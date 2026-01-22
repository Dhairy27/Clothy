# Clothing Store Backend

A complete Node.js backend with SQLite database for the clothing store e-commerce application.

## Features

- **User Authentication**: Registration, login with JWT tokens
- **User Profiles**: Complete profile management
- **Product Management**: CRUD operations for products
- **Shopping Cart**: Persistent cart for logged-in users
- **Order Management**: Complete order processing system
- **Database**: SQLite with proper relationships
- **Security**: Password hashing with bcrypt
- **API**: RESTful API with proper error handling

## Database Schema

### Users Table
- `id` (Primary Key)
- `firstName`, `lastName`, `email`, `phone`, `address`
- `password` (hashed)
- `newsletter` (boolean)
- `createdAt`, `updatedAt`

### Products Table
- `id` (Primary Key)
- `name`, `category`, `price`, `image`, `description`
- `stock` (quantity)
- `createdAt`

### Orders Table
- `id` (Primary Key)
- `userId` (Foreign Key)
- `totalAmount`, `status`, `shippingAddress`, `paymentMethod`
- `createdAt`

### Order Items Table
- `id` (Primary Key)
- `orderId` (Foreign Key)
- `productName`, `price`, `quantity`

### Cart Table
- `id` (Primary Key)
- `userId` (Foreign Key)
- `productName`, `price`, `quantity`
- `createdAt`
- Unique constraint on (userId, productName)

## API Endpoints

### Authentication
- `POST /api/register` - Register new user
- `POST /api/login` - User login

### Profile
- `GET /api/profile` - Get user profile (requires auth)
- `PUT /api/profile` - Update user profile (requires auth)

### Cart
- `GET /api/cart` - Get user cart (requires auth)
- `POST /api/cart` - Add item to cart (requires auth)
- `DELETE /api/cart/:id` - Remove cart item (requires auth)
- `DELETE /api/cart` - Clear cart (requires auth)

### Products
- `GET /api/products` - Get all products (optional ?category filter)
- `POST /api/products` - Create product (requires auth)

### Orders
- `GET /api/orders` - Get user orders (requires auth)
- `POST /api/orders` - Create new order (requires auth)

## Setup Instructions

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Initialize Database
```bash
npm run init-db
```

### 3. Start Server
```bash
# Development (with auto-restart)
npm run dev

# Production
npm start
```

### 4. Environment Variables (Optional)
Create a `.env` file:
```
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-here
```

## Usage

The server will start on `http://localhost:3000` by default.

- Frontend is served from `/` route
- API endpoints are available at `/api/*`
- Database file: `clothing_store.db`

## Security Features

- **Password Hashing**: All passwords are hashed using bcrypt
- **JWT Authentication**: Secure token-based authentication
- **Input Validation**: Basic validation on all inputs
- **CORS**: Cross-origin resource sharing enabled
- **SQL Injection Protection**: Parameterized queries

## Sample Data

The database is automatically populated with:
- 10 T-Shirts with different colors and prices
- 10 Shirts including check patterns
- 10 Jeans with various fits and prices

## Error Handling

All API endpoints return consistent error responses:
```json
{
  "error": "Error description"
}
```

Success responses include appropriate data and messages.

## Development

The server includes:
- Hot reload with nodemon (development mode)
- Detailed console logging
- Proper error handling
- Database connection management

## Frontend Integration

The frontend should:
- Store JWT token in localStorage
- Include token in Authorization header: `Bearer <token>`
- Handle authentication states properly
- Sync with backend API endpoints
