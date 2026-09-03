const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Override DNS to use Google DNS (fixes SRV lookup issues on some networks)
const dns = require('dns');
if (process.env.NODE_ENV !== 'production') {
  try {
    dns.setServers(['8.8.8.8', '8.8.4.4']);
    console.log('📡 Local DNS configured: Google DNS');
  } catch (err) {
    console.warn('⚠️ Failed to set Google DNS servers:', err.message);
  }
}
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

// Import keep-alive service
require('../keep-alive');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase payload limit for images
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from client directory
const clientPath = path.join(__dirname, '../client');
console.log('📁 Serving static files from:', clientPath);
console.log('🚀 Deploy version: 20260517a');
app.use(express.static(clientPath, {
  etag: false,
  lastModified: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.html') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// MongoDB Connection with optimized settings and faster timeout
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb+srv://keerthikishorebalagokul12_db_user:newmobile2026@cluster0.shyyujq.mongodb.net/mobile_shop?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
  maxPoolSize: 20,
  minPoolSize: 5,
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 30000,
  connectTimeoutMS: 15000,
  family: 4
})
  .then(() => {
    console.log('✅ Connected to MongoDB');
    console.log('📊 Connection pool size: 10');
    
    // Drop the problematic 'id' index if it exists (after connection is established)
    Product.collection.dropIndex('id_1').then(() => {
      console.log('✅ Dropped id_1 index');
    }).catch(err => {
      if (err.code === 27) {
        console.log('ℹ️ Index id_1 does not exist (this is fine)');
      } else {
        console.log('ℹ️ Could not drop index:', err.message);
      }
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('⚠️ Running in offline mode - using fallback data');
  });

// Product Schema
const productSchema = new mongoose.Schema({
  name: { type: String, index: true },
  category: { type: String, index: true },
  price: Number,
  originalPrice: Number,
  ownerPrice: Number,
  stock: { type: Number, default: 0 },
  minStock: { type: Number, default: 5 },
  image: String,
  imageUrl: String,
  imageUrl2: String,
  rating: Number,
  reviews: Number,
  inStock: { type: Boolean, index: true },
  badge: String,
  qrId: String,
  qrPassword: String,
  trackingStatus: String,
  ownerGender: String
}, { 
  timestamps: true,
  // Optimize for read performance
  autoIndex: true
});

// Add compound index for common queries
productSchema.index({ category: 1, inStock: 1 });
productSchema.index({ createdAt: 1 });

const Product = mongoose.model('Product', productSchema);

// Tracking Schema
const trackingSchema = new mongoose.Schema({
  qrId: { type: String, required: true, unique: true },
  qrPassword: String,
  customerName: String,
  productName: String,
  deviceModel: String,
  contact: String,
  address: String,
  dateIn: String,
  dateOut: String,
  status: String,
  issue: String,
  estimatedDays: Number,
  amount: { type: Number, default: 0 },
  advanceAmount: { type: Number, default: 0 },
  paidAmount:    { type: Number, default: 0 },
  totalReceived: { type: Number, default: 0 },
  balanceAmount: { type: Number, default: 0 },
  balancePaidDate: String,
  createdAt: String,
  completedAt: String,
  lastUpdated: String
}, { timestamps: true, strict: false });

const Tracking = mongoose.model('Tracking', trackingSchema);

// Order Schema
const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  customer: {
    name: String,
    phone: String,
    email: String,
    address: String
  },
  items: [{
    id: mongoose.Schema.Types.Mixed,
    name: String,
    price: Number,
    quantity: Number,
    image: String
  }],
  total: Number,
  paymentMethod: String,
  status: { type: String, default: 'Pending' },
  orderDate: { type: Date, default: Date.now },
  paymentScreenshot: {
    imageUrl: String, // URL to the uploaded image (local or cloud)
    data: String, // Base64 data as backup
    fileName: String,
    uploadTime: String
  }
}, { 
  timestamps: true,
  strict: false // Allow additional fields that might not be in schema
});

const Order = mongoose.model('Order', orderSchema);

// Sales Record Schema
const salesSchema = new mongoose.Schema({
  saleId: { type: String, required: true, unique: true },
  customerName: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  customerAddress: String,
  productName: { type: String, required: true },
  productItems: { type: Array, default: [] },  // multi-item support
  productModel: String,
  imeiNumber: String,
  saleAmount: Number,
  discount: { type: Number, default: 0 },
  purchaseDate: { type: String, required: true },
  warrantyPeriod: String,
  notes: String,
  createdAt: { type: String }
}, { timestamps: true });

const SalesRecord = mongoose.model('SalesRecord', salesSchema);

// Services Schema
const serviceSchema = new mongoose.Schema({
  serviceId: { type: String, required: true, unique: true },
  customerName: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  customerAddress: String,
  price: Number,
  advance: Number,
  serviceDate: { type: String, required: true },
  status: { type: String, default: 'Received' },
  serviceDetails: { type: String, required: true }
}, { timestamps: true });

const ServiceRecord = mongoose.model('ServiceRecord', serviceSchema);

// Display Stock Schema
const displayStockSchema = new mongoose.Schema({
  stockItemId: { type: String, required: true, unique: true },
  displayName:  { type: String, required: true },
  displayId:    { type: String, required: true },
  stock:        { type: Number, default: 0 },
  price:        { type: Number, default: null },
  history:      { type: Array, default: [] }
}, { timestamps: true });

const DisplayStock = mongoose.model('DisplayStock', displayStockSchema);

// Spare Parts Stock Schema
const sparePartsSchema = new mongoose.Schema({
  partItemId:    { type: String, required: true, unique: true },
  partName:      { type: String, required: true },
  partId:        { type: String, required: true },
  stock:         { type: Number, default: 0 },
  ownerPrice:    { type: Number, default: null },
  customerPrice: { type: Number, default: null },
  history:       { type: Array, default: [] }
}, { timestamps: true });

const SpareParts = mongoose.model('SpareParts', sparePartsSchema);

// Distributor Schema
const distributorSchema = new mongoose.Schema({
  distributorId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  code: String,
  contactPerson: String,
  phone: String,
  email: String,
  address: String,
  gstNumber: String,
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  notes: String
}, { timestamps: true });

const Distributor = mongoose.model('Distributor', distributorSchema);


// Stock Entry Schema (Master Product + Dealer Purchase Batch)
const stockEntrySchema = new mongoose.Schema({
  stockId: { type: String, required: true, unique: true },
  moduleType: { type: String, required: true, enum: ['Product', 'Display', 'SparePart'] },
  masterId: { type: String, required: true },
  masterName: { type: String, required: true },
  dealerId: { type: String, default: '' },
  dealerName: { type: String, default: 'Direct Purchase' },
  purchaseDate: { type: String, required: true },
  initialQuantity: { type: Number, default: 0 },
  currentQuantity: { type: Number, default: 0 },
  purchasePrice: { type: Number, default: 0 },
  mrp: { type: Number, default: 0 },
  sellingPrice: { type: Number, default: 0 },
  barcode: { type: String, required: true, unique: true },
  imei1: { type: String, default: '' },
  imei2: { type: String, default: '' },
  serialNumber: { type: String, default: '' },
  notes: String,
  status: { type: String, default: 'In Stock' }
}, { timestamps: true });

const StockEntry = mongoose.model('StockEntry', stockEntrySchema);

// Stock Movement Log Schema
const stockMovementSchema = new mongoose.Schema({
  movementId: { type: String, required: true, unique: true },
  stockEntryId: { type: String, required: true },
  barcode: { type: String, required: true },
  moduleType: String,
  masterId: String,
  dealerId: String,
  quantity: { type: Number, required: true },
  movementType: { type: String, required: true }, // Stock Added, Sold, Returned, Damaged, Adjusted
  date: { type: String, required: true },
  reason: String,
  notes: String
}, { timestamps: true });

const StockMovement = mongoose.model('StockMovement', stockMovementSchema);
const uploadImageToCloud = async (base64Data, fileName) => {
  try {
    // File saving disabled - screenshots only stored in database as base64
    console.log('📸 File saving disabled - screenshots stored in database only');
    return null; // No file URL returned
    
    /* File saving functionality disabled
    const base64Image = base64Data.split(',')[1];
    console.log('📸 Using local storage for image upload');
    return await saveImageLocally(base64Data, fileName);
    */
  } catch (error) {
    console.error('❌ Cloud upload disabled');
    return null;
  }
};

// File saving disabled - screenshots only stored in database
const saveImageLocally = async (base64Data, fileName) => {
  console.log('📸 File saving disabled - screenshots stored in database only');
  return null; // No file saving
  
  /* File saving functionality disabled
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Remove the data:image/...;base64, prefix
    const base64Image = base64Data.split(',')[1];
    const buffer = Buffer.from(base64Image, 'base64');
    
    // Generate unique filename
    const timestamp = Date.now();
    const extension = fileName.split('.').pop() || 'png';
    const uniqueFileName = `screenshot-${timestamp}.${extension}`;
    const filePath = path.join(uploadsDir, uniqueFileName);
    
    // Save file
    fs.writeFileSync(filePath, buffer);
    
    // Return URL path
    return `/uploads/${uniqueFileName}`;
  } catch (error) {
    console.error('❌ Local save failed:', error);
    throw error;
  }
  */
};

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// SEO Routes
app.get('/sitemap.xml', (req, res) => {
  res.sendFile(path.join(clientPath, 'sitemap.xml'));
});

app.get('/robots.txt', (req, res) => {
  res.sendFile(path.join(clientPath, 'robots.txt'));
});

app.get('/google5739f7b57b6f777b.html', (req, res) => {
  res.sendFile(path.join(clientPath, 'google5739f7b57b6f777b.html'));
});

app.get('/business-info.json', (req, res) => {
  res.sendFile(path.join(clientPath, 'business-info.json'));
});

// Health check endpoint for keep-alive and monitoring
app.get('/health', (req, res) => {
  const healthCheck = {
    uptime: process.uptime(),
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    memory: process.memoryUsage(),
    pid: process.pid
  };
  
  console.log(`🏥 Health check requested at ${healthCheck.timestamp}`);
  res.status(200).json(healthCheck);
});

// Keep-alive endpoint (lightweight)
app.get('/ping', (req, res) => {
  res.status(200).json({ 
    status: 'alive', 
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});

// Admin Login endpoint — verifies credentials server-side using HMAC-SHA256
const crypto = require('crypto');

// Admin Login endpoint
app.post('/api/admin/login', (req, res) => {
  const { phone, password } = req.body;

  const expectedPhone = process.env.ADMIN_PHONE        || '9840694616';
  const salt          = process.env.ADMIN_SALT         || 'mmw2026';
  const expectedHash  = process.env.ADMIN_PASSWORD_HASH || '2cb298af21d955b3da5139b96971eef8f23b3d7e6a2f54dc7c3aa9d208b5750d';

  const inputHash = crypto.createHmac('sha256', salt).update(password || '').digest('hex');

  if (phone !== expectedPhone || inputHash !== expectedHash) {
    console.warn('⚠️ Failed admin login attempt for phone:', phone);
    return res.status(401).json({ success: false, message: 'Invalid phone number or password' });
  }

  console.log('✅ Admin login successful');
  return res.json({ success: true });
});

// DIRECT TEST - Add this button to test screenshot saving directly
app.post('/api/direct-test', async (req, res) => {
  try {
    console.log('🧪 DIRECT TEST: Creating order with screenshot...');
    
    const testOrder = {
      orderId: 'DIRECT-TEST-' + Date.now(),
      customer: {
        name: 'Test User',
        phone: '1234567890',
        email: 'test@test.com',
        address: 'Test Address'
      },
      items: [{
        id: 1,
        name: 'Test Item',
        price: 100,
        quantity: 1
      }],
      total: 100,
      paymentMethod: 'UPI Payment (Screenshot Uploaded)',
      status: 'Payment Verification Pending',
      paymentScreenshot: {
        data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        fileName: 'test-screenshot.png',
        uploadTime: new Date().toISOString()
      }
    };
    
    console.log('🧪 Test order object:', {
      orderId: testOrder.orderId,
      hasScreenshot: !!testOrder.paymentScreenshot,
      screenshotDataLength: testOrder.paymentScreenshot.data.length
    });
    
    const order = new Order(testOrder);
    const savedOrder = await order.save();
    
    console.log('✅ DIRECT TEST: Order saved successfully:', {
      orderId: savedOrder.orderId,
      hasScreenshot: !!savedOrder.paymentScreenshot,
      screenshotDataLength: savedOrder.paymentScreenshot?.data?.length,
      allFields: Object.keys(savedOrder.toObject())
    });
    
    res.json({
      success: true,
      orderId: savedOrder.orderId,
      hasScreenshot: !!savedOrder.paymentScreenshot,
      screenshotDataLength: savedOrder.paymentScreenshot?.data?.length
    });
    
  } catch (error) {
    console.error('❌ DIRECT TEST FAILED:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Test endpoint to see what data we receive
app.post('/api/debug-order', (req, res) => {
  console.log('🔍 DEBUG: Received request body keys:', Object.keys(req.body));
  console.log('🔍 DEBUG: Has paymentScreenshot:', !!req.body.paymentScreenshot);
  console.log('🔍 DEBUG: PaymentScreenshot keys:', req.body.paymentScreenshot ? Object.keys(req.body.paymentScreenshot) : 'none');
  console.log('🔍 DEBUG: Screenshot data length:', req.body.paymentScreenshot?.data?.length);
  console.log('🔍 DEBUG: Full request body structure:', JSON.stringify(req.body, null, 2).substring(0, 1000));
  res.json({ received: true, hasScreenshot: !!req.body.paymentScreenshot });
});

// Test endpoint to verify schema works with screenshot data
app.post('/api/test-screenshot', async (req, res) => {
  try {
    console.log('🧪 Testing screenshot save capability...');
    
    const testOrder = new Order({
      orderId: 'TEST-' + Date.now(),
      customer: { name: 'Test User', phone: '1234567890', email: 'test@test.com', address: 'Test Address' },
      items: [{ id: 1, name: 'Test Item', price: 100, quantity: 1 }],
      total: 100,
      paymentMethod: 'Test Payment',
      status: 'Test',
      paymentScreenshot: {
        data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        fileName: 'test.png',
        uploadTime: new Date().toISOString()
      }
    });
    
    const saved = await testOrder.save();
    console.log('✅ Test order saved with screenshot:', !!saved.paymentScreenshot);
    
    // Clean up test order
    await Order.deleteOne({ orderId: saved.orderId });
    
    res.json({ success: true, hasScreenshot: !!saved.paymentScreenshot });
  } catch (error) {
    console.error('❌ Test failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Socket.IO connection
let connectedClients = 0;
io.on('connection', (socket) => {
  connectedClients++;
  console.log('👤 Client connected:', socket.id);
  console.log('📊 Total connected clients:', connectedClients);
  
  socket.on('disconnect', (reason) => {
    connectedClients--;
    console.log('👋 Client disconnected:', socket.id, '- Reason:', reason);
    console.log('📊 Total connected clients:', connectedClients);
  });

  socket.on('error', (error) => {
    console.error('❌ Socket error:', error);
  });
});

// Product Routes

// Simple in-memory cache for products
let productsCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60000; // 60 seconds - longer cache for speed

// Fallback products data for when database is unavailable
const fallbackProducts = [
  {
    id: "fallback-1",
    name: "iPhone 15 Pro Max",
    category: "Smartphones",
    price: 134900,
    originalPrice: 159900,
    image: "📱",
    imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-max-naturaltitanium-select?wid=470&hei=556&fmt=png-alpha&.v=1692845702781",
    rating: 4.8,
    reviews: 1250,
    inStock: true,
    badge: "New"
  },
  {
    id: "fallback-2", 
    name: "Samsung Galaxy S24 Ultra",
    category: "Smartphones",
    price: 124999,
    originalPrice: 139999,
    image: "📱",
    imageUrl: "https://images.samsung.com/is/image/samsung/p6pim/in/2401/gallery/in-galaxy-s24-ultra-s928-sm-s928bztqins-thumb-539573073",
    rating: 4.7,
    reviews: 890,
    inStock: true,
    badge: "Popular"
  },
  {
    id: "fallback-3",
    name: "Screen Replacement Service",
    category: "Services", 
    price: 2999,
    originalPrice: 4999,
    image: "🔧",
    rating: 4.9,
    reviews: 450,
    inStock: true,
    badge: "Service"
  }
];

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Always set no-cache headers to prevent stale stock on browser reload
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    // Check cache first
    const now = Date.now();
    if (productsCache && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('📦 Serving products from cache (instant)');
      return res.json(productsCache);
    }

    console.log('📡 Fetching products from database...');
    
    // Check if mongoose is connected
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ Database not connected, using fallback data');
      return res.json(fallbackProducts);
    }
    
    // Use lean() for faster queries with timeout
    const products = await Product.find()
      .lean()
      .select('-__v -updatedAt -createdAt') // Exclude unnecessary fields for speed
      .limit(100) // Limit results for faster loading
      .sort({ _id: -1 }) // Sort by _id is faster than createdAt
      .maxTimeMS(3000); // 3 second timeout for faster response
    
    // Transform MongoDB _id to id for client compatibility
    const transformedProducts = products.map(p => ({
      ...p,
      id: p._id.toString()
    }));
    
    // Update cache
    productsCache = transformedProducts;
    cacheTimestamp = now;
    
    const duration = Date.now() - startTime;
    console.log(`✅ Returning ${transformedProducts.length} products (took ${duration}ms)`);
    res.json(transformedProducts);
  } catch (error) {
    console.error('❌ Error fetching products:', error.message);
    console.log('⚠️ Using fallback products due to database error');
    res.json(fallbackProducts);
  }
});

// Create a new product
// Admin Reset Stock Endpoint (Clears sample/test stock items and resets valuation to 0)
app.post('/api/admin/reset-stock', async (req, res) => {
  try {
    console.log('🗑️ Resetting all inventory and test stock data...');
    
    await Promise.all([
      Product.deleteMany({}),
      StockEntry.deleteMany({}),
      StockMovement.deleteMany({}),
      DisplayStock.deleteMany({}),
      SpareParts.deleteMany({})
    ]);

    productsCache = null;
    cacheTimestamp = 0;

    io.emit('product-updated', { reset: true });
    console.log('✅ All inventory stock reset to 0 successfully.');

    res.json({ success: true, message: 'All inventory stock has been reset to 0.' });
  } catch (error) {
    console.error('❌ Error resetting stock:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    console.log('📦 [SERVER] Creating new product:', req.body.name);
    
    // Check if mongoose is connected
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ Database not connected, cannot create product');
      return res.status(503).json({ 
        error: 'Database not available. Please try again later.',
        offline: true 
      });
    }

    const product = new Product(req.body);
    
    // Add timeout to save operation
    const savedProduct = await Promise.race([
      product.save(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Save operation timed out')), 8000)
      )
    ]);
    
    const transformedProduct = {
      ...savedProduct.toObject(),
      id: savedProduct._id.toString()
    };
    
    // Invalidate cache
    productsCache = null;
    
    console.log('✅ [SERVER] Product created successfully:', transformedProduct.id);
    io.emit('product-added', transformedProduct);
    res.json(transformedProduct);
  } catch (error) {
    console.error('❌ [SERVER] Error creating product:', error.message);
    
    if (error.message.includes('timed out') || error.message.includes('buffering timed out')) {
      return res.status(504).json({ 
        error: 'Database operation timed out. Please check your connection and try again.',
        timeout: true 
      });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// Update a product
app.patch('/api/products/:id', async (req, res) => {
  try {
    console.log('🔄 [SERVER] Updating product:', req.params.id);
    
    // Check if mongoose is connected
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ Database not connected, cannot update product');
      return res.status(503).json({ 
        error: 'Database not available. Please try again later.',
        offline: true 
      });
    }

    // Add timeout to update operation
    const product = await Promise.race([
      Product.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true }
      ),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Update operation timed out')), 8000)
      )
    ]);

    console.log("product id: ", product._id)

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const transformedProduct = {
      ...product.toObject(),
      id: product._id.toString()
    };

    // Invalidate cache
    productsCache = null;

    console.log('✅ [SERVER] Product updated successfully:', transformedProduct.id);
    io.emit('product-updated', transformedProduct);

    res.json(transformedProduct);
  } catch (error) {
    console.error('❌ [SERVER] Error updating product:', error.message);
    
    if (error.message.includes('timed out') || error.message.includes('buffering timed out')) {
      return res.status(504).json({ 
        error: 'Database operation timed out. Please check your connection and try again.',
        timeout: true 
      });
    }
    
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);

    if (!deletedProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Invalidate cache
    productsCache = null;

    io.emit('product-deleted', { id: req.params.id });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Direct TSPL print endpoint — sends raw TSPL data directly to the printer
// The printer name must be configured in the server environment
app.post('/api/print-label', async (req, res) => {
  try {
    const { tspl } = req.body;
    if (!tspl) return res.status(400).json({ error: 'No TSPL data provided' });

    const os = require('os');
    const fs = require('fs');
    const { exec } = require('child_process');
    const path = require('path');

    // Write TSPL to a temp file
    const tmpFile = path.join(os.tmpdir(), `label-${Date.now()}.prn`);
    fs.writeFileSync(tmpFile, tspl, 'binary');

    // Get printer name from env or use default
    const printerName = process.env.LABEL_PRINTER_NAME || 'Zenpert 4T520';

    // Send to printer using Windows copy command
    const cmd = `copy /b "${tmpFile}" "\\\\.\\${printerName}"`;
    exec(cmd, (error, stdout, stderr) => {
      // Clean up temp file
      try { fs.unlinkSync(tmpFile); } catch(e) {}

      if (error) {
        console.error('❌ Print error:', error.message);
        return res.status(500).json({ error: 'Print failed: ' + error.message, cmd });
      }
      console.log('✅ Label printed to:', printerName);
      res.json({ success: true, printer: printerName });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Customer Lookup Route
app.get('/api/customer/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Query in parallel for speed
    const [trackingMatch, salesMatch, serviceMatch, orderMatch] = await Promise.all([
      Tracking.findOne({ contact: phone }).sort({ _id: -1 }).lean(),
      SalesRecord.findOne({ phoneNumber: phone }).sort({ _id: -1 }).lean(),
      ServiceRecord.findOne({ phoneNumber: phone }).sort({ _id: -1 }).lean(),
      Order.findOne({ "customer.phone": phone }).sort({ _id: -1 }).lean()
    ]);

    let customerName = '';
    let address = '';

    // Prioritize tracking records
    if (trackingMatch) {
      customerName = trackingMatch.customerName || '';
      address = trackingMatch.address || '';
    }

    // Fallback to SalesRecord
    if ((!customerName || !address) && salesMatch) {
      customerName = customerName || salesMatch.customerName || '';
      address = address || salesMatch.customerAddress || '';
    }

    // Fallback to ServiceRecord
    if ((!customerName || !address) && serviceMatch) {
      customerName = customerName || serviceMatch.customerName || '';
      address = address || serviceMatch.customerAddress || '';
    }

    // Fallback to Order
    if ((!customerName || !address) && orderMatch && orderMatch.customer) {
      customerName = customerName || orderMatch.customer.name || '';
      address = address || orderMatch.customer.address || '';
    }

    if (customerName || address) {
      return res.json({
        success: true,
        customerName,
        address
      });
    }

    return res.json({
      success: false,
      message: 'No customer details found'
    });
  } catch (error) {
    console.error('Error fetching customer details:', error);
    res.status(500).json({ error: error.message });
  }
});

// Tracking Routes
app.get('/api/tracking', async (req, res) => {
  try {
    const tracking = await Tracking.find().sort({ createdAt: -1 });
    res.json(tracking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tracking', async (req, res) => {
  try {
    const tracking = new Tracking(req.body);
    await tracking.save();
    io.emit('tracking-added', tracking);
    res.json(tracking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tracking/:qrId', async (req, res) => {
  try {
    const tracking = await Tracking.findOneAndUpdate(
      { qrId: req.params.qrId },
      req.body,
      { new: true }
    );
    io.emit('tracking-updated', tracking);
    res.json(tracking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tracking/:qrId', async (req, res) => {
  try {
    await Tracking.findOneAndDelete({ qrId: req.params.qrId });
    io.emit('tracking-deleted', { qrId: req.params.qrId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Persistent Local Orders Store (Bypasses Mongo Network/DNS issues and guarantees 100% order persistence)
const ORDERS_FILE_PATH = path.join(__dirname, 'orders_store.json');
let localOrdersStore = [];

function loadLocalOrders() {
  try {
    if (fs.existsSync(ORDERS_FILE_PATH)) {
      const data = fs.readFileSync(ORDERS_FILE_PATH, 'utf8');
      localOrdersStore = JSON.parse(data || '[]');
      console.log(`📁 Loaded ${localOrdersStore.length} persistent local orders from orders_store.json`);
    }
  } catch (err) {
    console.error('❌ Error reading local orders file:', err.message);
    localOrdersStore = [];
  }
}

function saveLocalOrders() {
  try {
    fs.writeFileSync(ORDERS_FILE_PATH, JSON.stringify(localOrdersStore, null, 2), 'utf8');
    console.log(`💾 Saved ${localOrdersStore.length} orders to local orders_store.json`);
  } catch (err) {
    console.error('❌ Error saving local orders file:', err.message);
  }
}

loadLocalOrders();

// Order Routes
app.get('/api/orders', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    let dbOrders = [];
    if (mongoose.connection.readyState === 1) {
      try {
        dbOrders = await Promise.race([
          Order.find()
            .lean()
            .select('-paymentScreenshot.data')
            .sort({ orderDate: -1, createdAt: -1 }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Orders query timed out')), 4000))
        ]);
      } catch (dbErr) {
        console.warn('⚠️ MongoDB query skipped or timed out, serving local order store:', dbErr.message);
      }
    } else {
      console.log('⚠️ Database not connected, serving local persistent order store');
    }

    // Merge DB orders and localOrdersStore, deduplicating by orderId / _id / id
    const combined = [...(dbOrders || []), ...localOrdersStore];
    const uniqueOrders = [];
    const seenMap = new Set();

    for (const o of combined) {
      const key = String(o.orderId || o._id || o.id || '');
      if (key && !seenMap.has(key)) {
        seenMap.add(key);
        uniqueOrders.push(o);
      }
    }

    console.log(`📤 [SERVER] Sending ${uniqueOrders.length} orders to client (DB: ${dbOrders.length}, Local: ${localOrdersStore.length})`);
    res.json(uniqueOrders);
  } catch (error) {
    console.error('❌ Error fetching orders:', error.message);
    res.json(localOrdersStore);
  }
});

// Endpoint to fetch screenshot data on-demand for a single order
app.get('/api/orders/:orderId/screenshot', async (req, res) => {
  try {
    const oId = req.params.orderId;
    if (mongoose.connection.readyState === 1) {
      const order = await Order.findOne({ $or: [{ orderId: oId }, { id: oId }] }).lean();
      if (order && order.paymentScreenshot) {
        return res.json(order.paymentScreenshot);
      }
    }

    const localOrder = localOrdersStore.find(o => String(o.orderId || o.id || o._id) === String(oId));
    if (localOrder && localOrder.paymentScreenshot) {
      return res.json(localOrder.paymentScreenshot);
    }

    res.status(404).json({ error: 'Screenshot not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const { orderId, customer, items, total, paymentMethod, status, orderDate, paymentScreenshot } = req.body;

    console.log('📥 Received order data:', {
      orderId,
      hasScreenshot: !!paymentScreenshot,
      paymentMethod,
      itemsCount: items?.length || 0
    });

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item' });
    }

    // Check for duplicate order submission
    if (orderId) {
      const existingOrder = await Order.findOne({ orderId: String(orderId) });
      if (existingOrder) {
        console.log(`⚠️ Order #${orderId} already exists in database. Returning existing order without duplicate insertion.`);
        return res.json(existingOrder);
      }
    }

    // Validate screenshot format if present
    if (paymentScreenshot && paymentScreenshot.data) {
      if (!paymentScreenshot.data.startsWith('data:image/')) {
        return res.status(400).json({ error: 'Invalid screenshot data format' });
      }
      if (paymentScreenshot.data.length > 10 * 1024 * 1024) {
        return res.status(400).json({ error: 'Screenshot data too large (max 10MB)' });
      }
    }

    // Proceed directly to saving the customer order in database

    let validOrderDate = new Date();
    if (orderDate) {
      const parsedDate = new Date(orderDate);
      if (!isNaN(parsedDate.getTime())) {
        validOrderDate = parsedDate;
      }
    }

    const oId = orderId || 'ORD-' + Date.now();
    const orderData = {
      orderId: oId,
      customer: customer || {},
      items: items || [],
      total: Number(total || 0),
      paymentMethod: paymentMethod || 'Cash on Delivery',
      status: status || 'Pending',
      orderDate: validOrderDate,
      stockDeducted: true,
      stockRestored: false,
      allocatedUnits: []
    };

    if (paymentScreenshot && paymentScreenshot.data) {
      orderData.paymentScreenshot = {
        data: paymentScreenshot.data,
        fileName: paymentScreenshot.fileName,
        uploadTime: paymentScreenshot.uploadTime
      };
    }

    // 2. MULTI-DISTRIBUTOR FIFO STOCK DEDUCTION & MOVEMENT LOGGING
    const allocatedUnits = [];

    for (const item of items) {
      const pId = item.id || item._id || item.productId;
      const qty = parseInt(item.quantity || 1, 10);

      let product = null;
      if (pId) {
        if (mongoose.Types.ObjectId.isValid(pId)) {
          product = await Product.findById(pId);
        }
        if (!product) {
          product = await Product.findOne({ id: String(pId) });
        }
      }

      // Fallback lookup by Product Name if ID is missing in order item payload
      if (!product && item.name) {
        product = await Product.findOne({ name: item.name.trim() });
      }

      if (!product) {
        console.warn(`⚠️ Cannot deduct stock — Product not found: ID="${pId}", Name="${item.name}"`);
        continue;
      }

      const targetProductId = product._id;

      const masterIdQuery = {
        $or: [
          { masterId: String(targetProductId) },
          { masterId: String(pId) },
          { masterId: String(product.id || '') }
        ].filter(q => q.masterId !== '')
      };

      // Find active distributor batches for this product (FIFO order: createdAt 1)
      const batches = await StockEntry.find({
        ...masterIdQuery,
        currentQuantity: { $gt: 0 }
      }).sort({ createdAt: 1 });

      let remainingToDeduct = qty;

      for (const batch of batches) {
        if (remainingToDeduct <= 0) break;

        const deductAmount = Math.min(batch.currentQuantity, remainingToDeduct);
        batch.currentQuantity -= deductAmount;
        if (batch.currentQuantity === 0) batch.status = 'Out of Stock';
        await batch.save();

        const movement = new StockMovement({
          movementId: 'MOV-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          stockEntryId: batch.stockId,
          barcode: batch.barcode,
          moduleType: batch.moduleType || 'Product',
          masterId: String(targetProductId),
          dealerId: batch.dealerId || '',
          quantity: deductAmount,
          movementType: 'Sold',
          date: new Date().toISOString().split('T')[0],
          reason: `Website Order #${oId}`,
          notes: `Sold to customer ${customer?.name || 'Customer'} from distributor ${batch.dealerName || 'Direct'}`
        });
        await movement.save();

        allocatedUnits.push({
          productId: String(targetProductId),
          productName: product.name,
          stockId: batch.stockId,
          distributorId: batch.dealerId,
          distributorName: batch.dealerName,
          barcode: batch.barcode,
          imei1: batch.imei1 || '',
          serialNumber: batch.serialNumber || '',
          quantity: deductAmount,
          purchasePrice: batch.purchasePrice
        });

        remainingToDeduct -= deductAmount;
      }

      // Calculate exact new master product stock (e.g. 41 - 1 = 40)
      const initialMasterStock = Number(product.stock) || 0;
      const newMasterStock = Math.max(0, initialMasterStock - qty);

      // Single Source of Truth: Sync Master Product Total Stock with remaining batches if present
      const allProductBatches = await StockEntry.find(masterIdQuery);
      let finalStock = newMasterStock;
      if (allProductBatches && allProductBatches.length > 0) {
        const batchTotal = allProductBatches.reduce((sum, b) => sum + (Number(b.currentQuantity) || 0), 0);
        finalStock = batchTotal;
      }

      const updatedProduct = await Product.findByIdAndUpdate(
        targetProductId,
        { stock: finalStock, inStock: finalStock > 0 },
        { new: true }
      );

      if (updatedProduct) {
        productsCache = null;
        cacheTimestamp = 0;
        const transformed = { ...updatedProduct.toObject(), id: updatedProduct._id.toString() };
        io.emit('product-updated', transformed);
        console.log(`📦 [WEBSITE ORDER DEDUCT SUCCESS] Product "${product.name}": ${initialMasterStock} -> ${finalStock} (Deducted: ${qty})`);
      }
    }

    orderData.allocatedUnits = allocatedUnits;

    let savedOrderObj = { ...orderData, orderId: oId, id: oId, _id: oId };

    if (mongoose.connection.readyState === 1) {
      try {
        const order = new Order(orderData);
        const savedDoc = await order.save();
        savedOrderObj = {
          ...savedDoc.toObject(),
          id: savedDoc._id.toString(),
          orderId: savedDoc.orderId || oId
        };
        console.log(`✅ Order #${oId} saved to MongoDB successfully.`);
      } catch (err) {
        console.warn(`⚠️ Could not save order #${oId} to MongoDB, saving to persistent local store:`, err.message);
      }
    } else {
      console.log(`⚠️ MongoDB offline/connecting. Saving order #${oId} to persistent local store.`);
    }

    // Always push to localOrdersStore & sync file
    const existingIndex = localOrdersStore.findIndex(o => String(o.orderId || o.id || o._id) === String(oId));
    if (existingIndex >= 0) {
      localOrdersStore[existingIndex] = savedOrderObj;
    } else {
      localOrdersStore.unshift(savedOrderObj);
    }
    saveLocalOrders();

    console.log(`✅ [WEBSITE ORDER CONFIRMED] Order #${oId} placed successfully and persisted.`);

    io.emit('order-added', savedOrderObj);
    res.json(savedOrderObj);
  } catch (error) {
    console.error('❌ Error saving order:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/orders/:orderId', async (req, res) => {
  try {
    const existingOrder = await Order.findOne({ orderId: req.params.orderId });
    if (!existingOrder) return res.status(404).json({ error: 'Order not found' });

    const newStatus = req.body.status;
    const isCancelOrRefund = newStatus && (newStatus.toLowerCase() === 'cancelled' || newStatus.toLowerCase() === 'refunded');

    // RESTORE STOCK IF ORDER IS CANCELLED / REFUNDED AND NOT YET RESTORED
    if (isCancelOrRefund && existingOrder.stockDeducted && !existingOrder.stockRestored) {
      console.log(`🔄 [ORDER CANCEL/REFUND] Restoring stock for Order #${existingOrder.orderId}...`);
      
      const allocated = existingOrder.allocatedUnits || [];
      for (const unit of allocated) {
        const batch = await StockEntry.findOne({ stockId: unit.stockId });
        if (batch) {
          batch.currentQuantity += (unit.quantity || 1);
          batch.status = 'In Stock';
          await batch.save();

          const movement = new StockMovement({
            movementId: 'MOV-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            stockEntryId: batch.stockId,
            barcode: batch.barcode,
            moduleType: 'Product',
            masterId: unit.productId,
            dealerId: batch.dealerId || '',
            quantity: unit.quantity || 1,
            movementType: 'Returned',
            date: new Date().toISOString().split('T')[0],
            reason: `Order ${newStatus} #${existingOrder.orderId}`,
            notes: `Stock restored to batch for ${batch.dealerName || 'Distributor'}`
          });
          await movement.save();
        }

        // Recalculate Master Product stock
        const allBatches = await StockEntry.find({ masterId: unit.productId });
        const totalStock = allBatches.reduce((s, b) => s + (Number(b.currentQuantity) || 0), 0);
        const updatedProd = await Product.findByIdAndUpdate(unit.productId, { stock: totalStock, inStock: totalStock > 0 }, { new: true });
        if (updatedProd) {
          productsCache = null;
          cacheTimestamp = 0;
          io.emit('product-updated', { ...updatedProd.toObject(), id: updatedProd._id.toString() });
        }
      }
      req.body.stockRestored = true;
    }

    const updatedOrder = await Order.findOneAndUpdate(
      { orderId: req.params.orderId },
      req.body,
      { new: true }
    );

    io.emit('order-updated', updatedOrder);
    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/orders/:orderId', async (req, res) => {
  try {
    console.log('🗑️ Deleting order:', req.params.orderId);
    const existingOrder = await Order.findOne({ orderId: req.params.orderId });
    if (!existingOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // RESTORE STOCK IF DELETED AND NOT YET RESTORED
    if (existingOrder.stockDeducted && !existingOrder.stockRestored) {
      console.log(`🔄 [ORDER DELETE] Restoring stock for Order #${existingOrder.orderId}...`);
      const allocated = existingOrder.allocatedUnits || [];
      for (const unit of allocated) {
        const batch = await StockEntry.findOne({ stockId: unit.stockId });
        if (batch) {
          batch.currentQuantity += (unit.quantity || 1);
          batch.status = 'In Stock';
          await batch.save();
        }
        const allBatches = await StockEntry.find({ masterId: unit.productId });
        const totalStock = allBatches.reduce((s, b) => s + (Number(b.currentQuantity) || 0), 0);
        const updatedProd = await Product.findByIdAndUpdate(unit.productId, { stock: totalStock, inStock: totalStock > 0 }, { new: true });
        if (updatedProd) {
          productsCache = null;
          cacheTimestamp = 0;
          io.emit('product-updated', { ...updatedProd.toObject(), id: updatedProd._id.toString() });
        }
      }
    }

    await Order.findOneAndDelete({ orderId: req.params.orderId });
    console.log('✅ Order deleted successfully:', req.params.orderId);
    io.emit('order-deleted', { orderId: req.params.orderId });
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting order:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint to process screenshot without saving to file
app.post('/api/test-image-upload', async (req, res) => {
  try {
    const { imageData, fileName } = req.body;
    
    if (!imageData || !fileName) {
      return res.status(400).json({ error: 'Missing imageData or fileName' });
    }
    
    console.log('🧪 Testing image processing (no file saving):', {
      fileName: fileName,
      dataLength: imageData.length,
      isValidFormat: imageData.startsWith('data:image/')
    });
    
    // Process image data without saving to file
    console.log('✅ Image processed successfully (stored in memory only)');
    
    res.json({
      success: true,
      originalFileName: fileName,
      dataLength: imageData.length,
      message: 'Image processed successfully - no file saved to disk'
    });
  } catch (error) {
    console.error('❌ Test image processing failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== SALES RECORDS ROUTES =====
app.get('/api/sales', async (req, res) => {
  try {
    const sales = await SalesRecord.find().sort({ createdAt: -1 });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sales', async (req, res) => {
  try {
    const saleId = 'SALE-' + Date.now();
    const cName = req.body.customerName || 'Walk-in Customer';
    const pPhone = req.body.phoneNumber || req.body.customerPhone || 'N/A';
    const pName = req.body.productName || (req.body.productItems && req.body.productItems[0] ? req.body.productItems[0].name : 'POS Quick Sale');
    const pDate = req.body.purchaseDate || new Date().toLocaleDateString('en-IN');

    const sale = new SalesRecord({
      ...req.body,
      saleId,
      customerName: cName,
      phoneNumber: pPhone,
      productName: pName,
      purchaseDate: pDate,
      createdAt: pDate
    });
    await sale.save();

    // AUTO STOCK DEDUCTION LOGIC (Master Product + Scanned Units / Batch Level FIFO)
    const deductProduct = async (item) => {
      const pId = item.id || item.productId || item._id;
      const qty = parseInt(item.quantity || 1, 10);
      if (!pId) return;

      try {
        let product = null;
        if (mongoose.Types.ObjectId.isValid(pId)) {
          product = await Product.findById(pId);
        }
        if (!product) {
          product = await Product.findOne({ id: String(pId) });
        }
        if (!product) return;

        const targetProductId = product._id;

        // If specific scanned units (barcodes/IMEIs) are attached:
        if (item.scannedUnits && Array.isArray(item.scannedUnits) && item.scannedUnits.length > 0) {
          for (const u of item.scannedUnits) {
            const batch = await StockEntry.findOne({ stockId: u.stockId });
            if (batch) {
              batch.currentQuantity = Math.max(0, batch.currentQuantity - 1);
              if (batch.currentQuantity === 0) batch.status = 'Out of Stock';
              await batch.save();

              const movement = new StockMovement({
                movementId: 'MOV-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                stockEntryId: batch.stockId,
                barcode: batch.barcode,
                moduleType: batch.moduleType || 'Product',
                masterId: String(targetProductId),
                dealerId: batch.dealerId || '',
                quantity: 1,
                movementType: 'Sold',
                date: new Date().toISOString().split('T')[0],
                reason: `POS Sale #${saleId}`,
                notes: `Sold via Barcode Scan (${batch.barcode}) from distributor ${batch.dealerName || 'Direct'}`
              });
              await movement.save();
            }
          }
        } else {
          // FIFO deduction across distributor batches
          const batches = await StockEntry.find({
            $or: [
              { masterId: String(targetProductId) },
              { masterId: String(pId) }
            ],
            currentQuantity: { $gt: 0 }
          }).sort({ createdAt: 1 });

          let remainingToDeduct = qty;
          for (const batch of batches) {
            if (remainingToDeduct <= 0) break;
            const deductAmount = Math.min(batch.currentQuantity, remainingToDeduct);
            batch.currentQuantity -= deductAmount;
            if (batch.currentQuantity === 0) batch.status = 'Out of Stock';
            await batch.save();

            const movement = new StockMovement({
              movementId: 'MOV-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
              stockEntryId: batch.stockId,
              barcode: batch.barcode,
              moduleType: batch.moduleType || 'Product',
              masterId: String(targetProductId),
              dealerId: batch.dealerId || '',
              quantity: deductAmount,
              movementType: 'Sold',
              date: new Date().toISOString().split('T')[0],
              reason: `POS Sale #${saleId}`,
              notes: `Sold from distributor ${batch.dealerName || 'Direct'}`
            });
            await movement.save();

            remainingToDeduct -= deductAmount;
          }
        }

        // Calculate exact new master product stock (e.g. 41 - 1 = 40)
        const initialMasterStock = Number(product.stock) || 0;
        const newMasterStock = Math.max(0, initialMasterStock - qty);

        // Check if distributor purchase batches exist in StockEntry
        const allBatches = await StockEntry.find({
          $or: [{ masterId: String(targetProductId) }, { masterId: String(pId) }]
        });

        let finalStock = newMasterStock;
        if (allBatches && allBatches.length > 0) {
          const batchTotal = allBatches.reduce((s, b) => s + (Number(b.currentQuantity) || 0), 0);
          finalStock = batchTotal;
        }

        const updatedProduct = await Product.findByIdAndUpdate(
          targetProductId,
          { stock: finalStock, inStock: finalStock > 0 },
          { new: true }
        );

        if (updatedProduct) {
          productsCache = null;
          cacheTimestamp = 0;
          const transformed = { ...updatedProduct.toObject(), id: updatedProduct._id.toString() };
          io.emit('product-updated', transformed);
          console.log(`📦 [POS SALE DEDUCT SUCCESS] Product "${product.name}": ${initialMasterStock} -> ${finalStock} (Deducted: ${qty})`);
        }
      } catch (err) {
        console.error(`⚠️ Failed to auto-deduct stock for product ${pId}:`, err.message);
      }
    };

    if (req.body.productItems && Array.isArray(req.body.productItems) && req.body.productItems.length > 0) {
      for (const item of req.body.productItems) {
        await deductProduct(item);
      }
    } else if (req.body.productId) {
      await deductProduct(req.body);
    }

    io.emit('sale-added', sale);
    res.json(sale);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/sales/:saleId', async (req, res) => {
  try {
    const sale = await SalesRecord.findOneAndUpdate({ saleId: req.params.saleId }, req.body, { new: true });
    io.emit('sale-updated', sale);
    res.json(sale);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/sales/:saleId', async (req, res) => {
  try {
    await SalesRecord.findOneAndDelete({ saleId: req.params.saleId });
    io.emit('sale-deleted', { saleId: req.params.saleId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== SERVICES ROUTES =====
app.get('/api/services', async (req, res) => {
  try {
    const services = await ServiceRecord.find().sort({ createdAt: -1 });
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/services', async (req, res) => {
  try {
    const serviceId = 'SVC-' + Date.now();
    const service = new ServiceRecord({ ...req.body, serviceId });
    await service.save();
    res.json(service);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/services/:serviceId', async (req, res) => {
  try {
    const service = await ServiceRecord.findOneAndUpdate(
      { serviceId: req.params.serviceId }, req.body, { new: true }
    );
    res.json(service);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/services/:serviceId', async (req, res) => {
  try {
    await ServiceRecord.findOneAndDelete({ serviceId: req.params.serviceId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== DISPLAY STOCK ROUTES =====
app.get('/api/display-stock', async (req, res) => {
  try {
    const items = await DisplayStock.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/display-stock', async (req, res) => {
  try {
    const stockItemId = 'STK-' + Date.now();
    const item = new DisplayStock({ ...req.body, stockItemId });
    await item.save();
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/display-stock/:stockItemId', async (req, res) => {
  try {
    const { displayName, displayId, price } = req.body;
    const item = await DisplayStock.findOneAndUpdate(
      { stockItemId: req.params.stockItemId },
      { $set: { displayName, displayId, price: price ?? null } },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (error) {
    console.error('❌ Error editing display stock:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/display-stock/:stockItemId', async (req, res) => {
  try {
    const { stock, historyEntry } = req.body;
    const item = await DisplayStock.findOne({ stockItemId: req.params.stockItemId });
    if (!item) return res.status(404).json({ error: 'Not found' });

    item.stock = stock;

    if (historyEntry) {
      // Use $push via findOneAndUpdate to avoid Mongoose mixed-type array mutation issues
      const updated = await DisplayStock.findOneAndUpdate(
        { stockItemId: req.params.stockItemId },
        {
          $set: { stock },
          $push: { history: historyEntry }
        },
        { new: true }
      );
      return res.json(updated);
    }

    await item.save();
    res.json(item);
  } catch (error) {
    console.error('❌ Error updating display stock:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/display-stock/:stockItemId', async (req, res) => {
  try {
    await DisplayStock.findOneAndDelete({ stockItemId: req.params.stockItemId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SMS notification endpoint
app.post('/api/send-order-sms', async (req, res) => {
  try {
    const { orderDetails, ownerPhone } = req.body;
    
    // Prepare SMS message
    const itemsList = orderDetails.items.map(item => 
      `${item.name} x${item.quantity} = Rs${item.price * item.quantity}`
    ).join(', ');
    
    const smsMessage = `New Order #${orderDetails.id}
Customer: ${orderDetails.customer.name}
Phone: ${orderDetails.customer.phone}
Address: ${orderDetails.customer.address}
Items: ${itemsList}
Total: Rs${orderDetails.total}
Payment: ${orderDetails.paymentMethod}`;
    
    // Log order details (SMS will be sent via SMS service)
    console.log('📱 New Order - SMS to be sent:');
    console.log('To:', ownerPhone);
    console.log('Message:', smsMessage);
    console.log('---');
    
    // TODO: Integrate with SMS service (Fast2SMS, Twilio, MSG91, etc.)
    // Example with Fast2SMS (you'll need to sign up and get API key):
    /*
    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'authorization': 'YOUR_FAST2SMS_API_KEY',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        route: 'q',
        message: smsMessage,
        language: 'english',
        flash: 0,
        numbers: ownerPhone
      })
    });
    */
    
    // For now, just log and return success
    res.json({ 
      success: true, 
      message: 'Order received and SMS queued',
      orderId: orderDetails.id 
    });
  } catch (error) {
    console.error('Error processing order:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== SPARE PARTS ROUTES =====
const getSparePartsModel = () => mongoose.models.SpareParts || SpareParts;

app.get('/api/spare-parts', async (req, res) => {
  try {
    const SP = getSparePartsModel();
    const items = await SP.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/spare-parts', async (req, res) => {
  try {
    const SP = getSparePartsModel();
    const partItemId = 'PART-' + Date.now();
    const item = new SP({ ...req.body, partItemId });
    await item.save();
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/spare-parts/:partItemId', async (req, res) => {
  try {
    const SP = getSparePartsModel();
    const { partName, partId, ownerPrice, customerPrice, stock } = req.body;
    const updateFields = { partName, partId, ownerPrice: ownerPrice ?? null, customerPrice: customerPrice ?? null };
    if (stock !== undefined) updateFields.stock = stock;
    const item = await SP.findOneAndUpdate(
      { partItemId: req.params.partItemId },
      { $set: updateFields },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (error) {
    console.error('❌ Error editing spare part:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/spare-parts/:partItemId', async (req, res) => {
  try {
    const SP = getSparePartsModel();
    const { stock, historyEntry } = req.body;
    const item = await SP.findOne({ partItemId: req.params.partItemId });
    if (!item) return res.status(404).json({ error: 'Not found' });

    if (historyEntry) {
      const updated = await SP.findOneAndUpdate(
        { partItemId: req.params.partItemId },
        { $set: { stock }, $push: { history: historyEntry } },
        { new: true }
      );
      return res.json(updated);
    }

    item.stock = stock;
    await item.save();
    res.json(item);
  } catch (error) {
    console.error('❌ Error updating spare part stock:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/spare-parts/:partItemId', async (req, res) => {
  try {
    const SP = getSparePartsModel();
    await SP.findOneAndDelete({ partItemId: req.params.partItemId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// ===== STOCK ENTRIES ROUTES =====
app.get('/api/stock-entries', async (req, res) => {
  try {
    const { moduleType, masterId, dealerId } = req.query;
    const query = {};
    if (moduleType) query.moduleType = moduleType;
    if (masterId) query.masterId = masterId;
    if (dealerId) query.dealerId = dealerId;

    const entries = await StockEntry.find(query).sort({ createdAt: -1 });
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stock-entries/barcode/:barcode', async (req, res) => {
  try {
    const entry = await StockEntry.findOne({ barcode: req.params.barcode });
    if (!entry) return res.status(404).json({ error: 'Barcode not found' });
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stock-entries', async (req, res) => {
  try {
    const { moduleType } = req.body;
    const prefix = moduleType === 'Product' ? 'STK-PROD-' : moduleType === 'Display' ? 'STK-DISP-' : 'STK-SP-';
    const count = await StockEntry.countDocuments({ moduleType });
    const formattedNum = String(count + 1).padStart(6, '0');
    const barcode = req.body.barcode || `${prefix}${formattedNum}`;
    const stockId = 'STK-' + Date.now();

    const initialQty = Number(req.body.initialQuantity || req.body.quantity || 0);
    const entryData = {
      ...req.body,
      stockId,
      barcode,
      initialQuantity: initialQty,
      currentQuantity: req.body.currentQuantity !== undefined ? Number(req.body.currentQuantity) : initialQty
    };

    const entry = new StockEntry(entryData);
    await entry.save();

    // Log initial Stock Added movement
    const movement = new StockMovement({
      movementId: 'MOV-' + Date.now(),
      stockEntryId: entry.stockId,
      barcode: entry.barcode,
      moduleType: entry.moduleType,
      masterId: entry.masterId,
      dealerId: entry.dealerId,
      quantity: initialQty,
      movementType: 'Stock Added',
      date: entry.purchaseDate || new Date().toISOString().split('T')[0],
      reason: 'Initial Purchase Batch',
      notes: `Purchased from ${entry.dealerName || 'Dealer'}`
    });
    await movement.save();

    console.log(`📦 Stock Entry Created [${entry.moduleType}]: ${entry.barcode} (${initialQty} units)`);
    res.json(entry);
  } catch (error) {
    console.error('❌ Error creating stock entry:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/stock-entries/:stockId', async (req, res) => {
  try {
    const entry = await StockEntry.findOneAndUpdate(
      { stockId: req.params.stockId },
      { $set: req.body },
      { new: true }
    );
    if (!entry) return res.status(404).json({ error: 'Stock entry not found' });
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/stock-entries/:stockId', async (req, res) => {
  try {
    await StockEntry.findOneAndDelete({ stockId: req.params.stockId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== STOCK MOVEMENTS ROUTES =====
app.get('/api/stock-movements', async (req, res) => {
  try {
    const movements = await StockMovement.find().sort({ createdAt: -1 });
    res.json(movements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stock-movements', async (req, res) => {
  try {
    const movementId = 'MOV-' + Date.now();
    const movement = new StockMovement({ ...req.body, movementId });
    await movement.save();

    // Deduct/Adjust stock entry if stockEntryId is supplied
    if (movement.stockEntryId) {
      const entry = await StockEntry.findOne({ stockId: movement.stockEntryId });
      if (entry) {
        if (movement.movementType === 'Sold' || movement.movementType === 'Damaged') {
          entry.currentQuantity = Math.max(0, entry.currentQuantity - movement.quantity);
        } else if (movement.movementType === 'Returned' || movement.movementType === 'Stock Added') {
          entry.currentQuantity += movement.quantity;
        }
        entry.status = entry.currentQuantity > 0 ? 'In Stock' : 'Out of Stock';
        await entry.save();
      }
    }

    res.json(movement);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== DISTRIBUTORS ROUTES =====
app.get('/api/distributors', async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) query.status = status;
    const distributors = await Distributor.find(query).sort({ name: 1 });
    res.json(distributors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Backward compatibility alias for dealers API
app.get('/api/dealers', async (req, res) => {
  try {
    const distributors = await Distributor.find().sort({ name: 1 });
    const formatted = distributors.map(d => ({ ...d.toObject(), dealerId: d.distributorId, dealerName: d.name, companyName: d.code }));
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/distributors', async (req, res) => {
  try {
    const { name, code, contactPerson, phone, email, address, gstNumber, status, notes } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Distributor Name and Phone Number are required' });
    }

    const distributorId = 'DIST-' + Date.now();
    const distributor = new Distributor({
      distributorId,
      name,
      code: code || name.substring(0, 4).toUpperCase(),
      contactPerson: contactPerson || '',
      phone,
      email: email || '',
      address: address || '',
      gstNumber: gstNumber || '',
      status: status || 'Active',
      notes: notes || ''
    });

    await distributor.save();
    console.log('✅ Distributor created:', distributor.name);
    res.json(distributor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/distributors/:distributorId', async (req, res) => {
  try {
    const distributor = await Distributor.findOneAndUpdate(
      { distributorId: req.params.distributorId },
      { $set: req.body },
      { new: true }
    );
    if (!distributor) return res.status(404).json({ error: 'Distributor not found' });
    res.json(distributor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/distributors/:distributorId/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Active', 'Inactive'].includes(status)) {
      return res.status(400).json({ error: 'Status must be Active or Inactive' });
    }
    const doc = await Distributor.findOneAndUpdate(
      { distributorId: req.params.distributorId },
      { $set: { status } },
      { new: true }
    );
    if (!doc) return res.status(404).json({ error: 'Dealer not found' });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/distributors/:distributorId', async (req, res) => {
  try {
    const deleted = await Distributor.findOneAndDelete({
      $or: [
        { distributorId: req.params.distributorId },
        { _id: mongoose.Types.ObjectId.isValid(req.params.distributorId) ? req.params.distributorId : null }
      ].filter(q => q._id !== null)
    });
    if (!deleted) return res.status(404).json({ error: 'Distributor not found' });
    console.log(`🗑️ [DISTRIBUTOR DELETED] ${deleted.distributorId} - ${deleted.name}`);
    res.json({ message: 'Distributor deleted successfully', distributorId: deleted.distributorId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== PURCHASE ENTRY & BATCHES ROUTES =====
app.post('/api/purchases', async (req, res) => {
  try {
    const pId = req.body.productId || req.body.masterId;
    const dId = req.body.distributorId || req.body.dealerId;
    const qty = parseInt(req.body.quantity || req.body.initialQuantity || 0, 10);
    const costPrice = Number(req.body.purchasePrice || 0);

    if (!pId || qty <= 0 || costPrice < 0) {
      return res.status(400).json({ error: 'Product ID, valid Quantity (>0), and Purchase Price are required' });
    }

    let product = null;
    if (mongoose.Types.ObjectId.isValid(pId)) {
      product = await Product.findById(pId);
    }
    if (!product) {
      product = await Product.findOne({ id: String(pId) });
    }

    if (!product) {
      product = await Product.findOne();
    }

    if (!product) {
      return res.status(404).json({ error: 'Product not found in database' });
    }

    let distributorName = 'Direct Purchase';
    if (dId) {
      const dist = await Distributor.findOne({ distributorId: dId });
      if (dist) distributorName = dist.name;
    }
    if (req.body.dealerName || req.body.distributorName) {
      distributorName = req.body.dealerName || req.body.distributorName;
    }

    const pDate = req.body.purchaseDate || new Date().toISOString().split('T')[0];
    const invNum = req.body.invoiceNumber || `INV-${Date.now()}`;
    const notes = req.body.notes || '';
    const items = req.body.items || [];

    // Create StockEntry batch(es)
    const createdEntries = [];

    // If unit-level items (with IMEIs/serials) provided:
    if (items && Array.isArray(items) && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const count = await StockEntry.countDocuments({ moduleType: 'Product' });
        const barcode = item.barcode || item.serialNumber || item.imei1 || `STK-PROD-${String(count + 1).padStart(6, '0')}`;
        const stockId = 'STK-' + Date.now() + '-' + i;

        const entry = new StockEntry({
          stockId,
          moduleType: 'Product',
          masterId: String(product._id),
          masterName: product.name,
          dealerId: dId || '',
          dealerName: distributorName,
          purchaseDate: pDate,
          initialQuantity: 1,
          currentQuantity: 1,
          purchasePrice: costPrice,
          mrp: product.originalPrice || 0,
          sellingPrice: product.price || 0,
          barcode,
          imei1: item.imei1 || '',
          imei2: item.imei2 || '',
          serialNumber: item.serialNumber || '',
          notes: notes ? `${notes} (Inv: ${invNum})` : `Inv: ${invNum}`,
          status: 'In Stock'
        });
        await entry.save();
        createdEntries.push(entry);

        const movement = new StockMovement({
          movementId: 'MOV-' + Date.now() + '-' + i,
          stockEntryId: entry.stockId,
          barcode: entry.barcode,
          moduleType: 'Product',
          masterId: String(product._id),
          dealerId: dId || '',
          quantity: 1,
          movementType: 'Stock Purchased',
          date: pDate,
          reason: `Purchase Batch Inv #${invNum}`,
          notes: `Purchased from ${distributorName}`
        });
        await movement.save();
      }
    } else {
      // Bulk batch entry
      const count = await StockEntry.countDocuments({ moduleType: 'Product' });
      const barcode = req.body.barcode || req.body.imei1 || req.body.serialNumber || `STK-PROD-${String(count + 1).padStart(6, '0')}`;
      const stockId = 'STK-' + Date.now();

      const entry = new StockEntry({
        stockId,
        moduleType: 'Product',
        masterId: String(product._id),
        masterName: product.name,
        dealerId: dId || '',
        dealerName: distributorName,
        purchaseDate: pDate,
        initialQuantity: qty,
        currentQuantity: qty,
        purchasePrice: costPrice,
        mrp: product.originalPrice || 0,
        sellingPrice: product.price || 0,
        barcode,
        imei1: req.body.imei1 || '',
        serialNumber: req.body.serialNumber || '',
        notes: notes ? `${notes} (Inv: ${invNum})` : `Inv: ${invNum}`,
        status: 'In Stock'
      });
      await entry.save();
      createdEntries.push(entry);

      const movement = new StockMovement({
        movementId: 'MOV-' + Date.now(),
        stockEntryId: entry.stockId,
        barcode: entry.barcode,
        moduleType: 'Product',
        masterId: String(product._id),
        dealerId: dId || '',
        quantity: qty,
        movementType: 'Stock Purchased',
        date: pDate,
        reason: `Purchase Batch Inv #${invNum}`,
        notes: `Purchased ${qty} units from ${distributorName}`
      });
      await movement.save();
    }

    // Recalculate Master Product Total Stock
    const allBatches = await StockEntry.find({
      $or: [{ masterId: String(product._id) }, { masterId: String(pId) }]
    });
    const totalAvailableStock = allBatches.reduce((sum, b) => sum + (Number(b.currentQuantity) || 0), 0);

    const updatedProduct = await Product.findByIdAndUpdate(
      product._id,
      { stock: totalAvailableStock, inStock: totalAvailableStock > 0 },
      { new: true }
    );

    if (updatedProduct) {
      const transformed = { ...updatedProduct.toObject(), id: updatedProduct._id.toString() };
      io.emit('product-updated', transformed);
    }

    console.log(`📦 [PURCHASE ENTRY] Added ${qty} units of ${product.name} from ${distributorName}. Total stock: ${totalAvailableStock}`);

    res.json({
      success: true,
      message: `Successfully recorded purchase of ${qty} units for ${product.name}`,
      product: updatedProduct,
      batches: createdEntries
    });
  } catch (error) {
    console.error('❌ Error recording purchase:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/purchases/history', async (req, res) => {
  try {
    const { distributorId, productId, search, moduleType } = req.query;
    const query = {};
    if (moduleType) query.moduleType = moduleType;

    if (distributorId) query.dealerId = distributorId;
    if (productId) query.masterId = String(productId);

    if (search) {
      query.$or = [
        { masterName: { $regex: search, $options: 'i' } },
        { dealerName: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }

    const entries = await StockEntry.find(query).sort({ createdAt: -1 });
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== REPORTS & VALUATION ROUTES =====
app.get('/api/reports/distributor-summary', async (req, res) => {
  try {
    const distributors = await Distributor.find();
    const stockEntries = await StockEntry.find();

    const summary = distributors.map(d => {
      const dEntries = stockEntries.filter(e => e.dealerId === d.distributorId || e.dealerName === d.name);
      const totalPurchasedQty = dEntries.reduce((sum, e) => sum + (Number(e.initialQuantity) || 0), 0);
      const availableStock = dEntries.reduce((sum, e) => sum + (Number(e.currentQuantity) || 0), 0);
      const soldQty = Math.max(0, totalPurchasedQty - availableStock);
      const totalPurchaseValue = dEntries.reduce((sum, e) => sum + ((Number(e.purchasePrice) || 0) * (Number(e.initialQuantity) || 0)), 0);
      const currentStockValue = dEntries.reduce((sum, e) => sum + ((Number(e.purchasePrice) || 0) * (Number(e.currentQuantity) || 0)), 0);

      return {
        distributorId: d.distributorId,
        name: d.name,
        code: d.code,
        phone: d.phone,
        status: d.status,
        totalPurchasedQty,
        soldQty,
        availableStock,
        totalPurchaseValue,
        currentStockValue
      };
    });

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reports/product-distributors/:productId', async (req, res) => {
  try {
    const entries = await StockEntry.find({ masterId: String(req.params.productId) });
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reports/stock-valuation', async (req, res) => {
  try {
    const entries = await StockEntry.find({ currentQuantity: { $gt: 0 } });
    const products = await Product.find();

    const totalValuation = entries.reduce((sum, e) => sum + ((Number(e.purchasePrice) || 0) * (Number(e.currentQuantity) || 0)), 0);
    const totalUnits = entries.reduce((sum, e) => sum + (Number(e.currentQuantity) || 0), 0);

    res.json({
      totalValuation,
      totalUnits,
      activeBatches: entries.length,
      productsCount: products.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 MongoDB URI configured: ${process.env.MONGO_URI ? 'Yes' : 'No'}`);
});
