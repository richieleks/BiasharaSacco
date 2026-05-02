# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod, `drizzle-zod`
- **Build**: esbuild (ESM bundle)

## Artifacts

| Artifact | Kind | Path | Description |
|---|---|---|---|
| `artifacts/biashara-sacco` | web | `/` | Biashara SACCO React frontend (Vite + Tailwind v3 + Wouter) |
| `artifacts/api-server` | api | `/api` | Express API server — auth, routes, WebSocket, seed |
| `artifacts/mockup-sandbox` | design | `/mockup-sandbox` | Component preview / design sandbox |

## Key Libraries (Frontend)

- React 18 + Wouter (routing with `base={import.meta.env.BASE_URL}`)
- TanStack Query for data fetching (custom `queryClient.ts`)
- Tailwind CSS v3 + shadcn/ui components
- Radix UI primitives, Framer Motion, Recharts
- `qrcode.react`, `date-fns`, `react-hook-form` + zod

## Key Libraries (Backend)

- Express 5 + Passport (local strategy) + express-session + connect-pg-simple
- Drizzle ORM on PostgreSQL (`pg` pool)
- `bcryptjs`, `nodemailer`, `multer`, `otpauth`, `exceljs`
- `ws` (WebSocket), `memoizee`
- Routes registered via `registerRoutes(app)` + `registerFinancialReportRoutes(app)` pattern

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Notes

- Frontend imports `@workspace/db` for Zod schemas only; the vite alias in `vite.config.ts` maps it directly to `lib/db/src/schema/schema.ts` to avoid triggering DB connection code in the browser.
- Backend schema lives at `lib/db/src/schema/schema.ts` and is exported from `@workspace/db`.
- The original app was migrated from `.migration-backup/` — legacy code patterns are preserved intentionally.
