let cart = JSON.parse(localStorage.getItem("cart")) || [];

// Sync cart with database when user is authenticated
async function syncCartWithDatabase() {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (!token) {
    // User is not logged in, clear cart and show empty cart
    cart = [];
    localStorage.setItem("cart", JSON.stringify(cart));
    updateCartCount();
    if (typeof displayCart === 'function') {
      displayCart();
    }
    console.log('User not logged in - cart cleared');
    return;
  }
  
  try {
    const response = await fetch('/api/cart', {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
    
    if (response.ok) {
      const dbCart = await response.json();
      // Update local cart with database cart
      cart = dbCart.map(item => ({
        id: item._id,
        name: item.productName,
        price: item.price,
        quantity: item.quantity,
        username: item.username // Include username from database
      }));
      localStorage.setItem("cart", JSON.stringify(cart));
      updateCartCount();
      if (typeof displayCart === 'function') {
        displayCart();
      }
      
      // Show notification that cart is synced for logged-in user
      const userData = localStorage.getItem('userData') || sessionStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        console.log(`Cart synced for user: ${user.firstName || user.email}`);
        console.log(`Cart items saved with username: ${cart[0]?.username || 'N/A'}`);
      }
    }
  } catch (error) {
    console.error('Error syncing cart with database:', error);
  }
}

// Fetch products from MongoDB API
async function fetchProducts() {
  try {
    const response = await fetch('/api/products');
    if (!response.ok) {
      throw new Error('Failed to fetch products');
    }
    const products = await response.json();
    displayProducts(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    document.getElementById('product-container').innerHTML = 
      '<div class="error">Failed to load products. Please try again later.</div>';
  }
}

// Display products grouped by category
function displayProducts(products) {
  const container = document.getElementById('product-container');
  
  if (!products || products.length === 0) {
    container.innerHTML = '<div class="no-products">No products available.</div>';
    return;
  }
  
  // Group products by category
  const productsByCategory = products.reduce((acc, product) => {
    if (!acc[product.category]) {
      acc[product.category] = [];
    }
    acc[product.category].push(product);
    return acc;
  }, {});
  
  let html = '';
  
  // Display each category
  Object.keys(productsByCategory).forEach(category => {
    html += `<h3 class="category">${category}</h3>`;
    html += '<div class="product-grid">';
    
    productsByCategory[category].forEach(product => {
      html += `
        <div class="card">
          <img src="${product.image}" alt="${product.name}" onerror="this.src='https://via.placeholder.com/200x200?text=No+Image'">
          <h4>${product.name}</h4>
          <p>₹${product.price}</p>
          <button onclick="addToCart('${product.name}', ${product.price})">Add</button>
        </div>
      `;
    });
    
    html += '</div>';
  });
  
  container.innerHTML = html;
}

async function addToCart(name, price){
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  
  console.log('Add to cart - Token exists:', !!token);
  console.log('Add to cart - Product:', name, 'Price:', price);
  
  // If user is authenticated, save to database
  if (token) {
    try {
      const userData = localStorage.getItem('userData') || sessionStorage.getItem('userData');
      console.log('Add to cart - User data:', userData);
      const user = userData ? JSON.parse(userData) : null;
      const fullName = user ? ((user.firstName || '') + ' ' + (user.lastName || '')).trim() || user.email : 'User';
      
      console.log('Add to cart - Full name:', fullName);
      
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ productName: name, price: price, quantity: 1 })
      });
      
      console.log('Add to cart - Response status:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('Add to cart - Response:', result);
        showNotification(`${name} added to cart for ${fullName}`);
        await syncCartWithDatabase();
        return;
      } else {
        const error = await response.json();
        console.error('Add to cart - Error:', error);
      }
    } catch (error) {
      console.error('Error adding to database cart:', error);
    }
  }
  
  // Fallback to localStorage if not authenticated or API fails
  console.log('Add to cart - Using localStorage fallback');
  cart.push({name, price, id: Date.now()});
  localStorage.setItem("cart", JSON.stringify(cart));
  showNotification(name + " added to cart");
  updateCartCount();
}

