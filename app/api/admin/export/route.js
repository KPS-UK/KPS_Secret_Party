import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getDb } from '../../../../lib/db';
import { isAdminRequest } from '../../../../lib/auth';
import { guestExportRows } from '../../../../lib/guestExport';

export async function GET(request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 401 });
  }

  const sql = getDb();
  // No filter on source here deliberately: this must include every guest in
  // the system (door registrations included), not just the ones that came
  // from the last uploaded sheet.
  const guests = await sql`
    SELECT name, email, role, organisation, attended, checked_in_at, source,
           contact_owner, record_id_company, company_owner, rsvp_status
    FROM guests
    ORDER BY name ASC
  `;

  const worksheet = XLSX.utils.json_to_sheet(guestExportRows(guests));
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
