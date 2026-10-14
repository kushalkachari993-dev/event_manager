# Event Profit Watch

A small profit tracker for independent event decorators, with a custom-order bakery workspace in beta. Plan a quote or selling price, estimate costs, record spending and payments, and see projected profit before the work is finished.

[Live beta](https://event-profit-watch.kushalkachari993.chatgpt.site/)

## First-draft features

- Sign in with ChatGPT; each account sees only its own events.
- Create and edit events with a client, date, quote, and budgets for Flowers, Materials, Labour, Rentals, Transport, and Other.
- Add, correct, and remove expenses. The dashboard updates totals and category overruns.
- Archive events without deleting their records, then restore them when needed.
- Track agreed vendor commitments and their due dates before paying them. Link vendor payments to expense records; the forecast includes the unpaid amount without counting payments twice. Removing a commitment keeps its recorded expenses.
- View active spending, projected cost, profit, margin, and client balance due. Money with paise is shown exactly on the dashboard. Forecast cost uses the higher of planned budget or actual spending plus unpaid commitments in each category.
- Record client deposits and other payments, correct or remove entries, and see the balance due for each event. Payments are records of money received outside the app.
- Print or save an event financial report as PDF, or download the same figures and transaction lists as CSV.
- Switch to Bakery orders to price custom orders with Ingredients, Labour, Packaging, Delivery, Overheads, and Other cost estimates. Track supplier commitments, actual expenses, customer deposits and balances, and export an order report. Event and bakery records remain separate.
- Move bakery orders through Enquiry, Quoted, Confirmed, In production, Ready, and Delivered stages. See upcoming or overdue deliveries and delivered orders with balances still due. Stage and balance appear on the order report.
- Capture customer-facing order details, quantity, pickup or delivery time, and a deposit to confirm. Preview and print a customer quote/confirmation or copy a message for manual sharing; internal costs, suppliers, and profit stay out of both. Set a private minimum margin target and see a warning while pricing.
- Save a private bakery business profile with name, contact details, and an optional logo. Customer quotes, confirmations, and copied messages use that branding.
- Download a full JSON workspace export from Overview. It includes active and archived event and bakery records, budgets, commitments, expenses, payments, and the bakery profile. The app does not yet import backups.

This is an MVP for testing the workflow with decorators and custom-order bakeries. Bakery costs are entered per order; recipe-level ingredient costing and inventory are not yet included. The app also does not include receipts, payment collection, invoicing, or billing.

## Stack

Vinext/Next.js, React, TypeScript, Cloudflare Workers, Cloudflare D1, Drizzle ORM, and CSS. The app is hosted with OpenAI Sites. The tracked `.openai/hosting.json` retains the Site's deployment configuration; secrets and local runtime data are excluded from Git.

## Run locally

Requires Node.js 22.13 or newer. From the project directory:

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_vengeful_triton.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_outgoing_masked_marvel.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_useful_blonde_phantom.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0003_purple_corsair.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0004_broad_wonder_man.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0005_cultured_gunslinger.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0006_nostalgic_forge.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0007_early_vanisher.sql
npm run dev
```

Apply each migration only once to a given local database. Open `http://127.0.0.1:5173/signin-with-chatgpt?return_to=/` to use the local mock sign-in. The hosted app uses real ChatGPT sign-in.

## Checks

```sh
npx tsc --noEmit
npm test
npm run build
```

The API is in `app/api/`, the dashboard is in `app/dashboard.tsx`, the finance calculations are in `lib/finance.ts`, and the D1 schema and migrations are in `db/` and `drizzle/`.
