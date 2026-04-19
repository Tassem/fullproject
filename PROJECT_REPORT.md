# 📋 Comprehensive Project Report — MediaFlow

## 📌 Basic Information

| Field | Value |
|-------|-------|
| **Project Name** | MediaFlow — Unified SaaS Platform |
| **GitHub Repo** | https://github.com/Tassem/fullproject |
| **Creation Date** | 2025 (merged April 2026) |
| **Current Version** | 0.1.0 |
| **Status** | In Development (functional, pre-production) |
| **Runtime** | Node.js 24 |
| **Package Manager** | pnpm (workspaces monorepo) |

---

## 🎯 Project Objective

MediaFlow merges **two separate SaaS tools** into a single unified platform with shared auth, billing, credits, and an admin panel:

| Original Project | Role in MediaFlow |
|-----------------|-------------------|
| **imageupdatenew** (News Card Generator) | Generates branded news cards from text + templates; posts via Telegram bot |
| **blogupdatenew** (Blog Automation / Liya) | AI pipeline: fetches RSS → writes SEO articles → publishes to WordPress |

**The problem it solves:** Customers who need both tools no longer pay for two separate subscriptions — one platform, one login, one billing plan covers everything.

---

## 🏗️ Technical Architecture

### Technologies Used

| Layer | Technology |
|-------|-----------|
| **Language** | TypeScript (strict, Node 24) |
| **Backend Framework** | Express 5 |
| **Database** | PostgreSQL 16 + Drizzle ORM |
| **Frontend** | React 18 + Vite 7 + TailwindCSS v4 |
| **UI Components** | shadcn/ui |
| **State Management** | TanStack Query (React Query v5) |
| **Routing (frontend)** | wouter |
| **Auth** | JWT (jsonwebtoken + bcryptjs) |
| **API Codegen** | Orval (OpenAPI → React Query hooks + Zod schemas) |
| **Monorepo** | pnpm workspaces |
| **Image Processing** | sharp |
| **RSS Parsing** | fast-xml-parser |
| **HTML Parsing** | node-html-parser |
| **Logging** | pino |

### Key Libraries

| Library | Purpose |
|---------|---------|
| `drizzle-orm` | Type-safe ORM for PostgreSQL |
| `drizzle-zod` | Auto-generate Zod schemas from Drizzle tables |
| `zod` (v4) | Runtime validation for API input |
| `bcryptjs` | Password hashing |
| `jsonwebtoken` | JWT creation and verification |
| `@tanstack/react-query` | Server state, caching, mutations |
| `orval` | Generates typed API hooks from OpenAPI spec |
| `fast-xml-parser` | RSS/XML feed parsing |
| `sharp` | Image resizing and optimization |
| `node-html-parser` | Scraping competitor article content |
| `pino` | Structured JSON logging |

---

## 📁 Project Structure

```
workspace/
├── artifacts/
│   ├── api-server/          # Express 5 REST API (port 8080)
│   │   └── src/
│   │       ├── routes/      # 20 route files (one per domain)
│   │       ├── pipeline/    # Blog automation AI pipeline
│   │       ├── middlewares/ # Auth, limits, rate-limiting
│   │       └── lib/         # Auth helpers, utils
│   ├── platform/            # React frontend (port 8081)
│   │   └── src/
│   │       ├── pages/       # 23 page components
│   │       ├── components/  # Reusable UI components + layout
│   │       ├── hooks/       # useAuth, useToast, custom hooks
│   │       └── lib/         # utils, publicSettings
│   └── mockup-sandbox/      # Canvas design tool (port 8099)
│
├── lib/
│   ├── db/                  # Drizzle ORM schema + DB client
│   │   └── src/schema/      # 14 table definitions
│   ├── api-spec/            # OpenAPI spec (openapi.yaml)
│   ├── api-client-react/    # Generated React Query hooks
│   └── api-zod/             # Generated Zod validation schemas
│
├── repo_blog/               # Original blog project (reference only)
├── replit.md                # Living architecture document
├── pnpm-workspace.yaml      # Monorepo workspace config
└── tsconfig.base.json       # Shared TypeScript config
```

---

## 🗄️ Database Schema (14 Tables)

### Core Auth & Billing

