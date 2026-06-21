(function () {
  const CONTACT_STORAGE_KEY = "cd:contact";
  const PHONE_VERIFIED_KEY = "cd:phone_verified";

  document.addEventListener("submit", handleRegistrationSubmit, true);

  async function handleRegistrationSubmit(event) {
    const form = event.target.closest("[data-registration-form]");
    if (!form) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const status = document.querySelector("[data-registration-status]");
    const submit = document.querySelector("[data-registration-submit]");
    const phone = String(new FormData(form).get("phone") || "").trim();
    const fullName = String(new FormData(form).get("full_name") || "").trim();
    const email = String(new FormData(form).get("email") || "").trim().toLowerCase();
    const organization = String(new FormData(form).get("organization") || "").trim();

    if (!phone) {
      if (status) status.textContent = "Dejanos un celular para habilitar la lectura.";
      return;
    }

    if (submit) {
      submit.disabled = true;
      submit.textContent = "Guardando celular...";
    }
    if (status) status.textContent = "Guardando contacto.";

    const contact = {
      visitor_id: getVisitorId(),
      phone,
      email,
      full_name: fullName,
      organization,
      access_reason: "pdf_download",
      phone_validation_status: "phone_verified",
      consent_terms: true,
      last_seen_at: new Date().toISOString(),
      tags: ["descarga_pdf", "celular_validado"],
    };

    localStorage.setItem(CONTACT_STORAGE_KEY, JSON.stringify({ ...getStoredContact(), ...contact }));
    localStorage.setItem(PHONE_VERIFIED_KEY, phone);

    try {
      await saveContact(contact);
    } catch (error) {
      console.warn("No se pudo guardar el contacto remoto", error);
    }

    if (status) status.textContent = "Listo. Te llevamos a las radiografias.";
    window.location.href = getRedirectTarget();
  }

  async function saveContact(contact) {
    const config = window.CD_SUPABASE || {};
    if (!config.url || !config.anonKey) return;

    const response = await fetch(`${config.url}/rest/v1/contactos`, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "content-type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(contact),
    });

    if (!response.ok) throw new Error(`contactos ${response.status}`);
  }

  function getRedirectTarget() {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    if (!next) return "../repositorio/index.html?v=phone-access";

    try {
      const target = new URL(next, window.location.href);
      if (target.origin !== window.location.origin) return "../repositorio/index.html?v=phone-access";
      target.searchParams.set("access", "phone");
      return target.href;
    } catch (_) {
      return "../repositorio/index.html?v=phone-access";
    }
  }

  function getStoredContact() {
    try {
      return JSON.parse(localStorage.getItem(CONTACT_STORAGE_KEY) || "{}");
    } catch (_) {
      return {};
    }
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
})();
