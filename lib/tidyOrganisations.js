import { correctOrganisations } from './guestImport';

// Sets each guest's company from their work email, for guests already in the
// app (no file needed). It is the same rule the import uses: each person with a
// company email address takes the name their email domain goes by, ignoring
// names that belong to another company. Personal emails (Gmail and so on) are
// left alone. Returns the people who were changed.
//
// Unlike the import, this cannot tell which names were hand-cleaned on the
// sign up sheet, so it treats every guest the same.
export async function tidyOrganisations(sql) {
  const guests = await sql`SELECT name, email, organisation FROM guests`;
  const people = guests.map((g) => ({
    name: g.name,
    email: g.email,
    organisation: g.organisation || '',
    onList: false,
  }));

  const changes = correctOrganisations(people);

  if (changes.length > 0) {
    const emails = changes.map((c) => c.email);
    const organisations = changes.map((c) => c.to);
    await sql`
      UPDATE guests g
      SET organisation = v.organisation, updated_at = now()
      FROM unnest(${emails}::text[], ${organisations}::text[]) AS v(email, organisation)
      WHERE LOWER(g.email) = LOWER(v.email)
    `;
  }

  return changes;
}
