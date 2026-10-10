/**
 * REPRODUCTOR SIMPLE — Lógica Telegram Bot API directa
 * Gestión de Token mediante Interfaz Web (Opción 1) + Almacenamiento local seguro
 */

// Estado global de la aplicación
const state = {
  token: localStorage.getItem('tg_bot_token') || '',
  botName: localStorage.getItem('tg_bot_name') || '',
  audio: new Audio(),
  standbyAudio: new Audio(),
  tracks: JSON.parse(localStorage.getItem('tg_cached_tracks') || '[]'),
  playlists: JSON.parse(localStorage.getItem('tg_playlists') || '[]'),
  currentIndex: 0,
  activeView: 'player',
  selectedArtist: '',
  selectedPlaylistId: '',
  playQueueIds: null,
  pendingTrackIds: new Set(),
  thumbnailUrls: new Map(),
  thumbnailRequests: new Map(),
  thumbnailQueue: [],
  thumbnailActive: 0,
  thumbnailObserver: null,
  isPlaying: false,
  isShuffle: false,
  repeatMode: 'none', // 'none' | 'all' | 'one'
  volume: 0.8,
  isMuted: false,
  isSyncing: false,
  isLoadingTrack: false,
  isSharing: false,
  shareController: null,
  shareFile: null,
  shareTrack: null,
  trackLoadId: 0,
  preloadRequestId: 0,
  preloadedTrackIndex: null,
  preloadedTrackId: null,
  preloadPromise: null,
  chatId: localStorage.getItem('tg_chat_id') || ''
};

// Elementos del DOM
const dom = {
  playerApp: document.getElementById('playerApp'),
  playerScreen: document.getElementById('playerScreen'),
  artistsScreen: document.getElementById('artistsScreen'),
  favoritesScreen: document.getElementById('favoritesScreen'),
  playlistsScreen: document.getElementById('playlistsScreen'),
  searchScreen: document.getElementById('searchScreen'),
  btnViewPlayer: document.getElementById('btnViewPlayer'),
  btnViewArtists: document.getElementById('btnViewArtists'),
  btnViewFavorites: document.getElementById('btnViewFavorites'),
  btnViewPlaylists: document.getElementById('btnViewPlaylists'),
  btnViewSearch: document.getElementById('btnViewSearch'),
  artistCount: document.getElementById('artistCount'),
  artistList: document.getElementById('artistList'),
  artistTracksPanel: document.getElementById('artistTracksPanel'),
  artistTrackTitle: document.getElementById('artistTrackTitle'),
  artistTrackList: document.getElementById('artistTrackList'),
  favoriteCount: document.getElementById('favoriteCount'),
  favoriteTrackList: document.getElementById('favoriteTrackList'),
  playlistOverview: document.getElementById('playlistOverview'),
  playlistDetail: document.getElementById('playlistDetail'),
  playlistHeroArt: document.getElementById('playlistHeroArt'),
  selectedPlaylistTitle: document.getElementById('selectedPlaylistTitle'),
  selectedPlaylistCount: document.getElementById('selectedPlaylistCount'),
  btnPlaylistShuffle: document.getElementById('btnPlaylistShuffle'),
  btnPlaylistPlay: document.getElementById('btnPlaylistPlay'),
  playlistTrackList: document.getElementById('playlistTrackList'),
  searchInput: document.getElementById('searchInput'),
  searchCount: document.getElementById('searchCount'),
  searchTrackList: document.getElementById('searchTrackList'),
  miniPlayer: document.getElementById('miniPlayer'),
  btnMiniPlayerOpen: document.getElementById('btnMiniPlayerOpen'),
  miniPlayerCover: document.getElementById('miniPlayerCover'),
  miniPlayerPlaceholder: document.getElementById('miniPlayerPlaceholder'),
  miniPlayerTitle: document.getElementById('miniPlayerTitle'),
  miniPlayerArtist: document.getElementById('miniPlayerArtist'),
  btnMiniPlayerToggle: document.getElementById('btnMiniPlayerToggle'),
  btnCreatePlaylist: document.getElementById('btnCreatePlaylist'),
  btnBackup: document.getElementById('btnBackup'),
  btnAddTracks: document.getElementById('btnAddTracks'),
  btnDeletePlaylist: document.getElementById('btnDeletePlaylist'),
  btnBackArtists: document.getElementById('btnBackArtists'),
  btnBackPlaylists: document.getElementById('btnBackPlaylists'),
  playlistModal: document.getElementById('playlistModal'),
  playlistNameInput: document.getElementById('playlistNameInput'),
  playlistNameError: document.getElementById('playlistNameError'),
  btnClosePlaylistModal: document.getElementById('btnClosePlaylistModal'),
  btnCancelPlaylist: document.getElementById('btnCancelPlaylist'),
  btnSavePlaylist: document.getElementById('btnSavePlaylist'),
  addTracksModal: document.getElementById('addTracksModal'),
  trackPickerSearch: document.getElementById('trackPickerSearch'),
  trackPickerList: document.getElementById('trackPickerList'),
  btnCloseAddTracks: document.getElementById('btnCloseAddTracks'),
  btnCancelAddTracks: document.getElementById('btnCancelAddTracks'),
  btnConfirmAddTracks: document.getElementById('btnConfirmAddTracks'),
  botStatusBadge: document.getElementById('botStatusBadge'),
  botNameLabel: document.getElementById('botNameLabel'),
  statusDot: document.querySelector('.status-dot'),
  btnSync: document.getElementById('btnSync'),
  btnSettings: document.getElementById('btnSettings'),
  coverImg: document.getElementById('coverImg'),
  coverPlaceholder: document.getElementById('coverPlaceholder'),
  trackTitle: document.getElementById('trackTitle'),
  trackArtist: document.getElementById('trackArtist'),
  progressBar: document.getElementById('progressBar'),
  progressFill: document.getElementById('progressFill'),
  currentTime: document.getElementById('currentTime'),
  totalTime: document.getElementById('totalTime'),
  btnShuffle: document.getElementById('btnShuffle'),
  btnFavorite: document.getElementById('btnFavorite'),
  btnPrev: document.getElementById('btnPrev'),
  btnPlay: document.getElementById('btnPlay'),
  btnNext: document.getElementById('btnNext'),
  btnRepeat: document.getElementById('btnRepeat'),
  btnShare: document.getElementById('btnShare'),
  shareModal: document.getElementById('shareModal'),
  shareCoverImg: document.getElementById('shareCoverImg'),
  shareCoverPlaceholder: document.getElementById('shareCoverPlaceholder'),
  shareTrackTitle: document.getElementById('shareTrackTitle'),
  shareTrackArtist: document.getElementById('shareTrackArtist'),
  shareProgressFill: document.getElementById('shareProgressFill'),
  shareStatus: document.getElementById('shareStatus'),
  btnCloseShare: document.getElementById('btnCloseShare'),
  btnCancelShare: document.getElementById('btnCancelShare'),
  btnShareNow: document.getElementById('btnShareNow'),
  volumeBtn: document.getElementById('volumeBtn'),
  playlistCount: document.getElementById('playlistCount'),
  // Modal de Token
  tokenModal: document.getElementById('tokenModal'),
  tokenInput: document.getElementById('tokenInput'),
  btnSaveToken: document.getElementById('btnSaveToken'),
  btnCloseModal: document.getElementById('btnCloseModal'),
  btnToggleTokenVisibility: document.getElementById('btnToggleTokenVisibility'),
  btnDisconnect: document.getElementById('btnDisconnect'),
  tokenError: document.getElementById('tokenError'),
  toast: document.getElementById('toast'),
  toast: document.getElementById('toast')
};

// Inicialización
window.addEventListener('DOMContentLoaded', () => {
  initAudioListeners();
  initUIListeners();
  initModalListeners();
  initPlaylistListeners();
  ensureFavoritesPlaylist();
  initThumbnailObserver();

  // Si no hay token guardado, abrir el modal de configuración de inmediato
  if (!state.token) {
    openTokenModal();
  } else {
    updateBotStatus(true, state.botName || 'Conectado');
    renderTracksList();
    if (state.tracks.length > 0) {
      loadTrack(0, false);
    }
    // Sincronizar automáticamente en segundo plano
    syncTelegramTracks(false);
  }
});

/**
 * ─────────────────────────────────────────────────────────────
 *  INTEGRACIÓN TELEGRAM BOT API
 * ─────────────────────────────────────────────────────────────
 */

