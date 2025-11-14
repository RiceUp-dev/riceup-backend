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

// Serve static files (your HTML frontend)
app.use(express.static('public'));

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
    { date: new Date('2024-01-01'), type: 'LOCAL', category: 'Special', price: 61.05, unit: 'PHP/kg' },
    { date: new Date('2024-01-01'), type: 'LOCAL', category: 'Premium', price: 55.02, unit: 'PHP/kg' },
    { date: new Date('2024-01-01'), type: 'LOCAL', category: 'Well_Milled', price: 50.90, unit: 'PHP/kg' },
    { date: new Date('2024-01-01'), type: 'LOCAL', category: 'Regular_Milled', price: 51.83, unit: 'PHP/kg' },
    { date: new Date('2024-01-01'), type: 'IMPORTED', category: 'Special', price: 61.04, unit: 'PHP/kg' },
    { date: new Date('2024-01-01'), type: 'IMPORTED', category: 'Premium', price: 57.45, unit: 'PHP/kg' },
    { date: new Date('2024-01-01'), type: 'IMPORTED', category: 'Well_Milled', price: 53.67, unit: 'PHP/kg' },
    { date: new Date('2024-01-01'), type: 'IMPORTED', category: 'Regular_Milled', price: 50.40, unit: 'PHP/kg' },
    { date: new Date('2024-01-01'), type: 'KADIWA_RICE_FOR_ALL', category: 'Well_Milled', price: 40.00, unit: 'PHP/kg' },
    { date: new Date('2024-02-01'), type: 'LOCAL', category: 'Special', price: 61.19, unit: 'PHP/kg' },
    { date: new Date('2024-02-01'), type: 'LOCAL', category: 'Premium', price: 55.21, unit: 'PHP/kg' },
    { date: new Date('2024-02-01'), type: 'LOCAL', category: 'Well_Milled', price: 52.05, unit: 'PHP/kg' },
    { date: new Date('2024-02-01'), type: 'LOCAL', category: 'Regular_Milled', price: 50.96, unit: 'PHP/kg' },
    { date: new Date('2024-02-01'), type: 'IMPORTED', category: 'Special', price: 61.00, unit: 'PHP/kg' },
    { date: new Date('2024-02-01'), type: 'IMPORTED', category: 'Premium', price: 57.70, unit: 'PHP/kg' },
    { date: new Date('2024-02-01'), type: 'IMPORTED', category: 'Well_Milled', price: 54.26, unit: 'PHP/kg' },
    { date: new Date('2024-02-01'), type: 'IMPORTED', category: 'Regular_Milled', price: 50.00, unit: 'PHP/kg' },
    { date: new Date('2024-02-01'), type: 'KADIWA_RICE_FOR_ALL', category: 'Well_Milled', price: 38.00, unit: 'PHP/kg' }
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
  // Filter data for the specific rice type and category
  const filteredData = riceData.filter(item => 
    item.type === riceType && item.category === category && item.price > 0
  );
  
  if (filteredData.length < 2) {
    throw new Error(`Not enough data for prediction. Only ${filteredData.length} records found for ${riceType} - ${category}`);
  }
  
  // Sort by date
  filteredData.sort((a, b) => a.date - b.date);
  
  // Convert dates to numerical values (days since first date)
  const firstDate = filteredData[0].date;
  const dataPoints = filteredData.map((item, index) => {
    const daysDiff = (item.date - firstDate) / (1000 * 60 * 60 * 24);
    return [daysDiff, item.price];
  });
  
  // Perform linear regression
  const result = regression.linear(dataPoints);
  const [slope, intercept] = result.equation;
  
  // Calculate confidence level (R² value)
  const confidence = Math.max(0.1, Math.min(1, result.r2));
  
  // Predict future price
  const lastDate = filteredData[filteredData.length - 1].date;
  const predictionDate = new Date(lastDate);
  predictionDate.setDate(predictionDate.getDate() + (weeksAhead * 7));
  
  const predictionDays = (predictionDate - firstDate) / (1000 * 60 * 60 * 24);
  const predictedPrice = slope * predictionDays + intercept;
  
  // Ensure price doesn't go negative and apply reasonable bounds
  const currentPrice = filteredData[filteredData.length - 1].price;
  const maxChange = currentPrice * 0.5; // Max 50% change
  const boundedPrice = Math.max(0, currentPrice - maxChange, Math.min(currentPrice + maxChange, predictedPrice));
  
  return {
    predicted_price: parseFloat(boundedPrice.toFixed(2)),
    prediction_date: predictionDate.toISOString().split('T')[0],
    confidence: parseFloat(confidence.toFixed(3)),
    data_points: filteredData.length,
    trend: slope > 0.01 ? 'upward' : slope < -0.01 ? 'downward' : 'stable',
    slope: parseFloat(slope.toFixed(6)),
    current_price: currentPrice
  };
}

