
class CheckoutSystem {
    constructor() {
        this.cartData = null;
        this.userData = null;
        this.isLoading = false;
        
        this.selectors = {
            loadingSection: '#loading-section',
            errorSection: '#error-section',
            errorMessage: '#error-message',
            checkoutContent: '#checkout-content',
            orderItems: '#order-items',
            subtotal: '#subtotal',
            shipping: '#shipping',
            grandTotal: '#grand-total',
            confirmOrderBtn: '#confirm-order-btn',
            walletProviders: '#wallet-providers',
            walletModal: '#wallet-modal',
            modalAmount: '#modal-amount',
            modalProvider: '#modal-provider',
            modalPhone: '#modal-phone',
            modalPhoneError: '#modal-phone-error',
            modalConfirmBtn: '#modal-confirm-btn',
            userInfo: '#user-info'
        };
        
        this.endpoints = {
            checkoutData: '../Api/checkout_api.php?action=get_data',
            processOrder: '../Api/checkout_api.php?action=process_order',
            removeFromCart: '../Api/checkout_api.php?action=remove_from_cart'
        };
        
        this.init();
    }
    
    async init() {
        console.log('🚀 تهيئة نظام الدفع...');
        await this.loadCheckoutData();
        this.bindEvents();
        this.setupPaymentMethodToggle();
        
        const cardRadio = document.getElementById('payment-card');
        if (cardRadio) {
            cardRadio.addEventListener('change', () => {
                console.log('💳 تم اختيار بطاقة الائتمان');
                if (cardRadio.checked) {
                    setTimeout(() => {
                        this.showCreditCardModal();
                    }, 300);
                }
            });
            
            if (cardRadio.checked) {
                setTimeout(() => {
                    this.showCreditCardModal();
                }, 1000);
            }
        }
    }
    
    async loadCheckoutData() {
        try {
            this.showLoading();
            
            const response = await fetch(this.endpoints.checkoutData);
            const data = await response.json();
            
            if (data.success) {
                this.cartData = data.cart;
                this.userData = data.user;
                console.log('✅ تم تحميل بيانات الطلب:', data);
                this.updateUI();
                this.updateUserInfo();
            } else {
                throw new Error(data.msg || 'فشل في تحميل بيانات الطلب');
            }
        } catch (error) {
            console.error('❌ خطأ في تحميل بيانات الطلب:', error);
            this.showError('حدث خطأ في تحميل بيانات الطلب. يرجى المحاولة مرة أخرى.');
        }
    }
    
    updateUI() {
        this.hideAllSections();
        
        if (!this.cartData || this.cartData.items.length === 0) {
            this.showEmptyCart();
            return;
        }
        
        this.showCheckoutContent();
        this.renderOrderItems();
        this.updateOrderTotals();
        this.prefillUserData();
        this.enableConfirmButton();
    }
    
    showEmptyCart() {
        this.hideAllSections();
        
        const container = document.querySelector(this.selectors.checkoutContent);
        if (container) {
            container.innerHTML = `
                <div class="empty-cart">
                    <div class="empty-cart-icon">🛒</div>
                    <h2>سلة المشتريات فارغة</h2>
                    <p>لا توجد منتجات في سلة المشتريات الخاصة بك.</p>
                    <button class="continue-shopping-btn-small" onclick="window.location.href='Home.php'">
                        🛍️ العودة للتسوق
                    </button>
                </div>
            `;
            container.style.display = 'block';
        }
    }
    
    renderOrderItems() {
        const container = document.querySelector(this.selectors.orderItems);
        const items = this.cartData.items;
        
        if (items.length === 0) {
            container.innerHTML = '<div class="empty-state">لا توجد منتجات في السلة</div>';
            return;
        }
        
        container.innerHTML = items.map(item => this.createOrderItemHTML(item)).join('');
    }
    
