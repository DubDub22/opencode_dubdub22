// Migration: Add FFL, SOT, and Tax Form file columns to submissions table
// These columns store uploaded files from the dealer portal application form

import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://dubdub_user:DubDubDB2024!@localhost/dubdub22",
});

async function migrate() {
  const client = await pool.connect();
  try {
    // Check if columns already exist
    const existing = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'submissions' AND column_name IN ('sot_file_name', 'sot_file_data', 'tax_form_name', 'tax_form_data')
    `);

    const existingCols = new Set(existing.rows.map(r => r.column_name));

    if (existingCols.has("sot_file_name")) {
      console.log("sot_file_name already exists — skipping");
    } else {
      await client.query(`ALTER TABLE submissions ADD COLUMN sot_file_name TEXT`);
      console.log("Added sot_file_name");
    }

    if (existingCols.has("sot_file_data")) {
      console.log("sot_file_data already exists — skipping");
    } else {
      await client.query(`ALTER TABLE submissions ADD COLUMN sot_file_data TEXT`);
      console.log("Added sot_file_data");
    }

    if (existingCols.has("tax_form_name")) {
      console.log("tax_form_name already exists — skipping");
    } else {
      await client.query(`ALTER TABLE submissions ADD COLUMN tax_form_name TEXT`);
      console.log("Added tax_form_name");
    }

    if (existingCols.has("tax_form_data")) {
      console.log("tax_form_data already exists — skipping");
    } else {
      await client.query(`ALTER TABLE submissions ADD COLUMN tax_form_data TEXT`);
      console.log("Added tax_form_data");
    }

    console.log("Migration complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => { console.error(err); process.exit(1); });
