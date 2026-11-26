import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { coxeterMath } from "./scripts/coxeter-mathjax.js";

const pages = ["index", "ring-lamps", "ring-lamps-notes", "fraction-24", "triple-rotate", "tits-cone"];

export default defineConfig({
  base: "./",
  plugins: [coxeterMath()],
  build: {
    rolldownOptions: {
      input: Object.fromEntries(pages.map(page => [
        page, fileURLToPath(new URL(page + ".html", import.meta.url))
      ])),
      output: {
        codeSplitting: {
          groups: [{name: "coxeter-math", test: /virtual:coxeter-math$/}]
        }
      }
    }
  }
});
