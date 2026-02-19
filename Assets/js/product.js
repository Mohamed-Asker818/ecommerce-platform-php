
class ProductSystem {
    constructor() {
        this.productId = null;
        this.productData = null;
        this.similarProducts = [];
        this.isLoading = false;
        this.quantity = 1;
        
        this.zoomLevel = 1.0;
        this.minZoom = 1.0;
        this.maxZoom = 5.0;
        this.zoomStep = 0.25;
        this.isZoomActive = false;
        this.animationFrame = null;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.mainImageLoaded = false;
        this.imageNaturalSize = { width: 0, height: 0 };
        
        this.selectors = {
            loadingSection: '#loading-section',
            errorSection: '#error-section',
            errorMessage: '#error-message',
            productContent: '#product-content',
            productMainImage: '#product-main-image',
            productName: '#product-name',
            currentPrice: '#current-price',
            oldPrice: '#old-price',
            stockStatus: '#stock-status',
            stockText: '#stock-text',
            productDescriptionText: '#product-description-text',
            quantityInput: '#quantity',
            addToCartBtn: '#add-to-cart-btn',
            buyNowBtn: '#buy-now-btn',
            similarProductsGrid: '#similar-products-grid',
            cartCount: '#cart-count',
            toastContainer: '#toast-container',
            zoomSlider: '#zoom-slider',
            zoomPercent: '#zoom-percent',
            thumbnailsContainer: '#product-thumbnails'
        };
        
        this.endpoints = {
            getProduct: '../Api/product_api.php?action=get_product',
            addToCart: '../Api/product_api.php?action=add_to_cart',
            buyNow: '../Api/checkout_api.php?action=process_direct_order',
            getCartCount: '../Api/cart_api.php?action=get_count'
        };
        
        this.init();
    }
    
    async init() {
        await this.loadProductData();
        this.bindEvents();
        this.initPrecisionZoom();
    }
    
    initPrecisionZoom() {
        const mainImage = document.querySelector(this.selectors.productMainImage);
        const imageContainer = document.querySelector('.main-image-container');
        
        if (!mainImage || !imageContainer) return;
        
        this.zoomElements = {
            mainImage: mainImage,
            imageContainer: imageContainer,
            zoomInBtn: imageContainer.querySelector('.zoom-in'),
            zoomOutBtn: imageContainer.querySelector('.zoom-out'),
            zoomResetBtn: imageContainer.querySelector('.zoom-reset'),
            zoomSlider: document.querySelector(this.selectors.zoomSlider),
            zoomPercent: document.querySelector(this.selectors.zoomPercent)
        };
        
        if (mainImage.complete && mainImage.naturalWidth > 0) {
            this.onMainImageLoaded();
        } else {
            mainImage.onload = () => this.onMainImageLoaded();
        }
        
        this.bindZoomEvents();
        
        this.bindMouseEvents();
        
        this.initMobileZoom();
    }
    
    onMainImageLoaded() {
        const { mainImage } = this.zoomElements;
        if (!mainImage) return;
        
        this.imageNaturalSize = {
            width: mainImage.naturalWidth,
            height: mainImage.naturalHeight
        };
        
        this.mainImageLoaded = true;
        
        this.createPrecisionZoomWindow();
        
        this.updateZoomControls();
    }
    
