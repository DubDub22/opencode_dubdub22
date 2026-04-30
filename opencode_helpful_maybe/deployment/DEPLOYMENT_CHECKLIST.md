# Linode Deployment Checklist

Use this checklist when deploying to your Linode server.

## Pre-Deployment

- [ ] Linode instance created and running
- [ ] Domain name pointed to Linode IP (optional)
- [ ] SSH access configured
- [ ] Telegram Bot Token obtained from @BotFather
- [ ] Telegram User IDs for Eric and Tom
- [ ] FastBound API credentials (if using)
- [ ] YouTube Playlist ID (if using)

## Server Setup

- [ ] Connected to Linode via SSH
- [ ] Created non-root user (`dubdub`)
- [ ] Updated system packages
- [ ] Installed Python 3.11, pip, git, nginx
- [ ] Installed PostgreSQL
- [ ] Created PostgreSQL database and user
- [ ] Configured firewall (UFW)

## Application Deployment

- [ ] Cloned repository to `/home/dubdub/DubDub-Hub`
- [ ] Created Python virtual environment
- [ ] Installed dependencies (`pip install -r requirements.txt`)
- [ ] Copied `.env.example` to `.env`
- [ ] Configured `.env` with all required values:
  - [ ] `TELEGRAM_BOT_TOKEN`
  - [ ] `TELEGRAM_GROUP_CHAT_ID`
  - [ ] `ERIC_TELEGRAM_ID`
  - [ ] `TOM_TELEGRAM_ID`
  - [ ] `DATABASE_URL` (PostgreSQL connection string)
  - [ ] `PORTAL_SECRET_KEY` (generated secure key)
  - [ ] `PORTAL_BASE_URL`
  - [ ] Other optional settings
- [ ] Ran database initialization (`python -m bot.utils.database`)
- [ ] Ran user initialization (`python scripts/init_users.py`)
- [ ] Created required directories (uploads, engraving_files, qr_codes)

## Systemd Services

- [ ] Copied systemd service files to `/etc/systemd/system/`
- [ ] Edited service files with correct paths (if needed)
- [ ] Ran `sudo systemctl daemon-reload`
- [ ] Enabled services (`sudo systemctl enable dubdub22-bot dubdub22-portal`)
- [ ] Started services (`sudo systemctl start dubdub22-bot dubdub22-portal`)
- [ ] Verified services are running (`sudo systemctl status`)

## Nginx Configuration

- [ ] Created Nginx config file
- [ ] Updated server_name in config
- [ ] Enabled site (`sudo ln -s`)
- [ ] Tested Nginx config (`sudo nginx -t`)
- [ ] Restarted Nginx
- [ ] Configured SSL with Let's Encrypt (if using domain)

## Testing

- [ ] Bot responds to `/start` command in Telegram
- [ ] Bot responds to `/help` command
- [ ] Portal accessible via browser
- [ ] Can access portal with serial number URL
- [ ] Can upload documents
- [ ] Can submit warranty request
- [ ] Admin commands work in Telegram
- [ ] Database connections working
- [ ] File uploads working

## Security

- [ ] Changed default passwords
- [ ] Firewall configured and enabled
- [ ] SSL/HTTPS configured (if using domain)
- [ ] Secure `PORTAL_SECRET_KEY` set
- [ ] File permissions set correctly
- [ ] Database credentials secure
- [ ] `.env` file not in git (check `.gitignore`)

## Monitoring

- [ ] Can view bot logs (`sudo journalctl -u dubdub22-bot -f`)
- [ ] Can view portal logs (`sudo journalctl -u dubdub22-portal -f`)
- [ ] Set up log rotation (optional)
- [ ] Set up automated backups (optional)

## Post-Deployment

- [ ] Tested purchase flow
- [ ] Tested serial generation
- [ ] Tested QR code generation
- [ ] Tested warranty system
- [ ] Verified FastBound integration (if using)
- [ ] Documented any custom configurations
- [ ] Created backup of initial database

## Troubleshooting Notes

Document any issues encountered and their solutions:

```
Issue:
Solution:
```



