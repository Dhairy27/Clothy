# Clothy Store - MongoDB Integration

## 🚀 MongoDB-Powered Clothing Store

This version integrates your clothing store with MongoDB for robust data management.

## 📋 Prerequisites

1. **MongoDB** - Install and run MongoDB locally
2. **Node.js** - Version 14 or higher
3. **npm** - Node Package Manager

## 🛠️ Setup Instructions

### 1. Install MongoDB
```bash
# Windows
# Download and install from https://www.mongodb.com/try/download/community

# macOS
brew install mongodb-community

# Ubuntu/Debian
sudo apt-get install mongodb
```

### 2. Start MongoDB
```bash
# Windows
net start MongoDB

# macOS/Linux
sudo systemctl start mongod
# or
mongod
```

### 3. Setup Backend
```bash
cd d:\Guni\CP\clothing-store\backend

# Install dependencies
npm install --save mongoose express cors dotenv

# Copy MongoDB package configuration
copy package-mongodb.json package.json

# Initialize database with products
node init-mongodb.js

# Start server
node server-mongodb.js
```

### 4. Run Frontend
```bash
cd d:\Guni\CP\clothing-store\frontend

# Open MongoDB-powered version
# Option 1: Double-click index-mongodb.html
# Option 2: Use live server extension
```

## 🗄️ Database Schema

### Products Collection
```javascript
{
  name: String (required),
  category: String (required),
  price: Number (required),
  image: String (required),
  description: String (default: 'Premium quality clothing item'),
  stock: Number (default: 10),
  createdAt: Date,
  updatedAt: Date
}
```

## 🌐 API Endpoints

### Products
- `GET /api/products` - Get all products
- `GET /api/products/category/:category` - Get products by category
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Add new product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Database Management
- `POST /api/products/initialize` - Initialize database with sample data

## 📁 File Structure

```
clothing-store/
├── backend/
│   ├── server-mongodb.js      # MongoDB server
│   ├── init-mongodb.js       # Database initializer
│   └── package-mongodb.json   # Dependencies
├── frontend/
│   ├── index-mongodb.html     # MongoDB-powered frontend
│   ├── script-mongodb.js     # Frontend JavaScript
│   └── style.css           # Styling
└── sources/               # Product images
```

## 🎯 Features

### MongoDB Benefits
- **Scalable**: Handle thousands of products
- **Flexible**: Easy to add new fields
- **Fast**: Optimized queries
- **Reliable**: ACID transactions
- **Search**: Advanced filtering capabilities

### Admin Panel Integration
- Add/Edit/Delete products via admin panel
- Real-time database updates
- Stock management
- Category organization

### Frontend Features
- Dynamic product loading from database
- Category-based filtering
- Shopping cart with localStorage
- Responsive design
- Loading states

## 🔧 Configuration

### Environment Variables
Create `.env` file in backend directory:
```
MONGODB_URI=mongodb://localhost:27017/clothing_store
PORT=3000
```

### Database Connection
Default connection: `mongodb://localhost:27017/clothing_store`

## 🚨 Troubleshooting

### MongoDB Connection Issues
1. Ensure MongoDB is running
2. Check connection string
3. Verify firewall settings
4. Check MongoDB service status

### Server Issues
1. Verify Node.js installation
2. Install dependencies: `npm install`
3. Check port availability
4. Review error logs

### Frontend Issues
1. Check browser console for errors
2. Verify API endpoint URLs
3. Ensure CORS is enabled
4. Check network connectivity

## 📊 Sample Data

The database is initialized with:
- **10 T-Shirts** (₹499-699)
- **10 Shirts** (₹919-1099)
- **Stock levels** for each item
- **Image paths** for all products

## 🔄 Migration from Static

To migrate existing static products:
1. Run `node init-mongodb.js` to populate database
2. Use `index-mongodb.html` instead of `index.html`
3. Update admin panel to use MongoDB endpoints

## 🎉 Benefits

- **Dynamic Content**: Products stored in database
- **Easy Updates**: Add/remove products without code changes
- **Scalability**: Handle large inventories
- **Search & Filter**: Advanced product discovery
- **Admin Integration**: Full CRUD operations
- **Performance**: Optimized database queries
