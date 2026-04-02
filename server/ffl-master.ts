import fs from "fs";
import path from "path";
import { pool } from "./db";

const CSV_PATH = "/home/dubdub/DubDubSuppressor/ffl_master.csv";

function padLeft(str: string, len: number): string {
  return String(str).padStart(len, "0");
}

function parseFFLNumber(rec: Record<string, string>): string {
  const reg = padLeft(rec.LIC_REGN.trim(), 2);
  const dist = padLeft(rec.LIC_DIST.trim(), 3);
  const cnty = padLeft(rec.LIC_CNTY.trim(), 3);
  const type = padLeft(rec.LIC_TYPE.trim(), 2);
  const exp = rec.LIC_XPRDTE.trim().toUpperCase();
  const seq = padLeft(rec.LIC_SEQN.trim(), 5);
  return `${reg}-${dist}-${cnty}-${type}-${exp}-${seq}`;
}

function parseZipCode(raw: string): string {
  const digits = raw.trim().replace(/\D/g, "");
  if (digits.length <= 5) return padLeft(digits, 5);
  // Remove Zip+4 (last 4 digits), then pad to 5
  return padLeft(digits.slice(0, digits.length - 4), 5);
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

    if (fields.length < 13) continue;

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
      VOICE_PHONE: fields[12] || "",
    };

    const fflNumber = parseFFLNumber(rec);
    const normalized = normalizeKey(fflNumber);
    const licenseeName = rec.LICENSE_NAME;
    const businessName = rec.BUSINESS_NAME || rec.LICENSE_NAME;

    fflMap.set(normalized, {
      fflNumber,
      licenseeName,
      businessName,
      premiseStreet: rec.PREMISE_STREET,
      premiseCity: rec.PREMISE_CITY,
      premiseState: rec.PREMISE_STATE,
      premiseZip: parseZipCode(rec.PREMISE_ZIP_CODE),
      voicePhone: rec.VOICE_PHONE,
    });

    // Secondary index: REGN-DIST-SEQN (padded) -> record
    // This supports short-format lookup via X-XX-XXXXX
    const regn = rec.LIC_REGN.trim().replace(/^0+/, "") || "0";
    const dist = rec.LIC_DIST.trim().replace(/^0+/, "") || "0";
    const seqn = rec.LIC_SEQN.trim().replace(/^0+/, "") || "0";
    const tupleKey = `${regn}-${dist}-${seqn}`;
    // Only store first match per tuple (short format can be ambiguous)
    if (!fflByTuple.has(tupleKey)) {
      fflByTuple.set(tupleKey, {
        fflNumber,
        licenseeName,
        businessName,
        premiseStreet: rec.PREMISE_STREET,
        premiseCity: rec.PREMISE_CITY,
        premiseState: rec.PREMISE_STATE,
        premiseZip: parseZipCode(rec.PREMISE_ZIP_CODE),
        voicePhone: rec.VOICE_PHONE,
      });
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
