// utama.js — gabungan: intro popup (wlcm->logo) + custom cursor + BGM + guide (muncul setelah intro)
(function () {
  // ---------- Config ----------
  const SHOW_DURATION = 500;    // anim masuk (ms)
  const DISPLAY_TIME = 2500;    // tampil wlcm sebelum berganti ke logo (ms)
  const SWAP_FADE = 400;        // fade saat swap (ms)
  const AFTER_LOGO_HIDE = 2200; // waktu sebelum overlay disembunyikan setelah logo muncul (ms)

  // ---------- DOM refs ----------
  const overlay = document.getElementById('intro-overlay');
  const introImg = document.getElementById('intro-img');
  const cursorEl = document.getElementById('customCursor');
  const bgm = document.getElementById('bgm');
  const guideEl = document.getElementById('guide');        // container guide (should exist, initially display:none)
  const guideTextEl = document.getElementById('guide-text');

  // safety checks
  if (!overlay || !introImg) {
    console.warn('utama.js: intro-overlay atau intro-img tidak ditemukan — intro popup dinonaktifkan.');
  }

  // ---------- Intro popup (wlcm -> logo) ----------
  function showIntro() {
    if (!overlay || !introImg) return;
    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');

    // small pop animation (we rely on CSS .popped)
    setTimeout(() => introImg.classList.add('popped'), SHOW_DURATION);

    // schedule swap to logo (with fade)
    setTimeout(() => {
      if (!introImg) return;
      introImg.classList.add('fading-out');

      setTimeout(() => {
        introImg.classList.remove('fading-out');
        introImg.classList.add('hidden');

        // change source to logo
        introImg.src = 'logo.png';
        void introImg.offsetWidth; // force reflow
        introImg.classList.remove('hidden');
        introImg.classList.add('popped');
        introImg.classList.add('logo-large');

        // after some time, hide overlay and show guide
        setTimeout(() => {
          hideOverlay();
          // show guide shortly after overlay hides so timing looks smooth
          setTimeout(showGuideAfterIntro, 160); // small delay to let overlay fade
        }, AFTER_LOGO_HIDE);
      }, SWAP_FADE);
    }, DISPLAY_TIME);
  }

  function hideOverlay() {
    if (!overlay || !introImg) return;
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');

    // reset intro classes so it can be reused if page reloads/plays again
    introImg.classList.remove('popped', 'fading-out', 'hidden', 'logo-large');
  }

  if (overlay) overlay.addEventListener('click', hideOverlay);

  // start intro when DOM siap
  document.addEventListener('DOMContentLoaded', () => {
    // tiny delay so layout first paints
    setTimeout(showIntro, 120);
  });

  // ---------- Custom cursor + dblclick swap ----------
  (function cursorSetup() {
    if (!cursorEl) return;
    const imgEl = cursorEl.querySelector('img');
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (isTouch) {
      cursorEl.style.display = 'none';
      document.documentElement.classList.remove('custom-cursor-active');
      return;
    }

    document.documentElement.classList.add('custom-cursor-active');

    let shown = false;
    function moveCursor(e) {
      cursorEl.style.left = (e.clientX) + 'px';
      cursorEl.style.top = (e.clientY) + 'px';
    }

    function showCursorOnce(e) {
      if (!shown) {
        cursorEl.style.opacity = '1';
        shown = true;
        window.removeEventListener('mousemove', showCursorOnce);
      }
      moveCursor(e);
    }

    window.addEventListener('mousemove', showCursorOnce, { passive: true });
    window.addEventListener('mousemove', moveCursor, { passive: true });

    window.addEventListener('mousedown', () => cursorEl.classList.add('click'));
    window.addEventListener('mouseup', () => cursorEl.classList.remove('click'));

    const normalCursor = 'krusor1.png';
    const doubleCursor = 'krusor2.png';
    let revertTimeout = null;

    window.addEventListener('dblclick', () => {
      if (!imgEl) return;
      imgEl.src = doubleCursor;
      clearTimeout(revertTimeout);
      revertTimeout = setTimeout(() => {
        imgEl.src = normalCursor;
      }, 800);
    });

    window.addEventListener('mouseout', (ev) => {
      // jika meninggalkan window
      if (!ev.relatedTarget) cursorEl.style.opacity = '0';
    });
    window.addEventListener('mouseover', () => {
      if (shown) cursorEl.style.opacity = '1';
    });
  })();

  // ---------- Background music (BGM) autoplay after first interaction ----------
  (function bgmSetup() {
    if (!bgm) return;
    bgm.volume = 0.0;
    bgm.loop = true;
    bgm.preload = 'auto';

    let started = false;
    let rampInterval = null;

    function rampVolumeTo(target = 0.6, duration = 800) {
      if (rampInterval) clearInterval(rampInterval);
      const steps = 20;
      const stepTime = Math.max(20, Math.floor(duration / steps));
      const start = bgm.volume;
      const delta = target - start;
      let currentStep = 0;
      rampInterval = setInterval(() => {
        currentStep++;
        const ratio = currentStep / steps;
        bgm.volume = Math.min(1, Math.max(0, start + delta * ratio));
        if (currentStep >= steps) {
          clearInterval(rampInterval);
          rampInterval = null;
        }
      }, stepTime);
    }

    function tryPlay() {
      if (started) return;
      const p = bgm.play();
      if (p !== undefined) {
        p.then(() => {
          started = true;
          rampVolumeTo(0.5, 700);
        }).catch(() => {
          // play gagal (harus ada gesture), tunggu event berikutnya
        });
      } else {
        started = true;
        rampVolumeTo(0.5, 700);
      }
      window.removeEventListener('click', tryPlay);
      window.removeEventListener('dblclick', tryPlay);
      window.removeEventListener('mousemove', tryPlay);
      window.removeEventListener('keydown', tryPlay);
    }

    window.addEventListener('click', tryPlay, { passive: true });
    window.addEventListener('dblclick', tryPlay, { passive: true });
    window.addEventListener('mousemove', tryPlay, { passive: true });
    window.addEventListener('keydown', tryPlay, { passive: true });

    // optional fallback (uncomment if you want auto start after X ms)
    // setTimeout(tryPlay, 1500);
  })();

  // ---------- Guide character (muncul dan mulai ngetik setelah intro selesai) ----------
  function showGuideAfterIntro() {
    if (!guideEl || !guideTextEl) return;
    // make guide visible
    guideEl.style.display = 'flex';
    guideEl.style.opacity = '0';
    guideEl.style.transition = 'opacity 0.6s ease, transform 400ms ease';
    // slight upward pop
    guideEl.style.transform = 'translateY(20px)';
    // small delay then show
    setTimeout(() => {
      guideEl.style.opacity = '1';
      guideEl.style.transform = 'translateY(0)';
      // start typing after it's in place
      setTimeout(() => startGuideDialog(guideTextEl), 250);
    }, 150);
  }

  function startGuideDialog(targetEl) {
  if (!targetEl) return;

  const messages = [
    `Hai~ Selamat datang di halaman utama <img src="dp2.png" class="inline-icon" alt="🌸">`,
    `Aku akan bantu kamu menjelajahi halaman ini! <img src="dp1.png" class="inline-icon" alt="✨">`,
    `Coba gerakkan kursor dan dengarkan musiknya~ <img src="dp3.png" class="inline-icon" alt="🎶">`
  ];

  let msgIndex = 0;
  let tokenIndex = 0;
  let tokens = [];         // token saat ini yang akan diketik
  let typingTimer = null;

  // helper: pecah pesan jadi token (tag utuh atau 1 karakter teks)
  function tokenizeHTML(html) {
    // regex: match tag <...> sebagai satu token, atau satu karakter non-< sebagai token
    // hasil: array seperti ["H","e","l","l","o","<img ...>","W","o"...]
    return html.match(/(<[^>]+>|[^<])/g) || [];
  }

  function startTypingMessage() {
    if (msgIndex >= messages.length) return;
    const raw = messages[msgIndex];
    tokens = tokenizeHTML(raw);
    tokenIndex = 0;
    targetEl.innerHTML = ''; // reset
    typeNextToken();
  }

  function typeNextToken() {
    if (!tokens || tokenIndex >= tokens.length) {
      // selesai satu message
      msgIndex++;
      if (msgIndex < messages.length) {
        // jeda sejenak lalu lanjut ke pesan berikut
        setTimeout(startTypingMessage, 1200);
      }
      return;
    }

    const token = tokens[tokenIndex++];
    // jika token adalah tag HTML (dimulai dgn '<'), tambahkan langsung tanpa delay (agar tag tidak terputus)
    if (token[0] === '<') {
      // append tag utuh
      targetEl.innerHTML += token;
      // sedikit delay kecil agar feel-nya natural (bisa 0)
      typingTimer = setTimeout(typeNextToken, 40);
    } else {
      // token adalah karakter teks tunggal — ketik perlahan
      targetEl.innerHTML += token;
      typingTimer = setTimeout(typeNextToken, 36); // kecepatan ketik (ms)
    }
  }


  // mulai
  startTypingMessage();

  // return cancel func bila butuh
  return () => {
    if (typingTimer) clearTimeout(typingTimer);
  };
}

document.getElementById("play-img").addEventListener("click", () => {
  window.location.href = "Game.html";
});

// === Tambahan: klik pada DP3 untuk ke mabar.html ===
const dp3 = document.querySelector(".dp3-img");
if (dp3) {
  dp3.addEventListener("click", () => {
    window.location.href = "mabar.html";
  });
}

})();
