// Radiografias publicadas como archivo dentro del sitio.
// Storage entrega los HTML como text/plain y sus enlaces firmados vencen en minutos:
// cuando una radiografia esta acá, los botones del informe apuntan directo al archivo.
// Clave: id de la radiografia en Supabase.
window.CD_INFORMES_ESTATICOS = {
  "1bc86a78-08da-43e9-9ce3-e12f618dee56": {
    titulo: "Patricia Bullrich y la señal “No me importa”",
    html: "/radiografias/patricia-bullrich-y-la-senal-no-me-importa.html",
    pdf: "/radiografias/patricia-bullrich-y-la-senal-no-me-importa.pdf",
  },
};

window.informeEstatico = function informeEstatico(reportId) {
  return (window.CD_INFORMES_ESTATICOS || {})[String(reportId || "")] || null;
};
