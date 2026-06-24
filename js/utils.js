// Datums-/Validierungs-Helfer. isValidSession ist die einzige Stelle, die definiert,
// was eine "gültige" Session ist (kg > 0) – wird konsequent überall verwendet, wo
// Sessions gelesen werden (Chart, Tabelle, letzter Eintrag, Sessions-Badge).

export function formatDateToday() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function parseDmy(d) {
  const [dd, mm, yyyy] = d.split(".").map(Number);
  return new Date(yyyy, mm - 1, dd).getTime();
}

export function formatDmShort(d) {
  // "TT.MM.JJJJ" -> "TT.MM"
  const [dd, mm] = d.split(".");
  return `${dd}.${mm}`;
}

export function isValidSession(session) {
  return typeof session.kg === "number" && session.kg > 0;
}

export function validSessionsSortedDesc(exercise) {
  // Sessions liegen bereits neueste-zuerst vor (so werden sie beim Eintragen
  // vorne eingefügt); hier zusätzlich defensiv sortiert + gefiltert.
  return exercise.sessions
    .filter(isValidSession)
    .slice()
    .sort((a, b) => parseDmy(b.d) - parseDmy(a.d));
}

export function isDoneToday(exercise) {
  const valid = validSessionsSortedDesc(exercise);
  if (valid.length === 0) return false;
  return valid[0].d === formatDateToday();
}

export function lastValidSession(exercise) {
  const valid = validSessionsSortedDesc(exercise);
  return valid.length ? valid[0] : null;
}

// Anzahl der Tage in den letzten 7 Kalendertagen (inkl. heute), an denen mindestens
// eine gültige Session über alle Übungen existiert.
export function sessionsInLast7Days(exercises) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = today.getTime() - 6 * 86400000; // heute + 6 Tage zurück = 7 Tage Fenster

  const daysWithSession = new Set();
  for (const ex of exercises) {
    for (const s of ex.sessions) {
      if (!isValidSession(s)) continue;
      const t = parseDmy(s.d);
      if (t >= cutoff && t <= today.getTime()) {
        daysWithSession.add(s.d);
      }
    }
  }
  return daysWithSession.size;
}

export function isValidWeight(value) {
  return typeof value === "number" && !Number.isNaN(value) && value > 0;
}

export function isValidReps(value) {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// Liefert die letzten 14 Kalendertage (älteste zuerst, heute zuletzt) im Format
// "TT.MM.JJJJ", für die Tagesbalken der Auswertungs-Widgets.
export function last14Days() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    days.push(`${dd}.${mm}.${yyyy}`);
  }
  return days;
}

// Geht die komplette Session-Historie einer Übung chronologisch durch und merkt sich,
// an welchen Tagen ein neues maximales Gewicht erreicht wurde ("Gewichtssteigerung")
// bzw. an welchen Tagen bei gleichbleibendem Maximalgewicht mehr Wiederholungen als
// bisher erreicht wurden ("Wiederholungssteigerung"). Die jeweils erste Session einer
// Übung legt nur die Ausgangs-Basis fest und zählt nicht selbst als Steigerung, da es
// kein "bisheriges" Gewicht zum Vergleich gibt.
export function computeProgressionPRDates(exercise) {
  const sessionsAsc = validSessionsSortedDesc(exercise).slice().reverse();
  let maxWeight = null;
  let bestRepsAtMax = null;
  const weightPRDates = new Set();
  const repsPRDates = new Set();

  for (const s of sessionsAsc) {
    if (maxWeight === null) {
      maxWeight = s.kg;
      bestRepsAtMax = s.r;
      continue;
    }
    if (s.kg > maxWeight) {
      maxWeight = s.kg;
      bestRepsAtMax = s.r;
      weightPRDates.add(s.d);
    } else if (s.kg === maxWeight && s.r > bestRepsAtMax) {
      bestRepsAtMax = s.r;
      repsPRDates.add(s.d);
    }
  }
  return { weightPRDates, repsPRDates };
}

// Aggregiert über alle Übungen: für jeden der letzten 14 Tage die Anzahl der
// Übungen, die an diesem Tag eine Gewichts- bzw. Wiederholungssteigerung erreicht haben.
export function computeDailyProgressionCounts(exercises) {
  const days = last14Days();
  const daySet = new Set(days);
  const weightCounts = Object.fromEntries(days.map((d) => [d, 0]));
  const repsCounts = Object.fromEntries(days.map((d) => [d, 0]));

  for (const ex of exercises) {
    const { weightPRDates, repsPRDates } = computeProgressionPRDates(ex);
    for (const d of weightPRDates) if (daySet.has(d)) weightCounts[d]++;
    for (const d of repsPRDates) if (daySet.has(d)) repsCounts[d]++;
  }
  return { days, weightCounts, repsCounts };
}

// Anzahl verschiedener Übungen am letzten Trainingstag (dem jüngsten Datum mit
// mindestens einer gültigen Session über alle Übungen). Bleibt bewusst auf diesem
// Wert stehen, bis am NÄCHSTEN Tag ein neuer Eintrag erfolgt – setzt sich nicht
// automatisch um Mitternacht zurück.
export function latestTrainingDayExerciseCount(exercises) {
  let latestDate = null;
  let latestTime = -Infinity;
  for (const ex of exercises) {
    for (const s of ex.sessions) {
      if (!isValidSession(s)) continue;
      const t = parseDmy(s.d);
      if (t > latestTime) {
        latestTime = t;
        latestDate = s.d;
      }
    }
  }
  if (latestDate === null) return 0;

  const exerciseIds = new Set();
  for (const ex of exercises) {
    if (ex.sessions.some((s) => isValidSession(s) && s.d === latestDate)) {
      exerciseIds.add(ex.id);
    }
  }
  return exerciseIds.size;
}

export function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
