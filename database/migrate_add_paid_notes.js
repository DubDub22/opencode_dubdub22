// Migration: Add paid_at and paid_notes columns to submissions table
// Run: node database/migrate_add_paid_notes.js
const { pool } = require("./db");

async function main() {
  // Add paid_at column if not exists (already in invoices, but not submissions)
  try {
    await pool.query(`ALTER TABLE submissions ADD COLUMN paid_at TIMESTAMPTZ`);
    console.log("Added paid_at column");
  } catch (e) {
    if (e.code === "42701") console.log("paid_at already exists");
    else throw e;
  }

  // Add paid_notes column
  try {
    await pool.query(`ALTER TABLE submissions ADD COLUMN paid_notes TEXT`);
    console.log("Added paid_notes column");
  } catch (e) {
    if (e.code === "42701") console.log("paid_notes already exists");
    else throw e;
  }

  await pool.end();
  console.log("Done.");
}

main().catch(e => { console.error(e); process.exit(1); });
