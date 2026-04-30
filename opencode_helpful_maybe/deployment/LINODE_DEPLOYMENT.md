# Linode Deployment Guide

## Prerequisites

- Linode instance running Ubuntu 22.04 LTS (or similar)
- Domain name pointed to your Linode IP (optional but recommended)
- SSH access to your Linode

## Initial Server Setup

### 1. Connect to Your Linode

```bash
ssh root@your-linode-ip
```

### 2. Create a Non-Root User

```bash
adduser dubdub
usermod -aG sudo dubdub
su - dubdub
```

### 3. Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 4. Install Required Software

```bash
# Python 3.11 and pip
sudo apt install -y python3.11 python3.11-venv python3-pip git nginx

# PostgreSQL (recommended for production)
sudo apt install -y postgresql postgresql-contrib

# Or use SQLite for simpler setup (not recommended for production)
```

### 5. Set Up PostgreSQL Database

```bash
sudo -u postgres psql
```

In PostgreSQL prompt:
```sql
CREATE DATABASE dubdub22;
CREATE USER dubdub_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE dubdub22 TO dubdub_user;
\q
```

## Application Deployment

### 1. Clone Repository

```bash
cd /home/dubdub
git clone https://github.com/Snail3D/DubDub-Hub.git
cd DubDub-Hub
```

### 2. Set Up Python Environment

```bash
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
cp .env.example .env
nano .env  # Edit with your configuration
```

**Important settings for production:**
- `DATABASE_URL=postgresql://dubdub_user:your_password@localhost/dubdub22`
- `PORTAL_SECRET_KEY` - Generate with: `python -c "import secrets; print(secrets.token_hex(32))"`
- `TELEGRAM_BOT_TOKEN` - Your bot token
- `PORTAL_BASE_URL=https://your-domain.com` (or `http://your-linode-ip:5000`)

### 4. Initialize Database

```bash
python -m bot.utils.database
python scripts/init_users.py
```

### 5. Create Directories

```bash
mkdir -p uploads engraving_files qr_codes
chmod 755 uploads engraving_files qr_codes
```

## Systemd Services

### 1. Create Bot Service

```bash
sudo nano /etc/systemd/system/dubdub22-bot.service
```

Add:
```ini
[Unit]
Description=DubDub22 Telegram Bot
After=network.target postgresql.service

[Service]
Type=simple
User=dubdub
Group=dubdub
WorkingDirectory=/home/dubdub/DubDub-Hub
Environment="PATH=/home/dubdub/DubDub-Hub/venv/bin"
ExecStart=/home/dubdub/DubDub-Hub/venv/bin/python -m bot.main
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### 2. Create Portal Service

```bash
sudo nano /etc/systemd/system/dubdub22-portal.service
```

Add:
```ini
[Unit]
Description=DubDub22 Customer Portal
After=network.target postgresql.service

[Service]
Type=simple
User=dubdub
Group=dubdub
WorkingDirectory=/home/dubdub/DubDub-Hub
Environment="PATH=/home/dubdub/DubDub-Hub/venv/bin"
ExecStart=/home/dubdub/DubDub-Hub/venv/bin/python -m portal.app
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### 3. Enable and Start Services

```bash
sudo systemctl daemon-reload
sudo systemctl enable dubdub22-bot
sudo systemctl enable dubdub22-portal
sudo systemctl start dubdub22-bot
sudo systemctl start dubdub22-portal
```

### 4. Check Status

```bash
sudo systemctl status dubdub22-bot
sudo systemctl status dubdub22-portal
```

## Nginx Configuration (for Portal)

### 1. Create Nginx Config

```bash
sudo nano /etc/nginx/sites-available/dubdub22
```

Add:
```nginx
server {
    listen 80;
    server_name your-domain.com;  # or your-linode-ip

    client_max_body_size 16M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        alias /home/dubdub/DubDub-Hub/uploads/;
    }
}
```

### 2. Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/dubdub22 /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 3. Set Up SSL (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Firewall Configuration

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## Monitoring and Logs

### View Logs

```bash
# Bot logs
sudo journalctl -u dubdub22-bot -f

# Portal logs
sudo journalctl -u dubdub22-portal -f

# Both logs
sudo journalctl -u dubdub22-bot -u dubdub22-portal -f
```

### Check Service Status

```bash
sudo systemctl status dubdub22-bot
sudo systemctl status dubdub22-portal
```

## Maintenance Commands

### Restart Services

```bash
sudo systemctl restart dubdub22-bot
sudo systemctl restart dubdub22-portal
```

### Update Application

```bash
cd /home/dubdub/DubDub-Hub
git pull
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart dubdub22-bot
sudo systemctl restart dubdub22-portal
```

### Backup Database

```bash
# PostgreSQL backup
sudo -u postgres pg_dump dubdub22 > backup_$(date +%Y%m%d).sql

# Restore
sudo -u postgres psql dubdub22 < backup_YYYYMMDD.sql
```

## Security Checklist

- [ ] Changed default passwords
- [ ] Set up firewall (UFW)
- [ ] Configured SSL/HTTPS
- [ ] Set secure `PORTAL_SECRET_KEY`
- [ ] Limited file upload sizes
- [ ] Set proper file permissions
- [ ] Regular database backups
- [ ] Monitoring and log rotation
- [ ] Keep system updated

## Troubleshooting

### Bot Not Starting

```bash
# Check logs
sudo journalctl -u dubdub22-bot -n 50

# Check if Telegram token is correct
# Verify database connection
```

### Portal Not Accessible

```bash
# Check if portal is running
sudo systemctl status dubdub22-portal

# Check Nginx
sudo nginx -t
sudo systemctl status nginx

# Check firewall
sudo ufw status
```

### Database Connection Issues

```bash
# Test PostgreSQL connection
sudo -u postgres psql -d dubdub22 -U dubdub_user

# Check PostgreSQL status
sudo systemctl status postgresql
```

## Performance Optimization

### For High Traffic

1. Use PostgreSQL instead of SQLite
2. Set up database connection pooling
3. Use a reverse proxy (Nginx) with caching
4. Consider using Gunicorn for Flask:
   ```bash
   pip install gunicorn
   # Update portal service to use:
   # ExecStart=/home/dubdub/DubDub-Hub/venv/bin/gunicorn -w 4 -b 127.0.0.1:5000 portal.app:app
   ```

## Next Steps

1. Test bot commands in Telegram
2. Test customer portal access
3. Set up automated backups
4. Configure monitoring/alerting
5. Set up log rotation



