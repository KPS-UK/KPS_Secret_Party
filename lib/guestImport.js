import * as XLSX from 'xlsx';

// Reads a guest list workbook and works out, for each person, their details
// and whether they are attending, can't attend, or haven't responded.
//
// Every sheet that has First Name, Last Name, Company Name and Email columns
// is read. What a sheet means depends on what it looks like:
//
//   - Has "Attending" / "Can't Attend" columns: an x in either column is the
//     person's response (the client sign up sheet).
//   - Has no such columns and its name contains "sign up" (for example
//     "All Sign Ups 24-09-26"): everyone listed is attending.
//   - Anything else: guest details only, no response recorded.
//
// The lists are merged: anyone on a sign up sheet OR marked Attending on the
// client sheet is attending.
//
// The client sheet's Company Name is sometimes wrong for a person (for example
// someone with an @arsenal.co.uk email listed under Milk & More), or spelled
// several ways. So the organisation goes by the work email: each person with a
// company email address takes the name their email domain's colleagues use.
// Names that belong to a different company (they fit another email domain in
// the file) are ignored when working that name out, and the hand-cleaned names
// on the sign up sheet count double. Personal emails (Gmail and so on) are
// left alone, sign up sheet names are never changed, and every correction is
// reported.
//
// People who appear more than once are merged into one:
//   - the same full name under two emails, where both emails fit the name
//     ("chris.pelling@epson.eu" and "cpelling@epson.eu"), including people who
//     signed up twice with a typo in their email;
//   - an abbreviated name with a similar email at the same company
//     ("Dwight P" and "Dwight Pampellone" at asos.com).
// The kept email is the sign up sheet's, else a company email over a personal
// one, else the one that fits the name best. A row whose name does not fit its
// email at all ("Matt Walburn" on helen.leahy@...) is renamed from the email
// when someone else with that name has an email that does fit. Every merge and
// rename is reported.
//
// The same person can be on the two lists under different emails (for example
// a work email on one and a company group email on the other). When someone
// who is not on a sign up sheet has exactly the same name as one person who
// is, they are treated as that one person: the sign up sheet's email is kept
// and the details are combined. If more than one person on the sign up sheet
// has that name, nothing is merged, as it is not clear who it is.
//
// People are matched by email, so someone on more than one sheet becomes one
// guest. Sign up sheets are read last, so their details (self-reported, and
// usually more complete) take priority over the client sheet.

const REQUIRED_COLUMNS = ['first name', 'last name', 'company name', 'email'];
const FIELDS = ['name', 'role', 'organisation', 'contactOwner', 'recordIdCompany', 'companyOwner'];

function normaliseKey(key) {
  return key
    .replace(/[\u2018\u2019]/g, "'") // curly single quotes -> straight, so "Can't Attend" matches however Excel saved it
    .trim()
    .toLowerCase()
    .replace(/_\d+$/, ''); // a repeated header such as "Company Name_1" counts as the same column
}

