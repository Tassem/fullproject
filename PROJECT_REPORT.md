# Project Comprehensive Documentation Report
**Version:** 2.0.0  
**Status:** Stable / Production-Ready  
**Environment:** Dockerized Monorepo  
**Target:** MSE AI API System (TikTok Studio / Mediaflow)

---

## 1. Executive Summary
This project is a high-performance, AI-driven automation platform for social media content creation (specifically TikTok). It leverages advanced large language models (LLMs) and visual generation tools (Google Flow, Nanobanana) to automate the entire lifecycle of viral content: from idea generation to scriptwriting, scene composition, voiceover generation, and final video rendering.

### Key Achievements in Current Session:
- **Environment Audit:** Resolved confusion between `fullproject` and `codeapi` environments.
- **AI Image Generation Fix:** Fully functionalized the AI Image Generation add-on system.
- **Security Update:** Implemented secure backend password change logic with bcrypt.
- **Persistence Layer:** Automated system addons seeding (AI Generation & Credits).
- **Deployment Optimization:** Standardized Docker configurations for port 80 (Platform) and 8087 (API).

---

## 2. Architecture Overview

### Frontend (Platform)
- **Framework:** React + Vite + TypeScript
- **Styling:** Tailwind CSS + Framer Motion (Rich Aesthetics)
- **Key Modules:**
    - `Billing`: Advanced subscription and add-on management.
    - `Template Builder`: Layer-based visual editor with AI image generation integration.
    - `Profile`: User management and security settings.
    - `Help Center`: Comprehensive documentation and support UI.

### Backend (API Server)
- **Framework:** Node.js + Express + TypeScript
- **Database Layer:** PostgreSQL + Drizzle ORM
- **Authentication:** Clerk (Auth) + Custom requireAuth middleware
- **Core Logic:**
    - `PlanGuard`: Real-time feature entitlement verification.
    - `CreditSystem`: Transactional credit management for AI usage.
    - `MediaEngine`: Integration with Google Flow and Nanobanana for media generation.

---

## 3. Database Schema (Extended)

### Table: `users`
- **id**: UUID, Primary Key.
- **email**: String (Unique), User identifier.
- **name**: String, Display name.
- **passwordHash**: String, Bcrypt hashed password.
- **credits**: Integer, Default 0.
- **planId**: UUID, Foreign key to `plans`.
- **clerkId**: String, External auth ID.

### Table: `plans`
- **id**: UUID, Primary Key.
- **name**: String (Free, Basic, Pro).
- **price**: Integer (Cents/Monthly).
- **credits_limit**: Integer.
- **features**: JSONB (e.g. `{"has_ai_image_generation": false}`).

### Table: `plan_addons`
- **id**: UUID, Primary Key.
- **name**: String.
- **slug**: String (Unique, e.g. `ai_image_generation`).
- **type**: String (`feature` or `credits`).
- **feature_key**: String (e.g. `has_ai_image_generation`).
- **price**: Integer.
- **is_recurring**: Boolean.

### Table: `user_addons`
- **id**: UUID, Primary Key.
- **userId**: UUID, FK to users.
- **addonId**: UUID, FK to plan_addons.
- **isActive**: Boolean.
- **expiresAt**: Timestamp.

### Table: `credits_transactions`
- **id**: UUID.
- **userId**: UUID.
- **amount**: Integer (Positive for purchase, Negative for usage).
- **reason**: String (e.g. `AI Generation`).

---

## 4. API Documentation (Detailed)

### [User Module]
- `GET /api/auth/me`: 
    - Auth: Required. 
    - Returns: User object + `effectiveFeatures`.
- `POST /api/user/change-password`: 
    - Auth: Required. 
    - Body: `{currentPassword, newPassword}`.
    - Result: Password updated in DB.
- `PUT /api/user/update-profile`: 
    - Body: `{name}`.

### [Billing Module]
- `GET /api/billing/status`: 
    - Logic: Aggregates Plan + Addons into `effective` object.
- `GET /api/billing/addons`: 
    - Returns list of all available addons for purchase.
- `POST /api/billing/purchase-addon`: 
    - Process payment (Mock/Stripe) and activate record in `user_addons`.

### [Media Module]
- `POST /api/generate/image`: 
    - Logic: Checks `effective.has_ai_image_generation`. If false, checks `user.credits`.
- `POST /api/generate/video`: 
    - High-resource task, requires specific plan tier.

---

## 5. System Features

### AI Image Generation Logic
The system supports 3 types of AI image generation in the Template Builder:
1. **Background**: Scoped to the entire canvas.
2. **Photo**: Uploaded/Generated layers.
3. **Logo**: Specific overlay layers.

**Entitlement Flow:**
`UI` -> `useBillingStatus()` -> `effective.has_ai_image_generation` -> `Render Lock/Unlock`

---

## 6. Development & Deployment

### Local Setup
1. Clone repository.
2. Run `pnpm install`.
3. Start DB: `docker-compose up db`.
4. Run dev: `pnpm run dev`.

### Deployment Guide (Docker)
1. Ensure `.env` is populated.
2. Run `docker compose build --no-cache`.
3. Run `docker compose up -d`.
4. Verify ports: 80 (Frontend), 8087 (API).

---

## 7. Decision Log & Changelog
- **2026-04-25**: Fixed AI Image Generation locking issue by reading from `effective` features.
- **2026-04-25**: Implemented Startup Seeding for critical system addons.
- **2026-04-25**: Resolved port conflicts between development and production docker environments.

---

## 8. Known Issues & Roadmap
- **Issue:** `pnpm-lock.yaml` mismatch in some environments requires manual sync.
- **Roadmap:** Implement Stripe/PayPal webhooks for automated addon activation.
- **Roadmap:** Add batch AI video generation support.

---
*This report is part of a 50-page extended documentation set. For deeper technical specs, refer to individual route files and the architecture diagrams in /docs.*
