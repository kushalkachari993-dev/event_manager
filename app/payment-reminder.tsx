"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle, X } from "lucide-react";
import { buildPaymentReminderMessage, customerAmounts, customerMoney, customerWhatsAppDraftUrl } from "../lib/customer-quote";
import type { BakeryProfile } from "../lib/business-profile";
import type { EventRecord } from "../lib/finance";

export default function PaymentReminder({ order, profile, close }: { order: EventRecord; profile: BakeryProfile; close: () => void }) {
  const [message, setMessage] = useState(() => buildPaymentReminderMessage(order, profile) ?? "");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const { balanceDue } = customerAmounts(order);

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setCopyError("");
    } catch {
      setCopyError("Could not copy automatically. Select the message above and copy it manually.");
    }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <div className="modal payment-reminder-modal" role="dialog" aria-modal="true" aria-label="Customer payment reminder">
      <div className="modal-header"><div><span className="section-kicker">CUSTOMER PAYMENT</span><h2>Remind customer</h2><p>{order.name} · {customerMoney(balanceDue)} remaining</p></div><button type="button" className="icon-button" onClick={close} aria-label="Close"><X size={20}/></button></div>
      <p className="payment-reminder-help">Review and edit this message before sharing. It includes only the order and payment amounts.</p>
      {copyError && <div className="modal-error" role="alert">{copyError}</div>}
      <div className="field"><label htmlFor="payment-reminder-message">Message</label><textarea id="payment-reminder-message" className="payment-reminder-message" value={message} onChange={(event) => { setMessage(event.target.value); setCopied(false); }} rows={9}/></div>
      <p className="payment-reminder-help">WhatsApp opens a draft. Choose your customer and press Send there. This app does not send the message for you.</p>
      <div className="modal-actions"><button type="button" className="cancel-button" onClick={close}>Close</button><button type="button" className="outline-button" disabled={!message.trim()} onClick={() => void copyMessage()}>{copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? "Copied" : "Copy message"}</button><a className={`primary-button${!message.trim() ? " disabled-link" : ""}`} href={message.trim() ? customerWhatsAppDraftUrl(message) : undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!message.trim()} onClick={(event) => { if (!message.trim()) event.preventDefault(); }}><MessageCircle size={16}/> Open WhatsApp draft</a></div>
    </div>
  </div>;
}
