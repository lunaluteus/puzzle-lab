import { mathjax } from "@mathjax/src/js/mathjax.js";
import { liteAdaptor } from "@mathjax/src/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "@mathjax/src/js/handlers/html.js";
import { TeX } from "@mathjax/src/js/input/tex.js";
import { SVG } from "@mathjax/src/js/output/svg.js";
import "@mathjax/src/js/input/tex/base/BaseConfiguration.js";
import "@mathjax/src/js/input/tex/ams/AmsConfiguration.js";
import "@mathjax/src/js/util/asyncLoad/esm.js";
import { examples, presets } from "../src/coxeter/model.js";
import { exampleFormulae, mathNotes } from "../src/coxeter/formulas.js";

const virtualId = "virtual:coxeter-math";
const supplementalId = "virtual:coxeter-extra-math";

async function typeset() {
  const adapter = liteAdaptor({fontSize: 16});
  const handler = RegisterHTMLHandler(adapter);
  try {
    const output = new SVG({fontCache: "global", useXlink: false});
    const document = mathjax.document("", {
      InputJax: new TeX({packages: ["base", "ams"], formatError(_jax, error) { throw error; }}),
      OutputJax: output
    });
    const collect = models => models.flatMap(example => Object.values(exampleFormulae(example)).filter(Boolean));
    const initial = new Set([...Object.values(mathNotes), ...collect(presets)]);
    const formulas = new Set([...initial, ...collect(examples)]);
    const standard = {}, supplemental = {};
    for (const tex of formulas) {
      const node = await document.convertPromise(tex, {display: false, em: 16, ex: 8});
      const target = initial.has(tex) ? standard : supplemental;
      target[tex] = adapter.outerHTML(node);
    }
    // Both modules reference the glyph cache included with the initial formulas.
    const glyphs = adapter.outerHTML(output.pageElements(document));
    return {standard: {formulas: standard, glyphs}, supplemental};
  } finally {
    mathjax.handlers.unregister(handler);
  }
}

export function coxeterMath() {
  let compilation;
  return {
    name: "coxeter-mathjax",
    resolveId(id) {
      return id === virtualId || id === supplementalId ? "\0" + id : null;
    },
    async load(id) {
      const main = id === "\0" + virtualId;
      if (!main && id !== "\0" + supplementalId) return null;
      const {standard, supplemental} = await (compilation ??= typeset());
      return "export default " + JSON.stringify(main ? standard : supplemental);
    }
  };
}
