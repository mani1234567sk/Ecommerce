const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== CONFIGURATION ====================
// Mongo configuration (falls back to provided URI if env is missing)
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://MAni1231:Mani123@cluster0.sumhwak.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const DB_NAME = process.env.MONGODB_DB || "ecommerce";

// ==================== DATABASE CONNECTION ====================
let db;
let isDBConnected = false;

async function connectDB() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    const client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });
    
    await client.connect();
    db = client.db(DB_NAME);
    isDBConnected = true;
    
    console.log('✅ Connected to MongoDB successfully!');
    
    // First, clean up any documents with null or missing id
    await cleanupDatabase();
    
    // Then create indexes
    try {
      await db.collection('products').createIndex({ id: 1 }, { unique: true });
      await db.collection('products').createIndex({ category: 1 });
      await db.collection('ads').createIndex({ createdAt: -1 });
      console.log('✅ Database indexes created');
    } catch (indexError) {
      console.warn('⚠️ Could not create indexes:', indexError.message);
    }
    
    // Initialize sample products if collection is empty
    await initializeSampleProducts();
    
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    isDBConnected = false;
    console.log('⚠️ Running in fallback mode without database');
  }
}

// Clean up database - fix documents with null or missing id
async function cleanupDatabase() {
  try {
    console.log('🧹 Cleaning up database...');
    
    // Find all documents
    const allProducts = await db.collection('products').find({}).toArray();
    
    // Fix documents with null or missing id
    let maxId = 0;
    const updates = [];
    
    // First, find the maximum id
    for (const product of allProducts) {
      if (product.id && product.id > maxId) {
        maxId = product.id;
      }
    }
    
    // Fix documents with null or missing id
    for (const product of allProducts) {
      if (!product.id || product.id === null) {
        maxId++;
        updates.push({
          updateOne: {
            filter: { _id: product._id },
            update: { $set: { id: maxId } }
          }
        });
      }
    }
    
    // Also check for duplicate ids
    const idMap = new Map();
    for (const product of allProducts) {
      if (product.id) {
        if (idMap.has(product.id)) {
          maxId++;
          updates.push({
            updateOne: {
              filter: { _id: product._id },
              update: { $set: { id: maxId } }
            }
          });
        } else {
          idMap.set(product.id, true);
        }
      }
    }
    
    // Apply updates if needed
    if (updates.length > 0) {
      console.log(`🔧 Fixing ${updates.length} documents...`);
      await db.collection('products').bulkWrite(updates);
      console.log('✅ Database cleanup completed');
    } else {
      console.log('✅ Database is already clean');
    }
    
  } catch (error) {
    console.error('❌ Error cleaning up database:', error.message);
  }
}

