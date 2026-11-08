"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, FileUp, Sparkles } from "lucide-react";
import { Modal } from "@/components/dialog";
import { showToast } from "@/components/toaster";
import { Alert, Badge, Button, buttonClass, inputClass } from "@/components/ui";
import { BODY_FIELDS, type BodyField } from "@/lib/import/body-comp";
import { LAB_TESTS, labLabel } from "@/lib/labs";
import { readImportFile, saveImportedBody, saveImportedLabs, type ImportPreview } from "./import-actions";

type LabRow = { on: boolean; test: string; value: string; unit: string; line: string; warnings: string[] };
type BodyEdit = { on: boolean; date: string; values: Partial<Record<BodyField, string>>; calculated: BodyField[]; warnings: string[]; duplicate: boolean; name: string | null };

// Import lab results or body composition from a file. Every value is shown
// next to the original and must be approved before anything is saved.
export function ImportDialog({ patientId, firstName, fullName, aiEnabled, label = "Import" }: { patientId: string; firstName: string; fullName: string; aiEnabled: boolean; label?: string }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [labs, setLabs] = useState<LabRow[]>([]);
  const [body, setBody] = useState<BodyEdit[]>([]);
  const [date, setDate] = useState("");
  const [nameOk, setNameOk] = useState(false);
  const [reading, startRead] = useTransition();
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  function reset() {
    setFile(null);
    setUrl(null);
    setPreview(null);
    setLabs([]);
    setBody([]);
    setDate("");
    setNameOk(false);
    setError(null);
    if (input.current) input.current.value = "";
  }

  function read(f: File, strength: "standard" | "strong" = "standard") {
    setError(null);
    setNameOk(false);
    setFile(f);
    setUrl(/pdf|image/.test(f.type) ? URL.createObjectURL(f) : null);
    startRead(async () => {
      const fd = new FormData();
      fd.set("file", f.type.startsWith("image/") ? await shrinkImage(f) : f);
      fd.set("strength", strength);
      const p = await readImportFile(patientId, fd);
      setPreview(p);
      if (p.kind === "labs") {
        setDate(p.date ?? "");
        setLabs(p.labs.map((l) => ({ on: l.confident, test: l.test, value: String(l.value), unit: l.unit, line: l.line, warnings: l.warnings })));
      } else if (p.kind === "body") {
        setBody(
          p.rows.map((r) => ({
            on: r.confident,
            date: r.date ?? "",
            values: Object.fromEntries(Object.entries(r.values).map(([k, v]) => [k, String(v)])),
            calculated: r.calculated,
            warnings: r.warnings,
            duplicate: r.duplicate,
            name: r.name,
          })),
        );
      }
    });
  }

  const nameStatus = preview && (preview.kind === "labs" || preview.kind === "body") ? preview.name : null;
  const needsNameOk = nameStatus === "missing" || nameStatus === "partial";
  const ticked = preview?.kind === "labs" ? labs.filter((l) => l.on).length : body.filter((b) => b.on).length;
  const blocked =
    ticked === 0 ||
    (needsNameOk && !nameOk) ||
    (preview?.kind === "labs" && (!date || labs.some((l) => l.on && !(Number(l.value) >= 0 && l.value.trim() !== "")))) ||
    (preview?.kind === "body" && body.some((b) => b.on && !b.date));

  function save() {
    if (!preview || !file) return;
    setError(null);
    startSave(async () => {
      const r =
        preview.kind === "labs"
          ? await saveImportedLabs(patientId, {
              file: file.name,
              via: preview.via,
              rows: labs.filter((l) => l.on).map((l) => ({ test: l.test, value: Number(l.value.replace(",", ".")), unit: l.unit, date, line: l.line })),
            })
          : preview.kind === "body"
            ? await saveImportedBody(patientId, {
                file: file.name,
                via: preview.via,
                device: preview.device,
                rows: body
                  .filter((b) => b.on)
                  .map((b) => ({
                    date: b.date,
                    values: Object.fromEntries(
                      Object.entries(b.values)
                        .filter(([, v]) => v !== undefined && v.trim() !== "")
                        .map(([k, v]) => [k, Number(String(v).replace(",", "."))]),
                    ) as Partial<Record<BodyField, number>>,
                  })),
              })
            : { error: "Nothing to save." };
      if (r.error) return setError(r.error);
      showToast(r.success ?? "Saved");
      setOpen(false);
      reset();
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("secondary")}>
        <FileUp className="size-4" /> {label}
      </button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          reset();
        }}
        title={`Import for ${firstName}`}
        description="Values are read from the file and shown here for you to check. Nothing is saved until you approve."
        size="xl"
      >
        {!preview || reading ? (
          <div className="space-y-4">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-line px-4 py-10 text-center hover:border-ink/30">
              <FileUp className="size-6 text-muted" />
              <span className="font-medium">{reading ? "Reading the file…" : "Choose a file"}</span>
              <span className="text-sm text-muted">
                Lab report PDFs, and InBody or Tanita exports (CSV or Excel)
                {aiEnabled ? ", or a photo or scan (read by AI)" : ""}.
              </span>
              <input
                ref={input}
                type="file"
                accept={`.pdf,.csv,.xlsx,application/pdf,text/csv${aiEnabled ? ",image/jpeg,image/png,image/webp" : ""}`}
                className="sr-only"
                disabled={reading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) read(f);
                }}
              />
            </label>
            {!aiEnabled && <p className="text-xs text-muted">Photos and scanned paper need AI reading, which isn&apos;t switched on for your practice. Ask the lab for the digital PDF, or export from the device software.</p>}
          </div>
        ) : preview.kind === "error" ? (
          <div className="space-y-4">
            <Alert tone="error">{preview.message}</Alert>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={reset}>
                Choose another file
              </Button>
              {preview.canUseAi && file && (
                <Button type="button" variant="secondary" onClick={() => read(file, "strong")}>
                  <Sparkles className="size-4" /> Read with AI
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {/* The original, to compare with */}
            <div className="min-h-64 overflow-hidden rounded-xl border border-line bg-canvas lg:sticky lg:top-0 lg:max-h-[70vh]">
              {url && file?.type === "application/pdf" ? (
                <iframe src={url} title="Original document" className="h-[70vh] w-full" />
              ) : url ? (
                // eslint-disable-next-line @next/next/no-img-element -- a local preview of the chosen file (blob URL)
                <img src={url} alt="Original document" className="h-full max-h-[70vh] w-full object-contain" />
              ) : (
                <div className="p-5 text-sm text-muted">
                  <p className="font-medium text-ink">{file?.name}</p>
                  <p className="mt-1">Device export{preview.kind === "body" ? `, ${preview.rows.length} row${preview.rows.length === 1 ? "" : "s"}` : ""}.</p>
                  {preview.kind === "body" && preview.unmatched.length > 0 && <p className="mt-2 text-xs">Columns not imported: {preview.unmatched.join(", ")}.</p>}
                </div>
              )}
            </div>

            {/* What was read */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge tone={preview.via === "ai" ? "amber" : "green"}>{preview.via === "ai" ? "Read by AI" : preview.via === "file" ? "Copied from the device file" : "Read from the PDF text (no AI)"}</Badge>
                <span className="text-muted">{file?.name}</span>
              </div>

              {nameStatus === "match" && (
                <p className="flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
                  <CheckCircle2 className="size-4" /> {fullName}&apos;s name is on the document.
                </p>
              )}
              {needsNameOk && (
                <div className="space-y-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                  <p className="flex items-center gap-2 font-medium">
                    <AlertTriangle className="size-4" />
                    {nameStatus === "missing" ? `${fullName}'s name isn't on this document.` : `Only part of ${fullName}'s name is on this document.`}
                  </p>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={nameOk} onChange={(e) => setNameOk(e.target.checked)} className="accent-ink" /> I&apos;ve checked this document is {firstName}&apos;s.
                  </label>
                </div>
              )}

              {preview.kind === "labs" && (
                <>
                  <label className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">Date of the test</span>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} w-44`} />
                    {!preview.date && <span className="text-xs text-danger">Not found on the document: set it.</span>}
                  </label>
                  {preview.unreadable.length > 0 && <Alert tone="error">Couldn&apos;t be read clearly, so not included: {preview.unreadable.join(", ")}.</Alert>}
                  <ul className="divide-y divide-line rounded-xl border border-line">
                    {labs.map((l, i) => (
                      <li key={i} className={`space-y-2 px-3 py-3 ${l.on ? "" : "bg-canvas/60"}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <input type="checkbox" checked={l.on} onChange={(e) => setLabs((all) => all.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} aria-label="Save this result" className="accent-ink" />
                          <select
                            value={l.test}
                            onChange={(e) => setLabs((all) => all.map((x, j) => (j === i ? { ...x, test: e.target.value } : x)))}
                            aria-label="Test"
                            className="h-9 rounded-lg border border-line bg-surface px-2 text-sm"
                          >
                            {LAB_TESTS.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.label}
                              </option>
                            ))}
                            {!LAB_TESTS.some((t) => t.id === l.test) && <option value={l.test}>{labLabel(l.test)}</option>}
                          </select>
                          <input
                            value={l.value}
                            inputMode="decimal"
                            onChange={(e) => setLabs((all) => all.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                            aria-label="Value"
                            className="h-9 w-24 rounded-lg border border-line bg-surface px-2 text-right text-sm tabular-nums"
                          />
                          <input value={l.unit} onChange={(e) => setLabs((all) => all.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} aria-label="Unit" className="h-9 w-24 rounded-lg border border-line bg-surface px-2 text-sm" />
                        </div>
                        <p className="rounded-md bg-canvas px-2 py-1 font-mono text-xs text-muted">{l.line}</p>
                        {l.warnings.map((w) => (
                          <p key={w} className="flex items-start gap-1.5 text-xs text-amber-800">
                            <AlertTriangle className="mt-0.5 size-3 shrink-0" /> {w}
                          </p>
                        ))}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {preview.kind === "body" && (
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {body.map((b, i) => (
                    <li key={i} className={`space-y-2 px-3 py-3 ${b.on ? "" : "bg-canvas/60"}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <input type="checkbox" checked={b.on} onChange={(e) => setBody((all) => all.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} aria-label="Save this measurement" className="accent-ink" />
                        <input type="date" value={b.date} onChange={(e) => setBody((all) => all.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} aria-label="Date" className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" />
                        {b.name && <span className="text-sm text-muted">{b.name}</span>}
                        {b.duplicate && <Badge tone="gray">Already recorded</Badge>}
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {BODY_FIELDS.filter((f) => b.values[f.id] !== undefined).map((f) => (
                          <label key={f.id} className="text-xs text-muted">
                            {f.label}
                            {f.unit ? ` (${f.unit})` : ""}
                            {b.calculated.includes(f.id) && <span className="ml-1 text-amber-800">calculated</span>}
                            <input
                              value={b.values[f.id] ?? ""}
                              inputMode="decimal"
                              onChange={(e) => setBody((all) => all.map((x, j) => (j === i ? { ...x, values: { ...x.values, [f.id]: e.target.value } } : x)))}
                              className="mt-0.5 h-9 w-full rounded-lg border border-line bg-surface px-2 text-right text-sm text-ink tabular-nums"
                            />
                          </label>
                        ))}
                      </div>
                      {b.calculated.length > 0 && (
                        <p className="text-xs text-muted">
                          Calculated from the file: {b.calculated.map((c) => (c === "body_water_pct" ? "body water % = litres ÷ weight" : "body fat % = fat mass ÷ weight")).join("; ")}.
                        </p>
                      )}
                      {b.warnings.map((w) => (
                        <p key={w} className="flex items-start gap-1.5 text-xs text-amber-800">
                          <AlertTriangle className="mt-0.5 size-3 shrink-0" /> {w}
                        </p>
                      ))}
                    </li>
                  ))}
                </ul>
              )}

              <p className="text-xs text-muted">
                Unticked rows had something to check, or are already recorded. Tick a row only after comparing it with the original.
              </p>
              {error && <Alert tone="error">{error}</Alert>}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" onClick={reset}>
                    Choose another file
                  </Button>
                  {aiEnabled && file && preview.via !== "file" && (
                    <Button type="button" variant="ghost" onClick={() => read(file, "strong")} disabled={reading}>
                      <Sparkles className="size-4" /> Read again with the stronger AI
                    </Button>
                  )}
                </div>
                <Button type="button" onClick={save} disabled={saving || blocked}>
                  {saving ? "Saving…" : `Approve and save ${ticked || ""}`.trim()}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

// Phone photos are often several MB: send at most 2000 px on the long side
// (plenty to read a printout), as JPEG. Smaller files are sent as they are.
async function shrinkImage(file: File): Promise<File> {
  if (file.size < 1_500_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}
