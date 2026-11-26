import React, { Suspense, use, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  affineDihedralProduct, affineProductStrip, braidMoves, buildGallery, couplingLabel, dihedralMetric, dihedralModels,
  dihedralProductModels, exampleById, infiniteDihedralModels, limitRays, maxDihedralOrder, maxTriangleOrder,
  presets, probeRankTwo, sphere, triangleSeries, wallNames
} from "./model.js";
import { exampleFormulae, mathNotes } from "./formulas.js";
import { drawPlot } from "./plot.js";
import { decodeSphereCamera, encodeSphereCamera, rotateSphereCamera, sphereCamera } from "./spherical.js";
import maths from "virtual:coxeter-math";

const defaultId = "indefinite";
const orderLabel = order => order === Infinity ? "∞" : order;
const families = [...new Set(presets.map(model => model.family))];
const rotationKeys = new Map([
  ["ArrowLeft", [-.16, 0]], ["ArrowRight", [.16, 0]], ["ArrowUp", [0, -.16]], ["ArrowDown", [0, .16]]
]);

function decodePoint(value) {
  const coordinates = value?.split(",");
  if (coordinates?.length !== 2) return null;
  const point = coordinates.map(part => part.trim() ? Number(part) : NaN);
  return point.every(coordinate => Math.abs(coordinate) <= Number.MAX_SAFE_INTEGER) ? point : null;
}

function initialView() {
  const query = new URLSearchParams(location.search);
  const model = exampleById.get(query.get("model")) ?? exampleById.get(defaultId);
  const budget = query.has("depth") ? Number(query.get("depth")) : model.depth;
  const {byWord} = buildGallery(model);
  const requested = query.get("word");
  const word = byWord.has(requested) ? requested : "";
  const target = query.get("destination");
  const destination = target && byWord.has(target) ? target : null;
  const budgetDepth = Number.isInteger(budget) ? Math.min(budget, model.max) : model.depth;
  const depth = Math.max(word.length, destination?.length ?? 0, budgetDepth);
  const zoom = Number(query.get("zoom"));
  const camera = model.family === "Spherical" ? decodeSphereCamera(query.get("camera")) : null;
  const projection = model.family === "Hyperbolic" && query.get("projection") === "poincare" ? "poincare" : "klein";
  const coordinates = model.family === "Finite dihedral" && query.get("coordinates") === "euclidean" ? "euclidean" : "dual";
  const point = model.rank === 2 ? decodePoint(query.get("point")) : null;
  return { id: model.id, word, destination, depth, zoom: zoom >= 1 && zoom <= 4 ? zoom : 1, camera, projection, coordinates, point };
}

function viewUrl(view, model, url = new URL(location.href)) {
  url.searchParams.set("model", view.id);
  if (view.depth === model.depth) url.searchParams.delete("depth");
  else url.searchParams.set("depth", view.depth);
  if (view.word) url.searchParams.set("word", view.word);
  else url.searchParams.delete("word");
  if (view.destination) url.searchParams.set("destination", view.destination);
  else url.searchParams.delete("destination");
  if (view.point) url.searchParams.set("point", view.point.join(","));
  else url.searchParams.delete("point");
  if (view.zoom === 1) url.searchParams.delete("zoom");
  else url.searchParams.set("zoom", view.zoom);
  if (view.camera) url.searchParams.set("camera", encodeSphereCamera(view.camera));
  else url.searchParams.delete("camera");
  if (model.family === "Hyperbolic" && view.projection === "poincare") url.searchParams.set("projection", "poincare");
  else url.searchParams.delete("projection");
  if (model.family === "Finite dihedral" && view.coordinates === "euclidean") url.searchParams.set("coordinates", "euclidean");
  else url.searchParams.delete("coordinates");
  return url;
}

