// Auswertungs-Widgets unterhalb des Headers: Gewichts-/Wdh-Steigerungen der letzten
// 14 Sessions, Anzahl Übungen am letzten Trainingstag, Ø Trainingseinheiten pro Tag
// und Muskelgruppen-Verteilung (letzte 6 Wochen). Reine Darstellungsfunktion; kein
// eigenes Event-Wiring nötig, da die Widgets nicht interaktiv sind.

import {
  computeDailyProgressionCounts,
  latestTrainingDayExerciseCount,
  avgExercisesPerSession,
  groupDistribution,
  formatDmShort,
} from "./utils.js";
import { GROUP_CHART_COLORS } from "./groups.js";
import { renderPieChart } from "./pie-chart.js";

const BAR_CAP = 3; // Balken zeigt Steigerungen nur bis 3 an, mehr wird gekappt dargestellt

export function renderStatsSection(container, exercises) {
  const { days, weightCounts, repsCounts } = computeDailyProgressionCounts(exercises);
  const exerciseCount = latestTrainingDayExerciseCount(exercises);
  const avgExercises = avgExercisesPerSession(exercises, 6);
  const distribution = groupDistribution(exercises, 6);

  container.innerHTML = `
    <div class="stats-row">
      ${dailyBarsCardHtml("Gewichtssteigerungen", days, weightCounts, "stat-bar-purple")}
      ${dailyBarsCardHtml("Wdh Steigerungen", days, repsCounts, "stat-bar-blue")}
    </div>
    <div class="stats-row stats-row-wide">
      ${exerciseCountCardHtml(exerciseCount)}
    </div>
    <div class="stats-row">
      ${avgPerDayCardHtml(avgExercises)}
      <div class="stat-card stat-card-pie" data-pie-card>
        <div class="stat-card-header">
          <span class="stat-title">Muskelgruppen</span>
          <span class="stat-sub">Letzte 6 Wochen</span>
        </div>
        <div data-pie-container></div>
      </div>
    </div>
  `;

  const pieContainer = container.querySelector("[data-pie-container]");
  const segments = distribution.map((d) => ({
    label: d.grp,
    value: d.count,
    color: GROUP_CHART_COLORS[d.grp] ?? "#888",
  }));
  renderPieChart(pieContainer, segments);
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
        <span class="stat-sub">Letzte 14 Sessions</span>
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
    <div class="stat-card stat-card-wide">
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

function avgPerDayCardHtml(avg) {
  const formatted = avg.toFixed(2).replace(".", ",");
  return `
    <div class="stat-card stat-card-narrow">
      <div class="stat-card-header">
        <span class="stat-title">Ø Übungen</span>
        <span class="stat-sub">Pro Einheit, letzte 6 Wochen</span>
      </div>
      <div class="stat-number">${formatted}</div>
    </div>
  `;
}
