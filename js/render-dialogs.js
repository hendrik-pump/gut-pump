// Dialoge "Übung hinzufügen" / "Übung bearbeiten" inkl. Bild-Upload und
// Lösch-Bestätigung. Die Dialoge sind statische, einmalige DOM-Elemente (kein
// Re-Rendering nötig), daher werden ihre internen Listener hier einmalig verdrahtet.
// Nach außen (app.js) wird über Callbacks kommuniziert (onSave, onDelete).

import { fileToBase64 } from "./utils.js";

const overlay = document.getElementById("exercise-dialog-overlay");
const titleEl = document.getElementById("exercise-dialog-title");
const form = document.getElementById("exercise-form");
const nameInput = document.getElementById("exercise-name-input");
const groupSelect = document.getElementById("exercise-group-select");
const typeSelect = document.getElementById("exercise-type-select");
const imagePreview = document.getElementById("exercise-image-preview");
const imageInput = document.getElementById("exercise-image-input");
const confirmBtn = document.getElementById("exercise-confirm-btn");
const deleteBtn = document.getElementById("delete-exercise-btn");

const confirmDeleteOverlay = document.getElementById("confirm-delete-overlay");

let editingId = null; // null = "Hinzufügen"-Modus
let currentImg = null;
let callbacks = { onSave: () => {}, onDelete: () => {} };
let pendingDeleteId = null;

export function initDialogs({ onSave, onDelete }) {
  callbacks = { onSave, onDelete };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) return; // Pflichtfeld, HTML "required" deckt das meiste ab
    callbacks.onSave({ id: editingId, name, grp: groupSelect.value, type: typeSelect.value, img: currentImg });
    closeExerciseDialog();
  });

  imageInput.addEventListener("change", async () => {
    const file = imageInput.files?.[0];
    if (!file) return;
    currentImg = await fileToBase64(file);
    renderPreview();
  });

  document.querySelectorAll('[data-action="close-exercise-dialog"]').forEach((btn) => {
    btn.addEventListener("click", closeExerciseDialog);
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeExerciseDialog();
  });

  deleteBtn.addEventListener("click", () => {
    pendingDeleteId = editingId;
    confirmDeleteOverlay.classList.remove("hidden");
  });

  document.querySelector('[data-action="cancel-delete"]').addEventListener("click", () => {
    confirmDeleteOverlay.classList.add("hidden");
    pendingDeleteId = null;
  });
  document.querySelector('[data-action="confirm-delete"]').addEventListener("click", () => {
    confirmDeleteOverlay.classList.add("hidden");
    if (pendingDeleteId) callbacks.onDelete(pendingDeleteId);
    pendingDeleteId = null;
    closeExerciseDialog();
  });
  confirmDeleteOverlay.addEventListener("click", (e) => {
    if (e.target === confirmDeleteOverlay) {
      confirmDeleteOverlay.classList.add("hidden");
      pendingDeleteId = null;
    }
  });
}

export function openAddDialog() {
  editingId = null;
  currentImg = null;
  nameInput.value = "";
  groupSelect.value = "Rücken";
  typeSelect.value = "kraft";
  typeSelect.disabled = false;
  imageInput.value = "";
  renderPreview();
  titleEl.textContent = "Übung hinzufügen";
  confirmBtn.textContent = "Hinzufügen";
  deleteBtn.classList.add("hidden");
  overlay.classList.remove("hidden");
  nameInput.focus();
}

export function openEditDialog(exercise) {
  editingId = exercise.id;
  currentImg = exercise.img ?? null;
  nameInput.value = exercise.name;
  groupSelect.value = exercise.grp;
  typeSelect.value = exercise.type ?? "kraft";
  typeSelect.disabled = true; // Typ ist nach dem Anlegen unveränderlich
  imageInput.value = "";
  renderPreview();
  titleEl.textContent = "Übung bearbeiten";
  confirmBtn.textContent = "Bestätigen";
  deleteBtn.classList.remove("hidden");
  overlay.classList.remove("hidden");
}

function closeExerciseDialog() {
  overlay.classList.add("hidden");
  editingId = null;
  currentImg = null;
}

function renderPreview() {
  imagePreview.innerHTML = currentImg ? `<img src="${currentImg}" alt="" />` : "";
}
