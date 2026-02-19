
class CompareSystem {
    constructor() {
        this.compareData = null;
        this.isLoading = false;
        this.maxProducts = this.getInitialMaxProducts();
        this.debounceTimer = null;
        this.cache = new Map();
        this.imageObserver = null;
        this.isDragging = false;
        this.dragIndex = null;
        this.dropIndex = null;
        
        this.selectors = {
            loadingSection: '#loading-section',
            errorSection: '#error-section',
            errorMessage: '#error-message',
            compareContent: '#compare-content',
            compareTable: '#compare-table',
            compareCount: '#compare-count',
            clearAllBtn: '#clear-all-btn',
            toastContainer: '#toast-container',
            addMoreSection: '#add-more-section',
            currentCount: '#current-count',
            maxProducts: '#max-products'
        };
        
        this.endpoints = {
            compareData: '../Api/compare_api.php?action=get_data',
            removeItem: '../Api/compare_api.php?action=remove_item',
            clearAll: '../Api/compare_api.php?action=clear_all',
            updatePositions: '../Api/compare_api.php?action=update_positions'
        };
        
        this.init();
    }
    
    getInitialMaxProducts() {
        return window.innerWidth <= 768 ? 2 : 4;
    }
    
    async init() {
        try {
            this.restoreScrollPosition();
            const cachedData = this.getFromCache('compareData');
            if (cachedData && cachedData.length > 0) {
                this.compareData = cachedData;
                this.updateUI();
            }
            
            await this.loadCompareData();
            this.bindEvents();
            this.initPerformanceOptimizations();
        } catch (error) {
            console.error('Initialization error:', error);
        }
    }
    
