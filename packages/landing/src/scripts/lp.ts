// Cowork Agent landing — minimal interactivity (no React runtime).
// Mirrors the behaviours from the design's app.jsx + sections.jsx:
//   - sticky nav shadow on scroll
//   - reveal-on-scroll
//   - role-tabs switching
//   - wedge step cycling (autoplay while in view + click to set)
//   - setup scroll-driven highlight + right-pane screen swap
// All loaded as a single deferred entry from src/pages/index.astro.

const READY = () => {
  if (document.readyState !== 'loading') return Promise.resolve();
  return new Promise<void>((r) =>
    document.addEventListener('DOMContentLoaded', () => r(), { once: true })
  );
};

READY().then(() => {
  setupNavShadow();
  setupReveal();
  setupRoleTabs();
  setupWedge();
  setupSetup();
  setupChatScenes();
});

// ── sticky nav shadow ────────────────────────────────────────
function setupNavShadow() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

// ── reveal-on-scroll ─────────────────────────────────────────
function setupReveal() {
  const els = document.querySelectorAll<HTMLElement>('.reveal');
  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
  );
  els.forEach((el) => io.observe(el));
}

// ── role tabs ────────────────────────────────────────────────
function setupRoleTabs() {
  const tabs = document.querySelectorAll<HTMLElement>('[data-role-tab]');
  const stages = document.querySelectorAll<HTMLElement>('[data-role-stage]');
  if (!tabs.length || !stages.length) return;

  const show = (id: string) => {
    tabs.forEach((t) => t.classList.toggle('on', t.dataset.roleTab === id));
    stages.forEach((s) => {
      s.style.display = s.dataset.roleStage === id ? '' : 'none';
    });
  };

  tabs.forEach((t) =>
    t.addEventListener('click', () => {
      const id = t.dataset.roleTab;
      if (id) show(id);
    }),
  );
}

// ── wedge step machine ───────────────────────────────────────
type WedgeView = 'code' | 'preview';
const WEDGE_STEPS: Array<{ view: WedgeView; action: 'preview' | 'apply' | 'rollback' | 'regen' }> = [
  { view: 'code', action: 'preview' }, // source
  { view: 'preview', action: 'apply' }, // previewing
  { view: 'preview', action: 'rollback' }, // applied
  { view: 'code', action: 'regen' }, // rolled back
];

function setupWedge() {
  const section = document.querySelector<HTMLElement>('[data-wedge]');
  if (!section) return;
  const stepEls = section.querySelectorAll<HTMLElement>('[data-wedge-step]');
  const badgeEls = section.querySelectorAll<HTMLElement>('[data-wedge-badge]');
  const noteEls = section.querySelectorAll<HTMLElement>('[data-wedge-note]');
  const viewEls = {
    code: section.querySelector<HTMLElement>('[data-wedge-view="code"]'),
    preview: section.querySelector<HTMLElement>('[data-wedge-view="preview"]'),
  };
  const previewTitle = section.querySelector<HTMLElement>('[data-wedge-preview-title]');
  const codeLine = section.querySelector<HTMLElement>('[data-wedge-codeline]');
  const actionBtns = {
    preview: section.querySelector<HTMLElement>('[data-wedge-action="preview"]'),
    apply: section.querySelector<HTMLElement>('[data-wedge-action="apply"]'),
    rollback: section.querySelector<HTMLElement>('[data-wedge-action="rollback"]'),
    regen: section.querySelector<HTMLElement>('[data-wedge-action="regen"]'),
  };

  let cur = 0;
  let live = false;

  const render = (i: number) => {
    cur = i;
    const s = WEDGE_STEPS[i]!;
    stepEls.forEach((el, idx) => el.classList.toggle('on', idx === i));
    badgeEls.forEach((el, idx) => (el.style.display = idx === i ? '' : 'none'));
    noteEls.forEach((el, idx) => (el.style.display = idx === i ? '' : 'none'));
    if (viewEls.code) viewEls.code.style.display = s.view === 'code' ? '' : 'none';
    if (viewEls.preview) viewEls.preview.style.display = s.view === 'preview' ? '' : 'none';

    // preview title gets a check during apply state
    if (previewTitle) {
      previewTitle.textContent = i === 2 ? '案件管理 · レコード一覧 ✓' : '案件管理 · レコード一覧';
    }
    // code highlight: rollback turns added → removed
    if (codeLine) {
      codeLine.classList.toggle('added', i !== 3);
      codeLine.classList.toggle('removed', i === 3);
    }
    // show only the action btn for the current step
    Object.entries(actionBtns).forEach(([name, el]) => {
      if (!el) return;
      el.style.display = name === s.action ? '' : 'none';
    });
  };

  stepEls.forEach((el) => {
    const idx = Number(el.dataset.wedgeStep);
    el.addEventListener('click', () => render(idx));
    el.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        render(idx);
      }
    });
  });

  // action buttons advance to the next step
  Object.entries(actionBtns).forEach(([, el]) => {
    if (!el) return;
    el.addEventListener('click', () => render((cur + 1) % WEDGE_STEPS.length));
  });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        live = entries[0]?.isIntersecting ?? false;
      },
      { threshold: 0.3 },
    );
    io.observe(section);
  } else {
    live = true;
  }

  setInterval(() => {
    if (live) render((cur + 1) % WEDGE_STEPS.length);
  }, 3200);

  render(0);
}

