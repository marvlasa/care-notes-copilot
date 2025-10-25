import { pool } from "@/db";
import fs from "fs";
import path from "path";

async function main() {
  const sql = fs.readFileSync(path.join(process.cwd(), "src/db/schema.sql"), "utf-8");
  await pool.query(sql);
  console.log("DB schema ready.");
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
