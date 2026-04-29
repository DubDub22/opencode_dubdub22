  // ── Form 3 Approved: Full workflow (Integrated) ────────────────────────────
  // 1. Create ShipStation label
  // 2. Commit FastBound disposition with tracking
  // 3. Generate invoice PDF with serial numbers + tracking
  // 4. Upload invoice to FastBound
  // 5. Email dealer with invoice + Form 3 PDF attached
  app.post("/api/admin/submissions/:id/form3-approved", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      // Get submission + dealer info
      const subResult = await pool.query(
        `SELECT s.*, d.business_name, d.contact_name, d.email, d.phone,
                d.business_address, d.city, d.state, d.zip, d.ffl_license_number
           FROM submissions s
           LEFT JOIN dealer_submissions ds ON ds.submission_id = s.id
           LEFT JOIN dealers d ON d.id = ds.dealer_id
          WHERE s.id = $1 LIMIT 1`,
        [id]
      );
      const sub = subResult.rows[0];
      if (!sub) return res.status(404).json({ ok: false, error: "Submission not found" });

      // 1. Create ShipStation label
      const labelRes = await fetch(`${req.protocol}://${req.get("host")}/api/admin/submissions/${id}/shipstation-label`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weightOz: 10, packageCode: "medium_flat_rate_box" }),
      });
      if (!labelRes.ok) throw new Error("ShipStation label creation failed");
      const label = await labelRes.json();

      // 2. Commit FastBound disposition with tracking
      const commitRes = await fetch(`${req.protocol}://${req.get("host")}/api/admin/submissions/${id}/fastbound-commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingNumber: label.trackingNumber }),
      });
      if (!commitRes.ok) throw new Error("FastBound commit failed");

      // 3. Generate invoice PDF with serial numbers + tracking
      const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([612, 792]); // Letter size
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const invoiceNum = `INV-${Date.now().toString().slice(-6)}`;

      // Header
      page.drawText("INVOICE", { x: 50, y: 720, size: 24, font: boldFont, color: rgb(0, 0, 0) });
      page.drawText(`Invoice #: ${invoiceNum}`, { x: 50, y: 690, size: 12, font, color: rgb(0, 0, 0) });
      page.drawText(`Date: ${new Date().toLocaleDateString()}`, { x: 50, y: 670, size: 12, font, color: rgb(0, 0, 0) });

      // Dealer info
      page.drawText("Bill To:", { x: 50, y: 630, size: 12, font: boldFont, color: rgb(0, 0, 0) });
      page.drawText(sub.business_name || sub.contact_name || "", { x: 50, y: 610, size: 11, font, color: rgb(0, 0, 0) });
      page.drawText(sub.business_address || "", { x: 50, y: 595, size: 11, font, color: rgb(0, 0, 0) });
      page.drawText(`${sub.city || ""}, ${sub.state || ""} ${sub.zip || ""}`, { x: 50, y: 580, size: 11, font, color: rgb(0, 0, 0) });

      // Serial numbers
      page.drawText("Serial Number(s):", { x: 50, y: 540, size: 12, font: boldFont, color: rgb(0, 0, 0) });
      const serials = (sub.serial_number || "").split(",").filter(Boolean);
      serials.forEach((sn: string, idx: number) => {
        page.drawText(sn.trim(), { x: 50, y: 520 - (idx * 15), size: 11, font, color: rgb(0, 0, 0) });
      });

      // Tracking
      page.drawText("Tracking Number:", { x: 50, y: 480, size: 12, font: boldFont, color: rgb(0, 0, 0) });
      page.drawText(label.trackingNumber, { x: 50, y: 460, size: 11, font, color: rgb(0, 0, 0) });
      page.drawText("Carrier: USPS Priority Mail", { x: 50, y: 445, size: 11, font, color: rgb(0, 0, 0) });

      // Items
      page.drawText("Item: DubDub22 Suppressor", { x: 50, y: 400, size: 11, font, color: rgb(0, 0, 0) });
      page.drawText(`Qty: ${sub.quantity || 1}`, { x: 50, y: 385, size: 11, font, color: rgb(0, 0, 0) });
      const price = sub.type === "demo_order" ? 0 : 725;
      page.drawText(`Price: $${price}.00`, { x: 50, y: 370, size: 11, font, color: rgb(0, 0, 0) });
      page.drawText(`Total: $${price * (sub.quantity || 1)}.00`, { x: 50, y: 350, size: 12, font: boldFont, color: rgb(0, 0, 0) });

      // Footer
      page.drawText("Thank you for your business!", { x: 50, y: 100, size: 11, font, color: rgb(0, 0, 0) });
      page.drawText("Double T Tactical / DubDub22", { x: 50, y: 85, size: 11, font, color: rgb(0, 0, 0) });

      const pdfBytes = await pdfDoc.save();
      const invoicePdfBase64 = Buffer.from(pdfBytes).toString("base64");

      // 4. Upload invoice to FastBound
      if (sub.ffl_license_number) {
        try {
          const contact = await findContactByFFL(sub.ffl_license_number);
          if (contact?.id) {
            await uploadDealerDocumentsToFastBound(contact.id, {
              taxFormFileData: invoicePdfBase64,
              taxFormFileName: `Invoice_${invoiceNum}.pdf`,
            });
          }
        } catch (fbErr) { console.error("invoice_fastbound_upload_error", fbErr); }
      }

      // 5. Email dealer with invoice PDF
      if (sub?.email) {
        try {
          const attachments = [
            { filename: `Invoice_${invoiceNum}.pdf`, base64Data: invoicePdfBase64, contentType: "application/pdf" },
          ];

          await sendViaGmail({
            to: sub.email,
            bcc: BCC_EMAIL,
            from: `DubDub22 Orders <orders@dubdub22.com>`,
            subject: `INVOICE & Shipping Confirmation - DubDub22 Suppressor`,
            text: [
              `Dear ${sub.contact_name || "Dealer"},`,
              ``,
              `Your DubDub22 suppressor order has been processed and is ready to ship!`,
              ``,
              `INVOICE ATTACHED: ${invoiceNum}`,
              `Tracking: ${label.trackingNumber}`,
              `Carrier: USPS Priority Mail`,
              ``,
              `Serial Number(s): ${sub.serial_number || "N/A"}`,
              ``,
              `Please retain this email and attachments for your records.`,
              ``,
              `- Double T Tactical / DubDub22`,
            ].join("\n"),
            attachments,
          });
        } catch (e) { console.error("form3_dealer_email_error", e); }
      }

      return res.json({ ok: true, trackingNumber: label.trackingNumber, labelPdfUrl: label.labelPdfUrl, invoiceNumber: invoiceNum });
    } catch (err: any) {
      console.error("form3_approved_error", err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
