(function () {
  // Supabase Storage entrega los HTML como text/plain (nosniff), asi que el navegador
  // muestra el codigo fuente. Los traemos por fetch y los servimos como text/html.
  const cache = new Map();

  function accessUrl(reportId, target) {
    const config = window.CD_SUPABASE || {};
    if (!config.url || !reportId) return "";
    const url = new URL("/functions/v1/report-access", config.url);
    url.searchParams.set("report", reportId);
    url.searchParams.set("target", target);
    return url.href;
  }

  async function htmlBlobUrl(source) {
    const url = String(source || "");
    if (!url) throw new Error("sin origen");
    if (cache.has(url)) return cache.get(url);
    const response = await fetch(url, { credentials: "omit", redirect: "follow" });
    if (!response.ok) {
      let detail = "";
      try {
        detail = (await response.json())?.error || "";
      } catch (_) {
        detail = "";
      }
      const error = new Error(detail || `No se pudo abrir el informe (${response.status}).`);
      error.status = response.status;
      error.detail = detail;
      throw error;
    }
    const markup = await response.text();
    const blobUrl = URL.createObjectURL(new Blob([markup], { type: "text/html; charset=utf-8" }));
    cache.set(url, blobUrl);
    return blobUrl;
  }

  window.CDReportHtml = {
    accessUrl,
    htmlBlobUrl,
    reportHtmlBlobUrl: (reportId) => htmlBlobUrl(accessUrl(reportId, "html")),
    isStorageHtmlLink: (url) => /\/functions\/v1\/report-access/.test(String(url || "")) && /target=html/.test(String(url || "")),
  };
})();
