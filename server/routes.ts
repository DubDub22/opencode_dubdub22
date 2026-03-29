import type { Express } from "express";
import { createServer, type Server } from "http";
import fs from "fs";
import { execSync } from "child_process";
import { globSync } from "glob";
import path from "path";
import session from "express-session";
import { storage } from "./storage";
import { pool } from "./db";

const SALES_EMAIL = "sales@doublettactical.com";
const WARRANTY_EMAIL = "warranty@doublettactical.com";
const BCC_EMAIL = "ericwoodard84@gmail.com";
const GMAIL_TOKEN_PATH = "/home/dubdub/DubDub-Hub/gmail_token.json";
const ENV_PATH = "/home/dubdub/DubDub-Hub/.env";

// ─────────────────────────────────────────────────────────────────────────────
// OCR / Parse helpers — shared by file-upload routes and parse-* routes
// ─────────────────────────────────────────────────────────────────────────────

function parseSotText(text: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  const einMatch = text.match(/(\d{2}-\d{7})/);
  if (einMatch) parsed.ein = einMatch[1];
  const lines = text.split("\n").map((l: string) => l.trim()).filter(Boolean);
  const nameBlockIdx = lines.findIndex((l: string) =>
    l.includes("Name and Principal") || l.includes("Business Address") || l.includes("DOUBLE T") || l.includes("TACTICAL")
  );
  if (nameBlockIdx >= 0) {
    const relevant = lines.slice(nameBlockIdx, nameBlockIdx + 6);
    const companyLine = relevant.find((l: string) =>
      /^[A-Z][A-Z\s&\-']+$/.test(l) && l.length > 2 && !l.includes("Address") && !l.includes("Name")
    );
    if (companyLine) parsed.businessName = companyLine;
    const addrLine = relevant.find((l: string) => /TX|Texas/.test(l));
    if (addrLine) {
      parsed.businessAddress = addrLine.replace(/\s+TX\s+\d{5}.*$/, "").trim();
      const zipMatch = addrLine.match(/\d{5}/);
      if (zipMatch) parsed.zip = zipMatch[0];
      parsed.state = "TX";
    }
  }
  const typeMatch = text.match(/\((\d+)\)\s*([^\n]+(?:NFA[^\n]+)?)/i);
  if (typeMatch) parsed.sotLicenseType = typeMatch[2].trim();
  const yearMatch = text.match(/Tax Year[:\s]+(\d{4})/i);
  if (yearMatch) parsed.sotTaxYear = yearMatch[1];
  const periodMatch = text.match(/(\d{2}\/\d{2}\/\d{4})\s+to\s+(\d{2}\/\d{2}\/\d{4})/);
  if (periodMatch) { parsed.sotPeriodStart = periodMatch[1]; parsed.sotPeriodEnd = periodMatch[2]; }
  const dateMatch = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/i);
  if (dateMatch) parsed.sotReceiptDate = dateMatch[0];
  const ctrlMatch = text.match(/(\d{7,}[A-Z0-9\-]+)/);
  if (ctrlMatch) parsed.sotControlNumber = ctrlMatch[1];
  return parsed;
}

