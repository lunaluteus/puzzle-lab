import { limitRays, slice, symbols } from "./model.js";

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


export function drawPlot(plot, model, chambers, word, zoom = 1) {
  const ctx = plot.getContext("2d");
  const {width, height} = plot.getBoundingClientRect();
  if (width === 0 || height === 0) return () => null;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  plot.width = Math.round(width * ratio);
  plot.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const view = {width, height, x: width / 2, y: height / 2,
    radius: .45 * Math.min(width, height) * zoom, far: Math.hypot(width, height)};
  const project = model.rank === 3 ? slice(model).project : null;
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
    if (!limitRays(model)) {
      ctx.fillStyle = palette.interior;
      ctx.fillRect(0, 0, view.width, view.height);
      return null;
    }
    const [upper, lower] = limitRays(model);
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
        const point = project(ray);
        if (Math.abs(Math.hypot(...point) - 1) > 1e-9) continue;
        const [x, y] = scale(point);
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, tau);
        ctx.fillStyle = chamber.word === word ? "#ffe2a7" : palette.line;
        ctx.fill();
      }
    }
  }


  ctx.fillStyle = palette.outside;
  ctx.fillRect(0, 0, width, height);
  if (model.rank === 2) {
    paintFans();
  } else if (model.family === "Affine") {
    const extent = Math.max(...chambers.flatMap(chamber => triangle(chamber).map(vertex => Math.hypot(...vertex))));
    view.radius /= extent;
    ctx.fillStyle = palette.interior;
    ctx.fillRect(0, 0, width, height);
    paintTriangles();
  } else {
    paintDisk();
  }

  return (x, y) => {
    x -= view.x;
    y -= view.y;
    if (Math.hypot(x, y) < 3 && model.rank === 2) return null;
    const chamber = chambers.find(chamber => {
      if (model.rank === 3) return containsTriangle([x / view.radius, y / view.radius], triangle(chamber));
      const {start, sweep} = fanAngles(chamber.rays);
      return wrap(Math.atan2(y, x) - start) <= sweep + 1e-12;
    });
    return chamber?.word ?? null;
  };
}