// Valida y conecta el bot
async function connectTelegramBot(inputToken) {
  const token = inputToken.trim();
  if (!token || !token.includes(':')) {
    showTokenError('El formato del token no es válido. Debe ser del tipo 123456789:ABCdef...');
    return false;
  }

  showTokenError('');
  dom.btnSaveToken.disabled = true;
  dom.btnSaveToken.textContent = 'Verificando...';

  try {
    // 1. Probar que el bot existe
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();

    if (!data.ok) {
      throw new Error(data.description || 'Token inválido');
    }

    const botName = data.result.first_name || data.result.username || 'Bot';

    // 2. Limpiar Webhooks para permitir getUpdates
    await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`).catch(() => {});

    // 3. Guardar en memoria local segura del navegador
    state.token = token;
    state.botName = botName;
    localStorage.setItem('tg_bot_token', token);
    localStorage.setItem('tg_bot_name', botName);

    updateBotStatus(true, botName);
    closeTokenModal();
    showToast(`¡Conectado a ${botName}!`);

    // Sincronizar canciones inmediatamente
    await syncTelegramTracks(true);
    return true;
  } catch (err) {
    showTokenError(`Error: ${err.message}`);
    return false;
  } finally {
    dom.btnSaveToken.disabled = false;
    dom.btnSaveToken.textContent = 'Guardar y Conectar';
  }
}

// Sincroniza las canciones enviadas al bot
async function syncTelegramTracks(showFeedback = true) {
  if (!state.token || state.isSyncing) return;

  state.isSyncing = true;
  dom.btnSync.classList.add('spinning');
  if (showFeedback) showToast('Buscando canciones en Telegram...');

  try {
    const updates = await fetchPendingTelegramUpdates();

    // Capturar chat_id del primer mensaje si aún no lo tenemos
    if (!state.chatId && updates.length > 0) {
      const firstMsg = updates.find(u => (u.message || u.channel_post)?.chat?.id);
      if (firstMsg) {
        const chatId = String((firstMsg.message || firstMsg.channel_post).chat.id);
        state.chatId = chatId;
        localStorage.setItem('tg_chat_id', chatId);
        console.log('✅ chat_id capturado:', chatId);
      }
    }

    // Detectar si el usuario reenvió un archivo de backup JSON para restaurar
    const backupUpdate = updates.find(u => {
      const doc = (u.message || u.channel_post || {}).document;
      return doc?.file_name?.startsWith('playlist_backup') && doc.file_name.endsWith('.json');
    });
    if (backupUpdate) {
      const doc = (backupUpdate.message || backupUpdate.channel_post).document;
      if (showFeedback) showToast('🔁 Backup detectado, restaurando...');
      await restoreFromBackup(doc.file_id);
    }

    const newTracksMap = new Map();

    // Mantener las pistas guardadas, incluidas las restauradas desde el backup
    state.tracks.forEach((t) => newTracksMap.set(t.id, t));

    let addedCount = 0;
    const newlyAdded = [];
    const AUDIO_EXTS = ['.mp3', '.flac', '.ogg', '.m4a', '.wav'];

    updates.forEach((u) => {
      const msg = u.message || u.channel_post || {};
      const audio = msg.audio;
      const doc = msg.document;

      // Caso 1: Archivo de audio nativo de Telegram
      if (audio && audio.file_id) {
        if (!newTracksMap.has(audio.file_id)) {
          const thumb = audio.thumbnail || audio.thumb;
          const track = {
            id: audio.file_id,
            name: audio.title || audio.file_name || 'Sin título',
            artist: audio.performer || 'Desconocido',
            duration: audio.duration || 0,
            thumb_id: thumb ? thumb.file_id : null,
            file_size: audio.file_size || 0,
            file_name: audio.file_name || null,
            mime_type: audio.mime_type || null
          };
          newTracksMap.set(audio.file_id, track);
          newlyAdded.push(track);
          addedCount++;
        }
      }
      // Caso 2: Documento de audio (MP3, FLAC, OGG, M4A, WAV)
      else if (doc && doc.file_name && AUDIO_EXTS.some(ext => doc.file_name.toLowerCase().endsWith(ext))) {
        if (!newTracksMap.has(doc.file_id)) {
          const thumb = doc.thumbnail || doc.thumb;
          const cleanName = doc.file_name.replace(/\.[^/.]+$/, '');
          const track = {
            id: doc.file_id,
            name: cleanName,
            artist: 'Telegram',
            duration: 0,
            thumb_id: thumb ? thumb.file_id : null,
            file_size: doc.file_size || 0,
            file_name: doc.file_name,
            mime_type: doc.mime_type || null
          };
          newTracksMap.set(doc.file_id, track);
          newlyAdded.push(track);
          addedCount++;
        }
      }
    });

    state.tracks = Array.from(newTracksMap.values());
    localStorage.setItem('tg_cached_tracks', JSON.stringify(state.tracks));

    // Enviar backup completo al chat del bot de Telegram
    if (newlyAdded.length > 0 && state.chatId) sendBackupToTelegram();

    renderTracksList();

    if (state.tracks.length > 0 && dom.trackTitle.textContent === 'Esperando bot...') {
      loadTrack(0, false);
    }

    if (showFeedback) {
      if (addedCount > 0) {
        showToast(`+${countLabel(addedCount, 'canción nueva agregada', 'canciones nuevas agregadas')}`);
      } else {
        showToast(`Lista al día (${countLabel(state.tracks.length, 'canción', 'canciones')})`);
      }
    }
  } catch (err) {
    console.error('Error al sincronizar:', err);
    if (showFeedback) showToast('Error al sincronizar con Telegram');
  } finally {
    state.isSyncing = false;
    dom.btnSync.classList.remove('spinning');
  }
}

async function fetchPendingTelegramUpdates() {
  const updates = [];
  let offset = null;

  for (let page = 0; page < 50; page++) {
    const offsetQuery = offset === null ? '' : `&offset=${offset}`;
    const res = await fetch(`https://api.telegram.org/bot${state.token}/getUpdates?limit=100${offsetQuery}`);
    const data = await res.json();
    if (!data.ok) {
      if (updates.length === 0) throw new Error(data.description || 'Error al obtener mensajes');
      console.warn('Sincronización parcial de Telegram:', data.description);
      break;
    }

    const batch = data.result || [];
    updates.push(...batch);
    if (batch.length < 100) break;

    const lastUpdateId = batch[batch.length - 1]?.update_id;
    if (!Number.isFinite(lastUpdateId)) break;
    offset = lastUpdateId + 1;
  }

  return updates;
}

// Obtiene la URL de streaming directo de un archivo en Telegram
async function getTelegramFileUrl(fileId) {
  const file = await getTelegramFileInfo(fileId);
  return file.url;
}

async function getTelegramFileInfo(fileId, signal) {
  const res = await fetch(`https://api.telegram.org/bot${state.token}/getFile?file_id=${encodeURIComponent(fileId)}`, { signal });
  const data = await res.json();
  if (data.ok && data.result.file_path) {
    return {
      url: `https://api.telegram.org/file/bot${state.token}/${data.result.file_path}`,
      filePath: data.result.file_path,
      fileSize: Number(data.result.file_size) || 0
    };
  }
  throw new Error('No se pudo obtener el archivo de Telegram');
}

const TELEGRAM_FILE_DOWNLOAD_LIMIT = 20_000_000;