```sql
-- Users
users: id, name, email, password_hash, is_admin, plan, credits,
       images_today, articles_this_month, telegram_chat_id,
       api_key, phone, email_verified, bot_code, created_at

-- Plans (seeded: free / starter / pro / agency)
plans: id, name, price_monthly, cards_per_day, max_templates,
       max_sites, articles_per_month, has_image_generator,
       has_blog_automation, has_telegram_bot, api_access,
       overlay_upload, credits_per_period

-- Subscriptions
subscriptions: id, user_id, plan_id, started_at, expires_at,
               articles_used_this_period, is_active

-- Credit Transactions
credit_transactions: id, user_id, amount, type, description, created_at

-- Points Wallet
points_wallet: id, user_id, balance, lifetime_earned, updated_at
points_transactions: id, user_id, amount, type, description, created_at

-- Payment Requests (manual payments)
payment_requests: id, user_id, amount, plan_id, status,
                  payment_method, reference_number, notes, created_at
```

### News Card Generator

```sql
-- Templates (card designs)
templates: id, user_id, name, is_public, canvas_layout (JSONB),
           thumbnail_url, category, created_at, updated_at

-- Generated Images (history)
generated_images: id, user_id, template_id, image_url,
                  input_data (JSONB), created_at
```

### Blog Automation

```sql
-- WordPress Sites
sites: id, user_id, name, domain, wp_url, wp_username, wp_password,
       is_active, rss_url, created_at, updated_at

-- RSS Feeds (per site)
rss_feeds: id, user_id, site_id, rss_url, label, wp_category_name,
           poll_hours, poll_minutes, max_articles, is_active,
           last_polled_at, created_at

-- Generated Articles
articles: id, user_id, site_id, source_url, title, content,
          status, wp_post_id, rank_math_score, word_count,
          ai_provider, created_at, updated_at

-- AI Agent Prompts (per site)
agent_prompts: id, user_id, site_id, agent_name, prompt,
               is_active, created_at, updated_at

-- Pipeline Run Logs
pipeline_logs: id, user_id, site_id, article_id, stage, status,
               message, duration_ms, created_at
```

### Settings

```sql
-- System Settings (key/value store)
system_settings: id, key (UNIQUE), value, description,
                 created_at, updated_at
```

### Table Relationships

```
users ──< subscriptions >── plans
users ──< credit_transactions
users ──< templates
users ──< generated_images
users ──< sites ──< rss_feeds
                 ──< articles
                 ──< agent_prompts
                 ──< pipeline_logs
users ──< points_wallet ──< points_transactions
users ──< payment_requests
```

---

## 📡 API Endpoints (20 Route Files)

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login → returns JWT |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/verify-email` | Email verification |

### News Card Generator
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/generate` | Generate a news card image |
| GET | `/api/history` | User's image history |
| GET/POST/PUT/DELETE | `/api/templates` | CRUD templates |
| POST | `/api/photo` | Upload photo/overlay |

### Blog Automation
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST/PUT/DELETE | `/api/sites` | WordPress sites CRUD |
| GET/POST/PUT/DELETE | `/api/rss` | RSS feeds CRUD |
| GET/POST/PUT/DELETE | `/api/articles` | Articles CRUD |
| GET/POST | `/api/pipeline` | Run pipeline / get status |
| GET | `/api/logs` | Pipeline run logs |
| GET/PUT | `/api/blog-settings` | AI + pipeline config |

### Bot & Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/bot` | Telegram bot status/config |
| GET/PUT | `/api/settings` | System settings |
| GET | `/api/test/:service` | Test API key connectivity |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | List all users |
| GET/PUT | `/api/admin/settings` | Global system settings |
| GET | `/api/stats` | Platform statistics |

### Billing
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/billing` | User billing info |
| POST | `/api/payments` | Create payment request |
| GET | `/api/plans` | Available plans |

---

## 🔄 Blog Automation Pipeline

The AI pipeline runs when triggered manually or by cron:

```
1. RSS Fetch
   ↓ Fetch all active sites → poll their RSS feeds
   ↓ Store new articles with status: "pending"

2. Scrape
   ↓ Fetch original article HTML from source URL
   ↓ Extract title, body, images

3. Competitor Analysis
   ↓ Gemini Vision: analyze competitor article images

4. Keyword Research
   ↓ Perplexity API: find ranking keywords

5. Title & Description Generation
   ↓ OpenRouter/OpenAI: SEO-optimized title + meta description

6. Internal & External Links
   ↓ Match internal links from site content
   ↓ Tavily API: find authoritative external links

7. Image Analysis & Generation
   ↓ Analyze competitor image → generate new featured image
   ↓ kie.ai FLUX / DALL-E 3 / OpenRouter

8. Article Writing
   ↓ Full SEO article written by AI (600–5000 words)

