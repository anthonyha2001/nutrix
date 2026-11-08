// Client-safe helpers for sharing links on WhatsApp (same as Gymix).

// Lebanese-style phone number to WhatsApp's international format:
// "71 123 456" / "03 123456" / "+961 71 123 456" / "00961…" -> "96171123456".
export function waNumber(phone: string | null | undefined) {
  let d = (phone ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("961")) return d;
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length === 7 || d.length === 8) return `961${d}`;
  return d.length >= 10 ? d : null;
}

export function whatsappUrl(phone: string | null | undefined, message: string) {
  const n = waNumber(phone);
  return `https://wa.me/${n ?? ""}?text=${encodeURIComponent(message)}`;
}

export function patientInviteMessage(firstName: string, practiceName: string, url: string) {
  return (
    `Hi ${firstName}, ${practiceName} has set up your Nutrix account.\n\n` +
    `See your meal plan and track your progress between visits.\n\n` +
    `Create your account with this email address: ${url}`
  );
}

export function staffInviteMessage(practiceName: string, roleLabel: string, url: string) {
  return `Hi, you've been invited to join ${practiceName} on Nutrix as ${roleLabel}.\n\nCreate your account here: ${url}`;
}
