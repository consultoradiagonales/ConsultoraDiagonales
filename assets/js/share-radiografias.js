(function () {
  const SHARE_CLASS = "radiografia-share-link";
  const SHARE_LABEL = "Compartir radiografia";
  const SLOGAN = "Data Analytics aplicado al territorio, opinion publica y escenarios de poder.";
  const MODAL_ID = "radiografia-share-panel";

  const observer = new MutationObserver(addShareLinks);
  document.addEventListener("click", handleShareActivation, true);
  document.addEventListener("keydown", handleShareKeydown, true);

  document.addEventListener("DOMContentLoaded", () => {
    removeLegacyShareLinks();
    ensureSharePanel();
    addShareLinks();
    document.querySelectorAll("[data-reports]").forEach((container) => {
      observer.observe(container, { childList: true });
    });
  });

  function addShareLinks() {
    removeLegacyShareLinks();
    document.querySelectorAll(".report-card").forEach(addCardShareLink);
    document.querySelectorAll(`.latest-list > a:not(.${SHARE_CLASS})`).forEach(addListShareLink);
  }

  function removeLegacyShareLinks() {
    document.querySelectorAll(`.latest-list > .${SHARE_CLASS}, .latest-list > a[href*="wa.me"], .latest-list > a[href*="whatsapp"]`).forEach((link) => {
      const text = link.textContent.trim().toLowerCase();
      if (link.classList.contains(SHARE_CLASS) || text === "whatsapp") link.remove();
    });
  }

  function addCardShareLink(card) {
    if (card.querySelector(`.${SHARE_CLASS}`)) return;

    const title = card.querySelector("h2")?.textContent?.trim() || "Radiografia de Consultora Diagonales";
    const actions = card.querySelector(".report-actions");
    if (!actions) return;

    actions.insertAdjacentHTML("beforeend", buildShareAnchor(title, `${SHARE_CLASS}--card`));
  }

  function addListShareLink(row) {
    if (row.classList.contains(SHARE_CLASS)) return;
    if (row.dataset.shareEnhanced === "true") return;

    const title = getRowTitle(row);
    const graphsUrl = row.dataset.graphsUrl || "";
    const pdfHref = row.getAttribute("href") || "";
    const graphsLink = graphsUrl
      ? `<a class="latest-report-row__graphs" href="${escapeAttribute(graphsUrl)}" data-html-viewer-open data-report-open data-report-index="${escapeAttribute(row.dataset.reportIndex || "")}" data-track="open_graph">Gr&aacute;ficos</a>`
      : "";
    const pdfLabel = row.querySelector("strong")?.innerHTML || "Abrir PDF";
    const pdfLink = pdfHref && pdfHref !== "#"
      ? `<a class="latest-report-row__pdf" href="${escapeAttribute(row.href)}" ${copyDataAttributes(row)}>${pdfLabel}</a>`
      : `<span class="latest-report-row__pdf latest-report-row__pdf--disabled" aria-disabled="true">${pdfLabel || "PDF no disponible"}</span>`;
    const replacement = document.createElement("div");
    replacement.className = "latest-report-row";
    replacement.dataset.shareEnhanced = "true";
    replacement.innerHTML = `
      <time datetime="${escapeAttribute(row.querySelector("time")?.getAttribute("datetime") || "")}">${row.querySelector("time")?.innerHTML || ""}</time>
      <span>${row.querySelector("span")?.innerHTML || escapeAttribute(title)}</span>
      ${graphsLink}
      ${pdfLink}
      <a class="radiografia-share-link radiografia-share-link--list" href="${escapeAttribute(buildWhatsappHref(title))}" target="_blank" rel="noopener" aria-label="${escapeAttribute(`${SHARE_LABEL}: ${title}`)}" data-share-title="${escapeAttribute(title)}">${shareIcon()}</a>
    `;
    row.replaceWith(replacement);
  }

  function getRowTitle(row) {
    const titleNode = row.querySelector("span")?.cloneNode(true);
    titleNode?.querySelectorAll(".report-privacy-badge").forEach((badge) => badge.remove());
    return titleNode?.textContent?.trim() || "Radiografia de Consultora Diagonales";
  }

  function buildShareAnchor(title, modifierClass) {
    return `<a class="radiografia-share-link ${modifierClass}" href="${escapeAttribute(repositoryUrl())}" aria-label="${escapeAttribute(`${SHARE_LABEL}: ${title}`)}" data-share-title="${escapeAttribute(title)}">${shareIcon()}</a>`;
  }

  function handleShareActivation(event) {
    const share = event.target.closest(`.${SHARE_CLASS}`);
    if (!share) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openWhatsappShare(share);
  }

  function handleShareKeydown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const share = event.target.closest(`.${SHARE_CLASS}`);
    if (!share) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openWhatsappShare(share);
  }

  function openWhatsappShare(share) {
    window.location.href = buildWhatsappHref(getShareTitle(share));
  }

  function copyDataAttributes(row) {
    return Array.from(row.attributes)
      .filter((attribute) => attribute.name.startsWith("data-"))
      .map((attribute) => `${attribute.name}="${escapeAttribute(attribute.value)}"`)
      .join(" ");
  }

  function openSharePanel(share) {
    const title = getShareTitle(share);
    const panel = ensureSharePanel();
    const titleTarget = panel.querySelector("[data-share-panel-title]");
    const linkTarget = panel.querySelector("[data-share-panel-link]");
    const whatsapp = panel.querySelector("[data-share-whatsapp]");
    const form = panel.querySelector("[data-share-lead-form]");
    const status = panel.querySelector("[data-share-status]");

    panel.dataset.shareTitle = title;
    if (titleTarget) titleTarget.textContent = title;
    if (linkTarget) linkTarget.value = repositoryUrl("copied_link", title);
    if (whatsapp) whatsapp.href = buildWhatsappHref(title);
    if (form) form.elements.interest.value = `Compartio o pidio seguimiento: ${title}`;
    if (status) status.textContent = "";

    panel.hidden = false;
    panel.setAttribute("aria-hidden", "false");
    document.body.classList.add("share-panel-open");
    panel.querySelector("[data-share-copy]")?.focus();
    window.trackEvent?.("share_panel_open", { title });
  }

  function closeSharePanel() {
    const panel = document.getElementById(MODAL_ID);
    if (!panel) return;
    panel.hidden = true;
    panel.setAttribute("aria-hidden", "true");
    document.body.classList.remove("share-panel-open");
  }

  function getShareTitle(share) {
    return share.dataset.shareTitle
      || share.closest(".latest-report-row")?.querySelector("span")?.textContent?.trim()
      || share.closest("a")?.querySelector("span")?.textContent?.trim()
      || "Radiografia de Consultora Diagonales";
  }

  function ensureSharePanel() {
    const existing = document.getElementById(MODAL_ID);
    if (existing) return existing;

    document.body.insertAdjacentHTML("beforeend", `
      <section class="share-panel" id="${MODAL_ID}" aria-hidden="true" hidden>
        <div class="share-panel__backdrop" data-share-close></div>
        <div class="share-panel__dialog" role="dialog" aria-modal="true" aria-labelledby="share-panel-heading">
          <button class="share-panel__close" type="button" aria-label="Cerrar" data-share-close>&times;</button>
          <p class="share-panel__eyebrow">Compartir sin salir</p>
          <h2 id="share-panel-heading">Mantene la lectura y activa un contacto.</h2>
          <p class="share-panel__title" data-share-panel-title></p>
          <div class="share-panel__actions">
            <button class="share-panel__button" type="button" data-share-copy>Copiar enlace</button>
            <a class="share-panel__button share-panel__button--ghost" href="#" target="_blank" rel="noopener" data-share-whatsapp>WhatsApp</a>
          </div>
          <label class="share-panel__link-label">
            Enlace de repositorio
            <input type="text" readonly data-share-panel-link value="${escapeAttribute(repositoryUrl())}" />
          </label>
          <form class="share-panel__form" data-share-lead-form>
            <input type="hidden" name="interest" value="" />
            <label>
              Nombre
              <input type="text" name="full_name" autocomplete="name" required />
            </label>
            <label>
              Celular
              <input type="tel" name="phone" autocomplete="tel" required />
            </label>
            <label>
              Email
              <input type="email" name="email" autocomplete="email" />
            </label>
            <button class="share-panel__button share-panel__button--primary" type="submit">Quiero recibir nuevos analisis</button>
            <p class="share-panel__status" role="status" data-share-status></p>
          </form>
        </div>
      </section>
    `);

    const panel = document.getElementById(MODAL_ID);
    panel.querySelectorAll("[data-share-close]").forEach((item) => item.addEventListener("click", closeSharePanel));
    panel.querySelector("[data-share-copy]")?.addEventListener("click", copyShareLink);
    panel.querySelector("[data-share-lead-form]")?.addEventListener("submit", submitShareLead);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !panel.hidden) closeSharePanel();
    });
    return panel;
  }

  async function copyShareLink(event) {
    const panel = event.target.closest(".share-panel");
    const input = panel?.querySelector("[data-share-panel-link]");
    const status = panel?.querySelector("[data-share-status]");
    const title = panel?.dataset.shareTitle || "";
    if (!input) return;

    try {
      await navigator.clipboard.writeText(input.value);
      if (status) status.textContent = "Enlace copiado. La persona entra al repositorio sin perder la pagina.";
      window.trackEvent?.("share_link_copied", { title });
    } catch (_) {
      input.select();
      if (status) status.textContent = "Selecciona el enlace para copiarlo.";
    }
  }

  async function submitShareLead(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = form.querySelector("[data-share-status]");
    const submit = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    const fullName = String(data.get("full_name") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    const email = String(data.get("email") || "").trim().toLowerCase();
    const interest = String(data.get("interest") || "").trim();

    if (!fullName || !phone) {
      if (status) status.textContent = "Dejanos nombre y celular para poder contactarte.";
      return;
    }

    submit.disabled = true;
    if (status) status.textContent = "Guardando contacto.";
    try {
      if (typeof window.saveLead === "function") {
        await window.saveLead({ email, phone, fullName, interest });
      }
      window.trackEvent?.("share_lead_submitted", { email, phone, fullName, interest });
      form.reset();
      if (status) status.textContent = "Listo. Te vamos a contactar con nuevos analisis.";
    } catch (error) {
      if (status) status.textContent = `No se pudo guardar: ${error.message}`;
    } finally {
      submit.disabled = false;
    }
  }

  function buildWhatsappHref(title) {
    const message = [
      "Consultora Diagonales",
      SLOGAN,
      "",
      title,
      repositoryUrl("whatsapp", title),
    ].join("\n");
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }

  function repositoryUrl(source = "website_share", title = "") {
    const url = new URL("/repositorio/index.html", window.location.origin);
    url.searchParams.set("utm_source", source);
    url.searchParams.set("utm_medium", "referral");
    url.searchParams.set("utm_campaign", "radiografias_compartidas");
    if (title) url.searchParams.set("utm_content", title.slice(0, 120));
    return url.href;
  }

  function shareIcon() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M16 8.5 8.8 12l7.2 3.5" />
        <circle cx="18" cy="7.5" r="2.5" />
        <circle cx="6" cy="12" r="2.5" />
        <circle cx="18" cy="16.5" r="2.5" />
      </svg>
    `;
  }

  function escapeAttribute(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
