# Dealer Journey - Complete Flow

## Step 1: Click "Dealers" Button (Home Page)
**Page:** `client/src/pages/home.tsx:417`
**Action:** `window.location.href = '/dealers'`

---

## Step 2: Enter FFL Number (Dealers Portal)
**Page:** `client/src/pages/dealers.tsx:8-222`
**Data Collected:**
- FFL Number (6 segments: X-XX-XXX-XX-XXXXX)

**What Happens:**
1. User enters FFL number
2. Click "Verify" → calls `POST /api/ffl/validate`
3. **If FFL found in database:** Redirects to `/apply?ffl={ffl}` (verified dealer)
4. **If FFL NOT found:** Redirects to `/apply?ffl={ffl}&pending=1` (pending dealer)

---

## Step 3A: Pending Dealer (FFL Not in Database)
**Page:** `client/src/pages/apply.tsx` → `PendingUpload` component (line 90)
**URL:** `/apply?ffl={ffl}&pending=1`

### Data Collected (Required):
| Field | Type | Where it Goes | Required |
|-------|------|-----------------|----------|
| FFL Number | 6 segments → joined with "-" | `dealers.ffl_license_number` | ✅ Yes |
| FFL File | PDF/PNG/JPG | `dealers.ffl_file_data`, `dealers.ffl_file_name` → FastBound contact | ✅ Yes |
| Dealer Name | string | `dealers.business_name` | ✅ Yes |
| Contact Name | string | `dealers.contact_name` | ✅ Yes |
| Email | string (valid email) | `dealers.email` | ✅ Yes |
| Confirm Email | string (must match) | (validation only) | ✅ Yes |
| Phone | string (10+ digits) | `dealers.phone` | ✅ Yes |
| Address | string | `dealers.business_address` | ✅ Yes |
| City | string | `dealers.city` | ✅ Yes |
| State | string | `dealers.state` | ✅ Yes |
| ZIP Code | string | `dealers.zip` | ✅ Yes |
| EIN | string | `dealers.ein` | ✅ Yes |
| SOT File | PDF/PNG/JPG | `dealers.sot_file_data`, `dealers.sot_file_name` → FastBound contact | ✅ Yes* |
| Message | string | `dealers.notes` | ❌ Optional |

*SOT required UNLESS "My FFL has SOT on same page" checkbox is checked*

### What Happens on Submit:
**API Call:** `POST /api/ffl/upload` (line 171)

**Backend (`server/routes.ts:1809`):**
1. Validate FFL number format
2. Validate uploaded files (PDF/PNG/JPG, max 10MB)
3. Parse FFL/SOT files to extract data (optional)
4. Check if FFL exists in `dealers` table:
   - **If NOT exists:** Create new dealer with `verified=false`, `source='pending_upload'`
   - **If exists:** Update existing dealer record
5. Create submission entry in `submissions` table:
   - `type='dealer'`
   - `ffl_file_name`, `ffl_file_data`, `sot_file_name`, `sot_file_data` stored
6. Link submission to dealer via `dealer_submissions` table
7. **Upload documents to FastBound:**
   - `uploadDealerDocumentsToFastBound()` → Creates/gets FFL contact
   - Uploads FFL, SOT files to FastBound contact
8. **Send email to dealer:**
   - Auto-reply with confirmation
   - BCC to Tom (`BCC_EMAIL`)
   - Attaches multi-state tax form PDF
9. **Response:** `{ ok: true }` → Show success message

**Data Storage:**
- `dealers` table: business_name, contact_name, email, phone, address, city, state, zip, ein, ffl_license_number, ffl_file_data, sot_file_data, notes
- `submissions` table: type='dealer', contact_name, business_name, email, phone, ffl_license_number, ffl_file_data, sot_file_data, description (message)
- `dealer_submissions` table: Links dealer_id to submission_id
- **FastBound contact:** FFL file, SOT file uploaded as attachments

---

## Step 3B: Verified Dealer (FFL Found in Database)
**Page:** `client/src/pages/apply.tsx` → `DealerForm` component (line 495)
**URL:** `/apply?ffl={ffl}`

