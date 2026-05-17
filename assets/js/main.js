const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
const SUPABASE_ANON_KEY = "TU_SUPABASE_ANON_KEY";
const RENDER_SAMPLE_DATA_WHEN_UNCONFIGURED = true;

const sampleReports = [
  {
    titulo: "Radiografia politica de Buenos Aires",
    provincia: "Buenos Aires",
    fecha: "2026-05-01",
    pdf_url: "#",
  },
  {
    titulo: "Mapa territorial y opinion publica",
    provincia: "Santa Fe",
    fecha: "2026-04-18",
    pdf_url: "#",
  },
  {
    titulo: "Escenarios electorales provinciales",
    provincia: "Cordoba",
    fecha: "2026-03-28",
    pdf_url: "#",
  },
];

const page = document.body.dataset.page;
const isConfigured = !SUPABASE_URL.includes("TU-PROYECTO") && !SUPABASE_ANON_KEY.includes("TU_SUPABASE");
const supabaseClient = isConfigured && window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

initNavigation();
initLogoFallbacks();

if (page === "repo") {
  loadReports();
}

if (page === "admin") {
  initAdmin();
}

function initNavigation() {
  const header = document.querySelector("[data-header]");
  const toggle = document.querySelector("[data-menu-toggle]");
  const menu = document.querySelector("[data-mobile-menu]");

  const onScroll = () => {
    if (!header || header.classList.contains("is-solid")) return;
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  };

  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  if (!toggle || !menu) return;

  toggle.addEventListener("click", () => {
    const open = !menu.classList.contains("is-open");
    menu.classList.toggle("is-open", open);
    toggle.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-hidden", String(!open));
    document.body.style.overflow = open ? "hidden" : "";
  });

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menu.classList.remove("is-open");
      toggle.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      menu.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    });
  });
}

function initLogoFallbacks() {
  document.querySelectorAll("[data-logo]").forEach((image) => {
    image.addEventListener(
      "error",
      () => {
        image.classList.add("is-missing");
      },
      { once: true },
    );
  });
}

async function loadReports() {
  const container = document.querySelector("[data-reports]");
  const count = document.querySelector("[data-count]");
  if (!container) return;

  try {
    let reports = sampleReports;

    if (supabaseClient) {
      const { data, error } = await supabaseClient
        .from("radiografias")
        .select("titulo, provincia, fecha, pdf_url, created_at")
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      reports = data || [];
    } else if (!RENDER_SAMPLE_DATA_WHEN_UNCONFIGURED) {
      reports = [];
    }

    renderReports(reports, container, count);
  } catch (error) {
    container.innerHTML = `<div class="empty-state">No pudimos cargar las radiografias. ${escapeHtml(error.message)}</div>`;
  }
}

function renderReports(reports, container, count) {
  if (count) {
    count.textContent = `${reports.length} ${reports.length === 1 ? "radiografia" : "radiografias"}`;
  }

  if (!reports.length) {
    container.innerHTML = '<div class="empty-state">Todavia no hay radiografias publicadas.</div>';
    return;
  }

  container.innerHTML = reports
    .map((report) => {
      const date = formatDate(report.fecha);
      const title = escapeHtml(report.titulo || "Radiografia sin titulo");
      const province = escapeHtml(report.provincia || "Territorio");
      const href = report.pdf_url ? escapeAttribute(report.pdf_url) : "#";
      return `
        <article class="report-card">
          <div>
            <div class="report-meta">
              <span>${province}</span>
              <time datetime="${escapeAttribute(report.fecha || "")}">${date}</time>
            </div>
            <h2>${title}</h2>
          </div>
          <a class="download-link" href="${href}" target="_blank" rel="noopener">Descargar PDF</a>
        </article>
      `;
    })
    .join("");
}

function initAdmin() {
  const form = document.querySelector("[data-admin-form]");
  const status = document.querySelector("[data-form-status]");
  const submit = document.querySelector("[data-submit]");
  if (!form) return;

  if (!supabaseClient) {
    status.textContent = "Supabase todavia no esta configurado. Edita assets/js/main.js para habilitar la carga.";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!supabaseClient) {
      status.textContent = "Configura SUPABASE_URL y SUPABASE_ANON_KEY antes de guardar.";
      return;
    }

    const formData = new FormData(form);
    const file = formData.get("pdf");
    const titulo = String(formData.get("titulo") || "").trim();
    const provincia = String(formData.get("provincia") || "").trim();
    const fecha = String(formData.get("fecha") || "").trim();

    if (!file || file.type !== "application/pdf") {
      status.textContent = "Selecciona un PDF valido.";
      return;
    }

    submit.disabled = true;
    submit.textContent = "Guardando...";
    status.textContent = "Subiendo PDF y publicando metadata.";

    try {
      const cleanName = file.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9.]+/g, "-")
        .replace(/-+/g, "-");
      const path = `${fecha}/${crypto.randomUUID()}-${cleanName}`;

      const { error: uploadError } = await supabaseClient.storage
        .from("radiografias")
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabaseClient.storage.from("radiografias").getPublicUrl(path);
      const pdf_url = publicData.publicUrl;

      const { error: insertError } = await supabaseClient.from("radiografias").insert({
        titulo,
        provincia,
        fecha,
        pdf_url,
      });

      if (insertError) throw insertError;

      form.reset();
      status.innerHTML = `Radiografia publicada. <a href="${escapeAttribute(pdf_url)}" target="_blank" rel="noopener">Abrir PDF</a>`;
    } catch (error) {
      status.textContent = `No se pudo guardar: ${error.message}`;
    } finally {
      submit.disabled = false;
      submit.textContent = "Guardar radiografia";
    }
  });
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
