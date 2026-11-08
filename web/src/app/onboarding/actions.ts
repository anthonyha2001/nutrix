"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { errorMessage, text, type ActionState } from "@/lib/action-result";
import { requireViewer } from "@/lib/session";

export async function createPractice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireViewer();
  const name = text(formData, "name");
  if (name.length < 2 || name.length > 80) return { error: "Practice name must be between 2 and 80 characters." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_practice", { p_name: name });
  if (error) return { error: errorMessage(error, "Couldn't create the practice. Please try again.") };
  redirect("/dashboard");
}
