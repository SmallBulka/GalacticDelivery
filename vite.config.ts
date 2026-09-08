/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  plugins: [react(), wasm()],
  optimizeDeps: {
    exclude: ["@babylonjs/havok"],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