// ==================== SAMPLE PRODUCTS ====================
async function initializeSampleProducts() {
  if (!isDBConnected) {
    console.log('⚠️ Skipping sample products initialization - DB not connected');
    return;
  }
  
  try {
    const count = await db.collection('products').countDocuments();
    
    if (count === 0) {
      console.log('📦 Initializing sample products...');
      
      const sampleProducts = [
        {
          id: 1,
          name: "Premium Wireless Headphones",
          description: "Noise-cancelling wireless headphones with 30-hour battery life. Perfect for music lovers and professionals.",
          price: 8499,
          category: "electronics",
          images: [
            "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=800&fit=crop",
            "https://images.unsplash.com/photo-1487215078519-e21cc028cb29?w=800&h=800&fit=crop"
          ],
          specifications: {
            brand: "AudioTech Pro",
            battery: "30 hours",
            connectivity: "Bluetooth 5.2",
            color: "Matte Black",
            warranty: "1 Year"
          },
          variations: [
            { color: "Black", price: 8499, stock: 15, sku: "AUD-BLK-001" },
            { color: "White", price: 8999, stock: 8, sku: "AUD-WHT-001" },
            { color: "Blue", price: 8799, stock: 5, sku: "AUD-BLU-001" }
          ],
          featured: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: ["electronics", "audio", "headphones", "wireless"]
        },
        {
          id: 2,
          name: "Men's Premium Cotton Shirt",
          description: "100% premium cotton shirt with perfect stitching. Comfortable for all-day wear in office or casual outings.",
          price: 1999,
          category: "clothing",
          images: [
            "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&h=800&fit=crop",
            "https://images.unsplash.com/photo-1618354691792-d1d42acfd860?w=800&h=800&fit=crop"
          ],
          specifications: {
            fabric: "100% Premium Cotton",
            fit: "Regular Fit",
            care: "Machine Wash Cold",
            origin: "Made in Pakistan",
            collar: "Classic Button-Down"
          },
          variations: [
            { size: "S", color: "Sky Blue", price: 1999, stock: 20, sku: "SHIRT-S-BLU" },
            { size: "M", color: "Sky Blue", price: 1999, stock: 25, sku: "SHIRT-M-BLU" },
            { size: "L", color: "Sky Blue", price: 1999, stock: 15, sku: "SHIRT-L-BLU" }
          ],
          featured: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: ["clothing", "shirt", "men", "cotton"]
        },
        {
          id: 3,
          name: "French Lavender Luxury Perfume",
          description: "Authentic French lavender perfume with 24-hour lasting fragrance. Made with natural essential oils in Grasse, France.",
          price: 6499,
          category: "perfumes",
          images: [
            "https://images.unsplash.com/photo-1541643600914-78b084683601?w=800&h=800&fit=crop"
          ],
          specifications: {
            fragrance: "French Lavender",
            duration: "24 hours",
            gender: "Unisex",
            origin: "Grasse, France"
          },
          variations: [
            { size: "50ml", price: 6499, stock: 30, sku: "PERF-50ML" },
            { size: "100ml", price: 11999, stock: 15, sku: "PERF-100ML" }
          ],
          featured: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: ["perfume", "fragrance", "luxury", "lavender"]
        },
        {
          id: 4,
          name: "Professional Running Shoes",
          description: "Lightweight running shoes with advanced air cushioning technology. Perfect for jogging, gym, and sports activities.",
          price: 4999,
          category: "footwear",
          images: [
            "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&h=800&fit=crop"
          ],
          specifications: {
            material: "Breathable Mesh & Rubber",
            weight: "280 grams",
            type: "Running Shoes",
            gender: "Men"
          },
          variations: [
            { size: "8", color: "Black/Red", price: 4999, stock: 12, sku: "SHOE-8-BR" },
            { size: "9", color: "Black/Red", price: 4999, stock: 18, sku: "SHOE-9-BR" }
          ],
          featured: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: ["footwear", "shoes", "sports", "running"]
        },
        {
          id: 5,
          name: "Genuine Leather Women's Handbag",
          description: "Elegant genuine leather handbag with multiple compartments. Spacious enough for laptop, perfect for office and travel.",
          price: 12999,
          category: "bags",
          images: [
            "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&h=800&fit=crop"
          ],
          specifications: {
            material: "100% Genuine Leather",
            compartments: "3 Main + 6 Pockets",
            closure: "Zipper & Magnetic",
            style: "Professional Tote"
          },
          variations: [
            { color: "Classic Brown", price: 12999, stock: 10, sku: "BAG-BROWN" },
            { color: "Elegant Black", price: 13499, stock: 12, sku: "BAG-BLACK" }
          ],
          featured: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: ["bags", "handbag", "leather", "women"]
        }
      ];
      
      await db.collection('products').insertMany(sampleProducts);
      console.log(`✅ Added ${sampleProducts.length} sample products to database`);
    } else {
      console.log(`📊 Database already has ${count} products`);
    }
  } catch (error) {
    console.error('❌ Error initializing sample products:', error.message);
  }
}

// ==================== MIDDLEWARE ====================
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname));

// ==================== HELPER FUNCTIONS ====================
function formatResponse(success, data = null, error = null, message = null) {
  return {
    success,
    data,
    error,
    message
  };
}

// Get next available ID
async function getNextProductId() {
  if (!isDBConnected || !db) {
    return 1; // Fallback for in-memory mode
  }
  
  try {
    const lastProduct = await db.collection('products')
      .find()
      .sort({ id: -1 })
      .limit(1)
      .toArray();
    
    return lastProduct.length > 0 ? lastProduct[0].id + 1 : 1;
  } catch (error) {
    console.error('Error getting next product ID:', error);
    return 1;
  }
}

