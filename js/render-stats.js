// Auswertungs-Widgets unterhalb des Headers. Reine Darstellungsfunktion.

import {
  computeDailyProgressionCounts,
  latestTrainingDayExerciseCount,
  avgExercisesPerSession,
  avgSessionsPerWeek,
  groupDistribution,
  formatDmShort,
  trainingDaysSet,
} from "./utils.js";
import { GROUP_CHART_COLORS } from "./groups.js";
import { renderPieChart } from "./pie-chart.js";

const BAR_CAP = 3;

const MONTH_NAMES = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

export function renderStatsSection(container, exercises) {
  const { days, weightCounts, repsCounts } = computeDailyProgressionCounts(exercises);
  const exerciseCount = latestTrainingDayExerciseCount(exercises);
  const avgExercises = avgExercisesPerSession(exercises, 6);
  const avgWeek = avgSessionsPerWeek(exercises, 6);
  const distribution = groupDistribution(exercises, 6);
  const sessionDays = trainingDaysSet(exercises);

  container.innerHTML = `
    <div class="stats-row stats-row-wide">
      ${calendarCardHtml(sessionDays)}
    </div>
    <div class="stats-row">
      ${dailyBarsCardHtml("Gewichtssteigerungen", days, weightCounts, "stat-bar-purple")}
      ${dailyBarsCardHtml("Wdh Steigerungen", days, repsCounts, "stat-bar-blue")}
    </div>
    <div class="stats-row stats-row-wide">
      ${exerciseCountCardHtml(exerciseCount)}
    </div>
    <div class="stats-row">
      ${avgCardHtml(avgExercises, avgWeek)}
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

// ---------- Kalender-Kachel ----------

function calendarCardHtml(sessionDays) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const currMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);

  return `
    <div class="stat-card stat-card-wide">
      <div class="stat-card-header">
        <span class="stat-title">Trainingstage</span>
        <span class="stat-sub">Aktueller &amp; letzter Monat</span>
      </div>
      <div class="cal-months-row">
        <div class="cal-month">
          <div class="cal-month-label">${MONTH_NAMES[prevMonthDate.getMonth()].toUpperCase()} ${prevMonthDate.getFullYear()}</div>
          <div class="cal-grid">${buildMonthBoxes(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), sessionDays, today)}</div>
        </div>
        <div class="cal-month">
          <div class="cal-month-label">${MONTH_NAMES[currMonthDate.getMonth()].toUpperCase()} ${currMonthDate.getFullYear()}</div>
          <div class="cal-grid">${buildMonthBoxes(currMonthDate.getFullYear(), currMonthDate.getMonth(), sessionDays, today)}</div>
        </div>
      </div>
    </div>
  `;
}

function buildMonthBoxes(year, month, sessionDays, today) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Wochenstart Montag (0=Mo … 6=So)
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;

  let html = "";
  for (let i = 0; i < firstWeekday; i++) html += `<div class="cal-day cal-empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const dd = String(day).padStart(2, "0");
    const mm = String(month + 1).padStart(2, "0");
    const dateStr = `${dd}.${mm}.${year}`;
    const dayDate = new Date(year, month, day);
    const isFuture = dayDate > today;
    const hasSession = sessionDays.has(dateStr);
    const cls = isFuture ? "cal-day cal-future" : hasSession ? "cal-day cal-active" : "cal-day";
    html += `<div class="${cls}" title="${dateStr}"></div>`;
  }
  return html;
}

// ---------- Steigerungs-Balken ----------

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

// ---------- Anzahl Übungen ----------

function exerciseCountCardHtml(count) {
  const frac = Math.min(count, 10) / 10;
  let colorClass = "hbar-red";
  if (count >= 7) colorClass = "hbar-green";
  else if (count >= 5) colorClass = "hbar-yellow";

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

// ---------- Ø Übungen & Ø Sessions/Woche ----------

function avgCardHtml(avgExercises, avgWeek) {
  const fmtEx = avgExercises.toFixed(2).replace(".", ",");
  const fmtWk = avgWeek.toFixed(2).replace(".", ",");
  return `
    <div class="stat-card stat-card-narrow">
      <div class="stat-card-header">
        <span class="stat-title">Ø Übungen</span>
        <span class="stat-sub">Pro Einheit, letzte 6 Wochen</span>
      </div>
      <div class="stat-number">${fmtEx}</div>
      <div class="avg-divider"></div>
      <div class="stat-card-header" style="margin-top:6px">
        <span class="stat-title">Ø Sessions</span>
        <span class="stat-sub">Pro Woche, letzte 6 Wochen</span>
      </div>
      <div class="stat-number stat-number-sm">${fmtWk}</div>
    </div>
  `;
}
