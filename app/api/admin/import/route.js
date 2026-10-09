import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { isAdminRequest } from '../../../../lib/auth';
import { readGuestWorkbook } from '../../../../lib/guestImport';
import { saveGuests } from '../../../../lib/saveGuests';

export async function POST(request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!file) {
    return NextResponse.json({ error: 'No file was uploaded' }, { status: 400 });
  }

  let parsed;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    parsed = readGuestWorkbook(buffer);
  } catch (err) {
    return NextResponse.json(
      { error: 'That file could not be read. Check it is an Excel file.' },
      { status: 400 }
    );
  }

  let result;
  try {
    result = await saveGuests(getDb(), parsed.records, {
      confirmedList: parsed.hasConfirmedList,
      merged: parsed.mergedPeople,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'The import stopped part way. It is safe to run it again.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    added: result.added,
    updated: result.updated,
    kpsDefaulted: result.kpsDefaulted,
    attendingReset: result.attendingReset,
    duplicatesRemoved: result.duplicatesRemoved.length,
    staleDuplicates: result.staleDuplicates,
    renamedPeople: parsed.renamedPeople,
    mergedPeople: parsed.mergedPeople,
    organisationCorrections: parsed.organisationCorrections,
    errors: parsed.errors,
    totalRows: parsed.totalRows,
    totalPeople: parsed.totalPeople,
    sheets: parsed.sheets,
    summary: parsed.summary,
    confirmedList: parsed.hasConfirmedList,
    clientOnly: parsed.clientOnly,
    duplicatesMerged: parsed.duplicatesMerged,
    possibleDuplicates: parsed.possibleDuplicates,
    conflicts: parsed.conflicts,
  });
}
