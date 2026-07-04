(function () {
  const PRIVATE_MARKER = "[[CD_PRIVATE]]";
  const REGISTRATION_URL = "/registro/";
  const CONSULTORA_WHATSAPP = "5492216765720";
  const CONSULTORA_EMAIL = "info.consultoradiagonales@gmail.com";

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

    // Las radiografías privadas NUNCA se abren desde la web:
    // toda persona interesada registra su solicitud (base de datos).
    event.preventDefault();
    event.stopImmediatePropagation();
    openAccessModal(report);
  }

  function isPrivateReport(report) {
    return (
      report?.is_private === true ||
      String(report?.is_private || "").toLowerCase() === "true" ||
      String(report?.localidad || "").includes(PRIVATE_MARKER) ||
      String(report?.provincia || "").includes(PRIVATE_MARKER)
    );
  }

  // Exponer el modal para main.js y pdf-viewer.js
  window.openPrivateReportModal = function (report) {
    openAccessModal(report || {});
  };

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
      form.dataset.reportId = report.id || "";
      form.reset();
      const idField = form.querySelector("[name='radiografiaId']");
      if (idField) idField.value = report.id || "";
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
              Esta radiografía es privada. Elegí cómo querés recibirla (podés marcar ambas opciones). No es obligatorio dejar tu nombre.
            </p>
            
            <form class="access-modal__form" data-registration-form>
              <input type="hidden" name="radiografiaId" />

              <div class="access-modal__channels">
                <label class="access-modal__channel">
                  <input type="checkbox" name="canal_email" data-channel="email" />
                  <span>Recibir por Email</span>
                </label>
                <label class="access-modal__channel">
                  <input type="checkbox" name="canal_whatsapp" data-channel="whatsapp" />
                  <span>Recibir por WhatsApp</span>
                </label>
              </div>

              <label class="access-modal__label" data-field="email" hidden>
                <span>Email</span>
                <input 
                  type="email" 
                  name="email" 
                  placeholder="tu@email.com" 
                  autocomplete="email"
                />
              </label>

              <label class="access-modal__label" data-field="whatsapp" hidden>
                <span>WhatsApp / Celular</span>
                <input 
                  type="tel" 
                  name="telefono" 
                  placeholder="+54 9 ..." 
                  autocomplete="tel"
                />
              </label>

              <label class="access-modal__label">
                <span>Nombre (opcional)</span>
                <input 
                  type="text" 
                  name="nombre" 
                  placeholder="Tu nombre" 
                  autocomplete="name"
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
                Solicitar radiografía
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
          top: 12px;
          right: 12px;
          width: 34px;
          height: 34px;
          border: 1px solid rgba(139, 207, 241, 0.35);
          background: rgba(139, 207, 241, 0.12);
          border-radius: 6px;
          color: #dbf6ff;
          font-size: 1.4rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .access-modal__close:hover {
          background: #C62828;
          border-color: #C62828;
          color: #ffffff;
        }

        .access-modal__channels {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        .access-modal__channel {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.7rem 0.9rem;
          border: 1px solid rgba(139, 207, 241, 0.28);
          border-radius: 8px;
          background: rgba(3, 8, 13, 0.5);
          color: #dbf6ff;
          font-size: 0.82rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s;
          user-select: none;
        }

        .access-modal__channel:hover {
          border-color: rgba(139, 207, 241, 0.55);
        }

        .access-modal__channel:has(input:checked) {
          border-color: #009AFE;
          background: rgba(0, 154, 254, 0.18);
          color: #82d8ff;
        }

        .access-modal__channel input {
          width: 18px;
          height: 18px;
          accent-color: #009AFE;
          cursor: pointer;
        }

        @media (max-width: 480px) {
          .access-modal__channels {
            grid-template-columns: 1fr;
          }
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

    // Mostrar el campo correspondiente al canal elegido (no excluyentes)
    form.querySelectorAll("[data-channel]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const field = form.querySelector(`[data-field="${checkbox.dataset.channel}"]`);
        if (!field) return;
        field.hidden = !checkbox.checked;
        const input = field.querySelector("input");
        if (input) {
          input.required = checkbox.checked;
          if (checkbox.checked) input.focus();
          else input.value = "";
        }
      });
    });

    form.addEventListener("submit", handleRegistrationSubmit);
  }

  async function handleRegistrationSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const status = form.querySelector("[data-modal-status]");
    const submit = form.querySelector('button[type="submit"]');
    const reportId = form.dataset.reportId;

    const wantsEmail = form.querySelector("[name='canal_email']")?.checked === true;
    const wantsWhatsapp = form.querySelector("[name='canal_whatsapp']")?.checked === true;

    const formData = {
      radiografiaId: reportId,
      titulo: getCurrentReportTitle(reportId),
      nombre: form.querySelector("[name='nombre']")?.value.trim() || "",
      email: form.querySelector("[name='email']")?.value.trim().toLowerCase() || "",
      telefono: form.querySelector("[name='telefono']")?.value.trim() || "",
      organizacion: form.querySelector("[name='organizacion']")?.value.trim() || "",
      canales: [wantsEmail ? "email" : "", wantsWhatsapp ? "whatsapp" : ""].filter(Boolean),
    };

    if (!wantsEmail && !wantsWhatsapp) {
      status.textContent = "Elegí al menos un canal: Email o WhatsApp.";
      status.classList.add("is-error");
      return;
    }
    if (wantsEmail && !formData.email) {
      status.textContent = "Marcaste Email: ingresá tu correo.";
      status.classList.add("is-error");
      return;
    }
    if (wantsWhatsapp && !formData.telefono) {
      status.textContent = "Marcaste WhatsApp: ingresá tu celular.";
      status.classList.add("is-error");
      return;
    }

    submit.disabled = true;
    status.textContent = "Enviando solicitud...";
    status.classList.remove("is-error", "is-success");

    try {
      await savePrivateAccessRequest(formData);

      // Registro local de la solicitud (solo constancia, NO habilita acceso)
      const registrations = JSON.parse(localStorage.getItem("cd:private_registrations") || "{}");
      registrations[reportId] = {
        verified: false,
        email: formData.email,
        timestamp: Date.now(),
      };
      localStorage.setItem("cd:private_registrations", JSON.stringify(registrations));

      const canales = formData.canales.map((c) => (c === "email" ? "Email" : "WhatsApp")).join(" y ");
      openSelectedContactChannels(formData);
      status.textContent = `✓ Solicitud registrada. Se abrió ${canales} para enviar el pedido.`;
      status.classList.add("is-success");

      setTimeout(() => {
        closeAccessModal();
      }, 2500);
    } catch (error) {
      status.textContent = `Error: ${error.message}`;
      status.classList.add("is-error");
    } finally {
      submit.disabled = false;
    }
  }

  async function savePrivateAccessRequest(formData) {
    let saved = false;

    // 1) Guardar/actualizar el contacto en la tabla "contactos" (base de datos de leads)
    if (typeof window.saveLead === "function" && (formData.email || formData.telefono)) {
      try {
        await window.saveLead({
          email: formData.email,
          phone: formData.telefono || "",
          fullName: formData.nombre,
          organization: formData.organizacion || "",
          interest: `solicitud_radiografia_privada:${formData.radiografiaId || ""}`,
        });
        saved = true;
      } catch (error) {
        console.warn("saveLead fallo, se intenta registro directo", error);
      }
    }

    // 2) Registrar el evento de solicitud vía edge function:
    //    ahí el backend captura y guarda la IP + geolocalización del solicitante.
    const config = window.CD_SUPABASE || {};
    if (config.url && config.anonKey) {
      try {
        const visitorId = localStorage.getItem("cd:visitor_id") || `anon-${Date.now()}`;
        localStorage.setItem("cd:visitor_id", visitorId);
        const response = await fetch(`${config.url}/functions/v1/track-visitor-event`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.anonKey}`,
            apikey: config.anonKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            visitor_id: visitorId,
            event_type: "private_report_access_requested",
            page: document.body.dataset.page || "",
            path: location.pathname,
            metadata: {
              radiografia_id: formData.radiografiaId || null,
              title: formData.titulo || null,
              delivery_channels: formData.canales,
              contact: {
                full_name: formData.nombre || null,
                email: formData.email || null,
                phone: formData.telefono || null,
                organization: formData.organizacion || null,
              },
            },
            user_agent: navigator.userAgent,
          }),
        });
        if (response.ok) saved = true;
      } catch (error) {
        console.warn("No se pudo registrar el evento de solicitud", error);
      }
    }

    if (!saved) throw new Error("No se pudo registrar la solicitud. Intentá nuevamente.");
  }

  function openSelectedContactChannels(formData) {
    const title = formData.titulo || getCurrentReportTitle(formData.radiografiaId);
    const message = buildRequestMessage(formData, title);

    if (formData.canales.includes("whatsapp")) {
      window.open(`https://wa.me/${CONSULTORA_WHATSAPP}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    }

    if (formData.canales.includes("email")) {
      const subject = `Solicitud de radiografía privada: ${title}`;
      window.location.href = `mailto:${CONSULTORA_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    }
  }

  function buildRequestMessage(formData, title) {
    return [
      "Hola Consultora Diagonales.",
      `Solicito acceso a la radiografía privada: ${title}.`,
      `Canal solicitado: ${formData.canales.map((c) => (c === "email" ? "Email" : "WhatsApp")).join(" y ")}.`,
      formData.nombre ? `Nombre: ${formData.nombre}.` : "",
      formData.organizacion ? `Organización: ${formData.organizacion}.` : "",
      formData.email ? `Email del solicitante: ${formData.email}.` : "",
      formData.telefono ? `WhatsApp/celular del solicitante: ${formData.telefono}.` : "",
      formData.radiografiaId ? `ID de radiografía: ${formData.radiografiaId}.` : "",
      `Página: ${window.location.href}`,
    ].filter(Boolean).join("\n");
  }

  function getCurrentReportTitle(reportId) {
    const report = (Array.isArray(window.CD_REPORTS) ? window.CD_REPORTS : []).find((item) => item.id === reportId);
    return report?.titulo || document.querySelector("[data-modal-title]")?.textContent?.replace(/^Acceso:\s*/i, "").trim() || "Radiografía privada";
  }
  async function getReports() {
    if (Array.isArray(window.CD_REPORTS) && window.CD_REPORTS.length) return window.CD_REPORTS;
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
