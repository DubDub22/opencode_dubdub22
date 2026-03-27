import type { Express } from "express";
import { createServer, type Server } from "http";
import fs from "fs";
import session from "express-session";
import { storage } from "./storage";

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
  // Trust proxy for secure cookies
  app.set('trust proxy', 1);

  // Setup simple session for admin
  app.use(session({
    secret: process.env.SESSION_SECRET || 'super-secret-dubdub-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production" }
  }));

  app.post("/api/admin/login", (req, res) => {
    const { password } = req.body;
    // Simple password check. In production, use env var.
    const adminPassword = process.env.ADMIN_PASSWORD || "dubdubadmin24";
    if (password === adminPassword) {
      (req.session as any).isAdmin = true;
      return res.json({ ok: true });
    }
    return res.status(401).json({ ok: false, error: "invalid_password" });
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

  app.post("/api/dealer-request", async (req, res) => {
    try {
      const { requestType, contactName, businessName, email, phone, quantityCans, fflFileName, fflFileData } = req.body || {};
      const isInquiry = requestType === 'Dealer Inquiry';

      // For orders, require contact/business/email/quantity; for inquiries just contact/business/email
      if (!contactName || !businessName || !email) {
        return res.status(400).json({ ok: false, error: "missing_required_fields" });
      }
      if (!isInquiry && !quantityCans) {
        return res.status(400).json({ ok: false, error: "missing_required_fields" });
      }

      const body = [
        `DubDub22 ${isInquiry ? 'Dealer Inquiry' : 'Dealer Order'}`,
        "",
        `Contact: ${contactName}`,
        `Business: ${businessName}`,
        `Email: ${email}`,
        `Phone: ${phone || "N/A"}`,
        isInquiry ? "" : `Quantity: ${quantityCans}`,
        isInquiry ? "" : `SOT File: ${fflFileName || "Not provided"}`,
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
          fflFileName: isInquiry ? null : fflFileName,
          fflFileData: isInquiry ? null : fflFileData,
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
