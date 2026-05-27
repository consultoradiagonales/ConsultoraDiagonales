# Configuracion de Supabase y WhatsApp

## Frontend

Editar `assets/js/supabase-config.js`:

```js
window.CD_SUPABASE = {
  url: "https://TU-PROYECTO.supabase.co",
  anonKey: "TU_SUPABASE_ANON_KEY",
};

window.CD_ADMIN = {
  uploadKey: "",
  useEdgeUpload: true,
};
```

La clave de administrador real no debe publicarse en el frontend. El panel la pide al ingresar y la envía como header a la Edge Function `admin-upload-report`, que la compara contra el secret `ADMIN_UPLOAD_KEY`.

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
supabase functions deploy admin-upload-report
supabase functions deploy admin-dashboard
```

Variables requeridas:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="..."
supabase secrets set ADMIN_UPLOAD_KEY="clave-larga-para-cargar-radiografias"
supabase secrets set WHATSAPP_TOKEN="..."
supabase secrets set WHATSAPP_PHONE_NUMBER_ID="..."
supabase secrets set WHATSAPP_GRAPH_VERSION="v21.0"
supabase secrets set WHATSAPP_CODE_PEPPER="una-cadena-larga-secreta"
```

`WHATSAPP_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID` corresponden a WhatsApp Cloud API. `WHATSAPP_GRAPH_VERSION` permite actualizar la versión de Graph API sin editar código.

Para enviar mensajes fuera de una conversacion iniciada por el usuario, WhatsApp Cloud API normalmente exige una plantilla aprobada. Si usan plantilla, configurar tambien:

```bash
supabase secrets set WHATSAPP_TEMPLATE_NAME="nombre_de_la_plantilla"
supabase secrets set WHATSAPP_TEMPLATE_LANGUAGE="es_AR"
```

La plantilla debe tener un parametro en el cuerpo para recibir el codigo de 6 digitos. Si no se configura `WHATSAPP_TEMPLATE_NAME`, la funcion intenta enviar un mensaje de texto simple.

## Conexion CLI

Antes de desplegar desde esta carpeta:

```bash
supabase login
supabase link --project-ref "PROJECT_REF"
supabase db push
supabase functions deploy send-whatsapp-code
supabase functions deploy verify-whatsapp-code
supabase functions deploy admin-upload-report
supabase functions deploy admin-dashboard
```

Luego copiar la URL del proyecto y la anon key en `assets/js/supabase-config.js`.
