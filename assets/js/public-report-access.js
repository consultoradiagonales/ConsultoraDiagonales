(function () {
  let reportsPromise;

  document.querySelector(".access-panel")?.remove();
  document.querySelector("[data-reports]")?.classList.remove("gated");

  document.addEventListener("click", handlePublicPdfClick, true);
  document.addEventListener("DOMContentLoaded", enablePublicLinks);
  window.setTimeout(enablePublicLinks, 1200);

  async function handlePublicPdfClick(event) {
    const link = event.target.closest("[data-pdf-download]");
    if (!link || event.target.closest(".radiografia-share-link")) return;

    const reports = await getReports();
    const report = reports[Number(link.dataset.reportIndex)];
    if (!report?.pdf_url) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    try {
      if (typeof logPdfDownload === "function") await logPdfDownload(report);
    } catch (_) {
      // La lectura pública no debe fallar si el registro analítico no responde.
    }

    if (typeof openPdfViewer === "function") {
      openPdfViewer(report);
    } else {
      window.location.href = report.pdf_url;
    }
  }

  async function enablePublicLinks() {
    const container = document.querySelector("[data-reports]");
    if (!container) return;

    try {
      const reports = await getReports();
      container.querySelectorAll("[data-pdf-download]").forEach((link) => {
        const report = reports[Number(link.dataset.reportIndex)];
        if (!report?.pdf_url) return;
        link.href = report.pdf_url;
        const label = link.querySelector("strong");
        if (label) label.textContent = "Abrir PDF";
        if (link.classList.contains("request-link")) link.textContent = "Abrir PDF";
      });
    } catch (_) {
      // El cargador principal conserva su mensaje de error.
    }
  }

  function getReports() {
    if (!reportsPromise) reportsPromise = fetchReports();
    return reportsPromise;
  }

  async function fetchReports() {
    const config = window.CD_SUPABASE || {};
    const url = new URL("/rest/v1/radiografias", config.url);
    url.searchParams.set("select", "id,titulo,provincia,localidad,fecha,html_url,pdf_url,created_at");
    url.searchParams.append("order", "fecha.desc");
    url.searchParams.append("order", "created_at.desc");
    const response = await fetch(url.href, {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  }
})();
