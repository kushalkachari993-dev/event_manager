# Event Profit Watch

A small profit tracker for independent event decorators. Plan an event's quote and category budgets, record expenses as they happen, and see projected profit before the job is finished.

[Live beta](https://event-profit-watch.kushalkachari993.chatgpt.site/)

## First-draft features

- Sign in with ChatGPT; each account sees only its own events.
- Create and edit events with a client, date, quote, and budgets for Flowers, Materials, Labour, Rentals, Transport, and Other.
- Add, correct, and remove expenses. The dashboard updates totals and category overruns.
- Archive events without deleting their records, then restore them when needed.
- View active quoted value, spending, projected cost, profit, and margin. Forecast cost uses the higher of planned or actual spend in each category.
- Record client deposits and other payments, correct or remove entries, and see the balance due for each event. Payments are records of money received outside the app.
- Print or save an event financial report as PDF, or download the same figures and transaction lists as CSV.

This is an MVP for testing the workflow with decorators. It does not yet include receipts, payment collection, invoicing, or billing.

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
npm run dev
```

Apply each migration only once to a given local database. Open `http://127.0.0.1:5173/signin-with-chatgpt?return_to=/` to use the local mock sign-in. The hosted app uses real ChatGPT sign-in.

## Checks

```sh
npx tsc --noEmit
npm run build
```

The API is in `app/api/`, the dashboard is in `app/dashboard.tsx`, the finance calculations are in `lib/finance.ts`, and the D1 schema and migrations are in `db/` and `drizzle/`.
