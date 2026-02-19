
class OrderSuccess {
    constructor() {
        this.orderData = null;
        this.orderId = this.getOrderIdFromURL();
        this.init();
    }
    
    init() {
        this.setupAnimations();
        this.bindEvents();
        this.startOrderTracking();
        this.setupPrintFunctionality();
        this.setupAutoRefresh();
    }
    
    getOrderIdFromURL() {
        const params = new URLSearchParams(window.location.search);
        return params.get('id') || '';
    }
    
    setupAnimations() {
        setTimeout(() => {
            document.getElementById('success-animation').style.display = 'none';
            document.getElementById('main-container').style.display = 'block';
            this.addRevealAnimations();
        }, 2000);
    }
    
    addRevealAnimations() {
        const elements = document.querySelectorAll('.order-summary-section, .info-grid, .timeline-section, .help-section');
        elements.forEach((el, index) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                el.style.transition = 'all 0.6s ease';
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, index * 200 + 300);
        });
    }
    
    bindEvents() {
        document.querySelector('[onclick*="print"]')?.addEventListener('click', this.printInvoice.bind(this));
        
        document.querySelector('[onclick*="downloadInvoice"]')?.addEventListener('click', this.downloadInvoice.bind(this));
        
        this.setupStatusUpdates();
    }
    
    startOrderTracking() {
        if (Math.random() > 0.5) {
            setTimeout(() => {
                this.simulateStatusUpdate();
            }, 10000);
        }
    }
    
    simulateStatusUpdate() {
        const statusElement = document.getElementById('status-badge');
        if (!statusElement) return;
        
        const currentStatus = statusElement.querySelector('.status-text').textContent;
        const statuses = ['قيد الانتظار', 'قيد المعالجة', 'تم الشحن', 'تم التسليم', 'مكتمل'];
        const currentIndex = statuses.indexOf(currentStatus);
        
        if (currentIndex < statuses.length - 1) {
            statusElement.style.animation = 'pulse 1.5s infinite';
            statusElement.querySelector('.status-text').textContent = statuses[currentIndex + 1];
            
            this.updateTimeline(currentIndex + 1);
            
            this.showNotification(`تم تحديث حالة طلبك إلى: ${statuses[currentIndex + 1]}`);
            
            setTimeout(() => {
                statusElement.style.animation = '';
            }, 3000);
        }
    }
    
    updateTimeline(stepIndex) {
        const steps = document.querySelectorAll('.timeline-step');
        steps.forEach((step, index) => {
            if (index <= stepIndex) {
                step.classList.add('completed');
                step.classList.remove('active', 'pending');
            } else if (index === stepIndex + 1) {
                step.classList.add('active');
                step.classList.remove('completed', 'pending');
            } else {
                step.classList.add('pending');
                step.classList.remove('completed', 'active');
            }
        });
    }
    
    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">🔔</span>
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
            z-index: 1000;
            animation: slideInRight 0.3s ease;
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
    
    setupPrintFunctionality() {
        const printStyle = document.createElement('style');
        printStyle.textContent = `
            @media print {
                body * {
                    visibility: hidden;
                }
                .order-success-container,
                .order-success-container * {
                    visibility: visible;
                }
                .order-success-container {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    padding: 0;
                    margin: 0;
                    box-shadow: none;
                }
                .order-actions,
                .help-section,
                .timeline-section,
                .success-animation {
                    display: none !important;
                }
            }
        `;
        document.head.appendChild(printStyle);
    }
    
    printInvoice() {
        window.print();
    }
    
    downloadInvoice() {
        this.showLoading('جاري تحميل الفاتورة...');
        
        setTimeout(() => {
            this.hideLoading();
            this.showNotification('تم تحميل الفاتورة بنجاح');
            
        }, 1500);
    }
    
    setupStatusUpdates() {
        document.querySelectorAll('.timeline-step').forEach(step => {
            step.addEventListener('click', () => {
                const status = step.querySelector('h4').textContent;
                this.showStatusDetails(status);
            });
        });
    }
    
    showStatusDetails(status) {
        const details = {
            'قيد الانتظار': 'طلبك قيد المراجعة من قبل فريقنا. سيتم تحديث الحالة قريباً.',
            'قيد المعالجة': 'جارٍ تحضير طلبك للتغليف والتجهيز للشحن.',
            'تم الشحن': 'طلبك في الطريق إليك. يمكنك تتبع الشحنة باستخدام رقم التتبع.',
            'تم التسليم': 'تم تسليم طلبك إلى العنوان المحدد.',
            'مكتمل': 'اكتمل طلبك بنجاح. شكراً لاختيارك متجرنا!'
        };
        
        const detail = details[status] || 'معلومات الحالة غير متوفرة.';
        alert(`${status}\n\n${detail}`);
    }
    
    setupAutoRefresh() {
        setInterval(() => {
            if (document.visibilityState === 'visible') {
                this.checkForUpdates();
            }
        }, 30000);
    }
    
    checkForUpdates() {
        if (Math.random() > 0.8) {
            this.simulateStatusUpdate();
        }
    }
    
    showLoading(message) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.querySelector('p').textContent = message;
            overlay.style.display = 'flex';
        }
    }
    
    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
}

function downloadInvoice() {
    window.OrderSuccess?.downloadInvoice();
}

document.addEventListener('DOMContentLoaded', () => {
    window.OrderSuccess = new OrderSuccess();
    
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
        }
        .notification-close {
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: #666;
        }
    `;
    document.head.appendChild(style);
});
