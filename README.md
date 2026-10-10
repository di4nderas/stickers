# WhatsApp Studio

Sitio estático servido por Vercel, con funciones Node.js bajo `api/`. El cliente crea y descarga packs `.wastickers`; cada sticker resultante también se puede enviar al chat privado configurado del bot y aparecer en una galería pública después de aprobación.

## Configuración de Telegram y Supabase

1. Crea un proyecto en Supabase y ejecuta [`supabase/schema.sql`](./supabase/schema.sql) en SQL Editor.
2. En Vercel, abre **Project → Settings → Environment Variables** y configura:
   - `SUPABASE_URL`: URL del proyecto Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY`: clave `service_role` del proyecto. Es secreta; nunca la publiques.
   - `TELEGRAM_BOT_TOKEN`: token de BotFather. Es secreto; nunca lo pongas en `app.js`.
   - `TELEGRAM_SETUP_KEY`: secreto aleatorio largo que usarás solo para descubrir el ID de tu chat privado.
   - `TELEGRAM_CHAT_ID`: se configura en el paso 4.
3. Abre el bot en Telegram, pulsa **Start** y envíale `/start`. Después, desde PowerShell, consulta las actualizaciones del bot usando tu dominio y la clave de configuración:

   ```powershell
   $headers = @{ Authorization = "Bearer TU_TELEGRAM_SETUP_KEY" }
   Invoke-RestMethod -Uri "https://TU-DOMINIO.vercel.app/api/telegram-setup" -Headers $headers
   ```

   La respuesta contiene `privateChats`; copia el `chatId` de tu conversación privada. La clave de configuración no se envía al navegador ni se guarda en el repositorio. El endpoint no confirma ni consume las actualizaciones.
4. Agrega `TELEGRAM_CHAT_ID` con ese valor como variable de entorno de Vercel y vuelve a desplegar.
5. Al crear stickers, el navegador los enviará a `api/sticker-upload`. El bot los archiva en ese chat privado y Supabase los registra con estado `pending`.
6. Para aprobar un sticker, abre **Supabase → Table Editor → stickers** y cambia su `status` de `pending` a `approved`. Solo los aprobados se muestran en la galería pública. Los rechazados se mantienen fuera de la galería.

Los endpoints de la galería requieren estas variables configuradas. Las cargas están limitadas a 490 KB por WebP y a 120 solicitudes por IP anonimizada en una ventana de una hora. La clave del bot y la clave `service_role` se usan únicamente en funciones del servidor.

## Publicar en GitHub y Vercel

Mantén `index.html`, `styles.css`, `app.js` y la carpeta `api/` en la raíz del repositorio. Vercel puede desplegar el sitio sin un paso de build; detecta automáticamente las funciones Node.js en `api/`. La carpeta `supabase/` contiene el esquema SQL que se aplica una vez al proyecto de Supabase.
