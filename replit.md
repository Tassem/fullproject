# MediaFlow — Unified SaaS Platform

## Overview

MediaFlow is a unified SaaS platform combining a **News Card Generator** (Project A) and **Blog Automation** (Project B) into a single product with shared auth, unified billing plans/credits, a combined dashboard, and an admin panel.

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec `lib/api-spec/openapi.yaml`)
- **Frontend**: React + Vite + TailwindCSS v4 (shadcn/ui components)
- **Auth**: JWT (jsonwebtoken + bcryptjs); token stored in `localStorage["pro_token"]`
- **State management**: TanStack Query (React Query v5)
- **Routing**: wouter

## Architecture

### Services
| Service | Port | Path | Description |
|---------|------|------|-------------|
| API Server | 8080 | `/api` | Express 5 REST API |
| Platform Frontend | 8081 | `/` | React/Vite SaaS dashboard |
| Mockup Sandbox | 8099 | `/__mockup` | Canvas design tool |

### Packages
- `artifacts/api-server` — Express backend with 17 route files
- `artifacts/platform` — React frontend (13 pages, sidebar layout)
- `lib/api-spec` — OpenAPI spec (`openapi.yaml`) + Orval codegen
- `lib/api-client-react` — Generated React Query hooks + custom-fetch
- `lib/api-zod` — Generated Zod schemas (from OpenAPI)
- `lib/db` — Drizzle ORM schema + migrations

### Database Tables (14)
1. `users` — Auth, plan, credits, bot code, API key, telegramChatId
2. `plans` — Free/Starter/Pro/Agency with feature flags
3. `credit_transactions` — Usage tracking
4. `templates` — Card/image templates
5. `generated_images` — Image generation history
6. `sites` — Blog automation sites
7. `articles` — Generated articles per site
8. `pipeline_logs` — RSS/AI pipeline run logs
9. `agent_prompts` — AI agent system prompts
10. `system_settings` — Key/value settings store
11. `rss_feeds` — RSS feed monitoring per site
12. `subscriptions` — User subscription periods
13. `points_wallet` + `points_transactions` — Points/credits wallet
14. `payment_requests` — Manual payment request tracking

### Plans (seeded)
- **Free**: 5 cards/day, 10 credits, image generator only
- **Starter** ($9.99/mo): 20 cards, 50 credits, blog automation, Telegram bot
- **Pro** ($29.99/mo): 100 cards, 200 credits, API access, custom watermark
- **Agency** ($99.99/mo): 500 cards, 1000 credits, all features

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run build` — rebuild API server (required after route changes)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Important Notes

- **API server must be rebuilt** after any route changes: `pnpm --filter @workspace/api-server run dev` runs `build && start`, so workflow restarts handle this automatically
- **api-zod orval config**: Uses `mode: "single"`, `clean: false`, NO `schemas` option — prevents orval from regenerating index.ts with duplicate exports. `index.ts` exports ONLY `./generated/api`
- **Auth token key**: `pro_token` (localStorage key); getter configured in `artifacts/platform/src/main.tsx`
- **lib/db must be rebuilt** after schema changes: `cd lib/db && npx tsc --build --force`
- Frontend uses **relative API paths** (`/api/...`); Replit proxy routes to port 8080 automatically
- Admin page only visible when `user.isAdmin === true`

## Test Credentials

- **Admin**: `admin@mediaflow.dev` / `Admin123!` (run `UPDATE users SET is_admin = true WHERE email = 'admin@mediaflow.dev';` to enable admin)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
