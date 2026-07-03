(function () {
  let reportsPromise;
  const PHONE_VERIFIED_KEY = "cd:phone_verified";
  const GMAIL_VERIFIED_KEY = "cd:gmail_verified";
  const PRIVATE_REPORT_REGISTRATION_KEY = "cd:private_report_after_registration";
  const PRIVATE_REPORT_REGISTRATION_TARGET_KEY = "cd:private_report_after_registration_target";

  document.querySelector(".access-panel")?.remove();
  document.querySelector("[data-reports]")?.classList.remove("gated");

  document.addEventListener("click", handlePublicReportClick, true);
  document.addEventListener("DOMContentLoaded", enablePublicLinks);
  document.addEventListener("DOMContentLoaded", observeReportList);
  document.addEventListener("DOMContentLoaded", openPendingPrivateReport);
  window.setTimeout(enablePublicLinks, 1200);
  window.setTimeout(openPendingPrivateReport, 1400);

  async function handlePublicReportClick(event) {
    const link = event.target.closest("[data-pdf-download], [data-html-viewer-open]");
    if (!link || event.target.closest(".radiografia-share-link")) return;

    const reports = await getReports();
    const report = reports[Number(link.dataset.reportIndex)];
    const target = link.matches("[data-html-viewer-open]") ? "html" : "pdf";
    const targetUrl = target === "html" ? getReportGraphsUrl(report, link.href) : report?.pdf_url;
    if (!targetUrl || targetUrl === "#") return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (isPrivateReport(report)) {
      // Las radiografias privadas NUNCA se abren: solo se registra la solicitud.
      const registrationLink = buildRegistrationLink(report, target);
      rememberPrivateReport(report, target);
      try {
        if (typeof logReportInterest === "function") await logReportInterest(report, "report_access_requested", registrationLink);
      } catch (_) {
        // El registro de interes no debe bloquear el formulario de acceso.
      }
      if (typeof window.openPrivateReportModal === "function") {
        window.openPrivateReportModal(report, target);
      } else {
        window.location.href = registrationLink;
      }
      return;
    }

    if (target === "html") {
      try {
        if (typeof logReportInterest === "function") await logReportInterest(report, "report_open", targetUrl);
      } catch (_) {
        // La apertura publica no debe depender del registro analitico.
      }

      if (typeof openHtmlReportViewer === "function") {
        openHtmlReportViewer(buildReportAccessLink(report, "html"), report.titulo || "Graficos");
      } else {
        window.location.href = buildReportAccessLink(report, "html");
      }
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
      window.location.href = buildReportAccessLink(report, "pdf");
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
        const isPrivate = isPrivateReport(report);
        if (isPrivate) link.dataset.privateReport = "true";
        link.href = isPrivate ? buildRegistrationLink(report, "pdf") : buildReportAccessLink(report, "pdf");
        const label = link.querySelector("strong");
        const text = isPrivate ? "Solicitar acceso" : "Abrir PDF";
        if (label) label.textContent = text;
        if (link.classList.contains("request-link")) link.textContent = text;
        if (link.classList.contains("latest-report-row__pdf")) link.textContent = text;
      });

      container.querySelectorAll("[data-html-viewer-open]").forEach((link) => {
        const report = reports[Number(link.dataset.reportIndex)];
        const graphsUrl = getReportGraphsUrl(report, link.href);
        if (!graphsUrl || graphsUrl === "#") return;
        const isPrivate = isPrivateReport(report);
        if (isPrivate) link.dataset.privateReport = "true";
        link.href = isPrivate ? buildRegistrationLink(report, "html") : buildReportAccessLink(report, "html");
        link.textContent = isPrivate ? "Solicitar graficos" : "Graficos";
      });
    } catch (_) {
      // El cargador principal conserva su mensaje de error.
    }
  }

  function observeReportList() {
    const container = document.querySelector("[data-reports]");
    if (!container) return;
    let timer;
    new MutationObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(enablePublicLinks, 50);
    }).observe(container, { childList: true, subtree: false });
  }

  async function openPendingPrivateReport() {
    if (!hasPrivatePdfAccess()) return;

    const params = new URLSearchParams(window.location.search);
    const reportId = params.get("report") || sessionStorage.getItem(PRIVATE_REPORT_REGISTRATION_KEY);
    const target = sessionStorage.getItem(PRIVATE_REPORT_REGISTRATION_TARGET_KEY) || params.get("private_target") || params.get("target") || "pdf";
    if (!reportId) return;

    try {
      const reports = await getReports();
      const report = reports.find((item) => item.id === reportId);
      sessionStorage.removeItem(PRIVATE_REPORT_REGISTRATION_KEY);
      sessionStorage.removeItem(PRIVATE_REPORT_REGISTRATION_TARGET_KEY);

      if (isPrivateReport(report)) {
        // Privadas: la solicitud queda registrada; el contenido no se autoabre.
        return;
      }

      if (target === "html") {
        const graphsUrl = getReportGraphsUrl(report);
        if (!graphsUrl) return;

        try {
          if (typeof logReportInterest === "function") await logReportInterest(report, "report_open", graphsUrl);
        } catch (_) {
          // El registro analitico no debe bloquear la apertura luego del alta.
        }

        if (typeof openHtmlReportViewer === "function") {
          openHtmlReportViewer(buildReportAccessLink(report, "html"), report.titulo || "Graficos");
        } else {
          window.location.href = buildReportAccessLink(report, "html");
        }
        return;
      }

      if (!report?.pdf_url) return;

      try {
        if (typeof logPdfDownload === "function") await logPdfDownload(report);
      } catch (_) {
        // El registro analitico no debe bloquear la apertura luego del alta.
      }

      if (typeof openPdfViewer === "function") {
        openPdfViewer(report);
      } else {
        window.location.href = buildReportAccessLink(report, "pdf");
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
    let response = await fetch(url.href, {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
      },
    });
    let data = await response.json().catch(() => null);

    if (!response.ok && isMissingColumnError(data, "is_private")) {
      url.searchParams.set("select", "id,titulo,provincia,localidad,fecha,html_url,pdf_url,created_at");
      response = await fetch(url.href, {
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
        },
      });
      data = await response.json().catch(() => null);
    }

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return Array.isArray(data) ? data : [];
  }

  function isPrivateReport(report) {
    return report?.is_private === true || String(report?.is_private || "").toLowerCase() === "true";
  }

  function isMissingColumnError(error, column) {
    const message = String(error?.message || "");
    const code = String(error?.code || "");
    return code === "42703" || (message.includes(column) && message.includes("does not exist"));
  }

  function hasPrivatePdfAccess() {
    const contact = JSON.parse(localStorage.getItem("cd:contact") || "{}");
    const gmailValidated = Boolean(contact.visitor_id) && localStorage.getItem(GMAIL_VERIFIED_KEY) === contact.visitor_id;
    const phoneValidated = Boolean(contact.phone) && localStorage.getItem(PHONE_VERIFIED_KEY) === contact.phone;
    const statusValidated = ["phone_verified", "gmail_verified"].includes(String(contact.phone_validation_status || ""));
    return Boolean(contact.phone && (gmailValidated || phoneValidated || statusValidated));
  }

  function buildRegistrationLink(report, accessTarget = "pdf") {
    const target = new URL(window.location.href);
    if (report?.id) target.searchParams.set("report", report.id);
    target.searchParams.set("private_target", accessTarget);
    const registration = new URL("/registro/", window.location.origin);
    registration.searchParams.set("next", target.href);
    if (report?.titulo) registration.searchParams.set("pdf", report.titulo);
    if (report?.id) registration.searchParams.set("report", report.id);
    registration.searchParams.set("target", accessTarget);
    return registration.href;
  }

  function buildReportAccessLink(report, target = "pdf") {
    const config = window.CD_SUPABASE || {};
    if (!config.url || !report?.id) return "#";
    const access = new URL("/functions/v1/report-access", config.url);
    access.searchParams.set("report", report.id);
    access.searchParams.set("target", target);
    if (hasPrivatePdfAccess()) access.searchParams.set("visitor_id", getAccessVisitorId());
    return access.href;
  }

  function getAccessVisitorId() {
    const contact = JSON.parse(localStorage.getItem("cd:contact") || "{}");
    return contact.visitor_id || getVisitorId();
  }

  function getVisitorId() {
    const key = "cd:visitor_id";
    let visitorId = localStorage.getItem(key);
    if (!visitorId) {
      visitorId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(key, visitorId);
    }
    return visitorId;
  }

  function rememberPrivateReport(report, target = "pdf") {
    if (report?.id) sessionStorage.setItem(PRIVATE_REPORT_REGISTRATION_KEY, report.id);
    sessionStorage.setItem(PRIVATE_REPORT_REGISTRATION_TARGET_KEY, target);
  }

  function getReportGraphsUrl(report, fallback = "") {
    if (report?.html_url) return report.html_url;
    const normalizedTitle = String(report?.titulo || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (normalizedTitle.includes("dia de la bandera")) {
      return new URL("/informes/radiografia-adorni-2026.html", window.location.origin).href;
    }
    return fallback && fallback !== window.location.href ? fallback : "";
  }
})();