// ==================== API ROUTES ====================

// 1. HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json(formatResponse(true, {
    status: 'healthy',
    database: isDBConnected ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  }));
});

// 2. GET ALL PRODUCTS
app.get('/api/products', async (req, res) => {
  try {
    const { category, featured, page = 1, limit = 100 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let products = [];
    let total = 0;
    
    if (isDBConnected && db) {
      let query = {};
      
      // Filter by category
      if (category && category !== 'all') {
        query.category = category;
      }
      
      // Filter featured products
      if (featured === 'true') {
        query.featured = true;
      }
      
      products = await db.collection('products')
        .find(query)
        .sort({ id: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .toArray();
      
      total = await db.collection('products').countDocuments(query);
    } else {
      return res.status(500).json(formatResponse(false, null, 'Database not connected'));
    }
    
    res.json(formatResponse(true, {
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    }));
    
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json(formatResponse(false, null, 'Failed to fetch products', error.message));
  }
});

// 3. GET SINGLE PRODUCT
app.get('/api/products/:id', async (req, res) => {
  try {
    if (!isDBConnected || !db) {
      return res.status(500).json(formatResponse(false, null, 'Database not connected'));
    }
    
    const productId = parseInt(req.params.id);
    const product = await db.collection('products').findOne({ id: productId });
    
    if (!product) {
      return res.status(404).json(formatResponse(false, null, 'Product not found'));
    }
    
    res.json(formatResponse(true, product));
    
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json(formatResponse(false, null, 'Failed to fetch product', error.message));
  }
});

// 4. GET PRODUCTS BY CATEGORY
app.get('/api/products/category/:category', async (req, res) => {
  try {
    if (!isDBConnected || !db) {
      return res.status(500).json(formatResponse(false, null, 'Database not connected'));
    }
    
    const category = req.params.category;
    const products = await db.collection('products')
      .find({ category: category })
      .sort({ id: 1 })
      .toArray();
    
    res.json(formatResponse(true, {
      products,
      count: products.length
    }));
    
  } catch (error) {
    console.error('Error fetching products by category:', error);
    res.status(500).json(formatResponse(false, null, 'Failed to fetch products', error.message));
  }
});

// 5. GET ALL CATEGORIES
app.get('/api/categories', async (req, res) => {
  try {
    if (!isDBConnected || !db) {
      return res.status(500).json(formatResponse(false, null, 'Database not connected'));
    }
    
    const categories = await db.collection('products').distinct('category');
    
    res.json(formatResponse(true, categories.filter(cat => cat)));
    
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json(formatResponse(false, null, 'Failed to fetch categories', error.message));
  }
});

// 6. ADD NEW PRODUCT
app.post('/api/products', async (req, res) => {
  try {
    if (!isDBConnected || !db) {
      return res.status(500).json(formatResponse(false, null, 'Database not connected'));
    }
    
    console.log('📥 Received product data');
    
    const { name, description, price, category, images, specifications, variations } = req.body;
    
    // Validate required fields
    if (!name || !description || !price || !category) {
      return res.status(400).json(formatResponse(false, null, 
        'Missing required fields: name, description, price, category'));
    }
    
    // Get next ID
    const newId = await getNextProductId();
    
    // Ensure images array
    const processedImages = Array.isArray(images) ? images : 
      (images ? [images] : ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&h=800&fit=crop']);
    
    // Process variations
    let processedVariations = [];
    if (variations && Array.isArray(variations)) {
      processedVariations = variations.map((v, index) => ({
        ...v,
        price: parseInt(v.price) || parseInt(price),
        stock: parseInt(v.stock) || 10,
        sku: v.sku || `${category.substring(0, 3).toUpperCase()}-${newId}-${index + 1}`
      }));
    }
    
    const newProduct = {
      id: newId,
      name,
      description,
      price: parseInt(price),
      category,
      images: processedImages,
      specifications: specifications || {},
      variations: processedVariations,
      featured: req.body.featured === true || req.body.featured === 'true',
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: req.body.tags || []
    };
    
    console.log('💾 Saving product with ID:', newId);
    
    const result = await db.collection('products').insertOne(newProduct);
    
    res.status(201).json(formatResponse(true, {
      ...newProduct,
      _id: result.insertedId
    }, null, 'Product added successfully'));
    
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json(formatResponse(false, null, 'Failed to add product', error.message));
  }
});

// 7. UPDATE PRODUCT
app.put('/api/products/:id', async (req, res) => {
  try {
    if (!isDBConnected || !db) {
      return res.status(500).json(formatResponse(false, null, 'Database not connected'));
    }
    
    const productId = parseInt(req.params.id);
    const updateData = { ...req.body, updatedAt: new Date() };
    
    // Remove fields that shouldn't be updated
    delete updateData._id;
    delete updateData.id;
    delete updateData.createdAt;
    
    // Convert price to number if present
    if (updateData.price) {
      updateData.price = parseInt(updateData.price);
    }
    
    const result = await db.collection('products').updateOne(
      { id: productId },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json(formatResponse(false, null, 'Product not found'));
    }
    
    const updatedProduct = await db.collection('products').findOne({ id: productId });
    
    res.json(formatResponse(true, updatedProduct, null, 'Product updated successfully'));
    
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json(formatResponse(false, null, 'Failed to update product', error.message));
  }
});

// 8. DELETE PRODUCT
app.delete('/api/products/:id', async (req, res) => {
  try {
    if (!isDBConnected || !db) {
      return res.status(500).json(formatResponse(false, null, 'Database not connected'));
    }
    
    const productId = parseInt(req.params.id);
    
    const product = await db.collection('products').findOne({ id: productId });
    
    if (!product) {
      return res.status(404).json(formatResponse(false, null, 'Product not found'));
    }
    
    const result = await db.collection('products').deleteOne({ id: productId });
    
    res.json(formatResponse(true, null, null, 'Product deleted successfully'));
    
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json(formatResponse(false, null, 'Failed to delete product', error.message));
  }
});

// 9. GET STATISTICS
app.get('/api/stats', async (req, res) => {
  try {
    if (!isDBConnected || !db) {
      return res.status(500).json(formatResponse(false, null, 'Database not connected'));
    }
    
    const totalProducts = await db.collection('products').countDocuments();
    const categories = await db.collection('products').distinct('category');
    
    // Get products with variations
    const productsWithVariations = await db.collection('products')
      .find({ 'variations.0': { $exists: true } })
      .toArray();
    
    // Calculate total stock
    let totalStock = 0;
    for (const product of productsWithVariations) {
      if (product.variations && Array.isArray(product.variations)) {
        totalStock += product.variations.reduce((sum, v) => sum + (v.stock || 0), 0);
      }
    }
    
    const featuredProducts = await db.collection('products').countDocuments({ featured: true });
    
    const latestProducts = await db.collection('products')
      .find()
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();
    
    res.json(formatResponse(true, {
      totalProducts,
      categories: categories.length,
      productsWithVariations: productsWithVariations.length,
      featuredProducts,
      totalStock,
      latestProducts: latestProducts.map(p => ({ id: p.id, name: p.name, price: p.price })),
      categoriesList: categories.filter(cat => cat)
    }));
    
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json(formatResponse(false, null, 'Failed to fetch statistics', error.message));
  }
});

// 10. ADS (video/image) CRUD
app.get('/api/ads', async (req, res) => {
  try {
    if (!isDBConnected || !db) {
      return res.status(500).json(formatResponse(false, null, 'Database not connected'));
    }

    const ads = await db.collection('ads')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    // Return a stable string id for clients (and omit raw _id)
    res.json(formatResponse(true, ads.map(a => {
      const { _id, ...rest } = a;
      return { ...rest, id: _id.toString() };
    })));
  } catch (error) {
    console.error('Error fetching ads:', error);
    res.status(500).json(formatResponse(false, null, 'Failed to fetch ads', error.message));
  }
});

app.post('/api/ads', async (req, res) => {
  try {
    if (!isDBConnected || !db) {
      return res.status(500).json(formatResponse(false, null, 'Database not connected'));
    }

    const { type, url, title } = req.body;
    if (!type || !url) {
      return res.status(400).json(formatResponse(false, null, 'type and url are required'));
    }
    if (!['video', 'image'].includes(type)) {
      return res.status(400).json(formatResponse(false, null, 'type must be video or image'));
    }

    const doc = {
      type,
      url,
      title: title || (type === 'video' ? 'Video Ad' : 'Image Ad'),
      createdAt: new Date()
    };

    const result = await db.collection('ads').insertOne(doc);
    res.status(201).json(formatResponse(true, { ...doc, id: result.insertedId.toString() }));
  } catch (error) {
    console.error('Error adding ad:', error);
    res.status(500).json(formatResponse(false, null, 'Failed to add ad', error.message));
  }
});

app.delete('/api/ads/:id', async (req, res) => {
  try {
    if (!isDBConnected || !db) {
      return res.status(500).json(formatResponse(false, null, 'Database not connected'));
    }

    const { id } = req.params;
    let objectId;
    try {
      objectId = new ObjectId(id);
    } catch {
      return res.status(400).json(formatResponse(false, null, 'Invalid ad id'));
    }

    const result = await db.collection('ads').deleteOne({ _id: objectId });
    if (result.deletedCount === 0) {
      return res.status(404).json(formatResponse(false, null, 'Ad not found'));
    }

    res.json(formatResponse(true, null, null, 'Ad deleted'));
  } catch (error) {
    console.error('Error deleting ad:', error);
    res.status(500).json(formatResponse(false, null, 'Failed to delete ad', error.message));
  }
});

// ==================== STATIC FILE SERVING ====================
// Serve main HTML files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Serve admin panel with any additional path
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Root health check
app.get('/health', (req, res) => {
  res.json(formatResponse(true, {
    status: 'Server is running',
    timestamp: new Date().toISOString(),
    database: isDBConnected ? 'connected' : 'disconnected'
  }));
});

// ==================== ERROR HANDLING ====================
// 404 handler
app.use((req, res) => {
  res.status(404).json(formatResponse(false, null, 'Endpoint not found'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('🚨 Server error:', err.stack);
  res.status(500).json(formatResponse(false, null, 'Internal server error', err.message));
});

// ==================== START SERVER ====================
async function startServer() {
  try {
    // Connect to database
    await connectDB();
    
    const server = app.listen(PORT, () => {
      console.log(`\n🚀 ============================================= 🚀`);
      console.log(`   🛍️  WhatsApp E-Commerce Store Started!`);
      console.log(`   🔗 Port: ${PORT}`);
      console.log(`   🏪 Main Store: http://localhost:${PORT}`);
      console.log(`   🔧 Admin Panel: http://localhost:${PORT}/admin`);
      console.log(`   🔐 Admin Password: admin123`);
      console.log(`   ❤️  Health Check: http://localhost:${PORT}/health`);
      console.log(`   🗄️  Database: ${isDBConnected ? 'Connected ✅' : 'Not Connected ⚠️'}`);
      console.log(`🚀 ============================================= 🚀\n`);
      
      console.log('📡 Available API Endpoints:');
      console.log('   GET    /api/products           - Get all products');
      console.log('   GET    /api/products/:id       - Get single product');
      console.log('   POST   /api/products           - Add new product');
      console.log('   PUT    /api/products/:id       - Update product');
      console.log('   DELETE /api/products/:id       - Delete product');
      console.log('   GET    /api/categories         - Get all categories');
      console.log('   GET    /api/stats              - Get statistics');
      console.log('   GET    /health                 - Health check\n');
      
      if (!isDBConnected) {
        console.log('⚠️  Database connection failed!');
        console.log('   Please check your MongoDB connection string');
        console.log('   Some features will not work without database\n');
      }
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('🛑 SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    });
    
    process.on('SIGINT', () => {
      console.log('🛑 SIGINT received. Shutting down gracefully...');
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer().catch(console.error);