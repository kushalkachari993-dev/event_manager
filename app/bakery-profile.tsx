"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { ImagePlus, Trash2, X } from "lucide-react";
import type { BakeryProfile } from "../lib/business-profile";

async function prepareLogo(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 3_000_000) {
    throw new Error("Choose a PNG, JPG, or WebP image under 3 MB.");
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const scale = Math.min(1, 256 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare this logo.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/webp", 0.8);
    if (dataUrl.length > 120_000) throw new Error("This logo is too detailed. Try a simpler or smaller image.");
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function BakeryProfileModal({ profile, close, saved }: {
  profile: BakeryProfile;
  close: () => void;
  saved: (profile: BakeryProfile) => void;
}) {
  const [form, setForm] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  function update(field: keyof BakeryProfile, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try { update("logoDataUrl", await prepareLogo(file)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not prepare this logo."); }
    finally { setUploading(false); event.target.value = ""; }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/bakery-profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json() as { profile?: BakeryProfile; error?: string };
      if (!response.ok || !data.profile) throw new Error(data.error || "Could not save your bakery profile.");
      saved(data.profile);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your bakery profile.");
    } finally { setSaving(false); }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <form className="modal bakery-profile-modal" onSubmit={(event) => void submit(event)} role="dialog" aria-modal="true" aria-label="Bakery business profile">
      <div className="modal-header"><div><span className="section-kicker">YOUR BAKERY</span><h2>Business profile</h2><p>These details appear on customer quotes and confirmations.</p></div><button type="button" className="icon-button" onClick={close} aria-label="Close"><X size={20}/></button></div>
      {error && <div className="modal-error" role="alert">{error}</div>}
      <div className="modal-body">
        <div className="field"><label htmlFor="bakery-name">Bakery name</label><input id="bakery-name" required maxLength={100} value={form.businessName} onChange={(event) => update("businessName", event.target.value)} placeholder="e.g. Asha's Bakes"/></div>
        <div className="two-fields"><div className="field"><label htmlFor="bakery-phone">Phone or WhatsApp <span>optional</span></label><input id="bakery-phone" type="tel" maxLength={40} value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="+91 98765 43210"/></div><div className="field"><label htmlFor="bakery-email">Email <span>optional</span></label><input id="bakery-email" type="email" maxLength={160} value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="hello@example.com"/></div></div>
        <div className="field"><label htmlFor="bakery-instagram">Instagram handle <span>optional</span></label><input id="bakery-instagram" maxLength={80} value={form.instagram} onChange={(event) => update("instagram", event.target.value)} placeholder="@yourbakery"/></div>
        <div className="field"><label htmlFor="bakery-logo">Logo <span>optional · PNG, JPG, or WebP</span></label><div className="logo-picker">{form.logoDataUrl ? <img src={form.logoDataUrl} alt="Bakery logo preview"/> : <span className="logo-placeholder"><ImagePlus size={24}/></span>}<div><input id="bakery-logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void upload(event)}/><small>Your logo is resized for the quote. It stays in your private profile.</small></div>{form.logoDataUrl && <button type="button" className="icon-button danger-icon" aria-label="Remove logo" onClick={() => update("logoDataUrl", "")}><Trash2 size={16}/></button>}</div></div>
      </div>
      <div className="modal-actions"><button type="button" className="cancel-button" onClick={close}>Cancel</button><button type="submit" className="primary-button" disabled={saving || uploading}>{saving ? "Saving…" : uploading ? "Preparing logo…" : "Save profile"}</button></div>
    </form>
  </div>;
}
