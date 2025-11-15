const express = require('express');
const cors = require('cors');
const regression = require('regression');
const fs = require('fs');
const csv = require('csv-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  credentials: false
}));
app.use(express.json());

let riceData = [];
let lastUpdate = new Date();

// Load data from CSV file - FIXED VERSION
function loadRiceData() {
  return new Promise((resolve, reject) => {
    const results = [];
    console.log('📁 Starting CSV load...');
    
    fs.createReadStream('rice_prices.csv')
      .pipe(csv())
      .on('data', (data) => {
        try {
          // DEBUG: Log the actual structure of each row
          if (results.length < 2) {
            console.log('🔍 RAW CSV ROW:', data);
            console.log('🔍 Available keys:', Object.keys(data));
          }
          
          // Handle price field - try different possible column names
          let priceValue;
          if (data.price !== undefined) {
            priceValue = data.price;
          } else if (data['price '] !== undefined) {
            priceValue = data['price ']; // with space
          } else {
            // Try to find any column that might contain price
            const possiblePriceKeys = Object.keys(data).filter(key => 
              key.toLowerCase().includes('price') || key.trim() === 'price'
            );
            if (possiblePriceKeys.length > 0) {
              priceValue = data[possiblePriceKeys[0]];
            } else {
              priceValue = '0';
            }
          }
          
          // Clean and parse the price
          const cleanPrice = parseFloat(priceValue.toString().trim().replace(',', ''));
          
          const record = {
            date: new Date(data.date),
            type: data.type,
            category: data.category,
            price: isNaN(cleanPrice) ? 0 : cleanPrice,
            unit: data.unit || 'PHP/kg'
          };
          
          // Log first few records to verify parsing
          if (results.length < 3) {
            console.log(`📝 PARSED RECORD: ${record.date.toISOString()} | ${record.type} | ${record.category} | ₱${record.price}`);
          }
          
          results.push(record);
        } catch (error) {
          console.error('❌ Error parsing row:', data, error);
        }
      })
      .on('end', () => {
        console.log(`✅ Loaded ${results.length} rice price records from CSV`);
        
        // Analyze the data
        const nonZeroPrices = results.filter(item => item.price > 0);
        const zeroPrices = results.filter(item => item.price === 0);
        
        console.log(`📊 Non-zero price records: ${nonZeroPrices.length}`);
        console.log(`📊 Zero price records: ${zeroPrices.length}`);
        
        // Log price statistics
        if (nonZeroPrices.length > 0) {
          const minPrice = Math.min(...nonZeroPrices.map(item => item.price));
          const maxPrice = Math.max(...nonZeroPrices.map(item => item.price));
          const avgPrice = nonZeroPrices.reduce((sum, item) => sum + item.price, 0) / nonZeroPrices.length;
          console.log(`💰 Price range: ₱${minPrice.toFixed(2)} - ₱${maxPrice.toFixed(2)} (avg: ₱${avgPrice.toFixed(2)})`);
        }
        
        // Log unique types and categories
        const types = [...new Set(results.map(item => item.type))];
        const categories = [...new Set(results.map(item => item.category))];
        console.log('📋 Available types:', types);
        console.log('📋 Available categories:', categories);
        
        // Log date range
        const dates = results.map(item => item.date).sort();
        console.log('📅 Date range:', dates[0]?.toISOString().split('T')[0], 'to', dates[dates.length-1]?.toISOString().split('T')[0]);
        
        lastUpdate = new Date();
        resolve(results);
      })
      .on('error', (error) => {
        console.error('❌ Error reading CSV:', error);
        reject(error);
      });
  });
}

