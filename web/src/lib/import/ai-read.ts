import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// AI reading for files without text (photos, scans). The model only
// TRANSCRIBES: it copies the result rows exactly as printed. It doesn't
// interpret, convert or compute anything; the same deterministic readers used
// for PDFs (lab-text.ts, body-comp.ts) then parse those lines, convert units
// and run every check. Used only when the platform admin has switched on
// "ai_document_import" and ANTHROPIC_API_KEY is set.

// Low budget by default (about 0.2 US cents a document); the stronger model is
// used only when the dietitian asks to read a document again.
export const AI_MODELS = { standard: "claude-haiku-5-5", strong: "claude-opus-5-5" } as const;

const Transcript = z.object({
  document_type: z.enum(["lab_report", "body_composition", "other"]),
  patient_name: z.string().nullable(),
  // Copied as printed, with its label, e.g. "Collected: 03/11/2026".
  date_lines: z.array(z.string()),
  // One entry per result row, copied exactly as printed (name, result, unit, reference range).
  result_lines: z.array(z.string()),
  unreadable: z.array(z.string()),
});
export type AiTranscript = z.infer<typeof Transcript>;

const SYSTEM = `You transcribe medical documents (lab reports and body composition printouts such as InBody or Tanita) for a dietitian, who checks every value against the original before anything is saved.

Reports may be in English, French or Arabic, or mix them. Keep the original language, script and digits: never translate.

Copy text exactly as printed. Do not interpret, correct, convert units, calculate, round, or fill in anything that is not printed. A wrong number is far worse than a missing one: if any character of a result is unclear (blur, glare, fold, handwriting), leave that row out and list its test name under "unreadable".

- result_lines: one entry per result row, in this order: test name, result, unit, reference range, exactly as printed and on one line, for example "LDL Cholesterol   3.4   mmol/L   < 3.4". For body composition, one entry per whole-body measurement, for example "Percent Body Fat 36.8 % (18.0 ~ 28.0)". Leave out segmental values (arms, legs, trunk), targets, control and history charts.
- date_lines: every line that contains a date, with its label, exactly as printed (collection, report, test or birth date).
- patient_name: the patient's name as printed, or null.
- document_type: "other" if this is not a lab report or a body composition result.`;

export type AiReadResult = { ok: true; transcript: AiTranscript; model: string } | { ok: false; error: string };

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function aiTranscribe(file: { data: Buffer; mediaType: string }, strength: keyof typeof AI_MODELS = "standard"): Promise<AiReadResult> {
  if (!aiConfigured()) return { ok: false, error: "AI reading isn't set up on this server." };
  const model = AI_MODELS[strength];
  const source =
    file.mediaType === "application/pdf"
      ? ({ type: "document", source: { type: "base64", media_type: "application/pdf", data: file.data.toString("base64") } } as const)
      : ({ type: "image", source: { type: "base64", media_type: file.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: file.data.toString("base64") } } as const);

  const client = new Anthropic({ maxRetries: 2, timeout: 90_000 });
  try {
    const response = await client.messages.parse({
      model,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { format: zodOutputFormat(Transcript) },
      messages: [{ role: "user", content: [source, { type: "text", text: "Transcribe this document." }] }],
    });
    if (response.stop_reason === "refusal") return { ok: false, error: "The document couldn't be read. Enter the values by hand." };
    if (response.stop_reason === "max_tokens" || !response.parsed_output) return { ok: false, error: "The document was too long to read in one go. Try one page at a time." };
    return { ok: true, transcript: response.parsed_output, model };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return { ok: false, error: "The AI key on the server isn't valid." };
    if (error instanceof Anthropic.RateLimitError) return { ok: false, error: "AI reading is busy. Try again in a minute." };
    if (error instanceof Anthropic.BadRequestError) return { ok: false, error: "This file couldn't be read. Try a clearer photo, or a PDF." };
    if (error instanceof Anthropic.APIError) return { ok: false, error: "AI reading failed. Try again." };
    return { ok: false, error: "AI reading isn't reachable right now." };
  }
}
