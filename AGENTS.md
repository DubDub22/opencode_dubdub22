# AGENTS.md — DubDub22 Suppressor (opencode_dubdub22)

## REPOS — Know Which Is Which

| Repo | Purpose | GitHub | Local Path | DO NOT PUSH TO PROD |
|------|---------|--------|------------|---------------------|
| **opencode_dubdub22** | DEV / sandbox | `DubDub22/opencode_dubdub22` | `C:\opencode_dubdub22` | ← THIS IS THE ONE WE WORK IN |
| DubDubSuppressor | PRODUCTION | `DubDub22/DubDubSuppressor` | `/home/dubdub/DubDubSuppressor` on Linode | **NEVER push here** |

Production is a SEPARATE repo. All dev work happens in opencode_dubdub22. When ready to go live, someone manually promotes changes to production.

## Project Overview
- **Stack**: Vite v5, React 19, Express 4, TypeScript 5.6, Drizzle ORM, Tailwind v4, shadcn/ui (Radix), pg (Neon), framer-motion
- **Build**: `npm run build` → vite build + esbuild server/index-prod.ts → dist/
- **Local Node**: `C:\Program Files\nodejs\node.exe` (v24.15.0)
- **TypeScript**: 0 errors as of commit `eb9a260`. Run `npx tsc --noEmit` to verify.

## Local Development
- **USE GIT BASH** (`C:\Program Files\Git\bin\bash.exe`), not PowerShell
- Start opencode from Git Bash: `cd /c/opencode_dubdub22 && opencode`

## Linode Infrastructure

### SSH
- **Alias**: `ssh linode-dubdub22`
- **Host**: 45.33.121.147
- **User**: root
- **SSH key**: `C:\Users\txmed\.ssh\dubdub22` (ed25519)

### Services
| Port | Environment | DB Name | Repo Path on Linode |
|------|------------|---------|---------------------|
| 5001 | **PRODUCTION** | `dubdub22` | `/home/dubdub/DubDubSuppressor` |
| 5002 | **DEV** | `dubdub22_dev` | `/home/dubdub/opencode_dubdub22` |
| 5432 | PostgreSQL | both | postgres |

### Dev Server Commands (from Git Bash)
```bash
# Quick restart (wrapped in subshell to avoid SSH hang)
ssh linode-dubdub22 'pkill -9 -f "tsx.*index-dev" ; sleep 2 ; cd /home/dubdub/opencode_dubdub22 && (nohup npx tsx -r dotenv/config server/index-dev.ts > /root/dev-server.log 2>&1 &) && echo restarted'

# Check if running
ssh linode-dubdub22 'ss -tlnp | grep 5002'

# View logs
ssh linode-dubdub22 'tail -50 /root/dev-server.log'

# Deploy single file (no restart needed for client files, vite HMR)
scp client/src/pages/admin.tsx linode-dubdub22:/home/dubdub/opencode_dubdub22/client/src/pages/admin.tsx

# Deploy multiple files + restart
cd /c/opencode_dubdub22 && tar czf /tmp/patch.tar.gz file1.ts file2.ts && scp /tmp/patch.tar.gz linode-dubdub22:/tmp/ && ssh linode-dubdub22 'cd /home/dubdub/opencode_dubdub22 && tar xzf /tmp/patch.tar.gz && pkill -9 -f "tsx.*index-dev" ; sleep 2 ; cd /home/dubdub/opencode_dubdub22 && (nohup npx tsx -r dotenv/config server/index-dev.ts > /root/dev-server.log 2>&1 &) && echo deployed'

# Clean up test dealer
ssh linode-dubdub22 "cat > /tmp/del_double.sql << 'SQL'
DELETE FROM dealer_submissions WHERE dealer_id IN (SELECT id FROM dealers WHERE business_name = 'DOUBLE T TACTICAL');
DELETE FROM dealer_tax_forms WHERE dealer_id IN (SELECT id FROM dealers WHERE business_name = 'DOUBLE T TACTICAL');
DELETE FROM dealer_orders WHERE dealer_id IN (SELECT id FROM dealers WHERE business_name = 'DOUBLE T TACTICAL');
DELETE FROM dealers WHERE business_name = 'DOUBLE T TACTICAL';
SQL
su - postgres -c 'psql dubdub22_dev -f /tmp/del_double.sql'"
```

