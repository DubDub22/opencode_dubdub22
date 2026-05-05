/**
 * ShipStation V1 API client for DubDub22 label generation.
 *
 * Endpoint: POST /shipments/createlabel
 * Docs: https://www.shipstation.com/docs/api/shipments/create-label/
 * Auth: HTTP Basic — API Key + API Secret
 * Carrier: stamps_com (USPS)
 *
 * Env vars:
 *   SHIPSTATION_API_KEY
 *   SHIPSTATION_API_SECRET
 */

import { pool } from "./db";
import { todayCST } from "../shared/dates";

// ShipStation V1 requires shipDate in the future (PDT timezone).
// Add 1 day to CST date to avoid "date in past" errors near midnight.
function shipDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

const BASE = "https://ssapi.shipstation.com";

const API_KEY = process.env.SHIPSTATION_API_KEY;
const API_SECRET = process.env.SHIPSTATION_API_SECRET;

function authHeaders() {
  if (!API_KEY || !API_SECRET) {
    throw new Error(
      "ShipStation credentials not configured (SHIPSTATION_API_KEY / SHIPSTATION_API_SECRET)",
    );
  }
  const b64 = Buffer.from(`${API_KEY}:${API_SECRET}`).toString("base64");
  return {
    Authorization: `Basic ${b64}`,
    "Content-Type": "application/json",
  };
}

async function ssFetch(path: string, init?: RequestInit) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { ...authHeaders(), ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ShipStation ${res.status} ${path} – ${body}`);
  }
  return res.json();
}

// ── Types ─────────────────────────────────────────────────────────────────

export type CreateLabelResult = {
  shipmentId: number;
  trackingNumber: string;
  labelData: string;    // base64 PDF
  cost: number;
};

// ── Ship From (always Double T Tactical) ──────────────────────────────────

const SHIP_FROM = {
  name: "Thomas Trevino",
  company: "Double T Tactical",
  street1: "105 Bear Trce",
  city: "Floresville",
  state: "TX",
  postalCode: "78114",
  country: "US",
  phone: "469-307-8001",
  residential: false,
};

/**
 * Create a USPS shipping label.
 * For sandbox/testing, pass testLabel=true.
 */
export async function createLabel(
  shipTo: {
    name: string;
    company?: string;
    street1: string;
    city: string;
    state: string;
    postalCode: string;
    phone?: string;
  },
  weightOz: number = 10,
  opts?: { serviceCode?: string; packageCode?: string; testLabel?: boolean },
): Promise<CreateLabelResult> {
  const payload: Record<string, any> = {
    carrierCode: "stamps_com",
    serviceCode: opts?.serviceCode ?? "usps_priority_mail",
    packageCode: opts?.packageCode ?? "package",
    confirmation: "none",
    shipDate: shipDate(),
    weight: { value: weightOz, units: "ounces" },
    shipFrom: SHIP_FROM,
    shipTo: {
      name: shipTo.name,
      company: shipTo.company ?? shipTo.name,
      street1: shipTo.street1,
      city: shipTo.city,
      state: shipTo.state,
      postalCode: shipTo.postalCode,
      country: "US",
      phone: shipTo.phone ?? "",
      residential: true,
    },
    insuranceOptions: null,
    internationalOptions: null,
    advancedOptions: null,
  };

  if (opts?.testLabel) {
    payload.testLabel = true;
  }

  const res: any = await ssFetch("/shipments/createlabel", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return {
    shipmentId: res.shipmentId,
    trackingNumber: res.trackingNumber,
    labelData: res.labelData,
    cost: res.shipmentCost ?? 0,
  };
}

/**
 * Save label info to submission row.
 */
export async function saveLabelInfo(
  submissionId: string,
  label: CreateLabelResult,
): Promise<void> {
  await pool.query(
    `UPDATE submissions
        SET tracking_number = $1,
            shipstation_shipment_id = $2,
            shipped_at = NOW()::text
      WHERE id = $3`,
    [
      label.trackingNumber,
      String(label.shipmentId),
      submissionId,
    ],
  );
}

/**
 * Void a label (within 28 days, unused).
 */
export async function voidLabel(labelId: string): Promise<void> {
  await ssFetch(`/shipments/${labelId}/void`, { method: "POST" });
}
