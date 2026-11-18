const glyphs = {
  route: '<circle cx="6" cy="18" r="2.2"/><path d="M8.2 18h7.2a3 3 0 0 0 0-6h-6.8a3 3 0 0 1 0-6H13"/><circle cx="16" cy="6" r="2.2"/><path d="m19 15 3 3-3 3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
  clipboard: '<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h3m0 7h8m-8 4h8"/>',
  shield: '<path d="M12 22s7-3.8 7-9.8V5.8l-7-3-7 3v6.4c0 6 7 9.8 7 9.8Z"/><path d="m9 12 2 2 4-4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.2 9a2.9 2.9 0 0 1 5.6 1c0 2-2.8 2.2-2.8 4m0 3h.01"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2.4"/>',
  spark: '<path d="M12 2 9.2 9.2 2 12l7.2 2.8L12 22l2.8-7.2L22 12l-7.2-2.8L12 2Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.1"/><path d="m15 15 5 5"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  package: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 21v-9m-4-6.7 8 4.4"/>',
  bag: '<path d="M5 8h14l1.3 11a1 1 0 0 1-1 1H4.7a1 1 0 0 1-1-1L5 8Z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/>',
  chair: '<path d="M7 13V6a2.5 2.5 0 0 1 2.5-2.5h5A2.5 2.5 0 0 1 17 6v7M5 16v4m14-4v4"/><rect x="4" y="13" width="16" height="4" rx="1.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  hand: '<path d="M8 12V6.3a1.5 1.5 0 0 1 3 0v5.2-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v6-2a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.7-2.2l-4-4.9a1.5 1.5 0 0 1 2.2-2l1.5 1.4"/>',
  badge: '<path d="m12 2 2.3 2.1 3.1.1 1.1 2.9 2.6 1.7-.6 3.1.6 3.1-2.6 1.7-1.1 2.9-3.1.1-2.3 2.1-2.3-2.1-3.1-.1-1.1-2.9-2.6-1.7.6-3.1-.6-3.1 2.6-1.7 1.1-2.9 3.1-.1L12 2Z"/><path d="m9 12 2 2 4-4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
  printer: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 12h.01"/><path d="M6 14h12v7H6z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
  inbox: '<path d="M4 12 7 5h10l3 7v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6Z"/><path d="M4 12h4l2 3h4l2-3h4"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2m2-15a3 3 0 0 1 0 6m1 3a4 4 0 0 1 3 4v2"/>',
};

export function icon(name) {
  return `<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${glyphs[name] ?? ''}</svg>`;
}