    async loadCompareData() {
        try {
            this.showLoading();
            
            const response = await fetch(`${this.endpoints.compareData}&t=${Date.now()}`, {
                cache: 'no-cache',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.compareData = data.products || [];
                this.saveToCache('compareData', this.compareData);
                this.updateUI();
            } else {
                throw new Error(data.msg || 'فشل في تحميل بيانات المقارنة');
            }
        } catch (error) {
            console.error('Error loading compare data:', error);
            this.showError('حدث خطأ في تحميل بيانات المقارنة. يرجى المحاولة مرة أخرى.');
            
            const cachedData = this.getFromCache('compareData');
            if (cachedData) {
                this.compareData = cachedData;
                this.updateUI();
                this.showToast('تم استخدام البيانات المخزنة مسبقاً', 'warning');
            }
        }
    }
    
    updateUI() {
        this.hideAllSections();
        
        if (!this.compareData || this.compareData.length === 0) {
            this.showEmptyState();
            return;
        }
        
        this.showCompareContent();
        this.renderCompareTable();
        this.updateCompareCount();
        this.updateAddMoreSection();
        this.updateMaxProductsDisplay();
    }
    
    renderCompareTable() {
        const container = document.querySelector(this.selectors.compareTable);
        const items = this.compareData;
        
        if (items.length === 0) {
            container.innerHTML = '<p class="no-products">لا توجد منتجات للمقارنة</p>';
            return;
        }
        
        const displayItems = items.slice(0, this.maxProducts);
        
        const tableHTML = this.createCompareTableHTML(displayItems);
        container.innerHTML = tableHTML;
        
        this.addTableAnimations();
        
        this.initLazyLoading();
        
        if (window.innerWidth > 768) {
            this.initProductSwitching();
        }
    }
    
    createCompareTableHTML(items) {
        const features = this.getComparisonFeatures(items);
        
        return `
            <div class="compare-table-container">
                <div class="compare-table-header">
                    <div class="feature-column">الميزة</div>
                    ${items.map((item, index) => `
                        <div class="product-column" data-id="${item.id}" data-index="${index}" draggable="true">
                            ${window.innerWidth > 768 ? `
                                <div class="product-switch-container">
                                    <button class="switch-btn up" onclick="CompareUI.moveProductUp(${item.id})" title="تحريك لأعلى">
                                        ↑
                                    </button>
                                    <button class="switch-btn down" onclick="CompareUI.moveProductDown(${item.id})" title="تحريك لأسفل">
                                        ↓
                                    </button>
                                </div>
                            ` : ''}
                            <button class="remove-item-btn" onclick="CompareUI.removeItem(${item.id})" 
                                    title="إزالة من المقارنة" aria-label="إزالة ${item.name}">
                                ❌
                            </button>
                            <div class="product-image">
                                <img data-src="${item.image ? '../Assets/images/' + item.image : '../Assets/images/default.jpg'}" 
                                     src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f0f0f0'/%3E%3C/svg%3E"
                                     alt="${item.name}"
                                     loading="lazy"
                                     onerror="this.src='../Assets/images/default.jpg'">
                            </div>
                            <div class="product-name">${this.escapeHtml(item.name)}</div>
                        </div>
                    `).join('')}
                </div>
                
                ${features.map(feature => this.createFeatureRow(feature, items)).join('')}
                
                <div class="compare-table-footer">
                    <div class="feature-column"></div>
                    ${items.map(item => `
                        <div class="product-column">
                            <button class="add-to-cart-btn" onclick="CompareUI.addToCart(${item.id})" 
                                    ${item.stock <= 0 ? 'disabled' : ''} aria-label="أضف ${item.name} للسلة">
                                🛒 أضف للسلة
                            </button>
                            <button class="view-product-btn" onclick="CompareUI.viewProduct(${item.id})" 
                                    aria-label="عرض تفاصيل ${item.name}">
                                👁️ عرض المنتج
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    createFeatureRow(feature, items) {
        return `
            <div class="compare-table-row">
                <div class="feature-column">${this.escapeHtml(feature.name)}</div>
                ${items.map(item => {
                    let value = this.getFeatureValue(feature.key, item);
                    let displayValue = this.formatFeatureValue(feature.key, value);
                    
                    return `
                        <div class="product-column" data-id="${item.id}" title="${String(value)}">
                            ${displayValue}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    initProductSwitching() {
        const productColumns = document.querySelectorAll('.product-column[draggable="true"]');
        
        productColumns.forEach(column => {
            // أحداث السحب
            column.addEventListener('dragstart', (e) => {
                this.isDragging = true;
                this.dragIndex = parseInt(column.dataset.index);
                column.classList.add('dragging');
                e.dataTransfer.setData('text/plain', column.dataset.id);
                e.dataTransfer.effectAllowed = 'move';
            });
            
            column.addEventListener('dragend', () => {
                this.isDragging = false;
                column.classList.remove('dragging');
                document.querySelectorAll('.product-column').forEach(col => {
                    col.classList.remove('drop-zone');
                });
                this.dragIndex = null;
                this.dropIndex = null;
            });
            
            // أحداث الإفلات
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                if (!column.classList.contains('dragging')) {
                    column.classList.add('drop-zone');
                    this.dropIndex = parseInt(column.dataset.index);
                }
            });
            
            column.addEventListener('dragleave', () => {
                column.classList.remove('drop-zone');
                this.dropIndex = null;
            });
            
            column.addEventListener('drop', (e) => {
                e.preventDefault();
                column.classList.remove('drop-zone');
                
                const draggedId = e.dataTransfer.getData('text/plain');
                const dropIndex = parseInt(column.dataset.index);
                
                if (this.dragIndex !== null && this.dragIndex !== dropIndex) {
                    this.swapProducts(this.dragIndex, dropIndex);
                }
            });
        });
    }
    
    swapProducts(fromIndex, toIndex) {
        if (!this.compareData || fromIndex === toIndex) return;
        
        // تبديل المنتجات في المصفوفة
        [this.compareData[fromIndex], this.compareData[toIndex]] = 
        [this.compareData[toIndex], this.compareData[fromIndex]];
        
        // حفظ التغييرات في Cache
        this.saveToCache('compareData', this.compareData);
        
        // إعادة رسم الجدول
        this.renderCompareTable();
        
        // إرسال التحديث للسيرفر (اختياري)
        this.savePositionsToServer();
        
        this.showToast('تم تبديل مواقع المنتجات بنجاح', 'success');
    }
    
    async savePositionsToServer() {
        try {
            const positions = this.compareData.map((item, index) => ({
                id: item.id,
                position: index
            }));
            
            const response = await fetch(this.endpoints.updatePositions, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ positions })
            });
            
