# PROJECT SKILLS & ARCHITECTURE LOG

This document serves as the master reference for the project's architecture, features, and historical decisions. It is a living document intended to provide context for any AI assistant or developer working on the codebase.

---

## 1. PROJECT OVERVIEW
**Project Name:** Unified SaaS Platform / News Card & Blog Automation
**Structure:** Monorepo using `pnpm workspaces`.
**Core Goal:** A comprehensive platform for news aggregation, AI-driven article generation, visual card creation, and multi-channel distribution (Web, Telegram, etc.).

---

## 2. TECHNICAL STACK
- **Frontend (Platform):** React (Vite), TypeScript, TailwindCSS, Radix UI, TanStack Query, Wouter (Routing).
- **Backend (API Server):** Node.js (Express), TypeScript, Pino (Logging).
- **Database:** PostgreSQL with Drizzle ORM.
- **Infrastructure:** Docker & Docker Compose (api, platform, db, nginx).
- **Auth:** Custom Auth system (standardized on `pro_token` in localStorage).
- **AI Integration:** OpenAI, OpenRouter, and Custom Proxies (Nanobanana, etc.).
- **Networking Pattern:** Uses `host.docker.internal` to allow Docker containers to communicate with services running on the host machine (e.g., local AI proxies).
- **Nanobanana Stream Fix**: Standardized prefix cleaning (`data: `, `[DONE]`) for SSE compatibility.
- **Custom Background Save Fix**: Removed `has_overlay_upload` restriction in `photo.ts` to allow persistence of uploaded images for all users. Enforced 5MB limit.
- **Builder Render Error (500)**: Fixed `ReferenceError` in `generate.ts` by replacing the undefined `settingsTable` with `systemSettingsTable` (or using `getSetting` utility) and adding robust `try/catch` wrapping for the entire route.

## 🛠 Troubleshooting & Common Fixes

### "Server render failed" in Builder
- **Symptom**: Red toast error when clicking "Generate Card".
- **Cause**: Often a `ReferenceError` in the backend (e.g., missing table imports) or a memory crash in the canvas renderer.
- **Solution**: Ensure `systemSettingsTable` is imported and used correctly. Check `docker logs api` for crash details.

### Background image disappears after saving
- **Symptom**: User uploads a background, it shows in editor, but is gone after saving and refreshing.
- **Cause**: Silent failure of the `/api/photo/upload` call due to plan restrictions (e.g., `has_overlay_upload`).
- **Solution**: Remove the plan guard in `photo.ts` or ensure the user has the required feature flag.

---

## 3. CORE ARCHITECTURE & WORKSPACES
The project is split into three main workspaces:
1.  **`artifacts/platform`**: The React frontend dashboard.
2.  **`artifacts/api-server`**: The Express backend handling pipelines and business logic.
3.  **`artifacts/db`**: Database schema and Drizzle migrations.

---

## 4. AUTHENTICATION & ACCESS CONTROL

### 4.1 Unified Auth System
- **Context:** `AuthProvider` in `platform/src/contexts/auth.tsx` is the single source of truth.
- **Token:** Uses `pro_token` stored in `localStorage`.
- **Hooks:** Use `useAuth()` to access user state and logout/login functions.
- **Guards:**
    - `AuthGuard`: Redirects unauthenticated users to `/login`.
    - `FeatureGuard`: Controls access to specific features based on the user's plan.
    - `planGuard.ts`: Backend logic for checking feature permissions.

### 4.2 User Roles & Plans
- **Roles:** `Admin`, `User`.
- **Plans:** `Free`, `Monthly`, `Purchased` (Credits-based), `Business`.
- **Admin Privilege:** Admins bypass all plan-based restrictions.

---

## 5. AI PIPELINE & ORCHESTRATION

### 5.1 Prompt Director (`promptDirector.ts`)
- Transforms Arabic headlines into detailed English prompts for image generation.
- Handles visual analysis of images to regenerate similar styles.
- **Robustness:** Includes try-catch parsing for AI responses to handle HTML/error pages gracefully with an English fallback.

### 5.2 Custom AI Slots
- The system supports up to 3 "Custom AI" slots in the settings.
- These allow users to plug in their own OpenAI-compatible proxies or specialized engines like **Nanobanana**.

### 5.3 Nanobanana Integration
- **Purpose:** Custom image generation engine.
- **Implementation:** Handles polling/jobs (SSE-like) since Nanobanana works asynchronously.
- **Resilience:** Backend logic cleans up `data: ` prefixes from streaming responses if the provider ignores `stream: false`.

---

## 6. CONTENT MANAGEMENT

### 6.1 RSS & Article Generation
- Pipelines to fetch RSS feeds, summarize content using AI, and generate matching visuals.
- Support for "Story Summary" and "Video Analysis" pipelines.

### 6.2 News Card Generator
- Specialized components for rendering news cards with custom overlays, branding, and layouts.

---

## 7. ADMIN DASHBOARD FEATURES
- **System Settings:** Control over AI providers, API keys, and global site configurations.
- **Blog Admin:** Management of generated articles, RSS feeds, and categories.
- **User Management:** Viewing user plans, credits, and usage statistics.

---

## 8. RESOLVED CRITICAL ISSUES (History)

### 8.1 Platform Rendering Fixes (2026-04-27)
- **Issue:** Blank/Dark screen on load.
- **Fix:** Corrected Provider hierarchy in `App.tsx`. `QueryClientProvider` must wrap `AuthProvider` because the latter uses React Query hooks (`useGetMe`).
- **Diagnosis:** `RootErrorBoundary` caught "No QueryClient set".

### 8.2 AI JSON Parsing Resilience (2026-04-27)
- **Issue:** Generation crashes when AI returns HTML error pages instead of JSON.
- **Fix:** Added try-catch to `extractJson` and a robust fallback mechanism in `promptDirector.ts`.

### 8.3 Admin Dashboard Syntax Overhaul (2026-04-26)
- **Issue:** `admin.tsx` had massive syntax errors (missing closing tags, stray braces) breaking the entire build.
- **Fix:** Manual re-balancing of the JSX tree and removal of stray code blocks.

### 8.4 CSP & Nginx Configuration (2026-04-26)
- **Issue:** Strict Content Security Policy blocking inline styles.
- **Fix:** Updated `Dockerfile.platform` to inject a more permissive CSP header in the Nginx config.

### 8.5 Nanobanana Streaming Fix (2026-04-23)
- **Issue:** Nanobanana provider sent "data: ..." stream chunks even when `stream: false` was requested.
- **Fix:** Implemented a robust text parser that cleans SSE prefixes before JSON parsing.

### 8.6 Missing API Key Column (2026-04-22)
- **Issue:** The `provider_settings` table originally lacked a column for the actual API key, storing only a boolean.
- **Fix:** Added the `apiKey` column to the schema and updated the backend to persist the key, enabling full multi-provider support without relying on `.env` file environment variables.

---

## 9. GUIDELINES FOR DEVELOPERS

### 9.1 Coding Standards
- **Imports:** Use `@/` aliases for platform components.
- **Providers:** Always ensure new providers are placed at the correct level in `App.tsx` relative to their dependencies (e.g., QueryClient first).
- **Error Handling:** Use `ErrorBoundary` for new major UI sections to prevent full-app crashes.

### 9.2 Build Process
- Always build using `docker compose up -d --build` to ensure environment variables and Nginx configs are properly applied.
- The `api` and `platform` containers are the primary targets for builds.

---

*This document was compiled and summarized by Antigravity AI on 2026-04-28, based on the full conversation history and technical logs.*
