/**
 * Batch Photo Downloader with in-browser streaming ZIP compression (JSZip)
 * Tối ưu tải song song, chống crash RAM trên iOS/Android, thanh tiến trình % và MB
 */

const AlbumDownloader = (function () {
  let animationFrameId = null;
  let resetTimeoutId = null;
  let fadeIntervalId = null;

  /**
   * Tải ảnh theo bộ lọc
   * @param {Array} photos - Danh sách object ảnh {link_id, filename, selected, tim, in_anh, note}
   * @param {string} albumTitle - Tên album
   * @param {string} filterType - 'all', 'selected', 'favorite', 'print', 'note'
   */
  async function downloadBatch(photos, albumTitle = 'Album', filterType = 'all') {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (resetTimeoutId) clearTimeout(resetTimeoutId);
    if (fadeIntervalId) clearInterval(fadeIntervalId);

    // Lọc danh sách file theo tiêu chí
    let targetPhotos = [];
    if (filterType === 'selected') {
      targetPhotos = photos.filter((p) => p.selected);
    } else if (filterType === 'favorite') {
      targetPhotos = photos.filter((p) => p.tim);
    } else if (filterType === 'print') {
      targetPhotos = photos.filter((p) => p.in_anh);
    } else if (filterType === 'note') {
      targetPhotos = photos.filter((p) => p.note && p.note.trim().length > 0);
    } else {
      targetPhotos = [...photos];
    }

    if (!targetPhotos.length) {
      alert('Không có ảnh nào phù hợp với bộ lọc đã chọn để tải về!');
      return;
    }

    const box = document.getElementById('downloadProgressBox');
    const bar = document.getElementById('downloadProgressBar');
    const percentEl = document.getElementById('downloadProgressPercent');
    const headerEl = document.getElementById('downloadProgressHeader');
    const subtextEl = document.getElementById('downloadProgressSubtext');
    const wakeNotice = document.getElementById('downloadWakeNotice');

    if (box) {
      box.style.display = 'block';
      box.style.opacity = '1';
    }
    if (bar) bar.style.width = '0%';
    if (percentEl) percentEl.textContent = '0%';
    if (headerEl) headerEl.textContent = `Đang chuẩn bị tải ${targetPhotos.length} ảnh...`;
    if (subtextEl) subtextEl.textContent = 'Đã tải: 0.0 MB';

    // Bật Screen Wake Lock để giữ màn hình điện thoại luôn sáng
    let wakeLock = null;
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
        if (wakeNotice) wakeNotice.style.display = 'flex';
      }
    } catch (e) {
      console.warn('Wake Lock không khả dụng hoặc bị từ chối.');
    }

    let loadedBytes = 0;
    let filesDone = 0;
    const totalFiles = targetPhotos.length;

    function updateStats() {
      if (subtextEl) {
        subtextEl.textContent = `Đã tải: ${(loadedBytes / 1024 / 1024).toFixed(1)} MB (${filesDone}/${totalFiles} ảnh)`;
      }
      animationFrameId = requestAnimationFrame(updateStats);
    }
    requestAnimationFrame(updateStats);

    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const MAX_ZIP_SIZE = isIOS ? 200 * 1024 * 1024 : 500 * 1024 * 1024; // 200MB trên iOS, 500MB trên PC
    const CONCURRENCY = isIOS ? 2 : 5;

    let currentZip = new JSZip();
    let currentSize = 0;
    let zipIndex = 1;

    async function flushZip() {
      if (currentSize === 0) return;
      if (headerEl) {
        headerEl.innerHTML = `<b>${Math.round((filesDone / totalFiles) * 100)}%</b> - Đang nén file ZIP ${zipIndex > 1 ? `phần ${zipIndex}` : ''}...`;
      }
      const zipBlob = await currentZip.generateAsync({
        type: 'blob',
        compression: 'STORE',
      });
      currentZip = null; // giải phóng RAM

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      const cleanTitle = albumTitle.replace(/[^a-zA-Z0-9_\-\u00C0-\u1EF9]/g, '_');
      a.download = `${cleanTitle}${zipIndex > 1 ? `-part${zipIndex}` : ''}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      zipIndex++;
      currentZip = new JSZip();
      currentSize = 0;

      if (isIOS) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    let zipQueue = Promise.resolve();

    async function addFileToZip(filename, blob) {
      if (currentSize + blob.size > MAX_ZIP_SIZE && currentSize > 0) {
        await flushZip();
      }
      currentZip.file(filename, blob);
      currentSize += blob.size;
    }

    async function fetchSinglePhoto(photo, index) {
      const filename = photo.filename || `IMG_${String(index + 1).padStart(4, '0')}.JPG`;
      const directUrl = DriveParser.getCdnUrl(photo.link_id, 1920);
      const fallbackUrl = DriveParser.getFallbackUrl(photo.link_id, 1600);

      const urlsToTry = [
        directUrl,
        fallbackUrl,
        `https://drive.google.com/uc?export=download&id=${photo.link_id}`
      ];

      for (let attempt = 0; attempt < urlsToTry.length; attempt++) {
        try {
          const resp = await fetch(urlsToTry[attempt]);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const blob = await resp.blob();
          loadedBytes += blob.size;
          return { filename, blob };
        } catch (e) {
          if (attempt === urlsToTry.length - 1) {
            console.error(`Không thể tải ảnh ${filename}:`, e);
            return null;
          }
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      return null;
    }

    let downloadIdx = 0;
    const workerPromises = Array.from({ length: CONCURRENCY }, async () => {
      while (true) {
        const current = downloadIdx++;
        if (current >= targetPhotos.length) break;

        const photo = targetPhotos[current];
        const res = await fetchSinglePhoto(photo, current);
        filesDone++;

        const percentVal = Math.round((filesDone / totalFiles) * 100);
        if (percentEl) percentEl.textContent = `${percentVal}%`;
        if (bar) bar.style.width = `${percentVal}%`;
        if (headerEl) headerEl.textContent = `Đang tải & xử lý (${filesDone}/${totalFiles})...`;

        if (res && res.blob) {
          zipQueue = zipQueue.then(() => addFileToZip(res.filename, res.blob));
          await zipQueue;
          res.blob = null;
        }
      }
    });

    await Promise.all(workerPromises);
    await flushZip();

    // Hoàn tất
    if (headerEl) headerEl.innerHTML = '🎉 <b>100%</b> - Đã hoàn tất tải file ZIP!';
    if (wakeNotice) wakeNotice.style.display = 'none';
    if (wakeLock) {
      wakeLock.release();
      wakeLock = null;
    }

    resetTimeoutId = setTimeout(() => {
      cancelAnimationFrame(animationFrameId);
      if (box) {
        box.style.display = 'none';
      }
    }, 4500);
  }

  return {
    downloadBatch,
  };
})();

window.AlbumDownloader = AlbumDownloader;
