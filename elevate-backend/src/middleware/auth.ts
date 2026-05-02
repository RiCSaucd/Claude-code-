import { Env, errorResponse } from "../types.js";

/**
 * Validates the Authorization header against the API_KEY secret.
 * Clients must send:  Authorization: Bearer <API_KEY>
 */
export async function requireAuth(
  request: Request,
  env: Env
): Promise<Response | null> {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    return errorResponse("Missing Authorization header", 401);
  }

  // Constant-time comparison to prevent timing attacks
  const expected = env.API_KEY;
  if (token.length !== expected.length) {
    return errorResponse("Invalid API key", 401);
  }

  let mismatch = 0;
  for (let i = 0; i < token.length; i++) {
    mismatch |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }

  if (mismatch !== 0) {
    return errorResponse("Invalid API key", 401);
  }

  return null; // auth passed
}
