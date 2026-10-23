// The server remains the source of truth. This only preserves unsent form text
// in the current browser tab, gives metadata dialogs native focus handling and
// opens the closed form card a link or fragment names.
export const browserScript = `(() => {
  let storage;
  try { storage = window.sessionStorage; storage.setItem('buoy:check', '1'); storage.removeItem('buoy:check'); } catch {}
  const url = new URL(location.href);
  const introduction = document.querySelector('[data-introduction]');
  if (storage && introduction) {
    if (url.searchParams.get('intro') === 'hidden') storage.setItem('buoy:intro', 'hidden');
    if (url.searchParams.get('intro') === 'show') storage.removeItem('buoy:intro');
    if (storage.getItem('buoy:intro') === 'hidden') {
      introduction.hidden = true;
      if (!document.querySelector('[data-show-introduction]')) { const link = document.createElement('a'); link.href = '/app?intro=show#first-use'; link.textContent = 'Show first-use checklist'; link.dataset.showIntroduction = 'true'; introduction.before(link); }
    }
  }
  const saved = url.searchParams.get('saved');
  if (saved && storage) { const split = saved.indexOf('|'); if (split > 0 && saved.startsWith('/app')) storage.removeItem('buoy:draft:' + saved.slice(0, split) + ':' + saved.slice(split + 1)); }
  // A successful reviewed multi-form operation clears drafts of its whole group
  // before restoration, so a prior receipt cannot put its stale revision back.
  if (saved && storage) { const split = saved.indexOf('|'); if (split > 0) { const path = saved.slice(0, split), group = saved.slice(split + 1); for (const form of document.querySelectorAll('form[data-draft-group]')) if (form.dataset.draftGroup === group) storage.removeItem('buoy:draft:' + path + ':' + form.getAttribute('id')); } }
  if (saved && storage && saved.endsWith('|delete')) { for (const key of Object.keys(storage)) if (key.startsWith('buoy:draft:')) storage.removeItem(key); }
  if (saved) { url.searchParams.delete('saved'); history.replaceState(null, '', url); }
  const error = document.querySelector('[data-form-error]');
  if (error) { error.tabIndex = -1; error.focus(); }
  for (const form of document.querySelectorAll('form[data-draft]')) {
    const key = 'buoy:draft:' + location.pathname + ':' + form.getAttribute('id');
    const fields = [...form.elements].filter(el => el.name && !['hidden','submit'].includes(el.type));
    if (error) { form.setAttribute('aria-describedby', 'form-error'); for (const el of fields) el.setAttribute('aria-describedby', 'form-error'); }
    if (storage && !error) {
      try { const draft = JSON.parse(storage.getItem(key) || 'null'); if (draft) { for (const el of fields) { if (el.name in draft) { if (el.type === 'checkbox') el.checked = draft[el.name] === true; else el.value = draft[el.name]; } } const revision = form.querySelector('[name="revision"]'); if (revision && draft._revision) { if (revision.value !== draft._revision) { const note = document.createElement('p'); note.textContent = 'Your unsent draft was restored, but the saved account has changed. Review the current evidence before replacing it.'; form.prepend(note); } revision.value = draft._revision; } } } catch {}
    }
    form.addEventListener('input', () => {
      form.dataset.dirty = 'true';
      if (storage) try { const draft = {}; for (const el of fields) draft[el.name] = el.type === 'checkbox' ? el.checked : el.value; const revision = form.querySelector('[name="revision"]'); if (revision) draft._revision = revision.value; storage.setItem(key, JSON.stringify(draft)); form.dataset.dirty = 'false'; } catch {}
    });
    form.addEventListener('submit', () => { form.dataset.dirty = 'false'; });
    for (const toggle of form.querySelectorAll('[data-source]')) {
      const sync = () => { for (const el of form.querySelectorAll('[data-group="' + toggle.dataset.source + '"]')) { el.required = toggle.checked; el.disabled = !toggle.checked; } };
      toggle.addEventListener('change', sync); sync();
    }
  }
  window.addEventListener('beforeunload', event => { if (document.querySelector('[data-dirty="true"]')) { event.preventDefault(); event.returnValue = ''; } });
  const reveal = () => { let target = null; try { target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch {} const card = target && target.closest('details'); if (card && !card.open) { card.open = true; target.scrollIntoView(); } };
  reveal(); window.addEventListener('hashchange', reveal);
  for (const opener of document.querySelectorAll('[data-open]')) {
    const dialog = document.getElementById(opener.dataset.open);
    opener.addEventListener('click', () => { dialog.showModal(); dialog.querySelector('button').focus(); });
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab' || event.ctrlKey || event.altKey || event.metaKey) return;
      const controls = [...dialog.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(element => element.getClientRects().length && !element.hidden && element.type !== 'hidden');
      const first = controls[0], last = controls[controls.length - 1];
      if (first && ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last))) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      }
    });
    dialog.addEventListener('close', () => opener.focus());
  }
})();`;
