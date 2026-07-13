import Database from "better-sqlite3";
import { SCHEMA } from "./schema.js";
import { mkdirSync } from "fs";
import { dirname } from "path";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  const dbPath = process.env["DB_PATH"] ?? "./data/sovegent-identity.db";
  mkdirSync(dirname(dbPath), { recursive: true });
  _db = new Database(dbPath);
  _db.exec(SCHEMA);
  return _db;
}

export function closeDb(): void {
  _db?.close();
  _db = null;
}
