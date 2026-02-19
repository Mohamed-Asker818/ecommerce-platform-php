
class WishlistSystem {
    constructor() {
        this.wishlistData = null;
        this.isLoading = false;
        
        this.selectors = {
            loadingSection: '#loading-section',
            errorSection: '#error-section',
            errorMessage: '#error-message',
            wishlistContent: '#wishlist-content',
            wishlistItems: '#wishlist-items',
            wishlistCount: '#wishlist-count',
            clearAllBtn: '#clear-all-btn',
            toastContainer: '#toast-container',
            userInfo: '#user-info'
        };
        
        this.endpoints = {
            wishlistData: '../Api/wishlist_api.php?action=get_data',
            removeItem: '../Api/wishlist_api.php?action=remove_item',
            clearAll: '../Api/wishlist_api.php?action=clear_all',
            moveToCart: '../Api/cart_action.php?action=add'
        };
        
        this.init();
    }
    
    async init() {
        await this.loadWishlistData();
        this.bindEvents();
        this.updateUserInfo();
    }
    
    async loadWishlistData() {
        try {
            this.showLoading();
            
            const response = await fetch(this.endpoints.wishlistData);
            const data = await response.json();
            
            if (data.success) {
                this.wishlistData = data.wishlist;
                this.updateUI();
            } else {
                throw new Error(data.msg || 'فشل في تحميل قائمة الرغبات');
            }
        } catch (error) {
            console.error('Error loading wishlist data:', error);
            this.showError('حدث خطأ في تحميل قائمة الرغبات. يرجى المحاولة مرة أخرى.');
        }
    }
    
    updateUI() {
        this.hideAllSections();
        
        if (!this.wishlistData || this.wishlistData.length === 0) {
            this.showEmptyState();
            return;
        }
        
        this.showWishlistContent();
        this.renderWishlistItems();
        this.updateWishlistCount();
    }
    
    renderWishlistItems() {
        const container = document.querySelector(this.selectors.wishlistItems);
        const items = this.wishlistData;
        
        container.innerHTML = items.map(item => this.createWishlistItemHTML(item)).join('');
    }
    
