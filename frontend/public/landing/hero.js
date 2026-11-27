/* Roomies landing: the liquid-glass nav and the hero's turn orbit. No dependencies.
   Motion runs when the visitor's system allows it. To preview the full motion on a machine whose
   system asks for reduced motion (Windows: Settings > Accessibility > Visual effects > Animation
   effects off), open the page with ?motion=full once; ?motion=auto goes back to the system setting. */

const html = document.documentElement;
const q = new URLSearchParams(location.search).get('motion');
try { if (q === 'full') localStorage.setItem('rmMotion', 'full'); else if (q === 'auto') localStorage.removeItem('rmMotion'); } catch {}
let forced = false; try { forced = localStorage.getItem('rmMotion') === 'full'; } catch {}
const motion = forced || !matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const chromium = !!(navigator.userAgentData && navigator.userAgentData.brands.some(b => /Chromium/.test(b.brand)));
if (chromium) html.classList.add('rm-lg');
if (motion) {
  html.classList.add('rm-motion', 'rm-enter');
  setTimeout(() => html.classList.remove('rm-enter'), 2600);
}

/* ---------------------------------------------------------------- the glass light follows the pointer */
if (finePointer) {
  // at most one style write per frame, only on the element under the pointer
  let last = null, queued = false;
  document.addEventListener('pointermove', e => {
    last = e;
    if (queued) return; queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const t = last.target;
      const g = t.closest && t.closest('.rm-nav__bar, .rm-cta, .rm-ghost, .rm-badge');
      if (!g) return;
      const r = g.getBoundingClientRect();
      const x = `${Math.round(last.clientX - r.left)}px`, y = `${Math.round(last.clientY - r.top)}px`;
      if (g.classList.contains('rm-cta')) { g.style.setProperty('--bx', x); g.style.setProperty('--by', y); }
      else { g.style.setProperty('--mx', x); g.style.setProperty('--my', y); }
    });
  }, { passive: true });
}

/* ---------------------------------------------------------------- nav */
const nav = document.querySelector('[data-rm-nav]');
if (nav) {
  const links = nav.querySelector('.rm-nav__links');
  const items = links ? [...links.querySelectorAll('a')] : [];
  const pill = links && links.querySelector('.rm-nav__pill');
  let here = null, hover = null;
  const place = a => {
    items.forEach(x => x.classList.toggle('is-lit', x === a));
    if (!a) { links.removeAttribute('data-on'); return; }
    pill.style.setProperty('--px', `${a.offsetLeft}px`);
    pill.style.setProperty('--pw', `${a.offsetWidth}px`);
    links.setAttribute('data-on', '');
  };
  items.forEach(a => {
    a.addEventListener('pointerenter', () => { hover = a; place(a); });
    a.addEventListener('focus', () => { hover = a; place(a); });
    a.addEventListener('blur', () => { hover = null; place(here); });
  });
  links && links.addEventListener('pointerleave', () => { hover = null; place(here); });

  // the section in view keeps the pill when nothing is hovered
  const sections = items.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  const spy = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { here = items.find(a => a.getAttribute('href') === `#${en.target.id}`) || null; } });
    if (!sections.some(s => { const r = s.getBoundingClientRect(); return r.top < innerHeight * .5 && r.bottom > innerHeight * .5; })) here = null;
    items.forEach(a => a.classList.toggle('is-here', a === here));
    if (!hover) place(here);
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(s => spy.observe(s));

  // compact and more opaque once the page moves; the hairline shows how far down the page you are
  const bar = nav.querySelector('.rm-nav__progress i');
  let ticking = false;
  const onScroll = () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
      nav.toggleAttribute('data-scrolled', y > 24);
      if (bar) bar.parentElement.style.setProperty('--rm-progress', max > 0 ? (y / max).toFixed(4) : 0);
      if (here === null && !hover) place(null);
    });
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  addEventListener('resize', () => place(hover || here));

  // the phone menu
  const burger = nav.querySelector('.rm-nav__burger');
  const sheet = nav.querySelector('.rm-sheet');
  const setOpen = open => {
    nav.toggleAttribute('data-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    sheet.toggleAttribute('inert', !open);
  };
  if (burger && sheet) {
    setOpen(false);
    burger.addEventListener('click', () => setOpen(!nav.hasAttribute('data-open')));
    sheet.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && nav.hasAttribute('data-open')) { setOpen(false); burger.focus(); } });
  }
}

