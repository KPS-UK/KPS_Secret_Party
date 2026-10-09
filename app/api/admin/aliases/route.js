import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { isAdminRequest } from '../../../../lib/auth';

export async function GET(request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 401 });
  }

  const sql = getDb();
  const aliases = await sql`
    SELECT id, organisation, alias
    FROM organisation_aliases
    ORDER BY organisation ASC, alias ASC
  `;
  // Every organisation currently in the guest list, to pick from.
  const organisations = await sql`
    SELECT DISTINCT organisation
    FROM guests
    WHERE organisation <> ''
    ORDER BY organisation ASC
  `;

  return NextResponse.json({
    aliases,
    organisations: organisations.map((o) => o.organisation),
  });
}

export async function POST(request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 401 });
  }

  const body = await request.json();
  const organisationInput = String(body.organisation || '').trim();
  // Several alternate names can be added at once, separated by commas,
  // semicolons or new lines.
  const aliasList = String(body.alias || '')
    .split(/[;,|\n]+/)
    .map((a) => a.trim())
    .filter(Boolean);

  if (!organisationInput || aliasList.length === 0) {
    return NextResponse.json(
      { error: 'Enter the organisation and at least one alternate name' },
      { status: 400 }
    );
  }

  const sql = getDb();

  // Store the organisation exactly as it is written in the guest list, so
  // the link still matches whatever casing was typed here.
  const found = await sql`
    SELECT organisation FROM guests
    WHERE LOWER(organisation) = LOWER(${organisationInput})
    LIMIT 1
  `;
  if (!found.length) {
    return NextResponse.json(
      { error: 'No guests found for that organisation. Pick one from the list.' },
      { status: 404 }
    );
  }
  const organisation = found[0].organisation;

  for (const alias of aliasList) {
    await sql`
      INSERT INTO organisation_aliases (organisation, alias)
      VALUES (${organisation}, ${alias})
      ON CONFLICT DO NOTHING
    `;
  }

  return NextResponse.json({ ok: true, organisation });
}

export async function DELETE(request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get('id'));

  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const sql = getDb();
  await sql`DELETE FROM organisation_aliases WHERE id = ${id}`;

  return NextResponse.json({ ok: true });
}
