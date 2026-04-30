# Connect Gmail - Setup Guide for Tom

This guide explains how to set up the "Connect Gmail" integration so that the portal uses the Gmail API to send form emails (bypassing server SMTP blocks).

## Step 1: Set Up Google Cloud Console

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g., "DubDub Portal").
3. In the sidebar, go to **APIs & Services** > **Library**.
4. Search for **Gmail API** and click **Enable**.
5. Go to **APIs & Services** > **OAuth consent screen**.
   - Choose **External** (or **Internal** if using a Google Workspace account).
   - Fill in the required fields (App name, User support email, Developer contact email).
   - Under **Scopes**, click "Add or Remove Scopes" and add `https://www.googleapis.com/auth/gmail.send`.
   - Save and continue. Add your Gmail account as a "Test User" if the app is unverified.
6. Go to **APIs & Services** > **Credentials**.
   - Click **Create Credentials** > **OAuth client ID**.
   - Application type: **Web application**.
   - Under **Authorized redirect URIs**, add your exact redirect URI:
     `https://YOUR_DOMAIN/admin/gmail/callback` 
     *(Replace YOUR_DOMAIN with the actual domain or `http://localhost:5000/admin/gmail/callback` for local testing).*
   - Click **Create**. You will get a **Client ID** and **Client Secret**.

## Step 2: Configure Environment Variables

Add the following to your server's `.env` file:

```env
GMAIL_CLIENT_ID=your-client-id-here
GMAIL_CLIENT_SECRET=your-client-secret-here
GMAIL_REDIRECT_URI=https://YOUR_DOMAIN/admin/gmail/callback
GMAIL_SENDER_ACCOUNT=your.account@gmail.com
```

> **Note:** Ensure that `GMAIL_REDIRECT_URI` matches exactly what you configured in Google Cloud.

## Step 3: Connect the Account

1. Restart the portal service to pick up the new `.env` variables.
2. Log in to the Admin Dashboard and go to **Settings**.
3. Under the **Gmail Integration** section, click **Connect Gmail**.
4. Authorize the application using your Google account.
5. You should be redirected back to the settings page, and the status should show a green **Connected** indicator.

All emails (warranty, forms, etc.) will now automatically route through the Gmail API! If the connection fails or the token is deleted, it will fall back to traditional SMTP.
