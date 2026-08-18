/**
 * Gallery Controller - Masonry Grid, Watermark, Tương tác chọn ảnh & Bộ lọc Chips
 */

const Gallery = (function () {
  let currentAlbum = null;
  let currentFilter = 'all'; // 'all', 'selected', 'favorite', 'print', 'note'
  let masonryInstance = null;
  let sharedWatermarkUrl = null;
  let debouncedLayoutTimer = null;

  function init(album) {
    currentAlbum = album;
    currentFilter = 'all';
    sharedWatermarkUrl = null;

    generateSharedWatermark();
    renderHeroBanner();
    renderGalleryGrid();
    updateFilterCounts();
  }

  /**
   * Tạo bản mẫu Watermark 1 lần duy nhất cho toàn album (Tiết kiệm 99% RAM)
   */
  function generateSharedWatermark() {
    if (!currentAlbum?.watermark) {
      sharedWatermarkUrl = null;
      return;
    }

    const canvas = document.createElement('canvas');
    const size = 1200;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const fontSize = size / 24;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.translate(size / 2, size / 2);
    ctx.rotate(-Math.PI / 6);

    const spacingX = fontSize * 9;
    const spacingY = fontSize * 3.8;

    for (let y = -size; y < size; y += spacingY) {
      for (let x = -size; x < size; x += spacingX) {
        ctx.fillText(currentAlbum.watermark, x, y);
      }
    }

    sharedWatermarkUrl = canvas.toDataURL('image/png');
  }

  function renderHeroBanner() {
    const coverEl = document.getElementById('albumHeroCover');
    const titleEl = document.getElementById('albumHeroTitle');
    const studioNameEl = document.getElementById('albumHeroStudioName');

    if (titleEl) titleEl.textContent = currentAlbum.title;
    if (studioNameEl) studioNameEl.textContent = currentAlbum.author || 'Harlan - Minh Hoàng';

    if (coverEl) {
      const coverPhoto = currentAlbum.photos.find((p) => p.link_id === currentAlbum.cover_id) || currentAlbum.photos[0];
      if (coverPhoto) {
        const coverUrl = DriveParser.getCdnUrl(coverPhoto.link_id, 4000);
        coverEl.style.backgroundImage = `url('${coverUrl}')`;
      }
    }
  }

  function renderGalleryGrid() {
    const grid = document.getElementById('masonryGridWrap');
    if (!grid) return;

    grid.innerHTML = '<div class="grid-sizer"></div>';

    // Lọc theo filter hiện tại
    let filteredPhotos = currentAlbum.photos;
    if (currentFilter === 'selected') {
      filteredPhotos = currentAlbum.photos.filter((p) => p.selected);
    } else if (currentFilter === 'favorite') {
      filteredPhotos = currentAlbum.photos.filter((p) => p.tim);
    } else if (currentFilter === 'print') {
      filteredPhotos = currentAlbum.photos.filter((p) => p.in_anh);
    } else if (currentFilter === 'note') {
      filteredPhotos = currentAlbum.photos.filter((p) => p.note && p.note.trim().length > 0);
    }

    if (filteredPhotos.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-state-box';
      emptyDiv.innerHTML = `
        <i class="bi bi-images empty-state-icon"></i>
        <h3>Không có ảnh nào trong mục này</h3>
        <p class="text-muted">Hãy chọn các ảnh khác hoặc quay lại bộ lọc Tất cả.</p>
        <button class="btn-modern btn-primary-glow mt-3" onclick="Gallery.setFilter('all')">Xem tất cả ảnh</button>
      `;
      grid.appendChild(emptyDiv);
      return;
    }

    filteredPhotos.forEach((photo) => {
      const globalIndex = currentAlbum.photos.indexOf(photo);
      const itemDiv = document.createElement('div');
      itemDiv.className = 'grid-item';
      itemDiv.id = `gridItem_${photo.id_photo}`;

      const thumbUrl = DriveParser.getCdnUrl(photo.link_id, 600);
      const fallbackUrl = DriveParser.getFallbackUrl(photo.link_id, 600);

      itemDiv.innerHTML = `
        <div class="photo-card-item">
          <div class="wm-image-wrapper" onclick="Lightbox.open(window.Gallery.getCurrentAlbum().photos, ${globalIndex}, '${currentAlbum.watermark || ''}')">
            <img 
              data-src="${thumbUrl}"
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 4'%3E%3C/svg%3E" 
              alt="${photo.filename || 'Photo'}" 
              class="gallery-photo-img lazy-img"
              onerror="
                this.classList.add('loaded');
                if(!this._attempt1) {
                  this._attempt1 = true;
                  this.src = '${fallbackUrl}';
                }
              "
            />
            ${sharedWatermarkUrl ? `<div class="wm-canvas-layer" style="background-image:url(${sharedWatermarkUrl});background-size:cover;background-position:center;"></div>` : ''}
          </div>

          <!-- Actions Toolbar -->
          <div class="photo-action-bar" onclick="event.stopPropagation()">
            <button class="p-action-btn ${photo.selected ? 'active-select' : ''}" 
              onclick="Gallery.toggleSelect('${photo.id_photo}')" title="Chọn ảnh">
              <i class="bi ${photo.selected ? 'bi-check-circle-fill' : 'bi-check-circle'}"></i>
            </button>
            <button class="p-action-btn ${photo.tim ? 'active-favorite' : ''}" 
              onclick="Gallery.toggleFavorite('${photo.id_photo}')" title="Yêu thích">
              <i class="bi ${photo.tim ? 'bi-heart-fill' : 'bi-heart'}"></i>
            </button>
            <div style="position:relative;">
              <button class="p-action-btn ${photo.in_anh ? 'active-print' : ''}" 
                onclick="Gallery.togglePrintDropdown('${photo.id_photo}', event)" title="Chọn kích cỡ in">
                <i class="bi bi-printer"></i>
              </button>
              <div class="print-dropdown-menu" id="printMenu_${photo.id_photo}">
                <a class="print-size-item text-danger" href="javascript:void(0)" onclick="Gallery.setPrintSize('${photo.id_photo}', '')">Bỏ chọn in</a>
                ${['13x18', '15x21', '20x30', '30x45', '40x60', '50x75', '60x90', '70x110']
                  .map((size) => `<a class="print-size-item" href="javascript:void(0)" onclick="Gallery.setPrintSize('${photo.id_photo}', '${size}')">${size} cm</a>`)
                  .join('')}
              </div>
            </div>
            <button class="p-action-btn ${photo.note ? 'active-note' : ''}" 
              onclick="Gallery.openNoteModalById('${photo.id_photo}')" title="Ghi chú chỉnh sửa">
              <i class="bi bi-chat-left-dots"></i>
            </button>
          </div>

          <!-- Cover Badge -->
          <div class="cover-badge-action" onclick="event.stopPropagation()">
            <button class="p-action-btn" onclick="Gallery.setAsCover('${photo.link_id}')" title="Đặt làm ảnh bìa Album">
              <i class="bi ${currentAlbum.cover_id === photo.link_id ? 'bi-image-fill text-warning' : 'bi-image'}"></i>
            </button>
          </div>

          ${photo.note ? `<div class="card-note-tag" title="${photo.note}"><i class="bi bi-chat-text-fill"></i> ${photo.note}</div>` : ''}
        </div>
      `;

      grid.appendChild(itemDiv);
    });

    initLazyLoading();
    rebuildMasonry();
  }

  function initLazyLoading() {
    const lazyImages = document.querySelectorAll('.gallery-photo-img.lazy-img:not([data-loaded])');

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target;
            const src = img.getAttribute('data-src');
            if (src) {
              img.src = src;
              img.onload = () => {
                img.classList.add('loaded');
                img.setAttribute('data-loaded', 'true');
                triggerDebouncedLayout();
              };
            }
            obs.unobserve(img);
          }
        });
      }, { rootMargin: '300px' });

      lazyImages.forEach((img) => observer.observe(img));
    } else {
      lazyImages.forEach((img) => {
        img.src = img.getAttribute('data-src');
        img.classList.add('loaded');
      });
    }
  }

  function rebuildMasonry() {
    if (typeof Masonry === 'undefined') return;

    setTimeout(() => {
      const grid = document.getElementById('masonryGridWrap');
      if (!grid) return;

      if (masonryInstance) {
        masonryInstance.destroy();
      }

      masonryInstance = new Masonry(grid, {
        itemSelector: '.grid-item',
        columnWidth: '.grid-sizer',
        percentPosition: true,
        transitionDuration: '0.2s',
      });

      if (typeof imagesLoaded !== 'undefined') {
        imagesLoaded(grid).on('progress', () => {
          if (masonryInstance) masonryInstance.layout();
        });
      }
    }, 100);
  }

  function triggerDebouncedLayout() {
    clearTimeout(debouncedLayoutTimer);
    debouncedLayoutTimer = setTimeout(() => {
      if (masonryInstance) masonryInstance.layout();
    }, 200);
  }

  function updateFilterCounts() {
    if (!currentAlbum) return;

    const total = currentAlbum.photos.length;
    const selected = currentAlbum.photos.filter((p) => p.selected).length;
    const favorite = currentAlbum.photos.filter((p) => p.tim).length;
    const print = currentAlbum.photos.filter((p) => p.in_anh).length;
    const note = currentAlbum.photos.filter((p) => p.note && p.note.trim().length > 0).length;

    const totalBadge = document.getElementById('badgeCountTotal');
    const selectedBadge = document.getElementById('badgeCountSelected');
    const favBadge = document.getElementById('badgeCountFavorite');
    const printBadge = document.getElementById('badgeCountPrint');
    const noteBadge = document.getElementById('badgeCountNote');

    if (totalBadge) totalBadge.textContent = total;
    if (selectedBadge) selectedBadge.textContent = selected;
    if (favBadge) favBadge.textContent = favorite;
    if (printBadge) printBadge.textContent = print;
    if (noteBadge) noteBadge.textContent = note;
  }

  function setFilter(filterType) {
    currentFilter = filterType;
    document.querySelectorAll('.chip-filter-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-filter') === filterType);
    });
    renderGalleryGrid();
  }

  function toggleSelect(idPhoto) {
    const photo = currentAlbum.photos.find((p) => p.id_photo === idPhoto);
    if (!photo) return;
    photo.selected = !photo.selected;
    saveAndRefreshCard(photo);
  }

  function toggleFavorite(idPhoto) {
    const photo = currentAlbum.photos.find((p) => p.id_photo === idPhoto);
    if (!photo) return;
    photo.tim = !photo.tim;
    saveAndRefreshCard(photo);
  }

  function togglePrintDropdown(idPhoto, e) {
    e.stopPropagation();
    document.querySelectorAll('.print-dropdown-menu').forEach((m) => m.classList.remove('show'));
    const menu = document.getElementById(`printMenu_${idPhoto}`);
    if (menu) menu.classList.toggle('show');
  }

  function setPrintSize(idPhoto, size) {
    const photo = currentAlbum.photos.find((p) => p.id_photo === idPhoto);
    if (!photo) return;
    photo.in_anh = Boolean(size);
    photo.size_anh = size;
    document.querySelectorAll('.print-dropdown-menu').forEach((m) => m.classList.remove('show'));
    saveAndRefreshCard(photo);
    window.App?.showToast(size ? `Đã chọn in kích cỡ: ${size} cm` : 'Đã bỏ chọn in ảnh', 'info');
  }

  function setAsCover(linkId) {
    currentAlbum.cover_id = linkId;
    window.App?.saveAlbum(currentAlbum);
    renderHeroBanner();
    renderGalleryGrid();
    window.App?.showToast('Đã đổi ảnh bìa Album thành công!', 'success');
  }

  function openNoteModalById(idPhoto) {
    const photo = currentAlbum.photos.find((p) => p.id_photo === idPhoto);
    if (photo) openNoteModal(photo);
  }

  function openNoteModal(photo) {
    const modal = document.getElementById('noteEditorModal');
    const textarea = document.getElementById('noteEditorTextarea');
    const idInput = document.getElementById('noteEditorPhotoId');

    if (modal && textarea && idInput) {
      idInput.value = photo.id_photo;
      textarea.value = photo.note || '';
      modal.classList.add('open');
      setTimeout(() => textarea.focus(), 150);
    }
  }

  function saveNote() {
    const modal = document.getElementById('noteEditorModal');
    const textarea = document.getElementById('noteEditorTextarea');
    const idInput = document.getElementById('noteEditorPhotoId');

    if (!idInput || !textarea) return;
    const photo = currentAlbum.photos.find((p) => p.id_photo === idInput.value);
    if (photo) {
      photo.note = textarea.value.trim();
      saveAndRefreshCard(photo);
      window.App?.showToast('Đã lưu ghi chú ảnh!', 'success');
    }
    if (modal) modal.classList.remove('open');
  }

  function updatePhotoState(photo) {
    saveAndRefreshCard(photo);
  }

  function saveAndRefreshCard(photo) {
    window.App?.saveAlbum(currentAlbum);
    updateFilterCounts();

    // Nếu đang lọc theo danh mục mà trạng thái thay đổi không còn phù hợp, render lại grid
    if (currentFilter !== 'all') {
      renderGalleryGrid();
    } else {
      // Cập nhật DOM cụ thể
      const itemEl = document.getElementById(`gridItem_${photo.id_photo}`);
      if (itemEl) {
        const btnSelect = itemEl.querySelector('.p-action-btn:nth-child(1)');
        const btnFav = itemEl.querySelector('.p-action-btn:nth-child(2)');
        const btnPrint = itemEl.querySelector('.p-action-btn:nth-child(3)');
        const btnNote = itemEl.querySelector('.p-action-btn:nth-child(4)');

        if (btnSelect) {
          btnSelect.className = `p-action-btn ${photo.selected ? 'active-select' : ''}`;
          btnSelect.innerHTML = `<i class="bi ${photo.selected ? 'bi-check-circle-fill' : 'bi-check-circle'}"></i>`;
        }
        if (btnFav) {
          btnFav.className = `p-action-btn ${photo.tim ? 'active-favorite' : ''}`;
          btnFav.innerHTML = `<i class="bi ${photo.tim ? 'bi-heart-fill' : 'bi-heart'}"></i>`;
        }
        if (btnPrint) {
          btnPrint.className = `p-action-btn ${photo.in_anh ? 'active-print' : ''}`;
        }
        if (btnNote) {
          btnNote.className = `p-action-btn ${photo.note ? 'active-note' : ''}`;
        }

        // Cập nhật note badge
        let noteTag = itemEl.querySelector('.card-note-tag');
        if (photo.note) {
          if (!noteTag) {
            noteTag = document.createElement('div');
            noteTag.className = 'card-note-tag';
            itemEl.querySelector('.photo-card-item').appendChild(noteTag);
          }
          noteTag.innerHTML = `<i class="bi bi-chat-text-fill"></i> ${photo.note}`;
          noteTag.title = photo.note;
        } else if (noteTag) {
          noteTag.remove();
        }
      }
    }
  }

  function resetSelections(type) {
    if (!currentAlbum) return;

    if (currentAlbum.password_selected) {
      const pass = prompt('Vui lòng nhập mật khẩu chọn hình để xác nhận reset:');
      if (pass !== currentAlbum.password_selected) {
        alert('Mật khẩu không chính xác!');
        return;
      }
    }

    currentAlbum.photos.forEach((p) => {
      if (type === '1') p.selected = false;
      else if (type === '3') p.tim = false;
      else if (type === '2') { p.in_anh = false; p.size_anh = ''; }
      else if (type === '4') p.note = '';
      else if (type === 'all') {
        p.selected = false;
        p.tim = false;
        p.in_anh = false;
        p.size_anh = '';
        p.note = '';
      }
    });

    window.App?.saveAlbum(currentAlbum);
    renderGalleryGrid();
    updateFilterCounts();
    window.App?.showToast('Đã reset danh sách thành công!', 'success');
  }

  function exportFilenames(type) {
    if (!currentAlbum) return;
    let list = [];
    if (type === '1') list = currentAlbum.photos.filter((p) => p.selected);
    else if (type === '3') list = currentAlbum.photos.filter((p) => p.tim);
    else if (type === '2') list = currentAlbum.photos.filter((p) => p.in_anh);
    else if (type === '4') list = currentAlbum.photos.filter((p) => p.note);
    else list = currentAlbum.photos;

    const names = list.map((p) => p.filename || `IMG_${p.link_id.substr(0, 6)}.JPG`).join('\n');
    
    // Đổ vào modal PC Sorter
    const textarea = document.getElementById('pcSorterImageList');
    if (textarea) textarea.value = names;

    const modal = document.getElementById('pcSorterModal');
    if (modal) modal.classList.add('open');
  }

  return {
    init,
    getCurrentAlbum: () => currentAlbum,
    setFilter,
    toggleSelect,
    toggleFavorite,
    togglePrintDropdown,
    setPrintSize,
    setAsCover,
    openNoteModalById,
    openNoteModal,
    saveNote,
    updatePhotoState,
    resetSelections,
    exportFilenames,
  };
})();

window.Gallery = Gallery;

// Đóng dropdown khi click ra ngoài
document.addEventListener('click', () => {
  document.querySelectorAll('.print-dropdown-menu').forEach((m) => m.classList.remove('show'));
});
