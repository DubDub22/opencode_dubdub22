/**
 * FastBound API client for DubDub22 suppressor dispositions.
 *
 * Docs: https://www.fastbound.com/faq/open-api/
 * Auth: HTTP Basic â€” API Key as username or password
 * Rate limit: 60 requests/min per API key
 *
 * Env vars:
 *   FASTBOUND_ACCOUNT  â€“ FastBound account number
 *   FASTBOUND_API_KEY  â€“ FastBound API key
 *   FASTBOUND_AUDIT_USER â€“ email of FastBound user for X-AuditUser header
 *   FASTBOUND_BASE_URL â€“ defaults to https://api.fastbound.com/api/v1
 */

import { pool } from "./db";
import { createHash } from "crypto";

const ACCOUNT = process.env.FASTBOUND_ACCOUNT;
const API_KEY = process.env.FASTBOUND_API_KEY;
const AUDIT_USER = process.env.FASTBOUND_AUDIT_USER;

const BASE =
  process.env.FASTBOUND_BASE_URL?.replace(/\/$/, "") ??
  `https://cloud.fastbound.com/${ACCOUNT}/api`;

/**
 * Manufacturer name in FastBound inventory.
 * Production: "DOUBLE TACTICAL" — your actual FFL business name
 * Sandbox:    "DubDub LLC"      — the name used on the test account
 * Set via FASTBOUND_MANUFACTURER env var or defaults to "DOUBLE TACTICAL".
 */
const MANUFACTURER = process.env.FASTBOUND_MANUFACTURER || "DOUBLE TACTICAL";

function authHeaders() {
  if (!ACCOUNT || !API_KEY) {
    throw new Error("FastBound credentials not configured (FASTBOUND_ACCOUNT / FASTBOUND_API_KEY)");
  }
  const b64 = Buffer.from(`${ACCOUNT}:${API_KEY}`).toString("base64");
  return {
    Authorization: `Basic ${b64}`,
    "Content-Type": "application/json",
    ...(AUDIT_USER ? { "X-AuditUser": AUDIT_USER } : {}),
  };
}

async function fbFetch(path: string, init?: RequestInit) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { ...authHeaders(), ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`FastBound ${res.status} ${path} – ${body}`);
  }
  const text = await res.text();
  if (!text?.trim()) return null; // sandbox sometimes returns 200 with empty body
  return JSON.parse(text);
}

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type FastBoundItem = {
  id?: string;               // FastBound item UUID (required for disposition items)
  serialNumber?: string;     // for display/search only
  make?: string;
  model?: string;
  caliber?: string;
  type?: string;
  acquisitionId?: string;
  price?: number;
};

export type FastBoundContact = {
  // FastBound FFL contact required fields
  fflNumber: string;
  fflExpires?: string; // YYYY-MM-DD
  licenseName?: string; // "TREVINO, THOMAS" (auto-populated by FastBound from FFL DB)
  tradeName?: string; // "DOUBLE T TACTICAL" (auto-populated by FastBound)
  // Premise address (required for all contact types)
  premiseAddress1: string;
  premiseCity: string;
  premiseState: string;
  premiseZipCode: string;
  premiseCountry?: string; // default "US"
  // Optional (NOT auto-populated by FastBound for FFL contacts)
  phone?: string;
  ein?: string; // EIN (not auto-populated)
  einType?: string; // "1 - Importer", "2 - Manufacturer", "3 - Dealer" (not auto-populated)
  email?: string; // stored in notes (FastBound FFL contacts don't have email field)
  // These are REJECTED for FFL contact type â€” do NOT send
  // firstName?: string;
  // lastName?: string;
  // organizationName?: string;
};

export type CreateDispositionResult = {
  id: string;
  status: string;
};

// â”€â”€ API Methods â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Create or update a FastBound FFL contact.
 * Returns the FastBound contact ID.
 */