async function removeFromCart(id){
  console.log('Remove from cart - Item ID:', id);
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  console.log('Remove from cart - Token exists:', !!token);
  
  // If user is authenticated, remove from database
  if (token && !id.toString().startsWith('temp-')) {
    try {
      console.log('Remove from cart - Attempting database removal');
      const response = await fetch(`/api/cart/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer ' + token
        }
      });
      
      console.log('Remove from cart - Response status:', response.status);
      
      if (response.ok) {
        showNotification("Item removed from cart");
        await syncCartWithDatabase();
        return;
      } else {
        const error = await response.json();
        console.error('Remove from cart - Error:', error);
      }
    } catch (error) {
      console.error('Error removing from database cart:', error);
    }
  }
  
  // Fallback to localStorage if not authenticated or API fails
  console.log('Remove from cart - Using localStorage fallback');
  
  // Handle both database IDs and temp IDs
  let updatedCart;
  if (id.toString().startsWith('temp-')) {
    // Remove by index for temp items
    const index = parseInt(id.toString().replace('temp-', ''));
    updatedCart = cart.filter((item, i) => i !== index);
  } else {
    // Remove by ID for database items
    updatedCart = cart.filter(item => item.id !== id);
  }
  
  cart = updatedCart;
  localStorage.setItem("cart", JSON.stringify(cart));
  displayCart();
  updateCartCount();
  showNotification("Item removed from cart");
}

async function clearCart(){
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  
  // If user is authenticated, clear from database
  if (token) {
    try {
      const response = await fetch('/api/cart', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer ' + token
        }
      });
      
      if (response.ok) {
        showNotification("Cart cleared");
        await syncCartWithDatabase();
        return;
      }
    } catch (error) {
      console.error('Error clearing database cart:', error);
    }
  }
  
  // Fallback to localStorage if not authenticated or API fails
  cart = [];
  localStorage.setItem("cart", JSON.stringify(cart));
  displayCart();
  updateCartCount();
  showNotification("Cart cleared");
}

function getTotalPrice(){
  return cart.reduce((total, item) => {
    const quantity = item.quantity || 1;
    return total + (item.price * quantity);
  }, 0);
}

function displayCart(){
  const cartElement = document.getElementById('cart');
  const totalElement = document.getElementById('total');
  
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  
  if(cart.length === 0){
    if (token) {
      // Logged in user with empty cart
      cartElement.innerHTML = '<div class="empty-cart"><p>Your cart is empty</p><a href="collection.html" class="btn">Continue Shopping</a></div>';
    } else {
      // Guest user or logged out
      cartElement.innerHTML = '<div class="empty-cart"><p>Your cart is empty</p><p><a href="login.html" class="btn">Login to see your saved cart</a></p><a href="collection.html" class="btn">Continue Shopping</a></div>';
    }
    if(totalElement) totalElement.textContent = '₹0';
    return;
  }
  
  console.log('Display cart - Items:', cart);
  
  let cartHTML = '<div class="cart-items">';
  cart.forEach((item, index) => {
    const quantity = item.quantity || 1;
    const itemTotal = item.price * quantity;
    console.log('Display cart - Item:', item, 'ID:', item.id, 'Index:', index);
    
    // Use index as fallback if id is missing or invalid
    const removeId = item.id || `temp-${index}`;
    
    cartHTML += `
      <div class="cart-item">
        <div class="item-info">
          <h4>${item.name}</h4>
          <p>₹${item.price} x ${quantity}</p>
          <p><strong>₹${itemTotal}</strong></p>
        </div>
        <button onclick="removeFromCart('${removeId}')" class="remove-btn">Remove</button>
      </div>
    `;
  });
  cartHTML += '</div>';
  
  // Add clear cart button after cart items
  cartHTML += `
    <div class="cart-actions">
      <button class="clear-cart-btn" onclick="clearCart()">
        Clear Cart
      </button>
    </div>
  `;
  
  cartElement.innerHTML = cartHTML;
  
  if(totalElement){
    totalElement.textContent = '₹' + getTotalPrice();
  }
}

function updateCartCount(){
  const countElement = document.getElementById('cart-count');
  if(countElement){
    // Count total quantity of items, not just number of unique items
    const totalQuantity = cart.reduce((total, item) => {
      return total + (item.quantity || 1);
    }, 0);
    countElement.textContent = totalQuantity;
  }
}

function showNotification(message){
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('show');
  }, 100);
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

// Authentication helper functions
function getAuthToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

function getCurrentUser() {
  const userStr = localStorage.getItem('userData') || sessionStorage.getItem('userData');
  return userStr ? JSON.parse(userStr) : null;
}

function isAuthenticated() {
  return !!getAuthToken() && !!getCurrentUser();
}

function logout() {
  // Clear cart when logging out
  cart = [];
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartCount();
  if (typeof displayCart === 'function') {
    displayCart();
  }
  
  localStorage.removeItem('token');
  localStorage.removeItem('userData');
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('userData');
  sessionStorage.removeItem('authToken');
  sessionStorage.removeItem('user');
  sessionStorage.removeItem('adminLoggedIn');
  sessionStorage.removeItem('adminUser');
  sessionStorage.removeItem('adminToken');
  showNotification('Logged out successfully!');
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 1500);
}

function updateProfileUI() {
  const loginLink = document.getElementById('login-link');
  const profileDropdown = document.getElementById('user-profile-dropdown');
  const user = getCurrentUser();
  
  if (loginLink && profileDropdown) {
    if (isAuthenticated() && user) {
      // User is logged in - hide login link, show profile dropdown
      loginLink.style.display = 'none';
      profileDropdown.style.display = 'block';
      
      // Update profile information
      updateUserProfile(user);
    } else {
      // User is not logged in - show login link, hide profile dropdown
      loginLink.style.display = 'block';
      loginLink.textContent = 'Login';
      loginLink.href = 'login.html';
      loginLink.onclick = null;
      profileDropdown.style.display = 'none';
    }
  }
}

// Initialize cart display when cart page loads
if(window.location.pathname.includes('cart.html')){
  document.addEventListener('DOMContentLoaded', displayCart);
}

// Initialize cart count on all pages
document.addEventListener('DOMContentLoaded', function() {
  updateCartCount();
  updateProfileUI();
  
  // Sync cart with database if user is authenticated
  syncCartWithDatabase();
  
  // Load quick order products if on home page
  if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
    loadQuickOrderProducts();
  }
  
  // Setup global browser close detection
  setupGlobalBrowserCloseDetection();
});

// Global browser close detection for automatic logout
function setupGlobalBrowserCloseDetection() {
  // Set a flag when page is loaded
  sessionStorage.setItem('globalBrowserSessionActive', 'true');
  
  // Clear all authentication data when browser is closing
  window.addEventListener('beforeunload', function(e) {
    // Only clear if this is actually browser close, not page navigation
    setTimeout(() => {
      // This won't execute if browser is closing
      sessionStorage.setItem('globalBrowserSessionActive', 'false');
    }, 100);
    
    // Check if we have any active session storage indicating browser is still open
    const isActive = sessionStorage.getItem('globalBrowserSessionActive');
    if (isActive === 'true') {
      // Browser is closing, clear all authentication data
      localStorage.removeItem('token');
      localStorage.removeItem('userData');
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      // Note: sessionStorage is automatically cleared when browser closes
    }
  });
  
  // Handle page visibility changes
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
      // Page is visible again, update session state
      sessionStorage.setItem('globalBrowserSessionActive', 'true');
    }
  });
}

// Quick Order functionality
async function loadQuickOrderProducts() {
  try {
    const response = await fetch('/api/products');
    if (!response.ok) {
      throw new Error('Failed to fetch products');
    }
    
    const allProducts = await response.json();
    
    // Filter products with stock less than 10
    const lowStockProducts = allProducts.filter(product => product.stock < 10);
    
    displayQuickOrderProducts(lowStockProducts);
  } catch (error) {
    console.error('Error loading quick order products:', error);
    document.getElementById('quick-order-container').innerHTML = 
      '<div class="error">Failed to load products. Please try again later.</div>';
  }
}

function displayQuickOrderProducts(products) {
  const container = document.getElementById('quick-order-container');
  
  if (!products || products.length === 0) {
    container.innerHTML = `
      <div class="no-low-stock">
        <h3>🎉 All Products Well Stocked!</h3>
        <p>All our products have sufficient stock. Check back later for quick order deals!</p>
        <a href="collection.html" class="btn">Browse Collection</a>
      </div>
    `;
    return;
  }
  
  let html = '<div class="quick-order-grid">';
  
  products.forEach(product => {
    const stockStatus = product.stock <= 5 ? 'critical' : 'low';
    const stockBadge = product.stock <= 3 ? '🔥 Only ' + product.stock + ' left!' : 
                       product.stock <= 5 ? '⚠️ Low Stock: ' + product.stock : 
                       '📦 Stock: ' + product.stock;
    
    html += `
      <div class="quick-order-card">
        <div class="quick-order-image">
          <img src="${product.image ? product.image.replace(/\\/g, '/') : 'https://via.placeholder.com/200x200?text=No+Image'}" 
               alt="${product.name}" 
               onerror="this.src='https://via.placeholder.com/200x200?text=No+Image'">
          <div class="stock-badge ${stockStatus}">${stockBadge}</div>
        </div>
        <div class="quick-order-info">
          <h3>${product.name}</h3>
          <p class="quick-order-category">${product.category}</p>
          <div class="quick-order-price">
            <span class="current-price">₹${product.price}</span>
            ${product.stock <= 3 ? '<span class="urgent-badge">URGENT</span>' : ''}
          </div>
          <button class="quick-order-btn" onclick="addToCart('${product.name}', ${product.price})" 
                  ${product.stock <= 0 ? 'disabled' : ''}>
            ${product.stock > 0 ? '⚡ Quick Order' : 'Out of Stock'}
          </button>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

// User Profile Management
document.addEventListener('DOMContentLoaded', function() {
  checkUserLoginStatus();
  updateCartCount();
});

function checkUserLoginStatus() {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const userData = localStorage.getItem('userData') || sessionStorage.getItem('userData');
  
  // Check admin login status
  const adminToken = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
  const adminLoggedIn = localStorage.getItem('adminLoggedIn') || sessionStorage.getItem('adminLoggedIn');
  
  // Get admin button element
  const adminBtn = document.querySelector('.admin-btn');
  
  if (token && userData) {
    // User is logged in, show profile dropdown
    const loginLink = document.getElementById('login-link');
    const profileDropdown = document.getElementById('user-profile-dropdown');
    
    if (loginLink) loginLink.style.display = 'none';
    if (profileDropdown) profileDropdown.style.display = 'block';
    
    // Parse user data and update profile
    const user = JSON.parse(userData);
    updateUserProfile(user);
    
    // Show admin button only if user type is admin
    if (adminBtn) {
      if (user.type === 'admin') {
        adminBtn.style.display = 'inline-block';
      } else {
        adminBtn.style.display = 'none';
      }
    }
  } else {
    // User is not logged in, show login button
    const loginLink = document.getElementById('login-link');
    const profileDropdown = document.getElementById('user-profile-dropdown');
    
    if (loginLink) loginLink.style.display = 'block';
    if (profileDropdown) profileDropdown.style.display = 'none';
    
    // Hide admin button when regular user is not logged in
    if (adminBtn) {
      adminBtn.style.display = 'none';
    }
  }
  
  // Additional check: If admin is logged in separately, show admin button
  if (adminToken && adminLoggedIn && adminBtn) {
    adminBtn.style.display = 'inline-block';
  }
}

function updateUserProfile(user) {
  document.getElementById('user-profile-username').textContent = user.firstName || 'User';
  document.getElementById('user-profile-name').textContent = `${user.firstName || 'User'} ${user.lastName || ''}`;
  document.getElementById('user-profile-email').textContent = user.email || 'user@example.com';
  
  // Sync cart with database when user profile is updated
  syncCartWithDatabase();
}

function toggleUserProfileDropdown() {
  const dropdown = document.getElementById('user-profile-dropdown');
  dropdown.classList.toggle('active');
  
  // Close dropdown when clicking outside
  document.addEventListener('click', function closeDropdown(e) {
    if (!dropdown.contains(e.target)) {
      dropdown.classList.remove('active');
      document.removeEventListener('click', closeDropdown);
    }
  });
}

function showUserProfileDetails() {
  // Redirect to profile page
  window.location.href = 'profile.html';
}

function userLogout() {
  // Check if we're on the cart page
  const isCartPage = window.location.pathname.includes('cart.html');
  
  // Clear authentication data
  localStorage.removeItem('token');
  localStorage.removeItem('userData');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('userData');
  
  // Show login button, hide profile
  const loginLink = document.getElementById('login-link');
  const profileDropdown = document.getElementById('user-profile-dropdown');
  
  if (loginLink) {
    loginLink.style.display = 'block';
    loginLink.href = 'login.html';
  }
  if (profileDropdown) profileDropdown.style.display = 'none';
  
  // Clear cart on all pages
  cart = [];
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartCount();
  
  if (isCartPage) {
    // On cart page: update UI to show logged out state but don't redirect
    updateCartUserInfo(); // Update cart user info to show guest state
    displayCart(); // Refresh cart display to show empty cart
    // No notification and no redirect on cart page
  } else {
    // On other pages: show notification and redirect
    if (typeof displayCart === 'function') {
      displayCart();
    }
    showNotification('Logged out successfully!');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1500);
  }
}
