// App-Einstiegspunkt: Init, globaler State, View-Routing, Event-Delegation.
// Pattern: nach jeder mutierenden Aktion wird der State komplett neu aus IndexedDB
// geladen und die aktuell sichtbare View neu gerendert ("refreshAndRender") – bei
// dieser Datenmenge (21 Übungen, je wenige Dutzend Sessions) unproblematisch und am
// wenigsten fehleranfällig.

import { ensureSeedImported, ensurePatch20260624Applied, getAllExercises, addExercise, updateExercise, deleteExercise, addSession, updateSession } from "./db.js";
import { renderExerciseList, renderSessionsBadge, toggleEntryForm } from "./render-list.js";
import { renderStatsSection } from "./render-stats.js";
import { buildRows, renderFilterPills, renderTable, FILTER_ALL, startEditCell, restoreCell, commitCellDisplay } from "./render-table.js";
import { initDialogs, openAddDialog, openEditDialog } from "./render-dialogs.js";
import { exportRowsAsXlsx } from "./xlsx-export.js";
import { isValidWeight, isValidReps, isValidZeit, isValidIntensitaet, isCardioExercise } from "./utils.js";

const state = {
  exercises: [],
  currentView: "list", // 'list' | 'table'
  editMode: false,
  tableFilter: FILTER_ALL,
};

const listContainer = document.getElementById("exercise-list");
const statsSection = document.getElementById("stats-section");
const sessionsBadge = document.getElementById("sessions-badge");
const settingsBtn = document.getElementById("settings-btn");
const settingsMenu = document.getElementById("settings-menu");
const viewList = document.getElementById("view-list");
const viewTable = document.getElementById("view-table");
const exitEditBtn = document.getElementById("exit-edit-mode-btn");

const tableBackBtn = document.getElementById("table-back-btn");
const filterPillsContainer = document.getElementById("filter-pills");
const tableBody = document.getElementById("data-table-body");
const tableCount = document.getElementById("table-count");
const exportXlsxBtn = document.getElementById("export-xlsx-btn");

async function init() {
  await ensureSeedImported();
  await ensurePatch20260624Applied();
  await refreshAndRender();

  wireHeader();
  wireExerciseList();
  wireTableView();
  initDialogs({ onSave: handleDialogSave, onDelete: handleDialogDelete });
  registerServiceWorker();

  if (navigator.storage?.persist) {
    navigator.storage.persist().catch(() => {});
  }
}

async function refreshAndRender() {
  state.exercises = await getAllExercises();
  renderCurrentView();
}

function renderCurrentView() {
  renderExerciseList(listContainer, state.exercises, state.editMode);
  renderSessionsBadge(sessionsBadge, state.exercises);
  renderStatsSection(statsSection, state.exercises);

  if (state.currentView === "table") {
    renderFilterPills(filterPillsContainer, state.tableFilter);
    const rows = buildRows(state.exercises);
    renderTable(tableBody, tableCount, rows, state.tableFilter);
  }
}

// ---------------- Header / Settings-Menü ----------------

function wireHeader() {
  settingsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    settingsMenu.classList.toggle("hidden");
  });
  document.addEventListener("click", (e) => {
    if (!settingsMenu.classList.contains("hidden") && !settingsMenu.contains(e.target) && e.target !== settingsBtn) {
      settingsMenu.classList.add("hidden");
    }
  });

  settingsMenu.addEventListener("click", (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    settingsMenu.classList.add("hidden");

    if (action === "open-add-exercise") openAddDialog();
    if (action === "enter-edit-mode") enterEditMode();
    if (action === "open-table") showTableView();
  });

  exitEditBtn.addEventListener("click", exitEditMode);
}

function enterEditMode() {
  state.editMode = true;
  exitEditBtn.classList.remove("hidden");
  renderCurrentView();
}

function exitEditMode() {
  state.editMode = false;
  exitEditBtn.classList.add("hidden");
  renderCurrentView();
}

// ---------------- View 1: Übungsliste ----------------