    createPrecisionZoomWindow() {
        const existingWindow = document.querySelector('.precision-zoom-window');
        if (existingWindow) existingWindow.remove();
        
        const zoomWindow = document.createElement('div');
        zoomWindow.className = 'precision-zoom-window';
        zoomWindow.style.display = 'none';
        zoomWindow.style.position = 'fixed';
        zoomWindow.style.background = '#ffffff';
        zoomWindow.style.border = '2px solid var(--primary-color)';
        zoomWindow.style.boxShadow = '0 20px 60px rgba(0,0,0,0.3)';
        zoomWindow.style.zIndex = '9999';
        zoomWindow.style.overflow = 'hidden';
        zoomWindow.style.borderRadius = '15px';
        zoomWindow.style.width = '500px';
        zoomWindow.style.height = '500px';
        zoomWindow.style.backdropFilter = 'blur(10px)';
        zoomWindow.style.webkitBackdropFilter = 'blur(10px)';
        zoomWindow.style.opacity = '0';
        zoomWindow.style.transition = 'opacity 0.2s ease';
        zoomWindow.style.pointerEvents = 'none';
        
        const zoomWindowImg = document.createElement('img');
        zoomWindowImg.className = 'precision-zoom-img';
        zoomWindowImg.style.position = 'absolute';
        zoomWindowImg.style.left = '0px';
        zoomWindowImg.style.top = '0px';
        zoomWindowImg.style.imageRendering = 'crisp-edges';
        zoomWindowImg.style.imageRendering = '-webkit-optimize-contrast';
        zoomWindowImg.style.transformOrigin = '0 0';
        zoomWindowImg.style.willChange = 'transform';
        zoomWindowImg.style.backfaceVisibility = 'hidden';
        zoomWindowImg.style.webkitBackfaceVisibility = 'hidden';
        zoomWindowImg.style.transition = 'transform 0.05s cubic-bezier(0.18, 0.89, 0.32, 1.28)';
        zoomWindowImg.style.maxWidth = 'none';
        zoomWindowImg.style.maxHeight = 'none';
        zoomWindowImg.draggable = false;
        zoomWindowImg.style.pointerEvents = 'none';
        
        zoomWindow.appendChild(zoomWindowImg);
        document.body.appendChild(zoomWindow);
        
        this.zoomElements.zoomWindow = zoomWindow;
        this.zoomElements.zoomWindowImg = zoomWindowImg;
        
        zoomWindowImg.src = this.zoomElements.mainImage.src;
    }
    
