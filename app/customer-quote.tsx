"use client";

import { useState } from "react";
import { Check, Copy, Printer, X } from "lucide-react";
import { buildCustomerMessage, customerAmounts, customerDocumentTitle, customerMoney, fulfillmentLabel, profileContactLines } from "../lib/customer-quote";
import type { BakeryProfile } from "../lib/business-profile";
import type { EventRecord } from "../lib/finance";

export default function CustomerQuoteModal({ order, profile, editProfile, close }: { order: EventRecord; profile: BakeryProfile; editProfile: () => void; close: () => void }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const amounts = customerAmounts(order);
  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(buildCustomerMessage(order, profile));
      setCopied(true);
      setCopyError("");
    } catch {
      setCopyError("Could not copy automatically. Use Print / Save PDF to share the quote.");
    }
  }
  return <div className="modal-backdrop customer-quote-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <div className="modal customer-quote-modal" role="dialog" aria-modal="true" aria-label="Customer quote preview">
      <div className="modal-header customer-quote-controls"><div><span className="section-kicker">CUSTOMER VIEW</span><h2>Preview before sharing</h2><p>This version leaves out your costs, suppliers, and profit.</p></div><button type="button" className="icon-button" onClick={close} aria-label="Close"><X size={20}/></button></div>
      {copyError && <div className="modal-error" role="alert">{copyError}</div>}
      {!profile.businessName && <div className="quote-profile-prompt customer-quote-controls" role="status"><span>Add your bakery name so customers know who sent this quote.</span><button type="button" className="text-button" onClick={editProfile}>Set up business profile</button></div>}
      <article className="customer-document">
        <header className="customer-document-header"><div className="customer-business"><div className="customer-business-heading">{profile.logoDataUrl && <img src={profile.logoDataUrl} alt="" className="customer-business-logo"/>}<strong className="customer-brand">{profile.businessName || "Your bakery"}</strong></div>{profileContactLines(profile).length > 0 && <p className="customer-business-contact">{profileContactLines(profile).map((line) => <span key={line}>{line}</span>)}</p>}<p>Prepared for {order.client || "your customer"}</p></div><div className="customer-document-label">{customerDocumentTitle(order)}</div></header>
        <div className="customer-document-main"><span className="section-kicker">YOUR CUSTOM ORDER</span><h1>{order.name}</h1>{order.orderDescription && <p className="customer-description">{order.orderDescription}</p>}
          <div className="customer-detail-grid"><div><span>Quantity</span><strong>{order.quantity}</strong></div><div><span>{order.fulfillment === "pickup" ? "Pickup" : "Delivery"}</span><strong>{fulfillmentLabel(order).replace(/^(Pickup|Delivery) on /, "")}</strong></div></div>
          <div className="customer-price"><span>Total price</span><strong>{customerMoney(order.quotePaise)}</strong></div>
          <div className="customer-amounts">{order.depositRequiredPaise > 0 && <div><span>Deposit to confirm</span><strong>{customerMoney(order.depositRequiredPaise)}</strong></div>}{amounts.received > 0 && <div><span>Already paid</span><strong>{customerMoney(amounts.received)}</strong></div>}<div><span>Balance due</span><strong>{customerMoney(amounts.balanceDue)}</strong></div>{amounts.depositDue > 0 && <div><span>Deposit still due</span><strong>{customerMoney(amounts.depositDue)}</strong></div>}</div>
          <p className="customer-document-footer">{customerDocumentTitle(order) === "Custom order quote" ? "Please confirm the order details and deposit with your bakery before production begins." : "Thank you for your order. Please keep this confirmation for your records."}</p>
        </div>
      </article>
      <div className="modal-actions customer-quote-controls"><button type="button" className="cancel-button" onClick={close}>Close</button><button type="button" className="outline-button" onClick={() => void copyMessage()}>{copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? "Copied" : "Copy message"}</button><button type="button" className="primary-button" onClick={() => window.print()}><Printer size={16}/> Print / Save PDF</button></div>
    </div>
  </div>;
}