### Data Collected:
| Field | Type | Where it Goes | Required | Auto-Populated |
|-------|------|-----------------|----------|-------------------|
| FFL Number | string | From URL param | ✅ Yes | ✅ From DB |
| Dealer Name | string | `submissions.business_name` | ✅ Yes | ✅ From DB |
| Contact Name | string | `submissions.contact_name` | ✅ Yes | ✅ From DB |
| Email | string | `submissions.email` | ✅ Yes | ✅ From DB |
| Phone | string | `submissions.phone` | ✅ Yes | ✅ From DB |
| Address | string | `submissions.customer_address` | ✅ Yes | ✅ From DB |
| City | string | `submissions.customer_city` | ✅ Yes | ✅ From DB |
| State | string | `submissions.customer_state` | ✅ Yes | ✅ From DB |
| ZIP | string | `submissions.customer_zip` | ✅ Yes | ✅ From DB |
| Order Type | "inquiry" / "demo" / "stocking" | `submissions.type` | ✅ Yes | ❌ Default: "inquiry" |
| Quantity (stocking) | number | `submissions.quantity` | ✅ Yes (if stocking) | ❌ |
| SOT File | PDF/PNG/JPG | `submissions.sot_file_data` → FastBound | ❌ Optional | ❌ |
| Tax Form | PDF/PNG/JPG | `submissions.tax_form_data` → FastBound | ❌ Optional | ❌ |
| Message | string | `submissions.description` | ❌ Optional | ❌ |

### What Happens on Submit:
**API Call:** `POST /api/dealer-request` (line 667)

**Backend (`server/routes.ts:1990`):**
1. Validate required fields
2. Check if dealer email already has a demo unit shipped (hides demo option if so)
3. Create submission in `submissions` table:
   - `type` = "inquiry" / "demo" / "stocking"
   - All contact info stored
   - If "stocking": `quantity` set
4. Link to dealer via `dealer_submissions` table
5. **Upload documents to FastBound (if provided):**
   - SOT file → FastBound contact attachment
   - Tax form → FastBound contact attachment
6. **Send email to dealer:**
   - Confirmation with order details
   - BCC Tom
7. **Response:** `{ ok: true }` → Show success message

**Data Storage:**
- `submissions` table: All order details
- `dealer_submissions` table: Links dealer to submission
- **FastBound contact:** SOT, Tax form uploaded as attachments

---

## Step 4: Admin Reviews Submission (Admin Dashboard)
**Page:** `client/src/pages/admin.tsx`
**Data Reviewed:**
- Submission type (inquiry/demo/stocking)
- Contact info (name, email, phone)
- FFL number, dealer name
- Uploaded files (FFL, SOT, Tax form) — served from FastBound
- Order details (quantity, message)

**Admin Actions:**
1. **Archive submission** → `DELETE /api/admin/submissions/:id`
2. **Mark paid** → `PATCH /api/admin/submissions/:id/paid`
3. **Create FastBound Pending Disposition** → `POST /api/admin/submissions/:id/fastbound-pending`
4. **Form 3 Approved (full workflow)** → `POST /api/admin/submissions/:id/form3-approved`

---

## Step 5: FastBound Pending Disposition (Admin Action)
**Trigger:** Admin clicks "FB Pending" button
**API Call:** `POST /api/admin/submissions/:id/fastbound-pending`

**Backend (`server/routes.ts:XXXX`):**
1. **Get FastBound inventory** → `searchInventoryItems()`
   - Filter: manufacturer="DOUBLE TACTICAL", model="DubDub22 Suppressor"
   - Only items with `dispositionId: null` (in inventory)
2. **Admin selects serial numbers** (from dropdown)
3. **Create FastBound pending disposition:**
   - `createOrUpdateContact()` → Create/get FFL contact in FastBound
   - `createPendingDisposition()` → 
     - `disposeType: "NFA Disposition"` (not "Sold")
     - `disposeDate: today`
   - Attach contact to disposition
   - Add items (serials) to disposition
4. **Save disposition ID** → `submissions.fastbound_disposition_id`

**Data Storage:**
- FastBound: Pending NFA Disposition created
- `submissions.fastbound_disposition_id` = FastBound disposition ID

---

## Step 6: Form 3 Approved (Admin Action - Full Workflow)
**Trigger:** Admin clicks "Form 3 Approved" button
**API Call:** `POST /api/admin/submissions/:id/form3-approved`

**Backend (`server/routes.ts:4000`):**
1. **Create ShipStation label:**
   - `createLabel()` → USPS Priority Mail, 10oz, medium flat rate box
   - Ship from: Tom Flores, 105 Bear Trce, Floresville, TX 78114
   - Ship to: Dealer address from submission
   - Returns: `trackingNumber`, `labelPdfUrl`
2. **Commit FastBound disposition:**
   - `commitDisposition()` → 
     - Add tracking number to disposition
     - Set `shippedDate`
     - Commit (Form 3 approved)
