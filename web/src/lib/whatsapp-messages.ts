// Ready-to-send WhatsApp messages for a patient, written from their file. The
// dietitian picks one, can edit it, and sends it from their own WhatsApp:
// nothing is sent automatically. Client-safe.

export type MessageContext = {
  firstName: string;
  practiceName: string;
  senderName: string | null;
  usesApp: boolean;
  // Each is present only when it applies to this patient right now.
  activePlan?: { name: string };
  nextAppointment?: { when: string; online: boolean };
  missedAppointment?: { when: string };
  daysSinceLog?: number;
  pkg?: { name: string; remaining: number; expires: string };
  balanceUsd?: number;
};

export type PreparedMessage = { id: string; label: string; text: string };

const sign = (c: MessageContext) => `\n\n${c.senderName ? `${c.senderName}, ` : ""}${c.practiceName}`;

export function preparedMessages(c: MessageContext): PreparedMessage[] {
  const hi = `Hi ${c.firstName},`;
  const out: PreparedMessage[] = [];

  if (c.nextAppointment) {
    out.push({
      id: "reminder",
      label: "Appointment reminder",
      text: `${hi} a reminder of your appointment on ${c.nextAppointment.when}${c.nextAppointment.online ? " (online)" : ""}. Reply here if you need to change it.${sign(c)}`,
    });
  }
  if (c.activePlan) {
    out.push({
      id: "plan",
      label: "Your plan is ready",
      text: c.usesApp
        ? `${hi} your meal plan "${c.activePlan.name}" is ready. Open the Nutrix app to see your meals and approved swaps for each day. Message me if anything is unclear.${sign(c)}`
        : `${hi} your meal plan "${c.activePlan.name}" is ready. I can send you the Nutrix app link so you have it on your phone, with your meals for each day.${sign(c)}`,
    });
  }
  if (c.missedAppointment) {
    out.push({
      id: "missed",
      label: "Missed appointment",
      text: `${hi} we missed you at your appointment on ${c.missedAppointment.when}. I hope everything is fine. Reply here and we'll find a new time.${sign(c)}`,
    });
  }
  if (c.usesApp && c.daysSinceLog !== undefined && c.daysSinceLog >= 3) {
    out.push({
      id: "nudge",
      label: "Haven't logged in a while",
      text: `${hi} I haven't seen your meals in the app for ${c.daysSinceLog} days. How is the plan going? Even a quick log of what you ate helps us adjust it together.${sign(c)}`,
    });
  }
  out.push({
    id: "checkin",
    label: "Check in",
    text: `${hi} just checking in. How are you finding the plan this week? Any meals that are hard to follow, or questions?${sign(c)}`,
  });
  if (c.usesApp) {
    out.push({
      id: "weigh",
      label: "Weigh-in reminder",
      text: `${hi} a quick reminder to record your weight in the Nutrix app this week, ideally in the morning before breakfast.${sign(c)}`,
    });
  }
  if (c.pkg && c.pkg.remaining <= 1) {
    out.push({
      id: "package",
      label: "Package ending",
      text:
        c.pkg.remaining <= 0
          ? `${hi} you've used all the consultations in your ${c.pkg.name}. Would you like to renew it at your next visit?${sign(c)}`
          : `${hi} you have 1 consultation left in your ${c.pkg.name} (valid until ${c.pkg.expires}). Would you like to renew it at your next visit?${sign(c)}`,
    });
  }
  if (c.balanceUsd && c.balanceUsd > 0) {
    out.push({
      id: "balance",
      label: "Balance due",
      text: `${hi} a friendly note that $${c.balanceUsd.toFixed(2).replace(/\.00$/, "")} is still due on your account. You can settle it at your next visit, by Whish or OMT. Thank you!${sign(c)}`,
    });
  }
  return out;
}