// Initialize data
loadRiceData()
  .then(data => {
    riceData = data;
    console.log('📊 Rice data initialization complete');
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

// Get current prices - FIXED VERSION
function getCurrentPrices() {
  if (riceData.length === 0) {
    console.log('❌ No rice data available');
    return { current_prices: [], as_of_date: new Date() };
  }
  
  // Find the latest date in the data
  const dates = riceData.map(item => item.date).filter(date => !isNaN(date.getTime()));
  if (dates.length === 0) {
    console.log('❌ No valid dates found');
    return { current_prices: [], as_of_date: new Date() };
  }
  
  const latestDate = new Date(Math.max(...dates));
  console.log('📅 Latest date in data:', latestDate.toISOString().split('T')[0]);
  
  // Get all entries for the latest date with non-zero prices
  const currentData = riceData.filter(item => {
    const itemDate = new Date(item.date);
    const isLatestDate = itemDate.getTime() === latestDate.getTime();
    const hasPrice = item.price > 0;
    return isLatestDate && hasPrice;
  });
  
  console.log(`📊 Found ${currentData.length} current price entries`);
  
  // If no current data, try to find ANY data with prices
  if (currentData.length === 0) {
    console.log('⚠️ No current prices found. Looking for any data with prices...');
    const anyDataWithPrices = riceData.filter(item => item.price > 0).slice(0, 10);
    console.log('🔍 Sample data with prices:', anyDataWithPrices);
  } else {
    // Log what we found
    currentData.forEach(item => {
      console.log(`   - ${item.type} ${item.category}: ₱${item.price}`);
    });
  }
  
  return {
    current_prices: currentData,
    as_of_date: latestDate
  };
}

// Get historical data with filtering - FIXED VERSION
function getHistoricalData(filters = {}) {
  let filteredData = riceData.filter(item => item.price > 0);
  
  // Filter by type
  if (filters.type && filters.type !== 'all') {
    filteredData = filteredData.filter(item => item.type === filters.type);
  }
  
  // Filter by category
  if (filters.category && filters.category !== 'all') {
    filteredData = filteredData.filter(item => item.category === filters.category);
  }
  
  // Sort by date (newest first)
  filteredData.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // Limit results if specified
  if (filters.limit) {
    filteredData = filteredData.slice(0, parseInt(filters.limit));
  }
  
  console.log(`📊 Returning ${filteredData.length} historical records`);
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
      predicted_price: Math.max(0, predictedPrice),
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
  const currentPrices = getCurrentPrices();
  res.json({
    success: true,
    message: 'RiceUp Backend API is running',
    version: '1.0.0',
    data_status: {
      total_records: riceData.length,
      current_records: currentPrices.current_prices.length,
      last_update: lastUpdate
    }
  });
});

// Get available rice types
app.get('/api/prices/types', (req, res) => {
  try {
    const types = getAvailableTypes();
    console.log('📋 Sending available types:', Object.keys(types).length, 'types');
    
    res.json({
      success: true,
      data: types,
      total_types: Object.keys(types).length
    });
  } catch (error) {
    console.error('Error in /api/prices/types:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rice types'
    });
  }
});

// Get current prices
app.get('/api/prices/current', (req, res) => {
  try {
    const currentPrices = getCurrentPrices();
    console.log('💰 Sending current prices:', currentPrices.current_prices.length, 'records');
    
    res.json({
      success: true,
      data: currentPrices
    });
  } catch (error) {
    console.error('Error in /api/prices/current:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch current prices'
    });
  }
});

// Get historical prices
app.get('/api/prices/historical', (req, res) => {
  try {
    const { type, category, limit = 100 } = req.query;
    console.log('📊 History request:', { type, category, limit });
    
    const historicalData = getHistoricalData({ type, category, limit });
    
    console.log(`📊 Sending ${historicalData.length} historical records`);
    
    res.json({
      success: true,
      data: {
        historical_data: historicalData,
        total_records: historicalData.length,
        filters: { type, category, limit }
      }
    });
  } catch (error) {
    console.error('Error in /api/prices/historical:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch historical prices'
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const currentPrices = getCurrentPrices();
  
  res.json({
    success: true,
    data: {
      status: 'OK',
      last_update: lastUpdate,
      total_records: riceData.length,
      current_records: currentPrices.current_prices.length,
      available_types: Object.keys(getAvailableTypes()).length,
      uptime: process.uptime()
    }
  });
});

// Price prediction endpoint
app.post('/api/predict', (req, res) => {
  try {
    const { type, category, weeks_ahead = 1 } = req.body;
    
    console.log('🔮 Prediction request:', { type, category, weeks_ahead });
    
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
    console.error('Error in /api/predict:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Prediction failed'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 RiceUp Backend Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
});
