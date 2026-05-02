import { Env, Contact, jsonResponse, errorResponse, crypto_randomUUID } from "../types.js";

// ── GET /contacts ─────────────────────────────────────────────────────────────
export async function listContacts(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM contacts ORDER BY created_at DESC LIMIT 100"
  ).all<Contact>();
  return jsonResponse({ success: true, data: results });
}

// ── POST /contacts ────────────────────────────────────────────────────────────
export async function createContact(
  request: Request,
  env: Env
): Promise<Response> {
  let body: Partial<Contact>;
  try {
    body = await request.json<Partial<Contact>>();
  } catch {
    return errorResponse("Invalid JSON body");
  }

  if (!body.first_name || !body.last_name) {
    return errorResponse("first_name and last_name are required");
  }

  const id = crypto_randomUUID();
  await env.DB.prepare(
    `INSERT INTO contacts (id, first_name, last_name, email, phone, company, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      body.first_name,
      body.last_name,
      body.email ?? null,
      body.phone ?? null,
      body.company ?? null,
      body.status ?? "lead",
      body.notes ?? null
    )
    .run();

  const contact = await env.DB.prepare(
    "SELECT * FROM contacts WHERE id = ?"
  )
    .bind(id)
    .first<Contact>();

  return jsonResponse({ success: true, data: contact }, 201);
}

// ── GET /contacts/:id ─────────────────────────────────────────────────────────
export async function getContact(id: string, env: Env): Promise<Response> {
  const contact = await env.DB.prepare(
    "SELECT * FROM contacts WHERE id = ?"
  )
    .bind(id)
    .first<Contact>();

  if (!contact) return errorResponse("Contact not found", 404);
  return jsonResponse({ success: true, data: contact });
}

// ── PATCH /contacts/:id ───────────────────────────────────────────────────────
export async function updateContact(
  id: string,
  request: Request,
  env: Env
): Promise<Response> {
  const existing = await env.DB.prepare(
    "SELECT id FROM contacts WHERE id = ?"
  )
    .bind(id)
    .first<{ id: string }>();

  if (!existing) return errorResponse("Contact not found", 404);

  let body: Partial<Contact>;
  try {
    body = await request.json<Partial<Contact>>();
  } catch {
    return errorResponse("Invalid JSON body");
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  const allowed: (keyof Contact)[] = [
    "first_name",
    "last_name",
    "email",
    "phone",
    "company",
    "status",
    "notes",
  ];

  for (const key of allowed) {
    if (key in body) {
      fields.push(`${key} = ?`);
      values.push(body[key] ?? null);
    }
  }

  if (fields.length === 0) return errorResponse("No updatable fields provided");

  fields.push("updated_at = datetime('now')");
  values.push(id);

  await env.DB.prepare(
    `UPDATE contacts SET ${fields.join(", ")} WHERE id = ?`
  )
    .bind(...values)
    .run();

  const contact = await env.DB.prepare(
    "SELECT * FROM contacts WHERE id = ?"
  )
    .bind(id)
    .first<Contact>();

  return jsonResponse({ success: true, data: contact });
}

// ── DELETE /contacts/:id ──────────────────────────────────────────────────────
export async function deleteContact(id: string, env: Env): Promise<Response> {
  const existing = await env.DB.prepare(
    "SELECT id FROM contacts WHERE id = ?"
  )
    .bind(id)
    .first<{ id: string }>();

  if (!existing) return errorResponse("Contact not found", 404);

  await env.DB.prepare("DELETE FROM contacts WHERE id = ?").bind(id).run();

  return jsonResponse({ success: true, data: { id } });
}