function PointProbe({model, point, euclidean, setPoint}) {
  const metric = euclidean ? dihedralMetric(model) : null;
  const displayedPoint = point && metric ? metric.forward(point) : point;
  const coordinateLimit = Number.MAX_SAFE_INTEGER / 2;
  let description = "Click the plane to probe a point. The marker snaps to nearby visible walls and limit rays.";
  if (point) {
    const result = probeRankTwo(model, point);
    switch (result.kind) {
      case "origin": description = "The origin belongs to every closed chamber."; break;
      case "outside": description = "Outside the Tits cone."; break;
      case "limit": description = "At the limit boundary to plotting precision. Limit rays are excluded from the Tits cone."; break;
      case "inside":
        if (result.distance === null) description = "Inside the Tits cone, close to its limit boundary.";
        else description = (result.onWall ? "On a chamber wall." : "Inside the Tits cone.")
          + " Gallery distance " + result.distance + ".";
        break;
    }
  }
  return <>
    <p className="point-probe" role="status">
      {displayedPoint && <b>({displayedPoint.map(x => Number(x.toFixed(3))).join(", ")}) · </b>}{description}
    </p>
    <form className="probe-controls" aria-label="Probe coordinates" key={euclidean ? "euclidean" : "dual"}
      onSubmit={event => {
        event.preventDefault();
        const fields = event.currentTarget.elements;
        const next = [fields.namedItem("x").valueAsNumber, fields.namedItem("y").valueAsNumber];
        setPoint(metric ? metric.inverse(next) : next);
      }} onReset={() => setPoint(null)}>
      <label>{euclidean ? "X" : "xₛ"}
        <input name="x" type="number" step="any" required min={-coordinateLimit} max={coordinateLimit} />
      </label>
      <label>{euclidean ? "Y" : "xₜ"}
        <input name="y" type="number" step="any" required min={-coordinateLimit} max={coordinateLimit} />
      </label>
      <button type="submit">Probe point</button>
      <button type="reset" disabled={!point}>Clear point</button>
    </form>
  </>;
}

function Plot({model, chambers, word, zoom, camera, projection, coordinates, point, setPoint, setCamera, choose, cross, neighbors}) {
  const canvas = useRef(null);
  const pick = useRef(null);
  const drag = useRef(null);
  const [previewCamera, setPreviewCamera] = useState(null);
  const [plotWalls, setPlotWalls] = useState([]);
  const affineProduct = model === affineDihedralProduct;
  const spherical = model.family === "Spherical";
  const euclidean = model.family === "Finite dihedral" && coordinates === "euclidean";
  const plotCamera = previewCamera ?? camera;

  useLayoutEffect(() => {
    const redraw = () => {
      pick.current = drawPlot(canvas.current, model, chambers, word, {
        zoom, point, camera: plotCamera, projection, coordinates, onWalls: affineProduct ? setPlotWalls : undefined
      });
    };
    redraw();
    const observer = new ResizeObserver(redraw);
    observer.observe(canvas.current);
    return () => observer.disconnect();
  }, [model, chambers, word, zoom, point, plotCamera, projection, coordinates, affineProduct]);

  const centeredCamera = () => sphereCamera(chambers.find(chamber => chamber.word === word).rays.map(sphere(model)));

  function selectAt(event) {
    const box = event.currentTarget.getBoundingClientRect();
    const hit = pick.current?.(event.clientX - box.left, event.clientY - box.top);
    if (hit?.point) setPoint(hit.point);
    if (typeof hit?.word === "string") choose(hit.word);
  }

  function endDrag(event) {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    setPreviewCamera(null);
  }

  return <figure>
    <canvas id="plot" ref={canvas} tabIndex="0"
      className={spherical ? "sphere" : model.rank === 1 ? "dual-line" : undefined}
      data-dragging={previewCamera !== null}
      aria-label={spherical
        ? "Coxeter chambers. Drag or use the arrow keys to rotate. Tap or click to select."
        : "Coxeter chambers. Click a chamber or press a generator key to cross a wall."}
      onPointerDown={event => {
        if (!event.isPrimary || event.button !== 0) return;
        if (!spherical) return selectAt(event);
        const {width, height} = event.currentTarget.getBoundingClientRect();
        drag.current = {id: event.pointerId, x: event.clientX, y: event.clientY,
          scale: 3 / Math.min(width, height), basis: camera ?? centeredCamera(), moved: false};
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        const active = drag.current;
        if (!active || active.id !== event.pointerId) return;
        const dx = event.clientX - active.x, dy = event.clientY - active.y;
        if (!active.moved && Math.hypot(dx, dy) < 4) return;
        active.moved = true;
        setPreviewCamera(rotateSphereCamera(active.basis, dx * active.scale, dy * active.scale));
      }}
      onPointerUp={event => {
        const active = drag.current;
        if (!active || active.id !== event.pointerId) return;
        const dx = event.clientX - active.x, dy = event.clientY - active.y;
        if (active.moved || Math.hypot(dx, dy) >= 4) {
          setCamera(rotateSphereCamera(active.basis, dx * active.scale, dy * active.scale));
        } else selectAt(event);
        endDrag(event);
      }}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onKeyDown={event => {
        const rotation = spherical && rotationKeys.get(event.key);
        if (rotation) {
          event.preventDefault();
          setCamera(rotateSphereCamera(camera ?? centeredCamera(), ...rotation));
          return;
        }
        const s = event.key.toLowerCase();
        if (wallNames(model).includes(s)) {
          event.preventDefault();
          cross(s);
        }
      }} />
    {plotWalls.map(({wall, x, y}) => <button className="plot-wall" type="button" key={wall}
      style={{left: x, top: y}} aria-label={"Cross wall " + wall + " on the plot"}
      disabled={neighbors[wall] === undefined} onClick={() => cross(wall)}>{wall}</button>)}
    <figcaption>
      <span><i className="fundamental" /> Fundamental chamber</span>
      <span><i className="selected" /> Selected chamber</span>
      {(model.family === "Hyperbolic" || limitRays(model)) &&
        <span id="limit-key"><i className="limit" /> Limit boundary</span>}
      {spherical && <span className="sphere-controls">
        Drag or use arrow keys to rotate.
        <button type="button" disabled={!camera} onClick={() => setCamera(null)}>Center on selection</button>
      </span>}
    </figcaption>
    {model.rank === 2 && <PointProbe model={model} point={point} euclidean={euclidean} setPoint={setPoint} />}
  </figure>;
}

