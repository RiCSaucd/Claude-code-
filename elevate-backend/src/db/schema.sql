-- Elevate Backend — D1 Schema
-- Run via: npm run db:init  (local)
--      or: npm run db:init:remote  (production)

PRAGMA foreign_keys = ON;

-- ──────────────────────────────────────────────
-- Contacts (CRM core entity)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id          TEXT PRIMARY KEY,          -- UUID
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  email       TEXT UNIQUE,
  phone       TEXT,
  company     TEXT,
  status      TEXT NOT NULL DEFAULT 'lead'
                CHECK (status IN ('lead','prospect','customer','inactive')),
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contacts_email   ON contacts (email);
CREATE INDEX IF NOT EXISTS idx_contacts_status  ON contacts (status);

-- ──────────────────────────────────────────────
-- Messages — outbound SMS sent via Twilio
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id           TEXT PRIMARY KEY,          -- UUID
  contact_id   TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  direction    TEXT NOT NULL CHECK (direction IN ('outbound','inbound')),
  body         TEXT NOT NULL,
  twilio_sid   TEXT,
  status       TEXT NOT NULL DEFAULT 'queued',
  sent_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages (contact_id);

-- ──────────────────────────────────────────────
-- Emails — outbound emails sent via Resend
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS emails (
  id          TEXT PRIMARY KEY,           -- UUID
  contact_id  TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  subject     TEXT NOT NULL,
  body_html   TEXT NOT NULL,
  resend_id   TEXT,
  status      TEXT NOT NULL DEFAULT 'queued',
  sent_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_emails_contact ON emails (contact_id);

-- ──────────────────────────────────────────────
-- AI Conversations — Anthropic Claude threads
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_conversations (
  id          TEXT PRIMARY KEY,           -- UUID
  contact_id  TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  title       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id              TEXT PRIMARY KEY,       -- UUID
  conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content         TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conv ON ai_messages (conversation_id);
