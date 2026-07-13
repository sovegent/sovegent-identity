import { getDb } from "./index.js";
const db = getDb();
console.log("Database migrated:", process.env["DB_PATH"] ?? "./data/sovegent-identity.db");
db.close();
