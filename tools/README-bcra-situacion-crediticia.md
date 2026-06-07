# BCRA Situacion Crediticia

Conector asistido con pausa humana para CAPTCHA.

## Uso

```bash
npm run bcra:situacion -- 20-12345678-9
```

Flujo:

1. Abre `https://www.bcra.gob.ar/situacion-crediticia/` en Chromium.
2. Carga la CUIT indicada.
3. Se detiene para que el usuario resuelva CAPTCHA o verificacion humana.
4. Envia la consulta.
5. Se detiene otra vez hasta que el resultado este visible.
6. Extrae texto, tablas, HTML y screenshot.

Salidas:

```text
exportados/bcra/<fecha>-<cuit>.json
exportados/bcra/<fecha>-<cuit>.html
exportados/bcra/<fecha>-<cuit>.png
exportados/bcra/<fecha>-<cuit>.osint.json
tools/osint-data/bcra-consultas.jsonl
```

El registro OSINT incluye:

- modulo y fuente;
- fecha de consulta;
- CUIT/CUIL/CDI consultado;
- captura, HTML, JSON crudo y reporte OSINT;
- texto/tablas extraidas;
- senal preliminar de resultado;
- confianza;
- caveats;
- constancia de cumplimiento.

No evade CAPTCHA, no automatiza resolucion humana y no salta controles de acceso.
