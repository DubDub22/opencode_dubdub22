# AGENTS.md — DubDub22 Suppressor (opencode_dubdub22)

## Project Overview
- **Repo**: https://github.com/DubDub22/opencode_dubdub22
- **Local working copy**: `C:\opencode_dubdub22`
- **Stack**: Vite v5, React 19, Express 4, TypeScript 5.6, Drizzle ORM, Tailwind v4, shadcn/ui (Radix), pg (Neon), framer-motion
- **Build**: `npm run build` → vite build + esbuild server/index-prod.ts → dist/
- **Local Node**: `C:\Program Files\nodejs\node.exe` (v24.15.0)

## Local Development
- **USE GIT BASH** (`C:\Program Files\Git\bin\bash.exe`), not PowerShell
- Start opencode from Git Bash: `cd /c/opencode_dubdub22 && opencode`
- If opencode not in PATH: `export PATH="$PATH:$(dirname $(npm root -g))/npm"`

## Linode Infrastructure
### SSH Access
- **Alias**: `ssh linode-dubdub22` | **Host**: 45.33.121.147 | **User**: root
- **SSH key**: `C:\Users\txmed\.ssh\dubdub22` (ed25519, comment: opencode-dubdub22)

### Services
| Port | Service | DB | Repo Path |
|------|---------|-----|-----------|
| 5001 | Production | `dubdub22` | `/home/dubdub/DubDubSuppressor` |
| 5002 | Dev | `dubdub22_dev` | `/home/dubdub/opencode_dubdub22` |
| 5432 | PostgreSQL | both | postgres |

### Dev Server Commands (from Git Bash)
```bash
# Restart
ssh linode-dubdub22 'pkill -9 -f "tsx.*index-dev"; sleep 2; cd /home/dubdub/opencode_dubdub22 && nohup npx tsx -r dotenv/config server/index-dev.ts > /root/dev-server.log 2>&1 < /dev/null & disown'

# Check
ssh linode-dubdub22 'ss -tlnp | grep 5002'

# Logs
ssh linode-dubdub22 'cat /root/dev-server.log'

# Clean DB
ssh linode-dubdub22 'su - postgres -c "psql dubdub22_dev -f /tmp/full-cleanup.sql"'
```

### API Credentials (DEV Sandbox — NEVER production!)
- **FastBound**: Account 146853, Audit txmedictom@gmail.com
- **ShipStation**: test_ keys
- **FastBound API**: `https://cloud.fastbound.com/{account}/api` (NOT api.fastbound.com)
- **Swagger**: https://cloud.fastbound.com/swagger

## Auth System
- Token-based (NOT session). Login returns token stored in localStorage("dubdub_token")
- Middleware reads `x-auth-token` header. Routes use `(req as any).dealerId`

## FastBound NFA Disposition Flow
### Dealer places order
- No items: `POST /Dispositions/NFA` + `PUT /Dispositions/{id}/AttachContact/{contactId}`
- With items: `POST /Dispositions/CreateAsPending` (single call)
- Stores order_number (DD22-YYYYMMDD-XXXX), invoice_number, fastbound_disposition_id on submissions

### Admin serial assignment ("FB Pending" button)
- Auto-loads inventory via `GET /Items` (manufacturer: "DubDub LLC" sandbox, "DOUBLE TACTICAL" prod)
- Checkbox UI with "First N" / "Select All" / "Clear"
- Submits item UUIDs → `POST /Dispositions/{id}/Items` (`{ items: [{ id, price }] }`)

### Form 3 buttons
- **Form 3 Pending** → email dealer (Net 30 info, no doc check)
- **Form 3 ✓** → ShipStation label + commit + email with tracking

### Key Endpoints (ALL PascalCase)
| Endpoint | Usage |
|----------|-------|
| `POST /Dispositions/NFA` | Create NFA (no items) |
| `POST /Dispositions/CreateAsPending` | Create with contact + items |
| `PUT /Dispositions/{id}/AttachContact/{cid}` | Attach contact |
| `POST /Dispositions/{id}/Items` | Add items |
| `POST /Dispositions/{id}/Commit` | Finalize |
| `GET /Items` | Inventory (field: `serial`, not serialNumber) |
| `POST /contacts` | Create contact |

## Key Files
- `server/routes.ts` — main routes (VERY LARGE)
- `server/routes/dealer-auth.ts` — dealer auth + order
- `server/fastbound.ts` — FastBound client
- `server/shipstation.ts` — ShipStation client
- `client/src/pages/admin.tsx` — admin dashboard
- `shared/schema.ts` — DB schema

## Recent Commits
- `f4ba3b2` — inventory import, CreateAsPending fallback, checkbox UI
- `ae9fa79` — addItemsToDisposition
- `94d37ea` — CreateAsPending (3 calls → 1)
- `0032f05` — PascalCase paths, Form 3 workflow
- `bd519de` — store FB contact ID on dealer
