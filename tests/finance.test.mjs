import assert from "node:assert/strict";
import test from "node:test";
import { belowMarginTarget, categoriesFor, categoryForecast, isCategoryFor, metrics } from "../lib/finance.ts";
import { orderAttention } from "../lib/order-workflow.ts";
import { buildCustomerMessage, customerAmounts, customerDocumentTitle } from "../lib/customer-quote.ts";
import { parseBakeryProfile } from "../lib/business-profile.ts";
import { buildWorkspaceExport } from "../lib/workspace-export.ts";
import { parsePilotFeedback } from "../lib/pilot-feedback.ts";

test("pilot feedback accepts useful notes and rejects invalid scores or oversized text", () => {
  assert.deepEqual(parsePilotFeedback({ stage: "quote", easeScore: 2, blocker: "  I could not find the share button.  ", workedWell: "  Pricing was quick.  " }), {
    stage: "quote", easeScore: 2, blocker: "I could not find the share button.", workedWell: "Pricing was quick.",
  });
  assert.equal(parsePilotFeedback({ stage: "quote", easeScore: 0, blocker: "I could not find the share button.", workedWell: "" }), null);
  assert.equal(parsePilotFeedback({ stage: "unknown", easeScore: 2, blocker: "I could not find the share button.", workedWell: "" }), null);
  assert.equal(parsePilotFeedback({ stage: "quote", easeScore: 2, blocker: "too short", workedWell: "" }), null);
  assert.equal(parsePilotFeedback({ stage: "quote", easeScore: 2, blocker: "x".repeat(1201), workedWell: "" }), null);
});

function eventWith({ budget = 0, agreed = 0, vendorPayments = [], otherExpenses = [] } = {}) {
  return {
    id: "event", kind: "event", name: "Test event", client: "", eventDate: "2026-10-20", quotePaise: 50000,
    createdAt: "", archivedAt: null, payments: [],
    budgets: [{ category: "Flowers", plannedPaise: budget }],
    commitments: agreed ? [{ id: "vendor", vendor: "Florist", category: "Flowers", agreedPaise: agreed, dueOn: "2026-10-18" }] : [],
    expenses: [
      ...vendorPayments.map((amountPaise, index) => ({ id: `payment-${index}`, commitmentId: "vendor", category: "Flowers", description: "Vendor payment", amountPaise, spentOn: "2026-10-12" })),
      ...otherExpenses.map((amountPaise, index) => ({ id: `other-${index}`, commitmentId: null, category: "Flowers", description: "Other cost", amountPaise, spentOn: "2026-10-12" })),
    ],
  };
}

test("budget remains the floor until vendor and other costs exceed it", () => {
  const event = eventWith({ budget: 12000, agreed: 9000, otherExpenses: [1000] });
  assert.deepEqual(categoryForecast(event, "Flowers"), { budget: 12000, spent: 1000, unpaidCommitments: 9000, forecast: 12000 });
  assert.equal(metrics(event).projectedProfit, 38000);
});

test("partial vendor payments replace unpaid commitments without double counting", () => {
  const before = eventWith({ agreed: 12000 });
  const after = eventWith({ agreed: 12000, vendorPayments: [2000, 3000] });
  assert.equal(metrics(before).projectedCost, 12000);
  assert.equal(metrics(after).spent, 5000);
  assert.equal(metrics(after).unpaidCommitments, 7000);
  assert.equal(metrics(after).projectedCost, 12000);
});

test("overpayment and other spending increase forecast by actual expense", () => {
  const event = eventWith({ agreed: 12000, vendorPayments: [13000], otherExpenses: [500] });
  assert.equal(metrics(event).unpaidCommitments, 0);
  assert.equal(metrics(event).projectedCost, 13500);
});

test("bakery orders use ingredient costs without event-only categories", () => {
  const order = {
    ...eventWith(), kind: "bakery", quotePaise: 250000,
    budgets: [{ category: "Ingredients", plannedPaise: 80000 }, { category: "Packaging", plannedPaise: 10000 }],
    commitments: [{ id: "supplier", vendor: "Chocolate supplier", category: "Ingredients", agreedPaise: 110000, dueOn: "2026-10-18" }],
    expenses: [{ id: "box", commitmentId: null, category: "Packaging", description: "Cake box", amountPaise: 12000, spentOn: "2026-10-12" }],
  };
  assert.deepEqual(categoriesFor("bakery"), ["Ingredients", "Labour", "Packaging", "Delivery", "Overheads", "Other"]);
  assert.equal(isCategoryFor("Flowers", "bakery"), false);
  assert.equal(isCategoryFor("Ingredients", "event"), false);
  assert.equal(metrics(order).projectedCost, 122000);
  assert.equal(metrics(order).projectedProfit, 128000);
});

