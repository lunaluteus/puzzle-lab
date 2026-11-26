import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { buildGallery, exampleById, examples, limitRays, slice, vertexAngles, wallNames } from "./model.js";
import { drawPlot } from "./plot.js";

const defaultId = "indefinite";
const pretty = value => Number(value.toFixed(4));
const orderLabel = order => order === Infinity ? "∞" : order;
const families = [...new Set(examples.map(model => model.family))];

function initialView() {
  const query = new URLSearchParams(location.search);
  const model = exampleById.get(query.get("model")) ?? exampleById.get(defaultId);
  const budget = query.has("depth") ? Number(query.get("depth")) : model.depth;
  const requested = query.get("word");
  const word = typeof requested === "string" && buildGallery(model).byWord.has(requested) ? requested : "";
  const budgetDepth = Number.isInteger(budget) ? Math.min(budget, model.max) : model.depth;
  const depth = Math.max(word.length, budgetDepth);
  const zoom = Number(query.get("zoom"));
  return { id: model.id, word, depth, zoom: zoom >= 1 && zoom <= 4 ? zoom : 1 };
}

function Plot({model, chambers, word, zoom, choose, cross}) {
  const canvas = useRef(null);
  const pick = useRef(null);
  useLayoutEffect(() => {
    const redraw = () => { pick.current = drawPlot(canvas.current, model, chambers, word, zoom); };
    redraw();
    const observer = new ResizeObserver(redraw);
    observer.observe(canvas.current);
    return () => observer.disconnect();
  }, [model, chambers, word, zoom]);

  return <figure>
    <canvas id="plot" ref={canvas} tabIndex="0"
      aria-label="Coxeter chambers. Click a chamber or press a generator key to cross a wall."
      onPointerDown={event => {
        const box = event.currentTarget.getBoundingClientRect();
        const next = pick.current?.(event.clientX - box.left, event.clientY - box.top);
        if (next !== null && next !== undefined) choose(next);
      }}
      onKeyDown={event => {
        const s = event.key.toLowerCase();
        if (wallNames(model).includes(s)) {
          event.preventDefault();
          cross(s);
        }
      }} />
    <figcaption>
      <span><i className="fundamental" /> Fundamental chamber</span>
      <span><i className="selected" /> Selected chamber</span>
      {(model.family === "Hyperbolic" || limitRays(model)) &&
        <span id="limit-key"><i className="limit" /> Limit boundary</span>}
    </figcaption>
  </figure>;
}

function Controls({model, view, count, neighbors, update, choose, changeModel}) {
  return <aside aria-label="Chamber controls">
    <div className="panel">
      <label htmlFor="model">Coxeter example</label>
      <select id="model" value={model.id} onChange={event => changeModel(event.target.value)}>
        {families.map(family => <optgroup key={family} label={family}>
          {examples.filter(example => example.family === family).map(example =>
            <option key={example.id} value={example.id}>{example.title}</option>)}
        </optgroup>)}
      </select>
      <label className="depth-label" htmlFor="depth">
        Gallery depth <output id="depth-value">{view.depth}</output>
      </label>
      <input id="depth" type="range" min="0" max={model.max} value={view.depth}
        onChange={event => {
          const depth = Number(event.target.value);
          update({depth, word: view.word.length <= depth ? view.word : ""});
        }} />
      <p id="count">{count} {count === 1 ? "chamber" : "chambers"} drawn</p>
      {model.rank === 3 && <>
        <label className="depth-label" htmlFor="zoom">Zoom <output>{view.zoom}×</output></label>
        <input id="zoom" type="range" min="1" max="4" step="0.25" value={view.zoom}
          onChange={event => update({zoom: Number(event.target.value)})} />
      </>}
      <p id="shape">{model.description}</p>
    </div>
    <div className="panel">
      <div className="field-heading">Selected chamber</div>
      <div className="word" id="word" data-word={view.word} aria-live="polite">
        {view.word ? view.word.split("").join(" ") + " C" : "C"}
      </div>
      <p>Coxeter length {view.word.length}</p>
      <div className="walls" aria-label="Cross a wall">
        {wallNames(model).map(wall => <button type="button" key={wall} data-wall={wall}
          disabled={neighbors[wall] === undefined}
          onClick={() => choose(neighbors[wall])}>Cross {wall}</button>)}
      </div>
      <div className="tools"><button type="button" id="home" disabled={!view.word}
        onClick={() => choose("")}>Home chamber</button></div>
      <p>{view.word.length === model.max && model.family !== "Finite dihedral"
        ? "Gallery limit reached. Cross back or select another chamber."
        : "Click a chamber, cross a wall, or focus the plot and use the generator keys."}</p>
    </div>
  </aside>;
}

function Diagram({model}) {
  const vertices = model.rank === 3 ? [[90, 14], [24, 90], [156, 90]] : [[33, 52], [147, 52]];
  const walls = wallNames(model);
  const edges = walls.flatMap((_, i) => walls.slice(i + 1).map((_, k) => [i, i + k + 1]))
    .filter(([i, j]) => model.exponents[i][j] !== 2);
  return <div className="graph" aria-label="Coxeter diagram">
    {edges.map(([i, j]) => {
      const [x, y] = vertices[i], [u, v] = vertices[j];
      const m = model.exponents[i][j];
      return <React.Fragment key={i + "-" + j}>
        <span className={"graph-line" + (m === Infinity ? " dotted" : "")}
          style={{left: x, top: y, width: Math.hypot(u - x, v - y),
            transform: "rotate(" + Math.atan2(v - y, u - x) + "rad)"}} />
        <span className="graph-weight" style={{left: (x + u) / 2, top: (y + v) / 2}}>{orderLabel(m)}</span>
      </React.Fragment>;
    })}
    {walls.map((wall, i) => <span key={wall} className="graph-node"
      style={{left: vertices[i][0], top: vertices[i][1]}}>{wall}</span>)}
  </div>;
}

