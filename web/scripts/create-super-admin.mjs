// Creates (or updates) a Nutrix platform super admin.
//
// Usage (from web/):
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SECRET_KEY=... ADMIN_PASSWORD=... \
//     node scripts/create-super-admin.mjs you@example.com "Your Name"
// The keys and the password are never stored in the repo: pass them in the
// environment when you run this. Run it again after a local `supabase db reset`.
import { createClient } from "@supabase/supabase-js";

const [email, fullName = ""] = process.argv.slice(2);
const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: key, ADMIN_PASSWORD: password } = process.env;
if (!email || !url || !key || !password) {
  console.error("Usage: SUPABASE_URL=... SUPABASE_SECRET_KEY=... ADMIN_PASSWORD=... node scripts/create-super-admin.mjs <email> [full name]");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;
let user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

if (user) {
  const { error } = await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  if (error) throw error;
  console.log(`Updated the password of ${email}`);
} else {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error) throw error;
  user = data.user;
  console.log(`Created ${email}`);
}

const { error } = await admin.from("platform_admins").upsert({ user_id: user.id }, { onConflict: "user_id" });
if (error) throw error;
console.log(`${email} is a Nutrix super admin. Log in and open /admin.`);
