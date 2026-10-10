/* ============================================================
     NAVEGACIÓN ENTRE PANTALLAS
     ============================================================ */
  (function () {
    const STORAGE_PREFIX = 'wa-studio-last-';
    const list = document.getElementById('chatList');
    const searchInput = document.getElementById('searchInput');
    const rows = Array.from(document.querySelectorAll('.wa-chat'));

    function formatChatTime(ts) {
      if (!ts) return '';
      const now = new Date();
      const d = new Date(ts);
      const pad = n => String(n).padStart(2, '0');

      const sameDay = d.toDateString() === now.toDateString();
      if (sameDay) {
        let h = d.getHours();
        const m = d.getMinutes();
        const ampm = h >= 12 ? 'p.m.' : 'a.m.';
        h = h % 12 || 12;
        return h + ':' + pad(m) + ' ' + ampm;
      }

      const yest = new Date(now); yest.setDate(now.getDate() - 1);
      if (d.toDateString() === yest.toDateString()) return 'ayer';

      const days = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
      const diffDays = Math.floor((now - d) / 86400000);
      if (diffDays < 7) return days[d.getDay()];

      if (d.getFullYear() === now.getFullYear()) {
        return pad(d.getDate()) + '/' + pad(d.getMonth() + 1);
      }
      return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
    }

    function renderTimes() {
      document.querySelectorAll('[data-tool-time]').forEach(el => {
        const key = el.dataset.toolTime;
        let ts = null;
        try { ts = localStorage.getItem(STORAGE_PREFIX + key); } catch (_) {}
        el.textContent = ts ? formatChatTime(parseInt(ts, 10)) : '';
      });
    }

    function stampTool(toolId) {
      try { localStorage.setItem(STORAGE_PREFIX + toolId, String(Date.now())); } catch (_) {}
      renderTimes();
    }

    function openTool(toolId) {
      const tool = document.getElementById(toolId);
      if (!tool) return;
      document.body.dataset.currentTool = toolId;
      tool.classList.add('is-open');
      tool.setAttribute('aria-hidden', 'false');
      tool.scrollTop = 0;
      stampTool(toolId);
    }

    function closeTool(toolId) {
      const tool = document.getElementById(toolId);
      if (!tool) return;
      tool.classList.remove('is-open');
      tool.setAttribute('aria-hidden', 'true');
      document.body.dataset.currentTool = '';
      const row = rows.find(r => r.dataset.tool === toolId);
      if (row) row.focus({ preventScroll: true });
    }

    rows.forEach(row => {
      row.addEventListener('click', () => openTool(row.dataset.tool));
      row.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openTool(row.dataset.tool);
        }
      });
    });

    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => closeTool(btn.dataset.close));
    });

    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      const current = document.body.dataset.currentTool;
      if (current) closeTool(current);
    });

    if (searchInput) {
      searchInput.addEventListener('input', e => {
        const q = e.target.value
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');

        rows.forEach(row => {
          if (!q) { row.hidden = false; return; }
          const name = row.querySelector('.wa-chat__name').textContent
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
          const last = row.querySelector('.wa-chat__last').textContent
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
          row.hidden = !(name.includes(q) || last.includes(q));
        });
      });
    }

    renderTimes();
  })();

  /* ============================================================
     TOOL 1 - CREADOR DE PACKS .wastickers
     ============================================================ */
  (function () {
    const SIZE = 512, MAX_PER_PACK = 30;
    const ANIM_LIMIT = 490 * 1024, STATIC_LIMIT = 98 * 1024, MAX_MS = 9800;

    const $ = id => document.getElementById('t1-' + id);
    const fileInput = $('fileInput');
    const buildBtn  = $('buildBtn');
    const chatBody  = $('chatBody');
    const field     = $('field');
    const attach    = $('attach');
    const avatar    = $('avatar');
    const titleIn   = $('title');
    const authorIn  = $('author');
    const moreBtn   = $('moreBtn');
    const menu      = $('menu');
    const live      = $('live');

    let items = [];
    let progEl = null;

    const tick = () => new Promise(r => setTimeout(r));

    function announce(text) { live.textContent = text; }

    function scrollToEnd() {
      chatBody.scrollTop = chatBody.scrollHeight;
    }

    /* ---------- Burbujas ---------- */

    function pushIn(text) {
      const el = document.createElement('div');
      el.className = 'msg msg--in';
      el.innerHTML = '<p class="msg__text"></p>';
      el.querySelector('.msg__text').textContent = text;
      chatBody.appendChild(el);
      scrollToEnd();
      return el;
    }

    function pushErr(text) {
      const el = document.createElement('div');
      el.className = 'msg msg--err';
      el.innerHTML = '<p class="msg__text"></p>';
      el.querySelector('.msg__text').textContent = text;
      chatBody.appendChild(el);
      scrollToEnd();
      return el;
    }

    function pushOutFile(it) {
      const el = document.createElement('div');
      el.className = 'msg msg--out';
      el.innerHTML =
        '<img class="msg__img" alt="">' +
        '<p class="msg__title"></p>' +
        '<p class="msg__meta"><span data-size></span></p>';
      el.querySelector('.msg__img').src = it.url;
      el.querySelector('.msg__title').textContent = it.file.name;
      it.msgEl = el;
      it.metaEl = el.querySelector('[data-size]');

      const kb = Math.max(1, Math.round(it.file.size / 1024));
      it.metaEl.textContent = it.animated
        ? `${kb} KB, animado, ${it.frames} fotogramas`
        : `${kb} KB, estático`;

      chatBody.appendChild(el);
      scrollToEnd();
    }

    function setProgress(text) {
      if (!progEl) {
        progEl = document.createElement('div');
        progEl.className = 'msg msg--prog';
        progEl.innerHTML = '<p class="msg__text"></p>';
        chatBody.appendChild(progEl);
      }
      progEl.querySelector('.msg__text').textContent = text;
      scrollToEnd();
    }

    function clearProgress() {
      if (progEl) { progEl.remove(); progEl = null; }
    }

    function mimeOf(file) {
      if (file.type) return file.type;
      const ext = file.name.split('.').pop().toLowerCase();
      return { gif:'image/gif', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg' }[ext] || 'image/webp';
    }

    async function openDecoder(file) {
      const d = new ImageDecoder({ data: await file.arrayBuffer(), type: mimeOf(file) });
      await d.tracks.ready; await d.completed;
      return d;
    }

    function updateFieldLabel() {
      if (!items.length) { field.textContent = 'Añade tus imágenes…'; return; }
      const a = items.filter(i => i.animated).length;
      const s = items.length - a;
      let msg = items.length === 1 ? '1 archivo' : `${items.length} archivos`;
      if (a && s) msg += ` (${a} animados, ${s} estáticos)`;
      field.textContent = msg + '. Añade más…';
    }

    function updateAvatar() {
      const first = items.find(i => i.url);
      if (first) {
        avatar.style.backgroundImage = `url("${first.url}")`;
        avatar.innerHTML = '';
      } else {
        avatar.style.backgroundImage = '';
        avatar.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.6-.8L3 21l1.9-5.1A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z"/></svg>';
      }
    }

    attach.addEventListener('click', () => fileInput.click());
    field.addEventListener('click', () => fileInput.click());

    let dragDepth = 0;
    chatBody.addEventListener('dragenter', e => { e.preventDefault(); dragDepth++; chatBody.classList.add('is-over'); });
    chatBody.addEventListener('dragover', e => e.preventDefault());
    chatBody.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; chatBody.classList.remove('is-over'); } });
    chatBody.addEventListener('drop', e => {
      e.preventDefault(); dragDepth = 0; chatBody.classList.remove('is-over');
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length) addFiles(files);
    });
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', e => e.preventDefault());

    fileInput.addEventListener('change', e => {
      const files = Array.from(e.target.files || []);
      if (files.length) addFiles(files);
      fileInput.value = '';
    });

    async function addFiles(files) {
      if (!('ImageDecoder' in window)) {
        pushErr('Este navegador no puede leer WebP animados. Usa Chrome o Edge actualizado.');
        return;
      }

      for (const file of files) {
        const url = URL.createObjectURL(file);
        let frames = 1;
        try {
          const d = await openDecoder(file);
          frames = d.tracks.selectedTrack.frameCount;
          d.close();
        } catch (_) {}
        const it = { file, url, frames, animated: frames > 1, out: null };
        items.push(it);
        pushOutFile(it);
      }

      updateFieldLabel();
      updateAvatar();
      buildBtn.disabled = items.length === 0;

      const a = items.filter(i => i.animated).length;
      const s = items.length - a;
      if (a && s && !items._warned) {
        items._warned = true;
        pushIn('Tienes animados y estáticos a la vez. WhatsApp no los mezcla en un mismo pack, así que se crearán packs separados.');
      }

      announce(`${items.length} archivos añadidos.`);
    }

    const work = document.createElement('canvas');
    work.width = work.height = SIZE;
    const wctx = work.getContext('2d', { willReadFrequently: true });

    function drawContain(src, w, h) {
      wctx.clearRect(0, 0, SIZE, SIZE);
      const s = Math.min(SIZE / w, SIZE / h);
      wctx.drawImage(src, (SIZE - w * s) / 2, (SIZE - h * s) / 2, w * s, h * s);
    }

    function toWebpBlob(q) {
      return new Promise((res, rej) => work.toBlob(
        b => (b && b.type === 'image/webp') ? res(b) : rej(new Error('Este navegador no puede codificar WebP. Usa Chrome o Edge.')),
        'image/webp', q));
    }

    /* ---------- Vista previa del pack ---------- */

    function loadImage(src) {
      return new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = src;
      });
    }

    function makeDoodleDataUrl() {
      const svg = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260" viewBox="0 0 260 260">',
        '<rect width="260" height="260" fill="#0B141A"/>',
        '<g fill="none" stroke="#FFFFFF" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" opacity="0.07">',
        '<g transform="translate(16 18)"><path d="M12 21C7 17.5 2 13.5 2 8.5A5.5 5.5 0 0 1 12 5.5 5.5 5.5 0 0 1 22 8.5c0 5-5 9-10 12.5z"/></g>',
        '<g transform="translate(148 10)"><path d="M11 .8 13.8 8 21.5 8.6l-6 5 2 7.6L11 17.2.5 21.2l2-7.6-6-5L4.2 8z"/></g>',
        '<g transform="translate(90 26)"><rect x="0" y="4" width="26" height="18" rx="3.5"/><path d="M8 4l2-3h6l2 3"/><circle cx="13" cy="13" r="5"/></g>',
        '<g transform="translate(212 22)"><circle cx="12" cy="12" r="11"/><circle cx="8.2" cy="9.5" r="1.1" fill="#FFFFFF" stroke="none"/><circle cx="15.8" cy="9.5" r="1.1" fill="#FFFFFF" stroke="none"/><path d="M6.5 14.5a6.5 6.5 0 0 0 11 0"/></g>',
        '<g transform="translate(34 82)"><path d="M0 7a6 6 0 0 1 6-6h18a6 6 0 0 1 6 6v9a6 6 0 0 1-6 6H11l-8 6v-6H6a6 6 0 0 1-6-6z"/></g>',
        '<g transform="translate(120 96)"><ellipse cx="4" cy="20" rx="4.5" ry="3.5"/><ellipse cx="17" cy="17.5" rx="4.5" ry="3.5"/><path d="M8.5 20V3l13-3v17"/></g>',
        '<g transform="translate(198 92)"><path d="M15 2A11 11 0 1 0 15 24 9 9 0 0 1 15 2z"/></g>',
        '<g transform="translate(28 162)"><circle cx="12" cy="6" r="4"/><circle cx="6" cy="14" r="4"/><circle cx="18" cy="14" r="4"/><circle cx="10" cy="22" r="4"/><circle cx="12" cy="14" r="2.2" fill="#FFFFFF" stroke="none"/></g>',
        '<g transform="translate(106 172)"><path d="M2 8h20v9a6 6 0 0 1-6 6H8a6 6 0 0 1-6-6z"/><path d="M22 11h3a4 4 0 0 1 0 8h-3"/><path d="M7 1.5v3M12 1.5v3M17 1.5v3" opacity=".8"/></g>',
        '<g transform="translate(180 174)"><path d="M13 0 2 15h8l-2 11L22 10h-8z"/></g>',
        '<g transform="translate(48 208)"><path d="M0 2 22 2 11 22z"/><circle cx="8" cy="8" r="1.2" fill="#FFFFFF" stroke="none"/><circle cx="15" cy="8" r="1.2" fill="#FFFFFF" stroke="none"/><circle cx="11" cy="14" r="1.2" fill="#FFFFFF" stroke="none"/></g>',
        '<g transform="translate(158 200)"><path d="M3 8 2 1l6 3h8l6-3-1 7v6a9 9 0 0 1-18 0z"/><circle cx="8" cy="10" r="1" fill="#FFFFFF" stroke="none"/><circle cx="16" cy="10" r="1" fill="#FFFFFF" stroke="none"/><path d="M10 14.5h4M4 12l-3-1M4 15H1M20 12l3-1M20 15h3"/></g>',
        '</g></svg>'
      ].join('');
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    async function generatePreview(stickerBlobs) {
      const count = stickerBlobs.length;
      if (!count) return null;

      const CELL = 200;
      const GAP = 16;
      const PADDING = 32;
      const COLS = Math.min(6, Math.max(1, Math.ceil(Math.sqrt(count * 1.2))));
      const ROWS = Math.ceil(count / COLS);

      const W = PADDING * 2 + COLS * CELL + (COLS - 1) * GAP;
      const H = PADDING * 2 + ROWS * CELL + (ROWS - 1) * GAP;

      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#0B141A';
      ctx.fillRect(0, 0, W, H);

      try {
        const img = await loadImage(makeDoodleDataUrl());
        const pat = ctx.createPattern(img, 'repeat');
        if (pat) {
          ctx.fillStyle = pat;
          ctx.fillRect(0, 0, W, H);
        }
      } catch (e) {
        console.warn('No se pudo cargar el fondo de garabatos:', e);
      }

      const bitmaps = await Promise.all(stickerBlobs.map(async b => {
        try { return await createImageBitmap(b); }
        catch (_) { return null; }
      }));

      for (let i = 0; i < count; i++) {
        const col = i % COLS;
        const row = (i / COLS) | 0;
        const x = PADDING + col * (CELL + GAP);
        const y = PADDING + row * (CELL + GAP);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x, y, CELL, CELL, 16);
        } else {
          const r = 16;
          ctx.moveTo(x + r, y);
          ctx.arcTo(x + CELL, y, x + CELL, y + CELL, r);
          ctx.arcTo(x + CELL, y + CELL, x, y + CELL, r);
          ctx.arcTo(x, y + CELL, x, y, r);
          ctx.arcTo(x, y, x + CELL, y, r);
          ctx.closePath();
        }
        ctx.fill();

        const bmp = bitmaps[i];
        if (!bmp) continue;

        const scale = Math.min(CELL / bmp.width, CELL / bmp.height) * 0.86;
        const iw = bmp.width * scale;
        const ih = bmp.height * scale;
        ctx.drawImage(bmp, x + (CELL - iw) / 2, y + (CELL - ih) / 2, iw, ih);
        bmp.close();
      }

      return new Promise(res => canvas.toBlob(res, 'image/png'));
    }

    /* ---------- Muxer WebP animado ---------- */

    const u24 = v => [v & 255, (v >> 8) & 255, (v >> 16) & 255];
    const u32 = v => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
    const tag4 = s => [...s].map(c => c.charCodeAt(0));

    function mk(tag, payload) {
      const pad = payload.length & 1;
      const out = new Uint8Array(8 + payload.length + pad);
      out.set(tag4(tag), 0); out.set(u32(payload.length), 4); out.set(payload, 8);
      return out;
    }
    function concat(parts) {
      const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
      let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
      return out;
    }
    function imageChunks(buf) {
      const u8 = new Uint8Array(buf), dv = new DataView(buf), parts = [];
      let off = 12;
      while (off + 8 <= u8.length) {
        const tag = String.fromCharCode(...u8.subarray(off, off + 4));
        const sz = dv.getUint32(off + 4, true);
        const end = Math.min(off + 8 + sz + (sz & 1), u8.length);
        if (tag === 'ALPH' || tag === 'VP8 ' || tag === 'VP8L') parts.push(u8.subarray(off, end));
        off = end;
      }
      return concat(parts);
    }
    function muxAnimated(frames) {
      const vp8x = mk('VP8X', new Uint8Array([0x12, 0, 0, 0, ...u24(SIZE - 1), ...u24(SIZE - 1)]));
      const anim = mk('ANIM', new Uint8Array([0, 0, 0, 0, 0, 0]));
      const anmf = frames.map(f => mk('ANMF', concat([
        new Uint8Array([...u24(0), ...u24(0), ...u24(SIZE - 1), ...u24(SIZE - 1), ...u24(f.duration), 0x03]),
        f.data
      ])));
      const body = concat([new Uint8Array(tag4('WEBP')), vp8x, anim, ...anmf]);
      return new Blob([concat([new Uint8Array(tag4('RIFF')), new Uint8Array(u32(body.length)), body])], { type: 'image/webp' });
    }

    /* ---------- Reencodado ---------- */

    async function encodeAnimated(file, label) {
      const d = await openDecoder(file);
      const n = d.tracks.selectedTrack.frameCount;
      const bmps = [], durs = []; let total = 0, truncated = false;

      for (let i = 0; i < n; i++) {
        const { image } = await d.decode({ frameIndex: i });
        const dur = Math.max(20, Math.round((image.duration || 100000) / 1000));
        if (total + dur > MAX_MS) { image.close(); truncated = true; break; }
        total += dur;
        drawContain(image, image.displayWidth, image.displayHeight);
        bmps.push(await createImageBitmap(work)); durs.push(dur);
        image.close();
        if (i % 5 === 0) await tick();
      }
      d.close();

      let best = null;
      for (const step of [1, 2, 3]) {
        for (const q of [0.8, 0.6, 0.4, 0.25]) {
          setProgress(`${label}\nProbando calidad ${Math.round(q * 100)} %, uno de cada ${step} fotogramas…`);
          const frames = [];
          for (let i = 0; i < bmps.length; i += step) {
            wctx.clearRect(0, 0, SIZE, SIZE);
            wctx.drawImage(bmps[i], 0, 0);
            const dur = durs.slice(i, i + step).reduce((a, b) => a + b, 0);
            frames.push({ data: imageChunks(await (await toWebpBlob(q)).arrayBuffer()), duration: dur });
            if (frames.length % 5 === 0) await tick();
          }
          const blob = muxAnimated(frames);
          if (!best || blob.size < best.size) best = blob;
          if (blob.size <= ANIM_LIMIT) { bmps.forEach(b => b.close()); return { blob, frames: frames.length, truncated }; }
        }
      }
      bmps.forEach(b => b.close());
      return { blob: best, frames: null, truncated, tooBig: true };
    }

    async function encodeStatic(file) {
      const d = await openDecoder(file);
      const { image } = await d.decode({ frameIndex: 0 });
      drawContain(image, image.displayWidth, image.displayHeight);
      image.close(); d.close();
      let best = null;
      for (const q of [0.9, 0.75, 0.6, 0.45, 0.3, 0.15]) {
        const blob = await toWebpBlob(q);
        if (!best || blob.size < best.size) best = blob;
        if (blob.size <= STATIC_LIMIT) return { blob };
      }
      return { blob: best, tooBig: true };
    }

    function makeTray(blob) {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob), img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas'); c.width = c.height = 96;
          c.getContext('2d').drawImage(img, 0, 0, 96, 96);
          URL.revokeObjectURL(url);
          c.toBlob(b => b ? resolve(b) : reject(new Error('No se pudo crear el ícono')), 'image/png');
        };
        img.onerror = () => reject(new Error('No se pudo crear el ícono'));
        img.src = url;
      });
    }

    function chunk(arr) {
      const out = [];
      for (let i = 0; i < arr.length; i += MAX_PER_PACK) out.push(arr.slice(i, i + MAX_PER_PACK));
      return out;
    }

    function pushResult({ title, url, filename, count, size }) {
      const el = document.createElement('div');
      el.className = 'msg msg--in';
      el.innerHTML =
        '<div class="msg__file">' +
          '<div class="msg__file-icon" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/>' +
              '<path d="M14 2v5h5"/>' +
            '</svg>' +
          '</div>' +
          '<div class="msg__file-text">' +
            '<p class="msg__title"></p>' +
            '<p class="msg__meta"><span></span></p>' +
          '</div>' +
        '</div>' +
        '<a class="msg__dl" download>Descargar otra vez</a>';
      el.querySelector('.msg__title').textContent = title;
      el.querySelector('.msg__meta span').textContent =
        `${count} ${count === 1 ? 'sticker' : 'stickers'}, ${Math.round(size / 1024)} KB`;
      const a = el.querySelector('.msg__dl');
      a.href = url; a.download = filename;
      chatBody.appendChild(el);
      scrollToEnd();
    }

    function pushPreviewResult(m) {
      const el = document.createElement('div');
      el.className = 'msg msg--in';
      el.innerHTML =
        '<div class="msg__file">' +
          '<div class="msg__file-icon msg__file-icon--preview" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
              '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
              '<circle cx="8.5" cy="8.5" r="1.5"/>' +
              '<path d="M21 15l-5-5L5 21"/>' +
            '</svg>' +
          '</div>' +
          '<div class="msg__file-text">' +
            '<p class="msg__title"></p>' +
            '<p class="msg__meta"><span></span></p>' +
          '</div>' +
        '</div>' +
        '<a class="msg__dl" download>Descargar vista previa</a>';
      el.querySelector('.msg__title').textContent = m.preview.filename;
      el.querySelector('.msg__meta span').textContent =
        `Vista previa · ${m.count} ${m.count === 1 ? 'sticker' : 'stickers'} · ${Math.round(m.preview.size / 1024)} KB`;
      const a = el.querySelector('.msg__dl');
      a.href = m.preview.url;
      a.download = m.preview.filename;
      chatBody.appendChild(el);
      scrollToEnd();
    }

    buildBtn.addEventListener('click', async () => {
      buildBtn.disabled = true;

      const baseTitle = titleIn.value.trim() || 'Mi pack';
      const author = (authorIn.value.replace(/^Autor:\s*/i, '') || 'Yo').trim();
      authorIn.value = 'Autor: ' + author;

      const problems = [];

      try {
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          const label = `Preparando ${it.file.name} (${i + 1} de ${items.length})`;
          setProgress(label);

          let r;
          try {
            r = it.animated ? await encodeAnimated(it.file, label) : await encodeStatic(it.file);
          } catch (err) {
            console.error(it.file.name, err);
            if (it.metaEl) {
              it.metaEl.textContent = 'No se pudo leer';
              it.metaEl.classList.add('msg__meta--warn');
            }
            problems.push(`${it.file.name} no se pudo procesar y se omitió.`);
            continue;
          }

          it.out = r.blob;
          const parts = [`${Math.round(r.blob.size / 1024)} KB`];
          if (r.truncated) parts.push('recortado a 10 s');
          if (r.tooBig) parts.push('sigue pesando demasiado');
          if (it.metaEl) {
            it.metaEl.textContent = parts.join(', ');
            if (r.truncated || r.tooBig) it.metaEl.classList.add('msg__meta--warn');
          }
          if (r.truncated || r.tooBig) {
            problems.push(r.tooBig
              ? `${it.file.name} sigue por encima del límite.`
              : `${it.file.name} se recortó a 10 segundos.`);
          }
          await tick();
        }

        const ok = items.filter(i => i.out);
        if (!ok.length) throw new Error('Ningún archivo se pudo procesar.');

        const groups = [
          ...chunk(ok.filter(i => i.animated)).map(c => ({ kind: 'animados', files: c })),
          ...chunk(ok.filter(i => !i.animated)).map(c => ({ kind: 'estáticos', files: c }))
        ];
        const hasBoth = ok.some(i => i.animated) && ok.some(i => !i.animated);
        let stamp = Math.floor(Date.now() / 1000);
        const made = [];

        for (let p = 0; p < groups.length; p++) {
          const g = groups[p];
          const title = baseTitle + (groups.length > 1 ? ` ${p + 1}` : '') + (hasBoth ? ` (${g.kind})` : '');
          setProgress(`Empaquetando «${title}»…`);

          const zip = new JSZip();
          zip.file('author.txt', author);
          zip.file('title.txt', title);
          for (const it of g.files) zip.file((stamp++) + '.webp', await it.out.arrayBuffer(), { compression: 'STORE' });
          zip.file((stamp++) + '.png', await makeTray(g.files[0].out), { compression: 'STORE' });

          const blob = await zip.generateAsync({ type: 'blob' });
          const filename = title.replace(/[\\/:*?"<>|]/g, '_') + '.wastickers';
          const url = URL.createObjectURL(blob);

          const a = document.createElement('a');
          a.href = url; a.download = filename;
          document.body.appendChild(a); a.click(); a.remove();

          const entry = { title, filename, url, count: g.files.length, size: blob.size, preview: null };

          /* Generar vista previa del pack */
          setProgress(`Generando vista previa de «${title}»…`);
          try {
            const previewBlob = await generatePreview(g.files.map(f => f.out));
            if (previewBlob) {
              const previewFilename = title.replace(/[\\/:*?"<>|]/g, '_') + '-vista-previa.png';
              entry.preview = {
                filename: previewFilename,
                url: URL.createObjectURL(previewBlob),
                size: previewBlob.size
              };
            }
          } catch (err) {
            console.warn('No se pudo generar la vista previa:', err);
          }

          made.push(entry);
          await new Promise(r => setTimeout(r, 800));
        }

        clearProgress();

        /* Publicar en el chat: pack primero, luego su vista previa */
        for (const m of made) {
          pushResult(m);
          if (m.preview) pushPreviewResult(m);
        }

        const small = groups.filter(g => g.files.length < 3).length;
        let summary = made.length === 1
          ? 'Listo. 1 pack descargado.'
          : `Listo. ${made.length} packs descargados.`;
        if (small) summary += ` ${small === 1 ? 'Un pack tiene' : 'Algunos packs tienen'} menos de 3 stickers y WhatsApp los rechazará.`;
        if (problems.length) summary += ' Avisos: ' + problems.join(' ');

        pushIn(summary);
        announce(summary);
      } catch (err) {
        console.error(err);
        clearProgress();
        pushErr(err.message);
        announce('Error: ' + err.message);
      }

      buildBtn.disabled = items.length === 0;
    });

    moreBtn.addEventListener('click', e => {
      e.stopPropagation();
      const open = menu.hidden;
      menu.hidden = !open;
      moreBtn.setAttribute('aria-expanded', String(open));
    });

    document.addEventListener('click', () => {
      menu.hidden = true;
      moreBtn.setAttribute('aria-expanded', 'false');
    });

    menu.addEventListener('click', e => e.stopPropagation());

    $('clearList').addEventListener('click', () => {
      items.forEach(i => URL.revokeObjectURL(i.url));
      items = [];
      chatBody.querySelectorAll('.msg--out, .msg--prog, .msg--err').forEach(el => el.remove());
      chatBody.querySelectorAll('.msg__meta--warn').forEach(el => el.classList.remove('msg__meta--warn'));
      clearProgress();
      updateFieldLabel();
      updateAvatar();
      buildBtn.disabled = true;
      menu.hidden = true;
      announce('Lista borrada.');
    });

    $('resetNames').addEventListener('click', () => {
      titleIn.value = 'Mi pack';
      authorIn.value = 'Autor: Yo';
      menu.hidden = true;
    });

    updateFieldLabel();
    updateAvatar();
  })();

  /* ============================================================
     TOOL 2 - EDITOR DE VÍDEO/IMAGEN A STICKER
     ============================================================ */
  (function () {
    const SIZE = 512;
    const MAX_DURATION = 5.0;
    const MIN_DURATION = 1.0;
    const DEFAULT_DURATION = 3.0;
    const ANIM_LIMIT = 490 * 1024;
    const STATIC_LIMIT = 98 * 1024;
    const MIN_SIDE = 32;
    const MAX_FILE_MB = 50;

    const $ = id => document.getElementById('t2-' + id);
    const toolRoot     = document.getElementById('tool2');
    const stage        = $('stage');
    const stageEmpty   = $('stageEmpty');
    const stageVideo   = $('stageVideo');
    const video        = $('video');
    const image        = $('image');
    const fileInput    = $('fileInput');
    const pickBtn      = $('pickBtn');
    const cropEl       = $('crop');
    const cropFrame    = $('cropFrame');
    const cropLabel    = $('cropLabel');
    const shadeTop     = $('shadeTop');
    const shadeBottom  = $('shadeBottom');
    const shadeLeft    = $('shadeLeft');
    const shadeRight   = $('shadeRight');

    const fab          = $('fab');
    const fabPanel     = $('fabPanel');
    const fabBadge     = $('fabBadge');
    const fabNote      = $('fabNote');
    const fpsField     = $('fpsField');

    const player       = $('player');
    const playBtn      = $('playBtn');
    const playIcon     = $('playIcon');
    const pauseIcon    = $('pauseIcon');
    const scrubber     = $('scrubber');
    const scrubberMarks= $('scrubberMarks');
    const timeNow      = $('timeNow');
    const timeTotal    = $('timeTotal');
    const markStartBtn = $('markStartBtn');
    const markEndBtn   = $('markEndBtn');

    const fileActions  = $('fileActions');
    const timelineWrap = $('timelineWrap');
    const timeline     = $('timeline');
    const timelineRange= $('timelineRange');
    const handleStart  = $('handleStart');
    const handleEnd    = $('handleEnd');
    const tStart       = $('tStart');
    const tEnd         = $('tEnd');
    const tLength      = $('tLength');

    const fpsSelect    = $('fps');
    const keyA         = $('keyA');
    const keyB         = $('keyB');
    const keyC         = $('keyC');
    const valA         = $('valA');
    const valB         = $('valB');
    const valC         = $('valC');
    const valD         = $('valD');
    const statusEl     = $('status');
    const buildBtn     = $('buildBtn');
    const clearBtn     = $('clearBtn');
    const resultsEl    = $('results');

    let mode = null;
    let imageFormat = '';
    let naturalW = 0, naturalH = 0;
    let duration = 0;
    let orientation = 'horizontal';

    let sel = { x: 0, y: 0, size: 0 };
    let range = { start: 0, end: DEFAULT_DURATION };

    let currentUrl = null;
    let dragCrop = null;
    let dragMove = null;
    let dragRange = null;
    let seekTimer = null;
    let scrubbing = false;

    function activeMedia() { return mode === 'video' ? video : image; }

    const tick = () => new Promise(r => setTimeout(r));
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    function setStatus(text, kind) {
      const show = text && (kind === 'busy' || kind === 'warn');
      statusEl.textContent = text || '';
      statusEl.className = 'status' + (kind ? ' is-' + kind : '');
      statusEl.hidden = !show;
    }

    function fmtTime(t) { return t.toFixed(1) + ' s'; }
    function fmtKB(bytes) { return Math.round(bytes / 1024) + ' KB'; }
    function fmtClock(t) {
      const s = Math.max(0, Math.floor(t));
      const m = Math.floor(s / 60);
      return m + ':' + String(s % 60).padStart(2, '0');
    }
    function classifyOrientation(w, h) {
      if (Math.abs(w - h) < Math.min(w, h) * 0.02) return 'cuadrado';
      return h > w ? 'vertical' : 'horizontal';
    }
    function isAcceptedType(type) {
      if (!type) return false;
      if (type.startsWith('video/')) return true;
      if (type === 'image/jpeg' || type === 'image/png' || type === 'image/webp') return true;
      return false;
    }
    function extToFormat(name) {
      const ext = (name.split('.').pop() || '').toLowerCase();
      if (ext === 'jpg' || ext === 'jpeg') return 'JPG';
      if (ext === 'png') return 'PNG';
      if (ext === 'webp') return 'WEBP';
      return ext.toUpperCase();
    }

    function openFab() { fabPanel.hidden = false; fab.setAttribute('aria-expanded', 'true'); }
    function closeFab() { fabPanel.hidden = true; fab.setAttribute('aria-expanded', 'false'); }

    fab.addEventListener('click', e => { e.stopPropagation(); if (fabPanel.hidden) openFab(); else closeFab(); });
    fabPanel.addEventListener('click', e => e.stopPropagation());
    toolRoot.addEventListener('click', () => { if (!fabPanel.hidden) closeFab(); });
    toolRoot.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !fabPanel.hidden) { closeFab(); fab.focus(); }
    });

    const mediaObserver = new ResizeObserver(() => {
      if (!naturalW) return;
      syncCropContainer();
      renderCrop();
    });

    pickBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', e => {
      const file = e.target.files?.[0];
      fileInput.value = '';
      if (file) loadFile(file);
    });

    let dragDepth = 0;
    stage.addEventListener('dragenter', e => { e.preventDefault(); dragDepth++; stage.classList.add('is-over'); });
    stage.addEventListener('dragover', e => e.preventDefault());
    stage.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; stage.classList.remove('is-over'); } });
    stage.addEventListener('drop', e => {
      e.preventDefault(); dragDepth = 0; stage.classList.remove('is-over');
      const file = Array.from(e.dataTransfer?.files || [])[0];
      if (file) loadFile(file);
    });
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', e => e.preventDefault());

    async function loadFile(file) {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setStatus(`El archivo pasa de ${MAX_FILE_MB} MB. Prueba con uno más pequeño.`, 'warn');
        return;
      }
      if (!isAcceptedType(file.type)) {
        setStatus('Formato no soportado. Usa MP4, WebM, MOV, JPG, PNG o WebP.', 'warn');
        return;
      }

      teardownMedia();

      if (currentUrl) URL.revokeObjectURL(currentUrl);
      currentUrl = URL.createObjectURL(file);

      const isVideo = file.type.startsWith('video/');
      mode = isVideo ? 'video' : 'image';

      setStatus('Cargando…', 'busy');

      try {
        if (isVideo) {
          await setupVideo();
        } else {
          imageFormat = extToFormat(file.name);
          await setupImage();
        }

        orientation = classifyOrientation(naturalW, naturalH);

        const side = Math.round(Math.min(naturalW, naturalH) * 0.55);
        const yStart = orientation === 'vertical'
          ? Math.round(naturalH * 0.06)
          : Math.round((naturalH - side) / 2);

        sel = { x: Math.round((naturalW - side) / 2), y: yStart, size: side };

        if (mode === 'video') {
          const dflt = Math.min(DEFAULT_DURATION, duration);
          range = { start: 0, end: dflt };
        }

        stage.dataset.state = 'ready';
        stageEmpty.hidden = true;
        stageVideo.hidden = false;
        fileActions.hidden = false;
        buildBtn.hidden = false;
        buildBtn.disabled = false;
        resultsEl.innerHTML = '';

        if (mode === 'video') {
          player.hidden = false;
          timelineWrap.hidden = false;
          video.hidden = false;
          image.hidden = true;
        } else {
          player.hidden = true;
          timelineWrap.hidden = true;
          video.hidden = true;
          image.hidden = false;
        }

        fab.hidden = false;
        closeFab();

        if (mode === 'video') {
          scrubber.min = 0;
          scrubber.max = duration;
          scrubber.value = 0;
          timeTotal.textContent = fmtClock(duration);
          timeNow.textContent = '0:00';
        }

        mediaObserver.disconnect();
        mediaObserver.observe(activeMedia());

        await tick(); await tick();
        syncCropContainer();
        renderCrop();

        if (mode === 'video') {
          renderTimeline();
          updateScrubberMarks();
          video.currentTime = range.start;
        }

        applyPanelMode();
        updateInfo();
        updateFabBadge();

        setStatus('');
      } catch (err) {
        console.error(err);
        setStatus(err.message, 'warn');
      }
    }

    async function setupVideo() {
      video.src = currentUrl;
      await new Promise((res, rej) => {
        const ok = () => { cleanup(); res(); };
        const err = () => { cleanup(); rej(new Error('Este navegador no puede leer ese vídeo.')); };
        const cleanup = () => {
          video.removeEventListener('loadedmetadata', ok);
          video.removeEventListener('error', err);
        };
        video.addEventListener('loadedmetadata', ok, { once: true });
        video.addEventListener('error', err, { once: true });
      });

      naturalW = video.videoWidth;
      naturalH = video.videoHeight;

      if (!isFinite(video.duration)) {
        video.currentTime = 1e7;
        await new Promise(r => {
          const onUpdate = () => { video.removeEventListener('timeupdate', onUpdate); r(); };
          video.addEventListener('timeupdate', onUpdate);
        });
        video.currentTime = 0;
      }

      duration = isFinite(video.duration) ? video.duration : 0;
      if (!naturalW || !naturalH || !duration) {
        throw new Error('No pudimos leer la duración o el tamaño del vídeo.');
      }
    }

    async function setupImage() {
      image.src = currentUrl;
      await new Promise((res, rej) => {
        const ok = () => { cleanup(); res(); };
        const err = () => { cleanup(); rej(new Error('Este navegador no puede leer esa imagen.')); };
        const cleanup = () => {
          image.removeEventListener('load', ok);
          image.removeEventListener('error', err);
        };
        image.addEventListener('load', ok, { once: true });
        image.addEventListener('error', err, { once: true });
      });

      naturalW = image.naturalWidth;
      naturalH = image.naturalHeight;
      duration = 0;

      if (!naturalW || !naturalH) {
        throw new Error('No pudimos leer el tamaño de la imagen.');
      }
    }

    function teardownMedia() {
      mediaObserver.disconnect();

      if (video.src) {
        try { video.pause(); } catch (_) {}
        video.removeAttribute('src');
        video.load();
      }
      video.hidden = true;

      image.removeAttribute('src');
      image.hidden = true;

      naturalW = naturalH = duration = 0;
      mode = null;
      imageFormat = '';
      sel = { x: 0, y: 0, size: 0 };
      range = { start: 0, end: DEFAULT_DURATION };
    }

    clearBtn.addEventListener('click', () => {
      teardownMedia();
      if (currentUrl) { URL.revokeObjectURL(currentUrl); currentUrl = null; }

      stage.dataset.state = 'empty';
      stageEmpty.hidden = false;
      stageVideo.hidden = true;
      player.hidden = true;
      timelineWrap.hidden = true;
      fileActions.hidden = true;
      buildBtn.hidden = true;
      buildBtn.disabled = true;
      resultsEl.innerHTML = '';
      fab.hidden = true;
      closeFab();
      setStatus('');
    });

    playBtn.addEventListener('click', () => {
      if (video.paused) {
        if (video.currentTime >= range.end - 0.05) video.currentTime = range.start;
        video.play().catch(err => console.warn(err));
      } else {
        video.pause();
      }
    });

    video.addEventListener('play', () => {
      playIcon.style.display = 'none';
      pauseIcon.style.display = '';
      playBtn.setAttribute('aria-label', 'Pausar');
    });

    video.addEventListener('pause', () => {
      playIcon.style.display = '';
      pauseIcon.style.display = 'none';
      playBtn.setAttribute('aria-label', 'Reproducir');
    });

    video.addEventListener('timeupdate', () => {
      if (scrubbing) return;
      scrubber.value = video.currentTime;
      timeNow.textContent = fmtClock(video.currentTime);
    });

    video.addEventListener('ended', () => {
      playIcon.style.display = '';
      pauseIcon.style.display = 'none';
      playBtn.setAttribute('aria-label', 'Reproducir');
    });

    scrubber.addEventListener('pointerdown', () => { scrubbing = true; });
    scrubber.addEventListener('pointerup', () => { scrubbing = false; });
    scrubber.addEventListener('pointercancel', () => { scrubbing = false; });

    scrubber.addEventListener('input', e => {
      const t = parseFloat(e.target.value);
      timeNow.textContent = fmtClock(t);
      try { video.currentTime = t; } catch (_) {}
    });

    scrubber.addEventListener('keydown', e => {
      if (e.key === 'Home') { e.preventDefault(); video.currentTime = 0; scrubber.value = 0; timeNow.textContent = '0:00'; }
      if (e.key === 'End')  { e.preventDefault(); video.currentTime = duration; scrubber.value = duration; timeNow.textContent = fmtClock(duration); }
    });

    function updateScrubberMarks() {
      scrubberMarks.innerHTML = '';
      if (!duration || mode !== 'video') return;
      const add = (t) => {
        const pct = (t / duration) * 100;
        const el = document.createElement('span');
        el.className = 'scrubber-mark';
        el.style.left = pct + '%';
        scrubberMarks.appendChild(el);
      };
      add(range.start); add(range.end);
    }

    markStartBtn.addEventListener('click', () => {
      if (mode !== 'video') return;
      let s = video.currentTime;
      let e = range.end;
      if (e - s < MIN_DURATION) e = s + MIN_DURATION;
      if (e - s > MAX_DURATION) e = s + MAX_DURATION;
      s = clamp(s, 0, Math.max(0, duration - MIN_DURATION));
      e = clamp(e, s + MIN_DURATION, Math.min(duration, s + MAX_DURATION));
      range.start = s; range.end = e;
      renderTimeline(); updateInfo(); updateScrubberMarks();
    });

    markEndBtn.addEventListener('click', () => {
      if (mode !== 'video') return;
      let e = video.currentTime;
      let s = range.start;
      if (e - s < MIN_DURATION) s = e - MIN_DURATION;
      if (e - s > MAX_DURATION) s = e - MAX_DURATION;
      s = clamp(s, 0, Math.max(0, duration - MIN_DURATION));
      e = clamp(e, s + MIN_DURATION, Math.min(duration, s + MAX_DURATION));
      range.start = s; range.end = e;
      renderTimeline(); updateInfo(); updateScrubberMarks();
    });

    function getQualityLabel(realPx) {
      if (realPx >= 512) return { label: 'nítido', kind: 'is-ok' };
      if (realPx >= 320) return { label: 'aceptable', kind: '' };
      return { label: 'borroso', kind: 'is-warn' };
    }

    function syncCropContainer() {
      const media = activeMedia();
      if (!media) return;
      const mediaRect = media.getBoundingClientRect();
      const stageRect = stageVideo.getBoundingClientRect();
      cropEl.style.left   = (mediaRect.left - stageRect.left) + 'px';
      cropEl.style.top    = (mediaRect.top  - stageRect.top)  + 'px';
      cropEl.style.width  = mediaRect.width  + 'px';
      cropEl.style.height = mediaRect.height + 'px';
    }

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', () => {
        if (!naturalW) return;
        syncCropContainer(); renderCrop();
      });
    }

    function renderCrop() {
      if (!naturalW) return;

      const pctX = (sel.x / naturalW) * 100;
      const pctY = (sel.y / naturalH) * 100;
      const pctW = (sel.size / naturalW) * 100;
      const pctH = (sel.size / naturalH) * 100;

      cropFrame.style.left   = pctX + '%';
      cropFrame.style.top    = pctY + '%';
      cropFrame.style.width  = pctW + '%';
      cropFrame.style.height = pctH + '%';

      shadeTop.style.height    = pctY + '%';
      shadeBottom.style.top    = (pctY + pctH) + '%';
      shadeLeft.style.top      = pctY + '%';
      shadeLeft.style.height   = pctH + '%';
      shadeLeft.style.width    = pctX + '%';
      shadeRight.style.top     = pctY + '%';
      shadeRight.style.height  = pctH + '%';
      shadeRight.style.left    = (pctX + pctW) + '%';

      cropEl.querySelectorAll('.crop__handle').forEach(h => {
        const c = h.dataset.corner;
        const hx = (c === 'tl' || c === 'bl') ? pctX : pctX + pctW;
        const hy = (c === 'tl' || c === 'tr') ? pctY : pctY + pctH;
        h.style.left = hx + '%';
        h.style.top  = hy + '%';
      });

      const realPx = Math.round(sel.size);
      const q = getQualityLabel(realPx);
      cropLabel.innerHTML = `512 × 512<small>${realPx} px del original · ${q.label}</small>`;
    }

    function pointerToMedia(e) {
      const media = activeMedia();
      const rect = media.getBoundingClientRect();
      return {
        x: clamp(((e.clientX - rect.left) / rect.width)  * naturalW, 0, naturalW),
        y: clamp(((e.clientY - rect.top)  / rect.height) * naturalH, 0, naturalH)
      };
    }

    cropFrame.addEventListener('pointerdown', e => {
      if (e.target.classList.contains('crop__handle')) return;
      e.preventDefault();
      const media = activeMedia();
      const rect = media.getBoundingClientRect();
      dragMove = {
        offsetX: ((e.clientX - rect.left) / rect.width)  * naturalW - sel.x,
        offsetY: ((e.clientY - rect.top)  / rect.height) * naturalH - sel.y
      };
      cropFrame.setPointerCapture(e.pointerId);
      document.body.classList.add('is-dragging');
    });

    cropFrame.addEventListener('pointermove', e => {
      if (!dragMove) return;
      const p = pointerToMedia(e);
      sel.x = clamp(p.x - dragMove.offsetX, 0, naturalW - sel.size);
      sel.y = clamp(p.y - dragMove.offsetY, 0, naturalH - sel.size);
      renderCrop();
    });

    const endMove = e => {
      if (!dragMove) return;
      dragMove = null;
      document.body.classList.remove('is-dragging');
      if (e.pointerId != null && cropFrame.hasPointerCapture(e.pointerId)) {
        cropFrame.releasePointerCapture(e.pointerId);
      }
    };
    cropFrame.addEventListener('pointerup', endMove);
    cropFrame.addEventListener('pointercancel', endMove);

    cropEl.querySelectorAll('.crop__handle').forEach(handle => {
      handle.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation();
        const corner = handle.dataset.corner;
        const anchor = {
          tl: { x: sel.x + sel.size, y: sel.y + sel.size },
          tr: { x: sel.x,            y: sel.y + sel.size },
          bl: { x: sel.x + sel.size, y: sel.y            },
          br: { x: sel.x,            y: sel.y            }
        }[corner];
        dragCrop = { corner, anchor };
        handle.setPointerCapture(e.pointerId);
        document.body.classList.add('is-dragging');
      });

      handle.addEventListener('pointermove', e => {
        if (!dragCrop) return;
        const p = pointerToMedia(e);
        const dx = Math.abs(p.x - dragCrop.anchor.x);
        const dy = Math.abs(p.y - dragCrop.anchor.y);
        const maxSide = Math.min(naturalW, naturalH);
        const side = clamp(Math.max(dx, dy), MIN_SIDE, maxSide);

        let x, y;
        const c = dragCrop.corner;
        if (c === 'tl') { x = dragCrop.anchor.x - side; y = dragCrop.anchor.y - side; }
        else if (c === 'tr') { x = dragCrop.anchor.x; y = dragCrop.anchor.y - side; }
        else if (c === 'bl') { x = dragCrop.anchor.x - side; y = dragCrop.anchor.y; }
        else { x = dragCrop.anchor.x; y = dragCrop.anchor.y; }

        x = clamp(x, 0, naturalW - side);
        y = clamp(y, 0, naturalH - side);

        sel = { x, y, size: side };
        renderCrop();
      });

      const end = e => {
        if (!dragCrop) return;
        dragCrop = null;
        document.body.classList.remove('is-dragging');
        if (e.pointerId != null && handle.hasPointerCapture(e.pointerId)) {
          handle.releasePointerCapture(e.pointerId);
        }
      };
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
    });

    function renderTimeline() {
      if (!duration || mode !== 'video') return;
      const pctStart = (range.start / duration) * 100;
      const pctEnd   = (range.end   / duration) * 100;
      handleStart.style.left = pctStart + '%';
      handleEnd.style.left   = pctEnd   + '%';
      timelineRange.style.left  = pctStart + '%';
      timelineRange.style.width = (pctEnd - pctStart) + '%';
      tStart.textContent  = fmtTime(range.start);
      tEnd.textContent    = fmtTime(range.end);
      tLength.textContent = fmtTime(range.end - range.start);
      handleStart.setAttribute('aria-valuemax', String(duration));
      handleStart.setAttribute('aria-valuenow', String(range.start.toFixed(2)));
      handleEnd.setAttribute('aria-valuemax', String(duration));
      handleEnd.setAttribute('aria-valuenow', String(range.end.toFixed(2)));
    }

    function pointerToTime(e) {
      const rect = timeline.getBoundingClientRect();
      return clamp((e.clientX - rect.left) / rect.width, 0, 1) * duration;
    }

    function scheduleSeekPreview() {
      if (mode !== 'video') return;
      clearTimeout(seekTimer);
      seekTimer = setTimeout(() => { try { video.currentTime = range.start; } catch (_) {} }, 60);
    }

    timeline.querySelectorAll('.timeline__handle').forEach(handle => {
      handle.addEventListener('pointerdown', e => {
        e.preventDefault();
        dragRange = { edge: handle.dataset.edge };
        handle.setPointerCapture(e.pointerId);
      });

      handle.addEventListener('pointermove', e => {
        if (!dragRange) return;
        const t = pointerToTime(e);
        if (dragRange.edge === 'start') {
          let s = clamp(t, 0, duration);
          s = Math.min(s, range.end - MIN_DURATION);
          s = Math.max(s, range.end - MAX_DURATION);
          range.start = Math.max(0, s);
        } else {
          let en = clamp(t, 0, duration);
          en = Math.max(en, range.start + MIN_DURATION);
          en = Math.min(en, range.start + MAX_DURATION);
          range.end = Math.min(duration, en);
        }
        renderTimeline(); updateInfo(); updateScrubberMarks(); scheduleSeekPreview();
      });

      const end = e => {
        if (!dragRange) return;
        dragRange = null;
        if (e.pointerId != null && handle.hasPointerCapture(e.pointerId)) {
          handle.releasePointerCapture(e.pointerId);
        }
      };
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);

      handle.addEventListener('keydown', e => {
        const step = e.shiftKey ? 0.5 : 0.1;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          const dir = e.key === 'ArrowLeft' ? -1 : 1;
          if (handle.dataset.edge === 'start') {
            let s = range.start + dir * step;
            s = Math.max(0, Math.min(s, range.end - MIN_DURATION));
            s = Math.max(s, range.end - MAX_DURATION);
            range.start = s;
          } else {
            let en = range.end + dir * step;
            en = Math.min(duration, Math.max(en, range.start + MIN_DURATION));
            en = Math.min(en, range.start + MAX_DURATION);
            range.end = en;
          }
          renderTimeline(); updateInfo(); updateScrubberMarks(); scheduleSeekPreview();
        }
      });
    });

    function applyPanelMode() {
      if (mode === 'video') {
        fpsField.hidden = false;
        keyA.textContent = 'Vídeo';
        keyB.textContent = 'Duración';
        keyC.textContent = 'Fotogramas';
        valD.textContent = '490 KB';
        fabNote.textContent = 'Suelta un vídeo corto, mueve el cuadrado por donde quieras y elige hasta 5 segundos. Te devolvemos un WebP animado de 512 × 512 listo para WhatsApp.';
      } else if (mode === 'image') {
        fpsField.hidden = true;
        keyA.textContent = 'Imagen';
        keyB.textContent = 'Formato';
        keyC.textContent = 'Tipo';
        valD.textContent = '100 KB';
        fabNote.textContent = 'Mueve el cuadrado sobre la imagen y genera un WebP estático de 512 × 512 listo para WhatsApp.';
      }
    }

    function updateInfo() {
      if (!naturalW) return;
      const realPx = Math.round(sel.size);
      const q = getQualityLabel(realPx);
      valA.innerHTML = `${naturalW} × ${naturalH}<small>${orientation} · recorte ${realPx} px · ${q.label}</small>`;
      valA.className = 'info__val ' + q.kind;

      if (mode === 'video') {
        const dur = range.end - range.start;
        const fps = parseInt(fpsSelect.value, 10);
        valB.textContent = dur.toFixed(1) + ' s';
        valC.textContent = Math.max(1, Math.floor(dur * fps)) + ' fotogramas';
      } else {
        valB.textContent = imageFormat || '—';
        valC.textContent = 'estática';
      }
    }

    function updateFabBadge() {
      if (mode === 'video') fabBadge.textContent = fpsSelect.value + ' fps';
      else if (mode === 'image') fabBadge.textContent = imageFormat || 'IMG';
      else fabBadge.textContent = '—';
    }

    fpsSelect.addEventListener('change', () => { updateInfo(); updateFabBadge(); });

    const work = document.createElement('canvas');
    work.width = work.height = SIZE;
    const wctx = work.getContext('2d', { willReadFrequently: true });

    function toWebpBlob(canvas, q) {
      return new Promise((res, rej) => canvas.toBlob(
        b => (b && b.type === 'image/webp') ? res(b) : rej(new Error('Este navegador no puede codificar WebP.')),
        'image/webp', q));
    }

    const u24 = v => [v & 255, (v >> 8) & 255, (v >> 16) & 255];
    const u32 = v => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
    const tag4 = s => [...s].map(c => c.charCodeAt(0));

    function mk(tag, payload) {
      const pad = payload.length & 1;
      const out = new Uint8Array(8 + payload.length + pad);
      out.set(tag4(tag), 0); out.set(u32(payload.length), 4); out.set(payload, 8);
      return out;
    }
    function concat(parts) {
      const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
      let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
      return out;
    }
    function imageChunks(buf) {
      const u8 = new Uint8Array(buf), dv = new DataView(buf), parts = [];
      let off = 12;
      while (off + 8 <= u8.length) {
        const tag = String.fromCharCode(...u8.subarray(off, off + 4));
        const sz = dv.getUint32(off + 4, true);
        const end = Math.min(off + 8 + sz + (sz & 1), u8.length);
        if (tag === 'ALPH' || tag === 'VP8 ' || tag === 'VP8L') parts.push(u8.subarray(off, end));
        off = end;
      }
      return concat(parts);
    }
    function muxAnimated(frames) {
      const vp8x = mk('VP8X', new Uint8Array([0x12, 0, 0, 0, ...u24(SIZE - 1), ...u24(SIZE - 1)]));
      const anim = mk('ANIM', new Uint8Array([0, 0, 0, 0, 0, 0]));
      const anmf = frames.map(f => mk('ANMF', concat([
        new Uint8Array([...u24(0), ...u24(0), ...u24(SIZE - 1), ...u24(SIZE - 1), ...u24(f.duration), 0x03]),
        f.data
      ])));
      const body = concat([new Uint8Array(tag4('WEBP')), vp8x, anim, ...anmf]);
      return new Blob([concat([new Uint8Array(tag4('RIFF')), new Uint8Array(u32(body.length)), body])], { type: 'image/webp' });
    }

    function seekTo(t) {
      return new Promise((resolve, reject) => {
        if (Math.abs(video.currentTime - t) < 0.0005) {
          video.currentTime = t + 0.0005;
        } else {
          video.currentTime = t;
        }
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          video.removeEventListener('error', onError);
          if (naturalW) { syncCropContainer(); renderCrop(); }
          resolve();
        };
        const onError = () => {
          video.removeEventListener('seeked', onSeeked);
          video.removeEventListener('error', onError);
          reject(new Error('Fallo al leer un fotograma.'));
        };
        video.addEventListener('seeked', onSeeked, { once: true });
        video.addEventListener('error', onError, { once: true });
      });
    }

    async function captureFrames(fps) {
      const dur = range.end - range.start;
      const total = Math.max(1, Math.floor(dur * fps));
      const step = dur / total;
      const bitmaps = [];
      const frameDurationMs = Math.round(1000 / fps);

      const sx = Math.round(sel.x);
      const sy = Math.round(sel.y);
      const sw = Math.round(sel.size);
      const sh = Math.round(sel.size);

      for (let i = 0; i <= total; i++) {
        const t = Math.min(range.start + i * step, range.end - 0.001);
        await seekTo(t);
        wctx.clearRect(0, 0, SIZE, SIZE);
        wctx.drawImage(video, sx, sy, sw, sh, 0, 0, SIZE, SIZE);
        bitmaps.push(await createImageBitmap(work));
        setStatus(`Capturando fotogramas… ${i + 1} de ${total + 1}`, 'busy');
        if (i % 4 === 0) await tick();
      }
      return { bitmaps, frameDurationMs };
    }

    async function encodeFromBitmaps(bitmaps, frameDurationMs) {
      const qualities = [0.82, 0.65, 0.5, 0.38, 0.28, 0.2];
      let best = null;

      for (const q of qualities) {
        setStatus(`Codificando a calidad ${Math.round(q * 100)} %…`, 'busy');
        const frames = [];
        for (let i = 0; i < bitmaps.length; i++) {
          wctx.clearRect(0, 0, SIZE, SIZE);
          wctx.drawImage(bitmaps[i], 0, 0);
          const blob = await toWebpBlob(work, q);
          frames.push({ data: imageChunks(await blob.arrayBuffer()), duration: frameDurationMs });
          if (i % 6 === 0) await tick();
        }
        const out = muxAnimated(frames);
        if (!best || out.size < best.size) best = out;
        if (out.size <= ANIM_LIMIT) return { blob: out, quality: q };
      }
      return { blob: best, quality: qualities[qualities.length - 1], tooBig: true };
    }

    async function encodeStatic() {
      const sx = Math.round(sel.x);
      const sy = Math.round(sel.y);
      const sw = Math.round(sel.size);
      const sh = Math.round(sel.size);

      wctx.clearRect(0, 0, SIZE, SIZE);
      wctx.drawImage(image, sx, sy, sw, sh, 0, 0, SIZE, SIZE);

      const qualities = [0.92, 0.8, 0.68, 0.55, 0.42, 0.32, 0.24, 0.16];
      let best = null;

      for (const q of qualities) {
        setStatus(`Codificando a calidad ${Math.round(q * 100)} %…`, 'busy');
        const blob = await toWebpBlob(work, q);
        if (!best || blob.size < best.size) best = blob;
        if (blob.size <= STATIC_LIMIT) return { blob, quality: q };
        await tick();
      }
      return { blob: best, quality: qualities[qualities.length - 1], tooBig: true };
    }

    buildBtn.addEventListener('click', async () => {
      if (!naturalW || !mode) return;
      buildBtn.disabled = true;
      clearBtn.disabled = true;
      resultsEl.innerHTML = '';

      try {
        let blob, tooBig;
        if (mode === 'video') {
          video.pause();
          const fps = parseInt(fpsSelect.value, 10);
          const { bitmaps, frameDurationMs } = await captureFrames(fps);
          const r = await encodeFromBitmaps(bitmaps, frameDurationMs);
          bitmaps.forEach(b => b.close());
          blob = r.blob; tooBig = r.tooBig;
        } else {
          const r = await encodeStatic();
          blob = r.blob; tooBig = r.tooBig;
        }

        const filename = 'sticker-' + Date.now() + '.webp';
        const url = URL.createObjectURL(blob);

        pushResult({ url, filename, size: blob.size, tooBig });
        setStatus('');

        if (tooBig) {
          const limitKB = mode === 'video' ? 490 : 100;
          setStatus(
            `El sticker pesa ${fmtKB(blob.size)} y pasa del límite de WhatsApp (${limitKB} KB).\n` +
            (mode === 'video'
              ? `Puedes descargarlo igual, pero WhatsApp podría rechazarlo. Prueba a acortar el tramo, bajar los fps o reducir el cuadrado.`
              : `Puedes descargarlo igual, pero WhatsApp podría rechazarlo. Prueba a reducir el cuadrado o usa una imagen con menos detalle.`),
            'warn'
          );
        }
      } catch (err) {
        console.error(err);
        setStatus('Error: ' + err.message, 'warn');
      }

      buildBtn.disabled = false;
      clearBtn.disabled = false;
    });

    function pushResult({ url, filename, size, tooBig }) {
      const row = document.createElement('div');
      row.className = 'result' + (tooBig ? ' result--warn' : '');
      row.innerHTML =
        '<div class="result__thumb"><img alt=""></div>' +
        '<div class="result__meta">' +
          '<p class="result__name"></p>' +
          '<p class="result__sub"></p>' +
        '</div>' +
        '<a class="result__dl" download>Descargar</a>';

      const kindLabel = mode === 'video' ? 'WebP animado' : 'WebP estático';
      const limitKB = mode === 'video' ? 490 : 100;

      row.querySelector('img').src = url;
      row.querySelector('.result__name').textContent = filename;
      row.querySelector('.result__sub').textContent =
        `${fmtKB(size)} · 512 × 512 · ${kindLabel}` +
        (tooBig ? ` · pasa del límite de ${limitKB} KB` : '');

      const a = row.querySelector('.result__dl');
      a.href = url; a.download = filename;

      resultsEl.prepend(row);
    }

    document.addEventListener('keydown', e => {
      if (!toolRoot.classList.contains('is-open')) return;
      if (!naturalW || mode !== 'video') return;
      if (e.target.matches('input, textarea, select')) return;

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        playBtn.click();
      } else if (e.key === 'i' || e.key === 'I') {
        markStartBtn.click();
      } else if (e.key === 'o' || e.key === 'O') {
        markEndBtn.click();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 0.1;
        const dir = e.key === 'ArrowLeft' ? -1 : 1;
        video.currentTime = clamp(video.currentTime + dir * step, 0, duration);
        scrubber.value = video.currentTime;
        timeNow.textContent = fmtClock(video.currentTime);
      }
    });

    applyPanelMode();
  })();
