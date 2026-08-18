/**
 * Google Sheets Cloud Sync Module
 * Tự động đồng bộ 2 chiều (ĐỌC & GHI) ngầm giữa Web Album và Google Sheets
 */

const SheetsSync = (function () {
  const SCRIPT_STORAGE_KEY = 'web_album_apps_script_url';
  const ACTIVE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzzKFwZRB3ni2tqrljpMFJMhDJ1BtaQwfhaoNWOSJVma7Thv2PZh66MD3QEirdA7kAouQ/exec';

  let scriptUrl = localStorage.getItem(SCRIPT_STORAGE_KEY) || ACTIVE_SCRIPT_URL;
  let syncDebounceTimer = null;

  function getScriptUrl() {
    return scriptUrl;
  }

  function setScriptUrl(url) {
    scriptUrl = (url || '').trim() || ACTIVE_SCRIPT_URL;
    localStorage.setItem(SCRIPT_STORAGE_KEY, scriptUrl);
  }

  /**
   * 🟢 ĐỌC dữ liệu từ Google Sheet (GET)
   */
  async function fetchAlbumsFromCloud() {
    if (!scriptUrl) return null;

    try {
      const response = await fetch(scriptUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
        return result.data;
      }
      return null;
    } catch (err) {
      console.warn('Đang sử dụng dữ liệu cục bộ (Chưa đồng bộ Sheet):', err.message);
      return null;
    }
  }

  /**
   * 🔴 GHI / CẬP NHẬT Album lên Google Sheet (POST)
   * Tự động gửi ngầm khi tạo album, khách chọn ảnh, thả tim, ghi chú...
   */
  async function syncAlbumToCloud(album) {
    if (!scriptUrl || !album) return;

    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(async () => {
      try {
        const payload = JSON.stringify({ album: album });

        await fetch(scriptUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: payload,
        });
      } catch (err) {
        console.warn('Lỗi ghi dữ liệu ngầm lên Google Sheet:', err.message);
      }
    }, 600);
  }

  return {
    getScriptUrl,
    setScriptUrl,
    fetchAlbumsFromCloud,
    syncAlbumToCloud,
  };
})();

window.SheetsSync = SheetsSync;
