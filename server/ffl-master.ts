import fs from "fs";
import path from "path";

import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.resolve(__dirname, "..", "ffl_master.csv");

function padLeft(str: string, len: number): string {
  return String(str).padStart(len, "0");
}

function parseFFLNumber(rec: Record<string, string>): string {
  // No padding — store FFL as-is from the source data
  const reg = rec.LIC_REGN.trim();
  const dist = rec.LIC_DIST.trim();
  const cnty = rec.LIC_CNTY.trim();
  const type = rec.LIC_TYPE.trim();
  const exp = rec.LIC_XPRDTE.trim().toUpperCase();
  const seq = rec.LIC_SEQN.trim();
  return `${reg}-${dist}-${cnty}-${type}-${exp}-${seq}`;
}

function parseZipCode(raw: string): string {
  const digits = raw.trim().replace(/\D/g, "");
  if (digits.length <= 5) return padLeft(digits, 5);
  return padLeft(digits.slice(0, digits.length - 4), 5);
}

const MONTH_MAP: Record<string, string> = {
  A: "01", B: "02", C: "03", D: "04", E: "05",
  F: "06", G: "07", H: "08", J: "09", K: "10",
  L: "11", M: "12",
};

// Parse FFL expiration date from the 9th and 10th digits of the FFL number
// 9th digit = last digit of year (e.g., 8 → 2028)
// 10th digit = month code (A=Jan through M=Dec)
// All FFLs expire on the 1st of the month
// Example: FFL 5-74-493-07-8E-07004 → May 1, 2028
function parseExpiryDate(fflDigits: string): string | null {
  if (fflDigits.length < 10) return null;
  const yearDigit = fflDigits[8];  // 9th digit (0-indexed: 8)
  const monthCode = fflDigits[9].toUpperCase(); // 10th digit
  
  const month = MONTH_MAP[monthCode];
  if (!month) return null;
  
  // Determine year: if digit is '0'-'9', it's 2020-2029 or 2030-2039
  const currentYear = new Date().getFullYear();
  const decadeBase = Math.floor(currentYear / 10) * 10;
  let year = decadeBase + parseInt(yearDigit);
  // If the derived year is more than 1 year in the past, add 10
  if (year < currentYear - 1) year += 10;
  
  return `${year}-${month}-01`;
}

export interface FFLRecord {
  fflNumber: string;
  licenseeName: string;
  businessName: string;
  premiseStreet: string;
  premiseCity: string;
  premiseState: string;
  premiseZip: string;
  voicePhone: string;
  fflExpiryDate: string; // YYYY-MM-DD — derived from FFL number digits
}

// In-memory lookup: normalized FFL -> record
let fflMap: Map<string, FFLRecord> = new Map();
// Secondary index: "REGN-DIST-SEQN" -> record (for short-format lookup X-XX-XXXXX)
let fflByTuple: Map<string, FFLRecord> = new Map();
let loaded = false;

function normalizeKey(ffl: string): string {
  return ffl.replace(/[^0-9A-Za-z]/gi, "").toUpperCase();
}

// Parse X-XX-XXXXX format into (REGN, DIST, SEQN) tuple key
// e.g. "5-74-07004" -> { regn: "5", dist: "74", seqn: "07004" }
function parseShortFFL(ffl: string): { regn: string; dist: string; seqn: string } | null {
  const digits = ffl.replace(/\D/g, "");
  // X-XX-XXXXX = 1 digit + 2 digits + 5 digits = 8 digits total
  if (digits.length !== 8) return null;
  return {
    regn: digits[0],
    dist: digits.slice(1, 3),
    seqn: digits.slice(3),
  };
}

export async function loadFFLMaster(): Promise<void> {
  if (loaded) return;
  const content = fs.readFileSync(CSV_PATH, "utf8");
  const lines = content.split("\n");
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Simple CSV parse — handle quoted fields with commas inside
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());

    if (fields.length < 17) continue;

    const rec: Record<string, string> = {
      LIC_REGN: fields[0],
      LIC_DIST: fields[1],
      LIC_CNTY: fields[2],
      LIC_TYPE: fields[3],
      LIC_XPRDTE: fields[4],
      LIC_SEQN: fields[5],
      LICENSE_NAME: fields[6].replace(/^"|"$/g, ""),
      BUSINESS_NAME: fields[7].replace(/^"|"$/g, ""),
      PREMISE_STREET: fields[8].replace(/^"|"$/g, ""),
      PREMISE_CITY: fields[9].replace(/^"|"$/g, ""),
      PREMISE_STATE: fields[10].replace(/^"|"$/g, ""),
      PREMISE_ZIP_CODE: fields[11],
      // fields[12] = MAIL_STREET (ignored)
      // fields[13] = MAIL_CITY (ignored)
      // fields[14] = MAIL_STATE (ignored)
      // fields[15] = MAIL_ZIP_CODE (ignored)
      VOICE_PHONE: fields[16] || "",
    };

    // Skip suppressor-ban states and US territories
    const state = rec.PREMISE_STATE.toUpperCase();
    const BANNED_STATES = new Set(["CA", "DE", "HI", "IL", "MA", "NJ", "NY", "RI", "DC"]);
    const TERRITORIES = new Set(["PR", "GU", "VI", "AS", "MP"]);
    if (BANNED_STATES.has(state) || TERRITORIES.has(state)) continue;

    const fflNumber = parseFFLNumber(rec);
    const normalized = normalizeKey(fflNumber);
    const licenseeName = rec.LICENSE_NAME;
    const businessName = rec.BUSINESS_NAME || rec.LICENSE_NAME;
    const expiryDate = parseExpiryDate(normalized) || "";

    const record: FFLRecord = {
      fflNumber,
      licenseeName,
      businessName,
      premiseStreet: rec.PREMISE_STREET,
      premiseCity: rec.PREMISE_CITY,
      premiseState: rec.PREMISE_STATE,
      premiseZip: parseZipCode(rec.PREMISE_ZIP_CODE),
      voicePhone: rec.VOICE_PHONE,
      fflExpiryDate: expiryDate,
    };

    fflMap.set(normalized, record);

    // Secondary index: REGN-DIST-SEQN (padded) -> record
    // This supports short-format lookup via X-XX-XXXXX
    const regn = rec.LIC_REGN.trim().replace(/^0+/, "") || "0";
    const dist = rec.LIC_DIST.trim().replace(/^0+/, "") || "0";
    const seqn = rec.LIC_SEQN.trim().replace(/^0+/, "") || "0";
    const tupleKey = `${regn}-${dist}-${seqn}`;
    // Only store first match per tuple (short format can be ambiguous)
    if (!fflByTuple.has(tupleKey)) {
      fflByTuple.set(tupleKey, record);
    }
  }
  loaded = true;
  console.log(`[ffl-master] Loaded ${fflMap.size} FFL records`);
}

export function validateFFL(fflNumber: string): FFLRecord | null {
  if (!loaded) return null;
  const normalized = normalizeKey(fflNumber);
  // Try full format first
  const full = fflMap.get(normalized);
  if (full) return full;
  // Try short format X-XX-XXXXX
  const short = parseShortFFL(fflNumber);
  if (short) {
    // Strip leading zeros to match how the secondary index is built
    const regn = short.regn.replace(/^0+/, "") || "0";
    const dist = short.dist.replace(/^0+/, "") || "0";
    const seqn = short.seqn.replace(/^0+/, "") || "0";
    return fflByTuple.get(`${regn}-${dist}-${seqn}`) || null;
  }
  return null;
}

export function getFFLCount(): number {
  return fflMap.size;
}
