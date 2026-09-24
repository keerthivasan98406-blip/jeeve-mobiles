// Owner Portal - ஜிவி மொபைல்ஸ் — Jivi Mobiles
class OwnerPortalApp {
  constructor() {
    this.currentPage = "admin-login"
    this.isAdminLoggedIn = localStorage.getItem('manjula_admin_logged_in') === 'true'
    this.editingProductId = null
    this.previousPage = "admin-products"

    this.adminSearch = ""
    this.trackingFilter = "all"
    this.trackingSearch = ""
    
    // Log admin login state on app start
    if (this.isAdminLoggedIn) {
      console.log('✅ Admin login state restored from localStorage')
      this.currentPage = "admin"
    }
    
    // MongoDB API URL - Auto-detect local vs production
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseURL = isLocalhost ? 'http://localhost:3001' : 'https://jeeve-mobiles-api.onrender.com';
    this.API_URL = `${baseURL}/api`
    
    // Socket.IO connection for real-time updates with reconnection
    if (typeof io !== 'undefined') {
      this.socket = io(baseURL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10
      })
      this.setupSocketListeners()
    } else {
      console.warn('⚠️ Socket.IO not loaded, real-time updates disabled');
      this.socket = null;
    }
    
    this.products = [];
    this.trackingData = [];
    this.orders = [];
    this.salesRecords = [];
    this.salesSearch = "";
    this.serviceRecords = [];
    this.serviceSearch = "";
    this.displayStock = [];
    this.stockSearch = "";
    this.sparePartsStock = [];
    this.sparePartsSearch = "";
    this.fullStockModuleFilter = "all";
    this.fullStockCategoryFilter = "all";
    this.fullStockStatusFilter = "all";
    this.fullStockSearch = "";
    this.customCategories = JSON.parse(localStorage.getItem('manjula_custom_categories') || '[]');
    this.stockTotalValueUnlocked = false;
    this.spareTotalValueUnlocked = false;
    this.stockFilter = "all"; // 'all', 'full', 'low', 'out'
    this.distributors = [];
    this.distributorSearch = "";
    this.distributorStatusFilter = "all";
    this.selectedDistributorId = null;
    this.purchaseBills = [];
    this.purchaseBillSearch = "";
    this.purchaseBillMonthFilter = "all";
    this.purchaseBillYearFilter = "all";
    this.purchaseBillDistributorFilter = "all";
    this.purchaseEntryRows = [];
    this.activeBillData = null;
    this.purchaseSearch = "";
    this.purchaseDistributorFilter = "all";
    this.activeReportTab = "distributors";
    this.stockEntries = [];
    this.stockMovements = [];
    this.posCart = []; // POS Billing Cart items
    this.shopConfig = JSON.parse(localStorage.getItem('shop_config') || JSON.stringify({
      shopName: "ஜிவி மொபைல்ஸ் — Jivi Mobiles",
      ownerName: "Shop Owner",
      phone: "+91 84890 62593 / +91 96295 16788",
      email: "jivimobiles@gmail.com",
      address: "Vanthavasi, Tamil Nadu",
      tagline: "Laptop & Mobile Sales / Service"
    }));
    
    this.init()
  }

  // Socket.IO Real-time Listeners
  setupSocketListeners() {
    if (!this.socket) {
      console.warn('⚠️ No socket connection, skipping listeners');
      return;
    }
    
    this.socket.on('connect', () => {
      console.log('✅ Connected to server for real-time updates');
      console.log('Socket ID:', this.socket.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from server:', reason);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Reconnected to server after', attemptNumber, 'attempts');
      // Reload data after reconnection
      this.loadProductsFromStorage();
      this.loadTrackingFromStorage();
      this.loadOrdersFromStorage();
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error.message);
    });

    this.socket.on('product-added', (product) => {
      console.log('📦 [OWNER PORTAL] New product added via socket:', product);
      const exists = this.products.find(p => 
        String(p.id) === String(product.id) || 
        String(p._id) === String(product._id) ||
        String(p.id) === String(product._id) ||
        String(p._id) === String(product.id)
      );
      if (!exists) {
        this.products.push(product);
        localStorage.setItem('manjula_products', JSON.stringify(this.products));
        console.log('✅ [OWNER PORTAL] Product added to local array, total products:', this.products.length);
        if (this.currentPage === 'admin' || this.currentPage === 'admin-products') {
          console.log('🔄 [OWNER PORTAL] Re-rendering admin page');
          this.renderPage(this.currentPage);
        }
      }
    });

    this.socket.on('product-updated', (product) => {
      console.log('🔄 Product updated:', product);
      if (!product) return;
      const targetId = String(product.id || product._id || '');
      const index = this.products.findIndex(p => String(p.id || p._id || '') === targetId);
      if (index !== -1) {
        this.products[index] = { ...this.products[index], ...product, stock: Number(product.stock) };
      } else {
        this.products.push(product);
      }
      localStorage.setItem('manjula_products', JSON.stringify(this.products));
      this.renderPage(this.currentPage);
    });

    this.socket.on('product-deleted', (data) => {
      console.log('🗑️ Product deleted:', data.id);
      this.products = this.products.filter(p => p.id !== data.id && p._id !== data.id);
      localStorage.setItem('manjula_products', JSON.stringify(this.products));
      if (this.currentPage === 'admin' || this.currentPage === 'admin-products') {
        this.renderPage(this.currentPage);
      }
    });

    this.socket.on('tracking-added', (tracking) => {
      console.log('📍 New tracking added:', tracking);
      const exists = this.trackingData.find(t => t.qrId === tracking.qrId);
      if (!exists) {
        this.trackingData.push(tracking);
        if (this.currentPage === 'admin' || this.currentPage === 'admin-tracking') {
          this.renderPage(this.currentPage);
        }
      }
    });

    this.socket.on('tracking-updated', (tracking) => {
      console.log('🔄 Tracking updated:', tracking);
      const index = this.trackingData.findIndex(t => t.qrId === tracking.qrId);
      if (index !== -1) {
        this.trackingData[index] = tracking;
        if (this.currentPage === 'admin' || this.currentPage === 'admin-tracking') {
          this.renderPage(this.currentPage);
        }
      }
    });

    this.socket.on('tracking-deleted', (data) => {
      console.log('🗑️ Tracking deleted:', data.qrId);
      this.trackingData = this.trackingData.filter(t => t.qrId !== data.qrId);
      if (this.currentPage === 'admin' || this.currentPage === 'admin-tracking') {
        this.renderPage(this.currentPage);
      }
    });

    this.socket.on('order-added', (order) => {
      console.log('🛒 New order received:', order);
      if (!order) return;
      const orderIdStr = String(order.orderId || order.id || order._id || '');
      const exists = this.orders.find(o => {
        const oIdStr = String(o.orderId || o.id || o._id || '');
        return (orderIdStr && oIdStr === orderIdStr) || (o.orderId && order.orderId && String(o.orderId) === String(order.orderId));
      });
      if (!exists) {
        this.orders.unshift(order);
        if (this.currentPage === 'admin' || this.currentPage === 'admin-orders') {
          this.renderPage(this.currentPage);
        }
      }
    });

    this.socket.on('order-updated', (order) => {
      console.log('🔄 Order updated:', order);
      const index = this.orders.findIndex(o => o.orderId === order.orderId);
      if (index !== -1) {
        this.orders[index] = order;
        if (this.currentPage === 'admin' || this.currentPage === 'admin-orders') {
          this.renderPage(this.currentPage);
        }
      }
    });

    this.socket.on('order-deleted', (data) => {
      console.log('🗑️ Order deleted:', data.orderId);
      this.orders = this.orders.filter(o => o.orderId !== data.orderId);
      if (this.currentPage === 'admin' || this.currentPage === 'admin-orders') {
        this.renderPage(this.currentPage);
      }
    });

    this.socket.on('sale-added', (sale) => {
      console.log('🛍️ New sale record added via socket:', sale);
      if (!sale) return;
      const saleIdStr = String(sale.saleId || sale._id || '');
      const exists = this.salesRecords.find(s => String(s.saleId || s._id || '') === saleIdStr);
      if (!exists) {
        this.salesRecords.unshift(sale);
        if (this.currentPage === 'admin' || this.currentPage === 'admin-sales' || this.currentPage === 'admin-sales-monthly') {
          this.renderPage(this.currentPage);
        }
      }
    });

    this.socket.on('sale-updated', (sale) => {
      console.log('🔄 Sale record updated via socket:', sale);
      if (!sale) return;
      const index = this.salesRecords.findIndex(s => String(s.saleId || s._id || '') === String(sale.saleId || sale._id || ''));
      if (index !== -1) {
        this.salesRecords[index] = sale;
        if (this.currentPage === 'admin' || this.currentPage === 'admin-sales' || this.currentPage === 'admin-sales-monthly') {
          this.renderPage(this.currentPage);
        }
      }
    });

    this.socket.on('sale-deleted', (data) => {
      console.log('🗑️ Sale record deleted via socket:', data.saleId);
      this.salesRecords = this.salesRecords.filter(s => String(s.saleId || s._id || '') !== String(data.saleId));
      if (this.currentPage === 'admin' || this.currentPage === 'admin-sales' || this.currentPage === 'admin-sales-monthly') {
        this.renderPage(this.currentPage);
      }
    });
  }

  async init() {
    try {
      console.log('🚀 Initializing ஜிவி மொபைல்ஸ் — Jivi Mobiles App...');
      
      // Setup event listeners first
      this.setupEventListeners();
      
      // Render login page immediately (don't wait for server)
      await this.renderPage(this.currentPage);
      
      // Load data in background without blocking UI
      this.loadDataInBackground();

      // Check for ?scan= URL parameter (from barcode scan on any device)
      const urlParams = new URLSearchParams(window.location.search);
      const scanId = urlParams.get('scan');
      if (scanId) {
        // Remove the param from URL without reload
        window.history.replaceState({}, '', window.location.pathname);
        // Wait for data to load then show the tracking record
        const tryLookup = async (attempts = 0) => {
          const t = this.trackingData.find(tr => tr.qrId === scanId);
          if (t) {
            // Navigate to tracking page and show the detail modal
            this.currentPage = 'admin-tracking';
            await this.renderPage('admin-tracking');
            setTimeout(() => this.showTrackingLookupResult(t), 300);
          } else if (attempts < 8) {
            setTimeout(() => tryLookup(attempts + 1), 600);
          }
        };
        setTimeout(() => tryLookup(), 800);
      }
      
    } catch (error) {
      console.error('❌ Error during initialization:', error);
    }
  }

  async loadDataInBackground() {
    try {
      console.log('📡 Loading data in background...');
      
      // Try to load data, but don't block the UI
      await Promise.all([
        this.loadProductsFromStorage().catch(err => {
          console.log('⚠️ Products load failed:', err.message);
          this.products = [];
        }),
        this.loadTrackingFromStorage().catch(err => {
          console.log('⚠️ Tracking load failed:', err.message);
          this.trackingData = [];
        }),
        this.loadOrdersFromStorage().catch(err => {
          console.log('⚠️ Orders load failed:', err.message);
          this.orders = [];
        }),
        this.loadSalesFromStorage().catch(err => {
          console.log('⚠️ Sales load failed:', err.message);
          this.salesRecords = [];
        }),
        this.loadServicesFromStorage().catch(err => {
          console.log('⚠️ Services load failed:', err.message);
          this.serviceRecords = [];
        }),
        this.loadDisplayStockFromStorage().catch(err => {
          console.log('⚠️ Display stock load failed:', err.message);
          this.displayStock = [];
        }),
        this.loadSparePartsFromStorage().catch(err => {
          console.log('⚠️ Spare parts load failed:', err.message);
          this.sparePartsStock = [];
        }),

        this.loadDistributorsFromStorage().catch(err => {
          console.log('⚠️ Distributors load failed:', err.message);
          this.distributors = [];
        }),
        this.loadPurchaseBillsFromStorage().catch(err => {
          console.log('⚠️ Purchase bills load failed:', err.message);
          this.purchaseBills = [];
        }),
        this.loadStockEntriesFromStorage().catch(err => {
          console.log('⚠️ Stock entries load failed:', err.message);
          this.stockEntries = [];
        }),
        this.loadStockMovementsFromStorage().catch(err => {
          console.log('⚠️ Stock movements load failed:', err.message);
          this.stockMovements = [];
        })
      ]);
      
      console.log('✅ Background data load complete');
      
      // Refresh the page if user is logged in to show loaded data
      if (this.isAdminLoggedIn && this.currentPage !== 'admin-login') {
        await this.renderPage(this.currentPage);
      }
    } catch (error) {
      console.error('❌ Background data load error:', error);
    }
  }

  async checkServerStatus() {
    try {
      const response = await fetch(`${this.API_URL}/health`, { 
        method: 'GET',
        timeout: 5000 
      });
      
      if (response.ok) {
        const health = await response.json();
        console.log('✅ Server is awake:', health.uptime, 'seconds uptime');
      }
    } catch (error) {
      console.log('⏰ Server might be waking up from sleep, but continuing...');
      // Don't block the UI - just log the issue
    }
  }

  showWakeUpMessage() {
    const app = document.getElementById("app");
    if (app) {
      app.innerHTML = `
        <div class="loading-screen">
          <div class="loading-container">
            <div class="mobile-icon-wrapper">
              <div class="mobile-phone">
                <div class="phone-screen">
                  <div class="loading-bars">
                    <div class="bar"></div>
                    <div class="bar"></div>
                    <div class="bar"></div>
                    <div class="bar"></div>
                  </div>
                </div>
                <div class="phone-button"></div>
              </div>
            </div>
            
            <div class="loading-text">
              <h2>Waking Up Server</h2>
              <p class="loading-subtitle">Please wait while we start the server...</p>
              <div class="loading-progress">
                <div class="progress-bar"></div>
              </div>
              <p class="loading-status">This may take 30-60 seconds on first visit</p>
              <p class="loading-time">Thank you for your patience! 🙏</p>
            </div>
          </div>
        </div>
      `;
    }
  }

  async loadDataWithRetry() {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        await Promise.all([
          this.loadProductsFromStorage(),
          this.loadTrackingFromStorage(),
          this.loadOrdersFromStorage()
        ]);
        return; // Success, exit retry loop
      } catch (error) {
        retryCount++;
        console.log(`⚠️ Load attempt ${retryCount} failed:`, error.message);
        
        if (retryCount < maxRetries) {
          console.log(`🔄 Retrying in ${retryCount * 2} seconds...`);
          await new Promise(resolve => setTimeout(resolve, retryCount * 2000));
        } else {
          console.error('❌ All retry attempts failed');
          throw error;
        }
      }
    }
  }

  showLoadingScreen() {
    const app = document.getElementById("app");
    if (app) {
      app.innerHTML = `
        <div class="loading-screen">
          <div class="loading-container">
            <div class="mobile-icon-wrapper">
              <div class="mobile-phone">
                <div class="phone-screen">
                  <div class="loading-bars">
                    <div class="bar"></div>
                    <div class="bar"></div>
                    <div class="bar"></div>
                    <div class="bar"></div>
                  </div>
                </div>
                <div class="phone-button"></div>
              </div>
            </div>
            
            <div class="loading-text">
              <h2>Owner Portal</h2>
              <p class="loading-subtitle">ஜிவி மொபைல்ஸ் — Jivi Mobiles Management</p>
              <div class="loading-progress">
                <div class="progress-bar"></div>
              </div>
              <p class="loading-status">Loading admin data...</p>
            </div>
          </div>
        </div>
      `;
    }
  }

  setupEventListeners() {
    const app = document.getElementById("app")
    
    if (!app) {
      console.error('❌ App container not found!');
      return;
    }
    
    // Event delegation for all click events
    app.addEventListener("click", async (e) => {
      // Navigation and page routing
      const pageElement = e.target.closest('[data-page]');
      if (pageElement && pageElement.dataset.page) {
        e.preventDefault()
        console.log('📄 Navigating to page:', pageElement.dataset.page);
        await this.renderPage(pageElement.dataset.page)
      }
      
      // Filter buttons
      const filterElement = e.target.closest('[data-filter]');
      if (filterElement && filterElement.dataset.filter) {
        e.preventDefault();
        this.filterTracking(filterElement.dataset.filter);
      }


      
      // Admin actions
      const actionElement = e.target.closest('[data-action]');
      if (actionElement && actionElement.dataset.action === "admin-login") {
        this.handleAdminLogin()
      }
      if (actionElement && actionElement.dataset.action === "admin-logout") {
        this.handleAdminLogout()
      }
      if (actionElement && actionElement.dataset.action === "add-product-form") {
        this.previousPage = this.currentPage
        this.renderPage("admin-add-product")
      }
      if (actionElement && actionElement.dataset.action === "edit-product") {
        const productId = actionElement.dataset.productId
        this.editingProductId = productId
        this.previousPage = this.currentPage
        this.renderPage("admin-edit-product")
      }
      if (actionElement && actionElement.dataset.action === "delete-product") {
        const productId = actionElement.dataset.productId
        this.deleteProduct(productId)
      }
      if (actionElement && actionElement.dataset.action === "save-product") {
        this.saveProduct()
      }
      
      // Tracking actions
      if (actionElement && actionElement.dataset.action === "save-new-tracking") {
        this.saveNewTracking()
      }
      if (actionElement && actionElement.dataset.action === "toggle-tracking-form") {
        this.toggleTrackingForm()
      }
      if (actionElement && actionElement.dataset.action === "edit-tracking") {
        const qrId = actionElement.dataset.qrId
        this.editTracking(qrId)
      }
      if (actionElement && actionElement.dataset.action === "delete-tracking") {
        const qrId = actionElement.dataset.qrId
        this.deleteTracking(qrId)
      }
    })

    // Handle input events for search
    app.addEventListener('input', (e) => {
      if (e.target.id === 'trackingSearchInput') {
        // Just update the search value, debouncing will handle the rest
        this.handleTrackingSearch(e.target.value);
      }
      if (e.target.id === 'adminSearch') {
        this.adminSearch = e.target.value;
      }

      if (e.target.id === 'newTrackingContact') {
        this.showContactSuggestions(e.target, 'newTrackingCustomer', 'newTrackingAddress');
        this.handleContactAutofill(e.target.value, 'newTrackingCustomer', 'newTrackingAddress');
      }
      if (e.target.id === 'et_contact') {
        this.showContactSuggestions(e.target, 'et_customerName', 'et_address');
        this.handleContactAutofill(e.target.value, 'et_customerName', 'et_address');
      }
    })

    // Close suggestions dropdown on focus loss
    app.addEventListener('focusout', (e) => {
      if (e.target.id === 'newTrackingContact' || e.target.id === 'et_contact') {
        setTimeout(() => {
          const dropdown = document.getElementById('contactSuggestionsDropdown');
          if (dropdown) dropdown.style.display = 'none';
        }, 200);
      }
    })

    // Handle Enter key in search inputs
    app.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        // Prevent Enter from navigating away on any search input
        if (e.target.id === 'adminSearch' || 
            e.target.id === 'trackingSearchInput' ||
            e.target.classList.contains('input')) {
          e.preventDefault();
        }
      }
    })

    // Global barcode scanner listener
    // When scanner fires on tracking page with nothing focused, route to globalScanInput
    this._scannerBuffer = '';
    this._scannerLastKey = 0;
    document.addEventListener('keydown', (e) => {
      if (this.currentPage !== 'admin-tracking') return;

      const activeId = document.activeElement?.id;
      const tag = document.activeElement?.tagName;
      const inInput = (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT');

      // If already in globalScanInput, let the input's own onkeydown handle it
      if (activeId === 'globalScanInput') return;

      // If in any other input, don't interfere
      if (inInput) return;

      // Nothing focused — capture scanner chars and route to globalScanInput
      const now = Date.now();
      const gap = now - this._scannerLastKey;
      this._scannerLastKey = now;

      if (e.key === 'Enter') {
        // Fire lookup with whatever is in the scan input
        const scanInput = document.getElementById('globalScanInput');
        const code = (scanInput?.value || this._scannerBuffer).trim();
        this._scannerBuffer = '';
        if (scanInput) scanInput.value = '';
        if (code.length >= 3) {
          this.lookupBarcode(code);
        }
      } else if (e.key.length === 1) {
        if (gap > 1200) this._scannerBuffer = ''; // generous reset for slow scanner guns
        this._scannerBuffer += e.key;

        // Route to scan input and focus it so user can see what's being scanned
        const scanInput = document.getElementById('globalScanInput');
        if (scanInput) {
          scanInput.value = this._scannerBuffer;
          scanInput.focus();
        }
      }
    });
  }

  async handleAdminLogin() {
    const phone    = document.getElementById("adminPhone")?.value || ""
    const password = document.getElementById("adminPassword")?.value || ""

    if (!phone || !password) {
      alert("Please enter both Phone Number and Password.");
      return;
    }

    try {
      const response = await fetch(`${this.API_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        this.isAdminLoggedIn = true;
        localStorage.setItem('manjula_admin_logged_in', 'true');
        console.log('✅ Admin logged in successfully');
        await this.renderPage("admin");
      } else {
        alert(result.message || "Invalid phone number or password. Please try again.");
      }
    } catch (error) {
      console.error('❌ Login request failed:', error);
      alert("Login failed. Please check your connection and try again.");
    }
  }

  async handleAdminLogout() {
    this.isAdminLoggedIn = false
    localStorage.removeItem('manjula_admin_logged_in')
    console.log('✅ Admin logged out - state removed from localStorage')
    await this.renderPage("admin-login")
  }

  // Product Management Methods - Database ONLY
  async loadProductsFromStorage() {
    try {
      console.log('📡 [OWNER PORTAL] Loading products from database...');
      
      const response = await fetch(`${this.API_URL}/products`);
      if (response.ok) {
        this.products = await response.json();
        console.log('✅ [OWNER PORTAL] Loaded products from database:', this.products.length);
      } else {
        console.log('⚠️ [OWNER PORTAL] Failed to load from database');
        this.products = [];
      }
    } catch (error) {
      console.error('❌ [OWNER PORTAL] Error loading products:', error);
      this.products = [];
    }
  }

  // Tracking Management Methods
  async loadTrackingFromStorage() {
    try {
      const response = await fetch(`${this.API_URL}/tracking`);
      if (response.ok) {
        this.trackingData = await response.json();
        console.log('✅ Loaded tracking from database:', this.trackingData.length);
      } else {
        this.trackingData = [];
      }
    } catch (error) {
      console.error('❌ Error loading tracking:', error);
      this.trackingData = [];
    }
  }

  // Orders Management Methods
  async loadOrdersFromStorage() {
    try {
      console.log('📡 [OWNER] Loading orders from database...');
      const response = await fetch(`${this.API_URL}/orders`);
      if (response.ok) {
        const rawOrders = await response.json();
        // Deduplicate orders by orderId / _id / id
        const uniqueOrders = [];
        const seenIds = new Set();
        for (const order of rawOrders) {
          const key = String(order.orderId || order._id || order.id || '');
          if (key && !seenIds.has(key)) {
            seenIds.add(key);
            uniqueOrders.push(order);
          }
        }
        this.orders = uniqueOrders;
        console.log('✅ [OWNER] Loaded unique orders from database:', this.orders.length);
        this.orders.forEach((order, index) => {
          console.log(`📋 [OWNER] Order ${index + 1}:`, {
            orderId: order.orderId,
            hasScreenshot: !!order.paymentScreenshot,
            screenshotDataLength: order.paymentScreenshot?.data?.length,
            paymentMethod: order.paymentMethod
          });
        });
      } else {
        console.log('⚠️ [OWNER] Failed to load orders from database');
        this.orders = [];
      }
    } catch (error) {
      console.error('❌ [OWNER] Error loading orders:', error);
      this.orders = [];
    }
  }

  async loadSalesFromStorage() {
    try {
      const response = await fetch(`${this.API_URL}/sales`);
      if (response.ok) {
        this.salesRecords = await response.json();
        console.log('✅ Loaded sales from database:', this.salesRecords.length);
      } else {
        this.salesRecords = [];
      }
    } catch (error) {
      console.error('❌ Error loading sales:', error);
      this.salesRecords = [];
    }
  }

  async loadServicesFromStorage() {
    try {
      const response = await fetch(`${this.API_URL}/services`);
      if (response.ok) {
        this.serviceRecords = await response.json();
        console.log('✅ Loaded services from database:', this.serviceRecords.length);
      } else {
        this.serviceRecords = [];
      }
    } catch (error) {
      console.error('❌ Error loading services:', error);
      this.serviceRecords = [];
    }
  }

  async loadDisplayStockFromStorage() {
    try {
      const response = await fetch(`${this.API_URL}/display-stock`);
      if (response.ok) {
        this.displayStock = await response.json();
        this.displayStock.sort((a, b) => {
          const nameA = (a.displayName || '').trim().toLowerCase();
          const nameB = (b.displayName || '').trim().toLowerCase();
          return nameA.localeCompare(nameB);
        });
        console.log('✅ Loaded display stock from database:', this.displayStock.length);
      } else {
        this.displayStock = [];
      }
    } catch (error) {
      console.error('❌ Error loading display stock:', error);
      this.displayStock = [];
    }
  }

  async loadSparePartsFromStorage() {
    try {
      const response = await fetch(`${this.API_URL}/spare-parts`);
      if (response.ok) {
        this.sparePartsStock = await response.json();
        console.log('✅ Loaded spare parts from database:', this.sparePartsStock.length);
      } else {
        this.sparePartsStock = [];
      }
    } catch (error) {
      console.error('❌ Error loading spare parts:', error);
      this.sparePartsStock = [];
    }
  }



  async loadStockEntriesFromStorage() {
    try {
      const response = await fetch(`${this.API_URL}/stock-entries`);
      if (response.ok) {
        this.stockEntries = await response.json();
        console.log('✅ Loaded stock entries from database:', this.stockEntries.length);
      } else {
        this.stockEntries = [];
      }
    } catch (error) {
      console.error('❌ Error loading stock entries:', error);
      this.stockEntries = [];
    }
  }

  async loadStockMovementsFromStorage() {
    try {
      const response = await fetch(`${this.API_URL}/stock-movements`);
      if (response.ok) {
        this.stockMovements = await response.json();
        console.log('✅ Loaded stock movements from database:', this.stockMovements.length);
      } else {
        this.stockMovements = [];
      }
    } catch (error) {
      console.error('❌ Error loading stock movements:', error);
      this.stockMovements = [];
    }
  }

  async loadDistributorsFromStorage() {
    try {
      const response = await fetch(`${this.API_URL}/distributors`);
      if (response.ok) {
        this.distributors = await response.json();
        console.log('✅ Loaded distributors from database:', this.distributors.length);
      } else {
        this.distributors = [];
      }
    } catch (error) {
      console.error('❌ Error loading distributors:', error);
      this.distributors = [];
    }
  }

  openDistributorModal(distributor = null) {
    const modalId = 'distributorModal';
    document.getElementById(modalId)?.remove();

    const isEdit = !!distributor;
    const html = `
      <div id="${modalId}" style="position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 16px;">
        <div style="background: #1e293b; color: #fff; border: 1px solid #334155; border-radius: 14px; max-width: 500px; width: 100%; padding: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid #334155; padding-bottom: 10px;">
            <h3 style="font-size: 18px; font-weight: 800; color: #38bdf8; margin: 0; display: flex; align-items: center; gap: 8px;">
              🤝 ${isEdit ? 'Edit Distributor' : 'Add New Distributor / Supplier'}
            </h3>
            <button onclick="document.getElementById('${modalId}').remove()" style="background: none; border: none; color: #94a3b8; font-size: 20px; cursor: pointer;">✕</button>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px;">
              <div>
                <label style="font-size: 12px; font-weight: 700; color: #cbd5e1; display: block; margin-bottom: 4px;">Distributor Name *</label>
                <input type="text" id="distName" value="${distributor?.name || ''}" placeholder="e.g. Ramesh Mobiles & Spares" style="width: 100%; padding: 10px 12px; background: #0f172a; border: 1px solid #475569; border-radius: 6px; color: #fff; font-weight: 600;">
              </div>
              <div>
                <label style="font-size: 12px; font-weight: 700; color: #cbd5e1; display: block; margin-bottom: 4px;">Short Code</label>
                <input type="text" id="distCode" value="${distributor?.code || ''}" placeholder="e.g. DIST-A" style="width: 100%; padding: 10px 12px; background: #0f172a; border: 1px solid #475569; border-radius: 6px; color: #fff; text-transform: uppercase;">
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div>
                <label style="font-size: 12px; font-weight: 700; color: #cbd5e1; display: block; margin-bottom: 4px;">Contact Person</label>
                <input type="text" id="distContact" value="${distributor?.contactPerson || ''}" placeholder="Manager Name" style="width: 100%; padding: 10px 12px; background: #0f172a; border: 1px solid #475569; border-radius: 6px; color: #fff;">
              </div>
              <div>
                <label style="font-size: 12px; font-weight: 700; color: #cbd5e1; display: block; margin-bottom: 4px;">Phone Number *</label>
                <input type="tel" id="distPhone" value="${distributor?.phone || ''}" placeholder="9876543210" style="width: 100%; padding: 10px 12px; background: #0f172a; border: 1px solid #475569; border-radius: 6px; color: #fff;">
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div>
                <label style="font-size: 12px; font-weight: 700; color: #cbd5e1; display: block; margin-bottom: 4px;">Email Address</label>
                <input type="email" id="distEmail" value="${distributor?.email || ''}" placeholder="distributor@mail.com" style="width: 100%; padding: 10px 12px; background: #0f172a; border: 1px solid #475569; border-radius: 6px; color: #fff;">
              </div>
              <div>
                <label style="font-size: 12px; font-weight: 700; color: #cbd5e1; display: block; margin-bottom: 4px;">GST / Tax ID</label>
                <input type="text" id="distGst" value="${distributor?.gstNumber || ''}" placeholder="33AAAAA0000A1Z5" style="width: 100%; padding: 10px 12px; background: #0f172a; border: 1px solid #475569; border-radius: 6px; color: #fff;">
              </div>
            </div>

            <div>
              <label style="font-size: 12px; font-weight: 700; color: #cbd5e1; display: block; margin-bottom: 4px;">Address / Market City</label>
              <textarea id="distAddress" rows="2" placeholder="Street, City, State" style="width: 100%; padding: 10px 12px; background: #0f172a; border: 1px solid #475569; border-radius: 6px; color: #fff;">${distributor?.address || ''}</textarea>
            </div>

            <div>
              <label style="font-size: 12px; font-weight: 700; color: #cbd5e1; display: block; margin-bottom: 4px;">Status</label>
              <select id="distStatus" style="width: 100%; padding: 10px 12px; background: #0f172a; border: 1px solid #475569; border-radius: 6px; color: #fff; font-weight: 700;">
                <option value="Active" ${distributor?.status !== 'Inactive' ? 'selected' : ''}>Active</option>
                <option value="Inactive" ${distributor?.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
              </select>
            </div>
          </div>

          <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
            <button onclick="document.getElementById('${modalId}').remove()" style="padding: 10px 16px; background: #334155; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Cancel</button>
            <button id="saveDistributorBtn" style="padding: 10px 20px; background: #059669; color: #fff; border: none; border-radius: 6px; font-weight: 800; cursor: pointer;">
              💾 Save Distributor
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);

    document.getElementById('saveDistributorBtn').onclick = async () => {
      const name = document.getElementById('distName')?.value?.trim();
      const code = document.getElementById('distCode')?.value?.trim();
      const contactPerson = document.getElementById('distContact')?.value?.trim();
      const phone = document.getElementById('distPhone')?.value?.trim();
      const email = document.getElementById('distEmail')?.value?.trim();
      const gstNumber = document.getElementById('distGst')?.value?.trim();
      const address = document.getElementById('distAddress')?.value?.trim();
      const status = document.getElementById('distStatus')?.value;

      if (!name || !phone) {
        alert('Please enter Distributor Name and Phone Number.');
        return;
      }

      const payload = { name, code, contactPerson, phone, email, gstNumber, address, status };
      const url = isEdit ? `${this.API_URL}/distributors/${distributor.distributorId}` : `${this.API_URL}/distributors`;
      const method = isEdit ? 'PUT' : 'POST';

      try {
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          alert(`✅ Distributor "${name}" saved successfully!`);
          document.getElementById(modalId)?.remove();
          await this.loadDistributorsFromStorage();
          this.renderPage(this.currentPage);
        } else {
          alert('❌ Failed to save distributor.');
        }
      } catch (err) {
        console.error('❌ Distributor save error:', err);
        alert('❌ Error saving distributor.');
      }
    };
  }

  async toggleDistributorStatus(distributorId, currentStatus) {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    try {
      const res = await fetch(`${this.API_URL}/distributors/${distributorId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        await this.loadDistributorsFromStorage();
        this.renderPage(this.currentPage);
      }
    } catch (err) {
      console.error('❌ Error toggling distributor status:', err);
    }
  }

  async deleteDistributor(distributorId, distributorName) {
    if (!confirm(`Are you sure you want to delete distributor "${distributorName}"?\n\nThis action cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`${this.API_URL}/distributors/${distributorId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        alert(`✅ Distributor "${distributorName}" deleted successfully!`);
        await this.loadDistributorsFromStorage();
        this.renderPage('admin-distributors');
      } else {
        const err = await res.json();
        alert(`❌ Failed to delete distributor: ${err.error || 'Server error'}`);
      }
    } catch (err) {
      console.error('❌ Error deleting distributor:', err);
      alert('❌ Error deleting distributor. Please check your connection.');
    }
  }

  openPurchaseEntryModal(preselectProductId = '', distributorId = '') {
    this.openAddPurchaseModal(distributorId, preselectProductId);
  }

  addPurchaseProductRow() {
    const listContainer = document.getElementById('purchaseRowsList');
    if (!listContainer) return;
    const rowIdx = listContainer.children.length;
    const productsList = (this.products || []).map(p => `<option value="${p.id || p._id}">${p.name} (${p.category}) - Available: ${p.stock}</option>`).join('');

    const rowHtml = `
      <div class="purchase-product-row" style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr 30px; gap: 8px; align-items: center; background: #1e293b; padding: 10px; border-radius: 8px; border: 1px solid #334155;">
        <div>
          <label style="font-size: 10px; color: #94a3b8; font-weight: 700; display: block; margin-bottom: 2px;">Item #${rowIdx + 1}</label>
          <select class="row_product_id" onchange="app.calcPurchaseMultiTotal()" style="width: 100%; padding: 8px; background: #0f172a; border: 1px solid #475569; border-radius: 6px; color: #fff; font-weight: 700; font-size: 12px;">
            <option value="">-- Select Product --</option>
            ${productsList}
          </select>
        </div>
        <div>
          <label style="font-size: 10px; color: #94a3b8; font-weight: 700; display: block; margin-bottom: 2px;">Distributor Cost (₹)</label>
          <input type="number" class="row_cost_price" placeholder="100" oninput="app.calcPurchaseMultiTotal()" style="width: 100%; padding: 8px; background: #0f172a; border: 1px solid #475569; border-radius: 6px; color: #fb7185; font-weight: 800; font-size: 12px;">
        </div>
        <div>
          <label style="font-size: 10px; color: #94a3b8; font-weight: 700; display: block; margin-bottom: 2px;">Customer Price (₹)</label>
          <input type="number" class="row_selling_price" placeholder="150" style="width: 100%; padding: 8px; background: #0f172a; border: 1px solid #475569; border-radius: 6px; color: #38bdf8; font-weight: 800; font-size: 12px;">
        </div>
        <div>
          <label style="font-size: 10px; color: #94a3b8; font-weight: 700; display: block; margin-bottom: 2px;">Quantity</label>
          <input type="number" class="row_qty" min="1" value="1" oninput="app.calcPurchaseMultiTotal()" style="width: 100%; padding: 8px; background: #0f172a; border: 1px solid #475569; border-radius: 6px; color: #fff; font-weight: 800; font-size: 12px;">
        </div>
        <div>
          <label style="font-size: 10px; color: #94a3b8; font-weight: 700; display: block; margin-bottom: 2px;">Line Total (₹)</label>
          <input type="text" class="row_line_total" readonly value="₹0" style="width: 100%; padding: 8px; background: #020617; border: 1px solid #334155; border-radius: 6px; color: #34d399; font-weight: 900; text-align: right; font-size: 12px;">
        </div>
        <div style="text-align: center; margin-top: 14px;">
          <button type="button" onclick="this.closest('.purchase-product-row').remove(); app.calcPurchaseMultiTotal();" style="background: #dc2626; color: #fff; border: none; border-radius: 4px; padding: 6px; cursor: pointer; font-weight: 800;">✕</button>
        </div>
      </div>
    `;
    listContainer.insertAdjacentHTML('beforeend', rowHtml);
  }

  calcPurchaseMultiTotal() {
    const rows = document.querySelectorAll('.purchase-product-row');
    let grandTotal = 0;
    rows.forEach(r => {
      const cost = Number(r.querySelector('.row_cost_price')?.value) || 0;
      const qty = Number(r.querySelector('.row_qty')?.value) || 0;
      const lineTotal = cost * qty;
      const lineInput = r.querySelector('.row_line_total');
      if (lineInput) lineInput.value = `₹${lineTotal.toLocaleString('en-IN')}`;
      grandTotal += lineTotal;
    });

    const singleCost = Number(document.getElementById('purCostPrice')?.value) || 0;
    const singleQty = Number(document.getElementById('purQty')?.value) || 0;
    if (rows.length === 0) {
      grandTotal = singleCost * singleQty;
    }

    const totalElem = document.getElementById('purTotalAmount');
    if (totalElem) totalElem.value = `₹${grandTotal.toLocaleString('en-IN')}`;
  }

  checkPurProductCategory() {
    const pId = document.getElementById('purProductId')?.value;
    const product = (this.products || []).find(p => String(p.id || p._id) === String(pId));
    const modeSelect = document.getElementById('purTrackingMode');
    if (product && modeSelect) {
      const cat = (product.category || '').toLowerCase();
      if (cat.includes('smartphone') || cat.includes('mobile') || cat.includes('laptop') || cat.includes('tablet')) {
        modeSelect.value = 'unit';
      } else {
        modeSelect.value = 'bulk';
      }
      this.generateUnitFieldsIfNeeded();
    }
  }

  generateUnitFieldsIfNeeded() {
    const mode = document.getElementById('purTrackingMode')?.value;
    const container = document.getElementById('unitFieldsContainer');
    const rowsList = document.getElementById('unitRowsList');
    const qty = Math.min(50, Math.max(1, Number(document.getElementById('purQty')?.value || 1)));

    if (mode === 'unit') {
      if (container) container.style.display = 'block';
      if (rowsList) {
        let html = '';
        for (let i = 1; i <= qty; i++) {
          html += `
            <div style="display: grid; grid-template-columns: 0.4fr 1.2fr 1fr 1fr; gap: 8px; align-items: center; background: #1e293b; padding: 6px 10px; border-radius: 6px; border: 1px solid #334155;">
              <span style="font-size: 11px; font-weight: 800; color: #94a3b8;">#${i}</span>
              <input type="text" class="unit_barcode" placeholder="Barcode ID (e.g. REDMI-A-${String(i).padStart(4, '0')})" style="padding: 6px 8px; background: #0f172a; border: 1px solid #475569; border-radius: 4px; color: #38bdf8; font-size: 11px; font-weight: 700;">
              <input type="text" class="unit_imei1" placeholder="IMEI 1 / Serial" style="padding: 6px 8px; background: #0f172a; border: 1px solid #475569; border-radius: 4px; color: #fff; font-size: 11px;">
              <input type="text" class="unit_imei2" placeholder="IMEI 2 (Optional)" style="padding: 6px 8px; background: #0f172a; border: 1px solid #475569; border-radius: 4px; color: #fff; font-size: 11px;">
            </div>
          `;
        }
        rowsList.innerHTML = html;
        this.autoFillUnitBarcodes();
      }
    } else {
      if (container) container.style.display = 'none';
    }
  }

  autoFillUnitBarcodes() {
    const pId = document.getElementById('purProductId')?.value;
    const distId = document.getElementById('purDistributorId')?.value;
    const product = (this.products || []).find(p => String(p.id || p._id) === String(pId));
    const dist = (this.distributors || []).find(d => d.distributorId === distId);

    const pCode = (product?.name || 'PROD').replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase();
    const dCode = (dist?.code || dist?.name || 'A').replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();

    const barcodeInputs = document.querySelectorAll('.unit_barcode');
    barcodeInputs.forEach((input, idx) => {
      if (!input.value || input.value.startsWith(pCode) || input.value.includes('-')) {
        input.value = `${pCode}-${dCode}-${String(idx + 1).padStart(4, '0')}`;
      }
    });
  }

  calcPurchaseTotal() {
    const qty = Number(document.getElementById('purQty')?.value || 0);
    const price = Number(document.getElementById('purCostPrice')?.value || 0);
    const totalEl = document.getElementById('purTotalAmount');
    if (totalEl) {
      totalEl.value = `₹${(qty * price).toLocaleString('en-IN')}`;
    }
  }

  async savePurchaseEntry() {
    const productId = document.getElementById('purProductId')?.value;
    const distributorId = document.getElementById('purDistributorId')?.value;
    const quantity = Number(document.getElementById('purQty')?.value || 0);
    const purchasePrice = Number(document.getElementById('purCostPrice')?.value || 0);
    const invoiceNumber = document.getElementById('purInvoiceNumber')?.value?.trim();
    const purchaseDate = document.getElementById('purDate')?.value;
    const notes = document.getElementById('purNotes')?.value?.trim();
    const trackingMode = document.getElementById('purTrackingMode')?.value || 'bulk';

    if (!productId || quantity <= 0 || purchasePrice < 0) {
      alert('Please select a Product, enter valid Quantity (>0) and Purchase Cost Price.');
      return;
    }

    let items = [];
    if (trackingMode === 'unit') {
      const barcodeInputs = document.querySelectorAll('.unit_barcode');
      const imei1Inputs = document.querySelectorAll('.unit_imei1');
      const imei2Inputs = document.querySelectorAll('.unit_imei2');

      for (let i = 0; i < barcodeInputs.length; i++) {
        items.push({
          barcode: barcodeInputs[i]?.value?.trim(),
          imei1: imei1Inputs[i]?.value?.trim(),
          imei2: imei2Inputs[i]?.value?.trim(),
          serialNumber: imei1Inputs[i]?.value?.trim()
        });
      }
    }

    const payload = {
      productId,
      distributorId,
      quantity,
      purchasePrice,
      invoiceNumber,
      purchaseDate,
      notes,
      items: items.length > 0 ? items : undefined
    };

    try {
      const res = await fetch(`${this.API_URL}/purchases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const result = await res.json();
        alert(`✅ ${result.message}`);
        document.getElementById('purchaseEntryModal')?.remove();

        await Promise.all([
          this.loadProductsFromStorage(),
          this.loadStockEntriesFromStorage(),
          this.loadStockMovementsFromStorage()
        ]);

        this.renderPage(this.currentPage);
      } else {
        const err = await res.json();
        alert(`❌ Failed to record purchase: ${err.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('❌ Save purchase error:', err);
      alert('❌ Error processing purchase entry.');
    }
  }

  openPurchaseDetailModal(stockId) {
    const entry = (this.stockEntries || []).find(e => e.stockId === stockId || e.barcode === stockId);
    if (!entry) {
      alert('Purchase entry details not found.');
      return;
    }
    const dist = (this.distributors || []).find(d => d.distributorId === entry.dealerId || d.name === entry.dealerName);
    const modalId = 'purchaseDetailModal';
    document.getElementById(modalId)?.remove();

    const unitPrice = Number(entry.purchasePrice) || 0;
    const initialQty = Number(entry.initialQuantity) || 0;
    const grandTotal = unitPrice * initialQty;

    const html = `
      <div id="${modalId}" style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 16px;">
        <div style="background: #0f172a; color: #fff; border: 1px solid #334155; border-radius: 16px; max-width: 680px; width: 100%; padding: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.7); max-height: 90vh; overflow-y: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #334155; padding-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 26px;">🧾</span>
              <div>
                <h3 style="font-size: 20px; font-weight: 800; color: #38bdf8; margin: 0;">Dealer Purchase Invoice Details</h3>
                <span style="font-size: 12px; color: #94a3b8;">Batch ID: ${entry.stockId}</span>
              </div>
            </div>
            <button onclick="document.getElementById('${modalId}').remove()" style="background: none; border: none; color: #94a3b8; font-size: 22px; cursor: pointer;">✕</button>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #1e293b; padding: 16px; border-radius: 12px; border: 1px solid #334155; margin-bottom: 16px; font-size: 13px;">
            <div>
              <div style="color: #94a3b8; font-size: 11px; font-weight: 700; text-transform: uppercase;">Distributor / Supplier</div>
              <div style="font-size: 16px; font-weight: 800; color: #38bdf8; margin-top: 2px;">${entry.dealerName || dist?.name || 'Direct Purchase'}</div>
              <div style="color: #cbd5e1; font-size: 12px; margin-top: 4px;">📞 ${dist?.phone || 'N/A'} · ${dist?.address || 'Local'}</div>
              ${dist?.gstNumber ? `<div style="color: #94a3b8; font-size: 11px; margin-top: 2px;">GST: ${dist.gstNumber}</div>` : ''}
            </div>

            <div>
              <div style="color: #94a3b8; font-size: 11px; font-weight: 700; text-transform: uppercase;">Invoice Metadata</div>
              <div style="color: #fff; font-weight: 700; margin-top: 2px;">Invoice #: <span style="color: #f59e0b;">${entry.notes?.match(/Inv:\s*([^\s\)]+)/)?.[1] || 'INV-DIRECT'}</span></div>
              <div style="color: #cbd5e1; font-size: 12px; margin-top: 4px;">Purchase Date: <strong>${entry.purchaseDate || entry.createdAt?.split('T')[0]}</strong></div>
              <div style="color: #cbd5e1; font-size: 12px; margin-top: 2px;">Status: <span style="color: #34d399; font-weight: 800;">${entry.status || 'In Stock'}</span></div>
            </div>
          </div>

          <div style="background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; margin-bottom: 16px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
              <thead>
                <tr style="background: #0f172a; color: #94a3b8; text-transform: uppercase; font-size: 11px;">
                  <th style="padding: 10px 14px;">Product Name</th>
                  <th style="padding: 10px 14px;">Barcode / Tracking</th>
                  <th style="padding: 10px 14px; text-align: center;">Qty Purchased</th>
                  <th style="padding: 10px 14px; text-align: right;">Unit Cost</th>
                  <th style="padding: 10px 14px; text-align: right;">Total Value</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-top: 1px solid #334155;">
                  <td style="padding: 12px 14px; font-weight: 800; color: #fff;">${entry.masterName}</td>
                  <td style="padding: 12px 14px; font-weight: 700; color: #7c3aed;">${entry.barcode}${entry.imei1 ? ` (IMEI: ${entry.imei1})` : ''}</td>
                  <td style="padding: 12px 14px; text-align: center; font-weight: 800;">${initialQty}</td>
                  <td style="padding: 12px 14px; text-align: right; font-weight: 800; color: #fb7185;">₹${unitPrice.toLocaleString('en-IN')}</td>
                  <td style="padding: 12px 14px; text-align: right; font-weight: 900; color: #34d399;">₹${grandTotal.toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid #059669; border-radius: 10px; padding: 12px; margin-bottom: 20px; font-size: 12px; color: #a7f3d0;">
            🔒 <strong>Audit Record Protection:</strong> Initial Purchased Quantity (${initialQty} units) is permanently preserved in history logs. Current available unsold stock is <strong>${entry.currentQuantity}</strong> units.
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button onclick="document.getElementById('${modalId}').remove()" style="padding: 10px 18px; background: #334155; color: #fff; border: none; border-radius: 8px; font-weight: 700; cursor: pointer;">Close</button>
            <button onclick="app.printDealerPurchaseBill('${entry.stockId}')" style="padding: 10px 20px; background: #0284c7; color: #fff; border: none; border-radius: 8px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px;">
              🖨️ Print A4 Invoice Bill
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
  }

  printDealerPurchaseBill(stockId) {
    const entry = (this.stockEntries || []).find(e => e.stockId === stockId || e.barcode === stockId);
    if (!entry) {
      alert('Purchase entry not found for printing.');
      return;
    }
    const dist = (this.distributors || []).find(d => d.distributorId === entry.dealerId || d.name === entry.dealerName);
    const unitPrice = Number(entry.purchasePrice) || 0;
    const initialQty = Number(entry.initialQuantity) || 0;
    const grandTotal = unitPrice * initialQty;
    const invNum = entry.notes?.match(/Inv:\s*([^\s\)]+)/)?.[1] || `INV-${entry.stockId.substring(4, 12)}`;

    const printWin = window.open('', '_blank', 'width=900,height=750');
    if (!printWin) {
      alert('Please allow popups to print the purchase invoice bill.');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Dealer Purchase Invoice - ${invNum}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 24px; color: #1e293b; background: #fff; margin: 0; }
          .invoice-box { max-width: 800px; margin: auto; padding: 30px; border: 2px solid #e2e8f0; border-radius: 12px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #dc2626; padding-bottom: 16px; margin-bottom: 24px; }
          .company-name { font-size: 24px; font-weight: 900; color: #dc2626; text-transform: uppercase; }
          .bill-title { font-size: 18px; font-weight: 800; color: #0f172a; text-align: right; }
          .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; font-size: 13px; }
          .card { background: #f8fafc; padding: 14px; border-radius: 8px; border: 1px solid #cbd5e1; }
          .table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
          .table th { background: #1e293b; color: #fff; padding: 10px 12px; text-transform: uppercase; font-size: 11px; text-align: left; }
          .table td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
          .total-box { text-align: right; font-size: 16px; font-weight: 900; color: #059669; margin-top: 12px; padding: 12px; background: #ecfdf5; border-radius: 8px; border: 1px solid #a7f3d0; }
          .footer { margin-top: 40px; padding-top: 16px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; }
          @media print {
            body { padding: 0; }
            .invoice-box { border: none; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-box">
          <div class="header">
            <div>
              <div class="company-name">ஜிவி மொபைல்ஸ் — Jivi Mobiles</div>
              <div style="font-size: 12px; color: #64748b;">Mobile Sales, Services &amp; Accessories</div>
            </div>
            <div>
              <div class="bill-title">DEALER PURCHASE BILL</div>
              <div style="font-size: 12px; color: #64748b;">Invoice #: <strong>${invNum}</strong></div>
              <div style="font-size: 12px; color: #64748b;">Date: <strong>${entry.purchaseDate || entry.createdAt?.split('T')[0]}</strong></div>
            </div>
          </div>

          <div class="details-grid">
            <div class="card">
              <strong style="color: #0284c7; text-transform: uppercase; font-size: 11px;">Distributor / Supplier Details</strong>
              <div style="font-size: 15px; font-weight: 800; margin-top: 4px;">${entry.dealerName || dist?.name || 'Direct Purchase'}</div>
              <div>Phone: ${dist?.phone || 'N/A'}</div>
              <div>Address: ${dist?.address || 'Local Market'}</div>
              ${dist?.gstNumber ? `<div>GST No: ${dist.gstNumber}</div>` : ''}
            </div>

            <div class="card">
              <strong style="color: #0284c7; text-transform: uppercase; font-size: 11px;">Stock Batch Info</strong>
              <div style="margin-top: 4px;">Batch ID: <strong>${entry.stockId}</strong></div>
              <div>Barcode: <strong>${entry.barcode}</strong></div>
              <div>Tracking Mode: <strong>${entry.imei1 ? 'Unit Serial / IMEI' : 'Bulk Batch'}</strong></div>
              <div>Status: <strong>${entry.status || 'In Stock'}</strong></div>
            </div>
          </div>

          <table class="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Product Description</th>
                <th>Barcode / IMEI</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Cost Price (₹)</th>
                <th style="text-align: right;">Line Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td><strong>${entry.masterName}</strong></td>
                <td>${entry.barcode}${entry.imei1 ? `<br><small>IMEI: ${entry.imei1}</small>` : ''}</td>
                <td style="text-align: center;"><strong>${initialQty}</strong></td>
                <td style="text-align: right;">₹${unitPrice.toLocaleString('en-IN')}</td>
                <td style="text-align: right;"><strong>₹${grandTotal.toLocaleString('en-IN')}</strong></td>
              </tr>
            </tbody>
          </table>

          <div class="total-box">
            Grand Total Investment: ₹${grandTotal.toLocaleString('en-IN')}
          </div>

          <div style="margin-top: 20px; font-size: 11px; color: #64748b;">
            * Note: Historical purchase logs permanently record original purchased quantity of ${initialQty} units.
          </div>

          <div class="footer">
            <div>Generated by Jivi Mobiles Owner Portal</div>
            <div>Authorized Signature: _______________________</div>
          </div>
        </div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;

    printWin.document.write(html);
    printWin.document.close();
  }

  renderDistributorsModule() {
    const search = (this.distributorSearch || '').toLowerCase().trim();
    let list = this.distributors || [];

    if (search) {
      list = list.filter(d => 
        (d.name || '').toLowerCase().includes(search) ||
        (d.phone || '').includes(search)
      );
    }

    const allDistributors = this.distributors || [];
    const activeCount = allDistributors.filter(d => d.status !== 'Inactive').length;
    const totalInvoicesCount = (this.purchaseBills || []).length;
    const totalPurchasedSpend = (this.purchaseBills || []).reduce((sum, b) => sum + Number(b.totalAmount || 0), 0);

    return `
      <div class="owner-portal-page" style="min-height: 100vh; background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 50%, #f0f9ff 100%); color: #0f172a; padding-top: 96px; padding-bottom: 80px;">
        <div class="container" style="max-width: 1300px; margin: 0 auto; padding: 0 16px;">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
            <div>
              <button class="back-button" data-page="admin" style="margin-bottom: 12px;">← Dashboard</button>
              <h1 style="font-size: 36px; font-weight: 700; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 10px;">
                🤝 Distributor Management
              </h1>
              <p style="color: #475569; font-size: 14px; margin-top: 4px;">Manage distributors, view purchase profiles, and record new stock transactions.</p>
            </div>

            <div style="display: flex; gap: 10px;">
              <button onclick="app.openAddDistributorModal()" style="background: linear-gradient(135deg, #059669, #047857); color: #fff; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 800; font-size: 15px; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 14px rgba(5,150,105,0.25);">
                ➕ + Add Distributor
              </button>
            </div>
          </div>

          <!-- Summary Analytics Bar -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px;">
            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 18px; box-shadow: 0 4px 14px rgba(0,0,0,0.04); display: flex; align-items: center; gap: 16px;">
              <div style="width: 48px; height: 48px; border-radius: 12px; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800;">🤝</div>
              <div>
                <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Suppliers</div>
                <div style="font-size: 24px; font-weight: 800; color: #0f172a;">${allDistributors.length}</div>
              </div>
            </div>
            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 18px; box-shadow: 0 4px 14px rgba(0,0,0,0.04); display: flex; align-items: center; gap: 16px;">
              <div style="width: 48px; height: 48px; border-radius: 12px; background: #ecfdf5; color: #059669; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800;">✅</div>
              <div>
                <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase;">Active Suppliers</div>
                <div style="font-size: 24px; font-weight: 800; color: #059669;">${activeCount}</div>
              </div>
            </div>
            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 18px; box-shadow: 0 4px 14px rgba(0,0,0,0.04); display: flex; align-items: center; gap: 16px;">
              <div style="width: 48px; height: 48px; border-radius: 12px; background: #fef3c7; color: #d97706; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800;">📄</div>
              <div>
                <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Bills</div>
                <div style="font-size: 24px; font-weight: 800; color: #0f172a;">${totalInvoicesCount}</div>
              </div>
            </div>
            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 18px; box-shadow: 0 4px 14px rgba(0,0,0,0.04); display: flex; align-items: center; gap: 16px;">
              <div style="width: 48px; height: 48px; border-radius: 12px; background: #f3e8ff; color: #9333ea; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800;">💳</div>
              <div>
                <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Sourced Spend</div>
                <div style="font-size: 24px; font-weight: 800; color: #9333ea;">₹${totalPurchasedSpend.toLocaleString('en-IN')}</div>
              </div>
            </div>
          </div>

          <!-- Controls: Search -->
          <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 18px; margin-bottom: 24px; box-shadow: 0 4px 16px rgba(0,0,0,0.05);">
            <div style="display: flex; gap: 14px; flex-wrap: wrap; align-items: center; justify-content: space-between;">
              <div style="position: relative; flex: 1; min-width: 280px;">
                <input type="text" id="distSearchInput" value="${this.distributorSearch || ''}" 
                  oninput="app.searchDistributors(this.value)"
                  placeholder="🔍 Search distributor name or mobile number..." 
                  style="width: 100%; padding: 12px 16px; background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; color: #0f172a; font-size: 14px; font-weight: 600;">
              </div>
            </div>
          </div>

          <!-- Table View (1 Row Per Distributor) -->
          <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.06);">
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
                <thead>
                  <tr style="background: #0f172a; color: #ffffff; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px;">
                    <th style="padding: 16px;">Distributor Name</th>
                    <th style="padding: 16px;">Mobile Number</th>
                    <th style="padding: 16px; text-align: center;">Total Purchases</th>
                    <th style="padding: 16px; text-align: center;">Last Purchase</th>
                    <th style="padding: 16px; text-align: center;">Action</th>
                  </tr>
                </thead>
                <tbody id="distributorsTableBody">
                  ${list.length === 0 ? `
                    <tr>
                      <td colspan="5" style="padding: 40px; text-align: center; color: #64748b; font-size: 15px;">
                        🔍 No distributors found. Click <strong>+ Add Distributor</strong> to add one.
                      </td>
                    </tr>
                  ` : list.map(d => this.renderDistributorRowHTML(d)).join('')}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  renderDistributorRowHTML(d) {
    const dBills = (this.purchaseBills || []).filter(b => b.distributorId === d.distributorId);
    const totalPurchases = dBills.length;
    const lastBill = dBills[0];
    const lastPurchase = lastBill ? lastBill.purchaseDate : '-';

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; background: #ffffff;">
        <td style="padding: 16px; font-weight: 800; color: #0f172a; font-size: 15px;">${d.name}</td>
        <td style="padding: 16px; font-weight: 700; color: #059669;">📞 ${d.phone}</td>
        <td style="padding: 16px; text-align: center; font-weight: 800; color: #0284c7;">${totalPurchases} purchases</td>
        <td style="padding: 16px; text-align: center; color: #475569; font-weight: 600;">${lastPurchase}</td>
        <td style="padding: 16px; text-align: center;">
          <div style="display:flex; gap:6px; justify-content:center;">
            <button onclick="app.viewDistributorHistory('${d.distributorId}')" style="padding: 8px 14px; background: #0284c7; color: #fff; border: none; border-radius: 8px; font-weight: 800; font-size: 13px; cursor: pointer; box-shadow: 0 2px 8px rgba(2,132,199,0.25);" title="View History">
              View History
            </button>
            <button onclick="app.deleteDistributor('${d.distributorId}', '${(d.name || '').replace(/'/g, "\\'")}')" style="padding: 8px 12px; background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; border-radius: 8px; font-weight: 800; font-size: 13px; cursor: pointer;" title="Delete Distributor">
              🗑️ Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  searchDistributors(value) {
    this.distributorSearch = value || '';
    const search = (this.distributorSearch || '').toLowerCase().trim();
    const list = (this.distributors || []).filter(d =>
      (d.name || '').toLowerCase().includes(search) ||
      (d.phone || '').includes(search)
    );
    const tbody = document.getElementById('distributorsTableBody');
    if (tbody) {
      tbody.innerHTML = list.length === 0 ? `
        <tr>
          <td colspan="5" style="padding: 40px; text-align: center; color: #64748b; font-size: 15px;">
            🔍 No distributors found. Click <strong>+ Add Distributor</strong> to add one.
          </td>
        </tr>
      ` : list.map(d => this.renderDistributorRowHTML(d)).join('');
    }
  }

  // Load Purchase Bills
  async loadPurchaseBillsFromStorage() {
    try {
      const response = await fetch(`${this.API_URL}/purchases/bills`);
      if (response.ok) {
        this.purchaseBills = await response.json();
        console.log('✅ Loaded purchase bills from database:', this.purchaseBills.length);
      } else {
        this.purchaseBills = [];
      }
    } catch (error) {
      console.error('❌ Error loading purchase bills:', error);
      this.purchaseBills = [];
    }
  }

  // Distributor History Navigation
  viewDistributorHistory(distributorId) {
    this.selectedDistributorId = distributorId;
    this.renderPage('admin-distributor-history');
  }

  // Add Distributor Modal & Duplicate Prevention
  openAddDistributorModal() {
    const existingModal = document.getElementById('addDistributorModal');
    if (existingModal) existingModal.remove();

    const modalHTML = `
      <div id="addDistributorModal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 16px;">
        <div style="background: #ffffff; border-radius: 16px; padding: 32px; max-width: 480px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px;">
            <h2 style="font-size: 22px; font-weight: 900; color: #0f172a; margin: 0;">🤝 Add New Distributor</h2>
            <button onclick="document.getElementById('addDistributorModal').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #64748b;">✕</button>
          </div>

          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 13px; font-weight: 800; color: #334155; margin-bottom: 6px;">Distributor Name <span style="color: #dc2626;">*</span></label>
            <input type="text" id="newDistName" class="input" placeholder="e.g. ABC Distributors" style="width: 100%; padding: 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 14px; font-weight: 600;">
          </div>

          <div style="margin-bottom: 24px;">
            <label style="display: block; font-size: 13px; font-weight: 800; color: #334155; margin-bottom: 6px;">Mobile Number <span style="color: #dc2626;">*</span></label>
            <input type="tel" id="newDistPhone" class="input" placeholder="e.g. 9876543210" style="width: 100%; padding: 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 14px; font-weight: 600;">
          </div>

          <div id="addDistErrorMsg" style="display: none; background: #fee2e2; border: 1px solid #fca5a5; color: #dc2626; padding: 12px; border-radius: 8px; font-size: 13px; font-weight: 700; margin-bottom: 18px;"></div>

          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button onclick="document.getElementById('addDistributorModal').remove()" style="padding: 12px 24px; background: #e2e8f0; color: #334155; border: none; border-radius: 8px; font-weight: 800; cursor: pointer;">Cancel</button>
            <button onclick="app.saveNewDistributor()" style="padding: 12px 24px; background: #059669; color: #fff; border: none; border-radius: 8px; font-weight: 900; cursor: pointer;">Save Distributor</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.getElementById('newDistName')?.focus();
  }

  async saveNewDistributor() {
    const nameEl = document.getElementById('newDistName');
    const phoneEl = document.getElementById('newDistPhone');
    const errorEl = document.getElementById('addDistErrorMsg');

    const name = (nameEl?.value || '').trim();
    const phone = (phoneEl?.value || '').trim();

    if (!name || !phone) {
      if (errorEl) {
        errorEl.textContent = 'Please enter both Distributor Name and Mobile Number.';
        errorEl.style.display = 'block';
      } else {
        alert('Please enter both Distributor Name and Mobile Number.');
      }
      return;
    }

    try {
      const response = await fetch(`${this.API_URL}/distributors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone })
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || 'Distributor already exists. Please add a new purchase entry to the existing distributor.';
        if (errorEl) {
          errorEl.textContent = errorMsg;
          errorEl.style.display = 'block';
        } else {
          alert(errorMsg);
        }
        return;
      }

      console.log('✅ Distributor saved successfully:', data);
      document.getElementById('addDistributorModal')?.remove();
      await this.loadDistributorsFromStorage();
      await this.renderPage('admin-distributors');
    } catch (err) {
      console.error('❌ Error saving distributor:', err);
      if (errorEl) {
        errorEl.textContent = 'Failed to save distributor. ' + err.message;
        errorEl.style.display = 'block';
      }
    }
  }

  // Distributor History View
  renderDistributorHistoryModule() {
    const distId = this.selectedDistributorId;
    const dist = (this.distributors || []).find(d => d.distributorId === distId);

    if (!dist) {
      return `
        <div style="min-height: 100vh; padding-top: 100px; text-align: center; color: #fff; background: #0f172a;">
          <h2>Distributor Not Found</h2>
          <button onclick="app.renderPage('admin-distributors')" style="padding: 10px 20px; background: #0284c7; color: #fff; border: none; border-radius: 8px; cursor: pointer;">← Back to Distributors</button>
        </div>
      `;
    }

    // Filter purchase bills for this distributor
    const dPurchases = (this.purchaseBills || []).filter(b => b.distributorId === distId);

    // Group purchases by Year -> Month -> Date
    const grouped = {};
    dPurchases.forEach(p => {
      const year = p.year || '2026';
      const month = p.month || 'September';
      const date = p.purchaseDate || '2026-09-04';

      if (!grouped[year]) grouped[year] = {};
      if (!grouped[year][month]) grouped[year][month] = {};
      if (!grouped[year][month][date]) grouped[year][month][date] = [];
      grouped[year][month][date].push(p);
    });

    const totalSpent = dPurchases.reduce((s, p) => s + (Number(p.totalAmount) || 0), 0);
    const totalUnits = dPurchases.reduce((s, p) => s + (Number(p.totalQuantity) || 0), 0);

    return `
      <div class="owner-portal-page" style="min-height: 100vh; background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 50%, #f0f9ff 100%); color: #0f172a; padding-top: 96px; padding-bottom: 80px;">
        <div class="container" style="max-width: 1300px; margin: 0 auto; padding: 0 16px;">
          
          <!-- Header Bar -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
            <div>
              <button onclick="app.renderPage('admin-distributors')" class="back-button" style="margin-bottom: 12px;">← Back to Distributors</button>
              <h1 style="font-size: 32px; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 10px;">
                🤝 ${dist.name}
              </h1>
              <p style="color: #475569; font-size: 14px; margin-top: 4px;">
                Mobile: <strong style="color: #059669;">${dist.phone}</strong> | ID: ${dist.distributorId}
              </p>
            </div>

            <div style="display: flex; gap: 12px;">
              <button onclick="app.openAddPurchaseModal('${dist.distributorId}')" style="background: linear-gradient(135deg, #059669, #047857); color: #fff; border: none; padding: 14px 24px; border-radius: 10px; font-weight: 900; font-size: 15px; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 14px rgba(5,150,105,0.3);">
                ➕ + Add Purchase
              </button>
            </div>
          </div>

          <!-- Quick Stats Cards -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px;">
            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 20px; text-align: center; box-shadow: 0 4px 16px rgba(0,0,0,0.05);">
              <div style="font-size: 28px; font-weight: 900; color: #0284c7;">${dPurchases.length}</div>
              <div style="font-size: 12px; font-weight: 800; color: #64748b; text-transform: uppercase;">Total Transactions</div>
            </div>
            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 20px; text-align: center; box-shadow: 0 4px 16px rgba(0,0,0,0.05);">
              <div style="font-size: 28px; font-weight: 900; color: #059669;">${totalUnits}</div>
              <div style="font-size: 12px; font-weight: 800; color: #64748b; text-transform: uppercase;">Total Purchased Units</div>
            </div>
            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 20px; text-align: center; box-shadow: 0 4px 16px rgba(0,0,0,0.05);">
              <div style="font-size: 26px; font-weight: 900; color: #d97706;">₹${totalSpent.toLocaleString('en-IN')}</div>
              <div style="font-size: 12px; font-weight: 800; color: #64748b; text-transform: uppercase;">Total Purchase Value</div>
            </div>
          </div>

          <!-- History Timeline -->
          <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 16px; padding: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.06);">
            <h2 style="font-size: 20px; font-weight: 900; color: #0f172a; margin-top: 0; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">
              📋 Purchase History
            </h2>

            ${dPurchases.length === 0 ? `
              <div style="padding: 40px; text-align: center; color: #64748b; font-size: 15px;">
                No purchase transactions recorded yet for this distributor. Click <strong>+ Add Purchase</strong> to record a purchase batch.
              </div>
            ` : Object.keys(grouped).map(year => `
              <div style="margin-bottom: 24px;">
                <h3 style="font-size: 18px; font-weight: 900; color: #0284c7; margin-bottom: 14px;">📅 ${year}</h3>
                
                ${Object.keys(grouped[year]).map(month => `
                  <div style="margin-left: 12px; margin-bottom: 18px; border-left: 3px solid #cbd5e1; padding-left: 16px;">
                    <h4 style="font-size: 16px; font-weight: 800; color: #334155; margin-bottom: 12px;">🗓️ ${month}</h4>

                    ${Object.keys(grouped[year][month]).map(date => `
                      <div style="margin-bottom: 12px;">
                        <div style="font-size: 13px; font-weight: 800; color: #64748b; margin-bottom: 8px;">📆 ${date}</div>

                        ${grouped[year][month][date].map(p => `
                          <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 16px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                            <div>
                              <span style="font-weight: 900; color: #dc2626; font-size: 15px;">${p.billNumber}</span>
                              <span style="margin-left: 12px; font-weight: 700; color: #0f172a; font-size: 13px;">${(p.items || []).length} Products (${p.totalQuantity} units)</span>
                            </div>
                            <div style="display: flex; gap: 16px; align-items: center;">
                              <span style="font-size: 16px; font-weight: 900; color: #059669;">₹${Number(p.totalAmount || 0).toLocaleString('en-IN')}</span>
                              <button onclick="app.openPurchaseBillModal('${p.billNumber}')" style="padding: 6px 14px; background: #0284c7; color: #fff; border: none; border-radius: 6px; font-weight: 800; font-size: 12px; cursor: pointer; box-shadow: 0 2px 8px rgba(2,132,199,0.3);">View Bill</button>
                            </div>
                          </div>
                        `).join('')}
                      </div>
                    `).join('')}
                  </div>
                `).join('')}
              </div>
            `).join('')}

          </div>

        </div>
      </div>
    `;
  }

  // Multi-Product Entry Modal
  openAddPurchaseModal(distributorId = '', preselectProductId = '') {
    const activeDists = (this.distributors || []).filter(d => d.status !== 'Inactive');
    if (!distributorId && activeDists.length > 0) {
      distributorId = activeDists[0].distributorId;
    }
    const dist = activeDists.find(d => d.distributorId === distributorId) || activeDists[0];

    this.activePurchaseModal = dist ? dist.distributorId : (distributorId || '');
    this.purchaseEntryRows = Array.from({ length: 5 }, () => ({
      productName: '',
      barcode: '',
      quantity: '',
      distributorPrice: '',
      ownerPrice: '',
      customerPrice: ''
    }));

    if (preselectProductId) {
      const prod = (this.products || []).find(p => String(p.id || p._id) === String(preselectProductId));
      if (prod) {
        this.purchaseEntryRows[0] = {
          productName: prod.name || '',
          barcode: prod.barcode || '',
          quantity: '1',
          distributorPrice: prod.distributorPrice !== undefined ? prod.distributorPrice : (prod.costPrice !== undefined ? prod.costPrice : ''),
          ownerPrice: prod.ownerPrice !== undefined ? prod.ownerPrice : (prod.price !== undefined ? prod.price : ''),
          customerPrice: prod.customerPrice !== undefined ? prod.customerPrice : (prod.price !== undefined ? prod.price : '')
        };
      }
    }

    const existing = document.getElementById('addPurchaseModal');
    if (existing) existing.remove();

    const todayDate = new Date().toISOString().split('T')[0];

    const modalHTML = `
      <div id="addPurchaseModal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 16px;">
        <div style="background: #ffffff; border-radius: 16px; width: 100%; max-width: 1280px; max-height: 92vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px rgba(0,0,0,0.3); overflow: hidden;">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #1e293b, #0f172a); color: #fff; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h2 style="font-size: 22px; font-weight: 900; margin: 0 0 6px 0; color: #38bdf8; display: flex; align-items: center; gap: 8px;">
                📥 New Stock Purchase Entry
              </h2>
              <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <label style="color: #cbd5e1; font-size: 13px; font-weight: 700;">Distributor Name:</label>
                <select id="purchaseEntryDistributorId" onchange="app.activePurchaseModal = this.value" style="padding: 6px 12px; background: #0f172a; color: #38bdf8; border: 1.5px solid #0284c7; border-radius: 8px; font-weight: 800; font-size: 14px; cursor: pointer; outline: none;">
                  ${activeDists.length === 0 ? '<option value="">Direct / Local Market</option>' : activeDists.map(d => `<option value="${d.distributorId}" ${d.distributorId === this.activePurchaseModal ? 'selected' : ''}>${d.name} (${d.phone})</option>`).join('')}
                </select>
              </div>
            </div>
            <button onclick="document.getElementById('addPurchaseModal').remove()" style="background: rgba(255,255,255,0.1); border: none; color: #fff; width: 36px; height: 36px; border-radius: 50%; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
          </div>

          <!-- Top Meta Bar -->
          <div style="background: #f8fafc; border-bottom: 1.5px solid #e2e8f0; padding: 14px 24px; display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
            <div>
              <label style="font-size: 12px; font-weight: 800; color: #475569; margin-right: 8px;">Purchase Date:</label>
              <input type="date" id="purchaseEntryDate" value="${todayDate}" style="padding: 8px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 13px; font-weight: 700;">
            </div>
            <div style="flex: 1;">
              <input type="text" id="purchaseEntryNotes" placeholder="Optional Purchase Notes / Remarks..." style="width: 100%; padding: 8px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 13px;">
            </div>
          </div>

          <!-- Table Container (Scrollable) -->
          <div style="flex: 1; overflow-y: auto; padding: 16px 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <thead>
                <tr style="background: #e2e8f0; color: #1e293b; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">
                  <th style="padding: 10px; text-align: center; width: 40px;">#</th>
                  <th style="padding: 10px; min-width: 200px;">Product Name *</th>
                  <th style="padding: 10px; min-width: 140px;">Barcode</th>
                  <th style="padding: 10px; width: 100px;">Qty *</th>
                  <th style="padding: 10px; width: 140px;">Dist. Price (₹) *</th>
                  <th style="padding: 10px; width: 140px;">Owner Price (₹)</th>
                  <th style="padding: 10px; width: 140px;">Cust. Price (₹)</th>
                  <th style="padding: 10px; width: 140px; text-align: right;">Total (₹)</th>
                  <th style="padding: 10px; width: 50px; text-align: center;">Action</th>
                </tr>
              </thead>
              <tbody id="purchaseRowsBody">
                ${this.renderPurchaseEntryRowsHTML()}
              </tbody>
            </table>
          </div>

          <!-- Footer Bar -->
          <div style="background: #0f172a; color: #fff; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; border-top: 2px solid #334155;">
            <div style="display: flex; gap: 24px; font-size: 15px; font-weight: 800;">
              <div>Items: <span id="summaryTotalItems" style="color: #38bdf8;">0</span></div>
              <div>Qty: <span id="summaryTotalQty" style="color: #34d399;">0</span></div>
              <div>Total Amount: <span id="summaryTotalAmt" style="color: #fbbf24; font-size: 18px;">₹0</span></div>
            </div>
            <div style="display: flex; gap: 12px;">
              <button onclick="app.addBlankPurchaseRow()" style="padding: 10px 18px; background: #334155; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 800; cursor: pointer;">➕ Add Extra Row</button>
              <button onclick="app.savePurchaseBatch()" style="padding: 12px 28px; background: linear-gradient(135deg, #059669, #047857); color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 900; cursor: pointer; box-shadow: 0 4px 14px rgba(5,150,105,0.4);">💾 Complete & Save Purchase</button>
            </div>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.updatePurchaseSummary();
    setTimeout(() => {
      document.querySelector('#purchaseRowsBody tr:first-child input[data-field="productName"]')?.focus();
    }, 100);
  }

  renderSinglePurchaseRowHTML(r, idx) {
    const qty = Number(r.quantity || 0);
    const distPrice = Number(r.distributorPrice || 0);
    const total = qty > 0 && distPrice > 0 ? (qty * distPrice).toLocaleString('en-IN') : '0';

    return `
      <tr id="pRow_${idx}" style="border-bottom: 1px solid #cbd5e1; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 8px; text-align: center; font-weight: 800; color: #64748b;">${idx + 1}</td>
        <td style="padding: 8px;">
          <input type="text" data-row="${idx}" data-field="productName" value="${r.productName || ''}" 
            oninput="app.onPurchaseRowInput(${idx}, 'productName', this.value)"
            onkeydown="app.handlePurchaseRowKeydown(event, ${idx}, 'productName')"
            placeholder="Product Name" style="width: 100%; padding: 8px 10px; border: 1.5px solid #cbd5e1; border-radius: 6px; font-size: 13px; font-weight: 600;">
        </td>
        <td style="padding: 8px;">
          <input type="text" data-row="${idx}" data-field="barcode" value="${r.barcode || ''}" 
            oninput="app.onPurchaseRowInput(${idx}, 'barcode', this.value)"
            onkeydown="app.handlePurchaseRowKeydown(event, ${idx}, 'barcode')"
            placeholder="Barcode / Serial" style="width: 100%; padding: 8px 10px; border: 1.5px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
        </td>
        <td style="padding: 8px;">
          <input type="number" min="1" data-row="${idx}" data-field="quantity" value="${r.quantity !== undefined ? r.quantity : ''}" 
            oninput="app.onPurchaseRowInput(${idx}, 'quantity', this.value)"
            onkeydown="app.handlePurchaseRowKeydown(event, ${idx}, 'quantity')"
            placeholder="Qty" style="width: 100%; padding: 8px 10px; border: 1.5px solid #cbd5e1; border-radius: 6px; font-size: 13px; font-weight: 800; text-align: center;">
        </td>
        <td style="padding: 8px;">
          <input type="number" min="0" step="any" data-row="${idx}" data-field="distributorPrice" value="${r.distributorPrice !== undefined ? r.distributorPrice : ''}" 
            oninput="app.onPurchaseRowInput(${idx}, 'distributorPrice', this.value)"
            onkeydown="app.handlePurchaseRowKeydown(event, ${idx}, 'distributorPrice')"
            placeholder="Dist Price" style="width: 100%; padding: 8px 10px; border: 1.5px solid #cbd5e1; border-radius: 6px; font-size: 13px; font-weight: 700; text-align: right; color: #0284c7;">
        </td>
        <td style="padding: 8px;">
          <input type="number" min="0" step="any" data-row="${idx}" data-field="ownerPrice" value="${r.ownerPrice !== undefined ? r.ownerPrice : ''}" 
            oninput="app.onPurchaseRowInput(${idx}, 'ownerPrice', this.value)"
            onkeydown="app.handlePurchaseRowKeydown(event, ${idx}, 'ownerPrice')"
            placeholder="Owner Price" style="width: 100%; padding: 8px 10px; border: 1.5px solid #cbd5e1; border-radius: 6px; font-size: 13px; font-weight: 700; text-align: right; color: #d97706;">
        </td>
        <td style="padding: 8px;">
          <input type="number" min="0" step="any" data-row="${idx}" data-field="customerPrice" value="${r.customerPrice !== undefined ? r.customerPrice : ''}" 
            oninput="app.onPurchaseRowInput(${idx}, 'customerPrice', this.value)"
            onkeydown="app.handlePurchaseRowKeydown(event, ${idx}, 'customerPrice')"
            placeholder="Cust Price" style="width: 100%; padding: 8px 10px; border: 1.5px solid #cbd5e1; border-radius: 6px; font-size: 13px; font-weight: 700; text-align: right; color: #059669;">
        </td>
        <td style="padding: 8px; text-align: right; font-weight: 900; color: #0f172a; font-size: 14px;" id="rowTotal_${idx}">
          ₹${total}
        </td>
        <td style="padding: 8px; text-align: center;">
          <button onclick="app.removePurchaseRow(${idx})" style="background: none; border: none; color: #ef4444; font-size: 16px; cursor: pointer;" title="Remove row">🗑️</button>
        </td>
      </tr>
    `;
  }

  renderPurchaseEntryRowsHTML() {
    return (this.purchaseEntryRows || []).map((r, idx) => this.renderSinglePurchaseRowHTML(r, idx)).join('');
  }

  onPurchaseRowInput(index, field, value) {
    if (!this.purchaseEntryRows[index]) return;
    this.purchaseEntryRows[index][field] = value;

    // Automatic Row Addition: If user types into the last row, automatically append a new blank row without destroying existing row focus!
    if (index === this.purchaseEntryRows.length - 1 && value.trim() !== '') {
      this.addBlankPurchaseRow();
    }

    const qty = Number(this.purchaseEntryRows[index].quantity || 0);
    const distPrice = Number(this.purchaseEntryRows[index].distributorPrice || 0);
    const totalCell = document.getElementById(`rowTotal_${index}`);
    if (totalCell) {
      totalCell.textContent = `₹${qty > 0 && distPrice > 0 ? (qty * distPrice).toLocaleString('en-IN') : '0'}`;
    }

    this.updatePurchaseSummary();
  }

  addBlankPurchaseRow() {
    const newRow = {
      productName: '',
      barcode: '',
      quantity: '',
      distributorPrice: '',
      ownerPrice: '',
      customerPrice: ''
    };
    this.purchaseEntryRows.push(newRow);
    const idx = this.purchaseEntryRows.length - 1;
    const tbody = document.getElementById('purchaseRowsBody');
    if (tbody) {
      tbody.insertAdjacentHTML('beforeend', this.renderSinglePurchaseRowHTML(newRow, idx));
      this.updatePurchaseSummary();
    }
  }

  removePurchaseRow(index) {
    if (this.purchaseEntryRows.length <= 1) {
      this.purchaseEntryRows = [{ productName: '', barcode: '', quantity: '', distributorPrice: '', ownerPrice: '', customerPrice: '' }];
    } else {
      this.purchaseEntryRows.splice(index, 1);
    }
    const tbody = document.getElementById('purchaseRowsBody');
    if (tbody) {
      tbody.innerHTML = this.renderPurchaseEntryRowsHTML();
      this.updatePurchaseSummary();
    }
  }

  handlePurchaseRowKeydown(event, index, field) {
    const fields = ['productName', 'barcode', 'quantity', 'distributorPrice', 'ownerPrice', 'customerPrice'];
    const fieldIdx = fields.indexOf(field);

    if (event.key === 'Enter') {
      event.preventDefault();
      if (fieldIdx < fields.length - 1) {
        const nextField = fields[fieldIdx + 1];
        document.querySelector(`input[data-row="${index}"][data-field="${nextField}"]`)?.focus();
      } else {
        if (index === this.purchaseEntryRows.length - 1) {
          this.addBlankPurchaseRow();
        }
        setTimeout(() => {
          document.querySelector(`input[data-row="${index + 1}"][data-field="productName"]`)?.focus();
        }, 50);
      }
    } else if (event.key === 'Tab' && !event.shiftKey && fieldIdx === fields.length - 1 && index === this.purchaseEntryRows.length - 1) {
      this.addBlankPurchaseRow();
      setTimeout(() => {
        document.querySelector(`input[data-row="${index + 1}"][data-field="productName"]`)?.focus();
      }, 50);
    }
  }

  updatePurchaseSummary() {
    let validItems = 0;
    let totalQty = 0;
    let totalAmt = 0;

    (this.purchaseEntryRows || []).forEach(r => {
      const q = parseInt(r.quantity || 0, 10);
      const dp = Number(r.distributorPrice || 0);
      if ((r.productName || '').trim() && q > 0 && dp >= 0) {
        validItems++;
        totalQty += q;
        totalAmt += (q * dp);
      }
    });

    const itemsEl = document.getElementById('summaryTotalItems');
    const qtyEl = document.getElementById('summaryTotalQty');
    const amtEl = document.getElementById('summaryTotalAmt');

    if (itemsEl) itemsEl.textContent = validItems;
    if (qtyEl) qtyEl.textContent = totalQty;
    if (amtEl) amtEl.textContent = `₹${totalAmt.toLocaleString('en-IN')}`;
  }

  async savePurchaseBatch(distributorId) {
    const targetDistId = document.getElementById('purchaseEntryDistributorId')?.value || distributorId || this.activePurchaseModal;
    if (!targetDistId) {
      alert('Please select a distributor.');
      return;
    }
    const pDate = document.getElementById('purchaseEntryDate')?.value || new Date().toISOString().split('T')[0];
    const notes = (document.getElementById('purchaseEntryNotes')?.value || '').trim();

    const validRows = (this.purchaseEntryRows || []).filter(r => {
      const name = (r.productName || '').trim();
      const q = parseInt(r.quantity || 0, 10);
      const dp = Number(r.distributorPrice || 0);
      return name !== '' && q > 0 && dp >= 0;
    });

    if (validRows.length === 0) {
      alert('Please fill in at least one valid product row with Product Name, Quantity (>0), and Distributor Price.');
      return;
    }

    try {
      const response = await fetch(`${this.API_URL}/purchases/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          distributorId: targetDistId,
          purchaseDate: pDate,
          notes,
          items: validRows
        })
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Failed to save purchase entry.');
        return;
      }

      console.log('✅ Purchase saved:', data);
      document.getElementById('addPurchaseModal')?.remove();

      await this.loadPurchaseBillsFromStorage();
      await this.loadProductsFromStorage();
      await this.loadDistributorsFromStorage();

      if (this.currentPage === 'admin-distributor-history') {
        await this.renderPage('admin-distributor-history');
      }

      if (data.purchase && data.purchase.billNumber) {
        this.openPurchaseBillModal(data.purchase.billNumber);
      }
    } catch (err) {
      console.error('❌ Error saving purchase batch:', err);
      alert('Failed to save purchase batch: ' + err.message);
    }
  }

  // Global Purchase Bills Module
  renderPurchaseBillsModule() {
    const search = (this.purchaseBillSearch || '').toLowerCase().trim();
    let list = this.purchaseBills || [];

    if (this.purchaseBillDistributorFilter !== 'all') {
      list = list.filter(b => b.distributorId === this.purchaseBillDistributorFilter);
    }
    if (this.purchaseBillMonthFilter !== 'all') {
      list = list.filter(b => b.month === this.purchaseBillMonthFilter);
    }
    if (this.purchaseBillYearFilter && this.purchaseBillYearFilter !== 'all') {
      list = list.filter(b => b.year === this.purchaseBillYearFilter);
    }
    if (search) {
      list = list.filter(b => 
        (b.billNumber || '').toLowerCase().includes(search) ||
        (b.distributorName || '').toLowerCase().includes(search) ||
        (b.distributorMobile || '').toLowerCase().includes(search)
      );
    }

    const totalBillsCount = list.length;
    const totalPurchasedQty = list.reduce((sum, b) => sum + Number(b.totalQuantity || 0), 0);
    const totalPurchasedAmount = list.reduce((sum, b) => sum + Number(b.totalAmount || 0), 0);
    const avgBillAmount = totalBillsCount > 0 ? (totalPurchasedAmount / totalBillsCount) : 0;

    return `
      <div class="owner-portal-page" style="min-height: 100vh; background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 50%, #f0f9ff 100%); color: #0f172a; padding-top: 96px; padding-bottom: 80px;">
        <div class="container" style="max-width: 1380px; margin: 0 auto; padding: 0 16px;">
          
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
            <div>
              <button class="back-button" data-page="admin" style="margin-bottom: 12px;">← Dashboard</button>
              <h1 style="font-size: 36px; font-weight: 700; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 10px;">
                📄 Global Purchase Bills
              </h1>
              <p style="color: #475569; font-size: 14px; margin-top: 4px;">Permanent records of all distributor purchase invoices and historical product bills.</p>
            </div>
          </div>

          <!-- Summary Metrics Banner -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px;">
            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 18px; box-shadow: 0 4px 14px rgba(0,0,0,0.04); display: flex; align-items: center; gap: 16px;">
              <div style="width: 48px; height: 48px; border-radius: 12px; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800;">📄</div>
              <div>
                <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase;">Filtered Invoices</div>
                <div style="font-size: 24px; font-weight: 800; color: #0f172a;">${totalBillsCount}</div>
              </div>
            </div>
            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 18px; box-shadow: 0 4px 14px rgba(0,0,0,0.04); display: flex; align-items: center; gap: 16px;">
              <div style="width: 48px; height: 48px; border-radius: 12px; background: #ecfdf5; color: #059669; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800;">📦</div>
              <div>
                <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Purchased Qty</div>
                <div style="font-size: 24px; font-weight: 800; color: #059669;">${totalPurchasedQty.toLocaleString('en-IN')} units</div>
              </div>
            </div>
            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 18px; box-shadow: 0 4px 14px rgba(0,0,0,0.04); display: flex; align-items: center; gap: 16px;">
              <div style="width: 48px; height: 48px; border-radius: 12px; background: #fef3c7; color: #d97706; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800;">💰</div>
              <div>
                <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Sourced Spend</div>
                <div style="font-size: 24px; font-weight: 800; color: #d97706;">₹${totalPurchasedAmount.toLocaleString('en-IN')}</div>
              </div>
            </div>
            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 18px; box-shadow: 0 4px 14px rgba(0,0,0,0.04); display: flex; align-items: center; gap: 16px;">
              <div style="width: 48px; height: 48px; border-radius: 12px; background: #f3e8ff; color: #9333ea; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800;">📊</div>
              <div>
                <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase;">Avg Invoice Value</div>
                <div style="font-size: 24px; font-weight: 800; color: #9333ea;">₹${Math.round(avgBillAmount).toLocaleString('en-IN')}</div>
              </div>
            </div>
          </div>

          <!-- Controls: Search & Filters -->
          <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 18px; margin-bottom: 24px; box-shadow: 0 4px 16px rgba(0,0,0,0.05);">
            <div style="display: flex; gap: 14px; flex-wrap: wrap; align-items: center; justify-content: space-between;">
              <div style="position: relative; flex: 1; min-width: 280px;">
                <input type="text" id="purchaseBillSearchInput" value="${this.purchaseBillSearch || ''}" 
                  oninput="app.searchPurchaseBills(this.value)"
                  placeholder="🔍 Search Bill No (PUR-0001), Distributor, Mobile, Product Name, Barcode..." 
                  style="width: 100%; padding: 12px 16px; background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; color: #0f172a; font-size: 14px; font-weight: 600;">
              </div>

              <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <select onchange="app.purchaseBillDistributorFilter = this.value; app.renderPage('admin-purchase-bills');" style="padding: 10px 14px; background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; color: #0f172a; font-weight: 700;">
                  <option value="all">All Distributors</option>
                  ${(this.distributors || []).map(d => `<option value="${d.distributorId}" ${this.purchaseBillDistributorFilter === d.distributorId ? 'selected' : ''}>${d.name}</option>`).join('')}
                </select>

                <select onchange="app.purchaseBillMonthFilter = this.value; app.renderPage('admin-purchase-bills');" style="padding: 10px 14px; background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; color: #0f172a; font-weight: 700;">
                  <option value="all">All Months</option>
                  ${['January','February','March','April','May','June','July','August','September','October','November','December'].map(m => `<option value="${m}" ${this.purchaseBillMonthFilter === m ? 'selected' : ''}>${m}</option>`).join('')}
                </select>
              </div>
            </div>
          </div>

          <!-- Purchase Bills Table -->
          <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.06);">
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                <thead>
                  <tr style="background: #0f172a; color: #ffffff; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px;">
                    <th style="padding: 14px 16px;">Bill Number</th>
                    <th style="padding: 14px 16px;">Distributor Name</th>
                    <th style="padding: 14px 16px;">Mobile</th>
                    <th style="padding: 14px 16px;">Date</th>
                    <th style="padding: 14px 16px; text-align: center;">Items</th>
                    <th style="padding: 14px 16px; text-align: center;">Total Quantity</th>
                    <th style="padding: 14px 16px; text-align: right;">Total Amount</th>
                    <th style="padding: 14px 16px; text-align: center;">Action</th>
                  </tr>
                </thead>
                <tbody id="purchaseBillsTableBody">
                  ${list.length === 0 ? `
                    <tr>
                      <td colspan="8" style="padding: 40px; text-align: center; color: #64748b; font-size: 15px;">
                        🔍 No purchase bills found. Create a distributor purchase entry to generate purchase bills.
                      </td>
                    </tr>
                  ` : list.map(b => this.renderPurchaseBillRowHTML(b)).join('')}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  renderPurchaseBillRowHTML(b) {
    return `
      <tr style="border-bottom: 1px solid #e2e8f0; background: #ffffff;">
        <td style="padding: 14px 16px; font-weight: 900; color: #dc2626; font-size: 14px;">${b.billNumber}</td>
        <td style="padding: 14px 16px; font-weight: 800; color: #0f172a;">${b.distributorName}</td>
        <td style="padding: 14px 16px; font-weight: 700; color: #059669;">📞 ${b.distributorMobile || '-'}</td>
        <td style="padding: 14px 16px; color: #475569; font-weight: 600;">${b.purchaseDate}</td>
        <td style="padding: 14px 16px; text-align: center; font-weight: 700; color: #0284c7;">${(b.items || []).length} products</td>
        <td style="padding: 14px 16px; text-align: center; font-weight: 800; color: #0f172a;">${b.totalQuantity} units</td>
        <td style="padding: 14px 16px; text-align: right; font-weight: 900; color: #059669; font-size: 15px;">₹${Number(b.totalAmount || 0).toLocaleString('en-IN')}</td>
        <td style="padding: 14px 16px; text-align: center;">
          <div style="display:flex; gap:6px; justify-content:center;">
            <button onclick="app.openPurchaseBillModal('${b.billNumber}')" style="padding: 6px 12px; background: #0284c7; color: #fff; border: none; border-radius: 6px; font-weight: 800; font-size: 12px; cursor: pointer; box-shadow: 0 2px 8px rgba(2,132,199,0.25);" title="View Bill">
              📄 View
            </button>
            <button onclick="app.deletePurchaseBill('${b.billNumber}')" style="padding: 6px 10px; background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; border-radius: 6px; font-weight: 800; font-size: 12px; cursor: pointer;" title="Delete Bill">
              🗑️ Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  async deletePurchaseBill(billNumber) {
    if (!billNumber) return;
    if (!confirm(`Are you sure you want to delete purchase bill "${billNumber}"?\n\nThis action cannot be undone.`)) {
      return;
    }
    try {
      const response = await fetch(`${this.API_URL}/purchases/bill/${billNumber}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        alert(`✅ Purchase bill "${billNumber}" deleted successfully!`);
        this.purchaseBills = (this.purchaseBills || []).filter(b => b.billNumber !== billNumber && b.purchaseId !== billNumber);
        if (this.currentPage === 'admin-purchase-bills') {
          this.renderPage('admin-purchase-bills');
        }
      } else {
        alert('❌ Failed to delete purchase bill.');
      }
    } catch (err) {
      console.error('❌ Delete purchase bill error:', err);
      alert('❌ Error deleting purchase bill.');
    }
  }

  searchPurchaseBills(value) {
    this.purchaseBillSearch = value || '';
    const search = (this.purchaseBillSearch || '').toLowerCase().trim();
    const distFilter = this.purchaseBillDistributorFilter || 'all';
    const monthFilter = this.purchaseBillMonthFilter || 'all';

    let list = (this.purchaseBills || []);
    if (distFilter !== 'all') {
      list = list.filter(b => b.distributorId === distFilter);
    }
    if (monthFilter !== 'all') {
      list = list.filter(b => (b.month || '') === monthFilter);
    }
    if (search) {
      list = list.filter(b => 
        (b.billNumber || '').toLowerCase().includes(search) ||
        (b.distributorName || '').toLowerCase().includes(search) ||
        (b.distributorMobile || '').includes(search) ||
        (b.items || []).some(i => (i.productName || '').toLowerCase().includes(search) || (i.barcode || '').toLowerCase().includes(search))
      );
    }

    const tbody = document.getElementById('purchaseBillsTableBody');
    if (tbody) {
      tbody.innerHTML = list.length === 0 ? `
        <tr>
          <td colspan="8" style="padding: 40px; text-align: center; color: #64748b; font-size: 15px;">
            🔍 No purchase bills found matching your search.
          </td>
        </tr>
      ` : list.map(b => this.renderPurchaseBillRowHTML(b)).join('');
    }
  }

  // Purchase Bill Modal View, Print & PDF
  async openPurchaseBillModal(billNumber) {
    try {
      const response = await fetch(`${this.API_URL}/purchases/bill/${billNumber}`);
      if (!response.ok) {
        alert('Purchase bill not found.');
        return;
      }
      const bill = await response.json();
      this.activeBillData = bill;

      const existing = document.getElementById('purchaseBillViewModal');
      if (existing) existing.remove();

      const itemsHTML = (bill.items || []).map((item, idx) => `
        <tr style="border-bottom: 1px solid #cbd5e1;">
          <td style="padding: 10px; text-align: center; font-weight: 700; color: #64748b;">${idx + 1}</td>
          <td style="padding: 10px; font-weight: 800; color: #0f172a;">${item.productName}</td>
          <td style="padding: 10px; font-family: monospace; color: #475569;">${item.barcode || '-'}</td>
          <td style="padding: 10px; text-align: center; font-weight: 800; color: #059669;">${item.quantity}</td>
          <td style="padding: 10px; text-align: right; font-weight: 700; color: #0284c7;">₹${Number(item.distributorPrice || 0).toLocaleString('en-IN')}</td>
          <td style="padding: 10px; text-align: right; font-weight: 700; color: #d97706;">₹${Number(item.ownerPrice || 0).toLocaleString('en-IN')}</td>
          <td style="padding: 10px; text-align: right; font-weight: 700; color: #059669;">₹${Number(item.customerPrice || 0).toLocaleString('en-IN')}</td>
          <td style="padding: 10px; text-align: right; font-weight: 900; color: #0f172a;">₹${Number(item.total || (item.quantity * item.distributorPrice)).toLocaleString('en-IN')}</td>
        </tr>
      `).join('');

      const modalHTML = `
        <div id="purchaseBillViewModal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 16px;">
          <div style="background: #ffffff; border-radius: 16px; width: 100%; max-width: 960px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px rgba(0,0,0,0.3); overflow: hidden;">
            
            <!-- Header -->
            <div style="background: #0f172a; color: #fff; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center;">
              <h2 style="font-size: 20px; font-weight: 900; margin: 0; color: #38bdf8;">📄 Purchase Bill #${bill.billNumber}</h2>
              <button onclick="document.getElementById('purchaseBillViewModal').remove()" style="background: none; border: none; color: #fff; font-size: 22px; cursor: pointer;">✕</button>
            </div>

            <!-- Bill Content Area (Printable) -->
            <div id="purchaseBillPrintableArea" style="flex: 1; overflow-y: auto; padding: 32px; background: #ffffff;">
              <!-- Invoice Header -->
              <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 24px;">
                <div>
                  <h1 style="font-size: 26px; font-weight: 900; color: #0f172a; margin: 0;">${this.shopConfig.shopName || 'ஜிவி மொபைல்ஸ் — Jivi Mobiles'}</h1>
                  <p style="color: #475569; font-size: 13px; font-weight: 600; margin: 4px 0 0 0;">${this.shopConfig.address || 'Vanthavasi, Tamil Nadu'}</p>
                  <p style="color: #475569; font-size: 12px; margin: 2px 0 0 0;">Phone: ${this.shopConfig.phone}</p>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 24px; font-weight: 900; color: #0284c7; letter-spacing: 0.5px;">PURCHASE BILL</div>
                  <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 4px;">Bill No: <span style="color: #dc2626;">${bill.billNumber}</span></div>
                  <div style="font-size: 13px; color: #475569; font-weight: 600; margin-top: 2px;">Date: ${bill.purchaseDate}</div>
                </div>
              </div>

              <!-- Distributor Info Box -->
              <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b;">Distributor Information</div>
                  <div style="font-size: 18px; font-weight: 900; color: #0f172a; margin-top: 2px;">${bill.distributorName}</div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 13px; font-weight: 800; color: #059669;">📞 Mobile: ${bill.distributorMobile || 'N/A'}</div>
                  <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Distributor ID: ${bill.distributorId}</div>
                </div>
              </div>

              <!-- Itemized Table -->
              <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px;">
                <thead>
                  <tr style="background: #1e293b; color: #fff; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">
                    <th style="padding: 12px; text-align: center; width: 40px;">#</th>
                    <th style="padding: 12px;">Product Name</th>
                    <th style="padding: 12px;">Barcode</th>
                    <th style="padding: 12px; text-align: center;">Qty</th>
                    <th style="padding: 12px; text-align: right;">Dist. Price</th>
                    <th style="padding: 12px; text-align: right;">Owner Price</th>
                    <th style="padding: 12px; text-align: right;">Cust. Price</th>
                    <th style="padding: 12px; text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHTML}
                </tbody>
              </table>

              <!-- Invoice Totals Summary -->
              <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
                <div style="background: #f1f5f9; border: 2px solid #cbd5e1; border-radius: 12px; padding: 18px 24px; min-width: 320px;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; font-weight: 700; color: #334155;">
                    <span>Total Products:</span>
                    <span>${(bill.items || []).length}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; font-weight: 700; color: #334155;">
                    <span>Total Quantity:</span>
                    <span>${bill.totalQuantity} units</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; border-top: 2px dashed #94a3b8; padding-top: 10px; font-size: 18px; font-weight: 900; color: #0f172a;">
                    <span>Grand Total:</span>
                    <span style="color: #059669;">₹${Number(bill.totalAmount || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              ${bill.notes ? `
                <div style="margin-top: 20px; padding: 12px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; font-size: 12px; color: #92400e;">
                  <strong>Notes:</strong> ${bill.notes}
                </div>
              ` : ''}

            </div>

            <!-- Modal Action Footer -->
            <div style="background: #f8fafc; border-top: 1.5px solid #e2e8f0; padding: 16px 24px; display: flex; justify-content: flex-end; gap: 12px;">
              <button onclick="app.printPurchaseBill('${bill.billNumber}')" style="padding: 10px 20px; background: #1e293b; color: #fff; border: none; border-radius: 8px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px;">🖨️ Print Bill</button>
              <button onclick="app.downloadPurchaseBillPDF('${bill.billNumber}')" style="padding: 10px 20px; background: #0284c7; color: #fff; border: none; border-radius: 8px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px;">📥 Download PDF</button>
              <button onclick="document.getElementById('purchaseBillViewModal').remove()" style="padding: 10px 20px; background: #cbd5e1; color: #0f172a; border: none; border-radius: 8px; font-weight: 800; cursor: pointer;">Close</button>
            </div>

          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHTML);
    } catch (err) {
      console.error('❌ Error viewing purchase bill:', err);
      alert('Error viewing purchase bill: ' + err.message);
    }
  }

  printPurchaseBill(billNumber) {
    const printArea = document.getElementById('purchaseBillPrintableArea');
    if (!printArea) return;
    const printWin = window.open('', '_blank');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Purchase Bill #${billNumber}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; color: #111; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 16px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
          th { background: #f1f5f9; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
        </style>
      </head>
      <body>
        ${printArea.innerHTML}
        <script>
          window.onload = function() { window.print(); window.close(); }
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  }

  downloadPurchaseBillPDF(billNumber) {
    this.printPurchaseBill(billNumber);
  }

  renderPurchaseHistoryModule() {
    const search = (this.purchaseSearch || '').toLowerCase().trim();
    let entries = this.stockEntries || [];

    if (this.purchaseDistributorFilter !== 'all') {
      entries = entries.filter(e => e.dealerId === this.purchaseDistributorFilter);
    }

    if (search) {
      entries = entries.filter(e => 
        (e.masterName || '').toLowerCase().includes(search) ||
        (e.dealerName || '').toLowerCase().includes(search) ||
        (e.barcode || '').toLowerCase().includes(search) ||
        (e.notes || '').toLowerCase().includes(search)
      );
    }

    const totalSpent = entries.reduce((s, e) => s + ((Number(e.purchasePrice) || 0) * (Number(e.initialQuantity) || 0)), 0);
    const totalUnits = entries.reduce((s, e) => s + (Number(e.initialQuantity) || 0), 0);

    return `
      <div class="owner-portal-page" style="min-height: 100vh; background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 50%, #f0f9ff 100%); color: #0f172a; padding-top: 96px; padding-bottom: 80px;">
        <div class="container" style="max-width: 1380px; margin: 0 auto; padding: 0 16px;">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
            <div>
              <button class="back-button" data-page="admin" style="margin-bottom: 12px;">← Dashboard</button>
              <h1 style="font-size: 36px; font-weight: 700; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 10px;">
                📦 Stock Purchase Transactions
              </h1>
              <p style="color: #475569; font-size: 14px; margin-top: 4px;">Log of all stock purchase batches received from distributors with cost prices and current available stock.</p>
            </div>

            <div style="display: flex; gap: 10px;">
              <button onclick="app.openPurchaseEntryModal()" style="background: linear-gradient(135deg, #059669, #047857); color: #fff; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 800; font-size: 15px; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 14px rgba(5,150,105,0.25);">
                📥 New Purchase Entry
              </button>
            </div>
          </div>

          <!-- KPI Summary -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px;">
            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 20px; text-align: center; box-shadow: 0 4px 16px rgba(0,0,0,0.05);">
              <div style="font-size: 26px; font-weight: 900; color: #0284c7;">${entries.length} Batches</div>
              <div style="font-size: 12px; font-weight: 800; color: #64748b; margin-top: 4px;">Total Purchase Entries</div>
            </div>
            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 20px; text-align: center; box-shadow: 0 4px 16px rgba(0,0,0,0.05);">
              <div style="font-size: 26px; font-weight: 900; color: #7c3aed;">${totalUnits} Units</div>
              <div style="font-size: 12px; font-weight: 800; color: #64748b; margin-top: 4px;">Total Purchased Qty</div>
            </div>
            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 20px; text-align: center; box-shadow: 0 4px 16px rgba(0,0,0,0.05);">
              <div style="font-size: 26px; font-weight: 900; color: #059669;">₹${totalSpent.toLocaleString('en-IN')}</div>
              <div style="font-size: 12px; font-weight: 800; color: #64748b; margin-top: 4px;">Total Purchase Investment</div>
            </div>
          </div>

          <!-- Filters -->
          <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 18px; margin-bottom: 24px; box-shadow: 0 4px 16px rgba(0,0,0,0.05);">
            <div style="display: flex; gap: 14px; flex-wrap: wrap; align-items: center; justify-content: space-between;">
              <input type="text" id="purSearchInput" value="${this.purchaseSearch || ''}"
                oninput="app.searchPurchases(this.value)"
                placeholder="🔍 Search product name, distributor, barcode, invoice..." 
                style="flex: 1; min-width: 280px; padding: 12px 16px; background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; color: #0f172a; font-size: 14px; font-weight: 600;">

              <select onchange="app.purchaseDistributorFilter = this.value; app.renderPage('admin-purchases');" style="padding: 12px 16px; background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; color: #0f172a; font-weight: 700;">
                <option value="all">All Distributors</option>
                ${(this.distributors || []).map(d => `<option value="${d.distributorId}" ${this.purchaseDistributorFilter === d.distributorId ? 'selected' : ''}>${d.name}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Table -->
          <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.06);">
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                <thead>
                  <tr style="background: #0f172a; color: #ffffff; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">
                    <th style="padding: 14px 16px;">Date</th>
                    <th style="padding: 14px 16px;">Product Name</th>
                    <th style="padding: 14px 16px;">Distributor</th>
                    <th style="padding: 14px 16px;">Barcode / ID</th>
                    <th style="padding: 14px 16px; text-align: right;">Unit Cost</th>
                    <th style="padding: 14px 16px; text-align: center;">Purchased</th>
                    <th style="padding: 14px 16px; text-align: center;">Remaining</th>
                    <th style="padding: 14px 16px; text-align: right;">Batch Value</th>
                    <th style="padding: 14px 16px; text-align: center;">Action</th>
                  </tr>
                </thead>
                <tbody id="purchasesTableBody">
                  ${entries.length === 0 ? `
                    <tr><td colspan="9" style="padding: 40px; text-align: center; color: #64748b;">No purchase entries recorded yet.</td></tr>
                  ` : entries.map(e => this.renderPurchaseRowHTML(e)).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderPurchaseRowHTML(e) {
    return `
      <tr style="border-bottom: 1px solid #e2e8f0; background: #ffffff;">
        <td style="padding: 14px 16px; color: #64748b; font-weight: 600;">${e.purchaseDate || e.createdAt?.split('T')[0]}</td>
        <td style="padding: 14px 16px; font-weight: 800; color: #0f172a;">${e.masterName}</td>
        <td style="padding: 14px 16px; font-weight: 700; color: #0284c7;">${e.dealerName || 'Direct'}</td>
        <td style="padding: 14px 16px; font-weight: 700; color: #7c3aed;">${e.barcode}</td>
        <td style="padding: 14px 16px; text-align: right; font-weight: 800; color: #dc2626;">₹${(Number(e.purchasePrice) || 0).toLocaleString('en-IN')}</td>
        <td style="padding: 14px 16px; text-align: center; font-weight: 800; color: #0f172a;">${e.initialQuantity || 0}</td>
        <td style="padding: 14px 16px; text-align: center; font-weight: 800; color: ${e.currentQuantity > 0 ? '#059669' : '#dc2626'};">${e.currentQuantity || 0}</td>
        <td style="padding: 14px 16px; text-align: right; font-weight: 800; color: #059669;">₹${((Number(e.purchasePrice) || 0) * (Number(e.initialQuantity) || 0)).toLocaleString('en-IN')}</td>
        <td style="padding: 14px 16px; text-align: center; white-space: nowrap;">
          <button onclick="app.openPurchaseDetailModal('${e.stockId}')" style="padding: 6px 10px; background: #3b82f6; color: #fff; border: none; border-radius: 6px; font-weight: 800; font-size: 11px; cursor: pointer; margin-right: 4px;">
            👁️ View
          </button>
          <button onclick="app.printDealerPurchaseBill('${e.stockId}')" style="padding: 6px 10px; background: #059669; color: #fff; border: none; border-radius: 6px; font-weight: 800; font-size: 11px; cursor: pointer; margin-right: 4px;">
            🖨️ Bill
          </button>
          <button onclick="app.printStockBarcodeSticker('${e.barcode}')" style="padding: 6px 10px; background: #0284c7; color: #fff; border: none; border-radius: 6px; font-weight: 800; font-size: 11px; cursor: pointer;">
            🏷️ Label
          </button>
        </td>
      </tr>
    `;
  }

  searchPurchases(value) {
    this.purchaseSearch = value || '';
    const search = (this.purchaseSearch || '').toLowerCase().trim();
    const distFilter = this.purchaseDistributorFilter || 'all';

    let entries = (this.stockEntries || []).filter(e => e.moduleType === 'Product' || !e.moduleType);
    if (distFilter !== 'all') {
      entries = entries.filter(e => e.dealerId === distFilter);
    }
    if (search) {
      entries = entries.filter(e => 
        (e.masterName || '').toLowerCase().includes(search) ||
        (e.dealerName || '').toLowerCase().includes(search) ||
        (e.barcode || '').toLowerCase().includes(search) ||
        (e.invoiceNumber || '').toLowerCase().includes(search)
      );
    }

    const tbody = document.getElementById('purchasesTableBody');
    if (tbody) {
      tbody.innerHTML = entries.length === 0 ? `
        <tr><td colspan="9" style="padding: 40px; text-align: center; color: #94a3b8;">No purchase entries recorded yet.</td></tr>
      ` : entries.map(e => this.renderPurchaseRowHTML(e)).join('');
    }
  }

  renderReportsModule() {
    const tab = this.activeReportTab || 'distributors';

    return `
      <div style="min-height: 100vh; background-color: #f13e74fb; color: #111; padding-top: 96px; padding-bottom: 80px;">
        <div class="container" style="max-width: 1300px; margin: 0 auto; padding: 0 16px;">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
            <div>
              <button class="back-button" data-page="admin" style="margin-bottom: 12px;">← Dashboard</button>
              <h1 style="font-size: 36px; font-weight: 800; color: #ffffff; margin: 0; display: flex; align-items: center; gap: 10px;">
                📊 Inventory Reports &amp; Stock Valuation
              </h1>
              <p style="color: #f8fafc; font-size: 14px; margin-top: 4px;">Distributor stock reports, product-wise supplier matrix, stock valuation, and low stock monitoring.</p>
            </div>

            <div style="display: flex; gap: 10px;">
              <button onclick="window.print()" style="background: #1e293b; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                🖨️ Print Report
              </button>
            </div>
          </div>

          <!-- Report Tabs -->
          <div style="display: flex; gap: 8px; flex-wrap: wrap; background: rgba(255, 255, 255, 0.97); border: 2px solid #dc2626; padding: 14px; border-radius: 14px; margin-bottom: 24px; box-shadow: 0 4px 16px rgba(0,0,0,0.1);">
            <button onclick="app.activeReportTab='distributors'; app.renderPage('admin-reports');" style="padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 800; border: none; cursor: pointer; background: ${tab === 'distributors' ? '#dc2626' : '#1e293b'}; color: #fff;">🤝 Distributor Purchase Report</button>
            <button onclick="app.activeReportTab='product-wise'; app.renderPage('admin-reports');" style="padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 800; border: none; cursor: pointer; background: ${tab === 'product-wise' ? '#dc2626' : '#1e293b'}; color: #fff;">📱 Product-Wise Supplier Matrix</button>
            <button onclick="app.activeReportTab='valuation'; app.renderPage('admin-reports');" style="padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 800; border: none; cursor: pointer; background: ${tab === 'valuation' ? '#dc2626' : '#1e293b'}; color: #fff;">💰 Stock Valuation</button>
            <button onclick="app.activeReportTab='low-stock'; app.renderPage('admin-reports');" style="padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 800; border: none; cursor: pointer; background: ${tab === 'low-stock' ? '#dc2626' : '#1e293b'}; color: #fff;">⚠️ Low Stock Alerts</button>
          </div>

          <!-- Report Body Container -->
          <div style="background: rgba(255, 255, 255, 0.97); border: 2px solid #dc2626; border-radius: 14px; padding: 24px; color: #111; box-shadow: 0 10px 30px rgba(0,0,0,0.15);">
            ${
              tab === 'distributors' ? this.renderDistributorStockReport() :
              tab === 'product-wise' ? this.renderProductWisePurchaseReport() :
              tab === 'valuation' ? this.renderStockValuationReport() :
              this.renderLowStockReport()
            }
          </div>
        </div>
      </div>
    `;
  }

  renderDistributorStockReport() {
    const distributors = this.distributors || [];
    const entries = this.stockEntries || [];

    return `
      <div>
        <h3 style="font-size: 20px; font-weight: 800; color: #dc2626; margin-bottom: 16px;">🤝 Distributor Purchase &amp; Stock Summary</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
          ${distributors.length === 0 ? `<div style="color: #64748b;">No distributors added yet. Click <strong>Distributors</strong> tab to add your first distributor.</div>` : distributors.map(d => {
            const dEntries = entries.filter(e => e.dealerId === d.distributorId || e.dealerName === d.name);
            const totalPurchased = dEntries.reduce((sum, e) => sum + (Number(e.initialQuantity) || 0), 0);
            const currentStock = dEntries.reduce((sum, e) => sum + (Number(e.currentQuantity) || 0), 0);
            const soldCount = Math.max(0, totalPurchased - currentStock);
            const totalValue = dEntries.reduce((sum, e) => sum + ((Number(e.purchasePrice) || 0) * (Number(e.currentQuantity) || 0)), 0);

            return `
              <div style="background: #ffffff; border: 2px solid #e2e8f0; border-radius: 12px; padding: 18px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                  <h4 style="font-size: 16px; font-weight: 800; color: #0f172a; margin: 0;">${d.name}</h4>
                  <span style="font-size: 11px; background: #0284c7; color: #fff; padding: 2px 8px; border-radius: 10px; font-weight: 700;">${d.code || 'Supplier'}</span>
                </div>
                <div style="font-size: 12px; color: #475569; margin-bottom: 12px;">📞 ${d.phone} &nbsp;·&nbsp; ${d.address || 'Local Market'}</div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; text-align: center;">
                  <div>
                    <div style="font-size: 16px; font-weight: 800; color: #0284c7;">${totalPurchased} pcs</div>
                    <div style="font-size: 10px; color: #64748b; font-weight: 700;">Total Purchased</div>
                  </div>
                  <div>
                    <div style="font-size: 16px; font-weight: 800; color: #059669;">${soldCount} pcs</div>
                    <div style="font-size: 10px; color: #64748b; font-weight: 700;">Units Sold</div>
                  </div>
                  <div>
                    <div style="font-size: 16px; font-weight: 800; color: #7c3aed;">${currentStock} pcs</div>
                    <div style="font-size: 10px; color: #64748b; font-weight: 700;">Available Stock</div>
                  </div>
                  <div>
                    <div style="font-size: 16px; font-weight: 800; color: #dc2626;">₹${totalValue.toLocaleString('en-IN')}</div>
                    <div style="font-size: 10px; color: #64748b; font-weight: 700;">Current Valuation</div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  renderProductWisePurchaseReport() {
    const products = this.products || [];
    const entries = this.stockEntries || [];

    return `
      <div>
        <h3 style="font-size: 20px; font-weight: 800; color: #dc2626; margin-bottom: 16px;">📱 Product-Wise Distributor Supply Matrix</h3>
        <div style="display: flex; flex-direction: column; gap: 20px;">
          ${products.length === 0 ? `<div style="color:#64748b;">No products available.</div>` : products.map(p => {
            const pEntries = entries.filter(e => String(e.masterId) === String(p.id || p._id));
            return `
              <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 18px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
                  <div>
                    <h4 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0;">${p.name}</h4>
                    <span style="font-size: 12px; color: #64748b;">Category: ${p.category} · Customer Price: ₹${(p.price || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div style="font-size: 16px; font-weight: 900; color: #059669; background: #dcfce7; padding: 4px 12px; border-radius: 8px;">
                    Total Available Stock: ${p.stock || 0} units
                  </div>
                </div>

                ${pEntries.length === 0 ? `<div style="font-size: 12px; color: #94a3b8;">No distributor purchase entries logged for this product. Initial stock directly added.</div>` : `
                  <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
                    <thead>
                      <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #475569;">
                        <th style="padding: 8px;">Distributor</th>
                        <th style="padding: 8px;">Purchase Date</th>
                        <th style="padding: 8px; text-align: right;">Unit Cost</th>
                        <th style="padding: 8px; text-align: center;">Initial Qty</th>
                        <th style="padding: 8px; text-align: center;">Remaining Qty</th>
                        <th style="padding: 8px;">Barcode / Batch</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${pEntries.map(e => `
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                          <td style="padding: 8px; font-weight: 700; color: #0284c7;">${e.dealerName || 'Direct'}</td>
                          <td style="padding: 8px; color: #64748b;">${e.purchaseDate}</td>
                          <td style="padding: 8px; text-align: right; font-weight: 700; color: #dc2626;">₹${(Number(e.purchasePrice) || 0).toLocaleString('en-IN')}</td>
                          <td style="padding: 8px; text-align: center;">${e.initialQuantity}</td>
                          <td style="padding: 8px; text-align: center; font-weight: 800; color: ${e.currentQuantity > 0 ? '#059669' : '#dc2626'};">${e.currentQuantity}</td>
                          <td style="padding: 8px; font-weight: 700; color: #7c3aed;">${e.barcode}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                `}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  renderStockValuationReport() {
    const entries = this.stockEntries || [];
    const activeEntries = entries.filter(e => (Number(e.currentQuantity) || 0) > 0);
    const totalValuation = activeEntries.reduce((sum, e) => sum + ((Number(e.purchasePrice) || 0) * (Number(e.currentQuantity) || 0)), 0);
    const totalUnits = activeEntries.reduce((sum, e) => sum + (Number(e.currentQuantity) || 0), 0);

    return `
      <div>
        <h3 style="font-size: 20px; font-weight: 800; color: #dc2626; margin-bottom: 16px;">💰 Total Inventory Stock Valuation</h3>
        
        <div style="background: linear-gradient(135deg, #065f46, #047857); color: #fff; padding: 24px; border-radius: 14px; margin-bottom: 24px; box-shadow: 0 10px 25px rgba(6,95,70,0.3);">
          <div style="font-size: 14px; text-transform: uppercase; font-weight: 700; opacity: 0.9;">Total Current Stock Valuation</div>
          <div style="font-size: 42px; font-weight: 900; margin: 8px 0;">₹${totalValuation.toLocaleString('en-IN')}</div>
          <div style="font-size: 14px;">Calculated across ${totalUnits} available units in ${activeEntries.length} active distributor purchase batches.</div>
        </div>

        <h4 style="font-size: 16px; font-weight: 800; color: #0f172a; margin-bottom: 12px;">Active Batch Valuation Breakdown</h4>
        <div style="overflow-x: auto; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
            <thead>
              <tr style="background: #1e293b; color: #fff;">
                <th style="padding: 10px;">Item Name</th>
                <th style="padding: 10px;">Distributor</th>
                <th style="padding: 10px; text-align: center;">Available Qty</th>
                <th style="padding: 10px; text-align: right;">Unit Cost Price</th>
                <th style="padding: 10px; text-align: right;">Total Stock Value</th>
              </tr>
            </thead>
            <tbody>
              ${activeEntries.length === 0 ? `<tr><td colspan="5" style="padding: 20px; text-align: center; color: #64748b;">No active stock batches found.</td></tr>` : activeEntries.map(e => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px; font-weight: 700; color: #0f172a;">${e.masterName}</td>
                  <td style="padding: 10px; font-weight: 700; color: #0284c7;">${e.dealerName || 'Direct'}</td>
                  <td style="padding: 10px; text-align: center; font-weight: 800;">${e.currentQuantity}</td>
                  <td style="padding: 10px; text-align: right; color: #dc2626; font-weight: 700;">₹${(Number(e.purchasePrice) || 0).toLocaleString('en-IN')}</td>
                  <td style="padding: 10px; text-align: right; color: #059669; font-weight: 800;">₹${((Number(e.purchasePrice) || 0) * (Number(e.currentQuantity) || 0)).toLocaleString('en-IN')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  renderLowStockReport() {
    const products = this.products || [];
    const lowStockProducts = products.filter(p => {
      const s = Number(p.stock) || 0;
      const min = Number(p.minStock) || 5;
      return s <= min;
    });

    return `
      <div>
        <h3 style="font-size: 20px; font-weight: 800; color: #dc2626; margin-bottom: 16px;">⚠️ Low Stock Monitoring &amp; Reorder Suggestions</h3>
        
        <div style="display: flex; flex-direction: column; gap: 14px;">
          ${lowStockProducts.length === 0 ? `
            <div style="background: #f0fdf4; border: 1px solid #86efac; color: #15803d; padding: 20px; border-radius: 10px; text-align: center; font-weight: 700;">
              🎉 All products are adequately stocked above minimum threshold levels!
            </div>
          ` : lowStockProducts.map(p => `
            <div style="background: #fff; border: 2px solid ${p.stock === 0 ? '#ef4444' : '#f59e0b'}; border-radius: 12px; padding: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
              <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 12px; font-weight: 800; padding: 2px 8px; border-radius: 4px; background: ${p.stock === 0 ? '#fee2e2' : '#fef3c7'}; color: ${p.stock === 0 ? '#dc2626' : '#d97706'};">
                    ${p.stock === 0 ? '🔴 OUT OF STOCK' : '⚠️ LOW STOCK'}
                  </span>
                  <h4 style="font-size: 16px; font-weight: 800; color: #0f172a; margin: 0;">${p.name}</h4>
                </div>
                <div style="font-size: 13px; color: #64748b; margin-top: 4px;">
                  Current Available: <strong style="color: #dc2626;">${p.stock} units</strong> · Min Threshold: ${p.minStock || 5} units
                </div>
              </div>

              <button onclick="app.openPurchaseEntryModal('${p.id || p._id}')" style="background: linear-gradient(135deg, #10b981, #059669); color: #fff; border: none; border-radius: 8px; padding: 10px 18px; font-weight: 800; font-size: 13px; cursor: pointer;">
                📥 Reorder Stock Now
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  openProductDistributorDetailsModal(productId) {
    const product = this.products.find(p => String(p.id || p._id) === String(productId));
    if (!product) return;

    const modalId = 'productDistributorModal';
    document.getElementById(modalId)?.remove();

    const batches = (this.stockEntries || []).filter(e => String(e.masterId) === String(productId));

    const totalPurchased = batches.reduce((sum, b) => sum + (Number(b.initialQuantity) || 0), 0);
    const totalAvailable = batches.reduce((sum, b) => sum + (Number(b.currentQuantity) || 0), 0);
    const totalSold = Math.max(0, totalPurchased - totalAvailable);

    const html = `
      <div id="${modalId}" style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 16px;">
        <div style="background: #0f172a; color: #fff; border: 1px solid #334155; border-radius: 16px; max-width: 720px; width: 100%; padding: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.7); max-height: 90vh; overflow-y: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #334155; padding-bottom: 12px;">
            <div>
              <h3 style="font-size: 20px; font-weight: 800; color: #38bdf8; margin: 0;">📱 ${product.name}</h3>
              <span style="font-size: 12px; color: #94a3b8;">Multi-Distributor Purchase Batches &amp; Inventory Breakdown</span>
            </div>
            <button onclick="document.getElementById('${modalId}').remove()" style="background: none; border: none; color: #94a3b8; font-size: 22px; cursor: pointer;">✕</button>
          </div>

          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; background: #1e293b; padding: 14px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #334155; text-align: center;">
            <div>
              <div style="font-size: 11px; color: #94a3b8;">Total Purchased</div>
              <div style="font-size: 20px; font-weight: 900; color: #38bdf8;">${totalPurchased} units</div>
            </div>
            <div>
              <div style="font-size: 11px; color: #94a3b8;">Total Sold</div>
              <div style="font-size: 20px; font-weight: 900; color: #f59e0b;">${totalSold} units</div>
            </div>
            <div>
              <div style="font-size: 11px; color: #94a3b8;">Available Stock</div>
              <div style="font-size: 20px; font-weight: 900; color: #34d399;">${totalAvailable} units</div>
            </div>
            <div>
              <div style="font-size: 11px; color: #94a3b8;">Selling Price</div>
              <div style="font-size: 20px; font-weight: 900; color: #f8fafc;">₹${(product.price || 0).toLocaleString('en-IN')}</div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h4 style="font-size: 14px; font-weight: 700; color: #cbd5e1; margin: 0;">Distributor Batches &amp; Purchase Sources (${batches.length})</h4>
            <button onclick="document.getElementById('${modalId}').remove(); app.openPurchaseEntryModal('${product.id || product._id}');" style="padding: 6px 14px; background: #059669; color: #fff; border: none; border-radius: 6px; font-weight: 800; font-size: 12px; cursor: pointer;">
              + Add Purchase Batch
            </button>
          </div>

          <div style="overflow-x: auto; background: #1e293b; border-radius: 8px; border: 1px solid #334155;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
              <thead>
                <tr style="background: #0f172a; color: #94a3b8; border-bottom: 1px solid #334155;">
                  <th style="padding: 10px;">Distributor</th>
                  <th style="padding: 10px;">Purchase Date</th>
                  <th style="padding: 10px; text-align: right;">Cost Price</th>
                  <th style="padding: 10px; text-align: center;">Purchased</th>
                  <th style="padding: 10px; text-align: center;">Sold</th>
                  <th style="padding: 10px; text-align: center;">Available</th>
                  <th style="padding: 10px;">Barcode / IMEI</th>
                </tr>
              </thead>
              <tbody>
                ${batches.length === 0 ? `
                  <tr><td colspan="7" style="padding: 20px; text-align: center; color: #64748b;">No distributor batches logged yet. Stock was directly entered.</td></tr>
                ` : batches.map(b => {
                  const sold = Math.max(0, (Number(b.initialQuantity) || 0) - (Number(b.currentQuantity) || 0));
                  return `
                    <tr style="border-bottom: 1px solid #334155;">
                      <td style="padding: 10px; font-weight: 700; color: #38bdf8;">${b.dealerName || 'Direct Purchase'}</td>
                      <td style="padding: 10px; color: #cbd5e1;">${b.purchaseDate}</td>
                      <td style="padding: 10px; text-align: right; font-weight: 800; color: #fb7185;">₹${(Number(b.purchasePrice) || 0).toLocaleString('en-IN')}</td>
                      <td style="padding: 10px; text-align: center; font-weight: 700;">${b.initialQuantity}</td>
                      <td style="padding: 10px; text-align: center; font-weight: 700; color: #f59e0b;">${sold}</td>
                      <td style="padding: 10px; text-align: center; font-weight: 900; color: ${b.currentQuantity > 0 ? '#34d399' : '#f87171'};">${b.currentQuantity}</td>
                      <td style="padding: 10px; font-weight: 700; color: #a78bfa;">
                        ${b.barcode}
                        ${b.imei1 ? `<div style="font-size: 10px; color: #94a3b8; font-weight: 400;">IMEI: ${b.imei1}</div>` : ''}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <div style="display: flex; justify-content: flex-end; margin-top: 20px;">
            <button onclick="document.getElementById('${modalId}').remove()" style="padding: 10px 20px; background: #334155; color: #fff; border: none; border-radius: 8px; font-weight: 700; cursor: pointer;">Close</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
  }

  generateStockBarcode(moduleType) {
    const prefix = moduleType === 'Product' ? 'STK-PROD-' : moduleType === 'Display' ? 'STK-DISP-' : 'STK-SP-';
    const count = (this.stockEntries || []).filter(e => e.moduleType === moduleType).length;
    const numStr = String(count + 1).padStart(6, '0');
    return `${prefix}${numStr}`;
  }

  printStockBarcodeLabel(barcode, printFormat = 'browser') {
    const entry = (this.stockEntries || []).find(e => e.barcode === barcode) || {
      barcode,
      masterName: 'Product Item',
      dealerName: 'Dealer',
      purchaseDate: new Date().toISOString().split('T')[0],
      sellingPrice: 0,
      stockId: barcode
    };

    this.printUnifiedThermalLabel({
      barcode: entry.barcode,
      title: entry.masterName,
      subtitle: entry.dealerName || 'DEALER',
      price: entry.sellingPrice || entry.mrp || 0
    });
  }

  printUnifiedThermalLabel({ barcode, title, subtitle, price }) {
    const barVal = (barcode || '').trim();
    const shopTitle = (this.shopSettings?.shopName || 'JIVI MOBILES').substring(0, 22).toUpperCase();
    const itemTitle = (title || 'PRODUCT ITEM').substring(0, 22).toUpperCase();
    const itemSub = (subtitle || '').substring(0, 18).toUpperCase();
    const priceVal = Number(price) || 0;
    const priceStr = priceVal > 0 ? `₹${priceVal.toLocaleString('en-IN')}` : '';

    const win = window.open('', '_blank', 'width=920,height=480');
    if (!win) {
      alert('Please allow popups to print barcode thermal labels.');
      return;
    }

    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>TSC Label - ${barVal}</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }

    /* ── Screen layout ── */
    body {
      font-family: Arial, Helvetica, sans-serif;
      background: #f1f5f9;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 24px 16px;
      min-height: 100vh;
    }
    h2 { font-size: 17px; font-weight: 800; color: #1e293b; margin-bottom: 4px; }
    .hint { font-size: 12px; color: #64748b; margin-bottom: 18px; text-align:center; line-height:1.5; }
    .hint strong { color: #1e293b; }

    /* ── Label strip container ── */
    .scale-wrap {
      zoom: 2;
      margin-top: 12px;
      margin-bottom: 16px;
      flex-shrink: 0;
      max-width: 100%;
      overflow: hidden;
    }
    .strip {
      display: flex;
      flex-direction: row;
      width: 101.5mm;
      height: 25mm;
      background: #fff;
      border: 0.3mm solid #ccc;
    }
    .label {
      width: 33.83mm;
      height: 25mm;
      border-right: 0.2mm dashed #ccc;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 1.2mm 0.5mm 0.5mm 0.5mm;
      overflow: hidden;
      gap: 0;
    }
    .label:last-child { border-right: none; }
    .shop {
      font-size: 7pt;
      font-weight: 900;
      text-align: center;
      color: #000;
      line-height: 1.1;
      letter-spacing: 0.2px;
      white-space: nowrap;
      margin-bottom: 0.3mm;
    }
    svg.bc, canvas.bc {
      display: block;
      max-width: 30mm;
      width: 30mm;
      height: 9.5mm !important;
      margin: 0 auto;
      object-fit: contain;
    }
    .barnum {
      font-size: 6.5pt;
      font-weight: 700;
      color: #000;
      letter-spacing: 0.8px;
      text-align: center;
      margin-top: 0.3mm;
      margin-bottom: 0.3mm;
      line-height: 1.1;
    }
    .device {
      font-size: 6.5pt;
      font-weight: 800;
      color: #000;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 31mm;
      text-transform: uppercase;
      letter-spacing: 0.2px;
      line-height: 1.1;
      margin-top: 0.2mm;
    }
    .subinfo {
      font-size: 6pt;
      font-weight: 700;
      color: #059669;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 31mm;
      text-transform: uppercase;
      letter-spacing: 0.2px;
      margin-top: 0.2mm;
      line-height: 1.1;
    }

    /* ── Print button ── */
    .print-btn {
      padding: 12px 44px;
      background: #1e293b;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0,0,0,0.18);
      margin-top: 8px;
    }
    .print-btn:hover { background: #0f172a; }
    .steps {
      margin-top: 12px;
      font-size: 11px;
      color: #64748b;
      text-align: center;
      line-height: 1.8;
    }
    .steps span { color: #1e293b; font-weight: 700; }

    /* ── Print mode: only the strip, exact paper size ── */
    @media print {
      @page {
        size: 25mm 101.5mm portrait;
        margin: 0;
      }
      html,
      body {
        width: 25mm;
        height: 101.5mm;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: #fff;
      }
      body * {
        visibility: hidden;
      }
      .print-strip,
      .print-strip * {
        visibility: visible;
      }
      .print-strip {
        display: flex !important;
        flex-direction: column !important;
        width: 25mm !important;
        height: 101.5mm !important;
        position: absolute;
        top: 0;
        left: 0;
      }
      .label {
        width: 25mm !important;
        height: 33.83mm !important;
        border-right: none !important;
        position: relative !important;
        overflow: hidden !important;
      }
      .label-inner {
        width: 33.83mm !important;
        height: 25mm !important;
        position: absolute !important;
        top: 4.415mm !important;
        left: -4.415mm !important;
        transform: rotate(90deg);
        transform-origin: center !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: flex-start !important;
        padding: 1.2mm 0.5mm 0.5mm 0.5mm !important;
        box-sizing: border-box !important;
      }
      h2, .hint, .print-btn, .steps, .scale-wrap {
        display: none !important;
      }
    }
  </style>
</head>
<body>

  <h2>🏷️ TSC Label Preview — ${barVal}</h2>
  <div class="hint">
    Paper: <strong>101.5 mm × 25 mm</strong> &nbsp;|&nbsp; 3 labels per strip<br>
    Select your <strong>TSC / Zenpert</strong> printer in the print dialog
  </div>

  <!-- Screen preview (scaled up 3.5×) -->
  <div class="scale-wrap">
    <div class="strip">
      <div class="label">
        <div class="shop">${shopTitle}</div>
        <canvas class="bc" id="bc1"></canvas>
        <div class="barnum">${barVal}</div>
        <div class="device">${itemTitle}</div>
        ${priceStr ? `<div class="subinfo">${priceStr}</div>` : ''}
      </div>
      <div class="label">
        <div class="shop">${shopTitle}</div>
        <canvas class="bc" id="bc2"></canvas>
        <div class="barnum">${barVal}</div>
        <div class="device">${itemTitle}</div>
        ${priceStr ? `<div class="subinfo">${priceStr}</div>` : ''}
      </div>
      <div class="label">
        <div class="shop">${shopTitle}</div>
        <canvas class="bc" id="bc3"></canvas>
        <div class="barnum">${barVal}</div>
        <div class="device">${itemTitle}</div>
        ${priceStr ? `<div class="subinfo">${priceStr}</div>` : ''}
      </div>
    </div>
  </div>

  <button class="print-btn" onclick="window.print()">🖨️ Print to TSC Printer</button>

  <div class="steps">
    In the print dialog: &nbsp;
    ① Select <span>TSC / Zenpert</span> printer &nbsp;
    ② Paper size → <span>LABEL25</span> &nbsp;
    ③ Layout → <span>Portrait</span> &nbsp;
    ④ Margins → <span>None</span> &nbsp;
    ⑤ Click <span>Print</span>
  </div>

  <!-- Hidden print-only strip (exact size, no transform) -->
  <div class="print-strip" style="display:none;">
    <div class="label">
      <div class="label-inner">
        <div class="shop">${shopTitle}</div>
        <canvas class="bc" id="bcp1"></canvas>
        <div class="barnum">${barVal}</div>
        <div class="device">${itemTitle}</div>
        ${priceStr ? `<div class="subinfo">${priceStr}</div>` : ''}
      </div>
    </div>
    <div class="label">
      <div class="label-inner">
        <div class="shop">${shopTitle}</div>
        <canvas class="bc" id="bcp2"></canvas>
        <div class="barnum">${barVal}</div>
        <div class="device">${itemTitle}</div>
        ${priceStr ? `<div class="subinfo">${priceStr}</div>` : ''}
      </div>
    </div>
    <div class="label">
      <div class="label-inner">
        <div class="shop">${shopTitle}</div>
        <canvas class="bc" id="bcp3"></canvas>
        <div class="barnum">${barVal}</div>
        <div class="device">${itemTitle}</div>
        ${priceStr ? `<div class="subinfo">${priceStr}</div>` : ''}
      </div>
    </div>
  </div>

  <script>
    function renderBarcodes() {
      const opts = {
        format: 'CODE128',
        width: 1.5,
        height: 22,
        displayValue: false,
        margin: 0
      };
      ['bc1','bc2','bc3','bcp1','bcp2','bcp3'].forEach(id => {
        const c = document.getElementById(id);
        if (c && typeof JsBarcode !== 'undefined') {
          try {
            JsBarcode(c, '${barVal}', opts);
            c.style.width = '30mm';
            c.style.height = '9.5mm';
          } catch(e) {}
        }
      });
    }
    if (typeof JsBarcode !== 'undefined') { renderBarcodes(); }
    else { window.onload = renderBarcodes; }
  <\/script>
</body>
</html>`);
    win.document.close();
  }

  async lookupBarcode(code) {
    const barcodeStr = String(code).trim();
    if (!barcodeStr) return;

    let entry = (this.stockEntries || []).find(e => e.barcode === barcodeStr || e.imei1 === barcodeStr || e.imei2 === barcodeStr || e.serialNumber === barcodeStr);

    if (!entry) {
      try {
        const res = await fetch(`${this.API_URL}/stock-entries/barcode/${barcodeStr}`);
        if (res.ok) {
          entry = await res.json();
        }
      } catch (err) {
        console.error('❌ Barcode lookup error:', err);
      }
    }

    if (!entry) {
      alert(`⚠️ Barcode / Serial "${barcodeStr}" not found in inventory.`);
      return;
    }

    const modalId = 'barcodeLookupModal';
    document.getElementById(modalId)?.remove();

    const movements = (this.stockMovements || []).filter(m => m.stockEntryId === entry.stockId || m.barcode === entry.barcode);

    const html = `
      <div id="${modalId}" style="position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 16px;">
        <div style="background: #0f172a; color: #fff; border: 1px solid #334155; border-radius: 16px; max-width: 550px; width: 100%; padding: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 12px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 24px;">🏷️</span>
              <div>
                <h3 style="font-size: 18px; font-weight: 800; color: #38bdf8; margin: 0;">Stock Barcode Lookup</h3>
                <span style="font-size: 11px; font-weight: 700; background: #0284c7; color: #fff; padding: 2px 8px; border-radius: 4px;">${entry.barcode}</span>
              </div>
            </div>
            <button onclick="document.getElementById('${modalId}').remove()" style="background: none; border: none; color: #94a3b8; font-size: 22px; cursor: pointer;">✕</button>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: rgba(30, 41, 59, 0.6); padding: 16px; border-radius: 10px; border: 1px solid #334155; margin-bottom: 16px;">
            <div>
              <div style="font-size: 11px; color: #94a3b8;">Item Name</div>
              <div style="font-size: 15px; font-weight: 800; color: #f8fafc;">${entry.masterName}</div>
            </div>

            <div>
              <div style="font-size: 11px; color: #94a3b8;">Module Category</div>
              <div style="font-size: 13px; font-weight: 700; color: #34d399;">${entry.moduleType}</div>
            </div>

            <div>
              <div style="font-size: 11px; color: #94a3b8;">Dealer / Supplier</div>
              <div style="font-size: 13px; font-weight: 700; color: #fbbf24;">${entry.dealerName || 'Direct'}</div>
            </div>

            <div>
              <div style="font-size: 11px; color: #94a3b8;">Purchase Date</div>
              <div style="font-size: 13px; font-weight: 700; color: #f8fafc;">${entry.purchaseDate}</div>
            </div>

            <div>
              <div style="font-size: 11px; color: #94a3b8;">Purchase Price</div>
              <div style="font-size: 14px; font-weight: 800; color: #fb7185;">₹${(Number(entry.purchasePrice) || 0).toLocaleString('en-IN')}</div>
            </div>

            <div>
              <div style="font-size: 11px; color: #94a3b8;">Selling Price</div>
              <div style="font-size: 14px; font-weight: 800; color: #34d399;">₹${(Number(entry.sellingPrice) || 0).toLocaleString('en-IN')}</div>
            </div>

            <div>
              <div style="font-size: 11px; color: #94a3b8;">Stock Quantity</div>
              <div style="font-size: 14px; font-weight: 800; color: ${entry.currentQuantity > 0 ? '#38bdf8' : '#f87171'};">
                ${entry.currentQuantity} / ${entry.initialQuantity} remaining
              </div>
            </div>

            <div>
              <div style="font-size: 11px; color: #94a3b8;">Status</div>
              <div style="font-size: 12px; font-weight: 700; color: ${entry.currentQuantity > 0 ? '#34d399' : '#f87171'};">
                ${entry.status || (entry.currentQuantity > 0 ? 'In Stock' : 'Out of Stock')}
              </div>
            </div>

            ${entry.imei1 ? `<div style="grid-column: span 2;"><span style="font-size: 11px; color: #94a3b8;">IMEI 1 / 2: </span><span style="font-weight: 700; color: #fff;">${entry.imei1} ${entry.imei2 ? '/ ' + entry.imei2 : ''}</span></div>` : ''}
            ${entry.serialNumber ? `<div style="grid-column: span 2;"><span style="font-size: 11px; color: #94a3b8;">Serial Number: </span><span style="font-weight: 700; color: #fff;">${entry.serialNumber}</span></div>` : ''}
          </div>

          <!-- Movement Log -->
          <div style="margin-bottom: 16px;">
            <div style="font-size: 12px; font-weight: 700; color: #94a3b8; margin-bottom: 6px;">STOCK MOVEMENTS HISTORY</div>
            <div style="max-height: 120px; overflow-y: auto; background: #1e293b; border-radius: 8px; padding: 8px;">
              ${movements.length === 0 ? `<div style="font-size: 11px; color: #64748b;">No movement history logged yet.</div>` : movements.map(m => `
                <div style="font-size: 11px; display: flex; justify-content: space-between; border-bottom: 1px solid #334155; padding: 4px 0;">
                  <span><strong>${m.movementType}</strong> (${m.quantity} pcs) - ${m.notes || m.reason || ''}</span>
                  <span style="color: #64748b;">${m.date}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Action Buttons -->
          <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button onclick="app.printStockBarcodeLabel('${entry.barcode}', 'browser')" style="padding: 10px 16px; background: #0284c7; color: #fff; border: none; border-radius: 8px; font-weight: 700; cursor: pointer;">
              🖨️ Print Label
            </button>
            <button onclick="document.getElementById('${modalId}').remove()" style="padding: 10px 16px; background: #334155; color: #fff; border: none; border-radius: 8px; cursor: pointer;">
              Close
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
  }



  async renderPage(page) {
    const app = document.getElementById("app")
    this.currentPage = page

    if (page.startsWith("admin") && !this.isAdminLoggedIn) {
      page = "admin-login"
    }

    let html = this.renderNavigation()

    if (page === "admin-login") {
      html += this.renderAdminLogin()
    } else if (page === "admin") {
      html += this.renderAdmin()
    } else if (page === "admin-products") {
      html += this.renderAdminProducts()
    } else if (page === "admin-tracking") {
      html += this.renderAdminTracking()
    } else if (page === "admin-tracking-daily") {
      html += this.renderTrackingDailyIncome()
    } else if (page === "admin-tracking-monthly") {
      html += this.renderTrackingMonthlyIncome()
    } else if (page === "admin-orders") {
      html += this.renderAdminOrders()
    } else if (page === "admin-sales") {
      html += this.renderAdminSales()
    } else if (page === "admin-sales-monthly") {
      html += this.renderMonthlySales()
    } else if (page === "admin-services") {
      html += this.renderAdminServices()
    } else if (page === "admin-services-daily") {
      html += this.renderDailyServices()
    } else if (page === "admin-services-monthly") {
      html += this.renderMonthlyServices()
    } else if (page === "admin-display-stock") {
      html += this.renderDisplayStock()
    } else if (page === "admin-spare-parts") {
      html += this.renderSpareParts()
    } else if (page === "admin-full-stock") {
      html += this.renderFullStockInventory()
    } else if (page === "admin-add-product") {
      html += this.renderAddProductForm()
    } else if (page === "admin-edit-product") {
      html += this.renderEditProductForm()
    } else if (page === "admin-distributors") {
      html += this.renderDistributorsModule()
    } else if (page === "admin-distributor-history") {
      html += this.renderDistributorHistoryModule()
    } else if (page === "admin-purchase-bills") {
      html += this.renderPurchaseBillsModule()
    } else if (page === "admin-purchases") {
      html += this.renderPurchaseHistoryModule()
    } else if (page === "admin-reports") {
      html += this.renderReportsModule()
    }

    html += this.renderFooter()

    app.innerHTML = html
  }

  renderNavigation() {
    return `
      <nav>
        <div class="nav-content">
          <div class="nav-brand" data-page="admin" style="cursor: pointer; display: flex; align-items: center; gap: 12px;">
            <div class="nav-logo">
              <img src="logo.jpg?v=20260822" alt="Jivi Mobiles Logo" style="width: 48px; height: 48px; object-fit: contain; border-radius: 50%; box-shadow: 0 2px 10px rgba(0,0,0,0.15);">
            </div>
            <div class="nav-title" data-page="admin">
              <div style="font-size: 16px; font-weight: 800; white-space: nowrap;">OWNER PORTAL</div>
              <div style="font-size: 10px; font-weight: 600; margin-top: 1px; color: #64748b;">ஜிவி மொபைல்ஸ் — Jivi Mobiles Management</div>
            </div>
          </div>
          
          <ul class="nav owner-nav-pills">
            ${this.isAdminLoggedIn ? `
              <li class="nav-item">
                <a class="owner-nav-link ${this.currentPage === 'admin' ? 'active' : ''}" data-page="admin">👑 Dashboard</a>
              </li>
              <li class="nav-item">
                <a class="owner-nav-link ${this.currentPage === 'admin-products' ? 'active' : ''}" data-page="admin-products">📦 Products</a>
              </li>
              <li class="nav-item">
                <a class="owner-nav-link ${this.currentPage === 'admin-tracking' ? 'active' : ''}" data-page="admin-tracking">🔧 Tracking</a>
              </li>
              <li class="nav-item">
                <a class="owner-nav-link ${this.currentPage === 'admin-orders' ? 'active' : ''}" data-page="admin-orders">📋 Orders</a>
              </li>
              <li class="nav-item">
                <a class="owner-nav-link ${this.currentPage === 'admin-sales' || this.currentPage === 'admin-sales-monthly' ? 'active' : ''}" data-page="admin-sales">🛍️ Sales</a>
              </li>
              <li class="nav-item">
                <a class="owner-nav-link ${this.currentPage === 'admin-display-stock' ? 'active' : ''}" data-page="admin-display-stock">📱 Display Stock</a>
              </li>
              <li class="nav-item">
                <a class="owner-nav-link ${this.currentPage === 'admin-spare-parts' ? 'active' : ''}" data-page="admin-spare-parts">🔩 Spare Parts</a>
              </li>
              <li class="nav-item">
                <a class="owner-nav-link ${this.currentPage === 'admin-distributors' || this.currentPage === 'admin-distributor-history' ? 'active' : ''}" data-page="admin-distributors">🤝 Distributors</a>
              </li>
              <li class="nav-item">
                <a class="owner-nav-link ${this.currentPage === 'admin-purchase-bills' ? 'active' : ''}" data-page="admin-purchase-bills">📄 Purchase Bills</a>
              </li>


              <li class="nav-item">
                <a class="owner-nav-link" href="index.html">🌐 Main Site</a>
              </li>
              <li class="nav-item">
                <a class="owner-nav-link admin-pill" data-action="admin-logout" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5;">🚪 Logout</a>
              </li>
            ` : `
              <li class="nav-item">
                <a class="owner-nav-link" href="index.html">🌐 Main Site</a>
              </li>
            `}
          </ul>
        </div>
      </nav>
    `
  }

  renderAdminLogin() {
    return `
      <div style="min-height: 100vh; background-color: #020617; padding-top: 96px; display: flex; align-items: center; justify-content: center;">
        <div style="background-color: rgba(30, 41, 59, 0.5); border: 1px solid #334155; border-radius: 12px; padding: 48px; max-width: 400px; width: 100%; margin: 0 16px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 32px; font-weight: 700; margin-bottom: 8px;">Owner Portal</h1>
            <p style="color: #94a3b8;">Enter your credentials to access the management panel</p>
          </div>
          
          <div class="form-field">
            <label class="form-label">Phone Number</label>
            <input type="tel" class="input" placeholder="Enter phone number" id="adminPhone"
              onkeydown="if(event.key === 'Enter') app.handleAdminLogin()">
          </div>
          
          <div class="form-field">
            <label class="form-label">Password</label>
            <input type="password" class="input" placeholder="Enter password" id="adminPassword"
              onkeydown="if(event.key === 'Enter') app.handleAdminLogin()">
          </div>

          <button class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 16px;" data-action="admin-login">Login</button>
          
          <div style="margin-top: 24px; text-align: center;">
            <a href="index.html" style="color: #94a3b8; text-decoration: none; font-size: 14px;">← Back to Main Site</a>
          </div>
        </div>
      </div>
    `
  }
 
  renderAdmin() {
    const totalProductsCount = (this.products || []).length;
    const activeDistributorsCount = (this.distributors || []).filter(d => d.status !== 'Inactive').length;
    const totalStockUnitsCount = (this.products || []).reduce((s, p) => s + (Number(p.stock) || 0), 0)
      + (this.displayStock || []).reduce((s, d) => s + (Number(d.stock) || 0), 0)
      + (this.sparePartsStock || []).reduce((s, sp) => s + (Number(sp.stock) || 0), 0);
    const purchaseBatchesCount = (this.stockEntries || []).length;
    const lowStockItemsCount = (this.products || []).filter(p => (Number(p.stock) || 0) <= 2).length
      + (this.displayStock || []).filter(d => (Number(d.stock) || 0) <= 2).length
      + (this.sparePartsStock || []).filter(sp => (Number(sp.stock) || 0) <= 2).length;
    const activeProductsValuation = (this.products || []).reduce((s, p) => s + ((Number(p.price) || Number(p.mrp) || 0) * (Number(p.stock) || 0)), 0);
    const displayStockValuation = (this.displayStock || []).reduce((s, d) => s + ((Number(d.sellingPrice) || Number(d.price) || 0) * (Number(d.stock) || 0)), 0);
    const sparePartsValuation = (this.sparePartsStock || []).reduce((s, sp) => s + ((Number(sp.customerPrice) || Number(sp.sellingPrice) || Number(sp.price) || 0) * (Number(sp.stock) || 0)), 0);
    const totalStockValuation = activeProductsValuation + displayStockValuation + sparePartsValuation;

    return `
      <div class="owner-portal-page" style="min-height: 100vh; background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 50%, #f0f9ff 100%); color: #0f172a; padding-top: 96px; padding-bottom: 80px;">
        <div class="container" style="max-width: 1380px; margin: 0 auto; padding: 0 20px;">
          <div style="margin-bottom: 28px;">
            <h1 style="font-size: 38px; font-weight: 800; color: #0f172a; margin-bottom: 6px;">👑 Owner Dashboard</h1>
            <p style="color: #475569; font-size: 15px; font-weight: 600;">Manage your products, repair tracking, customer orders & distributor stocks</p>
          </div>

          <!-- Quick Navigation Buttons Grid (Perfect Symmetrical Alignment) -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 32px;">
            <button class="btn btn-primary" onclick="app.openPOSBillingModal()" style="padding: 14px 12px; font-size: 13.5px; font-weight:800; display: flex; align-items: center; justify-content: center; gap: 6px; background: linear-gradient(135deg, #0284c7, #0369a1); border:1.5px solid #38bdf8; border-radius:12px; color:#ffffff !important; box-shadow:0 4px 14px rgba(2,132,199,0.25);">
              <span style="font-size: 18px;">🧾</span>
              <span style="color:#ffffff !important;"><strong>POS Billing</strong></span>
            </button>

            <button class="btn" data-page="admin-products" style="padding: 14px 12px; font-size: 13.5px; font-weight:800; display: flex; align-items: center; justify-content: center; gap: 6px; background:#ffffff; border:1.5px solid #cbd5e1; border-radius:12px; color:#0f172a !important; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
              <span style="font-size: 18px;">📦</span>
              <span style="color:#0f172a !important;">Products</span>
            </button>

            <button class="btn" data-page="admin-tracking" style="padding: 14px 12px; font-size: 13.5px; font-weight:800; display: flex; align-items: center; justify-content: center; gap: 6px; background:#ffffff; border:1.5px solid #cbd5e1; border-radius:12px; color:#0f172a !important; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
              <span style="font-size: 18px;">🔧</span>
              <span style="color:#0f172a !important;">Tracking</span>
            </button>

            <button class="btn" data-page="admin-orders" style="padding: 14px 12px; font-size: 13.5px; font-weight:800; display: flex; align-items: center; justify-content: center; gap: 6px; background:#ffffff; border:1.5px solid #cbd5e1; border-radius:12px; color:#0f172a !important; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
              <span style="font-size: 18px;">📋</span>
              <span style="color:#0f172a !important;">Orders</span>
            </button>

            <button class="btn" data-page="admin-sales" style="padding: 14px 12px; font-size: 13.5px; font-weight:800; display: flex; align-items: center; justify-content: center; gap: 6px; background:#ffffff; border:1.5px solid #cbd5e1; border-radius:12px; color:#0f172a !important; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
              <span style="font-size: 18px;">🛍️</span>
              <span style="color:#0f172a !important;">Sales Records</span>
            </button>

            <button class="btn" data-page="admin-display-stock" style="padding: 14px 12px; font-size: 13.5px; font-weight:800; display: flex; align-items: center; justify-content: center; gap: 6px; background:#ffffff; border:1.5px solid #cbd5e1; border-radius:12px; color:#0f172a !important; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
              <span style="font-size: 18px;">📱</span>
              <span style="color:#0f172a !important;">Display Stock</span>
            </button>

            <button class="btn" data-page="admin-spare-parts" style="padding: 14px 12px; font-size: 13.5px; font-weight:800; display: flex; align-items: center; justify-content: center; gap: 6px; background:#ffffff; border:1.5px solid #cbd5e1; border-radius:12px; color:#0f172a !important; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
              <span style="font-size: 18px;">🔩</span>
              <span style="color:#0f172a !important;">Spare Parts</span>
            </button>

            <button class="btn" data-page="admin-distributors" style="padding: 14px 12px; font-size: 13.5px; font-weight:800; display: flex; align-items: center; justify-content: center; gap: 6px; background: linear-gradient(135deg, #0284c7, #0369a1); border:1.5px solid #38bdf8; border-radius:12px; color:#ffffff !important; box-shadow:0 4px 14px rgba(2,132,199,0.25);">
              <span style="font-size: 18px;">🤝</span>
              <span style="color:#ffffff !important;">Distributors</span>
            </button>

            <button class="btn" data-page="admin-purchase-bills" style="padding: 14px 12px; font-size: 13.5px; font-weight:800; display: flex; align-items: center; justify-content: center; gap: 6px; background: linear-gradient(135deg, #059669, #047857); border:1.5px solid #34d399; border-radius:12px; color:#ffffff !important; box-shadow:0 4px 14px rgba(5,150,105,0.25);">
              <span style="font-size: 18px;">📄</span>
              <span style="color:#ffffff !important;">Purchase Bills</span>
            </button>

          </div>

          <!-- Quick Stats Cards (Complete Inventory & Valuation Theme) -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 16px; margin-bottom: 36px;">
            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 16px; padding: 20px 14px; text-align: center; box-shadow: 0 4px 16px rgba(0,0,0,0.05);">
              <div style="font-size: 32px; font-weight: 900; color: #0284c7; margin-bottom: 4px;">${totalProductsCount}</div>
              <div style="color: #475569; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Total Products</div>
            </div>

            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 16px; padding: 20px 14px; text-align: center; box-shadow: 0 4px 16px rgba(0,0,0,0.05);">
              <div style="font-size: 32px; font-weight: 900; color: #4f46e5; margin-bottom: 4px;">${activeDistributorsCount}</div>
              <div style="color: #475569; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Active Distributors</div>
            </div>

            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 16px; padding: 20px 14px; text-align: center; box-shadow: 0 4px 16px rgba(0,0,0,0.05);">
              <div style="font-size: 32px; font-weight: 900; color: #059669; margin-bottom: 4px;">${totalStockUnitsCount}</div>
              <div style="color: #475569; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Total Stock Units</div>
            </div>

            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 16px; padding: 20px 14px; text-align: center; box-shadow: 0 4px 16px rgba(0,0,0,0.05);">
              <div style="font-size: 32px; font-weight: 900; color: #d97706; margin-bottom: 4px;">${purchaseBatchesCount}</div>
              <div style="color: #475569; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Purchase Batches</div>
            </div>

            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 16px; padding: 20px 14px; text-align: center; box-shadow: 0 4px 16px rgba(0,0,0,0.05);">
              <div style="font-size: 32px; font-weight: 900; color: ${lowStockItemsCount > 0 ? '#dc2626' : '#64748b'}; margin-bottom: 4px;">${lowStockItemsCount}</div>
              <div style="color: #475569; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Low Stock Items</div>
            </div>

            <div style="background: linear-gradient(135deg, #059669, #047857); border: 1.5px solid #34d399; border-radius: 16px; padding: 20px 14px; text-align: center; box-shadow: 0 6px 20px rgba(5,150,105,0.25);">
              <div style="font-size: 26px; font-weight: 900; color: #ffffff; margin-bottom: 4px;">₹${totalStockValuation.toLocaleString('en-IN')}</div>
              <div style="color: #ecfdf5; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">Stock Valuation</div>
            </div>
          </div>

          <!-- Welcome Section -->
          <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 20px; padding: 40px; text-align: center; box-shadow: 0 8px 30px rgba(0,0,0,0.06);">
            <div style="font-size: 56px; margin-bottom: 12px;">👑</div>
            <h2 style="font-size: 30px; font-weight: 800; margin-bottom: 10px; color: #0f172a;">Welcome to Owner Control Center</h2>
            <p style="font-size: 15px; color: #475569; margin-bottom: 32px; max-width: 600px; margin-left: auto; margin-right: auto;">Manage shop inventory, track customer repairs, process POS sales, and review distributor stock valuations.</p>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 18px; max-width: 900px; margin: 0 auto;">
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 22px; text-align: center; cursor: pointer;" data-page="admin-products">
                <div style="font-size: 32px; margin-bottom: 8px;">📦</div>
                <h3 style="font-size: 17px; font-weight: 800; margin-bottom: 4px; color: #0f172a;">Products</h3>
                <p style="font-size: 13px; color: #475569;">Manage stock &amp; pricing</p>
              </div>
              
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 22px; text-align: center; cursor: pointer;" data-page="admin-tracking">
                <div style="font-size: 32px; margin-bottom: 8px;">🔧</div>
                <h3 style="font-size: 17px; font-weight: 800; margin-bottom: 4px; color: #0f172a;">Tracking</h3>
                <p style="font-size: 13px; color: #475569;">Monitor repair status</p>
              </div>
              
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 22px; text-align: center; cursor: pointer;" data-page="admin-orders">
                <div style="font-size: 32px; margin-bottom: 8px;">📋</div>
                <h3 style="font-size: 17px; font-weight: 800; margin-bottom: 4px; color: #0f172a;">Orders</h3>
                <p style="font-size: 13px; color: #475569;">Process customer orders</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  }

  renderAdminProducts() {
    const searchTerm = (document.getElementById("adminSearch")?.value || "").toLowerCase();
    
    // Categorize stock counts
    const outOfStockList = this.products.filter(p => (Number(p.stock) || 0) === 0);
    const lowStockList = this.products.filter(p => { 
      const s = Number(p.stock) || 0; 
      const min = Number(p.minStock) || 5; 
      return s > 0 && s <= min; 
    });
    const fullStockList = this.products.filter(p => {
      const s = Number(p.stock) || 0;
      const min = Number(p.minStock) || 5;
      return s > min;
    });

    let filteredProducts = this.products.filter(
      (product) =>
        product.name.toLowerCase().includes(searchTerm) || product.category.toLowerCase().includes(searchTerm),
    );

    // Apply stock category filter
    if (this.stockFilter === 'full') {
      filteredProducts = filteredProducts.filter(p => (Number(p.stock) || 0) > (Number(p.minStock) || 5));
    } else if (this.stockFilter === 'low') {
      filteredProducts = filteredProducts.filter(p => {
        const s = Number(p.stock) || 0;
        const min = Number(p.minStock) || 5;
        return s > 0 && s <= min;
      });
    } else if (this.stockFilter === 'out') {
      filteredProducts = filteredProducts.filter(p => (Number(p.stock) || 0) === 0);
    }

    return `
      <div class="owner-portal-page" style="min-height: 100vh; background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 50%, #f0f9ff 100%); color: #0f172a; padding-top: 96px; padding-bottom: 80px;">
        <div class="container">
          <button class="back-button" data-page="admin" style="margin-bottom: 20px;">&#8592; Dashboard</button>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
            <div>
              <h1 style="font-size: 36px; font-weight: 700; margin-bottom: 8px;">Products &amp; Inventory</h1>
              <p style="color: #94a3b8;">Manage product catalog, prices, and live stock tracking</p>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button onclick="app.openPOSBillingModal()" style="padding: 12px 20px; font-size: 15px; font-weight: 700; background: linear-gradient(135deg, #10b981, #059669); color: #fff; border: none; border-radius: 8px; cursor: pointer;">🧾 POS Quick Bill</button>
              <button class="btn btn-primary" data-action="add-product-form" style="padding: 12px 24px; font-size: 16px;">+ Add Product</button>
              <button onclick="app.exportProductsPDF()" style="padding: 12px 24px; background:#1e293b; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">📄 PDF</button>
            </div>
          </div>

          <!-- Stock Category Filter Bar -->
          <div style="display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
            <button onclick="app.setStockFilter('all')" style="padding: 10px 18px; border-radius: 20px; font-weight: 700; font-size: 13px; cursor: pointer; border: 2px solid ${this.stockFilter === 'all' ? '#fff' : 'rgba(255,255,255,0.3)'}; background: ${this.stockFilter === 'all' ? '#1e293b' : 'rgba(30,41,59,0.5)'}; color: #fff;">
              📦 All Products (${this.products.length})
            </button>
            <button onclick="app.setStockFilter('full')" style="padding: 10px 18px; border-radius: 20px; font-weight: 700; font-size: 13px; cursor: pointer; border: 2px solid ${this.stockFilter === 'full' ? '#10b981' : 'rgba(16,185,129,0.3)'}; background: ${this.stockFilter === 'full' ? '#065f46' : 'rgba(6,95,70,0.5)'}; color: #fff;">
              🟢 Full Stock (${fullStockList.length})
            </button>
            <button onclick="app.setStockFilter('low')" style="padding: 10px 18px; border-radius: 20px; font-weight: 700; font-size: 13px; cursor: pointer; border: 2px solid ${this.stockFilter === 'low' ? '#f59e0b' : 'rgba(245,158,11,0.3)'}; background: ${this.stockFilter === 'low' ? '#78350f' : 'rgba(120,53,15,0.5)'}; color: #fff;">
              ⚠️ Low Stock Alert (${lowStockList.length})
            </button>
            <button onclick="app.setStockFilter('out')" style="padding: 10px 18px; border-radius: 20px; font-weight: 700; font-size: 13px; cursor: pointer; border: 2px solid ${this.stockFilter === 'out' ? '#ef4444' : 'rgba(239,68,68,0.3)'}; background: ${this.stockFilter === 'out' ? '#7f1d1d' : 'rgba(127,29,29,0.5)'}; color: #fff;">
              🔴 Out of Stock (${outOfStockList.length})
            </button>
          </div>

          ${(outOfStockList.length > 0 || lowStockList.length > 0) ? `
          <div style="background: rgba(255,255,255,0.95); border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; border: 2px solid #fca5a5;">
            <div style="font-weight:700; color:#111; font-size:14px; margin-bottom:10px;">⚠️ Stock Alerts Overview</div>
            ${outOfStockList.length > 0 ? `
              <div style="margin-bottom:8px;">
                <span style="background:#fee2e2; color:#dc2626; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:700; margin-right:8px;">🔴 Out of Stock (${outOfStockList.length})</span>
                <span style="font-size:13px; color:#dc2626; font-weight:600;">${outOfStockList.map(p => p.name).join(' &nbsp;·&nbsp; ')}</span>
              </div>
            ` : ''}
            ${lowStockList.length > 0 ? `
              <div>
                <span style="background:#fef3c7; color:#d97706; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:700; margin-right:8px;">🟡 Low Stock Alert (${lowStockList.length})</span>
                <span style="font-size:13px; color:#d97706; font-weight:600;">${lowStockList.map(p => `${p.name} (${Number(p.stock)} left)`).join(' &nbsp;·&nbsp; ')}</span>
              </div>
            ` : ''}
          </div>
          ` : ''}

          <div style="margin-bottom: 24px; display: flex; gap: 16px; align-items: center;">
            <input 
              type="text" 
              class="input" 
              placeholder="Search products..." 
              id="adminSearch"
              style="flex: 1;"
              oninput="app.searchProducts(this.value)"
            >
            <span style="color: #94a3b8; font-size: 14px;">Total: ${filteredProducts.length} products</span>
          </div>

          <div class="admin-products-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
            ${
              filteredProducts.length > 0
                ? filteredProducts.map((product) => this.renderAdminProductCard(product)).join("")
                : '<div style="grid-column: 1/-1; text-align: center; padding: 48px; color: #94a3b8;">No products found</div>'
            }
          </div>
        </div>
      </div>
    `
  }

  renderAdminProductCard(product) {
    const productId = product.id || product._id || 'unknown';
    const discountPercent = product.originalPrice && product.price ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : 0;
    const stock = Number(product.stock) || 0;
    const stockAlert = stock === 0
      ? `<span style="background:rgba(239,68,68,0.2);color:#ef4444;font-size:10px;padding:2px 7px;border-radius:4px;font-weight:700;">⚠️ Out of Stock</span>`
      : stock <= 3
      ? `<span style="background:rgba(245,158,11,0.2);color:#f59e0b;font-size:10px;padding:2px 7px;border-radius:4px;font-weight:700;">⚠️ Low Stock (${stock})</span>`
      : `<span style="background:rgba(16,185,129,0.15);color:#10b981;font-size:10px;padding:2px 7px;border-radius:4px;font-weight:700;">📦 Stock: ${stock}</span>`;
    
    return `
      <div class="admin-product-card" style="background-color: rgba(30, 41, 59, 0.5); border: 1px solid ${stock === 0 ? '#ef4444' : stock <= 3 ? '#f59e0b' : '#334155'}; border-radius: 8px; padding: 16px; margin-bottom: 16px; max-width: 300px;">
        <div class="admin-product-image" style="width: 100%; height: 120px; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; background: rgba(51, 65, 85, 0.3); border-radius: 6px;">
          ${product.imageUrl ? 
            `<img src="${product.imageUrl}" alt="${product.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;">` :
            `<span style="font-size: 32px;">${product.image || '📦'}</span>`
          }
        </div>
        <div class="admin-product-info">
          <h3 style="margin-bottom: 6px; font-size: 14px; font-weight: 600; color: #f8fafc;">${product.name}</h3>
          <div style="color: #94a3b8; font-size: 11px; margin-bottom: 6px;">${product.category}</div>
          <div style="margin-bottom: 4px;">
            <span style="font-weight: 700; color: #10b981; font-size: 14px;">₹${(product.price || 0).toLocaleString()}</span>
            <span style="color: #94a3b8; text-decoration: line-through; margin-left: 6px; font-size: 12px;">₹${(product.originalPrice || 0).toLocaleString()}</span>
            ${discountPercent > 0 ? `<span style="color: #f59e0b; font-size: 10px; margin-left: 6px;">${discountPercent}% off</span>` : ''}
          </div>
          ${product.ownerPrice ? `<div style="margin-bottom: 6px; font-size: 12px; color: #f59e0b; font-weight: 600;">🔒 Owner: ₹${Number(product.ownerPrice).toLocaleString()}</div>` : ''}
          <div style="margin-bottom: 8px; display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
            <span class="stock-badge ${product.inStock ? 'in-stock' : 'out-of-stock'}" style="font-size: 10px; padding: 2px 6px; border-radius: 4px; ${product.inStock ? 'background: rgba(16, 185, 129, 0.2); color: #10b981;' : 'background: rgba(239, 68, 68, 0.2); color: #ef4444;'}">${product.inStock ? 'In Stock' : 'Out of Stock'}</span>
            ${stockAlert}
          </div>
          <div style="display: flex; gap: 4px; margin-bottom: 6px;">
            <button onclick="app.openProductDistributorDetailsModal('${productId}')" style="flex: 1; padding: 5px; font-size: 11px; font-weight: 700; background: #0284c7; color: #fff; border: none; border-radius: 4px; cursor: pointer;">🤝 Distributors</button>
            <button onclick="app.openPurchaseEntryModal('${productId}')" style="flex: 1; padding: 5px; font-size: 11px; font-weight: 700; background: #059669; color: #fff; border: none; border-radius: 4px; cursor: pointer;">📥 +Stock</button>
          </div>
          <div style="display: flex; gap: 6px;">
            <button onclick="app.printUnifiedThermalLabel({ barcode: '${productId}', title: '${(product.name || '').replace(/'/g, "\\'")}', subtitle: '${(product.category || '').replace(/'/g, "\\'")}', price: ${product.price || 0} })" style="flex: 1; padding: 4px 8px; font-size: 11px; font-weight: 800; background: #f59e0b; color: #fff; border: none; border-radius: 4px; cursor: pointer;">🏷️ Label</button>
            <button class="btn btn-secondary" style="flex: 1; padding: 4px 8px; font-size: 11px;" data-action="edit-product" data-product-id="${productId}">Edit</button>
            <button class="btn" style="flex: 1; padding: 4px 8px; font-size: 11px; background: rgba(244, 63, 94, 0.1); color: #f87171; border: 1px solid #f87171; border-radius: 4px;" data-action="delete-product" data-product-id="${productId}">Delete</button>
          </div>
        </div>
      </div>
    `
  }

  renderAdminTracking() {
    // Daily Sales rule:
    // - Records saved WITH the new payment system: count advance + paid only (never full price or balance)
    // - Records saved BEFORE the new payment system (no advanceAmount field): count the stored amount
    //   so old data still shows correctly
    // Calculate today's income & this month's income based on actual payment dates
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const monthLabel = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

    let todayIncome = 0;
    let todayPaymentsCount = 0;
    let monthIncome = 0;
    const monthRecordsSet = new Set();

    this.trackingData.forEach(t => {
      const isOldRecord = t.advanceAmount === undefined && t.paidAmount === undefined;

      if (isOldRecord) {
        const date = t.createdAt || '';
        const amt = Number(t.amount) || 0;
        if (date === today) {
          todayIncome += amt;
          todayPaymentsCount++;
        }
        if (date) {
          const parts = date.split('/');
          if (parts.length === 3) {
            const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) {
              monthIncome += amt;
              monthRecordsSet.add(t.qrId);
            }
          }
        }
      } else {
        // Advance Payment: counts on creation date
        const adv = Number(t.advanceAmount) || 0;
        const dateCreated = t.createdAt || '';
        if (adv > 0) {
          if (dateCreated === today) {
            todayIncome += adv;
            todayPaymentsCount++;
          }
          if (dateCreated) {
            const parts = dateCreated.split('/');
            if (parts.length === 3) {
              const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
              if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) {
                monthIncome += adv;
                monthRecordsSet.add(t.qrId);
              }
            }
          }
        }

        // Balance Payment: counts on balancePaidDate (falls back to creation date)
        const paid = Number(t.paidAmount) || 0;
        const datePaid = t.balancePaidDate || dateCreated;
        if (paid > 0) {
          if (datePaid === today) {
            todayIncome += paid;
            todayPaymentsCount++;
          }
          if (datePaid) {
            const parts = datePaid.split('/');
            if (parts.length === 3) {
              const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
              if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) {
                monthIncome += paid;
                monthRecordsSet.add(t.qrId);
              }
            }
          }
        }
      }
    });

    const monthRecordsCountTotal = monthRecordsSet.size;

    return `
      <div class="owner-portal-page" style="min-height: 100vh; background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 50%, #f0f9ff 100%); color: #0f172a; padding-top: 96px; padding-bottom: 80px;">
        <div class="container">
          <button class="back-button" data-page="admin" style="margin-bottom: 20px;">&#8592; Dashboard</button>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
            <div>
              <h1 style="font-size: 36px; font-weight: 700; margin-bottom: 8px;">Tracking Management</h1>
              <p style="color: #94a3b8;">Manage repair tracking records</p>
            </div>
            <!-- Income widgets + Add button in one row -->
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <!-- Today's Income widget -->
              <div onclick="app.renderPage('admin-tracking-daily')" style="background: linear-gradient(135deg,#065f46,#047857); border: 2px solid #10b981; border-radius: 10px; padding: 10px 16px; cursor: pointer; min-width: 130px; transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
                <div style="font-size: 10px; color: #6ee7b7; font-weight: 600; margin-bottom: 2px;">📅 Today</div>
                <div style="font-size: 20px; font-weight: 800; color: #fff; line-height:1;">₹${todayIncome.toLocaleString('en-IN')}</div>
                <div style="font-size: 10px; color: #a7f3d0; margin-top: 2px;">${todayPaymentsCount} payment${todayPaymentsCount !== 1 ? 's' : ''} →</div>
              </div>
              <!-- Monthly Income widget -->
              <div onclick="app.renderPage('admin-tracking-monthly')" style="background: linear-gradient(135deg,#1e3a8a,#1d4ed8); border: 2px solid #3b82f6; border-radius: 10px; padding: 10px 16px; cursor: pointer; min-width: 130px; transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
                <div style="font-size: 10px; color: #93c5fd; font-weight: 600; margin-bottom: 2px;">📆 ${monthLabel}</div>
                <div style="font-size: 20px; font-weight: 800; color: #fff; line-height:1;">₹${monthIncome.toLocaleString('en-IN')}</div>
                <div style="font-size: 10px; color: #bfdbfe; margin-top: 2px;">${monthRecordsCountTotal} record${monthRecordsCountTotal !== 1 ? 's' : ''} →</div>
              </div>
              <!-- Add Tracking button -->
              <button class="btn btn-primary" data-action="toggle-tracking-form" style="padding: 12px 24px; font-size: 16px; white-space: nowrap;">+ Add Tracking</button>
              <!-- Export buttons -->
              <button onclick="app.exportTrackingPDF()" style="padding: 10px 16px; background:#1e293b; color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; white-space:nowrap;">📄 PDF</button>
              <button onclick="app.exportTrackingXL()" style="padding: 10px 16px; background:#16a34a; color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; white-space:nowrap;">📊 XL Sheet</button>
            </div>
          </div>

          ${this.renderTrackingForm()}

          <!-- Permanent Barcode Scan Bar — always visible, works anytime -->
          <div id="persistentScanBar" style="background:rgba(16,185,129,0.12); border:1.5px solid #10b981; border-radius:10px; padding:10px 16px; margin-bottom:20px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
            <span style="font-size:13px; font-weight:700; color:#10b981; white-space:nowrap;">📷 Scan Barcode:</span>
            <input type="text" id="globalScanInput" placeholder="Scan barcode here to lookup any tracking record..."
              style="flex:1; min-width:200px; padding:8px 12px; border:1px solid #10b981; border-radius:6px; background:rgba(30,41,59,0.9); color:#fff; font-size:13px; outline:none;"
              autocomplete="off"
              onkeydown="if(event.key==='Enter'){ event.preventDefault(); const v=this.value.trim(); this.value=''; app._scannerBuffer=''; if(v.length>=3){ app.lookupBarcode(v); } }">
            <button onclick="const v=document.getElementById('globalScanInput').value.trim(); document.getElementById('globalScanInput').value=''; app._scannerBuffer=''; if(v.length>=3) app.lookupBarcode(v);"
              style="background:#10b981; color:#fff; border:none; border-radius:6px; padding:8px 16px; font-size:13px; font-weight:700; cursor:pointer; white-space:nowrap;">
              🔍 Lookup
            </button>
          </div>

          ${this.renderTrackingList()}
        </div>
      </div>
    `
  }

  renderTrackingDailyIncome() {
    // Group payments by date
    const paymentsByDate = {};
    this.trackingData.forEach(t => {
      const isOldRecord = t.advanceAmount === undefined && t.paidAmount === undefined;
      
      if (isOldRecord) {
        const date = t.createdAt || 'Unknown';
        if (!paymentsByDate[date]) paymentsByDate[date] = [];
        paymentsByDate[date].push({
          qrId: t.qrId,
          customerName: t.customerName,
          productName: t.productName || t.deviceModel || '',
          type: 'Full Payment',
          amount: Number(t.amount) || 0,
          balance: 0
        });
      } else {
        const adv = Number(t.advanceAmount) || 0;
        if (adv > 0) {
          const date = t.createdAt || 'Unknown';
          if (!paymentsByDate[date]) paymentsByDate[date] = [];
          paymentsByDate[date].push({
            qrId: t.qrId,
            customerName: t.customerName,
            productName: t.productName || t.deviceModel || '',
            type: 'Advance',
            amount: adv,
            balance: Number(t.balanceAmount) || 0
          });
        }
        
        const paid = Number(t.paidAmount) || 0;
        if (paid > 0) {
          const date = t.balancePaidDate || t.createdAt || 'Unknown';
          if (!paymentsByDate[date]) paymentsByDate[date] = [];
          paymentsByDate[date].push({
            qrId: t.qrId,
            customerName: t.customerName,
            productName: t.productName || t.deviceModel || '',
            type: 'Balance',
            amount: paid,
            balance: Number(t.balanceAmount) || 0
          });
        }
      }
    });

    // Sort dates newest first (DD/MM/YYYY format)
    const sortedKeys = Object.keys(paymentsByDate).sort((a, b) => {
      const parseDate = s => {
        const p = s.split('/');
        return p.length === 3 ? new Date(`${p[2]}-${p[1]}-${p[0]}`) : new Date(0);
      };
      return parseDate(b) - parseDate(a);
    });

    return `
      <div class="owner-portal-page" style="min-height:100vh; background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%); color:#ffffff; padding-top:96px; padding-bottom:80px;">
        <div class="container">
          <button class="back-button" data-page="admin-tracking" style="margin-bottom:20px;">&#8592; Tracking</button>
          <div style="margin-bottom:28px;">
            <h1 style="font-size:32px; font-weight:700; margin-bottom:4px;">📅 Daily Tracking Income</h1>
            <p style="color:#94a3b8;">Repair income grouped by the actual payment date</p>
          </div>

          ${sortedKeys.length === 0 ? `
            <div style="text-align:center; padding:60px; color:#fff; font-size:16px;">No tracking payments found</div>
          ` : sortedKeys.map(dateKey => {
            const payments = paymentsByDate[dateKey];
            const totalReceived = payments.reduce((sum, p) => sum + p.amount, 0);
            
            return `
              <div style="background:rgba(255,255,255,0.95); border-radius:12px; margin-bottom:20px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                <div style="background:linear-gradient(135deg,#065f46,#047857); padding:14px 20px; display:flex; justify-content:space-between; align-items:center;">
                  <div style="color:#fff; font-weight:700; font-size:16px;">📅 ${dateKey}</div>
                  <div style="text-align:right;">
                    <div style="color:#6ee7b7; font-size:12px;">${payments.length} payment${payments.length !== 1 ? 's' : ''}</div>
                    <div style="color:#fff; font-weight:800; font-size:20px;">₹${totalReceived.toLocaleString('en-IN')} received</div>
                  </div>
                </div>
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                  <thead>
                    <tr style="background:#f1f5f9;">
                      <th style="padding:10px 14px; text-align:left; color:#374151; font-weight:700;">Service Code</th>
                      <th style="padding:10px 14px; text-align:left; color:#374151; font-weight:700;">Customer</th>
                      <th style="padding:10px 14px; text-align:center; color:#374151; font-weight:700;">Payment Type</th>
                      <th style="padding:10px 14px; text-align:right; color:#374151; font-weight:700;">Amount Received</th>
                      <th style="padding:10px 14px; text-align:right; color:#374151; font-weight:700;">Remaining Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${payments.map((p, i) => {
                      const displayBal = p.balance > 0 ? p.balance : 0;
                      return `
                      <tr style="border-top:1px solid #e5e7eb; background:${i % 2 === 0 ? '#fff' : '#f9fafb'};">
                        <td style="padding:10px 14px; color:#1d4ed8; font-weight:700;">${p.qrId}</td>
                        <td style="padding:10px 14px; color:#111827; font-size:12px;">
                          <div style="font-weight:600;">${p.customerName}</div>
                          <div style="color:#6b7280; font-size:11px;">${p.productName}</div>
                        </td>
                        <td style="padding:10px 14px; text-align:center;">
                          <span style="padding:2px 8px; border-radius:4px; font-size:11px; font-weight:700; 
                            background:${p.type === 'Advance' ? '#fef3c7; color:#d97706;' : p.type === 'Balance' ? '#d1fae5; color:#059669;' : '#dbeafe; color:#2563eb;'}">
                            ${p.type}
                          </span>
                        </td>
                        <td style="padding:10px 14px; text-align:right; color:#1d4ed8; font-weight:800; font-size:14px;">
                          ₹${p.amount.toLocaleString('en-IN')}
                        </td>
                        <td style="padding:10px 14px; text-align:right; font-weight:700;">
                          ${p.type === 'Full Payment' ? '<span style="color:#10b981;">✓ Paid</span>' : (displayBal > 0
                            ? `<span style="color:#dc2626; font-weight:800;">₹${displayBal.toLocaleString('en-IN')}</span>`
                            : `<span style="color:#10b981;">✓ Cleared</span>`)}
                        </td>
                      </tr>
                    `}).join('')}
                    <tr style="border-top:2px solid #10b981; background:#f0fdf4; font-weight:800; font-size:13px;">
                      <td colspan="3" style="padding:10px 14px; color:#065f46;">📊 Total Daily Income</td>
                      <td style="padding:10px 14px; text-align:right; color:#1d4ed8; font-size:15px;">
                        ₹${totalReceived.toLocaleString('en-IN')}
                      </td>
                      <td style="padding:10px 14px; text-align:right;">
                        -
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  renderTrackingMonthlyIncome() {
    // Group payments by month (YYYY-MM)
    const groups = {};
    
    this.trackingData.forEach(t => {
      const isOldRecord = t.advanceAmount === undefined && t.paidAmount === undefined;

      if (isOldRecord) {
        if (!t.createdAt) return;
        const parts = t.createdAt.split('/');
        const key = parts.length === 3 ? `${parts[2]}-${parts[1]}` : 'Unknown';
        if (!groups[key]) groups[key] = [];
        groups[key].push({
          date: t.createdAt,
          qrId: t.qrId,
          customerName: t.customerName,
          productName: t.productName || t.deviceModel || '-',
          status: t.status,
          amount: Number(t.amount) || 0
        });
      } else {
        // Advance
        const adv = Number(t.advanceAmount) || 0;
        if (adv > 0) {
          if (!t.createdAt) return;
          const parts = t.createdAt.split('/');
          const key = parts.length === 3 ? `${parts[2]}-${parts[1]}` : 'Unknown';
          if (!groups[key]) groups[key] = [];
          groups[key].push({
            date: t.createdAt,
            qrId: t.qrId,
            customerName: t.customerName,
            productName: t.productName || t.deviceModel || '-',
            status: t.status,
            amount: adv,
            type: 'Advance'
          });
        }
        
        // Balance
        const paid = Number(t.paidAmount) || 0;
        if (paid > 0) {
          const date = t.balancePaidDate || t.createdAt;
          if (!date) return;
          const parts = date.split('/');
          const key = parts.length === 3 ? `${parts[2]}-${parts[1]}` : 'Unknown';
          if (!groups[key]) groups[key] = [];
          groups[key].push({
            date: date,
            qrId: t.qrId,
            customerName: t.customerName,
            productName: t.productName || t.deviceModel || '-',
            status: t.status,
            amount: paid,
            type: 'Balance'
          });
        }
      }
    });

    const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    const monthLabel = key => {
      if (key === 'Unknown') return 'Unknown Date';
      const [y, m] = key.split('-');
      return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    };

    return `
      <div class="owner-portal-page" style="min-height:100vh; background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%); color:#ffffff; padding-top:96px; padding-bottom:80px;">
        <div class="container">
          <button class="back-button" data-page="admin-tracking" style="margin-bottom:20px;">&#8592; Tracking</button>
          <div style="margin-bottom:28px;">
            <h1 style="font-size:32px; font-weight:700; margin-bottom:4px;">📆 Monthly Tracking Income</h1>
            <p style="color:#94a3b8;">Repair income grouped by month — actual payment dates</p>
          </div>

          ${sortedKeys.length === 0 ? `
            <div style="text-align:center; padding:60px; color:#fff; font-size:16px;">No tracking records found</div>
          ` : sortedKeys.map(monthKey => {
            const recs = groups[monthKey];
            const total = recs.reduce((s, t) => s + t.amount, 0);
            return `
              <div style="background:rgba(255,255,255,0.95); border-radius:12px; margin-bottom:20px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                <div style="background:linear-gradient(135deg,#1e3a8a,#1d4ed8); padding:14px 20px; display:flex; justify-content:space-between; align-items:center;">
                  <div style="color:#fff; font-weight:700; font-size:16px;">📆 ${monthLabel(monthKey)}</div>
                  <div style="text-align:right;">
                    <div style="color:#93c5fd; font-size:12px;">${recs.length} payment${recs.length !== 1 ? 's' : ''}</div>
                    <div style="color:#fff; font-weight:800; font-size:20px;">₹${total.toLocaleString('en-IN')}</div>
                  </div>
                </div>
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                  <thead>
                    <tr style="background:#f1f5f9;">
                      <th style="padding:10px 14px; text-align:left; color:#374151; font-weight:600;">Date</th>
                      <th style="padding:10px 14px; text-align:left; color:#374151; font-weight:600;">QR ID</th>
                      <th style="padding:10px 14px; text-align:left; color:#374151; font-weight:600;">Customer</th>
                      <th style="padding:10px 14px; text-align:left; color:#374151; font-weight:600;">Device</th>
                      <th style="padding:10px 14px; text-align:left; color:#374151; font-weight:600;">Status/Type</th>
                      <th style="padding:10px 14px; text-align:right; color:#374151; font-weight:600;">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${recs.map((p, i) => `
                      <tr style="border-top:1px solid #e5e7eb; background:${i % 2 === 0 ? '#fff' : '#f9fafb'};">
                        <td style="padding:10px 14px; color:#374151; font-size:12px;">${p.date}</td>
                        <td style="padding:10px 14px; color:#1d4ed8; font-weight:600;">${p.qrId}</td>
                        <td style="padding:10px 14px; color:#111827;">${p.customerName}</td>
                        <td style="padding:10px 14px; color:#374151;">${p.productName}</td>
                        <td style="padding:10px 14px;">
                          <span style="background:#dbeafe; color:#1e40af; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600;">${p.status}</span>
                          ${p.type ? `<span style="background:${p.type==='Advance'?'#fef3c7':'#d1fae5'}; color:${p.type==='Advance'?'#b45309':'#047857'}; padding:2px 6px; border-radius:4px; font-size:9px; font-weight:700; margin-left:4px;">${p.type}</span>` : ''}
                        </td>
                        <td style="padding:10px 14px; text-align:right; color:#1d4ed8; font-weight:700;">₹${(p.amount).toLocaleString('en-IN')}</td>
                      </tr>
                    `).join('')}
                    <tr style="border-top:2px solid #3b82f6; background:#eff6ff;">
                      <td colspan="5" style="padding:10px 14px; font-weight:700; color:#1e3a8a;">Monthly Total</td>
                      <td style="padding:10px 14px; text-align:right; font-weight:800; color:#1e3a8a; font-size:15px;">₹${total.toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  renderTrackingForm() {
    return `
      <div id="trackingForm" style="display: none; background-color: rgba(30, 41, 59, 0.5); border: 1px solid #334155; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
        
        <!-- Barcode display and print buttons at the top of the form -->
        <div style="margin-bottom: 20px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
          <!-- Barcode display -->
          <div style="background:#fff; padding:8px; border-radius:8px; text-align:center; display:inline-block; flex-shrink: 0;">
            <canvas id="formBarcodeCanvas" style="display:none; max-width:100%;"></canvas>
          </div>
          <!-- Print buttons -->
          <div style="display:flex; flex-direction:column; gap:8px;">
            <button type="button" onclick="app.printTrackingLabel(document.getElementById('newTrackingQRId').value, document.getElementById('newTrackingCustomer')?.value, document.getElementById('newTrackingDevice')?.value)"
              style="background:#1e293b; color:#fff; border:none; border-radius:6px; padding:7px 16px; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap;">
              🏷️ Print Label (Browser)
            </button>
            <button type="button" onclick="app.printTSCLabel(document.getElementById('newTrackingQRId').value, document.getElementById('newTrackingCustomer')?.value, document.getElementById('newTrackingDevice')?.value)"
              style="background:#ea580c; color:#fff; border:none; border-radius:6px; padding:7px 16px; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap;">
              🖶 TSC Printer (.prn)
            </button>
          </div>
        </div>

        <h3 style="margin-bottom: 24px;">Add New Tracking Record</h3>

        <!-- Barcode scan lookup -->
        <div style="background:rgba(16,185,129,0.1); border:1px solid #10b981; border-radius:8px; padding:12px 16px; margin-bottom:20px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          <span style="font-size:13px; font-weight:700; color:#10b981; white-space:nowrap;">📷 Scan Barcode:</span>
          <input type="text" id="barcodeScanInput" placeholder="Scan or type barcode to lookup tracking..."
            style="flex:1; min-width:200px; padding:8px 12px; border:1px solid #334155; border-radius:6px; background:rgba(30,41,59,0.8); color:#fff; font-size:13px;"
            oninput="app.handleBarcodeScan(this.value)"
            onkeydown="if(event.key==='Enter'){app.lookupBarcode(this.value);}">
          <button onclick="app.lookupBarcode(document.getElementById('barcodeScanInput').value)"
            style="background:#10b981; color:#fff; border:none; border-radius:6px; padding:8px 16px; font-size:13px; font-weight:700; cursor:pointer; white-space:nowrap;">
            🔍 Lookup
          </button>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div class="form-field">
            <label class="form-label">QR ID * <span style="font-size:11px; color:#10b981;">(auto-generated)</span></label>
            <input type="text" class="input" id="newTrackingQRId"
              oninput="app._renderFormBarcode(this.value)"
              placeholder="Auto-generated from 01518">
          </div>
          <div class="form-field">
            <label class="form-label">Password *</label>
            <input type="text" class="input" placeholder="Enter password" id="newTrackingPassword">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div class="form-field">
            <label class="form-label">Contact Number</label>
            <input type="tel" class="input" placeholder="Enter contact number" id="newTrackingContact">
          </div>
          <div class="form-field">
            <label class="form-label">Customer Name *</label>
            <input type="text" class="input" placeholder="Enter customer name" id="newTrackingCustomer">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div class="form-field">
            <label class="form-label">Device Model *</label>
            <input type="text" class="input" placeholder="Enter device model" id="newTrackingDevice">
          </div>
          <div class="form-field">
            <label class="form-label">IMS / IMEI Number * <span style="font-size:11px; color:#ef4444;">(compulsory)</span></label>
            <input type="text" class="input" placeholder="Enter compulsory IMS / IMEI Number" id="newTrackingImei">
          </div>
          <div class="form-field">
            <label class="form-label">Estimated Completion</label>
            <select class="input" id="newTrackingDays" style="background-color:rgba(51,65,85,0.5); color:#f8fafc;">
              <option value="0">📅 Same Day</option>
              <option value="1">1 Day</option>
              <option value="2">2 Days</option>
              <option value="3">3 Days</option>
              <option value="4">4 Days</option>
              <option value="5">5 Days</option>
              <option value="7">1 Week</option>
              <option value="10">10 Days</option>
              <option value="14">2 Weeks</option>
              <option value="30">1 Month</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div class="form-field">
            <label class="form-label">📥 Date In <span style="font-size:11px; color:#10b981;">(item received)</span></label>
            <input type="date" class="input" id="newTrackingDateIn"
              style="background-color:rgba(51,65,85,0.5); color:#f8fafc;">
          </div>
          <div class="form-field">
            <label class="form-label">📤 Date Out <span style="font-size:11px; color:#94a3b8;">(item returned)</span></label>
            <input type="date" class="input" id="newTrackingDateOut"
              style="background-color:rgba(51,65,85,0.5); color:#f8fafc;">
          </div>
        </div>

        <div class="form-field" style="margin-bottom: 16px;">
          <label class="form-label">Address</label>
          <input type="text" class="input" placeholder="Enter customer address" id="newTrackingAddress">
        </div>

        <!-- Amount Section -->
        <div style="background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.3); border-radius:10px; padding:16px; margin-bottom:16px;">
          <div style="font-size:13px; font-weight:700; color:#10b981; margin-bottom:12px;">💰 Payment Details</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom:12px;">
            <div class="form-field">
              <label class="form-label">Full Price (₹) *</label>
              <input type="number" class="input" placeholder="0" id="newTrackingAmount" min="0" step="1"
                oninput="
                  var full = Number(this.value)||0;
                  var adv  = Number(document.getElementById('newTrackingAdvance').value)||0;
                  var paid = Number(document.getElementById('newTrackingPaid').value)||0;
                  var tot  = adv + paid;
                  document.getElementById('newTrackingTotalReceived').value = tot;
                  document.getElementById('newTrackingBalance').value = Math.max(0, full - tot);
                ">
              <small style="color:#94a3b8;font-size:10px;">Owner reference only — not shown in sales</small>
            </div>
            <div class="form-field">
              <label class="form-label">Advance Received (₹)</label>
              <input type="number" class="input" placeholder="0" id="newTrackingAdvance" min="0" step="1"
                oninput="
                  var full = Number(document.getElementById('newTrackingAmount').value)||0;
                  var adv  = Number(this.value)||0;
                  var paid = Number(document.getElementById('newTrackingPaid').value)||0;
                  var tot  = adv + paid;
                  document.getElementById('newTrackingTotalReceived').value = tot;
                  document.getElementById('newTrackingBalance').value = Math.max(0, full - tot);
                ">
              <small style="color:#10b981;font-size:10px;">Shows in Today's Sales</small>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
            <div class="form-field">
              <label class="form-label">Paid Amount (₹)</label>
              <input type="number" class="input" placeholder="0" id="newTrackingPaid" min="0" step="1"
                oninput="
                  var full = Number(document.getElementById('newTrackingAmount').value)||0;
                  var adv  = Number(document.getElementById('newTrackingAdvance').value)||0;
                  var paid = Number(this.value)||0;
                  var tot  = adv + paid;
                  document.getElementById('newTrackingTotalReceived').value = tot;
                  document.getElementById('newTrackingBalance').value = Math.max(0, full - tot);
                ">
              <small style="color:#94a3b8;font-size:10px;">Additional payment received</small>
            </div>
            <div class="form-field">
              <label class="form-label">Total Received (₹)</label>
              <input type="number" class="input" placeholder="0" id="newTrackingTotalReceived" min="0" step="1" readonly
                style="background:rgba(16,185,129,0.1); color:#10b981; font-weight:700;">
              <small style="color:#94a3b8;font-size:10px;">Advance + Paid</small>
            </div>
            <div class="form-field">
              <label class="form-label">Balance Amount (₹)</label>
              <input type="number" class="input" placeholder="0" id="newTrackingBalance" min="0" step="1" readonly
                style="background:rgba(239,68,68,0.1); color:#f87171; font-weight:700;">
              <small style="color:#94a3b8;font-size:10px;">Full − Total Received</small>
            </div>
          </div>
        </div>

        <div class="form-field" style="margin-bottom: 16px;">
          <label class="form-label">Issue Description *</label>
          <textarea class="input" placeholder="Describe the issue..." id="newTrackingIssue" rows="3"></textarea>
        </div>

        <!-- 🔧 Replaced Items / Components Used (Auto Stock Reduction) -->
        <div style="background: #ecfeff; border: 1.5px solid #0891b2; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
          <div style="font-size: 14px; font-weight: 800; color: #0891b2; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
            <span>🔧 Replaced Items &amp; Components Used</span>
            <span style="font-size: 11px; background: #0891b2; color: #ffffff; padding: 3px 10px; border-radius: 12px; font-weight: 800;">📦 Auto Stock Deduct</span>
          </div>

          <!-- 📷 Barcode Scanner Option for Replaced Components -->
          <div style="display: flex; gap: 8px; margin-bottom: 12px; align-items: center; background: #ffffff; padding: 8px 12px; border-radius: 8px; border: 1.5px solid #0891b2; box-shadow: 0 2px 6px rgba(8,145,178,0.1);">
            <span style="font-size: 13px; font-weight: 800; color: #0891b2; white-space: nowrap;">📷 Scan Barcode:</span>
            <input type="text" id="trackingReplacedBarcodeScanInput" placeholder="Scan barcode / IMEI / Part ID to auto-add item..."
              style="flex: 1; padding: 8px 12px; background: #ffffff; color: #0f172a; border: 1.5px solid #cbd5e1; border-radius: 6px; font-weight: 700; font-size: 13px;"
              onkeydown="if(event.key === 'Enter') { event.preventDefault(); app.scanBarcodeToTrackingReplacedItems(this.value); this.value = ''; }">
            <button type="button" onclick="const input = document.getElementById('trackingReplacedBarcodeScanInput'); app.scanBarcodeToTrackingReplacedItems(input.value); input.value = '';"
              style="padding: 8px 14px; background: #0891b2; color: #ffffff; border: none; border-radius: 6px; font-weight: 800; font-size: 12px; cursor: pointer; white-space: nowrap; box-shadow: 0 2px 6px rgba(8,145,178,0.2);">
              ⚡ Scan &amp; Add
            </button>
          </div>

          <div style="display: flex; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; align-items: center;">
            <select id="newTrackingTypeFilter" onchange="app.filterTrackingPartSelect(this.value, 'newTrackingPartSelect')" style="padding: 10px 12px; background: #ffffff; color: #0f172a; border: 1.5px solid #0891b2; border-radius: 8px; font-weight: 800; font-size: 13px;">
              <option value="all">🌐 All Stock Options</option>
              <option value="product">📦 Product</option>
              <option value="display">📱 Display</option>
              <option value="spare">🔩 Spare</option>
            </select>
            <select id="newTrackingPartSelect" class="input" style="flex: 2; min-width: 220px; background-color: #ffffff; color: #0f172a; border: 1.5px solid #cbd5e1; font-weight:700;">
              <option value="">-- Select Product, Display, or Spare Part --</option>
              ${this.getAvailableStockOptions().map(opt => `<option value="${opt.type}|${opt.id}|${opt.name.replace(/"/g, '&quot;')}|${opt.price}">${opt.label}</option>`).join('')}
            </select>
            <input type="number" id="newTrackingPartQty" value="1" min="1" max="100" class="input" style="width: 80px; background-color: #ffffff; color: #0f172a; border: 1.5px solid #cbd5e1; font-weight:700;" placeholder="Qty">
            <button type="button" onclick="app.addReplacedItemToForm()" style="padding: 10px 18px; background: #0891b2; color: #ffffff; border: none; border-radius: 8px; font-weight: 800; font-size: 13px; cursor: pointer; white-space: nowrap; box-shadow: 0 2px 8px rgba(8,145,178,0.2);">
              + Add Component
            </button>
          </div>

          <div id="replacedItemsListContainer" style="display: flex; flex-direction: column; gap: 8px;">
            <div style="font-size:12px; color:#64748b; font-style:italic;">No replaced components added yet.</div>
          </div>
        </div>

        <!-- 📷 Mobile Condition & Owner Proof Photos + ✍️ Thin Pen Signature Pad -->
        <div style="background: rgba(30, 41, 59, 0.5); border: 1.5px dashed #0284c7; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
          <div style="font-size: 14px; font-weight: 800; color: #38bdf8; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
            <span>📸 Device &amp; Mobile Owner Proof Photos</span>
            <span style="font-size: 11px; background: #0284c7; color: #ffffff; padding: 3px 10px; border-radius: 12px; font-weight: 800;">Camera / File Upload</span>
          </div>

          <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px;">
            <button type="button" onclick="app.openCameraModal('tempTrackingPhotos', 'newTrackingPhotosPreview')" style="padding: 10px 18px; background: #0284c7; color: #ffffff; border: none; border-radius: 8px; font-weight: 800; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(2,132,199,0.3);">
              📷 Take Photo (Camera)
            </button>
            <label style="padding: 10px 18px; background: #4f46e5; color: #ffffff; border: none; border-radius: 8px; font-weight: 800; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; margin: 0; box-shadow: 0 2px 8px rgba(79,70,229,0.3);">
              📁 Upload Photo File
              <input type="file" accept="image/*" multiple style="display:none;" onchange="app.handleTrackingPhotosUpload(event, 'tempTrackingPhotos', 'newTrackingPhotosPreview')">
            </label>
          </div>

          <div id="newTrackingPhotosPreview" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;">
            <div style="font-size:11.5px; color:#94a3b8; font-style:italic;">No proof photos added yet.</div>
          </div>

          <!-- ✍️ Thin Pen Drawing Pad for Owner Proof / Signature -->
          <div style="border-top: 1px solid rgba(255,255,255,0.15); padding-top: 14px; margin-top: 10px;">
            <div style="font-size: 13.5px; font-weight: 800; color: #f8fafc; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
              <span>✍️ Proof of Mobile Owner / Signature (Thin Pen)</span>
              <button type="button" onclick="app.clearSignatureCanvas('newTrackingSignatureCanvas')" style="background: rgba(239,68,68,0.2); color: #f87171; border: 1px solid #ef4444; border-radius: 6px; padding: 4px 12px; font-size: 11px; font-weight: 800; cursor: pointer;">
                🧹 Clear Signature
              </button>
            </div>
            <div style="background: #ffffff; border-radius: 8px; padding: 4px; display: inline-block; width: 100%; box-shadow: inset 0 2px 6px rgba(0,0,0,0.2);">
              <canvas id="newTrackingSignatureCanvas" style="width: 100%; height: 140px; touch-action: none; cursor: crosshair; display: block; border-radius: 6px; background: #ffffff;"></canvas>
            </div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 6px;">Use thin pen (mouse or touch) to capture mobile owner signature or condition proof.</div>
          </div>
        </div>

        <div class="form-field" style="margin-bottom: 24px;">
          <label class="form-label">Initial Status</label>
          <select class="input" id="newTrackingStatus" style="background-color: rgba(51, 65, 85, 0.5); color: #f8fafc;">
            <option value="Received">📥 Received</option>
            <option value="Diagnostics">🔍 Diagnostics</option>
            <option value="Return">↩️ Return</option>
            <option value="In Progress">🔧 In Progress</option>
            <option value="Parts Ordered">📦 Parts Ordered</option>
            <option value="Quality Check">✅ Quality Check</option>
            <option value="Ready for Pickup">📢 Ready for Pickup</option>
            <option value="Completed">🎉 Completed</option>
            <option value="Delivered">🚀 Delivered</option>
          </select>
        </div>

        <div style="display: flex; gap: 12px;">
          <button class="btn btn-primary" data-action="save-new-tracking" style="flex: 1;">Save Tracking</button>
          <button class="btn btn-secondary" data-action="toggle-tracking-form" style="flex: 1;">Cancel</button>
        </div>
      </div>
    `
  }

  renderTrackingList() {
    // Get filter and search values
    const filterStatus = this.trackingFilter || 'all';
    const searchTerm = (this.trackingSearch || '').toLowerCase();
    
    // Filter tracking data
    let filteredTracking = this.trackingData;
    
    // Apply status filter
    if (filterStatus !== 'all') {
      filteredTracking = filteredTracking.filter(t => t.status === filterStatus);
    }
    
    // Apply search filter
    if (searchTerm) {
      filteredTracking = filteredTracking.filter(t => 
        t.customerName?.toLowerCase().includes(searchTerm) ||
        t.qrId?.toLowerCase().includes(searchTerm) ||
        t.productName?.toLowerCase().includes(searchTerm) ||
        t.contact?.toLowerCase().includes(searchTerm)
      );
    }

    // Sort newest first — by numeric QR ID descending, fallback to createdAt
    filteredTracking = [...filteredTracking].sort((a, b) => {
      const numA = parseInt(a.qrId, 10);
      const numB = parseInt(b.qrId, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
      // Fallback: sort by createdAt date string (DD/MM/YYYY)
      const parseDate = s => {
        if (!s) return 0;
        const p = s.split('/');
        return p.length === 3 ? new Date(`${p[2]}-${p[1]}-${p[0]}`).getTime() : 0;
      };
      return parseDate(b.createdAt) - parseDate(a.createdAt);
    });
    
    return `
      <div class="tracking-list">
        <!-- Search Bar -->
        <div style="margin-bottom: 20px;">
          <input 
            type="text" 
            id="trackingSearchInput"
            placeholder="🔍 Search by customer name, QR ID, device, or phone..."
            style="width: 100%; padding: 12px 16px; background: rgba(30, 41, 59, 0.5); border: 2px solid #334155; border-radius: 8px; color: white; font-size: 14px;"
            value="${this.trackingSearch || ''}"
          >
        </div>
        
        <!-- Filter Buttons -->
        <div style="display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap;">
          <button 
            class="filter-btn ${filterStatus === 'all' ? 'active' : ''}"
            data-filter="all"
            style="padding: 10px 20px; border-radius: 8px; border: 2px solid ${filterStatus === 'all' ? '#10b981' : '#334155'}; background: ${filterStatus === 'all' ? '#10b981' : 'rgba(30, 41, 59, 0.5)'}; color: white; cursor: pointer; font-weight: 600; transition: all 0.3s;"
          >
            📋 All (${this.trackingData.length})
          </button>
          <button 
            class="filter-btn ${filterStatus === 'Received' ? 'active' : ''}"
            data-filter="Received"
            style="padding: 10px 20px; border-radius: 8px; border: 2px solid ${filterStatus === 'Received' ? '#3b82f6' : '#334155'}; background: ${filterStatus === 'Received' ? '#3b82f6' : 'rgba(30, 41, 59, 0.5)'}; color: white; cursor: pointer; font-weight: 600; transition: all 0.3s;"
          >
            📥 Received (${this.trackingData.filter(t => t.status === 'Received').length})
          </button>
          <button 
            class="filter-btn ${filterStatus === 'Return' ? 'active' : ''}"
            data-filter="Return"
            style="padding: 10px 20px; border-radius: 8px; border: 2px solid ${filterStatus === 'Return' ? '#ef4444' : '#334155'}; background: ${filterStatus === 'Return' ? '#ef4444' : 'rgba(30, 41, 59, 0.5)'}; color: white; cursor: pointer; font-weight: 600; transition: all 0.3s;"
          >
            ↩️ Return (${this.trackingData.filter(t => t.status === 'Return').length})
          </button>
          <button 
            class="filter-btn ${filterStatus === 'Ready for Pickup' ? 'active' : ''}"
            data-filter="Ready for Pickup"
            style="padding: 10px 20px; border-radius: 8px; border: 2px solid ${filterStatus === 'Ready for Pickup' ? '#f59e0b' : '#334155'}; background: ${filterStatus === 'Ready for Pickup' ? '#f59e0b' : 'rgba(30, 41, 59, 0.5)'}; color: white; cursor: pointer; font-weight: 600; transition: all 0.3s;"
          >
            📢 Ready for Pickup (${this.trackingData.filter(t => t.status === 'Ready for Pickup').length})
          </button>
          <button 
            class="filter-btn ${filterStatus === 'Completed' ? 'active' : ''}"
            data-filter="Completed"
            style="padding: 10px 20px; border-radius: 8px; border: 2px solid ${filterStatus === 'Completed' ? '#10b981' : '#334155'}; background: ${filterStatus === 'Completed' ? '#10b981' : 'rgba(30, 41, 59, 0.5)'}; color: white; cursor: pointer; font-weight: 600; transition: all 0.3s;"
          >
            🎉 Completed (${this.trackingData.filter(t => t.status === 'Completed').length})
          </button>
          <button 
            class="filter-btn ${filterStatus === 'Delivered' ? 'active' : ''}"
            data-filter="Delivered"
            style="padding: 10px 20px; border-radius: 8px; border: 2px solid ${filterStatus === 'Delivered' ? '#2563eb' : '#334155'}; background: ${filterStatus === 'Delivered' ? '#2563eb' : 'rgba(30, 41, 59, 0.5)'}; color: white; cursor: pointer; font-weight: 600; transition: all 0.3s;"
          >
            � Delivered (${this.trackingData.filter(t => t.status === 'Delivered').length})
          </button>
        </div>
        
        <!-- Results Count -->
        <div style="margin-bottom: 24px; display: flex; gap: 16px; align-items: center;">
          <h3 style="color: #e2e8f0; margin: 0;">
            ${filterStatus === 'all' ? 'All' : filterStatus} Tracking Records 
            <span style="color: #10b981;">(${filteredTracking.length})</span>
          </h3>
          ${searchTerm ? `<span style="color: #f59e0b; font-size: 14px;">Searching: "${searchTerm}"</span>` : ''}
        </div>
        
        <!-- Tracking Cards Grid (matching product grid) -->
        <div class="admin-tracking-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
          ${
            filteredTracking.length > 0
              ? filteredTracking.map(tracking => this.renderTrackingCard(tracking)).join('')
              : `<div style="grid-column: 1/-1; text-align: center; padding: 48px; color: #94a3b8; background: rgba(30, 41, 59, 0.3); border-radius: 12px; border: 2px dashed #334155;">
                  <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
                  <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">No tracking records found</div>
                  <div style="font-size: 14px;">Try adjusting your search or filter</div>
                </div>`
          }
        </div>
      </div>
    `
  }

  renderTrackingCard(tracking) {
    const statusColors = {
      'Received':         '#3b82f6',
      'Diagnostics':      '#8b5cf6',
      'Return':           '#ef4444',
      'In Progress':      '#f59e0b',
      'Parts Ordered':    '#ec4899',
      'Quality Check':    '#06b6d4',
      'Ready for Pickup': '#f59e0b',
      'Completed':        '#10b981',
      'Delivered':        '#2563eb'
    };
    const statusColor = statusColors[tracking.status] || '#10b981';
    const bcId = `bc_card_${tracking.qrId.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Schedule barcode render after this HTML is injected into DOM
    setTimeout(() => {
      const el = document.getElementById(bcId);
      if (el && typeof JsBarcode !== 'undefined') {
        try {
          JsBarcode(el, tracking.qrId, {
            format: 'CODE128', width: 2, height: 80,
            displayValue: true, fontSize: 12, margin: 4,
            background: '#ffffff', lineColor: '#000000',
            font: 'monospace', fontOptions: 'bold'
          });
          el.style.display = 'block';
          el.style.width = '100%';
          el.style.height = '100px';
          el.setAttribute('height', '100');
        } catch(e) {}
      }
    }, 50);

    return `
      <div class="admin-tracking-card" style="background-color: #ffffff; border: 1.5px solid #d97706; border-radius: 14px; padding: 16px; max-width: 320px; box-shadow: 0 4px 16px rgba(217,119,6,0.12); color: #0f172a;">

        <!-- Barcode at top — scan this to lookup details -->
        <div style="background:#ffffff; border:1.5px solid #cbd5e1; border-radius:8px; padding:8px 6px; margin-bottom:12px; text-align:center; width:100%; cursor:pointer; overflow:hidden; min-height:120px; display:flex; flex-direction:column; align-items:center; justify-content:center; box-shadow: 0 2px 8px rgba(0,0,0,0.04);"
             onclick="app.showTrackingLookupResult(app.trackingData.find(t=>t.qrId==='${tracking.qrId}'))"
             title="Click or scan to view full details">
          <svg id="${bcId}" style="display:none; width:100%; height:100px;"></svg>
          <div style="font-size:10px; font-weight:800; color:#475569; margin-top:4px;">📷 Scan or click to view details</div>
        </div>

        <!-- Status Badge -->
        <div style="margin-bottom: 12px;">
          <span style="display: inline-block; font-size: 11px; font-weight: 800; padding: 5px 12px; border-radius: 6px; background: ${statusColor}18; color: ${statusColor}; border: 1.5px solid ${statusColor};">
            ${this.getStatusEmoji(tracking.status)} ${tracking.status}
          </span>
        </div>
        
        <!-- QR ID -->
        <h3 style="margin-bottom: 6px; font-size: 16px; font-weight: 900; color: #0f172a; letter-spacing: 0.5px;">QR: ${tracking.qrId}</h3>
        
        <!-- Customer & Device -->
        <div style="color: #0f172a; font-size: 13px; font-weight: 800; margin-bottom: 6px;">
          ${tracking.customerName} ${tracking.productName ? `• ${tracking.productName}` : ''}
        </div>
        
        ${(tracking.imeiNumber || tracking.imsNumber) ? `<div style="color:#7c3aed; font-size:12px; font-weight:900; margin-bottom:6px; font-family:monospace; background:#f3e8ff; padding:2px 8px; border-radius:4px; display:inline-block; border:1px solid #d8b4fe;">📱 IMS/IMEI: ${tracking.imeiNumber || tracking.imsNumber}</div>` : ''}

        <!-- Contact -->
        ${tracking.contact ? `<div style="color:#0284c7; font-size:12px; font-weight:800; margin-bottom:6px;">📞 ${tracking.contact}</div>` : ''}

        <!-- Dates -->
        <div style="color: #334155; font-size: 11.5px; font-weight: 700; margin-bottom: 8px; line-height: 1.5;">
          📅 Date: ${tracking.createdAt}
          ${tracking.completedAt ? `<br><span style="color:#059669; font-weight:800;">✅ Completed: ${tracking.completedAt}</span>` : ''}
          ${tracking.deliveredAt ? `<br><span style="color:#0284c7; font-weight:800;">🚀 Delivered: ${tracking.deliveredAt}</span>` : ''}
          ${tracking.returnedAt  ? `<br><span style="color:#dc2626; font-weight:800;">↩️ Returned: ${tracking.returnedAt}</span>`  : ''}
        </div>
        
        ${tracking.status === 'Return' ? `
        <div style="background:#fee2e2; border:1.5px solid #ef4444; border-radius:8px; padding:8px 12px; margin-bottom:10px; font-size:12px; font-weight:800; color:#dc2626; text-align:center;">
          ↩️ DEVICE RETURNED TO CUSTOMER
        </div>` : ''}
        
        <!-- Amount -->
        ${tracking.amount ? `
        <div style="margin-bottom: 10px; display:flex; flex-wrap:wrap; gap:8px; align-items:center; background: #f8fafc; padding: 8px 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <span style="font-weight: 900; color: #059669; font-size: 16px;">₹${Number(tracking.amount).toLocaleString()}</span>
          <span style="color: #64748b; font-size: 11px; font-weight: 700;">Full Price</span>
          ${Number(tracking.advanceAmount) > 0 ? `
            <span style="color:#d97706; font-size:12px; font-weight:800;">Adv: ₹${Number(tracking.advanceAmount).toLocaleString()}</span>
            <span style="color:#dc2626; font-size:12px; font-weight:800;">Bal: ₹${Number(tracking.balanceAmount || (tracking.amount - tracking.advanceAmount)).toLocaleString()}</span>
          ` : ''}
        </div>
        ` : ''}
        ${tracking.address ? `<div style="color:#334155; font-size:11.5px; font-weight:700; margin-bottom:8px; line-height:1.4;">📍 ${tracking.address}</div>` : ''}
        ${(tracking.dateIn || tracking.dateOut) ? `
        <div style="display:flex; gap:14px; margin-bottom:8px; font-size:11.5px;">
          ${tracking.dateIn  ? `<span style="color:#059669; font-weight:800;">📥 In: <strong>${tracking.dateIn}</strong></span>`  : ''}
          ${tracking.dateOut ? `<span style="color:#d97706; font-weight:800;">📤 Out: <strong>${tracking.dateOut}</strong></span>` : ''}
        </div>` : ''}
        
        <!-- Replaced Items / Parts Used Badge -->
        ${tracking.replacedItems && tracking.replacedItems.length > 0 ? `
        <div style="margin-bottom: 10px; padding: 8px 10px; background: #ecfeff; border: 1.5px solid #0891b2; border-radius: 8px; font-size: 11.5px;">
          <div style="font-weight: 900; color: #0891b2; margin-bottom: 2px;">🔧 Replaced Components (${tracking.replacedItems.length}):</div>
          <div style="font-weight: 800; color: #0f172a; line-height: 1.4;">
            ${tracking.replacedItems.map(i => `${i.name} (×${i.qty || 1})`).join(' • ')}
          </div>
        </div>` : ''}

        <!-- Issue Description Box -->
        <div style="margin-bottom: 12px; padding: 10px; background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px;">
          <div style="color: #0f172a; font-size: 12px; font-weight: 800; line-height: 1.5; max-height: 50px; overflow: hidden; text-overflow: ellipsis;">
            ${tracking.issue || 'No notes provided'}
          </div>
        </div>
        
        <!-- Action Buttons Grid (Bold High-Contrast Solid Colors) -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
          <button onclick="app.showEditTrackingModal('${tracking.qrId}')" style="padding: 8px 6px; font-size: 11.5px; background:#d97706; color:#ffffff; border:none; border-radius:6px; cursor:pointer; font-weight:800; text-align:center;">✏️ Edit</button>
          <button class="btn btn-secondary" style="padding: 8px 6px; font-size: 11.5px; background:#0284c7; color:#ffffff; border:none; border-radius:6px; cursor:pointer; font-weight:800; text-align:center;" data-action="edit-tracking" data-qr-id="${tracking.qrId}">🔄 Status</button>
          <button class="btn" style="padding: 8px 6px; font-size: 11.5px; background: #dc2626; color: #ffffff; border: none; border-radius: 6px; cursor:pointer; font-weight:800; text-align:center;" data-action="delete-tracking" data-qr-id="${tracking.qrId}">🗑️ Delete</button>
          <button onclick="app.printTrackingCard('${tracking.qrId}')" style="padding: 8px 6px; font-size: 11.5px; background: #059669; color: #ffffff; border: none; border-radius: 6px; cursor: pointer; font-weight: 800; text-align:center;">🖨️ Print</button>
          <button onclick="app.printTrackingLabel('${tracking.qrId}','${(tracking.customerName||'').replace(/'/g,"\\'")}','${((tracking.productName||tracking.deviceModel||'')).replace(/'/g,"\\'")}');" style="padding: 8px 6px; font-size: 11.5px; background: #0f172a; color: #ffffff; border: none; border-radius: 6px; cursor: pointer; font-weight: 800; text-align:center;">🏷️ Label</button>
          <button onclick="app.printTSCLabel('${tracking.qrId}','${(tracking.customerName||'').replace(/'/g,"\\'")}','${((tracking.productName||tracking.deviceModel||'')).replace(/'/g,"\\'")}');" style="padding: 8px 6px; font-size: 11.5px; background: #ea580c; color: #ffffff; border: none; border-radius: 6px; cursor: pointer; font-weight: 800; text-align:center;">🖶 TSC</button>
        </div>
      </div>
    `
  }

  renderAdminOrders() {
    return `
      <div class="owner-portal-page" style="min-height: 100vh; background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 50%, #f0f9ff 100%); color: #0f172a; padding-top: 96px; padding-bottom: 80px;">
        <div class="container" style="max-width: 1300px; margin: 0 auto;">
          <button class="back-button" data-page="admin" style="margin-bottom: 20px; background: #ffffff; color: #0f172a; border: 2px solid #0f172a; font-weight: 900;">← Dashboard</button>
          <div style="margin-bottom: 24px;">
            <h1 style="font-size: 36px; font-weight: 900; color: #0f172a; margin-bottom: 6px;">📋 Orders Management</h1>
            <p style="color: #0f172a; font-size: 15px; font-weight: 800;">View and manage customer orders placed from main website</p>
          </div>

          <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #0f172a; font-size: 16px; font-weight: 900;">Total Customer Orders: ${this.orders.length}</span>
            <button onclick="app.loadOrdersFromStorage(); app.renderPage('admin-orders');" style="background: #ffffff; color: #0284c7; border: 2px solid #0284c7; padding: 8px 16px; border-radius: 8px; font-weight: 900; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(2,132,199,0.2);">
              🔄 Refresh Orders
            </button>
          </div>

          <!-- 2 Orders per Row Grid Container -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(480px, 1fr)); gap: 16px; width: 100%;">
            ${
              this.orders.length > 0
                ? this.orders.map(order => this.renderOrderCard(order)).join('')
                : `
                  <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; background: #ffffff; border: 2px dashed #0f172a; border-radius: 16px; color: #0f172a;">
                    <div style="font-size: 48px; margin-bottom: 12px;">🛒</div>
                    <div style="font-size: 18px; font-weight: 900; color: #0f172a; margin-bottom: 4px;">No Orders Placed Yet</div>
                    <div style="font-size: 14px; color: #0f172a; font-weight: 800;">When a customer places an order on the website, it will immediately appear here.</div>
                  </div>
                `
            }
          </div>
        </div>
      </div>
    `
  }

  getPaymentScreenshotUrl(order) {
    if (!order) return null;
    if (typeof order.paymentScreenshot === 'string' && order.paymentScreenshot.trim().length > 5) {
      return order.paymentScreenshot.trim();
    }
    if (order.paymentScreenshot && typeof order.paymentScreenshot === 'object') {
      if (typeof order.paymentScreenshot.data === 'string' && order.paymentScreenshot.data.length > 5) return order.paymentScreenshot.data.trim();
      if (typeof order.paymentScreenshot.imageUrl === 'string' && order.paymentScreenshot.imageUrl.length > 5) return order.paymentScreenshot.imageUrl.trim();
    }
    if (typeof order.paymentProof === 'string' && order.paymentProof.length > 5) return order.paymentProof.trim();
    if (typeof order.screenshotUrl === 'string' && order.screenshotUrl.length > 5) return order.screenshotUrl.trim();
    if (typeof order.paymentImage === 'string' && order.paymentImage.length > 5) return order.paymentImage.trim();
    return null;
  }

  renderOrderCard(order) {
    // Fix order date formatting
    let formattedDate = 'Date not available';
    if (order.orderDate) {
      try {
        const date = new Date(order.orderDate);
        formattedDate = date.toLocaleString('en-IN', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata'
        });
      } catch (e) {
        formattedDate = order.orderDate.toString();
      }
    } else if (order.createdAt) {
      try {
        const date = new Date(order.createdAt);
        formattedDate = date.toLocaleString('en-IN', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata'
        });
      } catch (e) {
        formattedDate = order.createdAt.toString();
      }
    }

    const orderKey = order.id || order.orderId;
    const screenshotUrl = this.getPaymentScreenshotUrl(order);
    const imgBoxId = `order_img_box_${String(orderKey).replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Auto-fetch screenshot from backend API if not in memory
    if (!screenshotUrl) {
      setTimeout(async () => {
        try {
          const res = await fetch(`${this.API_URL}/orders/${orderKey}/screenshot`);
          if (res.ok) {
            const data = await res.json();
            const src = data.data || data.imageUrl;
            const container = document.getElementById(imgBoxId);
            if (src && container) {
              container.innerHTML = `
                <img src="${src}" alt="Payment Proof"
                  style="width: 60px; height: 45px; object-fit: cover; border-radius: 5px; border: 1.5px solid #34d399; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"
                  onclick="app.showScreenshotModal('${src}', 'UPI Payment Proof')" title="Click to view full screenshot">
                <div style="font-size: 8.5px; font-weight: 900; color: #34d399; margin-top: 1px;">⚡ UPI</div>
              `;
            }
          }
        } catch(e) {}
      }, 100);
    }

    return `
      <div class="order-card" style="background: #ffffff; border: 2px solid #d97706; border-radius: 12px; padding: 12px 14px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); color: #0f172a; width: 100%; box-sizing: border-box;">
        
        <!-- Header row (Pure Black Bold Text & Solid Emerald Badge) -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span style="font-size:14px; font-weight:900; color:#000000; letter-spacing:0.2px;">Order #${orderKey}</span>
            <span style="font-size:11px; color:#0f172a; font-weight:900; background:#f1f5f9; padding:2px 8px; border-radius:6px; border:1px solid #cbd5e1;">🗓️ ${formattedDate}</span>
          </div>
          <span style="font-size:10.5px; padding:3px 10px; border-radius:6px; background:#10b981; color:#ffffff; font-weight:900; box-shadow:0 2px 6px rgba(16,185,129,0.25); white-space:nowrap;">
            ${order.status || 'Payment Verification Pending'}
          </span>
        </div>

        <!-- Middle Content Row (Pure Black Customer Info + Dark Navy Item Box) -->
        <div style="display:flex; gap:10px; align-items:center; margin-bottom:10px; flex-wrap:wrap;">
          
          <!-- Customer Info (Left - Pure Black & Navy Bold Text) -->
          <div style="flex:1.1; min-width:180px; font-size:11.5px; line-height:1.4; color:#0f172a;">
            <div style="font-weight:900; color:#000000; font-size:13.5px; margin-bottom:2px; display:flex; align-items:center; gap:4px;">
              <span style="color:#0284c7;">👤</span> ${order.customer?.name || 'Customer'}
            </div>
            <div style="font-weight:900; color:#0284c7; font-size:12.5px; margin-bottom:2px;">📞 ${order.customer?.phone || 'No phone'}</div>
            ${order.customer?.email ? `<div style="color:#0f172a; font-weight:900; font-size:11px; margin-bottom:2px; word-break:break-all;">✉️ ${order.customer.email}</div>` : ''}
            ${order.customer?.address ? `<div style="color:#0f172a; font-size:11px; font-weight:900; line-height:1.25;">📍 ${order.customer.address}</div>` : ''}
          </div>

          <!-- Items Box + UPI Thumbnail (Right - Solid Dark Navy Box) -->
          <div style="flex:1.3; min-width:210px; background:#0f172a; border-radius:8px; padding:8px 10px; display:flex; justify-content:space-between; align-items:center; gap:8px; color:#ffffff;">
            
            <!-- Items & Price -->
            <div style="flex:1; font-size:11px;">
              ${(order.items || []).map(item => `
                <div style="display:flex; justify-content:space-between; margin-bottom:2px; gap:6px;">
                  <span style="color:#ffffff; font-weight:900;">${item.name} ×${item.quantity}</span>
                  <span style="color:#34d399; font-weight:900;">₹${((Number(item.price) || 0) * (Number(item.quantity) || 1)).toLocaleString()}</span>
                </div>
              `).join('')}
              <div style="border-top:1px dashed rgba(255,255,255,0.25); margin-top:4px; padding-top:4px; display:flex; justify-content:space-between; font-weight:900;">
                <span style="color:#ffffff;">Total</span>
                <span style="color:#34d399; font-size:14.5px;">₹${(Number(order.total) || 0).toLocaleString()}</span>
              </div>
            </div>

            <!-- UPI Proof Thumbnail Box -->
            <div style="text-align:center; min-width:60px;" id="${imgBoxId}">
              ${screenshotUrl ? `
                <img src="${screenshotUrl}" alt="Payment Proof"
                  style="width:60px; height:45px; object-fit:cover; border-radius:5px; border:1.5px solid #34d399; cursor:pointer; box-shadow:0 2px 6px rgba(0,0,0,0.4);"
                  onclick="app.showScreenshotModal('${screenshotUrl}', 'UPI Payment Proof')" title="Click to view full screenshot">
                <div style="font-size:8.5px; font-weight:900; color:#34d399; margin-top:1px;">⚡ UPI</div>
              ` : `
                <button onclick="app.showScreenshotFromOrder('${orderKey}')"
                  style="padding:4px 7px; background:#10b981; color:#ffffff; border:none; border-radius:5px; font-size:9px; font-weight:900; cursor:pointer;">
                  🖼️ Proof
                </button>
              `}
            </div>
          </div>

        </div>

        <!-- Action Buttons Row (Solid High-Contrast Black & Red Buttons) -->
        <div style="display:flex; gap:8px;">
          <button style="flex:1; padding:8px; font-size:12px; font-weight:900; background:#000000; color:#ffffff; border:2px solid #ea1c24; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px; box-shadow:0 2px 8px rgba(0,0,0,0.2);" onclick="app.printOrder('${orderKey}')">
            🖨️ Print
          </button>
          <button style="flex:1; padding:8px; font-size:12px; font-weight:900; background:#dc2626; color:#ffffff; border:none; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px; box-shadow:0 2px 8px rgba(220,38,38,0.25);" onclick="app.deleteOrder('${orderKey}')">
            🗑️ Delete
          </button>
        </div>

      </div>
    `
  }

  async showScreenshotFromOrder(orderId) {
    const order = this.orders.find(o => (o.orderId === orderId || o.id === orderId));
    let imageSrc = order?.paymentScreenshot?.data || order?.paymentScreenshot?.imageUrl;

    if (!imageSrc) {
      try {
        const res = await fetch(`${this.API_URL}/orders/${orderId}/screenshot`);
        if (res.ok) {
          const data = await res.json();
          imageSrc = data.data || data.imageUrl;
        }
      } catch (err) {
        console.error('Error fetching screenshot:', err);
      }
    }

    if (!imageSrc) {
      alert('Screenshot not found for this order.');
      return;
    }
    
    this.showScreenshotModal(imageSrc, order?.paymentScreenshot?.fileName || 'Payment Screenshot');
  }

  showScreenshotModal(imageSrc, fileName) {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 20px;
      box-sizing: border-box;
    `;
    
    modal.innerHTML = `
      <div style="background: white; border-radius: 12px; padding: 24px; max-width: 600px; width: 100%; text-align: center;">
        <h3 style="margin-bottom: 16px; color: #000;">Payment Screenshot</h3>
        <img src="${imageSrc}" alt="Payment Screenshot" style="max-width: 100%; max-height: 400px; border-radius: 8px; margin-bottom: 16px; border: 2px solid #fecaca;">
        <p style="color: #666; font-size: 14px; margin-bottom: 20px;">File: ${fileName}</p>
        <button id="closeModal" style="background: #dc2626; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600;">Close</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Handle close button
    document.getElementById('closeModal').onclick = () => {
      document.body.removeChild(modal);
    };
    
    // Close on background click
    modal.onclick = (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    };
  }

  // Print Order functionality
  printOrder(orderId) {
    // Find the order by ID
    const order = this.orders.find(o => (o.orderId === orderId || o.id === orderId));
    
    if (!order) {
      alert('Order not found!');
      return;
    }

    // Format order date
    let formattedDate = 'Date not available';
    if (order.orderDate) {
      try {
        const date = new Date(order.orderDate);
        formattedDate = date.toLocaleString('en-IN', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata'
        });
      } catch (e) {
        formattedDate = order.orderDate.toString();
      }
    } else if (order.createdAt) {
      try {
        const date = new Date(order.createdAt);
        formattedDate = date.toLocaleString('en-IN', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata'
        });
      } catch (e) {
        formattedDate = order.createdAt.toString();
      }
    }

    // Create printable content
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Order #${order.orderId || order.id} - ஜிவி மொபைல்ஸ் — Jivi Mobiles</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            color: #000; 
            background: white;
          }
          .header { 
            text-align: center; 
            border-bottom: 2px solid #dc2626; 
            padding-bottom: 20px; 
            margin-bottom: 30px; 
          }
          .logo { 
            font-size: 24px; 
            font-weight: bold; 
            color: #dc2626; 
            margin-bottom: 5px; 
          }
          .subtitle { 
            color: #666; 
            font-size: 14px; 
          }
          .order-info { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 30px; 
          }
          .order-details, .customer-details { 
            width: 48%; 
          }
          .section-title { 
            font-weight: bold; 
            color: #dc2626; 
            margin-bottom: 10px; 
            border-bottom: 1px solid #eee; 
            padding-bottom: 5px; 
          }
          .items-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 20px 0; 
          }
          .items-table th, .items-table td { 
            border: 1px solid #ddd; 
            padding: 12px; 
            text-align: left; 
          }
          .items-table th { 
            background-color: #f8f9fa; 
            font-weight: bold; 
          }
          .total-row { 
            font-weight: bold; 
            background-color: #f8f9fa; 
          }
          .payment-info { 
            background-color: #f0f9ff; 
            padding: 15px; 
            border-radius: 8px; 
            margin: 20px 0; 
            border-left: 4px solid #dc2626; 
          }
          .footer { 
            text-align: center; 
            margin-top: 40px; 
            padding-top: 20px; 
            border-top: 1px solid #eee; 
            color: #666; 
            font-size: 12px; 
          }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">💻📱 ஜிவி மொபைல்ஸ் — JIVI MOBILES</div>
          <div class="subtitle">Laptop & Mobile Sales / Service • Vanthavasi</div>
          <div class="subtitle">📞 +91 84890 62593 / +91 96295 16788 • ✉️ jivimobiles@gmail.com</div>
        </div>

        <div class="order-info">
          <div class="order-details">
            <div class="section-title">Order Information</div>
            <p><strong>Order ID:</strong> #${order.orderId || order.id}</p>
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Status:</strong> ${order.status}</p>
            <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
          </div>
          
          <div class="customer-details">
            <div class="section-title">Customer Details</div>
            <p><strong>Name:</strong> ${order.customer.name}</p>
            <p><strong>Phone:</strong> ${order.customer.phone}</p>
            <p><strong>Email:</strong> ${order.customer.email}</p>
            <p><strong>Address:</strong> ${order.customer.address}</p>
          </div>
        </div>

        <div class="section-title">Order Items</div>
        <table class="items-table">
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map(item => `
              <tr>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>₹${item.price.toLocaleString()}</td>
                <td>₹${(item.price * item.quantity).toLocaleString()}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3"><strong>Total Amount</strong></td>
              <td><strong>₹${order.total.toLocaleString()}</strong></td>
            </tr>
          </tbody>
        </table>

        <div class="payment-info">
          <div class="section-title">Payment Information</div>
          <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
          ${order.paymentScreenshot && order.paymentScreenshot.data ? 
            `<p><strong>Payment Screenshot:</strong> Attached (${order.paymentScreenshot.fileName})</p>` : 
            '<p><strong>Payment Screenshot:</strong> Not available</p>'
          }
        </div>

        <div class="footer">
          <p>Thank you for choosing ஜிவி மொபைல்ஸ் — Jivi Mobiles!</p>
          <p>For any queries, contact us at +91 84890 62593 / +91 96295 16788 or jivimobiles@gmail.com</p>
          <p>Printed on: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
        </div>
      </body>
      </html>
    `;

    // Open print window
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Wait for content to load then show printer dialog
    printWindow.onload = function() {
      printWindow.focus();
      printWindow.print();
      // Do NOT auto-close — let the user finish with the printer dialog
    };
  }

  renderAddProductForm() {
    const barcode = this.generateStockBarcode('Product');
    const today = new Date().toISOString().split('T')[0];

    return `
      <div class="owner-portal-page" style="min-height: 100vh; background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 50%, #f0f9ff 100%); color: #0f172a; padding-top: 96px; padding-bottom: 80px;">
        <div class="container" style="max-width: 650px;">
          <button class="back-button" data-page="admin-products" style="margin-bottom:20px;">← Back to Products</button>
          <h1 style="font-size: 36px; font-weight: 700; margin-bottom: 32px; color: #fff;">Add New Product &amp; Stock Batch</h1>

          <div style="background-color: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.15);">
            <div class="form-field">
              <label style="display:block; font-size:13px; font-weight:700; color:#1e293b; margin-bottom:6px;">Product Name *</label>
              <input type="text" class="input" placeholder="e.g. Samsung Galaxy A15 5G" id="productName" style="background:#f8fafc; color:#111; border:1px solid #cbd5e1;">
            </div>

            <div class="form-field">
              <label style="display:block; font-size:13px; font-weight:700; color:#1e293b; margin-bottom:6px;">Category *</label>
              <select class="input" id="productCategory" style="background:#f8fafc; color:#111; border:1px solid #cbd5e1;" onchange="
                const custom = document.getElementById('customCategoryWrap');
                if(this.value === '__custom__') { custom.style.display='block'; document.getElementById('customCategoryInput').focus(); }
                else { custom.style.display='none'; }
              ">
                <option value="">Select category</option>
                <option value="Smartphones">Smartphones</option>
                <option value="Services">Services</option>
                <option value="Accessories">Accessories</option>
                <option value="Chargers">Chargers</option>
                <option value="Audio">Audio</option>
                <option value="Power">Power Banks</option>
                ${(this.customCategories || []).map(c => `<option value="${c}">${c}</option>`).join('')}
                <option value="__custom__">➕ Add Custom Category...</option>
              </select>
              <div id="customCategoryWrap" style="display:none; margin-top:8px;">
                <div style="display:flex; gap:8px;">
                  <input type="text" id="customCategoryInput" class="input" placeholder="Type new category name..." style="flex:1; background:#f8fafc; color:#111; border:1px solid #cbd5e1;">
                  <button type="button" onclick="
                    const val = document.getElementById('customCategoryInput').value.trim();
                    if(!val) return;
                    if(!app.customCategories) app.customCategories = [];
                    if(!app.customCategories.includes(val)) { app.customCategories.push(val); localStorage.setItem('manjula_custom_categories', JSON.stringify(app.customCategories)); }
                    const sel = document.getElementById('productCategory');
                    const existing = [...sel.options].find(o => o.value === val);
                    if(!existing) {
                      const opt = new Option(val, val);
                      sel.insertBefore(opt, sel.options[sel.options.length - 1]);
                    }
                    sel.value = val;
                    document.getElementById('customCategoryWrap').style.display='none';
                  " style="padding:8px 16px; background:#dc2626; color:#fff; border:none; border-radius:8px; cursor:pointer; font-weight:600; white-space:nowrap;">✓ Add</button>
                </div>
              </div>
            </div>

            <!-- Purchase Info -->
            <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
              <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 12px;">
                <span>📅 Purchase Batch Info</span>
              </div>

              <div style="display: grid; grid-template-columns: 1fr; gap: 12px; margin-bottom: 12px;">
                <div>
                  <label style="display:block; font-size:12px; font-weight:700; color:#334155; margin-bottom:4px;">Purchase Date *</label>
                  <input type="date" id="productPurchaseDate" value="${today}" class="input" style="background:#fff; color:#111; border:1px solid #cbd5e1;">
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                <div>
                  <label style="display:block; font-size:12px; font-weight:700; color:#334155; margin-bottom:4px;">Purchase / Cost Price (₹) *</label>
                  <input type="number" id="productOwnerPrice" placeholder="12000" class="input" style="background:#fff; color:#111; border:1px solid #cbd5e1;">
                </div>
                <div>
                  <label style="display:block; font-size:12px; font-weight:700; color:#334155; margin-bottom:4px;">Customer Price (₹) *</label>
                  <input type="number" id="productPrice" placeholder="14999" class="input" style="background:#fff; color:#111; border:1px solid #cbd5e1;">
                </div>
                <div>
                  <label style="display:block; font-size:12px; font-weight:700; color:#334155; margin-bottom:4px;">MRP / Original (₹)</label>
                  <input type="number" id="productOriginalPrice" placeholder="16999" class="input" style="background:#fff; color:#111; border:1px solid #cbd5e1;">
                </div>
              </div>
            </div>

            <!-- Barcode & Serial Identifiers -->
            <div style="background: #eff6ff; border: 1px solid #93c5fd; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
              <div style="font-size: 14px; font-weight: 800; color: #1e40af; margin-bottom: 12px;">🏷️ Barcode &amp; Device Identity</div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                <div>
                  <label style="display:block; font-size:12px; font-weight:700; color:#1e3a8a; margin-bottom:4px;">Barcode</label>
                  <input type="text" id="productBarcode" value="" placeholder="Type or scan barcode..." class="input" style="background:#fff; color:#111; font-weight:700; border:1px solid #cbd5e1;">
                </div>
                <div>
                  <label style="display:block; font-size:12px; font-weight:700; color:#1e3a8a; margin-bottom:4px;">Batch Stock Quantity *</label>
                  <input type="number" id="productStock" value="1" min="1" class="input" style="background:#fff; color:#111; border:1px solid #cbd5e1;">
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div>
                  <label style="display:block; font-size:12px; font-weight:700; color:#1e3a8a; margin-bottom:4px;">IMEI 1 (Optional)</label>
                  <input type="text" id="productIMEI1" placeholder="86452109847..." class="input" style="background:#fff; color:#111; border:1px solid #cbd5e1;">
                </div>
                <div>
                  <label style="display:block; font-size:12px; font-weight:700; color:#1e3a8a; margin-bottom:4px;">Serial No / IMEI 2</label>
                  <input type="text" id="productSerial" placeholder="S/N or IMEI 2..." class="input" style="background:#fff; color:#111; border:1px solid #cbd5e1;">
                </div>
              </div>
            </div>

            <div class="form-field">
              <label style="display:block; font-size:13px; font-weight:700; color:#1e293b; margin-bottom:6px;">Product Images</label>
              <div style="margin-bottom: 16px; padding: 16px; background: #f1f5f9; border-radius: 8px; border:1px solid #e2e8f0;">
                <p style="color: #475569; font-size: 12px; margin-bottom: 8px; font-weight: 600;">Image 1 (Main)</p>
                <input type="url" class="input" placeholder="https://example.com/image1.jpg" id="productImageUrl" style="margin-bottom: 8px; background:#fff; color:#111; border:1px solid #cbd5e1;">
                <input type="file" class="input" accept="image/*" id="productImageFile1" onchange="app.handleImageUpload(event, 1)" style="font-size: 12px; background:#fff; color:#111; border:1px solid #cbd5e1;">
              </div>
              <div style="margin-bottom: 16px; padding: 16px; background: #f1f5f9; border-radius: 8px; border:1px solid #e2e8f0;">
                <p style="color: #475569; font-size: 12px; margin-bottom: 8px; font-weight: 600;">Image 2 (Secondary)</p>
                <input type="url" class="input" placeholder="https://example.com/image2.jpg" id="productImageUrl2" style="margin-bottom: 8px; background:#fff; color:#111; border:1px solid #cbd5e1;">
                <input type="file" class="input" accept="image/*" id="productImageFile2" onchange="app.handleImageUpload(event, 2)" style="font-size: 12px; background:#fff; color:#111; border:1px solid #cbd5e1;">
              </div>
              <div style="margin-bottom: 12px;">
                <p style="color: #475569; font-size: 12px; margin-bottom: 8px; font-weight:600;">Emoji/Icon (if no images)</p>
                <input type="text" class="input" placeholder="📱 or 🔧 or 📦" id="productImage" maxlength="2" style="background:#f8fafc; color:#111; border:1px solid #cbd5e1;">
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
              <input type="checkbox" id="productInStock" checked style="width: 18px; height: 18px; cursor: pointer;">
              <label for="productInStock" style="cursor: pointer; color: #1e293b; font-weight:600; font-size:14px;">In Stock</label>
            </div>

            <button class="btn btn-primary" style="width: 100%; padding: 14px; font-size: 16px; margin-bottom: 12px; font-weight:800;" data-action="save-product">💾 Save Product &amp; Stock Batch</button>
            <button class="btn btn-secondary" style="width: 100%; padding: 12px; font-size: 16px;" data-page="admin-products">Cancel</button>
          </div>
        </div>
      </div>
    `
  }

  renderEditProductForm() {
    const editingIdStr = String(this.editingProductId);
    const product = this.products.find((p) => String(p.id) === editingIdStr || String(p._id) === editingIdStr)
    if (!product) return `<div>Product not found</div>`

    return `
      <div class="owner-portal-page" style="min-height: 100vh; background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 50%, #f0f9ff 100%); color: #0f172a; padding-top: 96px; padding-bottom: 80px;">
        <div class="container" style="max-width: 600px;">
          <button class="back-button" data-page="admin-products" style="margin-bottom:20px;">← Back to Products</button>
          <h1 style="font-size: 36px; font-weight: 700; margin-bottom: 32px; color:#fff;">Edit Product</h1>

          <div style="background-color: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px;">
            <div class="form-field">
              <label style="display:block; font-size:13px; font-weight:700; color:#1e293b; margin-bottom:6px;">Product Name *</label>
              <input type="text" class="input" value="${product.name}" id="productName" style="background:#f8fafc; color:#111; border:1px solid #cbd5e1;">
            </div>

            <div class="form-field">
              <label style="display:block; font-size:13px; font-weight:700; color:#1e293b; margin-bottom:6px;">Category *</label>
              <select class="input" id="productCategory" style="background:#f8fafc; color:#111; border:1px solid #cbd5e1;" onchange="
                const custom = document.getElementById('customCategoryWrapEdit');
                if(this.value === '__custom__') { custom.style.display='block'; document.getElementById('customCategoryInputEdit').focus(); }
                else { custom.style.display='none'; }
              ">
                <option value="Smartphones" ${product.category === "Smartphones" ? "selected" : ""}>Smartphones</option>
                <option value="Services" ${product.category === "Services" ? "selected" : ""}>Services</option>
                <option value="Accessories" ${product.category === "Accessories" ? "selected" : ""}>Accessories</option>
                <option value="Chargers" ${product.category === "Chargers" ? "selected" : ""}>Chargers</option>
                <option value="Audio" ${product.category === "Audio" ? "selected" : ""}>Audio</option>
                <option value="Power" ${product.category === "Power" ? "selected" : ""}>Power Banks</option>
                ${(this.customCategories || []).filter(c => !['Smartphones','Services','Accessories','Chargers','Audio','Power'].includes(c)).map(c => `<option value="${c}" ${product.category === c ? 'selected' : ''}>${c}</option>`).join('')}
                ${!['Smartphones','Services','Accessories','Chargers','Audio','Power'].includes(product.category) && !(this.customCategories||[]).includes(product.category) && product.category ? `<option value="${product.category}" selected>${product.category}</option>` : ''}
                <option value="__custom__">➕ Add Custom Category...</option>
              </select>
              <div id="customCategoryWrapEdit" style="display:none; margin-top:8px;">
                <div style="display:flex; gap:8px;">
                  <input type="text" id="customCategoryInputEdit" class="input" placeholder="Type new category name..." style="flex:1; background:#f8fafc; color:#111; border:1px solid #cbd5e1;">
                  <button type="button" onclick="
                    const val = document.getElementById('customCategoryInputEdit').value.trim();
                    if(!val) return;
                    if(!app.customCategories) app.customCategories = [];
                    if(!app.customCategories.includes(val)) { app.customCategories.push(val); localStorage.setItem('manjula_custom_categories', JSON.stringify(app.customCategories)); }
                    const sel = document.getElementById('productCategory');
                    const existing = [...sel.options].find(o => o.value === val);
                    if(!existing) {
                      const opt = new Option(val, val);
                      sel.insertBefore(opt, sel.options[sel.options.length - 1]);
                    }
                    sel.value = val;
                    document.getElementById('customCategoryWrapEdit').style.display='none';
                  " style="padding:8px 16px; background:#dc2626; color:#fff; border:none; border-radius:8px; cursor:pointer; font-weight:600; white-space:nowrap;">✓ Add</button>
                </div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div class="form-field">
                <label style="display:block; font-size:13px; font-weight:700; color:#1e293b; margin-bottom:6px;">Customer Price (₹) *</label>
                <input type="number" class="input" value="${product.price}" id="productPrice" style="background:#f8fafc; color:#111; border:1px solid #cbd5e1;">
              </div>
              <div class="form-field">
                <label style="display:block; font-size:13px; font-weight:700; color:#1e293b; margin-bottom:6px;">Original / MRP Price (₹)</label>
                <input type="number" class="input" value="${product.originalPrice}" id="productOriginalPrice" style="background:#f8fafc; color:#111; border:1px solid #cbd5e1;">
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div class="form-field">
                <label style="display:block; font-size:13px; font-weight:700; color:#1e293b; margin-bottom:6px;">Owner Price (₹) <span style="font-size:11px; color:#f59e0b;">🔒 Owner only</span></label>
                <input type="number" class="input" value="${product.ownerPrice || ''}" placeholder="2500" id="productOwnerPrice" style="background:#f8fafc; color:#111; border:1px solid #cbd5e1;">
              </div>
              <div class="form-field">
                <label style="display:block; font-size:13px; font-weight:700; color:#1e293b; margin-bottom:6px;">Stock Quantity</label>
                <input type="number" class="input" value="${product.stock !== undefined ? product.stock : ''}" placeholder="0" id="productStock" min="0" style="background:#f8fafc; color:#111; border:1px solid #cbd5e1;">
              </div>
            </div>

            <!-- Barcode & Device Identity -->
            <div style="background: #eff6ff; border: 1px solid #93c5fd; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
              <div style="font-size: 14px; font-weight: 800; color: #1e40af; margin-bottom: 12px;">🏷️ Barcode &amp; Device Identity</div>
              <div class="form-field" style="margin-bottom: 0;">
                <label style="display:block; font-size:12px; font-weight:700; color:#1e3a8a; margin-bottom:4px;">Barcode</label>
                <input type="text" id="productBarcode" value="${product.barcode || ''}" placeholder="Type or scan barcode..." class="input" style="background:#fff; color:#111; font-weight:700; border:1px solid #cbd5e1;">
              </div>
            </div>

            <div class="form-field">
              <label style="display:block; font-size:13px; font-weight:700; color:#1e293b; margin-bottom:6px;">Product Images</label>
              <div style="margin-bottom: 16px; padding: 16px; background: #f1f5f9; border-radius: 8px; border:1px solid #e2e8f0;">
                <p style="color: #475569; font-size: 12px; margin-bottom: 8px; font-weight: 600;">Image 1 (Main)</p>
                <input type="url" class="input" placeholder="https://example.com/image1.jpg" id="productImageUrl" value="${product.imageUrl || ""}" style="margin-bottom: 8px; background:#fff; color:#111; border:1px solid #cbd5e1;">
                <input type="file" class="input" accept="image/*" id="productImageFile1" onchange="app.handleImageUpload(event, 1)" style="font-size: 12px; background:#fff; color:#111; border:1px solid #cbd5e1;">
              </div>
              <div style="margin-bottom: 16px; padding: 16px; background: #f1f5f9; border-radius: 8px; border:1px solid #e2e8f0;">
                <p style="color: #475569; font-size: 12px; margin-bottom: 8px; font-weight: 600;">Image 2 (Secondary)</p>
                <input type="url" class="input" placeholder="https://example.com/image2.jpg" id="productImageUrl2" value="${product.imageUrl2 || ""}" style="margin-bottom: 8px; background:#fff; color:#111; border:1px solid #cbd5e1;">
                <input type="file" class="input" accept="image/*" id="productImageFile2" onchange="app.handleImageUpload(event, 2)" style="font-size: 12px; background:#fff; color:#111; border:1px solid #cbd5e1;">
              </div>
              <div style="margin-bottom: 12px;">
                <p style="color: #475569; font-size: 12px; margin-bottom: 8px; font-weight:600;">Emoji/Icon (if no images)</p>
                <input type="text" class="input" value="${product.image}" id="productImage" maxlength="2" style="background:#f8fafc; color:#111; border:1px solid #cbd5e1;">
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
              <input type="checkbox" id="productInStock" ${product.inStock ? "checked" : ""} style="width: 18px; height: 18px; cursor: pointer;">
              <label for="productInStock" style="cursor: pointer; color: #1e293b; font-weight:600; font-size:14px;">In Stock</label>
            </div>

            <button class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 16px; margin-bottom: 12px;" data-action="save-product">Update Product</button>
            <button class="btn btn-secondary" style="width: 100%; padding: 12px; font-size: 16px;" data-page="admin-products">Cancel</button>
          </div>
        </div>
      </div>
    `
  }

  async saveProduct() {
    const name = document.getElementById('productName')?.value?.trim();
    const category = document.getElementById('productCategory')?.value;
    const price = document.getElementById('productPrice')?.value;
    const originalPrice = document.getElementById('productOriginalPrice')?.value;
    const ownerPrice = document.getElementById('productOwnerPrice')?.value;
    const stock = document.getElementById('productStock')?.value || '0';
    const dealerId = '';
    const dealerName = 'Direct Purchase';
    const purchaseDate = document.getElementById('productPurchaseDate')?.value || new Date().toISOString().split('T')[0];
    const barcode = document.getElementById('productBarcode')?.value || this.generateStockBarcode('Product');
    const imei1 = document.getElementById('productIMEI1')?.value?.trim() || '';
    const imei2 = document.getElementById('productIMEI2')?.value?.trim() || '';
    const serialNumber = document.getElementById('productSerial')?.value?.trim() || '';

    if (!name || !category || !price) {
      alert('Please fill in Product Name, Category and Customer Price.');
      return;
    }

    const productData = {
      name,
      category,
      price: Number(price),
      originalPrice: originalPrice ? Number(originalPrice) : null,
      ownerPrice: ownerPrice ? Number(ownerPrice) : null,
      stock: Number(stock),
      inStock: document.getElementById('productInStock')?.checked ?? true,
      image: document.getElementById('productImage')?.value || '📱',
      imageUrl: document.getElementById('productImageUrl')?.value || '',
      imageUrl2: document.getElementById('productImageUrl2')?.value || '',
      barcode: barcode || undefined
    };

    try {
      const isEdit = !!this.editingProductId;
      const url = isEdit ? `${this.API_URL}/products/${this.editingProductId}` : `${this.API_URL}/products`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });

      if (res.ok) {
        const savedProd = await res.json();

        // Save StockEntry batch record
        const stockEntryData = {
          moduleType: 'Product',
          masterId: String(savedProd.id || savedProd._id || Date.now()),
          masterName: savedProd.name,
          dealerId,
          dealerName,
          purchaseDate,
          initialQuantity: Number(stock),
          currentQuantity: Number(stock),
          purchasePrice: ownerPrice ? Number(ownerPrice) : 0,
          mrp: originalPrice ? Number(originalPrice) : 0,
          sellingPrice: Number(price),
          barcode,
          imei1,
          imei2,
          serialNumber
        };

        const entryRes = await fetch(`${this.API_URL}/stock-entries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stockEntryData)
        });

        if (entryRes.ok) {
          const entry = await entryRes.json();
          this.stockEntries.unshift(entry);
        }

        await this.loadProductsFromStorage();
        this.editingProductId = null;

        if (confirm(`✅ Product "${savedProd.name}" saved successfully!\nBarcode generated: ${barcode}\n\nWould you like to print the Barcode Label now?`)) {
          this.printStockBarcodeLabel(barcode, 'browser');
        }

        this.renderPage('admin-products');
      } else {
        alert('❌ Failed to save product.');
      }
    } catch (err) {
      console.error('❌ Save product error:', err);
      alert('❌ Error saving product.');
    }
  }

  async deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      const res = await fetch(`${this.API_URL}/products/${productId}`, { method: 'DELETE' });
      if (res.ok) {
        this.products = this.products.filter(p => String(p.id) !== String(productId) && String(p._id) !== String(productId));
        this.renderPage('admin-products');
        alert('✅ Product deleted.');
      }
    } catch (err) {
      console.error(err);
    }
  }

  renderAdminSales() {
    const search = (this.salesSearch || '').toLowerCase();
    const filtered = this.salesRecords.filter(s =>
      s.customerName?.toLowerCase().includes(search) ||
      s.phoneNumber?.includes(search) ||
      s.productName?.toLowerCase().includes(search) ||
      s.customerAddress?.toLowerCase().includes(search)
    );

    return `
      <div class="owner-portal-page" style="min-height: 100vh; background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%); color: #ffffff; padding-top: 96px; padding-bottom: 80px;">
        <div class="container">
          <button class="back-button" data-page="admin" style="margin-bottom: 20px;">&#8592; Dashboard</button>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
            <div>
              <h1 style="font-size: 32px; font-weight: 700; margin-bottom: 4px;">🛍️ Sales Records</h1>
              <p style="color: #94a3b8;">Store and lookup customer purchase details</p>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="btn btn-primary" onclick="app.toggleSalesForm()" style="padding: 12px 24px;">+ Add Sale</button>
              <button onclick="app.openPOSBillingModal()" style="padding: 12px 24px; background:linear-gradient(135deg, #10b981, #059669); color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">🧾 POS Billing</button>
              <button onclick="app.renderPage('admin-sales-monthly')" style="padding: 12px 24px; background:#1d4ed8; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">📅 Monthly Sales</button>
              <button onclick="app.exportSalesPDF()" style="padding: 12px 24px; background:#1e293b; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">📄 PDF</button>
              <button onclick="app.exportSalesXL()" style="padding: 12px 24px; background:#16a34a; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">📊 XL Sheet</button>
            </div>
          </div>

          <!-- Add Sale Form -->
          <div id="salesForm" style="display:none; background: rgba(255,255,255,0.95); border: 2px solid #dc2626; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 16px; color: #000;">New Sale Record</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
              <div>
                <label style="font-size: 13px; font-weight: 600; color: #374151; display: block; margin-bottom: 4px;">Customer Name *</label>
                <input class="input" id="sale_customerName" placeholder="Enter customer name" style="width:100%;">
              </div>
              <div>
                <label style="font-size: 13px; font-weight: 600; color: #374151; display: block; margin-bottom: 4px;">Phone Number *</label>
                <input class="input" id="sale_phoneNumber" placeholder="Enter phone number" style="width:100%;">
              </div>
              <div>
                <label style="font-size: 13px; font-weight: 600; color: #374151; display: block; margin-bottom: 4px;">IMS / IMEI Number</label>
                <input class="input" id="sale_imeiNumber" placeholder="Enter 15-digit IMEI / IMS" style="width:100%;">
              </div>
              <div style="grid-column: 1/-1;">
                <label style="font-size: 13px; font-weight: 600; color: #374151; display: block; margin-bottom: 4px;">Address</label>
                <input class="input" id="sale_customerAddress" placeholder="Enter customer address" style="width:100%;">
              </div>

              <!-- Barcode Scan in Sales Record -->
              <div style="grid-column: 1/-1; background: #eff6ff; border: 1.5px solid #3b82f6; border-radius: 10px; padding: 12px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <span style="font-size: 16px;">📷</span>
                <span style="font-size: 13px; font-weight: 800; color: #1d4ed8;">Scan Barcode to Add Item:</span>
                <input type="text" id="saleBarcodeScanInput" placeholder="Scan barcode or type item code..."
                  onkeydown="if(event.key==='Enter'){ event.preventDefault(); app.scanBarcodeToSalesForm(this.value); this.value=''; }"
                  style="flex: 1; min-width: 220px; padding: 8px 12px; background: #fff; border: 1.5px solid #93c5fd; border-radius: 6px; font-weight: 700; font-size: 13px; color:#0f172a;">
                <button type="button" onclick="const v=document.getElementById('saleBarcodeScanInput').value; app.scanBarcodeToSalesForm(v); document.getElementById('saleBarcodeScanInput').value='';"
                  style="padding: 8px 16px; background: #2563eb; color: #fff; border: none; border-radius: 6px; font-weight: 800; font-size: 12.5px; cursor: pointer;">
                  🔍 Scan &amp; Add Item
                </button>
              </div>

              <!-- ── PRODUCTS SECTION ── -->
              <div style="grid-column: 1/-1;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                  <label style="font-size:13px; font-weight:700; color:#374151;">Products / Displays / Spare Parts *</label>
                  <button type="button" onclick="app.addSaleProductRow()"
                    style="background:#dc2626; color:#fff; border:none; border-radius:6px; padding:5px 14px; font-size:12px; font-weight:700; cursor:pointer;">
                    + Add Item
                  </button>
                </div>

                <!-- Column headers -->
                <div style="display:grid; grid-template-columns:2fr 1.2fr 0.8fr 1fr 1fr 32px; gap:6px; margin-bottom:4px; padding:0 2px;">
                  <span style="font-size:11px; font-weight:700; color:#6b7280;">Item Name (Product / Spare / Display)</span>
                  <span style="font-size:11px; font-weight:700; color:#6b7280;">Category</span>
                  <span style="font-size:11px; font-weight:700; color:#6b7280;">Qty</span>
                  <span style="font-size:11px; font-weight:700; color:#6b7280;">Amount (₹)</span>
                  <span style="font-size:11px; font-weight:700; color:#6b7280;">Discount (₹)</span>
                  <span></span>
                </div>

                <!-- Product rows container -->
                <div id="sale_items_container"></div>
              </div>
              <!-- ── END PRODUCTS ── -->

              <div>
                <label style="font-size: 13px; font-weight: 600; color: #374151; display: block; margin-bottom: 4px;">Purchase Date *</label>
                <input class="input" type="date" id="sale_purchaseDate" value="${new Date().toISOString().split('T')[0]}" style="width:100%;">
              </div>
              <div>
                <label style="font-size: 13px; font-weight: 600; color: #374151; display: block; margin-bottom: 4px;">Warranty Period</label>
                <select class="input" id="sale_warrantyPeriod" style="width:100%;">
                  <option value="">No Warranty</option>
                  <option value="1 Month">1 Month</option>
                  <option value="3 Months">3 Months</option>
                  <option value="6 Months">6 Months</option>
                  <option value="1 Year">1 Year</option>
                  <option value="2 Years">2 Years</option>
                </select>
              </div>
              <div style="grid-column: 1/-1;">
                <label style="font-size: 13px; font-weight: 600; color: #374151; display: block; margin-bottom: 4px;">Notes</label>
                <textarea class="input" id="sale_notes" placeholder="Any additional notes..." rows="2" style="width:100%; resize:vertical;"></textarea>
              </div>

              <!-- 📸 Proof Photos & ✍️ Proof Signature Pad in Sales Record Form -->
              <div style="grid-column: 1 / -1; background: #f0f9ff; border: 1.5px dashed #0284c7; border-radius: 10px; padding: 14px; margin-top: 6px;">
                <div style="font-size: 13px; font-weight: 800; color: #0284c7; margin-bottom: 8px;">📸 Device &amp; Owner Proof Photos (Camera / Upload)</div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px;">
                  <button type="button" onclick="app.openCameraModal('tempSalePhotos', 'salePhotosPreview')" style="padding: 8px 14px; background: #0284c7; color: #fff; border: none; border-radius: 6px; font-weight: 800; font-size: 12px; cursor: pointer;">📷 Take Photo</button>
                  <label style="padding: 8px 14px; background: #4f46e5; color: #fff; border: none; border-radius: 6px; font-weight: 800; font-size: 12px; cursor: pointer; margin: 0;">📁 Upload File <input type="file" accept="image/*" multiple style="display:none;" onchange="app.handleTrackingPhotosUpload(event, 'tempSalePhotos', 'salePhotosPreview')"></label>
                </div>
                <div id="salePhotosPreview" style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px;"></div>

                <div style="border-top: 1px solid #cbd5e1; padding-top: 10px; margin-top: 8px;">
                  <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
                    <span>✍️ Mobile Owner Proof Signature (Thin Pen)</span>
                    <button type="button" onclick="app.clearSignatureCanvas('saleSignatureCanvas')" style="background: #fee2e2; color: #dc2626; border: 1px solid #dc2626; border-radius: 4px; padding: 2px 8px; font-size: 11px; font-weight: 800; cursor: pointer;">Clear Signature</button>
                  </div>
                  <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 2px; width: 100%;">
                    <canvas id="saleSignatureCanvas" style="width: 100%; height: 120px; touch-action: none; cursor: crosshair; display: block; border-radius: 4px; background: #fff;"></canvas>
                  </div>
                </div>
              </div>

              <!-- Live total preview -->
              <div style="grid-column: 1/-1; background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 10px 16px; display: flex; gap: 24px; align-items: center;">
                <span style="font-size: 13px; color: #374151;">Net Payable:</span>
                <span id="bill_preview_total" style="font-size: 18px; font-weight: 700; color: #16a34a;">₹0</span>
              </div>
            </div>
            <div style="display: flex; gap: 12px; margin-top: 16px;">
              <button class="btn btn-primary" onclick="app.saveSaleRecord()" style="padding: 10px 24px;">💾 Save Record</button>
              <button class="btn btn-secondary" onclick="app.toggleSalesForm()" style="padding: 10px 24px;">Cancel</button>
            </div>
          </div>

          <!-- Search -->
          <div style="margin-bottom: 20px; display: flex; gap: 12px; align-items: center;">
            <input class="input" placeholder="🔍 Search by name, phone, product or address..." 
              style="flex:1;" 
              oninput="app.searchSales(this.value)"
              value="${this.salesSearch || ''}">
            <span style="color: #fff; font-size: 14px; font-weight: 600;" class="sales-counter">${filtered.length} records</span>
          </div>

          <!-- Records Grid -->
          ${filtered.length === 0 ? `
            <div style="text-align:center; padding: 60px; color: #fff; font-size: 16px;">
              <div style="font-size: 48px; margin-bottom: 16px;">🛍️</div>
              <p>No sales records found. Add your first sale!</p>
            </div>
          ` : `
            <div class="sales-records-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">
              ${filtered.map(sale => {
                const amount = Number(sale.saleAmount) || 0;
                const discount = Number(sale.discount) || 0;
                const netAmount = sale.netAmount !== undefined && sale.netAmount !== null ? Number(sale.netAmount) : (amount > discount ? amount - discount : amount);
                const payMethod = sale.paymentMethod || (sale.notes && sale.notes.includes('POS Bill - ') ? sale.notes.split('POS Bill - ')[1] : 'Cash');
                
                const itemsListHTML = (sale.productItems && Array.isArray(sale.productItems) && sale.productItems.length > 0) ? `
                  <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px;">
                    ${sale.productItems.map(pi => {
                      const icon = pi.type === 'display' ? '📱' : pi.type === 'spare' ? '🔩' : '📦';
                      const bg = pi.type === 'display' ? '#e0f2fe; color:#0369a1;' : pi.type === 'spare' ? '#fef3c7; color:#b45309;' : '#f3e8ff; color:#6b21a8;';
                      return `<span style="font-size:10.5px; font-weight:700; padding:2px 6px; border-radius:4px; background:${bg}">${icon} ${pi.name} (x${pi.quantity || 1})</span>`;
                    }).join('')}
                  </div>
                ` : '';

                return `
                <div style="background: rgba(255,255,255,0.95); border-radius: 12px; padding: 16px; border: 2px solid #fecaca; position: relative;">
                  <div style="margin-bottom: 12px; display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                      <div style="font-size: 16px; font-weight: 700; color: #000;">${sale.customerName}</div>
                      <div style="font-size: 13px; color: #dc2626; font-weight: 600;">📞 ${sale.phoneNumber}</div>
                      ${sale.customerAddress ? `<div style="font-size: 12px; color: #6b7280;">📍 ${sale.customerAddress}</div>` : ''}
                    </div>
                    <span style="font-size:10.5px; font-weight:800; padding:3px 8px; border-radius:6px; background:#e0e7ff; color:#3730a3; white-space:nowrap;">💳 ${payMethod}</span>
                  </div>
                  <!-- Action buttons — 2×2 grid -->
                  <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:12px;">
                    <button onclick="app.showEditSaleModal('${sale.saleId}')" style="background:#16a34a; border:none; border-radius:8px; padding:7px 10px; cursor:pointer; color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:4px;" title="Edit">✏️ Edit</button>
                    <button onclick="app.printBill('${sale.saleId}')" style="background:#1d4ed8; border:none; border-radius:8px; padding:7px 10px; cursor:pointer; color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:4px;" title="Print Receipt">🧾 Print</button>
                    <button onclick="app.shareSaleWhatsApp('${sale.saleId}')" style="background:#25d366; border:none; border-radius:8px; padding:7px 10px; cursor:pointer; color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:4px;" title="Share on WhatsApp">💬 WhatsApp</button>
                    <button onclick="app.deleteSaleRecord('${sale.saleId}')" style="background:#dc2626; border:none; border-radius:8px; padding:7px 10px; cursor:pointer; color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:4px;" title="Delete">🗑️ Delete</button>
                  </div>
                  <div style="border-top: 1px solid #fecaca; padding-top: 10px; display: flex; flex-direction: column; gap: 6px;">
                    <div style="font-size: 13px; color: #000;"><span style="color: #6b7280;">📱 Product Items:</span> <strong>${sale.productName}</strong></div>
                    ${(sale.imeiNumber || sale.imsNumber) ? `<div style="color:#7c3aed; font-size:12px; font-weight:900; margin-top:2px; font-family:monospace; background:#f3e8ff; padding:2px 8px; border-radius:4px; display:inline-block; border:1px solid #d8b4fe;">📱 IMS/IMEI: ${sale.imeiNumber || sale.imsNumber}</div>` : ''}
                    ${itemsListHTML}
                    
                    <!-- Proof Photos Gallery in Sales Record -->
                    ${sale.proofImages && sale.proofImages.length > 0 ? `
                    <div style="margin-top:6px; background:#f0f9ff; border:1px solid #bae6fd; border-radius:6px; padding:6px;">
                      <div style="font-size:11px; font-weight:800; color:#0284c7; margin-bottom:4px;">📸 Proof Photos (${sale.proofImages.length}):</div>
                      <div style="display:flex; gap:4px; flex-wrap:wrap;">
                        ${sale.proofImages.map(img => `<img src="${img}" style="width:48px; height:48px; object-fit:cover; border-radius:4px; border:1px solid #cbd5e1; cursor:pointer;" onclick="window.open('${img}','_blank')">`).join('')}
                      </div>
                    </div>` : ''}

                    <!-- Signature Preview in Sales Record -->
                    ${sale.signatureImage ? `
                    <div style="margin-top:4px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:6px; text-align:center;">
                      <div style="font-size:10.5px; font-weight:800; color:#475569; margin-bottom:2px;">✍️ Mobile Owner Signature:</div>
                      <img src="${sale.signatureImage}" style="max-height:45px; max-width:180px; object-fit:contain;">
                    </div>` : ''}

                    <div style="font-size: 13px; color: #000;"><span style="color: #6b7280;">📅 Date:</span> ${sale.purchaseDate}</div>
                    ${amount ? `<div style="font-size: 13px; color: #374151;">Subtotal: ₹${amount.toLocaleString()}${discount ? ` &nbsp;|&nbsp; Discount: ₹${discount.toLocaleString()}` : ''}</div>` : ''}
                    <div style="font-size: 15px; font-weight: 800; color: #16a34a;">💰 Net Paid: ₹${netAmount.toLocaleString()}</div>
                    ${sale.warrantyPeriod ? `<div style="font-size: 12px; background: #dcfce7; color: #16a34a; padding: 3px 8px; border-radius: 20px; display: inline-block; font-weight: 600;">🛡️ Warranty: ${sale.warrantyPeriod}</div>` : ''}
                    ${sale.notes ? `<div style="font-size: 12px; color: #6b7280; font-style: italic;">${sale.notes}</div>` : ''}
                  </div>
                </div>
              `}).join('')}
            </div>
          `}
        </div>
      </div>
    `
  }

  renderDisplayStock() {
    const search = (this.stockSearch || '').toLowerCase();
    const filtered = (this.displayStock || []).filter(d =>
      d.displayName?.toLowerCase().includes(search) ||
      d.displayId?.toLowerCase().includes(search)
    );

    const lowStock = filtered.filter(d => (Number(d.stock) || 0) === 1);

    return `
      <div class="owner-portal-page" style="min-height:100vh; background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%); color:#ffffff; padding-top:96px; padding-bottom:80px;">
        <div class="container">
          <button class="back-button" data-page="admin" style="margin-bottom: 20px;">&#8592; Dashboard</button>
          <!-- Header -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:12px;">
            <div>
              <h1 style="font-size:32px; font-weight:700; margin-bottom:4px;">📦 Display Stock</h1>
              <p style="color:#94a3b8;">Manage display inventory — increase, decrease & track stock</p>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
              <button class="btn btn-primary" onclick="app.toggleStockForm()" style="padding:12px 24px;">+ Add Display</button>
              <button onclick="app.openPOSBillingWithItem('display', '')" style="padding: 12px 24px; background:linear-gradient(135deg, #10b981, #059669); color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">🧾 POS Billing</button>
              <button onclick="app.exportDisplayStockPDF()" style="padding: 12px 24px; background:#1e293b; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">📄 PDF</button>
              <button onclick="app.exportDisplayStockXL()" style="padding: 12px 24px; background:#16a34a; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">📊 XL Sheet</button>
            </div>
          </div>

          <!-- Add Form -->
          <div id="stockForm" style="display:none; background:rgba(255,255,255,0.97); border:2px solid #dc2626; border-radius:12px; padding:24px; margin-bottom:24px; box-shadow:0 10px 25px rgba(0,0,0,0.15);">
            <h3 style="font-size:18px; font-weight:700; margin-bottom:16px; color:#000;">Add New Display &amp; Purchase Stock</h3>
            
            <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px; margin-bottom:14px;">
              <div>
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Display Name *</label>
                <input class="input" id="stk_displayName" placeholder="e.g. Samsung A54 OLED" style="width:100%;">
              </div>
              <div>
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Display ID / Code *</label>
                <input class="input" id="stk_displayId" placeholder="e.g. DISP-SA54-001" style="width:100%;">
              </div>
            </div>

            <!-- Purchase Info -->
            <div style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; padding:14px; margin-bottom:14px;">
              <div style="font-size:13px; font-weight:700; color:#0f172a; margin-bottom:8px;">
                <span>📦 Purchase Batch Info</span>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
                <div>
                  <label style="font-size:11px; font-weight:700; color:#334155; display:block; margin-bottom:4px;">Purchase Date</label>
                  <input type="date" id="stk_purchaseDate" value="${new Date().toISOString().split('T')[0]}" class="input" style="width:100%; font-size:12px;">
                </div>
                <div>
                  <label style="font-size:11px; font-weight:700; color:#334155; display:block; margin-bottom:4px;">Cost Price (₹)</label>
                  <input type="number" id="stk_costPrice" placeholder="1200" class="input" style="width:100%; font-size:12px;">
                </div>
                <div>
                  <label style="font-size:11px; font-weight:700; color:#334155; display:block; margin-bottom:4px;">Customer Price (₹)</label>
                  <input class="input" type="number" id="stk_price" placeholder="1800" min="0" style="width:100%; font-size:12px;">
                </div>
              </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div>
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Initial Quantity *</label>
                <input class="input" type="number" id="stk_stock" placeholder="Enter pcs" value="1" min="1" style="width:100%;">
              </div>
              <div>
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Barcode ID (Manual Typing)</label>
                <input class="input" id="stk_barcode" placeholder="Enter barcode manually (e.g. DISP-1001)" style="width:100%; background:#ffffff; color:#0f172a; font-weight:700;" oninput="app._renderDisplayFormBarcode(this.value)">
                <div style="background:#fff; padding:6px; border-radius:8px; text-align:center; margin-top:8px; border:1px solid #cbd5e1; display:inline-block;">
                  <canvas id="displayFormBarcodeCanvas" style="display:none; max-width:100%; height:40px;"></canvas>
                </div>
              </div>
            </div>

            <div style="display:flex; gap:12px; margin-top:16px;">
              <button class="btn btn-primary" onclick="app.saveDisplayStock()" style="padding:10px 24px; font-weight:800;">💾 Save Display Stock</button>
              <button class="btn btn-secondary" onclick="app.toggleStockForm()" style="padding:10px 24px;">Cancel</button>
            </div>
          </div>

          <!-- Search -->
          <div style="margin-bottom:16px; display:flex; gap:12px; align-items:center;">
            <div style="flex:1; position:relative;">
              <input class="input" id="stockSearchInput" placeholder="🔍 Search by display name or ID..."
                style="width:100%; background:#fff; color:#111; border:1px solid #d1d5db;"
                oninput="app.searchStock(this.value)"
                onblur="setTimeout(()=>{ const d=document.getElementById('stockSearchDropdown'); if(d) d.style.display='none'; }, 200)"
                autocomplete="off"
                value="${this.stockSearch || ''}">
            </div>
            <span style="color:#fff; font-size:14px; font-weight:600; white-space:nowrap;" class="stock-counter">${filtered.length} items</span>
          </div>

          <!-- Low stock warning -->
          ${lowStock.length > 0 ? `
            <div style="background:#fef2f2; border:2px solid #fca5a5; border-radius:10px; padding:12px 18px; margin-bottom:16px; display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:20px;">⚠️</span>
                <span style="font-size:13px; color:#dc2626; font-weight:600;">Only 1 unit left — ${lowStock.map(d=>d.displayName).join(', ')}</span>
              </div>
              <button onclick="app.downloadLowStockAlertPDF()" style="background:#1e293b; color:#fff; border:none; border-radius:7px; padding:6px 14px; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap;">📄 Download PDF</button>
            </div>
          ` : ''}

          <!-- Excel-style Table -->
          ${filtered.length === 0 ? `
            <div style="text-align:center; padding:60px; color:#fff; font-size:16px;">
              <div style="font-size:48px; margin-bottom:16px;">📦</div>
              <p>No display stock found. Add your first display!</p>
            </div>
          ` : `
            <div style="background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.15); border:2px solid #e2e8f0;">
              <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:13px; min-width:680px;">
                  <!-- Table Header -->
                  <thead>
                    <tr style="background:#1e293b; color:#fff; text-align:left;">
                      <th style="padding:12px 14px; font-weight:700; border-right:1px solid #334155; width:36px;">#</th>
                      <th style="padding:12px 14px; font-weight:700; border-right:1px solid #334155; min-width:180px;">Display Name</th>
                      <th style="padding:12px 14px; font-weight:700; border-right:1px solid #334155; min-width:150px; text-align:center;">Barcode</th>
                      <th style="padding:12px 14px; font-weight:700; border-right:1px solid #334155; min-width:110px; text-align:center;">Customer Price (₹)</th>
                      <th style="padding:12px 14px; font-weight:700; border-right:1px solid #334155; min-width:110px; text-align:center;">
                        <div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
                          <span>Owner Price (₹)</span>
                          <span style="font-size:9px; color:#94a3b8; font-weight:500;">🔒 Password</span>
                        </div>
                      </th>
                      <th style="padding:12px 14px; font-weight:700; border-right:1px solid #334155; min-width:100px; text-align:center;">Stock</th>
                      <th style="padding:12px 14px; font-weight:700; border-right:1px solid #334155; min-width:130px; text-align:center;">
                        <div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
                          <span>Cust Total (₹)</span>
                          <span style="font-size:9px; color:#94a3b8; font-weight:500;">Cust × Stock</span>
                        </div>
                      </th>
                      <th style="padding:12px 14px; font-weight:700; border-right:1px solid #334155; min-width:170px; text-align:center;">
                        <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                          <span>Owner Total (₹) 🔒</span>
                          <input type="password" id="stockTotalValuePassword" placeholder="Enter password"
                            value="${this.stockTotalValueUnlocked ? 'admin123' : ''}"
                            oninput="app.checkStockTotalValuePassword(this.value)"
                            onkeydown="if(event.key === 'Enter') app.checkStockTotalValuePassword(this.value, true)"
                            style="width:105px; padding:3px 6px; border:1px solid #cbd5e1; border-radius:4px; font-size:11px; text-align:center; color:#000; outline:none; font-weight:normal;">
                        </div>
                      </th>
                      <th style="padding:12px 14px; font-weight:700; border-right:1px solid #334155; min-width:200px; text-align:center;">Adjust Stock</th>
                      <th style="padding:12px 14px; font-weight:700; text-align:center; min-width:70px;">Action</th>
                    </tr>
                  </thead>
                  <tbody class="stock-table-body">
                    ${filtered.map((item, idx) => {
                      const stock = Number(item.stock) || 0;
                      const price = Number(item.price) || 0;
                      const totalValue = price * stock;
                      const stockColor  = stock === 0 ? '#dc2626' : stock <= 1 ? '#dc2626' : stock <= 3 ? '#d97706' : '#16a34a';
                      const stockBg     = stock === 0 ? '#fef2f2' : stock <= 1 ? '#fef2f2' : stock <= 3 ? '#fffbeb' : '#f0fdf4';
                      const rowBg       = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                      const itemBarcode = item.barcode || item.displayId || '';
                      const dispBcId    = `bc_disp_${item.stockItemId.replace(/[^a-zA-Z0-9]/g, '_')}`;

                      setTimeout(() => {
                        const el = document.getElementById(dispBcId);
                        if (el && typeof JsBarcode !== 'undefined' && itemBarcode) {
                          try {
                            JsBarcode(el, itemBarcode, {
                              format: 'CODE128', width: 1.5, height: 32,
                              displayValue: true, fontSize: 11, margin: 4,
                              background: '#ffffff', lineColor: '#000000',
                              font: 'monospace', fontOptions: 'bold'
                            });
                            el.style.display = 'block';
                            el.style.width = '120px';
                          } catch(e) {}
                        }
                      }, 50);

                      return `
                        <tr class="stock-item-row" data-id="${item.stockItemId}" style="background:${rowBg}; border-bottom:1px solid #e2e8f0; transition:background 0.3s;"
                            onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='${rowBg}'">
                          <td style="padding:10px 14px; color:#9ca3af; font-weight:600; border-right:1px solid #e2e8f0; text-align:center;">${idx + 1}</td>
                          <td style="padding:10px 14px; font-weight:700; color:#111827; border-right:1px solid #e2e8f0;">
                            ${item.displayName}
                            ${stock <= 1 && stock > 0 ? `<span style="margin-left:6px; background:#fef2f2; color:#dc2626; font-size:10px; font-weight:800; padding:2px 7px; border-radius:4px; border:1px solid #fca5a5;">⚠️ LAST 1</span>` : ''}
                            ${stock === 0 ? `<span style="margin-left:6px; background:#fef2f2; color:#dc2626; font-size:10px; font-weight:800; padding:2px 7px; border-radius:4px; border:1px solid #fca5a5;">❌ OUT</span>` : ''}
                          </td>
                          <td style="padding:8px 14px; text-align:center; border-right:1px solid #e2e8f0;">
                            <div style="display:inline-flex; flex-direction:column; align-items:center; gap:4px;">
                              <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:6px; padding:4px; text-align:center; cursor:pointer; display:flex; align-items:center; justify-content:center;"
                                   onclick="app.printStockBarcodeLabel('${itemBarcode}', 'browser')"
                                   title="Click to print barcode label">
                                <svg id="${dispBcId}" style="display:none; width:120px; height:45px;"></svg>
                              </div>
                              <div style="display:flex; gap:4px; justify-content:center;">
                                <button onclick="app.printStockBarcodeLabel('${itemBarcode}', 'browser')"
                                  style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:4px; padding:2px 6px; font-size:10px; font-weight:600; cursor:pointer;" title="Print Browser Label">
                                  🏷️ Print
                                </button>
                                <button onclick="app.printSparePartTSCLabel('${itemBarcode}', '${(item.displayName||'').replace(/'/g, "\\'")}')"
                                  style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:4px; padding:2px 6px; font-size:10px; font-weight:600; cursor:pointer;" title="Print TSC Label">
                                  🖶 TSC
                                </button>
                              </div>
                            </div>
                          </td>
                          <td style="padding:10px 14px; text-align:center; color:#16a34a; font-weight:700; border-right:1px solid #e2e8f0;">
                            ${price ? `₹${price.toLocaleString('en-IN')}` : '<span style="color:#9ca3af;">—</span>'}
                          </td>
                          <td style="padding:10px 14px; text-align:center; font-weight:700; border-right:1px solid #e2e8f0; color:#d97706;">
                            ${this.stockTotalValueUnlocked
                              ? (item.costPrice ? `₹${Number(item.costPrice).toLocaleString('en-IN')}` : '<span style="color:#9ca3af;">—</span>')
                              : '<span style="color:#94a3b8; font-family:monospace; font-size:14px;">••••</span>'
                            }
                          </td>
                          <td style="padding:10px 14px; text-align:center; border-right:1px solid #e2e8f0;">
                            <span style="display:inline-block; background:${stockBg}; color:${stockColor}; font-weight:900; font-size:18px; min-width:48px; padding:4px 10px; border-radius:6px; border:1px solid ${stockColor}40;">
                              ${stock}
                            </span>
                          </td>
                          <td style="padding:10px 14px; text-align:center; font-weight:700; color:#0ea5e9; border-right:1px solid #e2e8f0;">
                            ${price && stock ? `₹${(price * stock).toLocaleString('en-IN')}` : '<span style="color:#9ca3af;">—</span>'}
                          </td>
                          <td style="padding:10px 14px; text-align:center; font-weight:700; color:#1d4ed8; border-right:1px solid #e2e8f0;">
                            ${this.stockTotalValueUnlocked
                              ? (item.costPrice && stock ? `₹${(Number(item.costPrice) * stock).toLocaleString('en-IN')}` : '<span style="color:#9ca3af;">—</span>')
                              : '<span style="color:#94a3b8; font-family:monospace; font-size:14px;">••••</span>'
                            }
                          </td>
                          <td style="padding:8px 14px; border-right:1px solid #e2e8f0;">
                            <div style="display:flex; gap:6px; align-items:center; justify-content:center;">
                              <input type="number" id="qty_${item.stockItemId}" min="1" value="1"
                                style="width:52px; padding:5px 6px; border:1px solid #d1d5db; border-radius:6px; font-size:13px; text-align:center; color:#111;">
                              <button onclick="app.adjustStock('${item.stockItemId}', 1)"
                                style="background:#16a34a; color:#fff; border:none; border-radius:6px; padding:6px 12px; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap;">
                                ▲ In
                              </button>
                              <button onclick="app.adjustStock('${item.stockItemId}', -1)"
                                style="background:#dc2626; color:#fff; border:none; border-radius:6px; padding:6px 12px; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap; ${stock===0?'opacity:0.45;cursor:not-allowed;':''}">
                                ▼ Out
                              </button>
                            </div>
                          </td>
                          <td style="padding:10px 14px; text-align:center;">
                            <div style="display:flex; gap:6px; justify-content:center;">
                              <button onclick="app.openPOSBillingWithItem('display', '${item.stockItemId}')"
                                style="background:#10b981; color:#fff; border:1px solid #059669; border-radius:6px; padding:5px 9px; font-size:12px; font-weight:700; cursor:pointer;" title="Add to POS Cart & Bill">
                                🛒 POS
                              </button>
                              <button onclick="app.showEditStockModal('${item.stockItemId}')"
                                style="background:#dbeafe; color:#1d4ed8; border:1px solid #93c5fd; border-radius:6px; padding:5px 10px; font-size:12px; cursor:pointer;" title="Edit">
                                ✏️
                              </button>
                              <button onclick="app.deleteDisplayStock('${item.stockItemId}')"
                                style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; border-radius:6px; padding:5px 10px; font-size:12px; cursor:pointer;" title="Delete">
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                  <!-- Grand Total Footer Row -->
                  <tfoot>
                    <tr style="background:#1e293b; color:#fff; font-weight:700;">
                      <td colspan="2" style="padding:12px 14px; font-size:13px; border-right:1px solid #334155;">📊 GRAND TOTAL</td>
                      <td style="padding:12px 14px; text-align:center; font-size:13px; border-right:1px solid #334155;">—</td>
                      <td style="padding:12px 14px; text-align:center; font-size:15px; font-weight:900; border-right:1px solid #334155;">
                        ${filtered.reduce((sum, d) => sum + (Number(d.stock) || 0), 0)} units
                      </td>
                      <td style="padding:12px 14px; text-align:center; font-size:15px; font-weight:900; color:#86efac; border-right:1px solid #334155;">
                        ${this.stockTotalValueUnlocked ? 
                          `₹${filtered.reduce((sum, d) => sum + ((Number(d.price) || 0) * (Number(d.stock) || 0)), 0).toLocaleString('en-IN')}` :
                          '<span style="color:#94a3b8; font-family:monospace; font-size:14px;">••••</span>'
                        }
                      </td>
                      <td colspan="2" style="padding:12px 14px; text-align:center; font-size:12px; color:#94a3b8;">
                        ${filtered.length} item${filtered.length !== 1 ? 's' : ''}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          `}
        </div>
      </div>`;
  }

  toggleStockForm() {
    const f = document.getElementById('stockForm');
    if (f) f.style.display = f.style.display === 'none' ? 'block' : 'none';
  }

  toggleStockHistory(stockItemId) {
    const el = document.getElementById(`hist_${stockItemId}`);
    if (el) el.style.display = el.style.display === 'none' ? 'table-row' : 'none';
  }

  checkStockTotalValuePassword(val, isSubmit = false) {
    const isCorrect = (val === 'admin123');
    if (isCorrect !== this.stockTotalValueUnlocked) {
      this.stockTotalValueUnlocked = isCorrect;
      this.renderPage('admin-display-stock');
      setTimeout(() => {
        const input = document.getElementById('stockTotalValuePassword');
        if (input) {
          input.focus();
          input.value = val;
          input.setSelectionRange(val.length, val.length);
        }
      }, 50);
    } else if (isSubmit && !isCorrect) {
      alert('❌ Invalid password');
    }
  }

  async saveDisplayStock() {
    const displayName = document.getElementById('stk_displayName')?.value?.trim();
    const displayId   = document.getElementById('stk_displayId')?.value?.trim();
    const stock       = document.getElementById('stk_stock')?.value;
    const price       = document.getElementById('stk_price')?.value;
    const costPrice   = document.getElementById('stk_costPrice')?.value;
    const dealerId = '';
    const dealerName = 'Direct Purchase';
    const purchaseDate = document.getElementById('stk_purchaseDate')?.value || new Date().toISOString().split('T')[0];
    const barcode = document.getElementById('stk_barcode')?.value?.trim() || displayId;

    if (!displayName || !displayId || stock === '' || stock === null) {
      alert('Please fill in Display Name, Display ID and Initial Stock.');
      return;
    }

    const data = {
      displayName,
      displayId,
      stock: Number(stock),
      price: price ? Number(price) : null,
      history: [{ change: Number(stock), stockAfter: Number(stock), date: new Date().toLocaleDateString('en-IN') }]
    };

    try {
      const response = await fetch(`${this.API_URL}/display-stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        const saved = await response.json();

        // Also save StockEntry batch record
        const stockEntryData = {
          moduleType: 'Display',
          masterId: String(saved.stockItemId || saved._id || Date.now()),
          masterName: saved.displayName,
          dealerId,
          dealerName,
          purchaseDate,
          initialQuantity: Number(stock),
          currentQuantity: Number(stock),
          purchasePrice: costPrice ? Number(costPrice) : 0,
          sellingPrice: price ? Number(price) : 0,
          barcode
        };

        const entryRes = await fetch(`${this.API_URL}/stock-entries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stockEntryData)
        });

        if (entryRes.ok) {
          const entry = await entryRes.json();
          this.stockEntries.unshift(entry);
        }

        this.displayStock.unshift(saved);
        this.displayStock.sort((a, b) => {
          const nameA = (a.displayName || '').trim().toLowerCase();
          const nameB = (b.displayName || '').trim().toLowerCase();
          return nameA.localeCompare(nameB);
        });

        if (confirm(`✅ Display "${saved.displayName}" saved!\nBarcode: ${barcode}\n\nPrint Barcode Label?`)) {
          this.printStockBarcodeLabel(barcode, 'browser');
        }

        this.renderPage('admin-display-stock');
      } else {
        alert('❌ Failed to save display stock.');
      }
    } catch (err) {
      console.error(err);
      alert('❌ Error saving display stock.');
    }
  }

  async adjustStock(stockItemId, direction) {
    const qtyInput = document.getElementById(`qty_${stockItemId}`);
    const qty = Math.max(1, Number(qtyInput?.value) || 1);
    const item = (this.displayStock || []).find(d => d.stockItemId === stockItemId);
    if (!item) return;

    const change = direction * qty;
    const newStock = Math.max(0, (Number(item.stock) || 0) + change);

    const historyEntry = {
      change,
      stockAfter: newStock,
      date: new Date().toLocaleDateString('en-IN')
    };

    try {
      const response = await fetch(`${this.API_URL}/display-stock/${stockItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: newStock, historyEntry })
      });
      if (response.ok) {
        const updated = await response.json();
        const idx = this.displayStock.findIndex(d => d.stockItemId === stockItemId);
        if (idx !== -1) this.displayStock[idx] = updated;

        // Show low stock warning modal with PDF option when stock reaches 1
        if (updated.stock === 1) {
          this.showLowStockAlert(updated);
        }

        this.renderPage('admin-display-stock');
      } else {
        alert('❌ Failed to update stock.');
      }
    } catch (err) {
      console.error(err);
      alert('❌ Error updating stock.');
    }
  }

  showLowStockAlert(item) {
    const existing = document.getElementById('lowStockAlertModal');
    if (existing) existing.remove();

    const totalValue = (Number(item.price) || 0) * 1; // stock is 1

    const modalHTML = `
      <div id="lowStockAlertModal" onclick="if(event.target===this)this.remove()" 
        style="position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;">
        <div style="background:#fff;border-radius:14px;padding:28px;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.4);text-align:center;">
          <div style="font-size:48px;margin-bottom:12px;">⚠️</div>
          <h2 style="font-size:20px;font-weight:800;color:#dc2626;margin-bottom:8px;">Low Stock Alert!</h2>
          <p style="font-size:15px;font-weight:700;color:#111;margin-bottom:6px;">${item.displayName}</p>
          <p style="font-size:13px;color:#6b7280;margin-bottom:16px;">Only <strong style="color:#dc2626;">1 unit</strong> remaining in stock. Please reorder soon.</p>
          ${item.price ? `<p style="font-size:13px;color:#374151;margin-bottom:20px;">Unit Price: <strong>${this.stockTotalValueUnlocked ? '₹' + Number(item.price).toLocaleString('en-IN') : '••••'}</strong></p>` : ''}
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
            <button onclick="app.downloadLowStockPDF('${item.stockItemId}')" 
              style="background:#1e293b;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:700;cursor:pointer;">
              📄 Download PDF
            </button>
            <button onclick="document.getElementById('lowStockAlertModal').remove()"
              style="background:#f1f5f9;color:#374151;border:1px solid #d1d5db;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:600;cursor:pointer;">
              ✕ Dismiss
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  downloadLowStockAlertPDF() {
    const lowItems = (this.displayStock || []).filter(d => Number(d.stock) === 1);
    if (lowItems.length === 0) return;

    const win = window.open('', '_blank', 'width=700,height=500');
    const rows = lowItems.map((d, i) => `
      <tr style="background:${i%2===0?'#fff':'#fef2f2'}">
        <td>${i+1}</td>
        <td style="font-weight:700;">${d.displayName}</td>
        <td>${d.displayId}</td>
        <td style="color:#dc2626;font-weight:900;">1 unit</td>
        <td>${this.stockTotalValueUnlocked ? (d.price ? '₹' + Number(d.price).toLocaleString('en-IN') : '—') : '••••'}</td>
      </tr>`).join('');

    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Low Stock Alert Report</title>
    <style>
      body{font-family:Arial,sans-serif;padding:30px;color:#111;}
      h2{color:#dc2626;}
      table{width:100%;border-collapse:collapse;font-size:13px;margin-top:16px;}
      th{background:#dc2626;color:#fff;padding:9px 12px;text-align:left;}
      td{padding:8px 12px;border-bottom:1px solid #e5e7eb;}
      .footer{margin-top:20px;font-size:12px;color:#6b7280;}
      @media print{button{display:none;}}
    </style></head><body>
    <h2>⚠️ Low Stock Alert — ஜிவி மொபைல்ஸ் — Jivi Mobiles</h2>
    <p style="color:#6b7280;font-size:13px;">Generated: ${new Date().toLocaleString('en-IN')} &nbsp;|&nbsp; Items with only 1 unit remaining: ${lowItems.length}</p>
    <table>
      <thead><tr><th>#</th><th>Display Name</th><th>Display ID</th><th>Stock</th><th>Unit Price</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top:20px;font-size:13px;color:#dc2626;font-weight:700;">⚠️ Please reorder the above items immediately!</p>
    <div class="footer">ஜிவி மொபைல்ஸ் — Jivi Mobiles | Vanthavasi | Ph: +91 84890 62593 / +91 96295 16788</div>
    <br>
    <button onclick="window.print()" style="padding:10px 24px;background:#1e293b;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;">🖨️ Print / Save as PDF</button>
    </body></html>`);
    win.document.close();
    setTimeout(() => { try { win.focus(); } catch(e) {} }, 200);
  }

  downloadLowStockPDF(stockItemId) {
    const item = (this.displayStock || []).find(d => d.stockItemId === stockItemId);
    if (!item) return;

    const win = window.open('', '_blank', 'width=600,height=500');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Low Stock Alert</title>
    <style>
      body{font-family:Arial,sans-serif;padding:30px;color:#111;}
      h2{color:#dc2626;}
      .box{border:2px solid #dc2626;border-radius:8px;padding:20px;margin-top:16px;}
      .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f3f4f6;font-size:14px;}
      .label{color:#6b7280;}
      .value{font-weight:700;}
      @media print{button{display:none;}}
    </style></head><body>
    <h2>⚠️ Low Stock Alert — ஜிவி மொபைல்ஸ் — Jivi Mobiles</h2>
    <p style="color:#6b7280;font-size:13px;">Generated: ${new Date().toLocaleString('en-IN')}</p>
    <div class="box">
      <div class="row"><span class="label">Display Name</span><span class="value">${item.displayName}</span></div>
      <div class="row"><span class="label">Display ID</span><span class="value">${item.displayId}</span></div>
      <div class="row"><span class="label">Remaining Stock</span><span class="value" style="color:#dc2626;">1 unit</span></div>
      <div class="row"><span class="label">Unit Price</span><span class="value">${this.stockTotalValueUnlocked ? (item.price ? '₹' + Number(item.price).toLocaleString('en-IN') : '—') : '••••'}</span></div>
      <div class="row"><span class="label">Total Value</span><span class="value">${this.stockTotalValueUnlocked ? (item.price ? '₹' + Number(item.price).toLocaleString('en-IN') : '—') : '••••'}</span></div>
    </div>
    <p style="margin-top:20px;font-size:13px;color:#dc2626;font-weight:700;">⚠️ Please reorder this display immediately!</p>
    <br>
    <button onclick="window.print()" style="padding:10px 24px;background:#1e293b;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;">🖨️ Print / Save as PDF</button>
    </body></html>`);
    win.document.close();
    setTimeout(() => { try { win.focus(); } catch(e) {} }, 200);
  }

  showEditStockModal(stockItemId) {
    const item = (this.displayStock || []).find(d => d.stockItemId === stockItemId);
    if (!item) return;

    const existing = document.getElementById('editStockModal');
    if (existing) existing.remove();

    const modalHTML = `
      <div id="editStockModal" style="position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
        <div style="background:#fff; border-radius:14px; padding:28px; width:100%; max-width:460px; box-shadow:0 20px 60px rgba(0,0,0,0.3);">
          <h3 style="font-size:18px; font-weight:800; color:#111; margin-bottom:20px;">✏️ Edit Display Stock</h3>

          <div style="display:flex; flex-direction:column; gap:14px;">
            <div>
              <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Display Name *</label>
              <input id="edit_displayName" class="input" value="${item.displayName}"
                style="width:100%; background:#f8fafc; color:#111; border:1px solid #d1d5db;">
            </div>
            <div>
              <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Display ID *</label>
              <input id="edit_displayId" class="input" value="${item.displayId}"
                style="width:100%; background:#f8fafc; color:#111; border:1px solid #d1d5db;">
            </div>
            <div>
              <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Barcode ID</label>
              <input id="edit_barcode" class="input" value="${item.barcode || item.displayId || ''}"
                placeholder="Barcode ID"
                oninput="app._renderEditDisplayBarcode(this.value)"
                style="width:100%; background:#f8fafc; color:#111; border:1px solid #d1d5db;">
              <div style="background:#fff; padding:6px; border-radius:8px; text-align:center; margin-top:8px; border:1px solid #cbd5e1; display:inline-block;">
                <canvas id="editDisplayBarcodeCanvas" style="display:none; max-width:100%; height:40px;"></canvas>
              </div>
            </div>
            <div>
              <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Customer Price (₹)</label>
              <input id="edit_price" class="input" type="number" min="0" value="${item.price || ''}"
                placeholder="Customer price"
                style="width:100%; background:#f8fafc; color:#111; border:1px solid #d1d5db;">
            </div>
          </div>

          <div style="display:flex; gap:10px; margin-top:22px;">
            <button onclick="app.saveEditDisplayStock('${stockItemId}')"
              style="flex:1; background:#1d4ed8; color:#fff; border:none; border-radius:8px; padding:11px; font-size:14px; font-weight:700; cursor:pointer;">
              💾 Save Changes
            </button>
            <button onclick="document.getElementById('editStockModal').remove()"
              style="flex:1; background:#f1f5f9; color:#374151; border:1px solid #d1d5db; border-radius:8px; padding:11px; font-size:14px; font-weight:600; cursor:pointer;">
              Cancel
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  async saveEditDisplayStock(stockItemId) {
    const displayName = document.getElementById('edit_displayName')?.value?.trim();
    const displayId   = document.getElementById('edit_displayId')?.value?.trim();
    const barcode     = document.getElementById('edit_barcode')?.value?.trim() || displayId;
    const priceVal    = document.getElementById('edit_price')?.value;

    if (!displayName || !displayId) {
      alert('Display Name and Display ID are required.');
      return;
    }

    const updates = {
      displayName,
      displayId,
      barcode,
      price: priceVal !== '' && priceVal !== null ? Number(priceVal) : null
    };

    try {
      const response = await fetch(`${this.API_URL}/display-stock/${stockItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        const updated = await response.json();
        const idx = this.displayStock.findIndex(d => d.stockItemId === stockItemId);
        if (idx !== -1) this.displayStock[idx] = updated;
        this.displayStock.sort((a, b) => {
          const nameA = (a.displayName || '').trim().toLowerCase();
          const nameB = (b.displayName || '').trim().toLowerCase();
          return nameA.localeCompare(nameB);
        });
        document.getElementById('editStockModal')?.remove();
        this.renderPage('admin-display-stock');
      } else {
        alert('❌ Failed to update item.');
      }
    } catch (err) {
      console.error(err);
      alert('❌ Error updating item.');
    }
  }

  async deleteDisplayStock(stockItemId) {
    if (!confirm('Delete this display stock item?')) return;
    try {
      const response = await fetch(`${this.API_URL}/display-stock/${stockItemId}`, { method: 'DELETE' });
      if (response.ok) {
        this.displayStock = this.displayStock.filter(d => d.stockItemId !== stockItemId);
        this.renderPage('admin-display-stock');
        alert('✅ Display stock deleted.');
      }
    } catch (err) {
      console.error(err);
    }
  }

  renderAdminServices() {
    const search = (this.serviceSearch || '').toLowerCase();
    const filtered = (this.serviceRecords || []).filter(s =>
      s.customerName?.toLowerCase().includes(search) ||
      s.phoneNumber?.includes(search) ||
      s.serviceDetails?.toLowerCase().includes(search) ||
      s.customerAddress?.toLowerCase().includes(search)
    );

    return `
      <div class="owner-portal-page" style="min-height:100vh; background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%); color:#ffffff; padding-top:96px; padding-bottom:80px;">
        <div class="container">
          <button class="back-button" data-page="admin" style="margin-bottom: 20px;">&#8592; Dashboard</button>
          <!-- Header -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:12px;">
            <div>
              <h1 style="font-size:32px; font-weight:700; margin-bottom:4px;">🔧 Services</h1>
              <p style="color:#94a3b8;">Manage customer service & repair records</p>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="btn btn-primary" onclick="app.toggleServiceForm()" style="padding:12px 24px;">+ Add Service</button>
              <button onclick="app.renderPage('admin-services-daily')" style="padding:12px 24px; background:#0891b2; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">📅 Daily</button>
              <button onclick="app.renderPage('admin-services-monthly')" style="padding:12px 24px; background:#1d4ed8; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">📆 Monthly</button>
            </div>
          </div>

          <!-- Add Service Form -->
          <div id="serviceForm" style="display:none; background:rgba(255,255,255,0.97); border:2px solid #dc2626; border-radius:12px; padding:24px; margin-bottom:24px;">
            <h3 style="font-size:18px; font-weight:700; margin-bottom:16px; color:#000;">New Service Record</h3>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
              <div>
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Customer Name *</label>
                <input class="input" id="svc_customerName" placeholder="Enter customer name" style="width:100%;">
              </div>
              <div>
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Phone Number *</label>
                <input class="input" id="svc_phoneNumber" placeholder="Enter phone number" style="width:100%;">
              </div>
              <div style="grid-column:1/-1;">
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Address</label>
                <input class="input" id="svc_customerAddress" placeholder="Enter customer address" style="width:100%;">
              </div>
              <div>
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Service Price (₹) *</label>
                <input class="input" type="number" id="svc_price" placeholder="Total service price" style="width:100%;" oninput="app.updateServicePreview()">
              </div>
              <div>
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Advance Paid (₹)</label>
                <input class="input" type="number" id="svc_advance" placeholder="Advance amount received" style="width:100%;" oninput="app.updateServicePreview()">
              </div>
              <div>
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Service Date *</label>
                <input class="input" type="date" id="svc_serviceDate" value="${new Date().toISOString().split('T')[0]}" style="width:100%;">
              </div>
              <div>
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Status</label>
                <select class="input" id="svc_status" style="width:100%;">
                  <option value="Received">📥 Received</option>
                  <option value="In Progress">🔧 In Progress</option>
                  <option value="Ready for Pickup">📢 Ready for Pickup</option>
                  <option value="Completed">✅ Completed</option>
                  <option value="Delivered">🎉 Delivered</option>
                </select>
              </div>
              <div style="grid-column:1/-1;">
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Product / Service Details *</label>
                <textarea class="input" id="svc_serviceDetails" placeholder="e.g. iPhone 13 - Screen replacement, battery issue fixed..." rows="3" style="width:100%; resize:vertical;"></textarea>
              </div>
              <!-- Balance preview -->
              <div style="grid-column:1/-1; background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:10px 16px; display:flex; gap:32px; align-items:center; flex-wrap:wrap;">
                <div><span style="font-size:12px; color:#6b7280;">Total Price:</span> <span id="svc_preview_total" style="font-size:16px; font-weight:700; color:#374151;">₹0</span></div>
                <div><span style="font-size:12px; color:#6b7280;">Advance:</span> <span id="svc_preview_advance" style="font-size:16px; font-weight:700; color:#16a34a;">₹0</span></div>
                <div><span style="font-size:12px; color:#6b7280;">Balance Due:</span> <span id="svc_preview_balance" style="font-size:18px; font-weight:800; color:#dc2626;">₹0</span></div>
              </div>
            </div>
            <div style="display:flex; gap:12px; margin-top:16px;">
              <button class="btn btn-primary" onclick="app.saveServiceRecord()" style="padding:10px 24px;">💾 Save Service</button>
              <button class="btn btn-secondary" onclick="app.toggleServiceForm()" style="padding:10px 24px;">Cancel</button>
            </div>
          </div>

          <!-- Search -->
          <div style="margin-bottom:20px; display:flex; gap:12px; align-items:center;">
            <input class="input" placeholder="🔍 Search by name, phone, address or service details..."
              style="flex:1;"
              oninput="app.searchServices(this.value)"
              value="${this.serviceSearch || ''}">
            <span style="color:#fff; font-size:14px; font-weight:600;" class="services-counter">${filtered.length} records</span>
          </div>

          <!-- Records -->
          ${filtered.length === 0 ? `
            <div style="text-align:center; padding:60px; color:#fff; font-size:16px;">
              <div style="font-size:48px; margin-bottom:16px;">🔧</div>
              <p>No service records yet. Add your first service!</p>
            </div>
          ` : `
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:16px;">
              ${filtered.map(svc => {
                const price = Number(svc.price) || 0;
                const advance = Number(svc.advance) || 0;
                const balance = price - advance;
                const statusColors = {
                  'Received': '#6b7280',
                  'In Progress': '#d97706',
                  'Ready for Pickup': '#2563eb',
                  'Completed': '#16a34a',
                  'Delivered': '#7c3aed'
                };
                const color = statusColors[svc.status] || '#6b7280';
                return `
                  <div style="background:rgba(255,255,255,0.97); border-radius:12px; padding:16px; border:2px solid #fecaca; position:relative;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                      <div>
                        <div style="font-size:16px; font-weight:700; color:#000;">${svc.customerName}</div>
                        <div style="font-size:13px; color:#dc2626; font-weight:600;">📞 ${svc.phoneNumber}</div>
                        ${svc.customerAddress ? `<div style="font-size:12px; color:#6b7280;">📍 ${svc.customerAddress}</div>` : ''}
                      </div>
                      <div style="display:flex; gap:6px; align-items:center;">
                        <span style="font-size:11px; font-weight:700; color:${color}; background:${color}18; padding:3px 8px; border-radius:20px; border:1px solid ${color}40;">${svc.status || 'Received'}</span>
                        <button onclick="app.showServiceBill('${svc.serviceId}')" style="background:#dbeafe; border:none; border-radius:6px; padding:4px 8px; cursor:pointer; color:#1d4ed8; font-size:12px;" title="View Bill">🧾</button>
                        <button onclick="app.deleteServiceRecord('${svc.serviceId}')" style="background:#fee2e2; border:none; border-radius:6px; padding:4px 8px; cursor:pointer; color:#dc2626; font-size:12px;" title="Delete">🗑️</button>
                      </div>
                    </div>
                    <div style="border-top:1px solid #fecaca; padding-top:10px; display:flex; flex-direction:column; gap:5px;">
                      <div style="font-size:13px; color:#374151;"><span style="color:#6b7280;">🔧 Service:</span> ${svc.serviceDetails}</div>
                      <div style="font-size:12px; color:#6b7280;">📅 Date: ${svc.serviceDate}</div>
                      <div style="display:flex; gap:16px; margin-top:4px; flex-wrap:wrap;">
                        <div style="font-size:13px;"><span style="color:#6b7280;">Price:</span> <strong>₹${price.toLocaleString()}</strong></div>
                        <div style="font-size:13px; color:#16a34a;"><span style="color:#6b7280;">Advance:</span> <strong>₹${advance.toLocaleString()}</strong></div>
                        <div style="font-size:14px; font-weight:800; color:${balance > 0 ? '#dc2626' : '#16a34a'};">Balance: ₹${balance.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  }

  toggleServiceForm() {
    const form = document.getElementById('serviceForm');
    if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
  }

  updateServicePreview() {
    const price = Number(document.getElementById('svc_price')?.value) || 0;
    const advance = Number(document.getElementById('svc_advance')?.value) || 0;
    const balance = price - advance;
    const t = document.getElementById('svc_preview_total');
    const a = document.getElementById('svc_preview_advance');
    const b = document.getElementById('svc_preview_balance');
    if (t) t.textContent = `₹${price.toLocaleString()}`;
    if (a) a.textContent = `₹${advance.toLocaleString()}`;
    if (b) b.textContent = `₹${balance.toLocaleString()}`;
  }

  async saveServiceRecord() {
    const customerName = document.getElementById('svc_customerName')?.value?.trim();
    const phoneNumber = document.getElementById('svc_phoneNumber')?.value?.trim();
    const serviceDetails = document.getElementById('svc_serviceDetails')?.value?.trim();
    const serviceDate = document.getElementById('svc_serviceDate')?.value;
    const price = document.getElementById('svc_price')?.value;

    if (!customerName || !phoneNumber || !serviceDetails || !serviceDate || !price) {
      alert('Please fill in Customer Name, Phone Number, Service Details, Date and Price.');
      return;
    }

    const serviceData = {
      customerName,
      phoneNumber,
      customerAddress: document.getElementById('svc_customerAddress')?.value?.trim(),
      price,
      advance: document.getElementById('svc_advance')?.value || '0',
      serviceDate,
      status: document.getElementById('svc_status')?.value || 'Received',
      serviceDetails
    };

    try {
      const response = await fetch(`${this.API_URL}/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serviceData)
      });
      if (response.ok) {
        const saved = await response.json();
        this.serviceRecords.unshift(saved);
        alert('✅ Service record saved successfully!');
        this.renderPage('admin-services');
      } else {
        alert('❌ Failed to save service record.');
      }
    } catch (error) {
      console.error('Error saving service:', error);
      alert('❌ Error saving service record.');
    }
  }

  async deleteServiceRecord(serviceId) {
    if (!confirm('Delete this service record?')) return;
    try {
      const response = await fetch(`${this.API_URL}/services/${serviceId}`, { method: 'DELETE' });
      if (response.ok) {
        this.serviceRecords = this.serviceRecords.filter(s => s.serviceId !== serviceId);
        this.renderPage('admin-services');
        alert('✅ Service record deleted.');
      }
    } catch (error) {
      console.error('Error deleting service:', error);
    }
  }

  showServiceBill(serviceId) {
    const svc = this.serviceRecords.find(s => s.serviceId === serviceId);
    if (!svc) return;

    const price = Number(svc.price) || 0;
    const advance = Number(svc.advance) || 0;
    const balance = price - advance;

    const billHTML = `
      <div id="serviceBillModal" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;">
        <div style="background:#fff;border-radius:12px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.4);">
          <div id="serviceBillContent" style="padding:32px;">
            <!-- Header -->
            <div style="text-align:center;border-bottom:2px solid #dc2626;padding-bottom:16px;margin-bottom:20px;">
              <div style="font-size:22px;font-weight:800;color:#dc2626;letter-spacing:1px;">ஜிவி மொபைல்ஸ் — JIVI MOBILES</div>
              <div style="font-size:12px;color:#6b7280;margin-top:4px;">📞 +91 84890 62593 / +91 96295 16788 &nbsp;|&nbsp; ✉️ jivimobiles@gmail.com</div>
              <div style="font-size:13px;font-weight:700;color:#374151;margin-top:6px;">SERVICE RECEIPT</div>
            </div>

            <div style="display:flex;justify-content:space-between;margin-bottom:20px;">
              <div style="font-size:13px;color:#6b7280;">Date: <strong style="color:#111;">${svc.serviceDate}</strong></div>
              <div style="font-size:12px;background:${svc.status==='Delivered'||svc.status==='Completed'?'#dcfce7':'#fef3c7'};color:${svc.status==='Delivered'||svc.status==='Completed'?'#16a34a':'#d97706'};padding:3px 10px;border-radius:20px;font-weight:700;">${svc.status}</div>
            </div>

            <!-- Customer -->
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px;margin-bottom:20px;">
              <div style="font-size:12px;font-weight:700;color:#dc2626;margin-bottom:8px;text-transform:uppercase;">Customer Details</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                <div style="font-size:13px;"><span style="color:#6b7280;">Name:</span> <strong>${svc.customerName}</strong></div>
                <div style="font-size:13px;"><span style="color:#6b7280;">Phone:</span> <strong>${svc.phoneNumber}</strong></div>
                <div style="font-size:13px;grid-column:1/-1;"><span style="color:#6b7280;">Address:</span> <strong>${svc.customerAddress || '—'}</strong></div>
              </div>
            </div>

            <!-- Service details -->
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:20px;">
              <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:8px;text-transform:uppercase;">Service Details</div>
              <div style="font-size:13px;color:#374151;line-height:1.6;">${svc.serviceDetails}</div>
            </div>

            <!-- Payment summary -->
            <div style="border-top:2px solid #dc2626;padding-top:12px;margin-bottom:20px;">
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;">
                <span style="color:#6b7280;">Service Price</span>
                <span>₹${price.toLocaleString()}</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;color:#16a34a;">
                <span>Advance Paid</span>
                <span>- ₹${advance.toLocaleString()}</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:800;color:${balance>0?'#dc2626':'#16a34a'};border-top:1px dashed #fecaca;padding-top:8px;margin-top:4px;">
                <span>${balance > 0 ? 'Balance Due' : 'Fully Paid ✅'}</span>
                <span>₹${balance.toLocaleString()}</span>
              </div>
            </div>

            <div style="text-align:center;border-top:1px solid #e5e7eb;padding-top:14px;font-size:11px;color:#9ca3af;">
              Thank you for choosing ஜிவி மொபைல்ஸ் — Jivi Mobiles! 🙏<br>
              Please keep this receipt for reference.
            </div>
          </div>

          <div style="display:flex;gap:12px;padding:16px 32px 24px;border-top:1px solid #e5e7eb;">
            <button onclick="app.printServiceBill()" style="flex:1;background:#dc2626;color:#fff;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;">🖨️ Print / Save PDF</button>
            <button onclick="app.closeServiceBillModal()" style="flex:1;background:#f1f5f9;color:#374151;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:600;cursor:pointer;">✕ Close</button>
          </div>
        </div>
      </div>
    `;

    const existing = document.getElementById('serviceBillModal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', billHTML);
  }

  closeBillModal() {
    const m = document.getElementById('billModal');
    if (m) m.remove();
  }

  closeServiceBillModal() {
    const m = document.getElementById('serviceBillModal');
    if (m) m.remove();
  }

  printServiceBill() {
    const content = document.getElementById('serviceBillContent');
    if (!content) return;
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Service Receipt - ஜிவி மொபைல்ஸ் — Jivi Mobiles</title><style>body{font-family:Arial,sans-serif;margin:0;padding:20px;color:#111;}@media print{button{display:none!important;}}.print-btn{display:block;margin:20px auto;padding:10px 28px;background:#000;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;font-family:monospace;}</style></head><body>${content.innerHTML}<br><button class="print-btn" onclick="window.print()">🖨️ PRINT</button></body></html>`);
    printWindow.document.close();
    setTimeout(() => { try { printWindow.focus(); } catch(e) {} }, 200);
  }

  // ── Helper: parse service/sale date to a Date object ──────────────────
  _parseDate(str) {
    if (!str) return null;
    if (str.includes('-')) return new Date(str);
    const p = str.split('/');
    if (p.length === 3) return new Date(`${p[2]}-${p[1]}-${p[0]}`);
    return null;
  }

  renderDailyServices() {
    const records = this.serviceRecords || [];

    // Group by date string (YYYY-MM-DD)
    const groups = {};
    records.forEach(svc => {
      const d = this._parseDate(svc.serviceDate);
      const key = d && !isNaN(d) ? d.toISOString().split('T')[0] : 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(svc);
    });

    const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    const fmtDate = key => {
      if (key === 'Unknown') return 'Unknown Date';
      const d = new Date(key);
      return d.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    };

    return `
      <div class="owner-portal-page" style="min-height:100vh; background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%); color:#ffffff; padding-top:96px; padding-bottom:80px;">
        <div class="container">
          <button class="back-button" data-page="admin-services" style="margin-bottom: 20px;">&#8592; Services</button>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:28px; flex-wrap:wrap; gap:12px;">
            <div>
              <h1 style="font-size:32px; font-weight:700; margin-bottom:4px;">📅 Daily Service Records</h1>
              <p style="color:#94a3b8;">Services grouped by day — ${records.length} total records</p>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button onclick="app.renderPage('admin-services-monthly')" style="padding:12px 20px; background:#1d4ed8; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">📆 Monthly View</button>
              <button onclick="app.renderPage('admin-services')" style="padding:12px 20px; background:#374151; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">← All Records</button>
            </div>
          </div>

          ${sortedKeys.length === 0 ? `
            <div style="text-align:center; padding:60px; color:#fff; font-size:16px;">
              <div style="font-size:48px; margin-bottom:16px;">📅</div><p>No service records yet.</p>
            </div>
          ` : sortedKeys.map(key => {
            const dayRecords = groups[key];
            const totalPrice   = dayRecords.reduce((s, r) => s + (Number(r.price)   || 0), 0);
            const totalAdvance = dayRecords.reduce((s, r) => s + (Number(r.advance) || 0), 0);
            const totalBalance = totalPrice - totalAdvance;
            return `
              <div style="background:rgba(255,255,255,0.97); border-radius:14px; margin-bottom:24px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.12);">
                <!-- Day header -->
                <div style="background:linear-gradient(135deg,#0891b2,#0e7490); padding:14px 24px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                  <div style="font-size:16px; font-weight:800; color:#fff;">📅 ${fmtDate(key)}</div>
                  <div style="display:flex; gap:20px; flex-wrap:wrap;">
                    <div style="text-align:center;"><div style="font-size:18px; font-weight:800; color:#fff;">${dayRecords.length}</div><div style="font-size:11px; color:#cffafe;">Jobs</div></div>
                    <div style="text-align:center;"><div style="font-size:18px; font-weight:800; color:#fff;">₹${totalPrice.toLocaleString()}</div><div style="font-size:11px; color:#cffafe;">Total</div></div>
                    <div style="text-align:center;"><div style="font-size:18px; font-weight:800; color:#a7f3d0;">₹${totalAdvance.toLocaleString()}</div><div style="font-size:11px; color:#cffafe;">Advance</div></div>
                    <div style="text-align:center;"><div style="font-size:18px; font-weight:800; color:${totalBalance>0?'#fde68a':'#a7f3d0'};">₹${totalBalance.toLocaleString()}</div><div style="font-size:11px; color:#cffafe;">Balance</div></div>
                  </div>
                </div>
                <!-- Table -->
                <div style="overflow-x:auto;">
                  <table style="width:100%; border-collapse:collapse; font-size:13px;">
                    <thead>
                      <tr style="background:#ecfeff; border-bottom:2px solid #a5f3fc;">
                        <th style="padding:9px 14px; text-align:left; color:#374151;">#</th>
                        <th style="padding:9px 14px; text-align:left; color:#374151;">Customer</th>
                        <th style="padding:9px 14px; text-align:left; color:#374151;">Phone</th>
                        <th style="padding:9px 14px; text-align:left; color:#374151;">Service Details</th>
                        <th style="padding:9px 14px; text-align:left; color:#374151;">Status</th>
                        <th style="padding:9px 14px; text-align:right; color:#374151;">Price</th>
                        <th style="padding:9px 14px; text-align:right; color:#374151;">Advance</th>
                        <th style="padding:9px 14px; text-align:right; color:#374151;">Balance</th>
                        <th style="padding:9px 14px; text-align:center; color:#374151;">Bill</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${dayRecords.map((svc, i) => {
                        const p = Number(svc.price)||0, a = Number(svc.advance)||0, b = p-a;
                        return `
                          <tr style="border-bottom:1px solid #ecfeff; ${i%2===1?'background:#f0fdff;':''}">
                            <td style="padding:9px 14px; color:#9ca3af;">${i+1}</td>
                            <td style="padding:9px 14px; font-weight:600; color:#111;">${svc.customerName}</td>
                            <td style="padding:9px 14px; color:#0891b2;">${svc.phoneNumber}</td>
                            <td style="padding:9px 14px; color:#374151; max-width:200px;">${svc.serviceDetails}</td>
                            <td style="padding:9px 14px;"><span style="font-size:11px; font-weight:700; padding:2px 8px; border-radius:20px; background:#f0fdf4; color:#16a34a;">${svc.status||'Received'}</span></td>
                            <td style="padding:9px 14px; text-align:right;">${p?'₹'+p.toLocaleString():'—'}</td>
                            <td style="padding:9px 14px; text-align:right; color:#16a34a;">${a?'₹'+a.toLocaleString():'—'}</td>
                            <td style="padding:9px 14px; text-align:right; font-weight:700; color:${b>0?'#dc2626':'#16a34a'};">${p?'₹'+b.toLocaleString():'—'}</td>
                            <td style="padding:9px 14px; text-align:center;"><button onclick="app.showServiceBill('${svc.serviceId}')" style="background:#dbeafe; border:none; border-radius:6px; padding:4px 10px; cursor:pointer; color:#1d4ed8; font-size:13px;">🧾</button></td>
                          </tr>`;
                      }).join('')}
                    </tbody>
                    <tfoot>
                      <tr style="background:#ecfeff; border-top:2px solid #a5f3fc;">
                        <td colspan="5" style="padding:9px 14px; font-weight:700; color:#374151;">Day Total</td>
                        <td style="padding:9px 14px; text-align:right; font-weight:700;">₹${totalPrice.toLocaleString()}</td>
                        <td style="padding:9px 14px; text-align:right; font-weight:700; color:#16a34a;">₹${totalAdvance.toLocaleString()}</td>
                        <td style="padding:9px 14px; text-align:right; font-weight:800; color:${totalBalance>0?'#dc2626':'#16a34a'};">₹${totalBalance.toLocaleString()}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  renderMonthlyServices() {
    const records = this.serviceRecords || [];

    // Group by YYYY-MM
    const groups = {};
    records.forEach(svc => {
      const d = this._parseDate(svc.serviceDate);
      const key = d && !isNaN(d)
        ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
        : 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(svc);
    });

    const sortedKeys = Object.keys(groups).sort((a,b) => b.localeCompare(a));
    const monthLabel = key => {
      if (key === 'Unknown') return 'Unknown Date';
      const [y, m] = key.split('-');
      return new Date(y, m-1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    };

    return `
      <div class="owner-portal-page" style="min-height:100vh; background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%); color:#ffffff; padding-top:96px; padding-bottom:80px;">
        <div class="container">
          <button class="back-button" data-page="admin-services" style="margin-bottom: 20px;">&#8592; Services</button>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:28px; flex-wrap:wrap; gap:12px;">
            <div>
              <h1 style="font-size:32px; font-weight:700; margin-bottom:4px;">📆 Monthly Service Records</h1>
              <p style="color:#94a3b8;">Services grouped by month — ${records.length} total records</p>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button onclick="app.renderPage('admin-services-daily')" style="padding:12px 20px; background:#0891b2; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">📅 Daily View</button>
              <button onclick="app.renderPage('admin-services')" style="padding:12px 20px; background:#374151; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">← All Records</button>
            </div>
          </div>

          ${sortedKeys.length === 0 ? `
            <div style="text-align:center; padding:60px; color:#fff; font-size:16px;">
              <div style="font-size:48px; margin-bottom:16px;">📆</div><p>No service records yet.</p>
            </div>
          ` : sortedKeys.map(key => {
            const monthRecords = groups[key];
            const totalPrice   = monthRecords.reduce((s,r) => s+(Number(r.price)||0), 0);
            const totalAdvance = monthRecords.reduce((s,r) => s+(Number(r.advance)||0), 0);
            const totalBalance = totalPrice - totalAdvance;
            return `
              <div style="background:rgba(255,255,255,0.97); border-radius:14px; margin-bottom:28px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.12);">
                <!-- Month header -->
                <div style="background:linear-gradient(135deg,#1d4ed8,#1e40af); padding:16px 24px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                  <div style="font-size:18px; font-weight:800; color:#fff;">📆 ${monthLabel(key)}</div>
                  <div style="display:flex; gap:20px; flex-wrap:wrap;">
                    <div style="text-align:center;"><div style="font-size:20px; font-weight:800; color:#fff;">${monthRecords.length}</div><div style="font-size:11px; color:#bfdbfe;">Jobs</div></div>
                    <div style="text-align:center;"><div style="font-size:20px; font-weight:800; color:#fff;">₹${totalPrice.toLocaleString()}</div><div style="font-size:11px; color:#bfdbfe;">Total Revenue</div></div>
                    <div style="text-align:center;"><div style="font-size:20px; font-weight:800; color:#a7f3d0;">₹${totalAdvance.toLocaleString()}</div><div style="font-size:11px; color:#bfdbfe;">Advance Collected</div></div>
                    <div style="text-align:center;"><div style="font-size:20px; font-weight:800; color:${totalBalance>0?'#fde68a':'#a7f3d0'};">₹${totalBalance.toLocaleString()}</div><div style="font-size:11px; color:#bfdbfe;">Balance Pending</div></div>
                  </div>
                </div>
                <!-- Table -->
                <div style="overflow-x:auto;">
                  <table style="width:100%; border-collapse:collapse; font-size:13px;">
                    <thead>
                      <tr style="background:#eff6ff; border-bottom:2px solid #bfdbfe;">
                        <th style="padding:9px 14px; text-align:left; color:#374151;">#</th>
                        <th style="padding:9px 14px; text-align:left; color:#374151;">Customer</th>
                        <th style="padding:9px 14px; text-align:left; color:#374151;">Phone</th>
                        <th style="padding:9px 14px; text-align:left; color:#374151;">Service Details</th>
                        <th style="padding:9px 14px; text-align:left; color:#374151;">Date</th>
                        <th style="padding:9px 14px; text-align:left; color:#374151;">Status</th>
                        <th style="padding:9px 14px; text-align:right; color:#374151;">Price</th>
                        <th style="padding:9px 14px; text-align:right; color:#374151;">Advance</th>
                        <th style="padding:9px 14px; text-align:right; color:#374151;">Balance</th>
                        <th style="padding:9px 14px; text-align:center; color:#374151;">Bill</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${monthRecords.map((svc, i) => {
                        const p = Number(svc.price)||0, a = Number(svc.advance)||0, b = p-a;
                        return `
                          <tr style="border-bottom:1px solid #eff6ff; ${i%2===1?'background:#f8faff;':''}">
                            <td style="padding:9px 14px; color:#9ca3af;">${i+1}</td>
                            <td style="padding:9px 14px; font-weight:600; color:#111;">${svc.customerName}</td>
                            <td style="padding:9px 14px; color:#1d4ed8;">${svc.phoneNumber}</td>
                            <td style="padding:9px 14px; color:#374151; max-width:200px;">${svc.serviceDetails}</td>
                            <td style="padding:9px 14px; color:#6b7280;">${svc.serviceDate}</td>
                            <td style="padding:9px 14px;"><span style="font-size:11px; font-weight:700; padding:2px 8px; border-radius:20px; background:#f0fdf4; color:#16a34a;">${svc.status||'Received'}</span></td>
                            <td style="padding:9px 14px; text-align:right;">${p?'₹'+p.toLocaleString():'—'}</td>
                            <td style="padding:9px 14px; text-align:right; color:#16a34a;">${a?'₹'+a.toLocaleString():'—'}</td>
                            <td style="padding:9px 14px; text-align:right; font-weight:700; color:${b>0?'#dc2626':'#16a34a'};">${p?'₹'+b.toLocaleString():'—'}</td>
                            <td style="padding:9px 14px; text-align:center;"><button onclick="app.showServiceBill('${svc.serviceId}')" style="background:#dbeafe; border:none; border-radius:6px; padding:4px 10px; cursor:pointer; color:#1d4ed8; font-size:13px;">🧾</button></td>
                          </tr>`;
                      }).join('')}
                    </tbody>
                    <tfoot>
                      <tr style="background:#eff6ff; border-top:2px solid #bfdbfe;">
                        <td colspan="6" style="padding:9px 14px; font-weight:700; color:#374151;">Month Total</td>
                        <td style="padding:9px 14px; text-align:right; font-weight:700;">₹${totalPrice.toLocaleString()}</td>
                        <td style="padding:9px 14px; text-align:right; font-weight:700; color:#16a34a;">₹${totalAdvance.toLocaleString()}</td>
                        <td style="padding:9px 14px; text-align:right; font-weight:800; color:${totalBalance>0?'#dc2626':'#16a34a'};">₹${totalBalance.toLocaleString()}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  renderMonthlySales() {
    // Group sales by year-month
    const groups = {};
    this.salesRecords.forEach(sale => {
      // purchaseDate can be "YYYY-MM-DD" or "DD/MM/YYYY"
      let dateObj = null;
      if (sale.purchaseDate) {
        if (sale.purchaseDate.includes('-')) {
          dateObj = new Date(sale.purchaseDate);
        } else {
          // DD/MM/YYYY
          const parts = sale.purchaseDate.split('/');
          if (parts.length === 3) dateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
      }
      const key = dateObj && !isNaN(dateObj)
        ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`
        : 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(sale);
    });

    // Sort months descending
    const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    const monthLabel = (key) => {
      if (key === 'Unknown') return 'Unknown Date';
      const [y, m] = key.split('-');
      return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    };

    return `
      <div class="owner-portal-page" style="min-height:100vh; background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%); color:#ffffff; padding-top:96px; padding-bottom:80px;">
        <div class="container">
          <button class="back-button" data-page="admin-sales" style="margin-bottom: 20px;">&#8592; Sales Records</button>
          <!-- Header -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:28px; flex-wrap:wrap; gap:12px;">
            <div>
              <h1 style="font-size:32px; font-weight:700; margin-bottom:4px;">📅 Monthly Sales</h1>
              <p style="color:#94a3b8;">Sales grouped by month — ${this.salesRecords.length} total records</p>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="btn btn-primary" onclick="app.toggleSalesForm(); app.renderPage('admin-sales')" style="padding:12px 24px;">+ Add Sale</button>
              <button onclick="app.renderPage('admin-sales')" style="padding:12px 24px; background:#374151; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">← All Records</button>
            </div>
          </div>

          ${sortedKeys.length === 0 ? `
            <div style="text-align:center; padding:60px; color:#fff; font-size:16px;">
              <div style="font-size:48px; margin-bottom:16px;">📅</div>
              <p>No sales records yet.</p>
            </div>
          ` : sortedKeys.map(key => {
            const sales = groups[key];
            const totalRevenue = sales.reduce((sum, s) => sum + (Number(s.saleAmount) || 0), 0);
            const totalDiscount = sales.reduce((sum, s) => sum + (Number(s.discount) || 0), 0);
            const netRevenue = totalRevenue - totalDiscount;

            return `
              <div style="background:rgba(255,255,255,0.97); border-radius:14px; margin-bottom:28px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.12);">
                <!-- Month header -->
                <div style="background:linear-gradient(135deg,#dc2626,#b91c1c); padding:16px 24px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                  <div style="font-size:18px; font-weight:800; color:#fff;">📅 ${monthLabel(key)}</div>
                  <div style="display:flex; gap:20px; flex-wrap:wrap;">
                    <div style="text-align:center;">
                      <div style="font-size:20px; font-weight:800; color:#fff;">${sales.length}</div>
                      <div style="font-size:11px; color:#fecaca;">Sales</div>
                    </div>
                    <div style="text-align:center;">
                      <div style="font-size:20px; font-weight:800; color:#fff;">₹${netRevenue.toLocaleString()}</div>
                      <div style="font-size:11px; color:#fecaca;">Net Revenue</div>
                    </div>
                    ${totalDiscount > 0 ? `
                    <div style="text-align:center;">
                      <div style="font-size:20px; font-weight:800; color:#fde68a;">₹${totalDiscount.toLocaleString()}</div>
                      <div style="font-size:11px; color:#fecaca;">Discounts</div>
                    </div>` : ''}
                  </div>
                </div>

                <!-- Sales table -->
                <div style="overflow-x:auto;">
                  <table style="width:100%; border-collapse:collapse; font-size:13px;">
                    <thead>
                      <tr style="background:#fef2f2; border-bottom:2px solid #fecaca;">
                        <th style="padding:10px 16px; text-align:left; color:#374151; font-weight:700;">#</th>
                        <th style="padding:10px 16px; text-align:left; color:#374151; font-weight:700;">Customer</th>
                        <th style="padding:10px 16px; text-align:left; color:#374151; font-weight:700;">Phone</th>
                        <th style="padding:10px 16px; text-align:left; color:#374151; font-weight:700;">Product</th>
                        <th style="padding:10px 16px; text-align:left; color:#374151; font-weight:700;">Date</th>
                        <th style="padding:10px 16px; text-align:right; color:#374151; font-weight:700;">Amount</th>
                        <th style="padding:10px 16px; text-align:right; color:#374151; font-weight:700;">Discount</th>
                        <th style="padding:10px 16px; text-align:right; color:#374151; font-weight:700;">Net</th>
                        <th style="padding:10px 16px; text-align:center; color:#374151; font-weight:700;">Bill</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${sales.map((sale, idx) => {
                        const amt = Number(sale.saleAmount) || 0;
                        const disc = Number(sale.discount) || 0;
                        const net = amt - disc;
                        return `
                          <tr style="border-bottom:1px solid #fef2f2; ${idx % 2 === 1 ? 'background:#fffbfb;' : ''}">
                            <td style="padding:10px 16px; color:#9ca3af;">${idx + 1}</td>
                            <td style="padding:10px 16px; font-weight:600; color:#111;">${sale.customerName}</td>
                            <td style="padding:10px 16px; color:#dc2626;">${sale.phoneNumber}</td>
                            <td style="padding:10px 16px; color:#374151;">${sale.productName}</td>
                            <td style="padding:10px 16px; color:#6b7280;">${sale.purchaseDate}</td>
                            <td style="padding:10px 16px; text-align:right; color:#374151;">${amt ? '₹' + amt.toLocaleString() : '—'}</td>
                            <td style="padding:10px 16px; text-align:right; color:#16a34a;">${disc ? '₹' + disc.toLocaleString() : '—'}</td>
                            <td style="padding:10px 16px; text-align:right; font-weight:700; color:#dc2626;">${amt ? '₹' + net.toLocaleString() : '—'}</td>
                            <td style="padding:10px 16px; text-align:center;">
                              <div style="display:flex;gap:6px;justify-content:center;">
                                <button onclick="app.showEditSaleModal('${sale.saleId}')" style="background:#16a34a; border:none; border-radius:8px; padding:6px 12px; cursor:pointer; color:#fff; font-size:13px; font-weight:700;" title="Edit">✏️ Edit</button>
                                <button onclick="app.printBill('${sale.saleId}')" style="background:#1d4ed8; border:none; border-radius:8px; padding:6px 12px; cursor:pointer; color:#fff; font-size:13px; font-weight:700;" title="Print Receipt">🧾 Print</button>
                                <button onclick="app.shareSaleWhatsApp('${sale.saleId}')" style="background:#25d366; border:none; border-radius:8px; padding:6px 12px; cursor:pointer; color:#fff; font-size:13px; font-weight:700;" title="WhatsApp">💬</button>
                              </div>
                            </td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                    <!-- Month total row -->
                    <tfoot>
                      <tr style="background:#fef2f2; border-top:2px solid #fecaca;">
                        <td colspan="5" style="padding:10px 16px; font-weight:700; color:#374151;">Month Total</td>
                        <td style="padding:10px 16px; text-align:right; font-weight:700; color:#374151;">₹${totalRevenue.toLocaleString()}</td>
                        <td style="padding:10px 16px; text-align:right; font-weight:700; color:#16a34a;">₹${totalDiscount.toLocaleString()}</td>
                        <td style="padding:10px 16px; text-align:right; font-weight:800; color:#dc2626; font-size:14px;">₹${netRevenue.toLocaleString()}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  toggleSalesForm() {
    const form = document.getElementById('salesForm');
    if (!form) return;
    const isHidden = form.style.display === 'none';
    form.style.display = isHidden ? 'block' : 'none';
    if (isHidden) {
      const container = document.getElementById('sale_items_container');
      if (container && container.children.length === 0) {
        this.addSaleProductRow();
      }
      this.updateBillPreview();
      this.tempSalePhotos = [];
      this.renderTrackingPhotoThumbnails('tempSalePhotos', 'salePhotosPreview');
      setTimeout(() => {
        this.initSignatureCanvas('saleSignatureCanvas');
      }, 150);
    }
  }

  // Generate a unique row ID
  _saleRowId() {
    return 'row_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  }

  scanBarcodeToSalesForm(value) {
    const code = (value || '').trim();
    if (!code) return;
    const lowerCode = code.toLowerCase();

    const allItems = this.getAllPOSItems();
    const matched = allItems.find(i => 
      String(i.id) === code ||
      (i.barcode && i.barcode.toLowerCase() === lowerCode) ||
      (i.raw && (i.raw.sku === code || i.raw.barcode === code || i.raw.imei1 === code || i.raw.imei2 === code || i.raw.stockItemId === code || i.raw.partItemId === code))
    );

    if (matched) {
      this.addSaleProductRow(matched);
      alert(`✅ Scanned & added "${matched.name}" to sales items!`);
    } else {
      alert(`❌ Item with barcode "${code}" not found in inventory.`);
    }
  }

  addSaleProductRow(presetItem = null) {
    const container = document.getElementById('sale_items_container');
    if (!container) return;
    const rowId = this._saleRowId();
    const rowHtml = `
      <div id="${rowId}" data-item-id="${presetItem ? presetItem.id : ''}" data-item-type="${presetItem ? presetItem.type : 'product'}" style="display:grid; grid-template-columns:2fr 1.2fr 0.8fr 1fr 1fr 32px; gap:6px; margin-bottom:6px; align-items:start;">
        <div style="position:relative;">
          <input class="input sp_name" data-row="${rowId}" value="${presetItem ? (presetItem.name || '').replace(/"/g, '&quot;') : ''}" placeholder="Type to search products, displays, spares..."
            style="width:100%; font-size:13px; color:#111; background:#fff; border:1px solid #d1d5db;"
            autocomplete="off"
            oninput="app.showRowProductSuggestions(this, '${rowId}')"
            onblur="setTimeout(()=>{ const d=document.getElementById('dd_${rowId}'); if(d) d.style.display='none'; }, 200)">
          <div id="dd_${rowId}" style="display:none; position:absolute; top:100%; left:0; right:0; background:#fff; border:2px solid #dc2626; border-radius:8px; max-height:220px; overflow-y:auto; z-index:9999; box-shadow:0 4px 12px rgba(0,0,0,0.15);"></div>
        </div>
        <input class="input sp_cat" data-row="${rowId}" value="${presetItem ? (presetItem.badgeText || presetItem.category || '') : ''}" placeholder="Category" readonly
          style="width:100%; font-size:13px; background:#f9fafb; color:#6b7280; border:1px solid #e5e7eb;">
        <input class="input sp_qty" data-row="${rowId}" type="number" placeholder="1" min="1" value="1"
          style="width:100%; font-size:13px; color:#111; border:1px solid #d1d5db;"
          oninput="app.updateBillPreview()">
        <input class="input sp_amount" data-row="${rowId}" type="number" value="${presetItem ? (presetItem.price || '') : ''}" placeholder="Amount" min="0"
          style="width:100%; font-size:13px; color:#111; border:1px solid #d1d5db;"
          oninput="app.updateBillPreview()">
        <input class="input sp_discount" data-row="${rowId}" type="number" placeholder="0" min="0" value="0"
          style="width:100%; font-size:13px; color:#111; border:1px solid #d1d5db;"
          oninput="app.updateBillPreview()">
        <button type="button" onclick="app.removeSaleProductRow('${rowId}')"
          style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; border-radius:6px; width:28px; height:34px; font-size:16px; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0; flex-shrink:0;">
          ×
        </button>
      </div>`;
    container.insertAdjacentHTML('beforeend', rowHtml);
    const newRow = document.getElementById(rowId);
    if (newRow && !presetItem) newRow.querySelector('.sp_name')?.focus();
    this.updateBillPreview();
  }

  removeSaleProductRow(rowId) {
    const row = document.getElementById(rowId);
    if (!row) return;
    const container = document.getElementById('sale_items_container');
    if (container && container.children.length <= 1) {
      alert('You need at least one product.');
      return;
    }
    row.remove();
    this.updateBillPreview();
  }

  showRowProductSuggestions(input, rowId) {
    const query = input.value.toLowerCase().trim();
    const dropdown = document.getElementById(`dd_${rowId}`);
    if (!dropdown) return;

    if (!query) { dropdown.style.display = 'none'; return; }

    const allItems = this.getAllPOSItems();
    const matches = allItems.filter(item =>
      (item.name || '').toLowerCase().includes(query) ||
      (item.category || '').toLowerCase().includes(query) ||
      (item.badgeText || '').toLowerCase().includes(query)
    ).slice(0, 10);

    if (matches.length === 0) { dropdown.style.display = 'none'; return; }

    dropdown.innerHTML = matches.map(item => `
      <div onmousedown="app.selectRowProduct('${rowId}', '${(item.name || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', '${(item.badgeText || item.category || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', ${Number(item.price) || 0}, '${item.id || ''}', '${item.type || 'product'}')"
        style="padding:10px 14px; cursor:pointer; border-bottom:1px solid #f3f4f6; font-size:13px; display:flex; justify-content:space-between; align-items:center;"
        onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='#fff'">
        <div>
          <span style="font-weight:700; color:#111;">${item.icon || '📦'} ${item.name}</span>
          <span style="margin-left:6px; font-size:10.5px; font-weight:700; padding:2px 6px; border-radius:4px; ${item.type==='display'?'background:#e0f2fe;color:#0284c7;':item.type==='spare'?'background:#fef3c7;color:#b45309;':'background:#f3e8ff;color:#6b21a8;'}">${item.badgeText}</span>
        </div>
        <span style="color:#16a34a; font-weight:800; font-size:12.5px;">${item.price ? '₹' + Number(item.price).toLocaleString('en-IN') : ''}</span>
      </div>
    `).join('');
    dropdown.style.display = 'block';
  }

  selectRowProduct(rowId, name, category, price, id = '', type = 'product') {
    const row = document.getElementById(rowId);
    if (!row) return;
    row.dataset.itemId = id;
    row.dataset.itemType = type;

    const nameInput     = row.querySelector('.sp_name');
    const catInput      = row.querySelector('.sp_cat');
    const amountInput   = row.querySelector('.sp_amount');
    const dropdown      = document.getElementById(`dd_${rowId}`);

    if (nameInput)   nameInput.value   = name;
    if (catInput)    catInput.value    = category;
    if (amountInput) amountInput.value = price || '';
    if (dropdown)    dropdown.style.display = 'none';

    this.updateBillPreview();
  }

  async saveSaleRecord() {
    const customerName = document.getElementById('sale_customerName')?.value?.trim();
    const phoneNumber  = document.getElementById('sale_phoneNumber')?.value?.trim();
    const purchaseDate = document.getElementById('sale_purchaseDate')?.value;
    const imeiNumber   = document.getElementById('sale_imeiNumber')?.value?.trim();

    if (!customerName || !phoneNumber || !purchaseDate) {
      alert('Please fill in Customer Name, Phone Number and Purchase Date.');
      return;
    }

    const container = document.getElementById('sale_items_container');
    const rows = container ? Array.from(container.children) : [];
    const items = rows.map(row => ({
      id:       row.dataset.itemId || '',
      type:     row.dataset.itemType || 'product',
      name:     (row.querySelector('.sp_name')?.value || '').trim(),
      category: (row.querySelector('.sp_cat')?.value  || '').trim(),
      quantity: Number(row.querySelector('.sp_qty')?.value)      || 1,
      qty:      Number(row.querySelector('.sp_qty')?.value)      || 1,
      amount:   Number(row.querySelector('.sp_amount')?.value)   || 0,
      price:    Number(row.querySelector('.sp_amount')?.value)   || 0,
      discount: Number(row.querySelector('.sp_discount')?.value) || 0
    })).filter(i => i.name);

    if (items.length === 0) {
      alert('Please add at least one product.');
      return;
    }

    const proofImages = [...(this.tempSalePhotos || [])];
    const signatureImage = this.getSignatureDataURL('saleSignatureCanvas');

    const productName = items.map(i => i.quantity > 1 ? `${i.name} (x${i.quantity})` : i.name).join(', ');
    const totalAmount = items.reduce((s, i) => s + (i.amount * i.quantity), 0);
    const totalDiscount = items.reduce((s, i) => s + (i.discount * i.quantity), 0);
    const netAmount = Math.max(0, totalAmount - totalDiscount);

    const saleData = {
      customerName,
      phoneNumber,
      customerAddress: document.getElementById('sale_customerAddress')?.value?.trim(),
      imeiNumber: imeiNumber || '',
      imsNumber: imeiNumber || '',
      productName,
      productItems: items,
      proofImages,
      signatureImage,
      saleAmount: totalAmount || null,
      discount: totalDiscount || null,
      netAmount,
      purchaseDate,
      warrantyPeriod: document.getElementById('sale_warrantyPeriod')?.value,
      notes: document.getElementById('sale_notes')?.value?.trim()
    };

    try {
      const response = await fetch(`${this.API_URL}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleData)
      });
      if (response.ok) {
        const saved = await response.json();
        this.salesRecords.unshift(saved);

        // Permanently deduct stock for all products, displays, and spare parts sold
        await this.processStockDeductionForReplacedItems(items, saved.saleId || saved._id, customerName);

        alert('✅ Sale record saved & stock auto-deducted successfully!');
        this.tempSalePhotos = [];
        this.renderPage('admin-sales');
      } else {
        alert('❌ Failed to save sale record.');
      }
    } catch (error) {
      console.error('Error saving sale:', error);
      alert('❌ Error saving sale record.');
    }
  }

  updateBillPreview() {
    const container = document.getElementById('sale_items_container');
    let total = 0;
    if (container) {
      Array.from(container.children).forEach(row => {
        const qty      = Number(row.querySelector('.sp_qty')?.value)      || 1;
        const amount   = Number(row.querySelector('.sp_amount')?.value)   || 0;
        const discount = Number(row.querySelector('.sp_discount')?.value) || 0;
        total += Math.max(0, (amount - discount) * qty);
      });
    }
    const el = document.getElementById('bill_preview_total');
    if (el) el.textContent = `₹${total.toLocaleString('en-IN')}`;
  }

  showEditSaleModal(saleId) {
    const sale = this.salesRecords.find(s => s.saleId === saleId);
    if (!sale) return;

    const existing = document.getElementById('editSaleModal');
    if (existing) existing.remove();

    const modalHTML = `
      <div id="editSaleModal" onclick="if(event.target===this)this.remove()"
        style="position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;">
        <div style="background:#fff;border-radius:14px;padding:28px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.4);">
          <h3 style="font-size:18px;font-weight:800;color:#111;margin-bottom:20px;">✏️ Edit Sale Record</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Customer Name *</label>
              <input id="es_customerName" class="input" value="${sale.customerName || ''}" style="width:100%;color:#111;background:#f8fafc;border:1px solid #d1d5db;">
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Phone Number *</label>
              <input id="es_phoneNumber" class="input" value="${sale.phoneNumber || ''}" style="width:100%;color:#111;background:#f8fafc;border:1px solid #d1d5db;">
            </div>
            <div style="grid-column:1/-1;">
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Address</label>
              <input id="es_customerAddress" class="input" value="${sale.customerAddress || ''}" style="width:100%;color:#111;background:#f8fafc;border:1px solid #d1d5db;">
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Product Name *</label>
              <input id="es_productName" class="input" value="${sale.productName || ''}" style="width:100%;color:#111;background:#f8fafc;border:1px solid #d1d5db;">
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Sale Amount (₹)</label>
              <input id="es_saleAmount" class="input" type="number" value="${sale.saleAmount || ''}" style="width:100%;color:#111;background:#f8fafc;border:1px solid #d1d5db;">
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Discount (₹)</label>
              <input id="es_discount" class="input" type="number" value="${sale.discount || ''}" placeholder="0" style="width:100%;color:#111;background:#f8fafc;border:1px solid #d1d5db;">
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Purchase Date *</label>
              <input id="es_purchaseDate" class="input" type="date" value="${sale.purchaseDate || ''}" style="width:100%;color:#111;background:#f8fafc;border:1px solid #d1d5db;">
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Warranty Period</label>
              <select id="es_warrantyPeriod" class="input" style="width:100%;color:#111;background:#f8fafc;border:1px solid #d1d5db;">
                <option value="" ${!sale.warrantyPeriod ? 'selected' : ''}>No Warranty</option>
                <option value="1 Month" ${sale.warrantyPeriod === '1 Month' ? 'selected' : ''}>1 Month</option>
                <option value="3 Months" ${sale.warrantyPeriod === '3 Months' ? 'selected' : ''}>3 Months</option>
                <option value="6 Months" ${sale.warrantyPeriod === '6 Months' ? 'selected' : ''}>6 Months</option>
                <option value="1 Year" ${sale.warrantyPeriod === '1 Year' ? 'selected' : ''}>1 Year</option>
                <option value="2 Years" ${sale.warrantyPeriod === '2 Years' ? 'selected' : ''}>2 Years</option>
              </select>
            </div>
            <div style="grid-column:1/-1;">
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Notes</label>
              <textarea id="es_notes" class="input" rows="2" style="width:100%;color:#111;background:#f8fafc;border:1px solid #d1d5db;resize:vertical;">${sale.notes || ''}</textarea>
            </div>
          </div>
          <div style="display:flex;gap:10px;margin-top:20px;">
            <button onclick="app.saveEditSale('${sale.saleId}')"
              style="flex:1;background:#16a34a;color:#fff;border:none;border-radius:8px;padding:11px;font-size:14px;font-weight:700;cursor:pointer;">
              💾 Save Changes
            </button>
            <button onclick="document.getElementById('editSaleModal').remove()"
              style="flex:1;background:#f1f5f9;color:#374151;border:1px solid #d1d5db;border-radius:8px;padding:11px;font-size:14px;font-weight:600;cursor:pointer;">
              ✕ Cancel
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  async saveEditSale(saleId) {
    const customerName  = document.getElementById('es_customerName')?.value?.trim();
    const phoneNumber   = document.getElementById('es_phoneNumber')?.value?.trim();
    const productName   = document.getElementById('es_productName')?.value?.trim();
    const purchaseDate  = document.getElementById('es_purchaseDate')?.value;

    if (!customerName || !phoneNumber || !productName || !purchaseDate) {
      alert('Please fill in Customer Name, Phone, Product Name and Date.');
      return;
    }

    const updatedData = {
      customerName,
      phoneNumber,
      customerAddress: document.getElementById('es_customerAddress')?.value?.trim(),
      productName,
      saleAmount:      document.getElementById('es_saleAmount')?.value || null,
      discount:        document.getElementById('es_discount')?.value || null,
      purchaseDate,
      warrantyPeriod:  document.getElementById('es_warrantyPeriod')?.value,
      notes:           document.getElementById('es_notes')?.value?.trim()
    };

    try {
      const response = await fetch(`${this.API_URL}/sales/${saleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      if (response.ok) {
        const updated = await response.json();
        const idx = this.salesRecords.findIndex(s => s.saleId === saleId);
        if (idx !== -1) this.salesRecords[idx] = updated;
        document.getElementById('editSaleModal')?.remove();
        this.renderPage('admin-sales');
      } else {
        alert('❌ Failed to update sale record.');
      }
    } catch (err) {
      console.error(err);
      alert('❌ Error updating sale record.');
    }
  }

  showBillModal(saleId) {
    const sale = this.salesRecords.find(s => s.saleId === saleId);
    if (!sale) return;

    const amount   = Number(sale.saleAmount) || 0;
    const discount = Number(sale.discount) || 0;
    const net      = amount - discount;

    const receiptStyle = `
      font-family: Arial, 'Helvetica Neue', sans-serif;
      font-size: 12px;
      width: 300px;
      color: #000;
      background: #fff;
      padding: 16px;
      line-height: 1.5;
    `;

    const billHTML = `
      <div id="billModal" onclick="if(event.target===this)app.closeBillModal()" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;">
        <div style="background:#fff;border-radius:8px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5);">

          <!-- Thermal Receipt Preview -->
          <div id="billContent" style="${receiptStyle}">

            <!-- Header -->
            <div style="text-align:center;">
              <div style="font-size:15px;font-weight:bold;">ஜிவி மொபைல்ஸ் — JIVI MOBILES</div>
              <div style="font-size:10px;margin-top:2px;">Laptop & Mobile Sales / Service</div>
              <div style="font-size:10px;">Vanthavasi, Tamil Nadu</div>
              <div style="font-size:10px;">Ph: +91 84890 62593 / +91 96295 16788</div>
              <div style="font-size:10px;">jivimobiles@gmail.com</div>
            </div>

            <div style="border-top:1px solid #000;margin:6px 0;"></div>
            <div style="text-align:center;font-weight:bold;font-size:12px;letter-spacing:1px;">** SALES RECEIPT **</div>
            <div style="text-align:center;font-size:10px;">Date: ${sale.purchaseDate || new Date().toLocaleDateString('en-IN')}</div>
            <div style="text-align:center;font-size:10px;">Bill No: ${sale.saleId}</div>
            <div style="border-top:1px dashed #000;margin:6px 0;"></div>

            <!-- Customer -->
            <div style="font-weight:bold;margin-bottom:3px;">CUSTOMER DETAILS</div>
            <div style="display:flex;justify-content:space-between;"><span>Name</span><span style="font-weight:bold;text-align:right;max-width:55%;word-break:break-word;">${sale.customerName}</span></div>
            <div style="display:flex;justify-content:space-between;"><span>Phone</span><span style="font-weight:bold;">${sale.phoneNumber || '-'}</span></div>
            ${sale.customerAddress ? `<div style="display:flex;justify-content:space-between;"><span>Address</span><span style="font-weight:bold;text-align:right;max-width:55%;word-break:break-word;">${sale.customerAddress}</span></div>` : ''}

            <div style="border-top:1px dashed #000;margin:6px 0;"></div>

            <!-- Product -->
            <div style="font-weight:bold;margin-bottom:3px;">PRODUCT DETAILS</div>
            ${
              sale.productItems && sale.productItems.length > 0
                ? sale.productItems.map((it, idx) => {
                    const qty = Number(it.quantity) || 1;
                    const qtyStr = qty > 1 ? ` (x${qty})` : '';
                    return `
                      <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
                        <span style="max-width:65%;word-break:break-word;">${it.name}${qtyStr}</span>
                        <span style="font-weight:bold;">Rs.${(it.amount * qty).toLocaleString('en-IN')}</span>
                      </div>
                    `;
                  }).join('')
                : `<div style="display:flex;justify-content:space-between;"><span>Product</span><span style="font-weight:bold;text-align:right;max-width:55%;word-break:break-word;">${sale.productName}</span></div>`
            }
            ${sale.productModel ? `<div style="display:flex;justify-content:space-between;"><span>Model</span><span style="font-weight:bold;">${sale.productModel}</span></div>` : ''}
            ${sale.warrantyPeriod ? `<div style="display:flex;justify-content:space-between;"><span>Warranty</span><span style="font-weight:bold;">${sale.warrantyPeriod}</span></div>` : ''}

            <div style="border-top:1px dashed #000;margin:6px 0;"></div>

            <!-- Amount -->
            <div style="display:flex;justify-content:space-between;"><span>Price</span><span style="font-weight:bold;">Rs.${amount.toLocaleString('en-IN')}</span></div>
            ${discount > 0 ? `<div style="display:flex;justify-content:space-between;"><span>Discount</span><span style="font-weight:bold;">- Rs.${discount.toLocaleString('en-IN')}</span></div>` : ''}

            <div style="border-top:1px solid #000;margin:6px 0;"></div>
            <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:bold;">
              <span>NET PAYABLE</span><span>Rs.${net.toLocaleString('en-IN')}</span>
            </div>
            <div style="border-top:1px solid #000;margin:6px 0;"></div>

            ${sale.notes ? `
            <div style="font-size:10px;margin:4px 0;">
              <div style="font-weight:bold;">Notes:</div>
              <div>${sale.notes}</div>
            </div>
            <div style="border-top:1px dashed #000;margin:6px 0;"></div>` : ''}

            <!-- Footer -->
            <div style="text-align:center;font-size:10px;margin-top:6px;">
              <div>Mon-Sun: 9:00 AM - 10:00 PM</div>
              <div>24/7 Emergency Service Available</div>
              <div style="margin-top:4px;">*** Thank You! Visit Again ***</div>
              <div style="margin-top:2px;">jeeve-mobiles.onrender.com</div>
            </div>

          </div>

          <!-- Action buttons -->
          <div style="display:flex;gap:12px;padding:12px 16px;border-top:1px solid #e5e7eb;">
            <button onclick="app.printBill('${sale.saleId}')" style="flex:1;background:#000;color:#fff;border:none;border-radius:6px;padding:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:monospace;">🖨️ PRINT</button>
            <button onclick="app.closeBillModal()" style="flex:1;background:#f1f5f9;color:#374151;border:none;border-radius:6px;padding:10px;font-size:14px;font-weight:600;cursor:pointer;">✕ Close</button>
          </div>
        </div>
      </div>
    `;

    const existing = document.getElementById('billModal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', billHTML);
  }

  printBill(saleId) {
    const sale = this.salesRecords.find(s => s.saleId === saleId);
    if (!sale) return;

    const amount   = Number(sale.saleAmount) || 0;
    const discount = Number(sale.discount) || 0;
    const net      = amount - discount;

    const win = window.open('', '_blank', 'width=520,height=780');
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Sales Receipt - ${sale.saleId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page {
      size: 80mm auto;
      margin: 4mm auto;
    }
    html, body {
      font-family: Arial, 'Helvetica Neue', sans-serif;
      font-size: 13px;
      font-weight: 800;
      width: 100%;
      min-height: 100vh;
      color: #000;
      background: #f1f5f9;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 24px 12px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt-card {
      width: 80mm;
      max-width: 100%;
      background: #ffffff;
      padding: 18px 16px;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.12);
      border: 1px solid #cbd5e1;
      margin: 0 auto;
    }
    .center { text-align: center; }
    .bold { font-weight: 900; }
    .large { font-size: 15px; font-weight: 900; }
    .xlarge { font-size: 19px; font-weight: 900; letter-spacing: 0.5px; }
    .divider { border-top: 1.5px dashed #000; margin: 6px 0; }
    .divider-solid { border-top: 2.5px solid #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; margin: 4px 0; font-size: 13px; }
    .label { color: #000; font-weight: 700; }
    .value { font-weight: 900; text-align: right; max-width: 55%; word-break: break-word; color: #000; }
    .amount-row { display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; margin: 6px 0; color: #000; letter-spacing: 0.5px; }
    .footer { font-size: 11px; text-align: center; margin-top: 8px; color: #000; font-weight: 700; line-height: 1.7; }
    .print-actions { text-align: center; margin-top: 18px; width: 100%; }
    .print-btn {
      padding: 10px 32px;
      background: #000;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 800;
      cursor: pointer;
      font-family: monospace;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      transition: transform 0.2s;
    }
    .print-btn:hover { transform: scale(1.03); }
    @media print {
      html, body {
        background: #fff !important;
        padding: 0 !important;
        margin: 0 auto !important;
        width: 100% !important;
        display: block !important;
      }
      .receipt-card {
        width: 76mm !important;
        margin: 0 auto !important;
        box-shadow: none !important;
        border: none !important;
        padding: 0 !important;
        border-radius: 0 !important;
      }
      .print-actions, button { display: none !important; }
    }
  </style>
</head>
<body>
<div class="receipt-card">

  <!-- Shop Header -->
  <div class="center">
    <div class="xlarge bold">ஜிவி மொபைல்ஸ் — JIVI MOBILES</div>
    <div style="font-size:10px; margin-top:2px; font-weight:700;">Laptop &amp; Mobile Sales / Service</div>
    <div style="font-size:10px; font-weight:700;">Vanthavasi, Tamil Nadu</div>
    <div style="font-size:10px;">Ph: +91 84890 62593 / +91 96295 16788</div>
    <div style="font-size:10px;">jivimobiles@gmail.com</div>
  </div>

  <div class="divider-solid"></div>

  <div class="center bold" style="font-size:12px; letter-spacing:1px;">** SALES RECEIPT **</div>
  <div class="center" style="font-size:10px;">Date: ${sale.purchaseDate || new Date().toLocaleDateString('en-IN')}</div>
  <div class="center" style="font-size:10px;">Bill No: ${sale.saleId}</div>

  <div class="divider"></div>

  <!-- Customer Details -->
  <div class="bold" style="margin-bottom:3px;">CUSTOMER DETAILS</div>
  <div class="row"><span class="label">Name</span><span class="value">${sale.customerName}</span></div>
  <div class="row"><span class="label">Phone</span><span class="value">${sale.phoneNumber || '-'}</span></div>
  ${sale.customerAddress ? `<div class="row"><span class="label">Address</span><span class="value">${sale.customerAddress}</span></div>` : ''}

  <div class="divider"></div>

  <!-- Product Details -->
  <div class="bold" style="margin-bottom:3px;">PRODUCT DETAILS</div>
  <div class="row"><span class="label">Product</span><span class="value">${sale.productName}</span></div>
  ${(sale.imeiNumber || sale.imsNumber) ? `<div class="row"><span class="label">IMS/IMEI</span><span class="value" style="font-family:monospace;">${sale.imeiNumber || sale.imsNumber}</span></div>` : ''}
  ${sale.productModel ? `<div class="row"><span class="label">Model</span><span class="value">${sale.productModel}</span></div>` : ''}
  ${sale.warrantyPeriod ? `<div class="row"><span class="label">Warranty</span><span class="value">${sale.warrantyPeriod}</span></div>` : ''}

  <!-- Proof Photos in Receipt if available -->
  ${sale.proofImages && sale.proofImages.length > 0 ? `
  <div style="margin: 6px 0; text-align:center;">
    <div style="font-size:10px; font-weight:800; margin-bottom:4px;">PROOF PHOTOS</div>
    <div style="display:flex; gap:4px; justify-content:center; flex-wrap:wrap;">
      ${sale.proofImages.map(img => `<img src="${img}" style="width:60px; height:45px; object-fit:contain; border:1px solid #ccc; border-radius:4px;">`).join('')}
    </div>
  </div>` : ''}

  <!-- Signature in Receipt if available -->
  ${sale.signatureImage ? `
  <div style="margin: 6px 0; text-align:center;">
    <div style="font-size:10px; font-weight:800;">MOBILE OWNER SIGNATURE</div>
    <img src="${sale.signatureImage}" style="max-height:45px; max-width:160px; object-fit:contain; margin-top:2px;">
  </div>` : ''}

  <div class="divider"></div>

  <!-- Amount -->
  <div class="row"><span class="label">Price</span><span class="value">Rs.${amount.toLocaleString('en-IN')}</span></div>
  ${discount > 0 ? `<div class="row"><span class="label">Discount</span><span class="value">- Rs.${discount.toLocaleString('en-IN')}</span></div>` : ''}

  <div class="divider-solid"></div>

  <div class="row amount-row">
    <span>NET PAYABLE</span>
    <span>Rs.${net.toLocaleString('en-IN')}</span>
  </div>

  <div class="divider-solid"></div>

  ${sale.notes ? `
  <div style="font-size:10px; margin: 4px 0;">
    <div class="bold">Notes:</div>
    <div>${sale.notes}</div>
  </div>
  <div class="divider"></div>
  ` : ''}

  <div class="footer">
    <div>Mon-Sun: 9:00 AM - 10:00 PM</div>
    <div>24/7 Emergency Service Available</div>
    <div style="margin-top:4px;">*** Thank You! Visit Again ***</div>
    <div style="margin-top:2px;">jeeve-mobiles.onrender.com</div>
  </div>

  <div class="print-actions">
    <button class="print-btn" onclick="window.print()">🖨️ PRINT</button>
  </div>

</div><!-- /.receipt-card -->
</body>
</html>`);
    win.document.close();
    setTimeout(() => { try { win.focus(); } catch(e) {} }, 200);
  }

  async deleteSaleRecord(saleId) {
    if (!confirm('Delete this sale record?')) return;
    try {
      const response = await fetch(`${this.API_URL}/sales/${saleId}`, { method: 'DELETE' });
      if (response.ok) {
        this.salesRecords = this.salesRecords.filter(s => s.saleId !== saleId);
        this.renderPage('admin-sales');
        alert('✅ Sale record deleted.');
      }
    } catch (error) {
      console.error('Error deleting sale:', error);
    }
  }

  async shareSaleWhatsApp(saleId) {
    const sale = this.salesRecords.find(s => s.saleId === saleId);
    if (!sale) return;

    const amount   = Number(sale.saleAmount) || 0;
    const discount = Number(sale.discount)   || 0;
    const net      = amount - discount;

    const items = sale.productItems && sale.productItems.length > 0
      ? sale.productItems
      : [{ name: sale.productName, category: '', amount: amount, discount: discount }];

    // ── Build PDF using jsPDF ─────────────────────────────────────────────
    const { jsPDF } = window.jspdf;
    if (!jsPDF) { alert('PDF library not loaded yet. Please try again in a moment.'); return; }

    const doc = new jsPDF({ unit: 'mm', format: [80, 200], orientation: 'portrait' });
    const W = 80;
    let y = 6;

    const centerText = (text, size, bold) => {
      doc.setFontSize(size);
      doc.setFont('courier', bold ? 'bold' : 'normal');
      doc.text(text, W / 2, y, { align: 'center' });
      y += size * 0.45 + 1;
    };
    const rowText = (label, value, size = 9) => {
      doc.setFontSize(size); doc.setFont('courier', 'normal');
      doc.text(label, 4, y);
      doc.setFont('courier', 'bold');
      doc.text(value, W - 4, y, { align: 'right' });
      y += size * 0.4 + 1.5;
    };
    const dashed = () => {
      doc.setLineDashPattern([1, 1], 0); doc.setDrawColor(0); doc.setLineWidth(0.3);
      doc.line(4, y, W - 4, y); y += 3;
    };
    const solid = () => {
      doc.setLineDashPattern([], 0); doc.setLineWidth(0.5);
      doc.line(4, y, W - 4, y); y += 3;
    };

    centerText('ஜிவி மொபைல்ஸ் — JIVI MOBILES', 11, true);
    centerText('Laptop & Mobile Sales / Service', 7, false);
    centerText('Vanthavasi, Tamil Nadu', 7, false);
    centerText('Ph: +91 84890 62593 / +91 96295 16788', 7, false);
    centerText('jivimobiles@gmail.com', 7, false);
    y += 1; solid();
    centerText('** SALES RECEIPT **', 9, true); y += 1;
    doc.setFontSize(8); doc.setFont('courier', 'normal');
    doc.text('Date: ' + (sale.purchaseDate || new Date().toLocaleDateString('en-IN')), 4, y); y += 4;
    doc.text('Bill No: ' + sale.saleId, 4, y); y += 4;
    dashed();
    doc.setFontSize(9); doc.setFont('courier', 'bold');
    doc.text('CUSTOMER DETAILS', 4, y); y += 5;
    rowText('Name', sale.customerName);
    rowText('Phone', sale.phoneNumber || '-');
    if (sale.customerAddress) rowText('Address', sale.customerAddress);
    dashed();
    doc.setFontSize(9); doc.setFont('courier', 'bold');
    doc.text('PRODUCT DETAILS', 4, y); y += 5;
    items.forEach((it, i) => {
      const itAmt = Number(it.amount || 0), itDisc = Number(it.discount || 0);
      const qty = Number(it.quantity) || 1;
      const qtyStr = qty > 1 ? ` (x${qty})` : '';
      rowText(`${i + 1}. ${it.name || '—'}${qtyStr}`, 'Rs.' + (itAmt * qty).toLocaleString('en-IN'));
      if (itDisc > 0) rowText('   Discount', '- Rs.' + (itDisc * qty).toLocaleString('en-IN'));
    });
    if (sale.warrantyPeriod) rowText('Warranty', sale.warrantyPeriod);
    dashed();
    if (discount > 0) {
      rowText('Sub-Total', 'Rs.' + amount.toLocaleString('en-IN'));
      rowText('Discount',  '- Rs.' + discount.toLocaleString('en-IN'));
    }
    solid();
    doc.setFontSize(11); doc.setFont('courier', 'bold');
    doc.text('NET PAYABLE', 4, y);
    doc.text('Rs.' + net.toLocaleString('en-IN'), W - 4, y, { align: 'right' });
    y += 6; solid();
    if (sale.notes) {
      doc.setFontSize(8); doc.setFont('courier', 'normal');
      doc.text('Notes: ' + sale.notes, 4, y); y += 5; dashed();
    }
    centerText('Mon-Sun: 9:00 AM - 10:00 PM', 7, false);
    centerText('24/7 Emergency Service Available', 7, false);
    y += 1;
    centerText('*** Thank You! Visit Again ***', 8, true);
    centerText('jeeve-mobiles.onrender.com', 7, false);

    // ── Share caption text ────────────────────────────────────────────────
    const productList = items.map(it => it.name).join(', ');
    const caption = [
      '*ஜிவி மொபைல்ஸ் — JIVI MOBILES*',
      '_Vanthavasi, Tamil Nadu | +91 84890 62593 / +91 96295 16788_',
      '',
      'Dear *' + sale.customerName + '*,',
      'Thank you for your purchase!',
      '',
      'Bill No: ' + sale.saleId,
      'Date: ' + (sale.purchaseDate || new Date().toLocaleDateString('en-IN')),
      'Product: ' + productList,
      sale.warrantyPeriod ? 'Warranty: ' + sale.warrantyPeriod : null,
      '*Net Payable: \u20B9' + net.toLocaleString('en-IN') + '*',
      '',
      'Visit us: https://jeeve-mobiles.onrender.com'
    ].filter(Boolean).join('\n');

    const fileName = `receipt-${sale.saleId}.pdf`;

    // Build the direct WhatsApp link for this customer's number
    let phone = (sale.phoneNumber || '').replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;
    else if (phone.startsWith('0')) phone = '91' + phone.slice(1);
    const waUrl = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(caption);

    // ── On mobile: share PDF via Web Share API, then open the customer's WhatsApp chat ──
    if (navigator.canShare) {
      try {
        const pdfBlob = doc.output('blob');
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          // Open customer's WhatsApp chat directly first
          window.open(waUrl, '_blank');
          // Then trigger file share so owner can attach the PDF
          setTimeout(async () => {
            try { await navigator.share({ files: [file], title: 'Receipt - ' + sale.saleId }); }
            catch(e) { if (e.name !== 'AbortError') doc.save(fileName); }
          }, 500);
          return;
        }
      } catch (err) {
        if (err.name !== 'AbortError') console.warn('Share API error:', err);
      }
    }

    // ── Fallback (desktop): download PDF + open customer's WhatsApp chat directly ──
    doc.save(fileName);
    setTimeout(() => { window.open(waUrl, '_blank'); }, 600);
  }

  printTrackingCard(qrId) {
    const t = this.trackingData.find(t => t.qrId === qrId);
    if (!t) return;

    const win = window.open('', '_blank', 'width=900,height=1000');
    const proofPhotos = t.proofImages || t.photos || [];
    const signatureImg = t.signatureImage || t.ownerSignature || null;

    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>A4 Repair Receipt - ${t.qrId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page {
      size: A4 portrait;
      margin: 12mm 15mm 12mm 15mm;
    }
    html, body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 13px;
      color: #0f172a;
      background: #f1f5f9;
      padding: 24px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .a4-page {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      padding: 32px 36px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
      border: 1.5px solid #cbd5e1;
    }
    .header-table {
      width: 100%;
      border-bottom: 3px solid #0f172a;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .shop-name {
      font-size: 24px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: 0.5px;
    }
    .shop-tagline {
      font-size: 12px;
      font-weight: 700;
      color: #0284c7;
      margin-top: 2px;
    }
    .shop-contact {
      font-size: 11px;
      color: #475569;
      margin-top: 4px;
      line-height: 1.4;
      font-weight: 600;
    }
    .receipt-title {
      font-size: 20px;
      font-weight: 900;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 1px;
      text-align: right;
    }
    .qr-badge {
      display: inline-block;
      background: #0f172a;
      color: #ffffff;
      font-weight: 900;
      font-size: 14px;
      padding: 4px 14px;
      border-radius: 6px;
      margin-top: 6px;
      letter-spacing: 1px;
    }
    .details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }
    .card-box {
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 16px;
    }
    .card-title {
      font-size: 12px;
      font-weight: 900;
      color: #0284c7;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
      border-bottom: 1.5px solid #cbd5e1;
      padding-bottom: 4px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
      font-size: 12.5px;
    }
    .info-label { font-weight: 700; color: #475569; }
    .info-val { font-weight: 900; color: #0f172a; text-align: right; word-break: break-word; }
    .issue-section {
      background: #fff;
      border: 1.5px solid #0f172a;
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 20px;
    }
    .issue-title {
      font-size: 12px;
      font-weight: 900;
      color: #0f172a;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .issue-text {
      font-size: 13px;
      font-weight: 700;
      color: #1e293b;
      line-height: 1.5;
    }
    .billing-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    .billing-table th {
      background: #0f172a;
      color: #fff;
      padding: 10px 12px;
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 800;
    }
    .billing-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 12.5px;
      font-weight: 700;
    }
    .total-row {
      background: #f0fdf4;
      font-size: 14px;
      font-weight: 900;
      color: #166534;
    }
    .photos-section {
      margin-bottom: 20px;
      border: 1.5px dashed #0284c7;
      border-radius: 8px;
      padding: 14px;
      background: #f0f9ff;
    }
    .photos-title {
      font-size: 12px;
      font-weight: 900;
      color: #0284c7;
      text-transform: uppercase;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .photos-grid {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .proof-img-item {
      width: 160px;
      height: 120px;
      object-fit: contain;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      padding: 4px;
    }
    .signature-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #0f172a;
    }
    .sig-box {
      text-align: center;
      width: 220px;
    }
    .sig-img-display {
      max-height: 80px;
      max-width: 210px;
      object-fit: contain;
      display: block;
      margin: 0 auto 6px auto;
    }
    .sig-line-text {
      border-top: 1.5px dashed #0f172a;
      padding-top: 4px;
      font-size: 11.5px;
      font-weight: 900;
      color: #0f172a;
    }
    .terms-box {
      margin-top: 24px;
      padding: 10px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 10.5px;
      color: #64748b;
      line-height: 1.5;
    }
    .no-print-bar {
      text-align: center;
      margin-bottom: 18px;
    }
    .btn-print {
      padding: 10px 30px;
      background: #059669;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(5,150,105,0.3);
    }
    @media print {
      html, body { background: #fff !important; padding: 0 !important; }
      .a4-page {
        box-shadow: none !important;
        border: none !important;
        padding: 0 !important;
        max-width: 100% !important;
        width: 100% !important;
      }
      .no-print-bar { display: none !important; }
    }
  </style>
</head>
<body>

<div class="no-print-bar">
  <button class="btn-print" onclick="window.print()">🖨️ PRINT A4 RECEIPT</button>
</div>

<div class="a4-page">
  <!-- Header Table -->
  <table class="header-table">
    <tr>
      <td>
        <div class="shop-name">ஜிவி மொபைல்ஸ் — JIVI MOBILES</div>
        <div class="shop-tagline">Laptop &amp; Mobile Sales / Service Specialist</div>
        <div class="shop-contact">
          📍 Main Road, Vanthavasi, Tamil Nadu<br>
          📞 Ph: +91 84890 62593 / +91 96295 16788 | ✉️ jivimobiles@gmail.com
        </div>
      </td>
      <td style="text-align:right; vertical-align:top;">
        <div class="receipt-title">REPAIR RECEIPT</div>
        <div class="qr-badge">QR ID: ${t.qrId}</div>
        <div style="font-size:11px; font-weight:700; color:#475569; margin-top:4px;">
          Password: <strong>${t.qrPassword || '-'}</strong>
        </div>
      </td>
    </tr>
  </table>

  <!-- Details Grid -->
  <div class="details-grid">
    <!-- Customer Info -->
    <div class="card-box">
      <div class="card-title">👤 Customer Information</div>
      <div class="info-row"><span class="info-label">Customer Name</span><span class="info-val">${t.customerName}</span></div>
      <div class="info-row"><span class="info-label">Phone Number</span><span class="info-val">${t.contact || '-'}</span></div>
      <div class="info-row"><span class="info-label">Address</span><span class="info-val">${t.address || '-'}</span></div>
    </div>

    <!-- Device & Repair Info -->
    <div class="card-box">
      <div class="card-title">📱 Repair Specifications</div>
      <div class="info-row"><span class="info-label">Device Model</span><span class="info-val">${t.productName || t.deviceModel || '-'}</span></div>
      <div class="info-row"><span class="info-label">IMS / IMEI No.</span><span class="info-val" style="font-family:monospace; font-weight:900;">${t.imeiNumber || t.imsNumber || '-'}</span></div>
      <div class="info-row"><span class="info-label">Date Received</span><span class="info-val">${t.dateIn || t.createdAt || new Date().toLocaleDateString('en-IN')}</span></div>
      <div class="info-row"><span class="info-label">Date Returned</span><span class="info-val">${t.dateOut || 'In Service'}</span></div>
      <div class="info-row"><span class="info-label">Current Status</span><span class="info-val" style="color:#0284c7;">${t.status}</span></div>
      <div class="info-row"><span class="info-label">Est. Completion</span><span class="info-val">${t.estimatedDays == 0 ? 'Same Day' : ((t.estimatedDays || 2) + ' Days')}</span></div>
    </div>
  </div>

  <!-- Issue Description -->
  <div class="issue-section">
    <div class="issue-title">📝 Reported Issue &amp; Service Notes</div>
    <div class="issue-text">${t.issue || 'Standard service and maintenance.'}</div>
  </div>

  <!-- Replaced Items Table if present -->
  ${t.replacedItems && t.replacedItems.length > 0 ? `
  <table class="billing-table">
    <thead>
      <tr>
        <th>Replaced Component / Spare Part</th>
        <th style="text-align:center;">Qty</th>
        <th style="text-align:right;">Unit Cost</th>
        <th style="text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${t.replacedItems.map(item => `
        <tr>
          <td>${item.name}</td>
          <td style="text-align:center;">${item.qty || 1}</td>
          <td style="text-align:right;">₹${(Number(item.price)||0).toLocaleString('en-IN')}</td>
          <td style="text-align:right;">₹${((Number(item.price)||0) * (Number(item.qty)||1)).toLocaleString('en-IN')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  <!-- Billing Table -->
  <table class="billing-table">
    <thead>
      <tr>
        <th>Payment Description</th>
        <th style="text-align:right;">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Full Estimated Service Price</td>
        <td style="text-align:right;">₹${(Number(t.amount) || 0).toLocaleString('en-IN')}</td>
      </tr>
      ${Number(t.advanceAmount) > 0 ? `
      <tr>
        <td>Advance Received at Drop-off</td>
        <td style="text-align:right; color:#059669;">- ₹${Number(t.advanceAmount).toLocaleString('en-IN')}</td>
      </tr>
      ` : ''}
      ${Number(t.paidAmount) > 0 ? `
      <tr>
        <td>Additional Payment Received</td>
        <td style="text-align:right; color:#059669;">- ₹${Number(t.paidAmount).toLocaleString('en-IN')}</td>
      </tr>
      ` : ''}
      <tr class="total-row">
        <td>BALANCE DUE AT PICKUP</td>
        <td style="text-align:right;">₹${(Number(t.balanceAmount) || Math.max(0, (Number(t.amount)||0) - (Number(t.advanceAmount)||0) - (Number(t.paidAmount)||0))).toLocaleString('en-IN')}</td>
      </tr>
    </tbody>
  </table>

  <!-- Proof Photos Section if present -->
  ${proofPhotos.length > 0 ? `
  <div class="photos-section">
    <div class="photos-title">📷 Recorded Condition &amp; Owner Proof Photos (${proofPhotos.length})</div>
    <div class="photos-grid">
      ${proofPhotos.map((url, i) => `<img src="${url}" class="proof-img-item" alt="Proof Photo ${i+1}">`).join('')}
    </div>
  </div>
  ` : ''}

  <!-- Signature Section -->
  <div class="signature-row">
    <div class="sig-box">
      ${signatureImg ? `<img src="${signatureImg}" class="sig-img-display" alt="Owner Signature">` : '<div style="height:60px;"></div>'}
      <div class="sig-line-text">Mobile Owner Signature / Proof</div>
    </div>
    <div class="sig-box">
      <div style="height:60px;"></div>
      <div class="sig-line-text">Authorized Shop Signatory &amp; Seal</div>
    </div>
  </div>

  <!-- Terms & Conditions -->
  <div class="terms-box">
    <strong>Terms &amp; Conditions:</strong><br>
    1. Please present this receipt or QR ID at the time of collecting your device.<br>
    2. Devices not collected within 60 days of completion notice may be subject to storage fees.<br>
    3. Track your repair status 24/7 online at <strong>jeeve-mobiles.onrender.com</strong> using your QR ID &amp; Password.
  </div>
</div>

</body>
</html>`);
    win.document.close();
    setTimeout(() => { try { win.focus(); } catch(e) {} }, 250);
  }

  exportProductsPDF() {
    const data = this.products;
    const win = window.open('', '_blank', 'width=1000,height=700');
    const rows = data.map((p, i) => {
      const stock = Number(p.stock) || 0;
      const stockColor = stock === 0 ? '#dc2626' : stock <= 3 ? '#d97706' : '#059669';
      const stockLabel = stock === 0 ? 'Out of Stock' : stock <= 3 ? `Low (${stock})` : stock;
      return `<tr style="background:${i%2===0?'#fff':'#f9fafb'}">
        <td>${i+1}</td>
        <td><strong>${p.name}</strong></td>
        <td>${p.category||'-'}</td>
        <td style="color:#059669;font-weight:700;">₹${(Number(p.price)||0).toLocaleString('en-IN')}</td>
        <td style="color:#6b7280;text-decoration:line-through;">₹${(Number(p.originalPrice)||0).toLocaleString('en-IN')}</td>
        <td style="color:#d97706;font-weight:700;">${p.ownerPrice ? '₹'+Number(p.ownerPrice).toLocaleString('en-IN') : '-'}</td>
        <td style="color:${stockColor};font-weight:700;">${stockLabel}</td>
        <td><span style="background:${p.inStock?'#dcfce7':'#fee2e2'};color:${p.inStock?'#166534':'#dc2626'};padding:2px 8px;border-radius:4px;font-size:11px;">${p.inStock?'In Stock':'Out of Stock'}</span></td>
      </tr>`;
    }).join('');
    const lowStockCount = data.filter(p => { const s = Number(p.stock)||0; return s > 0 && s <= 3; }).length;
    const outOfStockCount = data.filter(p => (Number(p.stock)||0) === 0).length;
    win.document.write(`
      <!DOCTYPE html><html><head><title>Products Report</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;color:#111;}
        h2{color:#dc2626;margin-bottom:4px;}
        table{width:100%;border-collapse:collapse;font-size:12px;margin-top:16px;}
        th{background:#dc2626;color:#fff;padding:8px 10px;text-align:left;}
        td{padding:7px 10px;border-bottom:1px solid #e5e7eb;}
        .summary{display:flex;gap:20px;margin:12px 0;flex-wrap:wrap;}
        .badge{padding:6px 14px;border-radius:6px;font-size:13px;font-weight:700;}
        @media print{button{display:none;}}
      </style></head><body>
      <h2>JIVI MOBILES — Products Report</h2>
      <p style="color:#6b7280;font-size:12px;">Generated: ${new Date().toLocaleString('en-IN')} | Total Products: ${data.length}</p>
      <div class="summary">
        <span class="badge" style="background:#dcfce7;color:#166534;">✅ Total: ${data.length}</span>
        <span class="badge" style="background:#fee2e2;color:#dc2626;">🔴 Out of Stock: ${outOfStockCount}</span>
        <span class="badge" style="background:#fef3c7;color:#d97706;">🟡 Low Stock: ${lowStockCount}</span>
      </div>
      <table>
        <thead><tr>
          <th>#</th><th>Product Name</th><th>Category</th>
          <th>Customer Price</th><th>MRP</th><th>Owner Price 🔒</th>
          <th>Stock</th><th>Status</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <br><button onclick="window.print()" style="padding:10px 24px;background:#dc2626;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;">🖨️ Print / Save as PDF</button>
      </body></html>
    `);
    win.document.close();
  }

  exportTrackingPDF() {
    const data = this.trackingData;
    const win = window.open('', '_blank', 'width=900,height=700');
    const rows = data.map((t, i) => `
      <tr style="background:${i%2===0?'#fff':'#f9fafb'}">
        <td>${i+1}</td><td>${t.createdAt||'-'}</td><td>${t.qrId}</td>
        <td>${t.customerName}</td><td>${t.contact||'-'}</td>
        <td>${t.productName||t.deviceModel||'-'}</td><td>${t.issue}</td>
        <td>${t.status}</td><td style="font-weight:700;color:#059669;">₹${(Number(t.amount)||0).toLocaleString('en-IN')}</td>
      </tr>`).join('');
    const total = data.reduce((s,t)=>s+(Number(t.amount)||0),0);
    win.document.write(`
      <!DOCTYPE html><html><head><title>Tracking Records</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;color:#111;}
        h2{color:#dc2626;}
        table{width:100%;border-collapse:collapse;font-size:12px;}
        th{background:#dc2626;color:#fff;padding:8px 10px;text-align:left;}
        td{padding:7px 10px;border-bottom:1px solid #e5e7eb;}
        .total{font-size:16px;font-weight:800;color:#059669;margin-top:12px;}
        @media print{button{display:none;}}
      </style></head><body>
      <h2>JIVI MOBILES — Tracking Records</h2>
      <p style="color:#6b7280;font-size:12px;">Generated: ${new Date().toLocaleString('en-IN')} | Total Records: ${data.length}</p>
      <table><thead><tr><th>#</th><th>Date</th><th>QR ID</th><th>Customer</th><th>Contact</th><th>Device</th><th>Issue</th><th>Status</th><th>Amount</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="total">Total Income: ₹${total.toLocaleString('en-IN')}</div>
      <br><button onclick="window.print()" style="padding:10px 24px;background:#dc2626;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;">🖨️ Print / Save as PDF</button>
      </body></html>
    `);
    win.document.close();
  }

  exportTrackingXL() {
    const data = this.trackingData;
    const headers = ['#','Date','QR ID','Customer','Contact','Device','Issue','Status','Amount (Rs)'];
    const rows = data.map((t, i) => [
      i+1, t.createdAt||'', t.qrId, t.customerName, t.contact||'',
      t.productName||t.deviceModel||'', t.issue, t.status, Number(t.amount)||0
    ]);
    this._downloadCSV('tracking_records', headers, rows);
  }

  exportSalesPDF() {
    const data = this.salesRecords;
    const win = window.open('', '_blank', 'width=900,height=700');
    const rows = data.map((s, i) => {
      const net = (Number(s.saleAmount)||0) - (Number(s.discount)||0);
      return `<tr style="background:${i%2===0?'#fff':'#f9fafb'}">
        <td>${i+1}</td><td>${s.purchaseDate||'-'}</td><td>${s.customerName}</td>
        <td>${s.phoneNumber||'-'}</td><td>${s.productName}</td>
        <td>${s.productModel||'-'}</td><td>${s.warrantyPeriod||'-'}</td>
        <td>₹${(Number(s.saleAmount)||0).toLocaleString('en-IN')}</td>
        <td>₹${(Number(s.discount)||0).toLocaleString('en-IN')}</td>
        <td style="font-weight:700;color:#059669;">₹${net.toLocaleString('en-IN')}</td>
      </tr>`;
    }).join('');
    const total = data.reduce((s,r)=>(s+(Number(r.saleAmount)||0)-(Number(r.discount)||0)),0);
    win.document.write(`
      <!DOCTYPE html><html><head><title>Sales Records</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;color:#111;}
        h2{color:#dc2626;}
        table{width:100%;border-collapse:collapse;font-size:12px;}
        th{background:#dc2626;color:#fff;padding:8px 10px;text-align:left;}
        td{padding:7px 10px;border-bottom:1px solid #e5e7eb;}
        .total{font-size:16px;font-weight:800;color:#059669;margin-top:12px;}
        @media print{button{display:none;}}
      </style></head><body>
      <h2>JIVI MOBILES — Sales Records</h2>
      <p style="color:#6b7280;font-size:12px;">Generated: ${new Date().toLocaleString('en-IN')} | Total Records: ${data.length}</p>
      <table><thead><tr><th>#</th><th>Date</th><th>Customer</th><th>Phone</th><th>Product</th><th>Model</th><th>Warranty</th><th>Amount</th><th>Discount</th><th>Net</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="total">Total Net Sales: ₹${total.toLocaleString('en-IN')}</div>
      <br><button onclick="window.print()" style="padding:10px 24px;background:#dc2626;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;">🖨️ Print / Save as PDF</button>
      </body></html>
    `);
    win.document.close();
  }

  exportSalesXL() {
    const data = this.salesRecords;
    const headers = ['#','Date','Customer','Phone','Product','Model','Warranty','Amount (Rs)','Discount (Rs)','Net (Rs)'];
    const rows = data.map((s, i) => {
      const net = (Number(s.saleAmount)||0) - (Number(s.discount)||0);
      return [i+1, s.purchaseDate||'', s.customerName, s.phoneNumber||'', s.productName, s.productModel||'', s.warrantyPeriod||'', Number(s.saleAmount)||0, Number(s.discount)||0, net];
    });
    this._downloadCSV('sales_records', headers, rows);
  }

  exportDisplayStockPDF() {
    const data = this.displayStock || [];
    const win = window.open('', '_blank', 'width=900,height=700');
    const rows = data.map((d, i) => {
      const stock = Number(d.stock) || 0;
      const stockColor = stock === 0 ? '#dc2626' : stock <= 1 ? '#dc2626' : '#16a34a';
      const statusLabel = stock === 0 ? 'Out of Stock' : stock <= 1 ? 'Last 1 - Reorder!' : 'In Stock';
      return `<tr style="background:${i%2===0?'#fff':'#f9fafb'}">
        <td>${i+1}</td>
        <td>${d.displayName}</td>
        <td>${d.displayId}</td>
        <td>${this.stockTotalValueUnlocked ? (d.price ? '₹' + Number(d.price).toLocaleString('en-IN') : '—') : '••••'}</td>
        <td style="font-weight:900; color:${stockColor};">${stock}</td>
        <td style="color:${stockColor}; font-weight:700;">${statusLabel}</td>
      </tr>`;
    }).join('');
    const totalValue = data.reduce((sum, d) => sum + ((Number(d.price)||0) * (Number(d.stock)||0)), 0);
    win.document.write(`
      <!DOCTYPE html><html><head><title>Display Stock Report</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;color:#111;}
        h2{color:#1e293b;}
        table{width:100%;border-collapse:collapse;font-size:12px;}
        th{background:#1e293b;color:#fff;padding:8px 10px;text-align:left;}
        td{padding:7px 10px;border-bottom:1px solid #e5e7eb;}
        .total{font-size:16px;font-weight:800;color:#1e293b;margin-top:12px;}
        @media print{button{display:none;}}
      </style></head><body>
      <h2>JIVI MOBILES — Display Stock Report</h2>
      <p style="color:#6b7280;font-size:12px;">Generated: ${new Date().toLocaleString('en-IN')} | Total Items: ${data.length}</p>
      <table><thead><tr><th>#</th><th>Display Name</th><th>Display ID</th><th>Price</th><th>Stock Qty</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="total">Total Stock Value: ${this.stockTotalValueUnlocked ? '₹' + totalValue.toLocaleString('en-IN') : '••••'}</div>
      <br><button onclick="window.print()" style="padding:10px 24px;background:#1e293b;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;">🖨️ Print / Save as PDF</button>
      </body></html>
    `);
    win.document.close();
  }

  exportDisplayStockXL() {
    const data = this.displayStock || [];
    const headers = ['#', 'Display Name', 'Display ID', 'Price (Rs)', 'Stock Qty', 'Status'];
    const rows = data.map((d, i) => {
      const stock = Number(d.stock) || 0;
      const status = stock === 0 ? 'Out of Stock' : stock <= 1 ? 'Last 1 - Reorder!' : 'In Stock';
      return [i+1, d.displayName, d.displayId, this.stockTotalValueUnlocked ? (Number(d.price)||0) : '••••', stock, status];
    });
    this._downloadCSV('display_stock', headers, rows);
  }

  _downloadCSV(filename, headers, rows) {
    const escape = v => {
      const s = String(v).replace(/"/g, '""');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
    };
    const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  renderFooter() {
    return `
      <footer>
        <div class="footer-content">
          <div class="footer-section">
            <h4>Owner Portal</h4>
            <ul>
              <li><a href="#" data-page="admin">Dashboard</a></li>
              <li><a href="#" data-page="admin-products">Products</a></li>
              <li><a href="#" data-page="admin-tracking">Tracking</a></li>
              <li><a href="#" data-page="admin-orders">Orders</a></li>
            </ul>
          </div>
          <div class="footer-section">
            <h4>Main Site</h4>
            <ul>
              <li><a href="index.html">← Back to Main Site</a></li>
            </ul>
          </div>
          <div class="footer-section">
            <h4>Contact</h4>
            <ul>
              <li><a href="mailto:jivimobiles@gmail.com">jivimobiles@gmail.com</a></li>
              <li><a href="tel:+918489062593">+91 84890 62593 / +91 96295 16788</a></li>
              <li>Available 24/7</li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <p>&copy; 2025 ஜிவி மொபைல்ஸ் — Jivi Mobiles Owner Portal. All rights reserved.</p>
        </div>
      </footer>
    `
  }

  // Product Management Methods
  async saveProduct() {
    const name = document.getElementById("productName")?.value;
    const category = document.getElementById("productCategory")?.value;
    const price = Number.parseInt(document.getElementById("productPrice")?.value || 0);
    const originalPrice = Number.parseInt(document.getElementById("productOriginalPrice")?.value || 0);
    const ownerPrice = Number.parseInt(document.getElementById("productOwnerPrice")?.value || 0);
    const stock = Number.parseInt(document.getElementById("productStock")?.value || 0);
    const imageUrl = document.getElementById("productImageUrl")?.value?.trim();
    const imageUrl2 = document.getElementById("productImageUrl2")?.value?.trim();
    const emoji = document.getElementById("productImage")?.value?.trim();
    const inStock = document.getElementById("productInStock")?.checked || false;

    if (!name || !category || !price) {
      alert("Please fill all required fields");
      return;
    }

    if (imageUrl && imageUrl.length > 700000) {
      alert("❌ Image file is too large. Please use a smaller image (max 500KB).");
      return;
    }
    if (imageUrl2 && imageUrl2.length > 700000) {
      alert("❌ Image 2 file is too large. Please use a smaller image (max 500KB).");
      return;
    }

    try {
      // Show loading indicator
      const saveButton = document.querySelector('[data-action="save-product"]');
      const originalText = saveButton.textContent;
      saveButton.textContent = 'Saving...';
      saveButton.disabled = true;

      if (this.editingProductId) {
        // Update existing product - Database ONLY
        const updatedProduct = {
          name,
          category,
          price,
          originalPrice: originalPrice || price,
          ownerPrice: ownerPrice || 0,
          stock: stock || 0,
          imageUrl: imageUrl || "",
          imageUrl2: imageUrl2 || "",
          image: emoji || "📦",
          inStock
        };

        const editingIdStr = String(this.editingProductId);
        const existingProduct = this.products.find((p) => String(p.id) === editingIdStr || String(p._id) === editingIdStr);
        
        if (existingProduct) {
          const mongoId = existingProduct._id || existingProduct.id;
          console.log('💾 [OWNER PORTAL] Updating product in database...');
          
          // Update in database ONLY
          const response = await fetch(`${this.API_URL}/products/${mongoId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedProduct)
          });

          if (response.ok) {
            const savedProduct = await response.json();
            console.log('✅ [OWNER PORTAL] Product updated in database:', savedProduct);
            
            // Update local array (no localStorage)
            const productIndex = this.products.findIndex((p) => String(p.id) === editingIdStr || String(p._id) === editingIdStr);
            if (productIndex !== -1) {
              this.products[productIndex] = savedProduct;
            }
            
            alert("✅ Product updated in database successfully!");
          } else {
            const errorText = await response.text();
            console.error('❌ [OWNER PORTAL] Database update failed:', errorText);
            throw new Error(`Failed to update product: ${errorText}`);
          }
          
          this.editingProductId = null;
          console.log('🔄 Product updated in database, main website will see changes');
        } else {
          alert("❌ Product not found for editing");
        }
      } else {
        // Create new product - Save ONLY to DATABASE
        const newProduct = {
          name,
          category,
          price,
          originalPrice: originalPrice || price,
          ownerPrice: ownerPrice || 0,
          stock: stock || 0,
          image: emoji || "📦",
          imageUrl: imageUrl || "",
          imageUrl2: imageUrl2 || "",
          rating: 4.5,
          reviews: 0,
          inStock,
          badge: null,
          qrId: "",
          qrPassword: "",
          trackingStatus: "Received",
          ownerGender: "none"
        };

        console.log('💾 [OWNER PORTAL] Saving product to database...');
        
        // Save to database ONLY
        const response = await fetch(`${this.API_URL}/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newProduct)
        });

        if (response.ok) {
          const savedProduct = await response.json();
          console.log('✅ [OWNER PORTAL] Product saved to database:', savedProduct);
          
          // Add to local array (no localStorage)
          this.products.push(savedProduct);
          
          alert("✅ Product saved to database successfully!");
        } else {
          const errorText = await response.text();
          console.error('❌ [OWNER PORTAL] Database save failed:', errorText);
          throw new Error(`Failed to save product: ${errorText}`);
        }
        
        console.log('🔄 Product saved to database, main website will see it');
      }

      this.renderPage("admin-products");
    } catch (error) {
      console.error('❌ Error saving product:', error);
      
      let errorMessage = error.message;
      
      if (error.message.includes('timeout') || error.message.includes('timed out')) {
        alert(`⏰ Database operation timed out!\n\nThis usually means:\n• Slow internet connection\n• Database server is busy\n\nPlease try again in a few moments.`);
      } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        alert(`🌐 Network connection error!\n\nPlease check:\n• Your internet connection\n• Server is running\n• Try refreshing the page`);
      } else if (error.message.includes('offline') || error.message.includes('not available')) {
        alert(`📡 Database is currently offline!\n\nThe server is running but can't connect to the database.\n\nPlease try again later.`);
      } else {
        alert(`❌ Error saving product:\n\n${errorMessage}\n\nPlease check your connection and try again.`);
      }
    } finally {
      // Restore button state
      const saveButton = document.querySelector('[data-action="save-product"]');
      if (saveButton) {
        saveButton.textContent = this.editingProductId ? 'Update Product' : 'Add Product';
        saveButton.disabled = false;
      }
    }
  }

  // Background sync method for product updates
  async syncProductUpdateToDatabase(mongoId, updatedProduct) {
    try {
      const response = await fetch(`${this.API_URL}/products/${mongoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProduct)
      });

      if (response.ok) {
        const savedProduct = await response.json();
        
        // Update local storage with response from database
        const index = this.products.findIndex(p => (p._id || p.id) === mongoId);
        if (index !== -1) {
          this.products[index] = savedProduct;
          localStorage.setItem('manjula_products', JSON.stringify(this.products));
        }
        
        console.log('✅ Product update synced to database successfully');
      } else {
        console.error('❌ Failed to sync product update to database');
      }
    } catch (error) {
      console.error('❌ Background update sync error:', error);
    }
  }

  // Background sync method - doesn't block UI
  async syncProductToDatabase(product) {
    try {
      console.log('🔄 [OWNER PORTAL] Starting database sync for product:', product.name);
      
      const productForDB = { ...product };
      delete productForDB.id; // Remove temporary ID, let MongoDB generate _id
      
      const response = await fetch(`${this.API_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productForDB)
      });

      if (response.ok) {
        const savedProduct = await response.json();
        console.log('✅ [OWNER PORTAL] Product saved to database:', savedProduct);
        
        // Update local storage with real database product
        const index = this.products.findIndex(p => p.id === product.id);
        if (index !== -1) {
          this.products[index] = savedProduct;
          localStorage.setItem('manjula_products', JSON.stringify(this.products));
          console.log('✅ [OWNER PORTAL] Local storage updated with database product');
        }
        
        console.log('✅ Product synced to database successfully - main website should see it now!');
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to sync product to database:', errorText);
      }
    } catch (error) {
      console.error('❌ Background sync error:', error);
    }
  }

  async deleteProduct(productId) {
    if (confirm("Are you sure you want to delete this product?")) {
      try {
        const productIdStr = String(productId);
        const product = this.products.find(p => String(p.id) === productIdStr || String(p._id) === productIdStr);
        if (!product) {
          alert('Product not found');
          return;
        }

        const mongoId = product._id || product.id;
        console.log('💾 [OWNER PORTAL] Deleting product from database...');
        
        // Delete from database ONLY
        const response = await fetch(`${this.API_URL}/products/${mongoId}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          console.log('✅ [OWNER PORTAL] Product deleted from database');
          
          // Remove from local array (no localStorage)
          this.products = this.products.filter((p) => String(p.id) !== productIdStr && String(p._id) !== productIdStr);
          
          this.renderPage("admin-products");
          alert('✅ Product deleted from database successfully!');
        } else {
          const errorText = await response.text();
          console.error('❌ [OWNER PORTAL] Database delete failed:', errorText);
          throw new Error(`Failed to delete product: ${errorText}`);
        }
        
        console.log('🔄 Product deleted from database, main website will see changes');
      } catch (error) {
        console.error('❌ Error deleting product:', error);
        alert('❌ Error deleting product: ' + error.message);
      }
    }
  }

  // Background sync method for product deletion
  async syncProductDeleteToDatabase(mongoId) {
    try {
      const response = await fetch(`${this.API_URL}/products/${mongoId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        console.log('✅ Product deletion synced to database successfully');
      } else {
        console.error('❌ Failed to sync product deletion to database');
      }
    } catch (error) {
      console.error('❌ Background delete sync error:', error);
    }
  }

  handleImageUpload(event, imageNumber = 1) {
    const file = event.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const base64Image = e.target.result
        if (imageNumber === 1) {
          document.getElementById("productImageUrl").value = base64Image
        } else if (imageNumber === 2) {
          document.getElementById("productImageUrl2").value = base64Image
        }
      }
      reader.readAsDataURL(file)
    }
  }

  // ── Replaced Items & Component Stock Auto-Deduction Helpers ──
  getAvailableStockOptions(filterType = 'all') {
    const options = [];

    // 1. Products (Product Stock)
    if (filterType === 'all' || filterType === 'product') {
      (this.products || []).forEach(item => {
        const qty = Number(item.stock) || 0;
        options.push({
          id: item.id || item._id,
          name: item.name || 'Product',
          code: item.id || 'PROD',
          type: 'product',
          stock: qty,
          price: Number(item.price) || 0,
          label: `📦 [Product] ${item.name} - Stock: ${qty} (₹${(Number(item.price)||0).toLocaleString('en-IN')})`
        });
      });
    }

    // 2. Display Stock
    if (filterType === 'all' || filterType === 'display') {
      (this.displayStock || []).forEach(item => {
        const qty = Number(item.stock) || 0;
        options.push({
          id: item.stockItemId || item._id,
          name: item.displayName || item.name || 'Display Item',
          code: item.displayId || 'DISPLAY',
          type: 'display',
          stock: qty,
          price: Number(item.price) || 0,
          label: `📱 [Display] ${item.displayName || item.name} (${item.displayId || ''}) - Stock: ${qty} (₹${(Number(item.price)||0).toLocaleString('en-IN')})`
        });
      });
    }

    // 3. Spare Parts Stock
    if (filterType === 'all' || filterType === 'spare') {
      (this.sparePartsStock || []).forEach(item => {
        const qty = Number(item.stock) || 0;
        options.push({
          id: item.partItemId || item._id,
          name: item.partName || item.name || 'Spare Part',
          code: item.partId || 'SPARE',
          type: 'spare',
          stock: qty,
          price: Number(item.customerPrice) || Number(item.price) || 0,
          label: `🔩 [Spare Part] ${item.partName || item.name} (${item.partId || ''}) - Stock: ${qty} (₹${(Number(item.customerPrice)||Number(item.price)||0).toLocaleString('en-IN')})`
        });
      });
    }

    return options;
  }

  filterTrackingPartSelect(filterType = 'all', targetSelectId = 'newTrackingPartSelect') {
    const select = document.getElementById(targetSelectId);
    if (!select) return;
    const options = this.getAvailableStockOptions(filterType);
    const labelPrefix = filterType === 'all' ? 'Product, Display, or Spare' : filterType.toUpperCase();
    select.innerHTML = `
      <option value="">-- Select ${labelPrefix} --</option>
      ${options.map(opt => `<option value="${opt.type}|${opt.id}|${opt.name.replace(/"/g, '&quot;')}|${opt.price}">${opt.label}</option>`).join('')}
    `;
  }

  scanBarcodeToTrackingReplacedItems(value) {
    const code = (value || '').trim();
    if (!code) return;
    const lowerCode = code.toLowerCase();

    // 1. Direct cross-inventory match (Products, Display Stock, Spare Parts)
    const allItems = this.getAllPOSItems();
    const matched = allItems.find(i => 
      String(i.id) === code ||
      (i.barcode && i.barcode.toLowerCase() === lowerCode) ||
      (i.category && String(i.category).toLowerCase() === lowerCode) ||
      (i.raw && (
        (i.raw.sku && i.raw.sku.toLowerCase() === lowerCode) || 
        (i.raw.barcode && i.raw.barcode.toLowerCase() === lowerCode) || 
        (i.raw.partId && i.raw.partId.toLowerCase() === lowerCode) ||
        (i.raw.partItemId && i.raw.partItemId.toLowerCase() === lowerCode) ||
        (i.raw.stockItemId && i.raw.stockItemId.toLowerCase() === lowerCode) ||
        (i.raw.imei1 && i.raw.imei1.toLowerCase() === lowerCode) || 
        (i.raw.imei2 && i.raw.imei2.toLowerCase() === lowerCode)
      ))
    );

    let targetItem = matched;

    // 2. Fallback lookup in stockEntries (distributor purchase items)
    if (!targetItem) {
      const entry = (this.stockEntries || []).find(e => 
        (e.barcode || '').toLowerCase() === lowerCode ||
        (e.imei1 || '').toLowerCase() === lowerCode ||
        (e.imei2 || '').toLowerCase() === lowerCode ||
        (e.serialNumber || '').toLowerCase() === lowerCode
      );
      if (entry) {
        const masterProd = (this.products || []).find(p => String(p._id) === String(entry.masterId) || String(p.id) === String(entry.masterId));
        if (masterProd) {
          targetItem = {
            id: masterProd._id || masterProd.id,
            name: masterProd.name,
            type: 'product',
            price: Number(masterProd.price) || 0
          };
        }
      }
    }

    if (targetItem) {
      if (!this.tempFormReplacedItems) this.tempFormReplacedItems = [];
      const existing = this.tempFormReplacedItems.find(x => String(x.id) === String(targetItem.id) && x.type === targetItem.type);
      if (existing) {
        existing.qty = (Number(existing.qty) || 1) + 1;
      } else {
        this.tempFormReplacedItems.push({
          type: targetItem.type,
          id: targetItem.id,
          name: targetItem.name,
          price: Number(targetItem.price) || 0,
          qty: 1
        });
      }
      this.renderReplacedItemsList();
      alert(`✅ Scanned & added "${targetItem.name}" to Replaced Components list!`);
    } else {
      alert(`❌ Item with barcode "${code}" not found in inventory (Products, Displays, or Spare Parts).`);
    }
  }

  addReplacedItemToForm() {
    const select = document.getElementById('newTrackingPartSelect') || document.getElementById('editTrackingPartSelect');
    const qtyInput = document.getElementById('newTrackingPartQty') || document.getElementById('editTrackingPartQty');
    if (!select || !select.value) {
      alert('Please select a Product, Display Stock, or Spare Part component first.');
      return;
    }
    const parts = select.value.split('|');
    const type = parts[0];
    const id = parts[1];
    const name = parts[2];
    const price = Number(parts[3]) || 0;
    const qty = Math.max(1, Number(qtyInput?.value) || 1);

    if (!this.tempFormReplacedItems) this.tempFormReplacedItems = [];
    this.tempFormReplacedItems.push({ type, id, name, price, qty });
    this.renderReplacedItemsList();

    select.value = '';
    if (qtyInput) qtyInput.value = '1';
  }

  removeReplacedItemFromForm(index) {
    if (this.tempFormReplacedItems && this.tempFormReplacedItems[index]) {
      this.tempFormReplacedItems.splice(index, 1);
      this.renderReplacedItemsList();
    }
  }

  renderReplacedItemsList() {
    const container = document.getElementById('replacedItemsListContainer') || document.getElementById('editReplacedItemsListContainer');
    if (!container) return;
    if (!this.tempFormReplacedItems || this.tempFormReplacedItems.length === 0) {
      container.innerHTML = `<div style="font-size:12px; color:#64748b; font-style:italic;">No replaced components added yet.</div>`;
      return;
    }

    container.innerHTML = this.tempFormReplacedItems.map((item, idx) => `
      <div style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; border:1.5px solid #cbd5e1; padding:8px 12px; border-radius:8px; font-size:12.5px; box-shadow:0 2px 6px rgba(0,0,0,0.03);">
        <div>
          <span style="font-weight:800; color:#0f172a;">${item.type === 'product' ? '📦 [Product]' : item.type === 'display' ? '📱 [Display]' : '🔩 [Spare Part]'} ${item.name}</span>
          <span style="font-weight:800; color:#0891b2; margin-left:8px;">×${item.qty}</span>
          ${item.price ? `<span style="font-weight:800; color:#059669; margin-left:8px;">(₹${(item.price * item.qty).toLocaleString()})</span>` : ''}
        </div>
        <button type="button" onclick="app.removeReplacedItemFromForm(${idx})" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; border-radius:6px; padding:4px 10px; font-size:11.5px; font-weight:800; cursor:pointer;">
          ✕ Remove
        </button>
      </div>
    `).join('');
  }

  async processStockDeductionForReplacedItems(replacedItems, qrId, customerName) {
    if (!replacedItems || !Array.isArray(replacedItems) || replacedItems.length === 0) return;

    for (const item of replacedItems) {
      try {
        const deductQty = Number(item.qty) || 1;

        if (item.type === 'product') {
          const productItem = (this.products || []).find(p => String(p.id) === String(item.id) || String(p._id) === String(item.id) || p.name === item.name);
          if (productItem) {
            const newStock = Math.max(0, (Number(productItem.stock) || 0) - deductQty);
            productItem.stock = newStock;
            productItem.inStock = newStock > 0;
            const mongoId = productItem._id || productItem.id;

            await fetch(`${this.API_URL}/products/${mongoId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ stock: newStock, inStock: newStock > 0 })
            });
            console.log(`✅ Product stock auto-reduced for ${productItem.name}: New stock = ${newStock}`);
          }
        } else if (item.type === 'display') {
          const displayItem = (this.displayStock || []).find(d => d.stockItemId === item.id || d._id === item.id || d.displayName === item.name);
          if (displayItem) {
            const newStock = Math.max(0, (Number(displayItem.stock) || 0) - deductQty);
            displayItem.stock = newStock;
            const historyEntry = {
              date: new Date().toLocaleDateString('en-IN'),
              type: 'REDUCE',
              change: -deductQty,
              reason: `Used for Repair Tracking #${qrId} (${customerName})`
            };
            if (!displayItem.history) displayItem.history = [];
            displayItem.history.push(historyEntry);

            await fetch(`${this.API_URL}/display-stock/${displayItem.stockItemId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ stock: newStock, historyEntry })
            });
            console.log(`✅ Display stock auto-reduced for ${displayItem.displayName}: New stock = ${newStock}`);
          }
        } else if (item.type === 'spare') {
          const spareItem = (this.sparePartsStock || []).find(s => s.partItemId === item.id || s._id === item.id || s.partName === item.name);
          if (spareItem) {
            const newStock = Math.max(0, (Number(spareItem.stock) || 0) - deductQty);
            spareItem.stock = newStock;
            const historyEntry = {
              date: new Date().toLocaleDateString('en-IN'),
              type: 'REDUCE',
              change: -deductQty,
              reason: `Used for Repair Tracking #${qrId} (${customerName})`
            };
            if (!spareItem.history) spareItem.history = [];
            spareItem.history.push(historyEntry);

            await fetch(`${this.API_URL}/spare-parts/${spareItem.partItemId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ stock: newStock, historyEntry })
            });
            console.log(`✅ Spare part stock auto-reduced for ${spareItem.partName}: New stock = ${newStock}`);
          }
        }
      } catch (err) {
        console.error('❌ Error in stock deduction for replaced item:', item, err);
      }
    }
  }

  // Tracking Management Methods
  async saveNewTracking() {
    const qrId = document.getElementById("newTrackingQRId")?.value?.trim();
    const password = document.getElementById("newTrackingPassword")?.value?.trim();
    const customer = document.getElementById("newTrackingCustomer")?.value?.trim();
    const device = document.getElementById("newTrackingDevice")?.value?.trim();
    const imei = document.getElementById("newTrackingImei")?.value?.trim();
    const contact       = document.getElementById("newTrackingContact")?.value?.trim();
    const address       = document.getElementById("newTrackingAddress")?.value?.trim();
    const dateIn        = document.getElementById("newTrackingDateIn")?.value?.trim();
    const dateOut       = document.getElementById("newTrackingDateOut")?.value?.trim();
    const issue         = document.getElementById("newTrackingIssue")?.value?.trim();
    const status        = document.getElementById("newTrackingStatus")?.value;
    const days          = document.getElementById("newTrackingDays")?.value;
    const amount        = document.getElementById("newTrackingAmount")?.value?.trim();
    const advance       = document.getElementById("newTrackingAdvance")?.value?.trim();
    const paidAmount    = document.getElementById("newTrackingPaid")?.value?.trim();
    const totalReceived = document.getElementById("newTrackingTotalReceived")?.value?.trim();
    const balance       = document.getElementById("newTrackingBalance")?.value?.trim();

    if (!qrId || !password || !customer || !device || !imei || !issue || !amount) {
      alert("Please fill all compulsory required fields: QR ID, Password, Customer Name, Device Model, IMS / IMEI Number, Issue Description, and Full Price");
      return;
    }

    if (this.trackingData.find((t) => t.qrId === qrId)) {
      alert("This QR ID already exists. Please use a unique QR ID.");
      return;
    }

    try {
      // Show loading indicator
      const saveButton = document.querySelector('[data-action="save-new-tracking"]');
      const originalText = saveButton.textContent;
      saveButton.textContent = 'Saving...';
      saveButton.disabled = true;

      const currentDate = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

      const replacedItems = [...(this.tempFormReplacedItems || [])];
      const proofImages = [...(this.tempTrackingPhotos || [])];
      const signatureImage = this.getSignatureDataURL('newTrackingSignatureCanvas');

      const newTracking = {
        qrId: qrId,
        qrPassword: password,
        customerName: customer,
        productName: device,
        deviceModel: device,
        imeiNumber: imei,
        imsNumber: imei,
        contact: contact,
        address: address || '',
        dateIn:  dateIn  || currentDate,
        dateOut: dateOut || '',
        status: status,
        issue: issue,
        proofImages: proofImages,
        signatureImage: signatureImage,
        replacedItems: replacedItems,
        estimatedDays: Number.parseInt(days) || 0,
        amount:         Number.parseInt(amount) || 0,
        advanceAmount:  Number.parseInt(advance) || 0,
        paidAmount:     Number.parseInt(paidAmount) || 0,
        totalReceived:  Number.parseInt(totalReceived) || 0,
        balanceAmount:  Number.parseInt(balance) || Number.parseInt(amount) || 0,
        createdAt: currentDate,
        completedAt: null,
        lastUpdated: new Date().toLocaleDateString('en-IN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      };

      // Deduct stock from database for all selected components
      this.processStockDeductionForReplacedItems(replacedItems, qrId, customer);
      this.tempFormReplacedItems = [];
      this.tempTrackingPhotos = [];
      this.clearSignatureCanvas('newTrackingSignatureCanvas');

      // 1. Save to local storage IMMEDIATELY (instant)
      this.trackingData.push(newTracking);
      
      // 2. Show SUCCESS popup immediately
      alert("✅ Tracking record created successfully!\n\nQR ID: " + qrId + "\nPassword: " + password + "\nAmount: ₹" + amount + "\n\nShare these details with your customer for tracking.");
      
      // 3. Clear form and render page immediately
      document.getElementById("newTrackingQRId").value = "";
      document.getElementById("newTrackingPassword").value = "";
      document.getElementById("newTrackingCustomer").value = "";
      document.getElementById("newTrackingDevice").value = "";
      if (document.getElementById("newTrackingImei")) document.getElementById("newTrackingImei").value = "";
      document.getElementById("newTrackingContact").value = "";
      if (document.getElementById("newTrackingAddress")) document.getElementById("newTrackingAddress").value = "";
      if (document.getElementById("newTrackingDateIn"))  document.getElementById("newTrackingDateIn").value  = "";
      if (document.getElementById("newTrackingDateOut")) document.getElementById("newTrackingDateOut").value = "";
      document.getElementById("newTrackingIssue").value = "";
      document.getElementById("newTrackingDays").value = "0";
      document.getElementById("newTrackingAmount").value = "";
      if (document.getElementById("newTrackingAdvance"))       document.getElementById("newTrackingAdvance").value = "";
      if (document.getElementById("newTrackingPaid"))          document.getElementById("newTrackingPaid").value = "";
      if (document.getElementById("newTrackingTotalReceived")) document.getElementById("newTrackingTotalReceived").value = "";
      if (document.getElementById("newTrackingBalance"))       document.getElementById("newTrackingBalance").value = "";
      
      this.toggleTrackingForm();
      this.renderPage("admin-tracking");
      
      // 4. Sync to database in background (don't wait for it)
      this.syncTrackingToDatabase(newTracking).catch(error => {
        console.error('❌ Background tracking sync failed:', error);
      });
      
      console.log('🔄 Tracking saved locally, syncing to database in background');
    } catch (error) {
      console.error('Error saving tracking:', error);
      alert('❌ Error saving tracking: ' + error.message + '\n\nPlease check your internet connection and try again.');
    } finally {
      // Restore button state
      const saveButton = document.querySelector('[data-action="save-new-tracking"]');
      if (saveButton) {
        saveButton.textContent = 'Save Tracking';
        saveButton.disabled = false;
      }
    }
  }

  // Background sync method for tracking
  async syncTrackingToDatabase(tracking) {
    try {
      const response = await fetch(`${this.API_URL}/tracking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tracking)
      });

      if (response.ok) {
        console.log('✅ Tracking synced to database successfully');
      } else {
        console.error('❌ Failed to sync tracking to database');
      }
    } catch (error) {
      console.error('❌ Background tracking sync error:', error);
    }
  }

  // Camera Capture & Photo Upload Helpers for Tracking
  openCameraModal(targetArrayName = 'tempTrackingPhotos', previewContainerId = 'newTrackingPhotosPreview') {
    const existing = document.getElementById('cameraCaptureModal');
    if (existing) existing.remove();

    const modalHTML = `
      <div id="cameraCaptureModal" style="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;">
        <div style="background:#0f172a;border-radius:14px;padding:20px;max-width:500px;width:100%;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,0.5);border:1px solid #334155;">
          <h4 style="font-size:16px;font-weight:800;color:#38bdf8;margin-bottom:12px;display:flex;align-items:center;justify-content:center;gap:8px;">
            📷 Take Mobile Proof Photo
          </h4>
          <div style="position:relative;width:100%;max-height:340px;background:#000;border-radius:10px;overflow:hidden;margin-bottom:14px;border:1.5px solid #0284c7;">
            <video id="cameraStreamVideo" autoplay playsinline style="width:100%;height:320px;object-fit:cover;display:block;"></video>
            <canvas id="cameraSnapCanvas" style="display:none;"></canvas>
          </div>
          <div style="display:flex;gap:10px;">
            <button type="button" onclick="app.captureCameraSnap('${targetArrayName}', '${previewContainerId}')" style="flex:2;background:#059669;color:#fff;border:none;border-radius:8px;padding:12px;font-weight:900;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
              📸 Snap Photo
            </button>
            <button type="button" onclick="app.closeCameraModal()" style="flex:1;background:#334155;color:#fff;border:none;border-radius:8px;padding:12px;font-weight:800;font-size:14px;cursor:pointer;">
              ✕ Cancel
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
      .then(stream => {
        this.cameraStream = stream;
        const video = document.getElementById('cameraStreamVideo');
        if (video) video.srcObject = stream;
      })
      .catch(err => {
        console.warn('Camera access error:', err);
        alert('📷 Could not open camera directly. Please use "Upload Photo File" option.');
        this.closeCameraModal();
      });
  }

  closeCameraModal() {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = null;
    }
    const modal = document.getElementById('cameraCaptureModal');
    if (modal) modal.remove();
  }

  captureCameraSnap(targetArrayName = 'tempTrackingPhotos', previewContainerId = 'newTrackingPhotosPreview') {
    const video = document.getElementById('cameraStreamVideo');
    const canvas = document.getElementById('cameraSnapCanvas');
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 800;
    canvas.height = video.videoHeight || 600;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataURL = canvas.toDataURL('image/jpeg', 0.85);
    if (!this[targetArrayName]) this[targetArrayName] = [];
    this[targetArrayName].push(dataURL);

    this.renderTrackingPhotoThumbnails(targetArrayName, previewContainerId);
    this.closeCameraModal();
  }

  handleTrackingPhotosUpload(event, targetArrayName = 'tempTrackingPhotos', previewContainerId = 'newTrackingPhotosPreview') {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (!this[targetArrayName]) this[targetArrayName] = [];

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 900;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const resizedDataURL = c.toDataURL('image/jpeg', 0.82);
          this[targetArrayName].push(resizedDataURL);
          this.renderTrackingPhotoThumbnails(targetArrayName, previewContainerId);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
    event.target.value = '';
  }

  renderTrackingPhotoThumbnails(targetArrayName = 'tempTrackingPhotos', previewContainerId = 'newTrackingPhotosPreview') {
    const container = document.getElementById(previewContainerId);
    if (!container) return;

    const list = this[targetArrayName] || [];
    if (list.length === 0) {
      container.innerHTML = '<div style="font-size:11.5px;color:#94a3b8;font-style:italic;">No proof photos added yet.</div>';
      return;
    }

    container.innerHTML = list.map((url, index) => `
      <div style="position:relative;display:inline-block;margin:4px;">
        <img src="${url}" onclick="app.previewImagePopup('${url}')" style="width:68px;height:68px;object-fit:cover;border-radius:8px;border:2px solid #0284c7;cursor:pointer;background:#fff;">
        <button type="button" onclick="app.removeTrackingPhoto(${index}, '${targetArrayName}', '${previewContainerId}')" style="position:absolute;top:-6px;right:-6px;background:#dc2626;color:#fff;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:11px;font-weight:bold;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,0.3);">✕</button>
      </div>
    `).join('');
  }

  removeTrackingPhoto(index, targetArrayName = 'tempTrackingPhotos', previewContainerId = 'newTrackingPhotosPreview') {
    if (this[targetArrayName]) {
      this[targetArrayName].splice(index, 1);
      this.renderTrackingPhotoThumbnails(targetArrayName, previewContainerId);
    }
  }

  previewImagePopup(url) {
    const popup = document.createElement('div');
    popup.onclick = () => popup.remove();
    popup.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;cursor:pointer;';
    popup.innerHTML = `<img src="${url}" style="max-width:90vw;max-height:90vh;object-fit:contain;border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,0.5);">`;
    document.body.appendChild(popup);
  }

  // Thin Pen Signature Drawing Pad Helpers
  initSignatureCanvas(canvasId) {
    setTimeout(() => {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        canvas.width = rect.width * 2;
        canvas.height = (rect.height || 140) * 2;
        ctx.scale(2, 2);
      }

      ctx.lineWidth = 1.8; // Thin pen
      ctx.strokeStyle = '#0f172a';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      let isDrawing = false;
      let lastX = 0;
      let lastY = 0;

      const getPos = (e) => {
        const r = canvas.getBoundingClientRect();
        const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;
        return {
          x: clientX - r.left,
          y: clientY - r.top
        };
      };

      const startDraw = (e) => {
        e.preventDefault();
        isDrawing = true;
        const pos = getPos(e);
        lastX = pos.x;
        lastY = pos.y;
      };

      const draw = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        lastX = pos.x;
        lastY = pos.y;
      };

      const stopDraw = (e) => {
        if (isDrawing) {
          isDrawing = false;
        }
      };

      canvas.onmousedown = startDraw;
      canvas.onmousemove = draw;
      canvas.onmouseup = stopDraw;
      canvas.onmouseleave = stopDraw;

      canvas.ontouchstart = startDraw;
      canvas.ontouchmove = draw;
      canvas.ontouchend = stopDraw;
      canvas.ontouchcancel = stopDraw;
    }, 100);
  }

  clearSignatureCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  getSignatureDataURL(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;
    let hasPixels = false;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] > 0) {
        hasPixels = true;
        break;
      }
    }
    return hasPixels ? canvas.toDataURL('image/png') : null;
  }

  showEditTrackingModal(qrId) {
    const t = this.trackingData.find(t => t.qrId === qrId);
    if (!t) return;

    this.editTrackingPhotos = [...(t.proofImages || t.photos || [])];

    const existing = document.getElementById('editTrackingModal');
    if (existing) existing.remove();

    const modalHTML = `
      <div id="editTrackingModal" onclick="if(event.target===this)this.remove()"
        style="position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;">
        <div style="background:#fff;border-radius:14px;padding:28px;max-width:560px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.4);">
          <h3 style="font-size:18px;font-weight:900;color:#0f172a;margin-bottom:20px;">✏️ Edit Tracking Record</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">
            <div>
              <label style="font-size:12px;font-weight:800;color:#0f172a;display:block;margin-bottom:4px;">Contact Number</label>
              <input id="et_contact" class="input" value="${t.contact || ''}" style="width:100%;color:#000000;font-weight:800;background:#ffffff;border:1.5px solid #0f172a;">
            </div>
            <div>
              <label style="font-size:12px;font-weight:800;color:#0f172a;display:block;margin-bottom:4px;">Customer Name *</label>
              <input id="et_customerName" class="input" value="${t.customerName || ''}" style="width:100%;color:#000000;font-weight:800;background:#ffffff;border:1.5px solid #0f172a;">
            </div>
            <div>
              <label style="font-size:12px;font-weight:800;color:#0f172a;display:block;margin-bottom:4px;">Address</label>
              <input id="et_address" class="input" value="${t.address || ''}" placeholder="Enter customer address" style="width:100%;color:#000000;font-weight:800;background:#ffffff;border:1.5px solid #0f172a;">
            </div>
            <div>
              <label style="font-size:12px;font-weight:800;color:#0f172a;display:block;margin-bottom:4px;">Device / Product Name *</label>
              <input id="et_productName" class="input" value="${t.productName || ''}" style="width:100%;color:#000000;font-weight:800;background:#ffffff;border:1.5px solid #0f172a;">
            </div>
            <div>
              <label style="font-size:12px;font-weight:800;color:#0f172a;display:block;margin-bottom:4px;">IMS / IMEI Number *</label>
              <input id="et_imeiNumber" class="input" value="${t.imeiNumber || t.imsNumber || ''}" placeholder="Enter 15-digit IMEI / IMS" style="width:100%;color:#000000;font-weight:800;background:#ffffff;border:1.5px solid #0f172a;">
            </div>
            <div>
              <label style="font-size:12px;font-weight:800;color:#0f172a;display:block;margin-bottom:4px;">Full Price (₹)</label>
              <input id="et_amount" class="input" type="number" value="${t.amount || ''}" style="width:100%;color:#000000;font-weight:800;background:#ffffff;border:1.5px solid #0f172a;"
                oninput="var f=Number(this.value)||0;var a=Number(document.getElementById('et_advance').value)||0;var p=Number(document.getElementById('et_paid').value)||0;var tot=a+p;document.getElementById('et_total').value=tot;document.getElementById('et_balance').value=Math.max(0,f-tot);">
              <small style="color:#334155;font-size:10.5px;font-weight:700;">Owner reference — not in daily sales</small>
            </div>
            <div>
              <label style="font-size:12px;font-weight:800;color:#0f172a;display:block;margin-bottom:4px;">Advance Received (₹)</label>
              <input id="et_advance" class="input" type="number" value="${t.advanceAmount || ''}" style="width:100%;color:#000000;font-weight:800;background:#ffffff;border:1.5px solid #0f172a;"
                oninput="var f=Number(document.getElementById('et_amount').value)||0;var a=Number(this.value)||0;var p=Number(document.getElementById('et_paid').value)||0;var tot=a+p;document.getElementById('et_total').value=tot;document.getElementById('et_balance').value=Math.max(0,f-tot);">
              <small style="color:#059669;font-size:10.5px;font-weight:800;">Amount paid at drop-off → shows in Today's Sales</small>
            </div>
            <div>
              <label style="font-size:12px;font-weight:800;color:#0f172a;display:block;margin-bottom:4px;">Paid Amount (₹) <span style="color:#059669;">(balance received)</span></label>
              <input id="et_paid" class="input" type="number" value="${Number(t.paidAmount) || ''}" style="width:100%;color:#000000;font-weight:800;background:#ffffff;border:1.5px solid #0f172a;"
                oninput="var f=Number(document.getElementById('et_amount').value)||0;var a=Number(document.getElementById('et_advance').value)||0;var p=Number(this.value)||0;var tot=a+p;document.getElementById('et_total').value=tot;document.getElementById('et_balance').value=Math.max(0,f-tot); if(p > 0 && !document.getElementById('et_balancePaidDate').value) { document.getElementById('et_balancePaidDate').value = new Date().toLocaleDateString('en-IN', {day:'2-digit',month:'2-digit',year:'numeric'}); }">
              <small style="color:#059669;font-size:10.5px;font-weight:800;">Amount paid when customer collects → shows in Today's Sales</small>
            </div>
            <div>
              <label style="font-size:12px;font-weight:800;color:#0f172a;display:block;margin-bottom:4px;">Balance Paid Date</label>
              <input id="et_balancePaidDate" class="input" type="text" placeholder="DD/MM/YYYY" value="${t.balancePaidDate || ''}" style="width:100%;color:#000000;font-weight:800;background:#ffffff;border:1.5px solid #0f172a;">
              <small style="color:#334155;font-size:10.5px;font-weight:700;">Date of balance payment (DD/MM/YYYY)</small>
            </div>
            <div>
              <label style="font-size:12px;font-weight:800;color:#0f172a;display:block;margin-bottom:4px;">Total Received (₹)</label>
              <input id="et_total" class="input" type="number" value="${Number(t.totalReceived) || (Number(t.advanceAmount||0) + Number(t.paidAmount||0))}" readonly style="width:100%;color:#059669;background:#f0fdf4;border:1.5px solid #059669;font-weight:900;">
              <small style="color:#334155;font-size:10.5px;font-weight:700;">Advance + Paid (auto)</small>
            </div>
            <div>
              <label style="font-size:12px;font-weight:800;color:#0f172a;display:block;margin-bottom:4px;">Balance Amount (₹)</label>
              <input id="et_balance" class="input" type="number"
                value="${Math.max(0, Number(t.amount||0) - Number(t.advanceAmount||0) - Number(t.paidAmount||0))}"
                readonly style="width:100%;color:#dc2626;background:#fef2f2;border:1.5px solid #dc2626;font-weight:900;">
              <small style="color:#334155;font-size:10.5px;font-weight:700;">Full − Advance − Paid (auto)</small>
            </div>
            <div>
              <label style="font-size:12px;font-weight:800;color:#0f172a;display:block;margin-bottom:4px;">Estimated Completion</label>
              <select id="et_estimatedDays" class="input" style="width:100%;color:#000000;font-weight:800;background:#ffffff;border:1.5px solid #0f172a;">
                <option value="0" ${(t.estimatedDays||0)==0?'selected':''}>📅 Same Day</option>
                <option value="1" ${(t.estimatedDays||0)==1?'selected':''}>1 Day</option>
                <option value="2" ${(t.estimatedDays||0)==2?'selected':''}>2 Days</option>
                <option value="3" ${(t.estimatedDays||0)==3?'selected':''}>3 Days</option>
                <option value="4" ${(t.estimatedDays||0)==4?'selected':''}>4 Days</option>
                <option value="5" ${(t.estimatedDays||0)==5?'selected':''}>5 Days</option>
                <option value="7" ${(t.estimatedDays||0)==7?'selected':''}>1 Week</option>
                <option value="10" ${(t.estimatedDays||0)==10?'selected':''}>10 Days</option>
                <option value="14" ${(t.estimatedDays||0)==14?'selected':''}>2 Weeks</option>
                <option value="30" ${(t.estimatedDays||0)==30?'selected':''}>1 Month</option>
              </select>
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">QR Password</label>
              <input id="et_qrPassword" class="input" value="${t.qrPassword || ''}" style="width:100%;color:#111;background:#f8fafc;border:1px solid #d1d5db;">
            </div>
            <div style="grid-column:1/-1;">
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Issue Description *</label>
              <textarea id="et_issue" class="input" rows="3" style="width:100%;color:#111;background:#f8fafc;border:1px solid #d1d5db;resize:vertical;">${t.issue || ''}</textarea>
            </div>

            <!-- 📷 Proof Photos & ✍️ Signature Pad in Edit Modal -->
            <div style="grid-column: 1 / -1; background: #f0f9ff; border: 1.5px dashed #0284c7; border-radius: 10px; padding: 14px; margin-top: 6px;">
              <div style="font-size: 13px; font-weight: 800; color: #0284c7; margin-bottom: 8px;">📸 Proof Photos (Camera / Upload)</div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px;">
                <button type="button" onclick="app.openCameraModal('editTrackingPhotos', 'editTrackingPhotosPreview')" style="padding: 8px 14px; background: #0284c7; color: #fff; border: none; border-radius: 6px; font-weight: 800; font-size: 12px; cursor: pointer;">📷 Take Photo</button>
                <label style="padding: 8px 14px; background: #4f46e5; color: #fff; border: none; border-radius: 6px; font-weight: 800; font-size: 12px; cursor: pointer; margin: 0;">📁 Upload File <input type="file" accept="image/*" multiple style="display:none;" onchange="app.handleTrackingPhotosUpload(event, 'editTrackingPhotos', 'editTrackingPhotosPreview')"></label>
              </div>
              <div id="editTrackingPhotosPreview" style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px;"></div>

              <div style="border-top: 1px solid #cbd5e1; padding-top: 10px; margin-top: 8px;">
                <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
                  <span>✍️ Mobile Owner Signature / Proof (Thin Pen)</span>
                  <button type="button" onclick="app.clearSignatureCanvas('editTrackingSignatureCanvas')" style="background: #fee2e2; color: #dc2626; border: 1px solid #dc2626; border-radius: 4px; padding: 2px 8px; font-size: 11px; font-weight: 800; cursor: pointer;">Clear Signature</button>
                </div>
                <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 2px; width: 100%;">
                  <canvas id="editTrackingSignatureCanvas" style="width: 100%; height: 120px; touch-action: none; cursor: crosshair; display: block; border-radius: 4px; background: #fff;"></canvas>
                </div>
              </div>
            </div>
          </div>
          <div style="display:flex;gap:10px;margin-top:20px;">
            <button onclick="app.saveEditTracking('${t.qrId}')"
              style="flex:1;background:#dc2626;color:#fff;border:none;border-radius:8px;padding:11px;font-size:14px;font-weight:700;cursor:pointer;">
              💾 Save Changes
            </button>
            <button onclick="document.getElementById('editTrackingModal').remove()"
              style="flex:1;background:#f1f5f9;color:#374151;border:1px solid #d1d5db;border-radius:8px;padding:11px;font-size:14px;font-weight:600;cursor:pointer;">
              ✕ Cancel
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    this.renderTrackingPhotoThumbnails('editTrackingPhotos', 'editTrackingPhotosPreview');
    this.initSignatureCanvas('editTrackingSignatureCanvas');
    if (t.signatureImage) {
      setTimeout(() => {
        const canvas = document.getElementById('editTrackingSignatureCanvas');
        if (canvas) {
          const ctx = canvas.getContext('2d');
          const img = new Image();
          img.onload = () => { ctx.drawImage(img, 0, 0, canvas.width / 2, canvas.height / 2); };
          img.src = t.signatureImage;
        }
      }, 150);
    }
  }

  async saveEditTracking(qrId) {
    const customerName  = document.getElementById('et_customerName')?.value?.trim();
    const productName   = document.getElementById('et_productName')?.value?.trim();
    const imeiNumber    = document.getElementById('et_imeiNumber')?.value?.trim();
    const issue         = document.getElementById('et_issue')?.value?.trim();

    if (!customerName || !productName || !imeiNumber || !issue) {
      alert('Please fill in Customer Name, Device Name, IMS / IMEI Number, and Issue Description.');
      return;
    }

    const t = this.trackingData.find(tr => tr.qrId === qrId);
    const proofImages = [...(this.editTrackingPhotos || [])];
    const newSig = this.getSignatureDataURL('editTrackingSignatureCanvas');
    const signatureImage = newSig || (t ? t.signatureImage : null);

    const paidAmt = Number(document.getElementById('et_paid')?.value) || 0;
    const updatedData = {
      customerName,
      productName,
      deviceModel: productName,
      imeiNumber,
      imsNumber: imeiNumber,
      contact:        document.getElementById('et_contact')?.value?.trim(),
      address:        document.getElementById('et_address')?.value?.trim(),
      amount:         Number(document.getElementById('et_amount')?.value) || 0,
      advanceAmount:  Number(document.getElementById('et_advance')?.value) || 0,
      paidAmount:     paidAmt,
      totalReceived:  Number(document.getElementById('et_total')?.value) || 0,
      balanceAmount:  Number(document.getElementById('et_balance')?.value) || 0,
      balancePaidDate: document.getElementById('et_balancePaidDate')?.value?.trim() || (paidAmt > 0 ? new Date().toLocaleDateString('en-IN', {day:'2-digit',month:'2-digit',year:'numeric'}) : ''),
      estimatedDays:  Number(document.getElementById('et_estimatedDays')?.value) || 0,
      qrPassword:     document.getElementById('et_qrPassword')?.value?.trim(),
      issue,
      proofImages,
      signatureImage
    };

    try {
      const response = await fetch(`${this.API_URL}/tracking/${qrId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });

      if (response.ok) {
        const updated = await response.json();
        const idx = this.trackingData.findIndex(t => t.qrId === qrId);
        if (idx !== -1) this.trackingData[idx] = { ...this.trackingData[idx], ...updated };
        document.getElementById('editTrackingModal')?.remove();
        this.renderTrackingListOnly();
        alert('✅ Tracking record updated!');
      } else {
        alert('❌ Failed to update tracking record.');
      }
    } catch (error) {
      console.error('Error updating tracking:', error);
      alert('❌ Error updating tracking record.');
    }
  }

  async editTracking(qrId) {
    const tracking = this.trackingData.find((t) => t.qrId === qrId);
    if (!tracking) return;

    this.showStatusModal(tracking);
  }

  showStatusModal(tracking) {
    const statuses = [
      { value: 'Received',        label: '📥 Received',         desc: 'Device received at service center' },
      { value: 'Diagnostics',     label: '🔍 Diagnostics',      desc: 'Checking device issues' },
      { value: 'Return',          label: '↩️ Return',            desc: 'Device returned to customer' },
      { value: 'In Progress',     label: '🔧 In Progress',      desc: 'Repair work in progress' },
      { value: 'Parts Ordered',   label: '📦 Parts Ordered',    desc: 'Waiting for replacement parts' },
      { value: 'Quality Check',   label: '✅ Quality Check',    desc: 'Final testing' },
      { value: 'Ready for Pickup',label: '📢 Ready for Pickup', desc: 'Ready for collection' },
      { value: 'Completed',       label: '🎉 Completed',        desc: 'Service completed' },
      { value: 'Delivered',       label: '🚚 Delivered',        desc: 'Device delivered to customer' }
    ];

    // Which options to hide when Return is selected
    const returnOnlyStatuses = ['Return'];
    const hiddenWhenReturn = ['In Progress','Parts Ordered','Quality Check','Ready for Pickup','Completed','Delivered'];

    const hasPaidFull = (Number(tracking.amount || 0) - Number(tracking.advanceAmount || 0) - Number(tracking.paidAmount || 0)) <= 0;

    const modalHTML = `
      <div class="status-modal" id="statusModal">
        <div class="status-modal-content">
          <div class="status-modal-header">
            <div class="status-modal-title">Update Repair Status</div>
            <div class="status-modal-subtitle">
              QR: ${tracking.qrId} | Device: ${tracking.productName} | Customer: ${tracking.customerName}
            </div>
          </div>
          
          <div class="status-select-group">
            <label class="status-select-label">Select New Status</label>
            <select class="status-select" id="newStatusSelect" data-qr-id="${tracking.qrId}" onchange="app.onStatusSelectChange(this)">
              ${statuses.map(s => {
                const isDelivered = s.value === 'Delivered';
                const hideReturn = hiddenWhenReturn.includes(s.value) && tracking.status === 'Return';
                const hideDelivered = isDelivered && !hasPaidFull;
                const hide = hideReturn || hideDelivered;

                return `
                  <option value="${s.value}" ${s.value === tracking.status ? 'selected' : ''}
                    ${hide ? 'style="display:none"' : ''}>
                    ${s.label} - ${s.desc}
                  </option>
                `;
              }).join('')}
            </select>
          </div>

          <!-- Return warning banner (shown only when Return is selected) -->
          <div id="returnWarning" style="display:${tracking.status === 'Return' ? 'flex' : 'none'}; align-items:center; gap:10px; background:#fef2f2; border:1px solid #fca5a5; border-radius:8px; padding:10px 14px; margin-top:12px;">
            <span style="font-size:18px;">↩️</span>
            <span style="font-size:13px; color:#dc2626; font-weight:600;">Return selected — device will be returned to customer. Further repair steps are hidden.</span>
          </div>
          
          <div class="status-modal-actions">
            <button class="status-btn status-btn-cancel" onclick="app.closeStatusModal()">Cancel</button>
            <button class="status-btn status-btn-save" onclick="app.saveTrackingStatus('${tracking.qrId}')">Update Status</button>
          </div>
        </div>
      </div>
    `;

    const existingModal = document.getElementById('statusModal');
    if (existingModal) existingModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  // Called when the status dropdown changes — hides/shows options based on Return and Payment status
  onStatusSelectChange(selectEl) {
    const hiddenWhenReturn = ['In Progress','Parts Ordered','Quality Check','Ready for Pickup','Completed','Delivered'];
    const isReturn = selectEl.value === 'Return';
    const warning = document.getElementById('returnWarning');

    const qrId = selectEl.dataset.qrId;
    const tracking = this.trackingData.find(t => t.qrId === qrId);
    const hasPaidFull = tracking ? ((Number(tracking.amount || 0) - Number(tracking.advanceAmount || 0) - Number(tracking.paidAmount || 0)) <= 0) : true;

    Array.from(selectEl.options).forEach(opt => {
      if (hiddenWhenReturn.includes(opt.value)) {
        if (opt.value === 'Delivered' && !hasPaidFull) {
          opt.style.display = 'none';
        } else {
          opt.style.display = isReturn ? 'none' : '';
        }
      }
    });

    // Only reset if Return is active AND the currently selected value is one of the hidden ones
    if (isReturn && hiddenWhenReturn.includes(selectEl.value)) {
      selectEl.value = 'Return';
    }

    if (warning) warning.style.display = isReturn ? 'flex' : 'none';
  }

  closeStatusModal() {
    const modal = document.getElementById('statusModal');
    if (modal) {
      modal.remove();
    }
  }

  async saveTrackingStatus(qrId) {
    const newStatus = document.getElementById('newStatusSelect').value;
    const tracking = this.trackingData.find((t) => t.qrId === qrId);
    
    if (!tracking) return;

    // 1. Update local storage IMMEDIATELY (instant)
    tracking.status = newStatus;
    tracking.lastUpdated = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Set completed date when status is changed to "Completed"
    if (newStatus === 'Completed' && !tracking.completedAt) {
      tracking.completedAt = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }
    // Set delivered date
    if (newStatus === 'Delivered' && !tracking.deliveredAt) {
      tracking.deliveredAt = new Date().toLocaleDateString('en-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      });
    }
    // Set return date
    if (newStatus === 'Return' && !tracking.returnedAt) {
      tracking.returnedAt = new Date().toLocaleDateString('en-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      });
    }
    
    // 2. Show SUCCESS and render page immediately
    this.closeStatusModal();
    this.renderPage("admin-tracking");
    alert(`✅ Status updated to: ${newStatus}${newStatus === 'Completed' ? '\n✅ Completed date recorded!' : ''}`);
    
    // 3. Sync to database in background (don't wait for it)
    this.syncTrackingStatusToDatabase(qrId, newStatus, tracking.lastUpdated, tracking.completedAt).catch(error => {
      console.error('❌ Background tracking status sync failed:', error);
    });
    
    console.log('🔄 Tracking status updated locally, syncing to database in background');
  }

  // Background sync method for tracking status updates
  async syncTrackingStatusToDatabase(qrId, newStatus, lastUpdated, completedAt) {
    try {
      const updateData = { 
        status: newStatus, 
        lastUpdated: lastUpdated 
      };
      
      // Include completedAt if it exists
      if (completedAt) {
        updateData.completedAt = completedAt;
      }
      
      const response = await fetch(`${this.API_URL}/tracking/${qrId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      
      if (response.ok) {
        console.log('✅ Tracking status synced to database successfully');
      } else {
        console.error('❌ Failed to sync tracking status to database');
      }
    } catch (error) {
      console.error('❌ Background tracking status sync error:', error);
    }
  }

  async deleteTracking(qrId) {
    if (confirm("Are you sure you want to delete this tracking record?")) {
      // 1. Delete from local storage IMMEDIATELY (instant)
      this.trackingData = this.trackingData.filter((t) => t.qrId !== qrId);
      
      // 2. Show SUCCESS and render page immediately
      this.renderPage("admin-tracking");
      alert('✅ Tracking deleted successfully!');
      
      // 3. Delete from database in background (don't wait for it)
      this.syncTrackingDeleteToDatabase(qrId).catch(error => {
        console.error('❌ Background tracking delete sync failed:', error);
      });
      
      console.log('🔄 Tracking deleted locally, syncing to database in background');
    }
  }

  // Background sync method for tracking deletion
  async syncTrackingDeleteToDatabase(qrId) {
    try {
      const response = await fetch(`${this.API_URL}/tracking/${qrId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        console.log('✅ Tracking deletion synced to database successfully');
      } else {
        console.error('❌ Failed to sync tracking deletion to database');
      }
    } catch (error) {
      console.error('❌ Background tracking delete sync error:', error);
    }
  }

  handleBarcodeScan(value) {
    // Auto-lookup when scanner sends a complete code (ends with Enter key via scanner)
    // Also update the barcode preview if it looks like a valid ID
    clearTimeout(this._scanTimer);
    this._scanTimer = setTimeout(() => {
      if (value && value.trim().length >= 4) {
        this.lookupBarcode(value.trim());
      }
    }, 400);
  }

  async lookupBarcode(value) {
    let code = (value || '').trim();
    if (!code) return;

    // If the scanner sends a full URL (e.g. https://...?scan=01518), extract the ID
    if (code.includes('scan=')) {
      try {
        const url = new URL(code.startsWith('http') ? code : 'https://x.x/' + code);
        code = url.searchParams.get('scan') || code;
      } catch(e) {
        const match = code.match(/[?&]scan=([^&\s]+)/);
        if (match) code = match[1];
      }
    }

    code = code.trim();
    if (!code) return;

    const lowerCode = code.toLowerCase();

    // 1. Check Repair Tracking records first
    let t = (this.trackingData || []).find(tr => 
      tr.qrId === code || 
      (tr.qrId && tr.qrId.toLowerCase() === lowerCode) ||
      tr.serviceId === code ||
      tr.imeiNumber === code ||
      tr.imsNumber === code
    );

    if (!t) {
      try {
        const response = await fetch(`${this.API_URL}/tracking`);
        if (response.ok) {
          this.trackingData = await response.json();
          t = (this.trackingData || []).find(tr => 
            tr.qrId === code || 
            (tr.qrId && tr.qrId.toLowerCase() === lowerCode) ||
            tr.serviceId === code ||
            tr.imeiNumber === code ||
            tr.imsNumber === code
          );
        }
      } catch (err) {
        console.warn('Fetch tracking failed during barcode lookup:', err);
      }
    }

    if (t) {
      this.showTrackingLookupResult(t);
      return;
    }

    // 2. Check Products, Display Stock, Spare Parts, Stock Entries
    let matchedItem = null;

    // Check Products
    const prod = (this.products || []).find(p => 
      p.barcode === code || p.sku === code || p._id === code || p.id === code || (p.barcode && p.barcode.toLowerCase() === lowerCode)
    );
    if (prod) {
      matchedItem = {
        id: prod._id || prod.id,
        name: prod.name || 'Unnamed Product',
        category: prod.category || 'Product',
        price: Number(prod.price) || 0,
        stock: Number(prod.stock) || 0,
        barcode: prod.barcode || prod.sku || code,
        type: 'product',
        badgeText: 'Product',
        icon: '📦',
        raw: prod
      };
    }

    // Check Display Stock
    if (!matchedItem) {
      const disp = (this.displayStock || []).find(d => 
        d.barcode === code || d.stockItemId === code || d.displayId === code || d._id === code || (d.barcode && d.barcode.toLowerCase() === lowerCode)
      );
      if (disp) {
        matchedItem = {
          id: disp.stockItemId || disp._id,
          name: disp.displayName || disp.itemName || 'Unnamed Display',
          category: disp.displayId || 'Display Stock',
          price: Number(disp.sellingPrice || disp.price) || 0,
          stock: Number(disp.stock) || 0,
          barcode: disp.barcode || disp.stockItemId || code,
          type: 'display',
          badgeText: 'Display Stock',
          icon: '📱',
          raw: disp
        };
      }
    }

    // Check Spare Parts
    if (!matchedItem) {
      const spare = (this.sparePartsStock || []).find(s => 
        s.barcode === code || s.partItemId === code || s.partId === code || s._id === code || (s.barcode && s.barcode.toLowerCase() === lowerCode)
      );
      if (spare) {
        matchedItem = {
          id: spare.partItemId || spare._id,
          name: spare.partName || spare.itemName || 'Unnamed Spare Part',
          category: spare.partId || 'Spare Part',
          price: Number(spare.customerPrice || spare.sellingPrice || spare.price) || 0,
          stock: Number(spare.stock) || 0,
          barcode: spare.barcode || spare.partItemId || code,
          type: 'spare',
          badgeText: 'Spare Part',
          icon: '🔩',
          raw: spare
        };
      }
    }

    // Check Stock Entries
    if (!matchedItem && this.stockEntries) {
      const entry = (this.stockEntries || []).find(e => 
        e.barcode === code || e.imei1 === code || e.imei2 === code || e.serialNumber === code || e._id === code
      );
      if (entry) {
        matchedItem = {
          id: entry._id || entry.stockId,
          name: entry.itemName || entry.modelName || 'Stock Entry Item',
          category: entry.category || 'Stock Entry',
          price: Number(entry.sellingPrice || entry.price) || 0,
          stock: Number(entry.quantity || 1),
          barcode: entry.barcode || entry.imei1 || entry.serialNumber || code,
          type: 'stock',
          badgeText: 'Stock Entry',
          icon: '📥',
          raw: entry
        };
      }
    }

    if (matchedItem) {
      // If tracking form is currently visible, pre-populate device name
      const devInput = document.getElementById('newTrackingDevice');
      if (devInput && !devInput.value.trim()) {
        devInput.value = matchedItem.name;
      }

      // If purchase bills search input is focused or active, populate it
      const purchaseSearch = document.getElementById('purchaseBillSearchInput');
      if (purchaseSearch && this.currentPage === 'admin-purchase-bills') {
        purchaseSearch.value = matchedItem.barcode || matchedItem.name;
        this.searchPurchaseBills(purchaseSearch.value);
      }

      this.showInventoryBarcodeLookupResult(matchedItem, code);
      return;
    }

    // 3. Not found anywhere
    const scanInput = document.getElementById('globalScanInput') || document.getElementById('barcodeScanInput');
    if (scanInput) {
      scanInput.style.border = '2px solid #dc2626';
      scanInput.placeholder = `❌ Not found: "${code}" — check barcode / QR ID`;
      setTimeout(() => {
        if (scanInput) {
          scanInput.style.border = '1px solid #10b981';
          scanInput.placeholder = 'Scan barcode here to lookup tracking or inventory...';
        }
      }, 2500);
    }
  }

  showInventoryBarcodeLookupResult(matchedItem, code) {
    const existing = document.getElementById('barcodeLookupModal');
    if (existing) existing.remove();

    this._lastScannedItem = matchedItem;

    const modal = `
      <div id="barcodeLookupModal" onclick="if(event.target===this)this.remove()"
        style="position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;">
        <div style="background:#1e293b;border:2px solid #334155;border-radius:14px;padding:24px;max-width:480px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
          
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:26px;">${matchedItem.icon || '📦'}</span>
              <div>
                <h2 style="font-size:17px;font-weight:800;color:#f8fafc;margin:0;">${matchedItem.name}</h2>
                <span style="background:rgba(14,165,233,0.2);color:#38bdf8;border:1px solid #38bdf8;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;">${matchedItem.badgeText}</span>
              </div>
            </div>
            <button onclick="document.getElementById('barcodeLookupModal').remove()"
              style="background:rgba(244,63,94,0.15);color:#f87171;border:1px solid #f87171;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:13px;">✕ Close</button>
          </div>

          <div style="display:grid;gap:8px;font-size:13px;background:rgba(15,23,42,0.8);padding:14px;border-radius:10px;border:1px solid #334155;margin-bottom:18px;">
            <div style="display:flex;justify-content:space-between;"><span style="color:#94a3b8;font-weight:700;">Barcode / SKU:</span><span style="color:#f8fafc;font-weight:900;font-family:monospace;">${matchedItem.barcode || code}</span></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:#94a3b8;font-weight:700;">Category:</span><span style="color:#f8fafc;font-weight:800;">${matchedItem.category || 'Standard'}</span></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:#94a3b8;font-weight:700;">Selling Price:</span><span style="color:#4ade80;font-weight:900;font-size:15px;">₹${Number(matchedItem.price || 0).toLocaleString('en-IN')}</span></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:#94a3b8;font-weight:700;">Stock Available:</span><span style="color:${matchedItem.stock > 0 ? '#38bdf8' : '#f87171'};font-weight:900;">${matchedItem.stock} units</span></div>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px;">
            <button onclick="app.addReplacedComponentFromScan(app._lastScannedItem); document.getElementById('barcodeLookupModal').remove();"
              style="padding:10px;background:#0284c7;color:#fff;border:none;border-radius:8px;font-weight:800;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
              🔧 Add to Replaced Components (Tracking Form)
            </button>
            <button onclick="app.addToPOSCart('${matchedItem.id}', '${matchedItem.type}'); document.getElementById('barcodeLookupModal').remove();"
              style="padding:10px;background:#059669;color:#fff;border:none;border-radius:8px;font-weight:800;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
              🛍️ Add to POS Cart
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modal);
  }

  addReplacedComponentFromScan(matchedItem) {
    if (!matchedItem) return;
    if (!this.tempFormReplacedItems) this.tempFormReplacedItems = [];

    const existing = this.tempFormReplacedItems.find(i => i.id === matchedItem.id && i.type === matchedItem.type);
    if (existing) {
      existing.qty = (Number(existing.qty) || 1) + 1;
    } else {
      this.tempFormReplacedItems.push({
        id: matchedItem.id,
        name: matchedItem.name,
        type: matchedItem.type,
        price: Number(matchedItem.price) || 0,
        qty: 1
      });
    }

    const devInput = document.getElementById('newTrackingDevice');
    if (devInput && !devInput.value.trim()) {
      devInput.value = matchedItem.name;
    }

    this.renderReplacedItemsList();
    alert(`✅ Added "${matchedItem.name}" to Replaced Components list!`);
  }

  showTrackingLookupResult(t) {
    if (!t) return;
    const existing = document.getElementById('barcodeLookupModal');
    if (existing) existing.remove();

    const statusColors = {
      'Received':'#3b82f6','Diagnostics':'#8b5cf6','Return':'#ef4444',
      'In Progress':'#f59e0b','Parts Ordered':'#ec4899','Quality Check':'#06b6d4',
      'Ready for Pickup':'#f59e0b','Completed':'#10b981','Delivered':'#2563eb'
    };
    const sc = statusColors[t.status] || '#10b981';
    const bcModalId = `bc_modal_${t.qrId.replace(/[^a-zA-Z0-9]/g,'_')}`;

    const modal = `
      <div id="barcodeLookupModal" onclick="if(event.target===this)this.remove()"
        style="position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;">
        <div style="background:#1e293b;border:2px solid #334155;border-radius:14px;padding:24px;max-width:500px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.5);max-height:90vh;overflow-y:auto;">

          <!-- Header -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <h2 style="font-size:18px;font-weight:800;color:#f8fafc;">📷 Tracking Details</h2>
            <button onclick="document.getElementById('barcodeLookupModal').remove()"
              style="background:rgba(244,63,94,0.15);color:#f87171;border:1px solid #f87171;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:13px;">✕ Close</button>
          </div>

          <!-- Barcode display -->
          <div style="background:#fff;border-radius:8px;padding:8px;text-align:center;margin-bottom:16px;">
            <svg id="${bcModalId}" style="max-width:100%;"></svg>
          </div>

          <!-- Status + QR -->
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
            <span style="font-size:20px;font-weight:900;color:#f8fafc;font-family:monospace;">${t.qrId}</span>
            <span style="padding:5px 14px;border-radius:20px;font-size:13px;font-weight:700;background:rgba(16,185,129,0.15);color:${sc};border:1px solid ${sc}40;">${t.status}</span>
            ${t.status === 'Return' ? `<span style="background:#fef2f2;color:#dc2626;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:700;border:1px solid #fca5a5;">↩️ RETURNED</span>` : ''}
          </div>

          <!-- All Details -->
          <div style="display:grid;gap:0;font-size:13px;border:1px solid #334155;border-radius:8px;overflow:hidden;">
            ${[
              ['👤 Customer', t.customerName],
              ['📞 Phone', t.contact || '—'],
              ['📱 Device', t.productName || t.deviceModel || '—'],
              ['📱 IMS/IMEI', t.imeiNumber || t.imsNumber || '—'],
              ['🔑 Password', t.qrPassword || '—'],
              ['⏱ Est. Days', t.estimatedDays == 0 ? 'Same Day' : (t.estimatedDays ? t.estimatedDays + ' days' : '—')],
              ['💰 Amount', t.amount ? '₹' + Number(t.amount).toLocaleString('en-IN') : '—'],
              ['📅 Received', t.createdAt || '—'],
              ['✅ Completed', t.completedAt || '—'],
              ['🚀 Delivered', t.deliveredAt || '—'],
              ['↩️ Returned', t.returnedAt  || '—'],
              ['🕒 Last Update', t.lastUpdated || '—'],
            ].filter(([,v]) => v !== '—' || ['👤 Customer','📱 Device','💰 Amount','📅 Received'].some(l => l === [].toString())).map(([label, value], i) => `
              <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:9px 14px;background:${i%2===0?'rgba(30,41,59,0.9)':'rgba(51,65,85,0.6)'};border-bottom:1px solid #334155;">
                <span style="color:#cbd5e1;font-size:12.5px;font-weight:800;min-width:110px;">${label}</span>
                <span style="font-weight:900;color:#ffffff;text-align:right;max-width:55%;word-break:break-word;">${value}</span>
              </div>`).join('')}
            <!-- Issue — full display -->
            <div style="padding:10px 14px;background:rgba(51,65,85,0.6);">
              <div style="color:#fde047;font-size:13px;font-weight:900;margin-bottom:4px;">🔧 Issue Description</div>
              <div style="color:#ffffff;font-size:13.5px;font-weight:800;line-height:1.5;">${t.issue || '—'}</div>
            </div>
          </div>

          <!-- Action buttons -->
          <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;">
            <button onclick="app.printTrackingLabel('${t.qrId}','${(t.customerName||'').replace(/'/g,"\\'")}','${((t.productName||t.deviceModel||'')).replace(/'/g,"\\'")}');document.getElementById('barcodeLookupModal').remove();"
              style="flex:1;min-width:100px;background:#1e293b;color:#fff;border:1px solid #475569;border-radius:8px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;">
              🏷️ Print Label
            </button>
            <button onclick="app.printTSCLabel('${t.qrId}','${(t.customerName||'').replace(/'/g,"\\'")}','${((t.productName||t.deviceModel||'')).replace(/'/g,"\\'")}');document.getElementById('barcodeLookupModal').remove();"
              style="flex:1;min-width:100px;background:#ea580c;color:#fff;border:none;border-radius:8px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;">
              🖶 TSC Printer
            </button>
            <button onclick="app.printTrackingCard('${t.qrId}');document.getElementById('barcodeLookupModal').remove();"
              style="flex:1;min-width:100px;background:#1d4ed8;color:#fff;border:none;border-radius:8px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;">
              🖨️ Full Receipt
            </button>
            <button onclick="app.showEditTrackingModal('${t.qrId}');document.getElementById('barcodeLookupModal').remove();"
              style="flex:1;min-width:100px;background:#f59e0b;color:#fff;border:none;border-radius:8px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;">
              ✏️ Edit
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modal);

    // Render barcode inside modal
    setTimeout(() => {
      const el = document.getElementById(bcModalId);
      if (el && typeof JsBarcode !== 'undefined') {
        try {
          JsBarcode(el, t.qrId, {
            format:'CODE128', width:2.2, height:50,
            displayValue:true, fontSize:14, margin:6,
            background:'#ffffff', lineColor:'#000000', fontOptions:'bold'
          });
        } catch(e) {}
      }
    }, 50);

    // Clear scan input
    const scanInput = document.getElementById('barcodeScanInput');
    if (scanInput) scanInput.value = '';
  }

  printTrackingLabel(qrId, customerName, deviceModel) {
    const t = this.trackingData.find(tr => tr.qrId === qrId) || {
      qrId, customerName: customerName || '', productName: deviceModel || '', contact: '', status: 'Received', amount: 0
    };

    const barVal = (t.qrId || '').trim();
    const cust   = (t.customerName || '').substring(0, 14).toUpperCase();
    const dev    = (t.productName || t.deviceModel || '').substring(0, 16);

    const win = window.open('', '_blank', 'width=920,height=480');
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>TSC Label - ${barVal}</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }

    /* ── Screen layout ── */
    body {
      font-family: Arial, Helvetica, sans-serif;
      background: #f1f5f9;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 24px 16px;
      min-height: 100vh;
    }
    h2 { font-size: 17px; font-weight: 800; color: #1e293b; margin-bottom: 4px; }
    .hint { font-size: 12px; color: #64748b; margin-bottom: 18px; text-align:center; line-height:1.5; }
    .hint strong { color: #1e293b; }

    /* ── Label strip container ── */
    .scale-wrap {
      zoom: 2;
      margin-top: 12px;
      margin-bottom: 16px;
      flex-shrink: 0;
      max-width: 100%;
      overflow: hidden;
    }
    .strip {
      display: flex;
      flex-direction: row;
      width: 101.5mm;
      height: 25mm;
      background: #fff;
      border: 0.3mm solid #ccc;
    }
    .label {
      width: 33.83mm;
      height: 25mm;
      border-right: 0.2mm dashed #ccc;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 1.2mm 0.5mm 0.5mm 0.5mm;
      overflow: hidden;
      gap: 0;
    }
    .label:last-child { border-right: none; }
    .shop {
      font-size: 7pt;
      font-weight: 900;
      text-align: center;
      color: #000;
      line-height: 1.1;
      letter-spacing: 0.2px;
      white-space: nowrap;
      margin-bottom: 0.3mm;
    }
    svg.bc, canvas.bc {
      display: block;
      max-width: 30mm;
      width: 30mm;
      height: 9.5mm !important;
      margin: 0 auto;
      object-fit: contain;
    }
    .barnum {
      font-size: 6.5pt;
      font-weight: 700;
      color: #000;
      letter-spacing: 0.8px;
      text-align: center;
      margin-top: 0.3mm;
      margin-bottom: 0.3mm;
      line-height: 1.1;
    }
    .device {
      font-size: 6.5pt;
      font-weight: 800;
      color: #000;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 31mm;
      text-transform: uppercase;
      letter-spacing: 0.2px;
      line-height: 1.1;
      margin-top: 0.2mm;
    }
    .custname {
      font-size: 6pt;
      font-weight: 600;
      color: #333;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 31mm;
      text-transform: uppercase;
      letter-spacing: 0.2px;
      margin-top: 0.2mm;
      line-height: 1.1;
    }

    /* ── Print button ── */
    .print-btn {
      padding: 12px 44px;
      background: #1e293b;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0,0,0,0.18);
      margin-top: 8px;
    }
    .print-btn:hover { background: #0f172a; }
    .steps {
      margin-top: 12px;
      font-size: 11px;
      color: #64748b;
      text-align: center;
      line-height: 1.8;
    }
    .steps span { color: #1e293b; font-weight: 700; }

    /* ── Print mode: only the strip, exact paper size ── */
    @media print {
      @page {
        size: 25mm 101.5mm portrait;
        margin: 0;
      }
      html,
      body {
        width: 25mm;
        height: 101.5mm;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: #fff;
      }
      body * {
        visibility: hidden;
      }
      .print-strip,
      .print-strip * {
        visibility: visible;
      }
      .print-strip {
        display: flex !important;
        flex-direction: column !important;
        width: 25mm !important;
        height: 101.5mm !important;
        position: absolute;
        top: 0;
        left: 0;
      }
      .label {
        width: 25mm !important;
        height: 33.83mm !important;
        border-right: none !important;
        position: relative !important;
        overflow: hidden !important;
      }
      .label-inner {
        width: 33.83mm !important;
        height: 25mm !important;
        position: absolute !important;
        top: 4.415mm !important;
        left: -4.415mm !important;
        transform: rotate(90deg); /* If sideways, try rotate(-90deg) */
        transform-origin: center !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: flex-start !important;
        padding: 1.2mm 0.5mm 0.5mm 0.5mm !important;
        box-sizing: border-box !important;
      }
      h2, .hint, .print-btn, .steps, .scale-wrap {
        display: none !important;
      }
    }
  </style>
</head>
<body>

  <h2>🏷️ TSC Label Preview — ${barVal}</h2>
  <div class="hint">
    Paper: <strong>101.5 mm × 25 mm</strong> &nbsp;|&nbsp; 3 labels per strip<br>
    Select your <strong>TSC / Zenpert</strong> printer in the print dialog
  </div>

  <!-- Screen preview (scaled up 3.5×) -->
  <div class="scale-wrap">
    <div class="strip">
      <div class="label">
        <div class="shop">JIVI MOBILES</div>
        <canvas class="bc" id="bc1"></canvas>
        <div class="barnum">${barVal}</div>
        <div class="device">${dev}</div>
      </div>
      <div class="label">
        <div class="shop">JIVI MOBILES</div>
        <canvas class="bc" id="bc2"></canvas>
        <div class="barnum">${barVal}</div>
        <div class="device">${dev}</div>
      </div>
      <div class="label">
        <div class="shop">JIVI MOBILES</div>
        <canvas class="bc" id="bc3"></canvas>
        <div class="barnum">${barVal}</div>
        <div class="device">${dev}</div>
      </div>
    </div>
  </div>

  <button class="print-btn" onclick="window.print()">🖨️ Print to TSC Printer</button>

  <div class="steps">
    In the print dialog: &nbsp;
    ① Select <span>TSC / Zenpert</span> printer &nbsp;
    ② Paper size → <span>LABEL25</span> &nbsp;
    ③ Layout → <span>Portrait</span> &nbsp;
    ④ Margins → <span>None</span> &nbsp;
    ⑤ Click <span>Print</span>
  </div>

  <!-- Hidden print-only strip (exact size, no transform) -->
  <div class="print-strip" style="display:none;">
    <div class="label">
      <div class="label-inner">
        <div class="shop">JIVI MOBILES</div>
        <canvas class="bc" id="bcp1"></canvas>
        <div class="barnum">${barVal}</div>
        <div class="device">${dev}</div>
      </div>
    </div>
    <div class="label">
      <div class="label-inner">
        <div class="shop">JIVI MOBILES</div>
        <canvas class="bc" id="bcp2"></canvas>
        <div class="barnum">${barVal}</div>
        <div class="device">${dev}</div>
      </div>
    </div>
    <div class="label">
      <div class="label-inner">
        <div class="shop">JIVI MOBILES</div>
        <canvas class="bc" id="bcp3"></canvas>
        <div class="barnum">${barVal}</div>
        <div class="device">${dev}</div>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      if (typeof JsBarcode === 'undefined') {
        setTimeout(renderBarcodes, 800);
      } else {
        renderBarcodes();
      }
    };
    function renderBarcodes() {
      try {
        var opts = {
          format: 'CODE128',
          width: 1.5,
          height: 22,
          displayValue: false,
          margin: 0,
          background: '#ffffff',
          lineColor: '#000000'
        };
        ['bc1','bc2','bc3','bcp1','bcp2','bcp3'].forEach(function(id){
          var canvas = document.getElementById(id);
          if (!canvas) return;
          JsBarcode(canvas, '${barVal}', opts);
          canvas.style.width  = '30mm';
          canvas.style.height = '9.5mm';
        });
      } catch(e) { console.error('Barcode error:', e); }
    }
  <\/script>
</body>
</html>`);
    win.document.close();
    setTimeout(() => { try { win.focus(); } catch(e) {} }, 200);
  }

  // ── Send ZPL command to Zebra-compatible thermal label printer ───────────
  async printTSCLabel(qrId, customerName, deviceModel) {
    const t = this.trackingData.find(tr => tr.qrId === qrId) || {
      qrId, customerName: customerName || '', productName: deviceModel || ''
    };

    const barVal = (t.qrId || '').replace(/[^A-Za-z0-9]/g, '');
    const cust   = (t.customerName || customerName || '').substring(0, 14).toUpperCase().replace(/"/g, '');
    const dev    = (t.productName || t.deviceModel || deviceModel || '').substring(0, 14).toUpperCase().replace(/"/g, '');

    // TSPL command for Zenpert 4T520 / TSC-compatible printer
    const tspl = [
      'SIZE 101.5 mm, 25 mm',
      'GAP 2 mm, 0 mm',
      'DIRECTION 0,0',
      'REFERENCE 0,4',
      'OFFSET 0 mm',
      'SET PEEL OFF',
      'SET CUTTER OFF',
      'SET PARTIAL_CUTTER OFF',
      'SET TEAR OFF',
      'CLS',
      `BARCODE 225,114,"128M",30,0,180,2,4,"!104${barVal}"`,
      'CODEPAGE 1252',
      `TEXT 176,78,"0",180,8,8,"${barVal}"`,
      `TEXT 214,160,"0",180,10,10,"JIVI MOBILES"`,
      `TEXT 260,50,"0",180,8,8,"${dev}"`,
      `TEXT 261,50,"0",180,8,8,"${dev}"`,
      'BAR 96,12, 78, 2',
      'BAR 99,11, 1, 2',
      `BARCODE 496,114,"128M",30,0,180,2,4,"!104${barVal}"`,
      `TEXT 447,78,"0",180,8,8,"${barVal}"`,
      `TEXT 485,160,"0",180,10,10,"JIVI MOBILES"`,
      `TEXT 531,50,"0",180,8,8,"${dev}"`,
      `TEXT 532,50,"0",180,8,8,"${dev}"`,
      'BAR 367,12, 78, 2',
      'BAR 370,11, 1, 2',
      `BARCODE 766,114,"128M",30,0,180,2,4,"!104${barVal}"`,
      `TEXT 717,78,"0",180,8,8,"${barVal}"`,
      `TEXT 755,160,"0",180,10,10,"JIVI MOBILES"`,
      `TEXT 801,50,"0",180,8,8,"${dev}"`,
      `TEXT 802,50,"0",180,8,8,"${dev}"`,
      'BAR 637,12, 78, 2',
      'BAR 640,11, 1, 2',
      'PRINT 1,1'
    ].join('\r\n');

    // Try local print agent first (port 9101), then fall back to download
    try {
      const response = await fetch('http://localhost:9101/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tspl })
      });
      const result = await response.json();
      if (result.success) {
        const btn = document.activeElement;
        if (btn && btn.textContent) {
          const orig = btn.textContent;
          btn.textContent = '✅ Printed!';
          btn.style.background = '#10b981';
          setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 2000);
        }
        return;
      }
      throw new Error(result.error || 'Agent print failed');
    } catch (agentErr) {
      // Agent not running — try cloud server
      try {
        const response = await fetch(`${this.API_URL}/print-label`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tspl })
        });
        const result = await response.json();
        if (result.success) return;
        throw new Error(result.error);
      } catch (serverErr) {
        // Both failed — download as fallback
        const blob = new Blob([tspl], { type: 'application/octet-stream' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = `label-${barVal}.prn`; a.click();
        URL.revokeObjectURL(url);
        alert('⚠️ Print agent not running.\n\nFile downloaded: label-' + barVal + '.prn\n\nTo enable one-click printing:\n1. Run print-agent/start-agent.bat on this PC\n2. Keep it running in the background');
      }
    }
  }

  toggleTrackingForm() {
    const form = document.getElementById("trackingForm");
    if (!form) return;
    const isHidden = form.style.display === 'none';
    form.style.display = isHidden ? 'block' : 'none';
    if (isHidden) {
      this.tempTrackingPhotos = [];
      this.renderTrackingPhotoThumbnails('tempTrackingPhotos', 'newTrackingPhotosPreview');
      this.initSignatureCanvas('newTrackingSignatureCanvas');

      // Auto-generate next QR ID starting from 01518
      const nextId = this._generateNextQRId();
      const qrInput = document.getElementById('newTrackingQRId');
      if (qrInput) {
        qrInput.value = nextId;
        this._renderFormBarcode(nextId);
      }

      // Auto-fill Date In with today's date
      const dateInInput = document.getElementById('newTrackingDateIn');
      if (dateInInput) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm   = String(today.getMonth() + 1).padStart(2, '0');
        const dd   = String(today.getDate()).padStart(2, '0');
        dateInInput.value = `${yyyy}-${mm}-${dd}`;
      }

      // Show "Don't Get the SIM" reminder popup
      this._showSimReminder();
    }
  }

  _showSimReminder() {
    const existing = document.getElementById('simReminderPopup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'simReminderPopup';
    popup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 99999;
      background: #fff;
      border: 3px solid #dc2626;
      border-radius: 16px;
      padding: 32px 40px;
      text-align: center;
      box-shadow: 0 24px 80px rgba(0,0,0,0.5);
      min-width: 280px;
      animation: popIn 0.25s ease;
    `;
    popup.innerHTML = `
      <style>
        @keyframes popIn {
          from { transform: translate(-50%, -50%) scale(0.7); opacity: 0; }
          to   { transform: translate(-50%, -50%) scale(1);   opacity: 1; }
        }
      </style>
      <div style="font-size: 48px; margin-bottom: 12px;">⚠️</div>
      <div style="font-size: 22px; font-weight: 900; color: #dc2626; margin-bottom: 8px; letter-spacing: 0.5px;">
        DON'T GET THE SIM
      </div>
      <div style="font-size: 14px; color: #64748b; margin-bottom: 24px;">
        Please remember to remove the SIM card<br>before accepting the device.
      </div>
      <button onclick="document.getElementById('simReminderPopup').remove()"
        style="background: #dc2626; color: #fff; border: none; border-radius: 8px;
               padding: 12px 32px; font-size: 15px; font-weight: 700; cursor: pointer; width: 100%;">
        ✅ Got it
      </button>
    `;
    document.body.appendChild(popup);
  }

  _generateNextQRId() {
    const BASE = 1518;
    // Find the highest numeric suffix among existing IDs
    let max = BASE - 1;
    (this.trackingData || []).forEach(t => {
      const num = parseInt(t.qrId, 10);
      if (!isNaN(num) && num > max) max = num;
    });
    const next = max + 1;
    // Zero-pad to 5 digits minimum
    return String(next).padStart(5, '0');
  }

  _renderFormBarcode(value) {
    const canvas = document.getElementById('formBarcodeCanvas');
    if (!canvas) return;
    if (typeof JsBarcode === 'undefined') {
      setTimeout(() => this._renderFormBarcode(value), 300);
      return;
    }
    try {
      JsBarcode(canvas, value, {
        format: 'CODE128', width: 2, height: 40,
        displayValue: true, fontSize: 13, margin: 4,
        background: '#ffffff', lineColor: '#000000'
      });
      canvas.style.display = 'block';
      canvas.style.margin = '0 auto';
    } catch(e) { console.warn('Barcode render error:', e); }
  }

  handleTrackingSearch(value) {
    this.trackingSearch = value;
    // Clear existing timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    // Wait for user to stop typing before filtering
    this.searchTimeout = setTimeout(() => {
      this.renderTrackingListOnly();
    }, 500); // Increased to 500ms for smoother typing
  }

  async handleContactAutofill(phone, targetNameId, targetAddressId) {
    const trimmedPhone = phone.trim();
    if (trimmedPhone.length === 10) {
      try {
        const response = await fetch(`${this.API_URL}/customer/${encodeURIComponent(trimmedPhone)}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            const customerInput = document.getElementById(targetNameId);
            const addressInput = document.getElementById(targetAddressId);
            
            if (customerInput && !customerInput.value.trim()) {
              customerInput.value = result.customerName;
            }
            if (addressInput && !addressInput.value.trim()) {
              addressInput.value = result.address;
            }
          }
        }
      } catch (err) {
        console.error('Error fetching customer details for autofill:', err);
      }
    }
  }

  getContactSuggestions(query) {
    const term = query.trim();
    if (term.length < 4) return [];

    const suggestionsMap = new Map();
    const addIfMatches = (phone, name, address, source) => {
      if (!phone) return;
      const cleanPhone = phone.trim();
      if (cleanPhone.includes(term) && !suggestionsMap.has(cleanPhone)) {
        suggestionsMap.set(cleanPhone, {
          phone: cleanPhone,
          name: (name || '').trim(),
          address: (address || '').trim(),
          source: source
        });
      }
    };

    if (this.trackingData) {
      this.trackingData.forEach(t => addIfMatches(t.contact, t.customerName, t.address, 'Repair'));
    }
    if (this.salesRecords) {
      this.salesRecords.forEach(s => addIfMatches(s.phoneNumber, s.customerName, s.customerAddress, 'Sale'));
    }
    if (this.serviceRecords) {
      this.serviceRecords.forEach(s => addIfMatches(s.phoneNumber, s.customerName, s.customerAddress, 'Service'));
    }
    if (this.orders) {
      this.orders.forEach(o => {
        if (o.customer) {
          addIfMatches(o.customer.phone, o.customer.name, o.customer.address, 'Order');
        }
      });
    }

    return Array.from(suggestionsMap.values()).slice(0, 10);
  }

  showContactSuggestions(inputElement, targetNameId, targetAddressId) {
    const value = inputElement.value;
    let dropdown = document.getElementById('contactSuggestionsDropdown');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.id = 'contactSuggestionsDropdown';
      dropdown.style.cssText = 'display:none; position:absolute; background:#fff; border:1.5px solid #10b981; border-radius:8px; max-height:200px; overflow-y:auto; z-index:99999; box-shadow:0 6px 20px rgba(0,0,0,0.18);';
      document.body.appendChild(dropdown);
    }

    const matches = this.getContactSuggestions(value);
    if (matches.length === 0) {
      dropdown.style.display = 'none';
      return;
    }

    const rect = inputElement.getBoundingClientRect();
    dropdown.style.top = (rect.bottom + window.scrollY + 4) + 'px';
    dropdown.style.left = (rect.left + window.scrollX) + 'px';
    dropdown.style.width = rect.width + 'px';

    dropdown.innerHTML = matches.map(item => `
      <div onmousedown="event.preventDefault(); app.selectContactSuggestion('${item.phone}', '${item.name.replace(/'/g, "\\'")}', '${item.address.replace(/'/g, "\\'")}', '${inputElement.id}', '${targetNameId}', '${targetAddressId}');"
        style="padding:10px 14px; cursor:pointer; border-bottom:1px solid #f1f5f9; font-size:13px;"
        onmouseover="this.style.background='#f0fdf4'" onmouseout="this.style.background='#fff'">
        <div style="font-weight:700; color:#111827;">${item.phone}</div>
        <div style="font-size:11px; color:#4b5563; display:flex; justify-content:space-between; margin-top:2px;">
          <span>👤 ${item.name || 'No name'}</span>
          <span style="font-size:9px; background:#e0f2fe; color:#0369a1; padding:1px 4px; border-radius:4px;">${item.source}</span>
        </div>
        ${item.address ? `<div style="font-size:10px; color:#9ca3af; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">📍 ${item.address}</div>` : ''}
      </div>
    `).join('');

    dropdown.style.display = 'block';
  }

  selectContactSuggestion(phone, name, address, inputId, targetNameId, targetAddressId) {
    const contactInput = document.getElementById(inputId);
    const customerInput = document.getElementById(targetNameId);
    const addressInput = document.getElementById(targetAddressId);

    if (contactInput) contactInput.value = phone;
    if (customerInput) customerInput.value = name;
    if (addressInput) addressInput.value = address;

    const dropdown = document.getElementById('contactSuggestionsDropdown');
    if (dropdown) dropdown.style.display = 'none';
  }

  filterTracking(status) {
    this.trackingFilter = status;
    this.renderTrackingListOnly();
  }

  showProductSuggestions(value) {
    const dropdown = document.getElementById('sale_product_dropdown');
    if (!dropdown) return;
    const term = value.trim().toLowerCase();
    if (!term) { dropdown.style.display = 'none'; return; }

    const matches = this.products.filter(p =>
      p.name.toLowerCase().includes(term) ||
      (p.category && p.category.toLowerCase().includes(term))
    ).slice(0, 10);

    if (matches.length === 0) { dropdown.style.display = 'none'; return; }

    dropdown.innerHTML = matches.map(p => {
      // Use index reference to avoid quote-escaping issues with product names
      const idx = this.products.indexOf(p);
      const inStock = p.inStock !== false;
      return `
        <div onmousedown="event.preventDefault(); app.selectProductSuggestion(${idx});"
          style="padding:10px 14px; cursor:pointer; border-bottom:1px solid #fecaca; font-size:13px; ${!inStock ? 'opacity:0.5;' : ''}"
          onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='#fff'">
          <div style="font-weight:600; color:#111;">${p.name} ${!inStock ? '<span style="color:#dc2626;font-size:10px;">(Out of Stock)</span>' : ''}</div>
          <div style="font-size:11px; color:#6b7280;">
            ${p.category ? `<span style="background:#fee2e2;color:#dc2626;padding:1px 6px;border-radius:4px;margin-right:4px;">${p.category}</span>` : ''}
            ${p.price ? `<span style="color:#16a34a;font-weight:600;">₹${Number(p.price).toLocaleString('en-IN')}</span>` : ''}
            ${p.originalPrice && p.originalPrice > p.price ? `<span style="color:#9ca3af;text-decoration:line-through;margin-left:4px;font-size:10px;">₹${Number(p.originalPrice).toLocaleString('en-IN')}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
    dropdown.style.display = 'block';
  }

  selectProductSuggestion(productIndex) {
    const p = this.products[productIndex];
    if (!p) return;

    const dropdown = document.getElementById('sale_product_dropdown');
    if (dropdown) dropdown.style.display = 'none';

    // Fill product name
    const nameInput = document.getElementById('sale_productName');
    if (nameInput) nameInput.value = p.name;

    // Fill sale amount from product price
    const amountInput = document.getElementById('sale_saleAmount');
    if (amountInput && p.price) {
      amountInput.value = p.price;
    }

    // Fill category/type field
    const categoryInput = document.getElementById('sale_productCategory');
    if (categoryInput) categoryInput.value = p.category || '';

    // Show original price as reference
    const origPriceEl = document.getElementById('sale_originalPrice_ref');
    if (origPriceEl) {
      if (p.originalPrice && p.originalPrice > p.price) {
        origPriceEl.textContent = `MRP: ₹${Number(p.originalPrice).toLocaleString('en-IN')}`;
        origPriceEl.style.display = 'inline';
      } else {
        origPriceEl.style.display = 'none';
      }
    }

    // Auto-set warranty if product has a badge hint
    const warrantySelect = document.getElementById('sale_warrantyPeriod');
    if (warrantySelect && p.badge) {
      const badge = p.badge.toLowerCase();
      if (badge.includes('1 year') || badge.includes('1year')) warrantySelect.value = '1 Year';
      else if (badge.includes('2 year') || badge.includes('2year')) warrantySelect.value = '2 Years';
      else if (badge.includes('6 month')) warrantySelect.value = '6 Months';
      else if (badge.includes('3 month')) warrantySelect.value = '3 Months';
    }

    this.updateBillPreview();
  }

  // ===== DEBOUNCED SEARCH METHODS (no full page re-render) =====

  searchProducts(value) {
    // Store value and update only the products grid
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => {
      const term = value.toLowerCase();
      const filtered = this.products.filter(p =>
        p.name.toLowerCase().includes(term) || p.category.toLowerCase().includes(term)
      );
      const grid = document.querySelector('.admin-products-grid');
      if (grid) {
        grid.innerHTML = filtered.length > 0
          ? filtered.map(p => this.renderAdminProductCard(p)).join('')
          : '<div style="grid-column:1/-1;text-align:center;padding:48px;color:#94a3b8;">No products found</div>';
      }
      const counter = document.querySelector('#adminSearch + span');
      if (counter) counter.textContent = `Total: ${filtered.length} products`;
    }, 300);
  }

  searchSales(value) {
    if (this._salesTimer) clearTimeout(this._salesTimer);
    this.salesSearch = value;
    this._salesTimer = setTimeout(() => {
      const term = value.toLowerCase();
      const filtered = this.salesRecords.filter(s =>
        s.customerName?.toLowerCase().includes(term) ||
        s.phoneNumber?.includes(term) ||
        s.productName?.toLowerCase().includes(term) ||
        s.customerAddress?.toLowerCase().includes(term)
      );
      const grid = document.querySelector('.sales-records-grid');
      const counter = document.querySelector('.sales-counter');
      if (counter) counter.textContent = `${filtered.length} records`;
      if (!grid) return;
      if (filtered.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:#374151;font-size:16px;"><div style="font-size:48px;margin-bottom:16px;">🛍️</div><p>No sales records found.</p></div>';
        return;
      }
      grid.innerHTML = filtered.map(sale => {
        const amount = Number(sale.saleAmount) || 0;
        const discount = Number(sale.discount) || 0;
        const netAmount = amount - discount;
        return `
          <div style="background: rgba(255,255,255,0.95); border-radius: 12px; padding: 16px; border: 2px solid #fecaca; position: relative;">
            <div style="margin-bottom: 12px;">
              <div style="font-size: 16px; font-weight: 700; color: #000;">${sale.customerName}</div>
              <div style="font-size: 13px; color: #dc2626; font-weight: 600;">📞 ${sale.phoneNumber}</div>
              ${sale.customerAddress ? `<div style="font-size: 12px; color: #6b7280;">📍 ${sale.customerAddress}</div>` : ''}
            </div>
            <!-- Action buttons — 2×2 grid -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:12px;">
              <button onclick="app.showEditSaleModal('${sale.saleId}')" style="background:#16a34a; border:none; border-radius:8px; padding:7px 10px; cursor:pointer; color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:4px;" title="Edit">✏️ Edit</button>
              <button onclick="app.printBill('${sale.saleId}')" style="background:#1d4ed8; border:none; border-radius:8px; padding:7px 10px; cursor:pointer; color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:4px;" title="Print Receipt">🧾 Print</button>
              <button onclick="app.shareSaleWhatsApp('${sale.saleId}')" style="background:#25d366; border:none; border-radius:8px; padding:7px 10px; cursor:pointer; color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:4px;" title="Share on WhatsApp">💬 WhatsApp</button>
              <button onclick="app.deleteSaleRecord('${sale.saleId}')" style="background:#dc2626; border:none; border-radius:8px; padding:7px 10px; cursor:pointer; color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:4px;" title="Delete">🗑️ Delete</button>
            </div>
            <div style="border-top: 1px solid #fecaca; padding-top: 10px; display: flex; flex-direction: column; gap: 6px;">
              <div style="font-size: 13px; color: #000;"><span style="color: #6b7280;">📱 Product:</span> <strong>${sale.productName}</strong></div>
              <div style="font-size: 13px; color: #000;"><span style="color: #6b7280;">📅 Date:</span> ${sale.purchaseDate}</div>
              ${amount ? `<div style="font-size: 13px; color: #374151;">Price: ₹${amount.toLocaleString()}${discount ? ` &nbsp;|&nbsp; Discount: ₹${discount.toLocaleString()}` : ''}</div>` : ''}
              ${amount ? `<div style="font-size: 14px; font-weight: 700; color: #16a34a;">💰 Net: ₹${netAmount.toLocaleString()}</div>` : ''}
              ${sale.warrantyPeriod ? `<div style="font-size: 12px; background: #dcfce7; color: #16a34a; padding: 3px 8px; border-radius: 20px; display: inline-block; font-weight: 600;">🛡️ Warranty: ${sale.warrantyPeriod}</div>` : ''}
              ${sale.notes ? `<div style="font-size: 12px; color: #6b7280; font-style: italic;">${sale.notes}</div>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }, 300);
  }

  searchStock(value) {
    if (this._stockTimer) clearTimeout(this._stockTimer);
    this.stockSearch = value;

    // Get or create a body-level dropdown (floats above everything)
    let dropdown = document.getElementById('stockSearchDropdown');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.id = 'stockSearchDropdown';
      dropdown.style.cssText = 'display:none; position:fixed; background:#fff; border:2px solid #dc2626; border-radius:8px; max-height:200px; overflow-y:auto; z-index:99999; box-shadow:0 6px 20px rgba(0,0,0,0.18); min-width:280px;';
      document.body.appendChild(dropdown);
    }

    // Position it under the input
    const input = document.getElementById('stockSearchInput');
    if (input) {
      const rect = input.getBoundingClientRect();
      dropdown.style.top  = (rect.bottom + window.scrollY + 4) + 'px';
      dropdown.style.left = rect.left + 'px';
      dropdown.style.width = rect.width + 'px';
    }

    // Hide if empty
    if (!value.trim()) {
      dropdown.style.display = 'none';
      return;
    }

    this._stockTimer = setTimeout(() => {
      const term = (this.stockSearch || '').toLowerCase();
      const matched = (this.displayStock || []).filter(d =>
        d.displayName?.toLowerCase().includes(term) ||
        d.displayId?.toLowerCase().includes(term)
      );
      matched.sort((a, b) => {
        const nameA = (a.displayName || '').trim().toLowerCase();
        const nameB = (b.displayName || '').trim().toLowerCase();
        return nameA.localeCompare(nameB);
      });

      if (matched.length === 0) {
        dropdown.innerHTML = `<div style="padding:12px; text-align:center; color:#9ca3af; font-size:12px;">No items found</div>`;
      } else {
        dropdown.innerHTML = matched.map(item => {
          const stock = Number(item.stock) || 0;
          const stockColor = stock === 0 ? '#dc2626' : stock <= 3 ? '#d97706' : '#16a34a';
          const stockLabel = stock === 0 ? '❌ Out' : stock <= 3 ? `⚠️ ${stock} left` : `✅ ${stock}`;
          return `
            <div style="padding:8px 12px; border-bottom:1px solid #f1f5f9; cursor:pointer; display:flex; justify-content:space-between; align-items:center; background:#fff;"
              onmouseover="this.style.background='#f0f9ff'" onmouseout="this.style.background='#fff'"
              onmousedown="event.preventDefault(); document.getElementById('stockSearchInput').value=''; document.getElementById('stockSearchDropdown').style.display='none'; app.stockSearch=''; app.scrollToStockItem('${item.stockItemId}')">
              <div>
                <div style="font-weight:700; color:#111827; font-size:13px;">${item.displayName}</div>
                <div style="font-size:11px; color:#6b7280; margin-top:1px;">${item.displayId}${item.price ? ' · ₹' + Number(item.price).toLocaleString('en-IN') : ''}</div>
              </div>
              <span style="font-size:11px; font-weight:700; color:${stockColor}; white-space:nowrap; margin-left:12px; padding:2px 8px; border-radius:12px; background:${stockColor}18;">${stockLabel}</span>
            </div>
          `;
        }).join('');
      }

      dropdown.style.display = 'block';
    }, 150);
  }

  scrollToStockItem(stockItemId) {
    // Highlight the row in the table
    const rows = document.querySelectorAll('.stock-item-row');
    rows.forEach(row => row.style.background = '');
    const target = document.querySelector(`.stock-item-row[data-id="${stockItemId}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.style.background = '#fef9c3';
      setTimeout(() => { target.style.background = ''; }, 2000);
    }
  }

  searchServices(value) {
    if (this._serviceTimer) clearTimeout(this._serviceTimer);
    this.serviceSearch = value;
    this._serviceTimer = setTimeout(() => {
      const term = value.toLowerCase();
      const filtered = (this.serviceRecords || []).filter(s =>
        s.customerName?.toLowerCase().includes(term) ||
        s.phoneNumber?.includes(term) ||
        s.serviceDetails?.toLowerCase().includes(term) ||
        s.customerAddress?.toLowerCase().includes(term)
      );
      const tbody = document.querySelector('.services-table-body');
      if (tbody) {
        tbody.innerHTML = filtered.length === 0
          ? '<tr><td colspan="9" style="text-align:center;padding:40px;color:#94a3b8;">No records found</td></tr>'
          : filtered.map((s, i) => this._renderServiceRow(s, i)).join('');
      }
      const counter = document.querySelector('.services-counter');
      if (counter) counter.textContent = `${filtered.length} records`;
    }, 300);
  }

  // Render only the tracking list without re-rendering the entire page
  renderTrackingListOnly() {
    const trackingListContainer = document.querySelector('.tracking-list');
    if (trackingListContainer) {
      const parent = trackingListContainer.parentElement;
      const newContent = this.renderTrackingList();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = newContent;
      const newTrackingList = tempDiv.firstElementChild;
      
      // Preserve the search input value and focus
      const oldInput = trackingListContainer.querySelector('#trackingSearchInput');
      const hadFocus = oldInput && document.activeElement === oldInput;
      const cursorPos = oldInput ? oldInput.selectionStart : 0;
      
      parent.replaceChild(newTrackingList, trackingListContainer);
      
      // Restore focus and cursor position
      if (hadFocus) {
        const newInput = document.getElementById('trackingSearchInput');
        if (newInput) {
          newInput.focus();
          newInput.setSelectionRange(cursorPos, cursorPos);
        }
      }
    }
  }

  getStatusEmoji(status) {
    const emojiMap = {
      'Received':         '📥',
      'Diagnostics':      '🔍',
      'Return':           '↩️',
      'In Progress':      '🔧',
      'Parts Ordered':    '📦',
      'Quality Check':    '✅',
      'Ready for Pickup': '📢',
      'Completed':        '🎉',
      'Delivered':        '🚚'
    }
    return emojiMap[status] || '📱'
  }

  // Order Management Methods
  async updateOrderStatus(orderId) {
    const order = this.orders.find(o => o.id === orderId || o.orderId === orderId);
    if (!order) return;

    const newStatus = prompt(
      "Enter new order status:\n\nPending\nProcessing\nShipped\nDelivered\nCancelled",
      order.status
    );

    if (newStatus) {
      const validStatuses = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];
      if (validStatuses.includes(newStatus)) {
        order.status = newStatus;
        this.renderPage("admin-orders");
        alert(`✅ Order status updated to: ${newStatus}`);
      } else {
        alert("Invalid status. Please use one of the suggested statuses.");
      }
    }
  }

  async deleteOrder(orderId) {
    if (confirm("Are you sure you want to delete this order?")) {
      try {
        const orderIdStr = String(orderId);
        const order = this.orders.find(o => String(o.id) === orderIdStr || String(o.orderId) === orderIdStr || String(o._id) === orderIdStr);
        
        if (!order) {
          throw new Error('Order not found in local array');
        }

        const dbOrderId = order.orderId || order.id;
        
        const response = await fetch(`${this.API_URL}/orders/${dbOrderId}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to delete order: ${errorText}`);
        }
        
        this.orders = this.orders.filter(o => o.id !== orderId && o.orderId !== orderId && o.id !== dbOrderId && o.orderId !== dbOrderId);
        
        this.renderPage("admin-orders");
        alert('✅ Order deleted successfully!');
      } catch (error) {
        console.error('❌ Error deleting order:', error);
        alert(`❌ Failed to delete order: ${error.message}`);
      }
    }
  }

  // ===== SPARE PARTS METHODS =====

  renderSpareParts() {
    const search = (this.sparePartsSearch || '').toLowerCase();
    const filtered = (this.sparePartsStock || []).filter(d =>
      d.partName?.toLowerCase().includes(search) ||
      d.partId?.toLowerCase().includes(search)
    );
    const lowStock = filtered.filter(d => (Number(d.stock) || 0) === 1);
    return `
      <div class="owner-portal-page" style="min-height:100vh; background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%); color:#ffffff; padding-top:96px; padding-bottom:80px;">
        <div class="container">
          <button class="back-button" data-page="admin" style="margin-bottom:20px;">&#8592; Dashboard</button>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:12px;">
            <div>
              <h1 style="font-size:32px; font-weight:700; margin-bottom:4px;">🔩 Spare Parts</h1>
              <p style="color:#94a3b8;">Manage spare parts inventory — increase, decrease &amp; track stock</p>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
              <button class="btn btn-primary" onclick="app.toggleSparePartsForm()" style="padding:12px 24px;">+ Add Part</button>
              <button onclick="app.openPOSBillingWithItem('spare', '')" style="padding: 12px 24px; background:linear-gradient(135deg, #10b981, #059669); color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">🧾 POS Billing</button>
              <button onclick="app.exportSparePartsPDF()" style="padding:12px 24px; background:#1e293b; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">📄 PDF</button>
              <button onclick="app.exportSparePartsXL()" style="padding:12px 24px; background:#16a34a; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">📊 XL Sheet</button>
            </div>
          </div>
          <div id="sparePartsForm" style="display:none; background:rgba(255,255,255,0.97); border:2px solid #dc2626; border-radius:12px; padding:24px; margin-bottom:24px;">
            <!-- Barcode preview and print buttons -->
            <div style="margin-bottom: 20px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
              <div style="background:#fff; padding:8px; border-radius:8px; text-align:center; display:inline-block; flex-shrink: 0; border:1px solid #cbd5e1;">
                <canvas id="sparePartFormBarcodeCanvas" style="display:none; max-width:100%;"></canvas>
              </div>
              <div style="display:flex; flex-direction:column; gap:8px;">
                <button type="button" onclick="app.printSparePartLabel(document.getElementById('sp_partId').value, document.getElementById('sp_partName')?.value)"
                  style="background:#1e293b; color:#fff; border:none; border-radius:6px; padding:7px 16px; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap;">
                  🏷️ Print Label (Browser)
                </button>
                <button type="button" onclick="app.printSparePartTSCLabel(document.getElementById('sp_partId').value, document.getElementById('sp_partName')?.value)"
                  style="background:#ea580c; color:#fff; border:none; border-radius:6px; padding:7px 16px; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap;">
                  🖶 TSC Printer (.prn)
                </button>
              </div>
            </div>

            <h3 style="font-size:18px; font-weight:700; margin-bottom:16px; color:#000;">Add New Spare Part &amp; Stock Batch</h3>
            <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px; margin-bottom:14px;">
              <div>
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Part Name *</label>
                <input class="input" id="sp_partName" placeholder="e.g. Samsung A54 Battery" style="width:100%;">
              </div>
              <div>
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Part ID / Model *</label>
                <input class="input" id="sp_partId" oninput="app._renderSparePartsFormBarcode(this.value)" placeholder="e.g. SP-SA54-BAT" style="width:100%;">
              </div>
            </div>

            <!-- Purchase Info -->
            <div style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; padding:14px; margin-bottom:14px;">
              <div style="font-size:13px; font-weight:700; color:#0f172a; margin-bottom:8px;">
                <span>🔩 Purchase Batch Info</span>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
                <div>
                  <label style="font-size:11px; font-weight:700; color:#334155; display:block; margin-bottom:4px;">Purchase Date</label>
                  <input type="date" id="sp_purchaseDate" value="${new Date().toISOString().split('T')[0]}" class="input" style="width:100%; font-size:12px;">
                </div>
                <div>
                  <label style="font-size:11px; font-weight:700; color:#d97706; display:block; margin-bottom:4px;">Owner Price (₹)</label>
                  <input class="input" type="number" id="sp_ownerPrice" placeholder="Cost price" min="0" style="width:100%; font-size:12px;">
                </div>
                <div>
                  <label style="font-size:11px; font-weight:700; color:#16a34a; display:block; margin-bottom:4px;">Customer Price (₹)</label>
                  <input class="input" type="number" id="sp_customerPrice" placeholder="Selling price" min="0" style="width:100%; font-size:12px;">
                </div>
              </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div>
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Initial Stock Quantity *</label>
                <input class="input" type="number" id="sp_stock" placeholder="Enter quantity" value="1" min="1" style="width:100%;">
              </div>
              <div>
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Barcode ID (Manual Typing)</label>
                <input class="input" id="sp_barcode" placeholder="Enter barcode manually (e.g. SP-1001)" style="width:100%; background:#ffffff; color:#0f172a; font-weight:700;">
              </div>
            </div>

            <div style="display:flex; gap:12px; margin-top:16px;">
              <button class="btn btn-primary" onclick="app.saveSparePart()" style="padding:10px 24px; font-weight:800;">💾 Save Spare Part</button>
              <button class="btn btn-secondary" onclick="app.toggleSparePartsForm()" style="padding:10px 24px;">Cancel</button>
            </div>
          </div>
          <div style="margin-bottom:16px; display:flex; gap:12px; align-items:center;">
            <div style="flex:1;">
              <input class="input" id="sparePartsSearchInput" placeholder="🔍 Search by part name or ID..."
                style="width:100%; background:#fff; color:#111; border:1px solid #d1d5db;"
                oninput="app.searchSpareParts(this.value)"
                value="${this.sparePartsSearch || ''}">
            </div>
            <span style="color:#fff; font-size:14px; font-weight:600; white-space:nowrap;">${filtered.length} items</span>
          </div>
          ${lowStock.length > 0 ? `
            <div style="background:#fef2f2; border:2px solid #fca5a5; border-radius:10px; padding:12px 18px; margin-bottom:16px; display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:20px;">⚠️</span>
                <span style="font-size:13px; color:#dc2626; font-weight:600;">Only 1 unit left — ${lowStock.map(d => d.partName).join(', ')}</span>
              </div>
              <button onclick="app.downloadSparePartsLowStockAlertPDF()" style="background:#1e293b; color:#fff; border:none; border-radius:7px; padding:6px 14px; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap;">📄 Download PDF</button>
            </div>
          ` : ''}
          ${filtered.length === 0 ? `
            <div style="text-align:center; padding:60px; color:#fff; font-size:16px;">
              <div style="font-size:48px; margin-bottom:16px;">🖥️</div>
              <p>No spare parts found. Add your first part!</p>
            </div>
          ` : `
            <div style="background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.15); border:2px solid #e2e8f0;">
              <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:13px; min-width:680px;">
                  <thead>
                    <tr style="background:#1e293b; color:#fff; text-align:left;">
                      <th style="padding:12px 14px; font-weight:700; border-right:1px solid #334155; width:36px;">#</th>
                      <th style="padding:12px 14px; font-weight:700; border-right:1px solid #334155; min-width:180px;">Part Name</th>
                      <th style="padding:12px 14px; font-weight:700; border-right:1px solid #334155; min-width:150px; text-align:center;">Barcode</th>
                      <th style="padding:12px 14px; font-weight:700; border-right:1px solid #334155; min-width:100px; text-align:center;">Owner Price (₹)</th>
                      <th style="padding:12px 14px; font-weight:700; border-right:1px solid #334155; min-width:110px; text-align:center;">Customer Price (₹)</th>
                      <th style="padding:12px 14px; font-weight:700; border-right:1px solid #334155; min-width:100px; text-align:center;">Stock</th>
                      <th style="padding:12px 14px; font-weight:700; border-right:1px solid #334155; min-width:170px; text-align:center;">
                        <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                          <span>Total Value (₹) + Password</span>
                          <input type="password" id="spareTotalValuePassword" placeholder="Enter password"
                            value="${this.spareTotalValueUnlocked ? 'admin123' : ''}"
                            oninput="app.checkSpareTotalValuePassword(this.value)"
                            onkeydown="if(event.key === 'Enter') app.checkSpareTotalValuePassword(this.value, true)"
                            style="width:105px; padding:3px 6px; border:1px solid #cbd5e1; border-radius:4px; font-size:11px; text-align:center; color:#000; outline:none; font-weight:normal;">
                        </div>
                      </th>
                      <th style="padding:12px 14px; font-weight:700; border-right:1px solid #334155; min-width:200px; text-align:center;">Adjust Stock</th>
                      <th style="padding:12px 14px; font-weight:700; text-align:center; min-width:70px;">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filtered.map((item, idx) => {
                      const stock = Number(item.stock) || 0;
                      const ownerPrice    = Number(item.ownerPrice) || 0;
                      const customerPrice = Number(item.customerPrice) || 0;
                      const totalValue = customerPrice * stock;
                      const stockColor = stock === 0 ? '#dc2626' : stock <= 1 ? '#dc2626' : stock <= 3 ? '#d97706' : '#16a34a';
                      const stockBg    = stock === 0 ? '#fef2f2' : stock <= 1 ? '#fef2f2' : stock <= 3 ? '#fffbeb' : '#f0fdf4';
                      const rowBg      = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                      const spBcId     = `bc_sp_${item.partItemId.replace(/[^a-zA-Z0-9]/g, '_')}`;

                      setTimeout(() => {
                        const el = document.getElementById(spBcId);
                        if (el && typeof JsBarcode !== 'undefined') {
                          try {
                            JsBarcode(el, item.partId, {
                              format: 'CODE128', width: 1.5, height: 32,
                              displayValue: true, fontSize: 11, margin: 4,
                              background: '#ffffff', lineColor: '#000000',
                              font: 'monospace', fontOptions: 'bold'
                            });
                            el.style.display = 'block';
                            el.style.width = '120px';
                          } catch(e) {}
                        }
                      }, 50);

                      return `
                        <tr style="background:${rowBg}; border-bottom:1px solid #e2e8f0; transition:background 0.3s;"
                            onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='${rowBg}'">
                          <td style="padding:10px 14px; color:#9ca3af; font-weight:600; border-right:1px solid #e2e8f0; text-align:center;">${idx + 1}</td>
                          <td style="padding:10px 14px; font-weight:700; color:#111827; border-right:1px solid #e2e8f0;">
                            ${item.partName}
                            ${stock <= 1 && stock > 0 ? `<span style="margin-left:6px; background:#fef2f2; color:#dc2626; font-size:10px; font-weight:800; padding:2px 7px; border-radius:4px; border:1px solid #fca5a5;">⚠️ LAST 1</span>` : ''}
                            ${stock === 0 ? `<span style="margin-left:6px; background:#fef2f2; color:#dc2626; font-size:10px; font-weight:800; padding:2px 7px; border-radius:4px; border:1px solid #fca5a5;">❌ OUT</span>` : ''}
                          </td>
                          <td style="padding:8px 14px; text-align:center; border-right:1px solid #e2e8f0;">
                            <div style="display:inline-flex; flex-direction:column; align-items:center; gap:4px;">
                              <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:6px; padding:4px; text-align:center; cursor:pointer; display:flex; align-items:center; justify-content:center;"
                                   onclick="app.printSparePartLabel('${item.partId}', '${(item.partName||'').replace(/'/g, "\\'")}')"
                                   title="Click to print barcode label">
                                <svg id="${spBcId}" style="display:none; width:120px; height:45px;"></svg>
                              </div>
                              <div style="display:flex; gap:4px; justify-content:center;">
                                <button onclick="app.printSparePartLabel('${item.partId}', '${(item.partName||'').replace(/'/g, "\\'")}')"
                                  style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:4px; padding:2px 6px; font-size:10px; font-weight:600; cursor:pointer;" title="Print Browser Label">
                                  🏷️ Print
                                </button>
                                <button onclick="app.printSparePartTSCLabel('${item.partId}', '${(item.partName||'').replace(/'/g, "\\'")}')"
                                  style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:4px; padding:2px 6px; font-size:10px; font-weight:600; cursor:pointer;" title="Print TSC Label">
                                  🖶 TSC
                                </button>
                              </div>
                            </div>
                          </td>
                          <td style="padding:10px 14px; text-align:center; color:#d97706; font-weight:700; border-right:1px solid #e2e8f0;">
                            ${this.spareTotalValueUnlocked ? 
                              (ownerPrice ? `₹${ownerPrice.toLocaleString('en-IN')}` : '<span style="color:#9ca3af;">—</span>') :
                              '<span style="color:#94a3b8; font-family:monospace; font-size:14px;">••••</span>'
                            }
                          </td>
                          <td style="padding:10px 14px; text-align:center; color:#16a34a; font-weight:700; border-right:1px solid #e2e8f0;">
                            ${customerPrice ? `₹${customerPrice.toLocaleString('en-IN')}` : '<span style="color:#9ca3af;">—</span>'}
                          </td>
                          <td style="padding:10px 14px; text-align:center; border-right:1px solid #e2e8f0;">
                            <span style="display:inline-block; background:${stockBg}; color:${stockColor}; font-weight:900; font-size:18px; min-width:48px; padding:4px 10px; border-radius:6px; border:1px solid ${stockColor}40;">
                              ${stock}
                            </span>
                          </td>
                          <td style="padding:10px 14px; text-align:center; font-weight:700; color:#1d4ed8; border-right:1px solid #e2e8f0;">
                            ${this.spareTotalValueUnlocked ? 
                              (customerPrice && stock ? `₹${totalValue.toLocaleString('en-IN')}` : '<span style="color:#9ca3af;">—</span>') :
                              '<span style="color:#94a3b8; font-family:monospace; font-size:14px;">••••</span>'
                            }
                          </td>
                          <td style="padding:8px 14px; border-right:1px solid #e2e8f0;">
                            <div style="display:flex; gap:6px; align-items:center; justify-content:center;">
                              <input type="number" id="spqty_${item.partItemId}" min="1" value="1"
                                style="width:52px; padding:5px 6px; border:1px solid #d1d5db; border-radius:6px; font-size:13px; text-align:center; color:#111;">
                              <button onclick="app.adjustSparePart('${item.partItemId}', 1)"
                                style="background:#16a34a; color:#fff; border:none; border-radius:6px; padding:6px 12px; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap;">
                                ▲ In
                              </button>
                              <button onclick="app.adjustSparePart('${item.partItemId}', -1)"
                                style="background:#dc2626; color:#fff; border:none; border-radius:6px; padding:6px 12px; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap; ${stock===0?'opacity:0.45;cursor:not-allowed;':''}">
                                ▼ Out
                              </button>
                            </div>
                          </td>
                          <td style="padding:10px 14px; text-align:center;">
                            <div style="display:flex; gap:6px; justify-content:center;">
                              <button onclick="app.openPOSBillingWithItem('spare', '${item.partItemId}')"
                                style="background:#10b981; color:#fff; border:1px solid #059669; border-radius:6px; padding:5px 9px; font-size:12px; font-weight:700; cursor:pointer;" title="Add to POS Cart & Bill">
                                🛒 POS
                              </button>
                              <button onclick="app.showSparePartHistoryModal('${item.partItemId}')"
                                style="background:#38bdf8; color:#0f172a; border:none; border-radius:6px; padding:5px 8px; font-size:12px; font-weight:800; cursor:pointer;" title="View History">
                                📋
                              </button>
                              <button onclick="app.showEditSparePartModal('${item.partItemId}')"
                                style="background:#dbeafe; color:#1d4ed8; border:1px solid #93c5fd; border-radius:6px; padding:5px 10px; font-size:12px; cursor:pointer;" title="Edit">
                                ✏️
                              </button>
                              <button onclick="app.deleteSparePart('${item.partItemId}')"
                                style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; border-radius:6px; padding:5px 10px; font-size:12px; cursor:pointer;" title="Delete">
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                  <tfoot>
                    <tr style="background:#1e293b; color:#fff; font-weight:700;">
                      <td colspan="3" style="padding:12px 14px; font-size:13px; border-right:1px solid #334155;">📊 GRAND TOTAL</td>
                      <td style="padding:12px 14px; text-align:center; font-size:13px; border-right:1px solid #334155;">—</td>
                      <td style="padding:12px 14px; text-align:center; font-size:13px; border-right:1px solid #334155;">—</td>
                      <td style="padding:12px 14px; text-align:center; font-size:15px; font-weight:900; border-right:1px solid #334155;">
                        ${filtered.reduce((sum, d) => sum + (Number(d.stock) || 0), 0)} units
                      </td>
                      <td style="padding:12px 14px; text-align:center; font-size:15px; font-weight:900; color:#86efac; border-right:1px solid #334155;">
                        ${this.spareTotalValueUnlocked ? 
                          `₹${filtered.reduce((sum, d) => sum + ((Number(d.customerPrice) || 0) * (Number(d.stock) || 0)), 0).toLocaleString('en-IN')}` :
                          '<span style="color:#94a3b8; font-family:monospace; font-size:14px;">••••</span>'
                        }
                      </td>
                      <td colspan="2" style="padding:12px 14px; text-align:center; font-size:12px; color:#94a3b8;">
                        ${filtered.length} item${filtered.length !== 1 ? 's' : ''}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          `}
        </div>
      </div>`;
  }

  toggleSparePartsForm() {
    const f = document.getElementById('sparePartsForm');
    if (f) {
      const isHidden = f.style.display === 'none';
      f.style.display = isHidden ? 'block' : 'none';
      if (isHidden) {
        const nextId = this._generateNextPartId();
        const partIdInput = document.getElementById('sp_partId');
        if (partIdInput) {
          partIdInput.value = nextId;
          this._renderSparePartsFormBarcode(nextId);
        }
      }
    }
  }

  checkSpareTotalValuePassword(val, isSubmit = false) {
    const isCorrect = (val === 'admin123');
    if (isCorrect !== this.spareTotalValueUnlocked) {
      this.spareTotalValueUnlocked = isCorrect;
      this.renderPage('admin-spare-parts');
      setTimeout(() => {
        const input = document.getElementById('spareTotalValuePassword');
        if (input) {
          input.focus();
          input.value = val;
          input.setSelectionRange(val.length, val.length);
        }
      }, 50);
    } else if (isSubmit && !isCorrect) {
      alert('❌ Invalid password');
    }
  }

  searchSpareParts(value) {
    this.sparePartsSearch = value || '';
    clearTimeout(this._sparePartsSearchTimer);
    this._sparePartsSearchTimer = setTimeout(() => {
      if (this.currentPage === 'admin-spare-parts') {
        this.renderPage('admin-spare-parts');
      }
    }, 250);
  }

  async saveSparePart() {
    const partName      = document.getElementById('sp_partName')?.value?.trim();
    const partId        = document.getElementById('sp_partId')?.value?.trim();
    const stock         = document.getElementById('sp_stock')?.value;
    const ownerPrice    = document.getElementById('sp_ownerPrice')?.value;
    const customerPrice = document.getElementById('sp_customerPrice')?.value;
    const dealerId = '';
    const dealerName = 'Direct Purchase';
    const purchaseDate = document.getElementById('sp_purchaseDate')?.value || new Date().toISOString().split('T')[0];
    const barcode = document.getElementById('sp_barcode')?.value?.trim() || partId;

    if (!partName || !partId || stock === '' || stock === null) {
      alert('Please fill in Part Name, Part ID and Initial Stock.');
      return;
    }

    const data = {
      partName,
      partId,
      stock: Number(stock),
      ownerPrice:    ownerPrice    ? Number(ownerPrice)    : null,
      customerPrice: customerPrice ? Number(customerPrice) : null,
      history: [{ change: Number(stock), stockAfter: Number(stock), date: new Date().toLocaleDateString('en-IN') }]
    };

    try {
      const response = await fetch(`${this.API_URL}/spare-parts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        const saved = await response.json();

        // Also save StockEntry batch record
        const stockEntryData = {
          moduleType: 'SparePart',
          masterId: String(saved.partItemId || saved._id || Date.now()),
          masterName: saved.partName,
          dealerId,
          dealerName,
          purchaseDate,
          initialQuantity: Number(stock),
          currentQuantity: Number(stock),
          purchasePrice: ownerPrice ? Number(ownerPrice) : 0,
          sellingPrice: customerPrice ? Number(customerPrice) : 0,
          barcode
        };

        const entryRes = await fetch(`${this.API_URL}/stock-entries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stockEntryData)
        });

        if (entryRes.ok) {
          const entry = await entryRes.json();
          this.stockEntries.unshift(entry);
        }

        this.sparePartsStock.unshift(saved);

        if (confirm(`✅ Spare Part "${saved.partName}" saved!\nBarcode: ${barcode}\n\nPrint Barcode Label?`)) {
          this.printStockBarcodeLabel(barcode, 'browser');
        }

        this.renderPage('admin-spare-parts');
      } else {
        alert('❌ Failed to save spare part.');
      }
    } catch (err) {
      console.error(err);
      alert('❌ Error saving spare part.');
    }
  }

  async adjustSparePart(partItemId, direction) {
    const qtyInput = document.getElementById(`spqty_${partItemId}`);
    const qty = Math.max(1, Number(qtyInput?.value) || 1);
    const item = (this.sparePartsStock || []).find(d => d.partItemId === partItemId);
    if (!item) return;

    const change = direction * qty;
    const newStock = Math.max(0, (Number(item.stock) || 0) + change);

    const historyEntry = {
      change,
      stockAfter: newStock,
      date: new Date().toLocaleDateString('en-IN')
    };

    try {
      const response = await fetch(`${this.API_URL}/spare-parts/${partItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: newStock, historyEntry })
      });
      if (response.ok) {
        const updated = await response.json();
        const idx = this.sparePartsStock.findIndex(d => d.partItemId === partItemId);
        if (idx !== -1) this.sparePartsStock[idx] = updated;

        // Show low stock warning modal when stock reaches 1
        if (updated.stock === 1) {
          this.showSparePartsLowStockAlert(updated);
        }

        this.renderPage('admin-spare-parts');
      } else {
        alert('❌ Failed to update stock.');
      }
    } catch (err) {
      console.error(err);
      alert('❌ Error updating stock.');
    }
  }

  printSparePartHistory(partItemId) {
    const item = (this.sparePartsStock || []).find(s => s.partItemId === partItemId || s._id === partItemId);
    if (!item) {
      alert('Spare Part not found.');
      return;
    }

    const shop = this.shopConfig;
    const history = item.history || [];
    const win = window.open('', '_blank', 'width=750,height=800');

    const rows = history.length === 0 ? `
      <tr><td colspan="5" style="text-align:center; padding:15px; color:#666;">No transaction history available.</td></tr>
    ` : history.slice().reverse().map((h, i) => `
      <tr>
        <td style="padding:8px; border-bottom:1px solid #ddd; text-align:center;">${i+1}</td>
        <td style="padding:8px; border-bottom:1px solid #ddd; font-weight:700;">${h.date || '—'}</td>
        <td style="padding:8px; border-bottom:1px solid #ddd;">
          <div>${h.reason || (h.change > 0 ? 'Stock Addition' : 'Stock Deduction')}</div>
          ${h.customerName ? `<div style="font-size:11px; color:#0284c7; font-weight:700;">👤 Customer: ${h.customerName} ${h.customerPhone ? '(' + h.customerPhone + ')' : ''}</div>` : ''}
          ${h.imsNumber || h.imeiNumber ? `<div style="font-size:11px; color:#475569;">📱 IMS/IMEI: ${h.imsNumber || h.imeiNumber}</div>` : ''}
        </td>
        <td style="padding:8px; border-bottom:1px solid #ddd; text-align:center; font-weight:900; color:${h.change > 0 ? '#16a34a' : '#dc2626'};">
          ${h.change > 0 ? '+' : ''}${h.change}
        </td>
        <td style="padding:8px; border-bottom:1px solid #ddd; text-align:center; font-size:11px;">
          ${h.saleId || '—'}
        </td>
      </tr>
    `).join('');

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Spare History - ${item.partName || item.itemName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #111; max-width: 700px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
          .shop-title { font-size: 22px; font-weight: 900; color: #1e293b; text-transform: uppercase; }
          .title { text-align: center; font-size: 15px; font-weight: 800; margin: 12px 0; background: #f1f5f9; padding: 6px; border-radius: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
          th { background: #0f172a; color: #fff; text-align: left; padding: 8px; font-size: 11px; text-transform: uppercase; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="shop-title">${shop.name || 'NEW MOBILE'}</div>
          <div>${shop.address || 'Mobile Sales & Services'}</div>
          <div>Phone: ${shop.phone || 'N/A'}</div>
        </div>

        <div class="title">📋 SPARE PART TRANSACTION HISTORY REPORT</div>

        <div style="background:#f8fafc; border:1px solid #cbd5e1; padding:10px; border-radius:6px; margin-bottom:15px; display:flex; justify-content:space-between; font-size:13px;">
          <div><strong>Part Name:</strong> ${item.partName || item.itemName}</div>
          <div><strong>Part ID:</strong> ${item.partItemId || item.partId || '—'}</div>
          <div><strong>Current Stock:</strong> ${item.stock || 0} units</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="text-align:center;">#</th>
              <th>Date</th>
              <th>Reason / Details / Customer</th>
              <th style="text-align:center;">Change</th>
              <th style="text-align:center;">Ref Bill ID</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div style="margin-top:30px; text-align:center; font-size:11px; color:#64748b;">
          Report Generated on ${new Date().toLocaleString('en-IN')}
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    win.document.close();
  }

  showSparePartHistoryModal(partItemId) {
    const item = (this.sparePartsStock || []).find(s => s.partItemId === partItemId || s._id === partItemId);
    if (!item) return;

    const existing = document.getElementById('spareHistoryModal');
    if (existing) existing.remove();

    const history = item.history || [];

    const modalHTML = `
      <div id="spareHistoryModal" onclick="if(event.target===this)this.remove()"
        style="position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;">
        <div style="background:#1e293b;border:2px solid #334155;border-radius:14px;padding:24px;max-width:720px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.5);max-height:90vh;overflow-y:auto;color:#f8fafc;">

          <!-- Header -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid #334155;padding-bottom:12px;">
            <div>
              <h2 style="font-size:18px;font-weight:800;color:#f8fafc;margin:0;">📋 Spare Part History — ${item.partName || item.itemName}</h2>
              <span style="font-size:12px;color:#38bdf8;font-weight:700;">Part ID: ${item.partItemId || item.partId || '—'} | Current Stock: ${item.stock || 0} units</span>
            </div>
            <div style="display:flex;gap:8px;">
              <button onclick="app.printSparePartHistory('${item.partItemId}')"
                style="background:linear-gradient(135deg, #0284c7, #0369a1);color:#fff;border:none;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:12px;font-weight:800;">🖨️ Print Report</button>
              <button onclick="document.getElementById('spareHistoryModal').remove()"
                style="background:rgba(244,63,94,0.15);color:#f87171;border:1px solid #f87171;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:12px;">✕ Close</button>
            </div>
          </div>

          <!-- History Table -->
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
              <thead>
                <tr style="background:#0f172a;color:#cbd5e1;text-transform:uppercase;font-size:11px;">
                  <th style="padding:8px 10px;text-align:left;">Date</th>
                  <th style="padding:8px 10px;text-align:left;">Reason / Customer Details</th>
                  <th style="padding:8px 10px;text-align:center;">Stock Change</th>
                  <th style="padding:8px 10px;text-align:center;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${history.length === 0 ? `
                  <tr><td colspan="4" style="padding:20px;text-align:center;color:#94a3b8;">No transaction history recorded yet for this spare part.</td></tr>
                ` : history.slice().reverse().map(h => `
                  <tr style="border-bottom:1px solid #334155;">
                    <td style="padding:8px 10px;font-weight:700;color:#cbd5e1;">${h.date || '—'}</td>
                    <td style="padding:8px 10px;color:#f8fafc;font-weight:600;">
                      ${h.reason || (h.change > 0 ? 'Stock Addition' : 'Stock Deduction')}
                      ${h.customerName ? `<div style="font-size:11.5px;color:#38bdf8;font-weight:700;margin-top:2px;">👤 Customer: ${h.customerName} ${h.customerPhone ? '(' + h.customerPhone + ')' : ''}</div>` : ''}
                      ${h.imsNumber || h.imeiNumber ? `<div style="font-size:11px;color:#94a3b8;">📱 IMS/IMEI: ${h.imsNumber || h.imeiNumber}</div>` : ''}
                    </td>
                    <td style="padding:8px 10px;text-align:center;font-weight:900;color:${h.change > 0 ? '#4ade80' : '#f87171'};">
                      ${h.change > 0 ? '+' : ''}${h.change}
                    </td>
                    <td style="padding:8px 10px;text-align:center;">
                      ${h.saleId ? `
                        <button onclick="app.printBill('${h.saleId}')" style="background:#0284c7;color:#fff;border:none;border-radius:4px;padding:5px 9px;font-size:11px;font-weight:800;cursor:pointer;" title="Print POS/Sales Bill">
                          🧾 Print Bill
                        </button>
                      ` : '—'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  showSparePartsLowStockAlert(item) {
    const existing = document.getElementById('sparePartsLowStockModal');
    if (existing) existing.remove();

    const modalHTML = `
      <div id="sparePartsLowStockModal" onclick="if(event.target===this)this.remove()"
        style="position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;">
        <div style="background:#fff;border-radius:14px;padding:28px;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.4);text-align:center;">
          <div style="font-size:48px;margin-bottom:12px;">⚠️</div>
          <h2 style="font-size:20px;font-weight:800;color:#dc2626;margin-bottom:8px;">Low Stock Alert!</h2>
          <p style="font-size:15px;font-weight:700;color:#111;margin-bottom:6px;">${item.partName}</p>
          <p style="font-size:13px;color:#6b7280;margin-bottom:16px;">Only <strong style="color:#dc2626;">1 unit</strong> remaining in stock. Please reorder soon.</p>
          ${item.customerPrice ? `<p style="font-size:13px;color:#374151;margin-bottom:4px;">Customer Price: <strong>${this.spareTotalValueUnlocked ? '₹' + Number(item.customerPrice).toLocaleString('en-IN') : '••••'}</strong></p>` : ''}
          ${item.ownerPrice ? `<p style="font-size:13px;color:#374151;margin-bottom:20px;">Owner Price: <strong>${this.spareTotalValueUnlocked ? '₹' + Number(item.ownerPrice).toLocaleString('en-IN') : '••••'}</strong></p>` : ''}
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
            <button onclick="app.downloadSparePartsLowStockPDF('${item.partItemId}')"
              style="background:#1e293b;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:700;cursor:pointer;">
              📄 Download PDF
            </button>
            <button onclick="document.getElementById('sparePartsLowStockModal').remove()"
              style="background:#f1f5f9;color:#374151;border:1px solid #d1d5db;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:600;cursor:pointer;">
              ✕ Dismiss
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  downloadSparePartsLowStockAlertPDF() {
    const lowItems = (this.sparePartsStock || []).filter(d => Number(d.stock) === 1);
    if (lowItems.length === 0) return;

    const win = window.open('', '_blank', 'width=700,height=500');
    const rows = lowItems.map((d, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#fef2f2'}">
        <td>${i + 1}</td>
        <td style="font-weight:700;">${d.partName}</td>
        <td>${d.partId}</td>
        <td style="color:#dc2626;font-weight:900;">1 unit</td>
        <td style="color:#d97706;font-weight:700;">${this.spareTotalValueUnlocked ? (d.ownerPrice ? '₹' + Number(d.ownerPrice).toLocaleString('en-IN') : '—') : '••••'}</td>
        <td style="color:#16a34a;font-weight:700;">${d.customerPrice ? '₹' + Number(d.customerPrice).toLocaleString('en-IN') : '—'}</td>
      </tr>`).join('');

    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Low Stock Alert — Spare Parts</title>
    <style>
      body{font-family:Arial,sans-serif;padding:30px;color:#111;}
      h2{color:#dc2626;}
      table{width:100%;border-collapse:collapse;font-size:13px;margin-top:16px;}
      th{background:#dc2626;color:#fff;padding:9px 12px;text-align:left;}
      td{padding:8px 12px;border-bottom:1px solid #e5e7eb;}
      .footer{margin-top:20px;font-size:12px;color:#6b7280;}
      @media print{button{display:none;}}
    </style></head><body>
    <h2>⚠️ Low Stock Alert — Spare Parts</h2>
    <p style="color:#6b7280;font-size:13px;">Generated: ${new Date().toLocaleString('en-IN')} &nbsp;|&nbsp; Items with only 1 unit remaining: ${lowItems.length}</p>
    <table>
      <thead><tr><th>#</th><th>Part Name</th><th>Part ID</th><th>Stock</th><th>Owner Price</th><th>Customer Price</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top:20px;font-size:13px;color:#dc2626;font-weight:700;">⚠️ Please reorder the above parts immediately!</p>
    <div class="footer">ஜிவி மொபைல்ஸ் — Jivi Mobiles | Vanthavasi | Ph: +91 84890 62593 / +91 96295 16788</div>
    <br>
    <button onclick="window.print()" style="padding:10px 24px;background:#1e293b;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;">🖨️ Print / Save as PDF</button>
    </body></html>`);
    win.document.close();
    setTimeout(() => { try { win.focus(); } catch(e) {} }, 200);
  }

  downloadSparePartsLowStockPDF(partItemId) {
    const item = (this.sparePartsStock || []).find(d => d.partItemId === partItemId);
    if (!item) return;

    const win = window.open('', '_blank', 'width=600,height=500');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Low Stock Alert</title>
    <style>
      body{font-family:Arial,sans-serif;padding:30px;color:#111;}
      h2{color:#dc2626;}
      .box{border:2px solid #dc2626;border-radius:8px;padding:20px;margin-top:16px;}
      .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f3f4f6;font-size:14px;}
      .label{color:#6b7280;}
      .value{font-weight:700;}
      @media print{button{display:none;}}
    </style></head><body>
    <h2>⚠️ Low Stock Alert — Spare Parts</h2>
    <p style="color:#6b7280;font-size:13px;">Generated: ${new Date().toLocaleString('en-IN')}</p>
    <div class="box">
      <div class="row"><span class="label">Part Name</span><span class="value">${item.partName}</span></div>
      <div class="row"><span class="label">Part ID</span><span class="value">${item.partId}</span></div>
      <div class="row"><span class="label">Remaining Stock</span><span class="value" style="color:#dc2626;">1 unit</span></div>
      <div class="row"><span class="label">Owner Price</span><span class="value" style="color:#d97706;">${this.spareTotalValueUnlocked ? (item.ownerPrice ? '₹' + Number(item.ownerPrice).toLocaleString('en-IN') : '—') : '••••'}</span></div>
      <div class="row"><span class="label">Customer Price</span><span class="value" style="color:#16a34a;">${item.customerPrice ? '₹' + Number(item.customerPrice).toLocaleString('en-IN') : '—'}</span></div>
    </div>
    <p style="margin-top:20px;font-size:13px;color:#dc2626;font-weight:700;">⚠️ Please reorder this part immediately!</p>
    <br>
    <button onclick="window.print()" style="padding:10px 24px;background:#1e293b;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;">🖨️ Print / Save as PDF</button>
    </body></html>`);
    win.document.close();
    setTimeout(() => { try { win.focus(); } catch(e) {} }, 200);
  }

  showEditSparePartModal(partItemId) {
    const item = (this.sparePartsStock || []).find(d => d.partItemId === partItemId);
    if (!item) return;

    const existing = document.getElementById('editSparePartModal');
    if (existing) existing.remove();

    const modalHTML = `
      <div id="editSparePartModal" onclick="if(event.target===this)this.remove()"
        style="position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;">
        <div style="background:#fff;border-radius:14px;padding:28px;max-width:520px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.4);">
          <h2 style="font-size:18px;font-weight:800;color:#111;margin-bottom:20px;">✏️ Edit Spare Part</h2>
          <div style="display:grid;gap:12px;">
            <div>
              <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Part Name *</label>
              <input class="input" id="edit_sp_partName" value="${item.partName}" style="width:100%;background:#f8fafc;color:#111;border:1px solid #d1d5db;">
            </div>
            <div>
              <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Part ID *</label>
              <input class="input" id="edit_sp_partId" value="${item.partId}" style="width:100%;background:#f8fafc;color:#111;border:1px solid #d1d5db;" oninput="app._renderEditSparePartsBarcode(this.value)">
              <div style="background:#fff; padding:6px; border-radius:8px; text-align:center; margin-top:8px; border:1px solid #cbd5e1; display:inline-block;">
                <canvas id="editSparePartBarcodeCanvas" style="display:none; max-width:100%; height:40px;"></canvas>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
              <div>
                <label style="font-size:13px;font-weight:600;color:#d97706;display:block;margin-bottom:4px;">Owner Price (₹)</label>
                <input class="input" type="${this.spareTotalValueUnlocked ? 'number' : 'password'}" id="edit_sp_ownerPrice" value="${item.ownerPrice || ''}" placeholder="${this.spareTotalValueUnlocked ? 'Cost price' : '••••'}" ${this.spareTotalValueUnlocked ? '' : 'readonly'} min="0" style="width:100%;background:#f8fafc;color:#111;border:1px solid #d1d5db;">
              </div>
              <div>
                <label style="font-size:13px;font-weight:600;color:#16a34a;display:block;margin-bottom:4px;">Customer Price (₹)</label>
                <input class="input" type="number" id="edit_sp_customerPrice" value="${item.customerPrice || ''}" placeholder="Customer price" min="0" style="width:100%;background:#f8fafc;color:#111;border:1px solid #d1d5db;">
              </div>
              <div>
                <label style="font-size:13px;font-weight:600;color:#1d4ed8;display:block;margin-bottom:4px;">Stock Qty</label>
                <input class="input" type="number" id="edit_sp_stock" value="${item.stock || 0}" placeholder="Quantity" min="0" style="width:100%;background:#f8fafc;color:#111;border:1px solid #d1d5db;">
              </div>
            </div>
          </div>
          <div style="display:flex;gap:10px;margin-top:20px;">
            <button onclick="app.saveEditSparePart('${partItemId}')"
              style="flex:1;background:#1d4ed8;color:#fff;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;">
              💾 Save Changes
            </button>
            <button onclick="document.getElementById('editSparePartModal').remove()"
              style="flex:1;background:#f1f5f9;color:#374151;border:1px solid #d1d5db;border-radius:8px;padding:12px;font-size:14px;font-weight:600;cursor:pointer;">
              Cancel
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    setTimeout(() => {
      this._renderEditSparePartsBarcode(item.partId);
    }, 50);
  }

  async saveEditSparePart(partItemId) {
    const partName      = document.getElementById('edit_sp_partName')?.value?.trim();
    const partId        = document.getElementById('edit_sp_partId')?.value?.trim();
    const ownerPrice    = document.getElementById('edit_sp_ownerPrice')?.value;
    const customerPrice = document.getElementById('edit_sp_customerPrice')?.value;
    const stock         = document.getElementById('edit_sp_stock')?.value;

    if (!partName || !partId) {
      alert('Part Name and Part ID are required.');
      return;
    }

    try {
      const response = await fetch(`${this.API_URL}/spare-parts/${partItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partName,
          partId,
          ownerPrice:    ownerPrice    ? Number(ownerPrice)    : null,
          customerPrice: customerPrice ? Number(customerPrice) : null,
          stock:         stock !== '' && stock !== undefined ? Number(stock) : undefined
        })
      });
      if (response.ok) {
        const updated = await response.json();
        const idx = this.sparePartsStock.findIndex(d => d.partItemId === partItemId);
        if (idx !== -1) this.sparePartsStock[idx] = updated;
        document.getElementById('editSparePartModal')?.remove();
        this.renderPage('admin-spare-parts');
      } else {
        alert('❌ Failed to update spare part.');
      }
    } catch (err) {
      console.error(err);
      alert('❌ Error updating spare part.');
    }
  }

  async deleteSparePart(partItemId) {
    if (!confirm('Delete this spare part? This cannot be undone.')) return;
    try {
      const response = await fetch(`${this.API_URL}/spare-parts/${partItemId}`, { method: 'DELETE' });
      if (response.ok) {
        this.sparePartsStock = this.sparePartsStock.filter(d => d.partItemId !== partItemId);
        this.renderPage('admin-spare-parts');
      } else {
        alert('❌ Failed to delete spare part.');
      }
    } catch (err) {
      console.error(err);
      alert('❌ Error deleting spare part.');
    }
  }

  exportSparePartsPDF() {
    const data = this.sparePartsStock || [];
    const win = window.open('', '_blank', 'width=1000,height=750');
    const rows = data.map((p, i) => {
      const stock         = Number(p.stock) || 0;
      const ownerPrice    = Number(p.ownerPrice) || 0;
      const customerPrice = Number(p.customerPrice) || 0;
      const stockColor = stock === 0 ? '#dc2626' : stock <= 3 ? '#d97706' : '#16a34a';
      return `
        <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'};">
          <td style="padding:8px 10px; border:1px solid #e2e8f0; text-align:center; color:#9ca3af;">${i + 1}</td>
          <td style="padding:8px 10px; border:1px solid #e2e8f0; font-weight:700;">${p.partName || '—'}</td>
          <td style="padding:8px 10px; border:1px solid #e2e8f0;">${p.partId || '—'}</td>
          <td style="padding:8px 10px; border:1px solid #e2e8f0; text-align:center; color:#d97706; font-weight:700;">${this.spareTotalValueUnlocked ? (ownerPrice ? '₹' + ownerPrice.toLocaleString('en-IN') : '—') : '••••'}</td>
          <td style="padding:8px 10px; border:1px solid #e2e8f0; text-align:center; color:#16a34a; font-weight:700;">${this.spareTotalValueUnlocked ? (customerPrice ? '₹' + customerPrice.toLocaleString('en-IN') : '—') : '••••'}</td>
          <td style="padding:8px 10px; border:1px solid #e2e8f0; text-align:center; font-weight:900; color:${stockColor};">${stock}</td>
          <td style="padding:8px 10px; border:1px solid #e2e8f0; text-align:center; font-weight:700; color:#1d4ed8;">${this.spareTotalValueUnlocked ? (customerPrice && stock ? '₹' + (customerPrice * stock).toLocaleString('en-IN') : '—') : '••••'}</td>
        </tr>`;
    }).join('');
    const totalUnits = data.reduce((s, p) => s + (Number(p.stock) || 0), 0);
    const totalValue = data.reduce((s, p) => s + ((Number(p.customerPrice) || 0) * (Number(p.stock) || 0)), 0);
    win.document.write(`
      <html><head><title>Spare Parts - Manjula Mobile World</title>
      <style>body{font-family:Arial,sans-serif;padding:20px;} table{width:100%;border-collapse:collapse;font-size:12px;} th{background:#1e293b;color:#fff;padding:10px;text-align:left;} tfoot td{background:#1e293b;color:#fff;font-weight:700;padding:10px;}</style>
      </head><body>
      <h2 style="margin-bottom:4px;">� Spare Parts — Manjula Mobile World</h2>
      <p style="color:#64748b; font-size:12px; margin-bottom:16px;">Generated: ${new Date().toLocaleString('en-IN')}</p>
      <table>
        <thead><tr><th>#</th><th>Part Name</th><th>Part ID</th><th>Owner Price</th><th>Customer Price</th><th>Stock</th><th>Total Value</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="5" style="text-align:right;">GRAND TOTAL</td><td style="text-align:center;">${totalUnits} units</td><td style="text-align:center;">${this.spareTotalValueUnlocked ? '₹' + totalValue.toLocaleString('en-IN') : '••••'}</td></tr></tfoot>
      </table>
      <script>window.print();<\/script>
      </body></html>`);
    win.document.close();
  }

  exportSparePartsXL() {
    const data = this.sparePartsStock || [];
    const headers = ['#', 'Part Name', 'Part ID', 'Owner Price (₹)', 'Customer Price (₹)', 'Stock Qty', 'Total Value (₹)'];
    const rows = data.map((p, i) => [
      i + 1,
      p.partName || '',
      p.partId || '',
      this.spareTotalValueUnlocked ? (Number(p.ownerPrice) || 0) : '••••',
      (Number(p.customerPrice) || 0),
      Number(p.stock) || 0,
      this.spareTotalValueUnlocked ? ((Number(p.customerPrice) || 0) * (Number(p.stock) || 0)) : '••••'
    ]);
    const totalUnits = data.reduce((s, p) => s + (Number(p.stock) || 0), 0);
    const totalValue = data.reduce((s, p) => s + ((Number(p.customerPrice) || 0) * (Number(p.stock) || 0)), 0);
    rows.push(['', 'GRAND TOTAL', '', '', '', totalUnits, this.spareTotalValueUnlocked ? totalValue : '••••']);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `spare-parts-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ===== SPARE PARTS BARCODE & PRINT METHODS =====
  _generateNextPartId() {
    const BASE = 1;
    let max = BASE - 1;
    (this.sparePartsStock || []).forEach(p => {
      const num = parseInt(p.partId, 10);
      if (!isNaN(num) && num > max) max = num;
    });
    const next = max + 1;
    return String(next).padStart(4, '0');
  }

  _renderDisplayFormBarcode(value) {
    const canvas = document.getElementById('displayFormBarcodeCanvas');
    if (!canvas) return;
    if (!value) {
      canvas.style.display = 'none';
      return;
    }
    if (typeof JsBarcode === 'undefined') {
      setTimeout(() => this._renderDisplayFormBarcode(value), 300);
      return;
    }
    try {
      JsBarcode(canvas, value, {
        format: 'CODE128', width: 2, height: 40,
        displayValue: true, fontSize: 13, margin: 4,
        background: '#ffffff', lineColor: '#000000'
      });
      canvas.style.display = 'block';
      canvas.style.margin = '0 auto';
    } catch(e) { console.warn('Barcode render error:', e); }
  }

  _renderEditDisplayBarcode(value) {
    const canvas = document.getElementById('editDisplayBarcodeCanvas');
    if (!canvas) return;
    if (!value) {
      canvas.style.display = 'none';
      return;
    }
    if (typeof JsBarcode === 'undefined') {
      setTimeout(() => this._renderEditDisplayBarcode(value), 300);
      return;
    }
    try {
      JsBarcode(canvas, value, {
        format: 'CODE128', width: 2, height: 40,
        displayValue: true, fontSize: 13, margin: 4,
        background: '#ffffff', lineColor: '#000000'
      });
      canvas.style.display = 'block';
    } catch(e) { console.warn('Barcode render error:', e); }
  }

  _renderSparePartsFormBarcode(value) {
    const canvas = document.getElementById('sparePartFormBarcodeCanvas');
    if (!canvas) return;
    if (typeof JsBarcode === 'undefined') {
      setTimeout(() => this._renderSparePartsFormBarcode(value), 300);
      return;
    }
    try {
      JsBarcode(canvas, value, {
        format: 'CODE128', width: 2, height: 40,
        displayValue: true, fontSize: 13, margin: 4,
        background: '#ffffff', lineColor: '#000000'
      });
      canvas.style.display = 'block';
      canvas.style.margin = '0 auto';
    } catch(e) { console.warn('Barcode render error:', e); }
  }

  _renderEditSparePartsBarcode(value) {
    const canvas = document.getElementById('editSparePartBarcodeCanvas');
    if (!canvas) return;
    if (typeof JsBarcode === 'undefined') {
      setTimeout(() => this._renderEditSparePartsBarcode(value), 300);
      return;
    }
    try {
      JsBarcode(canvas, value, {
        format: 'CODE128', width: 2, height: 40,
        displayValue: true, fontSize: 13, margin: 4,
        background: '#ffffff', lineColor: '#000000'
      });
      canvas.style.display = 'block';
    } catch(e) { console.warn('Barcode render error:', e); }
  }

  printSparePartLabel(partId, partName) {
    const barVal = (partId || '').trim();
    const dev = (partName || '').substring(0, 16);

    const win = window.open('', '_blank', 'width=920,height=480');
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Spare Part Label - ${barVal}</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      background: #f1f5f9;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 24px 16px;
      min-height: 100vh;
    }
    h2 { font-size: 17px; font-weight: 800; color: #1e293b; margin-bottom: 4px; }
    .hint { font-size: 12px; color: #64748b; margin-bottom: 18px; text-align:center; line-height:1.5; }
    .hint strong { color: #1e293b; }
    .scale-wrap {
      zoom: 2;
      margin-top: 12px;
      margin-bottom: 16px;
      flex-shrink: 0;
      max-width: 100%;
      overflow: hidden;
    }
    .strip {
      display: flex;
      flex-direction: row;
      width: 101.5mm;
      height: 25mm;
      background: #fff;
      border: 0.3mm solid #ccc;
    }
    .label {
      width: 33.83mm;
      height: 25mm;
      border-right: 0.2mm dashed #ccc;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 4.5mm 0.5mm 0 0.5mm;
      overflow: hidden;
      gap: 0;
    }
    .label:last-child { border-right: none; }
    .shop {
      font-size: 7.5pt;
      font-weight: 800;
      text-align: center;
      color: #000;
      line-height: 1.2;
      letter-spacing: 0.3px;
      white-space: nowrap;
      margin-bottom: 0.8mm;
    }
    svg.bc, canvas.bc {
      display: block;
      max-width: 31mm;
      width: 31mm;
      margin: 0 auto;
    }
    .barnum {
      font-size: 7pt;
      font-weight: 700;
      color: #000;
      letter-spacing: 1px;
      text-align: center;
      margin-top: 0.5mm;
      margin-bottom: 0.4mm;
    }
    .device {
      font-size: 7.5pt;
      font-weight: 800;
      color: #000;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 31mm;
      text-transform: uppercase;
      letter-spacing: 0.2px;
    }
    .print-btn {
      padding: 12px 44px;
      background: #1e293b;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0,0,0,0.18);
      margin-top: 8px;
    }
    .print-btn:hover { background: #0f172a; }
    .steps {
      margin-top: 12px;
      font-size: 11px;
      color: #64748b;
      text-align: center;
      line-height: 1.8;
    }
    .steps span { color: #1e293b; font-weight: 700; }
    @media print {
      @page {
        size: 25mm 101.5mm portrait;
        margin: 0;
      }
      html, body {
        width: 25mm;
        height: 101.5mm;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: #fff;
      }
      body * { visibility: hidden; }
      .print-strip, .print-strip * { visibility: visible; }
      .print-strip {
        display: flex !important;
        flex-direction: column !important;
        width: 25mm !important;
        height: 101.5mm !important;
        position: absolute;
        top: 0;
        left: 0;
      }
      .label {
        width: 25mm !important;
        height: 33.83mm !important;
        border-right: none !important;
        position: relative !important;
        overflow: hidden !important;
      }
      .label-inner {
        width: 33.83mm !important;
        height: 25mm !important;
        position: absolute !important;
        top: 4.415mm !important;
        left: -4.415mm !important;
        transform: rotate(90deg);
        transform-origin: center !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: flex-start !important;
        padding: 1.2mm 0.5mm 0.5mm 0.5mm !important;
        box-sizing: border-box !important;
      }
      h2, .hint, .print-btn, .steps, .scale-wrap { display: none !important; }
    }
  </style>
</head>
<body>
  <h2>🏷️ TSC Label Preview — ${barVal}</h2>
  <div class="hint">
    Paper: <strong>101.5 mm × 25 mm</strong> &nbsp;|&nbsp; 3 labels per strip<br>
    Select your <strong>TSC / Zenpert</strong> printer in the print dialog
  </div>
  <div class="scale-wrap">
    <div class="strip">
      <div class="label">
        <div class="shop">JIVI MOBILES</div>
        <canvas class="bc" id="bc1"></canvas>
        <div class="barnum">${barVal}</div>
        <div class="device">${dev}</div>
      </div>
      <div class="label">
        <div class="shop">JIVI MOBILES</div>
        <canvas class="bc" id="bc2"></canvas>
        <div class="barnum">${barVal}</div>
        <div class="device">${dev}</div>
      </div>
      <div class="label">
        <div class="shop">JIVI MOBILES</div>
        <canvas class="bc" id="bc3"></canvas>
        <div class="barnum">${barVal}</div>
        <div class="device">${dev}</div>
      </div>
    </div>
  </div>
  <button class="print-btn" onclick="window.print()">🖨️ Print to TSC Printer</button>
  <div class="steps">
    In the print dialog: &nbsp;
    ① Select <span>TSC / Zenpert</span> printer &nbsp;
    ② Paper size → <span>LABEL25</span> &nbsp;
    ③ Layout → <span>Portrait</span> &nbsp;
    ④ Margins → <span>None</span> &nbsp;
    ⑤ Click <span>Print</span>
  </div>
  <div class="print-strip" style="display:none;">
    <div class="label">
      <div class="label-inner">
        <div class="shop">JIVI MOBILES</div>
        <canvas class="bc" id="bcp1"></canvas>
        <div class="barnum">${barVal}</div>
        <div class="device">${dev}</div>
      </div>
    </div>
    <div class="label">
      <div class="label-inner">
        <div class="shop">JIVI MOBILES</div>
        <canvas class="bc" id="bcp2"></canvas>
        <div class="barnum">${barVal}</div>
        <div class="device">${dev}</div>
      </div>
    </div>
    <div class="label">
      <div class="label-inner">
        <div class="shop">JIVI MOBILES</div>
        <canvas class="bc" id="bcp3"></canvas>
        <div class="barnum">${barVal}</div>
        <div class="device">${dev}</div>
      </div>
    </div>
  </div>
  <script>
    window.onload = function() {
      if (typeof JsBarcode === 'undefined') {
        setTimeout(renderBarcodes, 800);
      } else {
        renderBarcodes();
      }
    };
    function renderBarcodes() {
      try {
        var opts = {
          format: 'CODE128',
          width: 1.5,
          height: 22,
          displayValue: false,
          margin: 0,
          background: '#ffffff',
          lineColor: '#000000'
        };
        ['bc1','bc2','bc3','bcp1','bcp2','bcp3'].forEach(function(id){
          var canvas = document.getElementById(id);
          if (!canvas) return;
          JsBarcode(canvas, '${barVal}', opts);
          canvas.style.width  = '30mm';
          canvas.style.height = '9.5mm';
        });
      } catch(e) { console.error('Barcode error:', e); }
    }
  <\/script>
</body>
</html>`);
    win.document.close();
    setTimeout(() => { try { win.focus(); } catch(e) {} }, 200);
  }

  async printSparePartTSCLabel(partId, partName) {
    const barVal = (partId || '').replace(/[^A-Za-z0-9]/g, '');
    const dev    = (partName || '').substring(0, 14).toUpperCase().replace(/"/g, '');

    const tspl = [
      'SIZE 101.5 mm, 25 mm',
      'GAP 2 mm, 0 mm',
      'DIRECTION 0,0',
      'REFERENCE 0,4',
      'OFFSET 0 mm',
      'SET PEEL OFF',
      'SET CUTTER OFF',
      'SET PARTIAL_CUTTER OFF',
      'SET TEAR OFF',
      'CLS',
      `BARCODE 225,114,"128M",30,0,180,2,4,"!104${barVal}"`,
      'CODEPAGE 1252',
      `TEXT 176,78,"0",180,8,8,"${barVal}"`,
      `TEXT 214,160,"0",180,10,10,"JIVI MOBILES"`,
      `TEXT 260,50,"0",180,8,8,"${dev}"`,
      `TEXT 261,50,"0",180,8,8,"${dev}"`,
      'BAR 96,12, 78, 2',
      'BAR 99,11, 1, 2',
      `BARCODE 496,114,"128M",30,0,180,2,4,"!104${barVal}"`,
      `TEXT 447,78,"0",180,8,8,"${barVal}"`,
      `TEXT 485,160,"0",180,10,10,"JIVI MOBILES"`,
      `TEXT 531,50,"0",180,8,8,"${dev}"`,
      `TEXT 532,50,"0",180,8,8,"${dev}"`,
      'BAR 367,12, 78, 2',
      'BAR 370,11, 1, 2',
      `BARCODE 766,114,"128M",30,0,180,2,4,"!104${barVal}"`,
      `TEXT 717,78,"0",180,8,8,"${barVal}"`,
      `TEXT 755,160,"0",180,10,10,"JIVI MOBILES"`,
      `TEXT 801,50,"0",180,8,8,"${dev}"`,
      `TEXT 802,50,"0",180,8,8,"${dev}"`,
      'BAR 637,12, 78, 2',
      'BAR 640,11, 1, 2',
      'PRINT 1,1'
    ].join('\r\n');

    try {
      const response = await fetch('http://localhost:9101/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tspl })
      });
      const result = await response.json();
      if (result.success) {
        const btn = document.activeElement;
        if (btn && btn.textContent) {
          const orig = btn.textContent;
          btn.textContent = '✅ Printed!';
          btn.style.background = '#10b981';
          setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 2000);
        }
        return;
      }
      throw new Error(result.error || 'Agent print failed');
    } catch (agentErr) {
      try {
        const response = await fetch(`${this.API_URL}/print-label`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tspl })
        });
        const result = await response.json();
        if (result.success) return;
        throw new Error(result.error);
      } catch (serverErr) {
        const blob = new Blob([tspl], { type: 'application/octet-stream' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = `label-${barVal}.prn`; a.click();
        URL.revokeObjectURL(url);
        alert('⚠️ Print agent not running.\n\nFile downloaded: label-' + barVal + '.prn\n\nTo enable one-click printing:\n1. Run print-agent/start-agent.bat on this PC\n2. Keep it running in the background');
      }
    }
  }

  setStockFilter(filter) {
    this.stockFilter = filter;
    if (this.currentPage === 'admin-products') {
      this.renderPage('admin-products');
    }
  }

  // POS BILLING SYSTEM (Product + Display Stock + Spare Parts Linked)
  openPOSBillingModal() {
    const existing = document.getElementById('posBillingModal');
    if (existing) existing.remove();

    this.posCart = [];
    this.posCategoryFilter = 'all';

    const modalHTML = `
      <div id="posBillingModal" style="position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
        <div style="background:#fff; border-radius:16px; padding:24px; width:100%; max-width:960px; max-height:92vh; display:flex; flex-direction:column; box-shadow:0 25px 70px rgba(0,0,0,0.5);">
          
          <!-- Header -->
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #e2e8f0; padding-bottom:12px; margin-bottom:16px;">
            <div>
              <h2 style="font-size:22px; font-weight:800; color:#1e293b; margin:0;">🧾 POS Customer Billing</h2>
              <p style="font-size:12px; color:#64748b; margin:2px 0 0 0;">Add Products, Display Stock &amp; Spare Parts, bill customer, print &amp; auto-deduct database stock</p>
            </div>
            <button onclick="document.getElementById('posBillingModal').remove()" style="background:#f1f5f9; color:#64748b; border:none; border-radius:50%; width:36px; height:36px; font-weight:800; font-size:18px; cursor:pointer;">✕</button>
          </div>

          <!-- Body Grid -->
          <div style="display:grid; grid-template-columns:1.25fr 1fr; gap:20px; flex:1; overflow:hidden;">
            
            <!-- Left: Select Items -->
            <div style="display:flex; flex-direction:column; overflow:hidden; border-right:1px solid #e2e8f0; padding-right:16px;">
              
              <!-- Category Filter Tabs -->
              <div style="display:flex; gap:6px; margin-bottom:10px; border-bottom:1px solid #e2e8f0; padding-bottom:8px; flex-wrap:wrap;">
                <button type="button" id="posTab_all" onclick="app.setPOSCategoryFilter('all')" style="padding:6px 12px; border-radius:6px; font-size:12px; font-weight:800; border:none; background:#1d4ed8; color:#fff; cursor:pointer;">🌐 All Items</button>
                <button type="button" id="posTab_product" onclick="app.setPOSCategoryFilter('product')" style="padding:6px 12px; border-radius:6px; font-size:12px; font-weight:800; border:1px solid #cbd5e1; background:#f1f5f9; color:#334155; cursor:pointer;">📦 Products</button>
                <button type="button" id="posTab_display" onclick="app.setPOSCategoryFilter('display')" style="padding:6px 12px; border-radius:6px; font-size:12px; font-weight:800; border:1px solid #cbd5e1; background:#f1f5f9; color:#334155; cursor:pointer;">📱 Display Stock</button>
                <button type="button" id="posTab_spare" onclick="app.setPOSCategoryFilter('spare')" style="padding:6px 12px; border-radius:6px; font-size:12px; font-weight:800; border:1px solid #cbd5e1; background:#f1f5f9; color:#334155; cursor:pointer;">🔩 Spare Parts</button>
              </div>

              <!-- Barcode Scanner Input -->
              <div style="background: #0f172a; border-radius: 8px; padding: 10px; margin-bottom: 10px; border: 1px solid #334155;">
                <label style="font-size: 11px; font-weight: 800; color: #38bdf8; display: block; margin-bottom: 4px;">📷 USB / Bluetooth Barcode Scanner</label>
                <div style="display: flex; gap: 6px;">
                  <input type="text" id="posBarcodeScannerInput" placeholder="⚡ Scan Barcode / Part ID / IMEI..." 
                    onkeydown="if(event.key === 'Enter') { event.preventDefault(); app.handlePOSBarcodeScan(this.value); this.value = ''; }"
                    autofocus
                    style="flex: 1; padding: 8px 12px; border: 2px solid #38bdf8; border-radius: 6px; font-size: 13px; font-weight: 800; background: #020617; color: #38bdf8; outline: none;">
                  <button type="button" onclick="app.handlePOSBarcodeScan(document.getElementById('posBarcodeScannerInput').value); document.getElementById('posBarcodeScannerInput').value = '';" style="padding: 8px 14px; background: #0284c7; color: #fff; border: none; border-radius: 6px; font-weight: 900; font-size: 12px; cursor: pointer;">
                    Scan
                  </button>
                </div>
              </div>

              <input type="text" id="posProductSearch" placeholder="🔍 Search product, display or spare part name/ID..." 
                oninput="app.filterPOSProducts(this.value)"
                style="width:100%; padding:9px 12px; border:1px solid #cbd5e1; border-radius:8px; font-size:12.5px; margin-bottom:10px; outline:none; background:#f8fafc; color:#111;">
              
              <div id="posProductList" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:8px; padding-right:4px;">
                ${this.renderPOSProductList('')}
              </div>
            </div>

            <!-- Right: Bill Details & Cart -->
            <div style="display:flex; flex-direction:column; overflow:hidden;">
              <h3 style="font-size:14px; font-weight:700; color:#334155; margin-bottom:8px;">👤 Customer &amp; Bill Items</h3>
              
              <!-- Customer Inputs -->
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:12px;">
                <input type="text" id="posCustName" placeholder="Customer Name *" style="padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px; background:#f8fafc; color:#111;">
                <input type="tel" id="posCustPhone" placeholder="Phone Number *" style="padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px; background:#f8fafc; color:#111;">
                <input type="text" id="posCustImei" placeholder="IMS / IMEI No." style="padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px; background:#f8fafc; color:#111;">
              </div>

              <!-- Cart Table -->
              <div style="flex:1; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px; padding:8px; background:#f8fafc; margin-bottom:12px;">
                <table style="width:100%; border-collapse:collapse; font-size:12px;">
                  <thead>
                    <tr style="border-bottom:1px solid #cbd5e1; color:#475569; text-align:left;">
                      <th style="padding:4px;">Item</th>
                      <th style="padding:4px; text-align:center;">Qty</th>
                      <th style="padding:4px; text-align:right;">Price</th>
                      <th style="padding:4px; text-align:center;">Action</th>
                    </tr>
                  </thead>
                  <tbody id="posCartBody">
                    <tr><td colspan="4" style="text-align:center; padding:20px; color:#94a3b8;">Cart is empty. Select items from left panel.</td></tr>
                  </tbody>
                </table>
              </div>

              <!-- Payment Details -->
              <div style="background:#f1f5f9; border-radius:8px; padding:12px; display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size:13px; font-weight:700; color:#334155;">Discount (₹):</span>
                  <input type="number" id="posDiscount" value="0" min="0" oninput="app.updatePOSTotals()" style="width:90px; padding:4px 8px; border:1px solid #cbd5e1; border-radius:4px; text-align:right; font-weight:700; font-size:13px; background:#fff; color:#111;">
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size:13px; font-weight:700; color:#334155;">Payment Method:</span>
                  <select id="posPaymentMethod" style="padding:4px 8px; border:1px solid #cbd5e1; border-radius:4px; font-size:12px; font-weight:700; background:#fff; color:#111;">
                    <option value="Cash">💵 Cash</option>
                    <option value="UPI">📱 UPI / QR</option>
                    <option value="Card">💳 Card</option>
                    <option value="Credit">📜 Credit / Pending</option>
                  </select>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1.5px solid #cbd5e1; padding-top:8px; margin-top:4px;">
                  <span style="font-size:16px; font-weight:900; color:#0f172a;">FINAL TOTAL:</span>
                  <span id="posGrandTotal" style="font-size:22px; font-weight:900; color:#059669;">₹0</span>
                </div>
              </div>

              <!-- ✍️ Proof Signature Pad in POS Modal -->
              <div style="background: #f0f9ff; border: 1.5px dashed #0284c7; border-radius: 8px; padding: 10px; margin-top: 8px;">
                <div style="font-size: 11.5px; font-weight: 800; color: #0f172a; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
                  <span>✍️ Mobile Owner Proof Signature (Thin Pen)</span>
                  <button type="button" onclick="app.clearSignatureCanvas('posSignatureCanvas')" style="background: #fee2e2; color: #dc2626; border: 1px solid #dc2626; border-radius: 4px; padding: 2px 6px; font-size: 10px; font-weight: 800; cursor: pointer;">Clear Signature</button>
                </div>
                <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px; width: 100%;">
                  <canvas id="posSignatureCanvas" style="width: 100%; height: 90px; touch-action: none; cursor: crosshair; display: block; border-radius: 4px; background: #fff;"></canvas>
                </div>
              </div>

              <!-- Submit Buttons -->
              <div style="display:flex; gap:10px; margin-top:12px;">
                <button onclick="app.processPOSCheckout(true)" style="flex:1; background:linear-gradient(135deg, #10b981, #059669); color:#fff; border:none; border-radius:8px; padding:12px; font-size:14px; font-weight:800; cursor:pointer;">
                  🖨️ Bill, Print &amp; Deduct Stock
                </button>
                <button onclick="app.processPOSCheckout(false)" style="background:#1e293b; color:#fff; border:none; border-radius:8px; padding:12px 16px; font-size:13px; font-weight:700; cursor:pointer;">
                  💾 Save Bill Only
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    this.tempPOSPhotos = [];
    setTimeout(() => {
      this.initSignatureCanvas('posSignatureCanvas');
    }, 150);
  }

  setPOSCategoryFilter(cat) {
    this.posCategoryFilter = cat || 'all';
    ['all', 'product', 'display', 'spare'].forEach(c => {
      const tab = document.getElementById(`posTab_${c}`);
      if (tab) {
        if (c === this.posCategoryFilter) {
          tab.style.background = '#1d4ed8';
          tab.style.color = '#ffffff';
          tab.style.border = 'none';
        } else {
          tab.style.background = '#f1f5f9';
          tab.style.color = '#334155';
          tab.style.border = '1px solid #cbd5e1';
        }
      }
    });
    this.filterPOSProducts(document.getElementById('posProductSearch')?.value || '');
  }

  openPOSBillingWithItem(type, itemId) {
    this.openPOSBillingModal();
    setTimeout(() => {
      if (type) this.setPOSCategoryFilter(type);
      this.addToPOSCart(itemId, type);
    }, 100);
  }

  getAllPOSItems() {
    const prods = (this.products || []).map(p => ({
      id: p._id || p.id,
      name: p.name || 'Unnamed Product',
      category: p.category || 'Product',
      price: Number(p.price) || 0,
      stock: Number(p.stock) || 0,
      minStock: Number(p.minStock) || 5,
      type: 'product',
      icon: '📦',
      badgeText: 'Product'
    }));

    const displays = (this.displayStock || []).map(d => ({
      id: d.stockItemId || d._id,
      name: d.displayName || d.itemName || 'Unnamed Display',
      category: d.displayId || 'Display Stock',
      price: Number(d.sellingPrice || d.price) || 0,
      stock: Number(d.stock) || 0,
      minStock: 1,
      type: 'display',
      icon: '📱',
      badgeText: 'Display'
    }));

    const spares = (this.sparePartsStock || []).map(s => ({
      id: s.partItemId || s._id,
      name: s.partName || s.itemName || 'Unnamed Spare Part',
      category: s.partId || 'Spare Part',
      price: Number(s.customerPrice || s.sellingPrice || s.price) || 0,
      stock: Number(s.stock) || 0,
      minStock: 1,
      type: 'spare',
      icon: '🔩',
      badgeText: 'Spare Part'
    }));

    return [...prods, ...displays, ...spares];
  }

  filterPOSProducts(query) {
    let q = (query || '').toLowerCase().trim();
    if (q.length >= 3) {
      const allItems = this.getAllPOSItems();
      const matched = allItems.find(item => 
        String(item.id).toLowerCase() === q ||
        String(item.category).toLowerCase() === q ||
        (item.type === 'product' && (this.stockEntries || []).some(e => 
          (e.barcode || '').toLowerCase() === q || (e.imei1 || '').toLowerCase() === q
        ))
      );
      if (matched) {
        this.addToPOSCart(matched.id, matched.type);
        const searchInput = document.getElementById('posProductSearch');
        if (searchInput) searchInput.value = '';
        q = '';
      }
    }

    const listEl = document.getElementById('posProductList');
    if (listEl) {
      listEl.innerHTML = this.renderPOSProductList(q);
    }
  }

  renderPOSProductList(query) {
    const q = (query || '').toLowerCase().trim();
    const catFilter = this.posCategoryFilter || 'all';

    let available = this.getAllPOSItems();

    if (catFilter !== 'all') {
      available = available.filter(item => item.type === catFilter);
    }

    if (q) {
      available = available.filter(item => 
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        String(item.id).toLowerCase().includes(q)
      );
    }

    if (available.length === 0) {
      return `<div style="text-align:center; padding:20px; color:#94a3b8; font-size:13px;">No items match your search or filter</div>`;
    }

    return available.map(item => {
      const stock = Number(item.stock) || 0;
      const minStock = Number(item.minStock) || 1;
      const isOut = stock === 0;
      const isLow = stock > 0 && stock <= minStock;

      const badgeColor = isOut ? '#fee2e2; color:#dc2626;' : isLow ? '#fef3c7; color:#d97706;' : '#dcfce7; color:#15803d;';
      const stockText = isOut ? 'Out of Stock' : isLow ? `Low Stock (${stock})` : `In Stock (${stock})`;
      const typeBadgeColor = item.type === 'display' ? '#e0f2fe; color:#0369a1;' : item.type === 'spare' ? '#fef3c7; color:#b45309;' : '#f3e8ff; color:#6b21a8;';

      return `
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 12px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px; background:${typeBadgeColor}">${item.icon} ${item.badgeText}</span>
              <span style="font-weight:700; color:#1e293b; font-size:13px;">${item.name}</span>
            </div>
            <div style="font-size:11px; color:#64748b; margin-top:3px;">${item.category} &nbsp;·&nbsp; <strong style="color:#059669;">₹${(Number(item.price) || 0).toLocaleString('en-IN')}</strong></div>
            <span style="display:inline-block; font-size:10px; font-weight:800; padding:2px 8px; border-radius:12px; background:${badgeColor} margin-top:4px;">${stockText}</span>
          </div>
          <button onclick="app.addToPOSCart('${item.id}', '${item.type}')" ${isOut ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''} style="background:#1d4ed8; color:#fff; border:none; border-radius:6px; padding:6px 12px; font-size:12px; font-weight:700; cursor:pointer;">
            + Add
          </button>
        </div>
      `;
    }).join('');
  }

  addToPOSCart(itemId, type = 'product') {
    const allItems = this.getAllPOSItems();
    const item = allItems.find(i => String(i.id) === String(itemId) && i.type === type);
    if (!item) return;

    const existing = this.posCart.find(c => String(c.id) === String(itemId) && c.type === type);
    const currentStock = Number(item.stock) || 0;

    if (existing) {
      if (existing.quantity >= currentStock) {
        alert(`Cannot add more. Only ${currentStock} units available in stock!`);
        return;
      }
      existing.quantity += 1;
    } else {
      if (currentStock < 1) {
        alert('Item is currently out of stock!');
        return;
      }
      this.posCart.push({
        id: item.id,
        name: item.name,
        price: Number(item.price) || 0,
        quantity: 1,
        type: item.type,
        icon: item.icon
      });
    }

    this.renderPOSCart();
  }

  updatePOSItemQty(itemId, type, qty) {
    const cartItem = this.posCart.find(i => String(i.id) === String(itemId) && i.type === type);
    const allItems = this.getAllPOSItems();
    const sourceItem = allItems.find(i => String(i.id) === String(itemId) && i.type === type);

    if (!cartItem) return;
    const val = parseInt(qty, 10);
    if (isNaN(val) || val <= 0) {
      this.posCart = this.posCart.filter(i => !(String(i.id) === String(itemId) && i.type === type));
    } else {
      const currentStock = Number(sourceItem?.stock || 9999);
      if (val > currentStock) {
        alert(`Only ${currentStock} units available in stock!`);
        cartItem.quantity = currentStock;
      } else {
        cartItem.quantity = val;
      }
    }
    this.renderPOSCart();
  }

  removePOSItem(itemId, type) {
    this.posCart = this.posCart.filter(i => !(String(i.id) === String(itemId) && i.type === type));
    this.renderPOSCart();
  }

  renderPOSCart() {
    const body = document.getElementById('posCartBody');
    if (!body) return;

    if (this.posCart.length === 0) {
      body.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#94a3b8;">Cart is empty. Select items from left panel.</td></tr>`;
      this.updatePOSTotals();
      return;
    }

    body.innerHTML = this.posCart.map(item => `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:6px 4px; font-weight:600; color:#1e293b;">
          <span style="font-size:11px; margin-right:4px;">${item.icon || '📦'}</span>${item.name}
        </td>
        <td style="padding:6px 4px; text-align:center;">
          <input type="number" value="${item.quantity}" min="1" onchange="app.updatePOSItemQty('${item.id}', '${item.type}', this.value)" style="width:45px; text-align:center; border:1px solid #cbd5e1; border-radius:4px; font-weight:700;">
        </td>
        <td style="padding:6px 4px; text-align:right; font-weight:700; color:#059669;">₹${(item.price * item.quantity).toLocaleString('en-IN')}</td>
        <td style="padding:6px 4px; text-align:center;">
          <button onclick="app.removePOSItem('${item.id}', '${item.type}')" style="background:none; border:none; color:#ef4444; font-weight:800; cursor:pointer;">✕</button>
        </td>
      </tr>
    `).join('');

    this.updatePOSTotals();
  }

  updatePOSTotals() {
    const subtotal = this.posCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discount = Number(document.getElementById('posDiscount')?.value || 0);
    const grandTotal = Math.max(0, subtotal - discount);

    const totalEl = document.getElementById('posGrandTotal');
    if (totalEl) {
      totalEl.textContent = `₹${grandTotal.toLocaleString('en-IN')}`;
    }
  }

  async processPOSCheckout(shouldPrint) {
    const custName = document.getElementById('posCustName')?.value?.trim();
    const custPhone = document.getElementById('posCustPhone')?.value?.trim();
    const discount = Number(document.getElementById('posDiscount')?.value || 0);
    const paymentMethod = document.getElementById('posPaymentMethod')?.value || 'Cash';

    if (!custName || !custPhone) {
      alert('Please enter Customer Name and Phone Number.');
      return;
    }

    if (this.posCart.length === 0) {
      alert('Cart is empty! Select at least one product or item.');
      return;
    }

    const subtotal = this.posCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const grandTotal = Math.max(0, subtotal - discount);

    if (this.isProcessingPOSCheckout) {
      console.log('⚠️ POS checkout already processing, ignoring duplicate click');
      return;
    }
    this.isProcessingPOSCheckout = true;

    // Lock UI buttons against double clicks
    const posModal = document.getElementById('posBillingModal');
    if (posModal) {
      const btns = posModal.querySelectorAll('button');
      btns.forEach(b => { b.disabled = true; b.style.opacity = '0.6'; });
    }

    const custImei = document.getElementById('posCustImei')?.value?.trim() || '';
    const proofImages = [...(this.tempPOSPhotos || [])];
    const signatureImage = this.getSignatureDataURL('posSignatureCanvas');

    const salePayload = {
      customerName: custName,
      phoneNumber: custPhone,
      imeiNumber: custImei,
      imsNumber: custImei,
      productName: this.posCart.map(i => `${i.name} (${i.quantity})`).join(', '),
      productItems: this.posCart.map(i => ({ 
        id: i.id || i.productId, 
        name: i.name, 
        quantity: i.quantity, 
        price: i.price,
        type: i.type,
        scannedUnits: i.scannedUnits || []
      })),
      proofImages,
      signatureImage,
      saleAmount: subtotal,
      discount: discount,
      netAmount: grandTotal,
      paymentMethod: paymentMethod,
      purchaseDate: new Date().toLocaleDateString('en-IN'),
      warrantyPeriod: "1 Year",
      notes: `POS Bill - ${paymentMethod}`
    };

    try {
      const response = await fetch(`${this.API_URL}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(salePayload)
      });

      if (response.ok) {
        const savedSale = await response.json();
        console.log('✅ Sales Record saved & stock auto-deducted:', savedSale);

        // Instantly reload fresh sales history and stock from MongoDB for all modules
        await this.loadSalesFromStorage();
        await this.loadProductsFromStorage();
        if (typeof this.loadDisplayStockFromStorage === 'function') {
          await this.loadDisplayStockFromStorage();
        }
        if (typeof this.loadSparePartsFromStorage === 'function') {
          await this.loadSparePartsFromStorage();
        }
        if (typeof this.loadStockEntriesFromStorage === 'function') {
          await this.loadStockEntriesFromStorage();
        }

        alert('✅ Bill Created & Item Stock Permanently Deducted in Database!');

        document.getElementById('posBillingModal')?.remove();

        if (shouldPrint) {
          this.printPOSCustomerBill(savedSale, this.posCart, grandTotal, discount, paymentMethod, custName, custPhone);
        }

        this.posCart = [];
        this.renderPage(this.currentPage);
      } else {
        alert('❌ Failed to process sale. Please check server connection.');
      }
    } catch (err) {
      console.error('❌ POS Billing checkout error:', err);
      alert('❌ Error processing bill checkout.');
    } finally {
      this.isProcessingPOSCheckout = false;
      if (posModal) {
        const btns = posModal.querySelectorAll('button');
        btns.forEach(b => { b.disabled = false; b.style.opacity = '1'; });
      }
    }
  }

  printPOSCustomerBill(saleRecord, cartItems, total, discount, paymentMethod, customerName, phone) {
    const shop = this.shopConfig;
    const win = window.open('', '_blank', 'width=700,height=750');

    const itemRows = cartItems.map((item, i) => `
      <tr>
        <td style="padding:6px; border-bottom:1px solid #eee;">${i+1}</td>
        <td style="padding:6px; border-bottom:1px solid #eee; font-weight:700;">${item.name}</td>
        <td style="padding:6px; border-bottom:1px solid #eee; text-align:center;">${item.quantity}</td>
        <td style="padding:6px; border-bottom:1px solid #eee; text-align:right;">₹${(item.price).toLocaleString('en-IN')}</td>
        <td style="padding:6px; border-bottom:1px solid #eee; text-align:right; font-weight:700;">₹${(item.price * item.quantity).toLocaleString('en-IN')}</td>
      </tr>
    `).join('');

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Customer Bill #${saleRecord.saleId}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #111; max-width: 550px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
          .shop-title { font-size: 22px; font-weight: 900; color: #1e293b; text-transform: uppercase; }
          .shop-sub { font-size: 11px; color: #475569; margin-top: 2px; }
          .bill-title { text-align: center; font-size: 14px; font-weight: 800; margin: 10px 0; background: #f1f5f9; padding: 4px; border-radius: 4px; }
          .details-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
          th { background: #f1f5f9; padding: 6px; text-align: left; border-bottom: 2px solid #cbd5e1; }
          .total-box { margin-top: 15px; border-top: 2px solid #000; padding-top: 8px; font-size: 13px; }
          .total-row { display: flex; justify-content: space-between; font-weight: 900; font-size: 16px; margin-top: 4px; }
          .footer { text-align: center; font-size: 11px; color: #64748b; margin-top: 25px; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="shop-title">${shop.shopName}</div>
          <div class="shop-sub">${shop.tagline || 'Mobile Repair & Spares'}</div>
          <div class="shop-sub">${shop.address}</div>
          <div class="shop-sub">Ph: ${shop.phone} | ${shop.email}</div>
        </div>

        <div class="bill-title">TAX INVOICE / CASH MEMO</div>

        <div class="details-row"><span>Bill No: <strong>${saleRecord.saleId}</strong></span><span>Date: ${saleRecord.purchaseDate}</span></div>
        <div class="details-row"><span>Customer: <strong>${customerName}</strong></span><span>Phone: ${phone}</span></div>
        ${(saleRecord.imeiNumber || saleRecord.imsNumber) ? `<div class="details-row"><span>IMS / IMEI No:</span><span style="font-family:monospace; font-weight:800;">${saleRecord.imeiNumber || saleRecord.imsNumber}</span></div>` : ''}
        <div class="details-row"><span>Payment Mode: <strong>${paymentMethod}</strong></span></div>

        <table>
          <thead>
            <tr><th>#</th><th>Item Description</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Rate</th><th style="text-align:right;">Amount</th></tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>

        <div class="total-box">
          ${discount > 0 ? `<div class="details-row"><span>Discount:</span><span>- ₹${discount.toLocaleString('en-IN')}</span></div>` : ''}
          <div class="total-row"><span>NET AMOUNT:</span><span>₹${total.toLocaleString('en-IN')}</span></div>
        </div>

        <!-- Proof Photos in POS Bill -->
        ${saleRecord.proofImages && saleRecord.proofImages.length > 0 ? `
        <div style="margin-top:12px; text-align:center; border-top:1px dashed #cbd5e1; padding-top:8px;">
          <div style="font-size:11px; font-weight:800; color:#334155; margin-bottom:4px;">PROOF PHOTOS</div>
          <div style="display:flex; gap:4px; justify-content:center; flex-wrap:wrap;">
            ${saleRecord.proofImages.map(img => `<img src="${img}" style="width:60px; height:45px; object-fit:contain; border:1px solid #ccc; border-radius:4px;">`).join('')}
          </div>
        </div>` : ''}

        <!-- Customer Signature in POS Bill -->
        ${saleRecord.signatureImage ? `
        <div style="margin-top:12px; text-align:center; border-top:1px dashed #cbd5e1; padding-top:8px;">
          <div style="font-size:11px; font-weight:800; color:#334155;">CUSTOMER SIGNATURE</div>
          <img src="${saleRecord.signatureImage}" style="max-height:50px; max-width:180px; object-fit:contain; margin-top:2px;">
        </div>` : ''}

        <div class="footer">
          Thank you for your business! Visit Again 🙏<br>
          <em>Goods once sold will be serviced per standard warranty terms.</em>
        </div>

        <br>
        <div style="text-align:center;">
          <button onclick="window.print()" style="padding:10px 24px; background:#0f172a; color:#fff; border:none; border-radius:6px; font-size:14px; font-weight:700; cursor:pointer;">🖨️ Print Bill</button>
        </div>
      </body>
      </html>
    `);

    win.document.close();
    setTimeout(() => { try { win.focus(); } catch(e) {} }, 200);
  }

  // POS BARCODE SCANNER LOGIC
  handlePOSBarcodeScan(barcodeStr) {
    const bCode = (barcodeStr || '').trim();
    if (!bCode) return;

    console.log('⚡ Scanning POS Barcode:', bCode);
    const lowerCode = bCode.toLowerCase();

    // 1. Direct cross-inventory match (Products, Display Stock, Spare Parts)
    const allItems = this.getAllPOSItems();
    const matched = allItems.find(i => 
      String(i.id) === bCode ||
      (i.barcode && i.barcode.toLowerCase() === lowerCode) ||
      (i.raw && (i.raw.sku === bCode || i.raw.barcode === bCode || i.raw.imei1 === bCode || i.raw.imei2 === bCode || i.raw.stockItemId === bCode || i.raw.partItemId === bCode))
    );

    if (matched) {
      this.addToPOSCart(matched.id, matched.type);
      alert(`✅ Scanned & added "${matched.name}" to POS cart!`);
      return;
    }

    // 2. Find matching stock entry in inventory
    const entry = (this.stockEntries || []).find(e => 
      (e.barcode || '').toLowerCase() === lowerCode ||
      (e.imei1 || '').toLowerCase() === lowerCode ||
      (e.imei2 || '').toLowerCase() === lowerCode ||
      (e.serialNumber || '').toLowerCase() === lowerCode
    );

    if (!entry) {
      alert(`❌ Invalid / Unknown Barcode!\n\nBarcode "${bCode}" is not found in the inventory system.`);
      return;
    }

    if (entry.status === 'Out of Stock' || (Number(entry.currentQuantity) || 0) <= 0) {
      alert(`⚠️ This item (${bCode}) has already been sold!\n\nStatus: Out of Stock\nDistributor: ${entry.dealerName || 'Direct'}`);
      return;
    }

    // Find Master Product
    const product = (this.products || []).find(p => String(p.id || p._id) === String(entry.masterId));
    if (!product) {
      alert(`❌ Product associated with barcode "${bCode}" was not found.`);
      return;
    }

    const pId = product._id || product.id;
    let cartItem = this.posCart.find(i => String(i.productId) === String(pId));

    const unitInfo = {
      stockId: entry.stockId,
      barcode: entry.barcode,
      dealerId: entry.dealerId,
      dealerName: entry.dealerName,
      imei1: entry.imei1,
      serialNumber: entry.serialNumber,
      purchasePrice: entry.purchasePrice
    };

    if (cartItem) {
      cartItem.quantity += 1;
      cartItem.scannedUnits = cartItem.scannedUnits || [];
      cartItem.scannedUnits.push(unitInfo);
    } else {
      this.posCart.push({
        productId: pId,
        name: product.name,
        price: product.price,
        quantity: 1,
        type: 'product',
        scannedUnits: [unitInfo]
      });
    }

    // 5. Update UI & Audio Feedback
    const cartBody = document.getElementById('posCartBody');
    if (cartBody) {
      cartBody.innerHTML = this.renderPOSCartRows();
    }
    this.updatePOSTotals();

    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch(e) {}

    // Focus input for next scan
    const scannerInput = document.getElementById('posBarcodeScannerInput');
    if (scannerInput) {
      scannerInput.value = '';
      scannerInput.focus();
    }
  }

  // BARCODE PRINTING OPTION - Generates All Purchased Quantity Barcode Labels
  printStockBarcodeSticker(barcode) {
    const entry = (this.stockEntries || []).find(e => e.barcode === barcode) || {
      barcode: barcode || 'STK-PROD-0001',
      masterName: 'Product Unit',
      dealerName: 'Distributor',
      initialQuantity: 1,
      currentQuantity: 1,
      purchaseDate: new Date().toISOString().split('T')[0],
      sellingPrice: 0,
      mrp: 0
    };

    const totalPcs = Number(entry.initialQuantity || entry.quantity || 1);
    const shop = this.shopConfig || { shopName: 'ஜிவி மொபைல்ஸ் — Jivi Mobiles' };
    const priceVal = entry.sellingPrice || entry.mrp || 0;
    const priceStr = priceVal > 0 ? `₹${priceVal.toLocaleString('en-IN')}` : '';

    const win = window.open('', '_blank', 'width=950,height=750');
    if (!win) {
      alert('Please allow popups to print barcode label stickers.');
      return;
    }

    // Build array of unit barcode items (e.g. 10 items for 10 pcs)
    const labelItems = [];
    for (let i = 0; i < totalPcs; i++) {
      const unitCode = totalPcs > 1 ? `${entry.barcode}-${String(i + 1).padStart(2, '0')}` : entry.barcode;
      labelItems.push({
        index: i + 1,
        barcode: unitCode,
        rawBarcode: entry.barcode
      });
    }

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Barcode Labels (${totalPcs} Pcs) - ${entry.barcode}</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: system-ui, -apple-system, Arial, sans-serif;
            background: #f1f5f9;
            color: #0f172a;
            padding: 24px;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .header-bar {
            background: #1e293b;
            color: #fff;
            padding: 16px 24px;
            border-radius: 12px;
            width: 100%;
            max-width: 900px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          }
          .header-title h2 { font-size: 18px; font-weight: 800; }
          .header-title p { font-size: 12px; color: #94a3b8; margin-top: 2px; }
          .btn-container { display: flex; gap: 10px; }
          .btn {
            padding: 10px 18px;
            border: none;
            border-radius: 8px;
            font-weight: 800;
            font-size: 13px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .btn-print { background: #059669; color: #fff; }
          .btn-close { background: #475569; color: #fff; }

          /* Stickers Grid (Matching TSC & Thermal Label Printing) */
          .labels-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(48mm, 1fr));
            gap: 12mm;
            width: 100%;
            max-width: 900px;
          }

          .sticker-card {
            width: 48mm;
            height: 32mm;
            border: 1.5px solid #000;
            border-radius: 6px;
            padding: 6px;
            background: #fff;
            text-align: center;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            box-sizing: border-box;
            page-break-inside: avoid;
            margin: 0 auto;
          }

          .shop-title {
            font-size: 8pt;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: #000;
          }

          .product-name {
            font-size: 8.5pt;
            font-weight: 800;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: #1e293b;
            margin-top: 1px;
          }

          svg.bc-svg {
            width: 100%;
            height: 28px;
            display: block;
            margin: 2px 0;
          }

          .barcode-text {
            font-size: 7.5pt;
            font-weight: 800;
            font-family: monospace;
            letter-spacing: 0.5px;
            color: #000;
          }

          .footer-details {
            font-size: 6.5pt;
            font-weight: 700;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px solid #e2e8f0;
            padding-top: 2px;
            margin-top: 2px;
          }

          .pcs-tag {
            background: #1e293b;
            color: #fff;
            padding: 1px 4px;
            border-radius: 3px;
            font-weight: 800;
            font-size: 6pt;
          }

          @media print {
            body { background: #fff; padding: 0; }
            .header-bar { display: none; }
            .labels-grid {
              display: flex;
              flex-wrap: wrap;
              gap: 2mm;
              max-width: 100%;
            }
            .sticker-card {
              border: 0.5px solid #999;
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="header-bar">
          <div class="header-title">
            <h2>🏷️ Thermal Barcode Labels (${totalPcs} Purchased Pieces)</h2>
            <p>Product: ${entry.masterName} | Supplier: ${entry.dealerName || 'Direct'} | Batch Barcode: ${entry.barcode}</p>
          </div>
          <div class="btn-container">
            <button class="btn btn-print" onclick="window.print()">🖨️ Print All ${totalPcs} Labels</button>
            <button class="btn btn-close" onclick="window.close()">✕ Close</button>
          </div>
        </div>

        <div class="labels-grid">
          ${labelItems.map((item) => `
            <div class="sticker-card">
              <div class="shop-title">${shop.shopName || 'JIVI MOBILES'}</div>
              <div class="product-name">${entry.masterName}</div>
              <svg id="bc_${item.index}" class="bc-svg"></svg>
              <div class="barcode-text">${item.barcode}</div>
              <div class="footer-details">
                <span>Dist: ${(entry.dealerName || 'Direct').substring(0, 10)}</span>
                <span class="pcs-tag">Pcs ${item.index}/${totalPcs}</span>
                <span>${priceStr}</span>
              </div>
            </div>
          `).join('')}
        </div>

        <script>
          window.onload = function() {
            ${labelItems.map((item) => `
              try {
                JsBarcode("#bc_${item.index}", "${item.barcode}", {
                  format: "CODE128",
                  height: 26,
                  fontSize: 8,
                  displayValue: false,
                  margin: 1
                });
              } catch(e) { console.error('JsBarcode error for #${item.index}:', e); }
            `).join('')}
          };
        <\/script>
      </body>
      </html>
    `);
    win.document.close();
  }

  // ===== FULL STOCK INVENTORY MODULE =====
  getFullStockCombinedData() {
    const productsList = (this.products || []).map(p => ({
      module: 'Product',
      moduleIcon: '📦',
      id: p.id || p._id || p.productId || 'PROD',
      name: p.name || p.title || 'Unnamed Product',
      category: p.category || 'General Product',
      brand: p.brand || p.model || '-',
      price: Number(p.price || p.mrp || 0),
      stock: Number(p.stock || 0),
      raw: p
    }));

    const displayStockList = (this.displayStock || []).map(d => ({
      module: 'Display Stock',
      moduleIcon: '📱',
      id: d.stockItemId || d._id || 'DS',
      name: d.name || d.itemName || 'Unnamed Display',
      category: d.category || d.type || 'Display Stock',
      brand: d.quality || d.grade || d.brand || d.model || '-',
      price: Number(d.sellingPrice || d.price || 0),
      stock: Number(d.stock || 0),
      raw: d
    }));

    const sparePartsList = (this.sparePartsStock || []).map(s => ({
      module: 'Spare Part',
      moduleIcon: '🔩',
      id: s.partItemId || s._id || 'SP',
      name: s.name || s.itemName || s.partName || 'Unnamed Part',
      category: s.category || s.partType || 'Spare Part',
      brand: s.brand || s.model || '-',
      price: Number(s.customerPrice || s.sellingPrice || s.price || 0),
      stock: Number(s.stock || 0),
      raw: s
    }));

    return [...productsList, ...displayStockList, ...sparePartsList];
  }

  renderFullStockInventory() {
    const allItems = this.getFullStockCombinedData();
    const categories = Array.from(new Set(allItems.map(i => i.category).filter(Boolean))).sort();

    // Filters
    const moduleFilter = this.fullStockModuleFilter || 'all';
    const categoryFilter = this.fullStockCategoryFilter || 'all';
    const statusFilter = this.fullStockStatusFilter || 'all';
    const searchQuery = (this.fullStockSearch || '').toLowerCase().trim();

    // Apply filtering
    const filteredItems = allItems.filter(item => {
      // Module check
      if (moduleFilter !== 'all' && item.module.toLowerCase().replace(/\s+/g, '') !== moduleFilter.toLowerCase().replace(/\s+/g, '')) {
        return false;
      }
      // Category check
      if (categoryFilter !== 'all' && item.category.toLowerCase() !== categoryFilter.toLowerCase()) {
        return false;
      }
      // Status check
      if (statusFilter === 'in-stock' && item.stock <= 0) return false;
      if (statusFilter === 'low-stock' && (item.stock < 1 || item.stock > 2)) return false;
      if (statusFilter === 'out-stock' && item.stock > 0) return false;

      // Search query check
      if (searchQuery) {
        const text = `${item.name} ${item.id} ${item.category} ${item.brand} ${item.module}`.toLowerCase();
        if (!text.includes(searchQuery)) return false;
      }

      return true;
    });

    // KPI Metrics
    const totalItemsCount = filteredItems.length;
    const totalStockUnits = filteredItems.reduce((sum, item) => sum + item.stock, 0);
    const totalStockValuation = filteredItems.reduce((sum, item) => sum + (item.stock * item.price), 0);
    const lowStockAlertCount = filteredItems.filter(i => i.stock <= 2).length;

    const rowsHTML = filteredItems.length > 0
      ? filteredItems.map((item, idx) => {
          const itemValuation = item.stock * item.price;
          const stockBadgeStyle = item.stock === 0
            ? 'background:#fef2f2; color:#dc2626; border:1px solid #fecaca;'
            : item.stock <= 2
              ? 'background:#fffbeb; color:#d97706; border:1px solid #fde68a;'
              : 'background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0;';
          const stockText = item.stock === 0 ? 'Out of Stock (0)' : item.stock <= 2 ? `Low Stock (${item.stock})` : `${item.stock} Units`;

          const moduleBadgeStyle = item.module === 'Product'
            ? 'background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe;'
            : item.module === 'Display Stock'
              ? 'background:#faf5ff; color:#7e22ce; border:1px solid #e9d5ff;'
              : 'background:#fff7ed; color:#c2410c; border:1px solid #ffedd5;';

          return `
            <tr style="border-bottom:1px solid #e2e8f0; transition:background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
              <td style="padding:14px; font-weight:700; color:#64748b; text-align:center;">${idx + 1}</td>
              <td style="padding:14px;">
                <span style="display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:20px; font-size:12px; font-weight:700; ${moduleBadgeStyle}">
                  <span>${item.moduleIcon}</span> ${item.module}
                </span>
              </td>
              <td style="padding:14px;">
                <div style="font-weight:700; color:#0f172a; font-size:15px;">${item.name}</div>
                <div style="font-size:12px; color:#64748b; margin-top:2px;">ID: <span style="font-family:monospace; font-weight:600; color:#334155;">#${item.id}</span></div>
              </td>
              <td style="padding:14px;">
                <span style="background:#f1f5f9; color:#334155; padding:4px 10px; border-radius:6px; font-size:12px; font-weight:600; border:1px solid #e2e8f0;">
                  📁 ${item.category}
                </span>
              </td>
              <td style="padding:14px; font-size:13px; color:#475569; font-weight:600;">
                ${item.brand}
              </td>
              <td style="padding:14px; font-weight:700; color:#0f172a; font-size:15px; text-align:right;">
                ₹${item.price.toLocaleString('en-IN')}
              </td>
              <td style="padding:14px; text-align:center;">
                <span style="display:inline-block; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:800; ${stockBadgeStyle}">
                  ${stockText}
                </span>
              </td>
              <td style="padding:14px; font-weight:800; color:#059669; font-size:15px; text-align:right;">
                ₹${itemValuation.toLocaleString('en-IN')}
              </td>
            </tr>
          `;
        }).join('')
      : `
        <tr>
          <td colspan="8" style="text-align:center; padding:60px 20px; color:#94a3b8;">
            <div style="font-size:48px; margin-bottom:12px;">🔍</div>
            <div style="font-size:18px; font-weight:700; color:#334155; margin-bottom:4px;">No Inventory Items Found</div>
            <div style="font-size:14px;">Try adjusting your category filters or search terms.</div>
          </td>
        </tr>
      `;

    return `
      <div class="owner-portal-page" style="min-height: 100vh; background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 50%, #f0f9ff 100%); color: #0f172a; padding-top: 96px; padding-bottom: 80px;">
        <div class="container" style="max-width: 1280px;">
          <!-- Top Header & Actions -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px; flex-wrap:wrap; gap:16px;">
            <div>
              <button class="back-button" data-page="admin" style="margin-bottom: 12px;">← Dashboard</button>
              <h1 style="font-size: 32px; font-weight: 800; color:#0f172a; margin:0;">📊 Full Stock Inventory</h1>
              <p style="color: #64748b; font-size:14px; margin-top:4px;">Complete stock list across Products, Display Stock &amp; Spare Parts</p>
            </div>
            
            <div style="display:flex; gap:12px; flex-wrap:wrap;">
              <button onclick="app.printFullStockReport()" style="background:#0f172a; color:white; border:none; padding:12px 20px; border-radius:10px; font-weight:700; font-size:14px; cursor:pointer; display:inline-flex; align-items:center; gap:8px; box-shadow:0 4px 12px rgba(15,23,42,0.15);">
                <span style="font-size:18px;">🖨️</span>
                <span>Print Stock List</span>
              </button>

              <button onclick="app.exportFullStockPDF()" style="background:#dc2626; color:white; border:none; padding:12px 20px; border-radius:10px; font-weight:700; font-size:14px; cursor:pointer; display:inline-flex; align-items:center; gap:8px; box-shadow:0 4px 12px rgba(220,38,38,0.2);">
                <span style="font-size:18px;">📄</span>
                <span>Download PDF</span>
              </button>

              <button onclick="app.exportFullStockCSV()" style="background:#059669; color:white; border:none; padding:12px 20px; border-radius:10px; font-weight:700; font-size:14px; cursor:pointer; display:inline-flex; align-items:center; gap:8px; box-shadow:0 4px 12px rgba(5,150,105,0.2);">
                <span style="font-size:18px;">📥</span>
                <span>Export CSV</span>
              </button>

              <button onclick="app.resetAllStockData()" style="background:#ef4444; color:white; border:none; padding:12px 20px; border-radius:10px; font-weight:700; font-size:14px; cursor:pointer; display:inline-flex; align-items:center; gap:8px; box-shadow:0 4px 12px rgba(239,68,68,0.2);" title="Clear test sample products and set stock valuation to ₹0">
                <span style="font-size:18px;">🗑️</span>
                <span>Clear Test Stock (Set ₹0)</span>
              </button>
            </div>
          </div>

          <!-- KPI Summary Cards -->
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:16px; margin-bottom: 28px;">
            <div style="background:white; border:1px solid #e2e8f0; border-radius:16px; padding:20px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="color:#64748b; font-size:13px; font-weight:700; text-transform:uppercase;">Total Unique Items</span>
                <span style="background:#eff6ff; color:#1d4ed8; padding:6px; border-radius:8px; font-size:18px;">📊</span>
              </div>
              <div style="font-size:32px; font-weight:800; color:#0f172a; margin-top:8px;">${totalItemsCount}</div>
              <div style="font-size:12px; color:#64748b; margin-top:4px;">Across active categories</div>
            </div>

            <div style="background:white; border:1px solid #e2e8f0; border-radius:16px; padding:20px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="color:#64748b; font-size:13px; font-weight:700; text-transform:uppercase;">Total Stock Units</span>
                <span style="background:#f0fdf4; color:#16a34a; padding:6px; border-radius:8px; font-size:18px;">📦</span>
              </div>
              <div style="font-size:32px; font-weight:800; color:#16a34a; margin-top:8px;">${totalStockUnits.toLocaleString()}</div>
              <div style="font-size:12px; color:#64748b; margin-top:4px;">Physical units in stock</div>
            </div>

            <div style="background:white; border:1px solid #e2e8f0; border-radius:16px; padding:20px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="color:#64748b; font-size:13px; font-weight:700; text-transform:uppercase;">Total Stock Valuation</span>
                <span style="background:#faf5ff; color:#7e22ce; padding:6px; border-radius:8px; font-size:18px;">💰</span>
              </div>
              <div style="font-size:32px; font-weight:800; color:#7e22ce; margin-top:8px;">₹${totalStockValuation.toLocaleString('en-IN')}</div>
              <div style="font-size:12px; color:#64748b; margin-top:4px;">Total inventory value (selling price)</div>
            </div>

            <div style="background:white; border:1px solid #e2e8f0; border-radius:16px; padding:20px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="color:#64748b; font-size:13px; font-weight:700; text-transform:uppercase;">Low Stock Alerts</span>
                <span style="background:#fffbeb; color:#d97706; padding:6px; border-radius:8px; font-size:18px;">⚠️</span>
              </div>
              <div style="font-size:32px; font-weight:800; color:#d97706; margin-top:8px;">${lowStockAlertCount}</div>
              <div style="font-size:12px; color:#64748b; margin-top:4px;">Items with stock ≤ 2</div>
            </div>
          </div>

          <!-- Controls & Filtering Bar -->
          <div style="background:white; border:1px solid #e2e8f0; border-radius:16px; padding:20px; margin-bottom: 24px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px; align-items:end;">
              <!-- Search -->
              <div>
                <label style="font-size:12px; font-weight:700; color:#475569; display:block; margin-bottom:6px; text-transform:uppercase;">🔍 Search Inventory</label>
                <input type="text" placeholder="Search by name, ID, brand..." value="${this.fullStockSearch || ''}" oninput="app.setFullStockSearch(this.value)" style="width:100%; padding:10px 14px; border:1px solid #cbd5e1; border-radius:8px; font-size:14px; outline:none; background:#f8fafc;">
              </div>

              <!-- Module Filter -->
              <div>
                <label style="font-size:12px; font-weight:700; color:#475569; display:block; margin-bottom:6px; text-transform:uppercase;">📦 Inventory Section</label>
                <select onchange="app.setFullStockModuleFilter(this.value)" style="width:100%; padding:10px 14px; border:1px solid #cbd5e1; border-radius:8px; font-size:14px; outline:none; background:#f8fafc; font-weight:600; cursor:pointer;">
                  <option value="all" ${moduleFilter === 'all' ? 'selected' : ''}>All Inventory (Combined)</option>
                  <option value="product" ${moduleFilter === 'product' ? 'selected' : ''}>📦 Products Only</option>
                  <option value="displaystock" ${moduleFilter === 'displaystock' ? 'selected' : ''}>📱 Display Stock Only</option>
                  <option value="sparepart" ${moduleFilter === 'sparepart' ? 'selected' : ''}>🔩 Spare Parts Only</option>
                </select>
              </div>

              <!-- Category Filter -->
              <div>
                <label style="font-size:12px; font-weight:700; color:#475569; display:block; margin-bottom:6px; text-transform:uppercase;">📁 Category Selection</label>
                <select onchange="app.setFullStockCategoryFilter(this.value)" style="width:100%; padding:10px 14px; border:1px solid #cbd5e1; border-radius:8px; font-size:14px; outline:none; background:#f8fafc; font-weight:600; cursor:pointer;">
                  <option value="all" ${categoryFilter === 'all' ? 'selected' : ''}>All Categories (${categories.length})</option>
                  ${categories.map(cat => `<option value="${cat}" ${categoryFilter === cat ? 'selected' : ''}>${cat}</option>`).join('')}
                </select>
              </div>

              <!-- Status Filter -->
              <div>
                <label style="font-size:12px; font-weight:700; color:#475569; display:block; margin-bottom:6px; text-transform:uppercase;">📊 Stock Status</label>
                <select onchange="app.setFullStockStatusFilter(this.value)" style="width:100%; padding:10px 14px; border:1px solid #cbd5e1; border-radius:8px; font-size:14px; outline:none; background:#f8fafc; font-weight:600; cursor:pointer;">
                  <option value="all" ${statusFilter === 'all' ? 'selected' : ''}>All Status</option>
                  <option value="in-stock" ${statusFilter === 'in-stock' ? 'selected' : ''}>✅ In Stock (>0)</option>
                  <option value="low-stock" ${statusFilter === 'low-stock' ? 'selected' : ''}>⚠️ Low Stock (1-2)</option>
                  <option value="out-stock" ${statusFilter === 'out-stock' ? 'selected' : ''}>❌ Out of Stock (0)</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Table Container -->
          <div style="background:white; border:1px solid #e2e8f0; border-radius:16px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
            <div style="overflow-x:auto;">
              <table style="width:100%; border-collapse:collapse; text-align:left; font-size:14px;">
                <thead>
                  <tr style="background:#0f172a; color:white; font-size:13px; text-transform:uppercase; letter-spacing:0.5px;">
                    <th style="padding:14px; text-align:center; width:50px;">#</th>
                    <th style="padding:14px;">Section</th>
                    <th style="padding:14px;">Item Details</th>
                    <th style="padding:14px;">Category</th>
                    <th style="padding:14px;">Brand / Quality</th>
                    <th style="padding:14px; text-align:right;">Selling Price</th>
                    <th style="padding:14px; text-align:center;">Stock Qty</th>
                    <th style="padding:14px; text-align:right;">Total Value</th>
                  </tr>
                </thead>
                <tbody id="fullStockTableBody">
                  ${rowsHTML}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  printFullStockReport() {
    const allItems = this.getFullStockCombinedData();
    const moduleFilter = this.fullStockModuleFilter || 'all';
    const categoryFilter = this.fullStockCategoryFilter || 'all';
    const statusFilter = this.fullStockStatusFilter || 'all';
    const searchQuery = (this.fullStockSearch || '').toLowerCase().trim();

    const filteredItems = allItems.filter(item => {
      if (moduleFilter !== 'all' && item.module.toLowerCase().replace(/\s+/g, '') !== moduleFilter.toLowerCase().replace(/\s+/g, '')) return false;
      if (categoryFilter !== 'all' && item.category.toLowerCase() !== categoryFilter.toLowerCase()) return false;
      if (statusFilter === 'in-stock' && item.stock <= 0) return false;
      if (statusFilter === 'low-stock' && (item.stock < 1 || item.stock > 2)) return false;
      if (statusFilter === 'out-stock' && item.stock > 0) return false;
      if (searchQuery) {
        const text = `${item.name} ${item.id} ${item.category} ${item.brand} ${item.module}`.toLowerCase();
        if (!text.includes(searchQuery)) return false;
      }
      return true;
    });

    const totalUnits = filteredItems.reduce((s, i) => s + i.stock, 0);
    const totalValuation = filteredItems.reduce((s, i) => s + (i.stock * i.price), 0);
    const currentDate = new Date().toLocaleString('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
    });

    const win = window.open('', '_blank', 'width=1100,height=800');
    if (!win) {
      alert('Pop-up blocked. Please allow pop-ups for this site to print stock reports.');
      return;
    }

    const tableRows = filteredItems.map((item, idx) => `
      <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding:8px 10px; border:1px solid #cbd5e1; text-align:center; font-weight:bold;">${idx + 1}</td>
        <td style="padding:8px 10px; border:1px solid #cbd5e1;">${item.moduleIcon} ${item.module}</td>
        <td style="padding:8px 10px; border:1px solid #cbd5e1;">
          <strong style="color:#0f172a;">${item.name}</strong><br>
          <span style="font-size:11px; color:#64748b;">ID: #${item.id}</span>
        </td>
        <td style="padding:8px 10px; border:1px solid #cbd5e1;">${item.category}</td>
        <td style="padding:8px 10px; border:1px solid #cbd5e1;">${item.brand}</td>
        <td style="padding:8px 10px; border:1px solid #cbd5e1; text-align:right;">₹${item.price.toLocaleString('en-IN')}</td>
        <td style="padding:8px 10px; border:1px solid #cbd5e1; text-align:center; font-weight:bold; color:${item.stock === 0 ? '#dc2626' : item.stock <= 2 ? '#d97706' : '#16a34a'};">
          ${item.stock}
        </td>
        <td style="padding:8px 10px; border:1px solid #cbd5e1; text-align:right; font-weight:bold; color:#059669;">₹${(item.stock * item.price).toLocaleString('en-IN')}</td>
      </tr>
    `).join('');

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Full Stock Inventory Report — ஜிவி மொபைல்ஸ் (Jivi Mobiles)</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 24px; color: #0f172a; background: #fff; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; }
          .shop-title { font-size: 24px; font-weight: bold; color: #0f172a; margin: 0; }
          .shop-sub { font-size: 13px; color: #64748b; margin-top: 4px; }
          .report-meta { text-align: right; font-size: 12px; color: #475569; }
          .kpi-bar { display: flex; gap: 16px; margin-bottom: 20px; background: #f1f5f9; padding: 12px 16px; border-radius: 8px; border: 1px solid #cbd5e1; }
          .kpi-item { flex: 1; text-align: center; }
          .kpi-val { font-size: 18px; font-weight: bold; color: #0f172a; }
          .kpi-lbl { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { background: #0f172a; color: white; padding: 10px; text-align: left; font-size: 11px; text-transform: uppercase; }
          tfoot td { background: #0f172a; color: white; font-weight: bold; padding: 10px; font-size: 13px; }
          @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
            @page { size: auto; margin: 12mm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="shop-title">ஜிவி மொபைல்ஸ் — Jivi Mobiles</h1>
            <div class="shop-sub">Full Stock Inventory &amp; Valuation Report</div>
            <div class="shop-sub">Vanthavasi, Tamil Nadu | Phone: +91 84890 62593 / +91 96295 16788</div>
          </div>
          <div class="report-meta">
            <div><strong>Generated Date:</strong> ${currentDate}</div>
            <div><strong>Module Filter:</strong> ${moduleFilter.toUpperCase()}</div>
            <div><strong>Category Filter:</strong> ${categoryFilter.toUpperCase()}</div>
          </div>
        </div>

        <div class="kpi-bar">
          <div class="kpi-item">
            <div class="kpi-val">${filteredItems.length}</div>
            <div class="kpi-lbl">Total Items</div>
          </div>
          <div class="kpi-item">
            <div class="kpi-val">${totalUnits.toLocaleString()}</div>
            <div class="kpi-lbl">Total Stock Units</div>
          </div>
          <div class="kpi-item">
            <div class="kpi-val">₹${totalValuation.toLocaleString('en-IN')}</div>
            <div class="kpi-lbl">Total Valuation</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="text-align:center;">#</th>
              <th>Section</th>
              <th>Item Name</th>
              <th>Category</th>
              <th>Brand / Quality</th>
              <th style="text-align:right;">Price</th>
              <th style="text-align:center;">Stock Qty</th>
              <th style="text-align:right;">Total Value</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="5" style="text-align:right;">GRAND TOTAL SUMMARY:</td>
              <td style="text-align:right;">-</td>
              <td style="text-align:center;">${totalUnits.toLocaleString()} units</td>
              <td style="text-align:right;">₹${totalValuation.toLocaleString('en-IN')}</td>
            </tr>
          </tfoot>
        </table>

        <div style="margin-top:30px; display:flex; justify-content:space-between; font-size:12px; color:#64748b;">
          <div>Report Verified By: ___________________________</div>
          <div>Owner Signature: ___________________________</div>
        </div>

        <div class="no-print" style="margin-top:24px; text-align:center;">
          <button onclick="window.print()" style="padding:12px 28px; background:#0f172a; color:white; border:none; border-radius:8px; font-weight:bold; font-size:14px; cursor:pointer;">
            🖨️ Print Now / Save as PDF
          </button>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        <\/script>
      </body>
      </html>
    `);
    win.document.close();
  }

  exportFullStockPDF() {
    this.printFullStockReport();
  }

  exportFullStockCSV() {
    const allItems = this.getFullStockCombinedData();
    const moduleFilter = this.fullStockModuleFilter || 'all';
    const categoryFilter = this.fullStockCategoryFilter || 'all';
    const statusFilter = this.fullStockStatusFilter || 'all';
    const searchQuery = (this.fullStockSearch || '').toLowerCase().trim();

    const filteredItems = allItems.filter(item => {
      if (moduleFilter !== 'all' && item.module.toLowerCase().replace(/\s+/g, '') !== moduleFilter.toLowerCase().replace(/\s+/g, '')) return false;
      if (categoryFilter !== 'all' && item.category.toLowerCase() !== categoryFilter.toLowerCase()) return false;
      if (statusFilter === 'in-stock' && item.stock <= 0) return false;
      if (statusFilter === 'low-stock' && (item.stock < 1 || item.stock > 2)) return false;
      if (statusFilter === 'out-stock' && item.stock > 0) return false;
      if (searchQuery) {
        const text = `${item.name} ${item.id} ${item.category} ${item.brand} ${item.module}`.toLowerCase();
        if (!text.includes(searchQuery)) return false;
      }
      return true;
    });

    const headers = ['#', 'Module Section', 'Item ID', 'Item Name', 'Category', 'Brand / Quality', 'Selling Price (₹)', 'Stock Qty', 'Total Valuation (₹)'];
    const rows = filteredItems.map((item, idx) => [
      idx + 1,
      item.module,
      item.id,
      item.name,
      item.category,
      item.brand,
      item.price,
      item.stock,
      item.stock * item.price
    ]);

    const totalUnits = filteredItems.reduce((s, i) => s + i.stock, 0);
    const totalValuation = filteredItems.reduce((s, i) => s + (i.stock * i.price), 0);
    rows.push(['', 'GRAND TOTAL', '', '', '', '', '', totalUnits, totalValuation]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `full-stock-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  setFullStockModuleFilter(val) {
    this.fullStockModuleFilter = val || 'all';
    this.renderPage('admin-full-stock');
  }

  setFullStockCategoryFilter(val) {
    this.fullStockCategoryFilter = val || 'all';
    this.renderPage('admin-full-stock');
  }

  setFullStockStatusFilter(val) {
    this.fullStockStatusFilter = val || 'all';
    this.renderPage('admin-full-stock');
  }

  renderFullStockRowHTML(item, idx) {
    const totalVal = item.stock * item.price;
    const stockBadgeClass = item.stock === 0 ? 'background:#fef2f2; color:#dc2626;' : item.stock <= 2 ? 'background:#fffbeb; color:#d97706;' : 'background:#f0fdf4; color:#16a34a;';
    const stockText = item.stock === 0 ? 'Out of Stock' : item.stock <= 2 ? `Low Stock (${item.stock})` : `${item.stock} in stock`;

    return `
      <tr style="border-bottom:1px solid #e2e8f0; background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding:12px; text-align:center; font-weight:700; color:#64748b;">${idx + 1}</td>
        <td style="padding:12px; font-weight:800; color:#0f172a;">${item.moduleIcon} ${item.module}</td>
        <td style="padding:12px;">
          <div style="font-weight:800; color:#0f172a;">${item.name}</div>
          <div style="font-size:11px; color:#64748b; font-family:monospace;">ID: ${item.id}</div>
        </td>
        <td style="padding:12px;"><span style="background:#f1f5f9; color:#475569; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:600;">${item.category}</span></td>
        <td style="padding:12px; font-weight:600; color:#334155;">${item.brand}</td>
        <td style="padding:12px; text-align:right; font-weight:800; color:#0284c7;">₹${Number(item.price || 0).toLocaleString('en-IN')}</td>
        <td style="padding:12px; text-align:center;">
          <span style="display:inline-block; padding:4px 10px; border-radius:20px; font-size:12px; font-weight:800; ${stockBadgeClass}">${stockText}</span>
        </td>
        <td style="padding:12px; text-align:right; font-weight:900; color:#059669;">₹${totalVal.toLocaleString('en-IN')}</td>
      </tr>
    `;
  }

  setFullStockSearch(val) {
    this.fullStockSearch = val || '';
    clearTimeout(this._fullStockSearchTimer);
    this._fullStockSearchTimer = setTimeout(() => {
      const tbody = document.getElementById('fullStockTableBody');
      if (!tbody) {
        this.renderPage('admin-full-stock');
        return;
      }
      const allItems = this.getFullStockCombinedData();
      const moduleFilter = this.fullStockModuleFilter || 'all';
      const categoryFilter = this.fullStockCategoryFilter || 'all';
      const statusFilter = this.fullStockStatusFilter || 'all';
      const searchQuery = (this.fullStockSearch || '').toLowerCase().trim();

      const filtered = allItems.filter(item => {
        if (moduleFilter !== 'all' && item.module.toLowerCase().replace(/\s+/g, '') !== moduleFilter.toLowerCase().replace(/\s+/g, '')) return false;
        if (categoryFilter !== 'all' && item.category.toLowerCase() !== categoryFilter.toLowerCase()) return false;
        if (statusFilter === 'in-stock' && item.stock <= 0) return false;
        if (statusFilter === 'low-stock' && (item.stock < 1 || item.stock > 2)) return false;
        if (statusFilter === 'out-stock' && item.stock > 0) return false;
        if (searchQuery) {
          const text = `${item.name} ${item.id} ${item.category} ${item.brand} ${item.module}`.toLowerCase();
          if (!text.includes(searchQuery)) return false;
        }
        return true;
      });

      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="padding:40px; text-align:center; color:#64748b; font-size:15px;">🔍 No items found matching "${this.fullStockSearch}".</td></tr>`;
      } else {
        tbody.innerHTML = filtered.map((item, idx) => this.renderFullStockRowHTML(item, idx)).join('');
      }
    }, 200);
  }

  async resetAllStockData() {
    if (!confirm('⚠️ ARE YOU SURE YOU WANT TO CLEAR ALL TEST STOCK DATA?\n\nThis will remove sample/test products and stock entries so your Stock Valuation resets to ₹0, allowing you to enter your real shop stock cleanly.')) {
      return;
    }

    try {
      const response = await fetch(`${this.API_URL}/admin/reset-stock`, {
        method: 'POST'
      });
      if (response.ok) {
        alert('✅ All sample/test stock items cleared successfully! Stock Valuation is now reset to ₹0.');
        this.products = [];
        this.displayStock = [];
        this.sparePartsStock = [];
        this.stockEntries = [];
        this.stockMovements = [];
        await Promise.all([
          this.loadProductsFromStorage().catch(() => {}),
          this.loadDisplayStockFromStorage().catch(() => {}),
          this.loadSparePartsFromStorage().catch(() => {}),
          this.loadStockEntriesFromStorage().catch(() => {}),
          this.loadStockMovementsFromStorage().catch(() => {})
        ]);
        this.renderPage(this.currentPage || 'admin-full-stock');
      } else {
        alert('❌ Failed to reset stock data. Please try again.');
      }
    } catch (err) {
      console.error('Reset stock error:', err);
      alert('❌ Error resetting stock data.');
    }
  }
}

// Initialize Owner Portal App
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOwnerApp);
} else {
  initOwnerApp();
}

function initOwnerApp() {
  try {
    console.log('🚀 Initializing Owner Portal...');
    const app = new OwnerPortalApp();
    window.app = app; // Make app globally accessible
    console.log('✅ Owner Portal initialized successfully');
  } catch (error) {
    console.error('❌ Owner Portal initialization error:', error);
    document.getElementById('app').innerHTML = `
      <div style="padding: 40px; text-align: center; font-family: Arial, sans-serif;">
        <h1 style="color: #dc2626; margin-bottom: 20px;">⚠️ Error Loading Owner Portal</h1>
        <p style="color: #666; margin-bottom: 20px;">There was an error initializing the owner portal.</p>
        <div style="background: #fef2f2; border: 2px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px auto; max-width: 600px; text-align: left;">
          <strong>Error Details:</strong>
          <pre style="margin-top: 10px; color: #dc2626; overflow-x: auto;">${error.message}\n\n${error.stack}</pre>
        </div>
        <button onclick="location.reload()" style="margin-top: 20px; padding: 12px 24px; background: #dc2626; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
          Retry
        </button>
      </div>
    `;
  }
}