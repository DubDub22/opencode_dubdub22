# Short Link System - Simple Explanation

## How It Works

### The Core Concept

**Serial Number + Salt = Secure Token**

1. **Serial Number** (e.g., `DUB22-00001`) is the identifier
2. **Random Salt** is added for security (unique per link)
3. **Hash** is created: `SHA256(serial_number + salt)`
4. **Token** stored as: `salt:hash`

### Example

```
Serial Number: "DUB22-00001"
Random Salt: "a1b2c3d4e5f6g7h8"
↓
Data: "DUB22-00001:a1b2c3d4e5f6g7h8"
↓
Hash: SHA256(data) = "9f8e7d6c5b4a3210..."
↓
Stored Token: "a1b2c3d4e5f6g7h8:9f8e7d6c5b4a3210..."
```

### The Flow

1. **Purchase Serial** → Serial "DUB22-00001" is created
2. **Generate Short Code** → Random 6-char code: `k7m9x2`
3. **Create Token** → Serial + Random Salt → Hash → Store as `salt:hash`
4. **Link Together** → Short code `k7m9x2` → Points to Serial `DUB22-00001` → Token verifies it

### When Customer Scans QR Code

1. QR code contains: `https://domain.com/s/k7m9x2`
2. System looks up: What serial does `k7m9x2` belong to?
3. Finds: `k7m9x2` → `DUB22-00001`
4. Verifies: Recompute hash using serial + stored salt
5. If valid: Show customer portal for `DUB22-00001`

## Key Points

✅ **Serial number is the identifier** - It's what tags/links everything together
✅ **Salt adds security** - Prevents guessing or tampering
✅ **Short code is random** - Just a lookup key, not based on serial
✅ **Token verifies authenticity** - Ensures link hasn't been tampered with

## Security Benefits

- Can't guess a link (random short code)
- Can't forge a link (salt + hash verification)
- Each link is unique (unique salt per serial)
- Serial number is the source of truth

## Database Structure

```
ShortLink
├── short_code: "k7m9x2" (random lookup key)
├── serial_number_id: 123 (links to SerialNumber)
└── encrypted_token: "salt:hash" (verification)
```

The serial number is what creates and tags everything - the salt just makes it secure!



