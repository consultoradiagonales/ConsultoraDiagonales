# Revisión de `metodo_muestreo.md` y del kit asociado

Revisión externa para CODEX · 16/11/2026 · Destino sugerido: `work/revision_metodo_muestreo.md`

Archivos revisados: `encuadre.txt`, `metodo_muestreo.md` (M), `acceso_plataformas.md` (A), `construir_guia.py` (G), `departamentos-original.geojson`. Los números remiten a líneas. No se modificó ningún original.

Trabajaron tres revisores: metodología, verificación de fuentes, y geografía con ejecución del script.

## Cómo leer esta revisión

- **Hecho verificado:** comprobado con código, con conteo o con la cita de una fuente.
- **Juicio:** evaluación metodológica de los revisores.
- **Suposición:** no verificada. Se indica expresamente.
- **Verificación de fuentes:** primero con fragmentos de buscador, porque la red estaba bloqueada. Después, con la red habilitada, se leyeron completas 11 de las 12 fuentes primarias. La única que no se pudo leer es help.x.com, bloqueada por Cloudflare. Ver I8.

## Veredicto

El diseño conceptual es sólido y cumple el encuadre:

- separa postura de sentimiento;
- separa comentarios de personas;
- usa tres geografías que no se mezclan;
- no guarda identificadores;
- no estima voto ni residencia;
- no declara legalidad general.

Los problemas principales son de **aritmética operativa** y de **reglas que no cierran entre sí**. Hay que corregirlos antes del piloto.

---

## Críticos

### C1. Con el piloto previsto, la vista por plataforma nunca alcanza el umbral

**Hecho.** M129 prevé 6 posts por territorio en 2 redes, o sea unos 3 posts por red. M104 exige ≥100 comentarios elegibles y ≥5 posts para colorear una celda. Por red, el máximo es 3 × 20 = 60 comentarios. Ninguna celda del piloto puede colorearse por red.

**Hecho.** Juntando las redes, el máximo por territorio es 120 comentarios. Para llegar a 100 hay que llenar en promedio ≥16,7 de los 20 lugares de cada post.

**Hecho.** El escalado de M135 (159 × 5 × 20 = 15.900) cae justo en el umbral mínimo y supone juntar las 4 redes sin decirlo. Exigir el umbral por red lleva a unas 63.600 observaciones (unas 530 h). Si además se mantienen separados los mapas de contexto y de asunto (M19), la cifra puede duplicarse.

**Corrección.**

- **M129:** «En el piloto, el umbral de color se evalúa por territorio, juntando las redes. La vista por plataforma es descriptiva, con conteos y sin color».
- **M135:** «Planificar 6–7 posts por celda para absorber los faltantes. La cifra supone redes juntas. Con umbral por red, multiplicar por el número de redes».
- **G58:** reemplazar «hasta 15.900» por «como mínimo unas 15.900».

### C2. La regla de selección no da 6 posts y choca con la captura a 72 h

**Hecho.** M35 fija un post por semana y por fuente: 3 fuentes × 3 semanas = 9 posts por red, frente a la meta de 6. No hay regla para descartar los que sobran, y descartarlos a mano introduce sesgo del investigador. M33 tampoco fija el «máximo de posts por fuente».

**Hecho.** El primer post de la semana solo se captura dentro de las 72 h ±12 (M37) si alguien revisa la página cada ≤48 h. Además, un post que califique al final de la semana 4 se captura después del día 28.

**Suposición.** Tomar siempre el primer post de la semana concentra la muestra en lunes y martes.

**Corrección.** Por territorio y red, sortear antes del ciclo, con semilla registrada, qué organización y qué semana aporta cada post. Cada organización aporta al menos un post.

- Revisar las páginas cada ≤48 h.
- Si la captura cae fuera de la ventana, capturar igual y marcar `desvio_edad`.
- Post borrado o con comentarios desactivados: registrar el estado y tomar una sola vez el siguiente post que califique.
- Seleccionar solo posts publicados hasta el día 25.
- Aclarar si «fuente» quiere decir organización o cuenta en una red.

### C3. Balance equilibrado: un post con 1 postura pesa igual que uno con 20

**Hecho.** M92 promedia `balance_post` entre los posts con n_postura>0. M88 advierte el caso extremo pero no fija un mínimo por post. Con unos 6 posts por celda, un solo ±100 con n_postura=1 puede invertir el signo de la celda.

**Corrección.**

- **Dentro de la organización:** agrupar en lugar de promediar.
  `balance_org = 100 × Σ(favor − contra) / Σ n_postura`.
  Después promediar con pesos iguales entre organizaciones y entre plataformas.
