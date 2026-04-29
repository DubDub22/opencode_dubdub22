# Admin Dashboard Flow — Demo & Dealer Orders

> **Dealer Orders** tab in admin panel
> Covers: `dealer_order` and `demo_order` submissions

---

## Quick Reference

| Step | Button Label | What Admin Does | What System Does Automatically |
|------|--------------|-----------------|-------------------------------|
| 1 | **FB Pending** | Select serial numbers from dropdown (auto-loaded from FastBound) | Creates FastBound contact (if new), creates **pending** NFA disposition, adds items |
| 2 | **Form 3 ✓ (Full)** | Click button after Form 3 approved by ATF | **INTEGRATED:** Creates ShipStation label + Commits FastBound + Generates invoice with serials/tracking + Uploads invoice to FastBound + Emails dealer with invoice + Form 3 PDF |
| 3 | **Mark Paid** (optional) | Click button | Sets `paid_at` timestamp in DB |

---

## Detailed Step-by-Step Flow

### Prerequisites (already done by system):
- ✅ Dealer submitted order via `/dealers` page
- ✅ Payment method selected (Demo = free, Stocking = $725 qty 1)
- ✅ FFL + SOT uploaded (if Stocking), or Demo auto-approved
- ✅ FastBound contact created (if FFL was in DB), or marked "FFL not on file"

---

### Step 1: "FB Pending" — Assign Serials + Create Pending Disposition

**Admin Action:**
1. Click **"FB Pending"** button
2. Dialog opens: "FastBound: Assign Serials"
3. Available serials **auto-load** from FastBound inventory (manufacturer: "DOUBLE TACTICAL")
4. Select serial(s) matching order quantity (hold Ctrl/Cmd for multiple)
5. Click **"Create Pending Disposition"**

**System Automatically:**
- Fetches available serials from FastBound inventory API (`/api/admin/fastbound/inventory`)
- Creates FastBound contact (if not exists) using FFL number
- Creates **pending** NFA disposition in FastBound
- Adds selected items (serials) to the disposition
- Saves FastBound `dispositionId` to `submissions.fastbound_disposition_id`
- Updates `submissions.serial_number` with comma-separated serials

**Result:**
- Button changes to **"Form 3 ✓ (Full)"**
- `submissions.fastbound_disposition_id` is set
- FastBound shows pending disposition

---

### Step 2: "Form 3 ✓ (Full)" — **INTEGRATED WORKFLOW** (One Click!)

**Admin Action:**
1. Click **"Form 3 ✓ (Full)"** button (only visible after FB Pending done)
2. Confirm dialog: "This will automatically: (1) Create USPS shipping label, (2) Commit FastBound disposition with tracking, (3) Generate invoice with serial numbers + tracking, (4) Upload invoice to FastBound, (5) Email dealer with invoice + Form 3 PDF attached."
3. Click **"Run Full Workflow"**

**System Automatically (ALL IN ONE STEP):**

1. **Creates ShipStation label**
   - USPS Priority Mail
   - 10 oz weight
   - Medium flat rate box
   - Uses dealer's shipping address
   - Returns tracking number + label PDF URL

2. **Commits FastBound disposition**
   - Pushes tracking number to FastBound
   - Changes disposition status from "pending" to "committed"
   - FastBound Form 3 PDF is generated

3. **Generates invoice PDF with serial numbers + tracking**
   - Invoice # (INV-XXXX format)
   - Dealer info + address
   - Serial number(s) included
   - Tracking number + carrier
   - Item: DubDub22 Suppressor
   - Qty + price ($0 for demo, $725 for stocking)
   - Total amount

4. **Uploads invoice to FastBound**
   - Attaches to dealer's contact record
   - Visible in FastBound documents

5. **Emails dealer (SINGLE EMAIL WITH ATTACHMENTS)**
   - To: dealer's email
   - BCC: info@dubdub22.com
   - Subject: "INVOICE & Shipping Confirmation - DubDub22 Suppressor"
   - Body: Invoice #, tracking, serial numbers, thank you message
   - **Attachment 1**: Invoice PDF (with serials + tracking)
   - **Attachment 2**: Form 3 PDF (from FastBound)
   - From: orders@dubdub22.com

**Result:**
- Button changes to **"✓ Shipped + Invoiced"** (green text)
- Tracking number visible in "Shipping" column
- Invoice # displayed in success message
- **ONE email sent** with all attachments
- Invoice uploaded to FastBound automatically

---

### Step 3: "Mark Paid" (Optional)

**Admin Action:**
- Click **"Mark Paid"** button
- Enter optional notes
- Click confirm

**System Automatically:**
- Sets `submissions.paid_at` to current timestamp
- Stores notes in `submissions.paid_notes`

---

## Demo vs Stocking Orders

