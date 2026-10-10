# WhatsApp Studio

Sitio estático servido por Vercel, con funciones Node.js en `api/`. El cliente crea packs `.wastickers`; cada sticker WebP también se archiva en el chat privado del bot de Telegram. El catálogo compartido vive en `stickers.json`, dentro del repositorio GitHub, y las funciones de Vercel lo actualizan y lo usan para alimentar la galería.

## Configuración de GitHub y Telegram

1. Mantén `stickers.json` en la raíz del repositorio. La aplicación lo actualiza mediante la API de GitHub.
2. Crea un token **Fine-grained personal access token** de GitHub limitado a este repositorio y con permiso **Contents: Read and write**. No lo pongas en el código ni lo compartas en el chat.
3. En Vercel, abre **Project → Settings → Environment Variables** y configura:
   - `GITHUB_TOKEN`: el token fine-grained. Es secreto.
   - `GITHUB_OWNER`: propietario del repositorio, por ejemplo `di4nderas`.
   - `GITHUB_REPO`: nombre del repositorio, por ejemplo `stickers`.
   - `GITHUB_BRANCH`: rama de despliegue, normalmente `main`.
   - `GITHUB_CATALOG_PATH`: `stickers.json`.
   - `TELEGRAM_BOT_TOKEN`: token de BotFather. Es secreto.
   - `TELEGRAM_CHAT_ID`: ID de tu chat privado con el bot.
4. Si aún no obtuviste el ID privado, configura temporalmente `TELEGRAM_SETUP_KEY` en Vercel, abre el bot, pulsa **Start** y envíale `/start`. Consulta `/api/telegram-setup` con la clave para obtener `privateChats[].chatId`; luego agrega `TELEGRAM_CHAT_ID`, vuelve a desplegar y elimina `TELEGRAM_SETUP_KEY`.
5. Cada nuevo sticker se guarda en Telegram y se agrega a `stickers.json` con estado `pending`. Para aprobarlo, edita ese archivo en GitHub y cambia el `status` de ese elemento a `approved`; guarda el cambio. Solo los stickers aprobados aparecen en la galería pública.

El repositorio público permite que cualquiera lea el catálogo, pero solo las funciones de Vercel reciben el token de escritura de GitHub y el token de Telegram. La carga admite WebP de hasta 490 KB, evita duplicados y limita cada IP anonimizada a 120 envíos por hora. Nunca se guarda la IP en claro.

Cada sticker actualiza el archivo del catálogo en GitHub: primero se reserva para evitar duplicados y luego se guarda su identificador de Telegram. GitHub conserva el historial de esos cambios. Las imágenes permanecen en el chat privado de Telegram; visitantes de la web no tienen acceso al chat ni a los secretos.

## Publicar

Mantén `index.html`, `styles.css`, `app.js`, `stickers.json` y las carpetas `api/` y `lib/` en la raíz del repositorio. Vercel detecta las funciones Node.js en `api/` sin paso de build.