- **Mínimo de entrada:** n_postura ≥10 por organización. Si no llega, se informa y queda fuera del score.
- **Sensibilidad, publicada al lado:**
  - `neto_elegible = 100 × (favor − contra)/n`;
  - `balance_sin_mixto = 100 × (favor − contra)/(favor + contra)`;
  - rango entre organizaciones y resultado de quitar cada una por turno.
- **Bootstrap (opcional):** solo con ≥8 unidades, rotulado «dispersión entre publicaciones de la muestra, no intervalo poblacional».

### C4. Leer comentarios puede exigir sesión iniciada y dejar el piloto sin datos

**Hecho (fuente oficial, por fragmento).** La búsqueda avanzada de X requiere sesión iniciada.

**Evidencia periodística, no oficial.** En X, sin sesión no se ven las respuestas completas.

**Suposición.** En Instagram y TikTok, la carga de comentarios sin sesión es parcial o inconsistente. Solo hay blogs comerciales como respaldo.

**Problema.** M47 dice «si aparece una barrera de acceso, detener esa vía». Leída así, la regla podría anular X y quizás también Instagram y TikTok.

**Corrección.** Definir de forma explícita si la lectura manual con la cuenta propia del investigador, sin automatización ni exportación de cookies, cuenta como «vía pública permitida». En la semana 1, verificar y registrar el comportamiento sin sesión en cada red en lugar de suponerlo.

---

## Importantes

### I1. La alerta de concentración por post nunca se activa (M107)

**Hecho.** Con un tope de 20 comentarios por post y un mínimo de 100 por celda, un post aporta como máximo el 20%, nunca más del 40%.

**Corrección.** Medir la concentración sobre n_postura: más del 25% de un post o más del 50% de una organización.

### I2. Redacción duplicada (M105)

**Hecho.** «Si n_postura<30, N/D» repite M104. «Si no se cumple cualquiera» debe decir «si no se cumple alguno».

### I3. Fechas de captura o de publicación (M104, G86)

**Hecho.** El período se define por fecha de publicación (M37), pero el umbral cuenta «fechas de captura». El agregado de G86 es ambiguo.

**Corrección.** «5 publicaciones, 3 organizaciones y 3 semanas de publicación distintas, cada una con n_postura>0».

### I4. Auditoría entre codificadores (M117–119)

**Hecho.** La regla original es incoherente: el 10% de un total menor que 50 da menos de 5. G89 la corrige bien, pero en la guía y no en la fuente.

**Juicio.** El porcentaje de acuerdo se infla cuando domina una categoría.

**Corrección.**

- Reportar también kappa de Cohen o alfa de Krippendorff nominal, el acuerdo por categoría y n.
- Presentarlos como dato descriptivo: con n=50 el kappa es impreciso.
- Codificar en silencio, cada persona en su hoja, y comparar al final.
- No reutilizar los 30 comentarios de la calibración.
- Repartir la auditoría entre redes.
- Renombrar `n_coincidencias_del_par` como `n_comentarios_del_par`.

### I5. La capa de asunto no tiene marco propio (M15–19)

**Juicio.** Sale de las mismas fuentes locales que la capa de contexto.

**Corrección.** Registrar `geo_contexto` y `geo_asunto` por lote. Declarar que el mapa de asunto se basa en el panel de fuentes. Registrar como panel aparte los medios nacionales que se sumen.

### I6. Asignación de CABA y de La Plata (M21)

**Suposición.** Hay riesgo de asignar al contexto CABA los medios nacionales con sede en CABA. Lo mismo con las cuentas provinciales y La Plata.

**Corrección.** «La sede no determina el contexto. Los medios nacionales van como `sin_asignar` y las cuentas del gobierno provincial, a la provincia».

### I7. Lo legal y lo referido a menores falta en el método

**Hecho.** La Ley 25.326, la exclusión de posts dirigidos a menores y el aviso de que no hay dictamen de legalidad están en la introducción de G (líneas 62–66), no en M. Si M circula solo, se pierden.

**Corrección.** Agregar a M §1 o §3:

- revisión de condiciones de plataforma;
- consulta profesional sobre opiniones políticas;
- exclusión de publicaciones dirigidas a menores, sin estimar la edad de quienes comentan.

### I8. Ajustes de precisión en las fuentes (A y M)

**Segunda verificación (16/11/2026).** Se leyeron completas, con la red habilitada, 11 de las 12 fuentes primarias. La única que no se pudo leer es help.x.com, porque Cloudflare bloquea el acceso automático.

**Saldo.** `acceso_plataformas.md` es correcto en casi todo. Solo hay que quitar o verificar la frase sobre «Latest» y matizar «hereda».

