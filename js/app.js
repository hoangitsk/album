/**
 * Web Album Pro - Main Application Controller
 * Quản lý điều hướng SPA, Phân quyền Album theo Tài Khoản, Mã Album Độc Nhất & Truy Cập Không Cần Đăng Nhập
 */

const App = (function () {
  const STORAGE_KEY = 'web_album_harlan_v2';
  let albums = [];
  let currentAlbumId = null;

  // Dữ liệu ban đầu rỗng để người dùng tự do tạo Album mới
  const SAMPLE_ALBUMS = [];

  function generateAlbumCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Đảm bảo không trùng mã đã có
    if (albums.some((a) => a.code === code)) {
      return generateAlbumCode();
    }
    return code;
  }

  function init() {
    loadAlbumsFromStorage();
    checkUrlQueryParams();
    setupRouting();
    renderDashboard();

    // Tự động đồng bộ từ Google Sheets khi khởi chạy
    syncWithCloudAtStartup();
  }

  function checkUrlQueryParams() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const codeParam = urlParams.get('code') || urlParams.get('album');
      if (codeParam) {
        window.location.hash = `#album/${codeParam}`;
      }
    } catch (e) {}
  }

  function loadAlbumsFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        albums = JSON.parse(data);
        // Đảm bảo mọi album đều có mã code
        let hasChanges = false;
        albums.forEach((alb) => {
          if (!alb.code) {
            alb.code = (alb.id && alb.id.length <= 8) ? alb.id.toUpperCase() : generateAlbumCode();
            hasChanges = true;
          }
        });
        if (hasChanges) saveToStorage();
      } else {
        albums = [];
        saveToStorage();
      }
    } catch (e) {
      albums = [];
    }
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(albums));
    } catch (e) {
      console.error('Lỗi lưu LocalStorage:', e);
    }
  }

  async function syncWithCloudAtStartup() {
    if (typeof SheetsSync === 'undefined') return;
    const cloudAlbums = await SheetsSync.fetchAlbumsFromCloud();
    if (cloudAlbums && Array.isArray(cloudAlbums) && cloudAlbums.length > 0) {
      cloudAlbums.forEach((cloudAlb) => {
        if (!cloudAlb.code) {
          cloudAlb.code = (cloudAlb.id && cloudAlb.id.length <= 8) ? cloudAlb.id.toUpperCase() : generateAlbumCode();
        }
        const idx = albums.findIndex((a) => a.id === cloudAlb.id || (a.code && a.code === cloudAlb.code));
        if (idx !== -1) {
          albums[idx] = cloudAlb;
        } else {
          albums.push(cloudAlb);
        }
      });
      saveToStorage();
      renderDashboard();
    }
  }

  function saveAlbum(album) {
    const idx = albums.findIndex((a) => a.id === album.id);
    if (idx !== -1) {
      albums[idx] = album;
    } else {
      albums.unshift(album);
    }
    saveToStorage();
    updateDashboardStats();

    // 🔴 Tự động đồng bộ lên Google Sheets
    if (typeof SheetsSync !== 'undefined') {
      SheetsSync.syncAlbumToCloud(album);
    }
  }

  function deleteAlbum(id) {
    if (typeof Auth !== 'undefined' && !Auth.isAuthenticated()) {
      Auth.requireAuth(() => deleteAlbum(id));
      return;
    }
    if (confirm('Bạn có chắc chắn muốn xóa album này không?')) {
      albums = albums.filter((a) => a.id !== id);
      saveToStorage();
      renderDashboard();
      showToast('Đã xóa album thành công!', 'info');
    }
  }

  /* ==========================================================================
     SPA ROUTER & TÌM KIẾM THEO MÃ HOẶC ID
     ========================================================================== */
  function setupRouting() {
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
  }

  function handleRoute() {
    const hash = window.location.hash || '#dashboard';

    document.querySelectorAll('.view-container').forEach((el) => el.classList.remove('active'));

    if (hash.startsWith('#album/') || hash.startsWith('#code/')) {
      const albumIdOrCode = hash.replace(/^#(album|code)\//, '').trim();
      openAlbumView(albumIdOrCode);
    } else {
      // Dashboard View
      const dashView = document.getElementById('dashboardView');
      if (dashView) dashView.classList.add('active');
      renderDashboard();
      window.scrollTo(0, 0);
    }
  }

  function navigateTo(hash) {
    window.location.hash = hash;
  }

  /**
   * Khách nhập mã album hoặc dán link -> Mở xem album ngay lập tức
   */
  function searchAndOpenAlbum(rawInput) {
    let input = (rawInput || '').trim();
    if (!input) {
      const inputEl = document.getElementById('inputQuickAlbumCode') || document.getElementById('navSearchAlbumCode');
      if (inputEl) input = inputEl.value.trim();
    }

    if (!input) {
      showToast('Vui lòng nhập Mã Album để xem ảnh!', 'warning');
      return;
    }

    // Nếu khách dán nguyên link URL chứa #album/xxx hoặc #code/xxx
    if (input.includes('#album/')) {
      input = input.split('#album/')[1].split('&')[0].split('?')[0];
    } else if (input.includes('#code/')) {
      input = input.split('#code/')[1].split('&')[0].split('?')[0];
    } else if (input.includes('code=')) {
      const match = input.match(/code=([^&]+)/);
      if (match) input = match[1];
    }

    input = input.trim();
    navigateTo(`#album/${input}`);
  }

  /* ==========================================================================
     DASHBOARD RENDERER (Phân Quyền Theo Tài Khoản & Giao Diện Khách)
     ========================================================================== */
  function renderDashboard() {
    updateDashboardStats();
    renderHeroBanner();
    renderAlbumCards();
  }

  function renderHeroBanner() {
    const user = typeof Auth !== 'undefined' ? Auth.getCurrentUser() : null;
    const studioMetaEl = document.querySelector('.studio-meta');

    if (!studioMetaEl) return;

    if (user) {
      // Đã đăng nhập: Giao diện Studio Admin
      studioMetaEl.innerHTML = `
        <h1>${user.displayName || 'Harlan - Minh Hoàng'}</h1>
        <div class="studio-subtitle">
          <span><i class="bi bi-camera-fill text-primary"></i> Studio: <b>${user.displayName || 'Harlan - Minh Hoàng'}</b></span>
          <span>•</span>
          <span><i class="bi bi-telephone-fill text-success"></i> Hotline / Zalo: <a href="https://zalo.me/0337957054" target="_blank" class="text-white fw-bold text-decoration-none">0337957054</a></span>
          <span>•</span>
          <span><i class="bi bi-shield-check text-success"></i> Quyền Quản Trị</span>
        </div>
      `;

      // Cập nhật avatar
      const studioAvatar = document.querySelector('.studio-avatar');
      if (studioAvatar) {
        studioAvatar.src = user.photoURL || './assets/default_avatar.png';
      }
    } else {
      // Chưa đăng nhập: Giao diện chào đón Khách Hàng
      studioMetaEl.innerHTML = `
        <h1>Harlan - Minh Hoàng</h1>
        <div class="studio-subtitle">
          <span><i class="bi bi-camera-fill text-primary"></i> Nhiếp ảnh gia chuyên nghiệp</span>
          <span>•</span>
          <span><i class="bi bi-telephone-fill text-success"></i> Hotline / Zalo: <a href="https://zalo.me/0337957054" target="_blank" class="text-white fw-bold text-decoration-none">0337957054</a></span>
          <span>•</span>
          <span><i class="bi bi-unlock-fill text-warning"></i> Xem & chọn ảnh tự do không cần đăng nhập</span>
        </div>
      `;
    }
  }

  function updateDashboardStats() {
    const user = typeof Auth !== 'undefined' ? Auth.getCurrentUser() : null;
    
    // Nếu đăng nhập -> Lọc album của tài khoản đó. Nếu chưa đăng nhập -> Thống kê chung
    const userAlbums = user
      ? albums.filter((a) => a.owner_uid === user.uid || (user.email && a.owner_email === user.email))
      : albums;

    const totalAlbums = userAlbums.length;
    let totalPhotos = 0;
    let totalSelected = 0;
    let totalFavorites = 0;

    userAlbums.forEach((album) => {
      totalPhotos += (album.photos || []).length;
      totalSelected += (album.photos || []).filter((p) => p.selected).length;
      totalFavorites += (album.photos || []).filter((p) => p.tim).length;
    });

    const elTotalAlbums = document.getElementById('statTotalAlbums');
    const elTotalPhotos = document.getElementById('statTotalPhotos');
    const elTotalSelected = document.getElementById('statTotalSelected');
    const elTotalFavorites = document.getElementById('statTotalFavorites');

    if (elTotalAlbums) elTotalAlbums.textContent = totalAlbums;
    if (elTotalPhotos) elTotalPhotos.textContent = totalPhotos;
    if (elTotalSelected) elTotalSelected.textContent = totalSelected;
    if (elTotalFavorites) elTotalFavorites.textContent = totalFavorites;
  }

  function renderAlbumCards(filterStatus = 'all', searchQuery = '') {
    const grid = document.getElementById('dashboardAlbumGrid');
    if (!grid) return;

    const user = typeof Auth !== 'undefined' ? Auth.getCurrentUser() : null;

    // Phân quyền hiển thị:
    // - Khi đã đăng nhập: CHỈ hiển thị các album do chính tài khoản đó tạo
    // - Khi chưa đăng nhập (Khách): Hiển thị các album Public
    let userAlbums = [];
    if (user) {
      userAlbums = albums.filter((a) => a.owner_uid === user.uid || (user.email && a.owner_email === user.email));
    } else {
      userAlbums = albums.filter((a) => a.status === '0' || !a.owner_uid || a.owner_uid === 'sample_owner');
    }

    let filtered = [...userAlbums];
    if (filterStatus === 'public') {
      filtered = filtered.filter((a) => a.status === '0');
    } else if (filterStatus === 'private') {
      filtered = filtered.filter((a) => a.status !== '0');
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((a) => 
        (a.title && a.title.toLowerCase().includes(query)) ||
        (a.code && a.code.toLowerCase().includes(query))
      );
    }

    if (filtered.length === 0) {
      if (user) {
        grid.innerHTML = `
          <div class="empty-state-box">
            <i class="bi bi-folder-plus empty-state-icon text-primary"></i>
            <h3>Bạn chưa có album nào trong tài khoản này</h3>
            <p class="text-muted">Nhấn nút bên dưới để tạo album đầu tiên và chia sẻ mã cho khách hàng!</p>
            <button class="btn-modern btn-primary-glow mt-3" onclick="App.openCreateModal()">
              <i class="bi bi-plus-lg"></i> Tạo Album Mới Ngay
            </button>
          </div>
        `;
      } else {
        grid.innerHTML = `
          <div class="empty-state-box">
            <i class="bi bi-camera-fill empty-state-icon text-primary mb-2"></i>
            <h3 class="fw-bold">Thư Viện Album Photo Harlan</h3>
            <p class="text-muted" style="max-width: 520px; margin: 0 auto 16px; line-height: 1.6;">
              Chào mừng quý khách đến với dịch vụ ảnh chuyên nghiệp <b>Harlan - Minh Hoàng</b>. Khách hàng vui lòng nhập <b>Mã Album</b> do studio cung cấp để vào xem và chọn ảnh trực tiếp!
            </p>
            <div class="quick-code-input-group mt-3 mx-auto" style="max-width:440px;">
              <div class="d-flex gap-2">
                <input type="text" id="emptyStateCodeInput" class="form-input-modern text-center fw-bold font-monospace text-uppercase" placeholder="Nhập mã (VD: HL8899)" onkeydown="if(event.key==='Enter') App.searchAndOpenAlbum(this.value)" />
                <button class="btn-modern btn-primary-glow" onclick="App.searchAndOpenAlbum(document.getElementById('emptyStateCodeInput').value)">
                  <i class="bi bi-arrow-right-circle"></i> Xem Album
                </button>
              </div>
            </div>
            <div class="mt-4 pt-3 d-flex flex-wrap justify-content-center gap-3" style="border-top: 1px dashed rgba(226, 232, 240, 0.8);">
              <a href="https://zalo.me/0337957054" target="_blank" class="btn-modern btn-glass text-success">
                <i class="bi bi-chat-dots-fill"></i> Nhắn Zalo: 0337957054
              </a>
              <a href="tel:0337957054" class="btn-modern btn-glass text-primary">
                <i class="bi bi-telephone-fill"></i> Hotline: 0337957054
              </a>
            </div>
          </div>
        `;
      }
      return;
    }

    grid.innerHTML = filtered
      .map((album) => {
        const coverPhoto = (album.photos || []).find((p) => p.link_id === album.cover_id) || (album.photos || [])[0];
        const coverUrl = coverPhoto ? DriveParser.getCdnUrl(coverPhoto.link_id, 600) : 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"%3E%3C/svg%3E';
        const photoCount = (album.photos || []).length;
        const selectedCount = (album.photos || []).filter((p) => p.selected).length;
        const albumCode = album.code || album.id;

        let statusBadge = '<span class="album-privacy-tag tag-public">Công khai</span>';
        if (album.status === '1') statusBadge = '<span class="album-privacy-tag tag-private">Link riêng tư</span>';
        if (album.status === '2') statusBadge = '<span class="album-privacy-tag tag-password"><i class="bi bi-lock-fill"></i> Mật khẩu</span>';

        const createdDate = album.createdAt ? new Date(album.createdAt).toLocaleDateString('vi-VN') : 'Mới tạo';

        // Nút chỉnh sửa/xóa chỉ hiện với chủ sở hữu hoặc khi đã đăng nhập
        const isOwner = user && (album.owner_uid === user.uid || (user.email && album.owner_email === user.email));
        const ownerActions = isOwner ? `
          <button class="btn-modern btn-glass" onclick="App.openEditModal('${album.id}')" title="Chỉnh sửa Album">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn-modern btn-glass text-danger" onclick="App.deleteAlbum('${album.id}')" title="Xóa Album">
            <i class="bi bi-trash"></i>
          </button>
        ` : '';

        return `
          <div class="album-card-item">
            <div class="album-card-thumb-wrap" onclick="App.navigateTo('#album/${albumCode}')">
              <img src="${coverUrl}" alt="${album.title}" class="album-card-thumb" onerror="this.src='https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop';" />
              ${statusBadge}
              
              <!-- Badge Mã Album Nổi Bật -->
              <div class="album-code-floating-badge" onclick="event.stopPropagation(); App.copyAlbumCode('${albumCode}')" title="Nhấn để sao chép mã Album">
                <i class="bi bi-key-fill text-warning"></i> Mã: <span>${albumCode}</span>
                <i class="bi bi-copy ms-1" style="font-size:0.75rem;"></i>
              </div>
            </div>

            <div class="album-card-body">
              <h3 class="album-card-title" onclick="App.navigateTo('#album/${albumCode}')">${album.title}</h3>
              <div class="album-card-date">
                <i class="bi bi-calendar3"></i> ${createdDate} • ${album.author || 'Studio'}
              </div>
              <div class="album-card-stats">
                <span><i class="bi bi-image"></i> ${photoCount} ảnh</span>
                <span><i class="bi bi-check-circle text-success"></i> ${selectedCount} đã chọn</span>
              </div>
            </div>

            <div class="album-card-actions">
              <button class="btn-modern btn-primary-glow flex-fill" onclick="App.navigateTo('#album/${albumCode}')" title="Xem Album">
                <i class="bi bi-eye"></i> Xem Album
              </button>
              <div style="display:flex;gap:6px;">
                <button class="btn-modern btn-glass" onclick="App.openShareModal('${album.id}')" title="Chia sẻ Link & Mã QR">
                  <i class="bi bi-share"></i>
                </button>
                ${ownerActions}
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  /* ==========================================================================
     OPEN ALBUM DETAIL VIEW (Truy cập bằng Mã hoặc ID, Không Cần Đăng Nhập)
     ========================================================================== */
  async function openAlbumView(albumIdOrCode) {
    if (!albumIdOrCode) {
      navigateTo('#dashboard');
      return;
    }

    const cleanQuery = albumIdOrCode.trim();

    // Tìm album theo Mã Code (ưu tiên) hoặc ID (không phân biệt chữ hoa/thường)
    let album = albums.find(
      (a) => (a.code && a.code.toUpperCase() === cleanQuery.toUpperCase()) || 
             a.id === cleanQuery ||
             (a.id && a.id.toLowerCase() === cleanQuery.toLowerCase())
    );

    // Nếu không tìm thấy trong bộ nhớ cục bộ -> Thử tải ngay từ Google Sheets Cloud
    if (!album && typeof SheetsSync !== 'undefined') {
      const cloudAlbums = await SheetsSync.fetchAlbumsFromCloud();
      if (cloudAlbums && Array.isArray(cloudAlbums) && cloudAlbums.length > 0) {
        cloudAlbums.forEach((cloudAlb) => {
          if (!cloudAlb.code) {
            cloudAlb.code = (cloudAlb.id && cloudAlb.id.length <= 8) ? cloudAlb.id.toUpperCase() : generateAlbumCode();
          }
          const idx = albums.findIndex((a) => a.id === cloudAlb.id || (a.code && a.code === cloudAlb.code));
          if (idx !== -1) {
            albums[idx] = cloudAlb;
          } else {
            albums.push(cloudAlb);
          }
        });
        saveToStorage();

        album = albums.find(
          (a) => (a.code && a.code.toUpperCase() === cleanQuery.toUpperCase()) || 
                 a.id === cleanQuery ||
                 (a.id && a.id.toLowerCase() === cleanQuery.toLowerCase())
        );
      }
    }

    if (!album) {
      alert(`Không tìm thấy Album với mã "${cleanQuery}". Vui lòng kiểm tra lại mã hoặc đường link!`);
      navigateTo('#dashboard');
      return;
    }

    // Kiểm tra mật khẩu truy cập nếu album đặt trạng thái Private Password (status == '2')
    if (album.status === '2' && album.password_view) {
      const enteredPass = prompt(`Album "${album.title}" được bảo vệ bằng mật khẩu. Vui lòng nhập mật khẩu để xem:`);
      if (enteredPass !== album.password_view) {
        alert('Mật khẩu không chính xác!');
        navigateTo('#dashboard');
        return;
      }
    }

    currentAlbumId = album.id;
    const albumView = document.getElementById('albumDetailView');
    if (albumView) albumView.classList.add('active');

    // Khởi tạo thư viện ảnh Gallery (Khách hàng xem tự do, không cần đăng nhập)
    window.Gallery?.init(album);
    window.scrollTo(0, 0);
  }

  /* ==========================================================================
     CREATE / EDIT ALBUM MODAL (Quản lý Chủ Studio)
     ========================================================================== */
  function openCreateModal() {
    if (typeof Auth !== 'undefined' && !Auth.isAuthenticated()) {
      Auth.requireAuth(() => openCreateModal());
      return;
    }
    const modal = document.getElementById('albumCreateModal');
    const form = document.getElementById('albumCreateForm');
    const titleEl = document.getElementById('modalFormTitle');
    const albumIdInput = document.getElementById('inputAlbumId');
    const albumCodeInput = document.getElementById('inputAlbumCode');

    if (form) form.reset();
    if (albumIdInput) albumIdInput.value = '';
    if (albumCodeInput) albumCodeInput.value = generateAlbumCode(); // Tự động sinh mã mới
    if (titleEl) titleEl.textContent = 'Tạo Album Mới';
    togglePasswordField('0');

    if (modal) modal.classList.add('open');
  }

  function openEditModal(albumId) {
    if (typeof Auth !== 'undefined' && !Auth.isAuthenticated()) {
      Auth.requireAuth(() => openEditModal(albumId));
      return;
    }
    const album = albums.find((a) => a.id === albumId);
    if (!album) return;

    const modal = document.getElementById('albumCreateModal');
    const titleEl = document.getElementById('modalFormTitle');
    const albumIdInput = document.getElementById('inputAlbumId');
    const albumCodeInput = document.getElementById('inputAlbumCode');
    const nameInput = document.getElementById('inputAlbumName');
    const driveInput = document.getElementById('inputLinkDrive');
    const statusSelect = document.getElementById('selectAlbumStatus');
    const passViewInput = document.getElementById('inputPasswordView');
    const passSelectInput = document.getElementById('inputPasswordSelected');
    const watermarkInput = document.getElementById('inputWatermark');

    if (titleEl) titleEl.textContent = 'Chỉnh Sửa Album';
    if (albumIdInput) albumIdInput.value = album.id;
    if (albumCodeInput) albumCodeInput.value = album.code || album.id;
    if (nameInput) nameInput.value = album.title || '';
    if (driveInput) driveInput.value = album.link_drive || '';
    if (statusSelect) statusSelect.value = album.status || '0';
    if (passViewInput) passViewInput.value = album.password_view || '';
    if (passSelectInput) passSelectInput.value = album.password_selected || '';
    if (watermarkInput) watermarkInput.value = album.watermark || '';

    togglePasswordField(album.status || '0');
    if (modal) modal.classList.add('open');
  }

  function closeCreateModal() {
    const modal = document.getElementById('albumCreateModal');
    if (modal) modal.classList.remove('open');
  }

  async function handleSaveAlbumForm(e) {
    e.preventDefault();

    const albumIdInput = document.getElementById('inputAlbumId');
    const albumCodeInput = document.getElementById('inputAlbumCode');
    const nameInput = document.getElementById('inputAlbumName');
    const driveInput = document.getElementById('inputLinkDrive');
    const statusSelect = document.getElementById('selectAlbumStatus');
    const passViewInput = document.getElementById('inputPasswordView');
    const passSelectInput = document.getElementById('inputPasswordSelected');
    const watermarkInput = document.getElementById('inputWatermark');

    const title = nameInput.value.trim();
    const linkDrive = driveInput.value.trim();
    const status = statusSelect.value;
    const passView = passViewInput.value.trim();
    const passSelected = passSelectInput.value.trim();
    const watermark = watermarkInput.value.trim();
    let code = (albumCodeInput ? albumCodeInput.value.trim().toUpperCase() : '') || generateAlbumCode();

    if (!title || !linkDrive) {
      alert('Vui lòng nhập đầy đủ Tên Album và Link Thư Mục Google Drive!');
      return;
    }

    const editId = albumIdInput.value;
    let existingAlbum = editId ? albums.find((a) => a.id === editId) : null;

    // Kiểm tra trùng mã với album khác
    const duplicateCodeAlbum = albums.find((a) => a.code === code && a.id !== editId);
    if (duplicateCodeAlbum) {
      alert(`Mã truy cập "${code}" đã được sử dụng cho album khác. Vui lòng chọn mã khác!`);
      return;
    }

    // Trích xuất File ID / Photos từ Link Drive
    let photos = existingAlbum ? existingAlbum.photos : [];

    // Nếu tạo mới hoặc đổi link Drive
    if (!existingAlbum || existingAlbum.link_drive !== linkDrive) {
      const folderId = DriveParser.extractFolderId(linkDrive);
      const parsedPhotos = DriveParser.parseMultipleLinks(linkDrive);

      if (parsedPhotos.length > 0) {
        photos = parsedPhotos;
      } else if (folderId) {
        photos = generatePhotosForFolder(folderId);
      }
    }

    const user = typeof Auth !== 'undefined' ? Auth.getCurrentUser() : null;

    const albumData = {
      id: editId || 'alb_' + Date.now().toString(36),
      code: code,
      title: title,
      author: user ? user.displayName : (existingAlbum ? existingAlbum.author : 'Harlan - Minh Hoàng'),
      avatar: user && user.photoURL ? user.photoURL : './assets/default_avatar.png',
      owner_uid: user ? user.uid : (existingAlbum ? existingAlbum.owner_uid : 'guest'),
      owner_email: user ? user.email : (existingAlbum ? existingAlbum.owner_email : ''),
      link_drive: linkDrive,
      cover_id: photos.length > 0 ? photos[0].link_id : '',
      status: status,
      password_view: status === '2' ? passView : '',
      password_selected: passSelected,
      watermark: watermark || 'Harlan Studio • 0337957054',
      createdAt: existingAlbum ? existingAlbum.createdAt : new Date().toISOString(),
      photos: photos,
    };

    saveAlbum(albumData);
    closeCreateModal();
    renderDashboard();
    showToast(editId ? `Đã cập nhật album [Mã: ${code}] thành công!` : `Đã tạo album mới [Mã: ${code}] thành công!`, 'success');
  }

  function generatePhotosForFolder(folderId) {
    const sampleIds = [
      '1Zxx99GBmd2-DWY-4v89d-cvBZ3uvCZy3',
      '1rK8MwE_OflDOY73NAxa4_8atKBRHRKKQ',
      '1Vsef8vbFXHlrAtzJykJr7Mv-1CNjSAEf',
      '1FODJOknLbX0XfBnErm1D4CZhuj-bZCYn',
      '17P0uTz88F-LzJtN78ZtWl043K1fVq-tF',
      '1pM9_ZJgY4eO6qWkM6vG4jW8Z9tF2qL0X',
      '1Sdt199fRqKytw5XzQJ67eqAQdaLTe6SI',
    ];

    return sampleIds.map((id, index) => ({
      id_photo: 'p_' + Math.random().toString(36).substr(2, 9),
      link_id: id,
      filename: `IMG_${String(index + 1).padStart(4, '0')}.JPG`,
      selected: false,
      tim: false,
      in_anh: false,
      size_anh: '',
      note: '',
    }));
  }

  function togglePasswordField(val) {
    const wrap = document.getElementById('passwordViewFieldWrap');
    if (wrap) {
      wrap.style.display = val === '2' ? 'block' : 'none';
    }
  }

  /* ==========================================================================
     SHARE MODAL & QR CODE (Mã Album + Link Xem Trực Tiếp)
     ========================================================================== */
  function openShareModal(albumId) {
    const album = albums.find((a) => a.id === albumId || a.code === albumId);
    if (!album) return;

    const modal = document.getElementById('shareModal');
    const input = document.getElementById('shareUrlInput');
    const qrContainer = document.getElementById('shareQrCodeContainer');
    const titleEl = document.getElementById('shareModalAlbumTitle');
    const codeDisplayEl = document.getElementById('shareModalAlbumCodeDisplay');

    const albumCode = album.code || album.id;
    // Đường dẫn chia sẻ trực tiếp tới album
    const shareUrl = `${window.location.origin}${window.location.pathname}#album/${albumCode}`;

    if (titleEl) titleEl.textContent = album.title;
    if (codeDisplayEl) codeDisplayEl.textContent = albumCode;
    if (input) input.value = shareUrl;

    if (qrContainer) {
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareUrl)}`;
      qrContainer.innerHTML = `<img src="${qrApiUrl}" alt="QR Code" style="width:160px;height:160px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);" />`;
    }

    if (modal) modal.classList.add('open');
  }

  function closeShareModal() {
    const modal = document.getElementById('shareModal');
    if (modal) modal.classList.remove('open');
  }

  function copyShareUrl() {
    const input = document.getElementById('shareUrlInput');
    if (input) {
      PcSorter.copyToClipboard(input.value, 'Đã sao chép link xem album trực tiếp!');
    }
  }

  function copyAlbumCode(code) {
    if (code) {
      PcSorter.copyToClipboard(code, `Đã sao chép Mã Album: ${code}`);
    }
  }

  /* ==========================================================================
     GOOGLE SHEETS SETTINGS MODAL
     ========================================================================== */
  function openSettingsModal() {
    const modal = document.getElementById('sheetsSettingsModal');
    const input = document.getElementById('inputAppsScriptUrl');
    if (input && typeof SheetsSync !== 'undefined') {
      input.value = SheetsSync.getScriptUrl();
    }
    if (modal) modal.classList.add('open');
  }

  function closeSettingsModal() {
    const modal = document.getElementById('sheetsSettingsModal');
    if (modal) modal.classList.remove('open');
  }

  function saveSettingsForm(e) {
    e.preventDefault();
    const input = document.getElementById('inputAppsScriptUrl');
    if (input && typeof SheetsSync !== 'undefined') {
      SheetsSync.setScriptUrl(input.value);
      closeSettingsModal();
      showToast('Đã lưu cấu hình Google Apps Script URL thành công!', 'success');
      syncWithCloudAtStartup();
    }
  }

  async function testSheetsConnection() {
    const input = document.getElementById('inputAppsScriptUrl');
    const resultBox = document.getElementById('sheetsTestResultBox');
    if (!input || !resultBox) return;

    resultBox.style.display = 'block';
    resultBox.className = 'alert alert-info py-2 small mb-3';
    resultBox.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Đang kiểm tra kết nối tới Google Apps Script...';

    const testRes = await SheetsSync.testConnection(input.value);
    if (testRes.success) {
      resultBox.className = 'alert alert-success py-2 small mb-3';
      resultBox.innerHTML = `<b>✓ Kết nối thành công!</b> ${testRes.message}`;
    } else {
      resultBox.className = 'alert alert-danger py-2 small mb-3';
      resultBox.innerHTML = `<b>✗ Chưa kết nối được:</b> ${testRes.message}`;
    }
  }

  /* ==========================================================================
     TOAST NOTIFICATIONS
     ========================================================================== */
  function showToast(message, type = 'success') {
    let container = document.getElementById('customToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'customToastContainer';
      container.className = 'toast-container-custom';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-message-item toast-${type}`;

    let icon = 'bi-check-circle-fill';
    if (type === 'error') icon = 'bi-x-circle-fill';
    if (type === 'warning' || type === 'info') icon = 'bi-info-circle-fill';

    toast.innerHTML = `<i class="bi ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  return {
    init,
    navigateTo,
    searchAndOpenAlbum,
    saveAlbum,
    deleteAlbum,
    openCreateModal,
    openEditModal,
    closeCreateModal,
    handleSaveAlbumForm,
    togglePasswordField,
    openShareModal,
    closeShareModal,
    copyShareUrl,
    copyAlbumCode,
    openSettingsModal,
    closeSettingsModal,
    saveSettingsForm,
    testSheetsConnection,
    showToast,
    renderDashboard,
    renderAlbumCards,
    generateAlbumCode,
  };
})();

window.App = App;

// Khởi chạy khi DOM tải xong
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
