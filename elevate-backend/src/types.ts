// Shared TypeScript types for Elevate Backend

export interface Env {
  // D1 database
  DB: D1Database;
  // KV namespace for rate limiting
  RATE_LIMIT: KVNamespace;
  // Secrets
  API_KEY: string;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_PHONE_NUMBER: string;
  RESEND_API_KEY: string;
  ANTHROPIC_API_KEY: string;
}

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: "lead" | "prospect" | "customer" | "inactive";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  contact_id: string;
  direction: "outbound" | "inbound";
  body: string;
  twilio_sid: string | null;
  status: string;
  sent_at: string;
}

export interface Email {
  id: string;
  contact_id: string;
  subject: string;
  body_html: string;
  resend_id: string | null;
  status: string;
  sent_at: string;
}

export interface AiConversation {
  id: string;
  contact_id: string | null;
  title: string | null;
  created_at: string;
}

export interface AiMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export function jsonResponse<T>(
  data: ApiResponse<T>,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse<never>({ success: false, error: message }, status);
}

export function crypto_randomUUID(): string {
  return crypto.randomUUID();
}
