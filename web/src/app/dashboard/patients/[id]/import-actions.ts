"use server";

import { readSheet } from "read-excel-file/node";
import { done } from "@/lib/done";
import { errorMessage, type ActionState } from "@/lib/action-result";
import { hasFeature } from "@/lib/features";
import { todayIn } from "@/lib/format";
import { aiConfigured, aiTranscribe } from "@/lib/import/ai-read";
import { BODY_FIELDS, parseCsv, readBodyComp, readBodyLines, type BodyField, type BodyRow } from "@/lib/import/body-comp";
import { nameCheck, readLabLines, reportDate, type LabCandidate } from "@/lib/import/lab-text";
import { pdfLines } from "@/lib/import/pdf-lines";
import { labTest } from "@/lib/labs";
import { CLINICAL_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/lib/supabase/database.types";

// Vercel accepts request bodies up to about 4.5 MB; photos are shrunk in the browser first.
const MAX_BYTES = 4 * 1024 * 1024;

export type ImportPreview =
  | {
      kind: "labs";
      file: string;
      via: "text" | "ai";
      model?: string;
      date: string | null;
      name: "match" | "partial" | "missing";
      labs: LabCandidate[];
      unreadable: string[];
    }
  | {
      kind: "body";
      file: string;
      via: "file" | "text" | "ai";
      model?: string;
      device: "inbody" | "tanita" | "manual";
      name: "match" | "partial" | "missing" | "none";
      rows: (BodyRow & { duplicate: boolean })[];
      unmatched: string[];
    }
  | { kind: "error"; message: string; canUseAi?: boolean };

async function canAccess(patientId: string) {
  const supabase = await createClient();
  const [{ data: patient }, { data: clinical }] = await Promise.all([
    supabase.from("patients").select("id, full_name").eq("id", patientId).maybeSingle(),
    supabase.rpc("can_see_clinical", { p_patient_id: patientId }),
  ]);
  return patient && clinical ? patient : null;
}

const cellText = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v === null || v === undefined ? "" : String(v));

// Reads a file and proposes values. Nothing is saved here.
export async function readImportFile(patientId: string, formData: FormData): Promise<ImportPreview> {
  const { membership } = await requireStaff(CLINICAL_ROLES);
  const patient = await canAccess(patientId);
  if (!patient) return { kind: "error", message: "Patient not found." };
  const file = formData.get("file");
  const strength = formData.get("strength") === "strong" ? "strong" : "standard";
  if (!(file instanceof File) || file.size === 0) return { kind: "error", message: "Choose a file." };
  if (file.size > MAX_BYTES) return { kind: "error", message: "The file is over 4 MB. Export a smaller PDF, or split it into pages." };
  const today = todayIn(membership.timezone);
  const name = file.name.slice(0, 200);
  const lower = name.toLowerCase();
  const data = Buffer.from(await file.arrayBuffer());
  const aiOn = (await hasFeature(membership.practiceId, "ai_document_import")) && aiConfigured();

  // Device exports: CSV or Excel.
  if (lower.endsWith(".csv") || lower.endsWith(".txt") || lower.endsWith(".xlsx")) {
    let table: string[][];
    try {
      table = lower.endsWith(".xlsx")
        ? (await readSheet(data)).map((row) => row.map(cellText))
        : parseCsv(data.toString("utf8"));
    } catch {
      return { kind: "error", message: "This file couldn't be opened. Export it again as CSV or Excel (.xlsx)." };
    }
    const body = readBodyComp(table, patient.full_name, today);
    if (body.error) return { kind: "error", message: body.error };
    const names = body.rows.map((r) => r.name).filter(Boolean) as string[];
    return {
      kind: "body",
      file: name,
      via: "file",
      device: body.device,
      name: names.length === 0 ? "none" : names.some((n) => nameCheck(n, patient.full_name) === "match") ? "match" : "missing",
      rows: await markDuplicates(patientId, body.rows),
      unmatched: body.unmatched,
    };
  }

  const isPdf = file.type === "application/pdf" || lower.endsWith(".pdf");
  const isImage = /^image\/(jpeg|png|webp|gif)$/.test(file.type);
  if (!isPdf && !isImage) return { kind: "error", message: "Use a PDF, a CSV or Excel export, or a photo (JPEG or PNG)." };

  // A PDF with real text is read without AI, unless the dietitian asked for the stronger AI reading.
  let lines: string[] = [];
  let via: "text" | "ai" = "text";
  let model: string | undefined;
  let docName: string | null = null;
  let unreadable: string[] = [];
  let docType: "lab_report" | "body_composition" | "other" | null = null;
  if (isPdf && formData.get("strength") !== "strong") {
    try {
      const pdf = await pdfLines(new Uint8Array(data));
      if (!pdf.scanned) lines = pdf.lines;
    } catch {
      return { kind: "error", message: "This PDF couldn't be opened." };
    }
  }
  if (!lines.length) {
    if (!aiOn) {
      return {
        kind: "error",
        message: isImage
          ? "Photos need AI reading, which is switched off. Ask the lab or device for a PDF, CSV or Excel file, or enter the values by hand."
          : "This PDF is a scan (it has no text), so it needs AI reading, which is switched off. Ask the lab for the digital PDF, or enter the values by hand.",
      };
    }
    const ai = await aiTranscribe({ data, mediaType: isPdf ? "application/pdf" : file.type }, strength);
    if (!ai.ok) return { kind: "error", message: ai.error };
    if (ai.transcript.document_type === "other") return { kind: "error", message: "This doesn't look like a lab report or a body composition result." };
    lines = [...ai.transcript.date_lines, ...ai.transcript.result_lines];
    via = "ai";
    model = ai.model;
    docName = ai.transcript.patient_name;
    unreadable = ai.transcript.unreadable;
    docType = ai.transcript.document_type;
  }

  const date = reportDate(lines, today);
  const name_ = docName ? nameCheck(docName, patient.full_name) : nameCheck(lines.join("\n"), patient.full_name);
  const labs = docType === "body_composition" ? [] : readLabLines(lines);
  if (labs.length && docType !== "body_composition") {
    // AI-read values are never ticked in advance: each is compared with the original first.
    if (via === "ai") for (const l of labs) { l.confident = false; l.warnings.unshift("Read by AI: compare with the original."); }
    return { kind: "labs", file: name, via, model, date, name: name_, labs, unreadable };
  }
  const body = readBodyLines(lines, patient.full_name, docName, date, today);
  if (body.rows.length) {
    const rows = await markDuplicates(patientId, body.rows);
    if (via === "ai") for (const r of rows) { r.confident = false; r.warnings.unshift("Read by AI: compare with the original."); }
    return { kind: "body", file: name, via, model, device: "manual", name: name_, rows, unmatched: [] };
  }
  return {
    kind: "error",
    message: "No lab results or body composition values were recognised in this document. Enter them by hand, or send the file to support so its format can be added.",
    canUseAi: aiOn && via === "text",
  };
}

