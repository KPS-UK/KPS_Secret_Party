import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getDb } from '../../../../lib/db';
import { isAdminRequest } from '../../../../lib/auth';
import { isKpsEmail } from '../../../../lib/kps';

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

// The server runs in UTC, so say which timezone the event is in, otherwise
// check-in times come out an hour out during British Summer Time.
function formatTime(value) {
  return value ? new Date(value).toLocaleString('en-GB', { timeZone: 'Europe/London' }) : '';
}

function responseLabel(status) {
  if (status === 'attending') return 'Attending';
  if (status === 'not_attending') return "Can't attend";
  return 'No response';
}

function excelResponse(rows, sheetName, fileName) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  });
}

export async function GET(request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sql = getDb();

  // ?filter=checked-in: only the people who actually checked in on the day,
  // in the order they arrived.
  if (searchParams.get('filter') === 'checked-in') {
    const guests = await sql`
      SELECT name, email, role, organisation, checked_in_at, source,
             contact_owner, company_owner, rsvp_status
      FROM guests
      WHERE attended IS TRUE
      ORDER BY checked_in_at ASC, name ASC
    `;

    const rows = guests.map((g) => {
      const { firstName, lastName } = splitName(g.name);
      return {
        'First Name': firstName,
        'Last Name': lastName,
        'Company Name': g.organisation,
        Email: g.email,
        'Job Title': g.role,
        'Checked-in Time': formatTime(g.checked_in_at),
        Response: responseLabel(g.rsvp_status),
        'Registered As': g.source === 'walk-in' ? 'Walk-in' : 'On the guest list',
        'Contact owner': g.contact_owner,
        'Company owner': g.company_owner,
        'KPS Staff': isKpsEmail(g.email) ? 'Yes' : '',
      };
    });

    return excelResponse(rows, 'Checked in', 'checked-in-list.xlsx');
  }

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
      'Checked-in Time': formatTime(g.checked_in_at),
      'KPS Staff': isKpsEmail(g.email) ? 'Yes' : '',
    };
  });

  return excelResponse(rows, 'Guests', 'guest-list.xlsx');
}