async function shareCurrentTrack() {
  if (state.isSharing) return;
  if (!state.token) {
    openTokenModal();
    return;
  }

  const track = state.tracks[state.currentIndex];
  if (!track) {
    showToast('Selecciona una canción para compartir');
    return;
  }
  if (track.file_size > TELEGRAM_FILE_DOWNLOAD_LIMIT) {
    showToast('Telegram no permite descargar archivos mayores de 20 MB desde el bot');
    return;
  }

  const controller = new AbortController();
  state.shareController = controller;
  state.shareTrack = track;
  state.shareFile = null;
  state.isSharing = true;
  dom.shareTrackTitle.textContent = track.name;
  dom.shareTrackArtist.textContent = track.artist || '';
  dom.shareCoverImg.classList.toggle('active', dom.coverImg.classList.contains('active'));
  dom.shareCoverPlaceholder.classList.toggle('hidden', dom.coverImg.classList.contains('active'));
  if (dom.coverImg.classList.contains('active')) dom.shareCoverImg.src = dom.coverImg.src;
  dom.shareProgressFill.style.width = '0%';
  dom.shareProgressFill.classList.add('indeterminate');
  dom.shareStatus.textContent = 'Preparando descarga…';
  dom.btnShareNow.classList.add('hidden');
  dom.btnShareNow.textContent = 'Compartir ahora';
  dom.shareModal.classList.remove('hidden');

  try {
    const fileInfo = await getTelegramFileInfo(track.id, controller.signal);
    if (fileInfo.fileSize > TELEGRAM_FILE_DOWNLOAD_LIMIT) {
      throw new Error('Este archivo supera el límite de descarga de Telegram (20 MB)');
    }

    dom.shareStatus.textContent = 'Descargando canción…';
    const response = await fetch(fileInfo.url, { signal: controller.signal });
    if (!response.ok) throw new Error('Telegram no pudo entregar el archivo');

    const contentLength = Number(response.headers.get('Content-Length')) || fileInfo.fileSize;
    if (contentLength > TELEGRAM_FILE_DOWNLOAD_LIMIT) {
      throw new Error('Este archivo supera el límite de descarga de Telegram (20 MB)');
    }

    let blob;
    if (response.body?.getReader) {
      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.length;
        if (received > TELEGRAM_FILE_DOWNLOAD_LIMIT) {
          await reader.cancel();
          throw new Error('Este archivo supera el límite de descarga de Telegram (20 MB)');
        }
        chunks.push(value);
        if (contentLength > 0) {
          const progress = Math.min(Math.round((received / contentLength) * 100), 100);
          dom.shareProgressFill.classList.remove('indeterminate');
          dom.shareProgressFill.style.width = `${progress}%`;
          dom.shareStatus.textContent = `Descargando canción… ${progress}%`;
        }
      }
      blob = new Blob(chunks, { type: response.headers.get('Content-Type') || 'application/octet-stream' });
    } else {
      blob = await response.blob();
      if (blob.size > TELEGRAM_FILE_DOWNLOAD_LIMIT) {
        throw new Error('Este archivo supera el límite de descarga de Telegram (20 MB)');
      }
      dom.shareProgressFill.classList.remove('indeterminate');
      dom.shareProgressFill.style.width = '100%';
    }

    if (state.shareController !== controller) return;
    const file = await createShareFile(blob, fileInfo.filePath, track);
    state.shareFile = file;
    dom.shareProgressFill.classList.remove('indeterminate');
    dom.shareProgressFill.style.width = '100%';
    dom.shareStatus.textContent = 'Descarga lista. Abriendo opciones para compartir…';

    if (canShareFile(file)) {
      try {
        await shareDownloadedFile();
      } catch (err) {
        showShareFallback(err);
      }
    } else {
      dom.shareStatus.textContent = 'Archivo listo. Este navegador no ofrece compartir archivos directamente.';
      dom.btnShareNow.innerHTML = '<i class="fas fa-download"></i> Descargar archivo';
      dom.btnShareNow.classList.remove('hidden');
    }
  } catch (err) {
    if (state.shareController !== controller || err.name === 'AbortError') return;
    dom.shareProgressFill.classList.remove('indeterminate');
    dom.shareStatus.textContent = err.message || 'No se pudo descargar la canción.';
    dom.btnShareNow.classList.add('hidden');
  } finally {
    if (state.shareController === controller) {
      state.isSharing = false;
      state.shareController = null;
    }
  }
}

async function createShareFile(blob, filePath, track) {
  const extension = await detectAudioExtension(blob, filePath, track);
  const safeName = String(track.name || 'cancion').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || 'cancion';
  const baseName = safeName.replace(/\.(mp3|flac|ogg|opus|m4a|wav|aac)$/i, '');
  const fileName = extension ? `${baseName}.${extension}` : baseName;
  const mimeTypes = {
    aac: 'audio/aac',
    flac: 'audio/flac',
    m4a: 'audio/mp4',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
    opus: 'audio/opus',
    wav: 'audio/wav'
  };
  const type = mimeTypes[extension] || (blob.type !== 'application/octet-stream' ? blob.type : '') || 'application/octet-stream';
  return new File([blob], fileName, { type });
}

async function detectAudioExtension(blob, filePath, track) {
  const supported = ['aac', 'flac', 'm4a', 'mp3', 'ogg', 'opus', 'wav'];
  const candidates = [filePath, track.file_name];
  for (const candidate of candidates) {
    const extension = String(candidate || '').match(/\.([a-z0-9]{2,5})$/i)?.[1].toLowerCase();
    if (supported.includes(extension)) return extension;
  }

  const format = String(track.format || '').toLowerCase();
  if (supported.includes(format)) return format;

  const mimeTypes = {
    'audio/aac': 'aac',
    'audio/flac': 'flac',
    'audio/mp3': 'mp3',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/ogg': 'ogg',
    'audio/opus': 'opus',
    'audio/wav': 'wav',
    'audio/x-flac': 'flac',
    'audio/x-m4a': 'm4a',
    'audio/x-wav': 'wav'
  };
  const mime = String(track.mime_type || blob.type || '').split(';')[0].trim().toLowerCase();
  if (mimeTypes[mime]) return mimeTypes[mime];

  const bytes = new Uint8Array(await blob.slice(0, 64).arrayBuffer());
  const signature = String.fromCharCode(...bytes);
  if (signature.startsWith('ID3')) return 'mp3';
  if (signature.startsWith('fLaC')) return 'flac';
  if (signature.startsWith('OggS')) return signature.includes('OpusHead') ? 'opus' : 'ogg';
  if (signature.startsWith('RIFF') && signature.slice(8, 12) === 'WAVE') return 'wav';
  if (signature.slice(4, 8) === 'ftyp') return 'm4a';
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    return ((bytes[1] >> 1) & 0x03) === 0 ? 'aac' : 'mp3';
  }
  return '';
}

function canShareFile(file) {
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch (err) {
    return false;
  }
}

async function shareDownloadedFile() {
  if (!state.shareFile || !state.shareTrack) return;
  if (canShareFile(state.shareFile)) {
    try {
      await navigator.share({
        files: [state.shareFile],
        title: state.shareTrack.name,
        text: state.shareTrack.artist || ''
      });
      closeShareDialog();
      showToast('Canción compartida');
      return;
    } catch (err) {
      showShareFallback(err);
      return;
    }
  }

  downloadShareFile();
}

function showShareFallback(error) {
  dom.shareStatus.textContent = error?.name === 'AbortError'
    ? 'El menú se cerró. Puedes volver a abrirlo cuando quieras.'
    : 'La descarga está lista. Toca para abrir las opciones de compartir.';
  dom.btnShareNow.innerHTML = '<i class="fas fa-share-nodes"></i> Compartir ahora';
  dom.btnShareNow.classList.remove('hidden');
}

function downloadShareFile() {
  if (!state.shareFile) return;
  const objectUrl = URL.createObjectURL(state.shareFile);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = state.shareFile.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  closeShareDialog();
  showToast('Canción descargada');
}

function cancelShare() {
  state.shareController?.abort();
  closeShareDialog();
}

function closeShareDialog() {
  state.shareController = null;
  state.shareFile = null;
  state.shareTrack = null;
  state.isSharing = false;
  dom.shareModal.classList.add('hidden');
}

/**
 * ─────────────────────────────────────────────────────────────
 *  REPRODUCCIÓN Y CONTROL DE AUDIO
 * ─────────────────────────────────────────────────────────────
 */

async function loadTrack(index, autoPlay = true) {
  if (state.tracks.length === 0) return;

  const loadId = ++state.trackLoadId;
  state.isLoadingTrack = true;
  state.currentIndex = (index + state.tracks.length) % state.tracks.length;
  const track = state.tracks[state.currentIndex];
  const hasPreloadedTrack = state.preloadedTrackId === track.id && state.preloadPromise;
  const preloadPromise = hasPreloadedTrack ? state.preloadPromise : null;

  if (!hasPreloadedTrack) clearPreloadedTrack();

  dom.trackTitle.textContent = track.name;
  dom.trackArtist.textContent = track.artist;
  updateFavoriteButton();
  updateMiniPlayer();
  updatePlaylistPlaybackButtons();
  dom.progressFill.style.width = '0%';
  dom.currentTime.textContent = '0:00';
  dom.totalTime.textContent = track.duration ? formatTime(track.duration) : '0:00';

  updateActiveTrackInList();

  // Reset carátula
  dom.playerApp.style.setProperty('--cover-artwork', 'none');
  dom.coverImg.classList.remove('active');
  dom.coverPlaceholder.style.display = 'block';

  try {
    // 1. Obtener la carátula si existe
    if (track.thumb_id) {
      getTelegramFileUrl(track.thumb_id)
        .then((thumbUrl) => {
          if (loadId !== state.trackLoadId) return;
          dom.coverImg.src = thumbUrl;
          dom.playerApp.style.setProperty('--cover-artwork', `url("${thumbUrl}")`);
          dom.coverImg.classList.add('active');
          dom.coverPlaceholder.style.display = 'none';
        })
        .catch(() => {});
    }

    // 2. Obtener enlace directo de streaming MP3
    dom.trackArtist.textContent = 'Cargando audio de Telegram...';
    let streamUrl = '';

    if (preloadPromise) {
      streamUrl = await preloadPromise;
      if (loadId !== state.trackLoadId) return;
      if (streamUrl && state.preloadedTrackId === track.id) {
        state.audio.pause();
        promotePreloadedTrack();
      } else {
        streamUrl = '';
      }
    }

    if (!streamUrl) {
      streamUrl = await getTelegramFileUrl(track.id);
      if (loadId !== state.trackLoadId) return;
      state.audio.src = streamUrl;
    }

    dom.trackArtist.textContent = track.artist;
    state.isLoadingTrack = false;

    if (autoPlay) {
      playTrack();
    }

    prepareNextTrack();
  } catch (err) {
    if (loadId !== state.trackLoadId) return;
    state.isLoadingTrack = false;
    console.error('Error al cargar pista:', err);
    dom.trackArtist.textContent = 'Archivo > 20MB o enlace caducado';
    pauseTrack();
  }
}

