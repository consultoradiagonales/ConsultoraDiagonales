(function () {
  const REGISTRATION_PATH = "/registro/";

  document.addEventListener(
    "click",
    (event) => {
      const link = event.target.closest("[data-pdf-download]");
      if (!link) return;

      const url = new URL(link.href, window.location.href);
      if (url.pathname.includes(REGISTRATION_PATH)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      openPdfViewer(url.href, link.closest("[data-report-index]")?.textContent?.trim() || "Radiografia");
    },
    true,
  );

  function openPdfViewer(pdfUrl, title) {
    let viewer = document.querySelector("[data-pdf-viewer]");
    if (!viewer) {
      viewer = document.createElement("div");
      viewer.className = "pdf-viewer";
      viewer.setAttribute("data-pdf-viewer", "");
      viewer.setAttribute("aria-hidden", "true");
      viewer.innerHTML = `
        <div class="pdf-viewer__dialog" role="dialog" aria-modal="true" aria-labelledby="pdf-viewer-title">
          <div class="pdf-viewer__bar">
            <div>
              <span>Radiografia</span>
              <h2 id="pdf-viewer-title" data-pdf-viewer-title>Documento</h2>
            </div>
            <div class="pdf-viewer__actions">
              <button type="button" data-pdf-viewer-close aria-label="Cerrar visor">Cerrar</button>
            </div>
          </div>
          <iframe data-pdf-viewer-frame title="Visor de PDF" loading="lazy"></iframe>
        </div>
      `;
      document.body.appendChild(viewer);

      viewer.addEventListener("click", (event) => {
        if (event.target === viewer || event.target.closest("[data-pdf-viewer-close]")) closePdfViewer();
      });

      window.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && viewer.classList.contains("is-open")) closePdfViewer();
      });
    }

    viewer.querySelector("[data-pdf-viewer-title]").textContent = title;
    viewer.querySelector("[data-pdf-viewer-frame]").src = pdfUrl;
    viewer.classList.add("is-open");
    viewer.setAttribute("aria-hidden", "false");
    document.body.classList.add("pdf-viewer-open");
  }

  function closePdfViewer() {
    const viewer = document.querySelector("[data-pdf-viewer]");
    if (!viewer) return;

    const frame = viewer.querySelector("[data-pdf-viewer-frame]");
    viewer.classList.remove("is-open");
    viewer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("pdf-viewer-open");
    if (frame) frame.src = "about:blank";
  }
})();