    createWishlistItemHTML(item) {
        const imageUrl = item.image ? `../Assets/images/${item.image}` : '../Assets/images/default.jpg';
        
        return `
            <div class="wishlist-item" data-id="${item.id}">
                <div class="wishlist-item-image-container">
                    <img src="${imageUrl}" 
                         alt="${item.name}" 
                         class="wishlist-item-image"
                         onerror="this.src='../Assets/images/default.jpg'">
                    <button class="remove-item-btn" onclick="WishlistUI.removeItem(${item.id})" 
                            title="حذف من قائمة الرغبات">
                        ❌
                    </button>
                </div>
                <div class="wishlist-item-details">
                    <div class="wishlist-item-name">${item.name}</div>
                    <div class="wishlist-item-price">${parseFloat(item.price).toFixed(2)} ج.م</div>
                    <div class="wishlist-item-stock ${item.stock <= 0 ? 'out-of-stock' : 'in-stock'}">
                        ${item.stock <= 0 ? '⛔ غير متوفر' : `✅ متوفر (${item.stock} قطعة)`}
                    </div>
                    <div class="wishlist-item-actions">
                        <button class="add-to-cart-btn" onclick="WishlistUI.moveToCart(${item.id})" 
                                ${item.stock <= 0 ? 'disabled' : ''}>
                            🛒 أضف إلى السلة
                        </button>
                        <button class="view-product-btn" onclick="window.location.href='product.php?id=${item.id}'">
                            👁️ عرض المنتج
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    updateWishlistCount() {
        const count = this.wishlistData ? this.wishlistData.length : 0;
        document.querySelector(this.selectors.wishlistCount).textContent = count;
    }
    
    updateUserInfo() {
        const userInfo = document.querySelector(this.selectors.userInfo);
    }
    
    async removeItem(productId) {
        if (this.isLoading) return;
        
        if (!confirm('هل أنت متأكد من إزالة هذا المنتج من قائمة الرغبات؟')) {
            return;
        }
        
        this.isLoading = true;
        
        try {
            const formData = new FormData();
            formData.append('product_id', productId);
            
            const response = await fetch(this.endpoints.removeItem, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast(result.msg || 'تمت إزالة المنتج من قائمة الرغبات', 'success');
                await this.loadWishlistData();
                
                this.updateGlobalWishlistCount(result.count || 0);
            } else {
                throw new Error(result.msg || 'فشل في إزالة المنتج');
            }
        } catch (error) {
            console.error('Error removing item:', error);
            this.showToast('حدث خطأ أثناء إزالة المنتج', 'error');
        } finally {
            this.isLoading = false;
        }
    }
    
    async clearAll() {
        if (this.isLoading) return;
        
        if (!confirm('هل أنت متأكد من حذف جميع المنتجات من قائمة الرغبات؟')) {
            return;
        }
        
        this.isLoading = true;
        
        try {
            const response = await fetch(this.endpoints.clearAll, {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast(result.msg || 'تمت إزالة جميع المنتجات من قائمة الرغبات', 'success');
                await this.loadWishlistData();
                this.updateGlobalWishlistCount(0);
            } else {
                throw new Error(result.msg || 'فشل في إزالة المنتجات');
            }
        } catch (error) {
            console.error('Error clearing wishlist:', error);
            this.showToast('حدث خطأ أثناء إزالة المنتجات', 'error');
        } finally {
            this.isLoading = false;
        }
    }
    
    async moveToCart(productId) {
        try {
            const formData = new FormData();
            formData.append('product_id', productId);
            formData.append('quantity', 1);
            
            const response = await fetch(this.endpoints.moveToCart, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast('تمت إضافة المنتج إلى السلة بنجاح', 'success');
                
                await this.removeItem(productId);
            } else {
                throw new Error(result.msg || 'فشل في إضافة المنتج إلى السلة');
            }
        } catch (error) {
            console.error('Error moving to cart:', error);
            this.showToast('حدث خطأ أثناء إضافة المنتج إلى السلة', 'error');
        }
    }
    
    bindEvents() {
        document.querySelector(this.selectors.clearAllBtn).addEventListener('click', () => {
            this.clearAll();
        });
    }
    
    showLoading() {
        this.hideAllSections();
        document.querySelector(this.selectors.loadingSection).style.display = 'block';
    }
    
    showError(message) {
        this.hideAllSections();
        document.querySelector(this.selectors.errorSection).style.display = 'block';
        document.querySelector(this.selectors.errorMessage).textContent = message;
    }
    
    showEmptyState() {
        this.hideAllSections();
        document.querySelector('#empty-section').style.display = 'block';
    }
    
    showWishlistContent() {
        this.hideAllSections();
        document.querySelector(this.selectors.wishlistContent).style.display = 'block';
    }
    
    hideAllSections() {
        document.querySelector(this.selectors.loadingSection).style.display = 'none';
        document.querySelector(this.selectors.errorSection).style.display = 'none';
        document.querySelector('#empty-section').style.display = 'none';
        document.querySelector(this.selectors.wishlistContent).style.display = 'none';
    }
    
    showToast(message, type = 'info') {
        const container = document.querySelector(this.selectors.toastContainer) || this.createToastContainer();
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${this.getToastIcon(type)}</span>
            <span class="toast-message">${message}</span>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
        return container;
    }
    
    getToastIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }
    
    updateGlobalWishlistCount(count) {
        const headerCounter = document.getElementById('header-wishlist-count');
        if (headerCounter) {
            headerCounter.textContent = count;
        }
    }
    
    retryLoading() {
        this.loadWishlistData();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.WishlistSystem = new WishlistSystem();
    window.WishlistUI = {
        removeItem: (productId) => window.WishlistSystem.removeItem(productId),
        moveToCart: (productId) => window.WishlistSystem.moveToCart(productId),
        retryLoading: () => window.WishlistSystem.retryLoading()
    };
});