    createOrderItemHTML(item) {
        const imageUrl = item.image ? `admin/assets/images/${item.image}` : 'admin/assets/images/default.jpg';
        
        return `
            <div class="order-item" data-id="${item.id}">
                <button class="remove-item-btn" data-id="${item.id}" title="حذف المنتج">
                    ×
                </button>
                <img src="${imageUrl}" 
                     alt="${item.name}" 
                     class="order-item-image"
                     onerror="this.src='admin/assets/images/default.jpg'">
                <div class="order-item-details">
                    <div class="order-item-name">${item.name}</div>
                    <div class="order-item-price">${parseFloat(item.price).toFixed(2)} ج.م</div>
                    <div class="order-item-quantity">الكمية: ${item.quantity}</div>
                </div>
                <div class="order-item-subtotal">
                    <strong>${parseFloat(item.subtotal).toFixed(2)} ج.م</strong>
                </div>
            </div>
        `;
    }
    
    updateOrderTotals() {
        const subtotal = this.cartData.totalPrice;
        const shipping = this.cartData.shipping || 0;
        const total = subtotal + shipping;
        
        document.querySelector(this.selectors.subtotal).textContent = 
            `${subtotal.toFixed(2)} ج.م`;
        document.querySelector(this.selectors.shipping).textContent = 
            `${shipping.toFixed(2)} ج.م`;
        document.querySelector(this.selectors.grandTotal).textContent = 
            `${total.toFixed(2)} ج.م`;
    }
    
    prefillUserData() {
        if (!this.userData) return;
        
        const nameInput = document.getElementById('customer-name');
        const phoneInput = document.getElementById('phone');
        const addressInput = document.getElementById('address');
        
        if (nameInput && this.userData.name) nameInput.value = this.userData.name;
        if (phoneInput && this.userData.phone) phoneInput.value = this.userData.phone;
        
        try {
            const savedAddress = localStorage.getItem('user_address');
            if (addressInput && savedAddress) {
                addressInput.value = savedAddress;
            }
        } catch (e) {
            console.warn('لا يمكن الوصول إلى localStorage');
        }
    }
    
    updateUserInfo() {
        const userInfo = document.querySelector(this.selectors.userInfo);
        if (this.userData && userInfo) {
            userInfo.innerHTML = `
                <span class="user-name">${this.userData.name || 'زائر'}</span>
                ${this.userData.email ? `<span class="user-email">${this.userData.email}</span>` : ''}
            `;
        }
    }
    
    setupPaymentMethodToggle() {
        const paymentMethods = document.querySelectorAll('input[name="payment_method"]');
        const walletProviders = document.querySelector(this.selectors.walletProviders);
        
        paymentMethods.forEach(method => {
            method.addEventListener('change', () => {
                const selectedMethod = document.querySelector('input[name="payment_method"]:checked').value;
                
                if (selectedMethod === 'wallet') {
                    walletProviders.style.display = 'block';
                } else {
                    walletProviders.style.display = 'none';
                }
            });
        });
    }
    
