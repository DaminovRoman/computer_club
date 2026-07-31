/* ==========================================================================
   NEON NEXUS — BEHAVIOR LAYER
   Vanilla JS only. Every effect gated behind prefers-reduced-motion and
   (hover: hover) where relevant. GPU-friendly: transform/opacity only,
   rAF-throttled pointer listeners, IntersectionObserver over scroll polling.
   ========================================================================== */

(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ------------------------------------------------------------------------
     0. PAGE-LOAD CURTAIN
     Purpose: a single deliberate "smooth page transition" moment on first
     paint, echoing the hero's neon-reveal so the very first frame already
     feels choreographed rather than a template popping into view.
     Trigger: DOMContentLoaded. Duration: 900ms fade, 400ms hold.
     ------------------------------------------------------------------------ */
  function initCurtain() {
    const curtain = document.createElement('div');
    curtain.className = 'page-curtain';
    curtain.innerHTML = '<span class="page-curtain__mark">NEON NEXUS</span>';
    document.body.prepend(curtain);
    curtain.addEventListener('animationend', () => curtain.remove(), { once: true });
    // Safety net in case animationend never fires (e.g. tab backgrounded)
    setTimeout(() => curtain.remove(), 2000);
  }

  /* ------------------------------------------------------------------------
     1. NAV — scrolled state + mobile burger
     Trigger: scroll position > 40px. Purely a background/border swap,
     transform/opacity-driven via CSS transition already declared there.
     ------------------------------------------------------------------------ */
  function initNav() {
    const nav = document.getElementById('nav');
    const burger = document.getElementById('navBurger');
    const mobile = document.getElementById('navMobile');
    if (!nav) return;

    let ticking = false;
    const applyScrollState = () => {
      nav.classList.toggle('is-scrolled', window.scrollY > 40);
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(applyScrollState);
        ticking = true;
      }
    }, { passive: true });
    applyScrollState();

    if (burger && mobile) {
      let closeTimer = null;

      const setOpen = (open) => {
        burger.setAttribute('aria-expanded', String(open));
        document.documentElement.classList.toggle('no-scroll-html', open);

        if (open) {
          clearTimeout(closeTimer);
          mobile.classList.add('is-open');
          // display:none -> flex needs a frame to paint before the
          // opacity/transform transition can animate from it.
          requestAnimationFrame(() => {
            requestAnimationFrame(() => mobile.classList.add('is-animate'));
          });
        } else {
          mobile.classList.remove('is-animate');
          // Keep display:flex until the fade-out transition finishes,
          // otherwise the menu vanishes instantly instead of animating out.
          clearTimeout(closeTimer);
          closeTimer = setTimeout(() => {
            mobile.classList.remove('is-open');
          }, 480);
        }
      };

      burger.addEventListener('click', () => {
        setOpen(!mobile.classList.contains('is-open'));
      });

      mobile.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => setOpen(false));
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && mobile.classList.contains('is-open')) {
          setOpen(false);
          burger.focus();
        }
      });
    }
  }

  /* ------------------------------------------------------------------------
     2. SCROLL STORYTELLING — generic reveal-up
     Trigger: element enters viewport (20% visible).
     Delay: staggered per-section via nth-child order (natural DOM order),
            no extra JS bookkeeping needed since each observes independently.
     Duration: 900ms (declared in CSS). Easing: ease-out-expo.
     GPU: animates opacity + transform only, unobserves after firing once.
     Purpose: content arrives with the same unhurried confidence as the
     hero, so scrolling feels like continued discovery, not a new page.
     ------------------------------------------------------------------------ */
  function initRevealObserver() {
    const targets = document.querySelectorAll('.reveal-up');
    if (!targets.length) return;

    if (prefersReducedMotion) {
      targets.forEach(el => el.classList.add('is-visible'));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -60px 0px' });

    targets.forEach(el => io.observe(el));
  }

  /* ------------------------------------------------------------------------
     3. AMBIENT SPOTLIGHT CURSOR
     Trigger: pointermove over document (desktop only, hover:hover).
     Delay: none, but movement is lerped for a soft trailing feel rather
     than a snap-to-cursor jump.
     Duration: continuous, rAF loop.
     Easing: linear interpolation factor 0.12 per frame (~ease-out feel
     over ~8 frames).
     GPU: translate3d only, opacity toggled once on first move.
     Purpose: makes the dark canvas feel like a physical surface with a
     light source the visitor carries, reinforcing "space" over "page".
     ------------------------------------------------------------------------ */
  function initSpotlight() {
    const spotlight = document.getElementById('spotlight');
    if (!spotlight || !hasHover || prefersReducedMotion) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;
    let activated = false;

    window.addEventListener('pointermove', (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!activated) {
        activated = true;
        spotlight.classList.add('is-active');
      }
    }, { passive: true });

    function loop() {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      spotlight.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`;
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  /* ------------------------------------------------------------------------
     4. MAGNETIC BUTTONS
     Trigger: pointermove within button bounds + 40% padding.
     Delay: none on follow; 300ms ease-out spring back on leave (via CSS
     transition already on .magnetic in the base stylesheet... actually
     declared inline below for the release moment specifically).
     Duration: continuous while hovering, 300ms release.
     Easing: ease-out-quart on release.
     GPU: translate only via CSS custom properties --mx/--my.
     Purpose: buttons feel like dense, weighted objects that respond to
     proximity — a small luxury tell rather than a flat click target.
     ------------------------------------------------------------------------ */
  function initMagneticButtons() {
    if (!hasHover || prefersReducedMotion) return;
    const buttons = document.querySelectorAll('.magnetic');

    buttons.forEach(btn => {
      const strength = 0.35;
      const maxPull = 10;

      btn.addEventListener('pointermove', (e) => {
        const rect = btn.getBoundingClientRect();
        const relX = e.clientX - (rect.left + rect.width / 2);
        const relY = e.clientY - (rect.top + rect.height / 2);
        const mx = Math.max(-maxPull, Math.min(maxPull, relX * strength));
        const my = Math.max(-maxPull, Math.min(maxPull, relY * strength));
        btn.style.transition = 'transform 80ms linear';
        btn.style.setProperty('--mx', `${mx}px`);
        btn.style.setProperty('--my', `${my}px`);
      });

      btn.addEventListener('pointerleave', () => {
        btn.style.transition = 'transform 400ms cubic-bezier(0.25, 1, 0.5, 1)';
        btn.style.setProperty('--mx', '0px');
        btn.style.setProperty('--my', '0px');
      });
    });
  }

  /* ------------------------------------------------------------------------
     5. 3D TILT (philosophy cards)
     Trigger: pointermove within card bounds.
     Delay: none while hovering; 400ms ease-out-expo return on leave.
     Duration: continuous / 400ms release.
     Easing: ease-out-expo on release, linear while tracking.
     GPU: rotateX/rotateY on a perspective-parented element (transform only).
     Purpose: reinforces the "glass panel suspended in space" read from the
     brief's sci-fi interior references, without a full 3D scene.
     ------------------------------------------------------------------------ */
  function initTilt() {
    if (!hasHover || prefersReducedMotion) return;
    const cards = document.querySelectorAll('[data-tilt]');
    const maxTilt = 6;

    cards.forEach(card => {
      card.addEventListener('pointermove', (e) => {
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;
        const tiltY = (px - 0.5) * maxTilt * 2;
        const tiltX = (0.5 - py) * maxTilt * 2;
        card.style.transition = 'transform 60ms linear';
        card.style.setProperty('--tiltX', `${tiltX}deg`);
        card.style.setProperty('--tiltY', `${tiltY}deg`);
      });

      card.addEventListener('pointerleave', () => {
        card.style.transition = 'transform 500ms cubic-bezier(0.16, 1, 0.3, 1)';
        card.style.setProperty('--tiltX', '0deg');
        card.style.setProperty('--tiltY', '0deg');
      });
    });
  }

  /* ------------------------------------------------------------------------
     6. FPS COUNTERS — count-up on reveal
     Trigger: fps-panel enters viewport.
     Delay: none, starts immediately on intersect.
     Duration: 1400ms per counter, all counters run in parallel.
     Easing: ease-out-quart (fast start, gentle settle on the true number).
     GPU: text content update only (no layout thrash — fixed-width column).
     Purpose: gives the spec sheet a moment of "live data" rather than a
     static price list, matching the brief's "understanding equipment
     level" step in the UX funnel.
     ------------------------------------------------------------------------ */
  function initFpsCounters() {
    const panel = document.querySelector('.fps-panel');
    if (!panel) return;
    const nums = panel.querySelectorAll('[data-count]');

    const animateCount = (el) => {
      const target = parseInt(el.dataset.count, 10);
      if (prefersReducedMotion) {
        el.textContent = target;
        return;
      }
      const duration = 1400;
      const start = performance.now();
      const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

      function tick(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutQuart(progress);
        el.textContent = Math.round(eased * target);
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          nums.forEach(animateCount);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });

    io.observe(panel);
  }

  /* ------------------------------------------------------------------------
     7. TESTIMONIAL CAROUSEL
     Trigger: dot click, or auto-advance every 6s (paused on hover/focus).
     Delay: n/a. Duration: 480ms slide (--dur-slow track transition in CSS).
     Easing: ease-in-out-cubic (symmetric — sliding to a neighbor, not a
     one-directional reveal).
     GPU: transform: translateX on the track only.
     Purpose: minimalist, self-explanatory carousel per the brief; auto-
     advance keeps the section alive without requiring interaction.
     ------------------------------------------------------------------------ */
  function initTestimonialCarousel() {
    const root = document.getElementById('testimonialCarousel');
    const track = document.getElementById('testimonialTrack');
    const dotsWrap = document.getElementById('testimonialDots');
    if (!root || !track || !dotsWrap) return;

    const slides = Array.from(track.children);
    let index = 0;
    let autoTimer = null;

    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-label', `Отзыв ${i + 1}`);
      if (i === 0) dot.classList.add('is-active');
      dot.addEventListener('click', () => goTo(i, true));
      dotsWrap.appendChild(dot);
    });
    const dots = Array.from(dotsWrap.children);

    function render() {
      track.style.transform = `translateX(-${index * 100}%)`;
      dots.forEach((d, i) => d.classList.toggle('is-active', i === index));
    }

    function goTo(i, userInitiated) {
      index = (i + slides.length) % slides.length;
      render();
      if (userInitiated) restartAuto();
    }

    function next() { goTo(index + 1); }

    function startAuto() {
      if (prefersReducedMotion) return;
      autoTimer = setInterval(next, 6000);
    }
    function stopAuto() { clearInterval(autoTimer); }
    function restartAuto() { stopAuto(); startAuto(); }

    root.addEventListener('mouseenter', stopAuto);
    root.addEventListener('mouseleave', startAuto);
    root.addEventListener('focusin', stopAuto);
    root.addEventListener('focusout', startAuto);

    /* Touch swipe: track finger position, drag the slide 1:1 for
       feedback, then snap to next/prev/current based on distance
       dragged rather than velocity — simpler and reliable enough for a
       3-slide set. Vertical scrolls are let through by bailing out once
       it's clear the gesture is more vertical than horizontal. */
    let touchStartX = 0;
    let touchStartY = 0;
    let dragOffset = 0;
    let isDragging = false;
    let isHorizontalSwipe = null;

    root.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      dragOffset = 0;
      isDragging = true;
      isHorizontalSwipe = null;
      stopAuto();
      track.style.transition = 'none';
    }, { passive: true });

    root.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;

      if (isHorizontalSwipe === null) {
        isHorizontalSwipe = Math.abs(dx) > Math.abs(dy);
      }
      if (!isHorizontalSwipe) return;

      e.preventDefault(); // stop page scroll once we're committed to a horizontal swipe
      dragOffset = dx;
      const percent = (dragOffset / root.clientWidth) * 100;
      track.style.transform = `translateX(calc(-${index * 100}% + ${percent}%))`;
    }, { passive: false });

    root.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;
      track.style.transition = '';

      const threshold = root.clientWidth * 0.15;
      if (isHorizontalSwipe && dragOffset < -threshold) {
        goTo(index + 1, true);
      } else if (isHorizontalSwipe && dragOffset > threshold) {
        goTo(index - 1, true);
      } else {
        render(); // snap back to the current slide
        restartAuto();
      }
      dragOffset = 0;
    });

    render();
    startAuto();
  }

  /* ------------------------------------------------------------------------
     8. FAQ — GLASS ACCORDION
     Trigger: click on question button.
     Delay: none. Duration: 480ms (--dur-med grid-template-rows transition
     declared in CSS, using the 0fr/1fr technique for auto-height animation).
     Easing: ease-in-out-cubic.
     GPU note: grid-template-rows is not a compositor-only property, but it
     is the only reliable way to animate to "auto" height without measuring;
     scope is small (one panel at a time) so layout cost stays negligible.
     Purpose: single-open accordion keeps the FAQ scannable and avoids a
     tall, intimidating wall of answers.
     ------------------------------------------------------------------------ */
  function initFaqAccordion() {
    const items = document.querySelectorAll('.faq-item');
    if (!items.length) return;

    items.forEach(item => {
      const btn = item.querySelector('.faq-item__q');
      if (!btn) return;
      btn.addEventListener('click', () => {
        const isOpen = btn.getAttribute('aria-expanded') === 'true';
        items.forEach(other => {
          other.querySelector('.faq-item__q').setAttribute('aria-expanded', 'false');
        });
        btn.setAttribute('aria-expanded', String(!isOpen));
      });
    });
  }

  /* ------------------------------------------------------------------------
     9. SMOOTH ANCHOR SCROLL (fallback / offset correction)
     html{scroll-behavior:smooth} handles the animation itself; this only
     exists to close the mobile menu before scrolling so the destination
     lands under the fixed nav correctly.
     ------------------------------------------------------------------------ */
  function initAnchorLinks() {
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', (e) => {
        const id = link.getAttribute('href').slice(1);
        const target = document.getElementById(id);
        if (!target) return;
        // Let default smooth-scroll happen; nothing to prevent.
      });
    });
  }

  /* ------------------------------------------------------------------------
     10. BOOKING FORM
     Client-side only: validates required fields via the native constraint
     API, then swaps in a confirmation message. Wire the fetch() call to a
     real endpoint when the backend is ready.
     ------------------------------------------------------------------------ */
  function initBookingForm() {
    const form = document.getElementById('bookingForm');
    const status = document.getElementById('bookingFormStatus');
    if (!form || !status) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      status.textContent = 'Отправляем заявку…';

      // Placeholder for a real request, e.g.:
      // fetch('/api/booking', { method: 'POST', body: new FormData(form) })
      window.setTimeout(() => {
        status.textContent = 'Заявка отправлена — мы свяжемся с вами в ближайшее время.';
        submitBtn.disabled = false;
        form.reset();
      }, 600);
    });
  }

  /* ------------------------------------------------------------------------
     INIT
     ------------------------------------------------------------------------ */
  function init() {
    initCurtain();
    initNav();
    initRevealObserver();
    initSpotlight();
    initMagneticButtons();
    initTilt();
    initFpsCounters();
    initTestimonialCarousel();
    initFaqAccordion();
    initAnchorLinks();
    initBookingForm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
