

(() => {
    'use strict';

    const CONFIG = {
        animationDuration: 300,
        overlayId: 'mobile-splash-overlay',
        checkboxId: 'dont-show-again',
        baseUrl: typeof PROJECT_BASE !== 'undefined' ? PROJECT_BASE : '../'
    };

    const getBaseUrl = () => {
        return CONFIG.baseUrl.endsWith('/') ? CONFIG.baseUrl : CONFIG.baseUrl + '/';
    };

    
    const closeMobileSplash = () => {
        const overlay = document.getElementById(CONFIG.overlayId);
        if (!overlay) return;

        overlay.style.animation = 'fadeOut 0.3s ease-out forwards';
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, CONFIG.animationDuration);
    };

    const continueShopping = () => {
        closeMobileSplash();
    };

    const viewDesktopVersion = () => {
        const apiUrl = getBaseUrl() + 'Api/set_view_preference.php?view=desktop';
        
        fetch(apiUrl, {
            method: 'GET',
            credentials: 'same-origin'
        })
        .then(response => {
            if (response.ok) {
                window.location.reload();
            } else {
                console.error('Failed to set view preference');
            }
        })
        .catch(error => {
            console.error('Error switching to desktop version:', error);
            window.location.reload();
        });
    };

    
    const handleDontShowAgain = () => {
        const checkbox = document.getElementById(CONFIG.checkboxId);
        if (!checkbox || !checkbox.checked) return;

        const apiUrl = getBaseUrl() + 'Api/set_view_preference.php?action=hide_splash';
        
        fetch(apiUrl, {
            method: 'GET',
            credentials: 'same-origin'
        })
        .catch(error => {
            console.error('Error hiding splash:', error);
        });
    };

    const setupEventListeners = () => {
        const overlay = document.getElementById(CONFIG.overlayId);
        if (!overlay) return;

        const closeBtn = overlay.querySelector('.splash-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeMobileSplash);
        }

        const primaryBtn = overlay.querySelector('.splash-btn-primary');
        if (primaryBtn) {
            primaryBtn.addEventListener('click', continueShopping);
        }

        const secondaryBtn = overlay.querySelector('.splash-btn-secondary');
        if (secondaryBtn) {
            secondaryBtn.addEventListener('click', viewDesktopVersion);
        }

        const checkbox = overlay.querySelector('.splash-checkbox input[type="checkbox"]');
        if (checkbox) {
            checkbox.addEventListener('change', handleDontShowAgain);
        }

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeMobileSplash();
            }
        });
    };

    const injectAnimations = () => {
        const styleSheets = document.styleSheets;
        let fadeOutExists = false;

        try {
            for (let i = 0; i < styleSheets.length; i++) {
                const rules = styleSheets[i].cssRules || styleSheets[i].rules;
                for (let j = 0; j < rules.length; j++) {
                    if (rules[j].name === 'fadeOut') {
                        fadeOutExists = true;
                        break;
                    }
                }
                if (fadeOutExists) break;
            }
        } catch (e) {
        }

        if (!fadeOutExists) {
            const style = document.createElement('style');
            style.textContent = `
                @keyframes fadeOut {
                    from {
                        opacity: 1;
                    }
                    to {
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    };

    const init = () => {
        const overlay = document.getElementById(CONFIG.overlayId);
        if (!overlay) return;

        injectAnimations();

        setupEventListeners();

        window.closeMobileSplash = closeMobileSplash;
        window.continueShopping = continueShopping;
        window.viewDesktopVersion = viewDesktopVersion;
        window.handleDontShowAgain = handleDontShowAgain;
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
