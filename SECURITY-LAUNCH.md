# Checklist de lanzamiento seguro

## Build y hosting

- Ejecutar `npm run build` antes de publicar.
- GitHub Pages debe publicar solo `dist/`.
- `dist/` contiene un sitio publico filtrado: HTML, assets, paginas y radiografias. No incluye `supabase/`, `tools/`, migraciones, funciones, `node_modules` ni archivos internos.

## Supabase

Aplicar la migracion:

```bash
npx supabase db push
```

Desplegar funciones despues de aplicar cambios:

```bash
npx supabase functions deploy send-whatsapp-code
npx supabase functions deploy verify-whatsapp-code
npx supabase functions deploy admin-dashboard
npx supabase functions deploy admin-upload-report
```

Secrets privados requeridos en Supabase:

```bash
SUPABASE_SERVICE_ROLE_KEY
ADMIN_UPLOAD_KEY
WHATSAPP_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_CODE_PEPPER
WHATSAPP_GRAPH_VERSION
```

Publicos en cliente:

```bash
SUPABASE_URL
SUPABASE_ANON_KEY
```

## Protecciones aplicadas

- Edge Functions con `verify_jwt = true`.
- CORS limitado a dominios de Consultora Diagonales y GitHub Pages.
- Rate limit basico en memoria para WhatsApp y admin.
- RLS endurecido para bloquear lectura publica de datos personales.
- RPC OSINT fuera de acceso anonimo.
- Scripts internos sin anon key hardcodeada.

## Pendiente recomendado

- Sentry para errores del frontend y Edge Functions.
- Alertas de gasto/uso en Supabase y Meta WhatsApp.
- Rate limit persistente con Redis/Upstash si hay trafico real o varios workers.
- Rotar `ADMIN_UPLOAD_KEY` antes de salir a produccion.
