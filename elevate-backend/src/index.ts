import { Env, errorResponse } from "./types.js";
import { requireAuth } from "./middleware/auth.js";
import { rateLimit } from "./middleware/rateLimit.js";
import {
  listContacts,
  createContact,
  getContact,
  updateContact,
  deleteContact,
} from "./routes/contacts.js";
import { sendSms, listSms } from "./routes/sms.js";
import { sendEmail, listEmails } from "./routes/email.js";
import {
  listConversations,
  createConversation,
  sendAiMessage,
  listAiMessages,
} from "./routes/ai.js";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // ── CORS pre-flight ──────────────────────────────────────────────────────
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // ── Rate limiting ────────────────────────────────────────────────────────
    const rateLimitResponse = await rateLimit(request, env);
    if (rateLimitResponse) return addCors(rateLimitResponse);

    // ── Auth (all routes require a valid API key) ────────────────────────────
    const authResponse = await requireAuth(request, env);
    if (authResponse) return addCors(authResponse);

    // ── Routing ──────────────────────────────────────────────────────────────
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    try {
      // Health check
      if (pathname === "/" || pathname === "/health") {
        return addCors(
          new Response(JSON.stringify({ success: true, status: "ok" }), {
            headers: { "Content-Type": "application/json" },
          })
        );
      }

      // ── Contacts ────────────────────────────────────────────────────────────
      if (pathname === "/contacts") {
        if (method === "GET") return addCors(await listContacts(env));
        if (method === "POST") return addCors(await createContact(request, env));
      }

      const contactMatch = pathname.match(/^\/contacts\/([^/]+)$/);
      if (contactMatch) {
        const id = contactMatch[1];
        if (method === "GET") return addCors(await getContact(id, env));
        if (method === "PATCH") return addCors(await updateContact(id, request, env));
        if (method === "DELETE") return addCors(await deleteContact(id, env));
      }

      // ── SMS ─────────────────────────────────────────────────────────────────
      if (pathname === "/sms") {
        if (method === "POST") return addCors(await sendSms(request, env));
        if (method === "GET") return addCors(await listSms(request, env));
      }

      // ── Email ───────────────────────────────────────────────────────────────
      if (pathname === "/email") {
        if (method === "POST") return addCors(await sendEmail(request, env));
        if (method === "GET") return addCors(await listEmails(request, env));
      }

      // ── AI Conversations ────────────────────────────────────────────────────
      if (pathname === "/ai/conversations") {
        if (method === "GET") return addCors(await listConversations(env));
        if (method === "POST") return addCors(await createConversation(request, env));
      }

      const convMatch = pathname.match(/^\/ai\/conversations\/([^/]+)\/messages$/);
      if (convMatch) {
        const convId = convMatch[1];
        if (method === "POST") return addCors(await sendAiMessage(convId, request, env));
        if (method === "GET") return addCors(await listAiMessages(convId, env));
      }

      return addCors(errorResponse("Not found", 404));
    } catch (err) {
      console.error("Unhandled error:", err);
      return addCors(errorResponse("Internal server error", 500));
    }
  },
} satisfies ExportedHandler<Env>;

function addCors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
