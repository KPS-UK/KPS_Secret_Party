import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getDb } from '../../../../lib/db';
import { isAdminRequest } from '../../../../lib/auth';

const REQUIRED_COLUMNS = ['name', 'email', 'role', 'organisation'];

function normaliseRow(row) {
  const result = {};
  for (const key of Object.keys(row)) {
    result[key.trim().toLowerCase()] = row[key];
  }
  return result;
}

export async function POST(request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!file) {
    return NextResponse.json({ error: 'No file was uploaded' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const sql = getDb();
  const errors = [];
  let added = 0;
  let updated = 0;

  for (let i = 0; i < rows.length; i++) {
    const normalised = normaliseRow(rows[i]);
    const missing = REQUIRED_COLUMNS.filter((c) => !(c in normalised));

    if (missing.length) {
      errors.push(`Row ${i + 2}: missing column(s) ${missing.join(', ')}`);
      continue;
    }

    const name = String(normalised.name).trim();
    const email = String(normalised.email).trim();

    if (!name || !email) {
      errors.push(`Row ${i + 2}: name and email are required`);
      continue;
    }

    const role = String(normalised.role || '').trim();
    const organisation = String(normalised.organisation || '').trim();

    const existing = await sql`SELECT id FROM guests WHERE LOWER(email) = LOWER(${email}) LIMIT 1`;

    if (existing.length) {
      await sql`
        UPDATE guests
        SET name = ${name}, role = ${role}, organisation = ${organisation}, updated_at = now()
        WHERE id = ${existing[0].id}
      `;
      updated += 1;
    } else {
      await sql`
        INSERT INTO guests (name, email, role, organisation, source)
        VALUES (${name}, ${email}, ${role}, ${organisation}, 'import')
      `;
      added += 1;
    }
  }

  return NextResponse.json({ added, updated, errors, totalRows: rows.length });
}
