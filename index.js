const express = require('express');
const cors = require('cors');
const regression = require('regression');
const fs = require('fs');
const csv = require('csv-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - Fix CORS to allow all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  credentials: false
}));
app.use(express.json());

let riceData = [];
let lastUpdate = new Date();

// Load data from CSV file
function loadRiceData() {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream('rice_prices.csv')
      .pipe(csv())
      .on('data', (data) => {
        // Clean up the price field (remove spaces)
        const cleanPrice = data.price?.trim() || data['price ']?.trim() || '0';
        results.push({
          date: new Date(data.date),
          type: data.type,
          category: data.category,
          price: parseFloat(cleanPrice) || 0,
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
  });

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

// Get current prices (latest date for each type/category)
function getCurrentPrices() {
  const latestDate = new Date(Math.max(...riceData.map(item => item.date.getTime())));
  const currentData = riceData.filter(item => item.date.getTime() === latestDate.getTime());
  
  return {
    current_prices: currentData,
    as_of_date: latestDate
  };
}

// Get historical data with filtering
function getHistoricalData(filters = {}) {
  let filteredData = [...riceData];
  
  // Filter by type
  if (filters.type && filters.type !== 'all') {
    filteredData = filteredData.filter(item => item.type === filters.type);
  }
  
  // Filter by category
  if (filters.category && filters.category !== 'all') {
    filteredData = filteredData.filter(item => item.category === filters.category);
  }
  
  // Limit results if specified
  if (filters.limit) {
    filteredData = filteredData.slice(0, parseInt(filters.limit));
  }
  
  return filteredData;
}

// Enhanced prediction with better error handling
function predictPrice(riceType, category, weeksAhead = 1) {
  try {
    // Filter data for the specific rice type and category
    const filteredData = riceData.filter(item => 
      item.type === riceType && item.category === category && item.price > 0
    );
    
    if (filteredData.length < 2) {
      throw new Error('Not enough historical data for prediction');
    }
    
    // Sort by date
    filteredData.sort((a, b) => a.date - b.date);
    
    // Prepare data for regression (use time index instead of dates)
    const regressionData = filteredData.map((item, index) => [index, item.price]);
    
    // Perform linear regression
    const result = regression.linear(regressionData);
    
    // Predict future price
    const futureIndex = filteredData.length + weeksAhead - 1;
    const predictedPrice = result.predict(futureIndex)[1];
    
    return {
      predicted_price: Math.max(0, predictedPrice), // Ensure non-negative price
      confidence: result.r2,
      data_points: filteredData.length,
      equation: result.equation
    };
  } catch (error) {
    console.error('Prediction error:', error);
    throw error;
  }
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
  try {
    const types = getAvailableTypes();
    res.json({
      success: true,
      data: types,
      total_types: Object.keys(types).length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rice types'
    });
  }
});

// Get current prices (latest prices for each type/category)
app.get('/api/prices/current', (req, res) => {
  try {
    const currentPrices = getCurrentPrices();
    res.json({
      success: true,
      data: currentPrices
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch current prices'
    });
  }
});

// Get historical prices with optional filtering
app.get('/api/prices/historical', (req, res) => {
  try {
    const { type, category, limit } = req.query;
    const historicalData = getHistoricalData({ type, category, limit });
    
    res.json({
      success: true,
      data: {
        historical_data: historicalData,
        total_records: historicalData.length,
        filters: { type, category, limit }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch historical prices'
    });
  }
});

// Get price statistics
app.get('/api/prices/stats', (req, res) => {
  try {
    const currentPrices = getCurrentPrices();
    const averagePrice = currentPrices.current_prices.reduce((sum, item) => sum + item.price, 0) / currentPrices.current_prices.length;
    
    res.json({
      success: true,
      data: {
        average_price: averagePrice,
        total_products: currentPrices.current_prices.length,
        last_updated: currentPrices.as_of_date
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch price statistics'
    });
  }
});

// Price prediction endpoint
app.post('/api/predict', (req, res) => {
  try {
    const { type, category, weeks_ahead = 1 } = req.body;
    
    if (!type || !category) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: type and category'
      });
    }
    
    const prediction = predictPrice(type, category, parseInt(weeks_ahead));
    
    res.json({
      success: true,
      data: {
        predicted_price: prediction.predicted_price,
        confidence: prediction.confidence,
        data_points: prediction.data_points,
        type: type,
        category: category,
        weeks_ahead: weeks_ahead
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Prediction failed'
    });
  }
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
