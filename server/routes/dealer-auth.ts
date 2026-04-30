import type { Express, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { db, pool } from "../db";
import { dealers } from "@shared/dealers-schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TAX_FORM_PATH = path.resolve(__dirname, "..", "shared", "multi_state_tax_form.pdf");

declare module "express-session" {
  interface SessionData {
    dealerId?: string;
    dealerEmail?: string;
  }
}

export function requireDealerAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.dealerId) {
    return res.status(401).json({ ok: false, error: "authentication_required" });
  }
  next();
}

export function registerDealerAuthRoutes(app: Express) {
  // ── Register ─────────────────────────────────────────────────────────────
  app.post("/api/dealer/auth/register", async (req, res) => {
    try {
      const {
        email, password, businessName, contactName, phone,
        fflNumber, ein, einType, address, city, state, zip
      } = req.body || {};

      if (!email || !password || !businessName || !contactName || !fflNumber) {
        return res.status(400).json({ ok: false, error: "missing_required_fields" });
      }
      if (password.length < 8) {
        return res.status(400).json({ ok: false, error: "password_too_short", message: "Password must be at least 8 characters" });
      }
      if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
        return res.status(400).json({ ok: false, error: "invalid_email" });
      }

      // Check if email already registered
      const existing = await db.select({ id: dealers.id })
        .from(dealers)
        .where(eq(dealers.email, email.toLowerCase()))
        .limit(1);

      if (existing.length > 0) {
        return res.status(409).json({ ok: false, error: "email_already_registered", message: "This email is already registered. Please log in instead." });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const [dealer] = await db.insert(dealers).values({
        email: email.toLowerCase(),
        passwordHash,
        businessName,
        contactName,
        phone: phone || null,
        fflLicenseNumber: fflNumber,
        ein: ein || null,
        einType: einType || null,
        businessAddress: address || null,
        city: city || null,
        state: state || null,
        zip: zip || null,
        source: "dealer_registration",
        tier: "Standard",
      }).returning({ id: dealers.id });

      req.session!.dealerId = dealer.id;
      req.session!.dealerEmail = email.toLowerCase();

      return res.json({ ok: true, dealerId: dealer.id });
    } catch (err: any) {
      console.error("dealer_register_error", err);
      return res.status(500).json({ ok: false, error: "registration_failed" });
    }
  });

  // ── Login ────────────────────────────────────────────────────────────────
  app.post("/api/dealer/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ ok: false, error: "missing_credentials" });
      }

      const result = await db.select({
        id: dealers.id,
        email: dealers.email,
        passwordHash: dealers.passwordHash,
        businessName: dealers.businessName,
        verified: dealers.verified,
      })
        .from(dealers)
        .where(eq(dealers.email, email.toLowerCase()))
        .limit(1);

      if (result.length === 0) {
        return res.status(401).json({ ok: false, error: "invalid_credentials" });
      }

      const dealer = result[0];
      const valid = await bcrypt.compare(password, dealer.passwordHash || "");
      if (!valid) {
        return res.status(401).json({ ok: false, error: "invalid_credentials" });
      }

      // Update last login
      await db.update(dealers)
        .set({ lastLoginAt: new Date().toISOString() })
        .where(eq(dealers.id, dealer.id));

      req.session!.dealerId = dealer.id;
      req.session!.dealerEmail = dealer.email;

      return res.json({
        ok: true,
        dealer: {
          id: dealer.id,
          email: dealer.email,
          businessName: dealer.businessName,
        }
      });
    } catch (err: any) {
      console.error("dealer_login_error", err);
      return res.status(500).json({ ok: false, error: "login_failed" });
    }
  });

  // ── Get current dealer profile ───────────────────────────────────────────
  app.get("/api/dealer/auth/me", requireDealerAuth, async (req, res) => {
    try {
      const result = await db.select()
        .from(dealers)
        .where(eq(dealers.id, req.session!.dealerId!))
        .limit(1);

      if (result.length === 0) {
        return res.status(404).json({ ok: false, error: "dealer_not_found" });
      }

      const d = result[0];
      return res.json({
        ok: true,
        dealer: {
          id: d.id,
          email: d.email,
          businessName: d.businessName,
          contactName: d.contactName,
          phone: d.phone,
          fflLicenseNumber: d.fflLicenseNumber,
          fflExpiryDate: d.fflExpiryDate,
          fflOnFile: d.fflOnFile,
          sotOnFile: d.sotOnFile,
          taxFormOnFile: d.taxFormOnFile,
          ein: d.ein,
          einType: d.einType,
          businessAddress: d.businessAddress,
          city: d.city,
          state: d.state,
          zip: d.zip,
          tier: d.tier,
          verified: d.verified,
          sotExpiryDate: d.sotExpiryDate,
          hasDemoUnitShipped: d.hasDemoUnitShipped,
          lastLoginAt: d.lastLoginAt,
          createdAt: d.createdAt,
        }
      });
    } catch (err: any) {
      console.error("dealer_me_error", err);
      return res.status(500).json({ ok: false, error: "fetch_failed" });
    }
  });

  // ── Update dealer profile ────────────────────────────────────────────────
  app.put("/api/dealer/auth/profile", requireDealerAuth, async (req, res) => {
    try {
      const { contactName, phone, ein, einType, businessAddress, city, state, zip } = req.body || {};
      const updates: Record<string, any> = {};
      if (contactName !== undefined) updates.contactName = contactName;
      if (phone !== undefined) updates.phone = phone;
      if (ein !== undefined) updates.ein = ein;
      if (einType !== undefined) updates.einType = einType;
      if (businessAddress !== undefined) updates.businessAddress = businessAddress;
      if (city !== undefined) updates.city = city;
      if (state !== undefined) updates.state = state;
      if (zip !== undefined) updates.zip = zip;
      updates.updatedAt = new Date().toISOString();

      await db.update(dealers)
        .set(updates)
        .where(eq(dealers.id, req.session!.dealerId!));

      return res.json({ ok: true });
    } catch (err: any) {
      console.error("dealer_update_profile_error", err);
      return res.status(500).json({ ok: false, error: "update_failed" });
    }
  });

  // ── Change password ──────────────────────────────────────────────────────
  app.put("/api/dealer/auth/password", requireDealerAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body || {};
      if (!currentPassword || !newPassword || newPassword.length < 8) {
        return res.status(400).json({ ok: false, error: "invalid_password" });
      }

      const result = await db.select({ passwordHash: dealers.passwordHash })
        .from(dealers)
        .where(eq(dealers.id, req.session!.dealerId!))
        .limit(1);

      if (result.length === 0) {
        return res.status(404).json({ ok: false, error: "dealer_not_found" });
      }

      const valid = await bcrypt.compare(currentPassword, result[0].passwordHash || "");
      if (!valid) {
        return res.status(401).json({ ok: false, error: "invalid_current_password" });
      }

      const newHash = await bcrypt.hash(newPassword, 12);
      await db.update(dealers)
        .set({ passwordHash: newHash })
        .where(eq(dealers.id, req.session!.dealerId!));

      return res.json({ ok: true });
    } catch (err: any) {
      console.error("dealer_change_password_error", err);
      return res.status(500).json({ ok: false, error: "password_change_failed" });
    }
  });

  // ── Logout ───────────────────────────────────────────────────────────────
  app.post("/api/dealer/auth/logout", (req, res) => {
    req.session?.destroy(() => {});
    return res.json({ ok: true });
  });

  // ── Get dealer orders ────────────────────────────────────────────────────
  app.get("/api/dealer/orders", requireDealerAuth, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT s.id, s.type, s.quantity, s.description, s.created_at, s.tracking_number,
                s.shipped_at, s.paid_at, s.ffl_license_number, s.serial_number,
                ds.order_type
         FROM submissions s
         JOIN dealer_submissions ds ON ds.submission_id = s.id
         WHERE ds.dealer_id = $1
         ORDER BY s.created_at DESC
         LIMIT 50`,
        [req.session!.dealerId]
      );

      return res.json({ ok: true, orders: result.rows });
    } catch (err: any) {
      console.error("dealer_orders_error", err);
      return res.status(500).json({ ok: false, error: "fetch_failed" });
    }
  });

  // ── Upload dealer document (FFL, SOT, Tax) ───────────────────────────────
  app.post("/api/dealer/upload-document", requireDealerAuth, async (req, res) => {
    try {
      const { fileName, fileData, documentType } = req.body || {};
      if (!fileName || !fileData || !documentType) {
        return res.status(400).json({ ok: false, error: "missing_fields" });
      }
      if (!["ffl", "sot", "tax"].includes(documentType)) {
        return res.status(400).json({ ok: false, error: "invalid_document_type" });
      }

      const updates: Record<string, any> = {};
      if (documentType === "ffl") {
        updates.fflFileName = fileName;
        updates.fflFileData = fileData;
        updates.fflOnFile = true;
      } else if (documentType === "sot") {
        updates.sotFileName = fileName;
        updates.sotFileData = fileData;
        updates.sotOnFile = true;
      } else if (documentType === "tax") {
        updates.salesTaxFormName = fileName;
        updates.salesTaxFormData = fileData;
        updates.taxFormOnFile = true;
      }
      updates.updatedAt = new Date().toISOString();

      await db.update(dealers)
        .set(updates)
        .where(eq(dealers.id, req.session!.dealerId!));

      return res.json({ ok: true, documentType });
    } catch (err: any) {
      console.error("dealer_upload_document_error", err);
      return res.status(500).json({ ok: false, error: "upload_failed" });
    }
  });

  // ── Full registration (both steps at once) ──────────────────────────
  app.post("/api/dealer/register-full", async (req, res) => {
    try {
      const {
        fflNumber, companyName, licenseName, phone, address, city, state, zip,
        fflExpiry, ein, einType,
        fflFileName, fflFileData, sotFileName, sotFileData, fflHasSot,
        fieldsEdited, email, password,
        regType, businessDescription, stateTaxIds, signatureDataUrl,
        stateDocFileName, stateDocFileData,
      } = req.body || {};

      if (!companyName || !fflNumber || !state) {
        return res.status(400).json({ ok: false, error: "missing_required" });
      }

      // Auto-format EIN: "123456789" -> "12-3456789"
      const rawEin = (ein || "").replace(/[^0-9]/g, "");
      const formattedEin = rawEin.length === 9 ? rawEin.slice(0,2) + "-" + rawEin.slice(2) : (ein || null);

      // Auto-format state tax IDs (strip non-alphanumeric, apply state-specific patterns)
      const formatTaxId = (state: string, id: string): string => {
        const cleaned = id.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        // Texas format: 11 digits → X-XXXXX-XXXX-X
        if (state === "TX" && /^\d{11}$/.test(cleaned)) {
          return `${cleaned[0]}-${cleaned.slice(1,6)}-${cleaned.slice(6,10)}-${cleaned[10]}`;
        }
        // General: just return as entered (dealers know their state format)
        return id.trim();
      };
      const formattedTaxIds = (stateTaxIds || []).map((s: any) => ({
        state: s.state,
        taxId: formatTaxId(s.state, s.taxId || ""),
      }));

      // Hash password if provided
      let passwordHash = null;
      if (password && password.length >= 8) {
        passwordHash = await bcrypt.hash(password, 12);
      }

      // 1. Insert dealer record
      const [dealer] = await db.insert(dealers).values({
        businessName: companyName,
        contactName: licenseName || companyName,
        email: (email || "").toLowerCase() || null,
        passwordHash,
        phone: phone || null,
        fflLicenseNumber: fflNumber,
        fflExpiryDate: fflExpiry || null,
        ein: formattedEin,
        einType: einType || "3",
        businessAddress: address || null,
        city: city || null,
        state: state || null,
        zip: zip || null,
        fflFileName: fflFileName || null,
        fflFileData: fflFileData || null,
        fflOnFile: !!(fflFileData),
        sotFileName: sotFileName || null,
        sotFileData: sotFileData || null,
        sotOnFile: !!(sotFileData || fflHasSot),
        source: "dealer_registration",
        tier: "Standard",
        verified: false,
        notes: fieldsEdited?.length > 0 ? `EDITED_FIELDS: ${(fieldsEdited || []).join(", ")}` : null,
      } as any).returning({ id: dealers.id });

      const dealerId = dealer.id;

      // 2. Fill and store multi-state tax form
      let filledTaxFormBase64 = null;
      try {
        const pdfBytes = fs.readFileSync(TAX_FORM_PATH);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const form = pdfDoc.getForm();

        form.getTextField("Issued to Seller").setText("Double T Tactical");
        form.getTextField("Address").setText("105 Bear Trce, Floresville, TX 78114");
        form.getTextField("Name of Firm Buyer").setText(companyName || "");
        form.getTextField("Address_2").setText([address, city, state, zip].filter(Boolean).join(", "));

        const regLower = regType?.toLowerCase() || "";
        try { form.getCheckBox("Wholesaler")[regLower === "wholesaler" ? "check" : "uncheck"](); } catch {}
        try { form.getCheckBox("Retailer")[regLower === "retailer" ? "check" : "uncheck"](); } catch {}
        try { form.getCheckBox("Manufacturer")[regLower === "manufacturer" ? "check" : "uncheck"](); } catch {}
        if (!["wholesaler", "retailer", "manufacturer"].includes(regLower)) {
          try { form.getTextField("Other Specify").setText(regType || ""); } catch {}
        }

        form.getTextField("Description of Business").setText(businessDescription || "");
        try { form.getTextField("General description of tangible property or taxable services to be purchased from the Seller 1").setText("Suppressors"); } catch {}

        // Fill all state tax IDs
        const stateMap: Record<string, string> = {
          AL:"State Registration Sellers Permit or ID Number of PurchaserAL 1",MO:"State Registration Sellers Permit or ID Number of PurchaserMO 16",AR:"State Registration Sellers Permit or ID Number of PurchaserAR",NE:"State Registration Sellers Permit or ID Number of PurchaserNE 16",AZ:"State Registration Sellers Permit or ID Number of PurchaserAZ 2",NV:"State Registration Sellers Permit or ID Number of PurchaserNV",CA:"State Registration Sellers Permit or ID Number of PurchaserCA 3",NJ:"State Registration Sellers Permit or ID Number of PurchaserNJ",CO:"State Registration Sellers Permit or ID Number of PurchaserCO 4",NM:"State Registration Sellers Permit or ID Number of PurchaserNM 417",CT:"State Registration Sellers Permit or ID Number of PurchaserCT 5",NC:"State Registration Sellers Permit or ID Number of PurchaserNC 18",FL:"State Registration Sellers Permit or ID Number of PurchaserFL6",ND:"State Registration Sellers Permit or ID Number of PurchaserND",GA:"State Registration Sellers Permit or ID Number of PurchaserGA7",OH:"State Registration Sellers Permit or ID Number of PurchaserOH19",HI:"State Registration Sellers Permit or ID Number of PurchaserHI 48",OK:"State Registration Sellers Permit or ID Number of PurchaserOK 20",ID:"State Registration Sellers Permit or ID Number of PurchaserID",PA:"State Registration Sellers Permit or ID Number of PurchaserPA 21",IL:"State Registration Sellers Permit or ID Number of PurchaserIL 49",RI:"State Registration Sellers Permit or ID Number of PurchaserRI 22",IA:"State Registration Sellers Permit or ID Number of PurchaserIA",SC:"State Registration Sellers Permit or ID Number of PurchaserSC",KS:"State Registration Sellers Permit or ID Number of PurchaserKS",SD:"State Registration Sellers Permit or ID Number of PurchaserSD 23",KY:"State Registration Sellers Permit or ID Number of PurchaserKY10",TN:"State Registration Sellers Permit or ID Number of PurchaserTN",ME:"State Registration Sellers Permit or ID Number of PurchaserME 11",TX:"State Registration Sellers Permit or ID Number of PurchaserTX 24",MD:"State Registration Sellers Permit or ID Number of PurchaserMD 12",UT:"State Registration Sellers Permit or ID Number of PurchaserUT",MI:"State Registration Sellers Permit or ID Number of PurchaserMI 13",VT:"State Registration Sellers Permit or ID Number of PurchaserVT",MN:"State Registration Sellers Permit or ID Number of PurchaserMN 14",WA:"State Registration Sellers Permit or ID Number of PurchaserWA 25",WI:"State Registration Sellers Permit or ID Number of PurchaserWI 26",
        };
        if (stateTaxIds && Array.isArray(stateTaxIds)) {
          for (const entry of formattedTaxIds) {
            if (!entry.taxId || !entry.state) continue;
            const fieldName = stateMap[entry.state];
            if (fieldName) {
              try { form.getTextField(fieldName).setText(entry.taxId); } catch {}
            }
          }
        }

        // Fill signature, title, date, and notes
        const today = new Date().toISOString().slice(0, 10);
        const signerTitle = "Authorized Representative";
        try { form.getTextField("Title").setText(signerTitle); } catch {}
        try { form.getTextField("Date").setText(today); } catch {}
        try { form.getTextField("Notes").setText(`EIN: ${formattedEin || "N/A"} | Tax ID: ${formattedTaxIds.filter((s:any) => s.taxId.trim()).map((s:any) => `${s.state}:${s.taxId}`).join(", ") || "N/A"}`); } catch {}

        // Embed signature image
        if (signatureDataUrl) {
          try {
            const sigBytes = Buffer.from(signatureDataUrl.replace(/^data:image\/\w+;base64,/, ""), "base64");
            const sigImage = await pdfDoc.embedPng(sigBytes);
            const pages = pdfDoc.getPages();
            const page = pages[0]; // signature is on first page
            // Place signature image at the exact position of the "Authorized Signature" field
            page.drawImage(sigImage, {
              x: 242,
              y: 110,
              width: 279,
              height: 40,
            });
            // Clear the text field since we're placing an image instead
            try { form.getTextField("Authorized Signature").setText(""); } catch {}
            // Also set signature text as fallback
            try { form.getTextField("Authorized Signature").setText(licenseName || companyName || ""); } catch {}
          } catch (sigErr) {
            // Fallback: just set text
            try { form.getTextField("Authorized Signature").setText(licenseName || companyName || ""); } catch {}
          }
        } else {
          try { form.getTextField("Authorized Signature").setText(licenseName || companyName || ""); } catch {}
        }

        // Flatten the form so fields become non-editable
        form.flatten();

        // Remove extra pages (keep only page 1)
        while (pdfDoc.getPageCount() > 1) {
          pdfDoc.removePage(1);
        }

        const filledPdf = await pdfDoc.save();
        filledTaxFormBase64 = Buffer.from(filledPdf).toString("base64");
      } catch (e) {
        console.error("tax_form_fill_error", e);
      }

      // 3. Update dealer with filled tax form
      if (filledTaxFormBase64) {
        await db.update(dealers)
          .set({
            salesTaxFormName: `multi_state_tax_form_${companyName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
            salesTaxFormData: filledTaxFormBase64,
            taxFormOnFile: true,
          } as any)
          .where(eq(dealers.id, dealerId));
      }

      // 4. Store state-issued tax document
      if (stateDocFileData && stateDocFileName) {
        await pool.query(
          `INSERT INTO submissions (type, contact_name, email, ffl_file_name, ffl_file_data)
           VALUES ($1, $2, $3, $4, $5)`,
          ["tax_form_state", companyName, "registration@dubdub22.com", stateDocFileName, stateDocFileData]
        );
      }

      // 5. Create FastBound contact (non-blocking)
      try {
        const { createOrUpdateContact } = await import("../fastbound.js");
        await createOrUpdateContact({
          fflNumber: fflNumber,
          fflExpires: fflExpiry || undefined,
          licenseName: licenseName || companyName,
          tradeName: companyName,
          premiseAddress1: address || "",
          premiseCity: city || "",
          premiseState: state || "",
          premiseZipCode: zip || "",
          phone: phone || undefined,
          ein: formattedEin || undefined,
          einType: formattedEin ? (einType || undefined) : undefined,
          email: email || undefined,
        });
        console.log("fastbound_contact_created", { fflNumber, companyName });
      } catch (e) {
        console.error("fastbound_contact_create_error", e);
      }

      // 6. Send emails (non-blocking) — bundle all docs into one ZIP
      try {
        const { sendViaGmail } = await import("../routes.js");
        const archiver = (await import("archiver")).default;
        const dealerEmail = email || "";

        // Build ZIP with all documents
        let zipBase64: string | null = null;
        const zipFiles: { name: string; data: string | null }[] = [
          { name: `TaxForm_${companyName}.pdf`, data: filledTaxFormBase64 },
          { name: fflFileName || "FFL.pdf", data: fflFileData || null },
          { name: sotFileName || "SOT.pdf", data: sotFileData || null },
          { name: stateDocFileName || "StateTaxDoc.pdf", data: stateDocFileData || null },
        ];

        const validFiles = zipFiles.filter(f => f.data);
        console.log("zip_files", { total: zipFiles.length, valid: validFiles.length, names: validFiles.map(f => f.name) });
        if (validFiles.length > 0) {
          const archive = archiver("zip", { zlib: { level: 9 } });
          const chunks: Buffer[] = [];
          archive.on("data", (chunk: Buffer) => chunks.push(chunk));
          const zipPromise = new Promise<string>((resolve) => {
            archive.on("end", () => resolve(Buffer.concat(chunks).toString("base64")));
          });
          for (const f of validFiles) {
            archive.append(Buffer.from(f.data!, "base64"), { name: f.name.replace(/[^a-zA-Z0-9._-]/g, "_") });
          }
          archive.finalize();
          zipBase64 = await zipPromise;
        }

        // Email 1: Dealer gets ZIP with all docs
        if (dealerEmail && zipBase64) {
          sendViaGmail({
            to: dealerEmail,
            from: "docs@dubdub22.com",
            subject: "YOUR DUBDUB22 DEALER DOCUMENTS",
            text: `FOR YOUR RECORDS. All dealer registration documents for ${companyName} are attached as a ZIP file. Thank you, DubDub22`,
            attachment: {
              filename: `DubDub22_Dealer_Docs_${companyName.replace(/[^a-zA-Z0-9]/g, "_")}.zip`,
              base64Data: zipBase64,
              contentType: "application/zip",
            },
          }).then(() => console.log("dealer_zip_email_sent", dealerEmail))
            .catch((e: any) => console.error("dealer_zip_email_error", e));
        }

        // Email 2: docs@ gets ZIP with all docs + summary
        if (zipBase64) {
          sendViaGmail({
            to: "docs@dubdub22.com",
            from: "docs@dubdub22.com",
            subject: `DEALER DOC PACKAGE - ${companyName}`,
            text: `New dealer registration complete for ${companyName}.

FFL: ${fflNumber}
Contact: ${licenseName || companyName}
Email: ${dealerEmail}
Phone: ${phone || "N/A"}
Address: ${[address, city, state, zip].filter(Boolean).join(", ")}
EIN: ${formattedEin || "N/A"}

All documents attached as ZIP. Review in admin: https://dubdub22.com/admin`,
            attachment: {
              filename: `DubDub22_Dealer_Docs_${companyName.replace(/[^a-zA-Z0-9]/g, "_")}.zip`,
              base64Data: zipBase64,
              contentType: "application/zip",
            },
          }).catch((e: any) => console.error("docs_zip_email_error", e));
        }
      } catch (e) {
        console.error("register_email_setup_error", e);
      }

      return res.json({ ok: true, dealerId, fieldsEdited: fieldsEdited || [] });
    } catch (err: any) {
      console.error("dealer_register_full_error", err);
      return res.status(500).json({ ok: false, error: "registration_failed" });
    }
  });
}
