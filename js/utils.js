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

export function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
