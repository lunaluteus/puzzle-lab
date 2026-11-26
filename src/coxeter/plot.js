import { affineDihedralProduct, affineProductStrip, dihedralMetric, limitRays, slice, symbols } from "./model.js";
import { drawSphere } from "./spherical.js";

const tau = 2 * Math.PI;
const labelFont = "600 13px system-ui, sans-serif";
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

function containsTriangle(point, vertices) {
  const signs = vertices.map(([x, y], i) => {
    const [a, b] = vertices[(i + 1) % 3];
    return (a - x) * (point[1] - y) - (b - y) * (point[0] - x);
  });
  return signs.every(sign => sign >= -1e-12) || signs.every(sign => sign <= 1e-12);
}

export function toPoincare([x, y]) {
  const gap = 1 - x*x - y*y;
  const divisor = 1 + (gap > 1e-14 ? Math.sqrt(gap) : 0);
  return [x / divisor, y / divisor];
}

export function toKlein([x, y]) {
  const factor = 2 / (1 + x*x + y*y);
  return [factor * x, factor * y];
}

export function poincareCircle([ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const length = Math.hypot(dx, dy);
  if (!length) return null;
  // Invert the foot of the Klein chord to find the orthogonal circle's center.
  const distance = (dx * ay - dy * ax) / length;
  if (Math.abs(distance) < 1e-6) return null;
  return {center: [-dy / length / distance, dx / length / distance],
    radius: Math.sqrt(Math.max(0, 1 - distance*distance)) / Math.abs(distance)};
}

export function drawPlot(plot, model, chambers, word, {
  zoom = 1, point = null, camera = null, projection = "klein", coordinates = "dual", onWalls
} = {}) {
  const ctx = plot.getContext("2d");
  const {width, height} = plot.getBoundingClientRect();
  if (width === 0 || height === 0) {
    onWalls?.([]);
    return () => null;
  }
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  plot.width = Math.round(width * ratio);
  plot.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const view = {width, height, x: width / 2, y: height / 2,
    radius: .45 * Math.min(width, height) * zoom, far: Math.hypot(width, height)};
  ctx.fillStyle = palette.outside;
  ctx.fillRect(0, 0, width, height);
  if (model.family === "Spherical") {
    const pickSphere = drawSphere(ctx, view, model, chambers, word, palette, camera);
    return (x, y) => ({word: pickSphere(x, y)});
  }
  const affineProduct = model === affineDihedralProduct;
  const project = model.rank === 3 && !affineProduct ? slice(model).project : null;
  const poincare = model.family === "Hyperbolic" && projection === "poincare";
  const metric = model.family === "Finite dihedral" && coordinates === "euclidean" ? dihedralMetric(model) : null;
  const fans = metric ? chambers.map(chamber => ({...chamber, rays: chamber.rays.map(metric.forward)})) : chambers;
  const limit = limitRays(model);
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
    ctx.font = labelFont;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(label, x, y);
  }

  if (affineProduct) {
    const strips = chambers.map(chamber => ({...affineProductStrip(chamber), word: chamber.word}));
    const min = Math.min(...strips.map(strip => strip.left));
    const max = Math.max(...strips.map(strip => strip.right));
    const step = Math.min(.86 * width / (max - min), .42 * height) * zoom;
    const selectedStrip = strips.find(strip => strip.word === word);
    const galleryCenter = (min + max) / 2;
    const selectedCenter = selectedStrip ? (selectedStrip.left + selectedStrip.right) / 2 : galleryCenter;
    // Keep the gallery centered until the selected strip needs more room at an edge.
    const margin = Math.min(24, .06 * width);
    const visibleOffset = Math.max(0, view.x - margin - step / 2) / step;
    const center = Math.min(selectedCenter + visibleOffset, Math.max(galleryCenter, selectedCenter - visibleOffset));
    const place = x => view.x + (x - center) * step;
    ctx.font = labelFont;
    ctx.fillStyle = palette.interior;
    ctx.fillRect(0, 0, width, height);
    const origin = place(0);
    line([0, view.y], [width, view.y], palette.line);
    line([origin, 0], [origin, height], palette.line);

    const walls = [];
    function positionWall(wall, x, y) {
      if (x >= 14 && x <= width - 14 && y >= 14 && y <= height - 14) walls.push({wall, x, y});
    }

    function paintStrip({left, right, above, sOnLeft, word: chamberWord}) {
      const a = place(left), b = place(right), edge = above ? 0 : height;
      const selected = chamberWord === word;
      ctx.fillStyle = selected ? (word ? palette.current : palette.currentOnHome)
        : chamberWord === "" ? palette.fundamental : "rgba(68, 135, 137, .32)";
      ctx.fillRect(a, Math.min(edge, view.y), step, Math.abs(edge - view.y));
      const color = selected ? "#f8d18a" : palette.line;
      const stroke = selected ? 1.6 : .8;
      line([a, edge], [a, view.y], color, stroke);
      line([a, view.y], [b, view.y], color, stroke);
      line([b, view.y], [b, edge], color, stroke);
      if ((selected || chamberWord === "") && ctx.measureText(chamberWord || "C").width + 16 < step) {
        text(chamberWord || "C", (a + b) / 2, (view.y + edge) / 2, selected ? palette.dark : palette.label);
      }
      if (selected) {
        const direction = above ? -1 : 1;
        if (step >= 30) {
          const y = view.y + direction * Math.max(56, .34 * view.y);
          positionWall("s", sOnLeft ? a : b, y);
          positionWall("t", sOnLeft ? b : a, y);
        }
        if (step >= 14) positionWall("u", (a + b) / 2, view.y + direction * 26);
      }
    }

    strips.filter(strip => strip.word !== word).forEach(paintStrip);
    if (selectedStrip) paintStrip(selectedStrip);
    onWalls?.(walls);
    function axisLabel(label, x, y) {
      const labelWidth = ctx.measureText(label).width + 6;
      ctx.fillStyle = palette.dark;
      ctx.fillRect(x - labelWidth / 2, y - 7, labelWidth, 15);
      text(label, x, y, palette.label);
    }

    const tickStep = Math.max(1, Math.ceil(30 / step));
    for (let coordinate = Math.ceil(min / tickStep) * tickStep; coordinate <= max; coordinate += tickStep) {
      const x = place(coordinate);
      if (x < 13 || x > width - 13) continue;
      line([x, view.y - 3], [x, view.y + 4], palette.axis);
      axisLabel(String(coordinate).replace("-", "−"), x, view.y + 13);
    }
    axisLabel("xₛ", width - 16, view.y - 13);
    if (origin >= 0 && origin <= width) {
      axisLabel("xᵤ", Math.min(width - 16, Math.max(16, origin)), 15);
    }
    return (x, y) => ({
      word: strips.find(({left, right, above}) =>
        (y === view.y || above === (y < view.y)) && x >= place(left) && x <= place(right))?.word ?? null
    });
  }

  if (model.rank === 1) {
    const {x, y, width} = view;
    const extent = x - 24;
    line([x - extent, y], [x + extent, y], palette.line);
    for (const chamber of chambers) {
      const direction = Math.sign(chamber.rays[0][0]);
      const end = x + direction * extent;
      const color = chamber.word === word ? palette.current
        : chamber.word === "" ? palette.fundamental : palette.line;
      line([x, y], [end, y], color, 5);
      ctx.beginPath();
      ctx.moveTo(end, y);
      ctx.lineTo(end - direction * 9, y - 6);
      ctx.lineTo(end - direction * 9, y + 6);
      ctx.fillStyle = color;
      ctx.fill();
      text(chamber.word ? "sC" : "C", x + direction * extent / 2, y - 22, palette.label);
    }
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, tau);
    ctx.fillStyle = palette.label;
    ctx.fill();
    text("0", x, y + 18, palette.label);
    text("xₛ", width - 24, y + 18, palette.label);
    return px => ({word: Math.abs(px - x) < 3 ? null
      : chambers.find(chamber => Math.sign(chamber.rays[0][0]) === Math.sign(px - x))?.word ?? null});
  }

  function rayEnd(angle, distance) {
    return [view.x + distance * Math.cos(angle), view.y + distance * Math.sin(angle)];
  }

  function planarFrame() {
    if (!limit) {
      ctx.fillStyle = palette.interior;
      ctx.fillRect(0, 0, view.width, view.height);
      return null;
    }
    const [upper, lower] = limit;
    const start = Math.atan2(-upper[1], upper[0]);
    const end = Math.atan2(-lower[1], lower[0]);
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
    fans.filter(chamber => chamber.word !== word).forEach(paintFan);
    paintFan(fans.find(chamber => chamber.word === word));
    ctx.setLineDash([4, 6]);
    line([0, view.y], [view.width, view.y], palette.axis, .8);
    line([view.x, 0], [view.x, view.height], palette.axis, .8);
    if (limits) {
      for (const angle of limits) line([view.x, view.y], rayEnd(angle, view.far), palette.limit, 1.4);
    }
    ctx.setLineDash([]);
    const current = fans.find(chamber => chamber.word === word);
    const markerRadius = 8;
    const minimumSpacing = 2 * markerRadius + 4;
    const availableRadius = Math.min(view.x, view.y) - markerRadius - minimumSpacing / 2 - 8;
    const labelRadius = Math.max(minimumSpacing / 2, Math.min(view.radius * .57, availableRadius));
    const angles = current.rays.map(([x, y]) => Math.atan2(-y, x));
    const [a, b] = angles.map(angle => rayEnd(angle, labelRadius));
    // Stagger along the wall rays so even coincident screen directions retain both labels.
    const offset = Math.hypot(a[0] - b[0], a[1] - b[1]) < minimumSpacing ? minimumSpacing / 2 : 0;
    angles.forEach((angle, i) => {
      const [x, y] = rayEnd(angle, labelRadius + (i ? offset : -offset));
      ctx.beginPath();
      ctx.arc(x, y, markerRadius, 0, tau);
      ctx.fillStyle = palette.outside;
      ctx.fill();
      text(symbols[1 - i], x, y, "#ffe2a7");
    });
    ctx.beginPath();
    ctx.arc(view.x, view.y, 3, 0, tau);
    ctx.fillStyle = palette.label;
    ctx.fill();
    text(metric ? "X" : "xₛ", view.width - 16, view.y - 13, palette.label);
    text(metric ? "Y" : "xₜ", view.x + 13, 16, palette.label);
  }

  function pickFan(x, y) {
    if (Math.hypot(x, y) < 3) return {point: [0, 0], word: null};
    let point = [x / view.radius, -y / view.radius];
    let snapDistance = 1.5;
    for (const [u, v] of [...fans.flatMap(chamber => chamber.rays), ...(limit ?? [])]) {
      const norm = Math.hypot(u, v);
      const a = u / norm, b = v / norm;
      const along = a * x - b * y;
      const across = Math.abs(b * x + a * y);
      if (along < 0 || across >= snapDistance) continue;
      snapDistance = across;
      point = [a * along / view.radius, b * along / view.radius];
    }
    const angle = Math.atan2(-point[1], point[0]);
    const chamber = fans.find(chamber => {
      const {start, sweep} = fanAngles(chamber.rays);
      const offset = wrap(angle - start);
      return offset <= sweep + 1e-12 || tau - offset <= 1e-12;
    });
    return {point: metric ? metric.inverse(point) : point, word: chamber?.word ?? null};
  }

  function scale([x, y]) {
    return [view.x + view.radius * x, view.y + view.radius * y];
  }

  function display(point) {
    return scale(poincare ? toPoincare(point) : point);
  }

  function arcEdge(a, b, start, end) {
    const circle = poincareCircle(a, b);
    if (!circle) {
      ctx.lineTo(...end);
      return;
    }
    const [x, y] = scale(circle.center);
    const startAngle = Math.atan2(start[1] - y, start[0] - x);
    const endAngle = Math.atan2(end[1] - y, end[0] - x);
    const sweep = wrap(endAngle - startAngle + Math.PI) - Math.PI;
    ctx.arc(x, y, circle.radius * view.radius, startAngle, startAngle + sweep, sweep < 0);
  }

  function triangle(chamber) {
    return chamber.rays.map(project);
  }

  function paintTriangle(chamber) {
    const vertices = triangle(chamber);
    const points = vertices.map(display);
    const selected = chamber.word === word;
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    if (poincare) {
      vertices.forEach((vertex, i) => {
        const next = (i + 1) % vertices.length;
        arcEdge(vertex, vertices[next], points[i], points[next]);
      });
    } else points.slice(1).forEach(point => ctx.lineTo(...point));
    ctx.closePath();
    ctx.fillStyle = selected ? (word ? palette.current : palette.currentOnHome)
      : chamber.word === "" ? palette.fundamental : "rgba(68, 135, 137, .32)";
    ctx.fill();
    ctx.strokeStyle = selected ? "#f8d18a" : palette.line;
    ctx.lineWidth = selected ? 1.6 : .8;
    ctx.stroke();
    if (selected || chamber.word === "") {
      const x = vertices.reduce((sum, point) => sum + point[0], 0) / 3;
      const y = vertices.reduce((sum, point) => sum + point[1], 0) / 3;
      const shortEdge = points.some(([a, b], i) => Math.hypot(a - points[(i + 1) % 3][0], b - points[(i + 1) % 3][1]) < 32);
      if (!shortEdge) text(chamber.word || "C", ...display([x, y]), selected ? palette.dark : palette.label);
      if (selected && !shortEdge) {
        vertices.forEach((_, i) => {
          const a = vertices[(i + 1) % 3], b = vertices[(i + 2) % 3];
          const midX = (a[0] + b[0]) / 2, midY = (a[1] + b[1]) / 2;
          text(symbols[i], ...display([.83 * midX + .17 * x, .83 * midY + .17 * y]), palette.dark);
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
        const point = project(ray);
        if (Math.abs(Math.hypot(...point) - 1) > 1e-9) continue;
        const [x, y] = display(point);
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, tau);
        ctx.fillStyle = chamber.word === word ? "#ffe2a7" : palette.line;
        ctx.fill();
      }
    }
  }


  if (model.rank === 2) {
    paintFans();
    if (point) {
      const [px, py] = metric ? metric.forward(point) : point;
      const x = view.x + view.radius * px, y = view.y - view.radius * py;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, tau);
      ctx.fillStyle = "#fff6dd";
      ctx.fill();
      ctx.strokeStyle = palette.dark;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  } else if (model.family === "Affine") {
    const extent = Math.max(...chambers.flatMap(chamber => triangle(chamber).map(vertex => Math.hypot(...vertex))));
    view.radius /= extent;
    ctx.fillStyle = palette.interior;
    ctx.fillRect(0, 0, width, height);
    paintTriangles();
  } else {
    paintDisk();
  }

  if (model.rank === 2) return (x, y) => pickFan(x - view.x, y - view.y);
  return (x, y) => {
    const point = [(x - view.x) / view.radius, (y - view.y) / view.radius];
    if (poincare && Math.hypot(...point) > 1 + 1e-12) return {word: null};
    const klein = poincare ? toKlein(point) : point;
    return {word: chambers.find(chamber => containsTriangle(klein, triangle(chamber)))?.word ?? null};
  };
}
