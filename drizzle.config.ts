import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/database/schema/*",
  out: "./src/database/migrations",
  dialect: "sqlite",
  driver: "d1-http",
});
