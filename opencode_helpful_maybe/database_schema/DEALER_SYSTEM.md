# Dealer System Documentation

## Overview

The dealer system allows FFL holders to register, upload their FFL documents, place orders, and receive automated invoices via email.

## Features

### FFL Registration & Verification
- **FFL Upload**: Dealers upload their FFL document
- **OCR Scanning**: Automatic extraction of FFL number, business info, type
- **FFL Verification**: Automatic verification (placeholder - needs implementation)
- **Type Detection**: Identifies FFL type (01, 07, etc.)

### Ordering System
- **Simple Pricing**:
  - $60 per can
  - Free shipping on 10+ cans
  - 20 packs of replacement baffles: $30
  - 5 pairs of extra sleeves: $100
- **FFL Type Restrictions**: Only Type 01 (Dealer) and 07 (Manufacturer) can order consumable parts
- **Automatic Invoice Generation**: PDF invoices created automatically
- **Email Delivery**: Invoices sent via email automatically

## Pricing Structure

### Suppressors (Cans)
- **Price**: $60 per can
- **Shipping**: Free on orders of 10+ cans, otherwise $15

### Consumable Parts (Only for FFL 01 & 07)
- **Replacement Baffles**: $30 per 20-pack
- **Extra Sleeves**: $100 per 5-pair pack

### Non-Consumable Parts
- All other parts are not available for order (as specified)

## Workflow

### 1. Dealer Registration
1. Dealer visits `/dealer/register`
2. Fills out business information
3. Uploads FFL document (PDF or image)
4. System processes with OCR:
   - Extracts FFL number
   - Extracts business name, address, contact info
   - Identifies FFL type
5. System verifies FFL (if automated verification available)
6. Dealer status set to "active" or "pending" (manual review)

### 2. Order Creation
1. Dealer logs into dashboard
2. Creates new order:
   - Selects quantity of cans
   - Selects consumable parts (if FFL 01 or 07)
3. System calculates totals:
   - Subtotal
   - Shipping (free if 10+ cans)
   - Total
4. Order created with status "pending"

### 3. Invoice Generation
1. System automatically generates invoice:
   - Unique invoice number (INV-YYYYMMDD-####)
   - PDF created with order details
   - 30-day payment terms
2. Invoice emailed to dealer
3. Order status updated to "invoiced"
4. Invoice status set to "sent"

## Database Models

### Dealer
- Business information
- FFL number and type
- Verification status
- OCR extracted data
- FFL document path

### DealerOrder
- Order items (cans, baffles, sleeves)
- Pricing
- Totals
- Status tracking

### Invoice
- Invoice number
- Linked to dealer and order
- PDF path
- Email status
- Payment tracking

## API Endpoints

### Dealer Portal
- `GET/POST /dealer/register` - Register new dealer
- `GET /dealer/dashboard/<dealer_id>` - Dealer dashboard
- `GET/POST /dealer/order/<dealer_id>` - Create order

## Configuration

### Email Settings (in .env)
```
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### OCR Requirements
- Tesseract OCR must be installed on server
- On Ubuntu: `sudo apt install tesseract-ocr`
- On macOS: `brew install tesseract`

## FFL Verification

### Current Status
- Placeholder implementation
- Needs actual ATF verification service

### Options for Implementation
1. **FFL123.com API** (paid service)
2. **Manual verification workflow** (admin reviews)
3. **ATF eZCheck scraping** (check ToS first)

### FFL Type Restrictions
- **Type 01 (Dealer)**: Can order cans + consumable parts
- **Type 07 (Manufacturer)**: Can order cans + consumable parts
- **Other Types**: Can only order cans (no consumable parts)

## Invoice Generation

### PDF Features
- Professional invoice layout
- Company branding
- Itemized list
- Totals breakdown
- Due date (30 days)
- PDF attachment in email

### Email Content
- Invoice number
- Order details
- Total amount
- Due date
- PDF attachment

## Future Enhancements

- Payment tracking
- Order status updates
- Inventory management
- Dealer portal login system
- Order history
- Invoice download portal
- Automated FFL re-verification



