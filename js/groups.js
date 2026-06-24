// Feste Muskelgruppen-Konfiguration: Reihenfolge, Farben (für CSS-Selektoren über
// data-grp) und Standard-Icons je Gruppe.

export const GROUP_ORDER = ["Rücken", "Brust", "Schultern", "Arme", "Beine"];

const ICON_BACK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v16M18 4v16M6 9h12M6 15h12"/></svg>`;
const ICON_CHEST = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9c0-2.5 2-4 4-4s3 1.5 4 3c1-1.5 2-3 4-3s4 1.5 4 4c0 4-4 8-8 11-4-3-8-7-8-11Z"/></svg>`;
const ICON_SHOULDERS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="8" r="3"/><circle cx="18" cy="8" r="3"/><path d="M3 20c0-4 1.5-7 3-7s3 3 3 7M15 20c0-4 1.5-7 3-7s3 3 3 7"/></svg>`;
const ICON_ARMS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v6c0 3 2 5 4 6 2-1 4-3 4-6V4M8 16v4M12 16v4"/></svg>`;
const ICON_LEGS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h2l1 9 2 9h-2l-1-7-2 7H7l2-9Z"/><path d="M13 3h2l2 18h-2l-1-9Z"/></svg>`;

export const GROUP_META = {
  "Rücken":    { icon: ICON_BACK },
  "Brust":     { icon: ICON_CHEST },
  "Schultern": { icon: ICON_SHOULDERS },
  "Arme":      { icon: ICON_ARMS },
  "Beine":     { icon: ICON_LEGS },
};

export function defaultIconFor(grp) {
  return GROUP_META[grp]?.icon ?? ICON_BACK;
}