function GallerySteps({route, byWord, word, label, onStep}) {
  const steps = [""];
  for (const wall of route) steps.push(byWord.get(steps.at(-1)).neighbors[wall]);
  const current = steps.indexOf(word);
  return <>
    <ol className="gallery-steps" role="list" aria-label={label}>
      {steps.map((step, i) => <li key={step}>
        <button type="button" aria-current={step === word ? "step" : undefined}
          aria-label={step ? "Step " + i + ", " + step.split("").join(" ") + " C" : "Fundamental chamber C"}
          onClick={() => onStep(step)}>{route[i - 1] ?? "C"}</button>
      </li>)}
    </ol>
    <div className="tools" role="group" aria-label={label + " navigation"}>
      <button type="button" disabled={current <= 0} onClick={() => onStep(steps[current - 1])}>Previous</button>
      <button type="button" disabled={current === steps.length - 1} onClick={() => onStep(steps[current + 1])}>
        {current < 0 ? "Start route" : "Next"}
      </button>
    </div>
  </>;
}

function CopyRouteLink({href}) {
  const [status, setStatus] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(href);
      setStatus("copied");
    } catch {
      setStatus("manual");
    }
  }
  return <>
    <div className="tools">
      <button type="button" onClick={copy}>Copy route link</button>
      <span role="status">{status === "copied" ? "Link copied. The route opens at C."
        : status === "manual" ? "Select and copy the URL below." : ""}</span>
    </div>
    {status === "manual" && <input className="route-link" aria-label="Route URL" readOnly value={href}
      onFocus={event => event.currentTarget.select()} />}
  </>;
}

function ShortestGallery({model, word, destination, followingGallery, onStep, routeHref}) {
  const details = useRef(null);
  useEffect(() => {
    if (followingGallery && details.current) details.current.open = true;
  }, [followingGallery]);
  if (!destination) return null;
  const {byWord} = buildGallery(model);
  const {value: alternative} = braidMoves(destination, model).next();
  const translation = model === affineDihedralProduct && (destination === "st" || destination === "ts");
  return <details className="gallery-route" ref={details}>
    <summary>Shortest gallery</summary>
    <GallerySteps route={destination} byWord={byWord} word={word} label="Shortest route" onStep={onStep} />
    {alternative ? <>
      <p>The braid relation <code>{destination.slice(alternative.index, alternative.index + alternative.length)}</code>
        {" = "}<code>{alternative.word.slice(alternative.index, alternative.index + alternative.length)}</code>
        {" "}gives another route to the same chamber in the same number of steps.</p>
      <GallerySteps route={alternative.word} byWord={byWord} word={word} label="Alternate shortest route" onStep={onStep} />
      {model === affineDihedralProduct && (destination === "su" || destination === "tu") &&
        <p>One step crosses a vertical wall and the other crosses xᵤ = 0. Try both routes to see the
          same endpoint via different half-strips.</p>}
    </> : translation ? <p>Follow the two wall crossings from <var>C</var>. Together they translate the
      starting chamber two units {destination === "st" ? "left" : "right"}.</p>
      : <p>Each letter crosses one wall.</p>}
    <CopyRouteLink key={routeHref} href={routeHref} />
  </details>;
}

