document.addEventListener('DOMContentLoaded', () => {
    // 1. Auth Simulation & Route Protection
    const currentRole = localStorage.getItem('userRole'); // 'admin', 'user', or null
    const currentPath = window.location.pathname;
    const filename = currentPath.split('/').pop() || 'index.html';

    // Route Protection Guards
    const protectedRoutes = ['dashboard.html', 'insights.html'];
    const adminRoutes = ['manage.html'];

    if (adminRoutes.includes(filename) && currentRole !== 'admin') {
        alert('Access Denied: Administrator privileges required.');
        window.location.href = 'index.html';
        return;
    }

    if (protectedRoutes.includes(filename) && !currentRole) {
        alert('Please log in to access this page.');
        window.location.href = 'login.html';
        return;
    }

    // 2. Navigation UI Updates based on Auth State
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu) {
        const navLinksList = Array.from(navMenu.querySelectorAll('li a.nav-link'));
        
        navLinksList.forEach(link => {
            const href = link.getAttribute('href');
            const li = link.parentElement;

            // Hide Manage Data for non-admins
            if (href === 'manage.html' && currentRole !== 'admin') {
                li.style.display = 'none';
            }

            // Hide Dashboard & Insights for non-logged in users
            if ((href === 'dashboard.html' || href === 'insights.html') && !currentRole) {
                li.style.display = 'none';
            }

            // Change Login to Logout if authenticated
            if (href === 'login.html' && currentRole) {
                link.innerHTML = '<i class="fa-solid fa-arrow-right-from-bracket"></i> Logout';
                link.setAttribute('href', '#');
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    localStorage.removeItem('userRole');
                    localStorage.removeItem('userEmail');
                    alert('You have been logged out.');
                    window.location.href = 'index.html';
                });
            }
        });
    }

    // 3. Active Nav State Logic
    const allNavLinks = document.querySelectorAll('.nav-link');
    allNavLinks.forEach(link => {
        const linkHref = link.getAttribute('href');
        if (linkHref === filename || (filename === '' && linkHref === 'index.html')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // 4. Handle Login Form Submission
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const usernameInput = document.getElementById('username').value;
            const passwordInput = document.getElementById('password').value;
            const roleElement = document.querySelector('input[name="role"]:checked');
            const roleInput = roleElement ? roleElement.value : '';
            
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email: usernameInput, password: passwordInput, role: roleInput })
                });

                const data = await response.json();

                if (data.success) {
                    localStorage.setItem('userRole', data.role);
                    localStorage.setItem('userEmail', usernameInput.toLowerCase().trim());
                    alert(`Logged in as ${data.name} (${data.role})`);
                    if (data.role === 'admin') {
                        window.location.href = 'manage.html';
                    } else {
                        window.location.href = 'dashboard.html';
                    }
                } else {
                    alert('Login failed: ' + data.message);
                }
            } catch (error) {
                console.error('Error during login:', error);
                alert('An error occurred during login. Please ensure the backend server is running.');
            }
        });
    }

    // 5. Data Fetching
    if (filename === 'manage.html' && currentRole === 'admin') {
        fetchSalesData();
    }
    if (filename === 'insights.html' || filename === 'dashboard.html') {
        fetchKpiData();
    }

    window.allSalesData = [];
    async function fetchSalesData() {
        try {
            const response = await fetch('/api/sales');
            const data = await response.json();
            const tbody = document.getElementById('salesData');
            
            if (tbody && Array.isArray(data)) {
                window.allSalesData = data;
                tbody.innerHTML = ''; // Clear loading
                data.forEach(item => {
                    const tr = document.createElement('tr');
                    // Map: Product ID -> id, Name -> product_name, Category -> category, Price -> sales_amount, Status -> quantity
                    const statusClass = item.quantity > 0 ? 'badge-active' : 'badge-inactive';
                    const statusText = item.quantity > 0 ? 'In Stock' : 'Out of Stock';
                    const price = parseFloat(item.sales_amount) || 0;
                    
                    tr.innerHTML = `
                        <td>PRD-${item.id}</td>
                        <td>${item.product_name || 'N/A'}</td>
                        <td>${item.category || 'N/A'}</td>
                        <td>₹${price.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        <td>${item.date || 'N/A'}</td>
                        <td>${item.region || 'N/A'}</td>
                        <td><span class="badge ${statusClass}">${statusText}</span></td>
                        <td>
                            <button class="action-btn btn-edit" onclick="openEditModal(${item.id})"><i class="fa-solid fa-pen"></i> Edit</button>
                            <button class="action-btn btn-delete" onclick="if(confirm('Are you sure you want to delete PRD-${item.id}?')) alert('Deleted!')"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        } catch (error) {
            console.error('Error fetching sales data:', error);
        }
    }

    async function fetchKpiData() {
        try {
            const response = await fetch('/api/kpi');
            const data = await response.json();
            
            if (data && !data.error) {
                const regionEl = document.getElementById('kpi-best-region');
                const categoryEl = document.getElementById('kpi-top-category');
                const growthEl = document.getElementById('kpi-growth');
                
                if (regionEl) regionEl.textContent = data.bestRegion;
                if (categoryEl) categoryEl.textContent = data.topProduct;
                if (growthEl) {
                    const growth = parseFloat(data.growth);
                    growthEl.textContent = growth > 0 ? '+' + growth.toFixed(1) + '%' : growth.toFixed(1) + '%';
                    growthEl.style.color = growth > 0 ? '#2ECC71' : '#E74C3C';
                }

                // Dashboard KPIs
                const dashTotalEl = document.getElementById('dash-kpi-total');
                const dashAvgEl = document.getElementById('dash-kpi-avg');
                const dashRegionEl = document.getElementById('dash-kpi-region');
                const dashProductEl = document.getElementById('dash-kpi-product');

                if (dashTotalEl) dashTotalEl.textContent = '₹' + parseFloat(data.totalSales).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                if (dashAvgEl) dashAvgEl.textContent = '₹' + parseFloat(data.averageSales).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                if (dashRegionEl) dashRegionEl.textContent = data.bestRegion;
                if (dashProductEl) dashProductEl.textContent = data.topProduct;
            }
        } catch (error) {
            console.error('Error fetching KPI data:', error);
        }
    }

    // Category Dropdown Logic
    window.toggleNewCategory = function() {
        const select = document.getElementById('categorySelect');
        const input = document.getElementById('newCategory');
        if (select.value === 'Other') {
            input.style.display = 'block';
            input.required = true;
        } else {
            input.style.display = 'none';
            input.required = false;
        }
    };

    window.toggleEditNewCategory = function() {
        const select = document.getElementById('editCategorySelect');
        const input = document.getElementById('editNewCategory');
        if (select.value === 'Other') {
            input.style.display = 'block';
            input.required = true;
        } else {
            input.style.display = 'none';
            input.required = false;
        }
    };

    window.toggleNewRegion = function() {
        const select = document.getElementById('regionSelect');
        const input = document.getElementById('newRegion');
        if (select.value === 'Other') {
            input.style.display = 'block';
            input.required = true;
        } else {
            input.style.display = 'none';
            input.required = false;
        }
    };

    window.toggleEditNewRegion = function() {
        const select = document.getElementById('editRegionSelect');
        const input = document.getElementById('editNewRegion');
        if (select.value === 'Other') {
            input.style.display = 'block';
            input.required = true;
        } else {
            input.style.display = 'none';
            input.required = false;
        }
    };

    // 6. Modal Logic (Add Product)
    const openModalBtn = document.getElementById('openModalBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const addProductModal = document.getElementById('addProductModal');
    const addProductForm = document.getElementById('addProductForm');

    if (openModalBtn && closeModalBtn && addProductModal) {
        openModalBtn.addEventListener('click', () => {
            addProductModal.classList.add('active');
        });

        closeModalBtn.addEventListener('click', () => {
            addProductModal.classList.remove('active');
        });

        // Close when clicking outside modal
        window.addEventListener('click', (e) => {
            if (e.target === addProductModal) {
                addProductModal.classList.remove('active');
            }
        });
    }

    if (addProductForm) {
        addProductForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const product_name = document.getElementById('productName').value;
            const categorySelect = document.getElementById('categorySelect').value;
            const newCategory = document.getElementById('newCategory').value;
            const category = categorySelect === 'Other' ? newCategory : categorySelect;
            const sales_amount = document.getElementById('price').value;
            const quantity = document.getElementById('quantity').value;
            const date = document.getElementById('date').value;
            
            const regionSelect = document.getElementById('regionSelect').value;
            const newRegion = document.getElementById('newRegion').value;
            const region = regionSelect === 'Other' ? newRegion : regionSelect;

            try {
                const response = await fetch('/api/sales', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        product_name: product_name,
                        category: category,
                        sales_amount: sales_amount,
                        quantity: quantity,
                        date: date,
                        region: region
                    })
                });

                const result = await response.json();
                if (response.ok && result.success) {
                    alert('Product added successfully!');
                    addProductModal.classList.remove('active');
                    addProductForm.reset();
                    fetchSalesData(); // Refresh table
                } else {
                    alert('Failed to add product: ' + (result.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Error adding product:', error);
                alert('An error occurred while adding the product.');
            }
        });
    }

    // 7. Edit Product Logic
    const editProductModal = document.getElementById('editProductModal');
    const closeEditModalBtn = document.getElementById('closeEditModalBtn');
    const editProductForm = document.getElementById('editProductForm');

    window.openEditModal = function(id) {
        const product = window.allSalesData.find(p => p.id === id);
        if (!product) return;

        document.getElementById('editProductId').value = product.id;
        document.getElementById('editProductName').value = product.product_name;
        document.getElementById('editPrice').value = product.sales_amount;
        document.getElementById('editQuantity').value = product.quantity;
        
        // Handle date formatting if necessary. Expects YYYY-MM-DD
        let formattedDate = '';
        if (product.date) {
            try {
                const d = new Date(product.date);
                if (!isNaN(d.getTime())) {
                    formattedDate = d.toISOString().split('T')[0];
                } else {
                    formattedDate = product.date; // fallback if already correct format
                }
            } catch(e) {}
        }
        document.getElementById('editDate').value = formattedDate;
        
        const regionSelect = document.getElementById('editRegionSelect');
        const regionInput = document.getElementById('editNewRegion');
        const knownRegions = ['West', 'North', 'East', 'Other', 'South', 'Central', 'North America'];
        
        if (knownRegions.includes(product.region)) {
            regionSelect.value = product.region;
            regionInput.style.display = 'none';
            regionInput.required = false;
        } else {
            regionSelect.value = 'Other';
            regionInput.value = product.region || '';
            regionInput.style.display = 'block';
            regionInput.required = true;
        }

        const select = document.getElementById('editCategorySelect');
        const input = document.getElementById('editNewCategory');
        const knownCategories = ['Electronics', 'Accessories', 'Misc'];
        
        if (knownCategories.includes(product.category)) {
            select.value = product.category;
            input.style.display = 'none';
            input.required = false;
        } else {
            select.value = 'Other';
            input.value = product.category || '';
            input.style.display = 'block';
            input.required = true;
        }

        editProductModal.classList.add('active');
    };

    if (closeEditModalBtn && editProductModal) {
        closeEditModalBtn.addEventListener('click', () => {
            editProductModal.classList.remove('active');
        });

        window.addEventListener('click', (e) => {
            if (e.target === editProductModal) {
                editProductModal.classList.remove('active');
            }
        });
    }

    if (editProductForm) {
        editProductForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('editProductId').value;
            const product_name = document.getElementById('editProductName').value;
            const categorySelect = document.getElementById('editCategorySelect').value;
            const newCategory = document.getElementById('editNewCategory').value;
            const category = categorySelect === 'Other' ? newCategory : categorySelect;
            const sales_amount = document.getElementById('editPrice').value;
            const quantity = document.getElementById('editQuantity').value;
            const date = document.getElementById('editDate').value;
            
            const rSelect = document.getElementById('editRegionSelect').value;
            const newR = document.getElementById('editNewRegion').value;
            const region = rSelect === 'Other' ? newR : rSelect;

            try {
                const response = await fetch('/api/sales/' + id, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        product_name: product_name,
                        category: category,
                        sales_amount: sales_amount,
                        quantity: quantity,
                        date: date,
                        region: region
                    })
                });

                const result = await response.json();
                if (response.ok && result.success) {
                    alert('Product updated successfully!');
                    editProductModal.classList.remove('active');
                    fetchSalesData(); // Refresh table
                } else {
                    alert('Failed to update product: ' + (result.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Error updating product:', error);
                alert('An error occurred while updating the product.');
            }
        });
    }

    // Optional: Add a simple animation to process steps if on overview page
    const processSteps = document.querySelectorAll('.process-step');
    if (processSteps.length > 0) {
        processSteps.forEach((step, index) => {
            step.style.opacity = '0';
            step.style.transform = 'translateY(20px)';
            step.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            
            setTimeout(() => {
                step.style.opacity = '1';
                step.style.transform = 'translateY(0)';
            }, 150 * index);
        });
    }

    // 8. Power BI Dashboard Embedding Logic
    if (filename === 'dashboard.html') {
        const embedModal = document.getElementById('embedModal');
        const openEmbedModalBtn = document.getElementById('openEmbedModalBtn');
        const closeEmbedModalBtn = document.getElementById('closeEmbedModalBtn');
        const embedForm = document.getElementById('embedForm');
        const powerBiUrlInput = document.getElementById('powerBiUrl');
        const clearEmbedBtn = document.getElementById('clearEmbedBtn');
        const dashboardContainer = document.querySelector('.dashboard-container');
        const currentUserDisplay = document.getElementById('currentUserDisplay');

        const DEFAULT_POWERBI_URL = 'https://app.powerbi.com/reportEmbed?reportId=558e1888-9a6f-4937-86ad-dbe56c3ac2d4&autoAuth=true&ctid=d04744cd-2784-4c96-a235-fa415e08dbea';
        const userEmail = localStorage.getItem('userEmail') || 'default';
        const userKey = `powerBiDashboardUrl_${userEmail}`;

        // Display current user email in modal
        if (currentUserDisplay) {
            currentUserDisplay.textContent = userEmail;
        }

        // Store original placeholder HTML to restore it when needed
        const defaultPlaceholderHTML = `
            <div class="placeholder-text">
                <i class="fa-solid fa-chart-line fa-4x" style="color: var(--secondary-color);"></i>
                <div>Power BI Dashboard Embedded Here</div>
                <small style="font-weight: normal; font-size: 1rem;">(Interactive iframe placeholder)</small>
            </div>
        `;

        // Load saved dashboard (user-specific key → legacy key → default Power BI URL)
        function loadDashboard() {
            const savedUrl = localStorage.getItem(userKey) || localStorage.getItem('powerBiDashboardUrl') || DEFAULT_POWERBI_URL;
            if (dashboardContainer) {
                dashboardContainer.innerHTML = `<iframe title="Sales Performance Dashboard" class="dashboard-iframe" src="${savedUrl}" frameborder="0" allowFullScreen="true"></iframe>`;
                if (powerBiUrlInput) powerBiUrlInput.value = savedUrl;
            }
        }

        loadDashboard();

        // Modal Controls
        if (openEmbedModalBtn && embedModal) {
            openEmbedModalBtn.addEventListener('click', () => {
                const savedUrl = localStorage.getItem(userKey) || localStorage.getItem('powerBiDashboardUrl') || DEFAULT_POWERBI_URL;
                if (powerBiUrlInput) powerBiUrlInput.value = savedUrl;
                embedModal.classList.add('active');
            });
        }

        if (closeEmbedModalBtn && embedModal) {
            closeEmbedModalBtn.addEventListener('click', () => {
                embedModal.classList.remove('active');
            });
        }

        // Close on clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === embedModal) {
                embedModal.classList.remove('active');
            }
        });

        // Form Submit
        if (embedForm) {
            embedForm.addEventListener('submit', (e) => {
                e.preventDefault();
                let urlValue = powerBiUrlInput.value.trim();
                
                if (!urlValue) {
                    alert('Please enter a valid URL or iframe code.');
                    return;
                }

                // If it looks like an iframe tag, extract the src attribute
                if (urlValue.startsWith('<iframe') || urlValue.includes('src=')) {
                    const srcMatch = urlValue.match(/src=["']([^"']+)["']/i);
                    if (srcMatch && srcMatch[1]) {
                        urlValue = srcMatch[1];
                    } else {
                        alert('Could not find a valid "src" attribute in the iframe code. Please check your input.');
                        return;
                    }
                }

                // Validate URL format roughly
                if (!urlValue.startsWith('http://') && !urlValue.startsWith('https://')) {
                    alert('Please enter a valid URL (starting with http:// or https://)');
                    return;
                }

                localStorage.setItem(userKey, urlValue);
                loadDashboard();
                embedModal.classList.remove('active');
                alert(`Power BI dashboard embed link updated successfully for ${userEmail}!`);
            });
        }

        // Clear/Reset
        if (clearEmbedBtn) {
            clearEmbedBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to reset to the default Power BI dashboard?')) {
                    localStorage.removeItem(userKey);
                    localStorage.removeItem('powerBiDashboardUrl'); // clear legacy fallback too
                    loadDashboard();
                    embedModal.classList.remove('active');
                    alert('Reset to default Power BI dashboard.');
                }
            });
        }
    }
});