export async function createOrUpdateContact(
  dealer: FastBoundContact,
): Promise<string> {
  // Try to find existing contact by FFL number
  if (dealer.fflNumber) {
    const existing = await findContactByFFL(dealer.fflNumber);
    if (existing) return existing;
  }

  // Create new FFL contact
  // FastBound auto-populates from FFL database when fflNumber is valid:
  //   - licenseName ("LAST, FIRST")
  //   - tradeName (business name)
  //   - premise address, city, state, zip, country
  //   - phone
  // DO NOT send firstName, lastName, or organizationName (FastBound rejects them for FFL)
  // DO send: fflExpires (required when fflNumber is present), licenseName (required)
  // DO send fields NOT auto-populated: ein, einType, email (in notes)

  const einTypeLabel: Record<string, string> = {
    "1": "Importer",
    "2": "Manufacturer", 
    "3": "Dealer",
  };

  // Format phone as (XXX) XXX-XXXX for FastBound
  const formattedPhone = dealer.phone
    ? dealer.phone.replace(/\D/g, "").replace(/^1?(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3")
    : undefined;

  const contact: any = {
    fflNumber: dealer.fflNumber,
    fflExpires: dealer.fflExpires || undefined,
    licenseName: dealer.licenseName || dealer.tradeName || undefined,
    tradeName: dealer.tradeName || undefined,
    premiseAddress1: dealer.premiseAddress1 || undefined,
    premiseCity: dealer.premiseCity || undefined,
    premiseState: dealer.premiseState || undefined,
    premiseZipCode: dealer.premiseZipCode || undefined,
    premiseCountry: dealer.premiseCountry || "US",
    // Tell FastBound to auto-populate from FFL EZ Check
    lookupFFL: true,
    // Custom fields NOT auto-populated by FFL lookup
    phoneNumber: formattedPhone || undefined,
    emailAddress: dealer.email || undefined,
    sotein: dealer.ein || undefined,
    sotClass: dealer.einType ? einTypeLabel[dealer.einType] || undefined : undefined,
  };

  // For Sole Proprietor: FastBound auto-populates licenseName as "LAST, FIRST"
  // For LLC: licenseName will be the LLC name, tradeName may be empty
  // We send both to ensure FastBound has the data (it will use auto-populated values if present)

  try {
    const res: any = await fbFetch("/contacts", {
      method: "POST",
      body: JSON.stringify(contact),
    });
    if (res?.id) return res.id;
    // Sandbox sometimes returns 200 with empty body — contact was created, find it
    if (dealer.fflNumber) {
      const refound = await findContactByFFL(dealer.fflNumber);
      if (refound) return refound;
    }
    throw new Error("FastBound contact creation returned empty response");
  } catch (err: any) {
    // If contact already exists, FastBound returns 400. Find it and return the ID.
    if (err.message?.includes("already exists") || err.message?.includes("400") || err.message?.includes("empty response")) {
      if (dealer.fflNumber) {
        const existing = await findContactByFFL(dealer.fflNumber);
        if (existing) return existing;
      }
      throw err; // re-throw if we still can't find it
    }
    throw err;
  }
}

/**
 * Create a pending disposition with dealer contact + items (serials).
 * Returns the disposition ID for later commit.
 *
 * FastBound flow:
 *   1. Create/get FFL contact
 *   2. Create pending disposition  â†’  POST /dispositions
 *   3. Attach contact                 â†’  POST /dispositions/{id}/contact
 *   4. Add items                   â†’  POST /dispositions/{id}/items
 */
export async function createPendingDisposition(
  dealer: FastBoundContact,
  items: FastBoundItem[],
  existingContactId?: string,
  opts?: { quantity?: number; orderNumber?: string; invoiceNumber?: string },
): Promise<CreateDispositionResult> {
  // Get FFL contact — use existing ID if available, otherwise find/create
  const contactId = existingContactId || await createOrUpdateContact(dealer);

  // Create fully-formed pending NFA disposition in ONE call
  const today = new Date().toISOString().slice(0, 10);
  const disp: any = await fbFetch("/Dispositions/CreateAsPending", {
    method: "POST",
    body: JSON.stringify({
      requestType: "NFA",
      date: today,
      submissionDate: today,
      type: "NFA/Form 3",
      contactId: contactId,
      items: items.map((item, idx) => ({
        id: item.id,
        price: item.price ?? (idx === 0 ? 60 : 0),
      })),
      externalId: opts?.orderNumber || undefined,
      purchaseOrderNumber: opts?.orderNumber || "",
      invoiceNumber: opts?.invoiceNumber || "",
      note: `DubDub22 — Order ${opts?.orderNumber || "N/A"} — ${opts?.quantity || items.length} suppressor(s) — FFL: ${dealer.fflNumber}`,
    }),
  });

  if (!disp?.id) throw new Error("No disposition ID returned from FastBound");
  console.log("[fb] CreateAsPending done:", disp.id, "items:", items.length);
  return { id: disp.id, status: "pending" };
}

/**
 * Upload a document (FFL, SOT, tax form) to a FastBound contact.
 * Accepts base64 data or Buffer.
 * Returns the attachment ID.
 */
export async function uploadContactDocument(
  contactId: string,
  fileName: string,
  fileData: string | Buffer, // base64 string or Buffer
  description?: string,
  isPublic = false,
): Promise<string> {
  // Convert base64 to Buffer if needed
  const buf = Buffer.isBuffer(fileData) ? fileData : Buffer.from(fileData, "base64");

  // Create multipart/form-data manually for Node.js
  const boundary = `----FormBoundary${Math.random().toString(16).slice(2)}`;
  const CRLF = "\r\n";
  const parts: Buffer[] = [];

  // File part
  parts.push(Buffer.from(`--${boundary}${CRLF}`));
  parts.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${fileName}"${CRLF}`));
  parts.push(Buffer.from(`Content-Type: application/octet-stream${CRLF}${CRLF}`));
  parts.push(buf);
  parts.push(Buffer.from(CRLF));

  // Description part
  if (description) {
    parts.push(Buffer.from(`--${boundary}${CRLF}`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="description"${CRLF}${CRLF}`));
    parts.push(Buffer.from(`${description}${CRLF}`));
  }

  // Public part
  if (isPublic) {
    parts.push(Buffer.from(`--${boundary}${CRLF}`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="public"${CRLF}${CRLF}`));
    parts.push(Buffer.from(`true${CRLF}`));
  }

  // Close boundary
  parts.push(Buffer.from(`--${boundary}--${CRLF}`));

  const body = Buffer.concat(parts);

  // Make request
  const headers = authHeaders();
  const res: any = await fbFetch(`/contacts/${contactId}/attachments`, {
    method: "POST",
    body: body,
    headers: {
      ...headers,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
  });

  return res.id;
}

/**
 * Upload dealer documents to FastBound contact.
 * Replaces SFTP uploads â€” documents stored per contact in FastBound.
 * Creates/gets FFL contact first, then uploads documents.
 */
export async function uploadDealerDocumentsToFastBound(
  fflNumber: string,
  documents: {
    fflFileData?: string;
    fflFileName?: string;
    sotFileData?: string;
    sotFileName?: string;
    resaleFileData?: string;
    resaleFileName?: string;
    taxFormFileData?: string;
    taxFormFileName?: string;
  }
): Promise<void> {
  try {
    // Create or get FFL contact in FastBound
    const contactId = await createOrUpdateContact({ fflNumber });

    // Upload each document
    const uploads: Promise<any>[] = [];

    if (documents.fflFileData && documents.fflFileName) {
      uploads.push(
        uploadContactDocument(contactId, documents.fflFileName, documents.fflFileData, "FFL License")
          .catch(err => console.error("fastbound_upload_ffl_error", err.message))
      );
    }

    if (documents.sotFileData && documents.sotFileName) {
      uploads.push(
        uploadContactDocument(contactId, documents.sotFileName, documents.sotFileData, "SOT License")
          .catch(err => console.error("fastbound_upload_sot_error", err.message))
      );
    }

    if (documents.resaleFileData && documents.resaleFileName) {
      uploads.push(
        uploadContactDocument(contactId, documents.resaleFileName, documents.resaleFileData, "Resale Certificate")
          .catch(err => console.error("fastbound_upload_resale_error", err.message))
      );
    }

    if (documents.taxFormFileData && documents.taxFormFileName) {
      uploads.push(
        uploadContactDocument(contactId, documents.taxFormFileName, documents.taxFormFileData, "Tax Form")
          .catch(err => console.error("fastbound_upload_taxform_error", err.message))
      );
    }

    await Promise.all(uploads);
    console.log(`[fastbound] Uploaded dealer documents for FFL ${fflNumber}`);
  } catch (err: any) {
    console.error("fastbound_upload_dealer_docs_error", err.message);
  }
}

/**
 * Commit a pending disposition after Form 3 is approved.
 * Pushes tracking number into the disposition before committing.
 */
export async function commitDisposition(
  dispositionId: string,
  trackingNumber: string,
): Promise<void> {
  // Update disposition with tracking via PUT
  await fbFetch(`/Dispositions/${dispositionId}`, {
    method: "PUT",
    body: JSON.stringify({
      shipmentTrackingNumber: trackingNumber,
      shippedDate: new Date().toISOString().slice(0, 10),
    }),
  });

  // Commit the disposition
  await fbFetch(`/Dispositions/${dispositionId}/Commit`, {
    method: "POST",
  });
}

/**
 * Look up a contact by FFL number (external ID or FFL field).
 * Returns FastBound contact ID if found.
 */
export async function findContactByFFL(fflNumber: string): Promise<string | null> {
  try {
    const res: any = await fbFetch(
      `/contacts?search=${encodeURIComponent(fflNumber)}&limit=5`,
    );
    const contacts = Array.isArray(res) ? res : res.data || res.contacts || [];
    console.log("[fb] findContactByFFL search for", fflNumber, "returned", contacts.length, "results");
    if (contacts.length > 0) {
      console.log("[fb] first 3 contact FFLs:", contacts.slice(0, 3).map((c: any) => ({
        id: c.id,
        fflNumber: c.fflNumber,
        externalId: c.externalId,
        tradeName: c.tradeName,
      })));
    }
    // Match with normalized FFL (strip all non-alphanumeric for comparison)
    const normalizedSearch = fflNumber.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
    const match = contacts.find(
      (c: any) => {
        const cFfl = (c.fflNumber || c.ffl || c.ffl_number || c.externalId || "").replace(/[^A-Za-z0-9]/g, "").toLowerCase();
        if (!cFfl) return false; // skip contacts with no FFL number
        return cFfl === normalizedSearch || cFfl.includes(normalizedSearch) || normalizedSearch.includes(cFfl);
      },
    );
    if (match) console.log("[fb] found match:", match.id, match.fflNumber || match.externalId);
    else console.log("[fb] no match found among", contacts.length, "contacts");
    return match?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Store the FastBound disposition ID on our submission row.
 */
export async function saveDispositionId(
  submissionId: string,
  dispositionId: string,
): Promise<void> {
  await pool.query(
    `UPDATE submissions SET fastbound_disposition_id = $1 WHERE id = $2`,
    [dispositionId, submissionId],
  );
}

/**
 * Retrieve the FastBound disposition ID for a submission.
 */
export async function getDispositionId(
  submissionId: string,
): Promise<string | null> {
  const res = await pool.query(
    `SELECT fastbound_disposition_id FROM submissions WHERE id = $1`,
    [submissionId],
  );
  return res.rows[0]?.fastbound_disposition_id ?? null;
}

/**
 * Search FastBound items in inventory (not disposed yet).
 * Filters by manufacturer "DOUBLE TACTICAL" and optionally model.
 * Limits results to quantity ordered.
 * Returns array of items with id, serialNumber, etc.
 */
export async function searchInventoryItems(params: {
  manufacturer?: string; // default "DOUBLE TACTICAL"
  model?: string;         // e.g. "DubDub22 Suppressor"
  limit?: number;        // max items to return (match order qty)
}): Promise<any[]> {
  const query = new URLSearchParams();
  // Always filter by your manufacturer to only show DubDub22 suppressors
  query.set("manufacturer", params.manufacturer || "DOUBLE TACTICAL");
  if (params.model) query.set("model", params.model);
  if (params.limit) query.set("limit", String(params.limit));
  query.set("openOnly", "true"); // Only open (not deleted) items

  const res: any = await fbFetch(`/Items?${query.toString()}`);
  const result = res?.data || (Array.isArray(res) ? res : res?.items || []);
  // Map FastBound's "serial" field to legacy "serialNumber" for existing code
  return (Array.isArray(result) ? result : []).map((i: any) => ({
    ...i,
    serialNumber: i.serialNumber || i.serial,
  }));
}

/**
 * List attachments for a FastBound contact.
 * Returns array of attachments with id, fileName, etc.
 */
export async function listContactAttachments(contactId: string): Promise<any[]> {
  const res: any = await fbFetch(`/contacts/${contactId}/attachments`);
  return res.data || res || [];
}

/**
 * Download a contact attachment from FastBound.
 * Returns the file as a Buffer (works in Node.js).
 */
export async function downloadContactAttachment(contactId: string, attachmentId: string): Promise<Buffer> {
  const url = `${BASE}/contacts/${contactId}/attachments/${attachmentId}`;
  const headers = authHeaders();
  delete headers["Content-Type"];

  const res = await fetch(url, {
    method: 'GET',
    headers,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`FastBound ${res.status} download attachment â€“ ${body}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Create a completed NFA transfer using the FastBound Transfer API (v1).
 * Call this AFTER ATF Form 3 is approved.
 *
 * One API call: disposition + contact + items + tracking.
 * Docs: https://github.com/FastBound/Support/tree/main/samples/transfers
 */
export async function createTransfer(options: {
  transferorFFL: string;
  transfereeFFL: string;
  items: Array<{
    manufacturer: string;
    model: string;
    caliber: string;
    type: string;
    serial: string;
  }>;
  trackingNumber?: string;
  note?: string;
  transfereeEmails?: string[];
}): Promise<{ idempotencyKey: string; statusCode: number }> {
  const { transferorFFL, transfereeFFL, items, trackingNumber, note, transfereeEmails = [] } = options;
  const today = new Date().toISOString().slice(0, 10);

  const idempotencyKey = createHash("sha256")
    .update([today, transferorFFL, transfereeFFL, trackingNumber || "", ...items.map(i => i.serial)].join("\n"))
    .digest("hex");

  const payload = {
    $schema: "https://schemas.fastbound.org/transfers-push-v1.json",
    idempotency_key: idempotencyKey,
    transferor: transferorFFL,
    transferee: transfereeFFL,
    transferee_emails: transfereeEmails,
    tracking_number: trackingNumber || null,
    acquire_type: "Purchase",
    note: note || `DubDub22 suppressor transfer — ${items.length} item(s)`,
    items: items.map(i => ({
      manufacturer: i.manufacturer,
      importer: null,
      country: "US",
      model: i.model,
      caliber: i.caliber,
      type: i.type,
      serial: i.serial,
      sku: null,
      mpn: "DubDub22",
      upc: null,
      barrelLength: null,
      overallLength: null,
      cost: 60,
      price: 60,
      condition: "New",
      note: null,
    })),
  };

  const url = `https://cloud.fastbound.com/${ACCOUNT}/api/transfers`;
  const res = await fetch(url, {
    method: "POST",
    headers: { ...authHeaders() },
    body: JSON.stringify(payload),
  });

  const body = await res.text();
  if (!res.ok) throw new Error(`FastBound Transfer ${res.status} — ${body}`);

  return { idempotencyKey, statusCode: res.status };
}
