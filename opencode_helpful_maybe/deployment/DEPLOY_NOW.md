# Deploy to Linode - Step by Step

Follow these commands in order on your Linode server.

## Step 1: Connect to Your Server

On your local machine, run:
```bash
ssh root@45.33.121.147
```
Password: `DubDubBigLubLub25!`

## Step 2: Initial Server Setup

Once connected, run these commands:

```bash
# Update system
apt update && apt upgrade -y

# Install required software
apt install -y python3.11 python3.11-venv python3-pip git nginx postgresql postgresql-contrib

# Install OCR dependencies (Tesseract OCR and PDF support)
apt install -y tesseract-ocr poppler-utils

# Create application user
adduser dubdub
usermod -aG sudo dubdub

# Switch to new user
su - dubdub
```

## Step 3: Set Up PostgreSQL Database

```bash
# Switch back to root temporarily
exit

# Set up database
sudo -u postgres psql
```

In PostgreSQL prompt, run:
```sql
CREATE DATABASE dubdub22;
CREATE USER dubdub_user WITH PASSWORD 'DubDubDB2024!';
GRANT ALL PRIVILEGES ON DATABASE dubdub22 TO dubdub_user;
\q
```

```bash
# Switch back to dubdub user
su - dubdub
```

## Step 4: Clone Repository

```bash
cd /home/dubdub
git clone https://github.com/Snail3D/DubDub-Hub.git
cd DubDub-Hub
```

## Step 5: Set Up Python Environment

```bash
# Create virtual environment
python3.11 -m venv venv

# Activate it
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt
```

## Step 6: Configure Environment Variables

```bash
# Copy example file
cp .env.example .env

# Edit the file
nano .env
```

**Important values to set:**
- `DATABASE_URL=postgresql://dubdub_user:DubDubDB2024!@localhost/dubdub22`
- `PORTAL_BASE_URL=http://45.33.121.147:5000`
- `PORTAL_SECRET_KEY` - Generate with: `python -c "import secrets; print(secrets.token_hex(32))"`
- Add your Telegram bot token, IDs, etc.

Save and exit (Ctrl+X, then Y, then Enter)

## Step 7: Initialize Database

```bash
# Make sure venv is activated
source venv/bin/activate

# Initialize database
python -m bot.utils.database

# Initialize users
python scripts/init_users.py
```

## Step 8: Create Required Directories

```bash
mkdir -p uploads engraving_files qr_codes
chmod 755 uploads engraving_files qr_codes
```

## Step 9: Set Up Systemd Services

```bash
# Switch to root
exit

# Copy service files
cp /home/dubdub/DubDub-Hub/systemd/dubdub22-bot.service /etc/systemd/system/
cp /home/dubdub/DubDub-Hub/systemd/dubdub22-portal.service /etc/systemd/system/

# Reload systemd
systemctl daemon-reload

# Enable services
systemctl enable dubdub22-bot
systemctl enable dubdub22-portal

# Start services
systemctl start dubdub22-bot
systemctl start dubdub22-portal

# Check status
systemctl status dubdub22-bot
systemctl status dubdub22-portal
```

## Step 10: Set Up Nginx

```bash
# Copy nginx config
cp /home/dubdub/DubDub-Hub/nginx/dubdub22.conf /etc/nginx/sites-available/dubdub22

# Edit to use your IP
nano /etc/nginx/sites-available/dubdub22
# Change "your-domain.com" to "45.33.121.147"

# Enable site
ln -s /etc/nginx/sites-available/dubdub22 /etc/nginx/sites-enabled/

# Test config
nginx -t

# Restart nginx
systemctl restart nginx
```

## Step 11: Configure Firewall

```bash
# Allow SSH and HTTP
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

## Step 12: Test Everything

```bash
# Check bot logs
journalctl -u dubdub22-bot -f

# Check portal logs
journalctl -u dubdub22-portal -f

# Test portal in browser
# Visit: http://45.33.121.147
```

## Troubleshooting

If services fail to start:
```bash
# Check logs
journalctl -u dubdub22-bot -n 50
journalctl -u dubdub22-portal -n 50

# Restart services
systemctl restart dubdub22-bot
systemctl restart dubdub22-portal
```

## Next Steps

1. Configure your Telegram bot token in `.env`
2. Set up Eric and Tom's Telegram IDs
3. Test the bot with `/start` command
4. Test the portal with a serial number URL

