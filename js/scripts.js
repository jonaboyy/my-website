/* js/scripts.js — Jonathan Lopez site */
/* eslint-env browser */
(() => {
  'use strict';

  // Tiny helpers
  const $  = (q, r = document) => r.querySelector(q);
  const $$ = (q, r = document) => Array.from(r.querySelectorAll(q));

  // Run once DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    initSkillBars();
    initParticles();
    initProjectTabs();
    initPortfolioFilters();
    initLightbox();
    initCommandPalette();
    initPjaxPageTurn();
    prefetchOnHover();

    // (optional) initCopyButtons(); // uncomment if you added the Copy button feature
  });

  /* ---------------- SKILL BARS ---------------- */
  function initSkillBars() {
    const els = $$('.skill-bar-inner');
    if (!els.length) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.setAttribute('data-loaded', 'true');
        io.unobserve(e.target);
      });
    }, { threshold: 0.3 });

    els.forEach(el => {
      // width from data-percentage
      const pctRaw = el.getAttribute('data-percentage');
      const pct = Math.max(0, Math.min(100, parseInt(pctRaw || '0', 10) || 0));
      el.style.setProperty('--width', pct + '%');

      // wrap label into per-letter spans (right->left slide)
      const text = (el.textContent || '').trim();
      const wrapped = text.split('').map((ch, i) => {
        const c = ch === ' ' ? '&nbsp;' : ch;
        return `<span class="char" style="--i:${i}">${c}</span>`;
      }).join('');
      el.innerHTML = `<span class="skill-label">${wrapped}</span>`;

      io.observe(el);
    });
  }

  /* ---------------- PAGE TRANSITIONS ---------------- */
