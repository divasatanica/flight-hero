import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../../outputs/fe",
    // The output sits outside the package root; only clear the frontend directory.
    emptyOutDir: true,
  },
});
