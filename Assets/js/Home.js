(() => {
    'use strict';

    const initMobileDetection = () => {
        const isMobile = /Mobile|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Windows Phone|BlackBerry|Kindle|Silk|webOS|Tablet/i.test(navigator.userAgent);
        const isBot = /Googlebot|Bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|Crawler|Spider|Robot|Scraper/i.test(navigator.userAgent);
        
        if (isMobile && !isBot) {
            document.documentElement.classList.add('is-mobile');
            document.body.classList.add('mobile-device');
            const splash = document.getElementById('mobile-splash-overlay');
            if (splash) {
                splash.style.display = 'flex';
                splash.style.animation = 'fadeIn 0.3s ease-in-out';
            }
        }
    };
    
    document.addEventListener('DOMContentLoaded', () => {
        initMobileDetection();
        
        initSmoothTransitions();
        
        requestIdleCallback(() => {
            const exploreBtn = document.querySelector('.btn-hero-explore');
            if (exploreBtn) {
                exploreBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const targetId = exploreBtn.getAttribute('href');
                    const targetSection = document.querySelector(targetId);
                    if (targetSection) {
                        targetSection.scrollIntoView({ behavior: 'smooth' });
                    }
                });
            }

            if (typeof initAdvancedHeroEffects === 'function') {
                initAdvancedHeroEffects();
            }
        });
    });

    const initSmoothTransitions = () => {
        window.addEventListener('popstate', (e) => {
            loadPage(window.location.href, false);
        });
        
        const loadPage = (url, pushState = true) => {
            const wrapper = document.querySelector('.app-wrapper');
            if (wrapper) wrapper.style.opacity = '0.6';
            
            const loaderBar = document.querySelector('.loader-bar');
            if (loaderBar) {
                loaderBar.parentElement.parentElement.style.display = 'flex';
                loaderBar.parentElement.parentElement.style.opacity = '0.5';
            }

            fetch(url)
                .then(response => {
                    if (!response.ok) throw new Error('Network response was not ok');
                    return response.text();
                })
                .then(html => {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    const newContent = doc.querySelector('.app-wrapper');
                    
                    if (newContent && wrapper) {
                        wrapper.innerHTML = newContent.innerHTML;
                        document.title = doc.title;
                        
                        if (pushState) {
                            window.history.pushState({}, '', url);
                        }
                        
                        wrapper.style.opacity = '1';
                        
                        cacheElements();
                        if (typeof initAll === 'function') {
                            initAll();
                        } else {
                            window.location.reload(); 
                            return;
                        }
                        
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        
                        if (loaderBar) {
                            loaderBar.parentElement.parentElement.style.display = 'none';
                        }
                    } else {
                        window.location.href = url;
                    }
                })
                .catch(err => {
                    console.error('SPA Load Error:', err);
                    window.location.href = url;
                });
        };

        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link && link.href && link.href.startsWith(window.location.origin) && 
                !link.target && !link.href.includes('#') && 
                !link.href.includes('logout') && 
                !link.href.includes('admin') &&
                !link.href.includes('download')) {
                
                e.preventDefault();
                loadPage(link.href);
            }
        });
    };

    const STATE = {
        phpVars: {},
        page: 1,
        hasNextPage: true,
        productsLoaded: 0,
        isLoading: false,
        filters: {
            category: '',
            min: '',
            max: '',
            sort: ''
        }
    };

    const elements = {};
    
    const cacheElements = () => {
        const ids = [
            'main-header', 'products-container', 'infinite-scroll-trigger',
            'search-overlay', 'search-open', 'filter-sidebar',
            'mobile-menu-toggle', 'theme-switcher', 'preloader',
            'filter-form', 'sort-products', 'php-vars',
            'total-results', 'category-hub-container',
            'featured-offers-container', 'load-more-btn',
            'loading-spinner', 'search-input', 'search-suggestions',
            'search-form', 'quick-view-modal', 'quick-view-body',
            'toggle-filters', 'apply-filters', 'clear-filters',
            'apply-inline', 'nav-user-links', 'cart-count',
            'wishlist-count', 'compare-bar', 'compare-count-text',
            'clear-compare', 'toast-region', 'search-term',
            'search-close', 'close-sidebar', 'year',
            'notification-bell', 'notification-count',
            'toggle-fold-sidebar', 'whatsapp-float'
        ];
        
        ids.forEach(id => {
            elements[id] = document.getElementById(id);
        });
    };

    const q = id => document.getElementById(id);
    
    const ce = (tag, props = {}) => {
        const el = document.createElement(tag);
        for (const [key, value] of Object.entries(props)) {
            if (key === 'dataset') {
                Object.assign(el.dataset, value);
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(el.style, value);
            } else if (key in el && typeof value !== 'object') {
                try { el[key] = value; } catch (e) { el.setAttribute(key, value); }
            } else {
                el.setAttribute(key, value);
            }
        }
        return el;
    };
    window.ce = ce;
    
    const escapeHtml = s => {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };
    
    const formatPrice = v => {
        if (v === null || v === undefined || Number.isNaN(Number(v))) return '-';
        return new Intl.NumberFormat('ar-EG', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(v) + ' ج.م';
    };

    // --- Error Handling ---
    class AppError extends Error {
        constructor(message, code = 'UNKNOWN') {
            super(message);
            this.name = 'AppError';
            this.code = code;
        }
    }

    // --- Toast System ---

    const showToast = (message, type = 'info') => {
        if (!elements['toast-region']) {
            // Create toast region if it doesn't exist
            const region = ce('div', { id: 'toast-region' });
            document.body.appendChild(region);
            elements['toast-region'] = region;
        }
        
        const toast = ce('div', {
            className: `toast toast-${type}`,
            textContent: message,
            role: 'status'
        });
        
        elements['toast-region'].appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }, 100);
    };

    // --- Splash Screen Functions ---
    window.closeMobileSplash = () => {
        const overlay = document.getElementById('mobile-splash-overlay');
        if (overlay) {
            overlay.style.animation = 'fadeOut 0.3s ease-out forwards';
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 300);
        }
    };
    
    window.continueShopping = () => {
        window.closeMobileSplash();
    };
    
    window.viewDesktopVersion = () => {
        fetch(PROJECT_BASE + 'Api/set_view_preference.php?view=desktop', {
            method: 'GET',
            credentials: 'same-origin'
        }).then(() => {
            window.location.reload();
        }).catch(e => console.error('Error:', e));
    };
    
    window.handleDontShowAgain = () => {
        const checkbox = document.getElementById('dont-show-again');
        if (checkbox && checkbox.checked) {
            fetch(PROJECT_BASE + 'Api/set_view_preference.php?action=hide_splash', {
                method: 'GET',
                credentials: 'same-origin'
            }).catch(e => console.error('Error:', e));
        }
    };

    // --- Premium Visual Effects ---
    const initPremiumEffects = () => {
        // 1. Parallax Hero Effect & Sticky Search
        const hero = document.querySelector('.layer-bg');
        const header = document.getElementById('main-header');
        
        let isScrolling = false;
        window.addEventListener('scroll', () => {
            if (!isScrolling) {
                window.requestAnimationFrame(() => {
                    const scrolled = window.pageYOffset;
                    if (hero) hero.style.transform = `translateY(${scrolled * 0.4}px)`;
                    if (scrolled > 100) header.classList.add('scrolled');
                    else header.classList.remove('scrolled');
                    isScrolling = false;
                });
                isScrolling = true;
            }
        });

        // 2. Premium Titles (Replacing the old color effect)
        const titles = ['cat-title', 'cat-subtitle', 'offer-title', 'offer-subtitle', 'random-offer-title', 'random-offer-subtitle'];
        titles.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('premium-title');
        });
    };

    // --- Pending Reviews & Notifications ---
    const checkPendingReviews = async () => {
        try {
            const response = await fetch(PROJECT_BASE + 'Controller/comments.php?action=check_notifications');
            const data = await response.json();
            
            if (data.success && data.pending_reviews && data.pending_reviews.length > 0) {
                const bell = elements['notification-bell'];
                const count = elements['notification-count'];
                if (bell && count) {
                    bell.style.display = 'flex';
                    count.textContent = data.pending_reviews.length;
                    bell.onclick = () => showPendingReviewsModal(data.pending_reviews);
                }
                
                if (!sessionStorage.getItem('review_popup_shown')) {
                    setTimeout(() => {
                        showPendingReviewsModal(data.pending_reviews);
                        sessionStorage.setItem('review_popup_shown', 'true');
                    }, 2000);
                }
            }
        } catch (e) {
            console.error('Error checking notifications:', e);
        }
    };

    const showPendingReviewsModal = (reviews) => {
        let modal = document.getElementById('pending-reviews-modal');
        if (!modal) {
            modal = ce('div', { id: 'pending-reviews-modal', className: 'modal-v2' });
            document.body.appendChild(modal);
        }
        
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content-v2">
                <div class="modal-header-v2">
                    <h3><i class="fas fa-star"></i> تقييم مشترياتك</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body-v2">
                    <p>لديك ${reviews.length} منتجات بانتظار تقييمك:</p>
                    <div class="pending-list">
                        ${reviews.map(r => `
                            <div class="pending-review-item" style="display: flex; align-items: center; gap: 15px; padding: 10px; border-bottom: 1px solid #eee; cursor: pointer;" onclick="window.HomeApp.openCommentsModal('${r.id}')">
                                <img src="../../Assets/images/${r.image}" style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover;">
                                <div style="flex: 1;">
                                    <h4 style="margin: 0; font-size: 0.9rem;">${escapeHtml(r.name)}</h4>
                                    <span style="color: #D4AF37; font-size: 0.8rem;">اضغط للتقييم الآن</span>
                                </div>
                                <i class="fas fa-chevron-left"></i>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        modal.querySelector('.close-modal').onclick = () => modal.style.display = 'none';
        window.onclick = (e) => { 
            if (e.target == modal) modal.style.display = 'none'; 
        };
    };

    window.filterAndScroll = (categoryId) => {
        if (window.innerWidth < 992 && elements['filter-sidebar']) {
            elements['filter-sidebar'].classList.remove('active');
        }
        
        STATE.filters.category = categoryId;
        STATE.page = 1; 
        STATE.hasNextPage = true;

        const url = new URL(window.location);
        if (categoryId) url.searchParams.set('category', categoryId);
        else url.searchParams.delete('category');
        window.history.pushState({}, '', url);
        
        const categoryInputs = document.querySelectorAll('input[name="category"]');
        categoryInputs.forEach(input => {
            input.checked = input.value === String(categoryId);
        });
        
        const productsContainer = elements['products-container'];
        if (productsContainer) {
            productsContainer.classList.add('loading');
            
            const loadingDiv = ce('div', {
                className: 'products-loading-overlay',
                innerHTML: `
                    <div class="loading-spinner" style="width: 50px; height: 50px; margin: 0 auto;"></div>
                    <p>جاري تحميل منتجات الفئة...</p>
                `
            });
            
            const currentContent = productsContainer.innerHTML;
            productsContainer.innerHTML = '';
            productsContainer.appendChild(loadingDiv);
            
            loadProducts(true).then(() => {
                setTimeout(() => {
                    productsContainer.classList.remove('loading');
                    
                    const productSection = document.getElementById('products-container');
                    if (productSection) {
                        const offset = 120; 
                        const elementPosition = productSection.getBoundingClientRect().top;
                        const offsetPosition = elementPosition + window.pageYOffset - offset;
                        
                        window.scrollTo({
                            top: offsetPosition,
                            behavior: 'smooth'
                        });
                    }
                }, 300);
            }).catch(error => {
                console.error('Error loading products:', error);
                productsContainer.innerHTML = currentContent;
                productsContainer.classList.remove('loading');
                showToast('حدث خطأ في تحميل المنتجات', 'error');
            });
        }
    };

    const initCategorySlider = () => {
        const categorySliderContainer = document.querySelector('.category-swiper');
        if (!categorySliderContainer) return;
        
        if (typeof Swiper !== 'undefined') {
            setTimeout(() => {
                try {
                    const categorySwiper = new Swiper('.category-swiper', {
                        direction: 'horizontal',
                        loop: true,
                        slidesPerView: 1.5, 
                        spaceBetween: 15,
                        centeredSlides: true, 
                        grabCursor: true,
                        autoplay: {
                            delay: 4000,
                            disableOnInteraction: false,
                        },
                        pagination: {
                            el: '.swiper-pagination',
                            clickable: true,
                            dynamicBullets: true,
                        },
                        navigation: {
                            nextEl: '.swiper-button-next',
                            prevEl: '.swiper-button-prev',
                        },
                        breakpoints: {
                            480: {
                                slidesPerView: 2.2,
                                spaceBetween: 15,
                                centeredSlides: false,
                            },
                            768: {
                                slidesPerView: 3.5,
                                spaceBetween: 20,
                                centeredSlides: false,
                            },
                            1024: {
                                slidesPerView: 5,
                                spaceBetween: 25,
                                centeredSlides: false,
                            },
                            1400: {
                                slidesPerView: 6,
                                spaceBetween: 30,
                                centeredSlides: false,
                            }
                        }
                    });
                    
                    console.log('Category slider initialized');
                } catch (e) {
                    console.warn('Category Swiper init failed', e);
                }
            }, 100);
        }
    };

    const initFoldableSidebar = () => {
        const toggleFoldBtn = elements['toggle-fold-sidebar'];
        const filterSidebar = elements['filter-sidebar'];
        
        if (!toggleFoldBtn || !filterSidebar) return;
        
        const isFolded = localStorage.getItem('sidebarFolded') === 'true';
        
        const mainLayout = document.querySelector('.main-layout');
        
        if (isFolded) {
            filterSidebar.classList.add('folded');
            if (mainLayout) mainLayout.classList.add('sidebar-folded');
            toggleFoldBtn.innerHTML = '<i class="fas fa-filter"></i>';
            toggleFoldBtn.title = "فتح التصفية";
        } else {
            toggleFoldBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
            toggleFoldBtn.title = "طي التصفية";
        }
        
        toggleFoldBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isFoldedNow = filterSidebar.classList.contains('folded');
            
            if (isFoldedNow) {
                filterSidebar.classList.remove('folded');
                if (mainLayout) mainLayout.classList.remove('sidebar-folded');
                toggleFoldBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
                toggleFoldBtn.title = "طي التصفية";
                localStorage.setItem('sidebarFolded', 'false');
            } else {
                // طي السايدبار
                filterSidebar.classList.add('folded');
                if (mainLayout) mainLayout.classList.add('sidebar-folded');
                toggleFoldBtn.innerHTML = '<i class="fas fa-filter"></i>';
                toggleFoldBtn.title = "فتح التصفية";
                localStorage.setItem('sidebarFolded', 'true');
            }
        });
    };

    // --- دالة إنشاء محتوى العرض السريع ---
    const createQuickViewContent = (product, similarProducts) => {
        const stockStatus = product.stock > 0 
            ? (product.stock <= 3 
                ? `<div class="quick-view-stock low-stock">باقي ${product.stock} فقط!</div>`
                : `<div class="quick-view-stock in-stock">متوفر في المخزون</div>`)
            : `<div class="quick-view-stock out-of-stock">نفد من المخزون</div>`;
        
        let similarProductsHTML = '';
        if (similarProducts && similarProducts.length > 0) {
            similarProductsHTML = `
                <div class="quick-view-similar">
                    <h4><i class="fas fa-random"></i> منتجات مشابهة</h4>
                    <div class="similar-products-grid">
                        ${similarProducts.map(item => `
                            <div class="similar-product-card" data-product-id="${item.id}">
                                <img src="${PROJECT_BASE}Controller/image.php?src=${encodeURIComponent(item.image)}&w=200&h=150&q=80" 
                                     alt="${escapeHtml(item.name)}"
                                     onerror="this.src='../../Assets/images/default-product.png'">
                                <div class="product-info">
                                    <div class="product-name">${escapeHtml(item.name)}</div>
                                    <div class="product-price">${formatPrice(item.price)}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        return `
            <button class="modal-close" aria-label="إغلاق"><i class="fas fa-times"></i></button>
            <div class="quick-view-grid">
                <div class="quick-view-image">
                    <img src="${PROJECT_BASE}Controller/image.php?src=${encodeURIComponent(product.image)}&w=500&h=500&q=95" 
                         alt="${escapeHtml(product.name)}"
                         onerror="this.src='../../Assets/images/default-product.png'">
                </div>
                <div class="quick-view-details">
                    <h2 class="quick-view-title">${escapeHtml(product.name)}</h2>
                    
                    <div class="quick-view-price">
                        <span class="current">${formatPrice(product.price)}</span>
                        ${product.old_price > product.price 
                            ? `<span class="old">${formatPrice(product.old_price)}</span>` 
                            : ''}
                    </div>
                    
                    ${stockStatus}
                    
                    <p class="quick-view-description">
                        ${escapeHtml(product.description || 'لا يوجد وصف مفصل لهذا المنتج.')}
                    </p>
                    
                    <div class="quick-view-buttons">
                        <button class="btn-primary add-to-cart-quick" 
                                data-id="${product.id}"
                                ${product.stock <= 0 ? 'disabled' : ''}>
                            <i class="fas fa-shopping-cart"></i> إضافة إلى السلة
                        </button>
                        <button class="toggle-wishlist-quick ${product.in_wishlist ? 'active' : ''}" 
                                data-id="${product.id}">
                            <i class="${product.in_wishlist ? 'fas' : 'far'} fa-heart"></i> 
                            ${product.in_wishlist ? 'مفضل' : 'إضافة للمفضلة'}
                        </button>
                        <a href="${PROJECT_BASE}Controller/product.php?id=${product.id}" class="btn-view-details">
                            <i class="fas fa-info-circle"></i> عرض التفاصيل الكاملة
                        </a>
                    </div>
                </div>
            </div>
            ${similarProductsHTML}
        `;
    };

    // --- دالة لربط أحداث العرض السريع ---
    const bindQuickViewEvents = (container) => {
        // ربط حدث الإغلاق
        const closeBtn = container.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.onclick = () => {
                const modal = document.getElementById('quick-view-modal');
                if (modal) {
                    modal.style.display = 'none';
                    modal.classList.remove('open');
                    const modalBody = document.getElementById('quick-view-body');
                    if (modalBody) modalBody.innerHTML = '';
                }
            };
        }

        // ربط حدث إضافة إلى السلة
        const addToCartBtn = container.querySelector('.add-to-cart-quick, .btn-add-cart');
        if (addToCartBtn) {
            addToCartBtn.addEventListener('click', async () => {
                const id = addToCartBtn.dataset.id;
                if (typeof addToCart === 'function') {
                    await addToCart(id, 1);
                }
            });
        }

        // ربط حدث المفضلة
        const wishlistBtn = container.querySelector('.toggle-wishlist-quick, .btn-wishlist');
        if (wishlistBtn) {
            wishlistBtn.addEventListener('click', async () => {
                const id = wishlistBtn.dataset.id;
                if (typeof toggleWishlist === 'function') {
                    await toggleWishlist(id, wishlistBtn);
                }
            });
        }

        // ربط أحداث المنتجات المشابهة
        const similarCards = container.querySelectorAll('.similar-card, .similar-product-card');
        similarCards.forEach(card => {
            card.addEventListener('click', async () => {
                const id = card.dataset.id || card.dataset.productId;
                if (id) {
                    const modalBody = document.getElementById('quick-view-body');
                    if (modalBody) {
                        modalBody.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:400px;width:100%;"><div class="loading-spinner"></div></div>';
                        const response = await fetch(`${PROJECT_BASE}Controller/product_quick.php?id=${encodeURIComponent(id)}`);
                        const html = await response.text();
                        modalBody.innerHTML = html;
                        bindQuickViewEvents(modalBody);
                    }
                }
            });
        });
    };

    // --- تحديث دالة العرض السريع ---
    const openQuickView = async (productId) => {
        const modal = elements['quick-view-modal'];
        const modalBody = elements['quick-view-body'];
        
        if (!modal || !modalBody) return;
        
        try {
            // استخدام تصميم جديد للعرض السريع
            modalBody.innerHTML = `
                <div class="quick-view-grid">
                    <div class="quick-view-image">
                        <div class="loading-spinner"></div>
                    </div>
                    <div class="quick-view-details">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
            `;
            
            // Show modal
            modal.style.display = 'flex';
            modal.classList.add('open');
            
            // تحميل المحتوى الفعلي
            const response = await fetch(`${PROJECT_BASE}Controller/product_quick.php?id=${encodeURIComponent(productId)}`);
            if (!response.ok) throw new Error('Network response was not ok');
            
            const html = await response.text();
            modalBody.innerHTML = html;
            
            // إضافة زر إغلاق مخصص للموبايل فوق الصورة
            if (document.documentElement.classList.contains('is-mobile')) {
                const closeBtnMobile = ce('button', {
                    className: 'modal-close-mobile',
                    innerHTML: '<i class="fas fa-times"></i>',
                    style: {
                        position: 'fixed',
                        top: '20px',
                        right: '20px',
                        zIndex: '9999',
                        background: 'rgba(0,0,0,0.5)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '50%',
                        width: '40px',
                        height: '40px',
                        fontSize: '20px',
                        cursor: 'pointer'
                    }
                });
                closeBtnMobile.onclick = () => {
                    modal.style.display = 'none';
                    modal.classList.remove('open');
                    modalBody.innerHTML = '';
                };
                modalBody.appendChild(closeBtnMobile);
            }
            
            // ربط الأحداث للعرض السريع
            bindQuickViewEvents(modalBody);
            
            // إعداد حدث الإغلاق للمودال نفسه
            const closeBtn = modal.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.onclick = () => {
                    modal.style.display = 'none';
                    modal.classList.remove('open');
                    modalBody.innerHTML = '';
                };
            }
            
            // إغلاق عند النقر خارج المودال
            const overlay = modal.querySelector('.modal-overlay');
            if (overlay) {
                overlay.onclick = () => {
                    modal.style.display = 'none';
                    modal.classList.remove('open');
                    modalBody.innerHTML = '';
                };
            }
            
            // إغلاق بالزر Escape
            const closeOnEscape = (e) => {
                if (e.key === 'Escape') {
                    modal.style.display = 'none';
                    modal.classList.remove('open');
                    modalBody.innerHTML = '';
                    document.removeEventListener('keydown', closeOnEscape);
                }
            };
            document.addEventListener('keydown', closeOnEscape);
            
        } catch (error) {
            console.error('Error loading quick view:', error);
            showToast('تعذر تحميل معاينة المنتج', 'error');
            const modal = elements['quick-view-modal'];
            if (modal) {
                modal.style.display = 'none';
                modal.classList.remove('open');
            }
        }
    };

    // --- Initialization ---
    const init = () => {
        initPremiumEffects();
        cacheElements();
        
        // Load PHP variables
        try {
            const varsEl = elements['php-vars'] || document.getElementById('php-vars');
            const rawText = varsEl && varsEl.textContent ? varsEl.textContent.trim() : '';
            
            if (rawText) {
                try {
                    STATE.phpVars = JSON.parse(rawText);
                } catch (firstErr) {
                    try {
                        const cleaned = rawText
                            .trim()
                            .replace(/,\s*}/g, '}')
                            .replace(/,\s*\]/g, ']')
                            .replace(/'/g, '"')
                            .replace(/([A-Za-z0-9_$]+)\s*:/g, '"$1":');

                        STATE.phpVars = JSON.parse(cleaned);
                    } catch (secondErr) {
                        console.error('Failed to clean/parse php-vars:', firstErr, secondErr);
                        STATE.phpVars = {
                            page: 1,
                            hasNextPage: false,
                            total: 0,
                            searchQuery: '',
                            category: '',
                            min: '',
                            max: '',
                            sort: ''
                        };
                    }
                }
            } else {
                STATE.phpVars = {
                    page: 1,
                    hasNextPage: false,
                    total: 0,
                    searchQuery: '',
                    category: '',
                    min: '',
                    max: '',
                    sort: ''
                };
            }

            // Normalize values
            STATE.page = Number(STATE.phpVars.page) || 1;
            STATE.hasNextPage = Boolean(STATE.phpVars.hasNextPage);
            if (STATE.phpVars.category) STATE.filters.category = STATE.phpVars.category;
            if (STATE.phpVars.min) STATE.filters.min = STATE.phpVars.min;
            if (STATE.phpVars.max) STATE.filters.max = STATE.phpVars.max;
            if (STATE.phpVars.sort) STATE.filters.sort = STATE.phpVars.sort;
        } catch (e) {
            console.error('Error parsing PHP variables', e);
            STATE.phpVars = {
                page: 1,
                hasNextPage: false,
                total: 0,
                searchQuery: '',
                category: '',
                min: '',
                max: '',
                sort: ''
            };
            STATE.page = 1;
            STATE.hasNextPage = false;
        }

        // Initialize page
        initPage();
        
        // Check for pending reviews
        checkPendingReviews();
        
        // Event Listeners
        setupEventListeners();
        
        // Infinite Scroll
        setupInfiniteScroll();

        // Initial UI Adjustments
        handleScroll();

        // User Menu Toggle
        const userAvatar = document.getElementById('user-avatar-trigger');
        const userDropdown = document.getElementById('user-dropdown-menu');
        
        if (userAvatar && userDropdown) {
            userAvatar.addEventListener('click', (e) => {
                // Toggle only if clicking the avatar itself or the image, not the dropdown items
                if (e.target.closest('#user-dropdown-menu')) return;
                
                e.stopPropagation();
                userDropdown.classList.toggle('active');
            });

            // Prevent closing when clicking inside the dropdown
            userDropdown.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            document.addEventListener('click', (e) => {
                if (!userAvatar.contains(e.target)) {
                    userDropdown.classList.remove('active');
                }
            });
        }

        // Rating functionality
        document.addEventListener('click', async (e) => {
            const star = e.target.closest('.product-rating-v2 .stars i');
            if (star) {
                e.preventDefault();
                e.stopPropagation();
                
                const ratingDiv = star.closest('.product-rating-v2');
                const card = ratingDiv.closest('.product-card-v2');
                const productId = card ? card.dataset.id : null;
                
                if (!productId) return;
                
                const stars = Array.from(ratingDiv.querySelectorAll('.stars i'));
                const ratingValue = stars.indexOf(star) + 1;
                
                try {
                    const response = await fetch(PROJECT_BASE + 'Api/rate_product.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: `product_id=${productId}&rating=${ratingValue}&csrf_token=${STATE.phpVars.csrf_token || ''}`
                    });
                    
                    const data = await response.json();
                    if (data.success) {
                        showToast(data.msg || 'تم تقييم المنتج بنجاح', 'success');
                        stars.forEach((s, i) => {
                            if (i < ratingValue) {
                                s.className = 'fas fa-star';
                            } else {
                                s.className = 'far fa-star';
                            }
                        });
                        ratingDiv.style.pointerEvents = 'none';
                        ratingDiv.style.opacity = '0.7';
                    } else {
                        showToast(data.msg, 'error');
                    }
                } catch (err) {
                    console.error('Rating error:', err);
                    showToast('حدث خطأ أثناء التقييم', 'error');
                }
            }
        });
        
        // Category filter click
        document.addEventListener('click', (event) => {
            const categoryRadio = event.target.closest('.custom-radio input[name="category"]');
            if (categoryRadio) {
                const categoryId = categoryRadio.value;
                window.filterAndScroll(categoryId);
            }
        });
        
        // Hide Preloader
        window.addEventListener('load', () => {
            setTimeout(() => {
                if (elements.preloader) {
                    elements.preloader.style.opacity = '0';
                    setTimeout(() => elements.preloader.style.display = 'none', 500);
                }
            }, 800);
        });

        // Load initial products if container is empty
        if (elements['products-container'] && elements['products-container'].children.length <= 1) {
            loadProducts(true);
        }

        // Initialize additional features
        initCategorySlider();
        initFoldableSidebar();
        
        // Initialize smart features after a delay
        setTimeout(() => {
            init3DTilt();
            initCountdownTimer();
            initWhatsAppFloat();
        }, 500);
    };

    // --- Page Initialization ---
    const initPage = async () => {
        try {
            document.documentElement.classList.remove('preload');
            
            const data = await fetchHomeData();
            
            // Update application state
            STATE.phpVars = data.phpVars || STATE.phpVars;
            STATE.page = STATE.phpVars.page || STATE.page || 1;
            STATE.hasNextPage = Boolean(STATE.phpVars.hasNextPage);
            
            // Update counters
            if (data.counts) {
                updateCartCount(data.counts.cart || 0);
                updateWishlistCount(data.counts.wishlist || 0);
                updateCompareBar(data.counts.compare || 0);
            }
            
            // Update user navigation
            if (elements['nav-user-links']) {
                if (data.logged_in) {
                    elements['nav-user-links'].innerHTML = 
                        `| <a href="${PROJECT_BASE}Controller/my_orders.php">📦 طلباتي</a> |
                         <a href="${PROJECT_BASE}Controller/profile.php">👤 ${escapeHtml(data.user?.name || '')}</a> |
                         <a href="${PROJECT_BASE}Controller/logout_user.php" class="logout-link">تسجيل الخروج</a>`;
                } else {
                    elements['nav-user-links'].innerHTML = 
                        '| <a href="' + PROJECT_BASE + 'Controller/login.php">تسجيل دخول</a> | <a href="' + PROJECT_BASE + 'Controller/register.php">تسجيل جديد</a>';
                }
            }
            
            // Update search input
            if (elements['search-input'] && STATE.phpVars.searchQuery) {
                elements['search-input'].value = STATE.phpVars.searchQuery;
            }
            
            // Update sort options
            if (elements['sort-products']) {
                const currentUrl = new URL(window.location.href);
                const currentSort = currentUrl.searchParams.get('sort');
                if (currentSort) {
                    elements['sort-products'].value = currentSort;
                }
            }
            
            // Build categories
            if (elements['category-hub-container'] && Array.isArray(data.categories)) {
                elements['category-hub-container'].innerHTML = '';
                data.categories.forEach(category => {
                    elements['category-hub-container'].appendChild(buildCategoryCard(category));
                });
            }
            
            // Build featured products
            if (elements['featured-offers-container'] && Array.isArray(data.featured) && data.featured.length > 0) {
                buildFeaturedProducts(data.featured);
            } else if (elements['featured-offers-container']) {
                elements['featured-offers-container'].innerHTML = '';
            }

            // Build random products
            const randomContainer = document.getElementById('random-products-container');
            if (randomContainer && Array.isArray(data.random) && data.random.length > 0) {
                buildRandomProducts(data.random);
            } else if (randomContainer) {
                randomContainer.innerHTML = '';
            }
            
            // Build products
            if (elements['products-container']) {
                elements['products-container'].innerHTML = '';
                
                if (Array.isArray(data.products) && data.products.length > 0) {
                    data.products.forEach(product => {
                        elements['products-container'].appendChild(buildProductCard(product));
                        STATE.productsLoaded++;
                    });
                } else {
                    elements['products-container'].innerHTML = 
                        '<p style="text-align:center; padding: 40px; color: #666;">لا توجد منتجات حالياً.</p>';
                }
            }
            
            // Update search info
            if (elements['search-term']) elements['search-term'].textContent = STATE.phpVars.searchQuery || '';
            if (elements['total-results']) elements['total-results'].textContent = STATE.phpVars.total || 0;
            
            // Update year in footer
            if (elements.year) elements.year.textContent = new Date().getFullYear();
            
            // Initialize AOS
            if (window.AOS) {
                try {
                    AOS.init({
                        duration: 800,
                        once: true,
                        mirror: false,
                        offset: 100,
                    });
                } catch (e) {
                    console.warn('AOS init failed', e);
                }
            }
            
            // Update Load More button
            updateLoadMoreButton();
            
        } catch (error) {
            console.error('Error initializing page:', error);
            showToast('حدث خطأ في تحميل الصفحة. يرجى المحاولة مرة أخرى.', 'error');
        }
    };

    // --- Event Listeners Setup ---
    const setupEventListeners = () => {
        // Scroll Effect
        window.addEventListener('scroll', handleScroll);

        // Search Toggle
        const searchTrigger = document.querySelector('.search-trigger');
        const searchWrapper = document.querySelector('.search-wrapper');
        
        if (searchTrigger && searchWrapper) {
            searchTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                searchWrapper.classList.toggle('active');
                if (searchWrapper.classList.contains('active')) {
                    const input = searchWrapper.querySelector('input');
                    if (input) input.focus();
                }
            });
        }

        // Close search when clicking outside
        document.addEventListener('click', (e) => {
            if (searchWrapper && searchWrapper.classList.contains('active') && 
                !searchWrapper.contains(e.target) && !searchTrigger.contains(e.target)) {
                searchWrapper.classList.remove('active');
            }
        });

        // Search Overlay
        if (elements['search-open'] && elements['search-overlay']) {
            elements['search-open'].addEventListener('click', () => 
                elements['search-overlay'].classList.add('active'));
        }
        if (elements['search-close'] && elements['search-overlay']) {
            elements['search-close'].addEventListener('click', () => 
                elements['search-overlay'].classList.remove('active'));
        }

        // Mobile Filter Toggle
        if (elements['toggle-filters'] && elements['filter-sidebar']) {
            elements['toggle-filters'].addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                elements['filter-sidebar'].classList.add('active');
                // لا نجمد السكرول هنا بناءً على طلب المستخدم
            });
        }

        // Close Sidebar X Button
        const closeBtnX = document.getElementById('close-sidebar-x');
        if (closeBtnX && elements['filter-sidebar']) {
            closeBtnX.addEventListener('click', () => {
                elements['filter-sidebar'].classList.remove('active');
                document.body.style.overflow = '';
            });
        }

        // Theme Switcher
        if (elements['theme-switcher']) {
            elements['theme-switcher'].addEventListener('click', (e) => {
                e.preventDefault();
                toggleTheme();
            });
        }

        // Filter Form - Instant Filtering
        if (elements['filter-form']) {
            const filterInputs = elements['filter-form'].querySelectorAll('input, select');
            filterInputs.forEach(input => {
                input.addEventListener('change', () => {
                    applyFilters();
                });
            });
        }

        if (elements['apply-filters']) {
            elements['apply-filters'].addEventListener('click', applyFilters);
        }

        // Sort Change
        if (elements['sort-products']) {
            elements['sort-products'].addEventListener('change', (e) => {
                STATE.filters.sort = e.target.value;
                STATE.page = 1;
                loadProducts(true);
            });
        }

        // Clear Filters - AJAX Reset
        if (elements['clear-filters']) {
            elements['clear-filters'].addEventListener('click', (e) => {
                e.preventDefault();
                if (elements['filter-form']) {
                    elements['filter-form'].reset();
                    // Reset hidden inputs if any
                    const hiddenInputs = elements['filter-form'].querySelectorAll('input[type="hidden"]');
                    hiddenInputs.forEach(input => {
                        if (input.name !== 'csrf_token') input.value = '';
                    });
                }
                STATE.filters = { category: '', min: '', max: '', sort: '' };
                STATE.page = 1;
                
                // Update URL without reload
                const url = new URL(window.location.origin + window.location.pathname);
                window.history.pushState({}, '', url);
                
                loadProducts(true);
            });
        }

        // Load More Button
        if (elements['load-more-btn']) {
            elements['load-more-btn'].addEventListener('click', loadMoreProducts);
        }

        // Search Form - AJAX Search
        if (elements['search-form']) {
            elements['search-form'].addEventListener('submit', (e) => {
                e.preventDefault();
                const searchInput = elements['search-input'];
                if (searchInput) {
                    const query = searchInput.value.trim();
                    const url = new URL(window.location);
                    if (query) url.searchParams.set('q', query);
                    else url.searchParams.delete('q');
                    window.history.pushState({}, '', url);
                    
                    STATE.page = 1;
                    loadProducts(true);
                }
            });
        }

        // Setup additional handlers
        initSearchSuggestions();
        initCompareBar();
        setupProductEventHandlers();
        
        // إظهار زر التصفية في الموبايل
        if (window.innerWidth < 992 && elements['toggle-filters']) {
            elements['toggle-filters'].style.display = 'flex';
        }

        // إغلاق الشريط الجانبي عند النقر خارجيه
        document.addEventListener('click', (event) => {
            if (elements['filter-sidebar'] && 
                elements['filter-sidebar'].classList.contains('active') &&
                !elements['filter-sidebar'].contains(event.target) &&
                !(elements['toggle-filters'] && elements['toggle-filters'].contains(event.target))) {
                elements['filter-sidebar'].classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    };

    // --- Core Functions ---
    const handleScroll = () => {
        if (!elements['main-header']) return;
        
        if (window.scrollY > 50) {
            elements['main-header'].classList.add('scrolled');
        } else {
            elements['main-header'].classList.remove('scrolled');
        }
    };

    const toggleTheme = () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        
        // Add transition effect
        document.body.style.transition = 'background-color 0.5s ease, color 0.5s ease';
        
        if (elements['theme-switcher']) {
            elements['theme-switcher'].style.transform = 'rotate(360deg)';
            setTimeout(() => {
                elements['theme-switcher'].innerHTML = isDark ? 
                    '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
                elements['theme-switcher'].style.transform = 'rotate(0deg)';
            }, 250);
        }
        
        // Update meta theme color
        const themeColor = isDark ? '#0f172a' : '#D4AF37';
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
        
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        
        showToast(isDark ? 'تم تفعيل الوضع الليلي الفاخر' : 'تم تفعيل الوضع النهاري المشرق', 'info');
    };

    const setupInfiniteScroll = () => {
        if (!elements['infinite-scroll-trigger']) return;

        // Hide loading message initially if no next page
        if (!STATE.hasNextPage) {
            elements['infinite-scroll-trigger'].style.display = 'none';
        }

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !STATE.isLoading && STATE.hasNextPage) {
                STATE.page++;
                loadProducts();
            }
        }, { threshold: 0.1 });

        observer.observe(elements['infinite-scroll-trigger']);
    };

    const applyFilters = (e) => {
        if (e) e.preventDefault();
        
        const formData = new FormData(elements['filter-form']);
        STATE.filters.category = formData.get('category') || '';
        STATE.filters.min = formData.get('min') || '';
        STATE.filters.max = formData.get('max') || '';
        STATE.page = 1;
        
        // تحديث الـ URL بدون إعادة تحميل الصفحة
        const url = new URL(window.location);
        if (STATE.filters.category) url.searchParams.set('category', STATE.filters.category);
        else url.searchParams.delete('category');
        if (STATE.filters.min) url.searchParams.set('min', STATE.filters.min);
        else url.searchParams.delete('min');
        if (STATE.filters.max) url.searchParams.set('max', STATE.filters.max);
        else url.searchParams.delete('max');
        window.history.pushState({}, '', url);
        
        loadProducts(true);
        
        // لا نغلق النافذة تلقائياً عند اختيار فئة، المستخدم يغلقها بـ X
    };

    // معالجة زر الرجوع في المتصفح
    window.addEventListener('popstate', () => {
        const urlParams = new URLSearchParams(window.location.search);
        STATE.filters.category = urlParams.get('category') || '';
        STATE.filters.min = urlParams.get('min') || '';
        STATE.filters.max = urlParams.get('max') || '';
        STATE.page = 1;
        
        // تحديث قيم الفورم
        if (elements['filter-form']) {
            const catInput = elements['filter-form'].querySelector('[name="category"]');
            if (catInput) catInput.value = STATE.filters.category;
            // ... تحديث باقي الحقول إذا لزم الأمر
        }
        
        loadProducts(true);
    });

    // --- Path Helper ---
    const getBaseUrl = () => {
        // يحصل على المسار الأساسي للمشروع بناءً على موقع ملف Home.js
        // بما أن Home.js موجود في Assets/js/Home.js، فإننا نعود مستويين للخلف
        const scriptTags = document.getElementsByTagName('script');
        for (let i = 0; i < scriptTags.length; i++) {
            if (scriptTags[i].src.includes('Assets/js/Home.js')) {
                const scriptPath = scriptTags[i].src;
                return scriptPath.substring(0, scriptPath.indexOf('Assets/js/Home.js'));
            }
        }
        // Fallback: استخدام المسار الحالي إذا فشل تحديد مسار السكريبت
        const path = window.location.pathname;
        return window.location.origin + path.substring(0, path.lastIndexOf('/Views/') + 1);
    };

    const PROJECT_BASE = getBaseUrl();

    // --- Data Fetching ---
    const fetchHomeData = async (params = {}) => {
        const url = new URL(PROJECT_BASE + 'Controller/Home.php');

        // Copy current search params
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.forEach((value, key) => {
            url.searchParams.set(key, value);
        });

        // Apply additional parameters
        Object.keys(params).forEach(key => {
            if (params[key] === null) {
                url.searchParams.delete(key);
            } else {
                url.searchParams.set(key, params[key]);
            }
        });

        // Ensure JSON format
        url.searchParams.set('format', 'json');
        
        const fetchOptions = {
            credentials: 'same-origin',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        };

        try {
            const response = await fetch(url.toString(), fetchOptions);
            if (!response.ok) throw new AppError(`HTTP ${response.status}`, 'NETWORK_ERROR');

            const data = await response.json();
            if (!data || !data.ok) throw new AppError('Invalid API response', 'API_ERROR');

            return data;
        } catch (error) {
            console.error('Fetch error:', error);
            throw error;
        }
    };

    const loadProducts = async (reset = false) => {
        if (STATE.isLoading) return;
        STATE.isLoading = true;
        
        if (reset && elements['products-container']) {
            const loadingOverlay = elements['products-container'].querySelector('.products-loading-overlay');
            if (!loadingOverlay) {
                const loadingDiv = ce('div', {
                    className: 'products-loading-overlay',
                    innerHTML: `
                        <div class="loading-spinner" style="width: 50px; height: 50px; margin: 0 auto;"></div>
                        <p>جاري التحميل...</p>
                    `
                });
                elements['products-container'].innerHTML = '';
                elements['products-container'].appendChild(loadingDiv);
            }
            STATE.productsLoaded = 0;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const params = {
            page: STATE.page,
            category: STATE.filters.category || urlParams.get('category') || '',
            min: STATE.filters.min || urlParams.get('min') || '',
            max: STATE.filters.max || urlParams.get('max') || '',
            sort: STATE.filters.sort || urlParams.get('sort') || '',
            q: urlParams.get('q') || ''
        };

        try {
            const data = await fetchHomeData(params);

            if (data.ok) {
                // Remove loading overlay
                const loadingOverlay = elements['products-container'].querySelector('.products-loading-overlay');
                if (loadingOverlay) {
                    loadingOverlay.remove();
                }
                
                // Clear products if reset
                if (reset && elements['products-container']) {
                    elements['products-container'].innerHTML = '';
                }
                
                renderProducts(data.products);
                STATE.hasNextPage = data.phpVars.hasNextPage;
                
                if (elements['total-results']) {
                    elements['total-results'].textContent = data.phpVars.total || 0;
                }
                
                // Update search term
                if (elements['search-term'] && STATE.filters.category) {
                    const categoryName = document.querySelector(`input[name="category"][value="${STATE.filters.category}"]`)?.nextElementSibling?.textContent;
                    if (categoryName) {
                        elements['search-term'].textContent = categoryName.split('(')[0].trim();
                    }
                }
                
                if (!STATE.hasNextPage && elements['infinite-scroll-trigger']) {
                    elements['infinite-scroll-trigger'].style.display = 'none';
                }
                
                // Refresh AOS for new elements
                if (window.AOS) {
                    AOS.refresh();
                }
            }
        } catch (error) {
            console.error('Failed to load products', error);
            showToast('حدث خطأ في تحميل المنتجات', 'error');
        } finally {
            STATE.isLoading = false;
            updateLoadMoreButton();
        }
    };

    const loadMoreProducts = async () => {
        if (!STATE.hasNextPage || STATE.isLoading) return;
        
        STATE.isLoading = true;
        if (elements['load-more-btn']) elements['load-more-btn'].disabled = true;
        if (elements['loading-spinner']) elements['loading-spinner'].style.display = 'block';
        
        try {
            const nextPage = STATE.page + 1;
            const data = await fetchHomeData({ page: nextPage });
            
            if (Array.isArray(data.products) && data.products.length > 0) {
                renderProducts(data.products);
                STATE.page = nextPage;
                STATE.hasNextPage = Boolean(data.phpVars.hasNextPage);
            }
        } catch (error) {
            console.error('Error loading more products:', error);
            showToast('حدث خطأ في تحميل المزيد من المنتجات.', 'error');
        } finally {
            STATE.isLoading = false;
            if (elements['loading-spinner']) elements['loading-spinner'].style.display = 'none';
            updateLoadMoreButton();
        }
    };

    // --- Rendering Functions ---
    const renderProducts = (products) => {
        const fragment = document.createDocumentFragment();
        
        products.forEach(prod => {
            const card = buildProductCard(prod);
            fragment.appendChild(card);
            STATE.productsLoaded++;
        });

        if (elements['products-container']) {
            elements['products-container'].appendChild(fragment);
        }
        
        // Re-initialize features for new elements
        setTimeout(() => {
            init3DTilt();
            initCountdownTimer();
        }, 100);

        // Trigger AOS for new elements
        if (window.AOS) window.AOS.refresh();
    };

    const initMagneticButtons = () => {
        // Disabled as requested to keep buttons stable
        return;
    };

    const buildProductCard = (prod) => {
        const article = ce('article', {
            className: 'product-card-v2',
            dataset: { id: prod.id, stock: prod.stock }
        });
        
        article.setAttribute('data-aos', 'luxury-reveal');
        
        // Product badges
        const badges = ce('div', { className: 'product-badges' });
        
        if (prod.is_new) {
            badges.appendChild(ce('span', {
                className: 'badge-v2 badge-new',
                textContent: 'جديد'
            }));
        }
        
        if (prod.discount > 0) {
            badges.appendChild(ce('span', {
                className: 'badge-v2 badge-discount',
                textContent: `-${prod.discount}%`
            }));
        }
        
        if (prod.stock <= 0) {
            badges.appendChild(ce('span', {
                className: 'badge-v2 badge-out',
                textContent: 'نفد'
            }));
        } else if (prod.stock > 0 && prod.stock <= 3) {
            badges.appendChild(ce('span', {
                className: 'badge-v2 badge-stock-low',
                textContent: `باقي ${prod.stock} فقط!`,
                style: { background: '#e74c3c', color: '#fff', fontWeight: 'bold' }
            }));
        }
        
        // Product image
        const imageDiv = ce('div', { className: 'product-image-v2 skeleton' });
        const img = ce('img', {
            src: `${PROJECT_BASE}Controller/image.php?src=${encodeURIComponent(prod.image)}&w=400&h=400&q=90`,
            alt: prod.name,
            loading: 'lazy',
            width: 400,
            height: 400
        });
        
        img.onload = () => imageDiv.classList.remove('skeleton');
        img.onerror = function() {
            this.onerror = null;
            this.src = '../../Assets/images/default-product.png';
            imageDiv.classList.remove('skeleton');
        };
        
        imageDiv.appendChild(badges);
        imageDiv.appendChild(img);
        
        // Product actions
        const actions = ce('div', { className: 'product-actions-v2' });
        
        actions.appendChild(ce('button', {
            className: 'btn-action-v2 add-cart',
            dataset: { id: prod.id },
            innerHTML: '<i class="fas fa-shopping-cart"></i>',
            title: 'أضف للسلة'
        }));
        
        actions.appendChild(ce('button', {
            className: `btn-action-v2 toggle-wishlist ${prod.in_wishlist ? 'active' : ''}`,
            dataset: { id: prod.id },
            innerHTML: '<i class="fas fa-heart"></i>',
            title: prod.in_wishlist ? 'إزالة من المفضلة' : 'أضف للمفضلة'
        }));
        
        actions.appendChild(ce('button', {
            className: 'btn-action-v2 toggle-compare',
            dataset: { id: prod.id, status: prod.in_compare ? 'added' : 'removed' },
            innerHTML: '<i class="fas fa-balance-scale"></i>',
            title: prod.in_compare ? 'إزالة من المقارنة' : 'أضف للمقارنة'
        }));
        
        actions.appendChild(ce('button', {
            className: 'btn-action-v2 quick-view',
            dataset: { id: prod.id },
            innerHTML: '<i class="far fa-eye"></i>',
            title: 'عرض سريع'
        }));
        
        imageDiv.appendChild(actions);
        article.appendChild(imageDiv);
        
        // Product info
        const info = ce('div', { className: 'product-info-v2' });
        
        // Product title
        info.appendChild(ce('h3', {
            className: 'product-title-v2',
            innerHTML: `<a href="${PROJECT_BASE}Controller/product.php?id=${encodeURIComponent(prod.id)}">${escapeHtml(prod.name)}</a>`
        }));
        
        // Product price
        const priceDiv = ce('div', { className: 'product-price-v2' });
        priceDiv.appendChild(ce('span', {
            className: 'current-price',
            textContent: formatPrice(prod.price)
        }));
        
        if (prod.old_price > prod.price) {
            priceDiv.appendChild(ce('span', {
                className: 'old-price',
                textContent: formatPrice(prod.old_price)
            }));
        }
        
        info.appendChild(priceDiv);

        // Countdown Timer
        if (prod.countdown) {
            const countdownDiv = ce('div', {
                className: 'product-countdown-v2',
                dataset: { countdown: prod.countdown }
            });
            info.appendChild(countdownDiv);
        }
        
        // Stock information
        if (prod.stock > 0 && prod.stock <= 3) {
            const stockInfo = ce('div', {
                className: 'product-stock-info low-stock',
                textContent: `باقي ${prod.stock} فقط!`
            });
            info.appendChild(stockInfo);
        } else if (prod.stock > 3) {
            const stockInfo = ce('div', {
                className: 'product-stock-info in-stock',
                textContent: 'متوفر في المخزون'
            });
            info.appendChild(stockInfo);
        }
        
        // Rating
        const ratingDiv = ce('div', {
            className: 'product-rating-v2',
            dataset: { productId: prod.id }
        });
        
        const stars = ce('div', { className: 'stars' });
        const rating = parseFloat(prod.rating || 0);
        
        for (let i = 1; i <= 5; i++) {
            let starClass = 'far fa-star';
            if (i <= rating) {
                starClass = 'fas fa-star';
            } else if (i === Math.ceil(rating) && (rating % 1) >= 0.5) {
                starClass = 'fas fa-star-half-alt';
            }
            stars.appendChild(ce('i', { className: starClass }));
        }
        
        stars.appendChild(ce('span', {
            className: 'rating-count',
            textContent: `(${prod.rating_count || 0})`
        }));
        
        // Add Comments Icon
        const commentsBtn = ce('button', {
            className: 'btn-comments',
            innerHTML: '<i class="fas fa-comments"></i>',
            title: 'التعليقات',
            onclick: (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.HomeApp.openCommentsModal(prod.id);
            }
        });
        stars.appendChild(commentsBtn);
        
        ratingDiv.appendChild(stars);
        info.appendChild(ratingDiv);
        article.appendChild(info);
        return article;
    };

    const buildCategoryCard = (category) => {
        const card = ce('div', { className: 'category-card' });
        
        const img = ce('img', {
            src: `../../Assets/images/${encodeURIComponent(category.image || '')}`,
            alt: category.name,
            loading: 'lazy'
        });
        
        const h3 = ce('h3', { textContent: category.name || '' });
        const p = ce('p', { textContent: `${category.count || 0} منتج` });
        
        card.appendChild(img);
        card.appendChild(h3);
        card.appendChild(p);
        
        card.onclick = () => {
            window.filterAndScroll(category.id);
        };
        
        return card;
    };

    const buildFeaturedProducts = (featuredProducts) => {
        const container = elements['featured-offers-container'];
        if (!container) return;
        
        // Shuffle featured products
        const shuffled = [...featuredProducts].sort(() => 0.5 - Math.random());
        
        container.innerHTML = '';
        
        shuffled.forEach(product => {
            const slide = ce('div', { className: 'swiper-slide' });
            const article = ce('article', {
                className: 'product-card featured-card',
                dataset: { productId: product.id }
            });
            
            article.innerHTML = `
                <a href="${PROJECT_BASE}Controller/product.php?id=${encodeURIComponent(product.id)}">
                    <div class="product-media">
                        <img src="../../Assets/images/${product.image}" 
                             alt="${escapeHtml(product.name)}" 
                             loading="lazy">
                    </div>
                    <div class="product-content">
                        <h3 class="product-title">${escapeHtml(product.name)}</h3>
                        <div class="product-price">
                            <span class="current-price">${formatPrice(product.price)}</span>
                            ${product.old_price > product.price ? 
                                `<span class="old-price">${formatPrice(product.old_price)}</span>` : ''}
                        </div>
                    </div>
                </a>
            `;
            slide.appendChild(article);
            container.appendChild(slide);
        });
        
        // Initialize Swiper
        setTimeout(() => {
            if (typeof Swiper !== 'undefined') {
                try {
                    new Swiper('.featured-slider', {
                        direction: 'horizontal',
                        loop: true,
                        autoplay: {
                            delay: 3000,
                            disableOnInteraction: false,
                        },
                        pagination: {
                            el: '.swiper-pagination',
                            clickable: true,
                        },
                        navigation: {
                            nextEl: '.swiper-button-next',
                            prevEl: '.swiper-button-prev',
                        },
                        breakpoints: {
                            1400: { slidesPerView: 4, spaceBetween: 30 },
                            1024: { slidesPerView: 3, spaceBetween: 25 },
                            768: { slidesPerView: 2, spaceBetween: 20 },
                            480: { slidesPerView: 1.5, spaceBetween: 15, centeredSlides: false },
                            0: { slidesPerView: 1.2, spaceBetween: 10, centeredSlides: true }
                        }
                    });
                } catch (e) {
                    console.warn('Swiper init failed', e);
                }
            }
        }, 100);
    };

    const buildRandomProducts = (products) => {
        const container = document.getElementById('random-products-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        products.forEach(product => {
            const slide = ce('div', { className: 'swiper-slide' });
            const card = buildProductCard(product);
            slide.appendChild(card);
            container.appendChild(slide);
        });
        
        // Initialize Swiper
        setTimeout(() => {
            if (typeof Swiper !== 'undefined') {
                try {
                    new Swiper('.random-products-slider', {
                        direction: 'horizontal',
                        loop: true,
                        autoplay: {
                            delay: 4000,
                            disableOnInteraction: false,
                        },
                        pagination: {
                            el: '.swiper-pagination',
                            clickable: true,
                        },
                        navigation: {
                            nextEl: '.swiper-button-next',
                            prevEl: '.swiper-button-prev',
                        },
                        breakpoints: {
                            1400: { slidesPerView: 4, spaceBetween: 30 },
                            1024: { slidesPerView: 3, spaceBetween: 25 },
                            768: { slidesPerView: 2, spaceBetween: 20 },
                            480: { slidesPerView: 1.5, spaceBetween: 15, centeredSlides: false },
                            0: { slidesPerView: 1.2, spaceBetween: 10, centeredSlides: true }
                        }
                    });
                } catch (e) {
                    console.warn('Swiper init failed', e);
                }
            }
        }, 100);
    };

    // --- Update Functions ---
    const updateLoadMoreButton = () => {
        if (!elements['load-more-btn']) return;
        
        if (STATE.hasNextPage) {
            elements['load-more-btn'].style.display = 'block';
            elements['load-more-btn'].disabled = STATE.isLoading;
            elements['load-more-btn'].textContent = STATE.isLoading ? 'جاري التحميل...' : 'عرض المزيد';
        } else {
            elements['load-more-btn'].style.display = 'none';
        }
    };

    const updateCartCount = (count) => {
        if (elements['cart-count']) elements['cart-count'].textContent = count;
    };

    const updateWishlistCount = (count) => {
        if (elements['wishlist-count']) elements['wishlist-count'].textContent = count;
    };

    const updateCompareBar = (count) => {
        const bar = document.getElementById('compare-bar');
        const text = document.getElementById('compare-count-text');
        
        if (!bar) {
            console.error('Compare bar element not found in DOM');
            return;
        }
        
        if (count > 0) {
            // التأكد من وجود الكلاسات اللازمة للظهور
            bar.classList.add('compare-bar-premium');
            bar.style.setProperty('display', 'block', 'important');
            
            // Force reflow
            bar.offsetHeight;
            
            bar.classList.add('active');
            bar.classList.add('show'); // إضافة كلاس show أيضاً لزيادة التأكيد
            
            if (text) text.textContent = count;
            console.log('Compare bar shown with count:', count);
        } else {
            bar.classList.remove('active');
            setTimeout(() => {
                if (!bar.classList.contains('active')) {
                    bar.style.setProperty('display', 'none', 'important');
                }
            }, 500);
        }
    };

    // --- Product Actions ---
    const addToCart = async (productId, quantity = 1) => {
        try {
            const response = await fetch(`${PROJECT_BASE}Api/add_to_cart.php?id=${encodeURIComponent(productId)}&qty=${encodeURIComponent(quantity)}`, {
                credentials: 'same-origin'
            });
            
            const data = await response.json();
            
            if (data.success) {
                showToast(data.msg || 'تمت إضافة المنتج إلى السلة', 'success');
                updateCartCount(data.cart_count || 0);
                
                // Update stock in UI
                const productCard = document.querySelector(`.product-card-v2[data-id="${productId}"]`);
                if (productCard && data.remaining !== undefined) {
                    productCard.dataset.stock = data.remaining;
                    
                    const badges = productCard.querySelector('.product-badges');
                    if (badges) {
                        const stockBadge = badges.querySelector('.badge-stock');
                        if (stockBadge) stockBadge.remove();
                        
                        if (data.remaining <= 0) {
                            const outOfStock = badges.querySelector('.badge-out');
                            if (!outOfStock) {
                                badges.appendChild(ce('span', {
                                    className: 'badge-v2 badge-out',
                                    textContent: 'نفد'
                                }));
                            }
                        } else if (data.remaining < 5) {
                            badges.appendChild(ce('span', {
                                className: 'badge-v2 badge-stock',
                                textContent: `باقي ${data.remaining}`,
                                style: { background: '#d32f2f' }
                            }));
                        }
                    }
                }
                
                return true;
            } else {
                showToast(data.msg || 'فشل إضافة المنتج إلى السلة', 'error');
                return false;
            }
        } catch (error) {
            console.error('Error adding to cart:', error);
            showToast('حدث خطأ في إضافة المنتج إلى السلة', 'error');
            return false;
        }
    };

    const toggleWishlist = async (productId, button) => {
        try {
            if (button) button.disabled = true;
            
            const response = await fetch(`${PROJECT_BASE}Api/wishlist_action.php?action=toggle&id=${encodeURIComponent(productId)}`, {
                credentials: 'same-origin'
            });
            
            const data = await response.json();
            
            if (data.success) {
                if (button) {
                    button.classList.toggle('active', data.status === 'added');
                    button.title = data.status === 'added' ? 'إزالة من المفضلة' : 'أضف للمفضلة';
                    button.innerHTML = data.status === 'added' ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
                }
                
                // Update counter
                updateWishlistCount(data.count || 0);
                
                showToast(data.msg || 'تم تحديث قائمة الرغبات', 'wishlist');
            } else {
                showToast(data.msg || 'فشل تحديث قائمة الرغبات', 'error');
            }
        } catch (error) {
            console.error('Error toggling wishlist:', error);
            showToast('حدث خطأ في تحديث قائمة الرغبات', 'error');
        } finally {
            if (button) button.disabled = false;
        }
    };

    const toggleCompare = async (productId, button) => {
        try {
            const response = await fetch(`${PROJECT_BASE}Api/compare_action.php?action=toggle&id=${encodeURIComponent(productId)}`, {
                credentials: 'same-origin'
            });
            
            const data = await response.json();
            
            if (data.success) {
                if (button) {
                    button.dataset.status = data.status;
                    button.classList.toggle('active', data.status === 'added');
                    button.title = data.status === 'added' ? 'إزالة من المقارنة' : 'أضف للمقارنة';
                }
                
                updateCompareBar(data.count || 0);
                
                showToast(data.msg || 'تم تحديث قائمة المقارنة', 'success');
            } else {
                showToast(data.msg || 'فشل تحديث قائمة المقارنة', 'error');
            }
        } catch (error) {
            console.error('Error toggling compare:', error);
            showToast('حدث خطأ في تحديث قائمة المقارنة', 'error');
        }
    };

    // --- Event Handlers for Products ---
    const setupProductEventHandlers = () => {
        // Add to cart with flying image effect
        document.addEventListener('click', async (event) => {
            const addCartBtn = event.target.closest('.add-cart');
            if (!addCartBtn) return;
            
            const productId = addCartBtn.dataset.id;
            const productCard = addCartBtn.closest('.product-card-v2');
            
            // Check stock
            const stock = parseInt(productCard?.dataset.stock || 0, 10);
            if (stock <= 0) {
                showToast('عذرًا، المنتج غير متاح حالياً (نفد المخزون).', 'error');
                return;
            }
            
            // Flying image effect
            const productImg = productCard?.querySelector('img');
            if (productImg) {
                const flyingImg = productImg.cloneNode(true);
                const imgRect = productImg.getBoundingClientRect();
                
                flyingImg.style.cssText = `
                    position: fixed;
                    left: ${imgRect.left}px;
                    top: ${imgRect.top}px;
                    width: ${imgRect.width}px;
                    height: ${imgRect.height}px;
                    z-index: 9999;
                    pointer-events: none;
                    transition: all 0.8s cubic-bezier(0.2, 0.9, 0.2, 1);
                    opacity: 0.8;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                `;
                
                document.body.appendChild(flyingImg);
                
                const cartIcon = document.querySelector('.cart-info') || 
                               document.querySelector('[href*="${PROJECT_BASE}Controller/cart.php"]');
                const cartRect = cartIcon?.getBoundingClientRect() || { 
                    left: window.innerWidth - 50, 
                    top: 20 
                };
                
                setTimeout(() => {
                    flyingImg.style.left = `${cartRect.left}px`;
                    flyingImg.style.top = `${cartRect.top}px`;
                    flyingImg.style.width = '30px';
                    flyingImg.style.height = '30px';
                    flyingImg.style.opacity = '0.3';
                    flyingImg.style.borderRadius = '50%';
                }, 10);
                
                setTimeout(() => {
                    flyingImg.remove();
                }, 800);
            }
            
            await addToCart(productId, 1);
        });
        
        // Wishlist toggle
        document.addEventListener('click', async (event) => {
            const wishlistBtn = event.target.closest('.toggle-wishlist');
            if (!wishlistBtn) return;
            
            const productId = wishlistBtn.dataset.id;
            await toggleWishlist(productId, wishlistBtn);
        });
        
        // Compare toggle
        document.addEventListener('click', async (event) => {
            const compareBtn = event.target.closest('.toggle-compare');
            if (!compareBtn) return;
            
            event.preventDefault();
            event.stopPropagation();
            
            const productId = compareBtn.dataset.id;
            console.log('Compare button clicked for product:', productId);
            await toggleCompare(productId, compareBtn);
        });
        
        // Quick view
        document.addEventListener('click', (event) => {
            const quickViewBtn = event.target.closest('.quick-view');
            if (quickViewBtn) {
                event.preventDefault();
                const productId = quickViewBtn.dataset.id;
                openQuickView(productId);
            }
        });
    };

    // --- Search Suggestions ---
    const initSearchSuggestions = () => {
        const input = elements['search-input'];
        const suggestionsBox = elements['search-suggestions'];
        
        if (!input || !suggestionsBox) return;
        
        suggestionsBox.classList.add('search-suggestions-premium');
        
        let timeoutId;
        let currentIndex = -1;
        
        const clearSuggestions = () => {
            suggestionsBox.innerHTML = '';
            suggestionsBox.style.display = 'none';
            currentIndex = -1;
        };
        
        input.addEventListener('input', function() {
            clearTimeout(timeoutId);
            const query = this.value.trim();
            
            if (query.length < 2) {
                clearSuggestions();
                return;
            }
            
            // Show a subtle loading state in the search bar
            input.classList.add('searching');
            
            timeoutId = setTimeout(async () => {
                try {
                    const response = await fetch(`${PROJECT_BASE}Controller/load_products.php?q=${encodeURIComponent(query)}&limit=6`);
                    const data = await response.json();
                    input.classList.remove('searching');
                    
                    if (data.success && data.html) {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(`<div>${data.html}</div>`, 'text/html');
                        const products = doc.querySelectorAll('.product-card');
                        
                        if (products.length > 0) {
                            suggestionsBox.innerHTML = '<div class="suggestions-header">نتائج البحث المقترحة</div>';
                            suggestionsBox.innerHTML += Array.from(products).map(p => {
                                const id = p.dataset.productId;
                                const name = p.querySelector('h3').innerText;
                                const price = p.querySelector('.price').innerText;
                                const img = p.querySelector('img').src;
                                return `
                                    <div class="suggestion-item premium-hover" onclick="window.location.href='${PROJECT_BASE}Controller/product.php?id=${id}'">
                                        <div class="suggestion-img-wrapper">
                                            <img src="${img}" class="suggestion-img" loading="lazy">
                                        </div>
                                        <div class="suggestion-info">
                                            <h4 class="suggestion-title">${escapeHtml(name)}</h4>
                                            <span class="suggestion-price">${price}</span>
                                        </div>
                                        <i class="fas fa-chevron-left suggestion-arrow"></i>
                                    </div>
                                `;
                            }).join('');
                            suggestionsBox.innerHTML += `<div class="suggestions-footer" onclick="document.getElementById('search-form').submit()">عرض كل النتائج لـ "${escapeHtml(query)}"</div>`;
                            suggestionsBox.style.display = 'block';
                            
                            // Add entrance animation
                            suggestionsBox.style.animation = 'slideDownFade 0.3s ease-out forwards';
                        } else {
                            suggestionsBox.innerHTML = '<div class="no-results-suggestion">لا توجد نتائج تطابق بحثك</div>';
                            suggestionsBox.style.display = 'block';
                        }
                    } else {
                        clearSuggestions();
                    }
                } catch (e) {
                    input.classList.remove('searching');
                    console.error('Search suggestions error:', e);
                }
            }, 300);
        });
        
        // Hide suggestions when clicking outside
        document.addEventListener('click', (event) => {
            if (!event.target.closest('.search-wrapper')) {
                clearSuggestions();
            }
        });
        
        // Keyboard navigation
        input.addEventListener('keydown', (e) => {
            const items = suggestionsBox.querySelectorAll('.suggestion-item');
            
            if (items.length === 0) return;
            
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    currentIndex = Math.min(currentIndex + 1, items.length - 1);
                    items[currentIndex].focus();
                    break;
                    
                case 'ArrowUp':
                    e.preventDefault();
                    currentIndex = Math.max(currentIndex - 1, 0);
                    items[currentIndex].focus();
                    break;
                    
                case 'Escape':
                    clearSuggestions();
                    break;
                    
                case 'Enter':
                    if (currentIndex >= 0 && items[currentIndex]) {
                        e.preventDefault();
                        items[currentIndex].click();
                    }
                    break;
            }
        });
    };

    // --- Compare Bar ---
    const initCompareBar = () => {
        const clearCompareBtn = elements['clear-compare'];
        if (clearCompareBtn) {
            clearCompareBtn.addEventListener('click', async () => {
                try {
                    const response = await fetch(`${PROJECT_BASE}Api/compare_action.php?action=clear`, {
                        credentials: 'same-origin'
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        // Update all compare buttons
                        document.querySelectorAll('.toggle-compare').forEach(btn => {
                            btn.dataset.status = 'removed';
                            btn.classList.remove('active');
                            btn.title = 'أضف للمقارنة';
                        });
                        
                        // Update compare bar
                        updateCompareBar(0);
                        
                        showToast(data.msg || 'تم مسح قائمة المقارنة', 'success');
                    } else {
                        showToast(data.msg || 'فشل مسح قائمة المقارنة', 'error');
                    }
                } catch (error) {
                    console.error('Error clearing compare:', error);
                    showToast('حدث خطأ في مسح قائمة المقارنة', 'error');
                }
            });
        }
    };

    // --- Comments Modal Logic ---
    const openCommentsModal = async (productId) => {
        // Close pending reviews modal if open
        const pendingModal = document.getElementById('pending-reviews-modal');
        if (pendingModal) pendingModal.style.display = 'none';

        // Create modal if not exists
        let modal = document.getElementById('comments-modal');
        if (!modal) {
            modal = ce('div', { id: 'comments-modal', className: 'modal-v2' });
            modal.innerHTML = `
                <div class="modal-content-v2">
                    <div class="modal-header-v2">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <img id="modal-product-img" src="" style="width: 40px; height: 40px; border-radius: 5px; display: none;">
                            <h3 id="modal-title"><i class="fas fa-comments"></i> تعليقات العملاء</h3>
                        </div>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="modal-body-v2">
                        <div id="comments-list" class="comments-list"></div>
                        <div id="comment-form-container" class="add-comment-form" style="display: none;">
                            <div class="rating-input">
                                <span>تقييمك:</span>
                                <div class="stars-input">
                                    <i class="far fa-star" data-value="1"></i>
                                    <i class="far fa-star" data-value="2"></i>
                                    <i class="far fa-star" data-value="3"></i>
                                    <i class="far fa-star" data-value="4"></i>
                                    <i class="far fa-star" data-value="5"></i>
                                </div>
                                <input type="hidden" id="rating-value" value="0">
                            </div>
                            <textarea id="new-comment" placeholder="اكتب تعليقك هنا..."></textarea>
                            <button id="submit-comment" class="btn-primary">إرسال التعليق والتقييم</button>
                        </div>
                        <div id="comment-status-msg" class="comment-status-msg"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            modal.querySelector('.close-modal').onclick = () => modal.style.display = 'none';
            window.onclick = (e) => { 
                if (e.target == modal) modal.style.display = 'none'; 
            };

            // Star rating logic
            const stars = modal.querySelectorAll('.stars-input i');
            stars.forEach(star => {
                star.onclick = () => {
                    const val = star.dataset.value;
                    document.getElementById('rating-value').value = val;
                    stars.forEach(s => {
                        if (s.dataset.value <= val) {
                            s.classList.replace('far', 'fas');
                        } else {
                            s.classList.replace('fas', 'far');
                        }
                    });
                };
            });
        }

        modal.style.display = 'flex';
        const list = document.getElementById('comments-list');
        const formContainer = document.getElementById('comment-form-container');
        const statusMsg = document.getElementById('comment-status-msg');
        const modalImg = document.getElementById('modal-product-img');
        
        list.innerHTML = '<p class="loading">جاري تحميل التعليقات...</p>';
        formContainer.style.display = 'none';
        statusMsg.innerHTML = '';
        if (modalImg) modalImg.style.display = 'none';

        try {
            const response = await fetch(`${PROJECT_BASE}Controller/comments.php?action=list&product_id=${productId}`);
            const data = await response.json();
            
            if (data.success && data.comments.length > 0) {
                list.innerHTML = '';
                data.comments.forEach(c => {
                    const item = ce('div', { className: 'comment-item' });
                    let starsHtml = '';
                    for (let i = 1; i <= 5; i++) {
                        starsHtml += `<i class="${i <= c.rating ? 'fas' : 'far'} fa-star" style="color: #ffc107; font-size: 0.8rem;"></i>`;
                    }
                    item.innerHTML = `
                        <div class="comment-header">
                            <img src="../../Assets/images/${c.avatar}" alt="${c.name}" class="comment-avatar">
                            <div class="comment-meta">
                                <span class="comment-author">${c.name}</span>
                                <div class="comment-rating">${starsHtml}</div>
                                <span class="comment-date">${c.date}</span>
                            </div>
                        </div>
                        <div class="comment-text">${c.comment}</div>
                    `;
                    list.appendChild(item);
                });
            } else {
                list.innerHTML = '<p class="no-comments">لا يوجد تعليقات على هذا المنتج الآن.</p>';
            }

            // Check if user can comment
            const checkRes = await fetch(`${PROJECT_BASE}Controller/comments.php?action=check_eligibility&product_id=${productId}`);
            const checkData = await checkRes.json();
            
            if (checkData.eligible) {
                formContainer.style.display = 'block';
                document.getElementById('submit-comment').onclick = async () => {
                    const comment = document.getElementById('new-comment').value.trim();
                    const rating = document.getElementById('rating-value').value;
                    
                    if (!comment || rating == 0) {
                        showToast('يرجى كتابة تعليق واختيار تقييم', 'error');
                        return;
                    }

                    const formData = new FormData();
                    formData.append('product_id', productId);
                    formData.append('comment', comment);
                    formData.append('rating', rating);

                    const addRes = await fetch(PROJECT_BASE + 'Controller/comments.php?action=add', {
                        method: 'POST',
                        body: formData
                    });
                    const addData = await addRes.json();
                    
                    if (addData.success) {
                        showToast(addData.msg, 'success');
                        // Refresh comments and check notifications
                        openCommentsModal(productId);
                        checkPendingReviews();
                    } else {
                        showToast(addData.msg, 'error');
                    }
                };
            } else if (checkData.msg) {
                statusMsg.innerHTML = `<p class="info-msg">${checkData.msg}</p>`;
            }

        } catch (e) {
            list.innerHTML = '<p class="error">فشل تحميل التعليقات.</p>';
        }
    };

    // --- Simple Scroll Logic ---
    const initScroll = () => {
        const header = document.getElementById('main-header');

        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            
            // Header Background Transition
            if (header) {
                if (scrolled > 50) {
                    header.classList.add('scrolled');
                } else {
                    header.classList.remove('scrolled');
                }
            }
        });
    };

    // --- Cinematic Effects (Dust, Shake & Golden Line) ---
    const createSparks = () => {
        const container = document.querySelector('.spark-container');
        if (!container) return;
        
        for (let i = 0; i < 15; i++) {
            const spark = document.createElement('div');
            spark.className = 'spark';
            
            const sx = (Math.random() - 0.5) * 150;
            const sy = (Math.random() - 0.5) * 150;
            
            spark.style.setProperty('--sx', `${sx}px`);
            spark.style.setProperty('--sy', `${sy}px`);
            spark.style.left = '50%';
            spark.style.top = '50%';
            
            container.appendChild(spark);
            spark.classList.add('spark-animate');
            
            setTimeout(() => spark.remove(), 600);
        }
    };

    const playCinematicSound = (type) => {
        // Audio removed for a silent experience
    };

    const createImpactEffects = () => {
        const container = document.querySelector('.dust-container');
        const wrapper = document.querySelector('.impact-wrapper');
        const hero = document.querySelector('.cinematic-hero');
        if (!wrapper) return;

        // 1. Screen Shake (Optimized)
        if (hero) {
            hero.classList.add('stamp-shake');
            setTimeout(() => hero.classList.remove('stamp-shake'), 300);
        }

        // 2. Final Polish Trigger
        const impactText = document.querySelector('.impact-text');
        if (impactText) {
            setTimeout(() => impactText.classList.add('final-polished'), 500);
        }

        // 3. Light Dust Particles (Reduced for performance)
        if (container) {
            const fragment = document.createDocumentFragment();
            for (let i = 0; i < 12; i++) {
                const particle = document.createElement('div');
                particle.className = 'dust-particle';
                const x = (Math.random() - 0.5) * 300;
                const y = -(Math.random() * 80 + 20);
                const size = Math.random() * 6 + 2;
                particle.style.width = `${size}px`;
                particle.style.height = `${size}px`;
                particle.style.setProperty('--x', `${x}px`);
                particle.style.setProperty('--y', `${y}px`);
                fragment.appendChild(particle);
                setTimeout(() => particle.remove(), 1500);
            }
            container.appendChild(fragment);
        }
    };

    const createDustCloud = (x, y) => {
        const container = document.querySelector('.dust-container');
        if (!container) return;
        for (let i = 0; i < 5; i++) {
            const cloud = ce('div', { className: 'dust-cloud' });
            cloud.style.left = `${x}px`;
            cloud.style.top = `${y}px`;
            cloud.style.width = `${Math.random() * 100 + 50}px`;
            cloud.style.height = `${Math.random() * 60 + 30}px`;
            cloud.style.animationDelay = `${Math.random() * 0.2}s`;
            container.appendChild(cloud);
            setTimeout(() => cloud.remove(), 1000);
        }
    };

    const createShockwave = (x, y) => {
        const container = document.querySelector('.dust-container');
        if (!container) return;
        const wave = ce('div', { className: 'shockwave' });
        wave.style.left = `${x}px`;
        wave.style.top = `${y}px`;
        container.appendChild(wave);
        setTimeout(() => wave.remove(), 600);
    };    const createGoldExplosion = (x, y, count = 12, power = 150) => {
        // تم تعطيل الانفجار لمنع تغطية الانعكاس
        return;
    };

    // --- Initialize Application ---
    const startCinematicHero = () => {
        const impactText = document.querySelector('.impact-text');
        const chars = Array.from(document.querySelectorAll('.char'));
        if (!impactText || chars.length === 0) return;

        // Simplified Hero: Just show text with a simple fade-in
        impactText.style.opacity = '1';
        chars.forEach((char, i) => {
            char.style.opacity = '1';
            char.style.transform = 'none';
            char.classList.add('final-gold');
        });
        
        const board = document.querySelector('.neon-board');
        if (board) board.classList.add('active-neon');
    };

    // تعريف الدالة المفقودة لتجنب الخطأ
    const createGoldenConnectors = () => {
        const container = document.querySelector('.impact-text-container');
        if (!container) return;
        
        const chars = container.querySelectorAll('.impact-char');
        if (chars.length < 2) return;

        // كود بسيط لإنشاء روابط جمالية بين الحروف (اختياري)
        console.log('Golden connectors initialized');
    };

    /* ============================================================
       SMART FEATURES: 3D TILT, COUNTDOWN, WHATSAPP FLOAT
       ============================================================ */

    // 1. 3D TILT EFFECT FOR PRODUCTS (Enhanced & Smoother)
    const init3DTilt = () => {
        const productCards = document.querySelectorAll('.product-card, .category-card');
        
        productCards.forEach(card => {
            const image = card.querySelector('img');
            if (!image) return;
            
            // Ensure transition is smooth
            image.style.transition = 'transform 0.1s ease-out';
            image.style.willChange = 'transform';
            
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                
                // Calculate rotation (max 10 degrees for better effect)
                const rotateX = ((y - centerY) / centerY) * -10;
                const rotateY = ((x - centerX) / centerX) * 10;
                
                image.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.08)`;
            });
            
            card.addEventListener('mouseleave', () => {
                image.style.transition = 'transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)';
                image.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
            });
        });
    };

    // 2. LUXURY COUNTDOWN TIMER
    const initCountdownTimer = () => {
        const countdownElements = document.querySelectorAll('[data-countdown]');
        
        countdownElements.forEach(element => {
            const endTime = parseInt(element.dataset.countdown);
            
            const updateCountdown = () => {
                const now = Date.now();
                const timeLeft = endTime - now;
                
                if (timeLeft <= 0) {
                    element.innerHTML = '<span style="color: var(--danger);">انتهت</span>';
                    return;
                }
                
                const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeLeft / (1000 * 60 * 60)) % 24);
                const minutes = Math.floor((timeLeft / 1000 / 60) % 60);
                const seconds = Math.floor((timeLeft / 1000) % 60);
                
                element.innerHTML = `
                    <div class="countdown-timer">
                        <div class="countdown-unit">
                            <span class="countdown-number">${String(days).padStart(2, '0')}</span>
                            <span class="countdown-label">ي</span>
                        </div>
                        <span style="opacity: 0.6;">:</span>
                        <div class="countdown-unit">
                            <span class="countdown-number">${String(hours).padStart(2, '0')}</span>
                            <span class="countdown-label">س</span>
                        </div>
                        <span style="opacity: 0.6;">:</span>
                        <div class="countdown-unit">
                            <span class="countdown-number">${String(minutes).padStart(2, '0')}</span>
                            <span class="countdown-label">د</span>
                        </div>
                        <span style="opacity: 0.6;">:</span>
                        <div class="countdown-unit">
                            <span class="countdown-number">${String(seconds).padStart(2, '0')}</span>
                            <span class="countdown-label">ث</span>
                        </div>
                    </div>
                `;
            };
            
            updateCountdown();
            setInterval(updateCountdown, 1000);
        });
    };

    // 3. WHATSAPP ELEGANT FLOAT BUTTON
    const initWhatsAppFloat = () => {
        const whatsappBtn = elements['whatsapp-float'];
        if (!whatsappBtn) return;
        
        const phoneNumber = '201026103523'; // Replace with actual number
        const message = 'السلام عليكم ورحمة الله وبركاته، أود استشارة خاصة حول منتجاتكم الفاخرة';
        
        whatsappBtn.addEventListener('click', () => {
            const encodedMessage = encodeURIComponent(message);
            const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
            window.open(whatsappUrl, '_blank');
        });
        
        // Add pulse animation on page load
        setTimeout(() => {
            whatsappBtn.classList.add('pulse');
        }, 2000);
        
        // Remove pulse on first interaction
        whatsappBtn.addEventListener('mouseenter', () => {
            whatsappBtn.classList.remove('pulse');
        });
    };

    // Initialize all smart features when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                init3DTilt();
                initCountdownTimer();
                initWhatsAppFloat();
            }, 500);
        });
    } else {
        setTimeout(() => {
            init3DTilt();
            initCountdownTimer();
            initWhatsAppFloat();
        }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (typeof init === 'function') init();
            initScroll();
            startCinematicHero();
            initMagneticButtons();
        });
    } else {
        if (typeof init === 'function') init();
        initScroll();
        startCinematicHero();
        initMagneticButtons();
    }

    // Make functions available globally
    window.HomeApp = {
        showToast,
        updateCartCount,
        updateWishlistCount,
        updateCompareBar,
        addToCart,
        toggleWishlist,
        toggleCompare,
        loadMoreProducts,
        openCommentsModal,
        filterAndScroll,
        checkPendingReviews,
        openQuickView
    };

    // Handle existing comment buttons
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-comments');
        if (btn) {
            const pid = btn.dataset.id;
            if (pid) window.HomeApp.openCommentsModal(pid);
        }
    });

})();

// Initialize AOS
if (window.AOS) {
    AOS.init({
        duration: 800,
        once: true,
        offset: 50,
        delay: 100
    });
}

// Set current year in footer
if (document.getElementById('year')) {
    document.getElementById('year').textContent = new Date().getFullYear();
}

// Initialize theme from localStorage
(function() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        const themeSwitcher = document.getElementById('theme-switcher');
        if (themeSwitcher) {
            themeSwitcher.innerHTML = '<i class="fas fa-sun"></i>';
        }
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    const initParallax = () => {
        const container = document.createElement('div');
        container.className = 'parallax-container';
        document.body.appendChild(container);

        const icons = ['fa-feather', 'fa-leaf', 'fa-star', 'fa-gem', 'fa-crown'];
        const elementsCount = 15;

        for (let i = 0; i < elementsCount; i++) {
            const el = document.createElement('i');
            const icon = icons[Math.floor(Math.random() * icons.length)];
            el.className = `fas ${icon} floating-element`;
            
            const x = Math.random() * 100;
            const y = Math.random() * 100;
            const size = 10 + Math.random() * 20;
            const rotation = Math.random() * 360;
            
            el.style.left = `${x}%`;
            el.style.top = `${y}%`;
            el.style.fontSize = `${size}px`;
            el.style.transform = `rotate(${rotation}deg)`;
            el.dataset.speed = (Math.random() * 0.05) + 0.02;
            
            container.appendChild(el);
        }

        document.addEventListener('mousemove', (e) => {
            const elements = document.querySelectorAll('.floating-element');
            const mouseX = e.clientX;
            const mouseY = e.clientY;

            elements.forEach(el => {
                const speed = parseFloat(el.dataset.speed);
                const x = (window.innerWidth - mouseX * speed) / 100;
                const y = (window.innerHeight - mouseY * speed) / 100;
                el.style.transform = `translate(${x}px, ${y}px) rotate(${mouseX * 0.02}deg)`;
            });
        });
    };

    // 2. Glassmorphism Hover Effects
    const initGlassHover = () => {
        const targets = document.querySelectorAll('.category-card, .product-card, .swiper-slide');
        targets.forEach(target => {
            target.classList.add('glass-hover-effect');
        });
    };

    initParallax();
    initGlassHover();
});
    // دالة لإنشاء جزيئات دوارة ملونة متقدمة
    const createRotatingParticles = (x, y, count = 40) => {
        const container = document.querySelector('.dust-container');
        if (!container) return;
        const colors = ['#FFD700', '#FFF8DC', '#FFE4B5', '#FFDAB9', '#FFE4E1'];
        
        for (let i = 0; i < count; i++) {
            const particle = ce('div', { className: 'rotating-particle' });
            particle.style.left = `${x}px`;
            particle.style.top = `${y}px`;
            
            const angle = (i / count) * Math.PI * 2;
            const distance = Math.random() * 300 + 100;
            const tx = Math.cos(angle) * distance;
            const ty = Math.sin(angle) * distance - Math.random() * 200;
            
            const size = Math.random() * 8 + 3;
            const duration = Math.random() * 1 + 0.8;
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            particle.style.setProperty('--tx', `${tx}px`);
            particle.style.setProperty('--ty', `${ty}px`);
            particle.style.setProperty('--size', `${size}px`);
            particle.style.setProperty('--duration', `${duration}s`);
            particle.style.setProperty('--color', color);
            particle.style.animationDelay = `${Math.random() * 0.1}s`;
            
            container.appendChild(particle);
            setTimeout(() => particle.remove(), duration * 1000 + 500);
        }
    };
    
    // دالة لإنشاء غبار ملون من الشروخ
    const createColoredDust = (x, y, count = 50) => {
        const container = document.querySelector('.dust-container');
        if (!container) return;
        const colors = ['#FFD700', '#FFF8DC', '#FFE4B5', '#C5A059', '#FFDAB9'];
        
        for (let i = 0; i < count; i++) {
            const dust = ce('div', { className: 'colored-dust' });
            dust.style.left = `${x}px`;
            dust.style.top = `${y}px`;
            
            const tx = (Math.random() - 0.5) * 400;
            const ty = -(Math.random() * 300 + 50);
            
            const size = Math.random() * 10 + 4;
            const duration = Math.random() * 1.2 + 0.8;
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            dust.style.setProperty('--tx', `${tx}px`);
            dust.style.setProperty('--ty', `${ty}px`);
            dust.style.setProperty('--size', `${size}px`);
            dust.style.setProperty('--duration', `${duration}s`);
            dust.style.setProperty('--color', color);
            dust.style.animationDelay = `${Math.random() * 0.15}s`;
            
            container.appendChild(dust);
            setTimeout(() => dust.remove(), duration * 1000 + 500);
        }
    };
    
    // دالة لإنشاء شرر ذهبي عشوائي
    const createGoldenSparks = (x, y, count = 60) => {
        const container = document.querySelector('.dust-container');
        if (!container) return;
        
        for (let i = 0; i < count; i++) {
            const spark = ce('div', { className: 'golden-spark' });
            spark.style.left = `${x}px`;
            spark.style.top = `${y}px`;
            
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 250 + 50;
            const tx = Math.cos(angle) * distance;
            const ty = Math.sin(angle) * distance;
            
            const duration = Math.random() * 0.6 + 0.4;
            
            spark.style.setProperty('--tx', `${tx}px`);
            spark.style.setProperty('--ty', `${ty}px`);
            spark.style.setProperty('--duration', `${duration}s`);
            spark.style.animationDelay = `${Math.random() * 0.1}s`;
            
            container.appendChild(spark);
            setTimeout(() => spark.remove(), duration * 1000 + 300);
        }
    };

    // 3. Golden Connecting Lines - DISABLED
    const createConnectingLines = () => {
        // Disabled to clean up the UI as requested
        return;
    };
// --- Advanced Hero Effects (Particles & 3D Tilt) ---
const initAdvancedHeroEffects = () => {
    const hero = document.getElementById('hero-story');
    const glass = document.querySelector('.hero-glass-container');
    const particleContainer = document.getElementById('hero-particles');
    const impactText = document.querySelector('.impact-text');

    if (!hero || !glass) return;

    // 1. Create Floating Particles
    const createParticles = () => {
        if (!particleContainer) return;
        const particleCount = window.innerWidth < 768 ? 40 : 100;
        
        for (let i = 0; i < particleCount; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            
            const size = Math.random() * 6 + 3;
            const duration = Math.random() * 10 + 10;
            const moveX = (Math.random() - 0.5) * 200;
            const moveY = -(Math.random() * 300 + 100);
            
            p.style.width = `${size}px`;
            p.style.height = `${size}px`;
            p.style.left = `${Math.random() * 100}%`;
            p.style.top = `${Math.random() * 100}%`;
            p.style.setProperty('--duration', `${duration}s`);
            p.style.setProperty('--move-x', `${moveX}px`);
            p.style.setProperty('--move-y', `${moveY}px`);
            
            particleContainer.appendChild(p);
        }
    };

    // 2. Reflection & Underline Sync
    const syncHeroAnimations = () => {
        if (!impactText) return;
        
        // Listen for the end of the main animation to trigger the underline
        impactText.addEventListener('animationend', (e) => {
            if (e.animationName.includes('final-polished') || e.target.classList.contains('impact-text')) {
                impactText.classList.add('final-polished');
            glass.classList.add('final-polished');
            }
        });

        // Fallback if animationend doesn't fire as expected
        setTimeout(() => {
            impactText.classList.add('final-polished');
            glass.classList.add('final-polished');
        }, 4000);
    };

    createParticles();
    syncHeroAnimations();
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initAdvancedHeroEffects();
});
