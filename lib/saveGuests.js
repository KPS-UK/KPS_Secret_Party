// Saves guests in a few batched queries rather than two queries per row, so
// a few hundred guests import in a second or two instead of risking a
// timeout. People are matched to existing guests by email (ignoring case).
//
// On an existing guest:
//   - Name is always taken from the file.
//   - Job title, company and owners are only replaced when the file has a
//     value, so a blank cell never wipes details already stored.
//   - A response is only replaced when the file has one, so importing a sheet
//     with no marks never erases responses already recorded.
//   - Check-in status and time are never touched.
//
// When the file has a sign up list (`confirmedList: true`), the file is the
// full picture of who is attending: anyone the app has as attending who is
// NOT attending in the file is set back to no response, because imports only
// add and update, so marks from an earlier import would otherwise linger.
// KPS staff are exempt.
//
// Two kinds of old record are removed. If the old record had been checked in
// at the door, that check-in is carried over to the kept record first, so
// nobody loses their check-in:
//   - people merged into one (same name, different emails) leave an old
//     record behind from earlier imports;
//   - older imported records of someone who is now in the file under a
//     different email (same full name, and only one person in the file has that
//     name). Records registered at the door are never touched.
//
// KPS staff are attending by default: after saving, anyone on a KPS email
// address with no response yet is set to attending. An explicit "can't
// attend" is never overridden.
import { kpsEmailPatterns } from './kps';

const CHUNK_SIZE = 400;

export async function saveGuests(sql, records, { confirmedList = false, merged = [] } = {}) {
  let added = 0;
  let updated = 0;

  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const chunk = records.slice(i, i + CHUNK_SIZE);
    const emails = chunk.map((r) => r.email);
    const names = chunk.map((r) => r.name);
    const roles = chunk.map((r) => r.role);
    const organisations = chunk.map((r) => r.organisation);
    const contactOwners = chunk.map((r) => r.contactOwner);
    const recordIds = chunk.map((r) => r.recordIdCompany);
    const companyOwners = chunk.map((r) => r.companyOwner);
    const rsvps = chunk.map((r) => r.rsvp);

    const updatedRows = await sql`
      UPDATE guests g
      SET name = v.name,
          role = COALESCE(NULLIF(v.role, ''), g.role),
          organisation = COALESCE(NULLIF(v.organisation, ''), g.organisation),
          contact_owner = COALESCE(NULLIF(v.contact_owner, ''), g.contact_owner),
          record_id_company = COALESCE(NULLIF(v.record_id_company, ''), g.record_id_company),
          company_owner = COALESCE(NULLIF(v.company_owner, ''), g.company_owner),
          rsvp_status = COALESCE(NULLIF(v.rsvp_status, ''), g.rsvp_status),
          updated_at = now()
      FROM unnest(
        ${emails}::text[], ${names}::text[], ${roles}::text[], ${organisations}::text[],
        ${contactOwners}::text[], ${recordIds}::text[], ${companyOwners}::text[], ${rsvps}::text[]
      ) AS v(email, name, role, organisation, contact_owner, record_id_company, company_owner, rsvp_status)
      WHERE LOWER(g.email) = LOWER(v.email)
      RETURNING g.id
    `;
    updated += updatedRows.length;

    const insertedRows = await sql`
      INSERT INTO guests (
        name, email, role, organisation,
        contact_owner, record_id_company, company_owner, rsvp_status, source
      )
      SELECT v.name, v.email, v.role, v.organisation,
             v.contact_owner, v.record_id_company, v.company_owner,
             NULLIF(v.rsvp_status, ''), 'import'
      FROM unnest(
        ${emails}::text[], ${names}::text[], ${roles}::text[], ${organisations}::text[],
        ${contactOwners}::text[], ${recordIds}::text[], ${companyOwners}::text[], ${rsvps}::text[]
      ) AS v(email, name, role, organisation, contact_owner, record_id_company, company_owner, rsvp_status)
      WHERE NOT EXISTS (SELECT 1 FROM guests g WHERE LOWER(g.email) = LOWER(v.email))
      RETURNING id
    `;
    added += insertedRows.length;
  }

  // Older imported records of people who are in the file under another email.
  const nameKey = (name) => String(name).toLowerCase().replace(/\s+/g, ' ').trim();
  let staleDuplicates = [];
  if (confirmedList) {
    const fileEmails = records.map((r) => r.email.toLowerCase());
    const emailsByName = new Map();
    for (const r of records) {
      const key = nameKey(r.name);
      emailsByName.set(key, [...(emailsByName.get(key) || []), r.email]);
    }
    const leftovers = await sql`
      SELECT name, email
      FROM guests
      WHERE source = 'import' AND NOT (LOWER(email) = ANY(${fileEmails}::text[]))
    `;
    const alreadyMerged = new Set(merged.map((m) => m.removedEmail.toLowerCase()));
    for (const g of leftovers) {
      if (alreadyMerged.has(g.email.toLowerCase())) continue;
      const owners = emailsByName.get(nameKey(g.name)) || [];
      if (owners.length === 1) {
        staleDuplicates.push({ name: g.name, keptEmail: owners[0], removedEmail: g.email });
      }
    }
  }

  // Remove the old records of people who have been merged into one.
  let duplicatesRemoved = [];
  const toRemove = [...merged, ...staleDuplicates];
  if (toRemove.length > 0) {
    const removedEmails = toRemove.map((m) => m.removedEmail.toLowerCase());
    const keptEmails = toRemove.map((m) => m.keptEmail.toLowerCase());

    await sql`
      UPDATE guests g
      SET attended = true,
          checked_in_at = COALESCE(g.checked_in_at, d.checked_in_at),
          updated_at = now()
      FROM guests d,
           unnest(${removedEmails}::text[], ${keptEmails}::text[]) AS m(removed_email, kept_email)
      WHERE LOWER(d.email) = m.removed_email
        AND LOWER(g.email) = m.kept_email
        AND d.attended IS TRUE
        AND g.attended IS NOT TRUE
    `;

    duplicatesRemoved = await sql`
      DELETE FROM guests
      WHERE LOWER(email) = ANY(${removedEmails}::text[])
      RETURNING name, email
    `;
  }

  // The file is the full picture: no one else stays marked as attending.
  let attendingReset = [];
  if (confirmedList) {
    const confirmedEmails = records
      .filter((r) => r.rsvp === 'attending')
      .map((r) => r.email.toLowerCase());
    attendingReset = await sql`
      UPDATE guests
      SET rsvp_status = NULL, updated_at = now()
      WHERE rsvp_status = 'attending'
        AND NOT (LOWER(email) = ANY(${confirmedEmails}::text[]))
        AND NOT (LOWER(email) LIKE ANY(${kpsEmailPatterns()}::text[]))
      RETURNING name, email, organisation
    `;
  }

  // KPS staff are attending unless they have said otherwise.
  const defaulted = await sql`
    UPDATE guests
    SET rsvp_status = 'attending', updated_at = now()
    WHERE rsvp_status IS NULL AND LOWER(email) LIKE ANY(${kpsEmailPatterns()}::text[])
    RETURNING id
  `;

  return {
    added,
    updated,
    kpsDefaulted: defaulted.length,
    attendingReset,
    duplicatesRemoved,
    staleDuplicates,
  };
}
