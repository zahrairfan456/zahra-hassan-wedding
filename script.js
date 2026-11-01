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

  // --- Envelope picture -> video: crossfade instead of a hard swap ---
  // The still picture sits on top of the video. Once the video is really
  // showing frames, the picture fades out slowly (see .envelope-poster in
  // the CSS), so there is no sudden blink when the video starts.
  const envelopePoster = document.getElementById('envelopePoster');
  let posterHidden = false;

  function hidePoster() {
    if (posterHidden) return;
    posterHidden = true;
    if (envelopePoster) envelopePoster.classList.add('is-hidden');
  }

  if (envelopeVideo.requestVideoFrameCallback) {
    // fires when the video has actually put a picture on screen
    envelopeVideo.requestVideoFrameCallback(hidePoster);
  }
  // fallback for phones that don't support the line above
  envelopeVideo.addEventListener('timeupdate', () => {
    if (envelopeVideo.currentTime > 0.05) hidePoster();
  });

  // Lock scrolling while the envelope screen is showing
  body.classList.add('lock-scroll');

  // --- Tap anywhere on the envelope screen to play ---
  // Phones don't download a video until you tap, so on a slow connection
  // the first tap can take a moment. This guard ignores extra taps while
  // it is already starting, but lets you tap again if the phone refused.
  let envelopeStarted = false;

  function startEnvelope() {
    if (envelopeStarted) return;
    envelopeStarted = true;

    const playPromise = envelopeVideo.play();
    if (playPromise && playPromise.catch) {
      // if the phone refused to start the video, allow another tap to retry
      playPromise.catch(() => { envelopeStarted = false; });
    }

    // Warm up the second video while the envelope is playing, so its first
    // picture is already on screen when the fade reveals it (no dark blink).
    primeSecondVideo();

    // Start the background music on the same tap. Phones only allow
    // sound after a tap, so this has to happen inside the click.
    // The <audio> tag has "loop", so it keeps playing while the
    // invitation is open.
    if (bgMusic) {
      bgMusic.play().catch(() => { /* file missing or blocked: stay silent */ });
    }
  }

  envelopeScreen.addEventListener('click', startEnvelope);

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

  // Loads video2 and holds it on its first frame, hidden behind the envelope.
  let secondPrimed = false;
  function primeSecondVideo() {
    if (secondPrimed) return;
    secondPrimed = true;
    const p = secondVideo.play();
    if (p && p.then) {
      p.then(() => {
        // if page 2 is already being revealed, leave it playing
        if (!transitionStarted) {
          secondVideo.pause();
          secondVideo.currentTime = 0;
        }
      }).catch(() => { /* if the phone refuses, it just starts at the fade instead */ });
    }
  }

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
    if (secondVideo.currentTime > 0.05) secondVideo.currentTime = 0;
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
    }, { threshold: 0, rootMargin: '0px 0px 35% 0px' });

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