import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import plansRouter from "./plans";
import creditsRouter from "./credits";
import statsRouter from "./stats";
import generateRouter from "./generate";
import templatesRouter from "./templates";
import botRouter from "./bot";
import sitesRouter from "./sites";
import articlesRouter from "./articles";
import pipelineRouter from "./pipeline";
import logsRouter from "./logs";
import settingsRouter from "./settings";
import adminRouter from "./admin";
import historyRouter from "./history";
import subscriptionRouter from "./subscription";
import keysRouter from "./keys";
import systemTemplatesRouter, { adminSystemTemplatesRouter } from "./system-templates";
import testRouter from "./test";
import photoRouter from "./photo";
import billingRouter from "./billing";
import paymentsUserRouter from "./payments_user";
import publicRouter from "./public";
import rssRouter from "./rss";
import blogSettingsRouter from "./blog-settings";
import nanobananaRouter from "./nanobanana/index";
import pointsRouter from "./points";
import v1Router from "./v1";
import savedDesignsRouter from "./saved-designs";
import aiBackgroundRouter from "./ai-background";
import addonsRouter from "./addons";
import supportRouter from "./support";
import userRouter from "./user";
import testCreditsRouter from "./test-credits";

import { requireAuth, requireAdmin } from "../lib/auth";
import { requireFeature } from "../lib/permissions";

const router: IRouter = Router();

// ── Public / Health ──────────────────────────────────────────────────────────
router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/plans", plansRouter);
router.use("/public", publicRouter);

// ── Protected (requireAuth) ──────────────────────────────────────────────────
router.use("/subscription", requireAuth, subscriptionRouter);
router.use("/credits", requireAuth, creditsRouter);
router.use("/stats", requireAuth, statsRouter);
router.use("/generate", requireAuth, generateRouter);
router.use("/history", requireAuth, historyRouter);
router.use("/keys", requireAuth, requireFeature("has_api_access"), keysRouter);
router.use("/templates", requireAuth, templatesRouter);
router.use("/bot", requireAuth, botRouter);
router.use("/sites", requireAuth, sitesRouter);
router.use("/settings", settingsRouter);
router.use("/admin", requireAuth, adminRouter);
router.use("/user", requireAuth, userRouter);
router.use("/billing", requireAuth, billingRouter);
router.use("/payments", requireAuth, paymentsUserRouter);

// ── Blog Automation Suite (Requires PRO+) ────────────────────────────────────
const requireBlog = [requireAuth, requireFeature("has_blog_automation")];
router.use("/articles", ...requireBlog, articlesRouter);
router.use("/pipeline", ...requireBlog, pipelineRouter);
router.use("/logs", ...requireBlog, logsRouter);
router.use("/rss", ...requireBlog, rssRouter);
router.use("/rss-feeds", ...requireBlog, rssRouter);
router.use("/blog-settings", ...requireBlog, blogSettingsRouter);

// ── Specialized Features ─────────────────────────────────────────────────────
router.use("/nanobanana", requireAuth, requireFeature("has_api_access"), nanobananaRouter);
router.use("/ai-background", requireAuth, requireFeature("has_ai_image_generation"), aiBackgroundRouter);

// ── System / Misc ────────────────────────────────────────────────────────────
router.use("/system-templates", systemTemplatesRouter);
router.use("/admin/system-templates", adminSystemTemplatesRouter);
router.use("/test", requireAuth, requireAdmin, testRouter);
router.use("/test-credits", requireAuth, requireAdmin, testCreditsRouter);
router.use("/photo", photoRouter);
router.use("/points", pointsRouter);
router.use("/v1", v1Router);
router.use("/saved-designs", savedDesignsRouter);
router.use("/designs", savedDesignsRouter);
router.use("/addons", addonsRouter);
router.use("/support", supportRouter);
router.use("/tickets", supportRouter);

export default router;
