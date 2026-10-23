# Vending CRM

A CRM for vending machine operators. See `CLAUDE.md` for the project brief and
`01_schema.sql` (plus the numbered change files) for the database.

Live at **https://crm.watwinvending.com.au** (Vercel, deployed from `main`).

## Run it on your computer

1. Copy `.env.example` to `.env.local` and fill in your Supabase URL and
   publishable (anon) key.
2. `npm install` (first time only)
3. `npm run dev`, then open http://localhost:3000
