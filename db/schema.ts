import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const bakeryProfiles = sqliteTable("bakery_profiles", {
  ownerId: text("owner_id").primaryKey(),
  businessName: text("business_name").notNull(),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  instagram: text("instagram").notNull().default(""),
  logoDataUrl: text("logo_data_url").notNull().default(""),
  updatedAt: text("updated_at").notNull(),
});

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  kind: text("kind").notNull().default("event"),
  orderStatus: text("order_status").notNull().default("enquiry"),
  orderDescription: text("order_description").notNull().default(""),
  quantity: integer("quantity").notNull().default(1),
  fulfillment: text("fulfillment").notNull().default("delivery"),
  fulfillmentTime: text("fulfillment_time").notNull().default(""),
  depositRequiredPaise: integer("deposit_required_paise").notNull().default(0),
  targetMarginPct: integer("target_margin_pct").notNull().default(30),
  name: text("name").notNull(),
  client: text("client").notNull().default(""),
  eventDate: text("event_date").notNull(),
  quotePaise: integer("quote_paise").notNull(),
  createdAt: text("created_at").notNull(),
  archivedAt: text("archived_at"),
});

export const budgets = sqliteTable("budgets", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  plannedPaise: integer("planned_paise").notNull(),
});

export const commitments = sqliteTable("vendor_commitments", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  vendor: text("vendor").notNull(),
  category: text("category").notNull(),
  agreedPaise: integer("agreed_paise").notNull(),
  dueOn: text("due_on").notNull(),
  createdAt: text("created_at").notNull(),
});

export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  commitmentId: text("commitment_id").references(() => commitments.id, { onDelete: "set null" }),
  category: text("category").notNull(),
  description: text("description").notNull(),
  amountPaise: integer("amount_paise").notNull(),
  spentOn: text("spent_on").notNull(),
  createdAt: text("created_at").notNull(),
});

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  amountPaise: integer("amount_paise").notNull(),
  receivedOn: text("received_on").notNull(),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull(),
});
