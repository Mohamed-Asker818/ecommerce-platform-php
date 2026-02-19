class RegisterSystem {
    constructor() {
        this.isLoading = false;
        this.currentStep = 1;
        
        this.elements = {
            form: document.getElementById('register-form'),
            submitBtn: document.getElementById('register-btn'),
            passwordToggle: document.getElementById('toggle-password'),
            confirmToggle: document.getElementById('toggle-confirm-password'),
            notification: document.getElementById('notification'),
            notificationMessage: document.getElementById('notification-message'),
            notificationClose: document.getElementById('notification-close'),
            progressFill: document.getElementById('form-progress')
        };
        
        this.endpoints = {
            checkField: '../Api/register_api.php?action=check_field',
            suggest: '../Api/register_api.php?action=suggest',
            register: '../Api/register_api.php?action=register'
        };
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.setupRealTimeValidation();
        this.setupPasswordToggle();
        this.createParticles();
        this.setupSteps();
        this.setupPasswordStrength();
    }
    
    bindEvents() {
        if (this.elements.form) {
            this.elements.form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitForm();
            });
        }
        
        if (this.elements.notificationClose) {
            this.elements.notificationClose.addEventListener('click', () => {
                this.hideNotification();
            });
        }
        
        document.addEventListener('click', (e) => {
            if (!this.elements.notification.contains(e.target)) {
                this.hideNotification();
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideNotification();
            }
            if (e.ctrlKey && e.key === 'Enter') {
                this.submitForm();
            }
        });
    }
    
    setupPasswordToggle() {
        if (this.elements.passwordToggle) {
            this.elements.passwordToggle.addEventListener('click', () => {
                const passwordInput = document.getElementById('password');
                this.togglePasswordVisibility(passwordInput, this.elements.passwordToggle);
            });
        }
        
        if (this.elements.confirmToggle) {
            this.elements.confirmToggle.addEventListener('click', () => {
                const confirmInput = document.getElementById('confirm_password');
                this.togglePasswordVisibility(confirmInput, this.elements.confirmToggle);
            });
        }
    }
    
    togglePasswordVisibility(input, toggleBtn) {
        const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
        input.setAttribute('type', type);
        
        toggleBtn.classList.toggle('show');
        
        toggleBtn.style.transform = 'translateY(-50%) scale(1.2)';
        setTimeout(() => {
            toggleBtn.style.transform = 'translateY(-50%) scale(1)';
        }, 200);
    }
    
    setupRealTimeValidation() {
        const fields = ['name', 'email', 'phone', 'password', 'confirm_password'];
        
        fields.forEach(field => {
            const input = document.getElementById(field);
            if (!input) return;
            
            let timeout;
            input.addEventListener('input', () => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    this.validateField(field, input.value);
                    
                    this.updateProgress();
                }, 500);
            });
            
            input.addEventListener('blur', () => {
                if (input.value.trim()) {
                    this.validateField(field, input.value);
                }
            });
            
            input.addEventListener('focus', () => {
                input.parentElement.classList.add('focused');
                this.updateStep(this.getFieldStep(field));
            });
            
            input.addEventListener('blur', () => {
                input.parentElement.classList.remove('focused');
            });
        });
        
        const passwordInput = document.getElementById('password');
        const confirmInput = document.getElementById('confirm_password');
        
        if (passwordInput && confirmInput) {
            confirmInput.addEventListener('input', () => {
                this.checkPasswordMatch();
            });
            
            passwordInput.addEventListener('input', () => {
                this.checkPasswordMatch();
                this.updatePasswordStrength(passwordInput.value);
            });
        }
    }
    
    getFieldStep(field) {
        const stepMap = {
            'name': 1,
            'email': 2,
            'phone': 2,
            'password': 3,
            'confirm_password': 3
        };
        return stepMap[field] || 1;
    }
    
    updateStep(step) {
        if (step > this.currentStep) {
            this.currentStep = step;
            this.updateStepIndicator();
        }
    }
    
    updateStepIndicator() {
        const steps = document.querySelectorAll('.step');
        steps.forEach((step, index) => {
            if (index + 1 <= this.currentStep) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
        });
    }
    
    updateProgress() {
        const fields = ['name', 'email', 'password', 'confirm_password'];
        let completed = 0;
        
        fields.forEach(field => {
            const input = document.getElementById(field);
            if (input && input.value.trim()) {
                completed++;
            }
        });
        
        const progress = (completed / fields.length) * 100;
        this.elements.progressFill.style.width = `${progress}%`;
    }
    
    setupPasswordStrength() {
        const passwordInput = document.getElementById('password');
        if (!passwordInput) return;
        
        const requirements = document.querySelectorAll('.requirement');
        requirements.forEach(req => {
            req.classList.remove('valid');
        });
    }
    
    updatePasswordStrength(password) {
        const strengthMeter = document.getElementById('password-strength');
        const strengthText = document.getElementById('strength-text');
        const dots = document.querySelectorAll('.dot');
        
        if (!strengthMeter || !strengthText) return;
        
        let strength = 0;
        let message = 'None';
        let color = '#ef4444';
        
        const hasLength = password.length >= 6;
        const hasLetter = /[a-zA-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecial = /[^A-Za-z0-9]/.test(password);
        
        this.updateRequirement('length', hasLength);
        this.updateRequirement('letter', hasLetter);
        this.updateRequirement('number', hasNumber);
        this.updateRequirement('special', hasSpecial);
        
        if (hasLength) strength++;
        if (hasLetter) strength++;
        if (hasNumber) strength++;
        if (hasSpecial) strength++;
        if (password.length >= 10) strength++;
        
        switch (strength) {
            case 0:
                message = 'None';
                color = '#ef4444';
                break;
            case 1:
                message = 'Very Weak';
                color = '#ef4444';
                break;
            case 2:
                message = 'Weak';
                color = '#f59e0b';
                break;
            case 3:
                message = 'Medium';
                color = '#10b981';
                break;
            case 4:
                message = 'Strong';
                color = '#3b82f6';
                break;
            case 5:
                message = 'Very Strong';
                color = '#8b5cf6';
                break;
        }
        
        strengthText.textContent = message;
        strengthText.style.color = color;
        strengthMeter.style.background = `linear-gradient(90deg, ${color}, ${color}60)`;
        strengthMeter.style.width = `${(strength / 5) * 100}%`;
        
        dots.forEach((dot, index) => {
            if (index < strength) {
                dot.classList.add('active');
                dot.style.background = color;
            } else {
                dot.classList.remove('active');
                dot.style.background = '';
            }
        });
    }
    
    updateRequirement(type, isValid) {
        const requirement = document.querySelector(`.requirement[data-check="${type}"]`);
        if (requirement) {
            if (isValid) {
                requirement.classList.add('valid');
            } else {
                requirement.classList.remove('valid');
            }
        }
    }
    
    checkPasswordMatch() {
        const password = document.getElementById('password').value;
        const confirm = document.getElementById('confirm_password').value;
        const matchIndicator = document.getElementById('password-match');
        
        if (!password || !confirm) {
            matchIndicator.classList.remove('show');
            return;
        }
        
        if (password === confirm) {
            matchIndicator.classList.add('show');
            matchIndicator.style.color = '#10b981';
        } else {
            matchIndicator.classList.remove('show');
        }
    }
    
    async validateField(field, value) {
        this.clearValidation(field);
        
        if ((field === 'phone') && !value.trim()) {
            return true;
        }
        
        try {
            const response = await fetch(this.endpoints.checkField, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                field: field,
                value: value,
                ...(field === 'confirm_password' ? { password: document.getElementById('password').value } : {})
            })
        });
            if (!response.ok) {
            console.error('Validation request failed', response.status, response.statusText);
            return false;
        }
            const data = await response.json();
            
            if (data.success) {
                if (data.valid) {
                    this.markValid(field);
                    return true;
                } else {
                    this.markInvalid(field, data.message);
                    
                    if (data.suggestions && data.suggestions.length > 0) {
                        this.showSuggestions(field, data.suggestions);
                    }
                    return false;
                }
} else {
            console.warn('Validation returned success:false', data);
            return false;
        }

    } catch (error) {
        console.error('Validation error:', error);
        return false;
    }
}
    
    markValid(field) {
        const input = document.getElementById(field);
        const error = document.getElementById(`${field}-error`);
        
        if (input) {
            input.classList.remove('invalid');
            input.classList.add('valid');
            
            this.animateSuccess(input);
        }
        
        if (error) {
            error.textContent = '';
            error.classList.remove('show');
        }
        
        this.removeSuggestions(field);
    }
    
    markInvalid(field, message) {
        const input = document.getElementById(field);
        const error = document.getElementById(`${field}-error`);
        
        if (input) {
            input.classList.remove('valid');
            input.classList.add('invalid');
            this.shakeElement(input);
        }
        
        if (error) {
            error.textContent = message;
            error.classList.add('show');
        }
    }
    
    clearValidation(field) {
        const input = document.getElementById(field);
        const error = document.getElementById(`${field}-error`);
        
        if (input) {
            input.classList.remove('invalid', 'valid');
        }
        
        if (error) {
            error.textContent = '';
            error.classList.remove('show');
        }
    }
    
    showSuggestions(field, suggestions) {
        this.removeSuggestions(field);
        
        const container = document.createElement('div');
        container.className = 'suggestions-container';
        
        suggestions.forEach((suggestion, index) => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.innerHTML = `
                <span class="suggestion-number">${index + 1}</span>
                <span class="suggestion-text">${suggestion}</span>
                <button class="suggestion-use-btn" data-suggestion="${suggestion}">Use</button>
            `;
            
            const useBtn = item.querySelector('.suggestion-use-btn');
            useBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const input = document.getElementById(field);
                if (input) {
                    input.value = suggestion;
                    input.focus();
                    this.validateField(field, suggestion);
                }
            });
            
            container.appendChild(item);
        });
        
        const error = document.getElementById(`${field}-error`);
        if (error) {
            error.parentNode.insertBefore(container, error.nextSibling);
            
            setTimeout(() => {
                container.style.opacity = '1';
                container.style.transform = 'translateY(0)';
            }, 10);
        }
    }
    
    removeSuggestions(field) {
        const container = document.querySelector(`#${field}-error + .suggestions-container`);
        if (container) {
            container.remove();
        }
    }
    
    async validateAllFields() {
        const fields = [
            { id: 'name', required: true },
            { id: 'email', required: true },
            { id: 'phone', required: false },
            { id: 'password', required: true },
            { id: 'confirm_password', required: true }
        ];
        
        let allValid = true;
        
        for (const field of fields) {
            const input = document.getElementById(field.id);
            const value = input ? input.value.trim() : '';
            
            if (field.required && !value) {
                this.markInvalid(field.id, 'This field is required');
                allValid = false;
            } else if (value) {
                const isValid = await this.validateField(field.id, value);
                if (!isValid) allValid = false;
            }
        }
        
        const termsCheckbox = document.getElementById('terms');
        if (!termsCheckbox.checked) {
            this.markInvalid('terms', 'You must agree to the terms');
            allValid = false;
        }
        
        return allValid;
    }
    
