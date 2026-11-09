import { sendScheduledWhatsApp } from "@/lib/whatsapp-events";

// Hourly, called by the database (pg_cron + pg_net, migration 20261115000000)
// with the shared CRON_SECRET: appointment reminders and package endings.
export async function POST(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await sendScheduledWhatsApp());
}
