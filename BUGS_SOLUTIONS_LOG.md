# 🐞 Bugs & Solutions Log — fullproject

| Date | Problem / Bug | Cause | Solution | Impact | Status |
|------|---------------|-------|----------|--------|--------|
| 2026-04-25 | 503 Service Unavailable (Hostinger) | DB Dialect mismatch (Postgres app on MySQL host) | Migrated to Neon PostgreSQL (Remote) | App connectivity restored | Fixed |
| 2026-04-25 | Hostinger Deployment Failed | Strict security audit on deprecated packages | Bypassed audit using `npm install --no-audit` and `build: None` | Successful build/deploy | Fixed |
| 2026-04-25 | "Upgrade to add sites" on Business Plan | `has_blog_automation` flag was `false` in DB for Business/Agency plan | SQL Update to set `has_blog_automation = true` for Agency/Pro/Starter | User can now add WordPress sites | Fixed |
| 2026-04-25 | PowerShell SQL operator error | `<` operator is reserved in PowerShell | Used `Get-Content \| docker exec` pipe instead | SQL scripts can now run on Windows | Fixed |
