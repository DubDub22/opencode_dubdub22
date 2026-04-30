# Warranty System Documentation

## Overview

The warranty system allows customers to submit warranty requests with photos, track their status, and request replacements. All warranty requests are managed through the Telegram bot by Eric (licensor).

## Customer Features

### Submitting a Warranty Request

1. **Access Portal**: Customer scans QR code on their suppressor to access the customer portal
2. **Navigate to Warranty**: Click "Submit Warranty Request" button
3. **Fill Out Form**:
   - Select request type:
     - Replacement Needed
     - Repair Request
     - Defect Report
     - Other
   - Provide description of the issue
   - Upload photo (optional but recommended)
4. **Submit**: Request is created with status "pending"

### Viewing Warranty Requests

- Customers can see all their warranty requests on the main portal page
- Click "View" to see detailed information including:
  - Request type and status
  - Description
  - Photo (if uploaded)
  - Admin notes (if reviewed)
  - Replacement serial number (if assigned)

## Admin Features (Telegram Bot)

### Viewing Warranty Requests

**List all warranty requests:**
```
/warranty_list
```

**Filter by status:**
```
/warranty_list pending
/warranty_list approved
/warranty_list denied
```

**View details of a specific request:**
```
/warranty_detail <request_id>
```
- Shows all request information
- Sends photo if available

### Updating Warranty Requests

**Update status:**
```
/warranty_update <request_id> <status> [notes]
```

**Status options:**
- `pending` - Initial status
- `in_review` - Being reviewed
- `approved` - Approved for replacement/repair
- `denied` - Request denied
- `fulfilled` - Replacement sent/repair completed

**Approve and assign replacement serial:**
```
/warranty_update <request_id> approved replacement_serial <serial_number> [notes]
```

Example:
```
/warranty_update 5 approved replacement_serial DUB22-00123 Customer reported cracked end cap, replacement approved
```

### Viewing Statistics

**System statistics include warranty info:**
```
/stats
```

Shows:
- Total warranty requests
- Pending requests
- Approved requests

## Workflow Example

1. **Customer submits request:**
   - Customer notices issue with suppressor
   - Takes photo
   - Submits warranty request via portal
   - Status: `pending`

2. **Eric reviews:**
   - Eric receives notification (can be added)
   - Views request: `/warranty_detail 5`
   - Reviews photo and description

3. **Eric approves:**
   - Approves request: `/warranty_update 5 approved replacement_serial DUB22-00123`
   - System assigns replacement serial
   - Customer can see replacement serial in portal

4. **Customer receives replacement:**
   - Eric marks as fulfilled: `/warranty_update 5 fulfilled Replacement shipped`
   - Customer sees updated status in portal

## Database Schema

### WarrantyRequest Model

- `id` - Unique identifier
- `serial_number_id` - Links to SerialNumber
- `customer_id` - Links to Customer
- `request_type` - Type of request (replacement, repair, defect, other)
- `description` - Customer's description
- `photo_path` - Path to uploaded photo
- `status` - Current status
- `admin_notes` - Notes from admin review
- `replacement_serial_id` - Assigned replacement serial (if applicable)
- `created_at` - When request was created
- `updated_at` - Last update time
- `reviewed_at` - When reviewed
- `reviewed_by` - User who reviewed

## File Storage

- Warranty photos are stored in the `uploads/` directory
- Files are named: `warranty_YYYYMMDD_HHMMSS_originalfilename.jpg`
- Photos are accessible via the portal for customers and admins

## Security

- Only customers with valid serial numbers can submit warranty requests
- Only Eric (licensor) can view and update warranty requests via Telegram
- Photo uploads are validated for file type and size
- All warranty data is linked to specific serial numbers

## Future Enhancements

Potential additions:
- Email/Telegram notifications when warranty requests are submitted
- Automatic replacement serial generation
- Warranty request templates
- Warranty statistics dashboard
- Integration with shipping system for replacement tracking



