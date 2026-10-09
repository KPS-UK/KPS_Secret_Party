// Undoing check-ins, for mistakes at the door and for clearing out testing.
// Only the checked-in status and time change: the guest, their response and
// their details are left exactly as they are.

// Undo one person's check-in. Returns their name, or null if there is no such guest.
export async function undoCheckIn(sql, email) {
  const rows = await sql`
    UPDATE guests
    SET attended = false, checked_in_at = NULL, updated_at = now()
    WHERE LOWER(email) = LOWER(${email})
    RETURNING name
  `;
  return rows.length ? rows[0].name : null;
}

// Undo every check-in. Returns how many people were checked in.
export async function clearCheckIns(sql) {
  const rows = await sql`
    UPDATE guests
    SET attended = false, checked_in_at = NULL, updated_at = now()
    WHERE attended IS TRUE
    RETURNING id
  `;
  return rows.length;
}
