# Mini BCRA OSINT

Proyecto minimo para probar el conector asistido de BCRA.

## Ejecutar

```bash
npm run demo:bcra
```

Abrir:

```text
http://localhost:4321
```

## Flujo

1. Ingresar CUIT/CUIL/CDI.
2. Click en `Iniciar`.
3. Se abre Chromium en BCRA.
4. Resolver CAPTCHA/verificacion manualmente si aparece.
5. Volver a la app y usar `Enviar Enter al script` cuando corresponda.
6. Cuando el resultado este visible, usar otra vez `Enviar Enter al script`.
7. Revisar registros y archivos en `exportados/bcra`.

No evade CAPTCHA ni controles. Solo pausa para intervencion humana.
