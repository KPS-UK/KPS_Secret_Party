import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getDb } from '../../../../lib/db';
import { isAdminRequest } from '../../../../lib/auth';

export async function GET(request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 401 });
  }

  const sql = getDb();
  const guests = await sql`
    SELECT name, email, role, organisation, attended, checked_in_at, source
    FROM guests
    ORDER BY name ASC
  `;

  const rows = guests.map((g) => ({
    name: g.name,
    email: g.email,
    role: g.role,
    organisation: g.organisation,
    attended: g.attended ? 'Yes' : 'No',
    checked_in_at: g.checked_in_at ? new Date(g.checked_in_at).toLocaleString('en-GB') : '',
    source: g.source,
  }));

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
