const paths: Record<string, string> = {
  accounts: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  imports: '<path d="M12 16V3m-5 5 5-5 5 5M3 14v6a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6"/>',
  backups: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 4 18 4 18 0V5M3 12c0 4 18 4 18 0"/>',
  document: '<rect x="4" y="2" width="16" height="20" rx="1"/><path d="M8 7h8M8 11h8M8 15h5"/>',
  people: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-4a6 6 0 0 1 12 0v4M16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 4 5v2"/>',
  coins: '<ellipse cx="9" cy="6" rx="6" ry="3"/><path d="M3 6v8c0 4 12 4 12 0V6m0 3c8-1 9 3 9 5v5c-2 4-12 4-12 0v-2M3 10c0 4 12 4 12 0"/>',
  export: '<path d="M14 2H4v20h16V8l-6-6v6h6M12 18v-7m-3 3 3-3 3 3"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18"/>',
  undo: '<path d="M14 2H4v20h16V8l-6-6v6h6M9 11l-3 3 3 3m-3-3h8a3 3 0 0 1 0 6"/>',
};
export function icon(name: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.document}</svg>`;
}