            if (!response.ok) {
                console.warn('Failed to save positions to server');
            }
        } catch (error) {
            console.error('Error saving positions:', error);
        }
    }
    
    moveProductUp(productId) {
        const index = this.compareData.findIndex(item => item.id == productId);
        if (index > 0) {
            this.swapProducts(index, index - 1);
        }
    }
    
    moveProductDown(productId) {
        const index = this.compareData.findIndex(item => item.id == productId);
        if (index < this.compareData.length - 1) {
            this.swapProducts(index, index + 1);
        }
    }
    
    getComparisonFeatures(items) {
        const baseFeatures = [
            { key: 'price', name: 'السعر', type: 'price' },
            { key: 'old_price', name: 'السعر القديم', type: 'price' },
            { key: 'discount', name: 'التخفيض', type: 'percentage' },
            { key: 'stock', name: 'المتوفر', type: 'stock' },
            { key: 'category', name: 'الفئة', type: 'text' },
            { key: 'description', name: 'الوصف', type: 'text' },
            { key: 'rating', name: 'التقييم', type: 'rating' }
        ];
        
        items.forEach(item => {
            Object.keys(item).forEach(key => {
                if (!baseFeatures.some(f => f.key === key) && 
                    !['id', 'name', 'image'].includes(key) &&
                    item[key] !== null && item[key] !== '' &&
                    !key.includes('_')) {
                    baseFeatures.push({ 
                        key, 
                        name: this.formatFeatureName(key), 
                        type: 'text' 
                    });
                }
            });
        });
        
        return baseFeatures.slice(0, 15);
    }
    
    formatFeatureName(key) {
        const names = {
            'weight': 'الوزن',
            'dimensions': 'الأبعاد',
            'warranty': 'الضمان',
            'brand': 'العلامة التجارية',
            'color': 'اللون',
            'size': 'المقاس',
            'material': 'المادة'
        };
        
        return names[key] || key;
    }
    
    getFeatureValue(featureKey, product) {
        const value = product[featureKey];
        
        switch(featureKey) {
            case 'discount':
                if (product.old_price && product.price) {
                    const discount = ((product.old_price - product.price) / product.old_price) * 100;
                    return Math.round(discount) + '%';
                }
                return 'لا يوجد';
                
            case 'rating':
                if (value) {
                    const rating = Math.round(value);
                    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
                }
                return 'لا يوجد تقييم';
                
            default:
                return value !== null && value !== '' ? value : 'غير متوفر';
        }
    }
    
    formatFeatureValue(featureKey, value) {
        switch(featureKey) {
            case 'price':
            case 'old_price':
                return value !== 'غير متوفر' ? `${parseFloat(value).toFixed(2)} ج.م` : value;
                
            case 'stock':
                if (value <= 0) return '<span class="out-of-stock">⛔ نفذ</span>';
                if (value <= 5) return `<span class="low-stock">🟡 ${value} فقط</span>`;
                return `<span class="in-stock">✅ ${value}</span>`;
                
            default:
                return String(value);
        }
    }
    
    updateCompareCount() {
        const count = this.compareData ? Math.min(this.compareData.length, this.maxProducts) : 0;
        const countElement = document.querySelector(this.selectors.compareCount);
        const currentCountElement = document.querySelector(this.selectors.currentCount);
        
        if (countElement) {
            countElement.textContent = count;
        }
        if (currentCountElement) {
            currentCountElement.textContent = count;
        }
        
        this.updateGlobalCompareCount(count);
    }
    
    updateMaxProductsDisplay() {
        const maxProductsElement = document.querySelector(this.selectors.maxProducts);
        if (maxProductsElement) {
            maxProductsElement.textContent = this.maxProducts;
        }
    }
    
    updateAddMoreSection() {
        const section = document.querySelector(this.selectors.addMoreSection);
        if (!section) return;
        
        const count = this.compareData ? this.compareData.length : 0;
        const displayCount = Math.min(count, this.maxProducts);
        const isMaxLimitReached = displayCount >= this.maxProducts;
        
        if (isMaxLimitReached) {
            // عند الوصول للحد الأقصى - نعرض رسالة بسيطة
            section.innerHTML = `
                <p>⚠️ تم الوصول للحد الأقصى للمقارنة (${this.maxProducts} منتجات)</p>
            `;
            section.style.display = 'flex';
        } else if (count > displayCount) {
            // عند وجود منتجات أكثر من المسموح به
            const hiddenCount = count - displayCount;
            section.innerHTML = `
                <p>⚠️ يتم عرض ${displayCount} من أصل ${count} منتجات</p>
                <p>يوجد ${hiddenCount} منتج${hiddenCount > 1 ? 'ات' : ''} غير معروضة</p>
            `;
            section.style.display = 'flex';
        } else {
            // حالة عادية - يمكن إضافة المزيد
            const remaining = this.maxProducts - displayCount;
            if (remaining > 0) {
                section.innerHTML = `
                    <p>يمكنك إضافة ${remaining} منتج${remaining > 1 ? 'ات' : ''} أخرى للمقارنة</p>
                    <button class="add-more-btn" onclick="CompareUI.goToHome()">
                        ➕ إضافة منتجات أخرى
                    </button>
                `;
                section.style.display = 'flex';
            } else {
                section.style.display = 'none';
            }
        }
    }
    
    // دالة للتحقق عند الضغط على زر إضافة منتجات
    handleAddMoreClick() {
        const count = this.compareData ? this.compareData.length : 0;
        const displayCount = Math.min(count, this.maxProducts);
        
        if (displayCount >= this.maxProducts) {
            // عرض رسالة toast عند الوصول للحد الأقصى
            this.showMaxLimitToast();
            return false; // منع الانتقال
        }
        
        // إذا لم يكن عند الحد الأقصى، انتقل للصفحة الرئيسية
        this.goToHome();
        return true;
    }
    
    // دالة لعرض رسالة الحد الأقصى
    showMaxLimitToast() {
        const container = document.querySelector(this.selectors.toastContainer) || this.createToastContainer();
        const toast = document.createElement('div');
        toast.className = 'toast max-limit';
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <span class="toast-icon">⚠️</span>
            <span class="toast-message">
                <strong>الحد الأقصى للمقارنة</strong><br>
                لقد وصلت للحد الأقصى المسموح به للمقارنة (${this.maxProducts} منتجات)<br>
                لإضافة منتجات جديدة، يجب إزالة بعض المنتجات الحالية أولاً
            </span>
        `;
        
        container.appendChild(toast);
        
        // تأثير الظهور
        setTimeout(() => {
            toast.style.animation = 'slideInRight 0.3s ease';
        }, 10);
        
        // إزالة تلقائية بعد 5 ثواني
        const timeout = setTimeout(() => {
            this.removeToast(toast);
        }, 5000);
        
        // السماح بالإغلاق اليدوي
        toast.addEventListener('click', () => {
            clearTimeout(timeout);
            this.removeToast(toast);
        });
        
        // إضافة زر إزالة المنتجات داخل الـ toast
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-some-btn-toast';
        removeBtn.innerHTML = '🗑️ إزالة بعض المنتجات';
        removeBtn.style.cssText = `
            background: var(--warning-color);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: var(--border-radius-sm);
            font-family: inherit;
            font-weight: 600;
            cursor: pointer;
            margin-top: 10px;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all var(--transition-speed);
        `;
        
        removeBtn.addEventListener('mouseenter', () => {
            removeBtn.style.background = '#f57c00';
            removeBtn.style.transform = 'translateY(-2px)';
        });
        
        removeBtn.addEventListener('mouseleave', () => {
            removeBtn.style.background = 'var(--warning-color)';
            removeBtn.style.transform = 'translateY(0)';
        });
        
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showRemoveOptions();
            this.removeToast(toast);
        });
        
        toast.querySelector('.toast-message').appendChild(document.createElement('br'));
        toast.querySelector('.toast-message').appendChild(removeBtn);
    }
    
    showRemoveOptions() {
        const options = this.compareData.map(item => 
            `• ${item.name.substring(0, 30)}${item.name.length > 30 ? '...' : ''}`
        ).join('\n');
        
        if (confirm(`المنتجات الحالية:\n${options}\n\nاختر "موافق" لعرض قائمة بالمنتجات للإزالة`)) {
            this.showToast('انقر على أيقونة ❌ بجوار المنتج لإزالته', 'info');
        }
    }
    
    async removeItem(productId) {
        if (this.isLoading) return;
        
        if (!confirm('هل أنت متأكد من إزالة هذا المنتج من المقارنة؟')) {
            return;
        }
        
        this.isLoading = true;
        this.showToast('جاري إزالة المنتج...', 'info');
        
        try {
            const formData = new FormData();
            formData.append('product_id', productId);
            
            const response = await fetch(this.endpoints.removeItem, {
                method: 'POST',
                body: formData,
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast(result.msg || 'تمت إزالة المنتج من المقارنة', 'success');
                
                // تحديث البيانات المحلية
                if (this.compareData) {
                    this.compareData = this.compareData.filter(item => item.id != productId);
                    this.saveToCache('compareData', this.compareData);
                    this.updateUI();
                }
                
                this.updateGlobalCompareCount(result.count || 0);
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
        
        if (!confirm('هل أنت متأكد من حذف جميع المنتجات من المقارنة؟')) {
            return;
        }
        
        this.isLoading = true;
        this.showToast('جاري مسح جميع المنتجات...', 'info');
        
        try {
            const response = await fetch(this.endpoints.clearAll, {
                method: 'POST',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast(result.msg || 'تمت إزالة جميع المنتجات من المقارنة', 'success');
                
                // تحديث البيانات المحلية
                this.compareData = [];
                this.clearCache();
                this.updateUI();
                this.updateGlobalCompareCount(0);
            } else {
                throw new Error(result.msg || 'فشل في إزالة المنتجات');
            }
        } catch (error) {
            console.error('Error clearing compare:', error);
            this.showToast('حدث خطأ أثناء إزالة المنتجات', 'error');
        } finally {
            this.isLoading = false;
        }
    }
    
    async addToCart(productId) {
        try {
            const formData = new FormData();
            formData.append('product_id', productId);
            formData.append('quantity', 1);
            
            this.showToast('جاري إضافة المنتج إلى السلة...', 'info');
            
            const response = await fetch('cart_api.php?action=add_item', {
                method: 'POST',
                body: formData,
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast('تمت إضافة المنتج إلى السلة بنجاح', 'success');
            } else {
                throw new Error(result.msg || 'فشل في إضافة المنتج إلى السلة');
            }
        } catch (error) {
            console.error('Error adding to cart:', error);
            this.showToast('حدث خطأ أثناء إضافة المنتج إلى السلة', 'error');
        }
    }
    
    viewProduct(productId) {
        this.saveScrollPosition();
        window.location.href = `product.php?id=${productId}`;
    }
    
    goToHome() {
        this.saveScrollPosition();
        window.location.href = 'Home.php';
    }
    
    goToCart() {
        this.saveScrollPosition();
        window.location.href = 'cart.php';
    }
    
    goToWishlist() {
        this.saveScrollPosition();
        window.location.href = 'wishlist.php';
    }
    
    bindEvents() {
        const clearAllBtn = document.querySelector(this.selectors.clearAllBtn);
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                this.clearAll();
            });
        }
        
        // إغلاق رسائل التنبيه عند النقر عليها
        document.addEventListener('click', (e) => {
            const toast = e.target.closest('.toast');
            if (toast) {
                this.removeToast(toast);
            }
        });
        
        // حفظ حالة التمرير قبل تحديث الصفحة
        window.addEventListener('beforeunload', () => {
            this.saveScrollPosition();
        });
        
        // تحديث عدد المنتجات القصوى عند تغيير حجم النافذة
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // استعادة حالة التمرير عند العودة
        window.addEventListener('pageshow', (event) => {
            if (event.persisted) {
                this.restoreScrollPosition();
            }
        });
        
        // منع الإفلات الافتراضي للعناصر
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        
        document.addEventListener('drop', (e) => {
            e.preventDefault();
        });
    }
    
    handleResize() {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            const newMaxProducts = window.innerWidth <= 768 ? 2 : 4;
            if (newMaxProducts !== this.maxProducts) {
                this.maxProducts = newMaxProducts;
                this.updateMaxProductsDisplay();
                this.updateAddMoreSection();
                this.renderCompareTable(); // إعادة الرسم مع/بدون ميزة التبديل
            }
        }, 250);
    }
    
    initPerformanceOptimizations() {
        // Debounce عمليات التمرير
        window.addEventListener('scroll', () => {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => {
                // أي عمليات تحتاج للتنفيذ عند التمرير
            }, 100);
        });
    }
    
    initLazyLoading() {
        if ('IntersectionObserver' in window) {
            if (!this.imageObserver) {
                this.imageObserver = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const img = entry.target;
                            const src = img.getAttribute('data-src');
                            if (src) {
                                img.src = src;
                                img.removeAttribute('data-src');
                            }
                            this.imageObserver.unobserve(img);
                        }
                    });
                }, {
                    rootMargin: '50px 0px',
                    threshold: 0.01
                });
            }
            
            const images = document.querySelectorAll('img[data-src]');
            images.forEach(img => this.imageObserver.observe(img));
        } else {
            // Fallback for browsers without IntersectionObserver
            const images = document.querySelectorAll('img[data-src]');
            images.forEach(img => {
                const src = img.getAttribute('data-src');
                if (src) {
                    img.src = src;
                    img.removeAttribute('data-src');
                }
            });
        }
    }
    
    // Cache Management
    saveToCache(key, data) {
        try {
            this.cache.set(key, data);
            const cacheData = {
                data: data,
                timestamp: Date.now()
            };
            localStorage.setItem(`compare_${key}`, JSON.stringify(cacheData));
        } catch (e) {
            console.warn('Failed to save to cache:', e);
        }
    }
    
    getFromCache(key) {
        try {
            if (this.cache.has(key)) {
                return this.cache.get(key);
            }
            
            const cached = localStorage.getItem(`compare_${key}`);
            if (cached) {
                const cacheData = JSON.parse(cached);
                if (Date.now() - cacheData.timestamp < 5 * 60 * 1000) {
                    this.cache.set(key, cacheData.data);
                    return cacheData.data;
                } else {
                    localStorage.removeItem(`compare_${key}`);
                }
            }
        } catch (e) {
            console.warn('Failed to get from cache:', e);
        }
        return null;
    }
    
    clearCache() {
        this.cache.clear();
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('compare_')) {
                localStorage.removeItem(key);
            }
        });
    }
    
    saveScrollPosition() {
        sessionStorage.setItem('compareScrollPosition', window.scrollY);
    }
    
    restoreScrollPosition() {
        const scrollPosition = sessionStorage.getItem('compareScrollPosition');
        if (scrollPosition) {
            setTimeout(() => {
                window.scrollTo(0, parseInt(scrollPosition));
                sessionStorage.removeItem('compareScrollPosition');
            }, 100);
        }
    }
    
    showLoading() {
        this.hideAllSections();
        const loadingSection = document.querySelector(this.selectors.loadingSection);
        if (loadingSection) {
            loadingSection.style.display = 'flex';
        }
    }
    
    showError(message) {
        this.hideAllSections();
        const errorSection = document.querySelector(this.selectors.errorSection);
        const errorMessage = document.querySelector(this.selectors.errorMessage);
        
        if (errorSection) {
            errorSection.style.display = 'flex';
        }
        if (errorMessage) {
            errorMessage.textContent = message;
        }
    }
    
    showEmptyState() {
        this.hideAllSections();
        const emptySection = document.querySelector('#empty-section');
        if (emptySection) {
            emptySection.style.display = 'flex';
        }
    }
    
    showCompareContent() {
        this.hideAllSections();
        const compareContent = document.querySelector(this.selectors.compareContent);
        if (compareContent) {
            compareContent.style.display = 'block';
        }
    }
    
    hideAllSections() {
        const sections = [
            this.selectors.loadingSection,
            this.selectors.errorSection,
            '#empty-section',
            this.selectors.compareContent
        ];
        
        sections.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.style.display = 'none';
            }
        });
    }
    
    showToast(message, type = 'info') {
        const container = document.querySelector(this.selectors.toastContainer) || this.createToastContainer();
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <span class="toast-icon">${this.getToastIcon(type)}</span>
            <span class="toast-message">${message}</span>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideInRight 0.3s ease';
        }, 10);
        
        const timeout = setTimeout(() => {
            this.removeToast(toast);
        }, 3000);
        
        toast.addEventListener('click', () => {
            clearTimeout(timeout);
            this.removeToast(toast);
        });
    }
    
    removeToast(toast) {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 300);
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
    
    updateGlobalCompareCount(count) {
        const headerCounter = document.getElementById('header-compare-count');
        if (headerCounter) {
            headerCounter.textContent = count;
        }
    }
    
    retryLoading() {
        this.loadCompareData();
    }
    
    escapeHtml(text) {
        if (typeof text !== 'string') {
            text = String(text);
        }
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
    
    addTableAnimations() {
        const rows = document.querySelectorAll('.compare-table-row');
        rows.forEach((row, index) => {
            row.style.animation = `fadeInRow 0.3s ease ${index * 0.05}s both`;
        });
    }
}

// Initialize compare system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.CompareSystem = new CompareSystem();
    window.CompareUI = {
        removeItem: (productId) => window.CompareSystem.removeItem(productId),
        addToCart: (productId) => window.CompareSystem.addToCart(productId),
        viewProduct: (productId) => window.CompareSystem.viewProduct(productId),
        goToHome: () => window.CompareSystem.goToHome(),
        goToCart: () => window.CompareSystem.goToCart(),
        goToWishlist: () => window.CompareSystem.goToWishlist(),
        retryLoading: () => window.CompareSystem.retryLoading(),
        moveProductUp: (productId) => window.CompareSystem.moveProductUp(productId),
        moveProductDown: (productId) => window.CompareSystem.moveProductDown(productId),
        handleAddMoreClick: () => window.CompareSystem.handleAddMoreClick(),
        showRemoveOptions: () => window.CompareSystem.showRemoveOptions()
    };
});

// إضافة أنماط الحركة ديناميكياً
if (!document.querySelector('#compare-animation-styles')) {
    const style = document.createElement('style');
    style.id = 'compare-animation-styles';
    style.textContent = `
        @keyframes fadeInRow {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}
