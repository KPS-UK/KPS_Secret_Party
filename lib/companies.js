// Groups organisation records into companies, and finds the companies that
// match what was typed.
//
// Two organisation records count as the same company when:
//   - one of them has an alternate name that matches the other's name
//     (ignoring case). For example, "DCC Vital" with the alternate name
//     "Williams Medical" is merged with the organisation "Williams Medical".
//   - or they share an alternate name. For example, "Milk & More" and
//     "MORECO GROUP LIMITED" both given the alternate name "MMO".
// Either way, one search returns everyone from both.
//
// An entry for an organisation with no guests at the moment (for example after
// its people were moved under another name) still works as a search term: if it
// shares a name with a company, its names are added to that company.

// orgRows:   [{ key (lower case name), organisation, guest_count }]
// aliasRows: [{ organisation, alias }]
export function buildCompanies(orgRows, aliasRows) {
  const byKey = new Map(orgRows.map((o) => [o.key, o]));
  const parent = new Map(orgRows.map((o) => [o.key, o.key]));

  function find(key) {
    let root = key;
    while (parent.get(root) !== root) root = parent.get(root);
    let current = key;
    while (parent.get(current) !== root) {
      const next = parent.get(current);
      parent.set(current, root);
      current = next;
    }
    return root;
  }

  function union(a, b) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootA, rootB);
  }

  const aliasesByOrg = new Map();
  const orgsByAlias = new Map();
  for (const row of aliasRows) {
    const orgKey = String(row.organisation).toLowerCase();
    // Ignore alternate names pointing at an organisation with no guests.
    if (!byKey.has(orgKey)) continue;

    if (!aliasesByOrg.has(orgKey)) aliasesByOrg.set(orgKey, []);
    aliasesByOrg.get(orgKey).push(row.alias);

    const aliasKey = String(row.alias).trim().toLowerCase();

    // An alternate name that is also the name of another organisation
    // means they are the same company, so merge them.
    if (aliasKey !== orgKey && byKey.has(aliasKey)) union(orgKey, aliasKey);

    if (!orgsByAlias.has(aliasKey)) orgsByAlias.set(aliasKey, []);
    orgsByAlias.get(aliasKey).push(orgKey);
  }

  // The same alternate name on more than one organisation links them.
  for (const owners of orgsByAlias.values()) {
    for (let i = 1; i < owners.length; i++) union(owners[0], owners[i]);
  }

  const groups = new Map();
  for (const org of orgRows) {
    const root = find(org.key);
    if (!groups.has(root)) groups.set(root, { members: [], names: [] });
    const group = groups.get(root);
    group.members.push(org);
    group.names.push(org.organisation, ...(aliasesByOrg.get(org.key) || []));
  }

  const companies = [...groups.values()].map((group) => {
    // Biggest organisation first, so it leads the label.
    group.members.sort(
      (a, b) => b.guest_count - a.guest_count || a.organisation.localeCompare(b.organisation)
    );
    return {
      label: group.members.map((m) => m.organisation).join(' / '),
      members: group.members.map((m) => m.organisation),
      names: group.names,
      guest_count: group.members.reduce((sum, m) => sum + m.guest_count, 0),
    };
  });

  // Entries for organisations that have no guests right now.
  const dormant = new Map();
  for (const row of aliasRows) {
    const orgKey = String(row.organisation).toLowerCase();
    if (byKey.has(orgKey)) continue;
    if (!dormant.has(orgKey)) dormant.set(orgKey, { name: row.organisation, aliases: [] });
    dormant.get(orgKey).aliases.push(row.alias);
  }
  for (const company of companies) {
    const known = new Set(company.names.map((n) => String(n).trim().toLowerCase()));
    for (const entry of dormant.values()) {
      if (entry.aliases.some((a) => known.has(String(a).trim().toLowerCase()))) {
        company.names.push(entry.name, ...entry.aliases);
      }
    }
  }

  return companies;
}

// Companies whose name or any alternate name contains what was typed,
// ignoring case. Exact matches come first.
export function matchCompanies(companies, query, limit = 5) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];

  return companies
    .filter((c) => c.names.some((n) => n.toLowerCase().includes(q)))
    .map((c) => ({
      organisation: c.label,
      members: c.members,
      guest_count: c.guest_count,
      exact_match: c.names.some((n) => n.trim().toLowerCase() === q),
    }))
    .sort(
      (a, b) =>
        Number(b.exact_match) - Number(a.exact_match) ||
        a.organisation.localeCompare(b.organisation)
    )
    .slice(0, limit);
}
