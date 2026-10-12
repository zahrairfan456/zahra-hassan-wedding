// ---------------------------------------------------------------
// Envelope reveal flow
// 1. Video1 starts paused. Tap ANYWHERE on the screen to play it.
// 2. Shortly before video1 ends, it fades out smoothly, revealing
//    page 2 underneath (which starts video2, looping, full-screen).
// 3. Page 2 is a normal scrollable page. The invitation image
//    fades + rises into place as you scroll to it.
// No navigation happens -- everything stays on this one document.
// ---------------------------------------------------------------
// UNCHANGED from previous version.

document.addEventListener('DOMContentLoaded', () => {
  // Prevent the browser from restoring a previous scroll position
  // (e.g. on refresh) -- always start at the very top.
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  window.scrollTo(0, 0);

  const body = document.body;
  const envelopeScreen = document.getElementById('envelopeScreen');
  const envelopeVideo = document.getElementById('envelopeVideo');
  const secondVideo = document.getElementById('secondVideo');
  const bgMusic = document.getElementById('bgMusic');

  const TRANSITION_LEAD_TIME = 0.6; // seconds before video1 ends to start fading

  let transitionStarted = false;

  // Lock scrolling while the envelope screen is showing
  body.classList.add('lock-scroll');

  // --- Tap anywhere on the envelope screen to play ---
  envelopeScreen.addEventListener('click', () => {
    envelopeVideo.play();

    // Start the background music on the same tap. Phones only allow
    // sound after a tap, so this has to happen inside the click.
    // The <audio> tag has "loop", so it keeps playing while the
    // invitation is open.
    if (bgMusic) {
      bgMusic.play().catch(() => { /* file missing or blocked: stay silent */ });
    }
  }, { once: true });

  // --- Watch playback progress, start the fade just before it ends ---
  envelopeVideo.addEventListener('timeupdate', () => {
    const { duration, currentTime } = envelopeVideo;
    if (!duration || Number.isNaN(duration)) return;

    const remaining = duration - currentTime;
    if (!transitionStarted && remaining <= TRANSITION_LEAD_TIME) {
      transitionStarted = true;
      goToPageTwo();
    }
  });

  // Fallback in case 'ended' fires before timeupdate catches the threshold
  envelopeVideo.addEventListener('ended', () => {
    if (!transitionStarted) {
      transitionStarted = true;
      goToPageTwo();
    }
  });

  function goToPageTwo() {
    envelopeScreen.classList.add('dismissed');

    envelopeScreen.addEventListener('transitionend', () => {
      body.classList.remove('lock-scroll');
      envelopeScreen.style.display = 'none';
      envelopeVideo.pause();
      // guarantee page 2 always opens at the very top
      window.scrollTo(0, 0);
    }, { once: true });

    // start video2 right away so it's already playing as the fade reveals it
    secondVideo.currentTime = 0;
    const playPromise = secondVideo.play();
    if (playPromise) playPromise.catch(() => { /* muted + playsinline should allow autoplay on mobile */ });
  }

  // --- Scroll-reveal for the invitation image ---
  const revealEls = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          if (entry.target.tagName === 'VIDEO') {
            entry.target.play().catch(() => {});
          }
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

    revealEls.forEach((el) => observer.observe(el));
  } else {
    revealEls.forEach((el) => {
      el.classList.add('is-visible');
      if (el.tagName === 'VIDEO') el.play().catch(() => {});
    });
  }

  // --- Schedule timeline: flower glides down the line with scroll ---
  const timelineSection = document.getElementById('timeline');
  const flower = document.getElementById('timelineFlower');
  const timelineLine = document.querySelector('.timeline-line');
  const eventEls = Array.from(document.querySelectorAll('.timeline-event'));
  const dotEls = Array.from(document.querySelectorAll('.timeline-dot'));

  if (timelineSection && flower && eventEls.length && dotEls.length) {
    let markerPositions = [];
    let markerX = 0;

    function measureMarkers() {
      const trackRect = document.querySelector('.timeline-track').getBoundingClientRect();
      markerPositions = dotEls.map((el) => {
        const r = el.getBoundingClientRect();
        return (r.top + r.height / 2) - trackRect.top;
      });

      const firstDotRect = dotEls[0].getBoundingClientRect();
      markerX = (firstDotRect.left + firstDotRect.width / 2) - trackRect.left;
      flower.style.left = markerX + 'px';

      if (timelineLine && markerPositions.length > 1) {
        const first = markerPositions[0];
        const last = markerPositions[markerPositions.length - 1];
        timelineLine.style.left = markerX + 'px';
        timelineLine.style.top = first + 'px';
        timelineLine.style.height = (last - first) + 'px';
      }
    }

    const timelineStickyEl = document.querySelector('.timeline-sticky');

    function updateTimeline() {
      const rect = timelineSection.getBoundingClientRect();
      // The pin duration is the OUTER section's height minus the
      // pinned box's own height -- not the full viewport height.
      // This stays correct no matter how tall .timeline-sticky is set to.
      const scrollableDistance = rect.height - timelineStickyEl.offsetHeight;
      let progress = scrollableDistance > 0 ? (-rect.top) / (scrollableDistance * 0.85) : 0;
      progress = Math.min(1, Math.max(0, progress));

      const segments = markerPositions.length - 1;
      const scaled = progress * segments;
      let segmentIndex = Math.floor(scaled);
      if (segmentIndex >= segments) segmentIndex = segments - 1;
      if (segmentIndex < 0) segmentIndex = 0;
      const segmentProgress = scaled - segmentIndex;

      const y = markerPositions[segmentIndex] +
        (markerPositions[segmentIndex + 1] - markerPositions[segmentIndex]) * segmentProgress;

      flower.style.top = y + 'px';

      const activeIndex = Math.round(scaled);
      eventEls.forEach((el, i) => {
        el.classList.toggle('active', i === activeIndex);
      });
    }

    window.addEventListener('load', () => {
      measureMarkers();
      updateTimeline();
    });
    if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    measureMarkers();
    updateTimeline();
  });
}
    window.addEventListener('resize', () => {
      measureMarkers();
      updateTimeline();
    });
    window.addEventListener('scroll', updateTimeline, { passive: true });

    measureMarkers();
    updateTimeline();
  }
});