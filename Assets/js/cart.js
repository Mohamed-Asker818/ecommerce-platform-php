
class CartSystem {
    constructor() {
        this.cartData = null;
        this.isLoading = false;
        this.currentAction = null;
        
        this.selectors = {
            loadingSection: '#loading-section',
            errorSection: '#error-section',
            errorMessage: '#error-message',
            emptyCartSection: '#empty-cart-section',
            cartContentSection: '#cart-content-section',
            cartItemsContainer: '#cart-items-container',
            cartFooter: '#cart-footer',
            itemsCount: '#items-count',
            summaryProductsCount: '#summary-products-count',
            summarySubtotal: '#summary-subtotal',
            summaryShipping: '#summary-shipping',
            summaryTotal: '#summary-total',
            checkoutBtn: '#checkout-btn',
            clearAllBtn: '#clear-all-btn',
            confirmationModal: '#confirmation-modal',
            modalTitle: '#modal-title',
            modalMessage: '#modal-message',
            modalCancel: '#modal-cancel',
            modalConfirm: '#modal-confirm',
            toastContainer: '#toast-container',
            userInfo: '#user-info'
        };
        
        this.endpoints = {
            cartData: '../Api/cart_ajax.php',
            cartAction: '../Api/cart_action.php'
        };
        
        this.init();
    }
    
    init() {
        this.loadCartData();
        this.bindEvents();
    }
    
    async loadCartData() {
        try {
            this.showLoading();
            
            const response = await fetch(this.endpoints.cartData);
            const data = await response.json();
            
            if (data.success) {
                this.cartData = data;
                this.updateUI();
                this.updateUserInfo();
            } else {
                throw new Error(data.msg || 'فشل في تحميل بيانات السلة');
            }
        } catch (error) {
            console.error('Error loading cart:', error);
            this.showError('حدث خطأ في تحميل سلة المشتريات. يرجى المحاولة مرة أخرى.');
        }
    }
    
    updateUI() {
        this.hideAllSections();
        
        if (!this.cartData.cartItems || this.cartData.cartItems.length === 0) {
            this.showEmptyCart();
            return;
        }
        
        this.showCartContent();
        this.renderCartItems();
        this.updateSummary();
        this.updateCartFooter();
    }
    
    renderCartItems() {
        const container = document.querySelector(this.selectors.cartItemsContainer);
        const items = this.cartData.cartItems;
        
        container.innerHTML = items.map(item => this.createCartItemHTML(item)).join('');
        
        // Bind item events
        this.bindItemEvents();
    }
    
    createCartItemHTML(item) {
        const isLowStock = item.stock && item.quantity > item.stock;
        const maxQuantity = item.stock || 999;
        
        return `
            <div class="cart-item" data-id="${item.id}">
                <img src="../Assets/images/${item.image || 'default.jpg'}" 
                     alt="${item.name}" 
                     class="cart-item-image"
                     onerror="this.src='../Assets/images/default.jpg'">
                
                <div class="cart-item-details">
                    <h3 class="cart-item-name">${item.name}</h3>
                    <div class="cart-item-price">${parseFloat(item.price).toFixed(2)} ج.م</div>
                    ${isLowStock ? `
                        <div class="stock-warning">
                            ⚠️ المخزون المتبقي: ${item.stock} فقط
                        </div>
                    ` : ''}
                </div>
                
                <div class="cart-item-actions">
                    <div class="quantity-control">
                        <button class="qty-btn minus" ${item.quantity <= 1 ? 'disabled' : ''}>−</button>
                        <span class="quantity-display">${item.quantity}</span>
                        <button class="qty-btn plus" ${item.quantity >= maxQuantity ? 'disabled' : ''}>+</button>
                    </div>
                </div>
                
                <div class="item-total">
                    ${parseFloat(item.subtotal).toFixed(2)} ج.م
                </div>
                
                <button class="remove-btn" title="حذف المنتج">×</button>
            </div>
        `;
    }
    
    updateSummary() {
        const items = this.cartData.cartItems;
        const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
        const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
        const shipping = 0; // يمكنك إضافة حساب الشحن هنا
        const total = subtotal + shipping;
        
        document.querySelector(this.selectors.itemsCount).textContent = 
            `${totalItems} منتج${totalItems > 1 ? 'ات' : ''}`;
        
        document.querySelector(this.selectors.summaryProductsCount).textContent = totalItems;
        document.querySelector(this.selectors.summarySubtotal).textContent = 
            `${subtotal.toFixed(2)} ج.م`;
        document.querySelector(this.selectors.summaryShipping).textContent = 
            `${shipping.toFixed(2)} ج.م`;
        document.querySelector(this.selectors.summaryTotal).textContent = 
            `${total.toFixed(2)} ج.م`;
        
        // Enable checkout button
        const checkoutBtn = document.querySelector(this.selectors.checkoutBtn);
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = '💳 إتمام الشراء';
    }
    
