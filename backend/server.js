const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/sources', express.static(path.join(__dirname, '../sources')));

// Initialize MongoDB connection
const mongoUrl = process.env.MONGODB_URL || 'mongodb+srv://Dhairy27:<db_password>@cluster0.llosvz3.mongodb.net/?appName=Cluster0';
const client = new MongoClient(mongoUrl);
let db;

// Connect to MongoDB
async function connectToMongo() {
  try {
    await client.connect();
    db = client.db('clothing_store');
    console.log('Connected to MongoDB database.');
    await initializeDatabase();
  } catch (err) {
    console.error('Error connecting to MongoDB:', err.message);
    process.exit(1);
  }
}

// Create database collections and indexes
async function initializeDatabase() {
  try {
    // Check if collections exist, create if they don't
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    if (!collectionNames.includes('users')) {
      await db.createCollection('users');
    }
    if (!collectionNames.includes('products')) {
      await db.createCollection('products');
    }
    if (!collectionNames.includes('orders')) {
      await db.createCollection('orders');
    }
    if (!collectionNames.includes('order_items')) {
      await db.createCollection('order_items');
    }
    if (!collectionNames.includes('addresses')) {
      await db.createCollection('addresses');
    }
    if (!collectionNames.includes('cart')) {
      await db.createCollection('cart');
    }
    if (!collectionNames.includes('categories')) {
      await db.createCollection('categories');
    }
    
    // Initialize default categories
    await initializeCategories();
    
    // Create indexes
    // Users collection
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    
    // Products collection
    await db.collection('products').createIndex({ category: 1 });
    await db.collection('products').createIndex({ createdAt: -1 });
    
    // Orders collection - remove any problematic orderId indexes
    try {
      await db.collection('orders').dropIndex('orderId_1');
    } catch (error) {
      // Silently handle index drop - no notification needed
    }
    
    await db.collection('orders').createIndex({ userId: 1 });
    await db.collection('orders').createIndex({ createdAt: -1 });
    
    console.log('Database collections initialized successfully');
    
    // Cart collection
    await db.collection('cart').createIndex({ userId: 1, productName: 1 }, { unique: true });
    await db.collection('cart').createIndex({ username: 1 });
    
    // Addresses collection
    await db.collection('addresses').createIndex({ userId: 1 });
    await db.collection('addresses').createIndex({ isDefault: -1, createdAt: -1 });
    
    console.log('Database collections initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// Initialize database with default categories if they don't exist
async function initializeCategories() {
  const existingCategories = await db.collection('categories').countDocuments();
  if (existingCategories === 0) {
    const defaultCategories = [
      { name: 'T-Shirts', description: 'Comfortable t-shirts in various colors and styles', createdAt: new Date(), createdBy: 'system' },
      { name: 'Shirts', description: 'Formal and casual shirts for all occasions', createdAt: new Date(), createdBy: 'system' },
      { name: 'Jeans', description: 'Denim jeans in different fits and styles', createdAt: new Date(), createdBy: 'system' }
    ];
    await db.collection('categories').insertMany(defaultCategories);
    console.log('Default categories initialized');
  }
}

// Clean up existing address documents to remove firstName and lastName fields
async function cleanupAddressFields() {
  try {
    console.log('Cleaning up firstName and lastName fields from existing addresses...');
    
    // Remove firstName and lastName from all existing address documents
    const result = await db.collection('addresses').updateMany(
      {}, // Match all documents
      { 
        $unset: { firstName: "", lastName: "" } // Remove these fields
      }
    );
    
    console.log(`Cleaned up ${result.modifiedCount} address documents`);
    return result.modifiedCount;
  } catch (error) {
    console.error('Error cleaning up address fields:', error);
    return 0;
  }
}

// Clean up existing user documents to remove address field
async function cleanupUserAddressFields() {
  try {
    console.log('Cleaning up address field from existing users...');
    
    // Remove address from all existing user documents
    const result = await db.collection('users').updateMany(
      {}, // Match all documents
      { 
        $unset: { address: "" } // Remove address field
      }
    );
    
    console.log(`Cleaned up ${result.modifiedCount} user documents`);
    return result.modifiedCount;
  } catch (error) {
    console.error('Error cleaning up user address fields:', error);
    return 0;
  }
}

// Utility functions
function generateToken(user) {
  return jwt.sign({ id: user._id.toString(), email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Check if it's an admin token (mock token for admin)
  if (token.startsWith('admin-mock-token-')) {
    // For admin routes, we'll use a simple admin authentication
    req.user = { id: 'admin', email: 'admin@clothy.com', isAdmin: true };
    return next();
  }

  // For regular users, verify JWT token
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// Auth Routes
app.post('/api/register', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password, type } = req.body;

    // Check if user already exists
    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const newUser = {
      firstName,
      lastName,
      email,
      phone,
      password: hashedPassword,
      type: type || 'user', // Use provided type or default to 'user'
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('users').insertOne(newUser);
    
    // Get created user
    const user = await db.collection('users').findOne({ _id: result.insertedId });
    
    const token = generateToken(user);
    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        address: user.address,
        type: user.type || 'user'
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await db.collection('users').findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Compare password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);
    res.json({
      message: 'Login successful',
      token,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        address: user.address,
        type: user.type || 'user'
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Profile Routes
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.id) });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove password from response
    delete user.password;
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/profile', authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName, phone, address } = req.body;
    
    const updateData = {
      firstName,
      lastName,
      phone,
      address,
      updatedAt: new Date()
    };
    
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(req.user.id) },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error updating profile' });
  }
});

// Cart Routes
app.get('/api/cart', authenticateToken, async (req, res) => {
  try {
    const items = await db.collection('cart').find({ userId: new ObjectId(req.user.id) }).toArray();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/cart', authenticateToken, async (req, res) => {
  try {
    const { productName, price, quantity = 1 } = req.body;
    
    console.log('POST /api/cart - User ID:', req.user.id);
    console.log('POST /api/cart - Product:', productName, 'Price:', price);

    // Get user information to include username
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.id) });
    if (!user) {
      console.log('POST /api/cart - User not found');
      return res.status(404).json({ error: 'User not found' });
    }

    // Create username from firstName and lastName
    const username = ((user.firstName || '') + ' ' + (user.lastName || '')).trim() || user.email || 'Unknown';
    console.log('POST /api/cart - Username:', username);

    // Check if item already exists in cart
    const existingItem = await db.collection('cart').findOne({ 
      userId: new ObjectId(req.user.id), 
      productName 
    });

    if (existingItem) {
      // Update quantity
      await db.collection('cart').updateOne(
        { userId: new ObjectId(req.user.id), productName },
        { 
          $inc: { quantity: 1 },
          $set: { username: username, updatedAt: new Date() }
        }
      );
      console.log('POST /api/cart - Item updated');
      res.json({ message: 'Cart updated successfully' });
    } else {
      // Add new item
      const newItem = {
        userId: new ObjectId(req.user.id),
        username: username,
        productName,
        price,
        quantity,
        createdAt: new Date()
      };
      const result = await db.collection('cart').insertOne(newItem);
      console.log('POST /api/cart - Item inserted:', result.insertedId);
      res.json({ message: 'Item added to cart successfully', itemId: result.insertedId });
    }
  } catch (error) {
    console.error('POST /api/cart - Error:', error);
    res.status(500).json({ error: 'Error updating cart' });
  }
});