| Feature | Demo Order (`demo_order`) | Stocking Dealer (`dealer_order`) |
|---------|--------------------------|----------------------------------|
| **Price** | $0 (free) | $725 × qty |
| **Qty** | Always 1 | 1–3 (configurable) |
| **Invoice** | Auto-generated in Form 3 workflow | Auto-generated in Form 3 workflow |
| **SOT Required** | No | Yes |
| **FFL Required** | No (but helpful) | Yes |
| **Form 3** | Yes (still NFA item) | Yes |
| **Serial Selection** | Manual (from inventory) | Manual (from inventory) |
| **Email** | Single email with invoice + Form 3 | Single email with invoice + Form 3 |

---

## What's Automated vs Manual

### ✅ FULLY AUTOMATED (Admin clicks ONE button, system does EVERYTHING):
1. **FastBound contact creation** (if not exists)
2. **FastBound pending disposition** (FB Pending button)
3. **ShipStation label creation** (Form 3 ✓ button)
4. **FastBound disposition commitment** (Form 3 ✓ button)
5. **Invoice PDF generation** with serial numbers + tracking (Form 3 ✓ button)
6. **Invoice upload to FastBound** (Form 3 ✓ button)
7. **Single email to dealer** with invoice + Form 3 PDF attached (Form 3 ✓ button)
8. **DB updates** (tracking #, shipped date, serial numbers)

### ⚙️ MANUAL (Admin must do):
1. **Select serial numbers** from dropdown (FB Pending dialog) - auto-loaded
2. **Click "FB Pending"** button
3. **Click "Form 3 ✓ (Full)"** button (after ATF approval) - **DOES EVERYTHING**

### ❌ REMOVED (Now Integrated):
- ~~"Mark Shipped" button~~ → Integrated into Form 3 ✓
- ~~"Send Invoice" button~~ → Integrated into Form 3 ✓
- ~~Separate emails~~ → Single email with all attachments

---

## API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/fastbound/inventory` | GET | Fetch available serials from FastBound (auto-loaded) |
| `/api/admin/submissions/:id/fastbound-pending` | POST | Create pending disposition + assign serials |
| `/api/admin/submissions/:id/form3-approved` | POST | **INTEGRATED WORKFLOW:** Label + Commit + Invoice + Email |

---

## Edge Cases & Improvements Needed

### 🚨 Critical (Fix Soon):
1. **Serial validation**: Check if selected serial is already disposed in FastBound
2. **Form 3 PDF**: Auto-download Form 3 PDF from FastBound after commitment for email attachment
3. **Shipping address validation**: Ensure dealer has valid address before label creation
4. **Error rollback**: If invoice generation fails, still commit FastBound (partial success)

### 🔧 Nice to Have:
1. **Bulk actions**: Select multiple submissions → bulk "Form 3 ✓ (Full)"
2. **Status dashboard**: Visual progress bar for each order (FB Pending → Form 3 → Shipped + Invoiced)
3. **Email templates**: Nicer HTML emails with DubDub22 branding
4. **PDF preview**: Show invoice PDF before sending
5. **Tracking link**: Auto-generate USPS tracking URL in email

---

## Flow Diagram

```
Dealer Order Submitted
         ↓
+-------------------+
|  FB Pending       |
|  (Assign Serials) |
|  Auto-load serials |
+--------+----------+
         |
         ↓
+-------------------+
|  Form 3 ✓ (Full)  |
|  ONE CLICK = ALL:  |
|  1. ShipStation    |
|  2. Commit FB      |
|  3. Generate Invoice (serials + tracking) |
|  4. Upload Invoice to FB |
|  5. Email dealer (invoice + Form 3 attached) |
+--------+----------+
         |
         ↓
+-------------------+
|  ✓ Shipped +      |
|    Invoiced       |
|  (Complete!)      |
+--------+----------+
         |
         ↓ (optional)
+-------------------+
|  Mark Paid        |
+-------------------+
```

---

## Summary

**Admin Dashboard Actions (SIMPLIFIED):**
- ✅ **FB Pending**: Select serials → Creates FastBound pending disposition
- ✅ **Form 3 ✓ (Full)**: **ONE CLICK DOES EVERYTHING** → Label + Commit + Invoice + Email

**What Admin Needs to Do Manually:**
1. Select serial numbers from auto-loaded dropdown
2. Click "FB Pending" button
3. Click "Form 3 ✓ (Full)" button → **DONE!**

**What System Does Automatically (Form 3 ✓):**
- ✅ ShipStation label creation
- ✅ FastBound disposition commitment
- ✅ Invoice PDF generation (with serials + tracking)
- ✅ Invoice upload to FastBound
- ✅ Single email with invoice + Form 3 PDF attached
- ✅ DB updates (tracking, dates, serials)

**Email Sent to Dealer (Single Email):**
- Subject: "INVOICE & Shipping Confirmation - DubDub22 Suppressor"
- Body: Invoice #, tracking, serial numbers
- Attachment 1: Invoice PDF (with serials + tracking)
- Attachment 2: Form 3 PDF (from FastBound)