function chooseNextTrackIndex() {
  const queue = getPlaybackQueueIndices();
  if (queue.length === 0) return 0;
  if (state.isShuffle && queue.length > 1) {
    let nextIndex;
    do {
      nextIndex = queue[Math.floor(Math.random() * queue.length)];
    } while (nextIndex === state.currentIndex);
    return nextIndex;
  }
  const currentPosition = queue.indexOf(state.currentIndex);
  return queue[(currentPosition + 1 + queue.length) % queue.length];
}

function getUpcomingTrackIndex() {
  if (state.repeatMode === 'one') return null;
  const queue = getPlaybackQueueIndices();
  if (queue.length === 0) return null;
  if (state.isShuffle && queue.length > 1) return chooseNextTrackIndex();
  const currentPosition = queue.indexOf(state.currentIndex);
  if (currentPosition >= 0 && currentPosition < queue.length - 1) return queue[currentPosition + 1];
  return state.repeatMode === 'all' ? queue[0] : null;
}

function getPlaybackQueueIndices() {
  const indexById = new Map(state.tracks.map((track, index) => [track.id, index]));
  if (!Array.isArray(state.playQueueIds) || state.playQueueIds.length === 0) {
    return state.tracks.map((track, index) => index);
  }
  const queue = state.playQueueIds.map((id) => indexById.get(id)).filter(Number.isInteger);
  return queue.length ? queue : state.tracks.map((track, index) => index);
}

function clearPreloadedTrack() {
  state.preloadRequestId++;
  state.preloadPromise = null;
  state.preloadedTrackIndex = null;
  state.preloadedTrackId = null;
  state.standbyAudio.pause();
  state.standbyAudio.removeAttribute('src');
  state.standbyAudio.load();
}

function prepareNextTrack() {
  if (!state.token || state.tracks.length === 0) return;

  const nextIndex = getUpcomingTrackIndex();
  if (nextIndex === null) {
    clearPreloadedTrack();
    return;
  }

  const track = state.tracks[nextIndex % state.tracks.length];
  if (state.preloadedTrackId === track.id && state.preloadPromise) {
    state.preloadedTrackIndex = nextIndex % state.tracks.length;
    return;
  }

  clearPreloadedTrack();
  const requestId = state.preloadRequestId;
  state.preloadedTrackIndex = nextIndex % state.tracks.length;
  state.preloadedTrackId = track.id;
  state.preloadPromise = getTelegramFileUrl(track.id)
    .then((url) => {
      if (requestId !== state.preloadRequestId) return '';
      state.standbyAudio.volume = state.isMuted ? 0 : state.volume;
      state.standbyAudio.preload = 'auto';
      state.standbyAudio.src = url;
      state.standbyAudio.load();
      return url;
    })
    .catch(() => {
      if (requestId === state.preloadRequestId) {
        state.preloadPromise = null;
        state.preloadedTrackIndex = null;
        state.preloadedTrackId = null;
      }
      return '';
    });
}

function promotePreloadedTrack() {
  const previousAudio = state.audio;
  state.audio = state.standbyAudio;
  state.standbyAudio = previousAudio;
  state.preloadRequestId++;
  state.preloadPromise = null;
  state.preloadedTrackIndex = null;
  state.preloadedTrackId = null;
  clearPreloadedTrack();
}

function playTrack() {
  state.audio.play()
    .then(() => {
      state.isPlaying = true;
      dom.btnPlay.innerHTML = '<i class="fas fa-pause"></i>';
      updateMiniPlayer();
      updatePlaylistPlaybackButtons();
    })
    .catch((err) => {
      console.warn('Reproducción en pausa:', err);
      pauseTrack();
    });
}

function pauseTrack() {
  state.audio.pause();
  state.isPlaying = false;
  dom.btnPlay.innerHTML = '<i class="fas fa-play"></i>';
  updateMiniPlayer();
  updatePlaylistPlaybackButtons();
}

function togglePlay() {
  if (state.isPlaying) pauseTrack();
  else playTrack();
}

function nextTrack() {
  if (state.tracks.length === 0) return;
  const nextIndex = state.preloadedTrackIndex ?? chooseNextTrackIndex();
  loadTrack(nextIndex, state.isPlaying);
}

function prevTrack() {
  if (state.tracks.length === 0) return;
  if (state.audio.currentTime > 3) {
    state.audio.currentTime = 0;
    return;
  }
  const queue = getPlaybackQueueIndices();
  const currentPosition = queue.indexOf(state.currentIndex);
  const previousPosition = (currentPosition - 1 + queue.length) % queue.length;
  loadTrack(queue[previousPosition] ?? state.currentIndex, state.isPlaying);
}

function initAudioListeners() {
  [state.audio, state.standbyAudio].forEach((audio) => {
    audio.volume = state.volume;
    audio.preload = 'auto';

    audio.addEventListener('timeupdate', () => {
      if (audio !== state.audio || state.isLoadingTrack || isNaN(audio.duration)) return;
      const progress = (audio.currentTime / audio.duration) * 100;
      dom.progressFill.style.width = `${progress}%`;
      dom.currentTime.textContent = formatTime(audio.currentTime);
    });

    audio.addEventListener('loadedmetadata', () => {
      if (audio === state.audio) dom.totalTime.textContent = formatTime(audio.duration);
    });

    audio.addEventListener('ended', () => {
      if (audio !== state.audio || state.isLoadingTrack) return;
      if (state.repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play();
      } else if (getUpcomingTrackIndex() !== null) {
        nextTrack();
      } else {
        pauseTrack();
        audio.currentTime = 0;
      }
    });

    audio.addEventListener('error', () => {
      if (audio !== state.audio || state.isLoadingTrack) return;
      dom.trackArtist.textContent = 'Error al reproducir audio';
      pauseTrack();
    });
  });
}

function initUIListeners() {
  dom.btnViewPlayer.addEventListener('click', () => setActiveView('player'));
  dom.btnViewArtists.addEventListener('click', () => setActiveView('artists'));
  dom.btnViewFavorites.addEventListener('click', () => setActiveView('favorites'));
  dom.btnViewPlaylists.addEventListener('click', () => setActiveView('playlists'));
  dom.btnViewSearch.addEventListener('click', () => setActiveView('search'));
  dom.btnMiniPlayerOpen.addEventListener('click', () => setActiveView('player'));
  dom.btnMiniPlayerToggle.addEventListener('click', togglePlay);
  dom.btnPlay.addEventListener('click', togglePlay);
  dom.btnPrev.addEventListener('click', prevTrack);
  dom.btnNext.addEventListener('click', nextTrack);
  dom.btnShare.addEventListener('click', shareCurrentTrack);
  dom.btnShareNow.addEventListener('click', shareDownloadedFile);
  dom.btnCloseShare.addEventListener('click', cancelShare);
  dom.btnCancelShare.addEventListener('click', cancelShare);
  dom.shareModal.addEventListener('click', (event) => {
    if (event.target === dom.shareModal) cancelShare();
  });

  dom.btnShuffle.addEventListener('click', () => {
    state.isShuffle = !state.isShuffle;
    dom.btnShuffle.classList.toggle('active', state.isShuffle);
    prepareNextTrack();
  });

  dom.btnFavorite.addEventListener('click', toggleCurrentFavorite);

  dom.btnRepeat.addEventListener('click', () => {
    const modes = ['none', 'all', 'one'];
    const nextIndex = (modes.indexOf(state.repeatMode) + 1) % modes.length;
    state.repeatMode = modes[nextIndex];

    dom.btnRepeat.classList.toggle('active', state.repeatMode !== 'none');
    dom.btnRepeat.innerHTML = state.repeatMode === 'one'
      ? '<i class="fas fa-redo-alt"></i>'
      : '<i class="fas fa-redo"></i>';
    prepareNextTrack();
  });

  dom.progressBar.addEventListener('click', (e) => {
    if (isNaN(state.audio.duration)) return;
    const rect = dom.progressBar.getBoundingClientRect();
    const clickPos = (e.clientX - rect.left) / rect.width;
    state.audio.currentTime = clickPos * state.audio.duration;
  });

  dom.volumeBtn.addEventListener('click', () => {
    state.isMuted = !state.isMuted;
    state.audio.volume = state.isMuted ? 0 : state.volume;
    state.standbyAudio.volume = state.audio.volume;
    updateVolumeIcon();
  });

  dom.searchInput.addEventListener('input', renderSearchResults);

  dom.btnSync.addEventListener('click', () => syncTelegramTracks(true));
  dom.btnSettings.addEventListener('click', openTokenModal);

  // Atajos de teclado
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      prevTrack();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      nextTrack();
    } else if (e.code === 'KeyM') {
      dom.volumeBtn.click();
    }
  });
}

