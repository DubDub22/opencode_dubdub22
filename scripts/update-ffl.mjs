#!/usr/bin/env node
/**
 * ATF FFL Database Update Script
 * 
 * Usage: node scripts/update-ffl.mjs <download-url-or-file>
 * 
 * Downloads the latest ATF FFL listing, filters for NFA-eligible dealers,
 * and saves the filtered CSV.
 * 
 * The ATF data is always one month behind. Download from:
 *   https://www.atf.gov/firearms/listing-federal-firearms-licensees
 *   → Select year/month → Apply → Click the CSV link → Copy link address
 * 
 * Then run: node scripts/update-ffl.mjs <pasted-url>
 */

import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.resolve(__dirname, "..", "ffl_master.csv");

// ═══ Filter Config ══════════════════════════════════════════════════

const BANNED_STATES = new Set(["CA", "DE", "HI", "IL", "MA", "NJ", "NY", "RI", "DC"]);
const TERRITORIES = new Set(["PR", "GU", "VI", "AS", "MP"]);
const BANNED_TYPES = new Set(["03", "06"]);

// ═══ CSV Parser ═════════════════════════════════════════════════════

function parseCSV(line) {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === "," && !inQuotes) { fields.push(current.trim()); current = ""; }
    else { current += ch; }
  }
  fields.push(current.trim());
  return fields;
}

function shouldInclude(state, fflType) {
  if (BANNED_STATES.has(state) || TERRITORIES.has(state)) return false;
  if (BANNED_TYPES.has(fflType)) return false;
  return true;
}

// ═══ Download ═══════════════════════════════════════════════════════

function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith("https") ? https : http;
    proto.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location;
        if (loc) return download(loc, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
      file.on("error", reject);
    }).on("error", reject);
  });
}

// ═══ Main ═══════════════════════════════════════════════════════════

async function main() {
  const input = process.argv[2];
  if (!input) {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const mm = String(prev.getMonth() + 1).padStart(2, "0");
    const yy = String(prev.getFullYear()).slice(2);
    console.log(`Usage: node scripts/update-ffl.mjs <url-or-file>`);
    console.log("");
    console.log("Steps to get the URL:");
    console.log("  1. Go to https://www.atf.gov/firearms/listing-federal-firearms-licensees");
    console.log(`  2. Select year/month (current: ${mm}/${yy} for ${prev.toLocaleString("en-US", { month: "long", year: "numeric" })})`);
    console.log("  3. Click Apply");
    console.log("  4. Right-click the CSV link → Copy link address");
    console.log("  5. Run: node scripts/update-ffl.mjs <paste-url>");
    console.log("");
    console.log("Or if you already downloaded the file:");
    console.log("  node scripts/update-ffl.mjs /path/to/downloaded.csv");
    process.exit(1);
  }

  const tmpFile = path.resolve(__dirname, "..", "_ffl_download.csv");

  try {
    // If input is a URL, download it
    if (input.startsWith("http")) {
      console.log(`Downloading ${input}...`);
      await download(input, tmpFile);
      console.log("Downloaded.");
    } else {
      // Input is a local file path
      fs.copyFileSync(input, tmpFile);
      console.log(`Using local file: ${input}`);
    }

    // Read and filter
    const content = fs.readFileSync(tmpFile, "utf8");
    const lines = content.split(/\r?\n/);
    const header = lines[0];
    const outLines: string[] = [header];

    let total = 0, kept = 0, skippedState = 0, skippedType = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      total++;

      const fields = parseCSV(line);
      if (fields.length < 13) continue;

      const state = (fields[10] || "").toUpperCase();
      const type = (fields[3] || "").trim();

      if (BANNED_STATES.has(state) || TERRITORIES.has(state)) { skippedState++; continue; }
      if (BANNED_TYPES.has(type)) { skippedType++; continue; }

      outLines.push(line);
      kept++;
    }

    // Save filtered CSV
    fs.writeFileSync(CSV_PATH, outLines.join("\n"));
    fs.unlinkSync(tmpFile);

    console.log(`Total records: ${total}`);
    console.log(`Filtered out: ${skippedState} (ban states/territories) + ${skippedType} (types 03/06)`);
    console.log(`Kept: ${kept} FFLs`);
    console.log(`Saved to: ${CSV_PATH}`);
    console.log("");
    console.log("Done! Commit and push to deploy the updated FFL database.");
  } catch (err: any) {
    console.error("Error:", err.message);
    fs.unlinkSync(tmpFile).catch(() => {});
    process.exit(1);
  }
}

main();