    bindMouseEvents() {
        const { mainImage, imageContainer } = this.zoomElements;
        
        if (!mainImage || !imageContainer) return;
        
        imageContainer.addEventListener('mouseenter', (e) => {
            if (window.innerWidth <= 768) return;
            if (!this.mainImageLoaded) return;
            
            this.showZoomWindow();
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            
            requestAnimationFrame(() => {
                this.updatePrecisionZoom(e);
            });
        });
        
        imageContainer.addEventListener('mouseleave', () => {
            if (window.innerWidth <= 768) return;
            this.hideZoomWindow();
        });
        
        imageContainer.addEventListener('mousemove', (e) => {
            if (window.innerWidth <= 768 || !this.isZoomActive) return;
            
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            
            if (this.animationFrame) {
                cancelAnimationFrame(this.animationFrame);
            }
            
            this.animationFrame = requestAnimationFrame(() => {
                this.updatePrecisionZoom(e);
            });
        });
        
        mainImage.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                this.toggleMobileZoom(e);
            }
        });
        
        window.addEventListener('resize', () => {
            if (this.isZoomActive && this.lastMouseX && this.lastMouseY) {
                this.updatePrecisionZoom({
                    clientX: this.lastMouseX,
                    clientY: this.lastMouseY
                });
            }
        });
        
        mainImage.addEventListener('dragstart', (e) => {
            e.preventDefault();
        });
    }
    
    updatePrecisionZoom(e) {
        const { mainImage, zoomWindow, zoomWindowImg } = this.zoomElements;
        
        if (!mainImage || !zoomWindow || !zoomWindowImg || !this.mainImageLoaded) {
            return;
        }
        
        const rect = mainImage.getBoundingClientRect();
        
        let mouseX = e.clientX - rect.left;
        let mouseY = e.clientY - rect.top;
        
        mouseX = Math.max(0, Math.min(mouseX, rect.width));
        mouseY = Math.max(0, Math.min(mouseY, rect.height));
        
        const xPercent = rect.width ? mouseX / rect.width : 0.5;
        const yPercent = rect.height ? mouseY / rect.height : 0.5;
        
        let windowSize = parseInt(zoomWindow.style.width, 10) || 500;
        const maxWindowSize = Math.min(window.innerWidth - 40, window.innerHeight - 40);
        windowSize = Math.min(windowSize, maxWindowSize > 200 ? maxWindowSize : windowSize);
        zoomWindow.style.width = `${windowSize}px`;
        zoomWindow.style.height = `${windowSize}px`;
        
        let windowX = rect.left - 30 - windowSize;
        let windowY = Math.max(
            20,
            Math.min(e.clientY - windowSize / 2, window.innerHeight - windowSize - 20)
        );
        
        if (windowX < 20) {
            windowX = rect.right + 30;
            if (windowX + windowSize > window.innerWidth - 20) {
                windowX = (window.innerWidth - windowSize) / 2;
                windowY = 20;
            }
        }
        
        zoomWindow.style.left = `${windowX}px`;
        zoomWindow.style.top = `${windowY}px`;
        
        const zoomFactor = this.zoomLevel;
        const zoomedWidth = rect.width * zoomFactor;
        const zoomedHeight = rect.height * zoomFactor;
        
        zoomWindowImg.style.width = `${zoomedWidth}px`;
        zoomWindowImg.style.height = `${zoomedHeight}px`;
        
        const translateX = -(xPercent * zoomedWidth - windowSize / 2);
        const translateY = -(yPercent * zoomedHeight - windowSize / 2);
        
        zoomWindowImg.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`;
    }
    
    showZoomWindow() {
        if (this.zoomElements.zoomWindow) {
            this.zoomElements.zoomWindow.style.display = 'block';
            setTimeout(() => {
                this.zoomElements.zoomWindow.style.opacity = '1';
            }, 10);
            this.isZoomActive = true;
        }
    }
    
    hideZoomWindow() {
        if (this.zoomElements.zoomWindow) {
            this.zoomElements.zoomWindow.style.opacity = '0';
            setTimeout(() => {
                this.zoomElements.zoomWindow.style.display = 'none';
            }, 200);
            this.isZoomActive = false;
        }
    }
    
    bindZoomEvents() {
        const { zoomInBtn, zoomOutBtn, zoomResetBtn, zoomSlider } = this.zoomElements;
        
        if (zoomInBtn) zoomInBtn.addEventListener('click', () => this.changeZoom(this.zoomStep));
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this.changeZoom(-this.zoomStep));
        if (zoomResetBtn) zoomResetBtn.addEventListener('click', () => this.resetZoom());
        
        if (zoomSlider) {
            zoomSlider.addEventListener('input', (e) => {
                this.zoomLevel = parseInt(e.target.value) / 100;
                this.applyZoom();
            });
        }
    }
    
    changeZoom(delta) {
        this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel + delta));
        this.applyZoom();
    }
    
    resetZoom() {
        this.zoomLevel = 1.0;
        this.applyZoom();
    }
    
    applyZoom() {
        this.updateZoomControls();
        if (this.isZoomActive && this.lastMouseX && this.lastMouseY) {
            this.updatePrecisionZoom({
                clientX: this.lastMouseX,
                clientY: this.lastMouseY
            });
        }
    }
    
    updateZoomControls() {
        const { zoomInBtn, zoomOutBtn, zoomSlider, zoomPercent } = this.zoomElements;
        
        if (zoomInBtn) zoomInBtn.disabled = this.zoomLevel >= this.maxZoom;
        if (zoomOutBtn) zoomOutBtn.disabled = this.zoomLevel <= this.minZoom;
        
        if (zoomSlider) zoomSlider.value = this.zoomLevel * 100;
        if (zoomPercent) zoomPercent.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    }
    
    initMobileZoom() {
        const { mainImage } = this.zoomElements;
        if (!mainImage) return;
        
        let lastTap = 0;
        mainImage.addEventListener('touchend', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            if (tapLength < 300 && tapLength > 0) {
                this.toggleMobileZoom(e);
                e.preventDefault();
            }
            lastTap = currentTime;
        });
    }
    
    toggleMobileZoom(e) {
        if (window.innerWidth > 768) return;
        const { mainImage } = this.zoomElements;
        if (!mainImage) return;
        
        if (this.zoomLevel === 1.0) {
            this.zoomLevel = 2.5;
            mainImage.style.transform = `scale(${this.zoomLevel})`;
            mainImage.style.transformOrigin = 'center center';
        } else {
            this.zoomLevel = 1.0;
            mainImage.style.transform = 'scale(1)';
        }
        this.applyZoom();
    }
    
    async loadProductData() {
        try {
            this.showLoading();
            const urlParams = new URLSearchParams(window.location.search);
            this.productId = urlParams.get('id');
            
            if (!this.productId) throw new Error('معرف المنتج غير موجود');
            
            const response = await fetch(`${this.endpoints.getProduct}&id=${this.productId}`);
            const data = await response.json();
            
            if (data.success) {
                this.productData = data.product;
                this.similarProducts = data.similar_products || [];
                this.updateUI();
                await this.updateCartCount();
            } else {
                throw new Error(data.msg || 'فشل في تحميل بيانات المنتج');
            }
        } catch (error) {
            console.error('Error loading product data:', error);
            this.showError('حدث خطأ في تحميل بيانات المنتج. يرجى المحاولة مرة أخرى.');
        }
    }
    
    updateUI() {
        this.hideAllSections();
        if (!this.productData) {
            this.showError('بيانات المنتج غير متوفرة');
            return;
        }
        this.showProductContent();
        this.renderProductInfo();
        this.renderSimilarProducts();
        this.enableButtons();
    }
    
    renderProductInfo() {
        const product = this.productData;
        const mainImage = document.querySelector(this.selectors.productMainImage);
        const mainImageUrl = `image.php?src=${encodeURIComponent(product.image)}`;
        
        mainImage.src = mainImageUrl;
        mainImage.alt = product.name;
        mainImage.onerror = function() { this.src = 'admin/assets/images/default.jpg'; };
        
        const thumbnailsContainer = document.querySelector(this.selectors.thumbnailsContainer);
        if (thumbnailsContainer) {
            let thumbnailsHtml = `
                <div class="thumbnail-item active" onclick="ProductUI.changeMainImage('${mainImageUrl}', this)">
                    <img src="${mainImageUrl}" alt="صورة رئيسية">
                </div>
            `;
            if (product.additional_images && product.additional_images.length > 0) {
                product.additional_images.forEach(img => {
                    const imgUrl = `image.php?src=${encodeURIComponent(img)}`;
                    thumbnailsHtml += `
                        <div class="thumbnail-item" onclick="ProductUI.changeMainImage('${imgUrl}', this)">
                            <img src="${imgUrl}" alt="صورة إضافية">
                        </div>
                    `;
                });
            }
            thumbnailsContainer.innerHTML = thumbnailsHtml;
        }
        
        mainImage.onload = () => { if (this.zoomElements) this.onMainImageLoaded(); };
        document.querySelector(this.selectors.productName).textContent = product.name;
        
        const currentPrice = document.querySelector(this.selectors.currentPrice);
        const oldPrice = document.querySelector(this.selectors.oldPrice);
        currentPrice.textContent = `${this.formatPrice(product.price)} ج.م`;
        
        if (product.old_price && product.old_price > product.price) {
            oldPrice.textContent = `${this.formatPrice(product.old_price)} ج.م`;
            oldPrice.style.display = 'block';
        } else {
            oldPrice.style.display = 'none';
        }
        
        const stockStatus = document.querySelector(this.selectors.stockStatus);
        const stockText = document.querySelector(this.selectors.stockText);
        const qtyInput = document.querySelector(this.selectors.quantityInput);
        
        if (product.stock > 0) {
            stockStatus.className = 'stock-status in-stock';
            stockText.textContent = `متوفر - ${product.stock} قطعة متبقية`;
            qtyInput.max = Math.min(product.stock, 10);
        } else {
            stockStatus.className = 'stock-status out-of-stock';
            stockText.textContent = 'غير متوفر حالياً';
            qtyInput.max = 0;
            this.disableButtons();
        }
        
        document.querySelector(this.selectors.productDescriptionText).textContent = product.description;
        this.updateQuantityButtons(parseInt(qtyInput.value), parseInt(qtyInput.min), parseInt(qtyInput.max));
    }
    
    renderSimilarProducts() {
        const grid = document.querySelector(this.selectors.similarProductsGrid);
        if (this.similarProducts.length === 0) {
            grid.innerHTML = '<p class="no-similar">لا توجد منتجات مشابهة</p>';
            return;
        }
        grid.innerHTML = this.similarProducts.map(product => `
            <div class="similar-product-card">
                <div class="similar-product-image">
                    <img src="image.php?src=${encodeURIComponent(product.image)}" alt="${product.name}" onerror="this.src='admin/assets/images/default.jpg'">
                </div>
                <div class="similar-product-info">
                    <h4>${product.name}</h4>
                    <div class="similar-product-price">${this.formatPrice(product.price)} ج.م</div>
                    <a href="product.php?id=${product.id}" class="view-similar-btn"><i class="fas fa-eye"></i> عرض المنتج</a>
                </div>
            </div>
        `).join('');
    }
    
    updateQuantity(change) {
        const input = document.querySelector(this.selectors.quantityInput);
        let currentValue = parseInt(input.value) || 1;
        const min = parseInt(input.min) || 1;
        const max = parseInt(input.max) || 10;
        
        currentValue += change;
        if (currentValue < min) currentValue = min;
        if (currentValue > max) currentValue = max;
        
        input.value = currentValue;
        this.quantity = currentValue;
        this.updateQuantityButtons(currentValue, min, max);
    }
    
    updateQuantityButtons(currentValue, min, max) {
        const minusBtn = document.querySelector('.quantity-btn.minus');
        const plusBtn = document.querySelector('.quantity-btn.plus');
        if (minusBtn) {
            minusBtn.disabled = currentValue <= min;
            minusBtn.style.opacity = currentValue <= min ? '0.5' : '1';
        }
        if (plusBtn) {
            plusBtn.disabled = currentValue >= max;
            plusBtn.style.opacity = currentValue >= max ? '0.5' : '1';
        }
    }
    
    async addToCart() {
        if (this.isLoading) return;
        if (!this.validateQuantity()) {
            this.showToast('الرجاء اختيار كمية صحيحة', 'error');
            return;
        }
        
        this.isLoading = true;
        const btn = document.querySelector(this.selectors.addToCartBtn);
        const originalText = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإضافة...';
        }
        
        try {
            const body = new URLSearchParams({ product_id: this.productId, quantity: this.quantity }).toString();
            const response = await fetch(this.endpoints.addToCart, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body
            });
            const result = await response.json();
            
            if (result.success) {
                this.showToast('تم إضافة المنتج إلى السلة بنجاح', 'success');
                this.updateCartCount();
                if (btn) {
                    btn.innerHTML = '<i class="fas fa-check"></i> تمت الإضافة';
                    btn.classList.add('success');
                    setTimeout(() => {
                        btn.innerHTML = originalText;
                        btn.classList.remove('success');
                    }, 2000);
                }
            } else {
                this.showToast(result.msg || 'حدث خطأ أثناء الإضافة', 'error');
            }
        } catch (error) {
            console.error('Error adding to cart:', error);
            this.showToast('حدث خطأ في الاتصال بالخادم', 'error');
        } finally {
            if (btn) btn.disabled = false;
            this.isLoading = false;
        }
    }
    
    async buyNow() {
        if (this.isLoading) return;
        this.isLoading = true;
        const btn = document.querySelector(this.selectors.buyNowBtn);
        const originalText = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحويل...';
        }
        
        try {
            const cartResponse = await this.addToCartDirect();
            if (cartResponse.success) {
                window.location.href = '../Controller/checkout.php';
            } else {
                this.showToast(cartResponse.msg || 'حدث خطأ أثناء الإضافة للسلة', 'error');
            }
        } catch (error) {
            console.error('Error in buy now:', error);
            this.showToast('حدث خطأ أثناء التوجيه للدفع', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
            this.isLoading = false;
        }
    }
    
    async addToCartDirect() {
        try {
            const body = new URLSearchParams({ product_id: this.productId, quantity: this.quantity, direct_buy: 'true' }).toString();
            const response = await fetch(this.endpoints.addToCart, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body
            });
            return await response.json();
        } catch (error) {
            console.error('Error in direct add to cart:', error);
            return { success: false, msg: 'خطأ في الاتصال' };
        }
    }
    
    async updateCartCount() {
        try {
            const response = await fetch(this.endpoints.getCartCount);
            const data = await response.json();
            if (data.success && data.count > 0) {
                const el = document.querySelector(this.selectors.cartCount);
                if (el) {
                    el.textContent = data.count;
                    el.style.display = 'inline-block';
                }
            }
        } catch (error) {
            console.error('Error updating cart count:', error);
        }
    }
    
    validateQuantity() {
        const input = document.querySelector(this.selectors.quantityInput);
        const quantity = parseInt(input.value) || 1;
        const max = parseInt(input.max) || 10;
        return quantity >= 1 && quantity <= max;
    }
    
    bindEvents() {
        const addBtnEl = document.querySelector(this.selectors.addToCartBtn);
        if (addBtnEl) addBtnEl.addEventListener('click', () => this.addToCart());
        
        const buyBtnEl = document.querySelector(this.selectors.buyNowBtn);
        if (buyBtnEl) buyBtnEl.addEventListener('click', () => this.buyNow());
        
        const qtyEl = document.querySelector(this.selectors.quantityInput);
        if (qtyEl) {
            qtyEl.addEventListener('change', (e) => this.validateQuantityInput(e.target));
            qtyEl.addEventListener('input', (e) => this.validateQuantityInput(e.target));
        }
        
        const minusBtn = document.querySelector('.quantity-btn.minus');
        const plusBtn = document.querySelector('.quantity-btn.plus');
        if (minusBtn) minusBtn.addEventListener('click', () => this.updateQuantity(-1));
        if (plusBtn) plusBtn.addEventListener('click', () => this.updateQuantity(1));
        
        window.addEventListener('resize', () => {
            setTimeout(() => { if (window.innerWidth <= 768) this.hideZoomWindow(); }, 300);
        });
    }
    
    validateQuantityInput(input) {
        const min = parseInt(input.min) || 1;
        const max = parseInt(input.max) || 10;
        let value = parseInt(input.value) || min;
        if (value < min) value = min;
        if (value > max) value = max;
        input.value = value;
        this.quantity = value;
        this.updateQuantityButtons(value, min, max);
    }
    
    formatPrice(price) { return parseFloat(price).toFixed(2); }
    showLoading() { this.hideAllSections(); const el = document.querySelector(this.selectors.loadingSection); if (el) el.style.display = 'block'; }
    showError(message) { this.hideAllSections(); const errSec = document.querySelector(this.selectors.errorSection); const errMsg = document.querySelector(this.selectors.errorMessage); if (errSec) errSec.style.display = 'block'; if (errMsg) errMsg.textContent = message; }
    showProductContent() { this.hideAllSections(); const el = document.querySelector(this.selectors.productContent); if (el) el.style.display = 'block'; }
    hideAllSections() { [this.selectors.loadingSection, this.selectors.errorSection, this.selectors.productContent].forEach(s => { const el = document.querySelector(s); if (el) el.style.display = 'none'; }); }
    enableButtons() { [this.selectors.addToCartBtn, this.selectors.buyNowBtn].forEach(s => { const el = document.querySelector(s); if (el) el.disabled = false; }); }
    disableButtons() { [this.selectors.addToCartBtn, this.selectors.buyNowBtn].forEach(s => { const el = document.querySelector(s); if (el) el.disabled = true; }); }
    
    showToast(message, type = 'info', duration = 3000) {
        const container = document.querySelector(this.selectors.toastContainer) || this.createToastContainer();
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span class="toast-icon">${this.getToastIcon(type)}</span><span class="toast-message">${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, duration);
    }
    
    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
        return container;
    }
    
    getToastIcon(type) {
        const icons = { success: '<i class="fas fa-check-circle"></i>', error: '<i class="fas fa-exclamation-circle"></i>', warning: '<i class="fas fa-exclamation-triangle"></i>', info: '<i class="fas fa-info-circle"></i>' };
        return icons[type] || icons.info;
    }
    
    retryLoading() { this.loadProductData(); }
}

document.addEventListener('DOMContentLoaded', () => {
    const system = new ProductSystem();
    window.ProductSystem = system;
    window.ProductUI = {
        changeMainImage: function(imgUrl, thumbnailElement) {
            const mainImage = document.querySelector(system.selectors.productMainImage);
            if (!mainImage) return;
            mainImage.src = imgUrl;
            document.querySelectorAll('.thumbnail-item').forEach(item => item.classList.remove('active'));
            thumbnailElement.classList.add('active');
            if (system.zoomElements && system.zoomElements.zoomWindowImg) system.zoomElements.zoomWindowImg.src = imgUrl;
        },
        retryLoading: () => system.loadProductData(),
        updateQuantity: (change) => system.updateQuantity(change)
    };
});
