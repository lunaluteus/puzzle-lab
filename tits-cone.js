"use strict";

const models = {
  a2: {rank: 2, order: 3, c: 0.5, depth: 3, max: 3,
    shape: "Six chambers fill the plane."},
  i25: {rank: 2, order: 5, c: Math.cos(Math.PI / 5), depth: 5, max: 5,
    shape: "Ten chambers fill the plane."},
  affine: {rank: 2, c: 1, depth: 5, max: 20,
    shape: "The open half-plane xₛ + xₜ > 0, together with the origin."},
  indefinite: {rank: 2, c: 1.35, depth: 4, max: 16,
    shape: "An open wedge and the origin. The chambers accumulate at two excluded rays."},
  affine2: {rank: 3, euclidean: true, c: 0.5, depth: 4, max: 9,
    shape: "The entire Euclidean slice is tiled by equilateral triangles."},
  ideal: {rank: 3, c: 1, depth: 4, max: 7,
    shape: "The open Klein disk and the ideal vertices of the reflected triangles."}
};

const $ = id => document.getElementById(id);
const symbols = ["s", "t", "u"];
const wallButtons = Array.from(document.querySelectorAll("[data-wall]"));
const plot = $("plot");
const ctx = plot.getContext("2d");
const tau = 2 * Math.PI;
const palette = {
  outside: "#14232d",
  interior: "#28444b",
  line: "#66868d",
  limit: "#aabdc5",
  fundamental: "#3a8b87",
  current: "#eeb758",
  currentOnHome: "#79c5ad",
  axis: "#9ab3b9",
  label: "#e2eeee",
  dark: "#14232d"
};

let model, depth, word, chambers, view;
let euclideanGallery;

function reflect(point, index, c) {
  return point.map((value, i) => i === index ? -value : value + 2 * c * point[index]);
}

function transform(point, expression, example) {
  for (let i = expression.length - 1; i >= 0; i--) {
    point = reflect(point, symbols.indexOf(expression[i]), example.c);
  }
  return point;
}

function alternating(first, length) {
  const second = first === "s" ? "t" : "s";
  return Array.from({length}, (_, i) => i % 2 === 0 ? first : second).join("");
}

function crossWall(expression, wall, example) {
  if (example.euclidean) {
    return affineGallery(example).byWord.get(expression).neighbors.get(wall) ?? null;
  }
  if (expression.endsWith(wall)) return expression.slice(0, -1);
  if (example.order && expression.length === example.order) {
    return alternating("t", example.order).slice(0, -1);
  }
  if (example.order && expression.length + 1 === example.order) {
    return alternating("s", example.order);
  }
  return expression + wall;
}

function affineGallery(example) {
  if (euclideanGallery) return euclideanGallery;
  const origin = {word: "", rays: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], neighbors: new Map()};
  const list = [origin];
  const byWord = new Map([["", origin]]);
  const key = rays => rays.flat().join(",");
  const byRays = new Map([[key(origin.rays), origin]]);
  for (let cursor = 0; cursor < list.length; cursor++) {
    const chamber = list[cursor];
    for (const [i, wall] of symbols.entries()) {
      const a = chamber.rays[(i + 1) % 3], b = chamber.rays[(i + 2) % 3];
      // In the affine slice the reflected vertex is a + b − v. Its coordinates stay integral.
      const rays = chamber.rays.map((v, j) => j === i ? v.map((x, k) => a[k] + b[k] - x) : v);
      const signature = key(rays);
      let target = byRays.get(signature);
      if (!target && chamber.word.length < example.max) {
        target = {word: chamber.word + wall, rays, neighbors: new Map()};
        byRays.set(signature, target);
        byWord.set(target.word, target);
        list.push(target);
      }
      if (target) chamber.neighbors.set(wall, target.word);
    }
  }
  euclideanGallery = {list, byWord};
  return euclideanGallery;
}

