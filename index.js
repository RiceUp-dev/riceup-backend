const express = require('express');
const cors = require('cors');
const regression = require('regression');
const fs = require('fs');
const csv = require('csv-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Remove static file serving since frontend is separate
// app.use(express.static('public'));

let riceData = [];
let lastUpdate = new Date();

// Load data from CSV file
function loadRiceData() {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream('rice_prices.csv')
      .pipe(csv())
      .on('data', (data) => {
        // Process the CSV data
        results.push({
          date: new Date(data.date),
          type: data.type,
          category: data.category,
          price: parseFloat(data.price) || 0,
          unit: data.unit
        });
      })
      .on('end', () => {
        console.log(`✅ Loaded ${results.length} rice price records from CSV`);
        lastUpdate = new Date();
        resolve(results);
      })
      .on('error', (error) => {
        console.error('Error reading CSV:', error);
        reject(error);
      });
  });
}

// Initialize data
loadRiceData()
  .then(data => {
    riceData = data;
    console.log('📊 Rice data loaded successfully');
  })
  .catch(error => {
    console.error('❌ Failed to load data:', error);
    // Fallback to sample data if CSV fails
    riceData = getSampleData();
  });

// Fallback sample data
function getSampleData() {
  console.log('🔄 Using sample data as fallback');
  return [
    // ... your sample data here
  ];
}

// Get available rice types and categories
function getAvailableTypes() {
  const types = {};
  
  riceData.forEach(item => {
    if (!types[item.type]) {
      types[item.type] = new Set();
    }
    types[item.type].add(item.category);
  });
  
  const result = {};
  Object.keys(types).forEach(type => {
    result[type] = Array.from(types[type]);
  });
  
  return result;
}

// Enhanced prediction with better error handling
function predictPrice(riceType, category, weeksAhead = 1) {
  // ... your existing prediction code
}

// API Routes

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'RiceUp Backend API is running',
    version: '1.0.0',
    endpoints: {
      'GET /api/health': 'Health check',
      'GET /api/prices/types': 'Available rice types',
      'GET /api/prices/current': 'Current prices', 
      'GET /api/prices/historical': 'Historical prices',
      'GET /api/prices/stats': 'Price statistics',
      'POST /api/predict': 'Price prediction'
    },
    data_status: {
      total_records: riceData.length,
      last_update: lastUpdate
    }
  });
});

// Get available rice types
app.get('/api/prices/types', (req, res) => {
  // ... your existing code
});

// Get current prices (latest prices for each type/category)
app.get('/api/prices/current', (req, res) => {
  // ... your existing code
});

// Get historical prices with optional filtering
app.get('/api/prices/historical', (req, res) => {
  // ... your existing code
});

// Get price statistics
app.get('/api/prices/stats', (req, res) => {
  // ... your existing code
});

// Price prediction endpoint
app.post('/api/predict', (req, res) => {
  // ... your existing code
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'OK',
      last_update: lastUpdate,
      total_records: riceData.length,
      available_types: Object.keys(getAvailableTypes()).length,
      memory_usage: process.memoryUsage(),
      uptime: process.uptime()
    }
  });
});

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'RiceUp Backend API',
      version: '1.0.0',
      endpoints: {
        'GET /api/health': 'Health check',
        'GET /api/prices/types': 'Available rice types',
        'GET /api/prices/current': 'Current prices', 
        'GET /api/prices/historical': 'Historical prices',
        'GET /api/prices/stats': 'Price statistics',
        'POST /api/predict': 'Price prediction'
      },
      data_status: {
        total_records: riceData.length,
        available_types: Object.keys(getAvailableTypes()).length,
        last_update: lastUpdate
      }
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 RiceUp Backend Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📍 API Documentation: http://localhost:${PORT}/api`);
  console.log(`\n📊 Loaded ${riceData.length} rice price records`);
});