function GalleryGrowth({counts, depth, changeDepth}) {
  const peak = Math.max(...counts);
  const labels = counts.map((count, length) =>
    "Length " + length + ", " + count + (count === 1 ? " chamber" : " chambers"));
  return <details className="gallery-growth">
    <summary>Chambers by length</summary>
    <p>Choose a bar to set the gallery depth.</p>
    <p aria-live="polite">{labels[depth]}</p>
    <div className="growth-chart" role="radiogroup" aria-label="Gallery depth by word length">
      {counts.map((count, length) => <label key={length} className="growth-column" title={labels[length]}>
        <input type="radio" name="growth-depth" value={length} checked={length === depth}
          aria-label={labels[length]} onChange={() => changeDepth(length)} />
        <span className="growth-bar" aria-hidden="true"
          style={{height: count ? "max(1px, " + 100 * count / peak + "%)" : 0}} />
      </label>)}
    </div>
    <div className="growth-axis" aria-hidden="true"><span>0</span><span>Word length</span><span>{counts.length - 1}</span></div>
  </details>;
}

function Controls({model, view, count, countsByLength, neighbors, update, choose, changeModel, changeCoupling}) {
  const destination = view.destination ?? view.word;
  const routeHref = destination ? viewUrl({...view, word: "", destination, camera: null, point: null},
    model, new URL(location.pathname, location.href)).href : null;
  const changeDepth = depth => update({
    depth,
    word: view.word.length <= depth ? view.word : "",
    destination: view.destination?.length <= depth ? view.destination : null
  });
  return <aside aria-label="Chamber controls">
    <div className="panel">
      <label htmlFor="model">Coxeter example</label>
      <select id="model" value={model.id} onChange={event => changeModel(event.target.value)}>
        {families.map(family => <optgroup key={family} label={family}>
          {presets.filter(example => example.family === family).map(example =>
            <option key={example.id} value={example.id}>{example.title}</option>)}
          {model.family === family && !presets.includes(model) &&
            <option value={model.id}>{model.title}</option>}
        </optgroup>)}
      </select>
      {model.family === "Finite dihedral" && <>
        <label className="depth-label" htmlFor="dihedral-order">Order of st</label>
        <select id="dihedral-order" value={model.id} onChange={event => changeModel(event.target.value)}>
          {dihedralModels.map(example => <option key={example.id} value={example.id}>{example.exponents[0][1]}</option>)}
        </select>
        <label className="depth-label" htmlFor="coordinates">Coordinates</label>
        <select id="coordinates" value={view.coordinates} onChange={event => update({coordinates: event.target.value})}>
          <option value="dual">Simple-root dual</option>
          <option value="euclidean">Invariant Euclidean</option>
        </select>
      </>}
      {model.coupling && <>
        <label className="depth-label" htmlFor="coupling">Gram coupling c</label>
        <select id="coupling" value={model.id} onChange={event => changeCoupling(event.target.value)}>
          {infiniteDihedralModels.map(example => <option key={example.id} value={example.id}>
            {couplingLabel(example.coupling)}
          </option>)}
        </select>
      </>}
      {triangleSeries.includes(model) && <>
        <label className="depth-label" htmlFor="triangle-order">Order m in (2, 3, m)</label>
        <select id="triangle-order" value={model.id} onChange={event => changeModel(event.target.value)}>
          {triangleSeries.map(example => <option key={example.id} value={example.id}>
            {orderLabel(example.exponents[0][2])}
          </option>)}
        </select>
      </>}
      {dihedralProductModels.includes(model) && <>
        <label className="depth-label" htmlFor="product-order">Order of st</label>
        <select id="product-order" value={model.id} onChange={event => changeModel(event.target.value)}>
          {dihedralProductModels.map(example => <option key={example.id} value={example.id}>
            {orderLabel(example.exponents[0][1])}
          </option>)}
        </select>
      </>}
      <label className="depth-label" htmlFor="depth">
        Gallery depth <output id="depth-value">{view.depth}</output>
      </label>
      <input id="depth" type="range" min="0" max={model.max} value={view.depth}
        onChange={event => changeDepth(Number(event.target.value))} />
      <p id="count">{count} {count === 1 ? "chamber" : "chambers"}
        {model.family === "Spherical" ? " in gallery" : " drawn"}</p>
      <GalleryGrowth counts={countsByLength} depth={view.depth} changeDepth={changeDepth} />
      {model.rank === 3 && <>
        <label className="depth-label" htmlFor="zoom">Zoom <output>{view.zoom}×</output></label>
        <input id="zoom" type="range" min="1" max="4" step="0.25" value={view.zoom}
          onChange={event => update({zoom: Number(event.target.value)})} />
      </>}
      {model.family === "Hyperbolic" && <div className="projection-control">
        <label htmlFor="projection">Disk model</label>
        <select id="projection" value={view.projection} onChange={event => update({projection: event.target.value})}>
          <option value="klein">Klein</option>
          <option value="poincare">Poincaré</option>
        </select>
      </div>}
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
      {model === affineDihedralProduct && <p>
        <a href="?model=a1-i2-infinity&amp;destination=st">Trace the st translation</a>
        {" · "}<a href="?model=a1-i2-infinity&amp;destination=su">Compare su and us</a>
      </p>}
      <ShortestGallery model={model} word={view.word} destination={destination} followingGallery={Boolean(view.destination)}
        onStep={word => update({word, destination})} routeHref={routeHref} />
      <p>{view.word.length === model.max && !["Finite line", "Finite dihedral", "Spherical"].includes(model.family)
        ? "Gallery limit reached. Cross back or select another chamber."
        : "Click a chamber, cross a wall, or focus the plot and use the generator keys."}</p>
    </div>
  </aside>;
}

