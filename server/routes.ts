import type { Express } from "express";
import { createServer, type Server } from "http";
import fs from "fs";
import { execSync } from "child_process";
import { globSync } from "glob";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { registerWildRoutes } from "./routes/wild.js";
import session from "express-session";
import { storage } from "./storage";
import { uploadDealerDocuments } from "./sftp-upload";
import { pool } from "./db";
import { loadFFLMaster, validateFFL } from "./ffl-master";

const SALES_EMAIL = "info@dubdub22.com";
const ORDER_EMAIL = "orders@dubdub22.com";
const WARRANTY_EMAIL = "warranty@dubdub22.com";
const CONTACT_EMAIL = "contact@dubdub22.com";
const INVOICE_EMAIL = "invoice@dubdub22.com";
const BCC_EMAIL = "info@dubdub22.com";
const GMAIL_TOKEN_PATH = "/home/dubdub/DubDub-Hub/gmail_token.json";
const ENV_PATH = "/home/dubdub/DubDub-Hub/.env";

// ─────────────────────────────────────────────────────────────────────────────
// Geocoding helper
// ─────────────────────────────────────────────────────────────────────────────

async function geocodeZip(zip: string): Promise<{ lat: number; lng: number; state?: string } | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!res.ok) return null;
    const data = await res.json() as any;
    const lat = parseFloat(data.places[0].latitude);
    const lng = parseFloat(data.places[0].longitude);
    const state = data.places[0]["state abbreviation"];
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng, state };
  } catch {
    return null;
  }
}

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
  cc,
  bcc,
  subject,
  text,
  replyTo,
  attachment,
}: {
  from: string;
  to: string;
  cc?: string;
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
  if (cc) headers.push(`Cc: ${cc}`);
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
  cc,
  bcc,
  subject,
  text,
  replyTo,
  attachment,
  from,
}: {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  text: string;
  replyTo?: string;
  attachment?: { filename: string; base64Data: string; contentType: string };
  from?: string;
}) {
  if (!fs.existsSync(GMAIL_TOKEN_PATH)) throw new Error("gmail_token_missing");
  const token = JSON.parse(fs.readFileSync(GMAIL_TOKEN_PATH, "utf8"));
  const refreshToken = token.refresh_token;
  if (!refreshToken) throw new Error("gmail_refresh_token_missing");

  const { clientId, clientSecret, sender } = getGmailConfig();
  if (!clientId || !clientSecret) throw new Error("gmail_client_config_missing");

  const accessToken = await refreshAccessToken(refreshToken, clientId, clientSecret);
  const raw = buildMime({
    from: from || `DubDub22 <info@dubdub22.com>`,
    to,
    cc,
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

// Load multi-state tax form PDF as base64 for auto-reply attachments
const MULTI_STATE_TAX_FORM_PATH = path.join(__dirname, "..", "shared", "multi_state_tax_form.pdf");
let multiStateTaxFormBase64: string | null = null;
try {
  multiStateTaxFormBase64 = fs.readFileSync(MULTI_STATE_TAX_FORM_PATH, "base64");
} catch {
  console.warn("multi_state_tax_form.pdf not found — tax form attachment will be skipped");
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Load FFL master list
  await loadFFLMaster();

  // Register "In The Wild" routes (YouTube + submission system)
  registerWildRoutes(app);

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
      const includeArchived = req.query.includeArchived === "true";
      const submissions = await storage.getSubmissions(includeArchived);
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

  app.patch("/api/admin/submissions/:id/archive", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.archiveSubmission(id);
      return res.json({ ok: true });
    } catch (err: any) {
      console.error("archive_submission_error", err);
      return res.status(500).json({ ok: false, error: "failed_to_archive" });
    }
  });

  app.patch("/api/admin/submissions/:id/unarchive", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.unarchiveSubmission(id);
      return res.json({ ok: true });
    } catch (err: any) {
      console.error("unarchive_submission_error", err);
      return res.status(500).json({ ok: false, error: "failed_to_unarchive" });
    }
  });

  app.patch("/api/admin/submissions/:id/ship", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { trackingNumber, atfFormName, atfFormData } = req.body || {};
      if (!trackingNumber?.trim()) {
        return res.status(400).json({ ok: false, error: "tracking_number_required" });
      }
      // Look up the submission first — if it's a demo (type=dealer, qty=1), lock the demo flag
      const sub = await pool.query(`SELECT ds.dealer_id, s.type, s.quantity FROM submissions s JOIN dealer_submissions ds ON ds.submission_id = s.id WHERE s.id = $1 LIMIT 1`, [id]);
      const dealerId = sub.rows[0]?.dealer_id;
      await pool.query(
        `UPDATE submissions SET tracking_number = $1, atf_form_name = $2, atf_form_data = $3, shipped_at = NOW()::text WHERE id = $4`,
        [trackingNumber.trim(), atfFormName || null, atfFormData || null, id]
      );
      if (dealerId) {
        await pool.query(`UPDATE dealers SET has_demo_unit_shipped = true WHERE id = $1`, [dealerId]);
      }
      return res.json({ ok: true });
    } catch (err: any) {
      console.error("ship_submission_error", err);
      return res.status(500).json({ ok: false, error: "failed_to_update" });
    }
  });

  // ── Dealers API ───────────────────────────────────────────────────────────

  // Public: Dealer map data (no PII — name, city, state, zip, tier, verified, phone)
  // Preferred dealers: show curated phone if submitted, else FFL voicePhone
  // Standard dealers: show FFL voicePhone
  app.get("/api/dealers/map", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT id, business_name, city, state, zip, tier, verified, phone, email, ffl_license_number
        FROM dealers
        ORDER BY
          CASE WHEN tier = 'Preferred' THEN 0 ELSE 1 END,
          state, city
      `);
      const data = result.rows.map(row => {
        const ffl = row.ffl_license_number ? validateFFL(row.ffl_license_number) : null;
        const voicePhone = ffl?.voicePhone || null;
        // Preferred dealers: curated phone takes priority; fall back to FFL voicePhone
        const displayPhone = row.tier === "Preferred" && row.phone ? row.phone : (row.phone || voicePhone);
        return { ...row, voicePhone, displayPhone };
      });
      return res.json({ ok: true, data });
    } catch (err: any) {
      console.error("get_dealers_map_error", err);
      return res.status(500).json({ ok: false, error: "failed_to_fetch" });
    }
  });

  // Public: Dealers near a zip code (lazy-load — only fetched on zip search)
  // GET /api/dealers/nearby?zip=XXXXX
  // Returns nearest 20 FFLs total, plus the nearest Preferred dealer separately
  app.get("/api/dealers/nearby", async (req, res) => {
    try {
      const zip = (req.query.zip as string || "").replace(/\D/g, "");
      if (zip.length !== 5) {
        return res.status(400).json({ ok: false, error: "invalid_zip" });
      }

      // Geocode the search zip
      const searchCoords = await geocodeZip(zip);
      if (!searchCoords) {
        return res.status(404).json({ ok: false, error: "zip_not_found" });
      }
      const { lat: lat1, lng: lng1 } = searchCoords;

      // Fetch all dealers that have coordinates in the same state as the search zip
      const searchState = searchCoords.state;
      const result = await pool.query(`
        SELECT id, business_name, city, state, zip, tier, verified, phone, email, lat, lng, ffl_license_number
        FROM dealers
        WHERE lat IS NOT NULL AND lng IS NOT NULL AND state = $1
      `, [searchState]);

      const R = 3958.8; // Earth radius in miles
      const DEG = Math.PI / 180;

      // Compute haversine distance for all dealers, enrich with phone
      const withDist = result.rows
        .map(row => {
          const dLat = ((row.lat as number) - lat1) * DEG;
          const dLng = ((row.lng as number) - lng1) * DEG;
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * DEG) * Math.cos((row.lat as number) * DEG) * Math.sin(dLng / 2) ** 2;
          const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const ffl = row.ffl_license_number ? validateFFL(row.ffl_license_number) : null;
          const voicePhone = ffl?.voicePhone || null;
          const displayPhone = row.tier === "Preferred" && row.phone ? row.phone : (row.phone || voicePhone);
          return { ...row, voicePhone, displayPhone, _dist: Math.round(dist * 10) / 10 };
        })
        .sort((a, b) => a._dist - b._dist);

      // Nearest 20 FFLs (all tiers)
      const nearest20 = withDist.slice(0, 20);

      // Nearest Preferred dealer — same state (all results already in-state from query)
      const nearestPreferred = withDist.find(d => d.tier === "Preferred") || null;

      return res.json({
        ok: true,
        searchZip: zip,
        searchCoords,
        dealers: nearest20,
        nearestPreferred,
      });
    } catch (err: any) {
      console.error("get_dealers_nearby_error", err);
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
          COUNT(*) FILTER (WHERE ds.order_type = 'dealer') AS dealer_order_count,
          d.demo_fulfilled_at
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
        "sotOnFile","sotExpiryDate",
        "fflLicenseNumber","fflLicenseType","fflExpiry",
        "fflFileName","fflFileData",
        "fflOnFile","fflExpiryDate",
        "fflLoaExpiry",
        "taxExempt","taxExemptNotes","salesTaxId",
        "salesTaxFormData","salesTaxFormName",
        "taxFormOnFile",
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

  // Serve master FFL CSV from disk (pre-cleaned, no banned states)
  app.get("/api/admin/dealers/export/master_ffl", requireAdmin, async (_req, res) => {
    const path = "/home/dubdub/DubDubSuppressor/ffl_master.csv";
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="ffl_master_2026-04-01.csv"`);
    return res.sendFile(path, (err) => {
      if (err) {
        console.error("master_ffl_export_error", err);
        res.status(500).json({ ok: false, error: "export_failed" });
      }
    });
  });

  app.get("/api/admin/dealers/export/ffl_zip_match", requireAdmin, async (_req, res) => {
    const path = "/home/dubdub/DubDubSuppressor/FFL_zip_match.csv";
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="FFL_zip_match.csv"`);
    return res.sendFile(path, (err) => {
      if (err) {
        console.error("ffl_zip_match_export_error", err);
        res.status(500).json({ ok: false, error: "export_failed" });
      }
    });
  });

  // Export non-ATF dealers by source as CSV
  app.get("/api/admin/dealers/export/:source", requireAdmin, async (req, res) => {
    try {
      const { source } = req.params;

      // Special case: compliance template file
      if (source === "compliance_template") {
        const fs = await import("fs");
        const path = await import("path");
        const filePath = path.join("/home/dubdub/DubDub-Hub", "compliance_pages_template.txt");
        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ ok: false, error: "File not found" });
        }
        const content = fs.readFileSync(filePath, "utf-8");
        res.setHeader("Content-Type", "text/plain");
        res.setHeader("Content-Disposition", "attachment; filename=\"compliance_pages_template.txt\"");
        return res.send(content);
      }

      const allowed = ["rebel_dealer_list", "web_form", "manual"];
      if (!allowed.includes(source)) {
        return res.status(400).json({ ok: false, error: "Invalid source. Use: rebel, web_form, manual" });
      }
      const result = await pool.query(
        `SELECT business_name, contact_name, email, phone, ein, business_address,
                city, state, zip, ffl_license_number, ffl_license_type, ffl_expiry,
                sot_license_type, sot_tax_year, sot_period_start, sot_period_end,
                sot_control_number, sot_receipt_date, tax_exempt, sales_tax_id,
                notes, tier, verified, created_at
         FROM dealers WHERE source = $1 ORDER BY business_name`,
        [source]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ ok: false, error: `No dealers found for source: ${source}` });
      }
      const cols = [
        "business_name","contact_name","email","phone","ein","business_address",
        "city","state","zip","ffl_license_number","ffl_license_type","ffl_expiry",
        "sot_license_type","sot_tax_year","sot_period_start","sot_period_end",
        "sot_control_number","sot_receipt_date","tax_exempt","sales_tax_id",
        "notes","tier","verified","created_at"
      ];
      const header = cols.join(",");
      const rows = result.rows.map((r: any) =>
        cols.map(c => {
          const val = r[c] ?? "";
          const str = String(val);
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(",")
      );
      const csv = [header, ...rows].join("\n");
      const label = source === "web_form" ? "web-form" : source;
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="dealers_${label}_${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.send(csv);
    } catch (err: any) {
      console.error("export_dealers_error", err);
      return res.status(500).json({ ok: false, error: "export_failed" });
    }
  });

  // List serial label runs
  app.get("/api/admin/label-runs", requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT id, start_serial, end_serial, filename, label_count, created_by, created_at FROM serial_label_runs ORDER BY created_at DESC LIMIT 50"
      );
      return res.json({ ok: true, data: result.rows });
    } catch (err: any) {
      console.error("label_runs_list_error", err);
      return res.status(500).json({ ok: false, error: "Failed to fetch label runs" });
    }
  });

  // Generate serial label PDF (roll strip, 2x2 labels)
  app.post("/api/admin/labels/generate", requireAdmin, async (req, res) => {
    try {
      const { startSerial, endSerial } = req.body || {};
      if (!startSerial || !endSerial) {
        return res.status(400).json({ ok: false, error: "startSerial and endSerial are required" });
      }
      const start = parseInt(startSerial, 10);
      const end = parseInt(endSerial, 10);
      if (isNaN(start) || isNaN(end) || start > end || end - start > 1000) {
        return res.status(400).json({ ok: false, error: "Invalid serial range (max 1000 labels at once)" });
      }
      const { execSync } = await import("child_process");
      const script = "/home/dubdub/DubDub-Hub/bot/services/label_generator.py";
      const output = execSync(`python3 ${script} ${start} ${end}`, { encoding: "utf-8" }).trim();
      const match = output.match(/Generated label strip: (.+)/);
      const pdfPath = match ? match[1] : null;
      if (!pdfPath) {
        return res.status(500).json({ ok: false, error: "Label generation failed", detail: output });
      }
      const filename = pdfPath.split("/").pop() || "";
      const labelCount = end - start + 1;
      await pool.query(
        "INSERT INTO serial_label_runs (start_serial, end_serial, filename, file_path, label_count) VALUES ($1, $2, $3, $4, $5)",
        [start, end, filename, pdfPath, labelCount]
      );
      return res.json({ ok: true, pdfPath, filename });
    } catch (err: any) {
      console.error("label_generate_error", err);
      return res.status(500).json({ ok: false, error: "Generation failed", detail: err.message });
    }
  });

  // Download a generated label PDF
  app.get("/api/admin/labels/download", requireAdmin, async (req, res) => {
    try {
      const { path: requestedPath } = req.query || {};
      if (!requestedPath || typeof requestedPath !== "string") {
        return res.status(400).json({ ok: false, error: "path is required" });
      }
      // Block path traversal and invalid filenames (allow pdf and png)
      if (requestedPath.includes("..") || !/^[a-zA-Z0-9_\-.]+\.(pdf|png)$/.test(requestedPath)) {
        return res.status(400).json({ ok: false, error: "Invalid filename" });
      }
      const labelPath = `/home/dubdub/DubDub-Hub/static/labels/${requestedPath}`;
      const fs = await import("fs");
      if (!fs.existsSync(labelPath)) {
        return res.status(404).json({ ok: false, error: "File not found" });
      }
      const isPng = requestedPath.endsWith(".png");
      res.setHeader("Content-Type", isPng ? "image/png" : "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${requestedPath}"`);
      return res.sendFile(labelPath);
    } catch (err: any) {
      console.error("label_download_error", err);
      return res.status(500).json({ ok: false, error: "Download failed" });
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
          `UPDATE dealers SET sot_file_name = $1, sot_file_data = $2, sot_on_file = true, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
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
          `UPDATE dealers SET ffl_file_name = $1, ffl_file_data = $2, ffl_on_file = true, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
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
        `UPDATE dealers SET sales_tax_form_name = $1, sales_tax_form_data = $2, tax_form_on_file = true, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
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
          const orderType = sub.quantity ? "dealer_order" : "inquiry";
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

  // ── FFL Validate ─────────────────────────────────────────────────────────────
  app.post("/api/ffl/validate", async (req, res) => {
    try {
      const { fflNumber } = req.body;
      if (!fflNumber) return res.status(400).json({ ok: false, error: "missing_ffl" });

      // Normalize FFL (remove dashes)
      const normalized = fflNumber.replace(/[^0-9A-Za-z]/gi, "").toUpperCase();

      // Check against verified dealers table first
      const dealer = await pool.query(
        `SELECT id, business_name, verified, ffl_license_number, ffl_expiry, contact_name, email, phone, ein
         FROM dealers WHERE UPPER(REPLACE(REPLACE(ffl_license_number, '-', ''), ' ', '')) = $1`,
        [normalized]
      );

      if (dealer.rows.length > 0 && dealer.rows[0].verified) {
        return res.json({
          ok: true,
          valid: true,
          dealerName: dealer.rows[0].business_name,
          fromDealersTable: true,
          fflLicenseNumber: dealer.rows[0].ffl_license_number,
          fflExpiry: dealer.rows[0].ffl_expiry,
          contactName: dealer.rows[0].contact_name,
          email: dealer.rows[0].email,
          phone: dealer.rows[0].phone,
          ein: dealer.rows[0].ein,
        });
      }

      // Check against MASTER FFL CSV
      const csvRecord = validateFFL(fflNumber);
      if (csvRecord) {
        return res.json({
          ok: true,
          valid: true,
          dealerName: csvRecord.businessName,
          fromMasterList: true,
          fflLicenseNumber: csvRecord.fflNumber,
          fflExpiry: csvRecord.expiry || "",
          email: csvRecord.email || "",
          phone: csvRecord.phone || "",
          fflRecord: csvRecord,
        });
      }

      // Not found — route to pending upload
      return res.json({ ok: true, valid: false });
    } catch (err: any) {
      console.error("ffl_validate_error", err);
      return res.status(500).json({ ok: false, error: "validation_failed" });
    }
  });

  // ── FFL Upload (pending dealer — text only, no file) ─────────────────────────
  app.post("/api/ffl/upload", async (req, res) => {
    try {
      const { fflNumber, dealerName, contactName, email, phone, address, city, state, zipCode, message } = req.body;
      if (!fflNumber) return res.status(400).json({ ok: false, error: "missing_ffl" });

      const normalized = fflNumber.replace(/[^0-9A-Za-z]/gi, "").toUpperCase();

      // Check if already in dealers table
      const existing = await pool.query(
        `SELECT id, business_name, contact_name, email, phone, business_address, city, state, zip FROM dealers WHERE UPPER(REPLACE(REPLACE(ffl_license_number, '-', ''), ' ', '')) = $1`,
        [normalized]
      );

      const isExisting = existing.rows.length > 0;

      if (isExisting) {
        // Update existing record with contact info (file fields left as-is)
        await pool.query(
          `UPDATE dealers SET business_name = COALESCE(NULLIF($1, ''), business_name), contact_name = COALESCE(NULLIF($2, ''), contact_name), email = COALESCE(NULLIF($3, ''), email), phone = COALESCE(NULLIF($4, ''), phone), business_address = COALESCE(NULLIF($5, ''), business_address), city = COALESCE(NULLIF($6, ''), city), state = COALESCE(NULLIF($7, ''), state), zip = COALESCE(NULLIF($8, ''), zip), notes = COALESCE(NULLIF($9, ''), notes) WHERE id = $10`,
          [dealerName, contactName, email, phone, address, city, state, zipCode, message, existing.rows[0].id]
        );
      } else {
        // Create a pending dealer entry
        await pool.query(
          `INSERT INTO dealers (business_name, ffl_license_number, contact_name, email, phone, business_address, city, state, zip, notes, verified, source)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, 'pending_upload')`,
          [dealerName || `Pending FFL ${normalized}`, normalized, contactName || null, email || null, phone || null, address || null, city || null, state || null, zipCode || null, message || null]
        );
      }

      // Send confirmation email to the dealer with the multi-state tax form attached
      if (email) {
        const taxFormPath = path.join(__dirname, "../shared/multi_state_tax_form.pdf");
        const taxFormBase64 = fs.existsSync(taxFormPath)
          ? fs.readFileSync(taxFormPath).toString("base64")
          : null;

        const emailText = `Thanks for submitting your dealer application to DubDub22. To complete your dealer profile, please email us:
