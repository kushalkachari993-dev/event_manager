import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
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

export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
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
