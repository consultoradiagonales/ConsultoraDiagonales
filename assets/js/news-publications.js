(function () {
  const fields = "id,slug,titulo,subtitulo,seccion,fecha,radiografia_id,estado,published_at,pdf_url,pdf_file_name,created_at";
  const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
  const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
  let pdfJsPromise;

  function client() {
    const config = window.CD_SUPABASE || {};
    if (!config.url || !config.anonKey || !window.supabase) return null;
    return window.supabase.createClient(config.url, config.anonKey);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }

  function dateLabel(value) {
    if (!value) return "";
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
  }

  function articleUrl(slug) {
    const url = new URL("/noticias/nota.html", window.location.origin);
    url.searchParams.set("slug", slug);
    return url.href;
  }

  function reportUrl(item) {
    if (!item?.radiografia_id) return "";
    const url = new URL("../radiografias/informe.html", window.location.href);
    url.searchParams.set("report", item.radiografia_id);
    if (item.titulo) url.searchParams.set("title", item.titulo);
    return url.href;
  }

  function newsPdfUrl(item) {
    const config = window.CD_SUPABASE || {};
    if (!config.url || !item?.id) return "";
    const url = new URL("/functions/v1/news-access", config.url);
    url.searchParams.set("news", item.id);
    return url.href;
  }

  async function loadPdfJs() {
    if (!pdfJsPromise) {
      pdfJsPromise = import(PDFJS_URL).then((module) => {
        module.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
        return module;
      });
    }
    return pdfJsPromise;
  }

  async function renderNewsPdf(target, url, article) {
    if (!target || !url) return;
    try {
      const pdfjs = await loadPdfJs();
      const pdf = await pdfjs.getDocument({ url }).promise;
      target.innerHTML = "";
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const base = page.getViewport({ scale: 1 });
        const availableWidth = Math.min(980, Math.max(280, target.clientWidth - 32));
        const cssScale = availableWidth / base.width;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const renderViewport = page.getViewport({ scale: cssScale * pixelRatio });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(renderViewport.width);
        canvas.height = Math.floor(renderViewport.height);
        canvas.style.width = `${Math.floor(renderViewport.width / pixelRatio)}px`;
        canvas.style.height = `${Math.floor(renderViewport.height / pixelRatio)}px`;
        canvas.setAttribute("aria-label", `Página ${pageNumber} de ${pdf.numPages}`);
        const pageShell = document.createElement("div");
        pageShell.className = "news-pdf-page";
        pageShell.appendChild(canvas);
        target.appendChild(pageShell);
        await page.render({ canvasContext: canvas.getContext("2d"), viewport: renderViewport }).promise;
      }
      const footer = article.querySelector("[data-report-unlock]");
      footer?.classList.remove("is-locked");
      footer?.setAttribute("aria-hidden", "false");
    } catch (_) {
      target.innerHTML = '<div class="empty-state">No se pudo mostrar el PDF. Usá “Abrir PDF completo” y luego volvé a intentar.</div>';
    }
  }

  async function featuredNews() {
    const supabase = client();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from("noticias")
      .select(fields)
      .eq("estado", "featured")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function archivedNews() {
    const supabase = client();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("noticias")
      .select(fields)
      .eq("estado", "archived")
      .order("published_at", { ascending: false })
      .order("fecha", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function articleBySlug(slug) {
    const supabase = client();
    if (!supabase || !slug) return null;
    const { data, error } = await supabase
      .from("noticias")
      .select(fields)
      .eq("slug", slug)
      .in("estado", ["featured", "archived"])
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  function renderFeatured(item, container) {
    if (!item) {
      container.hidden = true;
      container.innerHTML = "";
      return;
    }
    container.hidden = false;
    container.innerHTML = `
      <article class="featured-news-card__inner">
        <a class="featured-news-card__link" href="${escapeAttribute(articleUrl(item.slug))}" aria-label="Leer ${escapeAttribute(item.titulo)}">
          <div class="featured-news-card__copy">
            <span>Última noticia</span>
            <h2>${escapeHtml(item.titulo)}</h2>
            <p>${escapeHtml(item.subtitulo)}</p>
            <strong>Leer nota <i aria-hidden="true">→</i></strong>
          </div>
          <div class="featured-news-card__image" aria-hidden="true"></div>
        </a>
      </article>`;
  }

  function renderArchive(items, container) {
    if (!items.length) {
      container.innerHTML = '<div class="empty-state">Las notas anteriores se publicarán aquí.</div>';
      return;
    }
    container.innerHTML = items.map((item) => `
      <article class="news-archive-card">
        <a class="news-archive-card__image is-empty" href="${escapeAttribute(articleUrl(item.slug))}">
          <span>Diagonales</span>
        </a>
        <div class="news-archive-card__copy">
          <div><span>${escapeHtml(item.seccion || "Actualidad")}</span><time>${escapeHtml(dateLabel(item.published_at || item.fecha))}</time></div>
          <h2><a href="${escapeAttribute(articleUrl(item.slug))}">${escapeHtml(item.titulo)}</a></h2>
          <p>${escapeHtml(item.subtitulo)}</p>
          <a class="news-archive-card__cta" href="${escapeAttribute(articleUrl(item.slug))}">Leer nota <i aria-hidden="true">→</i></a>
        </div>
      </article>`).join("");
  }

  function renderArticle(item, container) {
    if (!item) {
      container.innerHTML = '<div class="empty-state">Esta nota no está disponible.</div>';
      return;
    }
    const pdf = newsPdfUrl(item);
    const notePdf = pdf
      ? `<section class="news-pdf-reader"><div><span>Nota periodística</span><a href="${escapeAttribute(pdf)}" target="_blank" rel="noopener noreferrer">Abrir PDF completo <i aria-hidden="true">↗</i></a></div><div class="news-pdf-document" data-news-pdf-document><div class="empty-state">Cargando todas las páginas de la nota.</div></div></section>`
      : '<div class="empty-state">El PDF de esta nota no está disponible.</div>';
    const report = reportUrl(item);
    const complete = report
      ? `<footer class="news-complete-report is-locked" data-report-unlock aria-hidden="true"><p>Accedé al documento, sus datos y sus gráficos.</p><a href="${escapeAttribute(report)}">INFORME COMPLETO <i aria-hidden="true">→</i></a></footer>`
      : "";
    container.innerHTML = `
      <article class="news-article">
        <header class="news-article__header">
          <div class="news-article__meta"><span>${escapeHtml(item.seccion || "Actualidad")}</span><time>${escapeHtml(dateLabel(item.published_at || item.fecha))}</time></div>
          <h1>${escapeHtml(item.titulo)}</h1>
          <p>${escapeHtml(item.subtitulo)}</p>
        </header>
        ${notePdf}
        ${complete}
      </article>`;
    if (pdf) renderNewsPdf(container.querySelector("[data-news-pdf-document]"), pdf, container.querySelector(".news-article"));
    document.title = `${item.titulo} | Consultora Diagonales`;
  }

  async function boot() {
    const featured = document.querySelector("[data-featured-news]");
    const archive = document.querySelector("[data-news-archive]");
    const article = document.querySelector("[data-news-article]");
    try {
      if (featured) renderFeatured(await featuredNews(), featured);
      if (archive) renderArchive(await archivedNews(), archive);
      if (article) renderArticle(await articleBySlug(new URLSearchParams(window.location.search).get("slug")), article);
    } catch (_) {
      if (featured) { featured.hidden = true; featured.innerHTML = ""; }
      if (archive) archive.innerHTML = '<div class="empty-state">No se pudieron cargar las noticias.</div>';
      if (article) article.innerHTML = '<div class="empty-state">No se pudo cargar esta nota.</div>';
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