function initPlaylistListeners() {
  dom.btnCreatePlaylist.addEventListener('click', openPlaylistModal);
  dom.btnBackup.addEventListener('click', sendBackupToTelegram);
  dom.btnAddTracks.addEventListener('click', openAddTracksModal);
  dom.btnDeletePlaylist.addEventListener('click', deleteSelectedPlaylist);
  dom.btnPlaylistShuffle.addEventListener('click', togglePlaylistShuffle);
  dom.btnPlaylistPlay.addEventListener('click', playSelectedPlaylist);
  dom.btnBackArtists.addEventListener('click', () => {
    dom.artistTracksPanel.classList.add('hidden');
    dom.artistList.classList.remove('hidden');
  });
  dom.btnBackPlaylists.addEventListener('click', () => {
    state.selectedPlaylistId = '';
    renderTracksList();
  });

  dom.btnClosePlaylistModal.addEventListener('click', closePlaylistModal);
  dom.btnCancelPlaylist.addEventListener('click', closePlaylistModal);
  dom.playlistModal.addEventListener('click', (event) => {
    if (event.target === dom.playlistModal) closePlaylistModal();
  });
  dom.btnSavePlaylist.addEventListener('click', createPlaylist);
  dom.playlistNameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') createPlaylist();
  });

  dom.btnCloseAddTracks.addEventListener('click', closeAddTracksModal);
  dom.btnCancelAddTracks.addEventListener('click', closeAddTracksModal);
  dom.addTracksModal.addEventListener('click', (event) => {
    if (event.target === dom.addTracksModal) closeAddTracksModal();
  });
  dom.trackPickerSearch.addEventListener('input', renderTrackPicker);
  dom.btnConfirmAddTracks.addEventListener('click', addSelectedTracks);
}

/**
 * ─────────────────────────────────────────────────────────────
 *  MODAL DE GESTIÓN DE TOKEN (OPCIÓN 1)
 * ─────────────────────────────────────────────────────────────
 */

function initModalListeners() {
  dom.btnSaveToken.addEventListener('click', () => {
    connectTelegramBot(dom.tokenInput.value);
  });

  dom.tokenInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') connectTelegramBot(dom.tokenInput.value);
  });

  dom.btnCloseModal.addEventListener('click', closeTokenModal);

  dom.tokenModal.addEventListener('click', (e) => {
    if (e.target === dom.tokenModal && state.token) closeTokenModal();
  });

  dom.btnToggleTokenVisibility.addEventListener('click', () => {
    const isPass = dom.tokenInput.type === 'password';
    dom.tokenInput.type = isPass ? 'text' : 'password';
    dom.btnToggleTokenVisibility.innerHTML = isPass ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
  });

  dom.btnDisconnect.addEventListener('click', () => {
    if (confirm('¿Estás seguro de desconectar el bot y borrar las canciones guardadas?')) {
      localStorage.removeItem('tg_bot_token');
      localStorage.removeItem('tg_bot_name');
      localStorage.removeItem('tg_cached_tracks');
      localStorage.removeItem('tg_playlists');
      state.token = '';
      state.botName = '';
      state.tracks = [];
      state.playlists = [];
      state.selectedPlaylistId = '';
      pauseTrack();
      updateBotStatus(false, 'Desconectado');
      renderTracksList();
      dom.tokenInput.value = '';
      dom.btnDisconnect.classList.add('hidden');
      closeTokenModal();
      showToast('Bot desconectado');
    }
  });
}

function openTokenModal() {
  dom.tokenInput.value = state.token;
  dom.tokenError.classList.add('hidden');
  if (state.token) {
    dom.btnDisconnect.classList.remove('hidden');
  } else {
    dom.btnDisconnect.classList.add('hidden');
  }
  dom.tokenModal.classList.remove('hidden');
  setTimeout(() => dom.tokenInput.focus(), 100);
}

function closeTokenModal() {
  dom.tokenModal.classList.add('hidden');
}

function showTokenError(msg) {
  if (msg) {
    dom.tokenError.textContent = msg;
    dom.tokenError.classList.remove('hidden');
  } else {
    dom.tokenError.classList.add('hidden');
  }
}

function updateBotStatus(online, name) {
  dom.statusDot.classList.toggle('online', online);
  dom.botNameLabel.textContent = name;
}

/**
 * ─────────────────────────────────────────────────────────────
 *  BACKUP EN TELEGRAM (SIN DEPENDENCIAS EXTERNAS)
 * ─────────────────────────────────────────────────────────────
 */

// Envía canciones y playlists al chat del bot como archivo .json
async function sendBackupToTelegram() {
  if (!state.token || !state.chatId) {
    showToast('Conecta Telegram y envía un mensaje al bot antes de crear el backup');
    return;
  }
  if (state.tracks.length === 0 && state.playlists.length === 0) {
    showToast('No hay canciones ni playlists para guardar');
    return;
  }

  try {
    const date = new Date().toISOString().split('T')[0];
    const backup = {
      formatVersion: 2,
      exportedAt: new Date().toISOString(),
      tracks: state.tracks,
      playlists: state.playlists
    };
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });

    const form = new FormData();
    form.append('chat_id', state.chatId);
    form.append('document', blob, `playlist_backup_${date}.json`);
    form.append('caption', `Backup — ${countLabel(state.tracks.length, 'canción', 'canciones')} y ${countLabel(state.playlists.length, 'playlist', 'playlists')}`);

    const res = await fetch(`https://api.telegram.org/bot${state.token}/sendDocument`, {
      method: 'POST',
      body: form
    });
    const data = await res.json();
    if (data.ok) {
      showToast('Backup de canciones y playlists enviado a Telegram');
    } else {
      console.warn('⚠️ Error al enviar backup a Telegram:', data.description);
      showToast('No se pudo enviar el backup a Telegram');
    }
  } catch (err) {
    console.warn('⚠️ Error al enviar backup a Telegram:', err.message);
  }
}

// Restaura la playlist desde un archivo .json de backup enviado al bot
async function restoreFromBackup(fileId) {
  try {
    const url = await getTelegramFileUrl(fileId);
    const res = await fetch(url);
    const backup = await res.json();
    const merged = applyBackupData(backup);
    showToast(`Backup restaurado: ${merged.restoredTracks} canciones, ${merged.restoredPlaylists} playlists nuevas`);
  } catch (err) {
    console.warn('⚠️ Error al restaurar desde backup:', err.message);
    showToast('❌ Error al leer el archivo de backup');
  }
}

function applyBackupData(backup) {
  const backupTracks = Array.isArray(backup) ? backup : backup?.tracks;
  const backupPlaylists = Array.isArray(backup?.playlists) ? backup.playlists : [];
  if (!Array.isArray(backupTracks) || (backupTracks.length === 0 && backupPlaylists.length === 0)) {
    throw new Error('El archivo no contiene canciones ni playlists válidas');
  }

  const merged = mergeBackupData(backup);
  state.tracks = merged.tracks;
  state.playlists = merged.playlists;
  ensureFavoritesPlaylist();
  localStorage.setItem('tg_cached_tracks', JSON.stringify(state.tracks));
  savePlaylists(false);
  if (state.tracks.length > 0 && dom.trackTitle.textContent === 'Esperando bot...') {
    loadTrack(0, false);
  }
  return merged;
}

