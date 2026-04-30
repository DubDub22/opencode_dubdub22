# DubDubSuppressor Website Deployment Guide

This guide will help you deploy the DubDubSuppressor website from your desktop to the Linode server and connect it to `dubdub22.com`.

## Overview

The website is a Node.js/TypeScript application with:
- **Frontend:** React + Vite
- **Backend:** Express.js
- **Database:** PostgreSQL (Drizzle ORM)
- **Port:** 5000 (or PORT env var)

## Step 1: Transfer Files to Server

### Option A: Using SCP (from your local machine)

```bash
# From your local machine, compress and transfer
cd /Users/edubs/Desktop
tar -czf DubDubSuppressor.tar.gz DubDubSuppressor/
scp DubDubSuppressor.tar.gz root@45.33.121.147:/home/dubdub/
```

### Option B: Using Git (Recommended)

```bash
# On your local machine, initialize git if not already
cd /Users/edubs/Desktop/DubDubSuppressor
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/Snail3D/DubDubSuppressor.git
git push -u origin main

# Then on server
cd /home/dubdub
git clone https://github.com/Snail3D/DubDubSuppressor.git
```

## Step 2: Install Node.js on Server

SSH into your server:
```bash
ssh root@45.33.121.147
```

Install Node.js 20.x (LTS):
```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version
```

## Step 3: Set Up Website on Server

```bash
# Switch to dubdub user
su - dubdub

# Navigate to website directory
cd /home/dubdub/DubDubSuppressor

# If you used SCP, extract the archive first:
# tar -xzf DubDubSuppressor.tar.gz

# Install dependencies
npm install

# Build the application
npm run build
```

## Step 4: Configure Environment Variables

Create `.env` file:
```bash
cd /home/dubdub/DubDubSuppressor
nano .env
```

Add these variables:
```env
NODE_ENV=production
PORT=5001
DATABASE_URL=postgresql://dubdub_user:DubDubDB2024!@localhost/dubdub22
# Add any other environment variables your app needs
```

**Note:** Using port 5001 to avoid conflict with the portal (port 5000).

## Step 5: Set Up Database

If the website uses a separate database, create it:
```bash
sudo -u postgres psql
```

In PostgreSQL:
```sql
CREATE DATABASE dubdub_suppressor;
GRANT ALL PRIVILEGES ON DATABASE dubdub_suppressor TO dubdub_user;
\q
```

Then run migrations:
```bash
cd /home/dubdub/DubDubSuppressor
npm run db:push
```

## Step 6: Create Systemd Service

Create service file:
```bash
sudo nano /etc/systemd/system/dubdub22-website.service
```

Add this content:
```ini
[Unit]
Description=DubDub22 Website
After=network.target postgresql.service

[Service]
Type=simple
User=dubdub
WorkingDirectory=/home/dubdub/DubDubSuppressor
Environment="NODE_ENV=production"
Environment="PORT=5001"
EnvironmentFile=/home/dubdub/DubDubSuppressor/.env
ExecStart=/usr/bin/node /home/dubdub/DubDubSuppressor/dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable dubdub22-website
sudo systemctl start dubdub22-website
sudo systemctl status dubdub22-website
```

## Step 7: Configure Nginx

Create Nginx configuration:
```bash
sudo nano /etc/nginx/sites-available/dubdub22.com
```

Add this content:
```nginx
server {
    listen 80;
    server_name dubdub22.com www.dubdub22.com;

    # Website (main domain)
    location / {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Portal subdomain (if needed)
server {
    listen 80;
    server_name portal.dubdub22.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/dubdub22.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Step 8: Update DNS Records on 1and1/IONOS

1. Log into your 1and1/IONOS control panel
2. Navigate to DNS management for `dubdub22.com`
3. Update the **A record**:
   - **Host:** `@` (or leave blank for root domain)
   - **Value:** `45.33.121.147` (your Linode IP)
   - **TTL:** 3600 (or default)

4. (Optional) Add **AAAA record** for IPv6:
   - **Host:** `@`
   - **Value:** `2600:3c00::2000:80ff:fe55:7bd4` (your Linode IPv6)
   - **TTL:** 3600

5. (Optional) Add **www** subdomain:
   - **Type:** A
   - **Host:** `www`
   - **Value:** `45.33.121.147`
   - **TTL:** 3600

**DNS Propagation:** Changes can take 24-48 hours, but usually propagate within a few hours.

## Step 9: Set Up SSL/HTTPS with Let's Encrypt

Install Certbot:
```bash
sudo apt install -y certbot python3-certbot-nginx
```

Get SSL certificate:
```bash
sudo certbot --nginx -d dubdub22.com -d www.dubdub22.com
```

Follow the prompts. Certbot will automatically configure Nginx for HTTPS.

Auto-renewal is set up automatically, but test it:
```bash
sudo certbot renew --dry-run
```

## Step 10: Verify Deployment

1. **Check service status:**
   ```bash
   sudo systemctl status dubdub22-website
   ```

2. **Check logs:**
   ```bash
   sudo journalctl -u dubdub22-website -f
   ```

3. **Test locally on server:**
   ```bash
   curl http://localhost:5001
   ```

4. **Test from browser:**
   - Visit `http://dubdub22.com` (or `https://` after SSL setup)
   - Check `http://45.33.121.147` (direct IP)

## Troubleshooting

### Service won't start
```bash
# Check logs
sudo journalctl -u dubdub22-website -n 50

# Check if port is in use
sudo netstat -tlnp | grep 5001

# Check file permissions
ls -la /home/dubdub/DubDubSuppressor/dist/
```

### Nginx 502 Bad Gateway
- Check if the service is running: `sudo systemctl status dubdub22-website`
- Check Nginx error logs: `sudo tail -f /var/log/nginx/error.log`
- Verify port in service file matches Nginx config

### Database connection issues
- Verify PostgreSQL is running: `sudo systemctl status postgresql`
- Check DATABASE_URL in `.env` file
- Test connection: `psql -U dubdub_user -d dubdub_suppressor -h localhost`

### Build errors
- Make sure all dependencies are installed: `npm install`
- Check Node.js version: `node --version` (should be 20.x)
- Clear node_modules and reinstall: `rm -rf node_modules package-lock.json && npm install`

## Updating the Website

When you make changes:

```bash
# SSH into server
ssh dubdub@45.33.121.147

# Navigate to website directory
cd /home/dubdub/DubDubSuppressor

# Pull latest changes (if using git)
git pull

# Install any new dependencies
npm install

# Rebuild
npm run build

# Restart service
sudo systemctl restart dubdub22-website
```

## File Structure on Server

```
/home/dubdub/
├── DubDub-Hub/          # Telegram bot & portal (port 5000)
└── DubDubSuppressor/    # Website (port 5001)
    ├── dist/            # Built files
    ├── .env             # Environment variables
    └── ...
```

## Port Allocation

- **Port 5000:** DubDub-Hub Portal (Flask)
- **Port 5001:** DubDubSuppressor Website (Node.js)
- **Port 80:** HTTP (Nginx)
- **Port 443:** HTTPS (Nginx)

## Next Steps

1. ✅ Transfer files to server
2. ✅ Install Node.js
3. ✅ Build application
4. ✅ Set up systemd service
5. ✅ Configure Nginx
6. ✅ Update DNS records
7. ✅ Set up SSL
8. ✅ Test website

## Notes

- The website runs on port 5001 to avoid conflicts with the portal
- Nginx proxies requests to the appropriate service based on domain
- SSL certificates auto-renew via Certbot
- All services run as `dubdub` user for security