3. **Save tracking to database:**
   - `submissions.tracking_number = trackingNumber`
   - `submissions.shipped_at = NOW()`
4. **Upload Form 3 PDF to FastBound** (if provided)
5. **Email dealer:**
   - Subject: "Your DubDub22 Order Has Shipped"
   - Body: Tracking number, carrier (USPS Priority Mail)
   - BCC Tom

**Data Storage:**
- FastBound: Disposition committed (Form 3 approved)
- `submissions.tracking_number` = tracking number
- `submissions.shipped_at` = timestamp
- **FastBound contact:** Form 3 PDF uploaded as attachment

---

## Step 7: Dealer Receives Order (Frontend)
**Email Received:** "Your DubDub22 Order Has Shipped"
- Tracking number: `XYZ123456789`
- Carrier: USPS Priority Mail
- Dealer can track package

**Order Complete!** 🎉

---

## Summary: Data Flow & Storage

| Data | Collected From | Stored In | Required | Auto-Populated |
|------|-----------------|------------|----------|-------------------|
| FFL Number | Dealer (input) | `dealers.ffl_license_number` | ✅ Yes | ❌ |
| FFL File | Dealer (upload) | `dealers.ffl_file_data` + FastBound contact | ✅ Yes* | ❌ |
| Dealer Name | Dealer (input) | `dealers.business_name` | ✅ Yes | ✅ If in DB |
| Contact Name | Dealer (input) | `dealers.contact_name` | ✅ Yes | ✅ If in DB |
| Email | Dealer (input) | `dealers.email` | ✅ Yes | ✅ If in DB |
| Phone | Dealer (input) | `dealers.phone` | ✅ Yes | ✅ If in DB |
| Address | Dealer (input) | `dealers.business_address` | ✅ Yes | ✅ If in DB |
| City | Dealer (input) | `dealers.city` | ✅ Yes | ✅ If in DB |
| State | Dealer (input) | `dealers.state` | ✅ Yes | ✅ If in DB |
| ZIP | Dealer (input) | `dealers.zip` | ✅ Yes | ✅ If in DB |
| EIN | Dealer (input) | `dealers.ein` | ✅ Yes* | ❌ |
| SOT File | Dealer (upload) | `dealers.sot_file_data` + FastBound contact | ✅ Yes* | ❌ |
| Tax Form | Dealer (upload) | `dealers.tax_form_data` + FastBound contact | ❌ Optional | ❌ |
| Message | Dealer (input) | `dealers.notes` | ❌ Optional | ❌ |
| Order Type | Dealer (select) | `submissions.type` | ✅ Yes | ❌ Default: "inquiry" |
| Quantity | Dealer (input) | `submissions.quantity` | ✅ If stocking | ❌ |
| Serial Numbers | Admin (select) | FastBound disposition items | ✅ Yes | ❌ From FastBound inventory |
| Tracking Number | ShipStation (auto) | `submissions.tracking_number` | ✅ Auto-generated | ✅ ShipStation API |

*Pending dealers only

---

## File Upload Summary

| Document | Collected | Goes To | API Endpoint |
|-----------|------------|---------|--------------|
| FFL File | Dealer (pending) | `dealers.ffl_file_data` + FastBound contact | `POST /api/ffl/upload` |
| SOT File | Dealer (pending/verified) | `dealers.sot_file_data` + FastBound contact | `POST /api/ffl/upload` or `POST /api/dealer-request` |
| Tax Form | Dealer (verified) | `submissions.tax_form_data` + FastBound contact | `POST /api/dealer-request` |
| Form 3 PDF | Admin (after approval) | FastBound contact | `POST /api/admin/submissions/:id/form3-approved` |
| Invoice PDF | Admin (after shipping) | FastBound contact | Auto-generated |

**All documents stored in FastBound contacts** (migrated from SFTP) → `uploadDealerDocumentsToFastBound()`

---

## Key Takeaways

1. **Pending dealers** (FFL not in DB): Must upload FFL + SOT + all contact info
2. **Verified dealers** (FFL in DB): Most fields auto-populated, can choose order type
3. **FastBound** stores all dealer documents as contact attachments
4. **ShipStation** auto-generates USPS labels after Form 3 approval
5. **Admin dashboard** handles FB pending disposition + Form 3 approval workflow
6. **All document uploads** go to FastBound contacts (no more SFTP)

---

**Status:** ✅ Complete flow mapped out — from "Dealers" button to order completion!
