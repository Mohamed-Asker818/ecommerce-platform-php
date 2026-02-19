
class LoginSystem {
    constructor() {
        this.currentMode = 'login'; 
        this.isLoading = false;
        this.otpVerified = false;
        
        this.selectors = {
            loginForm: '#login-form',
            forgotForm: '#forgot-form',
            resetForm: '#reset-form',
            otpForm: '#otp-form',
            
            modeTabs: '.mode-tab',
            activeTab: '.mode-tab.active',
            
            loginContainer: '#login-container',
            
            submitBtn: '.submit-btn',
            loadingSpinner: '.loading-spinner',
            
            errorContainer: '.error-container',
            successContainer: '.success-container',
            
            passwordToggle: '.password-toggle',
            passwordField: '.password-field',
            
            socialLogin: '.social-login-btn',
            guestLogin: '#guest-login',
            
            particlesContainer: '#particles-js',
            
            goToRegisterBtn: '#go-to-register'
        };
        
        this.endpoints = {
            login: '../Api/login_api.php',
            checkSession: '../Api/login_api.php?action=check_session'
        };
        
        this.init();
    }
    
    async init() {
        this.bindEvents();
        this.initParticles();
        this.setupPasswordToggles();
        this.setupSocialLogin();
        this.setupAnimations();
        this.autoFocusInput();
        this.checkURLParams();
    }
    
    checkURLParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode');
        
