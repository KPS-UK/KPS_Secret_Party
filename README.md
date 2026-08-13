# KPS Secret Party - check-in app

A small Next.js app for checking guests in at the door, plus an admin screen
for importing and exporting the guest list. Built for Vercel and Neon.

## What it does

- Guests search for their name on their phone.
- If there's one match, they see their details and confirm or edit them.
- If there's more than one match, they pick from a short list first.
- If there's no match, they can register on the spot.
- Everyone lands on a welcome screen once they're checked in.
- Admins can import a spreadsheet of pre-registered guests and export the
  full list (including who attended and when) from a password protected
  `/admin` page.

## 1. Set up the database (Neon)

1. Create a project at [neon.tech](https://neon.tech) if you don't have one already.
2. Open the SQL editor for your project and run everything in `schema.sql`
   (in this folder). This creates the `guests` table.
3. Copy the connection string from the Neon dashboard (Connection Details,
   the one starting `postgres://`).

## 2. Set your environment variables

Copy `.env.example` to `.env.local` and fill in:

- `DATABASE_URL` - the Neon connection string from step 1.
- `ADMIN_PASSWORD` - the password for the `/admin` screen.
- `SESSION_SECRET` - any long random string, used to sign the admin session.

## 3. Run it locally

```
npm install
npm run dev
```

Then open `http://localhost:3000` for the check-in flow, and
`http://localhost:3000/admin` for import and export.

## 4. Deploy to Vercel

1. Push this folder to a GitHub repository (or use `vercel` CLI directly).
2. In Vercel, import the repository as a new project.
3. Under the project's Settings > Environment Variables, add the same three
   variables as above (`DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET`).
4. Deploy. That's it, no other configuration needed.

## Importing your guest list

On `/admin`, sign in with `ADMIN_PASSWORD`, then upload an `.xlsx` file with
these column headers (case doesn't matter):

| name | email | role | organisation |
|---|---|---|---|
| Sarah Chen | sarah.chen@kps.com | Marketing Manager | KPS |

Re-importing a file is safe: rows are matched by email, so existing guests
get their details updated rather than duplicated. Anyone who's already
checked in keeps their attended status and check-in time, even if the
spreadsheet row changes.

## Exporting

Also on `/admin`, "Download excel file" gives you every guest, whether they
came from the spreadsheet or registered on the night, with an attended
column and check-in timestamp.

## A note on the xlsx library

This app uses the `xlsx` (SheetJS) package from the public npm registry to
read and write spreadsheets. That package has a couple of known, unpatched
issues (denial of service and prototype pollution) tracked upstream. For an
internal one-night event tool this is a reasonable trade-off, but if you'd
rather remove the risk entirely, SheetJS publish a patched build directly
from their own site (see their GitHub releases) that you can install instead
of the npm version.

## Project structure

```
app/
  page.js              the guest-facing check-in flow
  admin/
    page.js             admin page (login or dashboard depending on session)
    AdminLogin.js
    AdminDashboard.js
  api/
    guests/
      search/route.js   GET  ?q=name -> matching guests
      checkin/route.js  POST confirm/edit a pre-registered guest
      register/route.js POST register a walk-in guest
    admin/
      login/route.js
      logout/route.js
      import/route.js    POST an .xlsx file -> upserts guests
      export/route.js    GET -> downloads an .xlsx file
lib/
  db.js                 Neon connection helper
  auth.js               admin password/session helpers
schema.sql               run this once in Neon's SQL editor
```
