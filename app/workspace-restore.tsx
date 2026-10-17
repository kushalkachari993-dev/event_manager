"use client";

import { useState, type ChangeEvent } from "react";
import { Check, Upload, X } from "lucide-react";
import { MAX_BACKUP_BYTES, type RestoreCounts, type RestoreSummary } from "../lib/workspace-restore";

type PreviewResponse = { summary?: RestoreSummary; previewToken?: string; error?: string };
const labels: { key: keyof RestoreCounts; label: string }[] = [
  { key: "events", label: "events" }, { key: "orders", label: "bakery orders" },
  { key: "budgets", label: "budgets" }, { key: "commitments", label: "supplier commitments" },
  { key: "expenses", label: "expenses" }, { key: "payments", label: "payments" },
];

export default function WorkspaceRestore({ close }: { close: () => void }) {
  const [fileName, setFileName] = useState("");
  const [fileText, setFileText] = useState("");
  const [summary, setSummary] = useState<RestoreSummary | null>(null);
  const [previewToken, setPreviewToken] = useState("");
  const [busy, setBusy] = useState<"preview" | "import" | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setSummary(null);
    setPreviewToken("");
    setError("");
    setFileText("");
    setFileName(file?.name ?? "");
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) { setError("Choose a backup smaller than 5 MB."); return; }
    try { setFileText(await file.text()); }
    catch { setError("Could not read this file. Please choose it again."); }
  }

  async function send(mode: "preview" | "import") {
    setBusy(mode);
    setError("");
    try {
      const response = await fetch(`/api/workspace-restore?mode=${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(mode === "import" ? { "X-Restore-Preview": previewToken } : {}) },
        body: fileText,
      });
      const data = await response.json() as PreviewResponse;
      if (!response.ok || !data.summary) throw new Error(data.error || "Could not read the backup.");
      if (mode === "preview") {
        if (!data.previewToken) throw new Error("Could not prepare the restore preview.");
        setSummary(data.summary);
        setPreviewToken(data.previewToken);
      } else {
        setSummary(data.summary);
        setDone(true);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not restore the backup.");
      if (mode === "import") { setSummary(null); setPreviewToken(""); }
    } finally { setBusy(null); }
  }

  const additions = summary ? Object.values(summary.toAdd).reduce((total, count) => total + count, 0) : 0;
  const canRestore = !!summary && !!previewToken && (additions > 0 || summary.profile === "restore");
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) close(); }}>
    <div className="modal compact workspace-restore-modal" role="dialog" aria-modal="true" aria-label="Restore workspace backup">
      <div className="modal-header"><div><span className="section-kicker">YOUR DATA</span><h2>Restore a workspace backup</h2><p>Add missing records from an Event Profit Watch JSON backup.</p></div><button type="button" className="icon-button" disabled={!!busy} onClick={close} aria-label="Close"><X size={20}/></button></div>
      {done ? <div className="workspace-restore-done"><Check size={24}/><h3>Backup restored</h3><p>Missing records were added. Your existing records and edits were kept.</p><button type="button" className="primary-button" onClick={() => window.location.reload()}>Reload workspace</button></div> : <>
        <div className="modal-body workspace-restore-body">
          <p className="workspace-restore-help">Choose a backup downloaded from this app. Preview it before restoring. Existing IDs are skipped, and missing costs or payments can be added to an existing record. Nothing is overwritten.</p>
          <div className="field"><label htmlFor="workspace-backup-file">Backup JSON file</label><input id="workspace-backup-file" type="file" accept=".json,application/json" disabled={!!busy} onChange={(event) => void selectFile(event)}/>{fileName && <small>Selected: {fileName}</small>}</div>
          {error && <div className="modal-error" role="alert">{error}</div>}
          {summary && <section className="workspace-restore-preview" aria-label="Restore preview">
            <strong>Preview before restoring</strong>
            <p>Backup created {new Date(summary.exportedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}. The file has {summary.inFile.events} {summary.inFile.events === 1 ? "event" : "events"} and {summary.inFile.orders} bakery {summary.inFile.orders === 1 ? "order" : "orders"}.</p>
            <div className="workspace-restore-counts">{labels.map(({ key, label }) => <div key={key}><span>{label}</span><strong>+{summary.toAdd[key]}</strong><small>{summary.alreadyPresent[key]} already present</small></div>)}</div>
            <p>{summary.profile === "restore" ? "Bakery business profile will be restored." : summary.profile === "keep-existing" ? "Your current bakery business profile will be kept." : "No bakery business profile is in this backup."}</p>
            {!canRestore && <p>Everything in this backup is already present. There is nothing new to restore.</p>}
          </section>}
          <p className="workspace-restore-help">The restore does not include pilot participation or feedback. Keep the original JSON file as your own copy.</p>
        </div>
        <div className="modal-actions"><button type="button" className="cancel-button" disabled={!!busy} onClick={close}>Cancel</button>{summary ? <button type="button" className="primary-button" disabled={!!busy || !canRestore} onClick={() => void send("import")}><Upload size={16}/>{busy === "import" ? "Restoring…" : "Restore missing data"}</button> : <button type="button" className="primary-button" disabled={!!busy || !fileText} onClick={() => void send("preview")}>{busy === "preview" ? "Checking…" : "Preview backup"}</button>}</div>
      </>}
    </div>
  </div>;
}
