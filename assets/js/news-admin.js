(function () {
  const ADMIN_SESSION_KEY = "cd:admin_unlocked";
  const ADMIN_UPLOAD_KEY = "cd:admin_upload_key";
  let reports = [];
  let blocks = [];
  let started = false;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function apiUrl(name) {
    const config = window.CD_SUPABASE || {};
    return config.url ? `${config.url}/functions/v1/${name}` : "";
  }

  function adminHeaders(json = true) {
    const config = window.CD_SUPABASE || {};
    const headers = {
      apikey: config.anonKey || "",
      Authorization: `Bearer ${config.anonKey || ""}`,
      "x-admin-key": sessionStorage.getItem(ADMIN_UPLOAD_KEY) || "",
    };
    if (json) headers["Content-Type"] = "application/json";
    return headers;
  }

  async function request(path, options = {}) {
    const response = await fetch(apiUrl(path), { headers: adminHeaders(), ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }

  async function uploadNewsMedia(id, file, kind) {
    const formData = new FormData();
    formData.append("id", id);
    formData.append("kind", kind);
    formData.append("image", file);
    const response = await fetch(apiUrl("admin-upload-news-media"), {
      method: "POST",
      headers: adminHeaders(false),
      body: formData,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data.media;
  }

  function status(message, tone = "") {
    const target = document.querySelector("[data-news-status]");
    if (!target) return;
    target.textContent = message;
    target.dataset.tone = tone;
  }

  function dateLabel(value) {
    if (!value) return "Sin fecha";
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime()) ? "Sin fecha" : new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
  }

  function stateLabel(value) {
    return value === "featured" ? "En portada" : value === "archived" ? "Publicado" : "Borrador";
  }

  function blockId() {
    return window.crypto?.randomUUID?.() || `block-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function newBlock(type, values = {}) {
    return { id: blockId(), type, text: "", cite: "", url: "", alt: "", caption: "", provider: "", file: null, localPreview: "", ...values };
  }

  function slugify(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 90);
  }

  function updateCounter(form, name) {
    const field = form.querySelector(`[name="${name}"]`);
    const counterName = { subtitulo: "deck", seo_title: "seo-title", seo_description: "seo-description" }[name] || name;
    const target = form.querySelector(`[data-news-count="${counterName}"]`);
    if (field && target) target.textContent = String(field.value.length);
  }

  function updateCounters(form) {
    updateCounter(form, "subtitulo");
    updateCounter(form, "seo_title");
    updateCounter(form, "seo_description");
  }

  function reportOptions(selected = "") {
    const completeReports = reports.filter((report) => report.pdf_url && report.html_url);
    const options = ['<option value="">Sin radiografía vinculada</option>'];
    completeReports.forEach((report) => {
      const state = report.publication_state === "draft" ? "Borrador" : report.publication_state === "unlisted" ? "Vigente" : "Repositorio";
      options.push(`<option value="${escapeHtml(report.id)}"${report.id === selected ? " selected" : ""}>${escapeHtml(report.titulo || "Sin título")} · ${state}</option>`);
    });
    return options.join("");
  }

  async function loadReports() {
    const data = await request("admin-dashboard?range=all");
    reports = Array.isArray(data.reports) ? data.reports : [];
    const select = document.querySelector("[data-news-report-select]");
    if (select) {
      const selected = select.value;
      select.innerHTML = reportOptions(selected);
    }
  }

  function existingBlocks(item) {
    if (Array.isArray(item?.contenido) && item.contenido.length) {
      return item.contenido.map((block) => newBlock(block.type || "paragraph", block));
    }
    const body = String(item?.cuerpo || "").trim();
    return body ? body.split(/\n{2,}/).map((text) => newBlock("paragraph", { text })) : [];
  }

  function formElement(name) {
    return document.querySelector("[data-admin-news-form]")?.elements[name];
  }

  function buildLabel(labelText, control) {
    const label = document.createElement("label");
    const text = document.createElement("span");
    text.textContent = labelText;
    label.append(text, control);
    return label;
  }

  function buildTextControl(block, field, { multiline = false, placeholder = "", maxLength = 0 } = {}) {
    const control = document.createElement(multiline ? "textarea" : "input");
    if (!multiline) control.type = "text";
    control.value = block[field] || "";
    control.placeholder = placeholder;
    if (maxLength) control.maxLength = maxLength;
    if (multiline) control.rows = 5;
    control.dataset.blockField = field;
    control.dataset.blockId = block.id;
    return control;
  }

  function blockTitle(type) {
    return {
      paragraph: "Texto",
      heading: "Subtítulo",
      quote: "Cita",
      image: "Imagen interna",
      embed: "Publicación social",
    }[type] || "Bloque";
  }

  function renderBlocks() {
    const list = document.querySelector("[data-news-block-list]");
    const empty = document.querySelector("[data-news-block-empty]");
    if (!list) return;
    list.replaceChildren();
    if (empty) empty.hidden = blocks.length > 0;
    blocks.forEach((block, index) => {
      const article = document.createElement("article");
      article.className = `news-editor-block news-editor-block--${block.type}`;
      article.dataset.blockId = block.id;

      const header = document.createElement("header");
      const meta = document.createElement("div");
      const number = document.createElement("span");
      number.className = "news-editor-block__number";
      number.textContent = String(index + 1).padStart(2, "0");
      const title = document.createElement("strong");
      title.textContent = blockTitle(block.type);
      meta.append(number, title);
      const actions = document.createElement("div");
      [
        ["up", "Subir", index === 0],
        ["down", "Bajar", index === blocks.length - 1],
        ["remove", "Quitar", false],
      ].forEach(([action, label, disabled]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.dataset.blockAction = action;
        button.dataset.blockId = block.id;
        button.disabled = Boolean(disabled);
        actions.append(button);
      });
      header.append(meta, actions);
      article.append(header);

      const fields = document.createElement("div");
      fields.className = "news-editor-block__fields";
      if (block.type === "paragraph") {
        fields.append(buildLabel("Texto", buildTextControl(block, "text", { multiline: true, placeholder: "Escribí uno o varios párrafos. Para sumar un enlace usá [texto](https://url).", maxLength: 16000 })));
      } else if (block.type === "heading") {
        fields.append(buildLabel("Subtítulo", buildTextControl(block, "text", { placeholder: "Un subtítulo que ordene la lectura", maxLength: 220 })));
      } else if (block.type === "quote") {
        fields.append(buildLabel("Cita", buildTextControl(block, "text", { multiline: true, placeholder: "Cita textual o una idea central", maxLength: 1200 })));
        fields.append(buildLabel("Fuente de la cita", buildTextControl(block, "cite", { placeholder: "Nombre, documento o medio", maxLength: 180 })));
      } else if (block.type === "image") {
        const imageLayout = document.createElement("div");
        imageLayout.className = "news-inline-editor";
        const visual = document.createElement("div");
        visual.className = "news-inline-editor__preview";
        const source = block.localPreview || block.url;
        if (source) {
          const image = document.createElement("img");
          image.src = source;
          image.alt = block.alt || "Vista previa de imagen";
          visual.append(image);
        } else {
          visual.textContent = "La imagen se verá aquí";
        }
        const details = document.createElement("div");
        const file = document.createElement("input");
        file.type = "file";
        file.accept = "image/jpeg,image/png,image/webp,image/avif";
        file.dataset.blockFile = "";
        file.dataset.blockId = block.id;
        details.append(buildLabel("Archivo", file));
        details.append(buildLabel("Texto alternativo", buildTextControl(block, "alt", { placeholder: "Qué muestra la imagen", maxLength: 300 })));
        details.append(buildLabel("Epígrafe", buildTextControl(block, "caption", { multiline: true, placeholder: "Contexto, fuente o crédito", maxLength: 600 })));
        imageLayout.append(visual, details);
        fields.append(imageLayout);
      } else if (block.type === "embed") {
        const link = buildTextControl(block, "url", { placeholder: "Pegá el enlace de una publicación de X o Instagram", maxLength: 2000 });
        link.type = "url";
        fields.append(buildLabel("URL de X o Instagram", link));
        const help = document.createElement("small");
        help.className = "admin-seo-help";
        help.textContent = "Admite enlaces de x.com, twitter.com e instagram.com/p, /reel o /tv.";
        fields.append(help);
      }
      article.append(fields);
      list.append(article);
    });
  }

  function coverPreview(form) {
    const target = form.querySelector("[data-news-cover-preview]");
    if (!target) return;
    const existing = form.dataset.coverPreview || form.elements.imagen_url.value || "";
    target.replaceChildren();
    if (!existing) {
      const text = document.createElement("span");
      text.textContent = "La portada se verá aquí";
      target.append(text);
      return;
    }
    const image = document.createElement("img");
    image.src = existing;
    image.alt = form.elements.imagen_alt.value || "Vista previa de la portada";
    target.append(image);
  }

  function payloadFromForm(form) {
    const data = new FormData(form);
    return {
      action: "save",
      id: String(data.get("id") || "").trim(),
      titulo: String(data.get("titulo") || "").trim(),
      subtitulo: String(data.get("subtitulo") || "").trim(),
      seccion: String(data.get("seccion") || "").trim(),
      fecha: String(data.get("fecha") || "").trim(),
      autor: String(data.get("autor") || "").trim(),
      slug: String(data.get("slug") || "").trim(),
      imagen_url: String(data.get("imagen_url") || "").trim(),
      imagen_alt: String(data.get("imagen_alt") || "").trim(),
      imagen_epigrafe: String(data.get("imagen_epigrafe") || "").trim(),
      seo_title: String(data.get("seo_title") || "").trim(),
      seo_description: String(data.get("seo_description") || "").trim(),
      seo_keywords: String(data.get("seo_keywords") || "").trim(),
      radiografia_id: String(data.get("radiografia_id") || "").trim(),
      contenido: blocks.map(({ id, file, localPreview, ...block }) => block),
    };
  }

  function previewItem(form) {
    const payload = payloadFromForm(form);
    return {
      ...payload,
      imagen_url: form.dataset.coverPreview || payload.imagen_url,
      contenido: blocks.map(({ file, localPreview, ...block }) => (
        block.type === "image" && localPreview ? { ...block, url: localPreview } : block
      )),
      seccion: payload.seccion || "Actualidad",
      titulo: payload.titulo || "Titular de la nota",
      subtitulo: payload.subtitulo || "La bajada de la nota aparecerá debajo del titular.",
      autor: payload.autor || "Consultora Diagonales",
      fecha: payload.fecha || new Date().toISOString().slice(0, 10),
      lectura_minutos: Math.max(1, Math.ceil(blocks.filter((block) => block.type === "paragraph").map((block) => String(block.text || "").split(/\s+/).filter(Boolean).length).reduce((total, words) => total + words, 0) / 220)),
    };
  }

  function updatePreview() {
    const form = document.querySelector("[data-admin-news-form]");
    const target = document.querySelector("[data-news-preview]");
    if (!form || !target) return;
    if (!window.CDNewsRenderer?.renderArticle) {
      target.innerHTML = '<div class="empty-state">La vista previa no está disponible.</div>';
      return;
    }
    window.CDNewsRenderer.renderArticle(previewItem(form), target, { preview: true });
  }

  function updateEditorState(text) {
    const target = document.querySelector("[data-news-editor-state]");
    if (target) target.textContent = text;
  }

  function resetForm() {
    const form = document.querySelector("[data-admin-news-form]");
    if (!form) return;
    form.reset();
    form.elements.id.value = "";
    form.elements.fecha.value = new Date().toISOString().slice(0, 10);
    form.elements.autor.value = "Consultora Diagonales";
    form.elements.imagen_url.value = "";
    form.dataset.slugTouched = "";
    form.dataset.seoTitleTouched = "";
    form.dataset.seoDescriptionTouched = "";
    form.dataset.coverPreview = "";
    form.querySelector("[data-news-report-select]").innerHTML = reportOptions();
    blocks = [];
    renderBlocks();
    coverPreview(form);
    updateCounters(form);
    updateEditorState("Borrador nuevo");
    status("");
    updatePreview();
  }

  function fillForm(item) {
    const form = document.querySelector("[data-admin-news-form]");
    if (!form) return;
    ["id", "titulo", "subtitulo", "seccion", "fecha", "autor", "slug", "imagen_url", "imagen_alt", "imagen_epigrafe", "seo_title", "seo_description"].forEach((key) => {
      if (form.elements[key]) form.elements[key].value = item[key] || "";
    });
    form.elements.seo_keywords.value = Array.isArray(item.seo_keywords) ? item.seo_keywords.join(", ") : item.seo_keywords || "";
    form.querySelector("[data-news-report-select]").innerHTML = reportOptions(item.radiografia_id || "");
    form.dataset.slugTouched = "true";
    form.dataset.seoTitleTouched = "true";
    form.dataset.seoDescriptionTouched = "true";
    blocks = existingBlocks(item);
    renderBlocks();
    coverPreview(form);
    updateCounters(form);
    updateEditorState("Editando borrador");
    status("Editando borrador. Los cambios se ven a la derecha antes de publicar.");
    updatePreview();
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function storedItems() {
    try {
      return JSON.parse(document.querySelector("[data-admin-news-list]")?.dataset.items || "[]");
    } catch (_) {
      return [];
    }
  }

  function articleUrl(slug) {
    return window.CDNewsRenderer?.articleUrl?.(slug) || `${window.location.origin}/noticias/nota.html?slug=${encodeURIComponent(slug || "")}`;
  }

  async function loadNews() {
    const data = await request("admin-manage-news");
    const container = document.querySelector("[data-admin-news-list]");
    if (!container) return;
    const items = Array.isArray(data.news) ? data.news : [];
    if (!items.length) {
      container.innerHTML = '<div class="admin-list-item"><span>Todavía no hay notas cargadas.</span></div>';
      container.dataset.items = "[]";
      return;
    }
    container.innerHTML = items.map((item) => {
      const blockCount = Array.isArray(item.contenido) ? item.contenido.length : 0;
      const hasCover = item.imagen_url ? "Portada cargada" : "Sin portada";
      const actions = item.estado === "draft"
        ? `<button class="secondary-link" type="button" data-news-edit="${escapeHtml(item.id)}">Editar</button><button class="primary-link" type="button" data-news-publish="${escapeHtml(item.id)}">Publicar</button><button class="admin-danger-link" type="button" data-news-delete="${escapeHtml(item.id)}">Eliminar</button>`
        : `<a class="secondary-link" href="${escapeHtml(articleUrl(item.slug))}" target="_blank" rel="noopener noreferrer">Abrir</a><button class="secondary-link" type="button" data-news-duplicate="${escapeHtml(item.id)}">Crear actualización</button>`;
      return `<article class="admin-news-item">
        <div><span class="admin-news-state admin-news-state--${escapeHtml(item.estado)}">${stateLabel(item.estado)}</span><time>${dateLabel(item.published_at || item.fecha)}</time></div>
        <strong>${escapeHtml(item.titulo)}</strong>
        <small>${escapeHtml(item.subtitulo)} · ${blockCount} bloque${blockCount === 1 ? "" : "s"} · ${hasCover}</small>
        <div class="admin-news-item__actions">${actions}</div>
      </article>`;
    }).join("");
    container.dataset.items = JSON.stringify(items);
  }

  function setSaving(isSaving) {
    document.querySelectorAll("[data-news-save], [data-news-publish-current]").forEach((button) => { button.disabled = isSaving; });
  }

  async function saveArticle({ publish = false } = {}) {
    const form = document.querySelector("[data-admin-news-form]");
    if (!form) return;
    if (!form.reportValidity()) return;
    if (publish && !blocks.length) {
      status("Agregá al menos un bloque editorial antes de publicar.", "error");
      return;
    }
    const coverFile = form.elements.foto_nota.files?.[0];
    if (coverFile && !form.elements.imagen_alt.value.trim()) {
      status("La foto de portada necesita texto alternativo.", "error");
      form.elements.imagen_alt.focus();
      return;
    }
    const imageWithoutAlt = blocks.find((block) => block.type === "image" && block.file && !String(block.alt || "").trim());
    if (imageWithoutAlt) {
      status("Cada imagen interna necesita texto alternativo.", "error");
      return;
    }
    setSaving(true);
    status(publish ? "Guardando y preparando la publicación." : "Guardando borrador.");
    try {
      let saved = await request("admin-manage-news", { method: "POST", body: JSON.stringify(payloadFromForm(form)) });
      form.elements.id.value = saved.news.id;
      let hasMediaUpdates = false;
      if (coverFile) {
        const media = await uploadNewsMedia(saved.news.id, coverFile, "cover");
        form.elements.imagen_url.value = media.url;
        form.elements.foto_nota.value = "";
        form.dataset.coverPreview = "";
        hasMediaUpdates = true;
      }
      for (const block of blocks) {
        if (block.type !== "image" || !block.file) continue;
        const media = await uploadNewsMedia(saved.news.id, block.file, "inline");
        block.url = media.url;
        block.file = null;
        block.localPreview = "";
        hasMediaUpdates = true;
      }
      if (hasMediaUpdates) {
        saved = await request("admin-manage-news", { method: "POST", body: JSON.stringify(payloadFromForm(form)) });
        renderBlocks();
        coverPreview(form);
      }
      if (publish) {
        saved = await request("admin-manage-news", { method: "POST", body: JSON.stringify({ action: "publish", id: saved.news.id }) });
        await Promise.all([loadNews(), loadReports()]);
        resetForm();
        status("Nota publicada en el inicio. Las anteriores quedan en el archivo de Noticias.", "success");
      } else {
        updateEditorState("Borrador guardado");
        await loadNews();
        status("Borrador guardado. Revisá la vista previa y publicalo cuando esté listo.", "success");
        updatePreview();
      }
    } catch (error) {
      status(error.message || "No se pudo guardar la nota.", "error");
    } finally {
      setSaving(false);
    }
  }

  function bind() {
    const form = document.querySelector("[data-admin-news-form]");
    const list = document.querySelector("[data-admin-news-list]");
    const blockList = document.querySelector("[data-news-block-list]");
    if (!form || !list || !blockList) return;
    resetForm();

    form.addEventListener("input", (event) => {
      const target = event.target;
      if (target.name === "titulo") {
        if (form.dataset.slugTouched !== "true") form.elements.slug.value = slugify(target.value);
        if (form.dataset.seoTitleTouched !== "true") form.elements.seo_title.value = target.value.slice(0, 70);
      }
      if (target.name === "subtitulo" && form.dataset.seoDescriptionTouched !== "true") form.elements.seo_description.value = target.value.slice(0, 180);
      if (target.name === "slug") form.dataset.slugTouched = "true";
      if (target.name === "seo_title") form.dataset.seoTitleTouched = "true";
      if (target.name === "seo_description") form.dataset.seoDescriptionTouched = "true";
      updateCounters(form);
      if (["imagen_alt", "imagen_epigrafe"].includes(target.name)) coverPreview(form);
      updatePreview();
    });

    form.querySelector("[data-news-cover-file]").addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (form.dataset.coverPreview) URL.revokeObjectURL(form.dataset.coverPreview);
      form.dataset.coverPreview = file ? URL.createObjectURL(file) : "";
      coverPreview(form);
    });

    form.querySelectorAll("[data-news-add-block]").forEach((button) => {
      button.addEventListener("click", () => {
        blocks.push(newBlock(button.dataset.newsAddBlock));
        renderBlocks();
        updatePreview();
      });
    });

    blockList.addEventListener("input", (event) => {
      const target = event.target.closest("[data-block-field]");
      if (!target) return;
      const block = blocks.find((item) => item.id === target.dataset.blockId);
      if (!block) return;
      block[target.dataset.blockField] = target.value;
      updatePreview();
    });

    blockList.addEventListener("change", (event) => {
      const target = event.target.closest("[data-block-file]");
      if (!target) return;
      const block = blocks.find((item) => item.id === target.dataset.blockId);
      const file = target.files?.[0];
      if (!block || !file) return;
      if (block.localPreview) URL.revokeObjectURL(block.localPreview);
      block.file = file;
      block.localPreview = URL.createObjectURL(file);
      renderBlocks();
    });

    blockList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-block-action]");
      if (!button) return;
      const index = blocks.findIndex((item) => item.id === button.dataset.blockId);
      if (index < 0) return;
      if (button.dataset.blockAction === "remove") {
        if (blocks[index].localPreview) URL.revokeObjectURL(blocks[index].localPreview);
        blocks.splice(index, 1);
      } else if (button.dataset.blockAction === "up" && index > 0) {
        [blocks[index - 1], blocks[index]] = [blocks[index], blocks[index - 1]];
      } else if (button.dataset.blockAction === "down" && index < blocks.length - 1) {
        [blocks[index + 1], blocks[index]] = [blocks[index], blocks[index + 1]];
      }
      renderBlocks();
      updatePreview();
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      saveArticle();
    });
    form.querySelector("[data-news-publish-current]").addEventListener("click", () => saveArticle({ publish: true }));
    form.querySelector("[data-news-cancel]").addEventListener("click", resetForm);
    form.querySelector("[data-news-refresh-preview]").addEventListener("click", updatePreview);

    list.addEventListener("click", async (event) => {
      const edit = event.target.closest("[data-news-edit]");
      const publish = event.target.closest("[data-news-publish]");
      const remove = event.target.closest("[data-news-delete]");
      const duplicate = event.target.closest("[data-news-duplicate]");
      const selected = edit || publish || remove || duplicate;
      if (!selected) return;
      const id = selected.dataset.newsEdit || selected.dataset.newsPublish || selected.dataset.newsDelete || selected.dataset.newsDuplicate;
      const item = storedItems().find((entry) => entry.id === id);
      if (edit && item) {
        fillForm(item);
        return;
      }
      if (remove && !window.confirm("¿Eliminar este borrador?")) return;
      selected.disabled = true;
      try {
        if (duplicate) {
          const data = await request("admin-manage-news", { method: "POST", body: JSON.stringify({ action: "duplicate", id }) });
          await loadNews();
          fillForm(data.news);
          status("Se creó una actualización en borrador a partir de la nota publicada.", "success");
        } else if (publish) {
          await request("admin-manage-news", { method: "POST", body: JSON.stringify({ action: "publish", id }) });
          await Promise.all([loadNews(), loadReports()]);
          status("Nota publicada en el inicio.", "success");
        } else if (remove) {
          await request("admin-manage-news", { method: "POST", body: JSON.stringify({ action: "delete", id }) });
          await loadNews();
          status("Borrador eliminado.", "success");
        }
      } catch (error) {
        status(error.message || "No se pudo completar la acción.", "error");
      } finally {
        selected.disabled = false;
      }
    });
  }

  async function unlock() {
    if (started || sessionStorage.getItem(ADMIN_SESSION_KEY) !== "true") return;
    const form = document.querySelector("[data-admin-news-form]");
    if (!form) return;
    started = true;
    form.closest("[data-admin-news]")?.classList.remove("is-hidden");
    bind();
    try {
      await Promise.all([loadReports(), loadNews()]);
      resetForm();
    } catch (error) {
      status(error.message || "No se pudo cargar la gestión editorial.", "error");
    }
  }

  function observe() {
    const reportForm = document.querySelector("[data-admin-form]");
    if (reportForm) new MutationObserver(unlock).observe(reportForm, { attributes: true, attributeFilter: ["class"] });
    unlock();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", observe);
  else observe();
})();
