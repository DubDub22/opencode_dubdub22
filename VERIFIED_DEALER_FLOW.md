# Verified Dealer Flow (FFL in Database)

## Step 1: FFL Verified in Database
**Page:** `client/src/pages/dealers.tsx:8-222`
**Action:** Enter FFL # → "Verify" → `POST /api/ffl/validate`
**Result:** FFL found → Redirect to `/apply?ffl={ffl}`

---

## Step 2: Dealer Form (Auto-Populated)
**Page:** `client/src/pages/apply.tsx` → `DealerForm` component (line 495)
**URL:** `/apply?ffl={ffl}`

### Data Auto-Populated from `dealers` Table:
| Field | Source | Required | Auto-Populated |
|-------|--------|----------|-------------------|
| FFL Number | URL param → `dealers.ffl_license_number` | ✅ Yes | ✅ From DB |
| Dealer Name | `dealers.business_name` | ✅ Yes | ✅ From DB |
| Contact Name | `dealers.contact_name` | ✅ Yes | ✅ From DB |
| Email | `dealers.email` | ✅ Yes | ✅ From DB |
| Phone | `dealers.phone` | ✅ Yes | ✅ From DB |
| Address | `dealers.business_address` | ✅ Yes | ✅ From DB |
| City | `dealers.city` | ✅ Yes | ✅ From DB |
| State | `dealers.state` | ✅ Yes | ✅ From DB |
| ZIP | `dealers.zip` | ✅ Yes | ✅ From DB |
| EIN | `dealers.ein` | ❌ Optional | ❌ Not auto-populated |
| EIN Type | `dealers.ein_type` | ❌ Optional | ❌ Not auto-populated |

### Data Collected from Form:
| Field | Type | Required | Where it Goes | Auto-Populated |
|-------|------|----------|-----------------|------------|
| Order Type | "inquiry" / "demo" / "stocking" | ✅ Yes | `submissions.type` | ❌ Default: "inquiry" |
| Quantity (if stocking) | number | ✅ Yes (if stocking) | `submissions.quantity` | ❌ |
| SOT File | PDF/PNG/JPG | ❌ Optional | `submissions.sot_file_data` → FastBound | ❌ |
| Tax Form | PDF/PNG/JPG | ❌ Optional | `submissions.tax_form_data` → FastBound | ❌ |
| Message | string | ❌ Optional | `submissions.description` | ❌ |

---

## Step 3: Submit Order/Inquiry
**API Call:** `POST /api/dealer-request` (line 667)

### Backend (`server/routes.ts:2010`):
1. **Validate required fields:**
   - `contactName`, `dealerName`, `email` (always required)
   - `quantityCans` (required if NOT "inquiry")

2. **Validate FFL format:** `X-XX-XXX-XX-XXXXX` (15 digits with dashes)

3. **Validate uploaded files:** FFL, SOT, tax forms (PDF/PNG/JPG, max 10MB)

4. **Check if FFL exists in `dealers` table:**
   - Get `dealerId`, `ffl_on_file`, `sot_on_file`, `tax_form_on_file`

5. **Check if demo unit already shipped:**
   - If `dealers.demo_fulfilled_at` exists → Hide "demo" option

6. **Create submission in `submissions` table:**
```sql
INSERT INTO submissions (
  type,              -- 'inquiry' / 'demo' / 'stocking'
  contact_name,       -- from form
  business_name,      -- from form (dealerName)
  email,             -- from form
  phone,             -- from form
  ffl_license_number, -- from URL param
  description,        -- message from form (optional)
  customer_address,   -- from dealers table (auto-populated)
  customer_city,       -- from dealers table
  customer_state,      -- from dealers table
  customer_zip,       -- from dealers table
  quantity,          -- from form (if stocking)
  sot_file_name,     -- from form (optional)
  sot_file_data,     -- from form (optional) → FastBound
  tax_form_name,     -- from form (optional)
  tax_form_data      -- from form (optional) → FastBound
) VALUES (...)
RETURNING id;
```

7. **Link to dealer via `dealer_submissions` table:**
```sql
INSERT INTO dealer_submissions (dealer_id, submission_id, order_type, quantity)
VALUES ($dealerId, $submissionId, $orderType, $quantity);
```

