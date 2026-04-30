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
    throw new Error(`FastBound ${res.status} ${path} â€“ ${body}`);
  }
  return res.json();
}

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type FastBoundItem = {
  serialNumber: string;
  make?: string;
  model?: string;
  caliber?: string;
  type?: string;           // "Suppressor"
  acquisitionId?: string;   // links to item already in inventory
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
    // These are NOT accepted by FastBound for FFL contacts via API:
    // phone and emailAddress are silently ignored. FastBound only
    // auto-populates phone through its FFL EZ Check button in the UI.
    // Email must be stored in the notes field.
    ...(dealer.email ? { notes: `Email: ${dealer.email} | Phone: ${dealer.phone || "N/A"}` } : {}),

  // For Sole Proprietor: FastBound auto-populates licenseName as "LAST, FIRST"
  // For LLC: licenseName will be the LLC name, tradeName may be empty
  // We send both to ensure FastBound has the data (it will use auto-populated values if present)

  const res: any = await fbFetch("/contacts", {
    method: "POST",
    body: JSON.stringify(contact),
  });

  return res.id;
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
): Promise<CreateDispositionResult> {
  // 1. Map SOT license type to FastBound's EIN Type (1=Importer, 2=Manufacturer, 3=Dealer)
  const einTypeMap: Record<string, string> = {
    "1": "1 - Importer",
    "2": "2 - Manufacturer",
    "3": "3 - Dealer",
  };
  if (dealer.einType && !dealer.einType.includes("-")) {
    dealer.einType = einTypeMap[dealer.einType] || dealer.einType;
  }

  // 2. Create or get FFL contact in FastBound
  const contactId = await createOrUpdateContact(dealer);

  // 2. Create empty pending disposition
  // For NFA items (suppressors): the sandbox may not have NFA endpoints enabled (405).
  // Production accounts with NFA items should use the NFA-specific endpoint.
  // Fallback: create a standard disposition with a descriptive note.
  const disp: any = await fbFetch("/dispositions", {
    method: "POST",
    body: JSON.stringify({
      date: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
      type: "NFA Disposition",
      note: `DubDub22 suppressor transfer - ${items.length} item(s)`,
    }),
  });

  const dispositionId = disp.id;
  if (!dispositionId) throw new Error("No disposition ID returned from FastBound");

  // 3. Attach dealer contact by ID
  await fbFetch(`/dispositions/${dispositionId}/contact`, {
    method: "POST",
    body: JSON.stringify({
      contactId: contactId,
    }),
  });

  // 4. Validate serials exist in FastBound inventory (only DubDub22 suppressors)
  const inventory = await searchInventoryItems({
    manufacturer: MANUFACTURER,
    model: "DubDub22", // only your suppressors
    limit: 1000,
  });
  const inventorySerials = new Set(inventory.map((i: any) => i.serialNumber));

  // 5. Add items (serials) one by one
  for (const item of items) {
    // Warn if serial not found in inventory (but still try to add)
    if (!inventorySerials.has(item.serialNumber)) {
      console.warn(`Serial ${item.serialNumber} not found in FastBound inventory`);
    }
    await fbFetch(`/dispositions/${dispositionId}/items`, {
      method: "POST",
      body: JSON.stringify({
        serialNumber: item.serialNumber,
        make: item.make ?? MANUFACTURER,
        model: item.model ?? "DubDub22 Suppressor",
        caliber: item.caliber ?? "Multi",
        type: item.type ?? "Suppressor",
        ...(item.acquisitionId ? { acquisitionId: item.acquisitionId } : {}),
      }),
    });
  }

  return { id: dispositionId, status: "pending" };
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
  // Add tracking to disposition (FastBound stores shipment info)
  await fbFetch(`/dispositions/${dispositionId}`, {
    method: "PATCH",
    body: JSON.stringify({
      trackingNumber,
      shippedDate: new Date().toISOString().slice(0, 10),
    }),
  });

  // Commit the disposition
  await fbFetch(`/dispositions/${dispositionId}/commit`, {
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
    const match = (res.data || res).find(
      (c: any) => c.fflNumber === fflNumber || c.ffl === fflNumber,
    );
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
  query.set("dispositionId", "null"); // Only items in inventory (not disposed)
  if (params.limit) query.set("limit", String(params.limit));
  query.set("openOnly", "true"); // Only open (not deleted) items

  const res: any = await fbFetch(`/items?${query.toString()}`);
  return res.data || res || [];
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
