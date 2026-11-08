import "server-only";
import { createClient } from "@/lib/supabase/server";

// People who can be responsible for patients (owner and dietitians).
export async function clinicians(practiceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("practice_users")
    .select("user_id, role, profiles(full_name, email)")
    .eq("practice_id", practiceId)
    .in("role", ["owner", "dietitian"]);
  return (data ?? [])
    .map((r) => ({ id: r.user_id, name: r.profiles?.full_name || r.profiles?.email || "Unnamed" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
