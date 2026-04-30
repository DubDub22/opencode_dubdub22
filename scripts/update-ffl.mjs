#!/usr/bin/env node
import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.resolve(__dirname, "..", "ffl_master.csv");

const BANNED_STATES = new Set(["CA", "DE", "HI", "IL", "MA", "NJ", "NY", "RI", "DC"]);
const TERRITORIES = new Set(["PR", "GU", "VI", "AS", "MP"]);
const BANNED_TYPES = new Set(["03", "06"]);

function parseCSV(line) {
  const fields = [];
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

function download(url, dest) {
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
    console.log(`  2. Select year/month (current: ${mm}/${yy})`);
    console.log("  3. Click Apply");
    console.log("  4. Right-click the CSV link -> Copy link address");
    console.log("  5. Run: node scripts/update-ffl.mjs <paste-url>");
    process.exit(1);
  }

  const tmpFile = path.resolve(__dirname, "..", "_ffl_download.csv");

  try {
    if (input.startsWith("http")) {
      console.log(`Downloading ${input}...`);
      await download(input, tmpFile);
      console.log("Downloaded.");
    } else {
      fs.copyFileSync(input, tmpFile);
      console.log(`Using local file: ${input}`);
    }

    const content = fs.readFileSync(tmpFile, "utf8");
    const lines = content.split(/\r?\n/);
    const header = lines[0];
    const outLines = [header];

    let total = 0, kept = 0, skippedState = 0, skippedType = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      total++;
      const fields = parseCSV(line);
      if (fields.length < 13) continue;
      const st = (fields[10] || "").toUpperCase();
      const tp = (fields[3] || "").trim();
      if (BANNED_STATES.has(st) || TERRITORIES.has(st)) { skippedState++; continue; }
      if (BANNED_TYPES.has(tp)) { skippedType++; continue; }
      outLines.push(line);
      kept++;
    }

    fs.writeFileSync(CSV_PATH, outLines.join("\n"));
    fs.unlinkSync(tmpFile);

    console.log(`Total records: ${total}`);
    console.log(`Filtered: ${skippedState} ban/territory + ${skippedType} types 03/06`);
    console.log(`Kept: ${kept} FFLs`);
    console.log(`Saved to: ${CSV_PATH}`);
    console.log("Done! Restart server to load new data.");
  } catch (err) {
    console.error("Error:", err.message);
    try { fs.unlinkSync(tmpFile); } catch {}
    process.exit(1);
  }
}

main();