| Afirmación | Estado | Acción |
|---|---|---|
| Instagram: endpoints `/comments` y `/replies`, permisos, Standard Access | Confirmada | — |
| Instagram: Advanced Access para cuentas de terceros | **Confirmada.** «Advanced Access if your app serves Instagram professional accounts you don't own or manage». Exige App Review y Business Verification | Mantener y agregar App Review y Business Verification |
| Graph API: PPCA para páginas no administradas; `toplevel` y `stream` | Confirmada | — |
| Graph API: permisos del objeto padre | **Confirmada en sustancia.** «The same permissions required to view the parent object are required to view comments». La página no usa «heredar» | Escribir «requiere los mismos permisos que el objeto padre». Agregar que no devuelve comentarios ni perfiles de terceros sin su autorización |
| Meta Content Library: sin tarifa, solicitantes globales, revisión por CASD, `fetch_all` | Confirmada | — |
| Meta Content Library: elegibilidad | **Confirmada.** «qualified academic institution or a qualified non-academic research institution», sin fines de lucro. Excluye jurisdicciones sancionadas por EE.UU., Reino Unido, UE y ONU | Mantener. Una consultora con fines de lucro no califica por sí misma |
| Meta Content Library: 500.000 registros y 500.000 comentarios por 7 días | **Confirmada.** Por investigador, ventana móvil, compartida entre Library y API. API sincrónica: 60 consultas por minuto. Asincrónica: 1 por minuto | Mantener la cifra con la aclaración «condicionado a aprobación», como ya hace A32 |
| TikTok: cuota de 1.000 solicitudes / 100.000 registros / 100 por consulta; Brasil solo seguridad juvenil; Argentina ausente | Confirmada | — |
| TikTok: regiones | **Confirmada como figura en A11.** Académicas en EE.UU., EEE, Reino Unido, Canadá y Suiza. Sin fines de lucro, solo UE, más una beta | Mantener A11. *Corrige la primera versión de esta revisión, que sugería otra redacción* |
| TikTok: creadores, anunciantes y usuarios comerciales | **Confirmada.** FAQ: «…commercial user. Am I eligible…? No.» | Mantener |
| TikTok: `video_id` y `comment_id` excluyentes | **Confirmada.** «You may only request one or the other; both cannot be requested at the same time.» | Mantener «mutuamente excluyentes». *Corrige la primera versión, que sugería suavizarlo* |
| TikTok: `display_name` | Figura en el objeto Comment pero no en la lista de `fields` | Mantener la advertencia de A40: es un dato personal y no se pide |
| X: créditos y USD 0,005 por post leído | **Confirmada.** Deduplicado por día UTC, tope de 3 millones de lecturas por mes | — |
| X: `conversation_id`; búsqueda avanzada con sesión | Confirmada | — |
| X: Latest como orden «no personalizado» (A48) | **No accesible** | Quitar «no personalizado» hasta verificarlo a mano |
| AAPOR 2014 (M11) | **Confirmada.** Es un informe de grupo de trabajo, «working document»: «social media users are not representative of the wider general public»; «insights rather than point estimates» | Escribir «recomienda» o «advierte», no «exige». Mantener «exige» solo para los estándares de transparencia |
| Ley 25.326, art. 2 | **Confirmada.** «…opiniones políticas…» como dato sensible | — |
| Ley 25.326, art. 7 inc. 2 | **Confirmada literal.** «…con finalidades estadísticas o científicas cuando no puedan ser identificados sus titulares.» | — |
| Ley 25.326, art. 7 inc. 3 | **Hallazgo nuevo.** Prohíbe archivos que «directa o indirectamente» revelen datos sensibles | Citarlo en G62: refuerza no guardar textos, IDs ni enlaces a comentarios |
| Ley 25.326, arts. 4 y 9 | **Confirmados.** Art. 4: pertinencia y finalidad; inc. 7, destrucción cuando ya no sean necesarios. Art. 9: seguridad y confidencialidad | La política de revisión cada 90 días (G66) es coherente con art. 4 inc. 7 |
| PBA: 135 partidos | Confirmada | — |

---

## Script `construir_guia.py` y geografía

### G1. Resultado de la simulación (hecho verificado)

Con GeoJSON derivados del archivo de departamentos, el script corre y genera `plan_cobertura.csv` con **636 filas** ((24+135) × 4). Los ceros a la izquierda se conservan.

### G2. Siete enlaces de la guía apuntan a archivos que el script no crea (alta)

Los archivos que faltan son:

- `captura.html`
- `README-ejecucion.txt`
- `demo/mapa.html`
- `datos/plantilla_conteos.csv`
- `geografia/provincias.csv`
- `geografia/partidos_pba.csv`
- `geografia/procedencia.json`

También faltan `procesar.py` y `datos/ejemplo_simulado.csv`. Si otro paso los genera, hay que documentar el orden de ejecución. Agregar al final un `assert` que compruebe cada enlace local.

