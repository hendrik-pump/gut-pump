// Rendering von View 1 (Übungsliste). Reine Darstellungsfunktionen: bekommen Daten
// + editMode-Flag, bauen DOM/HTML. Datenzugriff (IndexedDB) und Event-Wiring passieren
// in app.js, das diese Funktionen nach jeder Änderung erneut aufruft.

import { GROUP_ORDER, defaultIconFor } from "./groups.js";
import {
  escapeHtml,
  isDoneToday,
  lastValidSession,
  validSessionsSortedDesc,
  sessionsInLast7Days,
  isCardioExercise,
  bestValueLast2Months,
} from "./utils.js";
import { renderChart } from "./chart.js";

const ICON_PLUS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;
const ICON_CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
const ICON_PENCIL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;

export function renderExerciseList(container, exercises, editMode) {
  const byGroup = GROUP_ORDER
    .map((grp) => ({ grp, items: exercises.filter((e) => e.grp === grp) }))
    .filter((g) => g.items.length > 0);

  container.innerHTML = byGroup.map((g) => `
    <section class="group-section" data-grp-section="${g.grp}">
      <h2 class="group-title">${g.grp.toUpperCase()}</h2>
      ${g.items.map((ex) => cardHtml(ex, editMode)).join("")}
    </section>
  `).join("");

  // Charts werden nach dem Einfügen ins DOM gerendert (chart.js schreibt eigenes innerHTML).
  for (const ex of exercises) {
    const chartEl = container.querySelector(`[data-chart-id="${ex.id}"]`);
    if (chartEl) {
      const cardio = isCardioExercise(ex);
      renderChart(chartEl, validSessionsSortedDesc(ex), {
        valueKey: cardio ? "zeit" : "kg",
        labelKey: cardio ? "intensitaet" : "r",
        unit: cardio ? "min" : "kg",
      });
    }
  }
}

function cardHtml(ex, editMode) {
  const cardio = isCardioExercise(ex);
  const last = lastValidSession(ex);
  const best = bestValueLast2Months(ex);
  const done = isDoneToday(ex);

  return `
    <div class="exercise-card ${editMode ? "edit-mode" : ""}" data-id="${ex.id}" data-grp="${ex.grp}">
      <div class="card-name-row">
        <span>${escapeHtml(ex.name)}</span>
        ${editMode ? `<button class="edit-pencil-btn" data-action="edit-exercise" data-id="${ex.id}">${ICON_PENCIL}</button>` : ""}
      </div>
      <div class="card-meta-row">
        <div class="card-icon">${ex.img ? `<img src="${ex.img}" alt="" />` : defaultIconFor(ex.grp)}</div>
        <div class="card-last-entry">
          ${best ? bestValueHtml(best, cardio) : `<span class="card-last-kg">–</span>`}
          ${last ? `<div class="card-last-session">Ltz Session: ${lastSessionText(last, cardio)}</div>` : ""}
        </div>
        ${editMode ? "" : (done
            ? `<div class="pill-btn badge-eingetragen">${ICON_CHECK} Eingetragen</div>`
            : `<button class="pill-btn btn-eintragen" data-action="toggle-entry-form" data-id="${ex.id}">${ICON_PLUS} Eintragen</button>`)}
      </div>
      <div class="chart-container" data-chart-id="${ex.id}"></div>
      ${editMode ? "" : entryFormHtml(ex, cardio)}
    </div>
  `;
}

function bestValueHtml(best, cardio) {
  if (cardio) {
    return `<span class="card-last-kg">${formatNum(best.zeit)} Min</span><span class="card-last-r">${formatNum(best.intensitaet)} Int.</span>`;
  }
  return `<span class="card-last-kg">${formatNum(best.kg)} Kg</span><span class="card-last-r">${best.r} Wdh</span>`;
}

function lastSessionText(last, cardio) {
  if (cardio) return `${formatNum(last.zeit)} Min, ${formatNum(last.intensitaet)} Int.`;
  return `${formatNum(last.kg)} Kg, ${last.r} Wdh`;
}

function entryFormHtml(ex, cardio) {
  if (cardio) {
    return `
      <div class="entry-form" data-entry-form-id="${ex.id}">
        <div class="field">
          <label>Zeit (Min)</label>
          <input type="number" step="1" min="1" class="input-primary" placeholder="— min" />
        </div>
        <div class="field">
          <label>Intensität</label>
          <input type="number" step="1" min="1" class="input-secondary" placeholder="— Int." />
        </div>
        <button class="save-btn" data-action="save-entry" data-id="${ex.id}">Speichern</button>
      </div>`;
  }
  return `
    <div class="entry-form" data-entry-form-id="${ex.id}">
      <div class="field">
        <label>Gewicht</label>
        <input type="number" step="0.5" min="0.5" class="input-primary" placeholder="— kg" />
      </div>
      <div class="field">
        <label>Wiederholung</label>
        <input type="number" step="1" min="1" class="input-secondary" placeholder="— Wdh" />
      </div>
      <button class="save-btn" data-action="save-entry" data-id="${ex.id}">Speichern</button>
    </div>`;
}

export function renderSessionsBadge(badgeEl, exercises) {
  const count = sessionsInLast7Days(exercises);
  badgeEl.textContent = `${count} Sessions in 7 Tagen`;
}

export function toggleEntryForm(cardEl) {
  const form = cardEl.querySelector(".entry-form");
  if (!form) return;
  form.classList.toggle("open");
}

export function closeAndClearEntryForm(cardEl) {
  const form = cardEl.querySelector(".entry-form");
  if (!form) return;
  form.classList.remove("open");
  const primaryInput = form.querySelector(".input-primary");
  const secondaryInput = form.querySelector(".input-secondary");
  if (primaryInput) primaryInput.value = "";
  if (secondaryInput) secondaryInput.value = "";
}

function formatNum(n) {
  return Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
}
