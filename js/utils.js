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

// Funktioniert für beide Übungstypen: Kraft-Sessions haben ein kg-Feld (gültig wenn
// kg > 0), Cardio-Sessions haben ein zeit-Feld (gültig wenn zeit > 0).
export function isValidSession(session) {
  if (typeof session.kg === "number") return session.kg > 0;
  if (typeof session.zeit === "number") return session.zeit > 0;
  return false;
}

export function isKraftExercise(exercise) {
  return (exercise.type ?? "kraft") === "kraft";
}

export function isCardioExercise(exercise) {
  return exercise.type === "cardio";
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

export function isValidZeit(value) {
  return typeof value === "number" && !Number.isNaN(value) && value > 0;
}

export function isValidIntensitaet(value) {
  return typeof value === "number" && !Number.isNaN(value) && value > 0;
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

// Liefert die letzten n Trainingstage (Tage mit mindestens einer gültigen Session
// über die übergebenen Übungen) in aufsteigender Reihenfolge (ältester zuerst).
// Anders als ein reines Kalenderfenster überspringt das Tage ohne Eintrag, sodass
// z.B. "die letzten 14 Sessions" wirklich 14 tatsächliche Trainingstage zeigt.
export function lastNTrainingDays(exercises, n) {
  const allDates = new Set();
  for (const ex of exercises) {
    for (const s of ex.sessions) {
      if (isValidSession(s)) allDates.add(s.d);
    }
  }
  return [...allDates]
    .sort((a, b) => parseDmy(b) - parseDmy(a))
    .slice(0, n)
    .reverse();
}

// Geht die komplette Session-Historie einer Kraft-Übung chronologisch durch und
// merkt sich, an welchen Tagen ein neues maximales Gewicht erreicht wurde
// ("Gewichtssteigerung") bzw. an welchen Tagen bei gleichbleibendem Maximalgewicht
// mehr Wiederholungen als bisher erreicht wurden ("Wdh-Steigerung"). Die jeweils
// erste Session einer Übung legt nur die Ausgangs-Basis fest und zählt nicht selbst
// als Steigerung, da es kein "bisheriges" Gewicht zum Vergleich gibt. Gilt nur für
// Kraft-Übungen (Cardio hat kein analoges Gewicht/Wdh-Konzept).
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

// Aggregiert über alle Kraft-Übungen: für jeden der letzten 14 Trainingstage (nicht
// Kalendertage) die Anzahl der Übungen, die an diesem Tag eine Gewichts- bzw.
// Wdh-Steigerung erreicht haben.
export function computeDailyProgressionCounts(exercises) {
  const kraftExercises = exercises.filter(isKraftExercise);
  const days = lastNTrainingDays(kraftExercises, 14);
  const daySet = new Set(days);
  const weightCounts = Object.fromEntries(days.map((d) => [d, 0]));
  const repsCounts = Object.fromEntries(days.map((d) => [d, 0]));

  for (const ex of kraftExercises) {
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

// Durchschnittliche Anzahl an verschiedenen Übungen pro Trainingseinheit (= Tag mit
// mindestens einer gültigen Session) innerhalb der letzten `weeks` Wochen. Wird NICHT
// auf alle Kalendertage des Fensters verteilt (das würde an trainingsfreien Tagen
// künstlich verwässern), sondern nur auf die Tage, an denen tatsächlich trainiert
// wurde. Mehrere Sessions derselben Übung am selben Tag zählen dabei nur einmal.
export function avgExercisesPerSession(exercises, weeks = 6) {
  const totalDays = weeks * 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = today.getTime() - (totalDays - 1) * 86400000;

  const exerciseCountByDay = {};
  for (const ex of exercises) {
    const daysSeenForEx = new Set();
    for (const s of ex.sessions) {
      if (!isValidSession(s)) continue;
      const t = parseDmy(s.d);
      if (t < cutoff || t > today.getTime()) continue;
      if (daysSeenForEx.has(s.d)) continue;
      daysSeenForEx.add(s.d);
      exerciseCountByDay[s.d] = (exerciseCountByDay[s.d] ?? 0) + 1;
    }
  }
  const trainingDays = Object.keys(exerciseCountByDay);
  if (trainingDays.length === 0) return 0;
  const total = trainingDays.reduce((sum, d) => sum + exerciseCountByDay[d], 0);
  return total / trainingDays.length;
}

// Verteilung der Trainingseinheiten (gültige Sessions) der letzten `weeks` Wochen
// nach Muskelgruppe, als Array von {grp, count}, nur Gruppen mit count > 0.
export function groupDistribution(exercises, weeks = 6) {
  const totalDays = weeks * 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = today.getTime() - (totalDays - 1) * 86400000;

  const counts = {};
  for (const ex of exercises) {
    for (const s of ex.sessions) {
      if (!isValidSession(s)) continue;
      const t = parseDmy(s.d);
      if (t >= cutoff && t <= today.getTime()) {
        counts[ex.grp] = (counts[ex.grp] ?? 0) + 1;
      }
    }
  }
  return Object.entries(counts)
    .map(([grp, count]) => ({ grp, count }))
    .sort((a, b) => b.count - a.count);
}

// Bester Wert einer Übung innerhalb der letzten 6 Monate: bei Kraft das höchste
// Gewicht und die dazu höchste Wiederholungszahl, bei Cardio die höchste Zeit und
// die dazu höchste Intensität. Gibt es in den letzten 6 Monaten keine gültige
// Session, wird auf die gesamte Historie zurückgefallen, damit nicht "keine Daten"
// angezeigt wird, nur weil zuletzt länger nicht trainiert wurde.
export function bestValueRecent(exercise) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = today.getTime() - 180 * 86400000;

  const allValid = validSessionsSortedDesc(exercise);
  let pool = allValid.filter((s) => parseDmy(s.d) >= cutoff);
  if (pool.length === 0) pool = allValid;
  if (pool.length === 0) return null;

  const primaryKey = isCardioExercise(exercise) ? "zeit" : "kg";
  const secondaryKey = isCardioExercise(exercise) ? "intensitaet" : "r";

  let best = pool[0];
  for (const s of pool) {
    if (
      s[primaryKey] > best[primaryKey] ||
      (s[primaryKey] === best[primaryKey] && s[secondaryKey] > best[secondaryKey])
    ) {
      best = s;
    }
  }
  return best;
}

// Durchschnittliche Anzahl Trainingstage (Tage mit ≥1 gültiger Session) pro Woche
// innerhalb der letzten `weeks` Wochen.
export function avgSessionsPerWeek(exercises, weeks = 6) {
  const totalDays = weeks * 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = today.getTime() - (totalDays - 1) * 86400000;

  const trainingDays = new Set();
  for (const ex of exercises) {
    for (const s of ex.sessions) {
      if (!isValidSession(s)) continue;
      const t = parseDmy(s.d);
      if (t >= cutoff && t <= today.getTime()) trainingDays.add(s.d);
    }
  }
  return trainingDays.size / weeks;
}

// Gibt die Menge aller Datums-Strings zurück, an denen mindestens eine gültige
// Session stattgefunden hat – Basis für die Kalender-Kachel.
export function trainingDaysSet(exercises) {
  const days = new Set();
  for (const ex of exercises) {
    for (const s of ex.sessions) {
      if (isValidSession(s)) days.add(s.d);
    }
  }
  return days;
}

export function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