    updateCartFooter() {
        const footer = document.querySelector(this.selectors.cartFooter);
        footer.style.display = 'block';
    }
    
    updateUserInfo() {
        const userInfo = document.querySelector(this.selectors.userInfo);
        if (this.cartData.userInfo) {
            userInfo.innerHTML = `
                <span class="user-name">${this.cartData.userInfo.name}</span>
                <span class="user-email">${this.cartData.userInfo.email}</span>
            `;
        }
    }
    
    async performCartAction(action, productId = null) {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.currentAction = action;
        
        try {
            let url = `${this.endpoints.cartAction}?action=${action}`;
            if (productId) {
                url += `&id=${productId}`;
            }
            
            const response = await fetch(url);
            const result = await response.json();
            
            if (result.success) {
                this.showToast(result.msg || 'تمت العملية بنجاح', 'success');
                await this.loadCartData();
            } else {
                this.showToast(result.msg || 'فشلت العملية', 'error');
            }
        } catch (error) {
            console.error('Error performing cart action:', error);
            this.showToast('حدث خطأ أثناء تنفيذ العملية', 'error');
        } finally {
            this.isLoading = false;
            this.currentAction = null;
        }
    }
    
    bindEvents() {
        // Clear all button
        document.querySelector(this.selectors.clearAllBtn).addEventListener('click', () => {
            this.showConfirmation('تفريغ السلة', 'هل أنت متأكد من تفريغ السلة بالكامل؟', () => {
                this.performCartAction('clear');
            });
        });
        
        // Checkout button
        document.querySelector(this.selectors.checkoutBtn).addEventListener('click', () => {
            window.location.href = 'checkout.php';
        });
        
        // Modal events
        document.querySelector(this.selectors.modalCancel).addEventListener('click', () => {
            this.hideConfirmation();
        });
        
        document.querySelector(this.selectors.modalConfirm).addEventListener('click', () => {
            if (this.confirmationCallback) {
                this.confirmationCallback();
                this.hideConfirmation();
            }
        });
    }
    
    bindItemEvents() {
        // Quantity buttons
        document.querySelectorAll('.qty-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const item = e.target.closest('.cart-item');
                const productId = item.dataset.id;
                const action = e.target.classList.contains('plus') ? 'add' : 'minus';
                
                this.performCartAction(action, productId);
            });
        });
        
        // Remove buttons
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const item = e.target.closest('.cart-item');
                const productId = item.dataset.id;
                
                this.showConfirmation('حذف المنتج', 'هل تريد حذف هذا المنتج من السلة؟', () => {
                    this.performCartAction('remove', productId);
                });
            });
        });
    }
    
    showConfirmation(title, message, callback) {
        this.confirmationCallback = callback;
        
        document.querySelector(this.selectors.modalTitle).textContent = title;
        document.querySelector(this.selectors.modalMessage).textContent = message;
        document.querySelector(this.selectors.confirmationModal).style.display = 'flex';
    }
    
    hideConfirmation() {
        document.querySelector(this.selectors.confirmationModal).style.display = 'none';
        this.confirmationCallback = null;
    }
    
    showToast(message, type = 'info') {
        const container = document.querySelector(this.selectors.toastContainer);
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${this.getToastIcon(type)}</span>
            <span class="toast-message">${message}</span>
        `;
        
        container.appendChild(toast);
        
        // Remove toast after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
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
    
    showLoading() {
        this.hideAllSections();
        document.querySelector(this.selectors.loadingSection).style.display = 'block';
    }
    
    showError(message) {
        this.hideAllSections();
        document.querySelector(this.selectors.errorSection).style.display = 'block';
        document.querySelector(this.selectors.errorMessage).textContent = message;
    }
    
    showEmptyCart() {
        this.hideAllSections();
        document.querySelector(this.selectors.emptyCartSection).style.display = 'block';
    }
    
    showCartContent() {
        this.hideAllSections();
        document.querySelector(this.selectors.cartContentSection).style.display = 'block';
    }
    
    hideAllSections() {
        document.querySelector(this.selectors.loadingSection).style.display = 'none';
        document.querySelector(this.selectors.errorSection).style.display = 'none';
        document.querySelector(this.selectors.emptyCartSection).style.display = 'none';
        document.querySelector(this.selectors.cartContentSection).style.display = 'none';
        document.querySelector(this.selectors.cartFooter).style.display = 'none';
    }
    
    retryLoading() {
        this.loadCartData();
    }
}

// Initialize cart system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.CartSystem = new CartSystem();
    window.CartUI = {
        retryLoading: () => window.CartSystem.retryLoading()
    };
});
