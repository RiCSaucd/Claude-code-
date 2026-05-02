# Claude-code- / Elevate Backend

A Cloudflare Workers CRM backend with D1 (SQLite), KV rate-limiting, Twilio SMS, Resend email, and Anthropic Claude AI.

## Quick Start

```bash
cd elevate-backend
npm install

# 1. Create cloud resources and copy the IDs into wrangler.jsonc
wrangler d1 create elevate-db           # → REPLACE_WITH_YOUR_D1_DATABASE_ID
wrangler kv namespace create RATE_LIMIT # → REPLACE_WITH_YOUR_KV_NAMESPACE_ID

# 2. Initialise the database schema
npm run db:init          # local (for wrangler dev)
npm run db:init:remote   # production

# 3. Store secrets
wrangler secret put API_KEY             # CRM API password
wrangler secret put TWILIO_ACCOUNT_SID
wrangler secret put TWILIO_AUTH_TOKEN
wrangler secret put TWILIO_PHONE_NUMBER
wrangler secret put RESEND_API_KEY
wrangler secret put ANTHROPIC_API_KEY

# 4. Deploy
npm run deploy
```

## API

All requests require `Authorization: Bearer <API_KEY>`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET/POST | `/contacts` | List / create contacts |
| GET/PATCH/DELETE | `/contacts/:id` | Read / update / delete a contact |
| GET/POST | `/sms` | List SMS (`?contact_id=`) / send SMS |
| GET/POST | `/email` | List emails (`?contact_id=`) / send email |
| GET/POST | `/ai/conversations` | List / create AI conversations |
| GET/POST | `/ai/conversations/:id/messages` | Get / send messages in a conversation |

## Local Development

```bash
npm run dev   # starts wrangler dev on http://localhost:8787
```

