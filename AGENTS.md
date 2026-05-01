# AGENTS.md — DubDub22 Suppressor (opencode_dubdub22)

## Project Overview
- **Repo**: https://github.com/DubDub22/opencode_dubdub22
- **Local working copy**: `C:\opencode_dubdub22`
- **Stack**: Vite v5, React 19, Express 4, TypeScript 5.6, Drizzle ORM, Tailwind v4, shadcn/ui (Radix), pg (Neon), framer-motion
- **Build**: `npm run build` → vite build + esbuild server/index-prod.ts → dist/
- **Lint/TypeCheck**: `npx tsc --noEmit` (many pre-existing TS errors in server/routes.ts, home.tsx, etc. — these are known/expected, build still passes)
- **Local Node**: `C:\Program Files\nodejs\node.exe` (v24.15.0), prepend to PATH before running npm: `$env:Path = "C:\Program Files\nodejs;" + $env:Path`

## Linode Infrastructure
### SSH Access
- **SSH alias**: `ssh linode-dubdub22`
- **Host**: 45.33.121.147
- **User**: root
- **SSH key**: `C:\Users\txmed\.ssh\dubdub22` (ed25519, comment: opencode-dubdub22)
- **SSH config**: `C:\Users\txmed\.ssh\config` has `Host linode-dubdub22` block
- **Git push**: use cached Windows credential manager (token for DubDub22 stored)

### Services on Linode
| Port | Service | DB | Repo | Code |
|------|---------|-----|------|------|
| 5001 | Production | `dubdub22` | `/home/dubdub/DubDubSuppressor` (doublettactical remote) | `dist/index.js` |
| 5002 | Dev | `dubdub22_dev` | `/home/dubdub/opencode_dubdub22` (DubDub22 remote) | `tsx server/index-dev.ts` |
| 80/443 | Nginx (production) | — | — | reverse proxy |
| 5432 | PostgreSQL | both DBs | — | postgres |

### Dev Server Commands (run via SSH)
```bash
# Start dev
su dubdub -c 'export DATABASE_URL=postgresql://dubdub_user:DubDubDB2024!@localhost/dubdub22_dev; export PORT=5002; export NODE_ENV=development; cd /home/dubdub/opencode_dubdub22; nohup npx tsx server/index-dev.ts > /tmp/dev-server.log 2>&1 &'

# Restart dev
pkill -f 'tsx server/index-dev.ts'
sleep 1
su dubdub -c 'export DATABASE_URL=postgresql://dubdub_user:DubDubDB2024!@localhost/dubdub22_dev; export PORT=5002; export NODE_ENV=development; cd /home/dubdub/opencode_dubdub22; nohup npx tsx server/index-dev.ts > /tmp/dev-server.log 2>&1 &'

# Check dev is running
ss -tlnp | grep 5002

# View dev logs
cat /tmp/dev-server.log

# Pull latest code + rebuild on Linode
cd /home/dubdub/opencode_dubdub22 && git pull origin main && npm install && npm run build

# Fix permissions after npm install (if run as root)
chown -R dubdub:dubdub /home/dubdub/opencode_dubdub22/node_modules
rm -rf /home/dubdub/opencode_dubdub22/node_modules/.vite
```

### Databases
- **Production**: `dubdub22` owned by postgres, user `dubdub_user` has access
- **Dev**: `dubdub22_dev` owned by dubdub_user, schema already populated (mirror of prod)
- **DB user**: `dubdub_user` / password in .env
- **Schema push (dev only)**: `npx drizzle-kit push` (requires TTY — run from local pointing at dev DB)

## Auth System (Dealer)
- Token-based auth, NOT session-based
- Login: POST `/api/dealer/auth/login` → returns `{ token }` stored in `localStorage("dubdub_token")`
- Middleware: `requireDealerAuth` in `server/routes/dealer-auth.ts` reads `x-auth-token` header
- Server stores tokens in `Map<string, {dealerId, email}>` in `dealer-auth.ts`
- Protected routes MUST use `(req as any).dealerId`, NOT `req.session!.dealerId!`
- Client must send `x-auth-token` header on all protected API calls

## Key Files
### Server
- `server/routes.ts` — main API routes (admin, submissions, retail, etc.) — **VERY LARGE FILE**
- `server/routes/dealer-auth.ts` — dealer auth routes
- `server/fastbound.ts` — FastBound API client (NFA dispositions)
- `server/shipstation.ts` — ShipStation API client (labels)
- `server/db.ts` — database connection using DATABASE_URL env var
- `server/storage.ts` — database storage interface
- `server/sftp-upload.ts` — SFTP file upload
- `server/ffl-master.ts` — FFL master list loader

### Client
- `client/src/pages/admin.tsx` — admin dashboard (very large)
- `client/src/pages/dealer-login.tsx` — dealer login form
- `client/src/pages/dealer-dashboard.tsx` — dealer dashboard + doc status + upload
- `client/src/pages/dealer-order.tsx` — dealer order placement
- `client/src/pages/dealer-register.tsx` — dealer registration (full)
- `client/src/pages/dealer-tax-form.tsx` — multi-state tax form
- `client/src/App.tsx` — route definitions (wouter)

## Recent Fixes
1. **Build fix**: missing `catch` block in `/api/dealer/auth/register` handler (`server/routes/dealer-auth.ts:31`)
2. **Login/auth fix**: token/session mismatch — all protected routes used `req.session!.dealerId!` but session was never set → changed to `(req as any).dealerId`
3. **Client fix**: added missing `x-auth-token` headers to all dealer auth API calls (dealer-order.tsx, dealer-tax-form.tsx, dealer-dashboard.tsx)
4. **Logout fix**: now removes token from server Map + clears localStorage
5. **Dev environment**: cloned repo to Linode `/home/dubdub/opencode_dubdub22`, set up separate dev DB `dubdub22_dev`, running on port 5002

## Session Log
- Fixed build + dealer login (token/session mismatch)
- Set up SSH key (`dubdub22` ed25519) on Linode via LISH console
- Cloned repo to Linode `/home/dubdub/opencode_dubdub22`
- Configured dev DB `dubdub22_dev` separate from production `dubdub22`
- Dev server running at http://45.33.121.147:5002
- All fixes committed and pushed to `main` as commits `b024304` and `6653509` and `1418556`