8. **Upload documents to FastBound (if provided):**
   - SOT file → `uploadDealerDocumentsToFastBound()` → FastBound contact attachment
   - Tax form → `uploadDealerDocumentsToFastBound()` → FastBound contact attachment
   - **Note:** FFL file NOT uploaded for verified dealers (already in DB)

9. **Send email to dealer:**
   - **To:** Dealer's email
   - **BCC:** Tom (`BCC_EMAIL`)
   - **Subject:** "Your DubDub22 Dealer Application"
   - **Body:** Order details, confirmations, next steps
   - **Attachment:** Multi-state tax form PDF (if not already on file)

10. **For demo/stocking orders:**
    - Redirect to `/order-confirmation?type=demo|stocking&qty=N&...`
    - Show terms & conditions
    - **Tax form generation:** Fill business name, EIN, address → Generate PDF via `pdf-lib`

---

## Step 4: Admin Reviews Submission (Admin Dashboard)
**Page:** `client/src/pages/admin.tsx`
**Tab:** "Dealer Orders" or "Dealer Inquiries"

### Data Shown:
- Submission type (inquiry/demo/stocking)
- Contact info (name, email, phone)
- FFL number, dealer name
- Order details (quantity, message)
- File status: FFL ✅/❌, SOT ✅/❌, Tax Form ✅/❌
- FastBound status: `fastbound_disposition_id` (null if not created)

### Admin Actions:
1. **Archive submission** → `DELETE /api/admin/submissions/:id`
2. **Mark paid** → `PATCH /api/admin/submissions/:id/paid`
3. **Create FastBound Pending Disposition** → `POST /api/admin/submissions/:id/fastbound-pending`
4. **Form 3 Approved (full workflow)** → `POST /api/admin/submissions/:id/form3-approved`

---

## Step 5: FastBound Pending Disposition (Admin Action)
**Trigger:** Admin clicks "FB Pending" button
**API Call:** `POST /api/admin/submissions/:id/fastbound-pending`

### Backend (`server/routes.ts:XXXX`):
1. **Get FastBound inventory** → `searchInventoryItems()`
   - Filter: `manufacturer="DOUBLE TACTICAL"`, `model="DubDub22 Suppressor"`
   - Only items with `dispositionId: null` (in inventory)

2. **Admin selects serial numbers** (from dropdown loaded from FastBound)

3. **Create FastBound pending disposition:**
```javascript
// Create or get FFL contact in FastBound
const contactId = await createOrUpdateContact({ fflNumber });

// Create pending NFA disposition (NOT "Sold")
const disp = await fbFetch("/dispositions", {
  method: "POST",
  body: JSON.stringify({
    disposeDate: today,
    disposeType: "NFA Disposition", // NOT "Sold"!
  }),
});

// Attach contact to disposition
await fbFetch(`/dispositions/${disp.id}/contact`, {
  method: "POST",
  body: JSON.stringify({ contactId }),
});

// Add items (serials) to disposition
for (const serial of selectedSerials) {
  await fbFetch(`/dispositions/${disp.id}/items`, {
    method: "POST",
    body: JSON.stringify({ serialNumber: serial }),
  });
}
```

4. **Save disposition ID to database:**
```sql
UPDATE submissions SET fastbound_disposition_id = $1 WHERE id = $2;
```

**Data Storage:**
- **FastBound:** Pending NFA Disposition created with serials
- **Database:** `submissions.fastbound_disposition_id` = FastBound disposition ID

---

## Step 6: Form 3 Approved (Admin Action - Full Workflow)
**Trigger:** Admin clicks "Form 3 Approved" button
**API Call:** `POST /api/admin/submissions/:id/form3-approved`

### Backend (`server/routes.ts:4000`):
1. **Create ShipStation label:**
```javascript
// Create USPS Priority Mail label
const label = await createLabel({
  shipTo: {
    name: contactName,
    companyName: dealerName,
    phone: phone,
    addressLine1: address,
    city: city,
    state: state,
    postalCode: zip,
  },
  pkg: {
    weightOz: 10, // ~10oz suppressor
    packageCode: "medium_flat_rate_box",
  },
});
// Returns: { trackingNumber, labelPdfUrl, ... }
```

