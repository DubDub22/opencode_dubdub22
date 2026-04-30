# DubDub22 Telegram Bot System

A comprehensive Telegram bot system for managing the DubDub22 suppressor licensing and manufacturing workflow between Eric Woodard (licensor) and Tom Trevino (manufacturer at Double T Tactical).

## Features

- **Telegram Bot**: Group and individual chat management for Eric and Tom
- **Serial Number System**: Purchase, generation, and tracking of serial numbers
- **Laser Engraving Integration**: Generate engraving files for G-Weike 30W G-Laser with 9x washer jig
- **QR Code System**: Generate QR codes linking to customer portal
- **Customer Portal**: Web portal for customers to upload documents, view videos, and access resources
- **Warranty System**: Customers can submit warranty requests with photos, track status, and request replacements
- **FastBound Integration**: Sync with FastBound FFL software
- **YouTube Integration**: Embedded playlist for instructional videos
- **199trust Integration**: Affiliate links and squeeze page

## Setup

1. Clone the repository:
```bash
git clone https://github.com/Snail3D/DubDub-Hub.git
cd DubDub-Hub
```

2. Create a virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Copy environment variables:
```bash
cp .env.example .env
```

5. Edit `.env` with your configuration values

6. Initialize the database:
```bash
python -m bot.utils.database init
```

7. Run the Telegram bot:
```bash
python -m bot.main
```

8. Run the customer portal (in a separate terminal):
```bash
python -m portal.app
```

## Project Structure

```
DubDub-Hub/
├── bot/                    # Telegram bot code
│   ├── handlers/          # Bot command handlers
│   ├── services/          # Business logic services
│   └── utils/             # Utilities and helpers
├── portal/                # Customer web portal
│   ├── routes/           # Web routes
│   └── templates/        # HTML templates
└── database/              # Database models
```

## Configuration

See `.env.example` for all configuration options. Key settings include:
- Telegram bot token
- Database connection
- Payment provider credentials
- FastBound API keys
- YouTube playlist ID

## Workflows

### Serial Number Purchase Flow
1. Tom uses `/purchase` command in Telegram
2. Selects quantity and completes purchase
3. System generates serial numbers, QR codes, and engraving files
4. Files are automatically sent to Tom via Telegram
5. Serial numbers are synced to FastBound (if configured)

### Customer Portal Flow
1. Customer scans QR code on suppressor
2. Accesses customer portal with serial number
3. Can upload trust documents, tax stamps
4. Can view instructional videos
5. Can submit warranty requests with photos

### Warranty Request Flow
1. Customer submits warranty request via portal with photo
2. Request is stored with status "pending"
3. Eric reviews requests via `/warranty_list` in Telegram
4. Eric views details with `/warranty_detail <id>`
5. Eric updates status with `/warranty_update <id> <status> [notes]`
6. Customer can track status in portal
7. Replacement serial can be assigned if approved

## License

Proprietary - All rights reserved

