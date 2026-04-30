# Dealer Order Flow Documentation

## Updated Flow

### Step 1: FFL Upload (First Step)
1. Dealer visits `/dealer/register`
2. **Only uploads FFL document** (PDF, DOCX, DOC, PNG, JPG, JPEG, GIF)
3. System processes with OCR:
   - Extracts FFL number
   - Extracts business info
   - Identifies FFL type
4. System verifies FFL number
5. If verified → Status: "active"
6. If not verified → Status: "pending" (manual review)
7. Eric notified via Telegram

### Step 2: Order Creation (After Verification)
1. Dealer can only order if FFL is verified and status is "active"
2. Dealer fills out order form:
   - Business name, contact info (if not already set)
   - Quantity of cans
   - Quantity of consumable parts (if FFL 01 or 07)
3. **FFL document is copied and stored with the order**
4. Order created with FFL document path
5. Invoice generated automatically
6. Eric notified via Telegram
7. Dealer redirected to invoice page

### Step 3: Payment
1. Dealer views invoice page
2. Downloads invoice PDF
3. Pays on website
4. Eric notified when payment received

## FFL Document Storage

### Per Dealer
- Original FFL stored in `Dealer.ffl_document_path`
- Updated when new FFL uploaded

### Per Order
- **Copy of FFL stored with each order** in `DealerOrder.ffl_document_path`
- Filename format: `order_YYYYMMDD_HHMMSS_original_filename.ext`
- Ensures FFL is retained with order record
- Can be downloaded via `/dealer/order/<order_id>/ffl`

## File Format Support

### Supported FFL Upload Formats
- PDF (`.pdf`)
- Word Documents (`.docx`, `.doc`)
- Images (`.png`, `.jpg`, `.jpeg`, `.gif`)

### OCR Processing
- Extracts text from all formats
- Identifies FFL number
- Extracts business information
- Determines FFL type

## Verification Process

### Automatic Verification
1. OCR extracts FFL number
2. System attempts to verify FFL number
3. If verification succeeds → Dealer status: "active"
4. If verification fails → Dealer status: "pending"

### Manual Verification (if needed)
- Eric reviews pending dealers via Telegram notification
- Can approve via admin command (to be implemented)
- Dealer status updated to "active"

## Order Requirements

### Before Ordering
- ✅ FFL document uploaded
- ✅ FFL number extracted
- ✅ FFL verified (status = "active")
- ✅ FFL type identified

### During Order
- FFL document copied to order
- Order linked to dealer
- FFL retained permanently with order

## Database Structure

### Dealer
- `ffl_document_path` - Current FFL document
- `ffl_verified` - Verification status
- `ffl_type` - FFL type (01, 07, etc.)
- `status` - "pending" or "active"

### DealerOrder
- `ffl_document_path` - **Copy of FFL stored with this order**
- Links to dealer
- All order details

## Benefits

✅ FFL-first approach - verification before ordering
✅ FFL retained with every order - compliance
✅ Multiple file format support
✅ Automatic OCR extraction
✅ Telegram notifications for Eric
✅ No email required

## Routes

- `GET/POST /dealer/register` - Upload FFL (first step)
- `GET /dealer/dashboard/<dealer_id>` - Dashboard (after verification)
- `GET/POST /dealer/order/<dealer_id>` - Create order (requires verified FFL)
- `GET /dealer/invoice/<invoice_id>` - View invoice
- `GET /dealer/invoice/<invoice_id>/download` - Download invoice PDF
- `GET /dealer/order/<order_id>/ffl` - Download FFL document for order
- `GET /dealer/pending/<dealer_id>` - Pending approval page



