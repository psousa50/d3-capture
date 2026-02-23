import pg from "pg";
import { migrate } from "./schema";

pg.types.setTypeParser(20, Number);

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

export async function initDb() {
  await migrate(getPool());
}