app.delete('/api/cart/:id', authenticateToken, async (req, res) => {
  try {
    const itemId = new ObjectId(req.params.id);
    
    const result = await db.collection('cart').deleteOne({ 
      _id: itemId, 
      userId: new ObjectId(req.user.id) 
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.json({ message: 'Item removed from cart successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error removing item' });
  }
});

app.delete('/api/cart', authenticateToken, async (req, res) => {
  try {
    await db.collection('cart').deleteMany({ userId: new ObjectId(req.user.id) });
    res.json({ message: 'Cart cleared successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error clearing cart' });
  }
});

// Products Routes
app.get('/api/products', async (req, res) => {
  try {
    const category = req.query.category;
    
    let query = {};
    if (category) {
      query.category = category;
    }
    
    const products = await db.collection('products')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { name, category, price, image, description, stock } = req.body;

    // Validate required fields
    if (!name || !category || !price) {
      return res.status(400).json({ error: 'Name, category, and price are required' });
    }

    const newProduct = {
      name,
      category,
      price: parseFloat(price),
      image: image || '',
      description: description || '',
      stock: parseInt(stock) || 0,
      createdAt: new Date(),
      createdBy: 'admin'
    };

    console.log('Creating product:', newProduct);
    
    const result = await db.collection('products').insertOne(newProduct);
    console.log('Product created with ID:', result.insertedId);
    
    res.status(201).json({
      message: 'Product created successfully',
      productId: result.insertedId
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Error creating product: ' + error.message });
  }
});

// Orders Routes
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const orders = await db.collection('orders')
      .find({ userId: new ObjectId(req.user.id) })
      .sort({ createdAt: -1 })
      .toArray();
    
    // Add order items to each order
    const ordersWithItems = await Promise.all(orders.map(async (order) => {
      const orderItems = await db.collection('order_items')
        .find({ orderId: order._id })
        .toArray();
      
      return {
        ...order,
        items: orderItems.map(item => ({
          _id: item._id,
          productName: item.productName,
          name: item.productName,
          price: item.price,
          quantity: item.quantity,
          total: item.price * item.quantity
        }))
      };
    }));
    
    res.json(ordersWithItems);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/orders', authenticateToken, async (req, res) => {
  try {
    console.log('Order request body:', req.body);
    const { items, totalAmount, shippingAddressId, paymentMethod, utrNumber } = req.body;

    // Simple validation - just check basic required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items are required' });
    }

    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({ error: 'Valid total amount is required' });
    }

    if (!paymentMethod) {
      return res.status(400).json({ error: 'Payment method is required' });
    }

    // Validate UTR for UPI payments
    if (paymentMethod === 'upi') {
      if (!utrNumber) {
        return res.status(400).json({ error: 'UTR number is required for UPI payments' });
      }
      if (typeof utrNumber !== 'string' || utrNumber.length !== 12 || !/^\d+$/.test(utrNumber)) {
        return res.status(400).json({ error: 'UTR number must be exactly 12 digits' });
      }
    }

    // Get address details - no ownership check
    let shippingAddress = null;
    if (shippingAddressId) {
      shippingAddress = await db.collection('addresses').findOne({ 
        _id: new ObjectId(shippingAddressId)
      });
    }

    // Create simple order object - no past order checks
    const newOrder = {
      userId: new ObjectId(req.user.id),
      totalAmount,
      status: 'pending',
      shippingAddress: shippingAddress ? {
        name: shippingAddress.name || '',
        email: shippingAddress.email || '',
        phone: shippingAddress.phone || '',
        house: shippingAddress.house || '',
        street: shippingAddress.address || shippingAddress.street || '',
        city: shippingAddress.city || '',
        state: shippingAddress.state || '',
        zipCode: shippingAddress.zipCode || '',
        country: shippingAddress.country || 'IN'
      } : null,
      paymentMethod,
      utrNumber: paymentMethod === 'upi' ? utrNumber : null, // Store UTR only for UPI payments
      createdAt: new Date()
    };

    console.log('Creating order:', JSON.stringify(newOrder, null, 2));

    const orderResult = await db.collection('orders').insertOne(newOrder);
    const orderId = orderResult.insertedId;
    console.log('Order created with ID:', orderId);

    // Create order items - simple mapping
    const orderItems = items.map(item =>({
      orderId: new ObjectId(orderId),
      productName: item.name,
      price: item.price,
      quantity: item.quantity
    }));
    
    // Add COD charge as separate item if payment method is COD
    if (paymentMethod === 'cod') {
      orderItems.push({
        orderId: new ObjectId(orderId),
        productName: 'Cash on Delivery Charge',
        price: 10,
        quantity: 1
      });
      console.log('Added COD charge as separate order item');
    }
    
    await db.collection('order_items').insertMany(orderItems);
    console.log('Order items created');

    // Clear cart - no user checks
    await db.collection('cart').deleteMany({ userId: new ObjectId(req.user.id) });
    
    res.status(201).json({
      message: 'Order created successfully',
      orderId
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Error creating order: ' + error.message });
  }
});

// ...
// Address Management Routes
app.get('/api/user/addresses', authenticateToken, async (req, res) => {
  try {
    const addresses = await db.collection('addresses')
      .find({ userId: new ObjectId(req.user.id) })
      .sort({ isDefault: -1, createdAt: -1 })
      .toArray();
    
    res.json(addresses);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/user/addresses', authenticateToken, async (req, res) => {
  try {
    console.log('Raw request body:', req.body); // Debug raw request body
    
    const { type, name, email, house, street, city, state, zipCode, country, phone, isDefault } = req.body;
    
    console.log('Received address data:', { type, name, email, house, street, city, state, zipCode, country, phone, isDefault }); // Debug log
    console.log('Email field debugging:', {
      email: email,
      emailType: typeof email,
      emailLength: email ? email.length : 0,
      emailIsEmpty: !email || email === '',
      emailIsUndefined: email === undefined,
      emailIsNull: email === null
    }); // Specific email debugging
    
    // Specific debugging for name field
    console.log('Name field debugging:', {
      name: name,
      nameType: typeof name,
      nameLength: name ? name.length : 0,
      nameIsEmpty: !name || name === ''
    });
    
    // Log to check if email exists in the data to be saved
    console.log('Email in newAddress object will be:', email);

    // If setting as default, unset other default addresses
    if (isDefault) {
      await db.collection('addresses').updateMany(
        { userId: new ObjectId(req.user.id) },
        { $set: { isDefault: false } }
      );
    }

    const newAddress = {
      userId: new ObjectId(req.user.id),
      type,
      name,
      email,
      house,
      street,
      city,
      state,
      zipCode,
      country,
      phone,
      isDefault: isDefault || false,
      createdAt: new Date()
    };

    console.log('New address to be saved:', newAddress); // Debug log
    
    // Specifically check if name and email are in the object being saved
    console.log('Name and email fields in newAddress object:', {
      name: newAddress.name,
      email: newAddress.email
    });

    const result = await db.collection('addresses').insertOne(newAddress);
    
    res.status(201).json({
      message: 'Address added successfully',
      addressId: result.insertedId
    });
  } catch (error) {
    console.error('Error adding address:', error); // Debug log
    res.status(500).json({ error: 'Error adding address' });
  }
});

app.put('/api/user/addresses/:id', authenticateToken, async (req, res) => {
  try {
    const addressId = new ObjectId(req.params.id);
    const { type, name, email, house, street, city, state, zipCode, country, phone, isDefault } = req.body;

    // If setting as default, unset other default addresses
    if (isDefault) {
      await db.collection('addresses').updateMany(
        { userId: new ObjectId(req.user.id), _id: { $ne: addressId } },
        { $set: { isDefault: false } }
      );
    }

    const updateData = {
      type,
      name,
      email,
      house,
      street,
      city,
      state,
      zipCode,
      country,
      phone,
      isDefault: isDefault || false,
      updatedAt: new Date()
    };

    const result = await db.collection('addresses').updateOne(
      { _id: addressId, userId: new ObjectId(req.user.id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Address not found' });
    }

    res.json({ message: 'Address updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error updating address' });
  }
});

app.delete('/api/user/addresses/:id', authenticateToken, async (req, res) => {
  try {
    const addressId = new ObjectId(req.params.id);

    const result = await db.collection('addresses').deleteOne({
      _id: addressId,
      userId: new ObjectId(req.user.id)
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Address not found' });
    }

    res.json({ message: 'Address deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting address' });
  }
});

// Admin Routes
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await db.collection('users').find({}).toArray();
    // Remove passwords from response
    const usersWithoutPasswords = users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
    res.json(usersWithoutPasswords);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/admin/orders', async (req, res) => {
  try {
    const orders = await db.collection('orders').find({}).sort({ createdAt: -1 }).toArray();
    
    // Add customer names to orders
    const ordersWithCustomers = await Promise.all(orders.map(async (order) => {
      if (order.userId) {
        const user = await db.collection('users').findOne({ _id: order.userId });
        return {
          ...order,
          customerName: user ? `${user.firstName} ${user.lastName}` : 'Unknown'
        };
      }
      return {
        ...order,
        customerName: 'Guest'
      };
    }));
    
    res.json(ordersWithCustomers);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/admin/orders/:id', async (req, res) => {
  try {
    const orderId = new ObjectId(req.params.id);
    
    console.log('Deleting order with ID:', orderId);
    
    // Delete order items first
    await db.collection('order_items').deleteMany({ orderId: orderId });
    
    // Delete the order
    const result = await db.collection('orders').deleteOne({ _id: orderId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    console.log('Order deleted successfully');
    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ error: 'Error deleting order: ' + error.message });
  }
});

app.put('/api/admin/orders/:id', async (req, res) => {
  try {
    const orderId = new ObjectId(req.params.id);
    const { status, paymentStatus } = req.body;
    
    console.log('Updating order with ID:', orderId);
    console.log('Update data:', { status, paymentStatus });
    
    // Check if order exists
    const order = await db.collection('orders').findOne({ _id: orderId });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Build update object
    const updateData = {};
    if (status) updateData.status = status;
    if (paymentStatus) updateData.paymentStatus = paymentStatus;
    
    // Add updated timestamp
    updateData.updatedAt = new Date();
    
    const result = await db.collection('orders').updateOne(
      { _id: orderId },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    console.log('Order updated successfully');
    res.json({ message: 'Order updated successfully' });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Error updating order' });
  }
});

app.delete('/api/admin/products/:id', async (req, res) => {
  try {
    const productId = new ObjectId(req.params.id);
    
    console.log('Deleting product with ID:', productId);
    
    const result = await db.collection('products').deleteOne({ _id: productId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    console.log('Product deleted successfully');
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Error deleting product: ' + error.message });
  }
});

app.put('/api/admin/products/:id', async (req, res) => {
  try {
    const productId = new ObjectId(req.params.id);
    const { name, category, price, image, description, stock } = req.body;
    
    // Validate required fields
    if (!name || !category || !price) {
      return res.status(400).json({ error: 'Name, category, and price are required' });
    }
    
    const updateData = {
      name,
      category,
      price: parseFloat(price),
      image: image || '',
      description: description || '',
      stock: parseInt(stock) || 0,
      updatedAt: new Date()
    };
    
    console.log('Updating product with ID:', productId);
    console.log('Update data:', updateData);
    
    const result = await db.collection('products').updateOne(
      { _id: productId },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    console.log('Product updated successfully');
    res.json({ message: 'Product updated successfully' });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Error updating product: ' + error.message });
  }
});

// Get categories from separate categories collection
app.get('/api/categories', async (req, res) => {
  try {
    // Get all categories from categories collection
    const categories = await db.collection('categories')
      .find({})
      .sort({ name: 1 })
      .toArray();
    
    console.log('Categories found:', categories);
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Add new category to separate categories collection
app.post('/api/admin/categories', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    // Check if category already exists in categories collection
    const existingCategory = await db.collection('categories').findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });
    
    if (existingCategory) {
      return res.status(400).json({ error: 'Category already exists' });
    }
    
    // Create new category in categories collection
    const newCategory = {
      name,
      description: description || '',
      createdAt: new Date(),
      createdBy: 'admin'
    };
    
    console.log('Creating category:', newCategory);
    
    const result = await db.collection('categories').insertOne(newCategory);
    
    // Get all categories after adding new one
    const allCategories = await db.collection('categories')
      .find({})
      .sort({ name: 1 })
      .toArray();
    
    console.log('Updated categories:', allCategories);
    
    res.status(201).json({
      message: 'Category added successfully',
      category: { _id: result.insertedId, ...newCategory },
      categories: allCategories
    });
  } catch (error) {
    console.error('Error adding category:', error);
    res.status(500).json({ error: 'Error adding category: ' + error.message });
  }
});

// Admin User Management Routes
app.post('/api/admin/users', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password, address, type } = req.body;
    
    // Check if user already exists
    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert user with type
    const newUser = {
      firstName,
      lastName,
      email,
      phone,
      password: hashedPassword,
      address,
      type: type || 'user', // Use provided type or default to 'user'
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection('users').insertOne(newUser);
    
    // Get created user
    const user = await db.collection('users').findOne({ _id: result.insertedId });
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    
    res.status(201).json({
      message: 'User created successfully',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Error creating user', details: error.message });
  }
});

app.put('/api/admin/users/:id', async (req, res) => {
  try {
    const userId = new ObjectId(req.params.id);
    const { firstName, lastName, email, phone, password, address, type } = req.body;
    
    // Check if user exists
    const user = await db.collection('users').findOne({ _id: userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Build update object
    const updateData = {
      firstName,
      lastName,
      email,
      phone,
      address,
      type: type || 'user',
      updatedAt: new Date()
    };
    
    // Only update password if provided
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }
    
    const result = await db.collection('users').updateOne(
      { _id: userId },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Error updating user', details: error.message });
  }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const userId = new ObjectId(req.params.id);
    
    // Check if user exists
    const user = await db.collection('users').findOne({ _id: userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('Deleting user and all related data for userId:', userId);
    
    // Delete user's cart items
    const cartResult = await db.collection('cart').deleteMany({ userId: userId });
    console.log('Deleted cart items:', cartResult.deletedCount);
    
    // Delete user's addresses
    const addressResult = await db.collection('addresses').deleteMany({ userId: userId });
    console.log('Deleted addresses:', addressResult.deletedCount);
    
    // Delete user's orders
    const userOrders = await db.collection('orders').find({ userId: userId }).toArray();
    const orderIds = userOrders.map(order => order._id);
    
    // Delete order items for user's orders
    let orderItemsDeleted = 0;
    if (orderIds.length > 0) {
      const itemsResult = await db.collection('order_items').deleteMany({ 
        orderId: { $in: orderIds } 
      });
      orderItemsDeleted = itemsResult.deletedCount;
      console.log('Deleted order items:', orderItemsDeleted);
    }
    
    // Delete orders
    const ordersResult = await db.collection('orders').deleteMany({ userId: userId });
    console.log('Deleted orders:', ordersResult.deletedCount);
    
    // Delete user
    const result = await db.collection('users').deleteOne({ _id: userId });
    console.log('Deleted user:', result.deletedCount > 0 ? 'User deleted successfully' : 'User not found');
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      message: 'User deleted successfully',
      deletedItems: {
        cartItems: cartResult.deletedCount,
        addresses: addressResult.deletedCount,
        orders: ordersResult.deletedCount,
        orderItems: orderItemsDeleted
      }
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Error deleting user', details: error.message });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start server
connectToMongo().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Database: MongoDB (clothing_store)`);
    console.log(`Frontend: http://localhost:${PORT}`);
  });
});
