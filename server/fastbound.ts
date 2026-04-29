/**
 * FastBound API client for DubDub22 suppressor dispositions.
 *
 * Docs: https://www.fastbound.com/faq/open-api/
 * Auth: HTTP Basic — API Key as username or password
 * Rate limit: 60 requests/min per API key
 *
 * Env vars:
 *   FASTBOUND_ACCOUNT  – FastBound account number
 *   FASTBOUND_API_KEY  – FastBound API key
 *   FASTBOUND_AUDIT_USER – email of FastBound user for X-AuditUser header
 *   FASTBOUND_BASE_URL – defaults to https://api.fastbound.com/api/v1
 */

import { pool } from "./db";

const BASE =
  process.env.FASTBOUND_BASE_URL?.replace(/\/$/, "") ??
  "https://api.fastbound.com/api/v1";

const ACCOUNT = process.env.FASTBOUND_ACCOUNT;
const API_KEY = process.env.FASTBOUND_API_KEY;
const AUDIT_USER = process.env.FASTBOUND_AUDIT_USER;

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
  return res.json();
}

// ── Types ────────────────────────────────────────────────────────────────────

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
  licenseName: string; // business name on FFL
  premiseAddress1: string;
  premiseCity: string;
  premiseState: string;
  premiseZipCode: string;
  premiseCountry?: string; // default "US"
  // SOT info
  sotLicenseType?: string; // "1 - Importer", "2 - Manufacturer", "3 - Dealer" (EIN Type)
  // Contact name (split for FFL contacts — FastBound doesn't allow contactName for FFL)
  firstName?: string;
  lastName?: string;
  // Optional
  phone?: string;
  ein?: string; // EIN from order form
  email?: string; // stored in notes (FastBound contacts don't have email field)
};

export type CreateDispositionResult = {
  id: string;
  status: string;
};

// ── API Methods ──────────────────────────────────────────────────────────────

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
  // Split contactName into firstName/lastName (FastBound FFL contacts don't allow full name)
  const nameParts = (dealer.contactName || "").split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || firstName;

  const contact: any = {
    fflNumber: dealer.fflNumber,
    fflExpires: dealer.fflExpires || undefined,
    licenseName: dealer.licenseName || dealer.premiseAddress1,
    premiseAddress1: dealer.premiseAddress1,
    premiseCity: dealer.premiseCity,
    premiseState: dealer.premiseState,
    premiseZipCode: dealer.premiseZipCode,
    premiseCountry: dealer.premiseCountry || "US",
    phone: dealer.phone,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    // EIN (FastBound stores as separate field on contact)
    ein: dealer.ein || undefined,
    // SOT License Type maps to FastBound's EIN Type field (1-Importer, 2-Manufacturer, 3-Dealer)
    ...(dealer.einType ? { einType: dealer.einType } : {}),
    // Email stored in notes (FastBound contacts don't have email field)
    ...(dealer.email ? { notes: `Email: ${dealer.email}` } : {}),
  };

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
 *   2. Create pending disposition  →  POST /dispositions
 *   3. Attach contact                 →  POST /dispositions/{id}/contact
 *   4. Add items                   →  POST /dispositions/{id}/items
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
  const disp: any = await fbFetch("/dispositions", {
    method: "POST",
    body: JSON.stringify({
      disposeDate: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
      disposeType: "Sold",
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

  // 4. Add items (serials) one by one
  for (const item of items) {
    await fbFetch(`/dispositions/${dispositionId}/items`, {
      method: "POST",
      body: JSON.stringify({
        serialNumber: item.serialNumber,
        make: item.make ?? "Double T Tactical",
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
  const blob = new Blob([buf], { type: "application/octet-stream" });

  const formData = new FormData();
  formData.append("file", blob, fileName);
  if (description) formData.append("description", description);
  if (isPublic) formData.append("public", "true");

  // Override content-type for multipart/form-data
  const headers: Record<string, string> = { ...authHeaders() };
  delete headers["Content-Type"]; // Let browser/Node set it with boundary

  const res: any = await fbFetch(`/contacts/${contactId}/attachments`, {
    method: "POST",
    body: formData,
    headers,
  });

  return res.id;
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
