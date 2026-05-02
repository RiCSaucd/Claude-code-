import {
  Env,
  Message,
  jsonResponse,
  errorResponse,
  crypto_randomUUID,
} from "../types.js";

interface TwilioResponse {
  sid: string;
  status: string;
  error_message?: string;
}

async function twilioSend(
  env: Env,
  to: string,
  body: string
): Promise<TwilioResponse> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
  const credentials = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);

  const form = new URLSearchParams({
    To: to,
    From: env.TWILIO_PHONE_NUMBER,
    Body: body,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const data = await res.json<TwilioResponse>();
  if (!res.ok) {
    throw new Error(data.error_message ?? `Twilio error ${res.status}`);
  }
  return data;
}

// ── POST /sms ─────────────────────────────────────────────────────────────────
export async function sendSms(request: Request, env: Env): Promise<Response> {
  let body: { contact_id: string; message: string };
  try {
    body = await request.json<{ contact_id: string; message: string }>();
  } catch {
    return errorResponse("Invalid JSON body");
  }

  if (!body.contact_id || !body.message) {
    return errorResponse("contact_id and message are required");
  }

  const contact = await env.DB.prepare(
    "SELECT id, phone FROM contacts WHERE id = ?"
  )
    .bind(body.contact_id)
    .first<{ id: string; phone: string | null }>();

  if (!contact) return errorResponse("Contact not found", 404);
  if (!contact.phone) return errorResponse("Contact has no phone number", 422);

  let twilioSid: string | null = null;
  let status = "sent";

  try {
    const tw = await twilioSend(env, contact.phone, body.message);
    twilioSid = tw.sid;
    status = tw.status;
  } catch (err) {
    status = "failed";
    console.error("Twilio error:", err);
  }

  const id = crypto_randomUUID();
  await env.DB.prepare(
    `INSERT INTO messages (id, contact_id, direction, body, twilio_sid, status)
     VALUES (?, ?, 'outbound', ?, ?, ?)`
  )
    .bind(id, body.contact_id, body.message, twilioSid, status)
    .run();

  const message = await env.DB.prepare(
    "SELECT * FROM messages WHERE id = ?"
  )
    .bind(id)
    .first<Message>();

  const httpStatus = status === "failed" ? 502 : 201;
  return jsonResponse({ success: status !== "failed", data: message }, httpStatus);
}

// ── GET /sms?contact_id=<id> ──────────────────────────────────────────────────
export async function listSms(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const contactId = url.searchParams.get("contact_id");

  if (!contactId) return errorResponse("contact_id query param is required");

  const { results } = await env.DB.prepare(
    "SELECT * FROM messages WHERE contact_id = ? ORDER BY sent_at DESC LIMIT 100"
  )
    .bind(contactId)
    .all<Message>();

  return jsonResponse({ success: true, data: results });
}
