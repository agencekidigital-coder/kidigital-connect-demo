(() => {
  'use strict';
  const menu = document.querySelector('.menu-toggle'), navigation = document.getElementById('site-navigation');
  function closeMenu(restoreFocus = false) {
    menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', 'Ouvrir le menu'); navigation.classList.remove('is-open');
    if (restoreFocus) menu.focus();
  }
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu'); navigation.classList.toggle('is-open', open);
  });
  navigation.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') closeMenu(true); });
  const media = matchMedia('(max-width: 1000px)'); media.addEventListener('change', () => closeMenu());

  const tabs = [...document.querySelectorAll('[role="tab"]')];
  function selectTab(tab, focus = false) {
    tabs.forEach(item => {
      const selected = item === tab; item.setAttribute('aria-selected', String(selected)); item.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(item.getAttribute('aria-controls')); panel.hidden = !selected;
      if (selected) panel.querySelector('img').loading = 'eager';
    });
    if (focus) tab.focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { event.preventDefault(); selectTab(tabs[next], true); }
    });
  });
  const capture = document.getElementById('capture-dialog'), privacy = document.getElementById('privacy-dialog');
  function openDialog(dialog) { closeMenu(); dialog.showModal(); document.documentElement.classList.add('dialog-open'); }
  document.querySelectorAll('[data-enlarge]').forEach(button => button.addEventListener('click', () => {
    const image = button.querySelector('img'), enlarged = document.getElementById('enlarged-capture');
    enlarged.src = new URL(image.src).searchParams.get('url') || image.src; enlarged.alt = image.alt;
    document.getElementById('capture-dialog-title').textContent = ({ agenda: 'L’agenda professionnel', fiche: 'La fiche côté familles', studio: 'Le studio de communication' })[button.dataset.enlarge];
    openDialog(capture);
  }));
  document.querySelector('[data-open-privacy]').addEventListener('click', () => openDialog(privacy));
  for (const dialog of [capture, privacy]) {
    dialog.querySelector('[data-close-dialog]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => document.documentElement.classList.remove('dialog-open'));
    dialog.addEventListener('click', event => {
      const r = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close();
    });
  }
  const mobile = document.querySelector('.mobile-signup'), visible = new Set();
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) visible.add(entry.target.id); else visible.delete(entry.target.id); });
      mobile.hidden = visible.size !== 0;
    }, { threshold: 0.1, rootMargin: '0px 0px -75px 0px' });
    [document.getElementById('hero-signup'), document.getElementById('closing-signup')].forEach(node => observer.observe(node));
  }
})();
