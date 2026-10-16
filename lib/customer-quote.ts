import type { EventRecord } from "./finance";
import type { BakeryProfile } from "./business-profile";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function customerMoney(paise: number): string {
  return money.format(paise / 100);
}

export function profileContactLines(profile: BakeryProfile): string[] {
  return [profile.phone, profile.email, profile.instagram && `Instagram: ${profile.instagram}`].filter(Boolean);
}

export function customerDocumentTitle(order: EventRecord): string {
  return ["enquiry", "quoted"].includes(order.orderStatus) ? "Custom order quote" : "Order confirmation";
}

export function fulfillmentLabel(order: EventRecord): string {
  const date = new Date(`${order.eventDate}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const time = order.fulfillmentTime ? ` at ${new Date(`2000-01-01T${order.fulfillmentTime}:00`).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` : "";
  return `${order.fulfillment === "pickup" ? "Pickup" : "Delivery"} on ${date}${time}`;
}

export function customerAmounts(order: EventRecord) {
  const received = order.payments.reduce((sum, payment) => sum + payment.amountPaise, 0);
  return {
    received,
    balanceDue: Math.max(0, order.quotePaise - received),
    depositDue: Math.max(0, order.depositRequiredPaise - received),
  };
}

export function buildCustomerMessage(order: EventRecord, profile?: BakeryProfile): string {
  const amounts = customerAmounts(order);
  const lines = [
    ...(profile?.businessName ? [profile.businessName, ...profileContactLines(profile), ""] : []),
    `${customerDocumentTitle(order)}${order.client ? ` for ${order.client}` : ""}`,
    "",
    `Order: ${order.name}`,
    ...(order.orderDescription ? [`Details: ${order.orderDescription}`] : []),
    `Quantity: ${order.quantity}`,
    fulfillmentLabel(order),
    `Total price: ${customerMoney(order.quotePaise)}`,
    ...(order.depositRequiredPaise ? [`Deposit to confirm: ${customerMoney(order.depositRequiredPaise)}`] : []),
    ...(amounts.received ? [`Already paid: ${customerMoney(amounts.received)}`] : []),
    `Balance due: ${customerMoney(amounts.balanceDue)}`,
    ...(amounts.depositDue ? [`Deposit still due: ${customerMoney(amounts.depositDue)}`] : []),
    "",
    ["enquiry", "quoted"].includes(order.orderStatus) ? "Please reply to confirm these details." : "Thank you for your order.",
  ];
  return lines.join("\n");
}

export function customerWhatsAppUrl(order: EventRecord, profile?: BakeryProfile): string {
  return `https://wa.me/?text=${encodeURIComponent(buildCustomerMessage(order, profile))}`;
}
