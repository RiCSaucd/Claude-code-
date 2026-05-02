import {
  Env,
  AiConversation,
  AiMessage,
  jsonResponse,
  errorResponse,
  randomUUID,
} from "../types.js";

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

interface AnthropicResponse {
  content: { type: string; text: string }[];
  error?: { message: string };
}

async function claudeChat(
  env: Env,
  messages: AnthropicMessage[],
  systemPrompt?: string
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      system: systemPrompt ?? "You are a helpful CRM assistant for Elevate.",
      messages,
    }),
  });

  const data = await res.json<AnthropicResponse>();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `Anthropic error ${res.status}`);
  }

  const textBlock = data.content.find((b) => b.type === "text");
  return textBlock?.text ?? "";
}

// ── POST /ai/conversations ────────────────────────────────────────────────────
export async function createConversation(
  request: Request,
  env: Env
): Promise<Response> {
  let body: { contact_id?: string; title?: string };
  try {
    body = await request.json<{ contact_id?: string; title?: string }>();
  } catch {
    body = {};
  }

  const id = randomUUID();
  await env.DB.prepare(
    "INSERT INTO ai_conversations (id, contact_id, title) VALUES (?, ?, ?)"
  )
    .bind(id, body.contact_id ?? null, body.title ?? null)
    .run();

  const conv = await env.DB.prepare(
    "SELECT * FROM ai_conversations WHERE id = ?"
  )
    .bind(id)
    .first<AiConversation>();

  return jsonResponse({ success: true, data: conv }, 201);
}

// ── POST /ai/conversations/:id/messages ───────────────────────────────────────
export async function sendAiMessage(
  convId: string,
  request: Request,
  env: Env
): Promise<Response> {
  const conv = await env.DB.prepare(
    "SELECT * FROM ai_conversations WHERE id = ?"
  )
    .bind(convId)
    .first<AiConversation>();

  if (!conv) return errorResponse("Conversation not found", 404);

  let body: { content: string };
  try {
    body = await request.json<{ content: string }>();
  } catch {
    return errorResponse("Invalid JSON body");
  }

  if (!body.content) return errorResponse("content is required");

  // Fetch conversation history
  const { results: history } = await env.DB.prepare(
    "SELECT role, content FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC"
  )
    .bind(convId)
    .all<{ role: "user" | "assistant"; content: string }>();

  const messages: AnthropicMessage[] = [
    ...history,
    { role: "user", content: body.content },
  ];

  // Save the user message
  const userMsgId = randomUUID();
  await env.DB.prepare(
    "INSERT INTO ai_messages (id, conversation_id, role, content) VALUES (?, ?, 'user', ?)"
  )
    .bind(userMsgId, convId, body.content)
    .run();

  // Get AI reply
  let replyText: string;
  try {
    replyText = await claudeChat(env, messages);
  } catch (err) {
    console.error("Anthropic error:", err);
    return errorResponse("AI service unavailable", 502);
  }

  // Save the assistant reply
  const asstMsgId = randomUUID();
  await env.DB.prepare(
    "INSERT INTO ai_messages (id, conversation_id, role, content) VALUES (?, ?, 'assistant', ?)"
  )
    .bind(asstMsgId, convId, replyText)
    .run();

  const assistantMsg = await env.DB.prepare(
    "SELECT * FROM ai_messages WHERE id = ?"
  )
    .bind(asstMsgId)
    .first<AiMessage>();

  return jsonResponse({ success: true, data: assistantMsg }, 201);
}

// ── GET /ai/conversations/:id/messages ────────────────────────────────────────
export async function listAiMessages(
  convId: string,
  env: Env
): Promise<Response> {
  const conv = await env.DB.prepare(
    "SELECT id FROM ai_conversations WHERE id = ?"
  )
    .bind(convId)
    .first<{ id: string }>();

  if (!conv) return errorResponse("Conversation not found", 404);

  const { results } = await env.DB.prepare(
    "SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC"
  )
    .bind(convId)
    .all<AiMessage>();

  return jsonResponse({ success: true, data: results });
}

// ── GET /ai/conversations ─────────────────────────────────────────────────────
export async function listConversations(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM ai_conversations ORDER BY created_at DESC LIMIT 50"
  ).all<AiConversation>();

  return jsonResponse({ success: true, data: results });
}