/* ---------------------------------------------------------------- the word that changes in the title */
const swap = document.querySelector('[data-rm-swap]');
if (swap && motion) {
  const words = swap.dataset.words.split('|');
  const holder = swap.querySelector('.rm-swap__word');
  const line = swap.querySelector('.rm-swap__line path');
  let i = 0, timer = 0;
  const render = (text, dir) => {
    holder.textContent = '';
    [...text].forEach((ch, n) => {
      const s = document.createElement('span');
      s.className = 'rm-swap__ch'; s.textContent = ch;
      holder.append(s);
      s.animate(dir === 'in'
        ? [{ opacity: 0, transform: 'translateY(.45em) scale(.9)', filter: 'blur(10px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }]
        : [], { duration: 700, delay: n * 28, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' });
    });
    line && line.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 650, delay: 120 + text.length * 22, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'both' });
  };
  const out = () => Promise.all([...holder.children].map((s, n) => s.animate(
    [{ opacity: 1, transform: 'none', filter: 'blur(0)' }, { opacity: 0, transform: 'translateY(-.35em) scale(.95)', filter: 'blur(10px)' }],
    { duration: 380, delay: n * 16, easing: 'cubic-bezier(.55,0,1,.45)', fill: 'both' }).finished))
    .then(() => line && line.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: 1 }], { duration: 200, fill: 'both' }).finished);
  const next = async () => {
    if (document.hidden || swap.closest('.rm-hero').dataset.off) { timer = setTimeout(next, 1200); return; }
    await out();
    i = (i + 1) % words.length;
    render(words[i], 'in');
    timer = setTimeout(next, 2600);
  };
  render(words[0], 'in');
  timer = setTimeout(next, 3200);
}

