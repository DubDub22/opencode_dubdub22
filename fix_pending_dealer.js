const fs = require('fs');
const path = require('path');

const filePath = process.argv[2] || 'server/routes.ts';
const content = fs.readFileSync(filePath, 'utf8');

// Fix: Remove FastBound upload for pending dealers
// Replace the section that uploads to FastBound with just database flags
const oldSection = `      // ── FastBound upload + database flags ──────────────────────────
      const hasFfl = !!(fflFileData && fflFileName);
      const hasSot = !!(sotFileData && sotFileName);
      const hasTax = !!(taxFormData && taxFormName);

      if (normalized && (hasFfl || hasSot || hasTax)) {
        // Upload to FastBound contact
        uploadDealerDocumentsToFastBound(normalized, {
          fflFileData: fflFileData || undefined,
          fflFileName: fflFileName || undefined,
          sotFileData: sotFileData || undefined,
          sotFileName: sotFileName || undefined,
          taxFormFileData: taxFormData || undefined,
          taxFormFileName: taxFormName || undefined,
        }).catch(err => console.error("fastbound_upload_dealer_docs_error", err));
        await pool.query(
          \`UPDATE dealers SET ffl_on_file = $1, sot_on_file = $2, tax_form_on_file = $3, updated_at = CURRENT_TIMESTAMP WHERE ffl_license_number = $4\`,
          [hasFfl, hasSot, hasTax, normalized]
        );
      }`;

const newSection = `      // ── Database flags only (NO FastBound for pending dealers) ─────────
      const hasFfl = !!(fflFileData && fflFileName);
      const hasSot = !!(sotFileData && sotFileName);
      const hasTax = !!(taxFormData && taxFormName);

      // Update dealer record with file flags (no FastBound upload for pending dealers)
      if (normalized) {
        await pool.query(
          \`UPDATE dealers SET ffl_on_file = $1, sot_on_file = $2, tax_form_on_file = $3, updated_at = CURRENT_TIMESTAMP WHERE ffl_license_number = $4\`,
          [hasFfl, hasSot, hasTax, normalized]
        );
      }`;

if (content.includes(oldSection)) {
  const newContent = content.replace(oldSection, newSection);
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log('Fixed pending dealer flow - removed FastBound upload');
} else {
  console.log('Could not find the exact section to replace');
  process.exit(1);
}
