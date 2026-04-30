# Deployment Guide

## Prerequisites

- Python 3.8 or higher
- PostgreSQL (recommended) or SQLite (for development)
- Telegram Bot Token from @BotFather
- FastBound API credentials (optional)
- YouTube API key (optional, for playlist management)

## Setup Steps

### 1. Clone and Install

```bash
git clone https://github.com/Snail3D/DubDub-Hub.git
cd DubDub-Hub
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

Required configuration:
- `TELEGRAM_BOT_TOKEN`: Get from @BotFather on Telegram
- `TELEGRAM_GROUP_CHAT_ID`: Create a group, add @userinfobot to get chat ID
- `ERIC_TELEGRAM_ID`: Your Telegram user ID (use @userinfobot)
- `TOM_TELEGRAM_ID`: Tom's Telegram user ID
- `DATABASE_URL`: PostgreSQL connection string or SQLite path
- `PORTAL_SECRET_KEY`: Generate with `python -c "import secrets; print(secrets.token_hex(32))"`

### 3. Initialize Database

```bash
python -m bot.utils.database
python scripts/init_users.py
```

### 4. Run the Bot

```bash
python -m bot.main
```

### 5. Run the Portal (Separate Terminal)

```bash
python -m portal.app
```

The portal will be available at `http://localhost:5000`

## Production Deployment

### Using systemd (Linux)

Create `/etc/systemd/system/dubdub22-bot.service`:

```ini
[Unit]
Description=DubDub22 Telegram Bot
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/DubDub-Hub
Environment="PATH=/path/to/DubDub-Hub/venv/bin"
ExecStart=/path/to/DubDub-Hub/venv/bin/python -m bot.main
Restart=always

[Install]
WantedBy=multi-user.target
```

Create `/etc/systemd/system/dubdub22-portal.service`:

```ini
[Unit]
Description=DubDub22 Customer Portal
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/DubDub-Hub
Environment="PATH=/path/to/DubDub-Hub/venv/bin"
ExecStart=/path/to/DubDub-Hub/venv/bin/python -m portal.app
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable dubdub22-bot
sudo systemctl enable dubdub22-portal
sudo systemctl start dubdub22-bot
sudo systemctl start dubdub22-portal
```

### Using Docker

Create `Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "-m", "bot.main"]
```

### Using Nginx (for portal)

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Security Considerations

1. **Environment Variables**: Never commit `.env` file
2. **Secret Key**: Use strong secret key for portal
3. **File Uploads**: Limit file sizes and validate file types
4. **Database**: Use PostgreSQL in production with proper credentials
5. **HTTPS**: Use SSL/TLS for portal in production
6. **Backups**: Regular database backups

## Monitoring

- Check bot logs: `journalctl -u dubdub22-bot -f`
- Check portal logs: `journalctl -u dubdub22-portal -f`
- Monitor database size and performance

## Troubleshooting

- **Bot not responding**: Check TELEGRAM_BOT_TOKEN
- **Database errors**: Verify DATABASE_URL and permissions
- **Portal not loading**: Check PORTAL_SECRET_KEY and port availability
- **File uploads failing**: Check UPLOADS_DIR permissions



