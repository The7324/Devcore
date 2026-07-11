import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@core": path.resolve(__dirname, "src/core"),
      "@commands": path.resolve(__dirname, "src/commands"),
      "@providers": path.resolve(__dirname, "src/providers"),
      "@telegram": path.resolve(__dirname, "src/telegram"),
      "@auth": path.resolve(__dirname, "src/auth"),
      "@connections": path.resolve(__dirname, "src/connections"),
    },
  },
  test: {
    globals: true,
    environment: "node",
  },
});
