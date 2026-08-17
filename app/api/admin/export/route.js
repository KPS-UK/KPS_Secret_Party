import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getDb } from '../../../../lib/db';
import { isAdminRequest } from '../../../../lib/auth';

// Simple, reversible-enough split: first word is the first name, everything
// else is the last name. Matches how the name was joined on import.
function splitName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/);
  if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) {
    return { firstName: '', lastName: '' };
  }
  const [firstName, ...rest] = parts;
  return { firstName, lastName: rest.join(' ') };
}

export async function GET(request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 401 });
  }

  const sql = getDb();
  // No filter on source here deliberately: this must include every guest in
  // the system (site-registered walk-ins included), not just the ones that
  // came from the last uploaded sheet.
  const guests = await sql`
    SELECT name, email, role, organisation, attended, checked_in_at, source,
           contact_owner, record_id_company, company_owner, rsvp_status
    FROM guests
    ORDER BY name ASC
  `;

  const rows = guests.map((g) => {
    const { firstName, lastName } = splitName(g.name);
    return {
      'First Name': firstName,
      'Last Name': lastName,
      'Company Name': g.organisation,
      Email: g.email,
      'Job Title': g.role,
      'Contact owner': g.contact_owner,
      'Record ID - Company': g.record_id_company,
      'Company owner': g.company_owner,
      Attending: g.rsvp_status === 'attending' ? 'X' : '',
      "Can't Attend": g.rsvp_status === 'not_attending' ? 'X' : '',
      'Checked In': g.attended ? 'X' : '',
      'Checked-in Time': g.checked_in_at ? new Date(g.checked_in_at).toLocaleString('en-GB') : '',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Guests');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="guest-list.xlsx"',
    },
  });
}