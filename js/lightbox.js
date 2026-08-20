/**
 * Lightbox Pro - Trình xem ảnh toàn màn hình chất lượng cao
 * Hỗ trợ zoom, vuốt cảm ứng mobile, phím tắt, watermark và thao tác nhanh
 */

const Lightbox = (function () {
  let currentIndex = 0;
  let photosList = [];
  let currentWatermark = '';

  const modalEl = () => document.getElementById('lightboxModal');
  const imgEl = () => document.getElementById('lightboxMainImg');
  const canvasEl = () => document.getElementById('lightboxWmCanvas');
  const counterEl = () => document.getElementById('lightboxCounter');

  function open(photos, index, watermark = '') {
    photosList = photos || [];
    currentIndex = index || 0;
    currentWatermark = watermark || '';

    const modal = modalEl();
    if (!modal) return;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    renderCurrentPhoto();
    setupKeyboardListeners();
    setupTouchListeners();
  }

  function close() {
    const modal = modalEl();
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
    removeKeyboardListeners();
  }

  function next() {
    if (currentIndex < photosList.length - 1) {
      currentIndex++;
      renderCurrentPhoto();
    } else {
      currentIndex = 0;
      renderCurrentPhoto();
    }
  }

  function prev() {
    if (currentIndex > 0) {
      currentIndex--;
      renderCurrentPhoto();
    } else {
      currentIndex = photosList.length - 1;
      renderCurrentPhoto();
    }
  }

  function renderCurrentPhoto() {
    const photo = photosList[currentIndex];
    if (!photo) return;

    const img = imgEl();
    const counter = counterEl();

    if (counter) {
      counter.textContent = `${currentIndex + 1} / ${photosList.length} • ${photo.filename || 'Ảnh'}`;
    }

    if (img) {
      img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"%3E%3C/svg%3E';
      const cdnUrl = DriveParser.getCdnUrl(photo.link_id, 1920);
      const fallbackUrl1 = DriveParser.getFallbackUrl(photo.link_id, 1600);
      const fallbackUrl2 = DriveParser.getWeservCdnUrl(photo.link_id, 1600);

      const highRes = new Image();
      highRes.onload = () => {
        img.src = cdnUrl;
        drawWatermark();
      };
      highRes.onerror = () => {
        const fallbackImg = new Image();
        fallbackImg.onload = () => {
          img.src = fallbackUrl1;
          drawWatermark();
        };
        fallbackImg.onerror = () => {
          img.src = fallbackUrl2;
          drawWatermark();
        };
        fallbackImg.src = fallbackUrl1;
      };
      highRes.src = cdnUrl;
    }

    updateActionStates(photo);
  }

  function updateActionStates(photo) {
    const btnSelect = document.getElementById('lbBtnSelect');
    const btnFav = document.getElementById('lbBtnFavorite');
    const btnPrint = document.getElementById('lbBtnPrint');
    const btnNote = document.getElementById('lbBtnNote');

    if (btnSelect) {
      btnSelect.className = `btn-modern btn-glass ${photo.selected ? 'active-select' : ''}`;
      btnSelect.innerHTML = `<i class="bi ${photo.selected ? 'bi-check-circle-fill' : 'bi-check-circle'}"></i> ${photo.selected ? 'Đã chọn' : 'Chọn ảnh'}`;
    }
    if (btnFav) {
      btnFav.className = `btn-modern btn-glass ${photo.tim ? 'active-favorite' : ''}`;
      btnFav.innerHTML = `<i class="bi ${photo.tim ? 'bi-heart-fill' : 'bi-heart'}"></i> ${photo.tim ? 'Đã thích' : 'Yêu thích'}`;
    }
    if (btnPrint) {
      btnPrint.className = `btn-modern btn-glass ${photo.in_anh ? 'active-print' : ''}`;
      btnPrint.innerHTML = `<i class="bi bi-printer"></i> ${photo.size_anh || 'In ảnh'}`;
    }
    if (btnNote) {
      btnNote.className = `btn-modern btn-glass ${photo.note ? 'active-note' : ''}`;
      btnNote.innerHTML = `<i class="bi bi-chat-left-dots"></i> ${photo.note ? 'Xem ghi chú' : 'Ghi chú'}`;
    }
  }

  function drawWatermark() {
    const img = imgEl();
    const canvas = canvasEl();
    if (!img || !canvas || !currentWatermark) {
      if (canvas) canvas.style.display = 'none';
      return;
    }

    canvas.style.display = 'block';
    const rect = img.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.save();

    const fontSize = 28 / dpr;
    const spacingX = 350 / dpr;
    const spacingY = 140 / dpr;

    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.translate(rect.width / 2, rect.height / 2);
    ctx.rotate(-Math.PI / 6);

    for (let y = -rect.height; y < rect.height; y += spacingY) {
      for (let x = -rect.width; x < rect.width; x += spacingX) {
        ctx.fillText(currentWatermark, x, y);
      }
    }
    ctx.restore();
  }

  function handleKeydown(e) {
    if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') prev();
    else if (e.key === 'Escape') close();
  }

  function setupKeyboardListeners() {
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('resize', drawWatermark);
  }

  function removeKeyboardListeners() {
    window.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('resize', drawWatermark);
  }

  let touchStartX = 0;
  function setupTouchListeners() {
    const wrap = document.getElementById('lightboxContentWrap');
    if (!wrap) return;

    wrap.ontouchstart = (e) => {
      touchStartX = e.changedTouches[0].screenX;
    };
    wrap.ontouchend = (e) => {
      const touchEndX = e.changedTouches[0].screenX;
      if (touchStartX - touchEndX > 50) next();
      if (touchEndX - touchStartX > 50) prev();
    };
  }

  // Thao tác trực tiếp từ Lightbox
  function toggleCurrentSelect() {
    const photo = photosList[currentIndex];
    if (!photo) return;
    photo.selected = !photo.selected;
    updateActionStates(photo);
    window.Gallery?.updatePhotoState(photo);
  }

  function toggleCurrentFavorite() {
    const photo = photosList[currentIndex];
    if (!photo) return;
    photo.tim = !photo.tim;
    updateActionStates(photo);
    window.Gallery?.updatePhotoState(photo);
  }

  function toggleCurrentNote() {
    const photo = photosList[currentIndex];
    if (!photo) return;
    window.Gallery?.openNoteModal(photo);
  }

  function downloadCurrentPhoto() {
    const photo = photosList[currentIndex];
    if (!photo) return;
    const url = DriveParser.getCdnUrl(photo.link_id, 2400);
    const a = document.createElement('a');
    a.href = url;
    a.download = photo.filename || 'photo.jpg';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return {
    open,
    close,
    next,
    prev,
    toggleCurrentSelect,
    toggleCurrentFavorite,
    toggleCurrentNote,
    downloadCurrentPhoto,
  };
})();

window.Lightbox = Lightbox;
