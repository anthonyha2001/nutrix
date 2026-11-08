import "server-only";
import { refresh } from "next/cache";
import type { ActionState } from "@/lib/action-result";

// A successful change: re-render the current page with fresh data, then
// report the message (shown as a toast).
export function done(message: string): ActionState {
  refresh();
  return { success: message };
}