function parseFflText(text: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  const lines = text.split("\n").map((l: string) => l.trim()).filter(Boolean);
  const licMatch = text.match(/(?:License\s*(?:No\.?|Number|#)\s*:?\s*)([8]-\d{5,}(?:-[A-Z])?)/i)
    || text.match(/\b(8-\d{5,}(?:-[A-Z])?)\b/);
  if (licMatch) parsed.fflLicenseNumber = licMatch[1].trim();
  const typeMatch = text.match(/(?:Type\s*0?\d)\s*[-–]\s*([^\n]+(?:Dealer|Manufacturer|Gunsmith)[^\n]*)/i)
    || text.match(/(Dealer in Firearms|Manufacturer of Firearms|Gunsmith)/i);
  if (typeMatch) { const t = typeMatch[1] || typeMatch[0]; parsed.fflLicenseType = t.trim().slice(0, 80); }
  const expMatch = text.match(/(?:Expires?\s*[:]\s*)(0?\d[-/]0?\d[-/]\d{4})/i)
    || text.match(/\b(0?\d[-/]0?\d[-/]\d{4})\b/);
  if (expMatch) parsed.fflExpiry = expMatch[1].trim();
  const licIdx = lines.findIndex((l: string) =>
    /license\s*(no\.?|number|#)/i.test(l) || /\b8-\d{5,}/.test(l)
  );
  if (licIdx > 0) {
    for (let i = licIdx - 1; i >= Math.max(0, licIdx - 5); i--) {
      const line = lines[i];
      if (/^(Street|St|Ave|Rd|Fl|Ste|Suite|Po Box|Box)/i.test(line)) continue;
      if (/license|ffl|expires|city|state|zip|phone|email/i.test(line)) continue;
      if (/^[A-Z][A-Z\s&\-\.\']+$/.test(line) && line.length > 2) { parsed.businessName = line; break; }
    }
  }
  const addrMatch = text.match(/([A-Za-z\s]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/);
  if (addrMatch) { parsed.city = addrMatch[1].trim(); parsed.state = addrMatch[2].trim(); parsed.zip = addrMatch[3].trim(); }
  return parsed;
}

async function parseSotFile(fileData: string, fileName: string): Promise<{ text: string; parsed: Record<string, string> }> {
  const buf = Buffer.from(fileData, "base64");
  const ext = (fileName || "").split(".").pop()?.toLowerCase() || "bin";
  const tmpPath = `/tmp/sot_parse_${Date.now()}.${ext}`;
  fs.writeFileSync(tmpPath, buf);
  let text = "";
  if (ext === "pdf") {
    try {
      execSync(`pdftoppm -r 150 -png "${tmpPath}" /tmp/sot_parse_page`, { stdio: "ignore" });
      const pageImg = glob.sync("/tmp/sot_parse_page-*.png")[0];
      if (pageImg) {
        execSync(`tesseract "${pageImg}" stdout -l eng --psm 6 2>/dev/null > /tmp/sot_ocr.txt`);
        text = fs.readFileSync("/tmp/sot_ocr.txt", "utf8");
      }
    } catch { text = "[OCR failed]"; }
  } else {
    try {
      execSync(`tesseract "${tmpPath}" stdout -l eng --psm 6 2>/dev/null > /tmp/sot_ocr.txt`);
      text = fs.readFileSync("/tmp/sot_ocr.txt", "utf8");
    } catch { text = "[OCR failed]"; }
  }
  try { fs.unlinkSync(tmpPath); } catch {}
  try { fs.unlinkSync("/tmp/sot_ocr.txt"); } catch {}
  try { glob.sync("/tmp/sot_parse_page-*.png").forEach((f: string) => fs.unlinkSync(f)); } catch {}
  return { text, parsed: parseSotText(text) };
}

async function parseFflFile(fileData: string, fileName: string): Promise<{ text: string; parsed: Record<string, string> }> {
  const buf = Buffer.from(fileData, "base64");
  const ext = (fileName || "").split(".").pop()?.toLowerCase() || "bin";
  const tmpPath = `/tmp/ffl_parse_${Date.now()}.${ext}`;
  fs.writeFileSync(tmpPath, buf);
  let text = "";
  if (ext === "pdf") {
    try {
      execSync(`pdftoppm -r 150 -png "${tmpPath}" /tmp/ffl_parse_page`, { stdio: "ignore" });
      const pageImg = glob.sync("/tmp/ffl_parse_page-*.png")[0];
      if (pageImg) {
        execSync(`tesseract "${pageImg}" stdout -l eng --psm 6 2>/dev/null > /tmp/ffl_ocr.txt`);
        text = fs.readFileSync("/tmp/ffl_ocr.txt", "utf8");
      }
    } catch { text = "[OCR failed]"; }
  } else {
    try {
      execSync(`tesseract "${tmpPath}" stdout -l eng --psm 6 2>/dev/null > /tmp/ffl_ocr.txt`);
      text = fs.readFileSync("/tmp/ffl_ocr.txt", "utf8");
    } catch { text = "[OCR failed]"; }
  }
  try { fs.unlinkSync(tmpPath); } catch {}
  try { fs.unlinkSync("/tmp/ffl_ocr.txt"); } catch {}
  try { glob.sync("/tmp/ffl_parse_page-*.png").forEach((f: string) => fs.unlinkSync(f)); } catch {}
  return { text, parsed: parseFflText(text) };
}

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

  app.patch("/api/admin/submissions/:id/ship", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { trackingNumber, atfFormName, atfFormData } = req.body || {};
      if (!trackingNumber?.trim()) {
        return res.status(400).json({ ok: false, error: "tracking_number_required" });
      }
      await pool.query(
        `UPDATE submissions SET tracking_number = $1, atf_form_name = $2, atf_form_data = $3, shipped_at = NOW()::text WHERE id = $4`,
        [trackingNumber.trim(), atfFormName || null, atfFormData || null, id]
      );
      return res.json({ ok: true });
    } catch (err: any) {
      console.error("ship_submission_error", err);
      return res.status(500).json({ ok: false, error: "failed_to_update" });
    }
  });

  // ── Dealers API ───────────────────────────────────────────────────────────

  // Public: Dealer map data (no PII — name, city, state, zip, tier, verified, email, phone)
  app.get("/api/dealers/map", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT id, business_name, city, state, zip, tier, verified, email, phone
        FROM dealers
        ORDER BY
          CASE WHEN tier = 'Preferred' THEN 0 ELSE 1 END,
          state, city
      `);
      return res.json({ ok: true, data: result.rows });
    } catch (err: any) {
      console.error("get_dealers_map_error", err);
      return res.status(500).json({ ok: false, error: "failed_to_fetch" });
    }
  });

  // List all dealers with order counts
  app.get("/api/admin/dealers", requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          d.*,
          COUNT(ds.id) AS order_count,
          COUNT(*) FILTER (WHERE ds.order_type = 'demo_order') AS demo_count,
          COUNT(*) FILTER (WHERE ds.order_type = 'retail_order') AS retail_count
        FROM dealers d
        LEFT JOIN dealer_submissions ds ON ds.dealer_id = d.id
        GROUP BY d.id
        ORDER BY d.created_at DESC
      `);
      return res.json({ ok: true, data: result.rows });
    } catch (err: any) {
      console.error("get_dealers_error", err);
      return res.status(500).json({ ok: false, error: "failed_to_fetch_dealers" });
    }
  });

  // Get single dealer with full submission history
  app.get("/api/admin/dealers/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const [dealer] = await pool.query(`SELECT * FROM dealers WHERE id = $1`, [id]);
      if (!dealer) return res.status(404).json({ ok: false, error: "dealer_not_found" });

      const subs = await pool.query(`
        SELECT s.*, ds.order_type, ds.quantity
        FROM dealer_submissions ds
        JOIN submissions s ON s.id = ds.submission_id
        WHERE ds.dealer_id = $1
        ORDER BY s.created_at DESC
      `, [id]);

      return res.json({ ok: true, data: { ...dealer, submissions: subs.rows } });
    } catch (err: any) {
      console.error("get_dealer_error", err);
      return res.status(500).json({ ok: false, error: "failed_to_fetch_dealer" });
    }
  });

  // Create a new dealer
  app.post("/api/admin/dealers", requireAdmin, async (req, res) => {
    try {
      const {
        businessName, ein, businessAddress, city, state, zip,
        contactName, email, phone,
        sotLicenseType, sotTaxYear, sotPeriodStart, sotPeriodEnd,
        sotControlNumber, sotReceiptDate,
        fflLicenseNumber, fflLicenseType, fflExpiry,
        taxExempt, taxExemptNotes, salesTaxId, notes
      } = req.body || {};

      if (!businessName || !email) {
        return res.status(400).json({ ok: false, error: "business_name_and_email_required" });
      }

      const result = await pool.query(`
        INSERT INTO dealers (
          business_name, ein, business_address, city, state, zip,
          contact_name, email, phone,
          sot_license_type, sot_tax_year, sot_period_start, sot_period_end,
          sot_control_number, sot_receipt_date,
          ffl_license_number, ffl_license_type, ffl_expiry,
          tax_exempt, tax_exempt_notes, sales_tax_id, notes
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
        RETURNING *
      `, [
        businessName, ein, businessAddress, city, state, zip,
        contactName, email, phone,
        sotLicenseType, sotTaxYear, sotPeriodStart, sotPeriodEnd,
        sotControlNumber, sotReceiptDate,
        fflLicenseNumber, fflLicenseType, fflExpiry,
        taxExempt || false, taxExemptNotes, salesTaxId, notes
      ]);

      return res.json({ ok: true, data: result.rows[0] });
    } catch (err: any) {
      console.error("create_dealer_error", err);
      return res.status(500).json({ ok: false, error: "failed_to_create_dealer" });
    }
  });

  // Update a dealer
  app.patch("/api/admin/dealers/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const allowed = [
        "businessName","ein","businessAddress","city","state","zip",
        "contactName","email","phone",
        "sotLicenseType","sotTaxYear","sotPeriodStart","sotPeriodEnd",
        "sotControlNumber","sotReceiptDate",
        "sotFileName","sotFileData",
        "fflLicenseNumber","fflLicenseType","fflExpiry",
        "fflFileName","fflFileData",
        "taxExempt","taxExemptNotes","salesTaxId",
        "salesTaxFormData","salesTaxFormName",
        "notes",
        "purchased","lastOrderDate"
      ];
      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

      for (const key of allowed) {
        const snake = key.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
        if (req.body[key] !== undefined) {
          updates.push(`${snake} = $${idx}`);
          values.push(req.body[key]);
          idx++;
        }
      }

      if (updates.length === 0) {
        return res.status(400).json({ ok: false, error: "no_fields_to_update" });
      }
      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const result = await pool.query(
        `UPDATE dealers SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
        values
      );
      if (result.rows.length === 0) return res.status(404).json({ ok: false, error: "dealer_not_found" });
      return res.json({ ok: true, data: result.rows[0] });
    } catch (err: any) {
      console.error("update_dealer_error", err);
      return res.status(500).json({ ok: false, error: "failed_to_update_dealer" });
    }
  });

  // Delete a dealer
  app.delete("/api/admin/dealers/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query(`DELETE FROM dealers WHERE id = $1`, [id]);
      return res.json({ ok: true });
    } catch (err: any) {
      console.error("delete_dealer_error", err);
      return res.status(500).json({ ok: false, error: "failed_to_delete_dealer" });
    }
  });

  // Parse SOT file — extract text from PDF/image and return structured data
  app.post("/api/admin/dealers/parse-sot", requireAdmin, async (req, res) => {
    try {
      const { sotFileData, sotFileName } = req.body || {};
      if (!sotFileData) return res.status(400).json({ ok: false, error: "no_file_data" });
      const { text, parsed } = await parseSotFile(sotFileData, sotFileName || "");
      return res.json({ ok: true, data: { parsed, rawText: text.slice(0, 500) } });
    } catch (err: any) {
      console.error("parse_sot_error", err);
      return res.status(500).json({ ok: false, error: "parse_failed" });
    }
  });

  // Parse FFL file — extract text from PDF/image and return structured data
  app.post("/api/admin/dealers/parse-ffl", requireAdmin, async (req, res) => {
    try {
      const { fflFileData, fflFileName } = req.body || {};
      if (!fflFileData) return res.status(400).json({ ok: false, error: "no_file_data" });
      const { text, parsed } = await parseFflFile(fflFileData, fflFileName || "");
      return res.json({ ok: true, data: { parsed, rawText: text.slice(0, 500) } });
    } catch (err: any) {
      console.error("parse_ffl_error", err);
      return res.status(500).json({ ok: false, error: "parse_failed" });
    }
  });

  // Upload / update SOT file for a dealer — parse and auto-populate SOT fields
  app.post("/api/admin/dealers/:id/sot-file", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { sotFileName, sotFileData } = req.body || {};
      if (!sotFileData) return res.status(400).json({ ok: false, error: "no_file" });

      // Run OCR parsing in parallel with the file save
      const [parseResult] = await Promise.all([
        parseSotFile(sotFileData, sotFileName || "sot-file").catch(() => ({ text: "", parsed: {} })),
        pool.query(
          `UPDATE dealers SET sot_file_name = $1, sot_file_data = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
          [sotFileName || "sot-file", sotFileData, id]
        ),
      ]);

      const { parsed } = parseResult;
      if (Object.keys(parsed).length > 0) {
        const sets: string[] = [];
        const vals: any[] = [];
        let idx = 1;
        const fieldMap: Record<string, string> = {
          ein: "ein", sotLicenseType: "sot_license_type", sotTaxYear: "sot_tax_year",
          sotPeriodStart: "sot_period_start", sotPeriodEnd: "sot_period_end",
          sotReceiptDate: "sot_receipt_date", sotControlNumber: "sot_control_number",
          businessName: "business_name", businessAddress: "business_address",
          city: "city", state: "state", zip: "zip",
        };
        for (const [key, col] of Object.entries(fieldMap)) {
          if (parsed[key]) { sets.push(`${col} = $${idx++}`); vals.push(parsed[key]); }
        }
        // Mark verified=true when both FFL and SOT are on file
        const hasFfl = await pool.query(`SELECT ffl_file_name FROM dealers WHERE id = $1 AND ffl_file_name IS NOT NULL`, [id]);
        if (hasFfl.rows.length > 0) { sets.push(`verified = true`); }
        if (sets.length > 0) {
          vals.push(id);
          await pool.query(`UPDATE dealers SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx}`, vals);
        }
      }
      return res.json({ ok: true });
    } catch (err: any) {
      console.error("upload_sot_error", err);
      return res.status(500).json({ ok: false, error: "upload_failed" });
    }
  });

  // Upload / update FFL file for a dealer — parse and auto-populate FFL fields
  app.post("/api/admin/dealers/:id/ffl-file", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { fflFileName, fflFileData } = req.body || {};
      if (!fflFileData) return res.status(400).json({ ok: false, error: "no_file" });

      // Run OCR parsing in parallel with the file save
      const [parseResult] = await Promise.all([
        parseFflFile(fflFileData, fflFileName || "ffl-file").catch(() => ({ text: "", parsed: {} })),
        pool.query(
          `UPDATE dealers SET ffl_file_name = $1, ffl_file_data = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
          [fflFileName || "ffl-file", fflFileData, id]
        ),
      ]);

      const { parsed } = parseResult;
      if (Object.keys(parsed).length > 0) {
        const sets: string[] = [];
        const vals: any[] = [];
        let idx = 1;
        const fieldMap: Record<string, string> = {
          fflLicenseNumber: "ffl_license_number", fflLicenseType: "ffl_license_type",
          fflExpiry: "ffl_expiry", businessName: "business_name",
          city: "city", state: "state", zip: "zip",
        };
        for (const [key, col] of Object.entries(fieldMap)) {
          if (parsed[key]) { sets.push(`${col} = $${idx++}`); vals.push(parsed[key]); }
        }
        // Mark verified=true when both FFL and SOT are on file
        const hasSot = await pool.query(`SELECT sot_file_name FROM dealers WHERE id = $1 AND sot_file_name IS NOT NULL`, [id]);
        if (hasSot.rows.length > 0) { sets.push(`verified = true`); }
        if (sets.length > 0) {
          vals.push(id);
          await pool.query(`UPDATE dealers SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx}`, vals);
        }
      }
      return res.json({ ok: true });
    } catch (err: any) {
      console.error("upload_ffl_error", err);
      return res.status(500).json({ ok: false, error: "upload_failed" });
    }
  });

  // Upload sales tax exemption form for a dealer
  app.post("/api/admin/dealers/:id/sales-tax-form", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { salesTaxFormName, salesTaxFormData } = req.body || {};
      await pool.query(
        `UPDATE dealers SET sales_tax_form_name = $1, sales_tax_form_data = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
        [salesTaxFormName || null, salesTaxFormData || null, id]
      );
      return res.json({ ok: true });
    } catch (err: any) {
      console.error("upload_tax_form_error", err);
      return res.status(500).json({ ok: false, error: "upload_failed" });
    }
  });

  // Link existing unlinked dealer submissions
  app.post("/api/admin/dealers/link-submissions", requireAdmin, async (req, res) => {
    try {
      // Find all dealer submissions that have no dealer_id (unlinked)
      const unlinked = await pool.query(`
        SELECT s.id, s.business_name, s.email, s.quantity, s.has_ordered_demo, s.created_at
        FROM submissions s
        LEFT JOIN dealer_submissions ds ON ds.submission_id = s.id
        WHERE s.type = 'dealer' AND ds.id IS NULL
        ORDER BY s.created_at DESC
      `);

      let linked = 0;
      for (const sub of unlinked.rows) {
        // Find matching dealer by business name
        const dealer = await pool.query(
          `SELECT id FROM dealers WHERE business_name ILIKE $1 LIMIT 1`,
          [sub.business_name]
        );
        if (dealer.rows.length > 0) {
          const isDemo = sub.quantity === "1";
          const orderType = isDemo ? "demo_order" : (sub.quantity ? "retail_order" : "inquiry");
          await pool.query(
            `INSERT INTO dealer_submissions (dealer_id, submission_id, order_type, quantity) VALUES ($1,$2,$3,$4)`,
            [dealer.rows[0].id, sub.id, orderType, sub.quantity]
          );
          linked++;
        }
      }

      return res.json({ ok: true, data: { unlinked: unlinked.rows.length, linked } });
    } catch (err: any) {
      console.error("link_submissions_error", err);
      return res.status(500).json({ ok: false, error: "link_failed" });
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

      // All dealer orders must be qty 1 (demo) or multiple of 5
      if (!isInquiry && quantityCans && quantityCans !== '1' && Number(quantityCans) % 5 !== 0) {
        return res.status(400).json({
          ok: false,
          error: "invalid_quantity",
          message: "Dealer orders must be 1 (demo can) or a multiple of 5 (5, 10, 15, etc.).",
        });
      }
      // ───────────────────────────────────────────────────────────────
      // ───────────────────────────────────────────────────────────────

      // ── Auto-create or find dealer record ──────────────────────────
      let dealerId: string;
      const existingDealer = await pool.query(
        `SELECT id FROM dealers WHERE email = $1 LIMIT 1`,
        [email.toLowerCase()]
      );
      if (existingDealer.rows.length > 0) {
        dealerId = existingDealer.rows[0].id;
      } else {
        const newDealer = await pool.query(
          `INSERT INTO dealers (business_name, contact_name, email, phone, source, tier)
           VALUES ($1, $2, $3, $4, 'web_form', 'Standard')
           RETURNING id`,
          [businessName, contactName, email.toLowerCase(), phone || null]
        );
        dealerId = newDealer.rows[0].id;
      }

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

      // Link submission to the dealer via dealer_submissions
      const submissionId = dbResult?.id;
      if (submissionId && submissionId !== "unknown") {
        const orderType = isInquiry ? "inquiry" : isDemoOrder ? "demo_order" : "retail_order";
        await pool.query(
          `INSERT INTO dealer_submissions (dealer_id, submission_id, order_type, quantity)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [dealerId, submissionId, orderType, quantityCans ? String(quantityCans) : null]
        ).catch(err => console.error("dealer_submission_link_failed", err));
      }

      return res.json({ ok: true, id: submissionId || "unknown" });
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

  // ── Public: Submit retail inquiry ────────────────────────────────────────────
  app.post("/api/retail-inquiry", async (req, res) => {
    try {
      const { dealerId, contactName, email, phone, message } = req.body || {};
      if (!dealerId || !contactName || !email) {
        return res.status(400).json({ ok: false, error: "missing_required_fields" });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ ok: false, error: "invalid_email" });
      }

      const dealerCheck = await pool.query(`SELECT id, business_name FROM dealers WHERE id = $1`, [dealerId]);
      if (dealerCheck.rows.length === 0) {
        return res.status(404).json({ ok: false, error: "dealer_not_found" });
      }
      const dealer = dealerCheck.rows[0];

      const result = await pool.query(`
        INSERT INTO retail_inquiries (dealer_id, contact_name, email, phone, message)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [dealerId, contactName, email, phone || null, message || null]);

      // Fetch dealer's email address
      const dealerFull = await pool.query(`SELECT email FROM dealers WHERE id = $1`, [dealerId]);
      const dealerEmail = dealerFull.rows[0]?.email;

      // Send email to dealer (from dubdub22.com) if dealer has an email on file
      if (dealerEmail) {
        try {
          await sendViaGmail({
            to: dealerEmail,
            subject: `DubDub22 Customer Interest — ${dealer.business_name}`,
            text: [
              `A customer has expressed interest in the DubDub22 suppressor through your dealer page.`,
              ``,
              `Customer: ${contactName}`,
              `Email: ${email}`,
              phone ? `Phone: ${phone}` : null,
              ``,
              message ? `Message:\n${message}` : null,
              ``,
              `Login to the admin portal to follow up: https://portal.dubdub22.com/admin`,
            ].filter(Boolean).join("\n"),
            replyTo: email,
          });
        } catch (gmailErr) {
          console.error("retail_inquiry_gmail_error", gmailErr);
          // Don't fail the request if email fails — inquiry is already saved
        }
      }

      const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
      if (webhookUrl) {
        fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `📍 **New Retail Inquiry**`,
            embeds: [{
              title: `Inquiry re: ${dealer.business_name}`,
              color: 0xFF6600,
              fields: [
                { name: "Contact", value: contactName, inline: true },
                { name: "Email", value: email, inline: true },
                { name: "Phone", value: phone || "Not provided", inline: true },
                { name: "Dealer", value: dealer.business_name, inline: true },
                { name: "Message", value: message || "_No message_" },
              ],
              footer: { text: `Inquiry ID: ${result.rows[0].id}` },
            }]
          }),
        }).catch(() => {});
      }

      return res.json({ ok: true, id: result.rows[0].id });
    } catch (err: any) {
      console.error("retail_inquiry_error", err);
      return res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
