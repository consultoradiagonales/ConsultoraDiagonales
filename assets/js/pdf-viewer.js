(function () {
  const REGISTRATION_PATH = "/registro/";
  const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
  const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

  document.addEventListener(
    "click",
    (event) => {
      if (event.target.closest(".radiografia-share-link")) return;

      const link = event.target.closest("[data-pdf-download]");
      if (!link) return;

      if (link.dataset.privateReport === "true" && !hasPrivateReportAccess()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const report = {
          id: link.dataset.reportId || null,
          titulo: link.dataset.privateTitle || getPdfTitle(link),
          pdf_url: link.dataset.pdfUnavailable === "true" ? null : link.href || null,
        };
        if (typeof window.rememberPrivateReport === "function") window.rememberPrivateReport(report, "pdf");
        if (typeof window.openPrivateReportModal === "function") {
          window.openPrivateReportModal(report, "pdf");
        }
        return;
      }

      const url = new URL(link.href, window.location.href);
      if (link.dataset.pdfUnavailable === "true") {
        event.preventDefault();
        event.stopImmediatePropagation();
        const report = {
          id: link.dataset.reportId || null,
          titulo: link.dataset.privateTitle || getPdfTitle(link),
          pdf_url: null,
        };
        if (typeof window.rememberPrivateReport === "function") window.rememberPrivateReport(report, "pdf");
        if (typeof window.openPrivateReportModal === "function") window.openPrivateReportModal(report, "pdf");
        return;
      }

      if (url.pathname.includes(REGISTRATION_PATH)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      openPdfViewer(url.href, getPdfTitle(link));
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
          <div class="pdf-viewer__mobile-note" data-pdf-viewer-note>
            Cargando paginas del PDF dentro de la web.
          </div>
          <div class="pdf-viewer__pages" data-pdf-viewer-pages aria-label="Paginas del PDF"></div>
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
    viewer.querySelector("[data-pdf-viewer-frame]").src = isMobileViewport() ? "about:blank" : pdfUrl;
    viewer.classList.add("is-open");
    viewer.setAttribute("aria-hidden", "false");
    document.body.classList.add("pdf-viewer-open");

    if (isMobileViewport()) renderMobilePdf(viewer, pdfUrl);
  }

  function getPdfTitle(link) {
    const cardTitle = link.closest(".report-card")?.querySelector("h2")?.textContent?.trim();
    const listTitle = link.closest(".latest-list a")?.querySelector("span")?.textContent?.trim();
    return cardTitle || listTitle || "Radiografia";
  }

  function hasPrivateReportAccess() {
    if (typeof window.hasPrivateReportAccess === "function") return window.hasPrivateReportAccess();
    return false;
  }

  function closePdfViewer() {
    const viewer = document.querySelector("[data-pdf-viewer]");
    if (!viewer) return;

    const frame = viewer.querySelector("[data-pdf-viewer-frame]");
    viewer.classList.remove("is-open");
    viewer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("pdf-viewer-open");
    if (frame) frame.src = "about:blank";
    viewer.querySelector("[data-pdf-viewer-pages]")?.replaceChildren();
  }

  function isMobileViewport() {
    return window.matchMedia("(max-width: 760px), (pointer: coarse)").matches;
  }

  async function renderMobilePdf(viewer, pdfUrl) {
    const pages = viewer.querySelector("[data-pdf-viewer-pages]");
    if (!pages) return;

    pages.replaceChildren();
    pages.classList.add("is-loading");
    pages.textContent = "Cargando PDF...";

    try {
      const pdfjs = await loadPdfJs();
      const pdf = await pdfjs.getDocument(pdfUrl).promise;
      pages.replaceChildren();
      pages.classList.remove("is-loading");

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const width = Math.max(280, pages.clientWidth - 24);
        const scale = width / viewport.width;
        const scaledViewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        canvas.width = Math.floor(scaledViewport.width);
        canvas.height = Math.floor(scaledViewport.height);
        canvas.style.width = "100%";
        canvas.style.height = "auto";
        pages.appendChild(canvas);
        await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
      }
    } catch (error) {
      pages.classList.remove("is-loading");
      pages.innerHTML = '<p>No se pudo previsualizar el PDF en este navegador. Tocá "Abrir PDF" para verlo.</p>';
      console.warn("No se pudo renderizar el PDF movil", error);
    }
  }

  async function loadPdfJs() {
    if (!window.CD_PDFJS_PROMISE) {
      window.CD_PDFJS_PROMISE = import(PDFJS_URL).then((pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
        return pdfjs;
      });
    }
    return window.CD_PDFJS_PROMISE;
  }
})();
