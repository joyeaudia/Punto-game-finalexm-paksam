// ==== mabar.js ====
document.addEventListener("DOMContentLoaded", () => {
  const guide = document.getElementById("guide");
  const textEl = document.getElementById("guide-text");

  if (!guide || !textEl) return;

  // Pesan-pesan yang mau ditampilkan
  const messages = [
    `Selamat datang di mode <b>Mabar!</b> 🎮`,
    `Kamu bisa buat atau gabung room untuk bermain bersama teman~ 🤝`,
    `Yuk coba klik tombol di atas untuk memulai! ✨`
  ];

  let msgIndex = 0;
  let charIndex = 0;
  let typingTimer;

  function typeNextChar() {
    const currentMessage = messages[msgIndex];
    if (charIndex < currentMessage.length) {
      textEl.innerHTML += currentMessage[charIndex];
      charIndex++;
      typingTimer = setTimeout(typeNextChar, 40);
    } else {
      msgIndex++;
      if (msgIndex < messages.length) {
        setTimeout(startNextMessage, 1200);
      }
    }
  }

  function startNextMessage() {
    charIndex = 0;
    textEl.innerHTML = "";
    typeNextChar();
  }

  startNextMessage();
});
