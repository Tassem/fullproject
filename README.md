# MediaFlow — Unified SaaS Platform

A unified SaaS platform combining **News Card Generator** and **Blog Automation** into one product with shared auth, billing, and admin panel.

---

## 🚀 Features

- **News Card Generator** — Create branded news cards from templates; post via Telegram bot
- **Blog Automation** — Full AI pipeline: RSS → AI writing → WordPress publishing
- **Unified Auth** — JWT-based with plan limits (Free / Starter / Pro / Agency)
- **Admin Panel** — Manage users, plans, credits, and AI settings
- **Points & Credits** — Dual currency system for usage tracking

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Express 5, Node.js 22, TypeScript |
| Frontend | React 18, Vite 7, TailwindCSS v4, shadcn/ui |
| Database | PostgreSQL 16 + Drizzle ORM |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| State | TanStack Query (React Query v5) |
| Monorepo | pnpm workspaces |
| Proxy | Nginx |

---

## 🐳 Run with Docker (Recommended)

### Prerequisites
- Docker Engine 24+
- Docker Compose v2

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/Tassem/fullproject.git
cd fullproject

# 2. Create environment file
cp .env.example .env
# Edit .env with your settings (DB password, SESSION_SECRET, API keys)

# 3. Start all services
docker compose up -d

# 4. Access the platform
open http://localhost
# API: http://localhost:8080/api
```

### Services Started by Docker Compose

| Service | Port | Description |
|---------|------|-------------|
| `db` | 5432 | PostgreSQL 16 database |
| `api` | 8080 | Express REST API |
| `platform` | 80 | React frontend (via Nginx) |
| `migrate` | — | Runs DB migrations on startup |

### Useful Docker Commands

```bash
# View logs
docker compose logs -f api
docker compose logs -f db

# Restart a service
docker compose restart api

# Stop all services
docker compose down

# Stop and remove volumes (DELETES database data)
docker compose down -v

# Rebuild after code changes
docker compose up -d --build api
```

---

## 💻 Run Without Docker (Development)

### Prerequisites
- Node.js 22+
- pnpm 9+
- PostgreSQL 16+

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Set environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL and SESSION_SECRET

# 3. Push DB schema
pnpm --filter @workspace/db run push

# 4. Start services (separate terminals)
pnpm --filter @workspace/api-server run dev     # port 8080
pnpm --filter @workspace/platform run dev       # port 8081
```

---

## ⚙️ Configuration

### Required Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string (e.g. `postgresql://user:pass@localhost:5432/mediaflow`) | Yes |
| `SESSION_SECRET` | JWT signing secret — at least 32 random characters. **Must be set; no fallback.** | Yes |
| `CORS_ORIGINS` | Comma-separated allowed origins (default: `http://localhost:3000,http://localhost:8000`) | No |
| `PORT` | API server port (default: `8080`) | No |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID for social login | No |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Email sending for password resets | No |

### Admin-Managed Settings

All AI provider settings are managed through the **Admin Panel → System** tab:
- OpenRouter API keys (article writing)
- OpenAI API key (image generation)
- Google Gemini API key (image analysis)
- Perplexity API key (keyword research)
- Tavily API key (link finding)
- kie.ai API key (FLUX image generation)
- WordPress global credentials

---

## 🔒 Security

- **CORS** restricted to allowed origins via `CORS_ORIGINS`
- **Rate limiting** globally (100 req/15 min) + strict auth limiter (10 req/15 min on login/register)
- **Helmet.js** security headers enabled
- **Input validation** via Zod on admin endpoints
- **SSRF protection** on remote image downloads — blocks private IPs, cloud metadata
- **File upload scanning** via Sharp re-encoding
- **Password complexity** enforced (uppercase, lowercase, digit, special char, min 8)
- **Request correlation IDs** for tracing

---

## 🧪 Testing

```bash
# Run unit tests
pnpm --filter @workspace/api-server run test --run

# Run tests in watch mode
pnpm --filter @workspace/api-server run test
```

---

## 🗄️ Database Schema

14 tables: `users`, `plans`, `subscriptions`, `credit_transactions`, `templates`, `generated_images`, `sites`, `articles`, `rss_feeds`, `agent_prompts`, `pipeline_logs`, `system_settings`, `points_wallet`, `points_transactions`

See [PROJECT_REPORT.md](./PROJECT_REPORT.md) for full schema documentation.

---

---

## 🔑 BYOK Plans Setup

To enable Bring Your Own Key (BYOK) plans:

1. **Set encryption key**:
   - Set environment variable `BYOK_ENCRYPTION_KEY` (32-byte hex string).
   - Generate with: `openssl rand -hex 32`
   - This key is used to encrypt user API keys at rest. **If lost, user keys cannot be decrypted.**

2. **Create a BYOK plan from admin dashboard**:
   - Go to Admin → Plans
   - Create new plan
   - Set **Plan Mode** = "Bring Your Own Key"
   - Set monthly credits (users on BYOK plans still consume credits for platform services like image generation fallbacks or premium tools).

3. **User Flow**:
   - Users on BYOK plans must add their **OpenRouter API key** in the Billing page.
   - AI features will use their personal OpenRouter account instead of the platform key.
   - Full keys are never exposed in API responses or logs.

---

## 📡 AI Blog Pipeline

```
RSS Fetch → Scrape → Competitor Analysis (Gemini)
→ Keyword Research (Perplexity) → Title Generation (OpenRouter)
→ Link Discovery (Tavily) → Image Generation (kie.ai/DALL-E)
→ Article Writing (OpenRouter/OpenAI) → WordPress Publish
→ Rank Math SEO Score
```

---

## 🔐 Default Admin Account

After first run:
```sql
UPDATE users SET is_admin = true WHERE email = 'admin@mediaflow.dev';
```
Password: `Admin123!`

---

## 📚 Documentation

- [PROJECT_REPORT.md](./PROJECT_REPORT.md) — Full architecture documentation
- [ISSUES_LOG.md](./ISSUES_LOG.md) — Issues encountered and solutions applied

---

## 📋 Subscription Plans

| Plan | Price | Daily Cap | Credits/Month |
|------|-------|-----------|----------------|
| Free | $0 | 5 | — |
| Starter | $9.99/mo | 20 | 50 |
| Pro | $29.99/mo | 100 | 200 |
| Agency | $99.99/mo | 500 | 1000 |
