
class MyOrders {
    constructor() {
        this.currentPage = 1;
        this.filters = {
            status: 'all',
            sort: 'newest',
            limit: 10
        };
        this.currentOrderId = null;
        this.isLoading = false;
        
        this.selectors = {
            loadingSection: '#loading-section',
            errorSection: '#error-section',
            errorMessage: '#error-message',
            ordersContent: '#orders-content',
            ordersStats: '#orders-stats',
            resultsCount: '#results-count',
            ordersList: '#orders-list',
            emptyState: '#empty-state',
            pagination: '#pagination',
            orderDetailsModal: '#order-details-modal',
            cancelOrderModal: '#cancel-order-modal',
            globalLoading: '#global-loading',
            loadingMessage: '#loading-message',
            userWelcome: '#user-welcome'
        };
        
        this.endpoints = {
            getOrders: '../Api/my_orders_api.php?action=get_orders',
            getOrderDetails: '../Api/my_orders_api.php?action=get_order_details',
            cancelOrder: '../Api/my_orders_api.php?action=cancel_order',
            repeatOrder: '../Api/my_orders_api.php?action=repeat_order'
        };

        this.loadOrders = this.loadOrders.bind(this);
        this.viewOrderDetails = this.viewOrderDetails.bind(this);
        this.repeatOrder = this.repeatOrder.bind(this);
        this.cancelOrder = this.cancelOrder.bind(this);
        this.closeOrderModal = this.closeOrderModal.bind(this);
        this.closeCancelModal = this.closeCancelModal.bind(this);
        this.applyFilters = this.applyFilters.bind(this);
        this.resetFilters = this.resetFilters.bind(this);
        this.retryLoading = this.retryLoading.bind(this);

        this.init();
    }

    q(selector) {
        try {
            return document.querySelector(selector);
        } catch (e) {
            console.error('Selector error:', e);
            return null;
        }
    }
    id(id) {
        return document.getElementById(id);
    }
    showSel(selector) {
        const el = this.q(selector);
        if (el) el.style.display = 'block';
    }
    hideSel(selector) {
        const el = this.q(selector);
        if (el) el.style.display = 'none';
    }
    setText(selector, text) {
        const el = this.q(selector);
        if (el) el.textContent = text;
    }
    setHTML(selector, html) {
        const el = this.q(selector);
        if (el) el.innerHTML = html;
    }

    init() {
        console.log('Initializing MyOrders...');
        this.bindEvents();
        this.loadUserInfo();
        this.loadOrders();
        this.setupAutoRefresh();
    }
    
    async loadUserInfo() {
        try {
            const userName = localStorage.getItem('user_name') || 'مستخدم';
            const userEmail = localStorage.getItem('user_email') || '';
            const welcomeEl = this.q(this.selectors.userWelcome);
            if (welcomeEl) {
                welcomeEl.innerHTML = `
                    مرحباً <strong>${userName}</strong>! ${userEmail ? `(${userEmail})` : ''}
                `;
            }
        } catch (error) {
            console.error('Error loading user info:', error);
        }
    }

    getApiUrl(endpoint) {
        const ep = (endpoint || '').replace(/^\/+/, '');
        const dir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        const baseUrl = window.location.origin + dir + ep;
        console.log('Built URL:', baseUrl);
        return baseUrl;
    }

