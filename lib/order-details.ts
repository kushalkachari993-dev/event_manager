import { toPaise, type Fulfillment } from "./finance";

export function parseOrderDetails(data: Record<string, unknown>, quotePaise: number) {
  const orderDescription = typeof data.orderDescription === "string" ? data.orderDescription.trim() : "";
  const quantity = data.quantity == null ? 1 : Number(data.quantity);
  const fulfillment = (data.fulfillment ?? "delivery") as Fulfillment;
  const fulfillmentTime = typeof data.fulfillmentTime === "string" ? data.fulfillmentTime : "";
  const depositRequiredPaise = toPaise(data.depositRequired ?? 0);
  const targetMarginPct = data.targetMarginPct == null ? 30 : Number(data.targetMarginPct);
  if (orderDescription.length > 1000 || !Number.isInteger(quantity) || quantity < 1 || quantity > 999
    || (fulfillment !== "pickup" && fulfillment !== "delivery")
    || (fulfillmentTime !== "" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(fulfillmentTime))
    || depositRequiredPaise === null || depositRequiredPaise > quotePaise
    || !Number.isInteger(targetMarginPct) || targetMarginPct < 0 || targetMarginPct > 100) return null;
  return { orderDescription, quantity, fulfillment, fulfillmentTime, depositRequiredPaise, targetMarginPct };
}