## API Credentials (DEV Sandbox — NEVER reuse for production)

### FastBound (Sandbox)
- **Account**: 146853
- **Audit email**: txmedictom@gmail.com
- **API Key**: `FqHny-t3ZaCCCpxiHpTRmODLPr_SPLwKuHPuyS08c8A` (in `.env` on dev server)
- **Base URL**: `https://cloud.fastbound.com/146853/api` (NOT api.fastbound.com)
- **Swagger**: https://cloud.fastbound.com/swagger
- **Inventory manufacturer filter**: "DubDub LLC" (sandbox), "DOUBLE TACTICAL" (production)

### ShipStation (Sandbox)
- **test_ keys** — in `.env` on dev server
- Sandbox only. Production has real keys.

### Gmail API (DEV)
- **Client ID**: `599460954717-lm5na2vj61j4hio5dikrfg71ep7b0fk9.apps.googleusercontent.com`
- **Client Secret**: in `.env` on dev server (`GMAIL_CLIENT_SECRET`)
- **Refresh Token**: stored in `/home/dubdub/opencode_dubdub22/gmail_token.json`
- **Token path**: configurable via `GMAIL_TOKEN_PATH` env var, defaults to `gmail_token.json` in project root
- **Sender**: defaults to `tomtrevino@doublettactical.com`, configurable via `GMAIL_SENDER_ACCOUNT`
- To regenerate: use https://developers.google.com/oauthplayground with `https://mail.google.com/` scope

### Gmail OAuth Regeneration Steps
1. Go to https://developers.google.com/oauthplayground
2. Gear icon → "Use your own OAuth credentials" → paste Client ID + Secret
3. Step 1: select `https://mail.google.com/` scope
4. Authorize → Exchange authorization code for tokens
5. Save the **refresh token** to `gmail_token.json` as `{"refresh_token": "..."}`

### Other API Keys (on dev server .env)
- **DISCORD_WEBHOOK_URL** — tax form acceptance notifications
- **FASTBOUND_API_KEY** — same as above
- **FASTBOUND_AUDIT_USER** — `txmedictom@gmail.com`

## Date Handling — ALWAYS USE CST
All dates sent to FastBound, ShipStation, or any external service MUST use CST (America/Chicago). The server is UTC and will spill into "tomorrow" otherwise.

**Use the shared utility** (`shared/dates.ts`):
```ts
import { todayCST, compactCST } from "../shared/dates";
// todayCST()     → "2026-05-01"     (YYYY-MM-DD in CST)
// compactCST()   → "20260501"       (YYYYMMDD in CST)
```

DO NOT use `new Date().toISOString().slice(0, 10)` for dates sent to external APIs. That's UTC and will fail FastBound validation when UTC rolls past midnight before CST.

## Auth System
- Token-based (NOT session). Login returns token stored in `localStorage("dubdub_token")`
- Middleware reads `x-auth-token` header. Routes use `(req as any).dealerId`

## What Works (Verified on Dev May 1, 2026)

### Registration Flow (`/apply`)
1. FFL lookup against ATF database + dealer table
2. FFL/SOT file upload with parsing
3. **Multi-state tax form**: filled with dealer info, digital signature, flattened → stored on dealer record
4. **FastBound contact**: auto-created via `createOrUpdateContact()`, contact ID saved to `dealers.fastbound_contact_id`
5. **ZIP package email**: all docs (tax form, FFL, SOT) bundled into ZIP and emailed via Gmail
6. Tax form state documents (`tax_form_state`) auto-archived so they don't clutter admin dashboard

