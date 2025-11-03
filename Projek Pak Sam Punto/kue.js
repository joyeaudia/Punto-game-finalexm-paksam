/* === CONFETTI === */
(function(){
  const container = document.querySelector('.confetti-container');
  if(container){
    const BURST_COUNT = 12;
    const INTERVAL_MS = 350;
    const LIFETIME_MS_MIN = 4200;
    const LIFETIME_MS_MAX = 7000;
    const COLORS = [
      '#ff5f5f','#ffd966','#6dd3ff','#9b6bff','#72ff84',
      '#ff72cc','#ff9a3c','#60ffea','#fff36d','#ff6dcf'
    ];

    const rand = (min,max)=> Math.random()*(max-min)+min;
    const randInt = (min,max)=> Math.floor(rand(min,max+1));

    function createConfetti(){
      const el = document.createElement('div');
      el.className = 'confetti';
      const w = rand(6,14), h = rand(10,20), left = rand(0,100);
      const color = COLORS[randInt(0,COLORS.length-1)];
      const dur = rand(LIFETIME_MS_MIN, LIFETIME_MS_MAX);
      const initX = rand(-6,6);
      el.style.left = left + '%';
      el.style.width = w + 'px';
      el.style.height = h + 'px';
      el.style.background = color;
      el.style.transform = `translateX(${initX}px)`;
      el.style.animation = `confettiFall ${dur}ms linear 0ms forwards`;
      container.appendChild(el);
      setTimeout(()=>{ try{ container.removeChild(el); }catch(e){} }, dur + 220);
    }

    setInterval(()=>{
      for(let i=0;i<BURST_COUNT;i++){
        setTimeout(createConfetti, Math.random() * 250);
      }
    }, INTERVAL_MS);
  }
})();


/* === CUSTOM CURSOR === */
(function(){
  const cursor = document.getElementById("customCursor");
  if(!cursor) return;

  const img = cursor.querySelector("img");
  const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  if(isTouch){ cursor.style.display = "none"; return; }

  document.documentElement.classList.add("custom-cursor-active");

  let shown = false;
  function showCursor(e){
    if(!shown){
      cursor.style.opacity = "1";
      shown = true;
      window.removeEventListener("mousemove", showCursor);
    }
    moveCursor(e);
  }

  function moveCursor(e){
    cursor.style.left = e.clientX + "px";
    cursor.style.top  = e.clientY + "px";
  }

  window.addEventListener("mousemove", showCursor, {passive:true});
  window.addEventListener("mousemove", moveCursor, {passive:true});

  // klik kecil animasi
  window.addEventListener("mousedown", ()=> cursor.classList.add("click"));
  window.addEventListener("mouseup", ()=> cursor.classList.remove("click"));

  // 💡 Fitur baru: ganti gambar saat double click
  const normalCursor = "krusor1.png";  // ganti ke nama file kursor default
  const doubleCursor = "krusor2.png";  // ganti ke nama file kursor saat double click
  let revertTimeout;

  window.addEventListener("dblclick", ()=>{
    img.src = doubleCursor;
    clearTimeout(revertTimeout);
    revertTimeout = setTimeout(()=>{
      img.src = normalCursor; // kembali normal setelah 800ms
    }, 800);
  });

  // sembunyikan kalau keluar layar
  window.addEventListener("mouseout", (ev)=>{
    if(!ev.relatedTarget) cursor.style.opacity = "0";
  });
  window.addEventListener("mouseover", ()=>{
    if(shown) cursor.style.opacity = "1";
  });


  /* === AUDIO AUTOPLAY (setelah interaksi pengguna) === */
(function(){
  const audio = document.getElementById("bgm");
  if(!audio) return;

  function tryPlay(){
    audio.volume = 0.6; // ubah volume (0.0–1.0)
    audio.loop = true;  // biar muter terus
    const playPromise = audio.play();
    if(playPromise !== undefined){
      playPromise.catch(()=>{}); // biar ga error di console
    }

    // lepas listener biar ga spam
    window.removeEventListener("click", tryPlay);
    window.removeEventListener("dblclick", tryPlay);
    window.removeEventListener("mousemove", tryPlay);
  }

  // mulai setelah klik / double click / gerakan pertama
  window.addEventListener("click", tryPlay);
  window.addEventListener("dblclick", tryPlay);
  window.addEventListener("mousemove", tryPlay);
setTimeout(() => {
  const audio = document.getElementById("bgm");
  if (audio) {
    audio.muted = false; // nyalain suaranya setelah 1 detik
    audio.play().catch(()=>{});
  }
}, 1000);
})();
/* === LOGO DELAYED REVEAL === */
(function(){
  const logo = document.getElementById('logoReveal');
  if (!logo) return;

  // muncul setelah 5 detik
  setTimeout(() => {
    logo.classList.add('show');
  }, 5000);
})();
/* === LOGO CLICK REDIRECT === */
(function() {
  const logoImg = document.querySelector('.logo-image');
  if (!logoImg) return;

  // kasih sedikit delay agar bisa diklik setelah muncul
  logoImg.style.pointerEvents = "auto"; // biar bisa diklik
  logoImg.style.cursor = "pointer";     // ubah jadi tangan

  logoImg.addEventListener("click", () => {
    window.location.href = "login.html"; // arahkan ke halaman login
  });
})();

})();