// A row already recorded (same date and weight) is shown but not ticked.
async function markDuplicates(patientId: string, rows: BodyRow[]) {
  const dates = [...new Set(rows.map((r) => r.date).filter(Boolean))] as string[];
  const { data: existing } = dates.length
    ? await (await createClient()).from("measurements").select("measured_on, weight_kg").eq("patient_id", patientId).in("measured_on", dates)
    : { data: [] };
  return rows.map((r) => {
    const duplicate = (existing ?? []).some((e) => e.measured_on === r.date && (r.values.weight_kg === undefined || Number(e.weight_kg) === r.values.weight_kg));
    return { ...r, duplicate, confident: r.confident && !duplicate };
  });
}

// ---- Saving what the dietitian approved. Everything is checked again here.

type LabSave = { test: string; value: number; unit: string; date: string; line: string };

export async function saveImportedLabs(patientId: string, payload: { file: string; via: "text" | "ai"; rows: LabSave[] }): Promise<ActionState> {
  const { viewer, membership } = await requireStaff(CLINICAL_ROLES);
  if (!(await canAccess(patientId))) return { error: "Patient not found." };
  const today = todayIn(membership.timezone);
  const rows = (payload.rows ?? []).slice(0, 60);
  if (!rows.length) return { error: "Tick at least one result to save." };
  for (const r of rows) {
    if (!r.test || r.test.length > 60) return { error: "A result has no test name." };
    if (!Number.isFinite(r.value) || r.value < 0 || r.value >= 1_000_000) return { error: `Check the value of ${labTest(r.test)?.label ?? r.test}.` };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || r.date > today) return { error: "Set the date of the test (not in the future)." };
  }
  const { error } = await (await createClient()).from("lab_results").insert(
    rows.map((r) => ({
      patient_id: patientId,
      test: r.test,
      value: r.value,
      unit: String(r.unit ?? "").slice(0, 20),
      measured_on: r.date,
      source: payload.via === "ai" ? ("ai_import" as const) : ("import" as const),
      source_file: String(payload.file ?? "").slice(0, 200) || null,
      source_line: String(r.line ?? "").slice(0, 300) || null,
      note: payload.via === "ai" ? "Imported (read by AI, checked by the dietitian)" : "Imported from a file",
      created_by: viewer.id,
    })),
  );
  return error ? { error: errorMessage(error, "Couldn't save the results.") } : done(`${rows.length} lab result${rows.length > 1 ? "s" : ""} saved`);
}

type BodySave = { date: string; values: Partial<Record<BodyField, number>> };

export async function saveImportedBody(patientId: string, payload: { file: string; via: "file" | "text" | "ai"; device: "inbody" | "tanita" | "manual"; rows: BodySave[] }): Promise<ActionState> {
  const { viewer, membership } = await requireStaff(CLINICAL_ROLES);
  if (!(await canAccess(patientId))) return { error: "Patient not found." };
  const today = todayIn(membership.timezone);
  const rows = (payload.rows ?? []).slice(0, 200);
  if (!rows.length) return { error: "Tick at least one measurement to save." };
  const insert: TablesInsert<"measurements">[] = [];
  for (const r of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || r.date > today) return { error: "Set the date of each measurement (not in the future)." };
    const row: Partial<Record<BodyField, number>> = {};
    for (const f of BODY_FIELDS) {
      const v = r.values?.[f.id];
      if (v === undefined || v === null) continue;
      if (!Number.isFinite(v) || v < f.min || v > f.max) return { error: `${f.label} ${v} is outside the possible range.` };
      row[f.id] = f.id === "bmr_kcal" ? Math.round(v) : Math.round(v * 10) / 10;
    }
    if (!Object.keys(row).length) continue;
    const source: "inbody" | "tanita" | "manual" = payload.device === "inbody" || payload.device === "tanita" ? payload.device : "manual";
    insert.push({
      patient_id: patientId,
      measured_on: r.date,
      ...row,
      source,
      notes: payload.via === "ai" ? "Imported (read by AI, checked by the dietitian)" : `Imported from ${String(payload.file ?? "a file").slice(0, 120)}`,
      recorded_by: viewer.id,
    });
  }
  if (!insert.length) return { error: "Nothing to save." };
  const { error } = await (await createClient()).from("measurements").insert(insert);
  return error ? { error: errorMessage(error, "Couldn't save the measurements.") } : done(`${insert.length} measurement${insert.length > 1 ? "s" : ""} saved`);
}
