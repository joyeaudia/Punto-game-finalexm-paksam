// ==== mabar.js ====
// Single tidy script for: guide typing, mabar card, invite & join modals, toast, clipboard, navigation.

document.addEventListener("DOMContentLoaded", () => {
  /* -----------------------
     Helper: Toast
     ----------------------- */
  function showToast(msg, timeout = 1600) {
    let t = document.getElementById("mabar-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "mabar-toast";
      Object.assign(t.style, {
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: "34px",
        zIndex: 99999,
        background: "rgba(0,0,0,0.7)",
        color: "#fff",
        padding: "8px 14px",
        borderRadius: "999px",
        fontSize: "14px",
        backdropFilter: "blur(4px)",
        opacity: "0",
        transition: "opacity .18s ease"
      });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = "1";
    clearTimeout(t.__hideTimeout);
    t.__hideTimeout = setTimeout(() => { t.style.opacity = "0"; }, timeout);
  }

  /* -----------------------
     GUIDe typing (supports small HTML tags)
     ----------------------- */
  const guide = document.getElementById("guide");
  const guideTextEl = document.getElementById("guide-text");

  if (guide && guideTextEl) {
    // messages can contain small inline tags like <b> or <img ...>
    const messages = [
      `Selamat datang di mode <b>Mabar!</b> 🎮`,
      `Kamu bisa buat atau gabung room untuk bermain bersama teman~ 🤝`,
      `Yuk coba klik tombol di atas untuk memulai! ✨`
    ];

    // tokenizer: keep tags intact
    function tokenizeHTML(html) {
      return html.match(/(<[^>]+>|[^<])/g) || [];
    }

    let msgIndex = 0;
    let tokens = [];
    let tokenIndex = 0;
    let typingTimer = null;

    function typeNextToken() {
      if (!tokens || tokenIndex >= tokens.length) {
        // finished one message
        msgIndex++;
        if (msgIndex < messages.length) {
          setTimeout(startTypingMessage, 900);
        }
        return;
      }
      const token = tokens[tokenIndex++];
      if (token[0] === "<") {
        guideTextEl.innerHTML += token;
        // small pause after a tag for natural feel
        typingTimer = setTimeout(typeNextToken, 30);
      } else {
        guideTextEl.innerHTML += token;
        typingTimer = setTimeout(typeNextToken, 36);
      }
    }

    function startTypingMessage() {
      guideTextEl.innerHTML = "";
      tokens = tokenizeHTML(messages[msgIndex]);
      tokenIndex = 0;
      typeNextToken();
    }

    startTypingMessage();
  }

  /* -----------------------
     MABAR CARD: Invite / Join buttons (open modals)
     ----------------------- */
  const inviteBtn = document.getElementById("invite-btn");
  const joinBtn = document.getElementById("join-btn");

  // modal elements
  const inviteModal = document.getElementById("invite-modal");
  const joinModal = document.getElementById("join-modal");

  const inviteCodeEl = document.getElementById("invite-code");
  const copyCodeBtn = document.getElementById("copy-code-btn");
  const inviteGoRoomBtn = document.getElementById("invite-go-room");
  const inviteClose = document.getElementById("invite-close");
  const inviteClose2 = document.getElementById("invite-close2");

  const joinInput = document.getElementById("join-code-input");
  const joinGoBtn = document.getElementById("join-go");
  const joinClose = document.getElementById("join-close");
  const joinClose2 = document.getElementById("join-close2");

  // utility: show/hide modal (use aria-hidden)
  function showModal(modEl) {
    if (!modEl) return;
    modEl.setAttribute("aria-hidden", "false");
  }
  function hideModal(modEl) {
    if (!modEl) return;
    modEl.setAttribute("aria-hidden", "true");
  }

  // generate numeric 6-digit code
  function gen6digit() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // copy helper
  async function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // fallback
    try {
      window.prompt("Salin kode undangan ini:", text);
      return true;
    } catch (e) {
      return false;
    }
  }

  // redirect to room (placeholder)
  function gotoRoomWithCode(code) {
    const sanitized = String(code).replace(/\D/g, '');
    if (!sanitized) {
      showToast("Kode tidak valid.");
      return;
    }
    // go to room.html?room=CODE
    window.location.href = `room.html?room=${encodeURIComponent(sanitized)}`;
  }

  // open invite modal and generate code
  function openInviteModal() {
    if (!inviteModal || !inviteCodeEl) return;
    const code = gen6digit();
    inviteCodeEl.textContent = code;
    showModal(inviteModal);
    // focus copy button for keyboard users
    setTimeout(() => { if (copyCodeBtn) copyCodeBtn.focus(); }, 80);
  }

  // open join modal
  function openJoinModal() {
    if (!joinModal || !joinInput) return;
    joinInput.value = "";
    showModal(joinModal);
    setTimeout(() => { joinInput.focus(); }, 80);
  }

  // wire card buttons
  if (inviteBtn) {
    inviteBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      openInviteModal();
    });
  }
  if (joinBtn) {
    joinBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      openJoinModal();
    });
  }

  // close handlers
  [inviteClose, inviteClose2].forEach(btn => {
    if (btn) btn.addEventListener("click", () => hideModal(inviteModal));
  });
  [joinClose, joinClose2].forEach(btn => {
    if (btn) btn.addEventListener("click", () => hideModal(joinModal));
  });

  // copy code
  if (copyCodeBtn && inviteCodeEl) {
    copyCodeBtn.addEventListener("click", async () => {
      const code = inviteCodeEl.textContent.trim();
      try {
        await copyText(code);
        showToast("Kode disalin ke clipboard!");
      } catch (err) {
        showToast("Gagal menyalin, salin manual.");
      }
    });
  }

  // invite -> go to room
  if (inviteGoRoomBtn && inviteCodeEl) {
    inviteGoRoomBtn.addEventListener("click", () => {
      const code = inviteCodeEl.textContent.trim();
      gotoRoomWithCode(code);
    });
  }

  // join modal: go
  if (joinGoBtn && joinInput) {
    joinGoBtn.addEventListener("click", () => {
      const raw = joinInput.value.trim();
      const code = raw.replace(/\D/g, '');
      if (code.length !== 6) {
        showToast('Masukkan kode 6 digit yang valid.');
        return;
      }
      gotoRoomWithCode(code);
    });
  }

  // allow Enter key to submit join
  if (joinInput) {
    joinInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        if (joinGoBtn) joinGoBtn.click();
      }
    });
  }

  // close modal when clicking outside inner area
  [inviteModal, joinModal].forEach(mod => {
    if (!mod) return;
    mod.addEventListener('click', (ev) => {
      if (ev.target === mod) hideModal(mod);
    });
  });

  /* -----------------------
     Small fallback: if user used earlier "invite" button which triggered share/copy
     we already replaced it with modal flow. But keep a quick share fallback if needed:
     (not strictly required but harmless)
     ----------------------- */
  // none: handled by modal flow above

  /* -----------------------
     End DOMContentLoaded
     ----------------------- */
});
