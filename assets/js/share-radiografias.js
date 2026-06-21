(function () {
  const SHARE_CLASS = "radiografia-share-link";
  const SHARE_LABEL = "Compartir radiografia";
  const SLOGAN = "Data Analytics aplicado al territorio, opinion publica y escenarios de poder.";

  const observer = new MutationObserver(addShareLinks);
  document.addEventListener("click", handleShareActivation, true);
  document.addEventListener("keydown", handleShareKeydown, true);

  document.addEventListener("DOMContentLoaded", () => {
    removeLegacyShareLinks();
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

    const title = row.querySelector("span")?.textContent?.trim() || "Radiografia de Consultora Diagonales";
    const replacement = document.createElement("div");
    replacement.className = "latest-report-row";
    replacement.dataset.shareEnhanced = "true";
    replacement.innerHTML = `
      <time datetime="${escapeAttribute(row.querySelector("time")?.getAttribute("datetime") || "")}">${row.querySelector("time")?.innerHTML || ""}</time>
      <span>${row.querySelector("span")?.innerHTML || escapeAttribute(title)}</span>
      <a class="latest-report-row__pdf" href="${escapeAttribute(row.href)}" ${copyDataAttributes(row)}>Abrir PDF</a>
      <a class="${SHARE_CLASS} ${SHARE_CLASS}--list" href="${escapeAttribute(buildWhatsappHref(title))}" target="_blank" rel="noopener" aria-label="${escapeAttribute(`${SHARE_LABEL}: ${title}`)}" data-share-title="${escapeAttribute(title)}">${shareIcon()}</a>
    `;
    row.replaceWith(replacement);
  }

  function buildShareAnchor(title, modifierClass) {
    return `<a class="${SHARE_CLASS} ${modifierClass}" href="${escapeAttribute(buildWhatsappHref(title))}" target="_blank" rel="noopener" aria-label="${escapeAttribute(`${SHARE_LABEL}: ${title}`)}" data-share-title="${escapeAttribute(title)}">${shareIcon()}</a>`;
  }

  function handleShareActivation(event) {
    const share = event.target.closest(`.${SHARE_CLASS}`);
    if (!share) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    window.location.href = buildWhatsappHref(getShareTitle(share));
  }

  function handleShareKeydown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const share = event.target.closest(`.${SHARE_CLASS}`);
    if (!share) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    window.location.href = buildWhatsappHref(getShareTitle(share));
  }

  function copyDataAttributes(row) {
    return Array.from(row.attributes)
      .filter((attribute) => attribute.name.startsWith("data-"))
      .map((attribute) => `${attribute.name}="${escapeAttribute(attribute.value)}"`)
      .join(" ");
  }

  function getShareTitle(share) {
    return share.dataset.shareTitle
      || share.closest(".latest-report-row")?.querySelector("span")?.textContent?.trim()
      || share.closest("a")?.querySelector("span")?.textContent?.trim()
      || "Radiografia de Consultora Diagonales";
  }

  function buildWhatsappHref(title) {
    const message = [
      "Consultora Diagonales",
      SLOGAN,
      "",
      title,
      repositoryUrl(),
    ].join("\n");
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }

  function repositoryUrl() {
    return new URL("/repositorio/index.html", window.location.origin).href;
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
