# 🐛 Issues & Solutions Log — MediaFlow

## Introduction
This file documents all real issues encountered during the development of the MediaFlow unified platform (merge of imageupdatenew + blogupdatenew), with root causes and applied solutions. This is a living document — update it whenever a new issue is encountered and resolved.

---

## 📊 Quick Statistics
- **Total Issues**: 12
- **Resolved Issues**: 12
- **Pending Issues**: 0
- **Project Phase**: Merge & Integration

---

## 🔴 Critical Issues

---

### Issue #1: DB Schema — camelCase vs snake_case Mismatch

**📅 Date**: April 2026
**🏷️ Category**: Database / Backend
**🚨 Priority**: Critical

#### 📝 Issue Description:
The original `imageupdatenew` project used Drizzle ORM with **camelCase** property names (e.g., `userId`, `siteId`, `rssUrl`). The `blogupdatenew` project's pipeline code queried columns using **snake_case** (e.g., `user_id`, `site_id`, `rss_url`). After merging both into a single DB schema, the pipeline either crashed or silently returned undefined for all joined queries.

#### 🔍 Symptoms:
- Pipeline returned 0 articles even when sites existed
- `rssFeedsTable.userId` was `undefined` at runtime (column didn't exist in object)
- `INSERT` statements failed with "column does not exist" errors
- Drizzle query builder generated wrong SQL column names

#### 💡 Root Cause:
Drizzle ORM uses the **TypeScript property name** in queries unless you explicitly set a SQL column name. The original tables were defined as:
```typescript
// WRONG — property name becomes SQL column name
userId: integer("userId")  // generates SQL: "userId" (case-sensitive, fails)
```
But the actual PostgreSQL columns were named `user_id`, `site_id` etc. (snake_case). After the merge, the new pipeline code used `rssFeedsTable.user_id` which didn't exist as a TS property.

#### 🛠️ Applied Solution:
Rewrote all affected table schemas to use snake_case property names that match the actual DB column names:

```typescript
// CORRECT — property matches SQL column
export const rssFeedsTable = pgTable("rss_feeds", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => usersTable.id),
  site_id: integer("site_id").notNull().references(() => sitesTable.id),
  rss_url: text("rss_url").notNull(),
  is_active: boolean("is_active").default(true),
  // ...
});
```

Also ran `ALTER TABLE` statements to add missing columns:
```sql
ALTER TABLE articles ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS rank_math_score INTEGER;
ALTER TABLE pipeline_logs ADD COLUMN IF NOT EXISTS site_id INTEGER;
```

#### ✅ Solution Verification:
- Pipeline queries returned correct results
- `db.select().from(rssFeedsTable).where(eq(rssFeedsTable.user_id, id))` worked correctly

#### 📚 Lessons Learned:
- Always define Drizzle ORM property names to exactly match PostgreSQL column names
- When merging two projects, audit all schema files for naming convention mismatches before running any queries

---

### Issue #2: `settingsTable` Not Exported from DB Package

**📅 Date**: April 2026
**🏷️ Category**: Backend / Build
**🚨 Priority**: Critical

#### 📝 Issue Description:
The pipeline code from `blogupdatenew` imported `settingsTable` from `@workspace/db`, but the unified platform only exported `systemSettingsTable`. This caused a build failure: `Module '@workspace/db' has no exported member 'settingsTable'`.

#### 🔍 Symptoms:
- `pnpm --filter @workspace/api-server run build` failed
- Error: `Named export 'settingsTable' not found`
- Pipeline's `index.ts` and `runner.ts` could not compile

#### 💡 Root Cause:
The `blogupdatenew` project used `settingsTable` as the alias for its settings table. The unified platform renamed it to `systemSettingsTable` to avoid confusion with other settings. The pipeline code was copied verbatim without updating imports.

#### 🛠️ Applied Solution:
Added a re-export alias in `lib/db/src/schema/system_settings.ts`:

```typescript
// Keep original name AND add alias for pipeline compatibility
export const systemSettingsTable = pgTable("system_settings", { ... });
export const settingsTable = systemSettingsTable; // alias for pipeline code
```

Also updated `lib/db/src/index.ts` to export the alias.

#### ✅ Solution Verification:
- Build succeeded: `⚡ Done in 367ms`
- Pipeline imported `settingsTable` without errors

#### 📚 Lessons Learned:
- When merging projects, add compatibility aliases rather than doing a mass find-replace that can break other code
- Export aliases are zero-cost and prevent breaking downstream consumers

---

### Issue #3: Missing DB Columns Causing Pipeline Runtime Crashes

**📅 Date**: April 2026
**🏷️ Category**: Database / Backend
**🚨 Priority**: Critical

#### 📝 Issue Description:
The pipeline from `blogupdatenew` expected columns (`source_url`, `rank_math_score`, `word_count`, `ai_provider` in `articles`; `stage`, `duration_ms` in `pipeline_logs`) that did not exist in the merged database schema — because these were added in `blogupdatenew` but never migrated to the unified DB.

#### 🔍 Symptoms:
- PostgreSQL error: `column "source_url" of relation "articles" does not exist`
- Pipeline crashed at `INSERT INTO articles` step
- `pipeline_logs` INSERT failed silently

#### 💡 Root Cause:
The Drizzle schema files were updated (new columns added in TypeScript), but `pnpm --filter @workspace/db run push` was never run, so the actual PostgreSQL table was not updated.

#### 🛠️ Applied Solution:
```sql
-- Applied via direct SQL (safer than push for production)
ALTER TABLE articles 
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rank_math_score INTEGER,
  ADD COLUMN IF NOT EXISTS word_count INTEGER,
  ADD COLUMN IF NOT EXISTS ai_provider VARCHAR(100);

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS wp_url TEXT,
  ADD COLUMN IF NOT EXISTS wp_username TEXT,
  ADD COLUMN IF NOT EXISTS wp_password TEXT,
  ADD COLUMN IF NOT EXISTS rss_url TEXT;

ALTER TABLE pipeline_logs
  ADD COLUMN IF NOT EXISTS site_id INTEGER,
  ADD COLUMN IF NOT EXISTS article_id INTEGER,
  ADD COLUMN IF NOT EXISTS stage VARCHAR(100),
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER;
```

#### ✅ Solution Verification:
- All INSERT operations completed successfully
- Pipeline ran without DB errors

#### 📚 Lessons Learned:
- After every schema change, immediately run `pnpm --filter @workspace/db run push`
- Use `ADD COLUMN IF NOT EXISTS` in raw SQL to make migrations idempotent

---

### Issue #4: Blog Settings Route Not Mounted

**📅 Date**: April 2026
**🏷️ Category**: Backend / Routing
**🚨 Priority**: High

#### 📝 Issue Description:
`GET /api/blog-settings` returned 404 even though `blog-settings.ts` route file existed and was imported in `routes/index.ts`. The import was added but `router.use(...)` line was missing.

#### 🔍 Symptoms:
- `curl /api/blog-settings` → `404 Not Found`
- No error in API server logs
- Route file existed and was valid

#### 💡 Root Cause:
Partial edit — the import line was added at the top of `routes/index.ts` but the `router.use("/blog-settings", blogSettingsRouter)` line was never added.

#### 🛠️ Applied Solution:
```typescript
// routes/index.ts
import blogSettingsRouter from "./blog-settings"; // was already there
// Added missing mount:
router.use("/blog-settings", blogSettingsRouter);
```

#### 📚 Lessons Learned:
- Always verify both: (1) import added AND (2) `router.use(...)` added
- After adding any route, test with `curl` to confirm 401 (auth required) not 404

---

## 🟡 Medium Priority Issues

---

### Issue #5: RSS Feeds Frontend Using camelCase After Backend Schema Change

**📅 Date**: April 2026
**🏷️ Category**: Frontend / API Contract
**🚨 Priority**: High

#### 📝 Issue Description:
After changing the `rss_feeds` Drizzle schema to use snake_case property names, the API started returning `{ site_id, rss_url, is_active, ... }`. But `rss-feeds.tsx` had a TypeScript interface with `{ siteId, rssUrl, isActive }` (camelCase), causing undefined values in the UI.

#### 🔍 Symptoms:
- RSS feed cards showed empty URL
- Toggle switch had no effect (fed undefined to `is_active`)
- Edit form pre-populated with blank values

#### 🛠️ Applied Solution:
Updated the TypeScript interface and all property references in `rss-feeds.tsx`:

```typescript
// Before
interface RssFeed {
  siteId: number;
  rssUrl: string;
  isActive: boolean;
}

// After
interface RssFeed {
  site_id: number;
  rss_url: string;
  is_active: boolean;
}
```

Also updated the POST body to use `site_id` (snake_case) to match the backend parser.

#### 📚 Lessons Learned:
- When changing DB schema naming convention, always audit the frontend interfaces immediately
- The API should be the contract — if it returns snake_case, the frontend must use snake_case

---

### Issue #6: Duplicate Blog Settings — System Tab vs New Blog Settings Page

**📅 Date**: April 2026
**🏷️ Category**: Frontend / UX
**🚨 Priority**: Medium

#### 📝 Issue Description:
A new "Blog Settings" page was created in the sidebar for configuring AI providers, RSS, and WordPress. However, the Admin Panel's "System" tab already had all these settings. Both pages wrote to the same `system_settings` table, creating duplication and confusion.

#### 🔍 Symptoms:
- Sidebar showed "Blog Settings" link
- Admin Panel → System had identical settings (AI Roles, OpenRouter, OpenAI, kie.ai, RSS & Pipeline, WordPress)
- User reported the duplication

#### 🛠️ Applied Solution:
Removed the new "Blog Settings" page:
1. Deleted `artifacts/platform/src/pages/blog-pipeline-settings.tsx`
2. Removed import and route from `App.tsx`
3. Removed nav link from `Sidebar.tsx`

The Admin Panel → System tab remains as the single source of truth for all pipeline configuration.

#### 📚 Lessons Learned:
- Before creating a new settings page, check if the admin panel already covers it
- Settings that affect the whole platform belong in Admin → System (not per-user)

---

### Issue #7: Pipeline Route Was a Stub (Not Calling Real Pipeline)

**📅 Date**: April 2026
**🏷️ Category**: Backend / Pipeline
**🚨 Priority**: High

#### 📝 Issue Description:
`POST /api/pipeline/run` returned `{ message: "Pipeline triggered" }` but did nothing — it was a stub that never called the actual `runPipeline()` function from the ported pipeline code.

#### 🔍 Symptoms:
- Clicking "Run Pipeline" in the UI showed success toast
- No articles were queued or processed
- `pipeline_logs` table remained empty

#### 🛠️ Applied Solution:
```typescript
// Before (stub)
router.post("/run", requireAuth, async (req, res) => {
  return res.json({ message: "Pipeline triggered" });
});

// After (real implementation)
import { runPipeline } from "../pipeline/index.js";

router.post("/run", requireAuth, async (req, res) => {
  try {
    const result = await runPipeline();
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
```

#### 📚 Lessons Learned:
- Stub routes are useful during development but must be flagged with `// TODO: implement`
- Always test the full flow (click button → check DB) not just the API response

---

### Issue #8: Missing Packages for Blog Automation Pipeline

**📅 Date**: April 2026
**🏷️ Category**: Backend / Dependencies
**🚨 Priority**: High

#### 📝 Issue Description:
After porting `pipeline/rss.ts` and `pipeline/runner.ts`, the API server failed to build because `fast-xml-parser`, `node-html-parser`, and `sharp` were not installed in the `api-server` package.

#### 🔍 Symptoms:
- Build error: `Cannot find module 'fast-xml-parser'`
- Build error: `Cannot find module 'node-html-parser'`

#### 🛠️ Applied Solution:
```bash
pnpm --filter @workspace/api-server add fast-xml-parser node-html-parser sharp
```

#### 📚 Lessons Learned:
- When copying pipeline code from another project, always check its `package.json` `dependencies` section and install any missing packages
- Run a build immediately after copying code to catch missing dependencies early

---

### Issue #9: `agentPromptsTable` Not Exported from DB Package

**📅 Date**: April 2026
**🏷️ Category**: Backend / Build
**🚨 Priority**: High

#### 📝 Issue Description:
`pipeline/runner.ts` imported `agentPromptsTable` from `@workspace/db`, but the table schema existed in the schema folder without being re-exported from the DB package's `index.ts`.

#### 🔍 Symptoms:
- Build error: `Named export 'agentPromptsTable' not found in module '@workspace/db'`

#### 🛠️ Applied Solution:
Added to `lib/db/src/index.ts`:
```typescript
export * from "./schema/agent_prompts";
```

#### 📚 Lessons Learned:
- After adding a new schema file, always add a corresponding `export *` to `lib/db/src/index.ts`
- Run `pnpm --filter @workspace/db run build` after any schema changes

---

## 🟢 Low Priority Issues

---

### Issue #10: Telegram Route Named Mismatch

**📅 Date**: April 2026
**🏷️ Category**: Frontend / Routing
**🚨 Priority**: Low

#### 📝 Issue Description:
The sidebar linked to `/telegram` for the Telegram Bot page, but no route was registered for this path in `App.tsx`.

#### 🛠️ Applied Solution:
Verified that `TelegramBot` component was imported and the route `<Route path="/telegram">` was registered in `App.tsx`.

---

### Issue #11: `Article` Type Not Exported for Pipeline

**📅 Date**: April 2026
**🏷️ Category**: Backend / TypeScript
**🚨 Priority**: Low

#### 📝 Issue Description:
`pipeline/runner.ts` used `import type { Article } from "@workspace/db"`, but the `Article` type was not exported from the DB package.

#### 🛠️ Applied Solution:
Added to `lib/db/src/schema/articles.ts`:
```typescript
export type Article = typeof articlesTable.$inferSelect;
```

---

### Issue #12: `consumeArticleCredit` Middleware Using Wrong Column Names

**📅 Date**: April 2026
**🏷️ Category**: Backend / Credits
**🚨 Priority**: Medium

#### 📝 Issue Description:
The original `limits.ts` from `blogupdatenew` referenced `subscriptionsTable.articlesUsedThisPeriod` (camelCase). After the merge, the `subscriptions` table schema used camelCase (it was not changed to snake_case), so this worked — but the check for `planDetails.articlesPerMonth` needed to come from the `plans` join.

#### 🛠️ Applied Solution:
Rewrote `middlewares/limits.ts` to do a proper join between `subscriptions` and `plans`, reading `articlesUsedThisPeriod` and comparing against the plan's `articlesPerMonth` limit before allowing the pipeline to process an article.

---

## 🔄 Recurring Issues

### Pattern #1: Missing Export from `lib/db`
**Occurrence Count**: 3 (Issues #2, #9, #11)
**Permanent Solution**: After adding ANY new schema file, immediately:
1. Add `export *` to `lib/db/src/index.ts`
2. Run `pnpm --filter @workspace/db run build`
3. Verify with `pnpm --filter @workspace/api-server run build`

### Pattern #2: Schema Change Not Reflected in DB
**Occurrence Count**: 2 (Issues #1, #3)
**Permanent Solution**: Always run `pnpm --filter @workspace/db run push` after any schema change. Never assume the DB matches the TypeScript schema.

### Pattern #3: camelCase vs snake_case Across the Stack
**Occurrence Count**: 3 (Issues #1, #5, #12)
**Permanent Solution**: **Convention established**: All Drizzle ORM property names MUST match PostgreSQL column names exactly (snake_case). Frontend TypeScript interfaces must match the API response shape exactly.

---

## 📋 Pre-Launch Checklist

### Completed:
- [x] DB schema merged and all columns aligned
- [x] Pipeline code ported from blogupdatenew
- [x] All route files registered in `routes/index.ts`
- [x] Auth middleware on all protected routes
- [x] RSS feeds CRUD (snake_case compatible)
- [x] Admin panel functional (users, plans, system settings)
- [x] Blog automation pipeline wired up
- [x] Telegram bot integration
- [x] News card generator working

### In Progress / Pending:
- [ ] End-to-end pipeline test (RSS → AI → WordPress publish)
- [ ] Email verification fully enforced
- [ ] Production rate limiting per plan tier
- [ ] Scheduled cron for automatic pipeline runs
- [ ] Performance testing with multiple concurrent users

---

## 💼 Tips for New Developers

### Before making any change:
1. Read `replit.md` for the current architecture overview
2. Read this file to understand past mistakes
3. Check `lib/db/src/index.ts` exports before assuming a table is available
4. Run `pnpm --filter @workspace/api-server run build` to verify before testing

### Common commands:
```bash
# Rebuild API server (required after any route/code change)
pnpm --filter @workspace/api-server run dev

# Push schema changes to DB
pnpm --filter @workspace/db run push

# Regenerate API client from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Full typecheck
pnpm run typecheck
```

### File naming conventions:
- DB schema properties: **snake_case** (matches PostgreSQL column names)
- Frontend TypeScript interfaces: **snake_case** (matches API response)
- Route files: **kebab-case** (e.g., `blog-settings.ts`)
- React components: **PascalCase** (e.g., `BlogAdmin.tsx`)

---

**Last Updated**: April 2026
**Maintained By**: AI Agent on Replit
