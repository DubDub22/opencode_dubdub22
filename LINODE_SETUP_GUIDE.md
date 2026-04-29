# Linode Deployment Guide for DubDub Suppressor

## Prerequisites on Linode Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (v20+)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should be 20+
npm --version

# Install PM2 globally
sudo npm install -g pm2

# Install nginx
sudo apt install -y nginx

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

## 1. Clone/Update Repository

```bash
cd ~
git clone https://github.com/DubDub22/DubDubSuppressor.git
# OR update existing:
cd DubDubSuppressor
git pull origin main
```

## 2. Install Dependencies & Build

```bash
cd DubDubSuppressor
npm install
npm run build
```

## 3. Configure Environment

```bash
# Copy example or create .env
nano .env
```

Add your environment variables (get from your current Replit or create new ones):

```env
# Database (set up PostgreSQL locally or use existing)
DATABASE_URL=postgresql://username:password@localhost:5432/dubdub

# FastBound API
FASTBOUND_ACCOUNT=your_account_id
FASTBOUND_API_KEY=your_api_key
FASTBOUND_AUDIT_USER=Tom Flores

# ShipStation API
SHIPSTATION_API_KEY=your_key
SHIPSTATION_API_SECRET=your_secret

# Gmail SMTP
GMAIL_USER=orders@dubdub22.com
GMAIL_APP_PASSWORD=your_app_password

# BCC Email
BCC_EMAIL=tom@doubletactical.com

# Session Secret
SESSION_SECRET=your_random_secret_string
```

## 4. Set Up PostgreSQL (if not using external DB)

```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
CREATE DATABASE dubdub;
CREATE USER dubdubuser WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE dubdub TO dubdubuser;
\q

# Update DATABASE_URL in .env:
# DATABASE_URL=postgresql://dubdubuser:your_password@localhost:5432/dubdub

# Push schema
npm run db:push
```

## 5. Configure PM2

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Save process list (for auto-start on reboot)
pm2 save

# Enable startup on boot
pm2 startup
# (Run the command it outputs with sudo)

# Check status
pm2 status
pm2 logs dubdub-suppressor
```

## 6. Configure Nginx

```bash
# Copy nginx config
sudo cp nginx/dubdub22.com /etc/nginx/sites-available/dubdub22.com

# Edit to match your domain
sudo nano /etc/nginx/sites-available/dubdub22.com

# Enable site
sudo ln -s /etc/nginx/sites-available/dubdub22.com /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test nginx config
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
```

## 7. Set Up SSL with Certbot

```bash
# Get SSL certificate
sudo certbot --nginx -d dubdub22.com -d www.dubdub22.com

# Test auto-renewal
sudo certbot renew --dry-run

# Certbot will auto-update nginx config with SSL settings
```

## 8. Deploy Updates

For future deployments, use the deploy script:

```bash
cd ~/DubDubSuppressor
chmod +x deploy.sh
./deploy.sh
```

Or manually:

```bash
cd ~/DubDubSuppressor
git pull origin main
npm install
npm run build
pm2 restart dubdub-suppressor
```

## Monitoring & Maintenance

```bash
# View PM2 status
pm2 status

# View logs
pm2 logs dubdub-suppressor

# Restart app
pm2 restart dubdub-suppressor

# Monitor resources
pm2 monit

# View nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Firewall (Optional but Recommended)

```bash
# Configure UFW firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

## Troubleshooting

**App not starting:**
```bash
pm2 logs dubdub-suppressor
cat /var/log/dubdub-suppressor/error.log
```

**Nginx errors:**
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

**Database connection issues:**
```bash
sudo systemctl status postgresql
psql -U dubdubuser -d dubdub -h localhost
```

## Quick Reference

| Task | Command |
|------|---------|
| Start app | `pm2 start ecosystem.config.js` |
| Restart app | `pm2 restart dubdub-suppressor` |
| View logs | `pm2 logs dubdub-suppressor` |
| Check status | `pm2 status` |
| Deploy | `./deploy.sh` |
| SSL certs | `sudo certbot renew` |
| Restart nginx | `sudo systemctl restart nginx` |
