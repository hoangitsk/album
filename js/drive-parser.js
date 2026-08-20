/**
 * Google Drive URL Parser & Image Resolver
 * Hỗ trợ trích xuất Folder ID, File ID, tạo link CDN chất lượng cao và fallback đa tầng
 * Chuẩn luồng hoạt động tối ưu tốc độ và chống chặn CORS
 */

const DriveParser = (function () {
  // Regex pattern cho Google Drive link
  const PATTERNS = {
    folder: /(?:folders\/|id=|open\?id=|\/folders\/)([a-zA-Z0-9_-]{25,})/,
    file: /(?:file\/d\/|id=|\/d\/|open\?id=|thumbnail\?id=)([a-zA-Z0-9_-]{25,})/,
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
   * Lớp 1: Link Google CDN trực tiếp (Tốc độ cao nhất)
   * @param {string} fileId
   * @param {number|string} width - 601 (grid), 1920 (lightbox), 4000 (cover)
   */
  function getCdnUrl(fileId, width = 601) {
    if (!fileId) return '';
    const sizeParam = typeof width === 'number' ? `w${width}` : width;
    return `https://lh3.googleusercontent.com/d/${fileId}=${sizeParam}`;
  }

  /**
   * Lớp 2: Link dự phòng qua Weserv Proxy (Drive Thumbnail)
   */
  function getFallbackUrl(fileId, width = 601) {
    if (!fileId) return '';
    const rawGg = `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;
    return `https://images.weserv.nl/?url=${encodeURIComponent(rawGg)}`;
  }

  /**
   * Lớp 2 phụ: Link dự phòng qua Weserv Proxy (Google CDN)
   */
  function getWeservCdnUrl(fileId, width = 601) {
    if (!fileId) return '';
    const directCdn = `https://lh3.googleusercontent.com/d/${fileId}=w${width}`;
    return `https://images.weserv.nl/?url=${encodeURIComponent(directCdn)}`;
  }

  /**
   * Link tải trực tiếp từ Google Drive
   */
  function getDirectDownloadUrl(fileId) {
    if (!fileId) return '';
    return `https://drive.usercontent.google.com/u/0/uc?id=${fileId}&export=download`;
  }

  /**
   * Link tải fallback từ Google Drive
   */
  function getDriveDownloadUrl(fileId) {
    if (!fileId) return '';
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }

  /**
   * Link mở thư mục Drive
   */
  function getFolderUrl(folderIdOrLink) {
    if (!folderIdOrLink) return 'https://drive.google.com';
    const folderId = extractFolderId(folderIdOrLink);
    return folderId ? `https://drive.google.com/drive/folders/${folderId}` : folderIdOrLink;
  }

  /**
   * Phân tích nội dung textarea / input nhiều link Drive hoặc danh sách file
   */
  function parseMultipleLinks(rawText) {
    if (!rawText) return [];
    const lines = rawText.split(/[\r\n,;]+/);
    const photos = [];
    let count = 1;

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      
      // Kiểm tra xem có định dạng "Tên_file.jpg https://drive.google.com/..." hoặc "Tên_file.jpg, FileID"
      const fileId = extractFileId(trimmed);
      if (fileId) {
        // Tìm filename nếu có trong dòng
        const nameMatch = trimmed.match(/([a-zA-Z0-9_\-\s]+\.(?:jpe?g|png|webp|heic|cr2|cr3|nef|arw|dng|raf|tif|tiff))/i);
        const filename = nameMatch ? nameMatch[1].trim() : `IMG_${String(count).padStart(4, '0')}.JPG`;

        photos.push({
          id_photo: 'p_' + Math.random().toString(36).substr(2, 9),
          link_id: fileId,
          filename: filename,
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
    if (directPhotos.length > 1) {
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
    getWeservCdnUrl,
    getDirectDownloadUrl,
    getDriveDownloadUrl,
    getFolderUrl,
    parseMultipleLinks,
    scanDriveFolder,
  };
})();

// Export globally
window.DriveParser = DriveParser;
