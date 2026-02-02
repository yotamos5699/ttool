import "dotenv/config";
import { defineConfig } from "drizzle-kit";
const url = process.env.DATABASE_URL!;
console.log("Database URL:", url);
export default defineConfig({
  out: "./src/dbs/drizzle/migrations/",
  schema: "./src/dbs/drizzle/schema/",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
