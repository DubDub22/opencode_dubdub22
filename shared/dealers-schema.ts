import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { submissions } from "./schema";

// ── Dealers (canonical dealer profiles) ─────────────────────────────────────
export const dealers = pgTable("dealers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Core business identity
  businessName: text("business_name").notNull(),
  ein: text("ein"),                    // e.g. 46-1766383
  businessAddress: text("business_address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),

  // Contact
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),

  // SOT info
  sotLicenseType: text("sot_license_type"),   // e.g. "NFA FIREARMS MFGR (REDUCED)"
  sotTaxYear: text("sot_tax_year"),           // e.g. "2026"
  sotPeriodStart: text("sot_period_start"),   // e.g. "07/01/2025"
  sotPeriodEnd: text("sot_period_end"),       // e.g. "06/30/2026"
  sotControlNumber: text("sot_control_number"), // e.g. "2025160-N75-129"
  sotReceiptDate: text("sot_receipt_date"),   // e.g. "July 03, 2025"
  sotFileName: text("sot_file_name"),
  sotFileData: text("sot_file_data"),         // base64
  sotOnFile: boolean("sot_on_file").default(false),
  sotExpiryDate: text("sot_expiry_date"),     // ISO date string (YYYY-MM-DD)

  // FFL info
  fflLicenseNumber: text("ffl_license_number"),
  fflLicenseType: text("ffl_license_type"),
  fflExpiry: text("ffl_expiry"),
  fflFileName: text("ffl_file_name"),
  fflFileData: text("ffl_file_data"),
  fflOnFile: boolean("ffl_on_file").default(false),
  fflExpiryDate: text("ffl_expiry_date"),     // ISO date string (YYYY-MM-DD)

  // Tax status
  einType: text("ein_type"),                 // 'manufacturer' or 'dealer' — for eForms/Form 3
  taxExempt: boolean("tax_exempt").default(false),
  taxExemptNotes: text("tax_exempt_notes"),  // e.g. "Texas — no state sales tax on NFA items"
  salesTaxId: text("sales_tax_id"),           // state sales tax exemption ID
  salesTaxFormData: text("sales_tax_form_data"), // base64 uploaded form
  salesTaxFormName: text("sales_tax_form_name"),
  taxFormOnFile: boolean("tax_form_on_file").default(false),

  // FFL review flag — prevents reviewed FFL-upload records from reappearing in dealer inquiries
  fflReviewed: boolean("ffl_reviewed").default(false),

  // Demo unit tracking
  hasDemoUnitShipped: boolean("has_demo_unit_shipped").default(false), // true once a dealer_order has been shipped to this dealer

  // Metadata
  notes: text("notes"),
  sourceSubmissionId: text("source_submission_id"), // first submission that created this dealer
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ── Dealer ↔ Submission junction ────────────────────────────────────────────
export const dealerSubmissions = pgTable("dealer_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealerId: text("dealer_id").notNull().references(() => dealers.id, { onDelete: "cascade" }),
  submissionId: text("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  orderType: text("order_type"), // 'inquiry' | 'dealer_order'
  quantity: text("quantity"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// submissions table is defined in schema.ts — imported above

// ── Zod schemas ───────────────────────────────────────────────────────────────
export const insertDealerSchema = createInsertSchema(dealers).omit({ id: true });
export type InsertDealer = z.infer<typeof insertDealerSchema>;
export type Dealer = typeof dealers.$inferSelect;

export const insertDealerSubmissionSchema = createInsertSchema(dealerSubmissions).omit({ id: true });
export type InsertDealerSubmission = z.infer<typeof insertDealerSubmissionSchema>;
export type DealerSubmission = typeof dealerSubmissions.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