function wireExerciseList() {
  listContainer.addEventListener("click", async (e) => {
    const actionEl = e.target.closest("[data-action]");
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    const card = actionEl.closest(".exercise-card");
    const id = actionEl.dataset.id;

    if (action === "toggle-entry-form") {
      toggleEntryForm(card);
    } else if (action === "save-entry") {
      await handleSaveEntry(card, id);
    } else if (action === "edit-exercise") {
      const exercise = state.exercises.find((ex) => ex.id === id);
      if (exercise) openEditDialog(exercise);
    }
  });
}

async function handleSaveEntry(card, exerciseId) {
  const exercise = state.exercises.find((ex) => ex.id === exerciseId);
  const cardio = isCardioExercise(exercise);
  const primaryInput = card.querySelector(".input-primary");
  const secondaryInput = card.querySelector(".input-secondary");
  const primary = parseFloat(primaryInput.value);
  const secondary = cardio ? parseFloat(secondaryInput.value) : parseInt(secondaryInput.value, 10);

  if (cardio) {
    if (!isValidZeit(primary) || !isValidIntensitaet(secondary)) return;
    await addSession(exerciseId, { zeit: primary, intensitaet: secondary });
  } else {
    if (!isValidWeight(primary) || !isValidReps(secondary)) return;
    await addSession(exerciseId, { kg: primary, r: secondary });
  }
  await refreshAndRender();
}

// ---------------- View 2: Datentabelle ----------------

function showTableView() {
  state.currentView = "table";
  viewList.classList.add("hidden");
  viewTable.classList.remove("hidden");
  renderCurrentView();
}

function showListView() {
  state.currentView = "list";
  viewTable.classList.add("hidden");
  viewList.classList.remove("hidden");
}

function wireTableView() {
  tableBackBtn.addEventListener("click", showListView);

  exportXlsxBtn.addEventListener("click", () => {
    const rows = buildRows(state.exercises); // gesamte Tabelle, unabhängig vom aktiven Filter
    exportRowsAsXlsx(rows, "Gut-pump-Datentabelle.xlsx");
  });

  filterPillsContainer.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='set-table-filter']");
    if (!btn) return;
    state.tableFilter = btn.dataset.grp;
    renderCurrentView();
  });

  tableBody.addEventListener("click", (e) => {
    const td = e.target.closest("[data-action='edit-cell']");
    if (!td) return;
    startEditCell(td);
  });

  tableBody.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName === "INPUT") {
      e.preventDefault();
      e.target.blur();
    }
  });

  tableBody.addEventListener("focusout", async (e) => {
    if (e.target.tagName !== "INPUT") return;
    const td = e.target.closest("[data-action='edit-cell']");
    if (!td) return;
    await commitCellEdit(td, e.target.value);
  });
}

const FIELD_VALIDATORS = {
  kg: { parse: parseFloat, isValid: isValidWeight },
  r: { parse: (v) => parseInt(v, 10), isValid: isValidReps },
  zeit: { parse: parseFloat, isValid: isValidZeit },
  intensitaet: { parse: parseFloat, isValid: isValidIntensitaet },
};

async function commitCellEdit(td, rawValue) {
  const field = td.dataset.field;
  const row = td.closest("tr");
  const exerciseId = row.dataset.exerciseId;
  const sessionId = row.dataset.sessionId;

  const { parse, isValid } = FIELD_VALIDATORS[field];
  const parsed = parse(rawValue);

  if (!isValid(parsed)) {
    restoreCell(td);
    return;
  }

  await updateSession(exerciseId, sessionId, { [field]: parsed });
  commitCellDisplay(td, parsed);
  state.exercises = await getAllExercises(); // State synchron halten (für Chart bei Rückkehr zur Liste)
}

// ---------------- Dialoge: Übung hinzufügen / bearbeiten / löschen ----------------

async function handleDialogSave({ id, name, grp, type, img }) {
  if (id) {
    await updateExercise(id, { name, grp, img }); // type bewusst nicht übergeben, bleibt unveränderlich
    await refreshAndRender();
  } else {
    const created = await addExercise({ name, grp, type, img });
    await refreshAndRender();
    const newCard = listContainer.querySelector(`[data-id="${created.id}"]`);
    newCard?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

async function handleDialogDelete(id) {
  await deleteExercise(id);
  await refreshAndRender();
}

// ---------------- Service Worker ----------------

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
}

init();
