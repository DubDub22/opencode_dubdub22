import {
  type User, type InsertUser,
  type Submission, type InsertSubmission,
  submissions,
} from "@shared/schema";

import {
  type Dealer, type InsertDealer,
  type DealerSubmission, type InsertDealerSubmission,
  dealers, dealerSubmissions
} from "@shared/dealers-schema";
import { db } from "./db";
import { eq, desc, sql, or, and } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createSubmission(submission: InsertSubmission): Promise<Submission>;
  getSubmissions(): Promise<Submission[]>;
  deleteSubmission(id: string): Promise<void>;
  // Dealer operations
  upsertDealer(dealer: Partial<Dealer> & { businessName: string; email: string }): Promise<Dealer>;
  getDealers(): Promise<(Dealer & { orderCount: number; demoCount: number; retailCount: number })[]>;
  getDealerById(id: string): Promise<Dealer | undefined>;
  updateDealer(id: string, data: Partial<Dealer>): Promise<Dealer>;
  deleteDealer(id: string): Promise<void>;
  getDealerSubmissions(dealerId: string): Promise<Submission[]>;
  linkSubmissionToDealer(submissionId: string, dealerId: string, orderType: string, quantity?: string): Promise<void>;
  getDealerByBusinessName(businessName: string): Promise<Dealer | undefined>;
  getDealerByEmail(email: string): Promise<Dealer | undefined>;
}

export class DatabaseStorage implements IStorage {
  // ── User ops ──────────────────────────────────────────────────────────────
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // ── Submission ops ───────────────────────────────────────────────────────
  async createSubmission(insertSubmission: InsertSubmission): Promise<Submission> {
    const [sub] = await db.insert(submissions).values(insertSubmission as any).returning();
    return sub;
  }

  async getSubmissions(): Promise<Submission[]> {
    return db.select().from(submissions).orderBy(desc(submissions.createdAt));
  }

  async deleteSubmission(id: string): Promise<void> {
    await db.delete(submissions).where(eq(submissions.id, id));
  }

  // ── Dealer ops ───────────────────────────────────────────────────────────
  async upsertDealer(data: Partial<Dealer> & { businessName: string; email: string }): Promise<Dealer> {
    // Look for existing dealer by email or business name
    const normalizedEmail = (data.email || "").toLowerCase().trim();
    const normalizedBiz = (data.businessName || "").trim();

    const existing = await db.select().from(dealers).where(
      or(
        sql`LOWER(${dealers.email}) = ${normalizedEmail}`,
        sql`${dealers.businessName} ILIKE ${normalizedBiz}`
      )
    ).limit(1);

    if (existing.length > 0) {
      const [updated] = await db.update(dealers)
        .set({ ...data, updatedAt: new Date().toISOString() } as any)
        .where(eq(dealers.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(dealers).values(data as any).returning();
    return created;
  }

  async getDealers(): Promise<(Dealer & { orderCount: number; demoCount: number; retailCount: number })[]> {
    const allDealers = await db.select().from(dealers).orderBy(desc(dealers.createdAt));

    const enriched = await Promise.all(allDealers.map(async (dealer) => {
      const rows = await db.execute(sql`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE ds.order_type = 'demo_order') AS demos,
          COUNT(*) FILTER (WHERE ds.order_type = 'retail_order') AS retail
        FROM dealer_submissions ds
        WHERE ds.dealer_id = ${dealer.id}
      `);
      const counts = rows[0] as { total: string; demos: string; retail: string };
      return {
        ...dealer,
        orderCount: parseInt(counts.total || "0"),
        demoCount: parseInt(counts.demos || "0"),
        retailCount: parseInt(counts.retail || "0"),
      };
    }));

    return enriched;
  }

  async getDealerById(id: string): Promise<Dealer | undefined> {
    const [dealer] = await db.select().from(dealers).where(eq(dealers.id, id));
    return dealer;
  }

  async getDealerByBusinessName(businessName: string): Promise<Dealer | undefined> {
    const [dealer] = await db.select().from(dealers)
      .where(sql`${dealers.businessName} ILIKE ${businessName}`)
      .limit(1);
    return dealer;
  }

  async getDealerByEmail(email: string): Promise<Dealer | undefined> {
    const normalized = email.toLowerCase().trim();
    const [dealer] = await db.select().from(dealers)
      .where(sql`LOWER(${dealers.email}) = ${normalized}`)
      .limit(1);
    return dealer;
  }

  async updateDealer(id: string, data: Partial<Dealer>): Promise<Dealer> {
    const [updated] = await db.update(dealers)
      .set({ ...data, updatedAt: new Date().toISOString() } as any)
      .where(eq(dealers.id, id))
      .returning();
    return updated;
  }

  async deleteDealer(id: string): Promise<void> {
    await db.delete(dealers).where(eq(dealers.id, id));
  }

  async getDealerSubmissions(dealerId: string): Promise<Submission[]> {
    const links = await db.select().from(dealerSubmissions)
      .where(eq(dealerSubmissions.dealerId, dealerId));
    if (links.length === 0) return [];

    const subIds = links.map(l => l.submissionId);
    const subs = await db.select().from(submissions)
      .where(sql`${submissions.id} = ANY(${subIds})`)
      .orderBy(desc(submissions.createdAt));
    return subs;
  }

  async linkSubmissionToDealer(
    submissionId: string,
    dealerId: string,
    orderType: string,
    quantity?: string
  ): Promise<void> {
    const existing = await db.select().from(dealerSubmissions)
      .where(and(
        eq(dealerSubmissions.submissionId, submissionId),
        eq(dealerSubmissions.dealerId, dealerId)
      ))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(dealerSubmissions).values({
        submissionId,
        dealerId,
        orderType,
        quantity: quantity || null,
      });
    }
  }
}

export const storage = new DatabaseStorage();
