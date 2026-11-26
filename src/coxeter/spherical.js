import { sphere, symbols } from "./model.js";

const tau = 2 * Math.PI;
const cameraPrecision = 1e6;
const dot = (a, b) => a.reduce((total, x, i) => total + x * b[i], 0);
const cross = ([a, b, c], [d, e, f]) => [b * f - c * e, c * d - a * f, a * e - b * d];
const unit = point => {
  const length = Math.hypot(...point);
  return point.map(x => x / length);
};
const mix = (a, b, t) => a.map((x, i) => x * (1 - t) + b[i] * t);

function center(vertices) {
  return unit(vertices[0].map((_, i) => vertices.reduce((sum, vertex) => sum + vertex[i], 0)));
}

export function sphereCamera(vertices) {
  const forward = center(vertices);
  const pole = Math.abs(forward[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const right = unit(cross(pole, forward));
  const up = cross(forward, right);
  return [right, up.map(x => -x), forward];
}

export function rotateSphereCamera(basis, dx, dy) {
  const angle = Math.hypot(dx, dy);
  if (!angle) return basis;
  // Rotate in screen coordinates around the axis perpendicular to the drag.
  const axis = [-dy / angle, dx / angle, 0];
  const cosine = Math.cos(angle), sine = Math.sin(angle);
  return basis[0].map((_, column) => {
    const vector = basis.map(row => row[column]);
    const perpendicular = cross(axis, vector);
    const parallel = dot(axis, vector) * (1 - cosine);
    return vector.map((value, row) => cosine * value + sine * perpendicular[row] + parallel * axis[row]);
  }).map((_, row, columns) => columns.map(column => column[row]));
}

export function encodeSphereCamera(camera) {
  return camera.slice(0, 2).flat().map(value => Math.round(value * cameraPrecision)).join(",");
}

export function decodeSphereCamera(encoded) {
  const fields = encoded?.split(",");
  if (fields?.length !== 6 || fields.some(field => !/^-?\d{1,7}$/.test(field))) return null;
  const values = fields.map(field => Number(field) / cameraPrecision);
  const horizontal = values.slice(0, 3), vertical = values.slice(3);
  const tolerance = 4 / cameraPrecision;
  if ([horizontal, vertical].some(axis => Math.abs(Math.hypot(...axis) - 1) > tolerance)
    || Math.abs(dot(horizontal, vertical)) > tolerance) return null;
  const right = unit(horizontal);
  const forward = unit(cross(vertical, right));
  return [right, cross(right, forward), forward];
}

export function clipHemisphere(vertices) {
  const visible = [];
  for (const [i, a] of vertices.entries()) {
    const b = vertices[(i + 1) % vertices.length];
    if (a[2] >= 0) visible.push(a);
    if (a[2] * b[2] >= 0) continue;
    const intersection = mix(a, b, a[2] / (a[2] - b[2]));
    intersection[2] = 0;
    if (Math.hypot(...intersection) > 1e-12) visible.push(unit(intersection));
  }
  return visible;
}

function contains(point, vertices) {
  return vertices.every((a, i) => {
    const normal = cross(a, vertices[(i + 1) % 3]);
    const inside = Math.sign(dot(normal, vertices[(i + 2) % 3]));
    return inside * dot(normal, point) >= -1e-12;
  });
}

export function drawSphere(ctx, view, model, chambers, word, palette, basis) {
  const project = sphere(model);
  const focus = chambers.find(chamber => chamber.word === word);
  const camera = basis ?? sphereCamera(focus.rays.map(project));
  const orient = point => camera.map(axis => dot(axis, point));
  const cells = chambers.map(chamber => ({word: chamber.word, vertices: chamber.rays.map(project).map(orient)}));
  const screen = ([x, y]) => [view.x + x * view.radius, view.y + y * view.radius];

  ctx.beginPath();
  ctx.arc(view.x, view.y, view.radius, 0, tau);
  ctx.fillStyle = palette.interior;
  ctx.fill();
  ctx.save();
  ctx.clip();

  function paint({word: label, vertices}) {
    const visible = clipHemisphere(vertices);
    if (visible.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(...screen(visible[0]));
    for (const [i, a] of visible.entries()) {
      const b = visible[(i + 1) % visible.length];
      // Normalized positive combinations follow the short great-circle arc.
      for (let j = 1; j <= 16; j++) ctx.lineTo(...screen(unit(mix(a, b, j / 16))));
    }
    ctx.closePath();
    const selected = label === word;
    ctx.fillStyle = selected ? (word ? palette.current : palette.currentOnHome)
      : label === "" ? palette.fundamental : "rgba(68, 135, 137, .32)";
    ctx.fill();
    ctx.strokeStyle = selected ? "#f8d18a" : palette.line;
    ctx.lineWidth = selected ? 1.6 : .8;
    ctx.stroke();
    if (selected) {
      const middle = center(vertices);
      if (middle[2] < 0) return;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "600 13px system-ui, sans-serif";
      ctx.fillStyle = palette.dark;
      const [cx, cy] = screen(middle);
      ctx.fillText(label.length > 7 ? "wC" : label || "C", cx, cy);
      for (const [i, s] of symbols.entries()) {
        const edge = mix(vertices[(i + 1) % 3], vertices[(i + 2) % 3], .5);
        const target = unit(mix(middle, edge, .78));
        if (target[2] < 0) continue;
        const [x, y] = screen(target);
        if (Math.hypot(x - cx, y - cy) >= 17) ctx.fillText(s, x, y);
      }
    }
  }

  cells.filter(cell => cell.word !== word).forEach(paint);
  paint(cells.find(cell => cell.word === word));
  ctx.restore();
  ctx.beginPath();
  ctx.arc(view.x, view.y, view.radius, 0, tau);
  ctx.strokeStyle = palette.limit;
  ctx.lineWidth = 1;
  ctx.stroke();
  return (x, y) => {
    x = (x - view.x) / view.radius;
    y = (y - view.y) / view.radius;
    const z = 1 - x*x - y*y;
    if (z < 0) return null;
    return cells.find(cell => contains([x, y, Math.sqrt(z)], cell.vertices))?.word ?? null;
  };
}
