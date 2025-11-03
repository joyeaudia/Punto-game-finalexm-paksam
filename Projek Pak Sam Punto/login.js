// === SIGNUP FORM ===
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("signupForm");

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const fullname = form.fullname.value.trim();
      const username = form.username.value.trim();
      const password = form.password.value;
      const confirmPassword = form.confirmPassword.value;

      if (!fullname || !username || !password || !confirmPassword) {
        alert("Isi semua kolom dulu ya 💕");
        return;
      }

      if (password !== confirmPassword) {
        alert("Password dan konfirmasi tidak sama 💢");
        return;
      }

      alert(`Halo ${fullname}! Akun kamu (${username}) berhasil dibuat 🍰`);
    });
  }

  // === CUSTOM CURSOR ===
  const cursor = document.getElementById("customCursor");
  if (!cursor) return;

  const img = cursor.querySelector("img");
  const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  if (isTouch) {
    cursor.style.display = "none";
    return;
  }

  // aktifkan mode custom cursor
  document.documentElement.classList.add("custom-cursor-active");

  let shown = false;
  function showCursor(e) {
    if (!shown) {
      cursor.style.opacity = "1";
      shown = true;
      window.removeEventListener("mousemove", showCursor);
    }
    moveCursor(e);
  }

  function moveCursor(e) {
    cursor.style.left = e.clientX + "px";
    cursor.style.top = e.clientY + "px";
  }

  window.addEventListener("mousemove", showCursor, { passive: true });
  window.addEventListener("mousemove", moveCursor, { passive: true });

  // klik kecil animasi
  window.addEventListener("mousedown", () => cursor.classList.add("click"));
  window.addEventListener("mouseup", () => cursor.classList.remove("click"));

  // 💡 Double click effect — ubah jadi krusor2.png sementara
  const normalCursor = "krusor1.png";
  const doubleCursor = "krusor2.png";
  let revertTimeout;

  window.addEventListener("dblclick", () => {
    img.src = doubleCursor;
    clearTimeout(revertTimeout);
    revertTimeout = setTimeout(() => {
      img.src = normalCursor;
    }, 800); // 0.8 detik
  });

  // sembunyikan kalau keluar layar
  window.addEventListener("mouseout", (ev) => {
    if (!ev.relatedTarget) cursor.style.opacity = "0";
  });
  window.addEventListener("mouseover", () => {
    if (shown) cursor.style.opacity = "1";
  });

  /* === bgm autoplay after first interaction (login page) === */
(function(){
  const audio = document.getElementById('bgm');
  if(!audio) return;

  // preferensi: mulai diam (volume 0) lalu naik pelan agar tidak ngejut
  audio.volume = 0.0;
  audio.loop = true;
  audio.preload = "auto";

  let started = false;
  let rampInterval = null;

  function rampVolumeTo(target = 0.6, duration = 800) {
    // naikkan volume secara halus selama `duration` ms
    if(rampInterval) clearInterval(rampInterval);
    const steps = 20;
    const stepTime = Math.max(20, Math.floor(duration / steps));
    const start = audio.volume;
    const delta = target - start;
    let currentStep = 0;
    rampInterval = setInterval(() => {
      currentStep++;
      const ratio = currentStep / steps;
      audio.volume = Math.min(1, Math.max(0, start + delta * ratio));
      if(currentStep >= steps) {
        clearInterval(rampInterval);
        rampInterval = null;
      }
    }, stepTime);
  }

  function tryPlay() {
    if(started) return;
    const p = audio.play();
    // some browsers return a promise; handle failure silently
    if (p !== undefined) {
      p.then(() => {
        started = true;
        // naikkan volume halus ke 0.6
        rampVolumeTo(0.6, 700);
      }).catch(()=> {
        // play gagal (biasanya karena belum ada gesture). Biarkan listeners menangani.
      });
    } else {
      // fallback synchronous (old browsers)
      started = true;
      rampVolumeTo(0.6, 700);
    }

    // remove listeners once attempted
    window.removeEventListener('click', tryPlay);
    window.removeEventListener('dblclick', tryPlay);
    window.removeEventListener('mousemove', tryPlay);
    window.removeEventListener('keydown', tryPlay);
  }

  // coba setelah gesture apa pun (klik / dblclick / mousemove / key)
  window.addEventListener('click', tryPlay, {passive:true});
  window.addEventListener('dblclick', tryPlay, {passive:true});
  window.addEventListener('mousemove', tryPlay, {passive:true});
  window.addEventListener('keydown', tryPlay, {passive:true});

  // Optional: kalau mau otomatis non-mute setelah X ms dari load (eksperimen)
  // setTimeout(tryPlay, 1200);

})();

});
