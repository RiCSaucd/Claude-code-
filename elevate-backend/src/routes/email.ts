import {
  Env,
  Email,
  jsonResponse,
  errorResponse,
  crypto_randomUUID,
} from "../types.js";

interface ResendResponse {
  id: string;
}

async function resendSend(
  env: Env,
  to: string,
  subject: string,
  html: string
): Promise<ResendResponse> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Elevate CRM <noreply@elevate.app>",
      to: [to],
      subject,
      html,
    }),
  });

  const data = await res.json<ResendResponse & { message?: string }>();
  if (!res.ok) {
    throw new Error(data.message ?? `Resend error ${res.status}`);
  }
  return data;
}

// ── POST /email ───────────────────────────────────────────────────────────────
export async function sendEmail(request: Request, env: Env): Promise<Response> {
  let body: { contact_id: string; subject: string; body_html: string };
  try {
    body = await request.json<{
      contact_id: string;
      subject: string;
      body_html: string;
    }>();
  } catch {
    return errorResponse("Invalid JSON body");
  }

  if (!body.contact_id || !body.subject || !body.body_html) {
    return errorResponse("contact_id, subject, and body_html are required");
  }

  const contact = await env.DB.prepare(
    "SELECT id, email FROM contacts WHERE id = ?"
  )
    .bind(body.contact_id)
    .first<{ id: string; email: string | null }>();

  if (!contact) return errorResponse("Contact not found", 404);
  if (!contact.email) return errorResponse("Contact has no email address", 422);

  let resendId: string | null = null;
  let status = "sent";

  try {
    const res = await resendSend(
      env,
      contact.email,
      body.subject,
      body.body_html
    );
    resendId = res.id;
  } catch (err) {
    status = "failed";
    console.error("Resend error:", err);
  }

  const id = crypto_randomUUID();
  await env.DB.prepare(
    `INSERT INTO emails (id, contact_id, subject, body_html, resend_id, status)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(id, body.contact_id, body.subject, body.body_html, resendId, status)
    .run();

  const email = await env.DB.prepare(
    "SELECT * FROM emails WHERE id = ?"
  )
    .bind(id)
    .first<Email>();

  const httpStatus = status === "failed" ? 502 : 201;
  return jsonResponse({ success: status !== "failed", data: email }, httpStatus);
}

// ── GET /email?contact_id=<id> ────────────────────────────────────────────────
export async function listEmails(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const contactId = url.searchParams.get("contact_id");

  if (!contactId) return errorResponse("contact_id query param is required");

  const { results } = await env.DB.prepare(
    "SELECT * FROM emails WHERE contact_id = ? ORDER BY sent_at DESC LIMIT 100"
  )
    .bind(contactId)
    .all<Email>();

  return jsonResponse({ success: true, data: results });
}
