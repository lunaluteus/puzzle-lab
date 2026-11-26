import { mathjax } from "@mathjax/src/js/mathjax.js";
import { liteAdaptor } from "@mathjax/src/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "@mathjax/src/js/handlers/html.js";
import { TeX } from "@mathjax/src/js/input/tex.js";
import { SVG } from "@mathjax/src/js/output/svg.js";
import "@mathjax/src/js/input/tex/base/BaseConfiguration.js";
import "@mathjax/src/js/input/tex/ams/AmsConfiguration.js";
import "@mathjax/src/js/util/asyncLoad/esm.js";
import { examples } from "../src/coxeter/model.js";
import { exampleFormulae, mathNotes } from "../src/coxeter/formulas.js";

const virtualId = "virtual:coxeter-math";
const resolvedId = "\0" + virtualId;

export function coxeterMath() {
  return {
    name: "coxeter-mathjax",
    resolveId(id) {
      return id === virtualId ? resolvedId : null;
    },
    async load(id) {
      if (id !== resolvedId) return null;
      const adapter = liteAdaptor({fontSize: 16});
      const handler = RegisterHTMLHandler(adapter);
      try {
        const output = new SVG({fontCache: "global", useXlink: false});
        const document = mathjax.document("", {
          InputJax: new TeX({packages: ["base", "ams"], formatError(_jax, error) { throw error; }}),
          OutputJax: output
        });
        const formulas = new Set([...Object.values(mathNotes), ...examples.flatMap(example =>
          Object.values(exampleFormulae(example)).filter(Boolean))]);
        const result = {};
        for (const tex of formulas) {
          const node = await document.convertPromise(tex, {display: false, em: 16, ex: 8});
          result[tex] = adapter.outerHTML(node);
        }
        const glyphs = adapter.outerHTML(output.pageElements(document));
        return "export default " + JSON.stringify({formulas: result, glyphs});
      } finally {
        mathjax.handlers.unregister(handler);
      }
    }
  };
}
