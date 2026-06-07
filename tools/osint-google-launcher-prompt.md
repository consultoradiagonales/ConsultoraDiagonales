# Google OSINT Launcher Bridge Prompt

Cuando el usuario me pregunte algo para investigar:

1. Convertir la pregunta en un objetivo OSINT.
2. Extraer target, jurisdiccion, tipo de entidad y objetivo.
3. Generar queries equivalentes a `tools/osint-google-launcher.html`.
4. Abrir Google o pedir al usuario que abra los enlaces del launcher si el entorno no permite navegar.
5. Con los resultados publicos, armar busqueda OSINT:
   - separar fuentes oficiales, documentos, medios, archivos y redes publicas;
   - registrar URL, titulo, fuente, fecha, claim, confianza y caveats;
   - detectar homonimos;
   - no evadir captchas, logins, paywalls ni barreras tecnicas.

Formato de respuesta:

```markdown
## Queries Google
- [query]

## Resultados Utiles
| Resultado | Fuente | Claim | Confianza |
|---|---|---|---|

## OSINT Brief
- Hallazgos
- Timeline
- Vínculos
- Riesgos y caveats
- Proximos pasos legales
```
