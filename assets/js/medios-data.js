// ============================================================
// REPOSITORIO DE NOTAS POR MEDIO — Consultora Diagonales
// ------------------------------------------------------------
// Para agregar una nota nueva: copiá un bloque { fecha, titulo,
// descripcion, url } dentro del array "notas" del medio que
// corresponda. La más reciente va PRIMERA. Guardar y pushear.
// ============================================================
window.CD_MEDIOS = [
  {
    slug: "newsdigitales",
    nombre: "News Digitales",
    ubicacion: "La Plata",
    tipo: "Portal de noticias",
    sitio: "https://www.newsdigitales.com/",
    notas: [
      {
        fecha: "2026-06",
        titulo: "La sucesión de Kicillof: el mapa político que ya empieza a definir la Provincia de 2027",
        descripcion: "Análisis del escenario sucesorio bonaerense y los actores en disputa hacia 2027.",
        url: "https://www.newsdigitales.com/nota/337651/la-sucesion-de-kicillof-el-mapa-politico-que-ya-empieza-a-definir-la-provincia-de-2027/",
      },
    ],
  },
  {
    slug: "realpolitik",
    nombre: "Realpolitik",
    ubicacion: "La Plata",
    tipo: "Portal de noticias",
    sitio: "https://realpolitik.com.ar/",
    notas: [
      {
        fecha: "2026-06",
        titulo: "La proyección presidencial de Axel Kicillof queda condicionada por el conflicto con IOMA",
        descripcion: "Cobertura del análisis de Consultora Diagonales sobre el impacto del conflicto IOMA en la proyección nacional del gobernador.",
        url: "https://realpolitik.com.ar/nota/71741/la-proyeccion-presidencial-de-axel-kicillof-queda-condicionada-por-el-conflicto-con-ioma/",
      },
      // ↓ AGREGAR ACÁ LA NOTA NUEVA DE REALPOLITIK (descomentá y completá):
      // {
      //   fecha: "2026-07",
      //   titulo: "TITULO DE LA NOTA",
      //   descripcion: "Breve descripción.",
      //   url: "https://realpolitik.com.ar/nota/XXXXX/...",
      // },
    ],
  },
  {
    slug: "radio-buenos-aires",
    nombre: "Radio Buenos Aires",
    ubicacion: "CABA",
    tipo: "Radio",
    sitio: "",
    notas: [
      {
        fecha: "2026-06",
        titulo: "Cobertura radial — Consultora Diagonales",
        descripcion: "Participación al aire con análisis político-electoral.",
        url: "https://share.google/ojJWTuvEOoXqV8Vp4",
      },
    ],
  },
  {
    slug: "aconcagua",
    nombre: "Aconcagua Radio",
    ubicacion: "Mendoza",
    tipo: "Radio / Podcast",
    sitio: "",
    notas: [
      {
        fecha: "2026-06",
        titulo: "Entrevista en Aconcagua Radio",
        descripcion: "Entrevista sobre coyuntura política y escenarios electorales (Spotify).",
        url: "https://open.spotify.com/episode/4ZzaFBYCtNazPilx16HSsm?si=_gzlQyuGRJG8CnmrznC5iw&context=spotify%3Ashow%3A5ECeh8pLbIPVPqNeFRNdAx",
      },
    ],
  },
  {
    slug: "la-sintesis",
    nombre: "La Síntesis",
    ubicacion: "Saladillo",
    tipo: "Diario digital",
    sitio: "https://www.lasintesis.com.ar/",
    notas: [
      {
        fecha: "2026-06",
        titulo: "Cobertura en La Síntesis de Saladillo",
        descripcion: "Trabajo de Consultora Diagonales publicado en el primer diario digital de Saladillo.",
        url: "https://www.lasintesis.com.ar/",
      },
    ],
  },
];