function clean(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

// Where a sheet repeats a column (this tracker has two company name columns),
// the later column wins, but only if it actually has a value in that row.
function normaliseRow(row) {
  const result = {};
  for (const key of Object.keys(row)) {
    const k = normaliseKey(key);
    if (!(k in result) || clean(row[key]) !== '') {
      result[k] = row[key];
    }
  }
  return result;
}

// Treat any non-blank, non-"0"/"false"/"no" cell as a cross/tick mark.
function isMarked(value) {
  const v = clean(value).toLowerCase();
  return v !== '' && v !== '0' && v !== 'false' && v !== 'no';
}

function classifySheet(sheetName, headers) {
  if (headers.has('attending') || headers.has("can't attend")) return 'responses';
  if (/sign[\s-]*ups?/i.test(sheetName)) return 'attending';
  return 'details';
}

// When two spellings differ only by capitalisation, keep the tidier one
// ("Kylie Andrew" rather than "kylie Andrew").
function nameScore(name) {
  const words = name.split(/\s+/).filter(Boolean);
  const capitalised = words.filter((w) => /^[A-Z]/.test(w)).length;
  const shouting = name === name.toUpperCase() && /[A-Z]/.test(name);
  return capitalised - (shouting ? 100 : 0);
}

function pickName(preferred, other) {
  if (!preferred) return other;
  if (!other) return preferred;
  if (preferred.toLowerCase() === other.toLowerCase() && nameScore(other) > nameScore(preferred)) {
    return other;
  }
  return preferred;
}

function mergeRecords(existing, incoming) {
  // The row that carries a response wins. If both do, or neither does, the
  // later row wins. Blanks are always filled from the other row.
  const preferIncoming = incoming.hasResponse || !existing.hasResponse;
  const merged = { ...existing };
  for (const field of FIELDS) {
    const first = preferIncoming ? incoming[field] : existing[field];
    const second = preferIncoming ? existing[field] : incoming[field];
    merged[field] = field === 'name' ? pickName(first, second) : first || second;
  }
  merged.attending = existing.attending || incoming.attending;
  merged.clientAttending = existing.clientAttending || incoming.clientAttending;
  merged.onList = existing.onList || incoming.onList;
  merged.declined = existing.declined || incoming.declined;
  merged.hasResponse = existing.hasResponse || incoming.hasResponse;
  return merged;
}

// ---- Company name corrections -------------------------------------------

const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'live.com',
  'live.co.uk', 'yahoo.com', 'yahoo.co.uk', 'icloud.com', 'me.com', 'aol.com', 'btinternet.com',
  'sky.com', 'msn.com', 'proton.me', 'protonmail.com',
]);
const SECOND_LEVEL_PARTS = new Set(['co', 'com', 'org', 'gov', 'ac', 'net', 'ltd', 'plc']);

// "cglines@arsenal.co.uk" -> "arsenal". Personal email providers give nothing.
function domainStem(email) {
  const host = String(email).split('@')[1] || '';
  if (!host || GENERIC_EMAIL_DOMAINS.has(host.toLowerCase())) return '';
  const parts = host.toLowerCase().split('.');
  parts.pop(); // the top level domain
  while (parts.length > 1 && SECOND_LEVEL_PARTS.has(parts[parts.length - 1])) parts.pop();
  return parts[parts.length - 1];
}

function squash(label) {
  return label.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
}

// Does this company name fit this email domain? "Milk & More" fits
// milkandmore, "Sysco Corporation" fits sysco.
function fitsDomain(label, stem) {
  const l = squash(label);
  if (!l || !stem) return false;
  return l === stem || (stem.length >= 4 && l.startsWith(stem)) || (l.length >= 4 && stem.startsWith(l));
}

// epson and epsonemear are the same family, so a name for one is not "another company".
function sameFamily(a, b) {
  return a === b || (Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a)));
}

// The name an email domain goes by: the most used among the people on that
// domain, ignoring names that belong to another company. Hand-cleaned sign up
// sheet names count double. Ties go to the more readable name ("Milk & More"
// over "Milkandmore").
function domainNames(people, stems) {
  const isAnotherCompany = (label, stem) =>
    [...stems].some((d) => fitsDomain(label, d) && !sameFamily(d, stem));

  const votes = new Map();
  for (const p of people) {
    if (!p.stem || !p.organisation || isAnotherCompany(p.organisation, p.stem)) continue;
    if (!votes.has(p.stem)) votes.set(p.stem, new Map());
    const names = votes.get(p.stem);
    names.set(p.organisation, (names.get(p.organisation) || 0) + (p.onList ? 2 : 1));
  }

  const readable = (label) => (/[ &]/.test(label) ? 0 : 1);
  const result = new Map();
  for (const [stem, names] of votes) {
    const best = [...names.entries()].sort(
      (a, b) => b[1] - a[1] || readable(a[0]) - readable(b[0]) || a[0].localeCompare(b[0])
    )[0][0];
    result.set(stem, best);
  }
  return result;
}

