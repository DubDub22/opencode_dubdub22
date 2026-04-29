# DubDub Suppressor - Session Log
**Last Updated**: April 28, 2026
**Status**: In Progress - Ready to Resume

---

## 🎯 Project Goal
Integrate FastBound + ShipStation into DubDub22 suppressor order flow:
1. Assign serials → FastBound pending disposition
2. Form 3 approved (manual) → ShipStation label → commit disposition → email dealer

---

## ✅ Completed Tasks

### 1. FastBound API Client (`server/fastbound.ts`)
- `createOrUpdateContact()` - Create/get FFL contacts (don't send firstName/lastName/organizationName)
- `createPendingDisposition()` - Create pending disposition with items
- `commitDisposition()` - Commit after Form 3 approved
- `saveDispositionId()` / `getDispositionId()` - Track disposition ID in DB
- `searchInventoryItems()` - Get available serials from FastBound (filter: DOUBLE TACTICAL, DubDub22)
- `uploadContactDocument()` - Upload documents to FastBound contacts
- `uploadDealerDocumentsToFastBound()` - Unified function to upload all dealer docs
- `findContactByFFL()` - Find contact by FFL number
- `listContactAttachments()` / `downloadContactAttachment()` - Document download

### 2. ShipStation API Client (`server/shipstation.ts`)
- `createLabel()` - Create USPS shipping labels (10oz, medium flat rate box)
- `saveLabelInfo()` - Save tracking to database
- **SHIP_FROM address**: Tom Flores, 105 Bear Trce, Floresville, TX 78114

### 3. API Routes (`server/routes.ts`)
- `POST /api/admin/fastbound/inventory` - Get available serials from FastBound
- `POST /api/admin/submissions/:id/fastbound-pending` - Create pending disposition
- `POST /api/admin/submissions/:id/fastbound-commit` - Commit disposition
- `POST /api/admin/submissions/:id/shipstation-label` - Create ShipStation label
- `POST /api/admin/submissions/:id/form3-approved` - Full workflow (label + commit + email)
- `POST /api/admin/tax-form/generate` - Generate tax form PDF with pdf-lib
- **Document storage**: Migrated ALL from SFTP → FastBound contacts

### 4. Admin UI (`client/src/pages/admin.tsx`)
- "FB Pending" dialog - Assign serials, create FastBound pending disposition
- "Form 3 Approved" dialog - Full workflow execution
- Serial dropdown loaded from FastBound inventory
- Status badges for FastBound integration

### 5. Tax Form Generation (`client/src/pages/order-confirmation.tsx`)
- HTML form: Business Name, EIN, Address, City, State, Zip
- PDF generation with pdf-lib (server-side)
- Auto-download after generation

### 6. Document Storage Migration
- **OLD**: SFTP server (100.99.180.68) with `uploadDealerDocuments()`
- **NEW**: FastBound contacts with `uploadDealerDocumentsToFastBound()`
- All FFL, SOT, tax forms, Form 3 PDFs, invoices now upload to FastBound
- File serving endpoint updated to read from FastBound attachments

### 7. Deployment Configuration
- `ecosystem.config.js` - PM2 process manager config
- `nginx/dubdub22.com` - Nginx reverse proxy with SSL support
- `deploy.sh` - One-command deployment script
- `LINODE_SETUP_GUIDE.md` - Complete setup instructions

---

## 🔑 Critical API Credentials Needed

### FastBound (Sandbox)
```env
FASTBOUND_ACCOUNT=your_fastbound_account_id
FASTBOUND_API_KEY=your_fastbound_api_key
FASTBOUND_AUDIT_USER=Tom Flores
```

### ShipStation (Sandbox)
```env
SHIPSTATION_API_KEY=your_shipstation_api_key
SHIPSTATION_API_SECRET=your_shipstation_api_secret
```

### Gmail SMTP
```env
GMAIL_USER=orders@dubdub22.com
GMAIL_APP_PASSWORD=your_app_password
BCC_EMAIL=tom@doubletactical.com
```

---

## ⚠️ Important Technical Decisions

1. **FastBound Contact Creation**:
   - DO NOT send `firstName`, `lastName`, `organizationName` (rejected for FFL type)
   - ONLY send: `fflNumber`, `ein`, `einType`, `notes` (email stored here)
   - FastBound auto-populates `licenseName` as "LAST, FIRST"

2. **FastBound EIN Type Mapping**:
   - "1" → "1 - Importer"
   - "2" → "2 - Manufacturer"
   - "3" → "3 - Dealer"

3. **FastBound Inventory Filter**:
   - `dispositionId: "null"` - Only items in inventory
   - `manufacturer: "DOUBLE TACTICAL"`
   - `openOnly: "true"`

4. **Sole Proprietor vs LLC**:
   - Sole Proprietor: FastBound auto-populates personal name
   - LLC: Uses business name

5. **Database Column Added**:
   - `fastbound_disposition_id` in `submissions` table

---

## 📋 Next Steps (Resume Here)

### Tomorrow's Tasks:
1. **Set up own Linode** (or continue on partner's):
   - Follow `LINODE_SETUP_GUIDE.md`
   - Get Linode IP, SSH in, run setup commands

2. **Install pdf-lib** (need Node.js/npm working):
   ```bash
   cd C:\DubDubSuppressor
   npm install pdf-lib
   ```

3. **Add API Credentials** to `.env`:
   - FastBound sandbox credentials
   - ShipStation sandbox credentials
   - Gmail app password

4. **Test Full Workflow**:
   - Load Serials from FastBound
   - Create FB Pending Disposition
   - Mark Form 3 Approved (triggers: ShipStation label → FB commit → email dealer)
   - Verify tax form PDF generation
   - Verify documents upload to FastBound contacts

---

## 🗂️ Key File Locations

| File | Purpose |
|------|---------|
| `server/fastbound.ts` | FastBound API client (all FB functions) |
| `server/shipstation.ts` | ShipStation API client (label creation) |
| `server/routes.ts` | API endpoints (FB, ShipStation, tax form) |
| `client/src/pages/admin.tsx` | Admin UI with FB/ShipStation dialogs |
| `client/src/pages/order-confirmation.tsx` | Tax form + PDF generation |
| `shared/schema.ts` | DB schema (submissions table) |
| `shared/dealers-schema.ts` | Dealers table (ein, sotLicenseType) |
| `ecosystem.config.js` | PM2 config for Linode deployment |
| `nginx/dubdub22.com` | Nginx reverse proxy config |
| `LINODE_SETUP_GUIDE.md` | Complete Linode setup guide |
| `.env` | Environment variables (create from template) |

---

## 🚨 Critical Context for Resume

- **FastBound API Base**: `https://api.fastbound.com/api/v1`
- **FastBound Auth**: HTTP Basic, API key as username
- **FastBound Rate Limit**: 60 requests/min per API key
- **ShipStation API Base**: `https://ssapi.shipstation.com`
- **ShipStation Auth**: HTTP Basic, API key + secret
- **Database**: PostgreSQL (could be on Linode or external)
- **Node.js type**: ES Modules (`"type": "module"` in package.json)

---

## 📝 Git Commits Made Today

1. `Implement pdf-lib for tax form PDF generation`
2. `Migrate document storage from SFTP to FastBound contacts`
3. `Migrate Form 3 PDF, tax forms, and invoices from SFTP to FastBound`
4. `Add FastBound functions for document download + update file serving endpoint`
5. `Clean up SFTP comments and unused imports`
6. `Add Linode deployment configuration`
7. `Add comprehensive Linode deployment guide`

**Git Repo**: https://github.com/DubDub22/DubDubSuppressor.git
**Branch**: main

---

## 🔍 Quick Reference Commands

```bash
# Check Node.js/npm (needed for pdf-lib install)
node --version
npm --version

# Install pdf-lib
cd C:\DubDubSuppressor
npm install pdf-lib

# Deploy to Linode (once set up)
./deploy.sh

# Check PM2 status (on Linode)
pm2 status
pm2 logs dubdub-suppressor

# Check nginx (on Linode)
sudo nginx -t
sudo systemctl status nginx
```

---

**END OF LOG - Resume from "Next Steps" section above**
