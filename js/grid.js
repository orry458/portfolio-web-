/**
 * Interactive Network Background Canvas Engine
 * Recreates the signature cursor-reactive and touch-reactive grid from rashmisaini.netlify.app
 * Fully optimized for both Desktop mouse interactions and Mobile phone touch gestures.
 */

(function () {
  'use strict';

  function initInteractiveGrid(canvasId, containerId) {
    const canvas = document.getElementById(canvasId);
    const container = document.getElementById(containerId);
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Simulation constants
    const SPACING = 58;
    const MAX_LINE_DIST = SPACING * 1.3;
    const POINTER_RADIUS = 140;
    const EASE = 0.22;
    const TRAIL_MAX_AGE = 550; // ms
    const TRAIL_MAX_POINTS = 50;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let points = [];

    // Pointer state with intensity easing for ultra-smooth mobile release
    const pointer = {
      x: null,
      y: null,
      active: false,
      intensity: 0,
      targetIntensity: 0,
      isTouch: false
    };

    let trail = [];
    let smoothX = null;
    let smoothY = null;
    let animationFrameId = null;

    // Build regular lattice grid points with baseline positions (bx, by)
    function buildGrid() {
      points = [];
      const cols = Math.ceil(width / SPACING) + 1;
      const rows = Math.ceil(height / SPACING) + 1;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const bx = c * SPACING;
          const by = r * SPACING;
          points.push({
            bx: bx,
            by: by,
            x: bx,
            y: by
          });
        }
      }
    }

    // Handle high-DPI crisp canvas rendering and resize
    function resize() {
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildGrid();
    }

    function setPointerCoordinates(clientX, clientY, isTouchDevice) {
      const rect = container.getBoundingClientRect();
      pointer.x = clientX - rect.left;
      pointer.y = clientY - rect.top;
      pointer.active = true;
      pointer.targetIntensity = 1.0;
      pointer.isTouch = !!isTouchDevice;

      // Initialize smooth path if starting fresh
      if (smoothX === null) {
        smoothX = pointer.x;
        smoothY = pointer.y;
      }
    }

    function releasePointer() {
      pointer.targetIntensity = 0.0;
      // On mobile or mouse exit, let the intensity decay smoothly
      // rather than cutting off abruptly.
    }

    // --- Unified Pointer & Touch Event Listeners ---

    let isInteracting = false;

    // Desktop Mouse events
    container.addEventListener('mousemove', (e) => {
      setPointerCoordinates(e.clientX, e.clientY, false);
    });

    container.addEventListener('mouseleave', () => {
      if (!isInteracting) {
        releasePointer();
      }
    });

    // Unified Pointerdown (handles both pen/touch/mouse)
    container.addEventListener('pointerdown', (e) => {
      isInteracting = true;
      setPointerCoordinates(e.clientX, e.clientY, e.pointerType === 'touch');
    });

    window.addEventListener('pointermove', (e) => {
      if (isInteracting) {
        setPointerCoordinates(e.clientX, e.clientY, e.pointerType === 'touch');
      }
    });

    window.addEventListener('pointerup', () => {
      if (isInteracting) {
        isInteracting = false;
        releasePointer();
      }
    });

    window.addEventListener('pointercancel', () => {
      if (isInteracting) {
        isInteracting = false;
        releasePointer();
      }
    });

    // Touch events fallback for all mobile browsers (iOS Safari & Android Chrome)
    container.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches && e.touches[0]) {
          isInteracting = true;
          const touch = e.touches[0];
          setPointerCoordinates(touch.clientX, touch.clientY, true);
        }
      },
      { passive: true }
    );

    window.addEventListener(
      'touchmove',
      (e) => {
        if (isInteracting && e.touches && e.touches[0]) {
          const touch = e.touches[0];
          setPointerCoordinates(touch.clientX, touch.clientY, true);
        }
      },
      { passive: true }
    );

    window.addEventListener(
      'touchend',
      () => {
        if (isInteracting) {
          isInteracting = false;
          releasePointer();
        }
      },
      { passive: true }
    );

    window.addEventListener(
      'touchcancel',
      () => {
        if (isInteracting) {
          isInteracting = false;
          releasePointer();
        }
      },
      { passive: true }
    );

    // Initial resize observer
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(resize);
      ro.observe(container);
    } else {
      window.addEventListener('resize', resize);
    }
    resize();

    // Subtle welcome ripple on first mobile/desktop load
    let introStartTime = performance.now();
    const introDuration = 1800; // ms
    let introActive = true;

    // Main animation loop
    function draw(now) {
      ctx.clearRect(0, 0, width, height);

      // Smooth intensity transition (for gentle decay on touch release)
      pointer.intensity += (pointer.targetIntensity - pointer.intensity) * 0.12;
      if (pointer.intensity < 0.005 && pointer.targetIntensity === 0) {
        pointer.intensity = 0;
        pointer.active = false;
        trail = [];
        smoothX = null;
        smoothY = null;
      }

      // Introductory gentle wave on load (fades out naturally)
      let introFactor = 0;
      let introX = 0;
      let introY = 0;
      if (introActive) {
        const elapsed = now - introStartTime;
        if (elapsed < introDuration) {
          const progress = elapsed / introDuration;
          introFactor = Math.sin(progress * Math.PI) * (1 - progress);
          introX = width * (0.25 + 0.5 * progress);
          introY = height * 0.45 + Math.sin(progress * 4) * 40;
        } else {
          introActive = false;
        }
      }

      const activeIntensity = Math.max(pointer.intensity, introFactor * 0.7);
      const effX = pointer.active ? pointer.x : introX;
      const effY = pointer.active ? pointer.y : introY;

      // 1. Update point physics (spring pull towards pointer position)
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        let targetX = p.bx;
        let targetY = p.by;

        if (activeIntensity > 0.01) {
          const dx = p.bx - effX;
          const dy = p.by - effY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < POINTER_RADIUS) {
            const pull = (1 - dist / POINTER_RADIUS) * 14 * activeIntensity;
            const len = dist || 1;
            targetX = p.bx - (dx / len) * pull;
            targetY = p.by - (dy / len) * pull;
          }
        }

        // Spring ease towards current target
        p.x += (targetX - p.x) * 0.18;
        p.y += (targetY - p.y) * 0.18;
      }

      // 2. Render connecting lines between adjacent lattice points
      ctx.lineWidth = 1.4;
      const totalPoints = points.length;
      for (let i = 0; i < totalPoints; i++) {
        const a = points[i];
        for (let j = i + 1; j < totalPoints; j++) {
          const b = points[j];
          const ddx = a.bx - b.bx;
          const ddy = a.by - b.by;
          const baseDist = Math.sqrt(ddx * ddx + ddy * ddy);

          if (baseDist > MAX_LINE_DIST) continue;

          let opacity = 0.08;
          let r = 231,
            g = 231,
            bCol = 231;

          if (activeIntensity > 0.01) {
            const mx = (a.x + b.x) * 0.5;
            const my = (a.y + b.y) * 0.5;
            const pdx = mx - effX;
            const pdy = my - effY;
            const pdist = Math.sqrt(pdx * pdx + pdy * pdy);

            if (pdist < POINTER_RADIUS) {
              const proximity = (1 - pdist / POINTER_RADIUS) * activeIntensity;
              opacity = 0.08 + proximity * 0.55;
              // Transition smoothly to warm yellow accent (#f3e9a8 = 243, 233, 168)
              r = Math.round(231 + (243 - 231) * proximity);
              g = Math.round(231 + (233 - 231) * proximity);
              bCol = Math.round(231 + (168 - 231) * proximity);
            }
          }

          ctx.strokeStyle = `rgba(${r},${g},${bCol},${opacity})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // 3. Render point dots
      for (let i = 0; i < totalPoints; i++) {
        const p = points[i];
        let opacity = 0.1;
        let r = 231,
          g = 231,
          bCol = 231;

        if (activeIntensity > 0.01) {
          const dx = p.x - effX;
          const dy = p.y - effY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < POINTER_RADIUS) {
            const proximity = (1 - dist / POINTER_RADIUS) * activeIntensity;
            opacity = 0.1 + proximity * 0.6;
            r = Math.round(231 + (243 - 231) * proximity);
            g = Math.round(231 + (233 - 231) * proximity);
            bCol = Math.round(231 + (168 - 231) * proximity);
          }
        }

        ctx.fillStyle = `rgba(${r},${g},${bCol},${opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.7, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. Digital-ink ribbon trail (enabled on both Desktop AND Mobile)
      if (pointer.active && pointer.intensity > 0.05) {
        if (smoothX === null) {
          smoothX = pointer.x;
          smoothY = pointer.y;
        }
        smoothX += (pointer.x - smoothX) * EASE;
        smoothY += (pointer.y - smoothY) * EASE;

        const last = trail[trail.length - 1];
        if (!last || Math.hypot(smoothX - last.x, smoothY - last.y) > 0.4) {
          trail.push({ x: smoothX, y: smoothY, t: now });
          if (trail.length > TRAIL_MAX_POINTS) {
            trail.shift();
          }
        }
      }

      if (trail.length > 1) {
        trail = trail.filter((pt) => now - pt.t < TRAIL_MAX_AGE);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let i = 1; i < trail.length; i++) {
          const p0 = trail[i - 1];
          const p1 = trail[i];
          const age = now - p1.t;
          if (age >= TRAIL_MAX_AGE) continue;

          const life = (1 - age / TRAIL_MAX_AGE) * pointer.intensity;
          const dt = Math.max(8, p1.t - p0.t);
          const speed = Math.hypot(p1.x - p0.x, p1.y - p0.y) / dt;
          const speedEase = Math.min(speed * 0.8, 0.5);

          ctx.strokeStyle = `rgba(243, 233, 168, ${life * 0.28})`;
          ctx.lineWidth = (2.2 + speedEase) * (0.35 + 0.65 * life);

          const mx = (p0.x + p1.x) * 0.5;
          const my = (p0.y + p1.y) * 0.5;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.quadraticCurveTo(mx, my, p1.x, p1.y);
          ctx.stroke();
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    }

    // Kick off animation loop
    animationFrameId = requestAnimationFrame(draw);

    // Pause canvas rendering when page is backgrounded to save CPU/battery
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
      } else {
        animationFrameId = requestAnimationFrame(draw);
      }
    });
  }

  // Live local clock (IST / user location)
  function initClock() {
    const el = document.getElementById('sidebar-local-time') || document.getElementById('live-time');
    if (!el) return;

    function update() {
      const now = new Date();
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).formatToParts(now);

      const get = (type) => parts.find((p) => p.type === type)?.value || '00';
      el.textContent = `${get('hour')}:${get('minute')}:${get('second')} IST`;
    }

    update();
    setInterval(update, 1000);
  }

  // Sidebar Nav sliding pill highlight
  function initNavSlider() {
    const sidebarNav = document.getElementById('sidebar-nav');
    const navSlider = document.getElementById('nav-slider');
    if (!sidebarNav || !navSlider) return;

    function moveSlider(link) {
      if (!link) return;
      const navRect = sidebarNav.getBoundingClientRect();
      const linkRect = link.getBoundingClientRect();
      navSlider.style.top = (linkRect.top - navRect.top) + 'px';
      navSlider.style.height = linkRect.height + 'px';
    }

    const links = sidebarNav.querySelectorAll('a');
    let isClickScrolling = false;
    let clickTimeout = null;

    links.forEach((link) => {
      link.addEventListener('click', () => {
        links.forEach((l) => l.classList.remove('active'));
        link.classList.add('active');
        moveSlider(link);

        // Pause scroll-spy temporarily while smooth scrolling to clicked anchor
        isClickScrolling = true;
        clearTimeout(clickTimeout);
        clickTimeout = setTimeout(() => {
          isClickScrolling = false;
        }, 900);
      });
    });

    // Scroll spy: accurately calculate document offset using getBoundingClientRect
    const targets = [
      { elId: 'about-outer', fallbackId: 'about', link: document.getElementById('nav-about') },
      { elId: 'projects', fallbackId: 'projects', link: document.getElementById('nav-projects') },
      { elId: 'hero-outer', fallbackId: 'top', link: document.getElementById('nav-home') }
    ].filter((t) => t.link);

    function onScrollSpy() {
      if (isClickScrolling) return;

      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const scrollBottom = scrollY + window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;

      // If user reached the very bottom of the page, activate the lowest nav link
      if (scrollBottom >= docHeight - 40) {
        const lastLink = targets[0]?.link;
        if (lastLink && !lastLink.classList.contains('active')) {
          links.forEach((l) => l.classList.remove('active'));
          lastLink.classList.add('active');
          moveSlider(lastLink);
        }
        return;
      }

      // Viewport trigger line (approx 35% from the top of the viewport)
      const triggerY = scrollY + Math.min(window.innerHeight * 0.38, 300);

      let matchedLink = targets[targets.length - 1].link;
      for (let i = 0; i < targets.length; i++) {
        const item = targets[i];
        const el = document.getElementById(item.elId) || document.getElementById(item.fallbackId);
        if (el) {
          const docTop = el.getBoundingClientRect().top + scrollY;
          if (triggerY >= docTop) {
            matchedLink = item.link;
            break;
          }
        }
      }

      if (matchedLink && !matchedLink.classList.contains('active')) {
        links.forEach((l) => l.classList.remove('active'));
        matchedLink.classList.add('active');
        moveSlider(matchedLink);
      }
    }

    window.addEventListener('scroll', onScrollSpy, { passive: true });

    const active = sidebarNav.querySelector('a.active') || links[0];
    if (active) {
      setTimeout(() => moveSlider(active), 100);
    }
    window.addEventListener('resize', () => {
      const cur = sidebarNav.querySelector('a.active');
      if (cur) moveSlider(cur);
    });
  }

  // Scroll Progress Rail along sidebar edge
  function initScrollRail() {
    const fill = document.getElementById('scroll-rail-fill');
    if (!fill) return;

    function update() {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? Math.min(100, Math.max(0, (scrollTop / max) * 100)) : 0;
      fill.style.height = pct + '%';
    }

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  // Hover video preview playback & expanded video modal controller
  function initVideoPreviewsAndModal() {
    const videoWraps = document.querySelectorAll('.card-video-wrap');
    const modal = document.getElementById('video-modal');
    const modalVideo = document.getElementById('modal-video-player');
    const modalCaseBody = document.getElementById('modal-case-body');
    const modalInfoCol = document.getElementById('modal-info-col');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    // 1. Hover video preview: Play without sound only on hover
    videoWraps.forEach((wrap) => {
      const video = wrap.querySelector('video');
      if (!video) return;

      // Ensure preview video is strictly muted
      video.muted = true;

      wrap.addEventListener('mouseenter', () => {
        video.currentTime = 0;
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {});
        }
      });

      wrap.addEventListener('mouseleave', () => {
        video.pause();
        // Allow poster overlay to transition in before rewinding frame
        setTimeout(() => {
          if (!wrap.matches(':hover')) {
            video.currentTime = 0;
          }
        }, 280);
      });

      // 2. Click to open in expanded side-by-side modal
      wrap.addEventListener('click', (e) => {
        e.preventDefault();
        const card = wrap.closest('.project-card');
        if (!card || !modal || !modalVideo) return;

        const videoSrc = card.dataset.video;
        const videoPoster = card.dataset.poster;

        // Populate case study explanation on the side
        const explanationEl = card.querySelector('.project-explanation');
        if (modalCaseBody) {
          if (explanationEl) {
            modalCaseBody.innerHTML = explanationEl.innerHTML;
          } else {
            const title = card.dataset.title || 'Project Case Study';
            modalCaseBody.innerHTML = `
              <div class="case-study-content">
                <div class="case-badge"><span class="badge-dot"></span><span>Motion System Case Study</span></div>
                <h2 class="case-heading">${title}</h2>
                <div class="case-section">
                  <h3 class="case-subheading">Overview</h3>
                  <p class="case-body">Detailed case study breakdown coming soon.</p>
                </div>
              </div>
            `;
          }
        }

        // Reset scroll position so only the text panel begins at top
        if (modalInfoCol) {
          modalInfoCol.scrollTop = 0;
        }

        // Set video source & un-mute for modal playback
        modalVideo.poster = videoPoster || '';
        modalVideo.src = videoSrc || '';
        modalVideo.muted = false;

        // Loop all project videos endlessly in the modal window
        modalVideo.loop = true;

        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        const p = modalVideo.play();
        if (p !== undefined) {
          p.catch(() => {});
        }
      });
    });

    // Close Modal helper
    function closeModal() {
      if (!modal) return;
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';

      if (modalVideo) {
        modalVideo.pause();
        modalVideo.loop = false;
        modalVideo.removeAttribute('src');
        modalVideo.load();
      }
    }

    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', closeModal);
    }

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeModal();
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && modal.classList.contains('open')) {
        closeModal();
      }
    });
  }

  // One-click Copy Email Pill with micro-interaction feedback
  function initEmailCopyPill() {
    const copyPill = document.getElementById('email-copy-pill');
    const copyLabel = document.getElementById('copy-label');
    const emailVal = document.getElementById('email-address-text');

    if (!copyPill || !emailVal) return;

    let copyTimer = null;

    copyPill.addEventListener('click', () => {
      const emailToCopy = emailVal.textContent.trim();

      const notifySuccess = () => {
        copyPill.classList.add('is-copied');
        if (copyLabel) copyLabel.textContent = 'Copied! ✓';

        clearTimeout(copyTimer);
        copyTimer = setTimeout(() => {
          copyPill.classList.remove('is-copied');
          if (copyLabel) copyLabel.textContent = 'Copy';
        }, 2400);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(emailToCopy).then(notifySuccess).catch(() => {
          fallbackCopy(emailToCopy, notifySuccess);
        });
      } else {
        fallbackCopy(emailToCopy, notifySuccess);
      }
    });

    function fallbackCopy(text, cb) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand('copy');
        cb();
      } catch (err) {}
      document.body.removeChild(ta);
    }
  }

  // Interactive Note Station & Sticky Memo Board
  function initInteractiveNoteDesk() {
    // 1. Interactive Note Composer
    const composerCard = document.getElementById('note-composer-card');
    const colorSwatches = document.querySelectorAll('.color-swatch');
    const moodPills = document.querySelectorAll('.mood-pill');
    const messageInput = document.getElementById('note-message-input');
    const authorInput = document.getElementById('note-author-input');
    const charNum = document.getElementById('char-num');
    const pinBtn = document.getElementById('pin-note-btn');
    const feedbackEl = document.getElementById('composer-feedback');
    const pinsContainer = document.getElementById('board-pins-container');
    const notesCountEl = document.getElementById('board-notes-count');

    if (!composerCard || !pinsContainer) return;

    let currentColor = 'yellow';
    let currentMood = '✦ Project Idea';

    // Color Swatch Selection
    colorSwatches.forEach((swatch) => {
      swatch.addEventListener('click', () => {
        colorSwatches.forEach((s) => s.classList.remove('active'));
        swatch.classList.add('active');
        currentColor = swatch.dataset.color || 'yellow';
        composerCard.dataset.color = currentColor;
      });
    });

    // Mood Pill Selection
    moodPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        moodPills.forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        currentMood = pill.dataset.mood || '✦ Project Idea';
      });
    });

    // Live Character Counter
    if (messageInput && charNum) {
      messageInput.addEventListener('input', () => {
        charNum.textContent = messageInput.value.length;
      });
    }

    // Storage Management & Notes Collection (Clean Board, No Default Sample Notes)
    const STORAGE_KEY = 'arindam_studio_notes_v2';
    const defaultNotes = [];

    function getSavedNotes() {
      try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (err) {}
      return defaultNotes;
    }

    function saveNotes(notesArr) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notesArr));
      } catch (err) {}
    }

    let notes = getSavedNotes();

    function renderBoard(justPinnedId) {
      pinsContainer.innerHTML = '';
      if (notesCountEl) {
        notesCountEl.textContent = `${notes.length} note${notes.length === 1 ? '' : 's'} pinned`;
      }

      if (notes.length === 0) {
        pinsContainer.innerHTML = `
          <div class="empty-board-placeholder">
            <span class="empty-pin-icon">📌</span>
            <p class="empty-board-text">The studio corkboard is currently clean and quiet.</p>
            <span class="empty-board-sub">Use the composer on the left to pin the very first note!</span>
          </div>
        `;
        return;
      }

      notes.forEach((note) => {
        const noteEl = document.createElement('div');
        const isJustPinned = note.id === justPinnedId;
        noteEl.className = `pinned-note color-${note.color || 'yellow'} ${isJustPinned ? 'just-pinned' : ''}`;
        noteEl.style.transform = `rotate(${note.rotation || 0}deg)`;
        noteEl.setAttribute('tabindex', '0');
        noteEl.setAttribute('role', 'article');
        noteEl.setAttribute('aria-label', `Note by ${note.author}: ${note.text}`);

        // Clean note card without timestamp
        noteEl.innerHTML = `
          <div class="pinned-thumbtack"></div>
          <span class="pinned-tag">${escapeHTML(note.mood || '✦ Note')}</span>
          <p class="pinned-text">${escapeHTML(note.text)}</p>
          <div class="pinned-footer">
            <span class="pinned-author">${escapeHTML(note.author || 'Anonymous')}</span>
          </div>
        `;

        pinsContainer.appendChild(noteEl);
      });
    }

    function escapeHTML(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    renderBoard();

    // Pin Note Button Click Handler
    if (pinBtn && messageInput) {
      pinBtn.addEventListener('click', () => {
        const messageText = messageInput.value.trim();
        if (!messageText) {
          if (feedbackEl) {
            feedbackEl.textContent = 'Please type a quick note first!';
            feedbackEl.style.color = '#ef4444';
          }
          messageInput.focus();
          return;
        }

        const authorName = (authorInput && authorInput.value.trim()) || 'Anonymous Friend';
        const newId = 'note-' + Date.now();
        // Generate subtle organic tilt between -3.5 and +3.5 deg
        const randomRot = (Math.random() * 6.5 - 3.25).toFixed(1);

        const newNote = {
          id: newId,
          text: messageText,
          author: authorName,
          mood: currentMood,
          color: currentColor,
          rotation: parseFloat(randomRot)
        };

        notes.unshift(newNote);
        // Keep at most 18 notes on board for performance
        if (notes.length > 18) notes.pop();
        saveNotes(notes);
        renderBoard(newId);

        // Reset composer inputs
        messageInput.value = '';
        if (authorInput) authorInput.value = '';
        if (charNum) charNum.textContent = '0';

        if (feedbackEl) {
          feedbackEl.textContent = '📌 Your note is pinned to the board! ✦';
          feedbackEl.style.color = '#10b981';
          setTimeout(() => {
            feedbackEl.textContent = '';
          }, 4500);
        }
      });
    }
  }

  // ==========================================================================
  // Interactive Paper Airplanes (Tactile Flight, Drag & Throw, Acrobatic Loops)
  // ==========================================================================
  function initPaperAirplanes() {
    const stage = document.getElementById('airplanes-stage');
    const canvas = document.getElementById('airplanes-canvas');
    const planeEl1 = document.getElementById('paper-plane-1');
    const planeEl2 = document.getElementById('paper-plane-2');
    const heroScreen = document.getElementById('contact-hero-screen');

    if (!stage || !canvas || !planeEl1 || !planeEl2 || !heroScreen) return;

    const ctx = canvas.getContext('2d');
    let width = 0;
    let height = 0;
    let dpr = window.devicePixelRatio || 1;
    let isVisible = true;
    let animId = null;

    function resizeCanvas() {
      const rect = stage.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      if (width === 0 || height === 0) return;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });

    // Smoke / trail particles pool
    const particles = [];
    function spawnParticle(x, y, vx, vy, color, size, decay) {
      particles.push({
        x: x,
        y: y,
        vx: (vx || 0) + (Math.random() - 0.5) * 0.7,
        vy: (vy || 0) + (Math.random() - 0.5) * 0.7,
        alpha: 0.7,
        color: color || '#f3e9a8',
        size: size || 2.4,
        decay: decay || 0.024
      });
      if (particles.length > 80) particles.shift();
    }

    // Angle lerp helper with wraparound
    function lerpAngle(current, target, factor) {
      let diff = (target - current) % 360;
      if (diff < -180) diff += 360;
      if (diff > 180) diff -= 360;
      return current + diff * factor;
    }

    // Smooth parametric flight path generator for slow, majestic gliding
    function getPathPosition(p, time) {
      if (p.id === 'plane-1') {
        // Plane 1: Graceful, wide, tilted figure-8 around upper-right / top zone
        const t = (time * 0.00028) + p.pathPhase;
        const cx = width * 0.74;
        const cy = height * 0.30;
        const rx = width * 0.19;
        const ry = height * 0.15;

        const x = cx + Math.sin(t) * rx;
        const y = cy + Math.sin(t * 2) * ry * 0.65 + Math.cos(t * 0.5) * (ry * 0.2);

        const dx = Math.cos(t) * rx;
        const dy = Math.cos(t * 2) * 2 * ry * 0.65 - Math.sin(t * 0.5) * 0.5 * (ry * 0.2);
        const heading = (Math.atan2(dy, dx) * 180 / Math.PI) + 90;

        return { x, y, heading };
      } else {
        // Plane 2: Sweeping wide wave / counter-orbit across mid-lower zone
        const t = (time * 0.00020) + p.pathPhase;
        const cx = width * 0.62;
        const cy = height * 0.62;
        const rx = width * 0.24;
        const ry = height * 0.13;

        const x = cx + Math.cos(t) * rx + Math.sin(t * 2) * (rx * 0.18);
        const y = cy + Math.sin(t) * ry + Math.cos(t * 1.5) * (ry * 0.16);

        const dx = -Math.sin(t) * rx + Math.cos(t * 2) * 2 * (rx * 0.18);
        const dy = Math.cos(t) * ry - Math.sin(t * 1.5) * 1.5 * (ry * 0.16);
        const heading = (Math.atan2(dy, dx) * 180 / Math.PI) + 90;

        return { x, y, heading };
      }
    }

    const planes = [
      {
        el: planeEl1,
        id: 'plane-1',
        pathPhase: 0,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        angle: -35,
        targetAngle: -35,
        scale: 1,
        state: 'idle',
        history: [],
        tailHistory: [],
        tailCounter: 0,
        loopProgress: 0,
        loopDuration: 1100,
        loopStartTime: 0,
        loopCenterX: 0,
        loopCenterY: 0,
        loopRadius: 55,
        startLoopAngle: 0,
        color: '#f3e9a8'
      },
      {
        el: planeEl2,
        id: 'plane-2',
        pathPhase: Math.PI * 0.8,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        angle: 40,
        targetAngle: 40,
        scale: 0.88,
        state: 'idle',
        history: [],
        tailHistory: [],
        tailCounter: 0,
        loopProgress: 0,
        loopDuration: 1100,
        loopStartTime: 0,
        loopCenterX: 0,
        loopCenterY: 0,
        loopRadius: 45,
        startLoopAngle: 0,
        color: '#ffffff'
      }
    ];

    planes.forEach((p) => {
      const init = getPathPosition(p, performance.now());
      p.x = init.x;
      p.y = init.y;
      p.angle = init.heading;
    });

    // Pointer Drag & Throw logic for each plane
    planes.forEach((p) => {
      let isPointerDown = false;
      let startPointerX = 0;
      let startPointerY = 0;
      let hasDragged = false;

      function onPointerDown(e) {
        if (e.button !== undefined && e.button !== 0) return;
        isPointerDown = true;
        hasDragged = false;
        startPointerX = e.clientX;
        startPointerY = e.clientY;
        p.state = 'dragging';
        p.vx = 0;
        p.vy = 0;
        p.history = [{ x: p.x, y: p.y, t: performance.now() }];
        p.el.classList.add('is-dragging');
        p.el.classList.add('hint-hidden');

        try {
          p.el.setPointerCapture(e.pointerId);
        } catch (err) {}

        e.preventDefault();
      }

      function onPointerMove(e) {
        if (!isPointerDown) return;
        const dx = e.clientX - startPointerX;
        const dy = e.clientY - startPointerY;
        if (!hasDragged && Math.hypot(dx, dy) > 4) {
          hasDragged = true;
        }

        const stageRect = stage.getBoundingClientRect();
        const curX = e.clientX - stageRect.left;
        const curY = e.clientY - stageRect.top;

        const prevX = p.x;
        const prevY = p.y;
        p.x = Math.max(16, Math.min(width - 16, curX));
        p.y = Math.max(16, Math.min(height - 16, curY));

        const moveDist = Math.hypot(p.x - prevX, p.y - prevY);
        if (moveDist > 2) {
          const moveAngle = (Math.atan2(p.y - prevY, p.x - prevX) * 180 / Math.PI) + 90;
          p.angle = lerpAngle(p.angle, moveAngle, 0.45);
          spawnParticle(p.x, p.y, (prevX - p.x) * 0.1, (prevY - p.y) * 0.1, p.color, 2, 0.035);
        }

        p.history.push({ x: p.x, y: p.y, t: performance.now() });
        if (p.history.length > 6) p.history.shift();
      }

      function onPointerUp(e) {
        if (!isPointerDown) return;
        isPointerDown = false;
        p.el.classList.remove('is-dragging');

        try {
          p.el.releasePointerCapture(e.pointerId);
        } catch (err) {}

        if (!hasDragged) {
          startLoopStunt(p);
        } else {
          let vx = 0;
          let vy = 0;
          if (p.history.length >= 2) {
            const first = p.history[0];
            const last = p.history[p.history.length - 1];
            const dt = Math.max(16, last.t - first.t);
            vx = ((last.x - first.x) / dt) * 16;
            vy = ((last.y - first.y) / dt) * 16;
          }

          const speed = Math.hypot(vx, vy);
          if (speed > 1.8) {
            const clampedSpeed = Math.min(speed, 24);
            const scaleFactor = clampedSpeed / speed;
            p.vx = vx * scaleFactor;
            p.vy = vy * scaleFactor;
            p.state = 'flying';
          } else {
            p.state = 'homing';
          }
        }
      }

      p.el.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    });

    function startLoopStunt(p) {
      p.state = 'looping';
      p.loopStartTime = performance.now();
      p.startLoopAngle = p.angle;
      const rad = (p.angle - 90) * Math.PI / 180;
      p.loopRadius = Math.min(width, height) * 0.08 + 25;
      p.loopCenterX = p.x + Math.cos(rad) * p.loopRadius;
      p.loopCenterY = p.y + Math.sin(rad) * p.loopRadius;
      p.el.classList.add('hint-hidden');
    }

    // Animation loop
    function animate(time) {
      if (!isVisible) {
        animId = requestAnimationFrame(animate);
        return;
      }

      if (width === 0 || height === 0) {
        resizeCanvas();
      }

      ctx.clearRect(0, 0, width, height);

      // Render & update contrail particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.alpha -= pt.decay;
        pt.size += 0.04;

        if (pt.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, pt.alpha);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Update and render each plane
      planes.forEach((p) => {
        if (p.state === 'idle') {
          // Slow, graceful cruising along parametric path
          const pathTarget = getPathPosition(p, time);

          p.x += (pathTarget.x - p.x) * 0.055;
          p.y += (pathTarget.y - p.y) * 0.055;
          p.angle = lerpAngle(p.angle, pathTarget.heading, 0.075);

          // Subtle vapor drift puff
          if (Math.random() < 0.06) {
            spawnParticle(p.x, p.y + 6, 0, 0.1, p.color, 1.8, 0.022);
          }
        } else if (p.state === 'flying') {
          p.x += p.vx;
          p.y += p.vy;

          p.vx *= 0.965;
          p.vy *= 0.965;

          const currentSpeed = Math.hypot(p.vx, p.vy);
          if (currentSpeed > 0.4) {
            const headingAngle = (Math.atan2(p.vy, p.vx) * 180 / Math.PI) + 90;
            p.angle = lerpAngle(p.angle, headingAngle, 0.18);
            spawnParticle(p.x, p.y, -p.vx * 0.15, -p.vy * 0.15, p.color, 2.4, 0.03);
          }

          const pad = 24;
          if (p.x < pad) { p.x = pad; p.vx = -p.vx * 0.7; }
          if (p.x > width - pad) { p.x = width - pad; p.vx = -p.vx * 0.7; }
          if (p.y < pad) { p.y = pad; p.vy = -p.vy * 0.7; }
          if (p.y > height - pad) { p.y = height - pad; p.vy = -p.vy * 0.7; }

          if (currentSpeed < 0.75) {
            p.state = 'homing';
          }
        } else if (p.state === 'homing') {
          // Smooth glide to intercept flight path
          const pathTarget = getPathPosition(p, time);
          const dx = pathTarget.x - p.x;
          const dy = pathTarget.y - p.y;
          const dist = Math.hypot(dx, dy);

          if (dist > 10) {
            p.x += dx * 0.045;
            p.y += dy * 0.045;
            const steerAngle = (Math.atan2(dy, dx) * 180 / Math.PI) + 90;
            p.angle = lerpAngle(p.angle, steerAngle, 0.12);
            spawnParticle(p.x, p.y, -dx * 0.01, -dy * 0.01, p.color, 2.0, 0.03);
          } else {
            p.state = 'idle';
          }
        } else if (p.state === 'looping') {
          const elapsed = time - p.loopStartTime;
          const progress = Math.min(1, elapsed / p.loopDuration);
          const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

          const angleRad = (p.startLoopAngle - 90) * Math.PI / 180 + ease * Math.PI * 2;
          p.x = p.loopCenterX + Math.cos(angleRad) * p.loopRadius;
          p.y = p.loopCenterY + Math.sin(angleRad) * p.loopRadius;
          p.angle = p.startLoopAngle + ease * 360;

          spawnParticle(p.x, p.y, 0, 0, '#f3e9a8', 2.8, 0.038);

          if (progress >= 1) {
            p.state = 'homing';
          }
        }

        // Draw fading dashed flight trail
        p.tailCounter = (p.tailCounter || 0) + 1;
        if (p.tailCounter % 2 === 0) {
          p.tailHistory.push({ x: p.x, y: p.y });
          if (p.tailHistory.length > 28) p.tailHistory.shift();
        }

        if (p.tailHistory.length > 2) {
          ctx.save();
          ctx.setLineDash([3, 6]);
          ctx.lineWidth = 1.3;
          for (let k = 1; k < p.tailHistory.length; k++) {
            const alpha = (k / p.tailHistory.length) * 0.42;
            ctx.strokeStyle = p.color === '#ffffff'
              ? `rgba(255, 255, 255, ${alpha * 0.85})`
              : `rgba(243, 233, 168, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(p.tailHistory[k - 1].x, p.tailHistory[k - 1].y);
            ctx.lineTo(p.tailHistory[k].x, p.tailHistory[k].y);
            ctx.stroke();
          }
          ctx.restore();
        }

        // Apply transform to DOM element
        p.el.style.transform = `translate3d(${p.x - 24}px, ${p.y - 24}px, 0) rotate(${p.angle}deg) scale(${p.scale || 1})`;
      });

      animId = requestAnimationFrame(animate);
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        isVisible = entry.isIntersecting;
      });
    }, { threshold: 0.1 });
    observer.observe(heroScreen);

    animId = requestAnimationFrame(animate);
  }

  /* ==========================================================================
   * Tools & Grayscale Basketball Hoop Interactive Engine
   * 7 Monochromatic logo badges on the grid.
   * Rock-solid relative offset dragging (zero DOM re-parenting / zero flex shift).
   * Drag & drop into the grayscale hoop on the extreme right, or flick/tap to shoot.
   * Subtle grayscale celebration: silver/white spark bursts, net ripple, star sparkle.
   * ========================================================================== */
  function initToolsHoopArcade() {
    const wrap = document.getElementById('about-tools-wrap');
    const bar = document.getElementById('about-tools-bar');
    const canvas = document.getElementById('tools-fx-canvas');
    const hoopStation = document.getElementById('about-hoop-station');
    const hoopRim = document.getElementById('hoop-rim-mono');
    const netSvg = document.getElementById('hoop-net-mono-svg');
    const burstAnchor = document.getElementById('hoop-mono-burst-anchor');

    if (!bar || !canvas || !hoopRim) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let isVisible = false;
    let animId = null;

    // Resize canvas
    function resizeCanvas() {
      const rect = bar.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Celebration sparks in gold theme (website secondary color #f3e9a8)
    const sparks = [];
    const goldPalette = ['#f3e9a8', '#fcf6cc', '#fae88a', '#dfd48f', '#ffffff', '#e8dc97'];
    function createMonoCelebration(canvasX, canvasY) {
      const count = 30;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5.8 + 1.8;
        sparks.push({
          x: canvasX,
          y: canvasY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2.0,
          color: goldPalette[Math.floor(Math.random() * goldPalette.length)],
          size: Math.random() * 2.8 + 1.4,
          alpha: 1,
          decay: Math.random() * 0.028 + 0.018
        });
      }
    }

    // Trigger celebration at the hoop
    function triggerHoopCelebration(canvasX, canvasY) {
      if (netSvg) {
        netSvg.classList.remove('net-swish-mono');
        void netSvg.offsetWidth;
        netSvg.classList.add('net-swish-mono');
      }

      hoopRim.classList.add('swish-glow');
      setTimeout(() => hoopRim.classList.remove('swish-glow'), 350);

      if (burstAnchor) {
        // Main center gold star (10 text removed)
        const starMain = document.createElement('div');
        starMain.className = 'mono-sparkle-float star-main';
        starMain.textContent = '✦';
        burstAnchor.appendChild(starMain);
        setTimeout(() => starMain.remove(), 1000);

        // Additional small gold star left
        const starLeft = document.createElement('div');
        starLeft.className = 'mono-sparkle-float star-left';
        starLeft.textContent = '✦';
        burstAnchor.appendChild(starLeft);
        setTimeout(() => starLeft.remove(), 900);

        // Additional small gold star right
        const starRight = document.createElement('div');
        starRight.className = 'mono-sparkle-float star-right';
        starRight.textContent = '✦';
        burstAnchor.appendChild(starRight);
        setTimeout(() => starRight.remove(), 950);
      }

      createMonoCelebration(canvasX, canvasY);
    }

    // Setup badges
    const badgeEls = Array.from(bar.querySelectorAll('.tool-pill-badge'));
    const badgeItems = badgeEls.map((el) => {
      const slotEl = el.closest('.tool-pill-slot');
      return {
        el,
        slotEl,
        state: 'IDLE', // IDLE, DRAGGING, FLYING, SWISHED, RESPAWNING
        slotCenterX: 0,
        slotCenterY: 0,
        dx: 0,
        dy: 0,
        pointerHistory: [],
        dragStartTime: 0
      };
    });

    badgeItems.forEach((item) => {
      let isPointerDown = false;
      let startClientX = 0;
      let startClientY = 0;
      let hasMovedSignificantly = false;

      function onPointerDown(e) {
        if (item.state === 'FLYING' || item.state === 'SWISHED' || item.state === 'RESPAWNING') return;
        e.preventDefault();
        isPointerDown = true;
        startClientX = e.clientX;
        startClientY = e.clientY;
        hasMovedSignificantly = false;
        item.dragStartTime = performance.now();
        item.pointerHistory = [{ x: e.clientX, y: e.clientY, time: item.dragStartTime }];

        // Compute slot center in viewport coords
        const slotRect = item.slotEl.getBoundingClientRect();
        item.slotCenterX = slotRect.left + slotRect.width / 2;
        item.slotCenterY = slotRect.top + slotRect.height / 2;

        item.state = 'DRAGGING';
        item.el.classList.add('is-dragging');
        item.el.style.transition = 'none';

        const dx = e.clientX - item.slotCenterX;
        const dy = e.clientY - item.slotCenterY;
        item.dx = dx;
        item.dy = dy;
        item.el.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.14)`;
      }

      function onPointerMove(e) {
        if (!isPointerDown || item.state !== 'DRAGGING') return;
        e.preventDefault();

        const dist = Math.hypot(e.clientX - startClientX, e.clientY - startClientY);
        if (dist > 6) {
          hasMovedSignificantly = true;
        }

        const now = performance.now();
        item.pointerHistory.push({ x: e.clientX, y: e.clientY, time: now });
        if (item.pointerHistory.length > 8) item.pointerHistory.shift();

        const dx = e.clientX - item.slotCenterX;
        const dy = e.clientY - item.slotCenterY;
        item.dx = dx;
        item.dy = dy;
        item.el.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.14)`;
      }

      function onPointerUp(e) {
        if (!isPointerDown) return;
        isPointerDown = false;
        item.el.classList.remove('is-dragging');

        const rimRect = hoopRim.getBoundingClientRect();
        const rimCenterX = rimRect.left + rimRect.width / 2;
        const rimCenterY = rimRect.top + rimRect.height / 2;

        const currentClientX = e.clientX;
        const currentClientY = e.clientY;
        const distToHoop = Math.hypot(currentClientX - rimCenterX, currentClientY - rimCenterY);

        // 1. Dropped directly over / near hoop:
        if (hasMovedSignificantly && distToHoop < Math.max(rimRect.width * 0.95, 56)) {
          animateDropIntoHoop(item, rimCenterX, rimCenterY);
          return;
        }

        // 2. Simple tap without drag -> jump-shot straight to the hoop!
        if (!hasMovedSignificantly) {
          animateJumpShotToHoop(item, rimCenterX, rimCenterY);
          return;
        }

        // 3. Flick / Throw release with velocity:
        let vx = 0;
        let vy = 0;
        if (item.pointerHistory.length >= 2) {
          const latest = item.pointerHistory[item.pointerHistory.length - 1];
          const oldest = item.pointerHistory[0];
          const dt = Math.max((latest.time - oldest.time) / 1000, 0.016);
          vx = (latest.x - oldest.x) / (dt * 60) * 1.05;
          vy = (latest.y - oldest.y) / (dt * 60) * 1.05;
        }

        const speed = Math.hypot(vx, vy);
        if (speed > 4.5) {
          animateFlight(item, currentClientX, currentClientY, vx, vy, rimCenterX, rimCenterY);
          return;
        }

        // 4. Otherwise: snap smoothly back to slot
        snapBackToSlot(item);
      }

      item.el.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);

      // Keyboard accessibility
      item.el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (item.state === 'IDLE') {
            const slotRect = item.slotEl.getBoundingClientRect();
            item.slotCenterX = slotRect.left + slotRect.width / 2;
            item.slotCenterY = slotRect.top + slotRect.height / 2;
            const rimRect = hoopRim.getBoundingClientRect();
            animateJumpShotToHoop(item, rimRect.left + rimRect.width / 2, rimRect.top + rimRect.height / 2);
          }
        }
      });
    });

    // Snap back to slot
    function snapBackToSlot(item) {
      item.state = 'RESPAWNING';
      item.el.style.transition = 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease';
      item.el.style.transform = 'translate3d(0, 0, 0) scale(1)';
      setTimeout(() => {
        item.el.style.transition = '';
        item.el.style.transform = '';
        item.state = 'IDLE';
      }, 360);
    }

    // Direct drop into hoop
    function animateDropIntoHoop(item, rimCenterX, rimCenterY) {
      item.state = 'SWISHED';
      const targetDx = rimCenterX - item.slotCenterX;
      const targetDy = rimCenterY - item.slotCenterY;

      // Trigger celebration on canvas
      const canvasRect = canvas.getBoundingClientRect();
      triggerHoopCelebration(rimCenterX - canvasRect.left, rimCenterY - canvasRect.top);

      // Sinks through net
      item.el.style.transition = 'transform 0.36s cubic-bezier(0.2, 0.8, 0.4, 1), opacity 0.36s ease-in';
      item.el.style.transform = `translate3d(${targetDx}px, ${targetDy + 38}px, 0) scale(0.85)`;
      item.el.style.opacity = '0';

      setTimeout(() => {
        item.el.style.transition = 'none';
        item.el.style.transform = 'translate3d(0, 0, 0) scale(0.5)';
        void item.el.offsetWidth;
        item.el.style.transition = 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease';
        item.el.style.opacity = '1';
        item.el.style.transform = 'translate3d(0, 0, 0) scale(1)';

        setTimeout(() => {
          item.el.style.transition = '';
          item.el.style.transform = '';
          item.state = 'IDLE';
        }, 360);
      }, 400);
    }

    // Jump-shot arc towards the hoop
    function animateJumpShotToHoop(item, rimCenterX, rimCenterY) {
      const slotRect = item.slotEl.getBoundingClientRect();
      item.slotCenterX = slotRect.left + slotRect.width / 2;
      item.slotCenterY = slotRect.top + slotRect.height / 2;

      item.state = 'FLYING';
      const startDx = 0;
      const startDy = 0;
      const targetDx = rimCenterX - item.slotCenterX;
      const targetDy = rimCenterY - item.slotCenterY;

      let t = 0;
      const totalFrames = 34;
      const apexDy = Math.min(targetDy, 0) - 75;

      function step() {
        t++;
        const p = t / totalFrames;
        if (p >= 1) {
          animateDropIntoHoop(item, rimCenterX, rimCenterY);
          return;
        }

        const curDx = startDx + (targetDx - startDx) * p;
        const curDy = (1 - p) * (1 - p) * startDy + 2 * (1 - p) * p * apexDy + p * p * targetDy;
        const rot = p * 12;

        item.el.style.transform = `translate3d(${curDx}px, ${curDy}px, 0) rotate(${rot}deg) scale(1.05)`;
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    // Projectile flight when flicked
    function animateFlight(item, startClientX, startClientY, vx, vy, rimCenterX, rimCenterY) {
      item.state = 'FLYING';
      let curDx = startClientX - item.slotCenterX;
      let curDy = startClientY - item.slotCenterY;
      let curVx = Math.min(Math.max(vx, -22), 22);
      let curVy = Math.min(Math.max(vy, -22), 22);
      let rot = 0;
      const vRot = (curVx > 0 ? 1 : -1) * 5;
      let frames = 0;

      function step() {
        frames++;
        curDx += curVx;
        curDy += curVy;
        curVy += 0.52;
        curVx *= 0.985;
        rot += vRot;

        const currentClientX = curDx + item.slotCenterX;
        const currentClientY = curDy + item.slotCenterY;
        const dist = Math.hypot(currentClientX - rimCenterX, currentClientY - rimCenterY);

        if (curVy > 0 && dist < 44) {
          animateDropIntoHoop(item, rimCenterX, rimCenterY);
          return;
        }

        if (curDy > 160 || currentClientX > window.innerWidth + 80 || frames > 65) {
          snapBackToSlot(item);
          return;
        }

        item.el.style.transform = `translate3d(${curDx}px, ${curDy}px, 0) rotate(${rot}deg) scale(1.04)`;
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    // Sparks animation loop on canvas
    function animate() {
      if (!isVisible) {
        animId = requestAnimationFrame(animate);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.26;
        p.vx *= 0.96;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          sparks.splice(i, 1);
        } else {
          ctx.save();
          ctx.globalAlpha = Math.max(p.alpha, 0);
          ctx.fillStyle = p.color;
          ctx.shadowColor = '#f3e9a8';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      animId = requestAnimationFrame(animate);
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        isVisible = entry.isIntersecting;
        if (isVisible && (width === 0 || height === 0)) {
          resizeCanvas();
        }
      });
    }, { threshold: 0.1 });
    observer.observe(bar);

    animId = requestAnimationFrame(animate);
  }

  // Floating Email Copy Popover for "Get In Touch" & Sidebar Mail Icon
  function initEmailCopyPopover() {
    const popover = document.getElementById('email-popover-card');
    const arrow = document.getElementById('email-popover-arrow');
    const chip = document.getElementById('email-popover-chip');
    const addr = document.getElementById('email-popover-addr');
    const copyBtn = document.getElementById('email-popover-copy-btn');
    const copyTxt = document.getElementById('email-popover-copy-txt');
    const closeBtn = document.getElementById('email-popover-close');
    const triggers = document.querySelectorAll('.email-popover-trigger');

    if (!popover || triggers.length === 0) return;

    let activeTrigger = null;
    let copyTimer = null;

    function openPopover(trigger) {
      activeTrigger = trigger;
      popover.style.display = 'block';
      void popover.offsetWidth; // Force layout reflow
      positionPopover(trigger);
      popover.classList.add('is-active');
      popover.setAttribute('aria-hidden', 'false');
    }

    function closePopover() {
      if (!activeTrigger) return;
      popover.classList.remove('is-active');
      popover.setAttribute('aria-hidden', 'true');
      activeTrigger = null;
      setTimeout(() => {
        if (!popover.classList.contains('is-active')) {
          popover.style.display = 'none';
        }
      }, 220);
    }

    function positionPopover(trigger) {
      const rect = trigger.getBoundingClientRect();
      const popRect = popover.getBoundingClientRect();
      const popW = popRect.width || 320;
      const popH = popRect.height || 135;
      const margin = 12;

      arrow.className = 'email-popover-arrow';

      let left = 0;
      let top = 0;

      // Sidebar mail icon check (left side)
      if (rect.left < 160) {
        left = rect.right + 12;
        top = rect.top + (rect.height - popH) / 2;
        arrow.classList.add('arrow-left');
        arrow.style.left = '-6px';
        arrow.style.right = 'auto';
        const arrowTopRel = Math.max(16, Math.min(popH - 24, rect.top - top + rect.height / 2 - 5));
        arrow.style.top = `${arrowTopRel}px`;
        arrow.style.bottom = 'auto';
      } else {
        const spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow >= popH + 16 || spaceBelow > rect.top) {
          // Below trigger
          top = rect.bottom + 10;
          left = rect.left + (rect.width - popW) / 2;
          arrow.classList.add('arrow-top');
          arrow.style.top = '-6px';
          arrow.style.bottom = 'auto';
          const arrowLeftRel = Math.max(20, Math.min(popW - 20, rect.left - left + rect.width / 2 - 5));
          arrow.style.left = `${arrowLeftRel}px`;
          arrow.style.right = 'auto';
        } else {
          // Above trigger
          top = rect.top - popH - 10;
          left = rect.left + (rect.width - popW) / 2;
          arrow.classList.add('arrow-bottom');
          arrow.style.bottom = '-6px';
          arrow.style.top = 'auto';
          const arrowLeftRel = Math.max(20, Math.min(popW - 20, rect.left - left + rect.width / 2 - 5));
          arrow.style.left = `${arrowLeftRel}px`;
          arrow.style.right = 'auto';
        }
      }

      // Clamp within viewport
      left = Math.max(margin, Math.min(window.innerWidth - popW - margin, left));
      top = Math.max(margin, Math.min(window.innerHeight - popH - margin, top));

      popover.style.left = `${Math.round(left)}px`;
      popover.style.top = `${Math.round(top)}px`;
    }

    triggers.forEach((trigger) => {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        if (activeTrigger === trigger) {
          closePopover();
        } else {
          openPopover(trigger);
        }
      });
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closePopover();
      });
    }

    function doCopy() {
      const emailText = (addr ? addr.textContent : 'banerjee.clg@gmail.com').trim();
      const notifyCopied = () => {
        if (chip) chip.classList.add('is-copied');
        if (copyTxt) copyTxt.textContent = 'Copied! ✓';
        clearTimeout(copyTimer);
        copyTimer = setTimeout(() => {
          if (chip) chip.classList.remove('is-copied');
          if (copyTxt) copyTxt.textContent = 'Copy';
        }, 2200);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(emailText).then(notifyCopied).catch(() => {
          fallbackCopy(emailText, notifyCopied);
        });
      } else {
        fallbackCopy(emailText, notifyCopied);
      }
    }

    function fallbackCopy(text, cb) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand('copy');
        cb();
      } catch (err) {}
      document.body.removeChild(ta);
    }

    if (chip) chip.addEventListener('click', doCopy);
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        doCopy();
      });
    }

    document.addEventListener('pointerdown', (e) => {
      if (!activeTrigger) return;
      if (popover.contains(e.target) || activeTrigger.contains(e.target)) return;
      closePopover();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && activeTrigger) {
        closePopover();
      }
    });

    window.addEventListener('resize', () => {
      if (activeTrigger) positionPopover(activeTrigger);
    });
    window.addEventListener('scroll', () => {
      if (activeTrigger) positionPopover(activeTrigger);
    }, { passive: true });
  }

  /* ==========================================================================
   * Advanced Inertial Smooth Scroll & Section Snap Engine (Lenis-Caliber Physics)
   * 
   * Features:
   * 1. Frame-rate independent exponential lerp smoothing (subpixel precision).
   * 2. Intelligent input normalization: differentiates notched mouse wheels from trackpads.
   * 3. Fluid momentum damping: consecutive wheel ticks compound smoothly with viscous decay.
   * 4. Single-gesture magnetic snapping across 100vh hero, about, and contact sections.
   * 5. Uninhibited, velvet-smooth scrolling inside the portfolio and notes sections.
   * 6. Quintic ease-out cinematic transitions between sections.
   * 7. Full synchronization with native scrollbar dragging, touch swipe, and keyboard nav.
   * ========================================================================== */
  function initSectionSnapController() {
    const heroOuter = document.getElementById('hero-outer');
    const projectsEl = document.getElementById('projects');
    const skillsMarquee = document.querySelector('.skills-marquee-outer');
    const aboutOuter = document.getElementById('about-outer') || document.getElementById('about');
    const contactEl = document.getElementById('contact');
    const studioNotesEl = document.getElementById('studio-notes');
    const videoModal = document.getElementById('video-modal');

    if (!heroOuter || !projectsEl || !aboutOuter || !contactEl || !studioNotesEl) return;

    // Check user preference for reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Core Scroll Physics State
    let currentY = window.pageYOffset || document.documentElement.scrollTop;
    let targetY = currentY;
    let isRafActive = false;
    let rafId = null;
    let lastTime = performance.now();

    // Section Snap State
    let isSnapping = false;
    let snapStartY = 0;
    let snapTargetY = 0;
    let snapStartTime = 0;
    let snapDuration = 420; // ms
    let snapCooldownUntil = 0;
    let mustWaitForWheelSilence = false;
    let wheelSilenceTimer = null;
    let lastInputIsTrackpad = false;

    // Bounds helper
    function getBounds(el) {
      const rect = el.getBoundingClientRect();
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;
      const top = rect.top + scrollY;
      const height = el.offsetHeight || rect.height;
      return { top, bottom: top + height, height };
    }

    // Anchor points calculator
    function getSnapAnchors() {
      const vh = window.innerHeight;
      const docH = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight
      );
      const maxScroll = Math.max(docH - vh, 0);

      // Hero top (0)
      const heroTop = 0;

      // Projects (docked at the skills marquee top)
      const projectsTarget = skillsMarquee ? getBounds(skillsMarquee).top : getBounds(projectsEl).top;
      const projectsEnd = Math.max(getBounds(projectsEl).bottom - vh, projectsTarget);

      // About
      const aboutTarget = getBounds(aboutOuter).top;
      const aboutEnd = Math.max(getBounds(aboutOuter).bottom - vh, aboutTarget);

      // Contact ("Let's Design" 100vh)
      const contactTarget = getBounds(contactEl).top;

      // Studio Notes
      const studioNotesTarget = getBounds(studioNotesEl).top;

      return {
        vh,
        docH,
        maxScroll,
        heroTop,
        projectsTarget,
        projectsEnd,
        aboutTarget,
        aboutEnd,
        contactTarget,
        studioNotesTarget
      };
    }

    // Programmatic Snap Transition with Quintic Deceleration
    function snapTo(destinationY, customDuration, callback) {
      const anchors = getSnapAnchors();
      const clampedY = Math.min(Math.max(destinationY, 0), anchors.maxScroll);

      if (prefersReducedMotion) {
        currentY = clampedY;
        targetY = clampedY;
        window.scrollTo(0, clampedY);
        isSnapping = false;
        if (callback) callback();
        return;
      }

      snapStartY = currentY;
      snapTargetY = clampedY;
      const diff = Math.abs(snapTargetY - snapStartY);

      if (diff < 2) {
        currentY = snapTargetY;
        targetY = snapTargetY;
        window.scrollTo(0, snapTargetY);
        isSnapping = false;
        if (callback) callback();
        return;
      }

      isSnapping = true;
      snapStartTime = performance.now();
      // Quintic duration: swift, energetic, responsive (340ms - 440ms)
      snapDuration = customDuration || Math.min(Math.max(diff * 0.22, 340), 440);
      snapCooldownUntil = snapStartTime + snapDuration + 140;
      mustWaitForWheelSilence = true;

      startRafLoop(callback);
    }

    // Main Physics RAF Loop
    function startRafLoop(onCompleteCallback) {
      if (isRafActive) return;
      isRafActive = true;
      lastTime = performance.now();

      function tick(now) {
        const dt = Math.min((now - lastTime) / 1000, 0.08); // delta time in seconds, clamped
        lastTime = now;

        if (isSnapping) {
          const elapsed = now - snapStartTime;
          const progress = Math.min(elapsed / snapDuration, 1);
          // Quintic ease-out: instantaneous launch, whisper-soft deceleration
          const ease = 1 - Math.pow(1 - progress, 5);
          currentY = snapStartY + (snapTargetY - snapStartY) * ease;
          targetY = currentY;

          window.scrollTo(0, currentY);

          if (progress >= 1) {
            currentY = snapTargetY;
            targetY = snapTargetY;
            window.scrollTo(0, currentY);
            isSnapping = false;
            isRafActive = false;
            if (onCompleteCallback) onCompleteCallback();
            return;
          }
        } else {
          // Exponential Inertial Smoothing (Frame-Rate Independent)
          // Trackpad: lambda = 18 (crisp, responsive 1:1 feel)
          // Mouse wheel: lambda = 10.5 (liquid, velvet Awwwards-style momentum)
          const lambda = lastInputIsTrackpad ? 18.0 : 10.5;
          const factor = 1 - Math.exp(-lambda * dt);
          currentY += (targetY - currentY) * factor;

          window.scrollTo(0, currentY);

          // Settle threshold: when within 0.15px of target, settle cleanly and pause RAF
          if (Math.abs(targetY - currentY) < 0.15) {
            currentY = targetY;
            window.scrollTo(0, currentY);
            isRafActive = false;
            return;
          }
        }

        rafId = requestAnimationFrame(tick);
      }

      rafId = requestAnimationFrame(tick);
    }

    // Sync state when page is scrolled externally (e.g. scrollbar drag or hash anchor)
    window.addEventListener('scroll', () => {
      if (!isRafActive && !isSnapping) {
        const sy = window.pageYOffset || document.documentElement.scrollTop;
        if (Math.abs(sy - currentY) > 2) {
          currentY = sy;
          targetY = sy;
        }
      }
    }, { passive: true });

    // Wheel input normalizer (differentiates discrete mouse notches vs precision trackpads)
    function normalizeWheel(e) {
      let dy = e.deltaY || 0;
      let dx = e.deltaX || 0;

      if (e.deltaMode === 1) { // LINES (e.g. Firefox)
        dy *= 36;
        dx *= 36;
      } else if (e.deltaMode === 2) { // PAGES
        dy *= window.innerHeight;
        dx *= window.innerWidth;
      }

      const isTrackpad = (Math.abs(dy) < 40 && !Number.isInteger(dy)) || Math.abs(dx) > 0;
      lastInputIsTrackpad = isTrackpad;

      // Multiplier: 1.0 for trackpads, 1.25 for mouse wheel to give fluid gliding travel
      const multiplier = isTrackpad ? 1.0 : 1.25;

      return {
        dy: dy * multiplier,
        isTrackpad
      };
    }

    // Wheel Event Listener
    window.addEventListener('wheel', (e) => {
      // Don't intercept if video modal is open
      if (videoModal && videoModal.classList.contains('open')) return;

      // Don't intercept if scrolling inside a scrollable container (e.g. modal text, textarea)
      let el = e.target;
      while (el && el !== document.body && el !== document.documentElement) {
        if (el.scrollHeight > el.clientHeight && (getComputedStyle(el).overflowY === 'auto' || getComputedStyle(el).overflowY === 'scroll')) {
          return;
        }
        el = el.parentElement;
      }

      // Suppress wheel input during active snap flight
      if (isSnapping) {
        e.preventDefault();
        return;
      }

      // Reset wheel silence timer
      clearTimeout(wheelSilenceTimer);
      wheelSilenceTimer = setTimeout(() => {
        mustWaitForWheelSilence = false;
      }, 90);

      const norm = normalizeWheel(e);
      if (Math.abs(norm.dy) < 2) return;

      const direction = norm.dy > 0 ? 1 : -1;
      const now = performance.now();
      const anchors = getSnapAnchors();

      // Guard snap triggering if in cooldown or silence wait
      const canTriggerSnap = (now >= snapCooldownUntil && !mustWaitForWheelSilence);

      if (direction > 0) {
        // SCROLLING DOWN
        // 1. From Hero -> Snap directly to Projects
        if (targetY <= anchors.projectsTarget - 60) {
          if (canTriggerSnap) {
            e.preventDefault();
            snapTo(anchors.projectsTarget);
          } else {
            e.preventDefault();
          }
          return;
        }

        // 2. In Projects: free inertial scroll; near bottom -> Snap to About
        if (targetY >= anchors.projectsTarget - 40 && targetY < anchors.aboutTarget - 60) {
          if (targetY >= anchors.projectsEnd - 70) {
            if (canTriggerSnap) {
              e.preventDefault();
              snapTo(anchors.aboutTarget);
            } else {
              e.preventDefault();
            }
            return;
          }

          // Inside Projects: Fluid Inertial Scroll!
          e.preventDefault();
          targetY = Math.min(Math.max(targetY + norm.dy, anchors.projectsTarget), anchors.projectsEnd);
          startRafLoop();
          return;
        }

        // 3. In About (100vh): Snap to Contact ("Let's Design")
        if (targetY >= anchors.aboutTarget - 60 && targetY < anchors.contactTarget - 60) {
          if (canTriggerSnap) {
            e.preventDefault();
            snapTo(anchors.contactTarget);
          } else {
            e.preventDefault();
          }
          return;
        }

        // 4. In Contact ("Let's Design" 100vh): Snap to Studio Notes
        if (targetY >= anchors.contactTarget - 60 && targetY < anchors.studioNotesTarget - 60) {
          if (canTriggerSnap) {
            e.preventDefault();
            snapTo(anchors.studioNotesTarget);
          } else {
            e.preventDefault();
          }
          return;
        }

        // 5. In Studio Notes: Fluid Inertial Scroll!
        if (targetY >= anchors.studioNotesTarget - 60) {
          e.preventDefault();
          targetY = Math.min(Math.max(targetY + norm.dy, anchors.studioNotesTarget), anchors.maxScroll);
          startRafLoop();
          return;
        }
      } else if (direction < 0) {
        // SCROLLING UP
        // 1. In Studio Notes: near top -> Snap to Contact ("Let's Design")
        if (targetY >= anchors.studioNotesTarget - 60) {
          if (targetY <= anchors.studioNotesTarget + 80) {
            if (canTriggerSnap) {
              e.preventDefault();
              snapTo(anchors.contactTarget);
            } else {
              e.preventDefault();
            }
            return;
          }

          // Inside Studio Notes: Fluid Inertial Scroll Up!
          e.preventDefault();
          targetY = Math.min(Math.max(targetY + norm.dy, anchors.studioNotesTarget), anchors.maxScroll);
          startRafLoop();
          return;
        }

        // 2. Zone between Contact and Studio Notes (if scrolling up, snap to Contact)
        if (targetY > anchors.contactTarget + 40 && targetY < anchors.studioNotesTarget) {
          if (canTriggerSnap) {
            e.preventDefault();
            snapTo(anchors.contactTarget);
          } else {
            e.preventDefault();
          }
          return;
        }

        // 3. Parked at Contact ("Let's Design" 100vh): Snap to bottom of About
        if (Math.abs(targetY - anchors.contactTarget) <= 80) {
          if (canTriggerSnap) {
            e.preventDefault();
            snapTo(anchors.aboutEnd);
          } else {
            e.preventDefault();
          }
          return;
        }

        // 4. In About: near top -> Snap to bottom of Projects
        if (targetY >= anchors.aboutTarget - 60 && targetY <= anchors.aboutEnd + 60) {
          if (targetY <= anchors.aboutTarget + 80) {
            if (canTriggerSnap) {
              e.preventDefault();
              snapTo(anchors.projectsEnd);
            } else {
              e.preventDefault();
            }
            return;
          }

          // Inside About: free scroll
          e.preventDefault();
          targetY = Math.min(Math.max(targetY + norm.dy, anchors.aboutTarget), anchors.aboutEnd);
          startRafLoop();
          return;
        }

        // 5. In Projects: near top -> Snap to Hero
        if (targetY >= anchors.projectsTarget - 60 && targetY <= anchors.projectsEnd + 60) {
          if (targetY <= anchors.projectsTarget + 80) {
            if (canTriggerSnap) {
              e.preventDefault();
              snapTo(anchors.heroTop);
            } else {
              e.preventDefault();
            }
            return;
          }

          // Inside Projects: Fluid Inertial Scroll Up!
          e.preventDefault();
          targetY = Math.min(Math.max(targetY + norm.dy, anchors.projectsTarget), anchors.projectsEnd);
          startRafLoop();
          return;
        }
      }
    }, { passive: false });

    // Touch Support for Mobile / Tablets (Native touch momentum with clean snap at boundaries)
    let touchStartY = 0;
    let touchStartX = 0;
    let isTouchActive = false;

    window.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches.length === 1) {
        touchStartY = e.touches[0].clientY;
        touchStartX = e.touches[0].clientX;
        isTouchActive = true;
        currentY = window.pageYOffset || document.documentElement.scrollTop;
        targetY = currentY;
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (isSnapping) {
        e.preventDefault();
        return;
      }
      if (!isTouchActive || !e.touches || e.touches.length !== 1) return;

      const currentTouchY = e.touches[0].clientY;
      const currentTouchX = e.touches[0].clientX;
      const diffY = touchStartY - currentTouchY; // positive = swipe up = scroll down
      const diffX = touchStartX - currentTouchX;

      if (Math.abs(diffY) < Math.abs(diffX) * 1.3 || Math.abs(diffY) < 32) return;

      const direction = diffY > 0 ? 1 : -1;
      const anchors = getSnapAnchors();
      const sy = window.pageYOffset || document.documentElement.scrollTop;

      if (direction > 0) {
        if (sy <= anchors.projectsTarget - 60) {
          e.preventDefault();
          isTouchActive = false;
          snapTo(anchors.projectsTarget);
        } else if (sy >= anchors.projectsEnd - 70 && sy < anchors.aboutTarget - 60) {
          e.preventDefault();
          isTouchActive = false;
          snapTo(anchors.aboutTarget);
        } else if (sy >= anchors.aboutTarget - 60 && sy < anchors.contactTarget - 60) {
          e.preventDefault();
          isTouchActive = false;
          snapTo(anchors.contactTarget);
        } else if (sy >= anchors.contactTarget - 60 && sy < anchors.studioNotesTarget - 60) {
          e.preventDefault();
          isTouchActive = false;
          snapTo(anchors.studioNotesTarget);
        }
      } else if (direction < 0) {
        if (sy >= anchors.studioNotesTarget - 60 && sy <= anchors.studioNotesTarget + 100) {
          e.preventDefault();
          isTouchActive = false;
          snapTo(anchors.contactTarget);
        } else if (Math.abs(sy - anchors.contactTarget) <= 80) {
          e.preventDefault();
          isTouchActive = false;
          snapTo(anchors.aboutEnd);
        } else if (sy >= anchors.aboutTarget - 60 && sy <= anchors.aboutTarget + 80) {
          e.preventDefault();
          isTouchActive = false;
          snapTo(anchors.projectsEnd);
        } else if (sy >= anchors.projectsTarget - 60 && sy <= anchors.projectsTarget + 80) {
          e.preventDefault();
          isTouchActive = false;
          snapTo(anchors.heroTop);
        }
      }
    }, { passive: false });

    window.addEventListener('touchend', () => {
      isTouchActive = false;
    }, { passive: true });

    // Keyboard Navigation with Smooth Momentum
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
        return;
      }

      const isDown = (e.code === 'ArrowDown' || e.code === 'PageDown' || (e.code === 'Space' && !e.shiftKey));
      const isUp = (e.code === 'ArrowUp' || e.code === 'PageUp' || (e.code === 'Space' && e.shiftKey));

      if (!isDown && !isUp) return;
      if (isSnapping) {
        e.preventDefault();
        return;
      }

      const stepSize = (e.code === 'PageDown' || e.code === 'PageUp' || e.code === 'Space') ? window.innerHeight * 0.8 : 140;
      const direction = isDown ? 1 : -1;
      const anchors = getSnapAnchors();

      if (direction > 0) {
        if (targetY <= anchors.projectsTarget - 60) {
          e.preventDefault();
          snapTo(anchors.projectsTarget);
        } else if (targetY >= anchors.projectsTarget - 40 && targetY < anchors.aboutTarget - 60) {
          if (targetY >= anchors.projectsEnd - 70) {
            e.preventDefault();
            snapTo(anchors.aboutTarget);
          } else {
            e.preventDefault();
            targetY = Math.min(targetY + stepSize, anchors.projectsEnd);
            startRafLoop();
          }
        } else if (targetY >= anchors.aboutTarget - 60 && targetY < anchors.contactTarget - 60) {
          e.preventDefault();
          snapTo(anchors.contactTarget);
        } else if (targetY >= anchors.contactTarget - 60 && targetY < anchors.studioNotesTarget - 60) {
          e.preventDefault();
          snapTo(anchors.studioNotesTarget);
        } else if (targetY >= anchors.studioNotesTarget - 60) {
          e.preventDefault();
          targetY = Math.min(targetY + stepSize, anchors.maxScroll);
          startRafLoop();
        }
      } else if (direction < 0) {
        if (targetY >= anchors.studioNotesTarget - 60) {
          if (targetY <= anchors.studioNotesTarget + 80) {
            e.preventDefault();
            snapTo(anchors.contactTarget);
          } else {
            e.preventDefault();
            targetY = Math.max(targetY - stepSize, anchors.studioNotesTarget);
            startRafLoop();
          }
        } else if (Math.abs(targetY - anchors.contactTarget) <= 80) {
          e.preventDefault();
          snapTo(anchors.aboutEnd);
        } else if (targetY >= anchors.aboutTarget - 60 && targetY <= anchors.aboutTarget + 80) {
          e.preventDefault();
          snapTo(anchors.projectsEnd);
        } else if (targetY >= anchors.projectsTarget - 60 && targetY <= anchors.projectsTarget + 80) {
          e.preventDefault();
          snapTo(anchors.heroTop);
        } else if (targetY > anchors.projectsTarget && targetY <= anchors.projectsEnd) {
          e.preventDefault();
          targetY = Math.max(targetY - stepSize, anchors.projectsTarget);
          startRafLoop();
        }
      }
    });

    // Anchor Link Smooth Navigation (Sidebar nav, scroll cues, buttons)
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      const href = a.getAttribute('href');
      if (!href || href === '#' || a.classList.contains('email-popover-trigger')) return;

      const targetEl = document.querySelector(href);
      if (!targetEl) return;

      a.addEventListener('click', (e) => {
        e.preventDefault();
        const anchors = getSnapAnchors();
        let destY = 0;
        if (href === '#top') {
          destY = 0;
        } else if (href === '#projects') {
          destY = anchors.projectsTarget;
        } else if (href === '#about') {
          destY = anchors.aboutTarget;
        } else if (href === '#contact') {
          destY = anchors.contactTarget;
        } else if (href === '#studio-notes') {
          destY = anchors.studioNotesTarget;
        } else {
          destY = getBounds(targetEl).top;
        }
        snapTo(destY, 440);
      });
    });

    // Expose programmatic snapTo globally on window for other components if needed
    window.__portfolioSnapTo = snapTo;
  }

  // Splash / Welcome Intro Screen Controller (Loads main site in background)
  function initSplashIntro() {
    const splash = document.getElementById('splash-overlay');
    const enterBtn = document.getElementById('splash-enter-btn');
    const stage = document.getElementById('splash-stage');
    const mainPlane = document.getElementById('splash-main-plane');
    const canvas = document.getElementById('splash-trail-canvas');

    if (!splash || !enterBtn) return;

    // Lock page scroll while splash screen is active
    document.body.classList.add('splash-active');

    // --------------------------------------------------------------------------
    // Dynamic Magical Trimpath & Stardust Contrail Engine
    // --------------------------------------------------------------------------
    let isSplashActive = true;
    let trailRafId = null;

    if (canvas && stage && mainPlane) {
      const ctx = canvas.getContext('2d');
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      
      // Match canvas internal resolution to DPR for razor-sharp rendering
      canvas.width = 320 * dpr;
      canvas.height = 220 * dpr;
      ctx.scale(dpr, dpr);

      const trailHistory = [];
      const sparkles = [];
      let lastSparkleTime = 0;

      function spawnSparkle(x, y, count = 1, extraSpeed = 1) {
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = (0.2 + Math.random() * 0.7) * extraSpeed;
          sparkles.push({
            x: x + (Math.random() - 0.5) * 6,
            y: y + (Math.random() - 0.5) * 6,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 0.15, // slight upward float
            size: 0.8 + Math.random() * 1.5,
            life: 1.0,
            maxLife: 0.6 + Math.random() * 0.55,
            color: Math.random() > 0.28 ? '#f3e9a8' : '#ffffff',
            flickerSeed: Math.random() * 10
          });
        }
      }

      function updateTrailLoop(now) {
        if (!isSplashActive) return;

        // Query real-time position of the paper airplane in stage coordinates
        const planeRect = mainPlane.getBoundingClientRect();
        const stageRect = stage.getBoundingClientRect();

        if (stageRect.width > 0 && stageRect.height > 0) {
          const scaleX = 320 / stageRect.width;
          const scaleY = 220 / stageRect.height;
          const planeCenterX = (planeRect.left - stageRect.left + planeRect.width / 2) * scaleX;
          const planeCenterY = (planeRect.top - stageRect.top + planeRect.height / 2) * scaleY;

          // Push new point into trail history
          trailHistory.push({
            x: planeCenterX,
            y: planeCenterY,
            time: now
          });

          // Spawn magical stardust sparkles from the plane's tail
          if (now - lastSparkleTime > 45) { // ~22 sparkles per second
            spawnSparkle(planeCenterX, planeCenterY, 1, 1);
            lastSparkleTime = now;
          }
        }

        // Trim Path: retain points within the last 850ms (creates dynamic trailing contrail ribbon)
        const cutoffTime = now - 850;
        while (trailHistory.length > 0 && trailHistory[0].time < cutoffTime) {
          trailHistory.shift();
        }

        // Render Canvas Frame
        ctx.clearRect(0, 0, 320, 220);

        // 1. Draw Trimpath Ribbon (starts wide & glowing at plane, tapers to razor-thin tail)
        const trailLen = trailHistory.length;
        if (trailLen > 2) {
          for (let i = 1; i < trailLen; i++) {
            const p0 = trailHistory[i - 1];
            const p1 = trailHistory[i];
            const progress = i / (trailLen - 1); // 0 at tail end, 1 at airplane

            // Cubic easing for taper: starts soft, narrows quickly at tail
            const taper = Math.pow(progress, 1.4);
            const lineWidth = 0.4 + taper * 2.4;
            const alpha = taper * 0.85;

            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.lineWidth = lineWidth;
            ctx.strokeStyle = `rgba(243, 233, 168, ${alpha})`;
            ctx.lineCap = 'round';
            ctx.shadowColor = 'rgba(243, 233, 168, 0.7)';
            ctx.shadowBlur = taper * 6;
            ctx.stroke();
          }
        }

        // 2. Draw Magical Flickering Stardust Sparkles
        for (let i = sparkles.length - 1; i >= 0; i--) {
          const s = sparkles[i];
          s.x += s.vx;
          s.y += s.vy;
          s.life -= 0.018;

          if (s.life <= 0) {
            sparkles.splice(i, 1);
            continue;
          }

          const lifeRatio = Math.max(0, s.life / s.maxLife);
          // High-frequency twinkle flicker
          const flicker = 0.65 + Math.sin(s.flickerSeed + now * 0.02) * 0.35;
          const currentAlpha = Math.min(1, Math.max(0, lifeRatio * flicker * 0.95));
          const currentRadius = s.size * lifeRatio;

          ctx.save();
          ctx.beginPath();
          ctx.arc(s.x, s.y, currentRadius, 0, Math.PI * 2);
          ctx.fillStyle = s.color === '#f3e9a8'
            ? `rgba(243, 233, 168, ${currentAlpha})`
            : `rgba(255, 255, 255, ${currentAlpha})`;
          ctx.shadowColor = 'rgba(243, 233, 168, 0.9)';
          ctx.shadowBlur = 4;
          ctx.fill();
          ctx.restore();
        }

        trailRafId = requestAnimationFrame(updateTrailLoop);
      }

      trailRafId = requestAnimationFrame(updateTrailLoop);
    }

    function dismissSplash() {
      if (splash.classList.contains('exit')) return;

      // Afterburner blastoff animation for the paper airplane
      if (mainPlane) {
        mainPlane.classList.add('blastoff');
      }

      // Smooth curtain lift / fade
      splash.classList.add('exit');
      document.body.classList.remove('splash-active');

      setTimeout(() => {
        isSplashActive = false;
        if (trailRafId) cancelAnimationFrame(trailRafId);
        splash.style.display = 'none';
      }, 820);
    }

    enterBtn.addEventListener('click', (e) => {
      e.preventDefault();
      dismissSplash();
    });

    if (stage) {
      stage.addEventListener('click', (e) => {
        e.preventDefault();
        dismissSplash();
      });
    }

    // Allow Enter or Space keyboard shortcut
    window.addEventListener('keydown', (e) => {
      if (!splash.classList.contains('exit')) {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          dismissSplash();
        }
      }
    });
  }

  // Initialize once DOM is ready
  function initAll() {
    initSplashIntro();
    initInteractiveGrid('hero-bg-canvas', 'hero-outer');
    initInteractiveGrid('about-bg-canvas', 'about-outer');
    initClock();
    initNavSlider();
    initScrollRail();
    initVideoPreviewsAndModal();
    initInteractiveNoteDesk();
    initPaperAirplanes();
    initEmailCopyPill();
    initEmailCopyPopover();
    initToolsHoopArcade();
    initSectionSnapController();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
