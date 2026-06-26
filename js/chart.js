// Eigenes, leichtgewichtiges SVG-Liniendiagramm nach Abschnitt 10 der Funktions-
// beschreibung. Bewusst ohne externe Chart-Bibliothek, da das Achsen-/Beschriftungs-
// verhalten sehr spezifisch ist (eigene Rundungsregeln, mehrere Sonderfälle).

import { parseDmy, formatDmShort } from "./utils.js";

const WIDTH = 320;
const HEIGHT = 150;
const PAD_LEFT = 38;
const PAD_RIGHT = 12;
const PAD_TOP = 22;
const PAD_BOTTOM = 22;

// valueKey/labelKey machen das Chart für beide Übungstypen nutzbar: Kraft nutzt
// kg (Y-Achse) + r (Label über Punkten), Cardio nutzt zeit + intensitaet. unit
// bestimmt die Y-Achsen-Beschriftung ("kg" bzw. "min").
export function renderChart(container, validSessions, { valueKey = "kg", labelKey = "r", unit = "kg" } = {}) {
  if (!validSessions || validSessions.length === 0) {
    renderEmptyState(container);
    return;
  }

  const sorted = validSessions.slice().sort((a, b) => parseDmy(a.d) - parseDmy(b.d));
  const points = sorted.slice(-10); // höchstens die letzten 10 Sessions

  const values = points.map((p) => p[valueKey]);
  const minData = Math.min(...values);
  const maxData = Math.max(...values);
  const minDisplay = Math.floor(minData / 5) * 5 - 5;
  const maxDisplay = Math.ceil(maxData / 5) * 5 + 5;

  const ticks = [];
  for (let v = minDisplay; v <= maxDisplay; v += 5) ticks.push(v);

  const chartW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const chartH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const xFor = (i) => (points.length === 1
    ? PAD_LEFT + chartW / 2
    : PAD_LEFT + (chartW * i) / (points.length - 1));
  const yFor = (v) => PAD_TOP + chartH * (1 - (v - minDisplay) / (maxDisplay - minDisplay));

  const gridLines = ticks.map((t) => {
    const y = yFor(t);
    return `<line x1="${PAD_LEFT}" y1="${y}" x2="${WIDTH - PAD_RIGHT}" y2="${y}" stroke="var(--chart-grid)" stroke-width="1" />
            <text x="${PAD_LEFT - 6}" y="${y + 4}" text-anchor="end" font-size="9" fill="var(--text-muted)">${t} ${unit}</text>`;
  }).join("");

  // Labeling-Regel (vereint Abschnitt 3.3 + 10): bis 7 Punkte alle Daten beschriften,
  // bei mehr als 7 jeden zweiten Punkt + den letzten immer beschriften.
  const shouldLabel = (i) => {
    if (points.length <= 7) return true;
    if (i === points.length - 1) return true;
    return i % 2 === 0;
  };

  let pathD = "";
  let circles = "";
  let repLabels = "";
  let dateLabels = "";

  points.forEach((p, i) => {
    const x = xFor(i);
    const y = yFor(p[valueKey]);
    pathD += (i === 0 ? "M" : "L") + `${x},${y} `;
    circles += `<circle cx="${x}" cy="${y}" r="4" fill="var(--chart-line)" />`;
    repLabels += `<text x="${x}" y="${y - 10}" text-anchor="middle" font-size="10" fill="var(--chart-label)" font-weight="700">${p[labelKey]}</text>`;
    if (shouldLabel(i)) {
      dateLabels += `<text x="${x}" y="${HEIGHT - 4}" text-anchor="middle" font-size="9" fill="var(--text-muted)">${formatDmShort(p.d)}</text>`;
    }
  });

  const linePath = points.length > 1
    ? `<path d="${pathD.trim()}" fill="none" stroke="var(--chart-line)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`
    : "";

  container.innerHTML = `
    <svg viewBox="0 0 ${WIDTH} ${HEIGHT}" class="chart-svg" preserveAspectRatio="none">
      ${gridLines}
      ${linePath}
      ${circles}
      ${repLabels}
      ${dateLabels}
    </svg>`;
}

export function renderEmptyState(container) {
  container.innerHTML = `
    <div class="chart-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
      </svg>
      <span>Keine Daten</span>
    </div>`;
}