- A copy of your FFL
- A copy of your SOT
- The completed multi-state tax form (attached)

We'll review your application and be in touch shortly.

DubDub22 Minions`;

        const emailOptions: {
          to: string;
          subject: string;
          text: string;
          attachment?: { filename: string; base64Data: string; contentType: string };
        } = {
          to: email,
          subject: "Your DubDub22 Dealer Application",
          text: emailText,
        };

        if (taxFormBase64) {
          emailOptions.attachment = {
            filename: "multi_state_tax_form.pdf",
            base64Data: taxFormBase64,
            contentType: "application/pdf",
          };
        }

        try {
          await sendViaGmail({ ...emailOptions, bcc: BCC_EMAIL });
        } catch (emailErr) {
          console.error("ffl_upload_confirmation_email_error", emailErr);
          // Don't fail the submission if the email fails
        }
      }

      return res.json({ ok: true, message: "FFL submitted for review" });
    } catch (err: any) {
      console.error("ffl_upload_error", err);
      return res.status(500).json({ ok: false, error: "upload_failed" });
    }
  });

  // Check if a dealer has a shipped demo order (for form pre-check)
  app.get("/api/dealer-request/demo-status", async (req, res) => {
    const { email } = req.query;
    if (!email || typeof email !== "string") {
      return res.json({ hasShippedDemo: false, demoFulfilledAt: null });
    }
    try {
      // Use demo_fulfilled_at on dealers table directly
      const dealer = await pool.query(
        `SELECT demo_fulfilled_at FROM dealers WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [email]
      );
      if (dealer.rows.length > 0 && dealer.rows[0].demo_fulfilled_at) {
        return res.json({ hasShippedDemo: true, demoFulfilledAt: dealer.rows[0].demo_fulfilled_at });
      }
      return res.json({ hasShippedDemo: false, demoFulfilledAt: null });
    } catch {
      return res.json({ hasShippedDemo: false, demoFulfilledAt: null });
    }
  });

  app.post("/api/dealer-request", async (req, res) => {
    try {
      const { requestType, dealerName, contactName, businessName, email, phone, quantityCans, fflFileName, fflFileData, sotFileName, sotFileData, message, orderKind, fflNumber, ein, resaleFileName, resaleFileData, taxFormFileName, taxFormFileData } = req.body || {};

      // Support new field names from dealer portal (dealerName/fflNumber) and legacy (businessName/fflType)
      const bizName = dealerName || businessName || "";
      const isInquiry = orderKind === "inquiry" || requestType === 'Dealer Inquiry';

      if (!contactName || !bizName || !email) {
        return res.status(400).json({ ok: false, error: "missing_required_fields" });
      }
      if (!isInquiry && !quantityCans) {
        return res.status(400).json({ ok: false, error: "missing_required_fields" });
      }

      const isDemoOrder = orderKind === "demo" || (!isInquiry && quantityCans === '1');
      const isStockingOrder = orderKind === "stocking" || (!isInquiry && quantityCans !== '1');

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
      let dealerFormStatus = { fflOnFile: false, sotOnFile: false, taxFormOnFile: false };
      const existingDealer = await pool.query(
        `SELECT id, ffl_on_file, sot_on_file, tax_form_on_file FROM dealers WHERE email = $1 LIMIT 1`,
        [email.toLowerCase()]
      );
      if (existingDealer.rows.length > 0) {
        dealerId = existingDealer.rows[0].id;
        dealerFormStatus = {
          fflOnFile: !!existingDealer.rows[0].ffl_on_file,
          sotOnFile: !!existingDealer.rows[0].sot_on_file,
          taxFormOnFile: !!existingDealer.rows[0].tax_form_on_file,
        };
        // Upgrade to Preferred tier on any submission
        await pool.query(
          `UPDATE dealers SET tier = 'Preferred', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tier = 'Standard'`,
          [dealerId]
        );
      } else {
        const newDealer = await pool.query(
          `INSERT INTO dealers (business_name, contact_name, email, phone, source, tier)
           VALUES ($1, $2, $3, $4, 'web_form', 'Preferred')
           RETURNING id`,
          [bizName, contactName, email.toLowerCase(), phone || null]
        );
        dealerId = newDealer.rows[0].id;
      }

      // DEBUG: disabled demo_ordered flag write — remove after debugging
      // if (isDemoOrder) {
      //   await pool.query(
      //     `UPDATE dealers SET demo_ordered = true WHERE id = $1`,
      //     [dealerId]
      //   );
      // }

      const body = [
        `DubDub22 ${isInquiry ? 'Dealer Inquiry' : isDemoOrder ? 'Dealer Order (DEMO CAN)' : 'Dealer Order'}`,
        "",
        `Contact: ${contactName}`,
        `Business: ${bizName}`,
        `Email: ${email}`,
        `Phone: ${phone || "N/A"}`,
        fflNumber ? `FFL: ${fflNumber}` : null,
        ein ? `EIN: ${ein}` : null,
        isInquiry ? "" : `Quantity: ${quantityCans}${isDemoOrder ? ' (DEMO CAN)' : isStockingOrder ? ' (STOCKING ORDER)' : ''}`,
        isInquiry ? "" : `FFL on File: ${fflFileName || "Not provided"}`,
        isInquiry ? "" : `SOT: ${sotFileName || "Not provided"}`,
        isInquiry ? "" : `Resale Certificate: ${resaleFileName || "Not provided"}`,
        isInquiry ? "" : `Multi-State Tax Form: ${taxFormFileName || "Not provided"}`,
        message ? `\nMessage:\n${message}` : "",
      ].filter(Boolean).join("\n");

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
          from: `DubDub22 Inquiries <inquiry@dubdub22.com>`,
          subject: `DubDub22 ${isInquiry ? 'Dealer Inquiry' : 'Dealer Order'} - ${bizName}`,
          text: body,
          replyTo: email,
          attachment: (fflFileData || sotFileData) && !isInquiry ? {
            filename: fflFileName || sotFileName || "document",
            base64Data: fflFileData || sotFileData || "",
            contentType: contentTypeMap[ext] || "application/octet-stream",
          } : undefined,
        }).catch(err => {
          console.error("gmail_failed", err);
          return null; // Don't fail the whole request
        }),
        storage.createSubmission({
          type: "dealer",
          contactName,
          businessName: bizName,
          email,
          phone,
          fflType: (req.body as any).fflType || null,
          quantity: quantityCans ? String(quantityCans) : null,
          description: message || null,
          fflFileName: isInquiry ? null : (fflFileName || null),
          fflFileData: isInquiry ? null : (fflFileData || null),
        }).catch(err => {
          console.error("db_save_failed", err);
          return null;
        })
      ]);

      // Link submission to the dealer via dealer_submissions
      const submissionId = dbResult?.id;
      if (submissionId && submissionId !== "unknown") {
        const orderType = isInquiry ? "inquiry" : "dealer_order";
        await pool.query(
          `INSERT INTO dealer_submissions (dealer_id, submission_id, order_type, quantity)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [dealerId, submissionId, orderType, quantityCans ? String(quantityCans) : null]
        ).catch(err => console.error("dealer_submission_link_failed", err));
      }

      // Upload documents to 3dprintmanager via SFTP (non-blocking)
      if (!isInquiry && fflNumber && (fflFileData || sotFileData)) {
        uploadDealerDocuments(fflNumber, { fflFileData, fflFileName, sotFileData, sotFileName, resaleFileData, resaleFileName, taxFormFileData, taxFormFileName }).catch(err =>
          console.error("sftp_upload_dealer_docs_error", err)
        );
      }

      // Build forms status paragraph for auto-reply
      const formsStatus: string[] = [];
      if (dealerFormStatus.fflOnFile) formsStatus.push("FFL on file ✓");
      if (dealerFormStatus.sotOnFile) formsStatus.push("SOT on file ✓");
      if (dealerFormStatus.taxFormOnFile) formsStatus.push("Tax form on file ✓");
      const missingForms: string[] = [];
      if (!dealerFormStatus.fflOnFile) missingForms.push("a current FFL");
      if (!dealerFormStatus.sotOnFile) missingForms.push("a current SOT");
      const taxFormInstruction = !dealerFormStatus.taxFormOnFile
        ? (multiStateTaxFormBase64
            ? "Please use the attached tax form for your resale tax exemption. If available, please also attach a copy of your state-issued sales and use tax permit."
            : "a completed multi-state tax form")
        : "";
      const formsParagraph = formsStatus.length > 0
        ? (missingForms.length > 0 || taxFormInstruction
            ? `We have your current ${formsStatus.join(", ")} on file.${missingForms.length > 0 ? ` Please send us ${missingForms.join(" and ")}.` : ""}${taxFormInstruction ? ` ${taxFormInstruction}` : ""}`
            : `We have all your current forms on file. Thank you!`)
        : (missingForms.length > 0 || taxFormInstruction
            ? `To complete your dealer profile, please send us ${missingForms.join(" and ")}.${taxFormInstruction ? ` ${taxFormInstruction}` : ""}`
            : "");

      // Send auto-reply to the dealer
      if (email) {
        try {
          const autoReplyLines = [
            `Thank you for ${isInquiry ? 'submitting a dealer inquiry' : 'placing a dealer order'} with DubDub22.`,
            ``,
            `We've received your ${isInquiry ? 'inquiry' : 'order'} and will be in touch soon.`,
            ``,
          ];
          if (formsParagraph) {
            autoReplyLines.push(formsParagraph, ``);
          }
          autoReplyLines.push(
            `If you have any questions, reach out to us at sales@dubdub22.com.`,
            ``,
            `Best regards,`,
            `DubDub22 Team`,
          );
          // Attach multi-state tax form if not on file
          const attachment = (!dealerFormStatus.taxFormOnFile && multiStateTaxFormBase64)
            ? { filename: "multi_state_tax_form.pdf", base64Data: multiStateTaxFormBase64, contentType: "application/pdf" }
            : undefined;
          await sendViaGmail({
            to: email,
            bcc: BCC_EMAIL,
            from: isInquiry ? `DubDub22 Inquiries <inquiry@dubdub22.com>` : `DubDub22 Orders <orders@dubdub22.com>`,
            subject: `We Received Your DubDub22 ${isInquiry ? 'Inquiry' : 'Order'}`,
            text: autoReplyLines.join("\n"),
            attachment,
          });
        } catch (gmailErr) {
          console.error("dealer_request_auto_reply_error", gmailErr);
        }
      }

      return res.json({ ok: true, id: submissionId || "unknown" });
    } catch (err: any) {
      console.error("dealer_request_error", err?.message || err);
      return res.status(500).json({ ok: false, error: err?.message || "dealer_save_failed" });
    }
  });

  app.post("/api/dealer-terms-accepted", async (req, res) => {
    try {
      const { dealerName, dealerEmail, dealerPhone, orderType, quantity, signatureName, signatureDate } = req.body || {};
      // Log the acceptance for now — no DB write needed yet
      console.log("Dealer terms accepted:", { dealerName, dealerEmail, orderType, quantity, signatureName, signatureDate });
      return res.json({ ok: true });
    } catch (err: any) {
      console.error("dealer_terms_accepted_error", err);
      return res.status(500).json({ ok: false, error: err?.message });
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
        // Email to Tom
        sendViaGmail({
          to: WARRANTY_EMAIL,
          bcc: BCC_EMAIL,
          subject: `DUBDUB22 WARRANTY - ${serialNumber}`,
          text: body,
          replyTo: email,
          from: "DubDub22 Warranty <warranty@dubdub22.com>",
        }).catch(err => {
          console.error("gmail_failed", err);
          return null;
        }),
        // Auto-reply to customer
        sendViaGmail({
          to: email,
          bcc: BCC_EMAIL,
          subject: `DUBDUB22 WARRANTY RECEIVED - ${serialNumber}`,
          text: [
            `Dear ${name},`,
            "",
            "We have received your warranty request.",
            "",
            `Serial Number: ${serialNumber}`,
            `Description: ${description}`,
            "",
            "Our team will review your submission and contact you within 1–2 business days.",
            "",
            "Thank you,",
            "DubDub22 / Double T Tactical",
          ].join("\n"),
          from: "DubDub22 Warranty <warranty@dubdub22.com>",
        }).catch(err => {
          console.error("warranty_auto_reply_failed", err);
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

  // ── Public: Dealer Order / Inquiry ──────────────────────────────────────────
  app.post("/api/retail-order", async (req, res) => {
    try {
      const {
        intent, contactName, email, phone,
        message, quantity, fflFileName, fflFileData,
        customerAddress, customerCity, customerState, customerZip
      } = req.body || {};

      if (!contactName || !email) {
        return res.status(400).json({ ok: false, error: "missing_required_fields" });
      }
      if (!phone) {
        return res.status(400).json({ ok: false, error: "phone_required" });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ ok: false, error: "invalid_email" });
      }

      const isInfo = intent === "info";
      const qty = isInfo ? null : quantity;

      // Validate quantity for order intents — must be 1 (demo) or multiple of 5
      if (!isInfo && qty) {
        const numQty = parseInt(qty, 10);
        if (isNaN(numQty) || numQty < 1 || numQty > 20 || (numQty !== 1 && numQty % 5 !== 0)) {
          return res.status(400).json({ ok: false, error: "invalid_quantity", message: "Quantity must be 1 (demo) or a multiple of 5." });
        }
      }

      // Route emails by intent: info → dealerinquiry@dubdub22.com, demo/order → orders@dubdub22.com
      const INQUIRY_EMAIL = "dealerinquiry@dubdub22.com";
      const emailTo = isInfo ? INQUIRY_EMAIL : ORDER_EMAIL;

      const subjectLine = isInfo
        ? "Dealer Inquiry"
        : `Dealer Order — ${qty} cans`;

      const bodyLines = [
        `DubDub22 ${subjectLine}`,
        "",
        `Contact: ${contactName}`,
        `Email: ${email}`,
        `Phone: ${phone}`,
        !isInfo && qty ? `Quantity: ${qty}` : null,
        message ? `\nMessage:\n${message}` : null,
        fflFileName && !isInfo ? `\nSOT File: ${fflFileName}` : null,
      ].filter(Boolean);

      const ext = (fflFileName || "").split(".").pop()?.toLowerCase() || "";
      const contentTypeMap: Record<string, string> = {
        pdf: "application/pdf",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
      };

      // Send email to the appropriate route
      await sendViaGmail({
        to: emailTo,
        bcc: BCC_EMAIL,
        from: isInfo ? `DubDub22 Inquiries <inquiry@dubdub22.com>` : `DubDub22 Orders <orders@dubdub22.com>`,
        subject: `DubDub22 ${subjectLine}`,
        text: bodyLines.join("\n"),
        replyTo: email,
        attachment: fflFileData && !isInfo ? {
          filename: fflFileName || "sot-file",
          base64Data: fflFileData,
          contentType: contentTypeMap[ext] || "application/octet-stream",
        } : undefined,
      }).catch(err => {
        console.error("retail_order_gmail_error", err);
        // Don't fail the whole request if email fails
      });

      // Insert into submissions table so it appears in the admin panel
      const orderType = isInfo ? "inquiry" : "dealer_order";
      const result = await pool.query(`
        INSERT INTO submissions (type, contact_name, email, phone, quantity, description, ffl_file_name, ffl_file_data, customer_address, customer_city, customer_state, customer_zip)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [orderType, contactName, email, phone, qty, message || null, fflFileName || null, fflFileData || null, customerAddress || null, customerCity || null, customerState || null, customerZip || null]);
      const newSub = result.rows[0];

      // Link to dealer via dealer_submissions if this email belongs to a known dealer
      try {
        const dealerLookup = await pool.query(
          `SELECT id FROM dealers WHERE email ILIKE $1 LIMIT 1`,
          [email]
        );
        if (dealerLookup.rows.length > 0) {
          await pool.query(
            `INSERT INTO dealer_submissions (dealer_id, submission_id, order_type, quantity)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT DO NOTHING`,
            [dealerLookup.rows[0].id, newSub.id, orderType, qty]
          );
        }
      } catch (linkErr) {
        console.error("dealer_submissions_link_error", linkErr);
        // Don't fail the request if linking fails
      }

      // Post Discord webhook
      const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
      if (webhookUrl) {
        fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: isInfo
              ? `💬 **New Dealer Inquiry — ${contactName}**`
              : `🛒 **New Dealer Order — ${contactName}**`,
            embeds: [{
              title: subjectLine,
              color: isInfo ? 0x666666 : 0xFF6600,
              fields: [
                { name: "Contact", value: contactName, inline: true },
                { name: "Email", value: email, inline: true },
                { name: "Phone", value: phone || "Not provided", inline: true },
                ...(qty ? [{ name: "Quantity", value: qty, inline: true }] : []),
                ...(message ? [{ name: "Message", value: message }] : []),
              ],
            }]
          }),
        }).catch(() => {});
      }

      return res.json({ ok: true, submissionId: newSub.id });
    } catch (err: any) {
      console.error("retail_order_error", err);
      return res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  // ── Public: Submit dealer inquiry ────────────────────────────────────────────
  app.post("/api/retail-inquiry", async (req, res) => {
    try {
      const { dealerId, contactName, email, phone, message } = req.body || {};
      if (!dealerId || !contactName) {
        return res.status(400).json({ ok: false, error: "missing_required_fields" });
      }
      if (!email && !phone) {
        return res.status(400).json({ ok: false, error: "email_or_phone_required" });
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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

      // Fetch dealer's full info for email and auto-reply
      const dealerFull = await pool.query(`SELECT business_name, business_address, city, state, zip, phone, email FROM dealers WHERE id = $1`, [dealerId]);
      const dealerInfo = dealerFull.rows[0];
      const dealerEmail = dealerInfo?.email;

      // Send email to dealer (from dubdub22.com) if dealer has an email on file
      if (dealerEmail) {
        try {
          await sendViaGmail({
            to: dealerEmail,
            from: `DubDub22 Inquiries <inquiry@dubdub22.com>`,
            subject: `DubDub22 Customer Interest - ${dealer.business_name}`,
            text: [
              `A customer has inquired about the DubDub22 suppressor through our web site and selected you as their preferred dealer. In order to help our dealers maximize profits, we don't cut you out of the sale. Our products are only available through dealers. Please visit us at dubdub22.com to order a demo unit or a stocking order for your store.`,
              ``,
              `--- Customer Information ---`,
              ``,
              `Customer: ${contactName}`,
              `Email: ${email}`,
              phone ? `Phone: ${phone}` : null,
              message ? `Message: ${message}` : null,
              ``,
              `Dealers Page: https://dubdub22.com/dealers`,
            ].filter(Boolean).join("\n"),
            replyTo: email,
          });
        } catch (gmailErr) {
          console.error("retail_inquiry_gmail_error", gmailErr);
          // Don't fail the request if email fails — inquiry is already saved
        }
      }

      // Send auto-reply to customer if they provided an email
      if (email) {
        try {
          const dealerAddress = [dealerInfo.business_address, dealerInfo.city, dealerInfo.state, dealerInfo.zip].filter(Boolean).join(", ");
          await sendViaGmail({
            to: email,
            from: `DubDub22 Inquiries <inquiry@dubdub22.com>`,
            subject: `We Received Your DubDub22 Inquiry`,
            text: [
              `Thank you for inquiring about the DubDub22 Suppressor. We appreciate you looking at our innovative product.`,
              ``,
              `We have forwarded your information to the Preferred Dealer you selected. If you don't hear from them, reach out in a few days. We can't control what SPAM filters do.`,
              ``,
              `--- Your Selected Dealer ---`,
              ``,
              `Name: ${dealerInfo.business_name}`,
              dealerAddress ? `Address: ${dealerAddress}` : null,
              dealerInfo.phone ? `Phone: ${dealerInfo.phone}` : null,
              dealerInfo.email ? `Email: ${dealerInfo.email}` : null,
              ``,
              `Best regards,`,
              `DubDub22 Minions`,
            ].filter(Boolean).join("\n"),
          });
        } catch (gmailErr) {
          console.error("retail_inquiry_auto_reply_error", gmailErr);
          // Don't fail the request if auto-reply fails
        }
      }

      // Send consolidated notification to DubDub22
      try {
        const dealerAddress = [dealerInfo.business_address, dealerInfo.city, dealerInfo.state, dealerInfo.zip].filter(Boolean).join(", ");
        await sendViaGmail({
          to: BCC_EMAIL,
          from: `DubDub22 Inquiries <inquiry@dubdub22.com>`,
          subject: `RETAIL LOCATOR INQUIRY`,
          text: [
            `--- Customer Information ---`,
            ``,
            `Name: ${contactName}`,
            `Email: ${email}`,
            phone ? `Phone: ${phone}` : null,
            message ? `Message: ${message}` : null,
            ``,
            `--- Selected Dealer ---`,
            ``,
            `Dealer: ${dealerInfo.business_name}`,
            dealerAddress ? `Address: ${dealerAddress}` : null,
            dealerInfo.phone ? `Phone: ${dealerInfo.phone}` : null,
            dealerInfo.email ? `Email: ${dealerInfo.email}` : null,
          ].filter(Boolean).join("\n"),
          replyTo: email,
        });
      } catch (gmailErr) {
        console.error("retail_inquiry_notification_error", gmailErr);
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

  // ── Admin: Dealer Inquiries ─────────────────────────────────────────
  app.get("/api/admin/retail-inquiries", requireAdmin, async (req, res) => {
    try {
      const { search, status } = req.query;
      let query = `SELECT ri.*,
        d.business_name as dealer_name,
        d.ffl_on_file as dealer_ffl_on_file,
        d.ffl_expiry_date as dealer_ffl_expiry,
        d.sot_on_file as dealer_sot_on_file,
        d.sot_expiry_date as dealer_sot_expiry,
        d.ffl_license_number as dealer_ffl_license_number
        FROM retail_inquiries ri
        LEFT JOIN dealers d ON ri.dealer_id = d.id
        WHERE 1=1`;
      const params: any[] = [];
      let idx = 1;

      if (status && status !== "all") {
        query += ` AND ri.status = $${idx++}`;
        params.push(status);
      }
      if (search) {
        query += ` AND (ri.contact_name ILIKE $${idx} OR ri.email ILIKE $${idx} OR ri.message ILIKE $${idx} OR d.business_name ILIKE $${idx})`;
        params.push(`%${search}%`);
        idx++;
      }
      query += ` ORDER BY ri.created_at DESC`;

      const result = await pool.query(query, params);
      return res.json({ ok: true, data: result.rows });
    } catch (err: any) {
      console.error("admin_retail_inquiries_error", err);
      return res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  // ── Admin: Warranty Requests ─────────────────────────────────────────
  app.get("/api/admin/warranty-requests", requireAdmin, async (req, res) => {
    try {
      const { search, status } = req.query;
      let query = `SELECT * FROM submissions WHERE type = 'warranty'`;
      const params: any[] = [];
      let idx = 1;

      if (status && status !== "all") {
        query += ` AND status = $${idx++}`;
        params.push(status);
      }
      if (search) {
        query += ` AND (contact_name ILIKE $${idx} OR email ILIKE $${idx} OR serial_number ILIKE $${idx} OR description ILIKE $${idx})`;
        params.push(`%${search}%`);
        idx++;
      }
      query += ` ORDER BY created_at DESC`;

      const result = await pool.query(query, params);
      return res.json({ ok: true, data: result.rows });
    } catch (err: any) {
      console.error("admin_warranty_requests_error", err);
      return res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  // ── Admin: Dealer Inquiries (submissions dealer leads only) ──
  app.get("/api/admin/dealer-inquiries", requireAdmin, async (req, res) => {
    try {
      const { search } = req.query;
      const params: any[] = [];
      let idx = 1;

      // Submissions: dealer leads (type=dealer) that are NOT linked to a dealer_submission
      // with order_type='dealer' or demo_order — those are actual orders, not inquiries.
      // We use dealer_submissions.order_type to distinguish: only show rows where there is
      // no linked dealer_submission, OR the linked order_type is 'inquiry'.
      // This prevents qty 5 stocking orders from appearing in the Dealer Inquiries tab.
      let query = `SELECT
        'submission' as source,
        s.id::text as id,
        s.contact_name,
        s.business_name,
        s.email,
        s.phone,
        NULL::text as message,
        s.created_at::timestamp as created_at,
        d.ffl_on_file as dealer_ffl_on_file,
        d.ffl_expiry_date as dealer_ffl_expiry,
        d.sot_on_file as dealer_sot_on_file,
        d.sot_expiry_date as dealer_sot_expiry,
        d.ffl_license_number as dealer_ffl_license_number
        FROM submissions s
        LEFT JOIN dealers d ON UPPER(REPLACE(REPLACE(d.ffl_license_number, '-', ''), ' ', '')) = UPPER(REPLACE(REPLACE(s.ffl_license_number, '-', ''), ' ', ''))
        LEFT JOIN dealer_submissions ds ON ds.submission_id = s.id
        WHERE s.type = 'dealer'
          AND (ds.id IS NULL OR ds.order_type = 'inquiry')`;
      if (search) {
        query += ` AND (s.contact_name ILIKE $${idx} OR s.business_name ILIKE $${idx} OR s.email ILIKE $${idx})`;
        params.push(`%${search}%`);
        idx++;
      }
      query += ` ORDER BY s.created_at DESC`;

      const result = await pool.query(query, params);
      return res.json({ ok: true, data: result.rows });
    } catch (err: any) {
      console.error("admin_dealer_inquiries_error", err);
      return res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  // Delete a dealer inquiry (supports both submission and retail_inquiry sources)
  app.delete("/api/admin/dealer-inquiries/:source/:id", requireAdmin, async (req, res) => {
    try {
      const { source, id } = req.params;
      if (source === "submission") {
        await pool.query(`DELETE FROM submissions WHERE id = $1`, [id]);
      } else if (source === "retail_inquiry") {
        await pool.query(`DELETE FROM retail_inquiries WHERE id = $1`, [id]);
      } else {
        return res.status(400).json({ ok: false, error: "invalid_source" });
      }
      return res.json({ ok: true });
    } catch (err: any) {
      console.error("delete_dealer_inquiry_error", err);
      return res.status(500).json({ ok: false, error: "failed_to_delete" });
    }
  });

  // ── Admin: Update Dealer Inquiry Status ───────────────────────────────
  app.patch("/api/admin/retail-inquiries/:id", requireAdmin, async (req, res) => {
    try {
      const { status, admin_notes } = req.body;
      const result = await pool.query(
        `UPDATE retail_inquiries SET status = COALESCE($1, status), admin_notes = COALESCE($2, admin_notes), updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *`,
        [status, admin_notes, req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ ok: false, error: "not_found" });
      return res.json({ ok: true, data: result.rows[0] });
    } catch (err: any) {
      console.error("admin_retail_inquiry_update_error", err);
      return res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  // ── Admin: Delete Retail Inquiry ──────────────────────────────────────
  app.delete("/api/admin/retail-inquiries/:id", requireAdmin, async (req, res) => {
    try {
      await pool.query(`DELETE FROM retail_inquiries WHERE id = $1`, [req.params.id]);
      return res.json({ ok: true });
    } catch (err: any) {
      console.error("admin_retail_inquiry_delete_error", err);
      return res.status(500).json({ ok: false, error: "failed_to_delete" });
    }
  });

  // ── Admin: Update Warranty Request Status ─────────────────────────────
  app.patch("/api/admin/warranty-requests/:id", requireAdmin, async (req, res) => {
    try {
      const { status, admin_notes } = req.body;
      const result = await pool.query(
        `UPDATE submissions SET status = COALESCE($1, status), admin_notes = COALESCE($2, admin_notes), updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND type = 'warranty' RETURNING *`,
        [status, admin_notes, req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ ok: false, error: "not_found" });
      return res.json({ ok: true, data: result.rows[0] });
    } catch (err: any) {
      console.error("admin_warranty_update_error", err);
      return res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // TAX FORM UPLOAD & REVIEW
  // ═══════════════════════════════════════════════════════════════════

  // Generate a tax form upload token and email the link to the dealer
  app.post("/api/tax-form/send-upload-link", requireAdmin, async (req, res) => {
    try {
      const { dealerId, submissionId, fflNumber } = req.body || {};
      if (!dealerId || !fflNumber) {
        return res.status(400).json({ ok: false, error: "dealer_id_and_ffl_required" });
      }

      // Look up dealer email
      const dealerResult = await pool.query(
        `SELECT email, business_name, contact_name FROM dealers WHERE id = $1`,
        [dealerId]
      );
      if (!dealerResult.rows.length) {
        return res.status(404).json({ ok: false, error: "dealer_not_found" });
      }
      const dealer = dealerResult.rows[0];

      // Check if a pending/uploaded record already exists for this dealer
      const existing = await pool.query(
        `SELECT id, token FROM dealer_tax_forms
         WHERE dealer_id = $1 AND status IN ('pending', 'uploaded')
         ORDER BY created_at DESC LIMIT 1`,
        [dealerId]
      );

      let token: string;
      if (existing.rows.length > 0) {
        token = existing.rows[0].token;
      } else {
        // Generate new token
        const tokenResult = await pool.query(
          `INSERT INTO dealer_tax_forms (dealer_id, submission_id, ffl_number, token, status)
           VALUES ($1, $2, $3, gen_random_uuid(), 'pending')
           RETURNING token`,
          [dealerId, submissionId || null, fflNumber]
        );
        token = tokenResult.rows[0].token;
      }

      const uploadUrl = `https://dubdub22.com/upload-tax-form?token=${token}`;

      // Send email to dealer
      await sendViaGmail({
        to: dealer.email,
        bcc: BCC_EMAIL,
        from: `DubDub22 Documents <orders@dubdub22.com>`,
        subject: `Action Required — DubDub22 Tax Form Upload`,
        text: [
          `Hi ${dealer.contact_name || dealer.business_name},`,
          ``,
          `We're ready to process your DubDub22 order and need a copy of your Multi-State Tax Form (or your Certificate of Resale).`,
          ``,
          `Please upload your completed form using the link below:`,
          ``,
          `${uploadUrl}`,
          ``,
          `If you have any questions, reach us at info@dubdub22.com.`,
          ``,
          `— DubDub22 Minions`,
        ].join("\n"),
        replyTo: SALES_EMAIL,
      });

      return res.json({ ok: true, token, uploadUrl });
    } catch (err: any) {
      console.error("tax_form_send_upload_link_error", err);
      return res.status(500).json({ ok: false, error: err?.message || "server_error" });
    }
  });

  // Public: Upload a tax form using a token (no auth required)
  app.post("/api/tax-form/upload", async (req, res) => {
    try {
      const { token, taxFormFileName, taxFormFileData } = req.body || {};
      if (!token || !taxFormFileName || !taxFormFileData) {
        return res.status(400).json({ ok: false, error: "missing_required_fields" });
      }

      // Validate token
      const tokenResult = await pool.query(
        `SELECT id, dealer_id, ffl_number, status FROM dealer_tax_forms WHERE token = $1`,
        [token]
      );
      if (!tokenResult.rows.length) {
        return res.status(404).json({ ok: false, error: "invalid_token" });
      }
      const record = tokenResult.rows[0];
      if (record.status === "accepted") {
        return res.status(400).json({ ok: false, error: "form_already_accepted" });
      }
      if (record.status === "uploaded") {
        // Allow re-upload — just overwrite
      }

      const ext = taxFormFileName.split(".").pop()?.toLowerCase() || "pdf";
      await pool.query(
        `UPDATE dealer_tax_forms
         SET file_name = $1, file_data = $2, status = 'uploaded', uploaded_at = NOW()
         WHERE token = $3`,
        [`${taxFormFileName.replace(/\.[^.]+$/, "")}_${Date.now()}.${ext}`, taxFormFileData, token]
      );

      // Update dealer's tax_form_status
      await pool.query(
        `UPDATE dealers SET tax_form_status = 'uploaded' WHERE id = $1`,
        [record.dealer_id]
      );

      return res.json({ ok: true, message: "Tax form uploaded successfully." });
    } catch (err: any) {
      console.error("tax_form_upload_error", err);
      return res.status(500).json({ ok: false, error: err?.message || "server_error" });
    }
  });

  // Admin: Get pending FFL uploads (dealers who submitted FFL/SOT for verification)
  app.get("/api/admin/verify-ffl", requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT id, business_name, contact_name, email, phone,
               ffl_license_number, ffl_file_name, ffl_file_data,
               sot_file_name, sot_file_data, verified, source,
               ffl_form_status, sot_form_status,
               created_at, updated_at
        FROM dealers
        WHERE ffl_file_data IS NOT NULL AND ffl_file_data != ''
           OR sot_file_data IS NOT NULL AND sot_file_data != ''
        ORDER BY updated_at DESC
      `);
      return res.json({ ok: true, data: result.rows });
    } catch (err: any) {
      console.error("admin_verify_ffl_error", err);
      return res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  // Admin: Approve FFL upload (mark verified, change source to web_form)
  app.post("/api/admin/verify-ffl/:id/approve", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const dealer = await pool.query(`SELECT * FROM dealers WHERE id = $1`, [id]);
      if (!dealer.rows.length) return res.status(404).json({ ok: false, error: "not_found" });
      const d = dealer.rows[0];

      await pool.query(
        `UPDATE dealers SET verified = true, source = 'web_form',
         ffl_form_status = 'accepted', sot_form_status = 'accepted'
         WHERE id = $1`,
        [id]
      );

      // Email Tom with all dealer data — from inquiry@dubdub22.com, subject "NEW DEALER VERIFICATION"
      const emailBody = [
        `NEW DEALER VERIFICATION — Approved`,
        ``,
        `Business Name: ${d.business_name || ''}`,
        `Contact Name: ${d.contact_name || ''}`,
        `Email: ${d.email || ''}`,
        `Phone: ${d.phone || ''}`,
        `FFL License: ${d.ffl_license_number || ''}`,
        `FFL Expiry: ${d.ffl_expiry || ''}`,
        `Business Address: ${d.business_address || ''}`,
        `City: ${d.city || ''}`,
        `State: ${d.state || ''}`,
        `Zip: ${d.zip || ''}`,
        `EIN: ${d.ein || ''}`,
        `Tier: ${d.tier || ''}`,
        `Verified: ${d.verified ? 'Yes' : 'No'}`,
        `Source: ${d.source || ''}`,
        ``,
        `Submitted at: ${d.created_at ? new Date(d.created_at).toLocaleString() : 'N/A'}`,
        `Approved at: ${new Date().toLocaleString()}`,
      ].join("\n");

      await sendViaGmail({
        to: process.env.ADMIN_EMAIL || "tom@dubdub22.com",
        from: `DubDub22 Inquiries <inquiry@dubdub22.com>`,
        subject: `NEW DEALER VERIFICATION`,
        text: emailBody,
      }).catch(err => {
        console.error("ffl_approve_notification_email_error", err);
      });

      return res.json({ ok: true });
    } catch (err: any) {
      console.error("admin_verify_ffl_approve_error", err);
      return res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  // Admin: Deny FFL upload (clear files, mark pending, send email)
  app.post("/api/admin/verify-ffl/:id/deny", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const dealer = await pool.query(`SELECT * FROM dealers WHERE id = $1`, [id]);
      if (!dealer.rows.length) return res.status(404).json({ ok: false, error: "not_found" });

      await pool.query(
        `UPDATE dealers SET
           ffl_file_data = NULL, ffl_file_name = NULL,
           sot_file_data = NULL, sot_file_name = NULL,
           ffl_form_status = 'denied', sot_form_status = 'denied'
         WHERE id = $1`,
        [id]
      );

      const emailText = `Your FFL/SOT submission has been reviewed and could not be verified at this time.
${reason ? `\nReason: ${reason}` : ""}
Please visit https://dubdub22.com/dealers to submit a new, valid FFL/SOT.
— DubDub22 Minions`;
      await sendViaGmail({
        to: dealer.rows[0].email,
        bcc: BCC_EMAIL,
        from: `DubDub22 Documents <orders@dubdub22.com>`,
        subject: `DubDub22 FFL/SOT Verification - Action Required`,
        text: emailText,
      });

      return res.json({ ok: true });
    } catch (err: any) {
      console.error("admin_verify_ffl_deny_error", err);
      return res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  // Admin: List all tax form records
  app.get("/api/admin/tax-forms", requireAdmin, async (req, res) => {
    try {
      const { status } = req.query;
      let query = `
        SELECT dtf.*, d.business_name as dealer_name, d.contact_name as dealer_contact,
               d.email as dealer_email, d.ffl_license_number, d.tax_form_status
        FROM dealer_tax_forms dtf
        JOIN dealers d ON dtf.dealer_id = d.id
        WHERE 1=1
      `;
      const params: any[] = [];
      if (status && status !== "all") {
        query += ` AND dtf.status = $1`;
        params.push(status);
      }
      query += ` ORDER BY dtf.created_at DESC`;
      const result = await pool.query(query, params);
      return res.json({ ok: true, data: result.rows });
    } catch (err: any) {
      console.error("admin_tax_forms_error", err);
      return res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  // Admin: Get single tax form record (includes file data)
  app.get("/api/admin/tax-forms/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        `SELECT dtf.*, d.business_name as dealer_name, d.contact_name as dealer_contact,
                d.email as dealer_email, d.ffl_license_number, d.tax_form_status
         FROM dealer_tax_forms dtf
         JOIN dealers d ON dtf.dealer_id = d.id
         WHERE dtf.id = $1`,
        [id]
      );
      if (!result.rows.length) return res.status(404).json({ ok: false, error: "not_found" });
      return res.json({ ok: true, data: result.rows[0] });
    } catch (err: any) {
      console.error("admin_tax_form_get_error", err);
      return res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  // Admin: Accept a tax form
  app.post("/api/admin/tax-forms/:id/accept", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      const recordResult = await pool.query(
        `SELECT dtf.*, d.ffl_license_number, d.tax_form_status
         FROM dealer_tax_forms dtf JOIN dealers d ON dtf.dealer_id = d.id
         WHERE dtf.id = $1`,
        [id]
      );
      if (!recordResult.rows.length) return res.status(404).json({ ok: false, error: "not_found" });
      const record = recordResult.rows[0];
      if (record.status === "accepted") {
        return res.status(400).json({ ok: false, error: "already_accepted" });
      }

      const ext = (record.file_name || "pdf").split(".").pop()?.toLowerCase() || "pdf";
      const fflDigits = (record.ffl_license_number || record.ffl_number || "").replace(/-/g, "");
      const remoteName = `Tax_${fflDigits}.${ext}`;
      const folderName = fflDigits; // matches fflToFolderName logic

      // Upload to 3dprintmanager via direct SFTP with correct naming
      if (record.file_data) {
        const { sftpUpload } = await import("./sftp-upload");
        const remotePath = `/home/dealer-uploader/dealer-docs/${folderName}/${remoteName}`;
        await sftpUpload(
          Buffer.from(record.file_data, "base64"),
          remotePath
        ).catch(err => {
          console.error("sftp_upload_tax_form_error", err);
          throw err;
        });
      }

      // Update status
      await pool.query(
        `UPDATE dealer_tax_forms SET status = 'accepted', reviewed_at = NOW() WHERE id = $1`,
        [id]
      );
      await pool.query(
        `UPDATE dealers SET tax_form_status = 'accepted' WHERE id = $1`,
        [record.dealer_id]
      );

      // Post Discord notification
      const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
      if (webhookUrl) {
        fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `✅ **Tax Form Accepted** — ${record.dealer_name} (FFL: ${record.ffl_license_number || record.ffl_number})`,
            embeds: [{
              color: 0x22c55e,
              fields: [
                { name: "Dealer", value: record.dealer_name, inline: true },
                { name: "FFL", value: record.ffl_license_number || record.ffl_number || "—", inline: true },
                { name: "File", value: remoteName },
              ]
            }]
          }),
        }).catch(() => {});
      }

      return res.json({ ok: true });
    } catch (err: any) {
      console.error("tax_form_accept_error", err);
      return res.status(500).json({ ok: false, error: err?.message || "server_error" });
    }
  });

  // Admin: Deny a tax form
  app.post("/api/admin/tax-forms/:id/deny", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body || {};

      const recordResult = await pool.query(
        `SELECT dtf.*, d.business_name, d.contact_name, d.email, d.ffl_license_number
         FROM dealer_tax_forms dtf JOIN dealers d ON dtf.dealer_id = d.id
         WHERE dtf.id = $1`,
        [id]
      );
      if (!recordResult.rows.length) return res.status(404).json({ ok: false, error: "not_found" });
      const record = recordResult.rows[0];
      if (record.status === "accepted") {
        return res.status(400).json({ ok: false, error: "cannot_deny_accepted_form" });
      }

      // Generate a fresh upload token so dealer can re-upload
      const newTokenResult = await pool.query(
        `UPDATE dealer_tax_forms
         SET token = gen_random_uuid(), status = 'pending', denial_sent = true, denial_email_sent_at = NOW()
         WHERE id = $1
         RETURNING token`,
        [id]
      );
      const newToken = newTokenResult.rows[0].token;
      const uploadUrl = `https://dubdub22.com/upload-tax-form?token=${newToken}`;

      // Send denial email
      await sendViaGmail({
        to: record.email,
        bcc: BCC_EMAIL,
        from: `DubDub22 Documents <orders@dubdub22.com>`,
        subject: `Action Required — DubDub22 Tax Form Update`,
        text: [
          `Hi ${record.contact_name || record.business_name},`,
          ``,
          `Thanks for submitting your Multi-State Tax Form! We reviewed it and need a few changes before we can accept it.`,
          ``,
          reason ? `Reason: ${reason}` : null,
          ``,
          `Please review the form linked below and upload a corrected version. If you have questions, feel free to email us directly at info@dubdub22.com.`,
          ``,
          `${uploadUrl}`,
          ``,
          `— DubDub22 Minions`,
        ].filter(Boolean).join("\n"),
        replyTo: SALES_EMAIL,
      });

      await pool.query(
        `UPDATE dealers SET tax_form_status = 'denied' WHERE id = $1`,
        [record.dealer_id]
      );

      return res.json({ ok: true });
    } catch (err: any) {
      console.error("tax_form_deny_error", err);
      return res.status(500).json({ ok: false, error: err?.message || "server_error" });
    }
  });

  // ── Send Invoice ───────────────────────────────────────────────────────────
  app.post("/api/admin/send-invoice", requireAdmin, async (req, res) => {
    try {
      const {
        submissionId,
        customerName: inName,
        customerEmail: inEmail,
        customerPhone: inPhone,
        customerAddress: inAddress,
        customerCity: inCity,
        customerState: inState,
        customerZip: inZip,
        quantity: inQty,
        overrideUnitPrice,
      } = req.body || {};

      let customerName = inName;
      let customerEmail = inEmail;
      let customerPhone = inPhone;
      let customerAddress = inAddress;
      let customerCity = inCity;
      let customerState = inState;
      let customerZip = inZip;
      let quantity = inQty ?? 1;

      if (!customerName) {
        return res.status(400).json({ ok: false, error: "customer_name_required" });
      }

      // Look up submission if ID provided to determine type & pre-fill missing fields
      // Warranty orders are $129 + tax; all other orders (dealer/demo) are $60/unit with no tax
      let isWarranty = false;
      let subDealerId: string | null = null;
      if (submissionId) {
        const [subRow] = await pool.query(
          `SELECT s.*, ds.dealer_id FROM submissions s
           LEFT JOIN dealer_submissions ds ON ds.submission_id = s.id
           WHERE s.id = $1 LIMIT 1`,
          [submissionId]
        );
        if (subRow && subRow.rows.length > 0) {
          const sub = subRow.rows[0];
          isWarranty = sub.type === 'warranty';
          subDealerId = sub.dealer_id || null;
          // Pre-fill any missing fields from submission
          customerName = customerName || sub.contact_name || "";
          customerEmail = customerEmail || sub.email || "";
          customerPhone = customerPhone || sub.phone || "";
          customerAddress = customerAddress || sub.customer_address || "";
          customerCity = customerCity || sub.customer_city || "";
          customerState = customerState || sub.customer_state || "";
          customerZip = customerZip || sub.customer_zip || "";
          // Quantity: use override or fall back to submission quantity
          if (!quantity || quantity === 1) {
            quantity = sub.quantity ? parseInt(sub.quantity, 10) || 1 : 1;
          }
        }
      }

      const qty = Math.max(1, parseInt(String(quantity), 10) || 1);
      // Dealer orders = $60/unit, no tax; Warranty orders = $129/unit with 8.25% tax
      const unitPrice = overrideUnitPrice != null ? parseFloat(String(overrideUnitPrice)) : (isWarranty ? 129.0 : 60.0);
      const subtotal = qty * unitPrice;
      const taxRate = 0.0825;
      const taxAmount = isWarranty ? parseFloat((subtotal * taxRate).toFixed(2)) : 0.0;
      const total = subtotal + taxAmount;

      // Get next invoice number from shared counter
      const counterResult = await pool.query(
        `INSERT INTO invoice_counter (id, last_number) VALUES (1, COALESCE((SELECT last_number FROM invoice_counter WHERE id = 1), 0) + 1)
         ON CONFLICT (id) DO UPDATE SET last_number = invoice_counter.last_number + 1
         RETURNING last_number`
      );
      const invoiceNum = counterResult.rows[0].last_number;
      const invoiceNumber = `INV-${String(invoiceNum).padStart(4, "0")}`;

      // Generate PDF
      let pdfPath = null;
      try {
        const args = JSON.stringify({
          invoiceNumber,
          customerName: customerName || "",
          customerEmail: customerEmail || "",
          customerPhone: customerPhone || "",
          customerAddress: customerAddress || "",
          customerCity: customerCity || "",
          customerState: customerState || "",
          customerZip: customerZip || "",
          quantity: qty,
          unitPrice,
          subtotal,
          taxAmount,
          totalAmount: total,
          isWarranty,
        });
        const pdfOut = execSync(`/home/dubdub/DubDub-Hub/venv/bin/python -c "
import sys, json, os
sys.path.insert(0, '/home/dubdub/DubDub-Hub')
from bot.services.invoice_generator import generate_pdf
params = json.loads(sys.argv[1])
pdf_path = generate_pdf(**params)
print(pdf_path)
" '${args}'`, { encoding: "utf8" }).trim();
        if (pdfOut && fs.existsSync(pdfOut.trim())) {
          pdfPath = pdfOut.trim();
        }
      } catch (e) {
        console.warn("PDF generation failed, continuing without PDF:", e.message);
      }

      // Save invoice record
      const insertResult = await pool.query(
        `INSERT INTO invoices
           (invoice_number, dealer_id, submission_id, is_retail, retail_customer_name, retail_customer_email,
            retail_customer_phone, retail_customer_address, retail_customer_city,
            retail_customer_state, retail_customer_zip,
            quantity, unit_price, subtotal, tax_rate, tax_amount, total_amount, pdf_path, status, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'sent', NOW())
         RETURNING id`,
        [invoiceNumber, subDealerId || 0, submissionId || null, isWarranty,
         customerName, customerEmail || null, customerPhone || null,
         customerAddress || null, customerCity || null, customerState || null, customerZip || null,
         qty, unitPrice, subtotal, taxRate, taxAmount, total, pdfPath]
      );
      const invoiceId = insertResult.rows[0].id;

      // Build email body
      const lineDesc = isWarranty ? "DUBDUB22 SUPPRESSOR" : "DUBDUB22 SUPPRESSOR (Dealer)";
      const emailBody = [
        `INVOICE: ${invoiceNumber}`,
        ``,
        `Customer: ${customerName}`,
        customerEmail ? `Email: ${customerEmail}` : null,
        customerPhone ? `Phone: ${customerPhone}` : null,
        customerAddress ? `Address: ${customerAddress}` : null,
        [customerCity, customerState, customerZip].filter(Boolean).join(", ") || null,
        ``,
        `${qty} × ${lineDesc} @ $${unitPrice.toFixed(2)} = $${subtotal.toFixed(2)}`,
        isWarranty ? `Sales Tax (8.25%): $${taxAmount.toFixed(2)}` : null,
        ``,
        `TOTAL: $${total.toFixed(2)}`,
        ``,
        `— Thomas Trevino | Double T Tactical | 469-307-8001`,
      ].filter(Boolean).join("\n");

      const attachment = pdfPath
        ? { filename: `${invoiceNumber}.pdf`, base64Data: fs.readFileSync(pdfPath).toString("base64"), contentType: "application/pdf" }
        : undefined;

      const toEmail = customerEmail || "tomtrevino@doublettactical.com";
      await sendViaGmail({
        to: toEmail,
        bcc: BCC_EMAIL,
        from: `DubDub22 Orders <orders@dubdub22.com>`,
        subject: `INVOICE ${invoiceNumber} — DubDub22 Suppressor`,
        text: emailBody,
        attachment,
      });

      return res.json({ ok: true, invoiceNumber, invoiceId });
    } catch (err: any) {
      console.error("send_invoice_error", err);
      return res.status(500).json({ ok: false, error: err?.message || "server_error" });
    }
  });

  app.post("/api/contact", async (req, res) => {
    try {
      const { name, email, subject, message } = req.body || {};
      if (!name || !email || !subject || !message) {
        return res.status(400).json({ ok: false, error: "missing_required_fields" });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ ok: false, error: "invalid_email" });
      }

      const body = [
        `Name: ${name}`,
        `Email: ${email}`,
        `Subject: ${subject}`,
        ``,
        `Message:`,
        message,
      ].join("\n");

      // Send to Tom
      await sendViaGmail({
        to: CONTACT_EMAIL,
        bcc: BCC_EMAIL,
        subject: `CONTACT FORM — ${subject.toUpperCase()}`,
        text: body,
        replyTo: email,
      });

      // Auto-reply to the submitter
      await sendViaGmail({
        to: email,
        bcc: BCC_EMAIL,
        subject: `WE RECEIVED YOUR MESSAGE — ${subject.toUpperCase()}`,
        text: [
          `Hi ${name},`,
          ``,
          `Thanks for reaching out to DubDub22. We've received your message and will get back to you within 1–2 business days.`,
          ``,
          `Here's a copy of what you submitted:`,
          ``,
          `Subject: ${subject}`,
          `Message: ${message}`,
          ``,
          `Best regards,`,
          `DubDub22 Team`,
        ].join("\n"),
      });

      return res.json({ ok: true });
    } catch (err: any) {
      console.error("contact_api_error", err);
      return res.status(500).json({ ok: false, error: err?.message || "server_error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