function gallery(example, limit) {
  if (example.euclidean) return affineGallery(example).list.filter(chamber => chamber.word.length <= limit);
  const result = [];
  const queue = [""];
  const seen = new Set(queue);
  const generators = symbols.slice(0, example.rank);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const expression = queue[cursor];
    const rays = generators.map((_, index) => {
      const axis = generators.map((_, i) => Number(i === index));
      return transform(axis, expression, example);
    });
    result.push({word: expression, rays});
    if (expression.length === limit) continue;
    for (const s of generators) {
      const next = crossWall(expression, s, example);
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return result;
}

function wrap(angle) {
  return (angle % tau + tau) % tau;
}

function fanAngles(rays) {
  let start = Math.atan2(-rays[0][1], rays[0][0]);
  const end = Math.atan2(-rays[1][1], rays[1][0]);
  let sweep = wrap(end - start);
  if (sweep > Math.PI) {
    start = end;
    sweep = tau - sweep;
  }
  return {start, sweep};
}

function project(ray) {
  const [s, t, u] = ray;
  const height = s + t + u;
  return [Math.sqrt(3) * (t - u) / (2 * height), (-s + (t + u) / 2) / height];
}

function pathFan(start, sweep) {
  ctx.beginPath();
  ctx.moveTo(view.x, view.y);
  ctx.arc(view.x, view.y, view.far, start, start + sweep);
  ctx.closePath();
}

function line(a, b, color, width = 1) {
  ctx.beginPath();
  ctx.moveTo(...a);
  ctx.lineTo(...b);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function text(label, x, y, color, align = "center") {
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(label, x, y);
}

function rayEnd(angle, distance) {
  return [view.x + distance * Math.cos(angle), view.y + distance * Math.sin(angle)];
}

function planarFrame() {
  if (model.order) {
    ctx.fillStyle = palette.interior;
    ctx.fillRect(0, 0, view.width, view.height);
    return null;
  }
  const lambda = model.c - Math.sqrt(model.c * model.c - 1);
  const start = Math.atan2(-1, -lambda);
  const end = Math.atan2(lambda, 1);
  pathFan(start, end - start);
  ctx.fillStyle = palette.interior;
  ctx.fill();
  return [start, end];
}

function paintFan(chamber) {
  const {start, sweep} = fanAngles(chamber.rays);
  pathFan(start, sweep);
  const selected = chamber.word === word;
  ctx.fillStyle = selected ? (word ? palette.current : palette.currentOnHome)
    : chamber.word === "" ? palette.fundamental : "rgba(68, 135, 137, .32)";
  ctx.fill();
  ctx.strokeStyle = selected ? "#f8d18a" : palette.line;
  ctx.lineWidth = selected ? 1.6 : 0.8;
  ctx.stroke();
  if (sweep > .17) {
    const labelAt = rayEnd(start + sweep / 2, .36 * Math.min(view.width, view.height));
    text(chamber.word || "C", ...labelAt, selected ? palette.dark : palette.label);
  }
}

function paintFans() {
  const limits = planarFrame();
  chambers.filter(chamber => chamber.word !== word).forEach(paintFan);
  paintFan(chambers.find(chamber => chamber.word === word));
  ctx.setLineDash([4, 6]);
  line([0, view.y], [view.width, view.y], palette.axis, .8);
  line([view.x, 0], [view.x, view.height], palette.axis, .8);
  if (limits) {
    for (const angle of limits) line([view.x, view.y], rayEnd(angle, view.far), palette.limit, 1.4);
  }
  ctx.setLineDash([]);
  const current = chambers.find(chamber => chamber.word === word);
  current.rays.forEach((ray, i) => {
    const angle = Math.atan2(-ray[1], ray[0]);
    const [x, y] = rayEnd(angle, view.radius * .57);
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, tau);
    ctx.fillStyle = palette.outside;
    ctx.fill();
    text(symbols[1 - i], x, y, "#ffe2a7");
  });
  ctx.beginPath();
  ctx.arc(view.x, view.y, 3, 0, tau);
  ctx.fillStyle = palette.label;
  ctx.fill();
  text("xₛ", view.width - 16, view.y - 13, palette.label);
  text("xₜ", view.x + 13, 16, palette.label);
}

function scale([x, y]) {
  return [view.x + view.radius * x, view.y + view.radius * y];
}

function triangle(chamber) {
  return chamber.rays.map(project);
}

function paintTriangle(chamber) {
  const points = triangle(chamber).map(scale);
  const selected = chamber.word === word;
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  points.slice(1).forEach(point => ctx.lineTo(...point));
  ctx.closePath();
  ctx.fillStyle = selected ? (word ? palette.current : palette.currentOnHome)
    : chamber.word === "" ? palette.fundamental : "rgba(68, 135, 137, .32)";
  ctx.fill();
  ctx.strokeStyle = selected ? "#f8d18a" : palette.line;
  ctx.lineWidth = selected ? 1.6 : .8;
  ctx.stroke();
  if (selected || chamber.word === "") {
    const x = points.reduce((sum, point) => sum + point[0], 0) / 3;
    const y = points.reduce((sum, point) => sum + point[1], 0) / 3;
    const shortEdge = points.some(([a, b], i) => Math.hypot(a - points[(i + 1) % 3][0], b - points[(i + 1) % 3][1]) < 32);
    if (!shortEdge) text(chamber.word || "C", x, y, selected ? palette.dark : palette.label);
    if (selected && !shortEdge) {
      points.forEach((_, i) => {
        const a = points[(i + 1) % 3], b = points[(i + 2) % 3];
        const midX = (a[0] + b[0]) / 2, midY = (a[1] + b[1]) / 2;
        text(symbols[i], .83 * midX + .17 * x, .83 * midY + .17 * y, palette.dark);
      });
    }
  }
}

function paintTriangles() {
  chambers.filter(chamber => chamber.word !== word).forEach(paintTriangle);
  paintTriangle(chambers.find(chamber => chamber.word === word));
}

function paintDisk() {
  ctx.beginPath();
  ctx.arc(view.x, view.y, view.radius, 0, tau);
  ctx.fillStyle = palette.interior;
  ctx.fill();
  paintTriangles();
  ctx.beginPath();
  ctx.arc(view.x, view.y, view.radius, 0, tau);
  ctx.setLineDash([4, 5]);
  ctx.strokeStyle = palette.limit;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);
  for (const chamber of chambers) {
    for (const ray of chamber.rays) {
      const [x, y] = scale(project(ray));
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, tau);
      ctx.fillStyle = chamber.word === word ? "#ffe2a7" : palette.line;
      ctx.fill();
    }
  }
}

