/**
 * Google Sheets Cloud Sync Module
 * Tự động đồng bộ 2 chiều (ĐỌC & GHI) ngầm giữa Web Album và Google Sheets
 * Hỗ trợ quét toàn bộ ảnh từ thư mục Google Drive (500+ / 1000+ ảnh) qua Apps Script
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
   * 🟢 ĐỌC dữ liệu Album từ Google Sheet (GET)
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
   * 🔍 QUÉT TOÀN BỘ ẢNH TRONG THƯ MỤC GOOGLE DRIVE (500+ / 1000+ ảnh)
   * Gọi Apps Script backend với action=scanFolder hoặc action=getFolderPhotos
   */
  async function scanFolderPhotos(folderId) {
    if (!scriptUrl || !folderId) return null;

    try {
      const url = `${scriptUrl}${scriptUrl.includes('?') ? '&' : '?'}action=scanFolder&folderId=${encodeURIComponent(folderId)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();

      if (result.success && Array.isArray(result.photos) && result.photos.length > 0) {
        return result.photos;
      }
      return null;
    } catch (err) {
      console.warn('Lỗi quét ảnh từ Google Apps Script:', err.message);
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
        const payload = JSON.stringify({ action: 'saveAlbum', album: album });

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

  /**
   * 🗑️ XÓA Album khỏi Google Sheet
   */
  async function deleteAlbumFromCloud(albumId) {
    if (!scriptUrl || !albumId) return;

    try {
      const payload = JSON.stringify({ action: 'deleteAlbum', albumId: albumId });
      await fetch(scriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: payload,
      });
    } catch (err) {
      console.warn('Lỗi gửi yêu cầu xóa album lên Cloud:', err.message);
    }
  }

  /**
   * Kiểm tra kết nối tới Apps Script
   */
  async function testConnection(testUrl) {
    const targetUrl = (testUrl || scriptUrl || '').trim();
    if (!targetUrl) {
      return { success: false, message: 'Chưa nhập URL Google Apps Script.' };
    }

    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return {
        success: true,
        message: `Đã kết nối thành công! Nhận được ${Array.isArray(data.data) ? data.data.length : 0} album từ Cloud.`,
      };
    } catch (err) {
      return {
        success: false,
        message: `Không thể kết nối (${err.message}). Vui lòng kiểm tra lại quyền Web App đã đặt "Anyone" (Bất kỳ ai).`,
      };
    }
  }

  /**
   * Mã nguồn mẫu Google Apps Script hoàn chỉnh để người dùng copy
   */
  function getAppsScriptCodeTemplate() {
    return `/**
 * GOOGLE APPS SCRIPT CHO WEB ALBUM PRO HARLAN
 * Chức năng:
 * 1. Quét tự động 500+ / 1000+ ảnh trong thư mục Google Drive (Tên file, Drive ID)
 * 2. Đọc và lưu dữ liệu Album 2 chiều vào Google Sheets
 * 3. Hỗ trợ CORS và chạy mượt mà không giới hạn
 */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';
  
  // 1. Quét toàn bộ ảnh trong Thư mục Google Drive
  if (action === 'scanFolder' || action === 'getFolderPhotos') {
    var folderId = e.parameter.folderId;
    if (!folderId) {
      return createJsonResponse({ success: false, message: 'Thiếu folderId' });
    }
    try {
      var folder = DriveApp.getFolderById(folderId);
      var files = folder.getFiles();
      var photos = [];
      var validExts = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'cr2', 'cr3', 'nef', 'arw', 'dng', 'raf', 'tif', 'tiff'];
      var count = 1;
      
      while (files.hasNext()) {
        var file = files.next();
        var name = file.getName();
        var mime = file.getMimeType();
        var ext = name.split('.').pop().toLowerCase();
        
        if (mime.indexOf('image/') === 0 || validExts.indexOf(ext) !== -1) {
          photos.push({
            id_photo: 'p_' + Utilities.getUuid().substring(0, 9),
            link_id: file.getId(),
            filename: name,
            selected: false,
            tim: false,
            in_anh: false,
            size_anh: '',
            note: ''
          });
          count++;
        }
      }
      
      // Sắp xếp theo tên file tăng dần tự nhiên (IMG_0001, IMG_0002...)
      photos.sort(function(a, b) {
        return a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' });
      });
      
      return createJsonResponse({
        success: true,
        count: photos.length,
        folderName: folder.getName(),
        photos: photos
      });
    } catch(err) {
      return createJsonResponse({ success: false, message: 'Lỗi đọc Drive: ' + err.toString() });
    }
  }
  
  // 2. Đọc toàn bộ danh sách Album từ Google Sheet
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = sheet.getDataRange().getValues();
    var albums = [];
    
    if (data.length > 1) {
      for (var i = 1; i < data.length; i++) {
        try {
          if (data[i][1]) {
            var albumObj = JSON.parse(data[i][1]);
            albums.push(albumObj);
          }
        } catch(ex) {}
      }
    }
    return createJsonResponse({ success: true, data: albums });
  } catch(err) {
    return createJsonResponse({ success: false, message: err.toString() });
  }
}

function doPost(e) {
  try {
    var contents = e.postData.contents;
    var payload = JSON.parse(contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = sheet.getDataRange().getValues();
    
    // Xóa album
    if (payload.action === 'deleteAlbum' && payload.albumId) {
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] == payload.albumId) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
      return createJsonResponse({ success: true, message: 'Deleted album' });
    }
    
    // Lưu / Cập nhật album
    var album = payload.album || payload;
    if (!album || !album.id) {
      return createJsonResponse({ success: false, message: 'Album invalid' });
    }
    
    var rowIndex = -1;
    for (var j = 1; j < data.length; j++) {
      if (data[j][0] == album.id || (data[j][1] && JSON.parse(data[j][1]).code == album.code)) {
        rowIndex = j + 1;
        break;
      }
    }
    
    var jsonString = JSON.stringify(album);
    if (rowIndex !== -1) {
      sheet.getRange(rowIndex, 1, 1, 3).setValues([[album.id, jsonString, new Date()]]);
    } else {
      sheet.appendRow([album.id, jsonString, new Date()]);
    }
    
    return createJsonResponse({ success: true, message: 'Saved album ' + album.id });
  } catch(err) {
    return createJsonResponse({ success: false, message: err.toString() });
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}`;
  }

  return {
    getScriptUrl,
    setScriptUrl,
    fetchAlbumsFromCloud,
    scanFolderPhotos,
    syncAlbumToCloud,
    deleteAlbumFromCloud,
    testConnection,
    getAppsScriptCodeTemplate,
  };
})();

window.SheetsSync = SheetsSync;