### G3. Depende del directorio de ejecución y deja salidas a medias (alta)

Ejecutado desde otra carpeta, falla con `FileNotFoundError`, pero ya creó carpetas. Si falta `geografia/`, deja un `plan_cobertura.csv` que solo tiene el encabezado.

**Corrección.** Usar `Path(__file__).resolve().parent` y validar todas las entradas antes de escribir.

### G4. No valida conteos (alta)

Si se le pasa el archivo de departamentos completo, genera 2.116 filas sin ningún aviso.

**Corrección.** Agregar asserts:

- 24 provincias y 135 partidos;
- IDs únicos de 2 y 5 dígitos;
- partidos con prefijo `06`.

### G5. Los `method.replace` fallarían en silencio (media)

**Hecho.** Hoy cada cadena aparece una sola vez y se reemplaza.

**Problema.** La guía publica reglas distintas de las de `metodo_muestreo.md`. No se pudo verificar qué versión aplica `procesar.py`, porque no fue entregado.

**Corrección.** Corregir la fuente y eliminar los reemplazos. Si se mantienen, `assert method.count(old) == 1`. Eliminar el reemplazo de `**Semana 1:**`, que no cambia nada.

### G6. `splitlines()[3:]` borra más que el título (media)

**Hecho.** Elimina también la línea 3, «Propuesta de diseño… No se recopilaron comentarios reales». La introducción lo cubre, pero es frágil.

**Corrección.** Quitar solo el primer `# `.

### G7. Jerarquía de títulos plana (media)

**Hecho.** Las secciones del método salen como `h2`, hermanas de «Protocolo completo…» en lugar de hijas.

**Corrección.** Bajar un nivel los títulos del método antes de renderizar.

### G8. Menores

- `import html` no se usa.
- Los GeoJSON se leen sin `utf-8-sig`.
- `table{display:block}` hace perder la semántica de tabla en lectores de pantalla.

### G9. GeoJSON de departamentos (hechos verificados)

**Estructura.**

- 529 features, WGS84, IDs de 5 caracteres como texto, sin duplicados.
- Buenos Aires (`06`): exactamente 135 partidos, de `06007` a `06882`.
- Incluye 15 comunas de CABA (`02`). No mezclarlas con los partidos.
- No trae la capa provincial: hay que disolverla por `provincia.id`, o usar la descarga Georef de provincias. La segunda opción es preferible.

**Geometría inválida.** Una sola, `94021 Islas del Atlántico Sur` («Nested shells»). Requiere `make_valid`, registrado en `procedencia.json`.

**Antártida.** La Antártida (`94028`) llega hasta latitud −90.

- Decidir cómo representarla: recuadro o mapa bicontinental.
- **Suposición:** con Mercator, la Antártida rompería el mapa.

### G10. La CSS no cumple las reglas editoriales del proyecto

**Medida de línea.** Con 908 px útiles a 17 px salen unos 97–107 caracteres por línea, frente a los 45–75 de la regla. Es una estimación.

**Corrección.** `p, li, blockquote {max-width: 66ch}`.

**Escala tipográfica.** El cuerpo (12,75 pt), el h1 (29,4 pt), las tablas (10,6 pt) y el footer (9,6 pt) quedan fuera de la escala 12/16/20/24 pt.

**Corrección.** Llevar cada nivel a la escala, con interlineado más compacto en títulos y más aireado en texto chico:

| Elemento | Tamaño | Interlineado |
|---|---|---|
| Cuerpo | 16 px (12 pt) | 1,6 |
| h3 | 16 pt | 1,3 |
| h2 | 20 pt | 1,2 |
| h1 | 24 pt | 1,1 |
| Tablas y footer | ≥12 pt | ≈1,7 |

El h3 hoy hereda 1,65, demasiado aireado para un título.

---

## Menores del método

- **M131:** 480 comentarios a 20–45 s dan 2,7–6 h solo de codificación. Contando los comentarios vistos y no solo los elegibles, unas 3,8–8,6 h. Las 8–14 h son plausibles, con el piso justo. Agregar ≈1 h de una segunda persona para la auditoría y rotular los segundos por comentario como supuesto.
- **M43:** registrar el orden (relevancia o cronológico) en el tooltip, porque condiciona la comparación entre redes.

## Prioridad sugerida para CODEX

1. C1–C4 y I1–I3: reglas y aritmética del piloto, corregidas en `metodo_muestreo.md`.
2. G2–G5: que el kit genere lo que enlaza, valide entradas y elimine los reemplazos.
3. I8: ajustes de redacción en `acceso_plataformas.md`.
4. G10 y el resto de los menores.
