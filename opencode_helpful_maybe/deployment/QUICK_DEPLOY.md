# Quick Deploy to Linode

## One-Time Setup (First Time Only)

### 1. On Your Linode Server

```bash
# Connect to your Linode
ssh root@your-linode-ip

# Create user
adduser dubdub
usermod -aG sudo dubdub
su - dubdub

# Install dependencies
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3.11 python3.11-venv python3-pip git nginx postgresql postgresql-contrib

# Set up PostgreSQL
sudo -u postgres psql
# In PostgreSQL:
CREATE DATABASE dubdub22;
CREATE USER dubdub_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE dubdub22 TO dubdub_user;
\q
```

### 2. Clone and Deploy

```bash
cd /home/dubdub
git clone https://github.com/Snail3D/DubDub-Hub.git
cd DubDub-Hub
./deploy.sh
```

### 3. Configure Environment

```bash
nano .env
# Fill in all required values (see .env.production.example)
```

### 4. Set Up Systemd Services

Copy the service files from `LINODE_DEPLOYMENT.md` or:

```bash
# Create bot service
sudo nano /etc/systemd/system/dubdub22-bot.service
# (paste content from LINODE_DEPLOYMENT.md)

# Create portal service  
sudo nano /etc/systemd/system/dubdub22-portal.service
# (paste content from LINODE_DEPLOYMENT.md)

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable dubdub22-bot dubdub22-portal
sudo systemctl start dubdub22-bot dubdub22-portal
```

### 5. Set Up Nginx

```bash
sudo nano /etc/nginx/sites-available/dubdub22
# (paste content from LINODE_DEPLOYMENT.md)

sudo ln -s /etc/nginx/sites-available/dubdub22 /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Daily Updates

When you make changes:

```bash
cd /home/dubdub/DubDub-Hub
git pull
./deploy.sh
```

## Check Status

```bash
# Services
sudo systemctl status dubdub22-bot
sudo systemctl status dubdub22-portal

# Logs
sudo journalctl -u dubdub22-bot -f
sudo journalctl -u dubdub22-portal -f
```

## Troubleshooting

- **Bot not working?** Check `.env` has correct `TELEGRAM_BOT_TOKEN`
- **Portal not loading?** Check Nginx config and firewall
- **Database errors?** Verify PostgreSQL is running and credentials are correct



