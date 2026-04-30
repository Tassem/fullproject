// Test setup — set required env vars before any module is imported
process.env.SESSION_SECRET = "test-secret-for-vitest-at-least-32-chars-long";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://mediaflow:password@localhost:5434/mediaflow";
process.env.CORS_ORIGINS = "http://localhost:3000,http://localhost:8000";
