import type { Express } from "express";
import { createServer, type Server } from "http";
import fs from "fs";
import session from "express-session";
import { storage } from "./storage";
import { pool } from "./db";

const SALES_EMAIL = "sales@doublettactical.com";
const WARRANTY_EMAIL = "warranty@doublettactical.com";
const BCC_EMAIL = "ericwoodard84@gmail.com";
const GMAIL_TOKEN_PATH = "/home/dubdub/DubDub-Hub/gmail_token.json";
const ENV_PATH = "/home/dubdub/DubDub-Hub/.env";

function loadEnvFromFile(filePath: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return out;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    out[key] = val;
  }
  return out;
}

function getGmailConfig() {
  const fileEnv = loadEnvFromFile(ENV_PATH);
  const clientId = process.env.GMAIL_CLIENT_ID || fileEnv.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET || fileEnv.GMAIL_CLIENT_SECRET;
  const sender = process.env.GMAIL_SENDER_ACCOUNT || fileEnv.GMAIL_SENDER_ACCOUNT || "tomtrevino@doublettactical.com";
  return { clientId, clientSecret, sender };
}

async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`token_refresh_failed: ${resp.status} ${txt}`);
  }

  const data = (await resp.json()) as { access_token: string };
  return data.access_token;
}

function buildMime({
  from,
  to,
  bcc,
  subject,
  text,
  replyTo,
  attachment,
}: {
  from: string;
  to: string;
  bcc?: string;
  subject: string;
  text: string;
  replyTo?: string;
  attachment?: { filename: string; base64Data: string; contentType: string };
}) {
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
  ];
  if (replyTo) headers.push(`Reply-To: ${replyTo}`);
  if (bcc) headers.push(`Bcc: ${bcc}`);

  if (!attachment) {
    headers.push("Content-Type: text/plain; charset=UTF-8");
    const raw = `${headers.join("\r\n")}\r\n\r\n${text}`;
    return Buffer.from(raw).toString("base64url");
  }

  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

  const parts = [
    `--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${text}`,
    `--${boundary}\r\nContent-Type: ${attachment.contentType}; name="${attachment.filename}"\r\nContent-Disposition: attachment; filename="${attachment.filename}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${attachment.base64Data}`,
    `--${boundary}--`,
  ];

  const raw = `${headers.join("\r\n")}\r\n\r\n${parts.join("\r\n")}`;
  return Buffer.from(raw).toString("base64url");
}

