import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { buildCompanies, matchCompanies } from '../../../../lib/companies';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const orgNames = searchParams
    .getAll('org')
    .map((o) => o.trim().toLowerCase())
    .filter(Boolean);
  const sql = getDb();

  // One or more organisation names: return everyone at those organisations,
  // for the group check-in screen. A merged company passes all its names.
  if (orgNames.length > 0) {
    const guests = await sql`
      SELECT id, name, email, role, organisation, attended
      FROM guests
      WHERE LOWER(organisation) = ANY(${orgNames}::text[])
      ORDER BY name ASC
      LIMIT 500
    `;
    return NextResponse.json({ guests });
  }

  if (!q) {
    return NextResponse.json({ results: [], orgs: [] });
  }

  const pattern = '%' + q + '%';

  // Individual name matches, exactly as before.
  const results = await sql`
    SELECT id, name, email, role, organisation, attended
    FROM guests
    WHERE name ILIKE ${pattern}
    ORDER BY name ASC
    LIMIT 8
  `;

  // Companies matching by name or alternate name. Organisation records that
  // are linked by an alternate name are merged into one company, so there is
  // a single list for the name and its aliases.
  const orgRows = await sql`
    SELECT LOWER(organisation) AS key,
           MIN(organisation) AS organisation,
           COUNT(*)::int AS guest_count
    FROM guests
    WHERE organisation <> ''
    GROUP BY LOWER(organisation)
  `;
  const aliasRows = await sql`SELECT organisation, alias FROM organisation_aliases`;
  const orgs = matchCompanies(buildCompanies(orgRows, aliasRows), q);

  return NextResponse.json({ results, orgs });
}
