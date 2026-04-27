import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, integer, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const submissions = pgTable("submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type", { length: 50 }).notNull(), // 'dealer' or 'warranty'
  contactName: text("contact_name"),
  businessName: text("business_name"),
  email: text("email").notNull(),
  phone: text("phone"),
  fflLicenseNumber: text("ffl_license_number"),
  fflType: text("ffl_type"),
  serialNumber: text("serial_number"),
  quantity: text("quantity"),
  description: text("description"),
  fflFileName: text("ffl_file_name"),
  fflFileData: text("ffl_file_data"),
  sotFileName: text("sot_file_name"),
  sotFileData: text("sot_file_data"),
  taxFormName: text("tax_form_name"),
  taxFormData: text("tax_form_data"),
  stateTaxFileName: text("state_tax_file_name"),
  stateTaxFileData: text("state_tax_file_data"),
  serialPhotoName: text("serial_photo_name"),
  serialPhotoData: text("serial_photo_data"),
  damagePhoto1Name: text("damage_photo1_name"),
  damagePhoto1Data: text("damage_photo1_data"),
  damagePhoto2Name: text("damage_photo2_name"),
  damagePhoto2Data: text("damage_photo2_data"),
  hasOrderedDemo: text("has_ordered_demo").default("false"),
  // Shipping fields
  atfFormName: text("atf_form_name"),
  atfFormData: text("atf_form_data"),
  form3PdfName: text("form3_pdf_name"),
  form3PdfData: text("form3_pdf_data"),
  trackingNumber: text("tracking_number"),
  shippedAt: text("shipped_at"),
  paidAt: text("paid_at"),
  paidNotes: text("paid_notes"),
  // Customer address (populated from /order form)
  customerAddress: text("customer_address"),
  customerCity: text("customer_city"),
  customerState: text("customer_state"),
  customerZip: text("customer_zip"),
  archived: boolean("archived").default(false).notNull(),
  archived_from: text("archived_from"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertSubmissionSchema = createInsertSchema(submissions);
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;
export type Submission = typeof submissions.$inferSelect;

// ── Dealer orders (canonical) ────────────────────────────────────────────────
export const dealerOrders = pgTable("dealer_orders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  dealerId: text("dealer_id"),
  quantity: integer("quantity"),
  unitPrice: doublePrecision("unit_price"),
  subtotal: doublePrecision("subtotal"),
  shippingCost: doublePrecision("shipping_cost"),
  totalAmount: doublePrecision("total_amount"),
  status: text("status"), // 'pending' | 'confirmed' | 'shipped' | 'delivered'
  trackingNumber: text("tracking_number"),
  shippedAt: text("shipped_at"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export type DealerOrder = typeof dealerOrders.$inferSelect;

// ── Invoices ─────────────────────────────────────────────────────────────────
export const invoices = pgTable("invoices", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),
  dealerId: text("dealer_id").notNull(),
  orderId: integer("order_id").references(() => dealerOrders.id),
  subtotal: doublePrecision("subtotal").notNull(),
  shippingCost: doublePrecision("shipping_cost"),
  totalAmount: doublePrecision("total_amount").notNull(),
  status: varchar("status", { length: 20 }),
  createdAt: text("created_at"),
  sentAt: text("sent_at"),
  paidAt: text("paid_at"),
  dueDate: text("due_date"),
  pdfPath: varchar("pdf_path", { length: 255 }),
  emailSent: boolean("email_sent"),
  emailSentAt: text("email_sent_at"),
  isRetail: boolean("is_retail").default(false),
  retailCustomerName: varchar("retail_customer_name", { length: 200 }),
  retailCustomerEmail: varchar("retail_customer_email", { length: 255 }),
  retailCustomerPhone: varchar("retail_customer_phone", { length: 50 }),
  retailCustomerAddress: varchar("retail_customer_address", { length: 255 }),
  retailCustomerCity: varchar("retail_customer_city", { length: 100 }),
  retailCustomerState: varchar("retail_customer_state", { length: 2 }),
  retailCustomerZip: varchar("retail_customer_zip", { length: 20 }),
  quantity: integer("quantity"),
  unitPrice: doublePrecision("unit_price"),
  taxRate: doublePrecision("tax_rate").default(0.0825),
  taxAmount: doublePrecision("tax_amount"),
  submissionId: varchar("submission_id", { length: 50 }),
});