/* ---------------- PJAX “page turn” transitions ---------------- */
/* ---------------- PJAX “page turn” transitions — FIXED ---------------- */
function initPjaxPageTurn(){
  const originalMain = document.querySelector('main');
  if (!originalMain) return;

  // 1) Replace <main> with the stack FIRST (so we don't pull it out prematurely)
  const parent = originalMain.parentNode;
  const stack  = document.createElement('div');
  stack.id = 'viewstack';
  parent.replaceChild(stack, originalMain);    // <-- correct order

  // 2) Build the current view and put <main> inside it
  const current = document.createElement('div');
  current.className = 'view is-current';
  current.appendChild(originalMain);
  stack.appendChild(current);

  // Nav order to determine direction
  const order = {
    '':           0,
    'about':      1,
    'experience': 2,
    'projects':   3,
    'portfolio':  4,
    'skills':     5,
    'resume':     6,
    'contact':    7
  };
  const pathLast = () => {
    const parts = location.pathname.split('/').filter(p => p && p !== 'index.html');
    return parts[parts.length - 1] || '';
  };
  const idxOf = (p) => order[p] ?? 0;

  // Helper: navigate to a root-level slug from any depth
  const gotoPage = (slug) => {
    const prefix = pathLast() === '' ? '' : '../';
    navigateTo(new URL(prefix + (slug ? slug + '/' : ''), location.href).href);
  };

  // Intercept internal navigation links
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (!href || href.startsWith('#')) return;
    if (href.startsWith('mailto:') || href.startsWith('tel:')) return;
    if (a.hasAttribute('download')) return;
    if (a.target === '_blank') return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const url = new URL(href, location.href);
    if (url.origin !== location.origin) return;

    e.preventDefault();
    navigateTo(url.href);
  });

  // Back/forward
  window.addEventListener('popstate', () => navigateTo(location.href, /*push=*/false));

  async function navigateTo(url, push = true){
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
                    document.documentElement.classList.contains('reduce-motion');

    const here = pathLast();
    const nextParts = new URL(url).pathname.split('/').filter(p => p && p !== 'index.html');
    const next = nextParts[nextParts.length - 1] || '';
    const dir  = idxOf(next) > idxOf(here) ? 'forward' : 'backward';

    if (reduced){
      if (push) history.pushState({}, '', url);
      location.replace(url);
      return;
    }

    // Fetch next page and extract <main>
    let nextMain, nextTitle;
    try{
      const res  = await fetch(url, { credentials: 'same-origin' });
      const html = await res.text();
      const doc  = new DOMParser().parseFromString(html, 'text/html');
      nextMain   = doc.querySelector('main');
      nextTitle  = (doc.querySelector('title') || {}).textContent || document.title;
      if (!nextMain) throw new Error('No <main> found on next page');
    }catch(err){
      console.warn('PJAX fetch failed, falling back:', err);
      if (push) history.pushState({}, '', url);
      location.href = url;
      return;
    }

    // Build entering view
    const entering = document.createElement('div');
    entering.className = 'view enter ' + (dir === 'forward' ? 'enter-right' : 'enter-left');
    entering.appendChild(nextMain);
    stack.appendChild(entering);

    // Prepare exiting view
    const exiting = stack.querySelector('.view.is-current');
    exiting.classList.add('exit', dir === 'forward' ? 'exit-left' : 'exit-right');

    // Animate both
    requestAnimationFrame(() => {
      entering.classList.add('view-animate');
      exiting.classList.add('view-animate');
    });

    const finish = () => {
      try { exiting.remove(); } catch {}
      entering.classList.remove('enter','enter-left','enter-right','view-animate');
      entering.classList.add('is-current');

      document.title = nextTitle;
      if (push) history.pushState({}, '', url);

      window.scrollTo(0,0);
      // Re-init features for fresh content
      initSkillBars();
      initProjectTabs();
      initPortfolioFilters();
      initLightbox();
      initParticles();
    };

    let done = false;
    const guard = setTimeout(() => { if (!done) { done = true; finish(); } }, 700);
    entering.addEventListener('transitionend', () => {
      if (done) return; done = true; clearTimeout(guard); finish();
    }, { once: true });
  }
}
function prefetchOnHover(){
  const cache = new Map();
  document.addEventListener('mouseover', (e)=>{
    const a = e.target.closest('a:not([target="_blank"]):not([download]):not([href^="mailto"]):not([href^="#"])');
    if (!a) return;
    const url = new URL(a.href, location.href).href;
    if (cache.has(url)) return;
    cache.set(url, fetch(url, { credentials:'same-origin' }).catch(()=>{}));
  });
}




  /* ---------------- PARTICLES (optional) ---------------- */
  function initParticles() {
    const container = $('#particles-js');
    if (!container || typeof window.particlesJS === 'undefined') return;

    try {
      window.particlesJS.load('particles-js', 'assets/particles.json', () => {
        console.log('particles loaded');
      });
    } catch (e) {
      console.warn('particles failed to load', e);
    }
  }

  /* ---------------- PROJECT TABS ---------------- */
  function initProjectTabs() {
    const cards = $$('.tab-card');
    if (!cards.length) return;

    function show(targetId) {
      cards.forEach(c => c.classList.toggle('is-active', c.dataset.target === targetId));
      $$('.case-study').forEach(sec => {
        sec.classList.toggle('hidden', sec.id !== targetId);
      });
      const el = document.getElementById(targetId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    cards.forEach(card => {
      const target = card.dataset.target;
      const handler = () => show(target);
      card.addEventListener('click', handler);
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
      });
    });
  }

  /* ---------------- PORTFOLIO FILTERS ---------------- */
  function initPortfolioFilters() {
    const chips = $$('.filters .chip');
    const cards = $$('.portfolio-grid .p-card');
    if (!chips.length || !cards.length) return;

    function apply(filter) {
      chips.forEach(c => c.classList.toggle('is-active', c.dataset.filter === filter));
      cards.forEach(card => {
        if (filter === 'all') { card.style.display = ''; return; }
        const tags = (card.dataset.tags || '').toLowerCase();
        card.style.display = tags.includes(filter) ? '' : 'none';
      });
    }

    chips.forEach(c => c.addEventListener('click', () => apply(c.dataset.filter)));

    // apply initial (active chip or "all")
    const active = chips.find(c => c.classList.contains('is-active'));
    apply(active ? active.dataset.filter : 'all');
  }

  /* ---------------- LIGHTBOX ---------------- */
  function initLightbox() {
    const triggers = $$('[data-lightbox]');
    if (!triggers.length) return;

    let backdrop = $('.lightbox-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'lightbox-backdrop';
      backdrop.innerHTML = '<img alt="">';
      document.body.appendChild(backdrop);
      backdrop.addEventListener('click', () => backdrop.classList.remove('show'));
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') backdrop.classList.remove('show'); });
    }
    const img = $('img', backdrop);

    triggers.forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        img.src = a.getAttribute('href');
        backdrop.classList.add('show');
      });
    });
  }

  /* ---------------- COMMAND PALETTE ---------------- */
  function initCommandPalette() {
    const backdrop = $('#cmdk-backdrop');
    const input    = $('#cmdk-input');
    const list     = $('#cmdk-list');
    const closeBtn = $('#cmdk-close');
    const hint     = $('#cmdk-hint');

    if (!backdrop || !input || !list) return; // palette not on this page

    // force [hidden] to actually hide via CSS is recommended:
    // .cmdk-backdrop[hidden]{display:none!important;}

    const email  = 'youremail@example.com';               // TODO: set yours
    const social = {
      instagram: 'https://instagram.com/yourhandle',
      x:         'https://x.com/yourhandle',
      facebook:  'https://facebook.com/yourhandle',
      discord:   'https://discord.gg/yourInvite'
    };

    const commands = [
      { label:'Go: Home',       action:() => gotoPage('') },
      { label:'Go: About Me',   action:() => gotoPage('about') },
      { label:'Go: Experience', action:() => gotoPage('experience') },
      { label:'Go: Projects',   action:() => gotoPage('projects') },
      { label:'Go: Projects → Discord Embed Forwarder', keywords:'discord webhook', action:() => gotoPage('projects') },
      { label:'Go: Projects → Inventory App', keywords:'electron sqlite',           action:() => gotoPage('projects') },
      { label:'Go: Projects → Credit Card Payoff Planner', keywords:'finance tkinter', action:() => gotoPage('projects') },
      { label:'Go: Portfolio',  action:() => gotoPage('portfolio') },
      { label:'Go: Skills',     action:() => gotoPage('skills') },
      { label:'Open Resume (PDF)', action:() => { const pre = pathLast() === '' ? '' : '../'; window.open(pre + 'Jona_resume.pdf', '_blank'); } },
      { label:'Download: Discord Forwarder (Python)', action:() => location.href = 'assets/code/discord_forwarder.py' },
      { label:'Download: Payoff Planner (Python)', action:() => location.href = 'assets/code/credit_card_payoff.py' },
      { label:'Copy email address', action:() => copyAndToast(email, 'Email copied'), meta: email },
      { label:'Open Contact page', action:() => gotoPage('contact') },
      { label:'Open Instagram', action:() => window.open(social.instagram, '_blank') },
      { label:'Open X (Twitter)', action:() => window.open(social.x, '_blank') },
      { label:'Open Facebook', action:() => window.open(social.facebook, '_blank') },
      { label:'Open Discord', action:() => window.open(social.discord, '_blank') },
      { label:'Toggle reduced motion', action: toggleReducedMotion, meta:'On/Off' },
      { label:'Toggle accent color',  action: toggleAccent,        meta:'Orange/Blue' }
    ];

    // one-time hint
    try {
      if (hint && !localStorage.getItem('cmdkHintShown')) {
        hint.hidden = false;
        setTimeout(() => { hint.hidden = true; localStorage.setItem('cmdkHintShown', '1'); }, 3000);
      }
    } catch {}

    // open/close helpers
    function openPalette() {
      backdrop.hidden = false;
      input.value = '';
      selected = 0;
      render('');
      setTimeout(() => input.focus(), 0);
    }
    function closePalette() { backdrop.hidden = true; }
    document.documentElement.classList.add('cmdk-ready');     // show triggers only when ready
    window.__cmdkToggle = () => (backdrop.hidden ? openPalette() : closePalette());

    closeBtn && closeBtn.addEventListener('click', closePalette);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closePalette(); });

    // keyboard shortcuts (toggle with Ctrl/⌘+K)
    document.addEventListener('keydown', (e) => {
      const inField = /input|textarea|select/i.test(e.target && e.target.tagName);
      const modK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
      if (modK && !inField) { e.preventDefault(); backdrop.hidden ? openPalette() : closePalette(); return; }
      if (!backdrop.hidden) {
        if (e.key === 'Escape') { closePalette(); return; }
        if (e.key === 'ArrowDown') { move(1); e.preventDefault(); }
        if (e.key === 'ArrowUp')   { move(-1); e.preventDefault(); }
        if (e.key === 'Enter')     { activate(); e.preventDefault(); }
      }
    });

    // search + render
    let selected = 0;
    function score(cmd, q) {
      if (!q) return 1;
      q = q.toLowerCase();
      const hay = (cmd.label + ' ' + (cmd.keywords || '')).toLowerCase();
      return q.split(/\s+/).every(t => hay.includes(t)) ? 1 : 0;
    }
    function render(q) {
      const results = commands.filter(c => score(c, q));
      list.innerHTML = results.length
        ? results.map((c, i) => `
            <li class="cmdk-item" role="option" data-i="${i}" aria-selected="${i === selected}">
              <div>
                <div>${c.label}</div>
                ${c.meta ? `<small>${c.meta}</small>` : ``}
              </div>
              <kbd>↵</kbd>
            </li>
          `).join('')
        : `<li class="cmdk-empty">No results for “${q}”</li>`;

      $$('.cmdk-item', list).forEach(el => {
        el.addEventListener('mouseenter', () => { selected = +el.dataset.i; highlight(); });
        el.addEventListener('click',      () => { selected = +el.dataset.i; activate();  });
      });
    }
    function highlight() {
      $$('.cmdk-item', list).forEach((el, i) => el.setAttribute('aria-selected', String(i === selected)));
      const selEl = $(`.cmdk-item[data-i="${selected}"]`, list);
      if (selEl) selEl.scrollIntoView({ block: 'nearest' });
    }
    function move(delta) {
      const items = $$('.cmdk-item', list);
      if (!items.length) return;
      selected = (selected + delta + items.length) % items.length;
      highlight();
    }
    function activate() {
      const results = commands.filter(c => score(c, input.value.trim()));
      if (!results.length) return;
      const cmd = results[selected];
      if (cmd) { closePalette(); if (typeof cmd.action === 'function') cmd.action(); }
    }

    input.addEventListener('input', () => { selected = 0; render(input.value.trim()); });

    // helpers
    function copyAndToast(text, msg) {
      navigator.clipboard.writeText(text)
        .then(() => toast(msg || 'Copied'))
        .catch(() => toast('Copy failed'));
    }
    function toast(msg) {
      let t = $('#cmdk-toast');
      if (!t) { t = document.createElement('div'); t.id = 'cmdk-toast'; document.body.appendChild(t); }
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 1200);
    }
    function toggleReducedMotion() {
      const cls = document.documentElement.classList;
      cls.toggle('reduce-motion');
      try { localStorage.setItem('reduceMotion', cls.contains('reduce-motion') ? '1' : ''); } catch {}
      toast(cls.contains('reduce-motion') ? 'Reduced motion: ON' : 'Reduced motion: OFF');
    }
    function toggleAccent() {
      const root = document.documentElement;
      const current = getComputedStyle(root).getPropertyValue('--accent').trim() || '#0ea5e9';
      const next = (current.toLowerCase() === '#0ea5e9') ? '#a855f7' : '#0ea5e9';
      root.style.setProperty('--accent', next);
      root.style.setProperty('--accent-2', (next === '#0ea5e9') ? '#7dd3fc' : '#d8b4fe');
      toast('Accent updated');
    }

    // persist reduced-motion preference
    try { if (localStorage.getItem('reduceMotion') === '1') document.documentElement.classList.add('reduce-motion'); } catch {}
  }

  /* ---------------- (optional) COPY BUTTONS ---------------- */
  function initCopyButtons() {
    $$('.code-block').forEach(block => {
      if (block.querySelector('button.copy-btn')) return;
      const btn = document.createElement('button');
      btn.className = 'copy-btn'; btn.textContent = 'Copy';
      btn.addEventListener('click', () => {
        const code = (block.querySelector('pre,code') || {}).innerText || '';
        navigator.clipboard.writeText(code).then(() => {
          btn.textContent = 'Copied!'; setTimeout(() => (btn.textContent = 'Copy'), 900);
        });
      });
      block.prepend(btn);
    });
  }

})();
