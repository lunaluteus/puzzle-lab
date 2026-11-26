import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const pages = ["index", "ring-lamps", "ring-lamps-notes", "fraction-24", "triple-rotate", "tits-cone"];

export default defineConfig({
  base: "./",
  build: {
    rolldownOptions: {
      input: Object.fromEntries(pages.map(page => [
        page, fileURLToPath(new URL(page + ".html", import.meta.url))
      ]))
    }
  }
});
