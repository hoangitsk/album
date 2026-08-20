// ===== Authentication State Management =====
class AuthManager {
    constructor() {
        this.isLoggedIn = this.getLoginState();
        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.updateUI();
    }

    cacheElements() {
        // Desktop auth buttons
        this.btnLogin = document.getElementById('btnLogin');
        this.btnLogout = document.getElementById('btnLogout');
        this.authLoggedIn = document.getElementById('authLoggedIn');

        // Mobile auth buttons
        this.btnLoginMobile = document.getElementById('btnLoginMobile');
        this.btnLogoutMobile = document.getElementById('btnLogoutMobile');
        this.authLoggedInMobile = document.getElementById('authLoggedInMobile');

        // Menu elements
        this.mobileMenuToggle = document.getElementById('mobileMenuToggle');
        this.navMenu = document.getElementById('navMenu');
    }

    bindEvents() {
        // Desktop Login/Logout buttons
        if (this.btnLogin) {
            this.btnLogin.addEventListener('click', () => this.login());
        }
        if (this.btnLogout) {
            this.btnLogout.addEventListener('click', () => this.logout());
        }

        // Mobile Login/Logout buttons
        if (this.btnLoginMobile) {
            this.btnLoginMobile.addEventListener('click', () => this.login());
        }
        if (this.btnLogoutMobile) {
            this.btnLogoutMobile.addEventListener('click', () => this.logout());
        }

        // Mobile menu toggle
        if (this.mobileMenuToggle) {
            this.mobileMenuToggle.addEventListener('click', () => this.toggleMobileMenu());
        }

        // Close mobile menu when clicking on nav links
        const navLinks = document.querySelectorAll('.nav-link, .btn-albums');
        navLinks.forEach(link => {
            link.addEventListener('click', () => this.closeMobileMenu());
        });

        // Close mobile menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.navMenu.contains(e.target) && !this.mobileMenuToggle.contains(e.target)) {
                this.closeMobileMenu();
            }
        });
    }

    login() {
        this.isLoggedIn = true;
        this.saveLoginState();
        this.updateUI();
        this.showNotification('Đăng nhập thành công! 🎊');
    }

    logout() {
        this.isLoggedIn = false;
        this.saveLoginState();
        this.updateUI();
        this.showNotification('Đã đăng xuất. Chúc mừng năm mới! 🧧');
    }

    updateUI() {
        if (this.isLoggedIn) {
            // Hide login buttons (both desktop and mobile)
            if (this.btnLogin) {
                this.btnLogin.style.display = 'none';
            }
            if (this.btnLoginMobile) {
                this.btnLoginMobile.style.display = 'none';
            }

            // Show logged in state (both desktop and mobile)
            if (this.authLoggedIn) {
                this.authLoggedIn.style.display = 'flex';
            }
            if (this.authLoggedInMobile) {
                this.authLoggedInMobile.style.display = 'flex';
            }
        } else {
            // Show login buttons (both desktop and mobile)
            if (this.btnLogin) {
                this.btnLogin.style.display = 'inline-block';
            }
            if (this.btnLoginMobile) {
                this.btnLoginMobile.style.display = 'inline-block';
            }

            // Hide logged in state (both desktop and mobile)
            if (this.authLoggedIn) {
                this.authLoggedIn.style.display = 'none';
            }
            if (this.authLoggedInMobile) {
                this.authLoggedInMobile.style.display = 'none';
            }
        }
    }

    saveLoginState() {
        localStorage.setItem('albumse_logged_in', this.isLoggedIn);
    }

    getLoginState() {
        const state = localStorage.getItem('albumse_logged_in');
        return state === 'true';
    }

    toggleMobileMenu() {
        if (this.navMenu) {
            this.navMenu.classList.toggle('active');
            this.animateMenuToggle();
        }
    }

    closeMobileMenu() {
        if (this.navMenu) {
            this.navMenu.classList.remove('active');
            this.resetMenuToggle();
        }
    }

    animateMenuToggle() {
        const spans = this.mobileMenuToggle.querySelectorAll('span');
        if (this.navMenu.classList.contains('active')) {
            spans[0].style.transform = 'rotate(45deg) translateY(8px)';
            spans[1].style.opacity = '0';
            spans[2].style.transform = 'rotate(-45deg) translateY(-8px)';
        } else {
            this.resetMenuToggle();
        }
    }

    resetMenuToggle() {
        const spans = this.mobileMenuToggle.querySelectorAll('span');
        spans[0].style.transform = 'none';
        spans[1].style.opacity = '1';
        spans[2].style.transform = 'none';
    }

    showNotification(message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: linear-gradient(135deg, #FFD700, #DAA520);
            color: #1A1A1A;
            padding: 1rem 2rem;
            border-radius: 50px;
            font-weight: 700;
            box-shadow: 0 4px 20px rgba(255, 215, 0, 0.4);
            z-index: 10000;
            animation: slideIn 0.3s ease, slideOut 0.3s ease 2.7s;
            font-family: 'Montserrat', sans-serif;
        `;

        // Add animation styles
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOut {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        // Remove notification after animation
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// ===== Scroll Effects =====
class ScrollEffects {
    constructor() {
        this.navbar = document.querySelector('.navbar');
        this.init();
    }

    init() {
        window.addEventListener('scroll', () => this.handleScroll());
    }

    handleScroll() {
        if (window.scrollY > 50) {
            this.navbar.style.background = 'rgba(26, 26, 26, 0.95)';
            this.navbar.style.padding = '0.5rem 0';
        } else {
            this.navbar.style.background = 'rgba(255, 255, 255, 0.1)';
            this.navbar.style.padding = '1rem 0';
        }
    }
}

// ===== Parallax Effect =====
// class ParallaxEffect {
//     constructor() {
//         this.hero = document.querySelector('.hero');
//         this.init();
//     }

//     init() {
//         window.addEventListener('scroll', () => this.handleParallax());
//     }

//     handleParallax() {
//         const scrolled = window.pageYOffset;
//         if (this.hero) {
//             this.hero.style.transform = `translateY(${scrolled * 0.5}px)`;
//         }
//     }
// }

// ===== Initialize Everything =====
document.addEventListener('DOMContentLoaded', () => {
    // Initialize authentication manager
    const authManager = new AuthManager();

    // Initialize scroll effects
    const scrollEffects = new ScrollEffects();



    // Add smooth scrolling to anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });


    // Add sparkle animation on mouse move (optional enhancement)
    let sparkleTimeout;
    document.addEventListener('mousemove', (e) => {
        clearTimeout(sparkleTimeout);
        sparkleTimeout = setTimeout(() => {
            createSparkle(e.clientX, e.clientY);
        }, 100);
    });

    function createSparkle(x, y) {
        // Only create sparkles occasionally (20% chance)
        if (Math.random() > 0.8) {
            const sparkle = document.createElement('div');
            sparkle.className = 'mouse-sparkle';
            sparkle.style.cssText = `
                position: fixed;
                left: ${x}px;
                top: ${y}px;
                width: 6px;
                height: 6px;
                background: #FFD700;
                border-radius: 50%;
                pointer-events: none;
                z-index: 9998;
                animation: mouseSparkle 1s ease-out forwards;
            `;

            // Add animation if not exists
            if (!document.getElementById('mouse-sparkle-styles')) {
                const style = document.createElement('style');
                style.id = 'mouse-sparkle-styles';
                style.textContent = `
                    @keyframes mouseSparkle {
                        0% {
                            opacity: 1;
                            transform: scale(0);
                        }
                        50% {
                            opacity: 0.8;
                            transform: scale(1);
                        }
                        100% {
                            opacity: 0;
                            transform: scale(0);
                        }
                    }
                `;
                document.head.appendChild(style);
            }

            document.body.appendChild(sparkle);

            setTimeout(() => {
                sparkle.remove();
            }, 1000);
        }
    }


    // ===== Fireworks Animation =====
    const canvas = document.getElementById('fireworksCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });

    class Particle {
        constructor(x, y, color) {
            this.x = x;
            this.y = y;
            this.color = color;
            this.velocity = {
                x: (Math.random() - 0.5) * 8,
                y: (Math.random() - 0.5) * 8
            };
            this.alpha = 1;
            this.decay = Math.random() * 0.015 + 0.015;
        }

        update() {
            this.velocity.y += 0.1; // gravity
            this.x += this.velocity.x;
            this.y += this.velocity.y;
            this.alpha -= this.decay;
        }

        draw() {
            ctx.save();
            ctx.globalAlpha = this.alpha;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    class Firework {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.targetY = Math.random() * canvas.height * 0.5;
            this.velocity = {
                x: 0,
                y: -8
            };
            this.exploded = false;
            this.particles = [];
            // Tet colors: gold and red
            this.colors = ['#FFD700', '#DAA520', '#FFA500', '#D9232E', '#C41E3A', '#FF6B6B'];
        }

        update() {
            if (!this.exploded) {
                this.velocity.y += 0.2;
                this.y += this.velocity.y;

                if (this.y <= this.targetY) {
                    this.explode();
                }
            }

            this.particles.forEach((particle, index) => {
                particle.update();
                if (particle.alpha <= 0) {
                    this.particles.splice(index, 1);
                }
            });
        }

        explode() {
            this.exploded = true;
            const particleCount = 80;
            for (let i = 0; i < particleCount; i++) {
                const color = this.colors[Math.floor(Math.random() * this.colors.length)];
                this.particles.push(new Particle(this.x, this.y, color));
            }
        }

        draw() {
            if (!this.exploded) {
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
                ctx.fill();
            }

            this.particles.forEach(particle => particle.draw());
        }

        isDone() {
            return this.exploded && this.particles.length === 0;
        }
    }

    const fireworks = [];
    let animationId;
    let fireworkCount = 0;
    const maxFireworks = 15; // Total fireworks to launch

    function launchFirework() {
        if (fireworkCount < maxFireworks) {
            const x = Math.random() * canvas.width;
            const y = canvas.height;
            fireworks.push(new Firework(x, y));
            fireworkCount++;
        }
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        fireworks.forEach((firework, index) => {
            firework.update();
            firework.draw();

            if (firework.isDone()) {
                fireworks.splice(index, 1);
            }
        });

        if (fireworkCount < maxFireworks || fireworks.length > 0) {
            animationId = requestAnimationFrame(animate);
        } else {
            // Fade out canvas after fireworks are done
            setTimeout(() => {
                canvas.style.transition = 'opacity 2s';
                canvas.style.opacity = '0';
                setTimeout(() => {
                    cancelAnimationFrame(animationId);
                }, 2000);
            }, 1000);
        }
    }

    // Launch fireworks on page load
    setTimeout(() => {
        animate();
        // Launch fireworks at intervals
        const launchInterval = setInterval(() => {
            launchFirework();
            if (fireworkCount >= maxFireworks) {
                clearInterval(launchInterval);
            }
        }, 300);
    }, 500);

    // Add CTA button functionality
    const btnStartAlbum = document.getElementById('btnStartAlbum');
    if (btnStartAlbum) {
        btnStartAlbum.addEventListener('click', () => {
            console.log('🎊 Albumse Tet Landing Page loaded successfully! Chúc mừng năm mới! 🧧');
                window.location = 'https://albumse.online/album';
            
        });
    }

    
});