async submitForm() {
    if (this.isLoading) return;

    const isValid = await this.validateAllFields();
    if (!isValid) {
        this.showNotification('Please correct the errors in the form', 'error');
        return;
    }

    this.isLoading = true;
    this.setLoading(true);

    try {
        const formData = new FormData(this.elements.form);

        const response = await fetch(this.endpoints.register, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            console.error('Register request failed', response.status, response.statusText);
            this.showNotification('Server error. Please try again later.', 'error');
            this.setLoading(false);
            this.isLoading = false;
            return;
        }

        const result = await response.json();

        if (result.success) {
                this.showNotification(result.msg || 'Account created successfully', 'success');
    this.setLoading(false);
    this.elements.submitBtn.disabled = true;
setTimeout(() => {
        window.location.href = result.redirect || 'Home.php';
    }, 500);
    
        } else {
            this.showNotification(result.msg || 'Failed to create account', 'error');
            this.setLoading(false);
        }

    } catch (error) {
        console.error('Registration error:', error);
        this.showNotification('Connection error. Please check your internet and try again.', 'error');
        this.setLoading(false);
    } finally {
        this.isLoading = false;
    }
}

    
    setLoading(loading) {
        if (!this.elements.submitBtn) return;
        
        if (loading) {
            this.elements.submitBtn.classList.add('loading');
            this.elements.submitBtn.disabled = true;
        } else {
            this.elements.submitBtn.classList.remove('loading');
            this.elements.submitBtn.disabled = false;
        }
    }
    
    showNotification(message, type = 'error') {
        if (!this.elements.notification || !this.elements.notificationMessage) return;
        
        this.elements.notificationMessage.textContent = message;
        this.elements.notification.className = `notification show ${type}`;
        
        setTimeout(() => {
            this.hideNotification();
        }, 5000);
    }
    
    hideNotification() {
        if (this.elements.notification) {
            this.elements.notification.classList.remove('show');
        }
    }
    
    shakeElement(element) {
        element.classList.add('shake');
        setTimeout(() => {
            element.classList.remove('shake');
        }, 500);
    }
    
    animateSuccess(element) {
        element.classList.add('success-animation');
        setTimeout(() => {
            element.classList.remove('success-animation');
        }, 1000);
    }
    
    createParticles() {
        const container = document.querySelector('.particles-container');
        if (!container) return;
        
        for (let i = 0; i < 30; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            
            const size = Math.random() * 5 + 2;
            const posX = Math.random() * 100;
            const posY = Math.random() * 100;
            const duration = Math.random() * 20 + 10;
            const delay = Math.random() * 5;
            
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.left = `${posX}%`;
            particle.style.top = `${posY}%`;
            particle.style.animationDuration = `${duration}s`;
            particle.style.animationDelay = `${delay}s`;
            particle.style.background = `rgba(255, 255, 255, ${Math.random() * 0.3 + 0.1})`;
            particle.style.borderRadius = '50%';
            
            particle.style.position = 'absolute';
            particle.style.animation = `float ${duration}s infinite linear`;
            
            container.appendChild(particle);
        }
    }
    
    setupSteps() {
        const steps = document.querySelectorAll('.step');
        steps.forEach(step => {
            step.addEventListener('click', () => {
                const stepNumber = parseInt(step.getAttribute('data-step'));
                this.scrollToStep(stepNumber);
            });
        });
    }
    
    scrollToStep(stepNumber) {
        let fieldId;
        switch (stepNumber) {
            case 1: fieldId = 'name'; break;
            case 2: fieldId = 'email'; break;
            case 3: fieldId = 'password'; break;
            default: return;
        }
        
        const field = document.getElementById(fieldId);
        if (field) {
            field.focus();
            field.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.registerSystem = new RegisterSystem();
    
    const style = document.createElement('style');
    style.textContent = `
        .shake {
            animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }
        
        @keyframes shake {
            10%, 90% { transform: translate3d(-1px, 0, 0); }
            20%, 80% { transform: translate3d(2px, 0, 0); }
            30%, 50%, 70% { transform: translate3d(-3px, 0, 0); }
            40%, 60% { transform: translate3d(3px, 0, 0); }
        }
        
        .success-animation {
            animation: success-pulse 0.6s ease;
        }
        
        @keyframes success-pulse {
            0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
            70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
            100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        
        .particle {
            position: absolute;
            pointer-events: none;
        }
    `;
    document.head.appendChild(style);
    
    setTimeout(() => {
        const nameField = document.getElementById('name');
        if (nameField) {
            nameField.focus();
        }
    }, 500);
});