function mergeBackupData(backup) {
  const backupTracks = Array.isArray(backup) ? backup : (Array.isArray(backup?.tracks) ? backup.tracks : []);
  const backupPlaylists = Array.isArray(backup?.playlists) ? backup.playlists : [];
  const trackMap = new Map(state.tracks.filter((track) => track?.id).map((track) => [track.id, track]));
  const playlistMap = new Map(state.playlists.filter((playlist) => playlist?.id).map((playlist) => [playlist.id, playlist]));
  let restoredTracks = 0;
  let restoredPlaylists = 0;

  backupTracks.forEach((track) => {
    if (track?.id && !trackMap.has(track.id)) {
      trackMap.set(track.id, track);
      restoredTracks++;
    }
  });

  backupPlaylists.forEach((playlist) => {
    if (!playlist?.id || !playlist.name || !Array.isArray(playlist.trackIds)) return;
    const existing = playlistMap.get(playlist.id);
    const trackIds = new Set(existing?.trackIds || []);
    playlist.trackIds.forEach((id) => {
      if (trackMap.has(id)) trackIds.add(id);
    });
    playlistMap.set(playlist.id, { ...existing, ...playlist, trackIds: Array.from(trackIds) });
    if (!existing) restoredPlaylists++;
  });

  return {
    tracks: Array.from(trackMap.values()),
    playlists: Array.from(playlistMap.values()),
    restoredTracks,
    restoredPlaylists
  };
}

/**
 * ─────────────────────────────────────────────────────────────
 *  RENDERIZADO Y HELPERS
 * ─────────────────────────────────────────────────────────────
 */

function renderTracksList() {
  dom.playlistCount.textContent = countLabel(state.tracks.length, 'canción en biblioteca', 'canciones en biblioteca');
  renderArtistList();
  renderFavoritesList();
  renderPlaylistOverview();
  renderPlaylistDetail();
  renderSearchResults();
  updateMiniPlayer();
}

function renderArtistList() {
  const artists = new Map();
  state.tracks.forEach((track) => {
    const name = String(track.artist || 'Telegram').trim() || 'Telegram';
    const key = name.toLocaleLowerCase();
    const artist = artists.get(key) || { name, count: 0 };
    artist.count++;
    artists.set(key, artist);
  });

  const sortedArtists = Array.from(artists.values()).sort((a, b) => a.name.localeCompare(b.name));
  dom.artistCount.textContent = countLabel(sortedArtists.length, 'artista', 'artistas');
  if (sortedArtists.length === 0) {
    dom.artistList.innerHTML = '<div class="empty-msg">Sin artistas todavía. Sincroniza canciones desde Telegram.</div>';
    return;
  }

  dom.artistList.innerHTML = sortedArtists.map((artist) => `
    <button class="collection-row" type="button" data-artist="${escapeHtml(artist.name)}">
      <span class="collection-avatar">${escapeHtml(artist.name.slice(0, 1).toLocaleUpperCase())}</span>
      <span class="collection-row-copy">
        <span class="collection-row-title">${escapeHtml(artist.name)}</span>
        <span class="collection-row-subtitle">${countLabel(artist.count, 'canción', 'canciones')}</span>
      </span>
      <i class="fas fa-chevron-right collection-chevron" aria-hidden="true"></i>
    </button>
  `).join('');

  dom.artistList.querySelectorAll('[data-artist]').forEach((item) => {
    item.addEventListener('click', () => {
      state.selectedArtist = item.getAttribute('data-artist');
      dom.artistTrackTitle.textContent = state.selectedArtist;
      dom.artistList.classList.add('hidden');
      dom.artistTracksPanel.classList.remove('hidden');
      const tracks = state.tracks.filter((track) => (track.artist || 'Telegram').trim() === state.selectedArtist);
      renderTrackItems(dom.artistTrackList, tracks, 'Este artista no tiene canciones.');
    });
  });
}

function ensureFavoritesPlaylist() {
  let favorites = state.playlists.find((playlist) =>
    playlist.isDefault === 'favorites' || String(playlist.name || '').trim().toLocaleLowerCase() === 'favoritos'
  );
  if (!favorites) {
    favorites = { id: 'favorites', name: 'Favoritos', trackIds: [], isDefault: 'favorites' };
    state.playlists.unshift(favorites);
  } else {
    favorites.name = 'Favoritos';
    favorites.isDefault = 'favorites';
    if (!Array.isArray(favorites.trackIds)) favorites.trackIds = [];
  }
  localStorage.setItem('tg_playlists', JSON.stringify(state.playlists));
  return favorites;
}

function getFavoritesPlaylist() {
  return state.playlists.find((playlist) => playlist.isDefault === 'favorites') || ensureFavoritesPlaylist();
}

function isTrackFavorite(track) {
  return Boolean(track && getFavoritesPlaylist().trackIds.includes(track.id));
}

function updateFavoriteButton() {
  const favorite = isTrackFavorite(state.tracks[state.currentIndex]);
  dom.btnFavorite.classList.toggle('active', favorite);
  dom.btnFavorite.setAttribute('aria-pressed', String(favorite));
  dom.btnFavorite.setAttribute('aria-label', favorite ? 'Quitar canción de Favoritos' : 'Añadir canción a Favoritos');
  dom.btnFavorite.title = favorite ? 'Quitar de Favoritos' : 'Añadir a Favoritos';
  dom.btnFavorite.innerHTML = favorite ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
}

function toggleCurrentFavorite() {
  const track = state.tracks[state.currentIndex];
  if (!track) return;

  const favorites = getFavoritesPlaylist();
  const index = favorites.trackIds.indexOf(track.id);
  if (index === -1) {
    favorites.trackIds.push(track.id);
    showToast('Añadida a Favoritos');
  } else {
    favorites.trackIds.splice(index, 1);
    showToast('Quitada de Favoritos');
  }

  savePlaylists(false);
  updateFavoriteButton();
}

function renderFavoritesList() {
  const favorites = getFavoritesPlaylist();
  const tracks = state.tracks.filter((track) => favorites.trackIds.includes(track.id));
  dom.favoriteCount.textContent = countLabel(tracks.length, 'canción', 'canciones');
  renderTrackItems(dom.favoriteTrackList, tracks, 'Todavía no hay favoritos. Usa el corazón en Ahora suena.');
}

function renderPlaylistOverview() {
  if (state.playlists.length === 0) {
    dom.playlistOverview.innerHTML = '<div class="empty-msg">Crea una playlist para organizar tus canciones favoritas.</div>';
    return;
  }

  dom.playlistOverview.innerHTML = state.playlists.map((playlist) => {
    const tracks = getPlaylistTracks(playlist);
    const artwork = tracks.slice(0, 4);
    const collage = artwork.length
      ? artwork.map((track) => `
          <span class="playlist-art-tile">
            ${track.thumb_id ? `<img data-thumb-id="${escapeHtml(track.thumb_id)}" alt="" loading="lazy">` : ''}
            <i class="fas fa-music" aria-hidden="true"></i>
          </span>
        `).join('')
      : '<span class="playlist-art-empty"><i class="fas fa-music" aria-hidden="true"></i></span>';
    const duration = getPlaylistDurationLabel(tracks);

    return `
      <button class="collection-row playlist-row" type="button" data-playlist-id="${escapeHtml(playlist.id)}">
        <span class="playlist-art ${artwork.length === 1 ? 'single-art' : ''}">${collage}</span>
        <span class="collection-row-copy">
          <span class="collection-row-title">${escapeHtml(playlist.name)}</span>
          <span class="collection-row-subtitle">${countLabel(tracks.length, 'canción', 'canciones')}</span>
          ${duration ? `<span class="collection-row-duration">${escapeHtml(duration)}</span>` : ''}
        </span>
        <i class="fas fa-chevron-right collection-chevron" aria-hidden="true"></i>
      </button>
    `;
  }).join('');

  dom.playlistOverview.querySelectorAll('[data-playlist-id]').forEach((item) => {
    item.addEventListener('click', () => {
      state.selectedPlaylistId = item.getAttribute('data-playlist-id');
      renderPlaylistDetail();
    });
  });
  observeTrackThumbnails(dom.playlistOverview);
}