// ── chat scenes (scripted conversation loop, in-viewport only) ──
type SceneStep =
  | { show: string[]; hold?: number }
  | { type: string; cps?: number; after?: number }
  | { clear: true };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function setupChatScenes() {
  const panels = document.querySelectorAll<HTMLElement>('[data-chat-scene]');
  panels.forEach((panel) => initScene(panel));
}

function initScene(panel: HTMLElement) {
  const scriptEl = panel.querySelector<HTMLScriptElement>('script[data-scene-script]');
  if (!scriptEl) return;
  let steps: SceneStep[];
  try {
    steps = JSON.parse(scriptEl.textContent || '[]');
  } catch {
    return;
  }
  if (!Array.isArray(steps) || steps.length === 0) return;

  const ph = panel.querySelector<HTMLElement>('[data-scene-ph]');
  const phDefault = ph?.dataset.sceneDefault ?? 'メッセージを入力…';
  const msgs = Array.from(panel.querySelectorAll<HTMLElement>('[data-msg-id]'));

  // initial: hide all that are not in the first show step
  const initialShow = pickInitialShow(steps);
  msgs.forEach((m) => {
    const id = m.dataset.msgId ?? '';
    if (!initialShow.has(id)) m.style.display = 'none';
  });
  setPlaceholder(ph, phDefault, false);

  // viewport visibility gate
  const liveRef = { current: false };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        liveRef.current = entries[0]?.isIntersecting ?? false;
      },
      { threshold: 0.15 },
    );
    io.observe(panel);
  } else {
    liveRef.current = true;
  }
  if (matchesReducedMotion()) return; // respect user preference

  runScene(steps, msgs, ph, phDefault, liveRef);
}

function pickInitialShow(steps: SceneStep[]): Set<string> {
  for (const s of steps) {
    if ('show' in s) return new Set(s.show);
  }
  return new Set();
}

function matchesReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function setPlaceholder(ph: HTMLElement | null, text: string, caret: boolean) {
  if (!ph) return;
  // Preserve existing caret span; replace only the text node.
  let caretEl = ph.querySelector<HTMLElement>('.caret');
  // remove all children then re-build
  while (ph.firstChild) ph.removeChild(ph.firstChild);
  ph.appendChild(document.createTextNode(text));
  if (caret) {
    if (!caretEl) {
      caretEl = document.createElement('span');
      caretEl.className = 'caret';
    }
    ph.appendChild(caretEl);
  }
}

async function runScene(
  steps: SceneStep[],
  msgs: HTMLElement[],
  ph: HTMLElement | null,
  phDefault: string,
  liveRef: { current: boolean },
) {
  // wait for first viewport entry
  while (!liveRef.current) await sleep(180);

  while (true) {
    for (const s of steps) {
      if ('clear' in s) {
        setPlaceholder(ph, phDefault, false);
        continue;
      }
      if ('type' in s) {
        const text = s.type;
        const cps = s.cps ?? 42;
        for (let i = 1; i <= text.length; i++) {
          setPlaceholder(ph, text.slice(0, i), true);
          const ch = text[i - 1];
          const extra = ch === '、' || ch === '。' ? 180 : 0;
          await sleep(cps + extra);
        }
        await sleep(s.after ?? 360);
        continue;
      }
      if ('show' in s) {
        const showSet = new Set(s.show);
        for (const el of msgs) {
          const id = el.dataset.msgId ?? '';
          const wasHidden = el.style.display === 'none';
          const shouldShow = showSet.has(id);
          if (shouldShow) {
            if (wasHidden) {
              el.style.display = '';
              // restart slideUp animation
              el.style.animation = 'none';
              // force reflow
              void el.offsetWidth;
              el.style.animation = '';
            }
          } else {
            el.style.display = 'none';
          }
        }
        await sleep(s.hold ?? 900);
      }
    }
    // pause then loop
    await sleep(1400);
    while (!liveRef.current) await sleep(180);
  }
}

// ── setup scroll-driven ──────────────────────────────────────
function setupSetup() {
  const rail = document.querySelector<HTMLElement>('[data-setup-rail]');
  if (!rail) return;
  const items = Array.from(rail.querySelectorAll<HTMLElement>('[data-setup-item]'));
  const screens = document.querySelectorAll<HTMLElement>('[data-setup-screen]');
  const fill = document.querySelector<HTMLElement>('[data-setup-line-fill]');
  if (!items.length) return;

  const setActive = (idx: number) => {
    items.forEach((el, i) => {
      el.classList.toggle('on', i === idx);
      el.classList.toggle('done', i < idx);
      const dot = el.querySelector<HTMLElement>('[data-setup-dot]');
      if (dot) dot.textContent = i < idx ? '✓' : String(i + 1);
    });
    screens.forEach((sc, i) => {
      sc.style.display = i === idx ? '' : 'none';
    });
    if (fill) fill.style.height = `${((idx + 1) / items.length) * 100}%`;
  };

  const onScroll = () => {
    const mid = window.innerHeight * 0.42;
    let best = 0;
    let bestD = Infinity;
    items.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - mid);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setActive(best);
  };

  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}
