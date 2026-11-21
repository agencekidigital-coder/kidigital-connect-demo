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
  matchMedia('(max-width: 1000px)').addEventListener('change', () => closeMenu());

  const tabs = [...document.querySelectorAll('.product-tabs [role="tab"]')], ids = ['pro', 'familles'];
  const panels = ids.map(id => document.getElementById('demo-' + id));
  function selectDemo(id, { focus = false, scroll = false, historyMode } = {}) {
    if (!ids.includes(id)) return;
    tabs.forEach(tab => {
      const selected = tab.dataset.demoLink === id;
      tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    });
    panels.forEach(panel => {
      panel.hidden = panel.id !== 'demo-' + id;
      if (panel.hidden) panel.querySelector('video').pause();
    });
    const hash = '#demo-' + id;
    if (historyMode && location.hash !== hash) history[historyMode === 'replace' ? 'replaceState' : 'pushState'](null, '', hash);
    if (scroll) document.getElementById('demo-' + id).scrollIntoView({ block: 'start' });
  }
  document.querySelectorAll('[data-demo-link]').forEach(link => link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); closeMenu(); selectDemo(link.dataset.demoLink, { scroll: true, historyMode: 'push' });
  }));
  tabs.forEach((tab, index) => tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (event.key === ' ') { event.preventDefault(); tab.click(); return; }
    if (next !== undefined) { event.preventDefault(); selectDemo(ids[next], { focus: true, historyMode: 'replace' }); }
  }));
  function fromHash() { if (['#demo-pro', '#demo-familles'].includes(location.hash)) selectDemo(location.hash.slice(6)); }
  selectDemo(location.hash === '#demo-familles' ? 'familles' : 'pro');
  addEventListener('hashchange', fromHash); addEventListener('popstate', fromHash);
  if (['#demo-pro', '#demo-familles'].includes(location.hash)) requestAnimationFrame(() => document.querySelector(location.hash).scrollIntoView({ block: 'start' }));
  const videos = [...document.querySelectorAll('.demo-panel video')];
  videos.forEach(video => video.addEventListener('play', () => videos.forEach(other => { if (other !== video) other.pause(); })));
  document.addEventListener('visibilitychange', () => { if (document.hidden) videos.forEach(video => video.pause()); });

  const privacy = document.getElementById('privacy-dialog');
  document.querySelector('[data-open-privacy]').addEventListener('click', () => { closeMenu(); privacy.showModal(); document.documentElement.classList.add('dialog-open'); });
  privacy.querySelector('[data-close-dialog]').addEventListener('click', () => privacy.close());
  privacy.addEventListener('close', () => document.documentElement.classList.remove('dialog-open'));
  privacy.addEventListener('click', event => {
    const r = privacy.getBoundingClientRect();
    if (event.target === privacy && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) privacy.close();
  });
  const mobile = document.querySelector('.mobile-signup'), visible = new Set();
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) visible.add(entry.target.id); else visible.delete(entry.target.id); });
      mobile.hidden = visible.size !== 0;
    }, { threshold: 0.1, rootMargin: '0px 0px -75px 0px' });
    [document.getElementById('hero-signup'), document.getElementById('closing-signup')].forEach(node => observer.observe(node));
  }
})();
