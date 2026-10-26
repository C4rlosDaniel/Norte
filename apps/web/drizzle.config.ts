import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: [".env.local", ".env"], quiet: true });

const url = process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"];

if (!url) {
  throw new Error(
    "Defina DIRECT_URL (porta 5432) ou DATABASE_URL em apps/web/.env.local para rodar o drizzle-kit.",
  );
}

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
