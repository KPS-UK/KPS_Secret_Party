import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getDb } from '../../../../lib/db';
import { isAdminRequest } from '../../../../lib/auth';

const REQUIRED_COLUMNS = ['first name', 'last name', 'company name', 'email'];

function normaliseKey(key) {
  return key
    .replace(/[\u2018\u2019]/g, "'") // curly single quotes -> straight, so "Can't Attend" matches however Excel saved it
    .trim()
    .toLowerCase();
}

function normaliseRow(row) {
  const result = {};
  for (const key of Object.keys(row)) {
    result[normaliseKey(key)] = row[key];
  }
  return result;
}

// Treat any non-blank, non-"0"/"false"/"no" cell as a cross/tick mark.
function isMarked(value) {
  if (value === undefined || value === null) return false;
  const v = String(value).trim().toLowerCase();
  return v !== '' && v !== '0' && v !== 'false' && v !== 'no';
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

    const firstName = String(normalised['first name']).trim();
    const lastName = String(normalised['last name']).trim();
    const name = [firstName, lastName].filter(Boolean).join(' ').trim();
    const email = String(normalised.email).trim();

    if (!name || !email) {
      errors.push(`Row ${i + 2}: first name/last name and email are required`);
      continue;
    }

    const role = String(normalised['job title'] || '').trim();
    const organisation = String(normalised['company name'] || '').trim();
    const contactOwner = String(normalised['contact owner'] || '').trim();
    const recordIdCompany = String(normalised['record id - company'] || '').trim();
    const companyOwner = String(normalised['company owner'] || '').trim();

    let rsvpStatus = null;
    if (isMarked(normalised['attending'])) {
      rsvpStatus = 'attending';
    } else if (isMarked(normalised["can't attend"])) {
      rsvpStatus = 'not_attending';
    }

    const existing = await sql`SELECT id FROM guests WHERE LOWER(email) = LOWER(${email}) LIMIT 1`;

    if (existing.length) {
      await sql`
        UPDATE guests
        SET name = ${name},
            role = ${role},
            organisation = ${organisation},
            contact_owner = ${contactOwner},
            record_id_company = ${recordIdCompany},
            company_owner = ${companyOwner},
            rsvp_status = ${rsvpStatus},
            updated_at = now()
        WHERE id = ${existing[0].id}
      `;
      updated += 1;
    } else {
      await sql`
        INSERT INTO guests (
          name, email, role, organisation,
          contact_owner, record_id_company, company_owner, rsvp_status, source
        )
        VALUES (
          ${name}, ${email}, ${role}, ${organisation},
          ${contactOwner}, ${recordIdCompany}, ${companyOwner}, ${rsvpStatus}, 'import'
        )
      `;
      added += 1;
    }
  }

  return NextResponse.json({ added, updated, errors, totalRows: rows.length });
}