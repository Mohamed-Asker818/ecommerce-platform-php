class ProfileSystem {
    constructor() {
        this.userData = null;
        this.isLoading = false;
        this.eventsBound = false; 
        this.cropper = null;

        this.selectors = {
            loadingSection: '#loading-section',
            errorSection: '#error-section',
            errorMessage: '#error-message',
            profileContent: '#profile-content',
            userAvatar: '#user-avatar',
            avatarFallback: '#avatar-fallback',
            userName: '#user-name',
            userEmail: '#user-email',
            memberSince: '#member-since',
            totalOrders: '#total-orders',
            totalSpent: '#total-spent',
            memberStatus: '#member-status',

            editProfileForm: '#edit-profile-form',
            editName: '#edit-name',
            editEmail: '#edit-email',
            editPhone: '#edit-phone',
            saveProfileBtn: '#save-profile-btn',

            changePasswordForm: '#change-password-form',
            currentPassword: '#current-password',
            newPassword: '#new-password',
            confirmPassword: '#confirm-password',
            changePasswordBtn: '#change-password-btn',

            avatarInput: '#avatar-input',
            cropperModal: '#cropper-modal',
            cropperImage: '#cropper-image',
            cropSaveBtn: '#crop-save-btn',

            deleteModal: '#delete-modal',
            deletePassword: '#delete-password',
            deletePasswordError: '#delete-password-error',
            confirmDeleteBtn: '#confirm-delete-btn',

            toastContainer: '#toast-container'
        };

        this.endpoints = {
            getData: '../Api/profile_api.php?action=get_data',
            updateInfo: '../Api/profile_api.php?action=update_info',
            changePassword: '../Api/profile_api.php?action=change_password',
            uploadAvatar: '../Api/profile_api.php?action=upload_avatar',
            deleteAccount: '../Api/profile_api.php?action=delete_account'
        };

    }

    async fetchJSON(url, options = {}) {
        const res = await fetch(url, options);
        const text = await res.text();

        const trimmed = text.trim();
        if (!res.ok) {
            try {
                const parsed = JSON.parse(trimmed);
                throw new Error(parsed.msg || `Server returned status ${res.status}`);
            } catch (e) {
                console.error('Server returned non-OK response (possibly HTML):', trimmed);
                throw new Error(`خطأ من السيرفر (status ${res.status}). راجع Console لمزيد من التفاصيل.`);
            }
        }

        try {
            return JSON.parse(trimmed);
        } catch (err) {
            if (trimmed.startsWith('<')) {
                console.error('Expected JSON but got HTML from server:', trimmed);
                throw new Error('استجابة السيرفر ليست بصيغة JSON — تحقق من مسارات الـ API أو أخطاء PHP.');
            }
            console.error('JSON parse error. Raw response:', trimmed);
            throw new Error('فشل تحليل JSON من السيرفر.');
        }
    }

    async init() {
        this.bindEvents();
        this.initAvatarHandling();
        await this.loadProfileData();
    }

    async loadProfileData() {
        try {
            this.showLoading();
            const data = await this.fetchJSON(this.endpoints.getData, { method: 'GET' });

            if (data && data.success) {
                this.userData = data.user;
                this.updateUI();
            } else {
                const msg = data && data.msg ? data.msg : 'فشل في تحميل البيانات';
                throw new Error(msg);
            }
        } catch (error) {
            console.error('Error loading profile data:', error);
            this.showError(error.message || 'حدث خطأ في تحميل البيانات. يرجى المحاولة مرة أخرى.');
        }
    }

    updateUI() {
        this.hideAllSections();

        if (!this.userData) {
            this.showError('لا توجد بيانات');
            return;
        }

        this.showProfileContent();
        this.renderUserInfo();
        this.prefillForms();
    }

    renderUserInfo() {
        const avatarElement = document.querySelector(this.selectors.userAvatar);
        const fallbackElement = document.querySelector(this.selectors.avatarFallback);

        const hasCustomAvatar = this.userData && this.userData.avatar_url &&
                                this.userData.avatar_url.trim() !== '' &&
                                !this.userData.avatar_url.includes('default-avatar.png');

        if (avatarElement && fallbackElement) {
            if (hasCustomAvatar) {
                avatarElement.src = this.userData.avatar_url;
                avatarElement.style.display = 'block';
                fallbackElement.style.display = 'none';
            } else {
                avatarElement.style.display = 'none';
                fallbackElement.style.display = 'block';
            }
        } else if (avatarElement) {
            if (hasCustomAvatar) {
                avatarElement.src = this.userData.avatar_url;
                avatarElement.style.display = 'block';
            } else {
                avatarElement.style.display = 'none';
            }
        }

        if (this.userData) {
            const setText = (sel, txt) => {
                const el = document.querySelector(sel);
                if (el) el.textContent = txt;
            };

            setText(this.selectors.userName, this.userData.name || '');
            setText(this.selectors.userEmail, this.userData.email || '');
            setText(this.selectors.memberSince, `عضو منذ: ${this.userData.created_at_formatted || ''}`);
            setText(this.selectors.totalOrders, (this.userData.stats && this.userData.stats.total_orders) || 0);
            setText(this.selectors.totalSpent, (this.userData.stats && parseFloat(this.userData.stats.total_spent || 0).toFixed(2) + ' ج.م') || '0.00 ج.م');
            setText(this.selectors.memberStatus, this.userData.created_at_readable || '');
        }
    }

    prefillForms() {
        const name = document.querySelector(this.selectors.editName);
        const email = document.querySelector(this.selectors.editEmail);
        const phone = document.querySelector(this.selectors.editPhone);

        if (name) name.value = this.userData ? (this.userData.name || '') : '';
        if (email) email.value = this.userData ? (this.userData.email || '') : '';
        if (phone) phone.value = this.userData ? (this.userData.phone || '') : '';
    }

    initAvatarHandling() {
        const avatarElement = document.querySelector(this.selectors.userAvatar);
        const fallbackElement = document.querySelector(this.selectors.avatarFallback);
        const avatarInput = document.querySelector(this.selectors.avatarInput);
        const cropSaveBtn = document.querySelector(this.selectors.cropSaveBtn);

        if (avatarElement) {
            avatarElement.onerror = () => this.handleAvatarError(avatarElement);
            avatarElement.onload = () => {
                if (fallbackElement) fallbackElement.style.display = 'none';
                avatarElement.style.display = 'block';
            };
        }

        if (avatarInput) {
            if (!avatarInput._profileInputBound) {
                avatarInput.addEventListener('change', (e) => {
                    const file = e.target.files && e.target.files[0];
                    if (file) {
                        this.showCropperModal(file);
                    }
                });
                avatarInput._profileInputBound = true;
            }
        }

        if (cropSaveBtn && !cropSaveBtn._profileClickBound) {
            cropSaveBtn.addEventListener('click', () => this.handleCropAndUpload());
            cropSaveBtn._profileClickBound = true;
        }
    }

    showCropperModal(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const cropperImage = document.querySelector(this.selectors.cropperImage);
            const modal = document.querySelector(this.selectors.cropperModal);

            if (!cropperImage || !modal) return;

            cropperImage.src = e.target.result;
            modal.style.display = 'flex';

            if (this.cropper) {
                try { this.cropper.destroy(); } catch (err) { /* ignore */ }
            }

            this.cropper = new Cropper(cropperImage, {
                aspectRatio: 1,
                viewMode: 1,
                dragMode: 'move',
                autoCropArea: 1,
                restore: false,
                guides: true,
                center: true,
                highlight: false,
                cropBoxMovable: true,
                cropBoxResizable: true,
                toggleDragModeOnDblclick: false,
            });
        };
        reader.readAsDataURL(file);
    }

    hideCropperModal() {
        const modal = document.querySelector(this.selectors.cropperModal);
        const avatarInput = document.querySelector(this.selectors.avatarInput);
        if (modal) modal.style.display = 'none';
        if (avatarInput) avatarInput.value = '';
        if (this.cropper) {
            try { this.cropper.destroy(); } catch (err) { /* ignore */ }
            this.cropper = null;
        }
    }

    async handleCropAndUpload() {
        if (!this.cropper) return;

        const canvas = this.cropper.getCroppedCanvas({ width: 400, height: 400 });
        if (!canvas) return;

        canvas.toBlob(async (blob) => {
            if (!blob) return;
            const file = new File([blob], "avatar.png", { type: "image/png" });
            await this.uploadAvatar(file);
            this.hideCropperModal();
        }, 'image/png');
    }

    handleAvatarError(imgElement) {
        const fallbackElement = document.querySelector(this.selectors.avatarFallback);
        if (imgElement) {
            imgElement.style.display = 'none';
            imgElement.onerror = null;
        }
        if (fallbackElement) fallbackElement.style.display = 'block';
        console.warn('فشل تحميل صورة البروفايل، تم عرض الصورة الافتراضية');
    }

    async updateProfileInfo() {
        if (this.isLoading) return;
        if (!this.validateProfileForm()) return;

        this.isLoading = true;
        this.disableButton(this.selectors.saveProfileBtn, 'جاري الحفظ...');

        try {
            const formData = {
                name: (document.querySelector(this.selectors.editName)?.value || '').trim(),
                email: (document.querySelector(this.selectors.editEmail)?.value || '').trim(),
                phone: (document.querySelector(this.selectors.editPhone)?.value || '').trim()
            };

            const result = await this.fetchJSON(this.endpoints.updateInfo, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (result.success) {
                this.showToast(result.msg, 'success');
                if (result.user) {
                    this.userData = { ...this.userData, ...result.user };
                    this.renderUserInfo();
                }
            } else {
                this.showToast(result.msg || 'فشل في الحفظ', 'error');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            this.showToast(error.message || 'حدث خطأ في الاتصال بالخادم', 'error');
        } finally {
            this.isLoading = false;
            this.enableButton(this.selectors.saveProfileBtn, '💾 حفظ التغييرات');
        }
    }

    async changePassword() {
        if (this.isLoading) return;
        if (!this.validatePasswordForm()) return;

        this.isLoading = true;
        this.disableButton(this.selectors.changePasswordBtn, 'جاري التغيير...');

        try {
            const formData = {
                current_password: (document.querySelector(this.selectors.currentPassword)?.value || '').trim(),
                new_password: (document.querySelector(this.selectors.newPassword)?.value || '').trim(),
                confirm_password: (document.querySelector(this.selectors.confirmPassword)?.value || '').trim()
            };

            const result = await this.fetchJSON(this.endpoints.changePassword, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (result.success) {
                this.showToast(result.msg, 'success');
                this.resetPasswordForm();
            } else {
                this.showToast(result.msg || 'فشل في تغيير كلمة المرور', 'error');
            }
        } catch (error) {
            console.error('Error changing password:', error);
            this.showToast(error.message || 'حدث خطأ في الاتصال بالخادم', 'error');
        } finally {
            this.isLoading = false;
            this.enableButton(this.selectors.changePasswordBtn, '🔑 تغيير كلمة المرور');
        }
    }

    async uploadAvatar(file) {
        if (this.isLoading) return;
        this.isLoading = true;

        try {
            const formData = new FormData();
            formData.append('avatar', file);

            const result = await this.fetchJSON(this.endpoints.uploadAvatar, {
                method: 'POST',
                body: formData
            });

            if (result.success) {
                this.showToast(result.msg || 'تم رفع الصورة بنجاح', 'success');
                if (result.avatar_url) {
                    const avatarElement = document.querySelector(this.selectors.userAvatar);
                    const fallbackElement = document.querySelector(this.selectors.avatarFallback);
                    if (this.userData) this.userData.avatar_url = result.avatar_url;
                    if (avatarElement) {
                        avatarElement.src = result.avatar_url;
                        avatarElement.style.display = 'block';
                    }
                    if (fallbackElement) fallbackElement.style.display = 'none';
                }
            } else {
                this.showToast(result.msg || 'فشل في رفع الصورة', 'error');
            }
        } catch (error) {
            console.error('Error uploading avatar:', error);
            this.showToast(error.message || 'حدث خطأ في رفع الصورة', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async deleteAccount() {
        if (this.isLoading) return;
        const passwordEl = document.querySelector(this.selectors.deletePassword);
        const password = passwordEl ? passwordEl.value.trim() : '';

        if (!password) {
            this.showValidationError(this.selectors.deletePasswordError, 'الرجاء إدخال كلمة المرور');
            return;
        }

        this.isLoading = true;
        this.disableButton(this.selectors.confirmDeleteBtn, 'جاري الحذف...');

        try {
            const result = await this.fetchJSON(this.endpoints.deleteAccount, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            if (result.success) {
                this.showToast(result.msg || 'تم حذف الحساب', 'success');
                if (result.redirect) window.location.href = result.redirect;
            } else {
                this.showValidationError(this.selectors.deletePasswordError, result.msg || 'فشل الحذف');
                this.showToast(result.msg || 'فشل الحذف', 'error');
            }
        } catch (error) {
            console.error('Error deleting account:', error);
            this.showToast(error.message || 'حدث خطأ في حذف الحساب', 'error');
        } finally {
            this.isLoading = false;
            this.enableButton(this.selectors.confirmDeleteBtn, 'حذف الحساب نهائيًا');
        }
    }

    validateProfileForm() {
        let isValid = true;

        const nameInput = document.querySelector(this.selectors.editName);
        if (!nameInput || !nameInput.value.trim()) {
            this.showValidationError('name-error', 'الرجاء إدخال الاسم');
            isValid = false;
        } else {
            this.hideValidationError('name-error');
        }

        const emailInput = document.querySelector(this.selectors.editEmail);
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailInput || !emailInput.value.trim() || !emailRegex.test(emailInput.value)) {
            this.showValidationError('email-error', 'الرجاء إدخال بريد إلكتروني صحيح');
            isValid = false;
        } else {
            this.hideValidationError('email-error');
        }

        return isValid;
    }

    validatePasswordForm() {
        let isValid = true;

        const currentPassword = document.querySelector(this.selectors.currentPassword);
        if (!currentPassword || !currentPassword.value.trim()) {
            this.showValidationError('current-password-error', 'الرجاء إدخال كلمة المرور الحالية');
            isValid = false;
        } else {
            this.hideValidationError('current-password-error');
        }

        const newPassword = document.querySelector(this.selectors.newPassword);
        if (!newPassword || !newPassword.value.trim() || newPassword.value.length < 6) {
            this.showValidationError('new-password-error', 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
            isValid = false;
        } else {
            this.hideValidationError('new-password-error');
        }

        const confirmPassword = document.querySelector(this.selectors.confirmPassword);
        if (!confirmPassword || newPassword.value !== confirmPassword.value) {
            this.showValidationError('confirm-password-error', 'كلمات المرور غير متطابقة');
            isValid = false;
        } else {
            this.hideValidationError('confirm-password-error');
        }

        return isValid;
    }

    showValidationError(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = message;
            element.classList.add('show');
        }
    }

    hideValidationError(elementId) {
        const element = document.getElementById(elementId);
        if (element) element.classList.remove('show');
    }

    resetPasswordForm() {
        const cur = document.querySelector(this.selectors.currentPassword);
        const nw = document.querySelector(this.selectors.newPassword);
        const cf = document.querySelector(this.selectors.confirmPassword);
        if (cur) cur.value = '';
        if (nw) nw.value = '';
        if (cf) cf.value = '';
        ['current-password-error', 'new-password-error', 'confirm-password-error'].forEach(id => this.hideValidationError(id));
    }

    showDeleteModal() {
        const modal = document.querySelector(this.selectors.deleteModal);
        const pwd = document.querySelector(this.selectors.deletePassword);
        const err = document.querySelector(this.selectors.deletePasswordError);
        if (modal) modal.style.display = 'flex';
        if (pwd) pwd.value = '';
        if (err) err.classList.remove('show');
    }

    hideDeleteModal() {
        const modal = document.querySelector(this.selectors.deleteModal);
        if (modal) modal.style.display = 'none';
    }

    bindEvents() {
        if (this.eventsBound) return;
        this.eventsBound = true;

        const editForm = document.querySelector(this.selectors.editProfileForm);
        if (editForm) {
            editForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.updateProfileInfo();
            });
        }

        const pwdForm = document.querySelector(this.selectors.changePasswordForm);
        if (pwdForm) {
            pwdForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.changePassword();
            });
        }

        const confirmDeleteBtn = document.querySelector(this.selectors.confirmDeleteBtn);
        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', () => this.deleteAccount());
        }

        const deleteModal = document.querySelector(this.selectors.deleteModal);
        if (deleteModal) {
            deleteModal.addEventListener('click', (e) => {
                if (e.target === deleteModal) this.hideDeleteModal();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.querySelector(this.selectors.deleteModal);
                if (modal && modal.style.display === 'flex') this.hideDeleteModal();
            }
        });
    }

    showLoading() {
        const ls = document.querySelector(this.selectors.loadingSection);
        const es = document.querySelector(this.selectors.errorSection);
        const pc = document.querySelector(this.selectors.profileContent);
        if (ls) ls.style.display = 'block';
        if (es) es.style.display = 'none';
        if (pc) pc.style.display = 'none';
    }

    showError(message) {
        const ls = document.querySelector(this.selectors.loadingSection);
        const es = document.querySelector(this.selectors.errorSection);
        const pc = document.querySelector(this.selectors.profileContent);
        const em = document.querySelector(this.selectors.errorMessage);
        if (ls) ls.style.display = 'none';
        if (es) es.style.display = 'block';
        if (pc) pc.style.display = 'none';
        if (em) em.textContent = message;
    }

    showProfileContent() {
        const ls = document.querySelector(this.selectors.loadingSection);
        const es = document.querySelector(this.selectors.errorSection);
        const pc = document.querySelector(this.selectors.profileContent);
        if (ls) ls.style.display = 'none';
        if (es) es.style.display = 'none';
        if (pc) pc.style.display = 'block';
    }

    hideAllSections() {
        const ls = document.querySelector(this.selectors.loadingSection);
        const es = document.querySelector(this.selectors.errorSection);
        const pc = document.querySelector(this.selectors.profileContent);
        if (ls) ls.style.display = 'none';
        if (es) es.style.display = 'none';
        if (pc) pc.style.display = 'none';
    }

    disableButton(selector, text) {
        const btn = document.querySelector(selector);
        if (btn) {
            btn.disabled = true;
            btn.textContent = text;
        }
    }

    enableButton(selector, text) {
        const btn = document.querySelector(selector);
        if (btn) {
            btn.disabled = false;
            btn.textContent = text;
        }
    }

    showToast(message, type = 'info') {
        const container = document.querySelector(this.selectors.toastContainer) || this.createToastContainer();
        const existing = Array.from(container.querySelectorAll('.toast-message')).some(el => el.textContent === message);
        if (existing) return;

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
        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        return icons[type] || icons.info;
    }

    retryLoading() {
        this.loadProfileData();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.ProfileSystem = new ProfileSystem();
    window.ProfileSystem.init().catch(err => {
        console.error('Failed to init ProfileSystem:', err);
    });
});
