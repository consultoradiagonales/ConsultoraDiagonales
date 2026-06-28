(function () {
  if (document.querySelector("[data-cd-voice-widget]")) return;

  const style = document.createElement("style");
  style.textContent = `
    .cd-voice-widget{position:fixed;top:14px;right:14px;z-index:2147483647;display:flex;align-items:center;gap:8px;font-family:Inter,Arial,sans-serif}
    .cd-voice-widget button{min-height:42px;border:0;border-radius:10px;padding:0 14px;color:#172033;background:#fff;font-size:13px;font-weight:900;box-shadow:0 10px 26px rgba(0,0,0,.22);cursor:pointer}
    .cd-voice-widget button.is-reading{background:#f7fbff}
    .cd-voice-widget span{color:#f8d68a;font-size:13px;font-weight:900;text-shadow:0 1px 8px rgba(0,0,0,.45)}
    @media(max-width:640px){.cd-voice-widget{top:10px;right:10px}.cd-voice-widget button{min-height:38px;padding:0 11px;font-size:12px}.cd-voice-widget span{display:none}}
  `;
  document.head.appendChild(style);

  const widget = document.createElement("div");
  widget.className = "cd-voice-widget";
  widget.setAttribute("data-cd-voice-widget", "");
  widget.innerHTML = '<button type="button" data-cd-voice-toggle>▶ Escuchar</button><span data-cd-voice-status></span>';
  document.body.appendChild(widget);

  const state = { chunks: [], index: 0, reading: false };
  const button = widget.querySelector("[data-cd-voice-toggle]");
  const status = widget.querySelector("[data-cd-voice-status]");

  function supported() {
    return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  }

  function cleanText() {
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll("script,style,noscript,svg,canvas,iframe,audio,video,nav,header,footer,[data-cd-voice-widget]").forEach((node) => node.remove());
    return (clone.innerText || clone.textContent || "").replace(/\s+/g, " ").trim();
  }

  function splitText(text, maxLength = 900) {
    const sentences = text.match(/[^.!?。！？]+[.!?。！？]*/g) || [text];
    const chunks = [];
    let current = "";
    sentences.forEach((sentence) => {
      const next = `${current} ${sentence}`.trim();
      if (next.length > maxLength && current) {
        chunks.push(current);
        current = sentence.trim();
      } else {
        current = next;
      }
    });
    if (current) chunks.push(current);
    return chunks;
  }

  function setReading(reading) {
    state.reading = reading;
    button.classList.toggle("is-reading", reading);
    button.textContent = reading ? "⏸ Pausa" : "▶ Escuchar";
    status.textContent = reading ? "🔊 Leyendo..." : "";
  }

  function stop() {
    if (supported()) window.speechSynthesis.cancel();
    state.chunks = [];
    state.index = 0;
    setReading(false);
  }

  function speakNext() {
    if (!state.chunks.length || state.index >= state.chunks.length) {
      stop();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(state.chunks[state.index]);
    utterance.lang = "es-AR";
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onend = () => {
      state.index += 1;
      speakNext();
    };
    utterance.onerror = () => stop();
    window.speechSynthesis.speak(utterance);
  }

  function toggle() {
    if (!supported()) {
      alert("Este navegador no permite lectura en voz desde la web.");
      return;
    }
    if (state.reading) {
      stop();
      return;
    }
    const text = cleanText();
    if (!text) {
      alert("No encontramos texto legible para escuchar en este HTML.");
      return;
    }
    stop();
    state.chunks = splitText(text);
    state.index = 0;
    setReading(true);
    speakNext();
  }

  button.addEventListener("click", toggle);
  window.addEventListener("beforeunload", stop);
})();
