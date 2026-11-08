// The public key: Supabase now calls it "publishable"; older projects say "anon".
// Accepts the names Supabase's dashboard and Vercel integration use, with or
// without NEXT_PUBLIC_ (the app only talks to Supabase from the server).
const publicKey = () =>
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY;
const projectUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

export function isSupabaseConfigured() {
  return Boolean(projectUrl() && publicKey());
}

export function supabasePublicKey() {
  return publicKey();
}

export function supabaseUrl() {
  const url = projectUrl();
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  return url;
}

export function supabaseAnonKey() {
  const key = publicKey();
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set");
  return key;
}

// supabase-js reports "couldn't reach the server" as a normal error with status 0,
// not as a thrown exception, so callers must check for it explicitly.
export function isUnreachable(error: { status?: number; name?: string } | null) {
  return Boolean(error && (error.status === 0 || error.name === "AuthRetryableFetchError"));
}

export const UNREACHABLE_MESSAGE =
  "Couldn't reach the Nutrix server. Check your connection and try again.";
