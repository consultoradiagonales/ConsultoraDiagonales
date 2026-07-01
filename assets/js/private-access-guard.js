(function () {
  const PRIVATE_MARKER = "[[CD_PRIVATE]]";
  const REGISTRATION_URL = "/registro/";
  const API_ENDPOINT = "/api/solicitar-radiografia.php";
  
  let modalOpen = false;

  // Interceptar clics en PDFs y gráficos privados
  document.addEventListener("click", handlePrivateReportClick, true);
  document.addEventListener("DOMContentLoaded", initPrivateGuard);

  function initPrivateGuard() {
    ensureAccessModal();
    checkUrlParams();
  }

  async function handlePrivateReportClick(event) {
    const link = event.target.closest("[data-pdf-download], [data-html-viewer-open]");
    if (!link || event.target.closest(".radiografia-share-link")) return;

    const reports = await getReports();
    const reportIndex = Number(link.dataset.reportIndex);
    const report = reports[reportIndex];

    if (!report) return;

    const isPrivate = isPrivateReport(report);
    if (!isPrivate) return; // Dejar pasar públicos

    const hasAccess = hasValidRegistration(report.id);
    if (!hasAccess) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openAccessModal(report);
      return;
    }
  }

  function isPrivateReport(report) {
    return (
      report?.is_private === true ||
      String(report?.is_private || "").toLowerCase() === "true" ||
      String(report?.localidad || "").includes(PRIVATE_MARKER) ||
      String(report?.provincia || "").includes(PRIVATE_MARKER)
    );
  }

  function hasValidRegistration(reportId) {
    const registrations = JSON.parse(localStorage.getItem("cd:private_registrations") || "{}");
    const reg = registrations[reportId];
    if (!reg) return false;
    
    // Validar que el email esté confirmado o que tenga token válido
    const now = Date.now();
    return (reg.verified === true || reg.expiresAt > now);
  }

  function openAccessModal(report) {
    if (modalOpen) return;
    
    const modal = document.getElementById("private-access-modal");
    if (!modal) {
      ensureAccessModal();
      return openAccessModal(report);
    }

    modalOpen = true;
    const form = modal.querySelector("[data-registration-form]");
    const title = modal.querySelector("[data-modal-title]");

    if (title) title.textContent = `Acceso: ${escapeHtml(report.titulo || "Radiografía")}`;
    
    if (form) {
      form.dataset.reportId = report.id;
      form.reset();
      form.querySelector("[name='radiografiaId']").value = report.id;
    }

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    modal.querySelector("[data-close-modal]")?.focus();
  }

  function closeAccessModal() {
    const modal = document.getElementById("private-access-modal");
    if (modal) {
      modal.hidden = true;
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }
    modalOpen = false;
  }

  function ensureAccessModal() {
    if (document.getElementById("private-access-modal")) return;

    document.body.insertAdjacentHTML(
      "beforeend",
      `
      <div id="private-access-modal" class="access-modal" hidden aria-hidden="true">
        <div class="access-modal__overlay" data-close-modal></div>
        <div class="access-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="access-modal-title">
          <button class="access-modal__close" type="button" aria-label="Cerrar" data-close-modal>×</button>
          <div class="access-modal__content">
            <h2 id="access-modal-title" class="access-modal__title" data-modal-title>Acceso a radiografía privada</h2>
            <p class="access-modal__description">
              Esta radiografía es privada. Completá tu información para acceder.
            </p>
            
            <form class="access-modal__form" data-registration-form>
              <input type="hidden" name="radiografiaId" />
              
              <label class="access-modal__label">
                <span>Nombre completo</span>
                <input 
                  type="text" 
                  name="nombre" 
                  placeholder="Tu nombre" 
                  required 
                  autocomplete="name"
                  minlength="3"
                />
              </label>

              <label class="access-modal__label">
                <span>Email</span>
                <input 
                  type="email" 
                  name="email" 
                  placeholder="tu@email.com" 
                  required 
                  autocomplete="email"
                />
              </label>

              <label class="access-modal__label">
                <span>Teléfono (opcional)</span>
                <input 
                  type="tel" 
                  name="telefono" 
                  placeholder="+54 9 ..." 
                  autocomplete="tel"
                />
              </label>

              <label class="access-modal__label">
                <span>Organización (opcional)</span>
                <input 
                  type="text" 
                  name="organizacion" 
                  placeholder="Tu organización" 
                  autocomplete="organization"
                />
              </label>

              <button type="submit" class="access-modal__button access-modal__button--primary">
                Solicitar acceso
              </button>
              
              <p class="access-modal__status" role="status" data-modal-status></p>
            </form>
          </div>
        </div>
      </div>

      <style>
        .access-modal {
          position: fixed;
          top: 0;
          left: 0;
          z-index: 9999;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }

        .access-modal[aria-hidden="true"] {
          display: none;
        }

        .access-modal__overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          cursor: pointer;
        }

        .access-modal__dialog {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 480px;
          border-radius: 12px;
          background: linear-gradient(180deg, rgba(3, 30, 45, 0.95), rgba(5, 44, 62, 0.98));
          border: 1px solid rgba(139, 207, 241, 0.28);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
          padding: 2rem;
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .access-modal__close {
          position: absolute;
          top: 1rem;
          right: 1rem;
          width: 32px;
          height: 32px;
          border: none;
          background: rgba(139, 207, 241, 0.1);
          border-radius: 50%;
          color: rgba(219, 246, 255, 0.8);
          font-size: 1.5rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .access-modal__close:hover {
          background: rgba(139, 207, 241, 0.2);
          color: #dbf6ff;
        }

        .access-modal__content {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .access-modal__title {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 900;
          color: #dbf6ff;
          line-height: 1.2;
        }

        .access-modal__description {
          margin: 0;
          font-size: 0.95rem;
          color: rgba(219, 246, 255, 0.75);
          line-height: 1.5;
        }

        .access-modal__form {
          display: grid;
          gap: 1rem;
        }

        .access-modal__label {
          display: grid;
          gap: 0.4rem;
          font-size: 0.85rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: rgba(130, 216, 255, 0.9);
        }

        .access-modal__label input {
          min-height: 40px;
          padding: 0.5rem 0.75rem;
          border: 1px solid rgba(139, 207, 241, 0.28);
          border-radius: 6px;
          background: rgba(3, 8, 13, 0.6);
          color: #dbf6ff;
          font-size: 0.95rem;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s;
        }

        .access-modal__label input:focus {
          border-color: rgba(139, 207, 241, 0.55);
          background: rgba(3, 8, 13, 0.8);
        }

        .access-modal__label input::placeholder {
          color: rgba(219, 246, 255, 0.45);
        }

        .access-modal__button {
          min-height: 40px;
          border: 1px solid rgba(139, 207, 241, 0.36);
          border-radius: 6px;
          padding: 0.6rem 1.2rem;
          background: rgba(2, 39, 64, 0.5);
          color: #dbf6ff;
          font-size: 0.85rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s;
        }

        .access-modal__button:hover:not(:disabled) {
          border-color: rgba(139, 207, 241, 0.55);
          background: rgba(2, 39, 64, 0.8);
        }

        .access-modal__button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .access-modal__button--primary {
          border-color: rgba(130, 216, 255, 0.4);
          background: rgba(34, 166, 194, 0.25);
          color: #82d8ff;
        }

        .access-modal__button--primary:hover:not(:disabled) {
          border-color: rgba(130, 216, 255, 0.6);
          background: rgba(34, 166, 194, 0.35);
        }

        .access-modal__status {
          margin: 0;
          min-height: 1.2rem;
          font-size: 0.85rem;
          color: rgba(219, 246, 255, 0.75);
          line-height: 1.4;
        }

        .access-modal__status.is-error {
          color: #ffa6a6;
        }

        .access-modal__status.is-success {
          color: #82d8ff;
        }

        @media (max-width: 640px) {
          .access-modal {
            padding: 1rem;
          }

          .access-modal__dialog {
            padding: 1.5rem;
          }

          .access-modal__title {
            font-size: 1.25rem;
          }

          .access-modal__label input {
            min-height: 36px;
            font-size: 16px;
          }
        }
      </style>
    `
    );

    const modal = document.getElementById("private-access-modal");
    const overlay = modal.querySelector(".access-modal__overlay");
    const closeBtn = modal.querySelector("[data-close-modal]");
    const form = modal.querySelector("[data-registration-form]");

    overlay.addEventListener("click", closeAccessModal);
    closeBtn.addEventListener("click", closeAccessModal);
    
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.hidden) closeAccessModal();
    });

    form.addEventListener("submit", handleRegistrationSubmit);
  }

  async function handleRegistrationSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const status = form.querySelector("[data-modal-status]");
    const submit = form.querySelector('button[type="submit"]');
    const reportId = form.dataset.reportId;

    const formData = {
      radiografiaId: reportId,
      nombre: form.querySelector("[name='nombre']").value.trim(),
      email: form.querySelector("[name='email']").value.trim().toLowerCase(),
      telefono: form.querySelector("[name='telefono']").value.trim(),
      organizacion: form.querySelector("[name='organizacion']").value.trim(),
    };

    if (!formData.nombre || !formData.email) {
      status.textContent = "Nombre y email son requeridos";
      status.classList.add("is-error");
      return;
    }

    submit.disabled = true;
    status.textContent = "Enviando solicitud...";
    status.classList.remove("is-error", "is-success");

    try {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "No se pudo procesar la solicitud");
      }

      // Guardar el registro localmente
      const registrations = JSON.parse(localStorage.getItem("cd:private_registrations") || "{}");
      registrations[reportId] = {
        verified: response.ok && data.success,
        email: formData.email,
        timestamp: Date.now(),
        expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 días
      };
      localStorage.setItem("cd:private_registrations", JSON.stringify(registrations));

      status.textContent = data.message || "✓ Solicitud registrada. El administrador revisará tu acceso pronto.";
      status.classList.add("is-success");

      setTimeout(() => {
        closeAccessModal();
      }, 2000);
    } catch (error) {
      status.textContent = `Error: ${error.message}`;
      status.classList.add("is-error");
    } finally {
      submit.disabled = false;
    }
  }

  async function getReports() {
    const config = window.CD_SUPABASE || {};
    const url = new URL("/rest/v1/radiografias", config.url);
    url.searchParams.set("select", "id,titulo,provincia,localidad,fecha,html_url,pdf_url,is_private,created_at");
    url.searchParams.append("order", "fecha.desc");
    url.searchParams.append("order", "created_at.desc");

    try {
      const response = await fetch(url.href, {
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
        },
      });

      if (!response.ok) throw new Error("No se pudo cargar las radiografías");
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.warn("Error loading reports:", error);
      return [];
    }
  }

  function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.has("registration_success")) {
      const status = document.querySelector("[data-modal-status]");
      if (status) {
        status.textContent = "✓ Registro completado. Ahora puedes acceder.";
        status.classList.add("is-success");
      }
      // Limpiar URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  function escapeHtml(text) {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return String(text).replace(/[&<>"']/g, (char) => map[char]);
  }
})();
