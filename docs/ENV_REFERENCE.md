# iNexus — Environment Variables Reference

This document lists all environment variables required to run iNexus. In the Manus platform, these are managed via Settings > Secrets in the Management UI.

## Database

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | MySQL/TiDB connection string (e.g., `mysql://user:pass@host:3306/inexus`) |

## Authentication

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | Secret key for signing session cookies |
| `VITE_APP_ID` | Yes | Manus OAuth application ID |
| `OAUTH_SERVER_URL` | Yes | Manus OAuth backend base URL |
| `VITE_OAUTH_PORTAL_URL` | Yes | Manus login portal URL (frontend redirect) |

## Owner Info

| Variable | Required | Description |
|----------|----------|-------------|
| `OWNER_OPEN_ID` | Yes | Owner's Manus OpenID |
| `OWNER_NAME` | Yes | Owner's display name |

## Forge API (LLM, Storage, Notifications)

| Variable | Required | Description |
|----------|----------|-------------|
| `BUILT_IN_FORGE_API_URL` | Yes | Forge API base URL for server-side calls |
| `BUILT_IN_FORGE_API_KEY` | Yes | Bearer token for server-side Forge API |
| `VITE_FRONTEND_FORGE_API_URL` | Yes | Forge API base URL for frontend calls |
| `VITE_FRONTEND_FORGE_API_KEY` | Yes | Bearer token for frontend Forge API |

## Analytics (Optional)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_ANALYTICS_ENDPOINT` | No | Analytics endpoint URL |
| `VITE_ANALYTICS_WEBSITE_ID` | No | Analytics website identifier |

## Worker Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `ENABLE_WORKER` | No | Set to `true` to run job processor in-process (default: `false` in production) |
| `WORKER_CONCURRENCY` | No | Max concurrent jobs (default: `3`) |

## App Display

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_APP_TITLE` | No | Application title (default: `iNexus`) |
| `VITE_APP_LOGO` | No | Application logo URL |
