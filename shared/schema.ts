import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean } from "drizzle-orm/pg-core";
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
  trackingNumber: text("tracking_number"),
  shippedAt: text("shipped_at"),
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
