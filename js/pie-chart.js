// Eigenes, leichtgewichtiges Donut-Diagramm (SVG, kein externes Chart-Lib nötig).
// Nutzt den klassischen stroke-dasharray-Trick auf einem Kreis statt Arc-Pfad-Mathematik.

const SIZE = 110;
const R = 42;
const STROKE = 16;
const CIRCUMFERENCE = 2 * Math.PI * R;

export function renderPieChart(container, segments) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    container.innerHTML = `<div class="pie-empty">Keine Daten</div>`;
    return;
  }

  let offset = 0;
  const circles = segments.map((s) => {
    const fraction = s.value / total;
    const dash = fraction * CIRCUMFERENCE;
    const circle = `<circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${R}" fill="none" stroke="${s.color}"
      stroke-width="${STROKE}" stroke-dasharray="${dash} ${CIRCUMFERENCE - dash}"
      stroke-dashoffset="${-offset}" transform="rotate(-90 ${SIZE / 2} ${SIZE / 2})" />`;
    offset += dash;
    return circle;
  }).join("");

  const legend = segments.map((s) => {
    const pct = Math.round((s.value / total) * 100);
    return `<div class="pie-legend-row">
      <span class="pie-legend-dot" style="background:${s.color}"></span>
      <span class="pie-legend-label">${s.label}</span>
      <span class="pie-legend-pct">${pct}%</span>
    </div>`;
  }).join("");

  container.innerHTML = `
    <div class="pie-row">
      <svg viewBox="0 0 ${SIZE} ${SIZE}" class="pie-svg">${circles}</svg>
      <div class="pie-legend">${legend}</div>
    </div>
  `;
}
