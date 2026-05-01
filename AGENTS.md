# AGENTS.md — DubDub22 Suppressor (opencode_dubdub22)

## Project Overview
- **Repo**: https://github.com/DubDub22/opencode_dubdub22
- **Stack**: Vite v5, React 19, Express 4, TypeScript 5.6, Drizzle ORM, Tailwind v4, shadcn/ui (Radix), pg (Neon), framer-motion
- **Dev server**: Port 5002 on Linode (45.33.121.147), `npm run dev`
- **Build**: `npm run build` → vite build + esbuild server/index-prod.ts → dist/
- **Lint/TypeCheck**: `npx tsc --noEmit` (many pre-existing TS errors in server/routes.ts, home.tsx, etc. — these are known/expected, build still passes)

## Auth System (Dealer)
- Token-based auth, NOT session-based
- Login: POST `/api/dealer/auth/login` → returns `{ token }` stored in `localStorage("dubdub_token")`
- Middleware: `requireDealerAuth` in `server/routes/dealer-auth.ts` reads `x-auth-token` header
- Server stores tokens in `Map<string, {dealerId, email}>` in `dealer-auth.ts`
- Protected routes MUST use `(req as any).dealerId`, NOT `req.session!.dealerId!`
- Client must send `x-auth-token` header on all protected API calls

## Recent Fixes
- Fixed missing `catch` block in `/api/dealer/auth/register` handler (build break)
- Fixed token/session mismatch: all protected routes used `req.session!.dealerId!` but session was never set → changed to `(req as any).dealerId`
- Fixed missing `x-auth-token` headers on client pages: dealer-order.tsx, dealer-tax-form.tsx, dealer-dashboard.tsx
- Logout now removes token from server Map and clears localStorage

## Key Files
- `server/routes.ts` — main API routes (admin, submissions, retail, etc.)
- `server/routes/dealer-auth.ts` — dealer auth routes
- `server/fastbound.ts` — FastBound API client (NFA dispositions)
- `server/shipstation.ts` — ShipStation API client (labels)
- `client/src/pages/admin.tsx` — admin dashboard
- `client/src/pages/dealer-login.tsx` — dealer login page
- `client/src/pages/dealer-dashboard.tsx` — dealer dashboard
- `client/src/pages/dealer-order.tsx` — dealer order page
- `client/src/pages/dealer-register.tsx` — dealer registration

## Dev Environment
- Linode at 45.33.121.147, dev on port 5002
- SSH into Linode, `cd /path/to/repo && git pull && npm install && npm run build && pm2 restart`
- PM2 process: `dubdub-suppressor` runs `dist/index.js`
- Deploy script: `deploy.sh`