async function sendViaGmail({
  to,
  bcc,
  subject,
  text,
  replyTo,
  attachment,
}: {
  to: string;
  bcc?: string;
  subject: string;
  text: string;
  replyTo?: string;
  attachment?: { filename: string; base64Data: string; contentType: string };
}) {
  if (!fs.existsSync(GMAIL_TOKEN_PATH)) throw new Error("gmail_token_missing");
  const token = JSON.parse(fs.readFileSync(GMAIL_TOKEN_PATH, "utf8"));
  const refreshToken = token.refresh_token;
  if (!refreshToken) throw new Error("gmail_refresh_token_missing");

  const { clientId, clientSecret, sender } = getGmailConfig();
  if (!clientId || !clientSecret) throw new Error("gmail_client_config_missing");

  const accessToken = await refreshAccessToken(refreshToken, clientId, clientSecret);
  const raw = buildMime({
    from: `DubDub22 Forms <${sender}>`,
    to,
    bcc,
    subject,
    text,
    replyTo,
    attachment,
  });

  const resp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`gmail_send_failed: ${resp.status} ${txt}`);
  }

  return resp.json();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Ensure auth tables exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_pin_requests (
      id SERIAL PRIMARY KEY,
      pin_hash VARCHAR(64) NOT NULL,
      ip_address VARCHAR(45) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin_ip_whitelist (
      id SERIAL PRIMARY KEY,
      ip_address VARCHAR(45) NOT NULL UNIQUE,
      whitelisted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin_failed_attempts (
      id SERIAL PRIMARY KEY,
      ip_address VARCHAR(45) NOT NULL,
      attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `).catch(() => {}); // Don't fail startup if DB is unavailable

  // Trust proxy for secure cookies
  app.set('trust proxy', 1);

  // Setup simple session for admin
  app.use(session({
    secret: process.env.SESSION_SECRET || 'super-secret-dubdub-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production" }
  }));

  // Get client IP from request
  const getClientIp = (req: any): string => {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.headers['x-real-ip'] as string
      || req.socket?.remoteAddress
      || '';
  };

  // --- PIN-based auth endpoints ---

  // Request a PIN (posted to Discord webhook)
  app.post("/api/admin/request-pin", async (req, res) => {
    try {
      const ip = getClientIp(req);

      // Rate limit: one PIN request per 60 seconds per IP
      const recent = await pool.query(
        `SELECT id FROM admin_pin_requests WHERE ip_address = $1 AND created_at > NOW() - INTERVAL '60 seconds'`,
        [ip]
      );
      if (recent.rows.length > 0) {
        return res.status(429).json({ ok: false, error: "Please wait 60 seconds before requesting another PIN." });
      }

      // Generate 6-digit PIN
      const pin = Math.floor(100000 + Math.random() * 900000).toString();
      const pinHash = Buffer.from(pin).toString('base64'); // simple hash, not cryptographic but enough for this use
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min

      await pool.query(
        `INSERT INTO admin_pin_requests (pin_hash, ip_address, expires_at) VALUES ($1, $2, $3)`,
        [pinHash, ip, expiresAt]
      );

      // Post to Discord webhook
      const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
      if (webhookUrl) {
        const discordPayload = {
          content: `🔐 **Admin Access Request**\n\nPIN: \`${pin}\`\nIP: \`${ip}\`\n\nValid for 5 minutes. Paste this PIN at dubdub22.com/admin to unlock access.`,
        };
        fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(discordPayload),
        }).catch(() => {});
      }

      return res.json({ ok: true, message: "PIN sent to #general channel." });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err?.message || "server_error" });
    }
  });

  // Verify PIN and whitelist IP
  app.post("/api/admin/verify-pin", async (req, res) => {
    try {
      const { pin } = req.body;
      if (!pin || !/^\d{6}$/.test(pin)) {
        return res.status(400).json({ ok: false, error: "invalid_pin_format" });
      }

      const ip = getClientIp(req);
      const pinHash = Buffer.from(pin).toString('base64');

      // Check for recent failed attempts (brute force protection)
      const recentFail = await pool.query(
        `SELECT COUNT(*) as cnt FROM admin_failed_attempts WHERE ip_address = $1 AND attempted_at > NOW() - INTERVAL '15 minutes'`,
        [ip]
      );
      if (parseInt(recentFail.rows[0]?.cnt || '0') >= 5) {
        return res.status(429).json({ ok: false, error: "Too many failed attempts. Wait 15 minutes." });
      }

      // Find valid PIN for this IP that hasn't expired
      const result = await pool.query(
        `SELECT id FROM admin_pin_requests WHERE pin_hash = $1 AND ip_address = $2 AND expires_at > NOW()`,
        [pinHash, ip]
      );

      if (result.rows.length === 0) {
        // Record failed attempt
        await pool.query(`INSERT INTO admin_failed_attempts (ip_address) VALUES ($1)`, [ip]);
        return res.status(401).json({ ok: false, error: "invalid_or_expired_pin" });
      }

      // PIN is valid — delete it and whitelist the IP for 7 days
      await pool.query(`DELETE FROM admin_pin_requests WHERE id = $1`, [result.rows[0].id]);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await pool.query(
        `INSERT INTO admin_ip_whitelist (ip_address, expires_at) VALUES ($1, $2)
         ON CONFLICT (ip_address) DO UPDATE SET expires_at = $2, whitelisted_at = NOW()`,
        [ip, expiresAt]
      );

      (req.session as any).isAdmin = true;
      return res.json({ ok: true, expiresAt: expiresAt.toISOString() });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err?.message || "server_error" });
    }
  });

  // Check if current IP is whitelisted (used on page load)
  app.get("/api/admin/check-auth", async (req, res) => {
    try {
      const ip = getClientIp(req);
      const result = await pool.query(
        `SELECT expires_at FROM admin_ip_whitelist WHERE ip_address = $1 AND expires_at > NOW()`,
        [ip]
      );
      if (result.rows.length > 0) {
        (req.session as any).isAdmin = true;
        return res.json({ ok: true, authorized: true, expiresAt: result.rows[0].expires_at });
      }
      return res.json({ ok: true, authorized: false });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err?.message || "server_error" });
    }
  });

  app.post("/api/admin/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  const requireAdmin = (req: any, res: any, next: any) => {
    if (req.session?.isAdmin) {
      return next();
    }
    return res.status(403).json({ ok: false, error: "unauthorized" });
  };

  app.get("/api/admin/submissions", requireAdmin, async (req, res) => {
    try {
      const submissions = await storage.getSubmissions();
      return res.json({ ok: true, data: submissions });
    } catch (err: any) {
      console.error("fetch_submissions_error", err);
      return res.status(500).json({ ok: false, error: "failed_to_fetch" });
    }
  });

  app.delete("/api/admin/submissions/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteSubmission(id);
      return res.json({ ok: true });
    } catch (err: any) {
      console.error("delete_submission_error", err);
      return res.status(500).json({ ok: false, error: "failed_to_delete" });
    }
  });

  app.post("/api/dealer-request", async (req, res) => {
    try {
      const { requestType, contactName, businessName, email, phone, quantityCans, fflFileName, fflFileData, message } = req.body || {};
      const isInquiry = requestType === 'Dealer Inquiry';

      if (!contactName || !businessName || !email) {
        return res.status(400).json({ ok: false, error: "missing_required_fields" });
      }
      if (!isInquiry && !quantityCans) {
        return res.status(400).json({ ok: false, error: "missing_required_fields" });
      }

      const isDemoOrder = !isInquiry && quantityCans === '1';

      // ── Demo can rules ──────────────────────────────────────────────
      // Demo cans: limit 1 per dealer (email + business name)
      if (isDemoOrder) {
        const existingDemo = await pool.query(
          `SELECT id FROM submissions
           WHERE email = $1 AND business_name ILIKE $2 AND has_ordered_demo = 'true' AND type = 'dealer'
           LIMIT 1`,
          [email.toLowerCase(), businessName]
        );
        if (existingDemo.rows.length > 0) {
          return res.status(400).json({
            ok: false,
            error: "demo_already_ordered",
            message: "Demo can limit of 1 per dealer has already been fulfilled for this business. Please order in multiples of 5 if placing a new order.",
          });
        }
      }

      // After a demo can, subsequent orders must be in multiples of 5
      if (!isInquiry && !isDemoOrder && Number(quantityCans) > 1) {
        const hasOrderedDemo = await pool.query(
          `SELECT id FROM submissions
           WHERE email = $1 AND business_name ILIKE $2 AND has_ordered_demo = 'true' AND type = 'dealer'
           LIMIT 1`,
          [email.toLowerCase(), businessName]
        );
        if (hasOrderedDemo.rows.length > 0 && Number(quantityCans) % 5 !== 0) {
          return res.status(400).json({
            ok: false,
            error: "must_be_multiple_of_5",
            message: "After your demo can order, subsequent orders must be in multiples of 5 units.",
          });
        }
      }
      // ───────────────────────────────────────────────────────────────
      // ───────────────────────────────────────────────────────────────

      const body = [
        `DubDub22 ${isInquiry ? 'Dealer Inquiry' : isDemoOrder ? 'Dealer Order (DEMO CAN)' : 'Dealer Order'}`,
        "",
        `Contact: ${contactName}`,
        `Business: ${businessName}`,
        `Email: ${email}`,
        `Phone: ${phone || "N/A"}`,
        isInquiry ? "" : `Quantity: ${quantityCans}${isDemoOrder ? ' (DEMO CAN)' : ''}`,
        isInquiry ? "" : `SOT File: ${fflFileName || "Not provided"}`,
        message ? `\nMessage:\n${message}` : "",
      ].join("\n");

      const ext = (fflFileName || "").split(".").pop()?.toLowerCase() || "";
      const contentTypeMap: Record<string, string> = {
        pdf: "application/pdf",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
      };

      const [gmailResult, dbResult] = await Promise.all([
        sendViaGmail({
          to: SALES_EMAIL,
          bcc: BCC_EMAIL,
          subject: `DubDub22 ${isInquiry ? 'Dealer Inquiry' : 'Dealer Order'} - ${businessName}`,
          text: body,
          replyTo: email,
          attachment: fflFileData && !isInquiry ? {
            filename: fflFileName || "sot-file",
            base64Data: fflFileData,
            contentType: contentTypeMap[ext] || "application/octet-stream",
          } : undefined,
        }).catch(err => {
          console.error("gmail_failed", err);
          return null; // Don't fail the whole request
        }),
        storage.createSubmission({
          type: "dealer",
          contactName,
          businessName,
          email,
          phone,
          quantity: quantityCans ? String(quantityCans) : null,
          description: message || null,
          fflFileName: isInquiry ? null : fflFileName,
          fflFileData: isInquiry ? null : fflFileData,
          hasOrderedDemo: isDemoOrder ? 'true' : 'false',
        }).catch(err => {
          console.error("db_save_failed", err);
          return null;
        })
      ]);

      return res.json({ ok: true, id: dbResult?.id || "unknown" });
    } catch (err: any) {
      console.error("dealer_request_error", err?.message || err);
      return res.status(500).json({ ok: false, error: err?.message || "dealer_save_failed" });
    }
  });

  app.post("/api/warranty-request", async (req, res) => {
    try {
      const { name, email, serialNumber, description, serialPhotoName, serialPhotoData, damagePhoto1Name, damagePhoto1Data, damagePhoto2Name, damagePhoto2Data } = req.body || {};
      if (!name || !email || !serialNumber || !description) {
        return res.status(400).json({ ok: false, error: "missing_required_fields" });
      }
      if (!/^[A-Za-z0-9]{6,}$/.test(String(serialNumber))) {
        return res.status(400).json({ ok: false, error: "serial_must_be_alphanumeric_min_6" });
      }
      if (!/[A-Za-z]{3,}/.test(String(description))) {
        return res.status(400).json({ ok: false, error: "description_must_have_word_3_letters" });
      }

      const body = [
        "DubDub22 Warranty Request",
        "",
        `Name: ${name}`,
        `Email: ${email}`,
        `Serial: ${serialNumber}`,
        `Description: ${description}`,
      ].join("\n");

      const [gmailResult, dbResult] = await Promise.all([
        sendViaGmail({
          to: WARRANTY_EMAIL,
          bcc: BCC_EMAIL,
          subject: `DubDub22 Warranty - ${serialNumber}`,
          text: body,
          replyTo: email,
        }).catch(err => {
          console.error("gmail_failed", err);
          return null;
        }),
        storage.createSubmission({
          type: "warranty",
          contactName: name,
          email,
          serialNumber: String(serialNumber),
          description: String(description),
          serialPhotoName,
          serialPhotoData,
          damagePhoto1Name,
          damagePhoto1Data,
          damagePhoto2Name,
          damagePhoto2Data,
        }).catch(err => {
          console.error("db_save_failed", err);
          return null;
        })
      ]);

      return res.json({ ok: true, id: dbResult?.id || "unknown" });
    } catch (err: any) {
      console.error("warranty_request_error", err?.message || err);
      return res.status(500).json({ ok: false, error: err?.message || "warranty_save_failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
