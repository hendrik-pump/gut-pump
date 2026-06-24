// Rendering von View 2 (Datentabelle). Reine Darstellungsfunktionen; Event-Wiring
// und DB-Updates passieren in app.js.

import { GROUP_ORDER } from "./groups.js";
import { escapeHtml, parseDmy, validSessionsSortedDesc } from "./utils.js";

export const FILTER_ALL = "Alle";

// Baut eine flache, sortierte Liste aller gültigen Sessions über alle Übungen.
export function buildRows(exercises) {
  const rows = [];
  for (const ex of exercises) {
    for (const s of validSessionsSortedDesc(ex)) {
      rows.push({
        exerciseId: ex.id,
        exerciseName: ex.name,
        grp: ex.grp,
        sessionId: s.id,
        d: s.d,
        kg: s.kg,
        r: s.r,
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
      <td class="editable-cell" data-action="edit-cell" data-field="kg" data-value="${row.kg}">${formatKg(row.kg)} kg</td>
      <td class="editable-cell" data-action="edit-cell" data-field="r" data-value="${row.r}">${row.r}</td>
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
  const field = td.dataset.field;
  const value = Number(td.dataset.value);
  td.innerHTML = field === "kg" ? `${formatKg(value)} kg` : `${value}`;
}

export function commitCellDisplay(td, newValue) {
  const field = td.dataset.field;
  td.dataset.value = String(newValue);
  td.innerHTML = field === "kg" ? `${formatKg(newValue)} kg` : `${newValue}`;
}

function formatKg(kg) {
  return Number.isInteger(kg) ? String(kg) : String(kg).replace(".", ",");
}
