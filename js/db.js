// IndexedDB-Layer. Einzige Datenquelle der App, kein Caching-Layer davor nötig bei
// dieser Datenmenge (21 Übungen, je Übung wenige Dutzend Sessions).

import { seedExercises } from "./seed-data.js";
import { generateId, formatDateToday } from "./utils.js";

const DB_NAME = "gutpump-db";
const DB_VERSION = 1;
const STORE_EXERCISES = "exercises";
const STORE_META = "meta";

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_EXERCISES)) {
        const store = db.createObjectStore(STORE_EXERCISES, { keyPath: "id" });
        store.createIndex("grp", "grp", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(db, storeNames, mode) {
  return db.transaction(storeNames, mode);
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Importiert die Excel-Historie genau einmal. Import + Flag-Setzen laufen in einer
// einzigen Transaktion, damit bei einem Abbruch mitten im Import kein
// halb-importierter Zustand entsteht (entweder beides passiert, oder nichts).
export async function ensureSeedImported() {
  const db = await openDB();
  const metaTx = tx(db, [STORE_META], "readonly");
  const existing = await reqToPromise(metaTx.objectStore(STORE_META).get("seedImported"));
  if (existing && existing.value) return;

  const writeTx = tx(db, [STORE_EXERCISES, STORE_META], "readwrite");
  const exStore = writeTx.objectStore(STORE_EXERCISES);
  // createdAt als kleiner, streng aufsteigender Index (0,1,2,...) statt Date.now():
  // beim Massen-Import in einer engen Schleife können mehrere Date.now()-Werte
  // dieselbe Millisekunde treffen, was die Anzeigereihenfolge instabil machen würde.
  seedExercises.forEach((ex, index) => {
    const id = generateId("ex");
    exStore.put({
      id,
      name: ex.name,
      grp: ex.grp,
      type: ex.type ?? "kraft",
      img: ex.img ?? null,
      createdAt: index,
      sessions: ex.sessions.map((s) => ({ id: generateId("s"), d: s.d, kg: s.kg, r: s.r })),
    });
  });
  writeTx.objectStore(STORE_META).put({ key: "seedImported", value: true });

  await new Promise((resolve, reject) => {
    writeTx.oncomplete = () => resolve();
    writeTx.onerror = () => reject(writeTx.error);
  });
}

export async function getAllExercises() {
  const db = await openDB();
  const store = tx(db, [STORE_EXERCISES], "readonly").objectStore(STORE_EXERCISES);
  const all = await reqToPromise(store.getAll());
  return all.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
}

export async function getExercise(id) {
  const db = await openDB();
  const store = tx(db, [STORE_EXERCISES], "readonly").objectStore(STORE_EXERCISES);
  return reqToPromise(store.get(id));
}

// type ('kraft' | 'cardio') wird nur bei der Erstellung gesetzt und ist danach
// unveränderlich (siehe updateExercise, das type bewusst nie übernimmt).
export async function addExercise({ name, grp, img, type }) {
  const db = await openDB();
  const store = tx(db, [STORE_EXERCISES], "readwrite").objectStore(STORE_EXERCISES);
  // Date.now() reicht hier (im Unterschied zum Massen-Import) aus, da neue Übungen
  // einzeln per Nutzeraktion angelegt werden, nicht in einer engen Schleife.
  const exercise = {
    id: generateId("ex"),
    name,
    grp,
    type: type ?? "kraft",
    img: img ?? null,
    createdAt: Date.now(),
    sessions: [],
  };
  await reqToPromise(store.add(exercise));
  return exercise;
}

// Übernimmt bewusst nie ein "type"-Feld aus dem Aufrufer – der Übungstyp ist nach
// dem Anlegen unveränderlich.
export async function updateExercise(id, { name, grp, img }) {
  const db = await openDB();
  const store = tx(db, [STORE_EXERCISES], "readwrite").objectStore(STORE_EXERCISES);
  const current = await reqToPromise(store.get(id));
  if (!current) throw new Error(`Übung ${id} nicht gefunden.`);
  const updated = {
    ...current,
    name: name ?? current.name,
    grp: grp ?? current.grp,
    img: img !== undefined ? img : current.img,
  };
  await reqToPromise(store.put(updated));
  return updated;
}

export async function deleteExercise(id) {
  const db = await openDB();
  const store = tx(db, [STORE_EXERCISES], "readwrite").objectStore(STORE_EXERCISES);
  await reqToPromise(store.delete(id));
}

// Fügt eine neue Session mit heutigem Datum vorne in exercise.sessions ein.
// fields enthält je nach Übungstyp {kg, r} oder {zeit, intensitaet}.
export async function addSession(exerciseId, fields) {
  const db = await openDB();
  const store = tx(db, [STORE_EXERCISES], "readwrite").objectStore(STORE_EXERCISES);
  const exercise = await reqToPromise(store.get(exerciseId));
  if (!exercise) throw new Error(`Übung ${exerciseId} nicht gefunden.`);
  const session = { id: generateId("s"), d: formatDateToday(), ...fields };
  exercise.sessions = [session, ...exercise.sessions];
  await reqToPromise(store.put(exercise));
  return exercise;
}

// Inline-Edit in der Datentabelle: aktualisiert einzelne Felder (kg/r bzw.
// zeit/intensitaet) einer bestehenden Session.
export async function updateSession(exerciseId, sessionId, fields) {
  const db = await openDB();
  const store = tx(db, [STORE_EXERCISES], "readwrite").objectStore(STORE_EXERCISES);
  const exercise = await reqToPromise(store.get(exerciseId));
  if (!exercise) throw new Error(`Übung ${exerciseId} nicht gefunden.`);
  const session = exercise.sessions.find((s) => s.id === sessionId);
  if (!session) throw new Error(`Session ${sessionId} nicht gefunden.`);
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) session[key] = value;
  }
  await reqToPromise(store.put(exercise));
  return exercise;
}