export function correctOrganisations(people) {
  const stems = new Set();
  for (const p of people) {
    p.stem = domainStem(p.email);
    if (p.stem) stems.add(p.stem);
  }

  // Work everything out from the original names first, then apply it.
  const nameFor = domainNames(people, stems);
  const corrections = [];
  for (const p of people) {
    if (p.onList || !p.stem) continue;
    const name = nameFor.get(p.stem);
    if (name && name.toLowerCase() !== (p.organisation || '').toLowerCase()) {
      corrections.push({ person: p, from: p.organisation || '', to: name });
    }
  }
  for (const c of corrections) c.person.organisation = c.to;

  return corrections.map((c) => ({
    name: c.person.name,
    email: c.person.email,
    from: c.from,
    to: c.to,
  }));
}

// ---- Same person under different emails ---------------------------------

const lettersOnly = (text) => String(text).toLowerCase().replace(/[^a-z]/g, '');
const nameKeyOf = (name) => name.toLowerCase().replace(/\s+/g, ' ').trim();

function nameWords(name) {
  return name.toLowerCase().split(/\s+/).map(lettersOnly).filter(Boolean);
}

// Does the first part of the email contain the person's name? "cpelling" fits
// "Chris Pelling". Needs a name word of 4+ letters to go on.
function emailFitsName(email, name) {
  const local = lettersOnly(String(email).split('@')[0]);
  return nameWords(name).some(
    (w) => w.length >= 4 && local.includes(w.slice(0, Math.min(w.length, 5)))
  );
}

// How many whole name words are in the email ("enyd.keer" beats "ekeer").
function nameWordsInEmail(email, name) {
  const local = lettersOnly(String(email).split('@')[0]);
  return nameWords(name).filter((w) => w.length >= 4 && local.includes(w)).length;
}

function nameFromEmail(email) {
  const m = String(email).split('@')[0].toLowerCase().match(/^([a-z]{2,})[._-]([a-z]{2,})$/);
  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
  return m ? `${cap(m[1])} ${cap(m[2])}` : '';
}

// "Matt Walburn" on helen.leahy@...: the name is wrong, not the person.
function correctNames(people) {
  const groups = new Map();
  for (const p of people) {
    const key = nameKeyOf(p.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const renamed = [];
  for (const group of groups.values()) {
    if (group.length < 2 || !group.some((p) => emailFitsName(p.email, p.name))) continue;
    for (const p of group) {
      if (p.onList || emailFitsName(p.email, p.name)) continue;
      const fixed = nameFromEmail(p.email);
      if (fixed) {
        renamed.push({ email: p.email, from: p.name, to: fixed });
        p.name = fixed;
      }
    }
  }
  return renamed;
}

// "Dwight P" and "Dwight Pampellone" at the same company.
function abbreviatedSameName(a, b) {
  const wa = nameWords(a.name);
  const wb = nameWords(b.name);
  if (wa.length < 2 || wb.length < 2 || wa[0] !== wb[0]) return false;
  const la = wa[wa.length - 1];
  const lb = wb[wb.length - 1];
  if (la === lb || !(la.startsWith(lb) || lb.startsWith(la))) return false;
  const sameCompany =
    (a.stem && a.stem === b.stem) ||
    (a.organisation && a.organisation.toLowerCase() === (b.organisation || '').toLowerCase());
  return Boolean(sameCompany);
}

function mergeSamePeople(people) {
  const parent = people.map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (i, j) => {
    const a = find(i);
    const b = find(j);
    if (a !== b) parent[b] = a;
  };

  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      const a = people[i];
      const b = people[j];
      const sameName =
        nameKeyOf(a.name) === nameKeyOf(b.name) &&
        emailFitsName(a.email, a.name) &&
        emailFitsName(b.email, b.name);
      if (sameName || abbreviatedSameName(a, b)) union(i, j);
    }
  }

  const sets = new Map();
  people.forEach((_, i) => {
    const root = find(i);
    if (!sets.has(root)) sets.set(root, []);
    sets.get(root).push(i);
  });

  const merged = [];
  const result = [];
  for (const indexes of sets.values()) {
    if (indexes.length === 1) {
      result.push({ at: indexes[0], person: people[indexes[0]] });
      continue;
    }
    const group = indexes.map((i) => people[i]);
    // The fullest name: most letters, then the tidiest capitalisation.
    const bestName = [...group]
      .map((p) => p.name)
      .sort((x, y) => lettersOnly(y).length - lettersOnly(x).length || nameScore(y) - nameScore(x))[0];

    const keeper = [...indexes]
      .map((i) => ({ i, p: people[i] }))
      .sort(
        (x, y) =>
          Number(!x.p.onList) - Number(!y.p.onList) ||
          Number(!x.p.stem) - Number(!y.p.stem) ||
          nameWordsInEmail(y.p.email, bestName) - nameWordsInEmail(x.p.email, bestName) ||
          Number(!x.p.attending) - Number(!y.p.attending) ||
          x.i - y.i
      )[0];

    // The kept email's own details win (its company, job title and so on),
    // with any blanks filled in from the other records. Responses are combined.
    const combined = { ...keeper.p };
    for (const i of indexes) {
      if (i === keeper.i) continue;
      const other = people[i];
      for (const field of FIELDS) combined[field] = combined[field] || other[field];
      combined.attending = combined.attending || other.attending;
      combined.clientAttending = combined.clientAttending || other.clientAttending;
      combined.declined = combined.declined || other.declined;
      combined.onList = combined.onList || other.onList;
      combined.hasResponse = combined.hasResponse || other.hasResponse;
      merged.push({ name: bestName, keptEmail: keeper.p.email, removedEmail: other.email });
    }
    combined.name = bestName;
    result.push({ at: Math.min(...indexes), person: combined });
  }

  result.sort((x, y) => x.at - y.at);
  return { people: result.map((r) => r.person), merged };
}

