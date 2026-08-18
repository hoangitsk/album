/**
 * PC File Sorter & Lightroom Export Tool
 * Sử dụng File System Access API để copy file trực tiếp trên ổ cứng
 * Hỗ trợ export danh sách tên file sang clipboard
 */

const PcSorter = (function () {
  let sourceDirHandle = null;
  let targetDirHandle = null;

  function log(msg) {
    const logEl = document.getElementById('pcSorterLog');
    if (logEl) {
      logEl.textContent += msg + '\n';
      logEl.scrollTop = logEl.scrollHeight;
    }
  }

  function getDirName(handle) {
    return handle && handle.name ? handle.name : 'Chưa chọn';
  }

  async function chooseSource() {
    try {
      sourceDirHandle = await window.showDirectoryPicker();
      const pathEl = document.getElementById('sourcePathDisplay');
      if (pathEl) {
        pathEl.textContent = '📁 ' + getDirName(sourceDirHandle);
        pathEl.style.display = 'block';
      }
      log(`✅ Đã chọn thư mục gốc: ${getDirName(sourceDirHandle)}`);
    } catch (err) {
      log('⚠️ Hủy chọn thư mục nguồn.');
    }
  }

  async function chooseTarget() {
    try {
      targetDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      const pathEl = document.getElementById('targetPathDisplay');
      if (pathEl) {
        pathEl.textContent = '📁 ' + getDirName(targetDirHandle);
        pathEl.style.display = 'block';
      }
      log(`✅ Đã chọn thư mục đích: ${getDirName(targetDirHandle)}`);
    } catch (err) {
      log('⚠️ Hủy chọn thư mục đích.');
    }
  }

  async function startCopyFiles() {
    if (!sourceDirHandle || !targetDirHandle) {
      alert('Vui lòng chọn cả thư mục nguồn và thư mục đích trên máy tính của bạn!');
      return;
    }

    const textarea = document.getElementById('pcSorterImageList');
    if (!textarea) return;

    const fileNames = textarea.value
      .split('\n')
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    if (fileNames.length === 0) {
      alert('Danh sách tên ảnh đang trống! Hãy chọn ảnh trước hoặc dán danh sách tên file vào ô.');
      return;
    }

    const startBtn = document.getElementById('btnStartPcCopy');
    if (startBtn) startBtn.disabled = true;

    const mode = document.querySelector('input[name="driveSpeedMode"]:checked')?.value || 'ssd';
    log(`🚀 Bắt đầu sao chép ${fileNames.length} file (Chế độ: ${mode.toUpperCase()})...`);

    const copySingleFile = async (name) => {
      try {
        const sourceFileHandle = await sourceDirHandle.getFileHandle(name);
        const file = await sourceFileHandle.getFile();
        const targetFileHandle = await targetDirHandle.getFileHandle(name, { create: true });
        const writable = await targetFileHandle.createWritable();
        await writable.write(await file.arrayBuffer());
        await writable.close();
        log(`✓ Đã sao chép: ${name}`);
      } catch (err) {
        log(`✗ Lỗi sao chép: ${name} (${err.message})`);
      }
    };

    if (mode === 'ssd') {
      await Promise.all(fileNames.map((name) => copySingleFile(name)));
    } else {
      const limit = 4;
      for (let i = 0; i < fileNames.length; i += limit) {
        const group = fileNames.slice(i, i + limit);
        await Promise.all(group.map((name) => copySingleFile(name)));
      }
    }

    log('🎉 Hoàn tất sao chép tất cả file vào thư mục đích!');
    if (startBtn) startBtn.disabled = false;
  }

  function copyToClipboard(text, successMsg = 'Đã sao chép vào Clipboard!') {
    if (!navigator.clipboard) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    } else {
      navigator.clipboard.writeText(text);
    }
    window.App?.showToast(successMsg, 'success');
  }

  return {
    chooseSource,
    chooseTarget,
    startCopyFiles,
    copyToClipboard,
  };
})();

window.PcSorter = PcSorter;
