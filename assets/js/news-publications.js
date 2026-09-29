(function () {
  const fields = "id,slug,titulo,subtitulo,seccion,fecha,radiografia_id,estado,published_at,pdf_url,pdf_file_name,imagen_url,imagen_alt,imagen_epigrafe,contenido,cuerpo,seo_title,seo_description,seo_keywords,autor,lectura_minutos,created_at,updated_at";
  const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
  const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
  let pdfJsPromise;
  let twitterScriptPromise;

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

  function safeHttpsUrl(value) {
    try {
      const url = new URL(String(value || ""), window.location.origin);
      return ["https:", "http:"].includes(url.protocol) ? url.href : "";
    } catch (_) {
      return "";
    }
  }

  function dateLabel(value) {
    if (!value) return "";
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
  }

  function articleUrl(slug) {
    const url = new URL("/noticias/nota.html", window.location.origin);
    if (slug) url.searchParams.set("slug", slug);
    return url.href;
  }

  function currentSlug(container) {
    return (
      container?.dataset?.slug ||
      document.querySelector("[data-news-slug]")?.dataset.newsSlug ||
      new URLSearchParams(window.location.search).get("slug") ||
      ""
    );
  }

  function absoluteImageUrl(item) {
    return safeHttpsUrl(item?.imagen_url);
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
    if (!config.url || !item?.id || !item?.pdf_url) return "";
    const url = new URL("/functions/v1/news-access", config.url);
    url.searchParams.set("news", item.id);
    return url.href;
  }

  function setMeta(selector, attribute, value) {
    let element = document.head.querySelector(selector);
    if (!element) {
      element = document.createElement("meta");
      const match = selector.match(/\[(name|property)="([^"]+)"\]/);
      if (match) element.setAttribute(match[1], match[2]);
      document.head.appendChild(element);
    }
    element.setAttribute(attribute, value);
  }

  function blockText(item) {
    return Array.isArray(item?.contenido)
      ? item.contenido
        .filter((block) => ["paragraph", "heading", "quote"].includes(String(block?.type || "")))
        .map((block) => String(block?.text || ""))
        .join(" ")
        .slice(0, 12_000)
      : String(item?.cuerpo || "").slice(0, 12_000);
  }

  function updateArticleSeo(item) {
    const title = `${item.seo_title || item.titulo} | Consultora Diagonales`;
    const description = String(item.seo_description || item.subtitulo || "").slice(0, 180);
    const canonicalUrl = articleUrl(item.slug);
    const image = absoluteImageUrl(item);
    document.title = title;
    setMeta('meta[name="description"]', "content", description);
    setMeta('meta[property="og:title"]', "content", title);
    setMeta('meta[property="og:description"]', "content", description);
    setMeta('meta[property="og:url"]', "content", canonicalUrl);
    setMeta('meta[property="og:type"]', "content", "article");
    setMeta('meta[name="twitter:title"]', "content", title);
    setMeta('meta[name="twitter:description"]', "content", description);
    if (item.seccion) setMeta('meta[property="article:section"]', "content", item.seccion);
    if (item.published_at || item.fecha) setMeta('meta[property="article:published_time"]', "content", item.published_at || item.fecha);
    if (item.updated_at) setMeta('meta[property="article:modified_time"]', "content", item.updated_at);
    const keywords = Array.isArray(item.seo_keywords) ? item.seo_keywords.filter(Boolean).join(", ") : "";
    if (keywords) setMeta('meta[name="keywords"]', "content", keywords);
    if (image) {
      setMeta('meta[property="og:image"]', "content", image);
      setMeta('meta[property="og:image:secure_url"]', "content", image);
      setMeta('meta[name="twitter:image"]', "content", image);
      setMeta('meta[name="twitter:card"]', "content", "summary_large_image");
    }
    const canonical = document.head.querySelector('link[rel="canonical"]') || document.head.appendChild(document.createElement("link"));
    canonical.setAttribute("rel", "canonical");
    canonical.setAttribute("href", canonicalUrl);
    let schema = document.getElementById("news-article-schema");
    if (!schema) {
      schema = document.createElement("script");
      schema.id = "news-article-schema";
      schema.type = "application/ld+json";
      document.head.appendChild(schema);
    }
    schema.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: item.titulo,
      alternativeHeadline: item.seo_title || undefined,
      description,
      articleBody: blockText(item) || undefined,
      datePublished: item.published_at || item.fecha,
      dateModified: item.updated_at || item.published_at || item.fecha,
      articleSection: item.seccion || undefined,
      keywords: keywords || undefined,
      mainEntityOfPage: canonicalUrl,
      author: { "@type": "Organization", name: item.autor || "Consultora Diagonales" },
      publisher: { "@type": "Organization", name: "Consultora Diagonales", url: "https://consultoradiagonales.com.ar/" },
      image: image || undefined,
    });
  }

  function appendLinkedText(target, text) {
    const value = String(text || "");
    const pattern = /\[([^\]\n]{1,220})\]\((https:\/\/[^\s)]+)\)/g;
    let cursor = 0;
    let match;
    while ((match = pattern.exec(value))) {
      target.append(document.createTextNode(value.slice(cursor, match.index)));
      const href = safeHttpsUrl(match[2]);
      if (href) {
        const link = document.createElement("a");
        link.href = href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = match[1];
        target.append(link);
      } else {
        target.append(document.createTextNode(match[0]));
      }
      cursor = pattern.lastIndex;
    }
    target.append(document.createTextNode(value.slice(cursor)));
  }

  function normalizedBlocks(item) {
    if (Array.isArray(item?.contenido) && item.contenido.length) return item.contenido;
    const fallback = String(item?.cuerpo || "").trim();
    return fallback ? fallback.split(/\n{2,}/).map((text) => ({ type: "paragraph", text })) : [];
  }

  function loadTwitterWidgets(scope) {
    if (window.twttr?.widgets?.load) {
      window.twttr.widgets.load(scope);
      return;
    }
    if (!twitterScriptPromise) {
      twitterScriptPromise = new Promise((resolve) => {
        const script = document.createElement("script");
        script.id = "cd-twitter-widgets";
        script.async = true;
        script.src = "https://platform.twitter.com/widgets.js";
        script.onload = () => resolve(window.twttr);
        script.onerror = () => resolve(null);
        document.head.append(script);
      });
    }
    twitterScriptPromise.then(() => window.twttr?.widgets?.load?.(scope));
  }

  function renderEmbed(block) {
    const wrap = document.createElement("section");
    wrap.className = "news-social-embed";
    const href = safeHttpsUrl(block.url);
    if (!href) return wrap;
    if (block.provider === "instagram") {
      const iframe = document.createElement("iframe");
      iframe.src = `${href.replace(/\/$/, "")}/embed/captioned/`;
      iframe.title = "Publicación de Instagram";
      iframe.loading = "lazy";
      iframe.allow = "encrypted-media; clipboard-write";
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      wrap.append(iframe);
      return wrap;
    }
    const quote = document.createElement("blockquote");
    quote.className = "twitter-tweet";
    const link = document.createElement("a");
    link.href = href;
    link.textContent = "Ver publicación en X";
    quote.append(link);
    wrap.append(quote);
    loadTwitterWidgets(wrap);
    return wrap;
  }

  function renderBlocks(item, target, options = {}) {
    normalizedBlocks(item).forEach((block) => {
      const type = String(block?.type || "");
      if (type === "heading") {
        const heading = document.createElement("h2");
        heading.textContent = String(block.text || "");
        target.append(heading);
      } else if (type === "quote") {
        const quote = document.createElement("blockquote");
        quote.className = "news-article__quote";
        quote.textContent = String(block.text || "");
        if (block.cite) {
          const cite = document.createElement("cite");
          cite.textContent = String(block.cite);
          quote.append(cite);
        }
        target.append(quote);
      } else if (type === "image") {
        const rawUrl = String(block.url || "");
        const url = options.preview && rawUrl.startsWith("blob:") ? rawUrl : safeHttpsUrl(rawUrl);
        if (!url) return;
        const figure = document.createElement("figure");
        figure.className = "news-inline-image";
        const image = document.createElement("img");
        image.src = url;
        image.alt = String(block.alt || "");
        image.loading = "lazy";
        image.decoding = "async";
        figure.append(image);
        if (block.caption) {
          const caption = document.createElement("figcaption");
          caption.textContent = String(block.caption);
          figure.append(caption);
        }
        target.append(figure);
      } else if (type === "embed") {
        target.append(renderEmbed(block));
      } else if (type === "paragraph") {
        const paragraph = document.createElement("p");
        appendLinkedText(paragraph, block.text);
        target.append(paragraph);
      }
    });
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
        pageShell.append(canvas);
        target.append(pageShell);
        await page.render({ canvasContext: canvas.getContext("2d"), viewport: renderViewport }).promise;
      }
      article.querySelector("[data-report-unlock]")?.classList.remove("is-locked");
    } catch (_) {
      target.innerHTML = '<div class="empty-state">No se pudo cargar la nota histórica. Recargá esta página para volver a intentarlo.</div>';
    }
  }

  function createShare(item, preview) {
    const shareUrl = articleUrl(item.slug);
    const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${item.titulo}\n\n${shareUrl}`)}`;
    const twitter = `https://x.com/intent/post?text=${encodeURIComponent(`${item.titulo}\n\n${shareUrl}`)}`;
    const aside = document.createElement("aside");
    aside.className = "news-share-tools";
    const copy = document.createElement("div");
    copy.className = "news-share-tools__copy";
    const label = document.createElement("span");
    label.textContent = preview ? "Vista previa editorial" : "Difundí esta nota";
    const title = document.createElement("p");
    title.textContent = item.titulo;
    copy.append(label, title);
    const actions = document.createElement("div");
    actions.className = "news-share-tools__actions";
    if (preview) {
      const note = document.createElement("span");
      note.className = "news-preview-note";
      note.textContent = "La URL final se habilita al publicar.";
      actions.append(note);
    } else {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Copiar enlace";
      button.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(shareUrl);
          button.textContent = "Enlace copiado";
        } catch (_) {
          window.prompt("Copiá este enlace", shareUrl);
        }
      });
      const whatsappLink = document.createElement("a");
      whatsappLink.href = whatsapp;
      whatsappLink.target = "_blank";
      whatsappLink.rel = "noopener noreferrer";
      whatsappLink.textContent = "WhatsApp";
      const xLink = document.createElement("a");
      xLink.href = twitter;
      xLink.target = "_blank";
      xLink.rel = "noopener noreferrer";
      xLink.textContent = "Compartir en X";
      actions.append(button, whatsappLink, xLink);
    }
    aside.append(copy, actions);
    return aside;
  }

  function renderArticle(item, container, options = {}) {
    if (!item) {
      container.innerHTML = '<div class="empty-state">Esta nota no está disponible.</div>';
      return null;
    }
    const article = document.createElement("article");
    article.className = "news-article";
    if (options.preview) article.classList.add("news-article--preview");
    const header = document.createElement("header");
    header.className = "news-article__header";
    const meta = document.createElement("div");
    meta.className = "news-article__meta";
    const section = document.createElement("span");
    section.textContent = item.seccion || "Actualidad";
    const date = document.createElement("time");
    date.textContent = dateLabel(item.published_at || item.fecha);
    meta.append(section, date);
    if (item.autor || item.lectura_minutos) {
      const detail = document.createElement("span");
      detail.className = "news-article__reading";
      detail.textContent = [item.autor, item.lectura_minutos ? `${item.lectura_minutos} min de lectura` : ""].filter(Boolean).join(" · ");
      meta.append(detail);
    }
    const headline = document.createElement("h1");
    headline.textContent = item.titulo;
    const deck = document.createElement("p");
    deck.textContent = item.subtitulo;
    header.append(meta, headline, deck);
    article.append(header);

    const rawCoverUrl = String(item.imagen_url || "");
    const coverUrl = options.preview && rawCoverUrl.startsWith("blob:") ? rawCoverUrl : safeHttpsUrl(rawCoverUrl);
    if (coverUrl) {
      const cover = document.createElement("figure");
      cover.className = "news-article__image";
      const image = document.createElement("img");
      image.src = coverUrl;
      image.alt = item.imagen_alt || item.titulo || "";
      image.decoding = "async";
      cover.append(image);
      if (item.imagen_epigrafe) {
        const caption = document.createElement("figcaption");
        caption.textContent = item.imagen_epigrafe;
        cover.append(caption);
      }
      article.append(cover);
    }

    const blocks = normalizedBlocks(item);
    if (blocks.length) {
      const body = document.createElement("section");
      body.className = "news-article__body";
      renderBlocks(item, body, options);
      article.append(body);
    } else {
      const pdf = newsPdfUrl(item);
      if (pdf) {
        const reader = document.createElement("section");
        reader.className = "news-pdf-reader";
        reader.setAttribute("aria-label", "Nota histórica en PDF");
        const documentTarget = document.createElement("div");
        documentTarget.className = "news-pdf-document";
        documentTarget.innerHTML = '<div class="empty-state">Cargando la nota histórica.</div>';
        reader.append(documentTarget);
        article.append(reader);
        window.setTimeout(() => renderNewsPdf(documentTarget, pdf, article), 0);
      } else {
        const empty = document.createElement("p");
        empty.className = "news-article__empty";
        empty.textContent = "Esta nota todavía no tiene contenido editorial publicado.";
        article.append(empty);
      }
    }

    article.append(createShare(item, Boolean(options.preview)));
    const report = reportUrl(item);
    if (report) {
      const complete = document.createElement("footer");
      complete.className = "news-complete-report";
      complete.dataset.reportUnlock = "";
      const text = document.createElement("p");
      text.textContent = "Accedé a la radiografía, su PDF y todos sus gráficos.";
      const link = document.createElement("a");
      link.href = report;
      link.textContent = "INFORME COMPLETO";
      complete.append(text, link);
      article.append(complete);
    }
    container.replaceChildren(article);
    if (!options.preview) updateArticleSeo(item);
    return article;
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
      .in("estado", ["featured", "archived"])
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
    const image = item.imagen_url
      ? `<img src="${escapeAttribute(item.imagen_url)}" alt="${escapeAttribute(item.imagen_alt || item.titulo)}" loading="eager" decoding="async" />`
      : "";
    container.innerHTML = `
      <article class="featured-news-card__inner">
        <a class="featured-news-card__link" href="${escapeAttribute(articleUrl(item.slug))}" aria-label="Leer ${escapeAttribute(item.titulo)}">
          <div class="featured-news-card__copy">
            <span>Última noticia</span>
            <h2>${escapeHtml(item.titulo)}</h2>
            <p>${escapeHtml(item.subtitulo)}</p>
            <strong>Leer nota <i aria-hidden="true">→</i></strong>
          </div>
          <div class="featured-news-card__image">${image}</div>
        </a>
      </article>`;
  }

  function renderArchive(items, container) {
    if (!items.length) {
      container.innerHTML = '<div class="empty-state">Las notas publicadas aparecerán aquí.</div>';
      return;
    }
    container.innerHTML = items.map((item) => `
      <article class="news-archive-card">
        <a class="news-archive-card__image${item.imagen_url ? "" : " is-empty"}" href="${escapeAttribute(articleUrl(item.slug))}">
          ${item.imagen_url ? `<img src="${escapeAttribute(item.imagen_url)}" alt="${escapeAttribute(item.imagen_alt || item.titulo)}" loading="lazy" decoding="async" />` : "<span>Diagonales</span>"}
        </a>
        <div class="news-archive-card__copy">
          <div><span>${escapeHtml(item.seccion || "Actualidad")}</span><time>${escapeHtml(dateLabel(item.published_at || item.fecha))}</time></div>
          <h2><a href="${escapeAttribute(articleUrl(item.slug))}">${escapeHtml(item.titulo)}</a></h2>
          <p>${escapeHtml(item.subtitulo)}</p>
          <a class="news-archive-card__cta" href="${escapeAttribute(articleUrl(item.slug))}">Leer nota <i aria-hidden="true">→</i></a>
        </div>
      </article>`).join("");
  }

  window.CDNewsRenderer = { renderArticle, renderBlocks, articleUrl };

  async function boot() {
    const featured = document.querySelector("[data-featured-news]");
    const archive = document.querySelector("[data-news-archive]");
    const article = document.querySelector("[data-news-article]");
    try {
      if (featured) renderFeatured(await featuredNews(), featured);
      if (archive) renderArchive(await archivedNews(), archive);
      if (article) renderArticle(await articleBySlug(currentSlug(article)), article);
    } catch (_) {
      if (featured) { featured.hidden = true; featured.innerHTML = ""; }
      if (archive) archive.innerHTML = '<div class="empty-state">No se pudieron cargar las noticias.</div>';
      if (article) article.innerHTML = '<div class="empty-state">No se pudo cargar esta nota.</div>';
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
