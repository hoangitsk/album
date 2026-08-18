/**
 * Google Drive URL Parser & Image Resolver
 * Hỗ trợ trích xuất Folder ID, File ID, tạo link CDN chất lượng cao và fallback
 */

const DriveParser = (function () {
  // Regex pattern cho Google Drive link
  const PATTERNS = {
    folder: /(?:folders\/|id=)([a-zA-Z0-9_-]{25,})/,
    file: /(?:file\/d\/|id=|\/d\/)([a-zA-Z0-9_-]{25,})/,
  };

  /**
   * Trích xuất Folder ID từ đường link bất kỳ
   */
  function extractFolderId(input) {
    if (!input) return null;
    const trimmed = input.trim();
    if (/^[a-zA-Z0-9_-]{25,}$/.test(trimmed)) {
      return trimmed;
    }
    const match = trimmed.match(PATTERNS.folder);
    return match ? match[1] : null;
  }

  /**
   * Trích xuất File ID từ link ảnh Google Drive
   */
  function extractFileId(input) {
    if (!input) return null;
    const trimmed = input.trim();
    if (/^[a-zA-Z0-9_-]{25,}$/.test(trimmed)) {
      return trimmed;
    }
    const match = trimmed.match(PATTERNS.file);
    return match ? match[1] : null;
  }

  /**
   * Tạo link CDN Google chất lượng cao
   * @param {string} fileId
   * @param {number|string} width - 'w600', 'w1200', 'w1920', 'w4000'
   */
  function getCdnUrl(fileId, width = 1200) {
    if (!fileId) return '';
    const sizeParam = typeof width === 'number' ? `w${width}` : width;
    return `https://lh3.googleusercontent.com/d/${fileId}=${sizeParam}`;
  }

  /**
   * Link dự phòng (Fallback qua Weserv Proxy hoặc Google uc)
   */
  function getFallbackUrl(fileId, width = 1000) {
    if (!fileId) return '';
    const rawGg = `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;
    return `https://images.weserv.nl/?url=${encodeURIComponent(rawGg)}`;
  }

  /**
   * Link tải trực tiếp từ Google Drive
   */
  function getDirectDownloadUrl(fileId) {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }

  /**
   * Phân tích nội dung textarea / input nhiều link Drive
   */
  function parseMultipleLinks(rawText) {
    if (!rawText) return [];
    const lines = rawText.split(/[\n,;]+/);
    const photos = [];
    let count = 1;

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const fileId = extractFileId(trimmed);
      if (fileId) {
        photos.push({
          id_photo: 'p_' + Math.random().toString(36).substr(2, 9),
          link_id: fileId,
          filename: `IMG_${String(count).padStart(4, '0')}.JPG`,
          selected: false,
          tim: false,
          in_anh: false,
          size_anh: '',
          note: '',
        });
        count++;
      }
    });
    return photos;
  }

  /**
   * Quét toàn bộ danh sách ảnh từ Folder Drive (Sử dụng Google Apps Script backend)
   */
  async function scanDriveFolder(input) {
    if (!input) return [];

    // Nếu dán danh sách nhiều file / link ảnh trực tiếp
    const directPhotos = parseMultipleLinks(input);
    if (directPhotos.length > 0 && directPhotos.length > 1) {
      return directPhotos;
    }

    const folderId = extractFolderId(input);
    if (!folderId) {
      // Nếu chỉ có 1 link ảnh đơn lẻ
      return directPhotos;
    }

    // Thử quét tự động qua Google Apps Script
    if (typeof SheetsSync !== 'undefined') {
      const scannedPhotos = await SheetsSync.scanFolderPhotos(folderId);
      if (scannedPhotos && Array.isArray(scannedPhotos) && scannedPhotos.length > 0) {
        return scannedPhotos;
      }
    }

    return directPhotos.length > 0 ? directPhotos : [];
  }

  return {
    extractFolderId,
    extractFileId,
    getCdnUrl,
    getFallbackUrl,
    getDirectDownloadUrl,
    parseMultipleLinks,
    scanDriveFolder,
  };
})();

// Export globally
window.DriveParser = DriveParser;
