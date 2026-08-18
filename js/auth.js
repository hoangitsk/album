/**
 * Authentication Module - Firebase Google Sign-In & Phân Quyền
 * Project: album-ec2c0
 * - Chủ Studio: Đăng nhập Google để Tạo / Sửa / Xóa Album
 * - Khách hàng: Không cần đăng nhập, tự do xem ảnh, chọn ảnh, thả tim, ghi chú
 */

const Auth = (function () {
  // Cấu hình Firebase chính thức từ project album-ec2c0
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyC_sP5tSgsA-Dt8iiGbJaeyjpUWQwaLAqA",
    authDomain: "album-ec2c0.firebaseapp.com",
    projectId: "album-ec2c0",
    storageBucket: "album-ec2c0.firebasestorage.app",
    messagingSenderId: "561710621976",
    appId: "1:561710621976:web:20a020fdb8f8f768632a6d",
    measurementId: "G-CT2P9QVWFQ"
  };

  const LOCAL_USER_KEY = 'web_album_auth_user';
  let currentUser = null;
  let isInitialized = false;

  function init() {
    loadSavedUser();
    initFirebase();
    renderAuthUI();
  }

  function loadSavedUser() {
    try {
      const saved = localStorage.getItem(LOCAL_USER_KEY);
      if (saved) {
        currentUser = JSON.parse(saved);
      }
    } catch (e) {
      currentUser = null;
    }
  }

  function saveUser(user) {
    currentUser = user;
    if (user) {
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(LOCAL_USER_KEY);
    }
    renderAuthUI();
    if (window.App && typeof window.App.renderDashboard === 'function') {
      window.App.renderDashboard();
    }
  }

  function quickDemoLogin(email = 'studio.admin@gmail.com', displayName = 'Studio Admin') {
    const demoUser = {
      uid: 'demo_' + (email.split('@')[0] || 'studio'),
      displayName: displayName,
      email: email,
      photoURL: './assets/default_avatar.png',
    };
    saveUser(demoUser);
    window.App?.showToast(`Đã đăng nhập tài khoản: ${displayName}`, 'success');
  }

  function initFirebase() {
    try {
      if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) {
          firebase.initializeApp(FIREBASE_CONFIG);
        }

        firebase.auth().onAuthStateChanged((user) => {
          if (user) {
            saveUser({
              uid: user.uid,
              displayName: user.displayName || user.email.split('@')[0],
              email: user.email,
              photoURL: user.photoURL || './assets/default_avatar.png',
            });
          }
          isInitialized = true;
        });
      }
    } catch (e) {
      console.warn('Lỗi khởi tạo Firebase SDK:', e);
    }
  }

  /**
   * Đăng nhập bằng Google Popup
   */
  async function signInWithGoogle() {
    if (typeof firebase === 'undefined') {
      alert('Đang tải thư viện Google Sign-In, vui lòng thử lại sau 2 giây...');
      return;
    }

    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');

      const result = await firebase.auth().signInWithPopup(provider);
      const user = result.user;

      saveUser({
        uid: user.uid,
        displayName: user.displayName || user.email.split('@')[0],
        email: user.email,
        photoURL: user.photoURL || './assets/default_avatar.png',
      });

      window.App?.showToast(`Đăng nhập thành công! Xin chào ${user.displayName || user.email}`, 'success');
    } catch (error) {
      console.error('Lỗi đăng nhập Google:', error);
      if (error.code === 'auth/popup-blocked') {
        firebase.auth().signInWithRedirect(new firebase.auth.GoogleAuthProvider());
      } else if (error.code !== 'auth/popup-closed-by-user') {
        alert('Đăng nhập Google chưa thành công: ' + error.message);
      }
    }
  }

  /**
   * Đăng xuất tài khoản
   */
  async function signOut() {
    try {
      if (typeof firebase !== 'undefined' && firebase.apps.length) {
        await firebase.auth().signOut();
      }
    } catch (e) {}

    saveUser(null);
    window.App?.showToast('Đã đăng xuất tài khoản.', 'info');
  }

  function isAuthenticated() {
    return currentUser !== null;
  }

  function getCurrentUser() {
    return currentUser;
  }

  /**
   * Kiểm tra quyền: nếu chưa đăng nhập thì yêu cầu đăng nhập trước khi thao tác
   */
  function requireAuth(actionCallback) {
    if (isAuthenticated()) {
      if (typeof actionCallback === 'function') actionCallback();
    } else {
      const confirmLogin = confirm('Tính năng Tạo/Sửa/Xóa Album dành cho Chủ Studio. Bạn cần đăng nhập tài khoản Google để tiếp tục. Bạn có muốn đăng nhập ngay không?');
      if (confirmLogin) {
        signInWithGoogle();
      }
    }
  }

  /**
   * Cập nhật giao diện thanh điều hướng Navbar
   */
  function renderAuthUI() {
    const authContainer = document.getElementById('navbarAuthContainer');
    if (!authContainer) return;

    if (currentUser) {
      authContainer.innerHTML = `
        <div class="user-profile-badge d-flex align-items-center gap-2" style="background:rgba(255,255,255,0.08);padding:4px 10px;border-radius:24px;border:1px solid rgba(255,255,255,0.15);">
          <img src="${currentUser.photoURL || './assets/default_avatar.png'}" alt="Avatar" style="width:28px;height:28px;border-radius:50%;object-fit:cover;" onerror="this.src='./assets/default_avatar.png';" />
          <div class="d-none d-lg-block text-start" style="line-height:1.2;">
            <div class="fw-bold small text-white text-truncate" style="max-width:120px;">${currentUser.displayName}</div>
            <div class="text-muted" style="font-size:0.7rem;">Studio Account</div>
          </div>
          <button class="btn btn-sm btn-link text-danger p-0 ms-1" onclick="Auth.signOut()" title="Đăng xuất" style="text-decoration:none;">
            <i class="bi bi-box-arrow-right fs-6"></i>
          </button>
        </div>
      `;
    } else {
      authContainer.innerHTML = `
        <button class="btn-modern btn-glass text-primary" onclick="Auth.signInWithGoogle()" title="Đăng nhập tài khoản Google để quản lý Album của bạn">
          <i class="bi bi-google"></i> <span class="d-none d-sm-inline">Đăng nhập Google</span>
        </button>
      `;
    }

    // Cập nhật tên studio trên dashboard
    const studioNameEl = document.querySelector('.studio-meta h1');
    if (studioNameEl) {
      studioNameEl.textContent = currentUser ? currentUser.displayName : 'Chào Mừng Quý Khách';
    }
    const studioAvatarEl = document.querySelector('.studio-avatar');
    if (studioAvatarEl && currentUser && currentUser.photoURL) {
      studioAvatarEl.src = currentUser.photoURL;
    }
  }

  return {
    init,
    signInWithGoogle,
    quickDemoLogin,
    signOut,
    isAuthenticated,
    getCurrentUser,
    requireAuth,
    renderAuthUI,
  };
})();

window.Auth = Auth;

document.addEventListener('DOMContentLoaded', () => {
  Auth.init();
});
