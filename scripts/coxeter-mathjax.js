import { mathjax } from "@mathjax/src/js/mathjax.js";
import { liteAdaptor } from "@mathjax/src/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "@mathjax/src/js/handlers/html.js";
import { TeX } from "@mathjax/src/js/input/tex.js";
import { SVG } from "@mathjax/src/js/output/svg.js";
import "@mathjax/src/js/input/tex/base/BaseConfiguration.js";
import "@mathjax/src/js/input/tex/ams/AmsConfiguration.js";
import "@mathjax/src/js/util/asyncLoad/esm.js";
import { dihedralProductModels, examples, presets, triangleSeries, triangleSeriesWithFour, twoCuspSeries } from "../src/coxeter/model.js";
import { exampleFormulae, inspectorMath, mathNotes } from "../src/coxeter/formulas.js";

const virtualId = "virtual:coxeter-math";
const supplementalId = "virtual:coxeter-extra-math";
const triangleId = "virtual:coxeter-triangle-math";
const triangleFourId = "virtual:coxeter-triangle-24-math";
const cuspId = "virtual:coxeter-two-cusp-math";
const productId = "virtual:coxeter-product-math";
const notesId = "virtual:coxeter-notes-math";
const moduleIds = new Set([virtualId, supplementalId, triangleId, triangleFourId, cuspId, productId, notesId]);

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
    const separatelyLoaded = new Set([...triangleSeries, ...triangleSeriesWithFour, ...twoCuspSeries, ...dihedralProductModels]);
    const groups = [
      [triangleId, collect(triangleSeries)],
      [triangleFourId, collect(triangleSeriesWithFour)],
      [cuspId, collect(twoCuspSeries)],
      [productId, collect(dihedralProductModels)],
      [notesId, Object.values(mathNotes)],
      [supplementalId, collect(examples.filter(example => !separatelyLoaded.has(example)))]
    ];
    const initial = [...Object.values(inspectorMath), ...collect(presets)];
    const owner = new Map(initial.map(tex => [tex, virtualId]));
    for (const [id, formulas] of groups) {
      for (const tex of new Set(formulas)) {
        // Keep shared formulas with the presets so opening one series needs only its own deferred module.
        owner.set(tex, owner.has(tex) ? virtualId : id);
      }
    }
    const modules = Object.fromEntries([...moduleIds].map(id => [id, {}]));
    for (const [tex, id] of owner) {
      const node = await document.convertPromise(tex, {display: false, em: 16, ex: 8});
      modules[id][tex] = adapter.outerHTML(node);
    }
    // Every module references the glyph cache with the initial formulas.
    const glyphs = adapter.outerHTML(output.pageElements(document));
    const deferred = Object.fromEntries([...owner].filter(([, id]) => id !== virtualId));
    modules[virtualId] = {formulas: modules[virtualId], glyphs, deferred};
    return modules;
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