        if (mode === 'forgot') {
            this.switchMode('forgot');
        }
    }
    
    initParticles() {
        if (typeof particlesJS !== 'undefined') {
            particlesJS(this.selectors.particlesContainer.replace('#', ''), {
                particles: {
                    number: { value: 60, density: { enable: true, value_area: 800 } },
                    color: { value: "#ffffff" },
                    shape: { type: "circle" },
                    opacity: { value: 0.2, random: true },
                    size: { value: 2.5, random: true },
                    line_linked: {
                        enable: true,
                        distance: 120,
                        color: "#ffffff",
                        opacity: 0.1,
                        width: 0.8
                    },
                    move: {
                        enable: true,
                        speed: 1.5,
                        direction: "none",
                        random: true,
                        straight: false,
                        out_mode: "out",
                        bounce: false
                    }
                },
                retina_detect: true
            });
        }
    }
    
    setupPasswordToggles() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.password-toggle')) {
                const toggle = e.target.closest('.password-toggle');
                const input = toggle.closest('.input-wrapper').querySelector('.password-field');
                const icon = toggle.querySelector('i');
                
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.className = 'fas fa-eye-slash';
                } else {
                    input.type = 'password';
                    icon.className = 'fas fa-eye';
                }
            }
        });
    }
    
    setupSocialLogin() {
        document.querySelectorAll(this.selectors.socialLogin).forEach(btn => {
            btn.addEventListener('click', (e) => {
                const provider = e.target.dataset.provider;
                this.socialLogin(provider);
            });
        });
        
        // Guest login
        const guestBtn = document.querySelector(this.selectors.guestLogin);
        if (guestBtn) {
            guestBtn.addEventListener('click', () => {
                this.guestLogin();
            });
        }
        
        // Go to register button
        const registerBtn = document.querySelector(this.selectors.goToRegisterBtn);
        if (registerBtn) {
            registerBtn.addEventListener('click', () => {
                window.location.href = 'register.php';
            });
        }
    }
    
    async socialLogin(provider) {
        this.showLoading(`جاري الاتصال بـ ${provider}...`);
        
        // Simulate API call
        setTimeout(() => {
            this.showToast('هذه الميزة قيد التطوير حالياً', 'info');
            this.hideLoading();
        }, 1500);
    }
    
    async guestLogin() {
        this.showLoading('جاري تسجيل الدخول كضيف...');
        
        // Set guest session
        sessionStorage.setItem('guest_mode', 'true');
        
        setTimeout(() => {
            this.showToast('مرحباً بك كضيف!', 'success');
            window.location.href = 'Home.php';
        }, 1000);
    }
    
    bindEvents() {
        // Mode switching
        document.querySelectorAll(this.selectors.modeTabs).forEach(tab => {
            tab.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                if (mode) {
                    this.switchMode(mode);
                }
            });
        });
        
        // Form submissions
        const forms = [
            this.selectors.loginForm,
            this.selectors.forgotForm,
            this.selectors.otpForm,
            this.selectors.resetForm
        ];
        
        forms.forEach(selector => {
            const form = document.querySelector(selector);
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.handleFormSubmit(selector);
                });
            }
        });
        
        this.setupRealTimeValidation();
        
        this.setupOTPInputs();
        
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.handleFormSubmit(this.getActiveForm());
            }
            
            if (e.key === 'Escape') {
                this.hideError();
                this.hideSuccess();
            }
        });
    }
    
    setupOTPInputs() {
        const otpInputs = document.querySelectorAll('.otp-input');
        otpInputs.forEach((input, index) => {
            input.addEventListener('input', (e) => {
                const value = e.target.value;
                
                // Only allow numbers
                if (!/^\d*$/.test(value)) {
                    e.target.value = '';
                    return;
                }
                
                // Auto-focus next input
                if (value && index < otpInputs.length - 1) {
                    otpInputs[index + 1].focus();
                }
                
                // Update hidden OTP field
                this.updateOTPCode();
            });
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !input.value && index > 0) {
                    otpInputs[index - 1].focus();
                }
            });
            
            input.addEventListener('paste', (e) => {
                e.preventDefault();
                const pasteData = e.clipboardData.getData('text').slice(0, 6);
                pasteData.split('').forEach((char, i) => {
                    if (otpInputs[i] && /^\d$/.test(char)) {
                        otpInputs[i].value = char;
                    }
                });
                this.updateOTPCode();
                if (pasteData.length === 6) {
                    document.querySelector('.submit-btn').focus();
                }
            });
        });
    }
    
    updateOTPCode() {
        const otpInputs = document.querySelectorAll('.otp-input');
        const otpCode = Array.from(otpInputs).map(input => input.value).join('');
        document.getElementById('otp-code').value = otpCode;
    }
    
    switchMode(mode) {
        if (this.currentMode === mode || this.isLoading) return;
        
        this.currentMode = mode;
        
        // Update active tab
        document.querySelectorAll(this.selectors.modeTabs).forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.mode === mode) {
                tab.classList.add('active');
            }
        });
        
        // Hide all forms
        const forms = [
            this.selectors.loginForm,
            this.selectors.forgotForm,
            this.selectors.otpForm,
            this.selectors.resetForm
        ];
        
        forms.forEach(selector => {
            const form = document.querySelector(selector);
            if (form) {
                form.classList.remove('active');
                form.style.opacity = '0';
                form.style.transform = 'translateX(20px)';
            }
        });
        
        // Show selected form with animation
        setTimeout(() => {
            let targetForm;
            switch(mode) {
                case 'login':
                    targetForm = this.selectors.loginForm;
                    break;
                case 'forgot':
                    targetForm = this.selectors.forgotForm;
                    break;
                default:
                    targetForm = this.selectors.loginForm;
            }
            
            const form = document.querySelector(targetForm);
            if (form) {
                form.classList.add('active');
                form.style.transition = 'all 0.5s ease';
                form.style.opacity = '1';
                form.style.transform = 'translateX(0)';
            }
            
            // Clear any errors
            this.hideError();
            this.hideSuccess();
            
            // Auto focus first input
            this.autoFocusInput();
            
        }, 300);
    }
    
    async handleFormSubmit(formSelector) {
        if (this.isLoading) return;
        
        const form = document.querySelector(formSelector);
        if (!form || !this.validateForm(form)) return;
        
        this.showLoading();
        
        const formData = new FormData(form);
        formData.append('action', this.getFormAction(formSelector));
        
        try {
            const response = await fetch(this.endpoints.login, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.handleSuccess(data, formSelector);
            } else {
                this.showError(data.msg);
            }
        } catch (error) {
            console.error('Error:', error);
            this.showError('حدث خطأ في الاتصال بالخادم');
        } finally {
            this.hideLoading();
        }
    }
    
    validateForm(form) {
        let isValid = true;
        const inputs = form.querySelectorAll('input[required], textarea[required]');
        
        // Clear previous errors
        form.querySelectorAll('.error-message').forEach(el => {
            el.textContent = '';
            el.classList.remove('show');
        });
        
        // Validate each input
        inputs.forEach(input => {
            const errorElement = input.parentElement.querySelector('.error-message') ||
                               input.parentElement.parentElement.querySelector('.error-message');
            
            if (!input.value.trim()) {
                this.showInputError(input, 'هذا الحقل مطلوب', errorElement);
                isValid = false;
            } else if (input.type === 'email' && !this.validateEmail(input.value)) {
                this.showInputError(input, 'البريد الإلكتروني غير صالح', errorElement);
                isValid = false;
            } else if (input.type === 'password' && input.value.length < 6) {
                this.showInputError(input, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل', errorElement);
                isValid = false;
            }
        });
        
        // Special validation for password confirmation
        const password = form.querySelector('input[name="new_password"]');
        const confirmPassword = form.querySelector('input[name="confirm_password"]');
        
        if (password && confirmPassword && password.value !== confirmPassword.value) {
            this.showInputError(confirmPassword, 'كلمات المرور غير متطابقة');
            isValid = false;
        }
        
        return isValid;
    }
    
    setupRealTimeValidation() {
        const forms = [
            this.selectors.loginForm,
            this.selectors.forgotForm
        ];
        
        forms.forEach(selector => {
            const form = document.querySelector(selector);
            if (form) {
                form.querySelectorAll('input').forEach(input => {
                    input.addEventListener('blur', () => {
                        this.validateField(input);
                    });
                    
                    input.addEventListener('input', () => {
                        this.clearFieldError(input);
                    });
                });
            }
        });
    }
    
    validateField(input) {
        const errorElement = input.parentElement.querySelector('.error-message');
        
        if (input.hasAttribute('required') && !input.value.trim()) {
            this.showInputError(input, 'هذا الحقل مطلوب', errorElement);
            return false;
        }
        
        if (input.type === 'email' && input.value && !this.validateEmail(input.value)) {
            this.showInputError(input, 'البريد الإلكتروني غير صالح', errorElement);
            return false;
        }
        
        return true;
    }
    
    clearFieldError(input) {
        const errorElement = input.parentElement.querySelector('.error-message');
        if (errorElement) {
            errorElement.classList.remove('show');
        }
        input.classList.remove('error');
    }
    
    showInputError(input, message, errorElement = null) {
        input.classList.add('error');
        
        const targetErrorElement = errorElement || 
                                 input.parentElement.querySelector('.error-message') ||
                                 input.parentElement.parentElement.querySelector('.error-message');
        
        if (targetErrorElement) {
            targetErrorElement.textContent = message;
            targetErrorElement.classList.add('show');
        }
        
        // Shake animation
        input.style.animation = 'gentlePulse 0.5s';
        setTimeout(() => {
            input.style.animation = '';
        }, 500);
    }
    
    handleSuccess(data, formSelector) {
        this.showSuccess(data.msg);
        
        switch(this.getFormAction(formSelector)) {
            case 'login':
                if (data.data?.user) {
                    // Redirect after successful login
                    setTimeout(() => {
                        const redirect = new URLSearchParams(window.location.search).get('redirect');
                        window.location.href = redirect || 'Home.php';
                    }, 1500);
                }
                break;
                
            case 'forgot_password':
                // Show OTP form
                this.showOTPForm(data.data?.user_id, data.data?.email);
                break;
                
            case 'verify_otp':
                // Show reset password form
                this.showResetForm(data.data?.user_id, data.data?.otp);
                break;
                
            case 'reset_password':
                // Return to login
                setTimeout(() => {
                    this.switchMode('login');
                }, 1500);
                break;
        }
    }
    
    showOTPForm(userId, email) {
        // Hide current form
        document.querySelector(this.getActiveForm()).classList.remove('active');
        
        // Show OTP form
        const otpForm = document.querySelector(this.selectors.otpForm);
        if (otpForm) {
            otpForm.classList.add('active');
            
            // Set user ID and email
            otpForm.querySelector('input[name="user_id"]').value = userId;
            document.getElementById('otp-email').textContent = email;
            
            // Start OTP timer
            this.startOTPTimer();
            
            // Auto focus first OTP input
            setTimeout(() => {
                document.querySelector('.otp-input').focus();
            }, 300);
        }
    }
    
    showResetForm(userId, otp) {
        // Hide OTP form
        document.querySelector(this.selectors.otpForm).classList.remove('active');
        
        // Show reset form
        const resetForm = document.querySelector(this.selectors.resetForm);
        if (resetForm) {
            resetForm.classList.add('active');
            
            // Set user ID and OTP
            resetForm.querySelector('input[name="user_id"]').value = userId;
            resetForm.querySelector('input[name="otp"]').value = otp;
            
            // Auto focus first password input
            setTimeout(() => {
                document.getElementById('new-password').focus();
            }, 300);
        }
    }
    
    startOTPTimer() {
        let timeLeft = 300; // 5 minutes
        const timerElement = document.querySelector('.otp-timer');
        const resendBtn = document.querySelector('.resend-otp');
        
        if (!timerElement) return;
        
        const timer = setInterval(() => {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            
            timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            if (timeLeft <= 0) {
                clearInterval(timer);
                timerElement.textContent = 'انتهى الوقت';
                if (resendBtn) {
                    resendBtn.disabled = false;
                    resendBtn.classList.remove('disabled');
                }
            }
            
            timeLeft--;
        }, 1000);
    }
    
    getFormAction(formSelector) {
        switch(formSelector) {
            case this.selectors.loginForm: return 'login';
            case this.selectors.forgotForm: return 'forgot_password';
            case this.selectors.otpForm: return 'verify_otp';
            case this.selectors.resetForm: return 'reset_password';
            default: return '';
        }
    }
    
    getActiveForm() {
        switch(this.currentMode) {
            case 'login': return this.selectors.loginForm;
            case 'forgot': return this.selectors.forgotForm;
            default: return this.selectors.loginForm;
        }
    }
    
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    showLoading(message = 'جاري المعالجة...') {
        this.isLoading = true;
        
        const submitBtn = document.querySelector('.login-form.active .submit-btn');
        if (submitBtn) {
            submitBtn.disabled = true;
            const originalText = submitBtn.dataset.originalText || submitBtn.querySelector('.btn-text').textContent;
            submitBtn.dataset.originalText = originalText;
            submitBtn.innerHTML = `
                <span class="loading-spinner"></span>
                ${message}
            `;
        }
    }
    
    hideLoading() {
        this.isLoading = false;
        
        const submitBtn = document.querySelector('.login-form.active .submit-btn');
        if (submitBtn) {
            submitBtn.disabled = false;
            const originalText = submitBtn.dataset.originalText || 'تسجيل الدخول';
            submitBtn.innerHTML = `
                <i class="${this.getFormIcon(submitBtn.closest('form').id)}"></i>
                <span class="btn-text">${originalText}</span>
            `;
        }
    }
    
    getFormIcon(formId) {
        switch(formId) {
            case 'login-form': return 'fas fa-sign-in-alt';
            case 'forgot-form': return 'fas fa-paper-plane';
            case 'otp-form': return 'fas fa-check-circle';
            case 'reset-form': return 'fas fa-sync-alt';
            default: return 'fas fa-sign-in-alt';
        }
    }
    
    showError(message) {
        const errorContainer = document.querySelector(this.selectors.errorContainer);
        if (errorContainer) {
            errorContainer.innerHTML = `
                <div class="error-message">
                    <span class="error-icon">⚠️</span>
                    <span class="error-text">${message}</span>
                </div>
            `;
            errorContainer.classList.add('show');
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                this.hideError();
            }, 5000);
        }
    }
    
    hideError() {
        const errorContainer = document.querySelector(this.selectors.errorContainer);
        if (errorContainer) {
            errorContainer.classList.remove('show');
        }
    }
    
    showSuccess(message) {
        const successContainer = document.querySelector(this.selectors.successContainer);
        if (successContainer) {
            successContainer.innerHTML = `
                <div class="success-message">
                    <span class="success-icon">✅</span>
                    <span class="success-text">${message}</span>
                </div>
            `;
            successContainer.classList.add('show');
            
            // Auto-hide after 3 seconds
            setTimeout(() => {
                this.hideSuccess();
            }, 3000);
        }
    }
    
    hideSuccess() {
        const successContainer = document.querySelector(this.selectors.successContainer);
        if (successContainer) {
            successContainer.classList.remove('show');
        }
    }
    
    showToast(message, type = 'info') {
        const container = document.querySelector('.toast-container') || this.createToastContainer();
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-icon">
                ${this.getToastIcon(type)}
            </div>
            <div class="toast-message">${message}</div>
            <button class="toast-close">&times;</button>
        `;
        
        container.appendChild(toast);
        
        // Close button
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 5000);
    }
    
    hideToast(toast) {
        toast.remove();
    }
    
    createToastContainer() {
        const container = document.createElement('div');
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
    
    autoFocusInput() {
        setTimeout(() => {
            const firstInput = document.querySelector('.login-form.active input:not([type="hidden"])');
            if (firstInput) {
                firstInput.focus();
            }
        }, 300);
    }
    
    setupAnimations() {
        // Add entrance animations
        const loginContainer = document.querySelector(this.selectors.loginContainer);
        if (loginContainer) {
            loginContainer.style.opacity = '0';
            loginContainer.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                loginContainer.style.transition = 'all 0.6s ease';
                loginContainer.style.opacity = '1';
                loginContainer.style.transform = 'translateY(0)';
            }, 100);
        }
        
        // Add floating animation to logo
        const logo = document.querySelector('.logo');
        if (logo) {
            setInterval(() => {
                logo.style.transform = 'translateY(-5px)';
                setTimeout(() => {
                    logo.style.transform = 'translateY(0)';
                }, 2000);
            }, 4000);
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.LoginSystem = new LoginSystem();
});
