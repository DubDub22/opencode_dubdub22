import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

const useLocalDb = process.env.LOCAL_DEV === "true";

let pool: any;
let db: any;

if (useLocalDb) {
  // @ts-ignore: top-level await for module initialization
  const { newDb } = await import("pg-mem");
  const mem = newDb();
  const pg = mem.adapters.createPg();
  pool = new pg.Pool();
  db = drizzle(pool as any, { schema });
} else {
  // @ts-ignore: top-level await for module initialization
  const pkg = await import("pg");
  const { Pool } = pkg;
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required in the environment variables");
  }

  pool = new Pool({ connectionString });
  db = drizzle(pool, { schema });
}

export { pool, db };
