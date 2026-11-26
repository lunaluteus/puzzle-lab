import { mathjax } from "@mathjax/src/js/mathjax.js";
import { liteAdaptor } from "@mathjax/src/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "@mathjax/src/js/handlers/html.js";
import { TeX } from "@mathjax/src/js/input/tex.js";
import { SVG } from "@mathjax/src/js/output/svg.js";
import "@mathjax/src/js/input/tex/base/BaseConfiguration.js";
import "@mathjax/src/js/input/tex/ams/AmsConfiguration.js";
import "@mathjax/src/js/util/asyncLoad/esm.js";
import { examples, presets, triangleSeries } from "../src/coxeter/model.js";
import { exampleFormulae, mathNotes } from "../src/coxeter/formulas.js";

const virtualId = "virtual:coxeter-math";
const supplementalId = "virtual:coxeter-extra-math";
const triangleId = "virtual:coxeter-triangle-math";
const moduleIds = new Set([virtualId, supplementalId, triangleId]);

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
    const deferred = new Set(collect(examples.filter(example => !triangleSeries.includes(example))));
    const formulas = new Set([...initial, ...deferred, ...collect(triangleSeries)]);
    const standard = {}, supplemental = {}, triangles = {};
    for (const tex of formulas) {
      const node = await document.convertPromise(tex, {display: false, em: 16, ex: 8});
      const target = initial.has(tex) ? standard : deferred.has(tex) ? supplemental : triangles;
      target[tex] = adapter.outerHTML(node);
    }
    // Both deferred modules reference the glyph cache with the initial formulas.
    const glyphs = adapter.outerHTML(output.pageElements(document));
    return {
      [virtualId]: {formulas: standard, glyphs, triangleFormulaKeys: Object.keys(triangles)},
      [supplementalId]: supplemental,
      [triangleId]: triangles
    };
  } finally {
    mathjax.handlers.unregister(handler);
  }
}

export function coxeterMath() {
  let compilation;
  return {
    name: "coxeter-mathjax",
    resolveId(id) {
      return moduleIds.has(id) ? "\0" + id : null;
    },
    async load(id) {
      if (!id?.startsWith("\0") || !moduleIds.has(id.slice(1))) return null;
      const modules = await (compilation ??= typeset());
      return "export default " + JSON.stringify(modules[id.slice(1)]);
    }
  };
}
