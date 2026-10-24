# Vending CRM: project brief

## What this is
A multi-tenant CRM for vending machine operators in Australia. Each operator is an
"organization". Operator #1 is the owner of this project, who is NOT a developer.
Explain what you are doing in plain English, work in small steps, and tell me how to
test each step before moving on.

## Stack
- Next.js (App Router, TypeScript) with Tailwind CSS
- Supabase (Postgres, Auth, Row Level Security)
- Deployed on Vercel
- Mobile-friendly from the start (Fillers will use phones)

## Rules
1. The database schema is in `01_schema.sql`, plus later changes in numbered files
   (`02_placement_position.sql`, `03_team_invitations.sql`, `04_private_costs.sql`, `05_machine_faults.sql`, `06_customer_fault_reports.sql`, `07_qr_page_position.sql`, `08_auto_needs_repair.sql`, `09_client_commission.sql`, `10_archive_customers.sql`, `11_construction_site_type.sql`, `12_atomic_machine_moves.sql`, `13_website_leads.sql`, ...), all run in Supabase in order.
   Do not change table structure unless I ask. If you think it needs changing, explain why first.
2. Security is enforced by Row Level Security in the database. Never use the Supabase
   "service role" key in browser code. Never bypass RLS.
3. Never put secrets in the code. Use `.env.local` for keys, and make sure it is in `.gitignore`.
4. Australian formats: dates DD/MM/YYYY, currency AUD ($), ABN is 11 digits and ACN is
   9 digits (accept spaces when typing, store digits only).
5. Roles are `administrator`, `manager`, `warehouse`, `filler`. Hide screens a role
   cannot use, but remember the database is the real protection.
6. Commit to git after each working step with a clear message.

## Business rules
- A client (company) has many locations (sites). A location has many machines.
- Machines are numbered automatically (VM-001, VM-002...) by the database. Never reuse numbers.
- Moving a machine = close its current placement (set ended_on) and open a new one. Never overwrite history.
- Commission is paid to a client as one payment with one line per site. One client is paid per site
  (a separate payment per site, each with a single line).

## Milestone 1 (build in this order, stopping after each to let me test)
1. Project set-up, connect to Supabase, deploy a blank page to Vercel.
2. Sign up and log in. After sign-up, ask for the business name and call the
   `create_organization` database function.
3. Clients list and add/edit form.
4. Locations (belonging to a client) list and add/edit form.
5. Machines list and add form, showing the auto-generated machine number.
6. Place a machine at a location, and move it (placement history).

Contacts, commission payments, notes and inviting team members come after Milestone 1.
