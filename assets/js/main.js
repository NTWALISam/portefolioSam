// Mobile nav toggle (tiny, no dependencies)
(function(){
  const btn = document.querySelector('.toggle');
  const menu = document.getElementById('menu');
  if(!btn || !menu) return;
  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!expanded));
    menu.classList.toggle('open');
  });
  menu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      btn.setAttribute('aria-expanded', 'false');
      menu.classList.remove('open');
    });
  });
})();

// Dynamic gallery (grouped) + lightbox (zoom + next/prev + swipe)
(function(){
  const grid = document.getElementById('galleryGrid');
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lbImg');
  const lbCaption = document.getElementById('lbCaption');
  const stage = document.getElementById('lbStage');
  const btnClose = document.getElementById('lbClose');
  const btnNext = document.getElementById('lbNext');
  const btnPrev = document.getElementById('lbPrev');

  if(!grid || !lb || !lbImg || !stage) return;

  // Add as many images as you want here (same caption => same card/slider)
  const GALLERY_ITEMS = [
    { src: 'assets/img/gallery/Sam2.jpeg', alt: 'Gallery image', caption: 'Travel / field visit' },
    { src: 'assets/img/gallery/Sam4.jpeg', alt: 'Gallery image', caption: 'Travel / field visit' },
    { src: 'assets/img/gallery/Sam3.jpeg', alt: 'Gallery image', caption: 'Travel / field visit' },
    { src: 'assets/img/gallery/Sam1.jpeg', alt: 'Gallery image', caption: 'Conference / event' },
    { src: 'assets/img/gallery/Sam3.jpeg', alt: 'Gallery image', caption: 'Work / engineering activity' },
  ];

  // Group items by caption (each caption becomes one card with internal slider)
  const groups = [];
  const byCaption = new Map();
  for(const item of GALLERY_ITEMS){
    const key = (item.caption || '').trim() || 'Gallery';
    if(!byCaption.has(key)){
      byCaption.set(key, { caption: key, items: [] });
      groups.push(byCaption.get(key));
    }
    byCaption.get(key).items.push(item);
  }

  // Render cards
  grid.innerHTML = groups.map((g, gi) => {
    const dots = g.items.map((_, ii) =>
      `<button class="g-dot${ii===0?' active':''}" type="button" data-action="dot" data-gi="${gi}" data-ii="${ii}" aria-label="Go to image ${ii+1}"></button>`
    ).join('');

    const slides = g.items.map((it, ii) => `
      <div class="g-slide${ii===0?' active':''}" data-gi="${gi}" data-ii="${ii}">
        <img src="${it.src}" alt="${it.alt || ''}" loading="lazy"/>
      </div>
    `).join('');

    const nav = g.items.length > 1 ? `
      <button class="g-nav g-prev" type="button" data-action="prev" data-gi="${gi}" aria-label="Previous image">‹</button>
      <button class="g-nav g-next" type="button" data-action="next" data-gi="${gi}" aria-label="Next image">›</button>
    ` : '';

    const dotsWrap = g.items.length > 1 ? `<div class="g-dots">${dots}</div>` : '';

    return `
      <article class="card gallery-group" data-gi="${gi}">
        <div class="g-carousel" data-gi="${gi}">
          <div class="g-frame">
            ${slides}
          </div>
          ${nav}
          ${dotsWrap}
        </div>
        <div class="g-caption">${g.caption}</div>
      </article>
    `;
  }).join('');

  // Slider state per group
  const state = groups.map(() => ({ i: 0 }));

  function show(gi, ii){
    const g = groups[gi];
    if(!g) return;
    const n = g.items.length;
    const next = ((ii % n) + n) % n;
    state[gi].i = next;

    // slides
    grid.querySelectorAll(`.g-slide[data-gi="${gi}"]`).forEach(el => {
      el.classList.toggle('active', Number(el.dataset.ii) === next);
    });
    // dots
    grid.querySelectorAll(`.g-dot[data-gi="${gi}"]`).forEach(el => {
      el.classList.toggle('active', Number(el.dataset.ii) === next);
    });
  }

  // Carousel clicks (prev/next/dot/image)
  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if(btn){
      const action = btn.dataset.action;
      const gi = Number(btn.dataset.gi);
      if(Number.isNaN(gi)) return;

      if(action === 'prev') show(gi, state[gi].i - 1);
      if(action === 'next') show(gi, state[gi].i + 1);
      if(action === 'dot') show(gi, Number(btn.dataset.ii));
      return;
    }

    // Click on image => open lightbox for that group
    const slide = e.target.closest('.g-slide');
    if(!slide) return;
    const gi = Number(slide.dataset.gi);
    const ii = Number(slide.dataset.ii);
    if(Number.isNaN(gi) || Number.isNaN(ii)) return;
    openLightbox(gi, ii);
  });

  // Basic swipe support on each carousel frame (mobile)
  let swipeStartX = 0, swipeGi = null;
  grid.addEventListener('touchstart', (e) => {
    const frame = e.target.closest('.g-frame');
    if(!frame) return;
    const car = e.target.closest('.g-carousel');
    if(!car) return;
    swipeGi = Number(car.dataset.gi);
    swipeStartX = e.touches[0].clientX;
  }, { passive:true });

  grid.addEventListener('touchend', (e) => {
    if(swipeGi === null) return;
    const dx = e.changedTouches[0].clientX - swipeStartX;
    if(Math.abs(dx) > 50){
      dx < 0 ? show(swipeGi, state[swipeGi].i + 1) : show(swipeGi, state[swipeGi].i - 1);
    }
    swipeGi = null;
  }, { passive:true });

  // ---------- Lightbox ----------
  let currentList = [];
  let idx = 0;
  let scale = 1;
  let tx = 0, ty = 0;
  let isPanning = false;
  let pageScrollY = 0;
  let startX = 0, startY = 0;

  function applyTransform(){
    lbImg.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  function render(){
    const item = currentList[idx];
    if(!item) return;
    lbImg.src = item.src;
    lbImg.alt = item.alt || '';
    if(lbCaption) lbCaption.textContent = item.caption || '';
    scale = 1; tx = 0; ty = 0;
    applyTransform();
    lbImg.style.cursor = 'default';
  }

  function lockPage(){
    pageScrollY = window.scrollY || 0;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${pageScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  }

  function unlockPage(){
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, pageScrollY);
  }

  function openLightbox(gi, ii){
    currentList = groups[gi]?.items || [];
    idx = Math.max(0, Math.min(ii, currentList.length - 1));
    render();
    lb.classList.add('open');
    lb.setAttribute('aria-hidden', 'false');
    lockPage();
  }

  function close(){
    lb.classList.remove('open');
    lb.setAttribute('aria-hidden', 'true');
    unlockPage();
  }

  function next(){
    if(!currentList.length) return;
    idx = (idx + 1) % currentList.length;
    render();
  }

  function prev(){
    if(!currentList.length) return;
    idx = (idx - 1 + currentList.length) % currentList.length;
    render();
  }

  btnClose && btnClose.addEventListener('click', close);
  btnNext && btnNext.addEventListener('click', next);
  btnPrev && btnPrev.addEventListener('click', prev);
  lb.addEventListener('click', (e) => { if(e.target === lb) close(); });

  window.addEventListener('keydown', (e) => {
    if(!lb.classList.contains('open')) return;
    if(e.key === 'Escape') close();
    if(e.key === 'ArrowRight') next();
    if(e.key === 'ArrowLeft') prev();
  });

  // Wheel zoom (desktop)
  lb.addEventListener('wheel', (e) => {
    if(!lb.classList.contains('open')) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.12 : 0.12;
    scale = Math.min(4, Math.max(1, scale + delta));
    if(scale === 1){ tx = 0; ty = 0; }
    applyTransform();
    lbImg.style.cursor = scale > 1 ? 'grab' : 'default';
  }, { passive:false });

  // Drag/pan when zoomed
  stage.addEventListener('pointerdown', (e) => {
    if(!lb.classList.contains('open')) return;
    if(scale <= 1) return;
    isPanning = true;
    stage.setPointerCapture(e.pointerId);
    startX = e.clientX - tx;
    startY = e.clientY - ty;
    lbImg.style.cursor = 'grabbing';
  });

  stage.addEventListener('pointermove', (e) => {
    if(!isPanning) return;
    tx = e.clientX - startX;
    ty = e.clientY - startY;
    applyTransform();
  });

  stage.addEventListener('pointerup', () => {
    isPanning = false;
    lbImg.style.cursor = scale > 1 ? 'grab' : 'default';
  });

  // Swipe left/right on mobile (only when not zoomed)
  let touchStartX = 0;
  stage.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  }, { passive:true });

  stage.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if(scale > 1) return;
    if(Math.abs(dx) > 50){
      dx < 0 ? next() : prev();
    }
  }, { passive:true });

  // Double click/tap toggles zoom
  stage.addEventListener('dblclick', () => {
    if(!lb.classList.contains('open')) return;
    if(scale === 1){ scale = 2; }
    else { scale = 1; tx = 0; ty = 0; }
    applyTransform();
    lbImg.style.cursor = scale > 1 ? 'grab' : 'default';
  });
})();