    bindEvents() {
        console.log('🔗 ربط الأحداث...');
        
        const confirmBtn = document.querySelector(this.selectors.confirmOrderBtn);
        if (confirmBtn) {
            confirmBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('🔄 معالجة الطلب...');
                this.processOrder();
            });
        }
        
        const cardConfirmBtn = document.querySelector('#credit-card-form .confirm-btn');
        if (cardConfirmBtn) {
            cardConfirmBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('💳 تأكيد دفع البطاقة...');
                this.processCreditCardPayment();
            });
        }
        
        const walletConfirmBtn = document.querySelector(this.selectors.modalConfirmBtn);
        if (walletConfirmBtn) {
            walletConfirmBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('📱 تأكيد دفع المحفظة...');
                this.confirmWalletPayment();
            });
        }
        
        const showCvvBtn = document.querySelector('.show-cvv-btn');
        if (showCvvBtn) {
            showCvvBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleCVVVisibility();
            });
        }
        
        // إغلاق النوافذ عند النقر خارجها
        document.addEventListener('click', (e) => {
            const creditCardModal = document.getElementById('credit-card-modal');
            if (creditCardModal && e.target === creditCardModal) {
                this.hideCreditCardModal();
            }
            
            const walletModal = document.getElementById('wallet-modal');
            if (walletModal && e.target === walletModal) {
                this.hideWalletModal();
            }
            
            const orderSuccessModal = document.getElementById('order-success-modal');
            if (orderSuccessModal && e.target === orderSuccessModal) {
                orderSuccessModal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideCreditCardModal();
                this.hideWalletModal();
                const orderSuccessModal = document.getElementById('order-success-modal');
                if (orderSuccessModal) {
                    orderSuccessModal.style.display = 'none';
                    document.body.style.overflow = 'auto';
                }
            }
        });
        
        // إرسال نموذج بطاقة الائتمان
        const cardForm = document.getElementById('credit-card-form');
        if (cardForm) {
            cardForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.processCreditCardPayment();
            });
        }
        
        // حذف المنتج من السلة (Event Delegation)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-item-btn')) {
                e.preventDefault();
                e.stopPropagation();
                const productId = e.target.getAttribute('data-id');
                this.confirmRemoveItem(productId);
            }
        });
    }
    
    async processOrder() {
        if (this.isLoading) {
            this.showToast('جاري معالجة طلب سابق...', 'warning');
            return;
        }
        
        // التحقق من النموذج
        if (!this.validateForm()) {
            this.showToast('الرجاء ملء جميع الحقول المطلوبة بشكل صحيح', 'error');
            return;
        }
        
        const paymentMethod = document.querySelector('input[name="payment_method"]:checked').value;
        console.log(`💳 طريقة الدفع المختارة: ${paymentMethod}`);
        
        // التعامل مع طرق الدفع المختلفة
        switch (paymentMethod) {
            case 'wallet':
                this.showWalletModal();
                break;
            case 'card':
                this.showCreditCardModal();
                break;
            default:
                await this.submitOrder(paymentMethod);
        }
    }
    
    validateForm() {
        let isValid = true;
        
        // التحقق من الاسم
        const nameInput = document.getElementById('customer-name');
        const nameError = document.getElementById('name-error');
        if (!nameInput.value.trim()) {
            nameError.textContent = 'الرجاء إدخال الاسم الكامل';
            nameError.classList.add('show');
            isValid = false;
        } else {
            nameError.classList.remove('show');
        }
        
        // التحقق من الهاتف
        const phoneInput = document.getElementById('phone');
        const phoneError = document.getElementById('phone-error');
        const phoneRegex = /^[0-9]{10,15}$/;
        if (!phoneInput.value.trim() || !phoneRegex.test(phoneInput.value)) {
            phoneError.textContent = 'الرجاء إدخال رقم هاتف صحيح (10-15 رقم)';
            phoneError.classList.add('show');
            isValid = false;
        } else {
            phoneError.classList.remove('show');
        }
        
        // التحقق من العنوان
        const addressInput = document.getElementById('address');
        const addressError = document.getElementById('address-error');
        if (!addressInput.value.trim()) {
            addressError.textContent = 'الرجاء إدخال العنوان';
            addressError.classList.add('show');
            isValid = false;
        } else {
            addressError.classList.remove('show');
        }
        
        return isValid;
    }
    
    async submitOrder(paymentMethod, walletData = null, cardData = null) {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.disableConfirmButton();
        
        try {
            const formData = new FormData(document.getElementById('checkout-form'));
            formData.append('payment_method', paymentMethod);
            
            if (walletData) {
                formData.append('wallet_provider', walletData.provider);
                formData.append('wallet_phone', walletData.phone);
            }
            
            if (cardData) {
                formData.append('card_last_four', cardData.card_number ? cardData.card_number.slice(-4) : '');
            }
            
            // حفظ العنوان في localStorage
            const address = formData.get('address');
            if (address) {
                try {
                    localStorage.setItem('user_address', address);
                } catch (e) {
                    console.warn('لا يمكن حفظ العنوان في localStorage');
                }
            }
            
            console.log('📤 إرسال الطلب إلى الخادم...');
            
            const response = await fetch(this.endpoints.processOrder, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            console.log('📥 استجابة الخادم:', result);
            
            if (result.success) {
                this.showToast(result.msg || 'تم إنشاء الطلب بنجاح 🎉', 'success');
                
                // عرض نافذة النجاح
                this.showSuccessModal(result);
                
                // إعادة التوجيه بعد 5 ثواني
                setTimeout(() => {
                    if (result.redirect) {
                        window.location.href = result.redirect;
                    } else if (result.order_id) {
                        window.location.href = `order_success.php?id=${result.order_id}`;
                    }
                }, 5000);
            } else {
                this.showToast(result.msg || 'حدث خطأ أثناء إنشاء الطلب', 'error');
                this.enableConfirmButton();
            }
        } catch (error) {
            console.error('❌ خطأ في معالجة الطلب:', error);
            this.showToast('حدث خطأ في الاتصال بالخادم', 'error');
            this.enableConfirmButton();
        } finally {
            this.isLoading = false;
        }
    }
    
    showWalletModal() {
        const total = this.cartData ? this.cartData.grandTotal : 0;
        const provider = document.querySelector('input[name="wallet_provider"]:checked')?.value || 'vodafone_cash';
        const providerName = this.getProviderName(provider);
        
        const modal = document.getElementById('wallet-modal');
        if (!modal) {
            console.error('❌ نافذة المحفظة غير موجودة');
            return;
        }
        
        document.querySelector(this.selectors.modalAmount).textContent = 
            `${parseFloat(total).toFixed(2)} ج.م`;
        document.querySelector(this.selectors.modalProvider).textContent = providerName;
        
        // تعبئة الهاتف من بيانات المستخدم
        const modalPhone = document.querySelector(this.selectors.modalPhone);
        if (this.userData && this.userData.phone && modalPhone) {
            modalPhone.value = this.userData.phone;
        }
        
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
    
    hideWalletModal() {
        const modal = document.getElementById('wallet-modal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
        
        const phoneError = document.querySelector(this.selectors.modalPhoneError);
        if (phoneError) {
            phoneError.classList.remove('show');
        }
    }
    
    async confirmWalletPayment() {
        const phoneInput = document.querySelector(this.selectors.modalPhone);
        const phoneError = document.querySelector(this.selectors.modalPhoneError);
        const phoneRegex = /^[0-9]{10,15}$/;
        
        if (!phoneInput || !phoneInput.value.trim() || !phoneRegex.test(phoneInput.value)) {
            if (phoneError) {
                phoneError.textContent = 'الرجاء إدخال رقم هاتف صحيح (10-15 رقم)';
                phoneError.classList.add('show');
            }
            return;
        }
        
        if (phoneError) {
            phoneError.classList.remove('show');
        }
        
        const provider = document.querySelector('input[name="wallet_provider"]:checked')?.value || 'vodafone_cash';
        
        this.hideWalletModal();
        await this.submitOrder('wallet', {
            provider: provider,
            phone: phoneInput.value
        });
    }
    
    showCreditCardModal() {
        const modal = document.getElementById('credit-card-modal');
        if (!modal) {
            console.error('❌ نافذة بطاقة الائتمان غير موجودة');
            return;
        }
        
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // التركيز على أول حقل
        setTimeout(() => {
            const cardNumberInput = document.getElementById('card-number');
            if (cardNumberInput) {
                cardNumberInput.focus();
            }
        }, 100);
    }
    
    hideCreditCardModal() {
        const modal = document.getElementById('credit-card-modal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
        this.clearCreditCardErrors();
    }
    
    clearCreditCardErrors() {
        const errors = document.querySelectorAll('#credit-card-form .error-message');
        errors.forEach(error => error.classList.remove('show'));
    }
    
    async processCreditCardPayment() {
        if (!this.validateCreditCardForm()) {
            this.showToast('الرجاء تصحيح الأخطاء في نموذج البطاقة', 'error');
            return;
        }

        this.hideCreditCardModal();
        this.showToast('جاري معالجة الدفع بالبطاقة...', 'info');

        // محاكاة معالجة الدفع
        setTimeout(async () => {
            try {
                await this.submitOrder('card', null, this.getCreditCardData());
            } catch (error) {
                this.showToast('حدث خطأ أثناء معالجة الدفع', 'error');
            }
        }, 1500);
    }
    
    validateCreditCardForm() {
        let isValid = true;
        
        // التحقق من رقم البطاقة
        const cardNumber = document.getElementById('card-number')?.value.replace(/\s/g, '') || '';
        const cardNumberError = document.getElementById('card-number-error');
        
        if (!this.validateCardNumber(cardNumber)) {
            if (cardNumberError) {
                cardNumberError.textContent = 'رقم البطاقة غير صالح';
                cardNumberError.classList.add('show');
            }
            isValid = false;
        } else if (cardNumberError) {
            cardNumberError.classList.remove('show');
        }

        // التحقق من تاريخ الانتهاء
        const expiryDate = document.getElementById('card-expiry')?.value || '';
        const expiryError = document.getElementById('card-expiry-error');
        
        if (!this.validateExpiryDate(expiryDate)) {
            if (expiryError) {
                expiryError.textContent = 'تاريخ الانتهاء غير صالح';
                expiryError.classList.add('show');
            }
            isValid = false;
        } else if (expiryError) {
            expiryError.classList.remove('show');
        }

        // التحقق من CVV
        const cvv = document.getElementById('card-cvv')?.value || '';
        const cvvError = document.getElementById('card-cvv-error');
        
        if (!cvv || cvv.length < 3 || cvv.length > 4 || !/^\d+$/.test(cvv)) {
            if (cvvError) {
                cvvError.textContent = 'CVV غير صالح (3-4 أرقام)';
                cvvError.classList.add('show');
            }
            isValid = false;
        } else if (cvvError) {
            cvvError.classList.remove('show');
        }

        // التحقق من اسم حامل البطاقة
        const cardholderName = document.getElementById('cardholder-name')?.value.trim() || '';
        const nameError = document.getElementById('cardholder-name-error');
        
        if (!cardholderName || cardholderName.length < 3) {
            if (nameError) {
                nameError.textContent = 'الرجاء إدخال اسم حامل البطاقة (3 أحرف على الأقل)';
                nameError.classList.add('show');
            }
            isValid = false;
        } else if (nameError) {
            nameError.classList.remove('show');
        }

        return isValid;
    }
    
    validateCardNumber(cardNumber) {
        if (!/^\d+$/.test(cardNumber)) {
            return false;
        }

        if (cardNumber.length < 13 || cardNumber.length > 19) {
            return false;
        }

        return this.luhnCheck(cardNumber);
    }
    
    luhnCheck(cardNumber) {
        let sum = 0;
        let isEven = false;
        
        for (let i = cardNumber.length - 1; i >= 0; i--) {
            let digit = parseInt(cardNumber.charAt(i), 10);
            
            if (isEven) {
                digit *= 2;
                if (digit > 9) {
                    digit -= 9;
                }
            }
            
            sum += digit;
            isEven = !isEven;
        }
        
        return (sum % 10) === 0;
    }
    
    validateExpiryDate(expiryDate) {
        if (!/^\d{2}\/\d{2}$/.test(expiryDate)) {
            return false;
        }
        
        const [month, year] = expiryDate.split('/').map(Number);
        const currentYear = new Date().getFullYear() % 100;
        const currentMonth = new Date().getMonth() + 1;
        
        if (month < 1 || month > 12) {
            return false;
        }
        
        if (year < currentYear || (year === currentYear && month < currentMonth)) {
            return false;
        }
        
        return true;
    }
    
    getCreditCardData() {
        return {
            card_number: document.getElementById('card-number')?.value.replace(/\s/g, '') || '',
            card_expiry: document.getElementById('card-expiry')?.value || '',
            card_cvv: document.getElementById('card-cvv')?.value || '',
            cardholder_name: document.getElementById('cardholder-name')?.value.trim() || ''
        };
    }
    
    getProviderName(provider) {
        const providers = {
            'vodafone_cash': 'Vodafone Cash',
            'orange_money': 'Orange Money',
            'etisalat_cash': 'Etisalat Cash'
        };
        
        return providers[provider] || provider;
    }
    
    formatCardNumber(input) {
        let value = input.value.replace(/\D/g, '');
        let formattedValue = '';
        
        for (let i = 0; i < value.length; i++) {
            if (i > 0 && i % 4 === 0) {
                formattedValue += ' ';
            }
            formattedValue += value[i];
        }
        
        input.value = formattedValue.substring(0, 19);
        this.detectCardType(value);
    }
    
    formatExpiryDate(input) {
        let value = input.value.replace(/\D/g, '');
        
        if (value.length >= 2) {
            value = value.substring(0, 2) + '/' + value.substring(2, 4);
        }
        
        input.value = value.substring(0, 5);
    }
    
    detectCardType(cardNumber) {
        const cardTypeIcon = document.getElementById('card-type-icon');
        if (!cardTypeIcon) return;
        
        // إعادة تعيين الأنماط
        cardTypeIcon.className = 'card-icon';
        
        // فيزا
        if (/^4/.test(cardNumber)) {
            cardTypeIcon.classList.add('card-type-visa');
            cardTypeIcon.title = 'Visa';
        }
        // ماستركارد
        else if (/^5[1-5]/.test(cardNumber)) {
            cardTypeIcon.classList.add('card-type-mastercard');
            cardTypeIcon.title = 'MasterCard';
        }
        // أمريكان إكسبريس
        else if (/^3[47]/.test(cardNumber)) {
            cardTypeIcon.classList.add('card-type-amex');
            cardTypeIcon.title = 'American Express';
        }
        // نوع آخر
        else if (cardNumber.length > 0) {
            cardTypeIcon.title = 'بطاقة ائتمان';
        }
    }
    
    toggleCVVVisibility() {
        const cvvInput = document.getElementById('card-cvv');
        const showBtn = document.querySelector('.show-cvv-btn');
        
        if (!cvvInput || !showBtn) return;
        
        if (cvvInput.type === 'password') {
            cvvInput.type = 'text';
            showBtn.textContent = '🙈';
            showBtn.title = 'إخفاء';
        } else {
            cvvInput.type = 'password';
            showBtn.textContent = '👁️';
            showBtn.title = 'إظهار';
        }
    }
    
    showSuccessModal(result) {
        const modal = document.getElementById('order-success-modal');
        const orderDetails = document.getElementById('success-order-details');
        
        if (!modal || !orderDetails) return;
        
        // تعبئة تفاصيل الطلب
        orderDetails.innerHTML = `
            <div class="order-detail-row">
                <span>رقم الطلب:</span>
                <strong>#${result.order_id || '000'}</strong>
            </div>
            <div class="order-detail-row">
                <span>المبلغ الإجمالي:</span>
                <strong>${result.order_summary?.total ? parseFloat(result.order_summary.total).toFixed(2) : '0.00'} ج.م</strong>
            </div>
            <div class="order-detail-row">
                <span>طريقة الدفع:</span>
                <strong>${result.order_summary?.payment_method === 'card' ? 'بطاقة ائتمان' : 'الدفع عند الاستلام'}</strong>
            </div>
            <div class="order-detail-row">
                <span>عدد المنتجات:</span>
                <strong>${result.order_summary?.items_count || 0}</strong>
            </div>
        `;
        
        // إعداد زر عرض الطلب
        const viewOrderBtn = document.getElementById('view-order-btn');
        if (viewOrderBtn && result.order_id) {
            viewOrderBtn.onclick = () => {
                window.location.href = `order_success.php?id=${result.order_id}`;
            };
        }
        
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
    
    showLoading() {
        this.hideAllSections();
        const loadingSection = document.querySelector(this.selectors.loadingSection);
        if (loadingSection) loadingSection.style.display = 'block';
    }
    
    showError(message) {
        this.hideAllSections();
        const errorSection = document.querySelector(this.selectors.errorSection);
        const errorMessage = document.querySelector(this.selectors.errorMessage);
        
        if (errorSection) errorSection.style.display = 'block';
        if (errorMessage) errorMessage.textContent = message;
    }
    
    showCheckoutContent() {
        this.hideAllSections();
        const checkoutContent = document.querySelector(this.selectors.checkoutContent);
        if (checkoutContent) checkoutContent.style.display = 'block';
    }
    
    hideAllSections() {
        const sections = [
            this.selectors.loadingSection,
            this.selectors.errorSection,
            this.selectors.checkoutContent
        ];
        
        sections.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) element.style.display = 'none';
        });
    }
    
    enableConfirmButton() {
        const btn = document.querySelector(this.selectors.confirmOrderBtn);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '💳 تأكيد الطلب';
        }
    }
    
    disableConfirmButton() {
        const btn = document.querySelector(this.selectors.confirmOrderBtn);
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '⏳ جاري المعالجة...';
        }
    }
    
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container') || this.createToastContainer();
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${this.getToastIcon(type)}</span>
            <span class="toast-message">${message}</span>
        `;
        
        container.appendChild(toast);
        
        // إزالة الـ toast بعد 5 ثواني
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode === container) {
                    container.removeChild(toast);
                }
            }, 300);
        }, 5000);
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
    
    retryLoading() {
        this.loadCheckoutData();
    }
    
    /* ========== حذف المنتج من السلة ========== */
    
    confirmRemoveItem(productId) {
        // إنشاء نافذة تأكيد
        const confirmationDialog = document.createElement('div');
        confirmationDialog.className = 'confirmation-dialog';
        confirmationDialog.innerHTML = `
            <div class="confirmation-content">
                <div class="confirmation-icon">⚠️</div>
                <p class="confirmation-message">هل أنت متأكد من حذف هذا المنتج من السلة؟</p>
                <div class="confirmation-actions">
                    <button class="confirmation-btn confirm-no" onclick="CheckoutUI.hideConfirmation()">
                        إلغاء
                    </button>
                    <button class="confirmation-btn confirm-yes" onclick="CheckoutUI.removeItem(${productId})">
                        نعم، حذف
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(confirmationDialog);
    }
    
    async removeItem(productId) {
        // إخفاء نافذة التأكيد
        const confirmationDialog = document.querySelector('.confirmation-dialog');
        if (confirmationDialog) {
            confirmationDialog.remove();
        }
        
        try {
            this.showToast('جاري حذف المنتج...', 'info');
            
            const response = await fetch(this.endpoints.removeFromCart, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `product_id=${productId}`
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast('تم حذف المنتج من السلة', 'success');
                // إعادة تحميل بيانات السلة
                await this.loadCheckoutData();
            } else {
                this.showToast(result.msg || 'فشل في حذف المنتج', 'error');
            }
        } catch (error) {
            console.error('❌ خطأ في حذف المنتج:', error);
            this.showToast('حدث خطأ أثناء حذف المنتج', 'error');
        }
    }
    
    hideConfirmation() {
        const confirmationDialog = document.querySelector('.confirmation-dialog');
        if (confirmationDialog) {
            confirmationDialog.remove();
        }
    }
}

