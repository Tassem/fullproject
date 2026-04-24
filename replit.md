# Workspace — MediaFlow (NewsCard Pro)

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.
Unified SaaS platform combining News Card Generator and Blog Automation with shared auth, billing, and admin panel.

## Features Implemented
- News Card Generator (templates, template-builder, generate route, history)
- Blog Automation (sites, articles, pipeline, RSS feeds, logs)
- Shared auth (JWT, bcrypt), admin panel, billing/plans
- Unified dual-credit system: `users.monthly_credits` (resets monthly, lazy) + `users.purchased_credits` (never expires). Deducts monthly first then purchased. `deductCredits()` in `lib/credits.ts` is the single deduction entry point.
- 4-tier plans: Free(30cr/mo), Starter(300cr/$9), Pro(1000cr/$29), Business(3000cr/$79). All plan fields use snake_case: `monthly_credits`, `has_api_access`, `has_overlay_upload`, `has_custom_watermark`, `has_priority_processing`, `has_priority_support`, `rate_limit_daily`, `rate_limit_hourly`, `is_active`, `is_free`.
- User credit fields: `monthly_credits`, `purchased_credits`, `credits_reset_date`, `daily_usage_count`, `daily_usage_date` (dropped old: `credits`, `imagesToday`, `imagesLastReset`, `articlesThisMonth`, `articlesLastReset`)
- Admin can grant purchased_credits with full transaction logging; change-plan auto-assigns monthly_credits
- Screenshot prevention + blur overlay on window focus loss + Download PNG in template-builder (html2canvas)
- API Templates: per-user only (system templates shared, not other users' public templates)
- Unique name + email enforcement on registration

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
