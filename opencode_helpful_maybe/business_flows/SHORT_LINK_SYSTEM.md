# Short Link System Documentation

## Overview

The short link system generates simple, secure URLs for QR codes. Instead of long URLs like `https://domain.com/portal/DUB22-00001`, customers scan QR codes that redirect to short links like `https://domain.com/s/abc123`.

## Benefits

1. **Simpler QR Codes**: Shorter URLs = less complex QR codes = easier to scan
2. **Security**: Salted encryption ensures links can't be guessed
3. **Tracking**: Access counts and last accessed timestamps
4. **No Email Required**: Uses serial number-based authentication

## How It Works

### Short Link Generation

1. When a serial number is purchased, a short link is automatically generated
2. A unique 6-character code is created (e.g., `abc123`)
3. A salted hash token is created using the serial number + random salt
4. The short link is stored in the database linked to the serial number

### Example Flow

```
Purchase Serial → Generate Serial "DUB22-00001"
  ↓
Create Short Link
  - Short Code: "k7m9x2"
  - Encrypted Token: "salt:hash"
  ↓
Generate QR Code
  - URL: "https://domain.com/s/k7m9x2"
  - Simple QR code (version 1, low error correction)
  ↓
Customer Scans QR Code
  ↓
Redirects to Portal
  - Verifies token
  - Shows customer portal for DUB22-00001
```

## Database Schema

### ShortLink Model

- `id` - Primary key
- `short_code` - Unique 6-character code (e.g., "k7m9x2")
- `serial_number_id` - Links to SerialNumber
- `encrypted_token` - Salted hash token (format: "salt:hash")
- `created_at` - Creation timestamp
- `access_count` - Number of times accessed
- `last_accessed` - Last access timestamp

## Security

### Salted Encryption

- Each short link has a unique random salt
- Token is created using: `SHA256(serial_number + salt)`
- Stored as: `salt:hash`
- Verification: Recompute hash and compare

### Short Code Generation

- 6 characters using: `abcdefghjkmnpqrstuvwxyz23456789`
- Excludes ambiguous characters: `0`, `O`, `1`, `I`, `l`, `o`
- Randomly generated with collision checking

## QR Code Optimization

QR codes are optimized for small size:

- **Version**: 1 (smallest)
- **Error Correction**: Low (L)
- **Box Size**: 8 pixels
- **Border**: 2 modules

This creates the simplest possible QR code for the short URL.

## API Usage

### Generate Short Link

```python
from bot.services.short_link_generator import ShortLinkGenerator

# Generate for a serial number ID
short_link = ShortLinkGenerator.generate_short_link(serial_number_id=123)

# Get the short URL
short_url = ShortLinkGenerator.get_short_url(short_link.short_code)
# Returns: "https://domain.com/s/k7m9x2"
```

### Resolve Short Link

```python
# Resolve a short code
serial, is_valid = ShortLinkGenerator.resolve_short_link("k7m9x2")

if is_valid:
    print(f"Serial: {serial.serial}")
else:
    print("Invalid link")
```

### Generate QR Code

```python
from bot.services.qr_generator import QRGenerator

# Generate QR code using short link (automatic)
qr_path = QRGenerator.generate_qr_code(serial_number_id=123, use_short_link=True)
```

## Portal Routes

### Short Link Redirect

- **URL**: `/s/<short_code>`
- **Method**: GET
- **Action**: Verifies token and redirects to customer portal
- **Example**: `https://domain.com/s/k7m9x2` → redirects to portal for that serial

## Configuration

No additional configuration needed. The system uses:
- `PORTAL_BASE_URL` from config for generating short URLs
- Database for storing short links
- Automatic generation when serials are purchased

## Migration Notes

Existing serial numbers without short links will get them automatically when:
- QR codes are regenerated
- Or manually via admin command (can be added)

## Future Enhancements

Potential additions:
- Custom short codes
- Link expiration dates
- Analytics dashboard
- Bulk short link generation