function renderPlaylistDetail() {
  const playlist = state.playlists.find((item) => item.id === state.selectedPlaylistId);
  if (!playlist) {
    dom.playlistDetail.classList.add('hidden');
    dom.playlistOverview.classList.remove('hidden');
    return;
  }

  dom.playlistOverview.classList.add('hidden');
  dom.playlistDetail.classList.remove('hidden');
  dom.btnDeletePlaylist.classList.toggle('hidden', playlist.isDefault === 'favorites');
  dom.selectedPlaylistTitle.textContent = playlist.name;
  const tracks = getPlaylistTracks(playlist);
  const duration = getPlaylistDurationLabel(tracks);
  dom.selectedPlaylistCount.textContent = `${countLabel(tracks.length, 'canción', 'canciones')}${duration ? ` · ${duration}` : ''}`;
  const artwork = tracks.slice(0, 4);
  dom.playlistHeroArt.innerHTML = artwork.length
    ? artwork.map((track) => `
        <span class="playlist-hero-tile">
          ${track.thumb_id ? `<img data-thumb-id="${escapeHtml(track.thumb_id)}" alt="" loading="lazy">` : ''}
          <i class="fas fa-music" aria-hidden="true"></i>
        </span>
      `).join('')
    : '<span class="playlist-hero-empty"><i class="fas fa-music"></i></span>';
  dom.playlistHeroArt.dataset.count = String(artwork.length);
  renderTrackItems(dom.playlistTrackList, tracks, 'Playlist vacía. Añade canciones para empezar.');
  observeTrackThumbnails(dom.playlistHeroArt);
  updatePlaylistPlaybackButtons();
}

function getPlaylistTracks(playlist) {
  const tracksById = new Map(state.tracks.map((track) => [track.id, track]));
  return playlist.trackIds.map((id) => tracksById.get(id)).filter(Boolean);
}

function playSelectedPlaylist() {
  const playlist = state.playlists.find((item) => item.id === state.selectedPlaylistId);
  if (!playlist) return;

  const tracks = getPlaylistTracks(playlist);
  if (tracks.length === 0) {
    showToast('Esta playlist no tiene canciones');
    return;
  }

  const trackIds = tracks.map((track) => track.id);
  const sameQueue = Array.isArray(state.playQueueIds)
    && state.playQueueIds.length === trackIds.length
    && state.playQueueIds.every((id, index) => id === trackIds[index]);
  const currentTrackId = state.tracks[state.currentIndex]?.id;
  if (sameQueue && trackIds.includes(currentTrackId)) {
    togglePlay();
    return;
  }

  startPlaylistPlayback(playlist, false);
}

function togglePlaylistShuffle() {
  const playlist = state.playlists.find((item) => item.id === state.selectedPlaylistId);
  if (!playlist) return;

  const trackIds = getPlaylistTracks(playlist).map((track) => track.id);
  if (trackIds.length === 0) {
    showToast('Esta playlist no tiene canciones');
    return;
  }

  const sameQueue = Array.isArray(state.playQueueIds)
    && state.playQueueIds.length === trackIds.length
    && state.playQueueIds.every((id, index) => id === trackIds[index]);
  if (sameQueue && state.isShuffle) {
    state.isShuffle = false;
    dom.btnShuffle.classList.remove('active');
    prepareNextTrack();
    updatePlaylistPlaybackButtons();
    return;
  }

  startPlaylistPlayback(playlist, true);
}

function startPlaylistPlayback(playlist, shuffle) {
  const tracks = getPlaylistTracks(playlist);
  if (tracks.length === 0) return;

  state.playQueueIds = tracks.map((track) => track.id);
  state.isShuffle = shuffle;
  dom.btnShuffle.classList.toggle('active', shuffle);
  let trackIndex = state.tracks.indexOf(tracks[0]);
  if (shuffle && tracks.length > 1) {
    trackIndex = state.tracks.indexOf(tracks[Math.floor(Math.random() * tracks.length)]);
  }
  loadTrack(trackIndex, true);
}

function updatePlaylistPlaybackButtons() {
  if (!dom.btnPlaylistPlay || !dom.btnPlaylistShuffle) return;
  const playlist = state.playlists.find((item) => item.id === state.selectedPlaylistId);
  if (!playlist) return;

  const trackIds = getPlaylistTracks(playlist).map((track) => track.id);
  const sameQueue = Array.isArray(state.playQueueIds)
    && state.playQueueIds.length === trackIds.length
    && state.playQueueIds.every((id, index) => id === trackIds[index]);
  const currentTrackIsInPlaylist = sameQueue && trackIds.includes(state.tracks[state.currentIndex]?.id);
  const shouldPause = state.isPlaying && currentTrackIsInPlaylist;
  dom.btnPlaylistPlay.innerHTML = shouldPause
    ? '<i class="fas fa-pause"></i>'
    : '<i class="fas fa-play"></i>';
  dom.btnPlaylistPlay.setAttribute('aria-label', shouldPause ? 'Pausar playlist' : 'Reproducir playlist');
  dom.btnPlaylistShuffle.classList.toggle('active', sameQueue && state.isShuffle);
  dom.btnPlaylistShuffle.setAttribute('aria-pressed', String(sameQueue && state.isShuffle));
}

function getPlaylistDurationLabel(tracks) {
  if (tracks.length === 0) return '';

  const knownDurations = tracks
    .map((track) => Number(track.duration))
    .filter((duration) => Number.isFinite(duration) && duration > 0);
  const totalSeconds = knownDurations.reduce((total, duration) => total + duration, 0);
  const hasUnknownDurations = knownDurations.length < tracks.length;
  if (totalSeconds === 0) return 'Duración pendiente';

  const totalMinutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const formatted = hours ? `${hours} h${minutes ? ` ${minutes} min` : ''}` : `${minutes} min`;
  return hasUnknownDurations ? `Duración parcial · ${formatted}` : formatted;
}

function renderSearchResults() {
  const query = dom.searchInput.value.trim().toLocaleLowerCase();
  if (!query) {
    dom.searchCount.textContent = '';
    dom.searchTrackList.innerHTML = '<div class="empty-msg">Busca por título o artista.</div>';
    return;
  }

  const matches = state.tracks.filter((track) =>
    `${track.name || ''} ${track.artist || ''}`.toLocaleLowerCase().includes(query)
  );
  dom.searchCount.textContent = countLabel(matches.length, 'resultado', 'resultados');
  renderTrackItems(dom.searchTrackList, matches, 'No se encontraron canciones.');
}

function renderTrackItems(container, tracks, emptyMessage) {
  if (tracks.length === 0) {
    container.innerHTML = `<div class="empty-msg">${emptyMessage}</div>`;
    return;
  }

  container.innerHTML = tracks.map((track) => {
    const index = state.tracks.indexOf(track);
    return `
      <button class="track-item ${index === state.currentIndex ? 'active' : ''}" type="button" data-index="${index}" aria-label="${escapeHtml(track.name)} de ${escapeHtml(track.artist)}">
        <span class="track-artwork" aria-hidden="true">
          ${track.thumb_id ? `<img data-thumb-id="${escapeHtml(track.thumb_id)}" alt="" loading="lazy">` : ''}
          <span class="track-artwork-placeholder"><i class="fas fa-music"></i></span>
        </span>
        <span class="track-item-details">
          <span class="track-item-title">${escapeHtml(track.name)}</span>
          <span class="track-item-artist">${escapeHtml(track.artist)}</span>
        </span>
        <i class="fas fa-play track-play-icon" aria-hidden="true"></i>
      </button>
    `;
  }).join('');

  container.querySelectorAll('.track-item').forEach((item) => {
    item.addEventListener('click', () => {
      setActiveView('player');
      state.playQueueIds = tracks.map((track) => track.id);
      loadTrack(Number(item.getAttribute('data-index')), true);
    });
  });
  observeTrackThumbnails(container);
}

function initThumbnailObserver() {
  if (!('IntersectionObserver' in window)) return;
  state.thumbnailObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      state.thumbnailObserver.unobserve(entry.target);
      loadTrackThumbnail(entry.target);
    });
  }, { rootMargin: '120px 0px' });
}

function observeTrackThumbnails(container) {
  if (!state.thumbnailObserver || !state.token) return;
  container.querySelectorAll('img[data-thumb-id]').forEach((image) => {
    const cachedUrl = state.thumbnailUrls.get(image.dataset.thumbId);
    if (cachedUrl) {
      image.src = cachedUrl;
      image.classList.add('loaded');
    } else {
      state.thumbnailObserver.observe(image);
    }
  });
}

async function loadTrackThumbnail(image) {
  const fileId = image.dataset.thumbId;
  let url = state.thumbnailUrls.get(fileId) || '';
  if (!url) url = await requestTrackThumbnail(fileId);
  if (!url || !image.isConnected || image.dataset.thumbId !== fileId) return;
  image.src = url;
  image.classList.add('loaded');
}