function Diagram({model}) {
  const vertices = model.rank === 3 ? [[90, 14], [24, 90], [156, 90]]
    : model.rank === 2 ? [[33, 52], [147, 52]] : [[90, 52]];
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

function FormulaMarkup({latex, label, html}) {
  return <span className="formula" role="math" data-tex={latex}
    aria-label={label ? label + " " + latex : latex}
    dangerouslySetInnerHTML={html ? {__html: html} : undefined}>{html ? null : latex}</span>;
}

const deferredCatalogs = new Map(Object.entries(maths.deferred));
const catalogImports = {
  "virtual:coxeter-extra-math": () => import("virtual:coxeter-extra-math"),
  "virtual:coxeter-triangle-math": () => import("virtual:coxeter-triangle-math"),
  "virtual:coxeter-product-math": () => import("virtual:coxeter-product-math")
};
const catalogRequests = new Map();
function SupplementalFormula({catalog, ...props}) {
  if (!catalogRequests.has(catalog)) {
    catalogRequests.set(catalog, catalogImports[catalog]().then(module => module.default, () => ({})));
  }
  const formulas = use(catalogRequests.get(catalog));
  return <FormulaMarkup {...props} html={formulas[props.latex]} />;
}

function Formula(props) {
  const html = maths.formulas[props.latex];
  const catalog = deferredCatalogs.get(props.latex);
  if (html || !catalog) return <FormulaMarkup {...props} html={html} />;
  return <Suspense fallback={<FormulaMarkup {...props} />}>
    <SupplementalFormula {...props} catalog={catalog} />
  </Suspense>;
}

function Inspector({model, coordinates, chamber}) {
  const {relations, matrix, eigenvalues, angles, angleSum, area, covector, angle} = exampleFormulae(model);
  const spherical = model.family === "Spherical";
  const strip = model === affineDihedralProduct ? affineProductStrip(chamber) : null;
  const signature = {"Finite line": "Positive definite", "Finite dihedral": "Positive definite", Spherical: "Positive definite",
    Affine: "Positive semidefinite", Indefinite: "Signature (1, 1)", Hyperbolic: "Signature (2, 1)"};
  return <section className="inspector" aria-label="Coxeter data">
    <div className="panel data">
      <h2>Coxeter diagram</h2>
      <Diagram model={model} />
      <p><Formula latex={relations} /></p>
    </div>
    <div className="panel data">
      <h2>Gram matrix</h2>
      <div className="matrix"><Formula latex={matrix} label="Exact Gram matrix" /></div>
      <p>{signature[model.family]}. Generator order {wallNames(model).join(", ")}.</p>
      {eigenvalues && <p>Eigenvalues <Formula latex={eigenvalues} label="Gram eigenvalues" />.</p>}
    </div>
    <div className="panel data">
      <h2>{spherical ? "Sphere of rays" : angles || strip ? "Projective slice" : model.rank === 1 ? "The dual line" : "The dual plane"}</h2>
      {model.rank === 1 ? <p>The positive half-line is the fundamental chamber. Reflecting across zero gives the other half-line. Both include zero.</p>
      : strip ? <>
        <p>Slice <Formula latex={mathNotes.affineProductSlice} /> in coordinates <Formula latex={mathNotes.affineProductAxes} />.</p>
        <p>In the selected chamber, {strip.left} ≤ xₛ ≤ {strip.right} and xᵤ {strip.above ? "≥" : "≤"} 0.</p>
        <p>The left wall is <var>{strip.sOnLeft ? "s" : "t"}</var>, the right wall is <var>{strip.sOnLeft ? "t" : "s"}</var>,
          and the wall at xᵤ = 0 is <var>u</var>.</p>
        <p>The Tits cone consists of <Formula latex={mathNotes.affineProductPositiveHeight} /> and
          the line <Formula latex={mathNotes.affineProductLine} /> at height zero.</p>
      </>
      : angles ? <>
        <p>Intrinsic corner angles <Formula latex={angles} /></p>
        <p>Angle sum <Formula latex={angleSum} label="Triangle angle sum" />.</p>
        {model.family === "Hyperbolic" &&
          <p>Hyperbolic area <Formula latex={area} /> at curvature −1.</p>}
        {spherical && <p>Area on the unit sphere <Formula latex={area} /> sr.</p>}
        {covector && <p>Slice <Formula latex={mathNotes.slice} /> with <Formula latex={covector} />.</p>}
      </> : <>
        {angle && coordinates === "euclidean"
          ? <p>The axes are orthonormal for the dual metric <Formula latex={mathNotes.sphere} />.</p>
          : <p>Axes show <Formula latex={mathNotes.axes} /> in simple-root dual coordinates.</p>}
        {angle ? <p>Mirror angle <Formula latex={angle} /> in the invariant Euclidean metric.</p>
          : <p>Limit rays <Formula latex={mathNotes.limit} />.</p>}
      </>}
    </div>
  </section>;
}

function Notes({notesRef}) {
  useEffect(() => {
    function followNotesLink() {
      const hash = location.hash;
      if (hash !== "#notes" && hash !== "#classification") return;
      const notes = notesRef.current;
      notes.open = true;
      const target = hash === "#notes" ? notes : notes.querySelector("#classification");
      target.scrollIntoView();
    }
    followNotesLink();
    window.addEventListener("hashchange", followNotesLink);
    return () => window.removeEventListener("hashchange", followNotesLink);
  }, [notesRef]);

  return <details id="notes" ref={notesRef}>
    <summary>Notes on Coxeter groups and the Tits cone</summary>
    <h2 id="classification">Classification through rank three</h2>
    <p>The rank is the number of simple reflections. The label on a pair gives the order
      of their product. A label of 2 means the reflections commute, so the diagram omits that edge.
      An irreducible system has a connected diagram.</p>
    <p><strong>Rank one.</strong> A₁ consists of a single reflection and the identity.
      Its chambers are the two closed half-lines. <a href="?model=a1">Try A₁</a>.</p>
    <p><strong>Rank two.</strong> The single label determines the dihedral system <Formula latex={mathNotes.dihedral} />.
      The order selector lets you explore <Formula latex={mathNotes.dihedralOrders} />.
      Choose invariant Euclidean coordinates to see the chambers as sectors of equal angle.
      With <Formula latex={mathNotes.infiniteDihedral} />, the same infinite dihedral group has realizations
      with different Gram entries <Formula latex={mathNotes.dihedralCoupling} />.
      The Gram eigenvalues are <Formula latex={mathNotes.couplingEigenvalues} />. One vanishes at c = 1.
      The coupling selector varies c from 1 to 2 in steps of 1/20. A probed point stays fixed in dual coordinates as c changes.
      At c = 1, the Tits cone is an open half-plane together with the origin.
      At c &gt; 1, it is an open wedge together with the origin, and its opening angle depends on c.</p>
    <p>Probe the same point (1, −0.6) in two realizations of the infinite dihedral group. It lies
      inside <a href="?model=affine&amp;point=1,-0.6">the half-plane at c = 1</a> and outside
      {" "}<a href="?model=i2-infinity-5-4&amp;point=1,-0.6">the wedge at c = 5/4</a>.
      In the wedge, <a href="?model=i2-infinity-5-4&amp;point=1,-0.5">(1, −0.5) lies on a limit ray</a>,
      which is excluded from the cone.</p>
    <p><strong>Rank three.</strong> The three labels <Formula latex={mathNotes.triangleOrders} /> determine
      the system up to relabeling. For a connected diagram in the standard realization,
      compare <Formula latex={mathNotes.reciprocalSum} /> to 1, with <Formula latex={mathNotes.reciprocalInfinity} />.
      The angle sum shown in the inspector is π times this fraction.</p>
    <ul>
      <li><strong>Above 1.</strong> Spherical. The three irreducible types are A₃, B₃, and H₃, all available here.
        {" "}<a href="?model=h3">Try H₃</a>.</li>
      <li><strong>Equal to 1.</strong> Euclidean. The three irreducible affine types are Ã₂, C̃₂, and G̃₂, all available here.
        {" "}<a href="?model=affine2">Try Ã₂</a>.</li>
      <li><strong>Below 1.</strong> Hyperbolic. There are infinitely many triples. The seven presets include compact
        triangles and triangles with ideal vertices. An ∞ label gives an ideal vertex with angle zero.
        {" "}<a href="?model=one-cusp">Try (2, 3, ∞)</a>.</li>
    </ul>
    <p>The <Formula latex={mathNotes.triangleSeries} /> series passes from spherical to Euclidean at m = 6
      and to hyperbolic at m = 7. The order selector runs from 3 through {maxTriangleOrder}, with ∞ for the ideal corner.
      {" "}<a href="?model=b3">Start at m = 4 and change the third order</a>.</p>
    <p>Disconnected diagrams give direct products. The rank-three products have the form
      <Formula latex={mathNotes.product} />, where m can also be infinite.
      For the finite products, the selector varies the order m of st from 2 through {maxDihedralOrder}.
      In the m = 5 example, the diagram shows the two dihedral generators joined
      by a 5 edge. The isolated generator <var>u</var> reflects one hemisphere
      onto the other, with ten chambers on each side. <a href="?model=a1-i25">Try A₁ × I₂(5)</a>.
      The m = 2 example has three isolated generators. <a href="?model=a1-cubed">Try A₁ × A₁ × A₁</a>.
      At m = ∞, dihedral chambers become unit intervals on <Formula latex={mathNotes.affineProductSlice} />.
      Taking their product with the positive and negative half-lines gives a tiling by half-strips.
      {" "}<a href="?model=a1-i2-infinity">Try A₁ × I₂(∞)</a>.</p>
    <p>On that slice, the vertical mirrors act by <Formula latex={mathNotes.affineProductReflections} /> and
      keep xᵤ fixed. Composing from right to left gives <Formula latex={mathNotes.affineProductTranslations} />.
      In the gallery, each letter names a wall of the current chamber. From <var>C</var>, crossing{" "}
      <var>s</var> then <var>t</var> reaches <var>stC</var>.
      {" "}<a href="?model=a1-i2-infinity&amp;destination=st">Trace st to the left</a>
      {" or "}<a href="?model=a1-i2-infinity&amp;destination=ts">trace ts to the right</a>.</p>
    <p>The horizontal mirror acts by <Formula latex={mathNotes.affineProductFlip} /> and keeps xₛ fixed.
      The vertical mirrors leave xᵤ fixed, so these actions commute with <var>u</var>.
      {" "}<a href="?model=a1-i2-infinity&amp;destination=su">Compare the su and us routes</a>.</p>
    <p><a href="https://personal.math.ubc.ca/~cass/coxeter/crm1.html">Casselman on rank two and rank three</a>
      {" · "}<a href="https://people.math.osu.edu/davis.12/old_papers/djs2.pdf">Davis, Januszkiewicz and Scott on triangle groups, §7.3</a></p>
    <h2>Coordinates and boundaries</h2>
    <p>Write <Formula latex={mathNotes.coordinate} /> in the dual of the simple-root space.
      The fundamental chamber is <Formula latex={mathNotes.chamber} />, and the Tits cone is <Formula latex={mathNotes.cone} />.
      Crossing wall i gives <Formula latex={mathNotes.crossing} />.
      The fundamental reflection acts by <Formula latex={mathNotes.reflection} />.</p>
    <p>For a finite rank-three example, normalize each positive ray using the dual metric <Formula latex={mathNotes.sphere} />.
      The resulting unit sphere is tiled by spherical triangles. The drawing shows one hemisphere.
      For affine and hyperbolic triangle examples, h is the positive unit eigenvector for the smallest eigenvalue of B.
      The slice <Formula latex={mathNotes.slice} /> is Euclidean in affine type and gives the Klein disk in hyperbolic type.
      A hyperbolic boundary point belongs to the sliced cone exactly when it is an ideal vertex of a chamber.
      The dashed boundary indicates the circle or limiting rays. The gallery depth controls how many chambers are drawn.</p>
    <p>Klein geodesics appear as straight chords. At an interior point p, measure angles using the
      hyperbolic inner product <Formula latex={mathNotes.kleinMetric} />.
      Switch to the Poincaré disk to see the same chambers with their angles preserved.
      The geodesics there are diameters or circular arcs orthogonal to the boundary.
      {" "}<a href="?model=hurwitz&projection=poincare">Try the (2, 3, 7) triangle in Poincaré coordinates</a>.</p>
    <p><a href="https://people.math.osu.edu/davis.12/papers/SurveyKM.pdf">Rémy, Kac–Moody groups, §1.1</a>
      {" · "}<a href="https://personal.math.ubc.ca/~cass/coxeter/R.html">Casselman, Coxeter Groups I</a>
      {" · "}<a href="https://arxiv.org/abs/1305.0052">Hohlweg, Préaux and Ripoll, Lorentzian Coxeter groups</a>
      {" · "}<a href="https://brice.loustau.eu/ressources/book.pdf">Loustau, Hyperbolic geometry, §§8.2–10.1</a></p>
  </details>;
}

function App() {
  const [view, setView] = useState(initialView);
  const notes = useRef(null);
  const model = exampleById.get(view.id);
  const graph = buildGallery(model);
  const chambers = useMemo(() => graph.list.filter(chamber => chamber.word.length <= view.depth),
    [graph, view.depth]);
  const chamber = graph.byWord.get(view.word);
  const {neighbors} = chamber;
  const update = patch => setView(current => ({...current, ...patch}));
  const choose = word => {
    if (word !== undefined) setView(current => ({
      ...current, word, depth: Math.max(current.depth, word.length), destination: null
    }));
  };
  const changeCoupling = id => {
    const maximum = exampleById.get(id).max;
    setView(current => ({
      ...current, id, word: current.word.slice(0, maximum), depth: Math.min(current.depth, maximum), destination: null
    }));
  };

  useEffect(() => {
    const url = viewUrl(view, model);
    if (url.href !== location.href) history.replaceState(null, "", url);
  }, [view, model]);

  return <main>
    <header>
      <nav className="page-links" aria-label="Page links">
        <a href="index.html">Puzzle Lab</a>
        <a href="#notes" onClick={event => {
          if (!(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) notes.current.open = true;
        }}>Notes</a>
      </nav>
      <h1>The Tits Cone</h1>
      <p>Reflect chambers on a line, in the dual plane, on the sphere of rays, and in Euclidean or hyperbolic slices.</p>
    </header>
    <div className="viewer">
      <Plot key={model.id} model={model} chambers={chambers} word={view.word} zoom={view.zoom}
        camera={view.camera} projection={view.projection} coordinates={view.coordinates} point={view.point}
        setPoint={point => update({point})} setCamera={camera => update({camera})}
        choose={choose} cross={wall => choose(neighbors[wall])} neighbors={neighbors} />
      <Controls model={model} view={view} count={chambers.length} countsByLength={graph.countsByLength} neighbors={neighbors}
        update={update} choose={choose} changeCoupling={changeCoupling}
        changeModel={id => setView({id, word: "", zoom: 1, depth: exampleById.get(id).depth, camera: null, point: null,
          projection: view.projection, coordinates: view.coordinates})} />
    </div>
    <Inspector model={model} coordinates={view.coordinates} chamber={chamber} />
    <Notes notesRef={notes} />
  </main>;
}

createRoot(document.getElementById("app")).render(<>
  <div aria-hidden="true" dangerouslySetInnerHTML={{__html: maths.glyphs}} />
  <App />
</>);
