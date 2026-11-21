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
  function selectDemo(id, { focus = false, focusPanel = false, scroll = false, historyMode } = {}) {
    if (!ids.includes(id)) return;
    tabs.forEach(tab => {
      const selected = tab.dataset.demoLink === id;
      tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    });
    panels.forEach(panel => {
      panel.hidden = panel.id !== 'demo-' + id;
      const video = panel.querySelector('video');
      if (panel.hidden) { video.pause(); video.muted = true; }
    });
    const hash = '#demo-' + id;
    if (historyMode && location.hash !== hash) history[historyMode === 'replace' ? 'replaceState' : 'pushState'](null, '', hash);
    if (scroll) document.getElementById('demo-' + id).scrollIntoView({ block: 'start' });
    if (focusPanel) document.getElementById('demo-' + id).focus({ preventScroll: true });
  }
  document.querySelectorAll('[data-demo-link]').forEach(link => link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); closeMenu(); selectDemo(link.dataset.demoLink, { scroll: true, focusPanel: link.getAttribute('role') !== 'tab', historyMode: 'push' });
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
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)'), inView = new Set(), pausedByVisitor = new WeakSet();
  function tryAutoplay(video) {
    if (!inView.has(video) || document.hidden || reducedMotion.matches || video.closest('[hidden]') || document.querySelector('dialog[open]') || pausedByVisitor.has(video)) return;
    video.play().catch(() => {});
  }
  videos.forEach(video => {
    const sound = video.closest('.demo-panel').querySelector('[data-video-sound]');
    function updateSound() { sound.textContent = video.muted ? 'Activer le son' : 'Couper le son'; sound.setAttribute('aria-pressed', String(!video.muted)); }
    video.addEventListener('volumechange', updateSound);
    video.addEventListener('play', () => {
      pausedByVisitor.delete(video);
      videos.forEach(other => { if (other !== video) { other.pause(); other.muted = true; } });
    });
    video.addEventListener('pause', () => {
      // Preserve a manual pause while the video stays in view.
      if (inView.has(video) && !video.closest('[hidden]') && !document.hidden && !document.querySelector('dialog[open]')) pausedByVisitor.add(video);
    });
    sound.addEventListener('click', () => {
      const enable = video.muted;
      video.muted = !enable;
      if (enable) { video.currentTime = 0; pausedByVisitor.delete(video); video.play().catch(() => {}); }
      updateSound();
    });
    updateSound();
  });
  if ('IntersectionObserver' in window) {
    const mediaObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { inView.add(entry.target); tryAutoplay(entry.target); }
      else { inView.delete(entry.target); entry.target.pause(); }
    }), { threshold: .25 });
    videos.forEach(video => mediaObserver.observe(video));
    const tabObserver = new MutationObserver(() => videos.forEach(tryAutoplay));
    panels.forEach(panel => tabObserver.observe(panel, { attributes: true, attributeFilter: ['hidden'] }));
  }
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) videos.forEach(video => video.pause()); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) videos.forEach(video => video.pause());
    else videos.forEach(tryAutoplay);
  });
  // Also covers the preferences dialog injected by the consent module.
  new MutationObserver(entries => {
    if (entries.some(entry => entry.target.tagName === 'DIALOG' && entry.target.open)) videos.forEach(video => video.pause());
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });

  const capture = document.getElementById('capture-dialog');
  document.querySelectorAll('[data-capture]').forEach(button => button.addEventListener('click', () => {
    const preview = button.querySelector('img'), enlarged = document.getElementById('enlarged-capture');
    const source = new URL(preview.currentSrc || preview.src);
    enlarged.src = source.searchParams.get('url') || source.href; enlarged.alt = preview.alt;
    document.getElementById('capture-title').textContent = button.dataset.captureLabel;
    videos.forEach(video => video.pause()); closeMenu();
    capture.showModal(); capture.scrollTop = 0; document.documentElement.classList.add('dialog-open');
  }));
  capture.querySelector('[data-close-dialog]').addEventListener('click', () => capture.close());
  capture.addEventListener('close', () => document.documentElement.classList.remove('dialog-open'));
  capture.addEventListener('click', event => {
    const r = capture.getBoundingClientRect();
    if (event.target === capture && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) capture.close();
  });
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