function requestTrackThumbnail(fileId) {
  const cachedUrl = state.thumbnailUrls.get(fileId);
  if (cachedUrl) return Promise.resolve(cachedUrl);

  const pending = state.thumbnailRequests.get(fileId);
  if (pending) return pending;

  let resolveRequest;
  const request = new Promise((resolve) => { resolveRequest = resolve; });
  state.thumbnailRequests.set(fileId, request);
  state.thumbnailQueue.push({ fileId, resolve: resolveRequest });
  pumpThumbnailQueue();
  return request;
}

function pumpThumbnailQueue() {
  while (state.thumbnailActive < 3 && state.thumbnailQueue.length > 0) {
    const job = state.thumbnailQueue.shift();
    state.thumbnailActive++;
    getTelegramFileUrl(job.fileId)
      .then((url) => {
        state.thumbnailUrls.set(job.fileId, url);
        job.resolve(url);
      })
      .catch(() => job.resolve(''))
      .finally(() => {
        state.thumbnailRequests.delete(job.fileId);
        state.thumbnailActive--;
        pumpThumbnailQueue();
      });
  }
}

function setActiveView(view) {
  state.activeView = view;
  const views = {
    player: [dom.playerScreen, dom.btnViewPlayer],
    artists: [dom.artistsScreen, dom.btnViewArtists],
    favorites: [dom.favoritesScreen, dom.btnViewFavorites],
    playlists: [dom.playlistsScreen, dom.btnViewPlaylists],
    search: [dom.searchScreen, dom.btnViewSearch]
  };
  Object.entries(views).forEach(([name, [screen, button]]) => {
    const active = name === view;
    screen.classList.toggle('active', active);
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  updateMiniPlayer();
}

function updateMiniPlayer() {
  const track = state.tracks[state.currentIndex];
  const visible = state.activeView !== 'player' && Boolean(track);
  dom.miniPlayer.classList.toggle('hidden', !visible);
  if (!track) return;

  dom.miniPlayerTitle.textContent = track.name;
  dom.miniPlayerArtist.textContent = track.artist || 'Desconocido';
  dom.btnMiniPlayerToggle.setAttribute('aria-label', state.isPlaying ? 'Pausar' : 'Reproducir');
  dom.btnMiniPlayerToggle.innerHTML = state.isPlaying
    ? '<i class="fas fa-pause"></i>'
    : '<i class="fas fa-play"></i>';

  dom.miniPlayerCover.dataset.trackId = track.id;
  if (!track.thumb_id) {
    dom.miniPlayerCover.removeAttribute('src');
    dom.miniPlayerCover.classList.add('hidden');
    dom.miniPlayerPlaceholder.classList.remove('hidden');
    return;
  }

  const cachedUrl = state.thumbnailUrls.get(track.thumb_id);
  if (cachedUrl) {
    dom.miniPlayerCover.src = cachedUrl;
    dom.miniPlayerCover.classList.remove('hidden');
    dom.miniPlayerPlaceholder.classList.add('hidden');
    return;
  }

  dom.miniPlayerCover.classList.add('hidden');
  dom.miniPlayerPlaceholder.classList.remove('hidden');
  requestTrackThumbnail(track.thumb_id).then((url) => {
    if (!url || state.tracks[state.currentIndex]?.id !== track.id) return;
    dom.miniPlayerCover.src = url;
    dom.miniPlayerCover.classList.remove('hidden');
    dom.miniPlayerPlaceholder.classList.add('hidden');
  });
}

function updateActiveTrackInList() {
  [dom.artistTrackList, dom.favoriteTrackList, dom.playlistTrackList, dom.searchTrackList].forEach((container) => {
    container.querySelectorAll('.track-item').forEach((item) => {
      item.classList.toggle('active', Number(item.getAttribute('data-index')) === state.currentIndex);
    });
    const activeItem = container.querySelector('.track-item.active');
    if (activeItem) activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

function openPlaylistModal() {
  dom.playlistNameInput.value = '';
  dom.playlistNameError.classList.add('hidden');
  dom.playlistModal.classList.remove('hidden');
  setTimeout(() => dom.playlistNameInput.focus(), 50);
}

function closePlaylistModal() {
  dom.playlistModal.classList.add('hidden');
}

function createPlaylist() {
  const name = dom.playlistNameInput.value.trim();
  const duplicate = state.playlists.some((playlist) => playlist.name.toLocaleLowerCase() === name.toLocaleLowerCase());
  if (!name || duplicate) {
    dom.playlistNameError.textContent = name ? 'Ya existe una playlist con ese nombre.' : 'Escribe un nombre para la playlist.';
    dom.playlistNameError.classList.remove('hidden');
    return;
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  state.playlists.unshift({ id, name, trackIds: [] });
  state.selectedPlaylistId = id;
  savePlaylists(false);
  closePlaylistModal();
  setActiveView('playlists');
  renderTracksList();
  showToast(`Playlist "${name}" creada`);
}

function savePlaylists(showFeedback = true) {
  localStorage.setItem('tg_playlists', JSON.stringify(state.playlists));
  renderTracksList();
  if (showFeedback) showToast('Playlists guardadas en este navegador');
}

function deleteSelectedPlaylist() {
  const playlist = state.playlists.find((item) => item.id === state.selectedPlaylistId);
  if (playlist?.isDefault === 'favorites') {
    showToast('Favoritos es una playlist predeterminada');
    return;
  }
  if (!playlist || !confirm(`¿Eliminar la playlist "${playlist.name}"? Las canciones seguirán en tu biblioteca.`)) return;

  state.playlists = state.playlists.filter((item) => item.id !== playlist.id);
  state.selectedPlaylistId = '';
  savePlaylists(false);
  showToast('Playlist eliminada');
}

function openAddTracksModal() {
  if (!state.selectedPlaylistId) return;
  state.pendingTrackIds = new Set();
  dom.trackPickerSearch.value = '';
  renderTrackPicker();
  dom.addTracksModal.classList.remove('hidden');
}

function closeAddTracksModal() {
  dom.addTracksModal.classList.add('hidden');
  state.pendingTrackIds.clear();
}

function renderTrackPicker() {
  const query = dom.trackPickerSearch.value.trim().toLocaleLowerCase();
  const tracks = state.tracks.filter((track) =>
    `${track.name || ''} ${track.artist || ''}`.toLocaleLowerCase().includes(query)
  );
  if (tracks.length === 0) {
    dom.trackPickerList.innerHTML = '<div class="empty-msg">No se encontraron canciones.</div>';
    return;
  }

  const playlist = state.playlists.find((item) => item.id === state.selectedPlaylistId);
  const existingIds = new Set(playlist?.trackIds || []);
  dom.trackPickerList.innerHTML = tracks.map((track) => {
    const alreadyAdded = existingIds.has(track.id);
    const checked = alreadyAdded || state.pendingTrackIds.has(track.id);
    return `
      <label class="track-picker-row ${alreadyAdded ? 'already-added' : ''}">
        <input type="checkbox" value="${escapeHtml(track.id)}" ${checked ? 'checked' : ''} ${alreadyAdded ? 'disabled' : ''}>
        <span class="track-item-details">
          <span class="track-item-title">${escapeHtml(track.name)}</span>
          <span class="track-item-artist">${escapeHtml(track.artist)}</span>
        </span>
        ${alreadyAdded ? '<span class="picker-added-label">Añadida</span>' : ''}
      </label>
    `;
  }).join('');

  dom.trackPickerList.querySelectorAll('input[type="checkbox"]:not(:disabled)').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) state.pendingTrackIds.add(checkbox.value);
      else state.pendingTrackIds.delete(checkbox.value);
    });
  });
}

function addSelectedTracks() {
  const playlist = state.playlists.find((item) => item.id === state.selectedPlaylistId);
  if (!playlist) return;

  const existingIds = new Set(playlist.trackIds);
  const additions = Array.from(state.pendingTrackIds).filter((id) =>
    !existingIds.has(id) && state.tracks.some((track) => track.id === id)
  );
  playlist.trackIds.push(...additions);
  closeAddTracksModal();
  savePlaylists(false);
  showToast(additions.length ? countLabel(additions.length, 'canción añadida', 'canciones añadidas') : 'No seleccionaste canciones nuevas');
}

function updateVolumeIcon() {
  const icon = dom.volumeBtn.querySelector('i');
  if (state.isMuted || state.audio.volume === 0) {
    icon.className = 'fas fa-volume-mute';
  } else if (state.audio.volume < 0.5) {
    icon.className = 'fas fa-volume-down';
  } else {
    icon.className = 'fas fa-volume-up';
  }
}

function showToast(msg) {
  dom.toast.textContent = msg;
  dom.toast.classList.add('show');
  setTimeout(() => dom.toast.classList.remove('show'), 2800);
}

function countLabel(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatTime(seconds) {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