export function readGuestWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheets = [];
  const errors = [];
  const parsed = [];

  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
    if (rows.length === 0) {
      sheets.push({ name: sheetName, kind: 'skipped', rows: 0, note: 'no rows' });
      continue;
    }
    const headers = new Set(Object.keys(rows[0]).map(normaliseKey));
    const missing = REQUIRED_COLUMNS.filter((c) => !headers.has(c));
    if (missing.length) {
      sheets.push({
        name: sheetName,
        kind: 'skipped',
        rows: rows.length,
        note: `missing column(s) ${missing.join(', ')}`,
      });
      continue;
    }
    parsed.push({ name: sheetName, rows, kind: classifySheet(sheetName, headers) });
  }

  if (parsed.length === 0) {
    errors.push('No sheet had the required columns: First Name, Last Name, Company Name, Email');
  }

  // Sign up sheets last, so their details win where both sheets have a value.
  parsed.sort((a, b) => Number(a.kind === 'attending') - Number(b.kind === 'attending'));
  const hasConfirmedList = parsed.some((sheet) => sheet.kind === 'attending');

  const byEmail = new Map();
  let totalRows = 0;
  let duplicatesMerged = 0;

  for (const sheet of parsed) {
    sheets.push({ name: sheet.name, kind: sheet.kind, rows: sheet.rows.length });
    const seenInSheet = new Set();

    for (let i = 0; i < sheet.rows.length; i++) {
      totalRows += 1;
      const n = normaliseRow(sheet.rows[i]);

      const name = [clean(n['first name']), clean(n['last name'])].filter(Boolean).join(' ');
      const email = clean(n.email);
      if (!name || !email) {
        errors.push(`${sheet.name}, row ${i + 2}: first name/last name and email are required`);
        continue;
      }

      const clientAttending = sheet.kind === 'responses' && isMarked(n['attending']);
      const onList = sheet.kind === 'attending';
      const attending = onList || clientAttending;
      const declined = sheet.kind === 'responses' && isMarked(n["can't attend"]);

      const incoming = {
        email,
        name,
        role: clean(n['job title']),
        organisation: clean(n['company name']),
        contactOwner: clean(n['contact owner']),
        recordIdCompany: clean(n['record id - company']),
        companyOwner: clean(n['company owner']),
        attending,
        clientAttending,
        onList,
        declined,
        hasResponse: attending || declined,
      };

      const key = email.toLowerCase();
      const existing = byEmail.get(key);
      if (existing) {
        if (seenInSheet.has(key)) duplicatesMerged += 1;
        byEmail.set(key, mergeRecords(existing, incoming));
      } else {
        byEmail.set(key, incoming);
      }
      seenInSheet.add(key);
    }
  }

  // Fold anyone with the same name as a person on the sign up list into that
  // person, keeping the sign up list's email.
  const nameOf = (p) => p.name.toLowerCase().replace(/\s+/g, ' ').trim();
  const listEmailsByName = new Map();
  for (const p of byEmail.values()) {
    if (!p.onList) continue;
    const key = nameOf(p);
    listEmailsByName.set(key, [...(listEmailsByName.get(key) || []), p.email.toLowerCase()]);
  }
  const mergedPeople = [];
  for (const p of [...byEmail.values()]) {
    if (p.onList) continue;
    const targets = listEmailsByName.get(nameOf(p)) || [];
    if (targets.length !== 1) continue; // no match, or not clear who it is
    const target = byEmail.get(targets[0]);
    byEmail.set(targets[0], { ...mergeRecords(p, target), email: target.email });
    byEmail.delete(p.email.toLowerCase());
    mergedPeople.push({ name: target.name, keptEmail: target.email, removedEmail: p.email });
  }

  let people = [...byEmail.values()];

  const organisationCorrections = correctOrganisations(people);

  // Wrong names first, so a mislabelled row is not merged into someone else.
  const renamedPeople = correctNames(people);

  // The same person under different emails, merged into one.
  const sameness = mergeSamePeople(people);
  people = sameness.people;
  mergedPeople.push(...sameness.merged);

  // The same name under different emails is probably one person counted twice.
  // They are not merged automatically, as two different people can share a name.
  const byName = new Map();
  for (const p of people) {
    const nameKey = p.name.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!byName.has(nameKey)) byName.set(nameKey, []);
    byName.get(nameKey).push(p);
  }
  const possibleDuplicates = [...byName.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      name: group[0].name,
      emails: group.map((p) => p.email),
      attending: group.filter((p) => p.attending).length,
    }));

  // Attending only because the client sheet marks them, not because they are
  // on a sign up sheet. Where the same name IS on a sign up sheet under another
  // email, say so, as it is probably the same person counted twice.
  const clientOnly = hasConfirmedList
    ? people
        .filter((p) => p.clientAttending && !p.onList)
        .map((p) => {
          const nameKey = p.name.toLowerCase().replace(/\s+/g, ' ').trim();
          const listedAs = people
            .filter((q) => q.onList && q.name.toLowerCase().replace(/\s+/g, ' ').trim() === nameKey)
            .map((q) => q.email);
          return { name: p.name, email: p.email, organisation: p.organisation, listedAs };
        })
    : [];

  const records = people.map((p) => ({
    email: p.email,
    name: p.name,
    role: p.role,
    organisation: p.organisation,
    contactOwner: p.contactOwner,
    recordIdCompany: p.recordIdCompany,
    companyOwner: p.companyOwner,
    // Attending beats can't attend if the sheets disagree (see conflicts).
    rsvp: p.attending ? 'attending' : p.declined ? 'not_attending' : '',
  }));

  return {
    records,
    sheets,
    errors,
    totalRows,
    totalPeople: records.length,
    duplicatesMerged,
    hasConfirmedList,
    organisationCorrections,
    renamedPeople,
    mergedPeople,
    clientOnly,
    possibleDuplicates,
    conflicts: people.filter((p) => p.attending && p.declined).map((p) => `${p.name} (${p.email})`),
    summary: {
      attending: records.filter((r) => r.rsvp === 'attending').length,
      declined: records.filter((r) => r.rsvp === 'not_attending').length,
      noResponse: records.filter((r) => r.rsvp === '').length,
    },
  };
}