function Inspector({model}) {
  const walls = wallNames(model);
  const angles = model.rank === 3 ? vertexAngles(model) : null;
  const covector = model.rank === 3 ? slice(model).height : null;
  const signature = {"Finite dihedral": "Positive definite", Affine: "Positive semidefinite",
    Indefinite: "Signature (1, 1)", Hyperbolic: "Signature (2, 1)"};
  const pairs = walls.flatMap((a, i) => walls.slice(i + 1).map((b, k) =>
    "m" + a + b + " = " + orderLabel(model.exponents[i][i + k + 1])));
  return <section className="inspector" aria-label="Coxeter data">
    <div className="panel data">
      <h2>Coxeter diagram</h2>
      <Diagram model={model} />
      <p>{pairs.join(" · ")}</p>
    </div>
    <div className="panel data">
      <h2>Gram matrix</h2>
      <table className="matrix">
        <thead><tr><th scope="col" aria-label="Generator" />{walls.map(w =>
          <th key={w} scope="col">{w}</th>)}</tr></thead>
        <tbody>{model.gram.map((row, i) => <tr key={walls[i]}>
          <th scope="row">{walls[i]}</th>
          {row.map((x, j) => <td key={walls[j]}>{pretty(x)}</td>)}
        </tr>)}</tbody>
      </table>
      <p>{signature[model.family]}</p>
    </div>
    <div className="panel data">
      <h2>{angles ? "Projective slice" : "The dual plane"}</h2>
      {angles ? <>
        <p>Corner angles {angles.map(x => pretty(x * 180 / Math.PI) + "°").join(", ")}</p>
        {model.family === "Hyperbolic" &&
          <p>Hyperbolic area {pretty(Math.PI - angles.reduce((a, b) => a + b, 0))} at curvature −1.</p>}
        <p>Cut each ray at h · x = 1, with h ≈ ({covector.map(pretty).join(", ")}).</p>
      </> : <>
        <p>Axes show x<sub>s</sub> and x<sub>t</sub> in the simple-root dual coordinates.</p>
        {limitRays(model) ? <p>Limit rays
          {" " + limitRays(model).map(ray => "(" + ray.map(pretty).join(", ") + ")").join(" and ")}.</p>
          : <p>Mirror angle π/{model.exponents[0][1]} in the invariant Euclidean metric.</p>}
      </>}
    </div>
  </section>;
}

function Notes() {
  return <details>
    <summary>Coordinates, boundaries, and references</summary>
    <p>Write x<sub>i</sub> = λ(α<sub>i</sub>) for λ in the dual of the simple-root space.
      The closed fundamental chamber C has x<sub>i</sub> ≥ 0, and the Tits cone is the union of wC.
      Crossing wall i of wC takes you to ws<sub>i</sub>C. In the dual coordinates,
      crossing the fundamental i wall sends x<sub>j</sub> to x<sub>j</sub> − 2B<sub>ij</sub>x<sub>i</sub>.</p>
    <p>For a rank-three example, h is the positive unit eigenvector for the smallest eigenvalue of B.
      The slice is Euclidean in affine type and uses the Klein disk in hyperbolic type.
      A hyperbolic boundary point belongs to the sliced cone exactly when it is an ideal vertex of a chamber.
      The dashed boundary indicates the circle or limiting rays. The gallery depth controls how many chambers are drawn.</p>
    <p><a href="https://people.math.osu.edu/davis.12/papers/SurveyKM.pdf">Rémy, Kac–Moody groups, §1.1</a>
      {" · "}<a href="https://personal.math.ubc.ca/~cass/coxeter/R.html">Casselman, Coxeter Groups I</a>
      {" · "}<a href="https://arxiv.org/abs/1305.0052">Hohlweg, Préaux and Ripoll, Lorentzian Coxeter groups</a></p>
  </details>;
}

function App() {
  const [view, setView] = useState(initialView);
  const model = exampleById.get(view.id);
  const graph = buildGallery(model);
  const chambers = useMemo(() => graph.list.filter(chamber => chamber.word.length <= view.depth),
    [graph, view.depth]);
  const neighbors = graph.byWord.get(view.word).neighbors;
  const update = patch => setView(current => ({...current, ...patch}));
  const choose = word => {
    if (word !== undefined) setView(current => ({...current, word, depth: Math.max(current.depth, word.length)}));
  };

  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.set("model", view.id);
    if (view.depth === model.depth) url.searchParams.delete("depth");
    else url.searchParams.set("depth", view.depth);
    if (view.word) url.searchParams.set("word", view.word);
    else url.searchParams.delete("word");
    if (view.zoom === 1) url.searchParams.delete("zoom");
    else url.searchParams.set("zoom", view.zoom);
    history.replaceState(null, "", url);
  }, [view, model]);

  return <main>
    <header>
      <a href="index.html">Puzzle Lab</a>
      <h1>The Tits Cone</h1>
      <p>Reflect chambers in the dual plane, or compare Euclidean and hyperbolic slices.</p>
    </header>
    <div className="viewer">
      <Plot model={model} chambers={chambers} word={view.word} zoom={view.zoom}
        choose={choose} cross={wall => choose(neighbors[wall])} />
      <Controls model={model} view={view} count={chambers.length} neighbors={neighbors}
        update={update} choose={choose} changeModel={id => setView({id, word: "", zoom: 1, depth: exampleById.get(id).depth})} />
    </div>
    <Inspector model={model} />
    <Notes />
  </main>;
}

createRoot(document.getElementById("app")).render(<App />);