### FastBound NFA Disposition Flow
- **Dealer places order** (`/api/dealer/place-order`) → creates submission with `order_number` + `invoice_number`, creates pending NFA disposition with FastBound, stores `fastbound_disposition_id`
- **Admin "FB Pending" button** → opens dialog with serial number inventory, checkbox selection UI, "First N" / "Select All" / "Clear" buttons
- **CreateAsPending**: single API call with items, contact, order number, invoice number
- **Existing dispositions**: adds items to existing disposition instead of creating duplicate
- **Contact reuse**: uses `fastbound_contact_id` from dealer record if available, otherwise creates new
- **Invoice/Order numbers**: passed to FastBound in disposition for traceability

### Key FastBound Endpoints (ALL PascalCase)
| Endpoint | Usage |
|----------|-------|
| `POST /Dispositions/NFA` | Create NFA (no items) |
| `POST /Dispositions/CreateAsPending` | Create with contact + items (preferred) |
| `PUT /Dispositions/{id}/AttachContact/{cid}` | Attach contact |
| `POST /Dispositions/{id}/Items` | Add items to existing |
| `POST /Dispositions/{id}/Commit` | Finalize disposition |
| `GET /Items` | Inventory (field: `serial`, not serialNumber) |
| `POST /contacts` | Create contact |
| `POST /Dispositions/{id}/CommitDispositionAndCreateForm3` | Commit + Form 3 |

### Admin Dashboard
- Documents column **removed** (all docs collected at registration now)
- `tax_form_state` submissions auto-archived (not shown in main tabs)
- FFL database update: downloads from ATF URL (not file upload)
- FastBound inventory auto-loads when dialog opens

## Needs Testing

### Form 3 Workflow (NOT YET TESTED)
- "Form 3 ✓" button → creates ShipStation label + commits FastBound disposition + generates invoice PDF + emails dealer
- ShipStation label creation → sandbox keys configured, need to verify end-to-end
- Invoice PDF generation with serial numbers + tracking

### Edge Cases
- Dealer with no FFL/SOT uploads (inquiry-only flow)
- Multiple orders from same dealer
- Demo unit ordering
- Warranty submissions
- Retail orders (non-dealer)

## TODO / Known Gaps

### Serial Number Assignment — Prevent Duplicates
**Problem**: The FB Pending inventory dialog pulls ALL open DubDub22 items from FastBound, including serials already assigned to other submissions. An admin could accidentally assign the same serial twice.

**Fix needed**:
1. After pulling inventory from FastBound (`GET /Items`), cross-reference with `submissions.serial_number` (comma-separated) to exclude already-assigned serials
2. On the server endpoint `/api/admin/submissions/:id/fastbound-pending`, filter `availableSerials` to remove any serial that appears in any submission's `serial_number` column
3. Alternatively: after assigning serials, immediately "consume" the item in FastBound so it no longer shows as open

**Implementation approach**: Add a SQL query in the inventory endpoint or filter in the frontend that checks `SELECT serial_number FROM submissions WHERE serial_number IS NOT NULL` and excludes those serials from the dropdown. This way the UI only shows truly available DubDub22 serials.

## Key Files
| File | Purpose |
|------|---------|
| `server/routes.ts` | Main routes — VERY LARGE, be careful |
| `server/routes/dealer-auth.ts` | Registration, login, order placement, tax form fill |
| `server/fastbound.ts` | FastBound API client — dispositions, contacts, inventory |
| `server/shipstation.ts` | ShipStation API — label creation |
| `client/src/pages/admin.tsx` | Admin dashboard — submissions, FB Pending, Form 3 |
| `client/src/pages/apply.tsx` | Dealer application / registration |
| `client/src/pages/dealer-register.tsx` | New dealer registration with digital signature |
| `shared/schema.ts` | DB schema (Drizzle ORM) |
| `shared/dates.ts` | CST date utilities — USE THESE for external API dates |

## Database Access (Dev)
```bash
ssh linode-dubdub22 'su - postgres -c "psql dubdub22_dev"'
# Quick queries:
ssh linode-dubdub22 "su - postgres -c \"psql dubdub22_dev -c 'SELECT id, business_name, email, fastbound_contact_id FROM dealers ORDER BY created_at DESC LIMIT 5;'\""
```

## Latest Commit
`eb9a260` — "comprehensive fix: TypeScript errors, registration flow, Gmail, FB dates, clean dashboard"
