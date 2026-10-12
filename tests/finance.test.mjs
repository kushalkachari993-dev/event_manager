import assert from "node:assert/strict";
import test from "node:test";
import { categoryForecast, metrics } from "../lib/finance.ts";

function eventWith({ budget = 0, agreed = 0, vendorPayments = [], otherExpenses = [] } = {}) {
  return {
    id: "event", name: "Test event", client: "", eventDate: "2026-10-20", quotePaise: 50000,
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
