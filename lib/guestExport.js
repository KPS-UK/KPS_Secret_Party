import { isKpsEmail } from './kps';

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

// One row per guest: their response, whether they checked in (and when), and
// whether they were on the guest list or registered at the door. The
// Attending / Can't Attend / Checked In columns use an X, like the client's
// sign up sheet, so the layout stays familiar.
export function guestExportRows(guests) {
  return guests.map((g) => {
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
      'Registered As': g.source === 'walk-in' ? 'Walk-in' : 'On the guest list',
      'KPS Staff': isKpsEmail(g.email) ? 'Yes' : '',
    };
  });
}
