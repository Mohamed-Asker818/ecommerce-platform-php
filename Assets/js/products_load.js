
const ProductLoader = {
    currentPage: 1,
    isLoading: false,
    containerSelector: '#products-container',
    loadMoreBtnSelector: '#load-more-btn',

    init: function() {
        const loadMoreBtn = document.querySelector(this.loadMoreBtnSelector);
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => this.loadMore());
        }

        this.bindEvents();
    },

    loadMore: function() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        const btn = document.querySelector(this.loadMoreBtnSelector);
        if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحميل...';

        const nextPage = this.currentPage + 1;
        const url = `../Controller/load_products.php?page=${nextPage}`;

        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const container = document.querySelector(this.containerSelector);
                    if (container) {
                        container.insertAdjacentHTML('beforeend', data.html);
                        this.currentPage = nextPage;
                        
                        if (!data.hasNextPage && btn) {
                            btn.style.display = 'none';
                        }
                    }
                }
            })
            .catch(error => console.error('Error loading products:', error))
            .finally(() => {
                this.isLoading = false;
                if (btn && btn.style.display !== 'none') {
                    btn.innerHTML = 'تحميل المزيد';
                }
                this.bindEvents(); 
            });
    },

    bindEvents: function() {
        document.querySelectorAll('.btn-action-v2.add-cart').forEach(btn => {
            btn.onclick = function() {
                const id = this.getAttribute('data-id');
                console.log('Adding product to cart:', id);
            };
        });

        document.querySelectorAll('.btn-action-v2.toggle-wishlist').forEach(btn => {
            btn.onclick = function() {
                const id = this.getAttribute('data-id');
                this.classList.toggle('active');
                console.log('Toggling wishlist for product:', id);
            };
        });
    }
};

document.addEventListener('DOMContentLoaded', () => ProductLoader.init());
