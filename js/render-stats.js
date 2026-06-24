// Auswertungs-Widgets unterhalb des Headers (Gewichts-/Wiederholungssteigerungen der
// letzten 14 Tage, Anzahl Übungen am letzten Trainingstag). Reine Darstellungsfunktion;
// kein eigenes Event-Wiring nötig, da die Widgets nicht interaktiv sind.

import { computeDailyProgressionCounts, latestTrainingDayExerciseCount, formatDmShort } from "./utils.js";

const BAR_CAP = 3; // Balken zeigt Steigerungen nur bis 3 an, mehr wird gekappt dargestellt

export function renderStatsSection(container, exercises) {
  const { days, weightCounts, repsCounts } = computeDailyProgressionCounts(exercises);
  const exerciseCount = latestTrainingDayExerciseCount(exercises);

  container.innerHTML = `
    <div class="stats-row">
      ${dailyBarsCardHtml("Gewichtssteigerungen", days, weightCounts, "stat-bar-purple")}
      ${dailyBarsCardHtml("Wiederholungssteigerungen", days, repsCounts, "stat-bar-blue")}
      ${exerciseCountCardHtml(exerciseCount)}
    </div>
  `;
}

function dailyBarsCardHtml(title, days, counts, barClass) {
  const total = days.reduce((sum, d) => sum + counts[d], 0);
  const bars = days.map((d) => {
    const count = counts[d];
    const frac = Math.min(count, BAR_CAP) / BAR_CAP;
    const filled = count > 0 ? barClass : "";
    return `<div class="stat-bar-track" title="${formatDmShort(d)}: ${count}">
      <div class="stat-bar-fill ${filled}" style="height:${frac * 100}%"></div>
    </div>`;
  }).join("");

  return `
    <div class="stat-card">
      <div class="stat-card-header">
        <span class="stat-title">${title}</span>
        <span class="stat-sub">Letzte 14 Tage</span>
      </div>
      <div class="stat-number">${total}</div>
      <div class="stat-bars">${bars}</div>
    </div>
  `;
}

function exerciseCountCardHtml(count) {
  const frac = Math.min(count, 10) / 10;
  let colorClass = "hbar-orange";
  if (count >= 7) colorClass = "hbar-gold";
  else if (count >= 5) colorClass = "hbar-green";

  return `
    <div class="stat-card">
      <div class="stat-card-header">
        <span class="stat-title">Anzahl Übungen</span>
        <span class="stat-sub">Letzter Trainingstag</span>
      </div>
      <div class="stat-number">${count}</div>
      <div class="hbar-track">
        <div class="hbar-fill ${colorClass}" style="width:${frac * 100}%"></div>
      </div>
    </div>
  `;
}
