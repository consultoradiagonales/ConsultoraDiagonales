(function () {
  const ADMIN_SESSION_KEY = "cd:admin_unlocked";
  const ADMIN_UPLOAD_KEY = "cd:admin_upload_key";
  let reports = [];
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

  async function uploadNewsPdf(id, file) {
    const formData = new FormData();
    formData.append("id", id);
    formData.append("pdf_nota", file);
    const response = await fetch(apiUrl("admin-upload-news-pdf"), { method: "POST", headers: adminHeaders(false), body: formData });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }

  function status(message, tone = "") {
    const target = document.querySelector("[data-news-status]");
    if (!target) return;
    target.textContent = message;
    target.dataset.tone = tone;
  }

  function reportOptions(selected = "") {
    const completeReports = reports.filter((report) => report.pdf_url && report.html_url);
    if (!completeReports.length) return '<option value="">Cargá primero el PDF y el HTML de la radiografía.</option>';
    return ['<option value="">Elegí una radiografía</option>']
      .concat(completeReports.map((report) => {
        const state = report.publication_state === "draft" ? "Borrador" : report.publication_state === "unlisted" ? "Vigente" : "Repositorio";
        return `<option value="${escapeHtml(report.id)}"${report.id === selected ? " selected" : ""}>${escapeHtml(report.titulo || "Sin título")} · ${state}</option>`;
      }))
      .join("");
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

  function dateLabel(value) {
    if (!value) return "Sin fecha";
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime()) ? "Sin fecha" : new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
  }

  function stateLabel(value) {
    return value === "featured" ? "En portada" : value === "archived" ? "En Noticias" : "Borrador";
  }

  async function loadNews() {
    const data = await request("admin-manage-news");
    const container = document.querySelector("[data-admin-news-list]");
    if (!container) return;
    const items = Array.isArray(data.news) ? data.news : [];
    if (!items.length) {
      container.innerHTML = '<div class="admin-list-item"><span>Todavía no hay notas cargadas.</span></div>';
      return;
    }
    container.innerHTML = items.map((item) => `
      <article class="admin-news-item">
        <div><span class="admin-news-state admin-news-state--${escapeHtml(item.estado)}">${stateLabel(item.estado)}</span><time>${dateLabel(item.published_at || item.fecha)}</time></div>
        <strong>${escapeHtml(item.titulo)}</strong>
        <small>${escapeHtml(item.subtitulo)} · ${item.pdf_url ? "PDF periodístico cargado" : "Falta PDF periodístico"}</small>
        <div class="admin-news-item__actions">
          ${item.estado === "draft" ? `<button class="secondary-link" type="button" data-news-edit="${escapeHtml(item.id)}">Editar</button><button class="primary-link" type="button" data-news-publish="${escapeHtml(item.id)}">Publicar</button><button class="admin-danger-link" type="button" data-news-delete="${escapeHtml(item.id)}">Eliminar</button>` : ""}
        </div>
      </article>`).join("");
    container.dataset.items = JSON.stringify(items);
  }

  function storedItems() {
    try {
      return JSON.parse(document.querySelector("[data-admin-news-list]")?.dataset.items || "[]");
    } catch (_) {
      return [];
    }
  }

  function resetForm() {
    const form = document.querySelector("[data-admin-news-form]");
    if (!form) return;
    form.reset();
    form.elements.id.value = "";
    form.elements.fecha.value = new Date().toISOString().slice(0, 10);
    form.querySelector("[data-news-save]").textContent = "Guardar borrador";
    form.querySelector("[data-news-cancel]").classList.add("is-hidden");
    form.querySelector("[data-news-report-select]").innerHTML = reportOptions();
    status("");
  }

  function fillForm(item) {
    const form = document.querySelector("[data-admin-news-form]");
    if (!form) return;
    Object.entries({
      id: item.id,
      titulo: item.titulo,
      subtitulo: item.subtitulo,
      seccion: item.seccion,
      fecha: item.fecha,
    }).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value || ""; });
    form.querySelector("[data-news-report-select]").innerHTML = reportOptions(item.radiografia_id);
    form.querySelector("[data-news-save]").textContent = "Actualizar borrador";
    form.querySelector("[data-news-cancel]").classList.remove("is-hidden");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    status("Editando borrador.");
  }

  function formPayload(form) {
    const data = new FormData(form);
    return {
      action: "save",
      id: String(data.get("id") || "").trim(),
      titulo: String(data.get("titulo") || "").trim(),
      subtitulo: String(data.get("subtitulo") || "").trim(),
      seccion: String(data.get("seccion") || "").trim(),
      fecha: String(data.get("fecha") || "").trim(),
      radiografia_id: String(data.get("radiografia_id") || "").trim(),
    };
  }

  function bind() {
    const form = document.querySelector("[data-admin-news-form]");
    const list = document.querySelector("[data-admin-news-list]");
    if (!form || !list) return;
    resetForm();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("[data-news-save]");
      const formData = new FormData(form);
      const existingId = String(formData.get("id") || "").trim();
      const pdfFile = formData.get("pdf_nota");
      const hasPdf = pdfFile instanceof File && pdfFile.size > 0;
      if (!existingId && !hasPdf) {
        status("Cargá el PDF periodístico antes de guardar el borrador.", "error");
        return;
      }
      button.disabled = true;
      status("Guardando borrador.");
      try {
        const saved = await request("admin-manage-news", { method: "POST", body: JSON.stringify(formPayload(form)) });
        if (hasPdf) await uploadNewsPdf(saved.news.id, pdfFile);
        await Promise.all([loadNews(), loadReports()]);
        resetForm();
        status("Borrador guardado. Publicalo cuando quieras reemplazar la nota de portada.", "success");
      } catch (error) {
        status(error.message || "No se pudo guardar la nota.", "error");
      } finally {
        button.disabled = false;
      }
    });

    form.querySelector("[data-news-cancel]").addEventListener("click", resetForm);
    list.addEventListener("click", async (event) => {
      const edit = event.target.closest("[data-news-edit]");
      const publish = event.target.closest("[data-news-publish]");
      const remove = event.target.closest("[data-news-delete]");
      if (edit) {
        const item = storedItems().find((entry) => entry.id === edit.dataset.newsEdit);
        if (item) fillForm(item);
        return;
      }
      if (!publish && !remove) return;
      const id = (publish || remove).dataset.newsPublish || (publish || remove).dataset.newsDelete;
      const button = publish || remove;
      button.disabled = true;
      status(publish ? "Publicando nota y actualizando el repositorio." : "Eliminando borrador.");
      try {
        await request("admin-manage-news", { method: "POST", body: JSON.stringify({ action: publish ? "publish" : "delete", id }) });
        await Promise.all([loadNews(), loadReports()]);
        status(publish ? "Nota publicada. La anterior pasó a Noticias y su radiografía al repositorio." : "Borrador eliminado.", "success");
      } catch (error) {
        status(error.message || "No se pudo completar la acción.", "error");
      } finally {
        button.disabled = false;
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
