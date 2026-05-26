# Configuracion de Supabase y WhatsApp

## Frontend

Editar `assets/js/supabase-config.js`:

```js
window.CD_SUPABASE = {
  url: "https://TU-PROYECTO.supabase.co",
  anonKey: "TU_SUPABASE_ANON_KEY",
};

window.CD_ADMIN = {
  uploadKey: "CLAVE_PRIVADA_PARA_ADMIN",
};
```

## Base de datos

Ejecutar `supabase-schema.sql` en el SQL editor de Supabase.

El panel admin publica solo archivos PDF en el bucket `radiografias`. La tabla `radiografias` guarda la metadata y `pdf_url`.

Cada apertura de PDF luego de validar WhatsApp inserta una fila en `pdf_downloads` con:

- usuario (`full_name`)
- fecha y hora (`created_at` / `downloaded_at`)
- lugar, provincia y localidad
- telefono
- mail
- radiografia y URL del PDF

Para métricas rápidas queda disponible la vista `pdf_download_metrics`.

## Edge Functions

Desplegar:

```bash
supabase functions deploy send-whatsapp-code
supabase functions deploy verify-whatsapp-code
```

Variables requeridas:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="..."
supabase secrets set WHATSAPP_TOKEN="..."
supabase secrets set WHATSAPP_PHONE_NUMBER_ID="..."
supabase secrets set WHATSAPP_CODE_PEPPER="una-cadena-larga-secreta"
```

`WHATSAPP_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID` corresponden a WhatsApp Cloud API.
