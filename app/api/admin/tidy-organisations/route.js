import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { isAdminRequest } from '../../../../lib/auth';
import { tidyOrganisations } from '../../../../lib/tidyOrganisations';

export async function POST(request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 401 });
  }

  try {
    const changes = await tidyOrganisations(getDb());
    return NextResponse.json({ changes });
  } catch (err) {
    return NextResponse.json(
      { error: 'The organisation names could not be updated. It is safe to try again.' },
      { status: 500 }
    );
  }
}
