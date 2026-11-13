/* Chalé Terra Canastra — interaction and scroll choreography. */
(() => {
  'use strict';
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const root = document.documentElement;
  const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
  const desktopQuery = window.matchMedia('(min-width: 900px)');
  const roomsPinQuery = window.matchMedia('(min-width: 900px) and (min-height: 740px)');
  const video = $('#hero-video');
  const videoToggle = $('#video-toggle');
  const motionToggle = $('#motion-toggle');
  let motionPreference = null;
  try { motionPreference = localStorage.getItem('canastra-motion'); } catch (_) { /* Private browsing remains supported. */ }
  let reduced = motionPreference ? motionPreference === 'reduced' : reduceQuery.matches;
  let videoPausedByVisitor = false;
  let videoVisible = true;
  let animationContext;
  let refreshTimer;

  function setButtonLabel(button, label) {
    if (!button) return;
    button.setAttribute('aria-label', label);
    const labelElement = $('.control-label', button);
    if (labelElement) labelElement.textContent = label;
    else {
      const textNode = [...button.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      if (textNode) textNode.textContent = `${label} `;
      else button.textContent = label;
    }
  }

  function syncVideoLabel() {
    if (!videoToggle || !video) return;
    setButtonLabel(videoToggle, video.paused ? 'Reproduzir vídeo' : 'Pausar vídeo');
    videoToggle.setAttribute('aria-pressed', String(!video.paused));
    const icon = $('span:not(.control-label)', videoToggle);
    if (icon) { icon.textContent = video.paused ? '▷' : 'Ⅱ'; icon.setAttribute('aria-hidden', 'true'); }
  }

  function syncVideo() {
    if (!video) return;
    if (reduced || videoPausedByVisitor || !videoVisible || document.hidden) video.pause();
    else video.play().catch(() => { syncVideoLabel(); });
    syncVideoLabel();
  }

  videoToggle?.addEventListener('click', () => {
    if (!video) return;
    if (video.paused) {
      // An explicit request to play is respected even when automatic motion is reduced.
      videoPausedByVisitor = false;
      video.play().catch(() => { syncVideoLabel(); });
    } else {
      videoPausedByVisitor = true;
      video.pause();
    }
    syncVideoLabel();
  });
  video?.addEventListener('play', syncVideoLabel);
  video?.addEventListener('pause', syncVideoLabel);
  document.addEventListener('visibilitychange', syncVideo);
  if (video && 'IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      videoVisible = entries[0].isIntersecting;
      syncVideo();
    }, { threshold: 0.05 }).observe(video);
  }

  // The original words remain available as one coherent accessible heading.
  $$('.word-reveal').forEach(element => {
    const original = element.textContent.trim().replace(/\s+/g, ' ');
    element.setAttribute('aria-label', original);
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const fragment = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) fragment.append(document.createTextNode(part));
        else {
          const span = document.createElement('span');
          span.className = 'word';
          span.setAttribute('aria-hidden', 'true');
          span.textContent = part;
          fragment.append(span);
        }
      });
      node.replaceWith(fragment);
    });
  });

  // All three chapters remain readable in the document without animation support.
  function resetRooms() {
    const scene = $('#rooms-scroll');
    if (!scene) return;
    scene.classList.remove('rooms-enhanced');
    scene.style.removeProperty('--room-progress');
    $$('.room-panel', scene).forEach(panel => {
      panel.hidden = false;
      panel.inert = false;
      panel.removeAttribute('aria-hidden');
    });
    $$('.room-step', scene).forEach(step => {
      step.classList.remove('is-active');
      step.removeAttribute('aria-current');
    });
  }

  function buildRooms(gsap) {
    const scene = $('#rooms-scroll');
    const stage = scene && $('.rooms-stage', scene);
    const chapters = scene ? $$('.room-panel', scene) : [];
    if (!stage || chapters.length !== 3) return;
    if (!roomsPinQuery.matches) {
      chapters.forEach(chapter => {
        gsap.from(chapter, {
          y: 28, opacity: 0, duration: 0.85, ease: 'power2.out',
          scrollTrigger: { trigger: chapter, start: 'top 93%', once: true }
        });
      });
      return;
    }

    scene.classList.add('rooms-enhanced');
    const steps = $$('.room-step', scene);
    let current = -1;
    function setCurrent(index) {
      if (current === index) return;
      current = index;
      chapters.forEach((chapter, i) => {
        chapter.inert = i !== index;
        chapter.setAttribute('aria-hidden', String(i !== index));
      });
      steps.forEach((step, i) => {
        step.classList.toggle('is-active', i === index);
        if (i === index) step.setAttribute('aria-current', 'step');
        else step.removeAttribute('aria-current');
      });
    }
    setCurrent(0);
    gsap.set(chapters, { yPercent: 0, scale: 1, autoAlpha: 0 });
    gsap.set(chapters[0], { autoAlpha: 1 });
    gsap.set(chapters.slice(1), { yPercent: 100 });

    // Hold each chapter long enough to read, then reveal the next image and card.
    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: scene, start: 'top 95px', end: () => `+=${Math.round(window.innerHeight * 2.1)}`,
        pin: true, anticipatePin: 1, refreshPriority: 2, scrub: 0.65, invalidateOnRefresh: true
      }
    });
    timeline.to({}, { duration: 0.7 });
    [1, 2].forEach((index, transitionIndex) => {
      const at = 0.7 + transitionIndex * 1.2;
      const chapter = chapters[index];
      timeline.set(chapter, { autoAlpha: 1 }, at)
        .to(chapters[index - 1], { yPercent: -8, scale: 0.96, autoAlpha: 0, duration: 0.5, ease: 'power1.inOut' }, at)
        .to(chapter, { yPercent: 0, duration: 0.55, ease: 'power2.inOut' }, at);
      const card = $('.room-card', chapter);
      if (card) timeline.fromTo(card, { y: 45 }, { y: 0, duration: 0.55, ease: 'power2.out' }, at + 0.1);
    });
    timeline.to({}, { duration: 0.7 }, 2.55);
    timeline.eventCallback('onUpdate', () => {
      const time = timeline.time();
      setCurrent(time < 0.98 ? 0 : time < 2.18 ? 1 : 2);
      scene.style.setProperty('--room-progress', `${timeline.progress() * 100}%`);
    });
  }

  function buildMotion() {
    animationContext?.revert();
    animationContext = undefined;
    resetRooms();
    root.dataset.motion = reduced ? 'reduced' : 'full';
    setButtonLabel(motionToggle, reduced ? 'Ativar animações' : 'Reduzir animações');
    motionToggle?.setAttribute('aria-pressed', String(reduced));
    syncVideo();
    if (reduced || !window.gsap || !window.ScrollTrigger) return;
    const { gsap, ScrollTrigger } = window;
    gsap.registerPlugin(ScrollTrigger);
    animationContext = gsap.context(() => {
      const desktop = desktopQuery.matches;
      buildRooms(gsap);
      $$('.reveal').forEach(element => {
        gsap.from(element, {
          y: desktop ? 40 : 22, autoAlpha: 0, duration: 1.05, ease: 'power3.out',
          scrollTrigger: { trigger: element, start: 'top 94%', once: true }
        });
      });
      $$('.word-reveal').forEach(element => {
        gsap.fromTo($$('.word', element), { opacity: 0.23 }, {
          opacity: 1, ease: 'none', stagger: 0.13,
          scrollTrigger: { trigger: element, start: 'top 85%', end: 'bottom 48%', scrub: 0.6 }
        });
      });
      if (desktop) {
        const hero = $('.hero');
        if (hero) {
          const media = $('.hero-media', hero);
          const title = $('.hero-title', hero);
          if (media) gsap.to(media, { yPercent: 17, scale: 1.06, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
          if (title) gsap.to(title, { y: 140, opacity: 0, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: '80% top', scrub: true } });
        }
        $$('.parallax-image').forEach(element => {
          const img = $('img', element);
          if (img) gsap.fromTo(img, { yPercent: -5, scale: 1.12 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: element, start: 'top bottom', end: 'bottom top', scrub: true } });
        });
        $$('.orbit-photo').forEach(element => {
          gsap.fromTo(element, { y: 55 }, { y: -65, ease: 'none', scrollTrigger: { trigger: element.parentElement, start: 'top bottom', end: 'bottom top', scrub: 0.7 } });
        });
        const scene = $('#landscape-scene');
        const stage = scene && $('.landscape-stage', scene);
        const frame = stage && $('.landscape-frame', stage);
        if (scene && stage && frame) {
          const timeline = gsap.timeline({ scrollTrigger: { trigger: stage, start: 'top top', end: () => `+=${Math.round(window.innerHeight * 1.1)}`, pin: true, refreshPriority: 1, anticipatePin: 1, scrub: 0.8, invalidateOnRefresh: true } });
          timeline.fromTo(frame, { clipPath: 'inset(10% 18% 10% 18%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', duration: 1 }, 0);
          const image = $('img', frame);
          if (image) timeline.fromTo(image, { scale: 1.2 }, { scale: 1, ease: 'none', duration: 1.3 }, 0);
          const copy = $('.landscape-copy', stage);
          if (copy) timeline.fromTo(copy, { y: 70, autoAlpha: 0 }, { y: 0, autoAlpha: 1, ease: 'power2.out', duration: 0.6 }, 0.45);
          timeline.to({}, { duration: 0.25 });
        }
      }
      return resetRooms;
    });
    ScrollTrigger.refresh();
  }
  motionToggle?.addEventListener('click', () => {
    reduced = !reduced;
    motionPreference = reduced ? 'reduced' : 'full';
    try { localStorage.setItem('canastra-motion', motionPreference); } catch (_) { /* Nonessential persistence. */ }
    buildMotion();
    hidePhotoCursor();
  });
  reduceQuery.addEventListener('change', () => {
    if (!motionPreference) { reduced = reduceQuery.matches; buildMotion(); }
  });
  desktopQuery.addEventListener('change', buildMotion);
  roomsPinQuery.addEventListener('change', buildMotion);

  const header = $('.site-header');
  const progress = $('.reading-progress');
  let scrollQueued = false;
  function updateScrollUI() {
    header?.classList.toggle('scrolled', window.scrollY > 70);
    if (progress) {
      const distance = root.scrollHeight - window.innerHeight;
      progress.style.transform = `scaleX(${distance > 0 ? Math.min(1, Math.max(0, window.scrollY / distance)) : 0})`;
    }
    scrollQueued = false;
  }
  window.addEventListener('scroll', () => {
    if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(updateScrollUI); }
  }, { passive: true });
  window.addEventListener('resize', () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => { updateScrollUI(); window.ScrollTrigger?.refresh(); }, 160);
  });
  updateScrollUI();

  const openedDialogs = new Set();
  let savedOverflow = '';
  function lockPage(dialog) {
    if (!openedDialogs.size) { savedOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    openedDialogs.add(dialog);
  }
  function unlockPage(dialog) {
    openedDialogs.delete(dialog);
    if (!openedDialogs.size) document.body.style.overflow = savedOverflow;
  }
  function closeOnBackdrop(dialog) {
    dialog?.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
  }
  const menuToggle = $('#menu-toggle');
  const menu = $('#mobile-menu');
  if (menu && menuToggle) {
    menuToggle.addEventListener('click', () => {
      if (menu.open) menu.close();
      else { menu.showModal(); lockPage(menu); menuToggle.setAttribute('aria-expanded', 'true'); }
    });
    $('#menu-close')?.addEventListener('click', () => menu.close());
    $$('a', menu).forEach(link => link.addEventListener('click', () => menu.close()));
    menu.addEventListener('close', () => {
      unlockPage(menu);
      menuToggle.setAttribute('aria-expanded', 'false');
    });
    closeOnBackdrop(menu);
  }

  $$('.magnetic').forEach(element => {
    const inner = $('.button-inner', element);
    if (!inner) return;
    element.addEventListener('pointermove', event => {
      if (reduced || !pointerQuery.matches) return;
      const bounds = element.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 9;
      const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 9;
      inner.style.transform = `translate(${x}px, ${y}px)`;
    });
    element.addEventListener('pointerleave', () => { inner.style.transform = ''; });
    element.addEventListener('blur', () => { inner.style.transform = ''; });
  });

  const galleryItems = $$('.gallery-open');
  const galleryDialog = $('#gallery-dialog');
  const galleryImage = $('#gallery-image');
  const galleryCaption = $('#gallery-caption');
  const galleryCount = $('#gallery-count');
  let galleryIndex = 0;
  let galleryOpener;
  function displayPhoto(index) {
    if (!galleryItems.length || !galleryImage) return;
    galleryIndex = (index + galleryItems.length) % galleryItems.length;
    const button = galleryItems[galleryIndex];
    const source = button.dataset.image || $('img', button)?.currentSrc;
    const caption = button.dataset.caption || $('img', button)?.alt || 'Chalé Terra Canastra';
    if (source) galleryImage.src = source;
    galleryImage.alt = caption;
    if (galleryCaption) galleryCaption.textContent = caption;
    if (galleryCount) galleryCount.textContent = `${String(galleryIndex + 1).padStart(2, '0')} / ${String(galleryItems.length).padStart(2, '0')}`;
  }
  galleryItems.forEach((button, index) => {
    button.addEventListener('click', () => {
      if (!galleryDialog || !galleryImage) return;
      galleryOpener = button;
      displayPhoto(index);
      galleryDialog.showModal();
      lockPage(galleryDialog);
      hidePhotoCursor();
      $('#gallery-close')?.focus();
    });
  });
  $('#gallery-prev')?.addEventListener('click', () => displayPhoto(galleryIndex - 1));
  $('#gallery-next')?.addEventListener('click', () => displayPhoto(galleryIndex + 1));
  $('#gallery-close')?.addEventListener('click', () => galleryDialog?.close());
  galleryDialog?.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); displayPhoto(galleryIndex - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); displayPhoto(galleryIndex + 1); }
  });
  galleryDialog?.addEventListener('close', () => { unlockPage(galleryDialog); galleryOpener?.focus({ preventScroll: true }); });
  closeOnBackdrop(galleryDialog);

  const photoCursor = $('#photo-cursor');
  function hidePhotoCursor() {
    photoCursor?.classList.remove('visible');
    if (photoCursor) photoCursor.style.opacity = '0';
  }
  galleryItems.forEach(button => {
    button.addEventListener('pointermove', event => {
      if (!photoCursor || reduced || !pointerQuery.matches || event.pointerType === 'touch') return;
      photoCursor.classList.add('visible');
      photoCursor.style.opacity = '1';
      photoCursor.style.left = `${event.clientX}px`;
      photoCursor.style.top = `${event.clientY}px`;
    });
    button.addEventListener('pointerleave', hidePhotoCursor);
  });
  window.addEventListener('scroll', hidePhotoCursor, { passive: true });

  const bookingForm = $('#booking-form');
  const checkin = $('#checkin');
  const checkout = $('#checkout');
  const bookingError = $('#booking-error');
  const bookingFallback = $('#booking-fallback');
  function localDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function parseDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(y, m - 1, d, 12);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
  }
  function updateDateLimits() {
    const today = localDate(new Date());
    if (checkin) checkin.min = today;
    if (checkout) {
      const nextDay = parseDate(checkin?.value || today) || new Date();
      nextDay.setDate(nextDay.getDate() + 1);
      checkout.min = localDate(nextDay);
    }
  }
  updateDateLimits();
  checkin?.addEventListener('change', updateDateLimits);
  bookingForm?.addEventListener('input', event => {
    event.target.removeAttribute('aria-invalid');
    if (bookingError) bookingError.textContent = '';
    if (bookingFallback) bookingFallback.hidden = true;
  });
  bookingForm?.addEventListener('submit', event => {
    event.preventDefault();
    updateDateLimits();
    const nameField = $('#guest-name');
    const guestsField = $('#guests');
    const name = nameField?.value.trim() || '';
    const start = parseDate(checkin?.value || '');
    const end = parseDate(checkout?.value || '');
    let error = '';
    let invalidField;
    if (nameField && !name) { error = 'Conte para nós o seu nome.'; invalidField = nameField; }
    else if (!start || checkin.value < localDate(new Date())) { error = 'Escolha uma data de chegada a partir de hoje.'; invalidField = checkin; }
    else if (!end || end <= start) { error = 'A saída precisa ser depois da chegada.'; invalidField = checkout; }
    else if (guestsField && !guestsField.value) { error = 'Selecione o número de hóspedes para a consulta.'; invalidField = guestsField; }
    if (error) {
      if (bookingError) bookingError.textContent = error;
      invalidField?.setAttribute('aria-invalid', 'true');
      invalidField?.focus();
      return;
    }
    const format = date => date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const message = `Olá!${name ? ` Meu nome é ${name}.` : ''} Gostaria de consultar a disponibilidade do Chalé Terra Canastra.\n\nChegada: ${format(start)}\nSaída: ${format(end)}${guestsField ? `\nHóspedes: ${guestsField.value}` : ''}\n\nPodem me informar os valores e as condições da estadia?`;
    const url = `https://wa.me/5534991297971?text=${encodeURIComponent(message)}`;
    if (bookingFallback) { bookingFallback.href = url; bookingFallback.hidden = false; }
    if (bookingError) bookingError.textContent = 'Sua consulta está pronta. Continue no WhatsApp para verificar disponibilidade e valores.';
    window.open(url, '_blank', 'noopener,noreferrer');
  });

  $$('.faq-list details').forEach(details => {
    details.addEventListener('toggle', () => {
      window.ScrollTrigger?.refresh();
      updateScrollUI();
    });
  });

  buildMotion();
  window.addEventListener('load', () => { window.ScrollTrigger?.refresh(); updateScrollUI(); });
  document.fonts?.ready.then(() => window.ScrollTrigger?.refresh());
})();