2. **Commit FastBound disposition:**
```javascript
// Add tracking to disposition
await fbFetch(`/dispositions/${dispositionId}`, {
  method: "PATCH",
  body: JSON.stringify({
    trackingNumber: label.trackingNumber,
    shippedDate: today,
  }),
});

// Commit disposition (Form 3 approved)
await fbFetch(`/dispositions/${dispositionId}/commit`, {
  method: "POST",
});
```

3. **Save tracking to database:**
```sql
UPDATE submissions
SET tracking_number = $1, shipped_at = NOW()
WHERE id = $2;
```

4. **Upload Form 3 PDF to FastBound** (if provided):
```javascript
if (form3Data) {
  await uploadDealerDocumentsToFastBound(fflNumber, {
    taxFormFileData: form3Data,
    taxFormFileName: `Form3_${date}.pdf`,
  });
}
```

5. **Email dealer:**
```javascript
await sendViaGmail({
  to: email,
  bcc: "tom@doubletactical.com",
  subject: "Your DubDub22 Order Has Shipped",
  text: `
    Dear ${contactName},
    
    Your DubDub22 suppressor order has shipped!
    
    Tracking: ${trackingNumber}
    Carrier: USPS Priority Mail
    
    Please retain this email for your records.
    
    - Double T Tactical / DubDub22
  `,
});
```

---

## Step 7: Dealer Receives Order
**Email Received:** "Your DubDub22 Order Has Shipped"
- **Tracking Number:** `XYZ123456789`
- **Carrier:** USPS Priority Mail
- **Shipped From:** Tom Flores, 105 Bear Trce, Floresville, TX 78114

**Order Complete!** 🎉

---

## Summary: Verified Dealer Data Flow

| Data | Collected From | Stored In | Required | Auto-Populated |
|------|-----------------|------------|----------|-------------------|
| FFL Number | FFL validation | `dealers.ffl_license_number` | ✅ Yes | ✅ From DB |
| Dealer Name | Form input | `dealers.business_name` | ✅ Yes | ✅ From DB |
| Contact Name | Form input | `dealers.contact_name` | ✅ Yes | ✅ From DB |
| Email | Form input | `dealers.email` | ✅ Yes | ✅ From DB |
| Phone | Form input | `dealers.phone` | ✅ Yes | ✅ From DB |
| Address | Form input | `dealers.business_address` | ✅ Yes | ✅ From DB |
| City | Form input | `dealers.city` | ✅ Yes | ✅ From DB |
| State | Form input | `dealers.state` | ✅ Yes | ✅ From DB |
| ZIP | Form input | `dealers.zip` | ✅ Yes | ✅ From DB |
| EIN | Form input | `dealers.ein` | ❌ Optional | ❌ |
| EIN Type | Form input | `dealers.ein_type` | ❌ Optional | ❌ |
| Order Type | Form select | `submissions.type` | ✅ Yes | ❌ Default: "inquiry" |
| Quantity | Form input | `submissions.quantity` | ✅ If stocking | ❌ |
| SOT File | Form upload | `submissions.sot_file_data` → **FastBound** | ❌ Optional | ❌ |
| Tax Form | Form upload | `submissions.tax_form_data` → **FastBound** | ❌ Optional | ❌ |
| Serial Numbers | Admin select | **FastBound disposition items** | ✅ For NFA transfer | ❌ From inventory |
| Tracking # | Auto-generated | `submissions.tracking_number` | ✅ After Form 3 | ✅ ShipStation API |

---

## Key Differences: Pending vs Verified Dealers

| Feature | Pending (FFL NOT in DB) | Verified (FFL in DB) |
|---------|--------------------------|------------------------|
| FFL File | ✅ Required, uploaded | ❌ Not required (already in DB) |
| SOT File | ✅ Required* | ❌ Optional |
| Creates FastBound Contact? | ❌ NO (manual later) | ✅ YES (when admin creates FB pending) |
| Data Pre-filled? | ❌ No (empty form) | ✅ YES (from `dealers` table) |
| Appears in Tab | "Dealer Inquiries" | "Dealer Orders" |
| Email Goes To | `inquiries@dubdub22.com` | Dealer's email + BCC Tom |
| Order Type Options | N/A (inquiry only) | inquiry/demo/stocking |

*SOT required UNLESS "My FFL has SOT on same page" checked*

---

**Status:** ✅ Complete verified dealer flow documented — from FFL validation to order completion!