9. WordPress Publish
   ↓ REST API → create post (draft or published)

10. Rank Math SEO
    ↓ Set focus keyword, meta description, SEO score
```

---

## ⚙️ Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ | JWT signing secret |
| `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` | ✅ | PostgreSQL credentials |
| `PORT` | Auto | Server port (set by Replit per artifact) |
| `NODE_ENV` | Auto | `development` or `production` |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | Optional | GitHub API access |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Optional | OpenAI via Replit proxy |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Optional | OpenAI proxy base URL |

**Pipeline AI keys** (stored in `system_settings` table, managed via Admin → System):
- `openrouter_api_key_1`, `openrouter_api_key_2`
- `openai_api_key`
- `gemini_api_key`
- `perplexity_api_key`
- `tavily_api_key`
- `kieai_api_key`
- `wp_url`, `wp_username`, `wp_password` (global WordPress fallback)

---

## 🚀 How to Run Locally (Replit)

All three services start automatically via Replit Workflows:

```bash
# API Server (rebuilds then starts)
pnpm --filter @workspace/api-server run dev

# Platform Frontend (Vite dev server)
pnpm --filter @workspace/platform run dev

# Mockup Sandbox (canvas tool)
pnpm --filter @workspace/mockup-sandbox run dev
```

### After schema changes:
```bash
pnpm --filter @workspace/db run push
```

### After OpenAPI spec changes:
```bash
pnpm --filter @workspace/api-spec run codegen
```

---

## 🔐 Auth Flow

```
Register/Login → bcrypt verify → JWT signed with SESSION_SECRET
→ stored in localStorage["pro_token"]
→ sent as Authorization: Bearer <token> on every request
→ requireAuth middleware verifies JWT → attaches user to req.user
```

**Test Credentials:**
- Admin: `admin@mediaflow.dev` / `Admin123!`
- (Run `UPDATE users SET is_admin = true WHERE email = 'admin@mediaflow.dev';` once)

---

## 📋 Subscription Plans

| Plan | Price | Cards/Day | Articles/Month | Features |
|------|-------|-----------|----------------|----------|
| **Free** | $0 | 5 | — | Image generator only |
| **Starter** | $9.99/mo | 20 | 50 | Blog automation + Telegram bot |
| **Pro** | $29.99/mo | 100 | 200 | + API access + custom watermark |
| **Agency** | $99.99/mo | 500 | 1000 | All features, highest limits |

---

## 🔐 Security Practices

- [x] JWT-based stateless auth (`SESSION_SECRET` from env)
- [x] Password hashing with bcryptjs (never stored in plain text)
- [x] `requireAuth` middleware on all protected routes
- [x] `requireAdmin` middleware on admin routes
- [x] API keys stored in database, not hardcoded
- [x] Input validation with Zod on all API bodies
- [x] User isolation: all queries filter by `user_id`
- [ ] Rate limiting (basic, needs production hardening)
- [ ] Email verification fully enforced (partial)

---

## 🌐 Frontend Pages (23)

| Route | Page | Description |
|-------|------|-------------|
| `/dashboard` | Dashboard | Stats, quick actions |
| `/generate` | Generate | News card generator |
| `/history` | History | Generated cards history |
| `/templates` | Templates | Browse templates |
| `/template-builder` | Template Builder | Visual card editor |
| `/telegram` | Bot | Telegram bot config |
| `/billing` | Billing | Plan & payment info |
| `/settings` | Settings | Account & API key |
| `/sites` | Sites | WordPress sites CRUD |
| `/articles` | Articles | Generated articles |
| `/rss-feeds` | RSS Feeds | RSS feed management |
| `/pipeline` | Pipeline | Pipeline status & control |
| `/logs` | Logs | Pipeline run logs |
| `/blog-admin` | Admin Panel | Full admin dashboard (admin only) |
| `/login` | Login | Auth |
| `/register` | Register | Auth |

---

## 🔮 Future Plans

- [ ] Full email verification enforcement
- [ ] Production rate limiting per plan
- [ ] Scheduled cron for automatic pipeline runs
- [ ] Webhook support for WordPress events
- [ ] Multi-language article generation
- [ ] Analytics dashboard per site
- [ ] White-label mode for Agency tier
- [ ] Mobile app (Expo)

---

## 📞 Contact & Repository

- **GitHub**: https://github.com/Tassem/fullproject
- **Platform**: Replit (hosted)

---

**Last Updated**: April 2026
**Report Prepared By**: AI Agent on Replit
