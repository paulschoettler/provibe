import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    coverage: { provider: "v8", include: ["src/lib/**"] },
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