// API Routes

// Get available rice types
app.get('/api/prices/types', (req, res) => {
  try {
    const types = getAvailableTypes();
    res.json({
      success: true,
      data: types
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Get current prices (latest prices for each type/category)
app.get('/api/prices/current', (req, res) => {
  try {
    const latestPrices = {};
    
    // Find the latest date for each type/category combination
    riceData.forEach(item => {
      const key = `${item.type}-${item.category}`;
      if (!latestPrices[key] || item.date > latestPrices[key].date) {
        latestPrices[key] = {
          date: item.date,
          price: item.price,
          type: item.type,
          category: item.category,
          unit: item.unit
        };
      }
    });
    
    const currentPricesArray = Object.values(latestPrices);
    
    res.json({
      success: true,
      data: {
        current_prices: currentPricesArray,
        as_of_date: lastUpdate.toISOString(),
        total_records: riceData.length,
        available_combinations: Object.keys(latestPrices).length
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Get historical prices with optional filtering
app.get('/api/prices/historical', (req, res) => {
  try {
    const { type, category, limit = 100 } = req.query;
    
    let filteredData = [...riceData];
    
    if (type && type !== 'all') {
      filteredData = filteredData.filter(item => item.type === type);
    }
    
    if (category && category !== 'all') {
      filteredData = filteredData.filter(item => item.category === category);
    }
    
    // Sort by date (newest first)
    filteredData.sort((a, b) => b.date - a.date);
    
    // Limit records for performance
    const limitedData = filteredData.slice(0, parseInt(limit));
    
    res.json({
      success: true,
      data: {
        historical_data: limitedData,
        total_records: filteredData.length,
        returned_records: limitedData.length,
        filters: {
          type: type || 'all',
          category: category || 'all'
        }
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Get price statistics
app.get('/api/prices/stats', (req, res) => {
  try {
    const { type, category } = req.query;
    
    let filteredData = [...riceData];
    
    if (type && type !== 'all') {
      filteredData = filteredData.filter(item => item.type === type);
    }
    
    if (category && category !== 'all') {
      filteredData = filteredData.filter(item => item.category === category);
    }
    
    // Filter out zero prices
    const validData = filteredData.filter(item => item.price > 0);
    
    if (validData.length === 0) {
      return res.json({
        success: true,
        data: {
          average_price: 0,
          min_price: 0,
          max_price: 0,
          total_records: 0,
          date_range: { start: null, end: null }
        }
      });
    }
    
    const prices = validData.map(item => item.price);
    const average = prices.reduce((a, b) => a + b, 0) / prices.length;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    
    const dates = validData.map(item => item.date).sort((a, b) => a - b);
    const dateRange = {
      start: dates[0].toISOString().split('T')[0],
      end: dates[dates.length - 1].toISOString().split('T')[0]
    };
    
    // Find min and max price entries
    const minEntry = validData.find(item => item.price === min);
    const maxEntry = validData.find(item => item.price === max);
    
    res.json({
      success: true,
      data: {
        average_price: parseFloat(average.toFixed(2)),
        min_price: parseFloat(min.toFixed(2)),
        max_price: parseFloat(max.toFixed(2)),
        min_price_entry: minEntry,
        max_price_entry: maxEntry,
        total_records: validData.length,
        date_range: dateRange
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Price prediction endpoint
app.post('/api/predict', (req, res) => {
  try {
    const { type, category, weeks_ahead = 4 } = req.body;
    
    if (!type || !category) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: type and category'
      });
    }
    
    const weeksAhead = parseInt(weeks_ahead);
    if (isNaN(weeksAhead) || weeksAhead < 1 || weeksAhead > 52) {
      return res.status(400).json({
        success: false,
        error: 'Weeks ahead must be between 1 and 52'
      });
    }
    
    const prediction = predictPrice(type, category, weeksAhead);
    
    res.json({
      success: true,
      data: {
        ...prediction,
        type,
        category,
        weeks_ahead: weeksAhead
      }
    });
    
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
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

// Serve the main HTML page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
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
  console.log(`📍 Frontend: http://localhost:${PORT}/`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📍 API Documentation: http://localhost:${PORT}/api`);
  console.log(`\n📊 Loaded ${riceData.length} rice price records`);
});
