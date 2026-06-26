// Rendering von View 2 (Datentabelle). Reine Darstellungsfunktionen; Event-Wiring
// und DB-Updates passieren in app.js.

import { GROUP_ORDER } from "./groups.js";
import { escapeHtml, parseDmy, validSessionsSortedDesc, isCardioExercise } from "./utils.js";

export const FILTER_ALL = "Alle";

// Baut eine flache, sortierte Liste aller gültigen Sessions über alle Übungen.
// primary/secondary sind die typabhängigen Rohwerte (kg/r bzw. zeit/intensitaet),
// primaryField/secondaryField sagen, welcher DB-Feldname beim Inline-Edit
// geschrieben werden muss.
export function buildRows(exercises) {
  const rows = [];
  for (const ex of exercises) {
    const cardio = isCardioExercise(ex);
    for (const s of validSessionsSortedDesc(ex)) {
      rows.push({
        exerciseId: ex.id,
        exerciseName: ex.name,
        grp: ex.grp,
        cardio,
        sessionId: s.id,
        d: s.d,
        primary: cardio ? s.zeit : s.kg,
        secondary: cardio ? s.intensitaet : s.r,
        primaryField: cardio ? "zeit" : "kg",
        secondaryField: cardio ? "intensitaet" : "r",
      });
    }
  }
  rows.sort((a, b) => {
    const dt = parseDmy(b.d) - parseDmy(a.d);
    if (dt !== 0) return dt;
    return a.exerciseName.localeCompare(b.exerciseName, "de");
  });
  return rows;
}

export function renderFilterPills(container, activeFilter) {
  const groups = [FILTER_ALL, ...GROUP_ORDER];
  container.innerHTML = groups.map((g) => `
    <button class="filter-pill ${g === activeFilter ? "active" : ""}" data-action="set-table-filter" data-grp="${g}">${g}</button>
  `).join("");
}

export function renderTable(tbody, countEl, rows, activeFilter) {
  const filtered = activeFilter === FILTER_ALL ? rows : rows.filter((r) => r.grp === activeFilter);

  tbody.innerHTML = filtered.map((row) => `
    <tr data-exercise-id="${row.exerciseId}" data-session-id="${row.sessionId}">
      <td class="cell-date">${row.d}</td>
      <td class="cell-name">${escapeHtml(row.exerciseName)}</td>
      <td><span class="group-badge" data-grp="${row.grp}">${row.grp}</span></td>
      <td class="editable-cell" data-action="edit-cell" data-field="${row.primaryField}" data-value="${row.primary}" data-unit="${row.cardio ? "min" : "kg"}">${formatPrimary(row.primary, row.cardio)}</td>
      <td class="editable-cell" data-action="edit-cell" data-field="${row.secondaryField}" data-value="${row.secondary}" data-unit="${row.cardio ? "int" : ""}">${formatSecondary(row.secondary, row.cardio)}</td>
    </tr>
  `).join("");

  countEl.textContent = `${filtered.length} Eintrag${filtered.length === 1 ? "" : "e"}`;
}

// Wandelt eine editable-cell <td> in ein Eingabefeld um (Inline-Edit).
export function startEditCell(td) {
  if (td.querySelector("input")) return; // schon im Bearbeitungsmodus
  const field = td.dataset.field;
  const currentValue = td.dataset.value;
  const step = field === "kg" ? "0.5" : "1";
  td.innerHTML = `<input type="number" step="${step}" min="0" value="${currentValue}" />`;
  const input = td.querySelector("input");
  input.focus();
  input.select();
}

export function restoreCell(td) {
  const value = Number(td.dataset.value);
  td.innerHTML = formatCellValue(td, value);
}

export function commitCellDisplay(td, newValue) {
  td.dataset.value = String(newValue);
  td.innerHTML = formatCellValue(td, newValue);
}

function formatCellValue(td, value) {
  const unit = td.dataset.unit;
  if (unit === "kg") return `${formatNum(value)} kg`;
  if (unit === "min") return `${formatNum(value)} min`;
  if (unit === "int") return `Int. ${formatNum(value)}`;
  return `${formatNum(value)}`;
}

function formatPrimary(value, cardio) {
  return cardio ? `${formatNum(value)} min` : `${formatNum(value)} kg`;
}

function formatSecondary(value, cardio) {
  return cardio ? `Int. ${formatNum(value)}` : `${formatNum(value)}`;
}

function formatNum(n) {
  return Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
}
