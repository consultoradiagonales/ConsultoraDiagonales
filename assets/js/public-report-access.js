(function () {
  let reportsPromise;
  const PHONE_VERIFIED_KEY = "cd:phone_verified";
  const GMAIL_VERIFIED_KEY = "cd:gmail_verified";
  const PRIVATE_REPORT_REGISTRATION_KEY = "cd:private_report_after_registration";

  document.querySelector(".access-panel")?.remove();
  document.querySelector("[data-reports]")?.classList.remove("gated");

  document.addEventListener("click", handlePublicPdfClick, true);
  document.addEventListener("DOMContentLoaded", enablePublicLinks);
  document.addEventListener("DOMContentLoaded", openPendingPrivateReport);
  window.setTimeout(enablePublicLinks, 1200);
  window.setTimeout(openPendingPrivateReport, 1400);

  async function handlePublicPdfClick(event) {
    const link = event.target.closest("[data-pdf-download]");
    if (!link || event.target.closest(".radiografia-share-link")) return;

    const reports = await getReports();
    const report = reports[Number(link.dataset.reportIndex)];
    if (!report?.pdf_url) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (isPrivateReport(report) && !hasPrivatePdfAccess()) {
      const registrationLink = buildRegistrationLink(report);
      rememberPrivateReport(report);
      try {
        if (typeof logReportInterest === "function") await logReportInterest(report, "report_access_requested", registrationLink);
      } catch (_) {
        // El registro de interes no debe bloquear el formulario de acceso.
      }
      window.location.href = registrationLink;
      return;
    }

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
        const needsRegistration = isPrivateReport(report) && !hasPrivatePdfAccess();
        link.href = needsRegistration ? buildRegistrationLink(report) : report.pdf_url;
        const label = link.querySelector("strong");
        const text = needsRegistration ? "Registrar datos y abrir PDF" : "Abrir PDF";
        if (label) label.textContent = text;
        if (link.classList.contains("request-link")) link.textContent = text;
      });
    } catch (_) {
      // El cargador principal conserva su mensaje de error.
    }
  }

  async function openPendingPrivateReport() {
    if (!hasPrivatePdfAccess()) return;

    const params = new URLSearchParams(window.location.search);
    const reportId = params.get("report") || sessionStorage.getItem(PRIVATE_REPORT_REGISTRATION_KEY);
    if (!reportId) return;

    try {
      const reports = await getReports();
      const report = reports.find((item) => item.id === reportId);
      if (!report?.pdf_url) return;
      sessionStorage.removeItem(PRIVATE_REPORT_REGISTRATION_KEY);

      try {
        if (typeof logPdfDownload === "function") await logPdfDownload(report);
      } catch (_) {
        // El registro analitico no debe bloquear la apertura luego del alta.
      }

      if (typeof openPdfViewer === "function") {
        openPdfViewer(report);
      } else {
        window.location.href = report.pdf_url;
      }
    } catch (_) {
      // Si el listado aun no esta disponible, el usuario conserva el enlace visible.
    }
  }

  function getReports() {
    if (!reportsPromise) reportsPromise = fetchReports();
    return reportsPromise;
  }

  async function fetchReports() {
    const config = window.CD_SUPABASE || {};
    const url = new URL("/rest/v1/radiografias", config.url);
    url.searchParams.set("select", "id,titulo,provincia,localidad,fecha,html_url,pdf_url,is_private,created_at");
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

  function isPrivateReport(report) {
    return report?.is_private === true || String(report?.is_private || "").toLowerCase() === "true";
  }

  function hasPrivatePdfAccess() {
    return Boolean(localStorage.getItem(PHONE_VERIFIED_KEY) || localStorage.getItem(GMAIL_VERIFIED_KEY));
  }

  function buildRegistrationLink(report) {
    const target = new URL(window.location.href);
    if (report?.id) target.searchParams.set("report", report.id);
    const registration = new URL("/registro/", window.location.origin);
    registration.searchParams.set("next", target.href);
    return registration.href;
  }

  function rememberPrivateReport(report) {
    if (report?.id) sessionStorage.setItem(PRIVATE_REPORT_REGISTRATION_KEY, report.id);
  }
})();