/* ---------------------------------------------------------------- the turn orbit */
const stage = document.querySelector('[data-rm-stage]');
if (stage) {
  const ROOMIES = ['Aditi', 'Leo', 'Mei', 'Jonas'];
  const TURNS = [
    { who: 0, chore: 'Wash up after dinner', meta: 'Repeats after each turn · 10 points', due: 'Due tonight, 21:00', photo: '/landing/img/photo-f16290270-500.jpg', voters: [1, 2] },
    { who: 1, chore: 'Laundry, towels', meta: 'Every Saturday · 10 points', due: 'Due Saturday, 18:00', photo: '/landing/img/photo-f69723992-500.jpg', voters: [2, 3] },
    { who: 2, chore: 'Mop the kitchen floor', meta: 'Every Sunday · 10 points', due: 'Due Sunday, 20:00', photo: '/landing/img/photo-f28270859-500.jpg', voters: [3, 0] },
    { who: 3, chore: 'Take the bins out', meta: 'Every Thursday · 10 points', due: 'Due Thursday, 08:00', photo: '/landing/img/photo-f1044167-500.jpg', voters: [0, 1] },
  ];
  const PHASES = [
    { chip: 'To do', tone: 'neutral', votes: '0 of 2 approvals', bar: '0%' },
    { chip: 'In review', tone: 'info', votes: '0 of 2 approvals', bar: '6%' },
    { chip: 'In review', tone: 'info', votes: '1 of 2 approvals', bar: '50%' },
    { chip: 'Done', tone: 'success', votes: '2 of 2 approvals', bar: '100%' },
  ];
  const $ = s => stage.querySelector(s);
  const card = $('.rm-tc');
  const f = name => card.querySelector(`[data-f="${name}"]`);
  const nodes = [...stage.querySelectorAll('.rm-node')];
  const photo = $('.rm-sat--photo img');
  const steps = [...card.querySelectorAll('.rm-tc__steps li')];
  const NODE_POS = [[50, 11.5], [88.5, 50], [50, 88.5], [11.5, 50]];
  let t = 0, handAngle = 0, paused = false, visible = true, timers = [];

  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const clear = () => { timers.forEach(clearTimeout); timers = []; };

  const setPhase = p => {
    const ph = PHASES[p];
    card.dataset.phase = String(p);
    const chip = f('chip');
    chip.textContent = ph.chip; chip.className = `rm-chip rm-chip--${ph.tone}`;
    f('votes').textContent = ph.votes;
    card.style.setProperty('--bar', ph.bar);
    steps.forEach((s, n) => s.classList.toggle('is-done', n === 0 || (n === 1 && p >= 1) || (n === 2 && p >= 3)));
    const turn = TURNS[t];
    nodes.forEach((n, k) => n.classList.toggle('has-vote', (p >= 2 && k === turn.voters[0]) || (p >= 3 && k === turn.voters[1])));
    stage.toggleAttribute('data-photo', p >= 1 && p < 3 || (p === 3 && !motion));
  };
  const fill = turn => {
    f('chore').textContent = turn.chore; f('meta').textContent = turn.meta;
    f('who').textContent = `${ROOMIES[turn.who]}'s turn`; f('due').textContent = turn.due;
    f('av').textContent = ROOMIES[turn.who][0];
    photo.src = turn.photo;
    nodes.forEach((n, k) => n.classList.toggle('is-turn', k === turn.who));
    const [x, y] = NODE_POS[turn.who];
    stage.style.setProperty('--ptx', `${x}%`); stage.style.setProperty('--pty', `${y}%`);
  };
  const aim = who => {
    // the hand always turns forward, a quarter at a time
    const target = who * 90;
    let delta = ((target - handAngle) % 360 + 360) % 360;
    handAngle += delta;
    stage.style.setProperty('--hand', `${handAngle}deg`);
  };

  // one turn, about 7 s: picked, handed in with a photo, two approvals, done and points, then the next roommate
  const run = () => {
    clear();
    const turn = TURNS[t];
    card.classList.add('is-swapping');
    aim(turn.who);
    later(380, () => { fill(turn); setPhase(0); card.classList.remove('is-swapping'); });
    later(1900, () => setPhase(1));
    later(3200, () => setPhase(2));
    later(4300, () => { setPhase(3); stage.removeAttribute('data-points'); void stage.offsetWidth; stage.setAttribute('data-points', ''); });
    later(6600, () => { stage.removeAttribute('data-photo'); t = (t + 1) % TURNS.length; if (!paused && visible && !document.hidden) run(); else waiting = true; });
  };
  let waiting = false;
  const resume = () => { if (waiting && !paused && visible && !document.hidden) { waiting = false; run(); } };

  if (motion) {
    fill(TURNS[0]); aim(0); setPhase(0);
    later(1400, run);
    const pause = stage.querySelector('.rm-stage__pause');
    pause && pause.addEventListener('click', () => {
      paused = !paused;
      stage.toggleAttribute('data-paused', paused);
      pause.setAttribute('aria-label', paused ? 'Play the animation' : 'Pause the animation');
      html.classList.toggle('rm-hold', paused);
      if (!paused) resume();
    });
    // off screen or in a hidden tab the loop waits; it picks up again where it stopped
    const heroEl = stage.closest('.rm-hero');
    new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      if (visible) { delete heroEl.dataset.off; resume(); } else heroEl.dataset.off = '1';
    }, { threshold: .15 }).observe(stage);
    document.addEventListener('visibilitychange', resume);

    // the stage leans toward the pointer, the chips float at their own depth
    const tilt = stage.querySelector('.rm-stage__tilt');
    const hero = stage.closest('.rm-hero');
    if (finePointer && hero) {
      // the target follows the pointer; one frame loop eases toward it and writes transforms directly
      const spot = hero.querySelector('.rm-hero__spot');
      let tx = 0, ty = 0, cx = 0, cy = 0, sx = 0, sy = 0, csx = 0, csy = 0, running = false;
      const frame = () => {
        cx += (tx - cx) * .08; cy += (ty - cy) * .08;
        csx += (sx - csx) * .12; csy += (sy - csy) * .12;
        tilt.style.transform = `rotateX(${(-cy * 8).toFixed(3)}deg) rotateY(${(cx * 10).toFixed(3)}deg)`;
        if (spot) spot.style.transform = `translate3d(${(csx - 320).toFixed(1)}px, ${(csy - 320).toFixed(1)}px, 0)`;
        if (Math.abs(tx - cx) + Math.abs(ty - cy) + Math.abs(sx - csx) / 400 + Math.abs(sy - csy) / 400 > .0015) requestAnimationFrame(frame);
        else running = false;
      };
      const kick = () => { if (!running) { running = true; requestAnimationFrame(frame); } };
      let r = null;
      hero.addEventListener('pointerenter', () => { r = null; });
      hero.addEventListener('pointermove', e => {
        r = r || { s: stage.getBoundingClientRect(), h: hero.getBoundingClientRect() };
        tx = (e.clientX - (r.s.left + r.s.width / 2)) / r.s.width;
        ty = (e.clientY - (r.s.top + r.s.height / 2)) / r.s.height;
        sx = e.clientX; sy = e.clientY - r.h.top;
        kick();
      }, { passive: true });
      hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; kick(); });
      addEventListener('scroll', () => { r = null; }, { passive: true });
    }

    // scrolling away: the words lift a little faster than the page, the orbit sinks back
    const copy = document.querySelector('.rm-hero__copy');
    let tick = false;
    addEventListener('scroll', () => {
      if (tick) return; tick = true;
      requestAnimationFrame(() => {
        tick = false;
        const p = Math.min(1, Math.max(0, scrollY / innerHeight));
        if (copy) { copy.style.transform = `translateY(${(-p * 60).toFixed(1)}px)`; copy.style.opacity = String(1 - p * .6); }
        stage.style.transform = `scale(${(1 - p * .06).toFixed(4)})`; stage.style.opacity = String(1 - p * .5);
      });
    }, { passive: true });
  } else {
    // the finished picture: a turn in review, its photo in, one approval
    fill(TURNS[0]); aim(0); setPhase(2);
    stage.setAttribute('data-photo', '');
  }
}