    async loadOrders(page = 1) {
        if (this.isLoading) return;
        this.currentPage = page;
        this.showLoading();

        try {
            const endpoint = this.endpoints.getOrders || 'my_orders_api.php?action=get_orders';
            const baseUrl = this.getApiUrl(endpoint);
            const sep = baseUrl.includes('?') ? '&' : '?';
            let url = `${baseUrl}${sep}page=${page}&limit=${this.filters.limit}`;

            if (this.filters.status && this.filters.status !== 'all') {
                url += `&status=${encodeURIComponent(this.filters.status)}`;
            }

            console.log('Fetching orders from:', url);
            const response = await fetch(url, { 
                credentials: 'same-origin',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });

            if (!response.ok) {
                const text = await response.text().catch(()=> '');
                console.error('Server returned non-OK:', response.status, text);
                throw new Error('خطأ في الخادم: ' + response.status);
            }

            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Expected JSON but got:', text.substring(0, 200));
                throw new Error('استجابة غير صالحة من الخادم');
            }

            const data = await response.json();
            console.log('Orders data:', data);
            
            if (data.success) {
                this.renderOrders(data);
            } else {
                this.showError(data.message || 'حدث خطأ في جلب الطلبات');
            }
        } catch (error) {
            console.error('Error loading orders:', error);
            this.showError('حدث خطأ في الاتصال بالخادم: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }
    
    renderOrders(data) {
        if (data.filters) {
            Object.assign(this.filters, data.filters);
        }
        
        this.updateFiltersUI();
        this.renderStats(data.stats);
        this.renderOrdersList(data.orders || []);
        this.renderPagination(data.pagination || null);
        this.updateResultsCount(data.pagination?.total || (data.orders ? data.orders.length : 0));
        
        const emptyState = this.q(this.selectors.emptyState);
        if (emptyState) {
            if (!data.orders || data.orders.length === 0) {
                emptyState.style.display = 'block';
            } else {
                emptyState.style.display = 'none';
            }
        }
        
        this.hideAllSections();
        const ordersContent = this.q(this.selectors.ordersContent);
        if (ordersContent) ordersContent.style.display = 'block';
    }
    
    renderStats(stats) {
        const statsContainer = this.q(this.selectors.ordersStats);
        if (!stats || !statsContainer) return;
        
        statsContainer.innerHTML = `
            <div class="stat-card">
                <span class="stat-icon">📦</span>
                <div class="stat-value">${stats.total_orders || 0}</div>
                <div class="stat-label">إجمالي الطلبات</div>
            </div>
            <div class="stat-card">
                <span class="stat-icon">💰</span>
                <div class="stat-value">${stats.formatted_total_spent || '0.00'}</div>
                <div class="stat-label">إجمالي المشتريات</div>
            </div>
            <div class="stat-card">
                <span class="stat-icon">⏳</span>
                <div class="stat-value">${stats.by_status?.pending || 0}</div>
                <div class="stat-label">طلبات قيد الانتظار</div>
            </div>
            <div class="stat-card">
                <span class="stat-icon">🚀</span>
                <div class="stat-value">${stats.recent_orders || 0}</div>
                <div class="stat-label">طلبات هذا الشهر</div>
            </div>
        `;
    }
    
    renderOrdersList(orders) {
        const ordersList = this.q(this.selectors.ordersList);
        if (!ordersList) return;
        
        if (!orders || orders.length === 0) {
            ordersList.innerHTML = '';
            return;
        }
        
        const ordersHTML = orders.map(order => this.createOrderCard(order)).join('');
        ordersList.innerHTML = ordersHTML;
        
        this.bindOrderCardEvents();
    }
    
    createOrderCard(order) {
        const statusClass = order.status_class || 'pending';
        const canCancel = order.can_cancel !== false;
        const canRepeat = order.can_repeat !== false;
        
        return `
            <div class="order-card" data-order-id="${order.id}">
                <div class="order-card-header">
                    <div class="order-info">
                        <div class="order-number">
                            <i class="fas fa-hashtag"></i>
                            ${order.order_number || ''}
                        </div>
                        <div class="order-date">
                            <i class="fas fa-calendar"></i>
                            ${order.created_at || ''}
                        </div>
                    </div>
                    <div class="order-status-badge ${statusClass}">
                        <span class="status-icon">${order.status_icon || ''}</span>
                        <span class="status-text">${order.status_name || ''}</span>
                    </div>
                </div>
                
                <div class="order-details">
                    <div class="detail-item">
                        <div class="detail-label">المجموع</div>
                        <div class="detail-value">${order.formatted_total || '0.00'} ج.م</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">طريقة الدفع</div>
                        <div class="detail-value">${order.payment_method || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">حالة الدفع</div>
                        <div class="detail-value">${order.payment_status || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">عدد المنتجات</div>
                        <div class="detail-value">${order.items_count || 0} منتج</div>
                    </div>
                </div>
                
                <div class="order-actions">
                    <button class="order-btn primary view-details-btn" data-order-id="${order.id}">
                        <i class="fas fa-eye"></i> عرض التفاصيل
                    </button>
                    
                    ${canRepeat ? `
                    <button class="order-btn success repeat-order-btn" data-order-id="${order.id}">
                        <i class="fas fa-redo"></i> إعادة الطلب
                    </button>` : ''}
                    
                    ${canCancel ? `
                    <button class="order-btn danger cancel-order-btn" data-order-id="${order.id}">
                        <i class="fas fa-times"></i> إلغاء الطلب
                    </button>` : ''}
                    
                    <button class="order-btn secondary track-order-btn" onclick="window.location.href='order_success.php?id=${order.id}'">
                        <i class="fas fa-truck"></i> تتبع الطلب
                    </button>
                </div>
            </div>
        `;
    }
    
    renderPagination(pagination) {
        const paginationContainer = this.q(this.selectors.pagination);
        if (!paginationContainer) return;
        
        if (!pagination || pagination.pages <= 1) {
            paginationContainer.style.display = 'none';
            return;
        }
        
        paginationContainer.style.display = 'flex';
        
        let paginationHTML = '';
        const currentPage = pagination.page || 1;
        const totalPages = pagination.pages || 1;
        
        paginationHTML += `
            <button class="pagination-btn prev-btn" ${currentPage <= 1 ? 'disabled' : ''} data-page="${currentPage - 1}">
                <i class="fas fa-chevron-right"></i> السابق
            </button>
        `;
        
        const maxVisible = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        
        if (endPage - startPage + 1 < maxVisible) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }
        
        if (startPage > 1) {
            paginationHTML += `<button class="pagination-btn" data-page="1">1</button>${startPage > 2 ? '<span class="pagination-dots">...</span>' : ''}`;
        }
        
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        
        if (endPage < totalPages) {
            paginationHTML += `${endPage < totalPages - 1 ? '<span class="pagination-dots">...</span>' : ''}<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
        }
        
        paginationHTML += `
            <button class="pagination-btn next-btn" ${currentPage >= totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">
                التالي <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        paginationHTML += `<span class="pagination-info">صفحة ${currentPage} من ${totalPages}</span>`;
        
        paginationContainer.innerHTML = paginationHTML;

        paginationContainer.querySelectorAll('.pagination-btn:not([disabled])').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = parseInt(btn.getAttribute('data-page')) || 1;
                this.loadOrders(page);
            });
        });
    }
    
    updateResultsCount(total) {
        const resultsCount = this.q(this.selectors.resultsCount);
        if (resultsCount) resultsCount.textContent = `${total} طلب`;
    }
    
    updateFiltersUI() {
        const sf = this.id('status-filter');
        const so = this.id('sort-filter');
        const lf = this.id('limit-filter');
        if (sf) sf.value = this.filters.status;
        if (so) so.value = this.filters.sort;
        if (lf) lf.value = this.filters.limit;
    }
    
    async viewOrderDetails(orderId) {
        if (!orderId) {
            this.showNotification('رقم الطلب غير صالح', 'error');
            return;
        }
        
        this.showGlobalLoading('جاري تحميل تفاصيل الطلب...');
        console.log('Loading order details for ID:', orderId);

        try {
            const endpoint = this.endpoints.getOrderDetails || 'my_orders_api.php?action=get_order_details';
            const baseUrl = this.getApiUrl(endpoint);
            const sep = baseUrl.includes('?') ? '&' : '?';
            const url = `${baseUrl}${sep}order_id=${encodeURIComponent(orderId)}`;

            console.log('Fetching order details from:', url);
            const response = await fetch(url, { 
                credentials: 'same-origin',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });

            if (!response.ok) {
                const text = await response.text().catch(() => '');
                console.error('Order details fetch failed. HTTP', response.status, text);
                this.showNotification('حدث خطأ في الاتصال بالخادم (HTTP ' + response.status + ')', 'error');
                return;
            }

            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Expected JSON but got HTML/text for order details:', text.substring(0, 500));
                this.showNotification('الخادم أعاد استجابة غير صالحة - يرجى التحقق من الـ Console', 'error');
                return;
            }

            const data = await response.json();
            console.log('Order details response:', data);
            
            if (data.success) {
                this.showOrderDetailsModal(data);
            } else {
                console.warn('API returned success:false for order details', data);
                this.showNotification(data.message || 'حدث خطأ في جلب التفاصيل', 'error');
            }
        } catch (err) {
            console.error('Error loading order details:', err);
            this.showNotification('حدث خطأ في الاتصال بالخادم: ' + err.message, 'error');
        } finally {
            this.hideGlobalLoading();
        }
    }

    showOrderDetailsModal(data) {
        const modal = this.q(this.selectors.orderDetailsModal);
        if (!modal) {
            console.error('Modal element not found');
            return;
        }
        
        const modalBody = modal.querySelector('#modal-body');
        if (!modalBody) {
            console.error('Modal body not found');
            return;
        }
        
        let content = this.buildOrderDetailsContent(data);
        
        const titleEl = modal.querySelector('#modal-title');
        if (titleEl) {
            titleEl.textContent = `تفاصيل الطلب #${data.order?.order_number || ''}`;
        }
        
        modalBody.innerHTML = content;
        modal.style.display = 'flex';
        
        document.body.style.overflow = 'hidden';
        
        this.bindModalEvents();
    }
    
    buildOrderDetailsContent(data) {
        const order = data.order || {};
        const items = data.items || [];
        const timeline = data.timeline || [];
        const shipping = data.shipping || null;
        
        let content = `
            <div class="order-details-modal">
                <div class="order-summary">
                    <div class="summary-row">
                        <strong>الحالة:</strong>
                        <span class="status-badge ${order.status_class || ''}" style="background-color: ${order.status_color || '#ddd'}">
                            ${order.status_icon || ''} ${order.status_name || ''}
                        </span>
                    </div>
                    <div class="summary-row"><strong>تاريخ الطلب:</strong> ${order.created_at || ''}</div>
                    <div class="summary-row"><strong>المجموع:</strong> ${order.formatted_total || '0.00'} ج.م</div>
                    <div class="summary-row"><strong>طريقة الدفع:</strong> ${order.payment_method || '-'}</div>
                    <div class="summary-row"><strong>حالة الدفع:</strong> ${order.payment_status || '-'}</div>
                </div>
        `;
        
        if (shipping && (shipping.tracking_number || shipping.carrier)) {
            content += `
                <div class="shipping-info">
                    <h4><i class="fas fa-truck"></i> معلومات الشحن</h4>
                    <div class="shipping-details">
                        ${shipping.tracking_number ? `<div><strong>رقم التتبع:</strong> ${shipping.tracking_number}</div>` : ''}
                        ${shipping.carrier ? `<div><strong>شركة الشحن:</strong> ${shipping.carrier}</div>` : ''}
                        ${shipping.estimated_delivery ? `<div><strong>التسليم المتوقع:</strong> ${shipping.estimated_delivery}</div>` : ''}
                        ${shipping.actual_delivery ? `<div><strong>تاريخ التسليم الفعلي:</strong> ${shipping.actual_delivery}</div>` : ''}
                        ${shipping.shipping_address ? `<div><strong>عنوان الشحن:</strong> ${shipping.shipping_address}</div>` : ''}
                    </div>
                </div>
            `;
        }
        
        content += `
            <div class="order-items-section">
                <h4><i class="fas fa-box"></i> المنتجات المطلوبة</h4>
                <div class="order-items-list">
        `;
        
        if (items.length === 0) {
            content += `<div class="no-items">لا توجد منتجات في هذا الطلب</div>`;
        } else {
            items.forEach((item, index) => {
                content += `
                    <div class="order-item-row">
                        <div class="item-image">
                            <img src="admin/assets/images/${item.image || 'default.jpg'}" alt="${item.product_name || ''}" 
                                 onerror="this.onerror=null; this.src='admin/assets/images/default.jpg'">
                        </div>
                        <div class="item-details">
                            <div class="item-name">${item.product_name || 'منتج غير معروف'}</div>
                            <div class="item-price">${item.formatted_price || '0.00'} ج.م</div>
                        </div>
                        <div class="item-quantity">×${item.quantity || 1}</div>
                        <div class="item-total">${item.formatted_subtotal || '0.00'} ج.م</div>
                    </div>
                `;
            });
        }
        
        content += `</div></div>`;
        
        if (timeline.length > 0) {
            content += `<div class="order-timeline"><h4><i class="fas fa-history"></i> سجل الطلب</h4>`;
            timeline.forEach(event => {
                content += `
                    <div class="timeline-item">
                        <div class="timeline-icon">${event.icon || ''}</div>
                        <div class="timeline-content">
                            <div class="timeline-title">${event.description || ''}</div>
                            <div class="timeline-date">${event.created_at || ''}</div>
                        </div>
                    </div>
                `;
            });
            content += `</div>`;
        }
        
        content += `
                <div class="modal-actions" style="margin-top: 20px;">
                    <button class="cancel-btn" id="modal-close-btn"><i class="fas fa-times"></i> إغلاق</button>
                    ${order.can_repeat ? `<button class="confirm-btn" id="modal-repeat-btn" data-order-id="${order.id}"><i class="fas fa-redo"></i> إعادة الطلب</button>` : ''}
                    ${order.can_cancel ? `<button class="confirm-btn danger" id="modal-cancel-btn" data-order-id="${order.id}"><i class="fas fa-times"></i> إلغاء الطلب</button>` : ''}
                </div>
            </div>
        `;
        
        return content;
    }
    
    showCancelModal(orderId) {
        this.currentOrderId = orderId;
        const modal = this.q(this.selectors.cancelOrderModal);
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }
    
    closeCancelModal() {
        this.currentOrderId = null;
        const modal = this.q(this.selectors.cancelOrderModal);
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
        const reason = this.id('cancel-reason');
        if (reason) reason.value = '';
    }
    
    async cancelOrder() {
        const orderId = this.currentOrderId;
        if (!orderId) { 
            this.showNotification('رقم الطلب غير صالح','error'); 
            return; 
        }
        
        this.showGlobalLoading('جاري إلغاء الطلب...');
        try {
            const endpoint = this.endpoints.cancelOrder || 'my_orders_api.php?action=cancel_order';
            const url = this.getApiUrl(endpoint);
            const formData = new FormData();
            formData.append('order_id', orderId);
            const reasonEl = this.id('cancel-reason');
            if (reasonEl && reasonEl.value.trim()) {
                formData.append('reason', reasonEl.value.trim());
            }

            const response = await fetch(url, { 
                method: 'POST', 
                body: formData, 
                credentials: 'same-origin' 
            });
            
            const data = await response.json();
            console.log('Cancel response:', data);
            
            if (data.success) {
                this.showNotification(data.message || 'تم إلغاء الطلب بنجاح', 'success');
                this.closeCancelModal();
                this.loadOrders(this.currentPage);
            } else {
                this.showNotification(data.message || 'حدث خطأ في إلغاء الطلب', 'error');
            }
        } catch (err) {
            console.error('Error cancelling order:', err);
            this.showNotification('حدث خطأ في الاتصال بالخادم', 'error');
        } finally {
            this.hideGlobalLoading();
        }
    }

    async repeatOrder(orderId) {
        if (!orderId) return;
        
        if (!confirm('هل تريد إضافة منتجات هذا الطلب إلى سلة المشتريات؟')) return;
        
        this.showGlobalLoading('جاري إعادة الطلب...');
        try {
            const endpoint = this.endpoints.repeatOrder || 'my_orders_api.php?action=repeat_order';
            const url = this.getApiUrl(endpoint);
            const formData = new FormData();
            formData.append('order_id', orderId);
            
            const response = await fetch(url, { 
                method: 'POST', 
                body: formData, 
                credentials: 'same-origin' 
            });
            
            const data = await response.json();
            console.log('Repeat order response:', data);
            
            if (data.success) {
                this.showNotification(data.message || 'تمت إضافة المنتجات إلى السلة', 'success');
                if (typeof updateCartCount === 'function') {
                    updateCartCount(data.added_count);
                }
                this.closeOrderModal();
                setTimeout(() => {
                    window.location.href = 'cart.php';
                }, 1500);
            } else {
                this.showNotification(data.message || 'حدث خطأ في إعادة الطلب', 'error');
            }
        } catch (err) {
            console.error('Error repeating order:', err);
            this.showNotification('حدث خطأ في الاتصال بالخادم', 'error');
        } finally {
            this.hideGlobalLoading();
        }
    }
    
    applyFilters() {
        const status = this.id('status-filter')?.value || 'all';
        const sort = this.id('sort-filter')?.value || 'newest';
        const limit = this.id('limit-filter')?.value || 10;
        
        this.filters = { status, sort, limit };
        this.loadOrders(1);
    }
    
    resetFilters() {
        this.filters = { status: 'all', sort: 'newest', limit: 10 };
        this.updateFiltersUI();
        this.loadOrders(1);
    }
    
    bindEvents() {
        const applyBtn = this.id('apply-filters-btn');
        const resetBtn = this.id('reset-filters-btn');
        const confirmCancelBtn = this.id('confirm-cancel-btn');
        const cancelCancelBtn = this.id('cancel-cancel-btn');
        
        if (applyBtn) applyBtn.addEventListener('click', this.applyFilters);
        if (resetBtn) resetBtn.addEventListener('click', this.resetFilters);
        if (confirmCancelBtn) confirmCancelBtn.addEventListener('click', () => this.cancelOrder());
        if (cancelCancelBtn) cancelCancelBtn.addEventListener('click', () => this.closeCancelModal());
        
        document.addEventListener('click', (e) => {
            const orderModal = this.q(this.selectors.orderDetailsModal);
            const cancelModal = this.q(this.selectors.cancelOrderModal);
            
            if (orderModal && e.target === orderModal) {
                this.closeOrderModal();
            }
            if (cancelModal && e.target === cancelModal) {
                this.closeCancelModal();
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeOrderModal();
                this.closeCancelModal();
            }
        });
        
        const retryBtn = this.q('#retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', this.retryLoading);
        }
    }
    
    bindOrderCardEvents() {
        document.querySelectorAll('.view-details-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const orderId = btn.dataset.orderId;
                this.viewOrderDetails(orderId);
            });
        });
        
        document.querySelectorAll('.repeat-order-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const orderId = btn.dataset.orderId;
                this.repeatOrder(orderId);
            });
        });
        
        document.querySelectorAll('.cancel-order-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const orderId = btn.dataset.orderId;
                this.showCancelModal(orderId);
            });
        });
    }
    
    bindModalEvents() {
        const modal = this.q(this.selectors.orderDetailsModal);
        if (!modal) return;
        
        const closeBtn = modal.querySelector('#modal-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', this.closeOrderModal);
        }
        
        const repeatBtn = modal.querySelector('#modal-repeat-btn');
        if (repeatBtn) {
            repeatBtn.addEventListener('click', () => {
                const id = parseInt(repeatBtn.getAttribute('data-order-id'));
                this.repeatOrder(id);
            });
        }
        
        const cancelBtn = modal.querySelector('#modal-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                const id = parseInt(cancelBtn.getAttribute('data-order-id'));
                this.showCancelModal(id);
            });
        }
    }
    
    setupAutoRefresh() {
        setInterval(() => {
            if (document.visibilityState === 'visible' && !this.isLoading) {
                this.loadOrders(this.currentPage);
            }
        }, 60000);
    }
    
    showLoading() {
        this.isLoading = true;
        this.hideAllSections();
        this.showSel(this.selectors.loadingSection);
    }
    
    hideLoading() {
        this.isLoading = false;
        this.hideSel(this.selectors.loadingSection);
    }
    
    showError(message) {
        this.hideAllSections();
        this.showSel(this.selectors.errorSection);
        this.setText(this.selectors.errorMessage, message);
    }
    
    hideAllSections() {
        this.hideSel(this.selectors.loadingSection);
        this.hideSel(this.selectors.errorSection);
        this.hideSel(this.selectors.ordersContent);
    }
    
    showGlobalLoading(message = 'جاري المعالجة...') {
        const overlay = this.q(this.selectors.globalLoading);
        if (!overlay) return;
        const msg = overlay.querySelector('#loading-message');
        if (msg) msg.textContent = message;
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
    
    hideGlobalLoading() {
        const overlay = this.q(this.selectors.globalLoading);
        if (overlay) overlay.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
    
    showNotification(message, type = 'info') {
        document.querySelectorAll('.notification').forEach(el => el.remove());
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${this.getNotificationIcon(type)}</span>
                <span class="notification-text">${message}</span>
                <button class="notification-close">×</button>
            </div>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            border-radius: 8px;
            padding: 15px 20px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideInRight 0.3s ease;
            border-right: 4px solid ${this.getNotificationColor(type)};
            min-width: 300px;
            max-width: 400px;
        `;
        
        document.body.appendChild(notification);
        notification.querySelector('.notification-close').onclick = () => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        };
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }
    
    getNotificationIcon(type) {
        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        return icons[type] || icons.info;
    }
    
    getNotificationColor(type) {
        const colors = { success: '#4CAF50', error: '#F44336', warning: '#FF9800', info: '#2196F3' };
        return colors[type] || colors.info;
    }
    
    closeOrderModal() {
        const modal = this.q(this.selectors.orderDetailsModal);
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }
    
    retryLoading() {
        this.loadOrders(this.currentPage);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const yearEl = document.getElementById('current-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        .notification-content { 
            display: flex; 
            align-items: center; 
            gap: 15px; 
        }
        .notification-icon { 
            font-size: 1.2rem; 
        }
        .notification-text { 
            flex: 1; 
            font-size: 0.9rem; 
        }
        .notification-close { 
            background: none; 
            border: none; 
            font-size: 1.5rem; 
            cursor: pointer; 
            color: #666; 
            width: 30px; 
            height: 30px; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            border-radius: 50%; 
        }
        .notification-close:hover { 
            background: #f0f0f0; 
        }
    `;
    document.head.appendChild(style);
    
    console.log('DOM loaded, initializing MyOrders...');
    window.MyOrders = new MyOrders();
});