function draw() {
  const {width, height} = plot.getBoundingClientRect();
  if (!model || width === 0 || height === 0) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  plot.width = Math.round(width * ratio);
  plot.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  view = {width, height, x: width / 2, y: height / 2,
    radius: .45 * Math.min(width, height), far: Math.hypot(width, height)};
  ctx.fillStyle = palette.outside;
  ctx.fillRect(0, 0, width, height);
  if (model.rank === 2) {
    paintFans();
  } else if (model.euclidean) {
    const extent = Math.max(...chambers.flatMap(chamber => triangle(chamber).map(vertex => Math.hypot(...vertex))));
    view.radius /= extent;
    ctx.fillStyle = palette.interior;
    ctx.fillRect(0, 0, width, height);
    paintTriangles();
  } else {
    paintDisk();
  }
}

function containsTriangle(point, vertices) {
  const signs = vertices.map(([x, y], i) => {
    const [a, b] = vertices[(i + 1) % 3];
    return (a - x) * (point[1] - y) - (b - y) * (point[0] - x);
  });
  return signs.every(sign => sign >= -1e-12) || signs.every(sign => sign <= 1e-12);
}

function choose(next) {
  if (next === null || next.length > model.max) return;
  word = next;
  depth = Math.max(depth, word.length);
  render();
}

function render() {
  chambers = gallery(model, depth);
  $("depth").value = depth;
  $("depth-value").value = depth;
  $("count").textContent = chambers.length + (chambers.length === 1 ? " chamber drawn" : " chambers drawn");
  $("word").textContent = word ? word.split("").join(" ") + " C" : "C";
  $("home").disabled = word === "";
  for (const button of wallButtons) {
    if (button.hidden) continue;
    const next = crossWall(word, button.dataset.wall, model);
    button.disabled = next === null || next.length > model.max;
  }
  $("hint").textContent = !model.order && word.length === model.max
    ? "Gallery limit reached. Cross back or select another chamber."
    : "Click a visible chamber or cross a wall to move through the gallery.";
  draw();
}

function loadModel() {
  model = models[$("model").value];
  word = "";
  depth = model.depth;
  $("depth").max = model.max;
  $("shape").textContent = model.shape;
  $("matrix").textContent = "The Gram matrix has diagonal 1 and off-diagonal −c, with c = "
    + Number(model.c.toFixed(5))
    + ". The dual reflection negates xᵢ and adds 2c xᵢ to every other coordinate.";
  $("limit-key").hidden = Boolean(model.order || model.euclidean);
  wallButtons.forEach((button, i) => { button.hidden = i >= model.rank; });
  render();
}

$("model").addEventListener("change", loadModel);
$("depth").addEventListener("input", event => {
  depth = Number(event.target.value);
  if (word.length > depth) word = "";
  render();
});
$("home").addEventListener("click", () => choose(""));
for (const button of wallButtons) {
  button.addEventListener("click", () => choose(crossWall(word, button.dataset.wall, model)));
}
plot.addEventListener("keydown", event => {
  const wall = event.key.toLowerCase();
  if (!symbols.slice(0, model.rank).includes(wall)) return;
  event.preventDefault();
  choose(crossWall(word, wall, model));
});
plot.addEventListener("click", event => {
  if (!view) return;
  const rect = plot.getBoundingClientRect();
  const x = event.clientX - rect.left - view.x, y = event.clientY - rect.top - view.y;
  if (Math.hypot(x, y) < 3 && model.rank === 2) return;
  const selected = chambers.find(chamber => {
    if (model.rank === 3) return containsTriangle([x / view.radius, y / view.radius], triangle(chamber));
    const {start, sweep} = fanAngles(chamber.rays);
    return wrap(Math.atan2(y, x) - start) <= sweep + 1e-12;
  });
  if (selected) choose(selected.word);
});

const preset = new URLSearchParams(location.search).get("model");
if (Object.hasOwn(models, preset)) $("model").value = preset;
loadModel();
new ResizeObserver(draw).observe(plot);