// تعريف الدوال العامة
window.CheckoutUI = {
    formatCardNumber: function(input) {
        window.CheckoutSystem?.formatCardNumber(input);
    },
    formatExpiryDate: function(input) {
        window.CheckoutSystem?.formatExpiryDate(input);
    },
    toggleCVVVisibility: function() {
        window.CheckoutSystem?.toggleCVVVisibility();
    },
    retryLoading: function() {
        window.CheckoutSystem?.retryLoading();
    },
    confirmOrder: function() {
        window.CheckoutSystem?.processOrder();
    },
    hideCreditCardModal: function() {
        window.CheckoutSystem?.hideCreditCardModal();
    },
    hideWalletModal: function() {
        window.CheckoutSystem?.hideWalletModal();
    },
    removeItem: function(productId) {
        window.CheckoutSystem?.removeItem(productId);
    },
    hideConfirmation: function() {
        window.CheckoutSystem?.hideConfirmation();
    }
};

// تهيئة النظام عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 تحميل صفحة الدفع...');
    
    setTimeout(() => {
        window.CheckoutSystem = new CheckoutSystem();
        console.log('✅ نظام الدفع جاهز للعمل');
    }, 100);
});

window.addEventListener('load', function() {
    console.log('🔍 فحص عناصر الصفحة...');
    
    const importantElements = [
        { id: 'confirm-order-btn', name: 'زر تأكيد الطلب' },
        { id: 'credit-card-modal', name: 'نافذة بطاقة الائتمان' },
        { id: 'card-number', name: 'حقل رقم البطاقة' },
        { id: 'payment-card', name: 'خيار بطاقة الائتمان' },
        { id: 'show-cvv-btn', name: 'زر إظهار/إخفاء CVV' }
    ];
    
    importantElements.forEach(element => {
        const el = document.getElementById(element.id);
        console.log(`${element.name}: ${el ? '✅ موجود' : '❌ غير موجود'}`);
    });
});