test("bakery delivery and payment attention follows the order stage", () => {
  const order = { ...eventWith(), kind: "bakery", orderStatus: "confirmed", eventDate: "2026-10-15", quotePaise: 50000 };
  assert.equal(orderAttention(order, "2026-10-13"), "due_soon");
  assert.equal(orderAttention({ ...order, eventDate: "2026-10-13" }, "2026-10-13"), "due_today");
  assert.equal(orderAttention({ ...order, eventDate: "2026-10-12" }, "2026-10-13"), "overdue");
  assert.equal(orderAttention({ ...order, orderStatus: "delivered" }, "2026-10-13"), "payment_due");
  assert.equal(orderAttention({ ...order, orderStatus: "delivered", payments: [{ amountPaise: 50000 }] }, "2026-10-13"), null);
  assert.equal(orderAttention({ ...order, archivedAt: "2026-10-13" }, "2026-10-13"), null);
  assert.equal(orderAttention({ ...order, kind: "event" }, "2026-10-13"), null);
});

test("customer quote includes order and payment details without internal finances", () => {
  const order = {
    ...eventWith({ budget: 60000, agreed: 70000 }), kind: "bakery", orderStatus: "quoted",
    name: "Birthday cake", client: "Asha", orderDescription: "Chocolate, 1 kg", quantity: 1,
    fulfillment: "pickup", fulfillmentTime: "16:30", quotePaise: 100000,
    depositRequiredPaise: 30000, targetMarginPct: 30,
    payments: [{ amountPaise: 10000 }],
  };
  const message = buildCustomerMessage(order);
  assert.equal(customerDocumentTitle(order), "Custom order quote");
  assert.deepEqual(customerAmounts(order), { received: 10000, balanceDue: 90000, depositDue: 20000 });
  assert.match(message, /Chocolate, 1 kg/);
  assert.match(message, /Pickup on/);
  assert.match(message, /Deposit still due/);
  assert.doesNotMatch(message, /profit|supplier|cost|margin|budget/i);
  assert.equal(customerDocumentTitle({ ...order, orderStatus: "confirmed" }), "Order confirmation");
  assert.equal(belowMarginTarget(100000, 75000, 30), true);
  assert.equal(belowMarginTarget(100000, 65000, 30), false);
});

test("bakery profile is validated and brands the customer message", () => {
  const profile = parseBakeryProfile({ businessName: "  Asha's Bakes  ", phone: "+91 98765 43210", email: "hello@example.com", instagram: "@ashasbakes", logoDataUrl: "" });
  assert.equal(profile?.businessName, "Asha's Bakes");
  assert.equal(parseBakeryProfile({ ...profile, businessName: "" }), null);
  assert.equal(parseBakeryProfile({ ...profile, logoDataUrl: "data:image/svg+xml;base64,PHN2Zz4=" }), null);
  const message = buildCustomerMessage({ ...eventWith(), kind: "bakery", orderStatus: "quoted", orderDescription: "Chocolate cake", quantity: 1, fulfillment: "pickup", fulfillmentTime: "", depositRequiredPaise: 0 }, profile);
  assert.match(message, /^Asha's Bakes\n\+91 98765 43210\nhello@example.com\nInstagram: @ashasbakes/);
  assert.doesNotMatch(message, /profit|supplier|cost|margin|budget/i);
});

test("full workspace export keeps archived records and nested transactions without owner IDs", () => {
  const record = { ...eventWith(), ownerId: "account-one", archivedAt: "2026-10-20T10:00:00.000Z" };
  const backup = buildWorkspaceExport({
    events: [record],
    budgets: [{ id: "budget-1", eventId: record.id, category: "Flowers", plannedPaise: 12000 }],
    commitments: [{ id: "vendor-1", eventId: record.id, vendor: "Florist", category: "Flowers", agreedPaise: 9000, dueOn: "2026-10-18", createdAt: "2026-10-12" }],
    expenses: [{ id: "cost-1", eventId: record.id, commitmentId: "vendor-1", category: "Flowers", description: "Deposit", amountPaise: 2000, spentOn: "2026-10-13", createdAt: "2026-10-13" }, { id: "foreign", eventId: "another-owner", amountPaise: 5000 }],
    payments: [{ id: "payment-1", eventId: record.id, amountPaise: 10000, receivedOn: "2026-10-14", note: "Client deposit", createdAt: "2026-10-14" }],
    bakeryProfile: { ownerId: "account-one", businessName: "Test Bakery", phone: "", email: "", instagram: "", logoDataUrl: "data:image/webp;base64,AA==", updatedAt: "2026-10-14" },
  }, "2026-10-14T12:00:00.000Z");
  assert.equal(backup.format, "event-profit-watch-workspace");
  assert.equal(backup.version, 1);
  assert.equal(backup.records[0].archivedAt, "2026-10-20T10:00:00.000Z");
  assert.equal(backup.records[0].budgets[0].plannedPaise, 12000);
  assert.equal(backup.records[0].commitments[0].agreedPaise, 9000);
  assert.equal(backup.records[0].expenses[0].commitmentId, "vendor-1");
  assert.equal(backup.records[0].payments[0].amountPaise, 10000);
  assert.equal(backup.bakeryProfile?.businessName, "Test Bakery");
  assert.equal(JSON.stringify(backup).includes("account-one"), false);
  assert.equal(JSON.stringify(backup).includes("another-owner"), false);
});
