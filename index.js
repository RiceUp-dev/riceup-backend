const express = require('express');
const cors = require('cors');
const regression = require('regression');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: false
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files (if needed)
app.use(express.static('public'));

let riceData = [];
let lastUpdate = new Date();

// Load data from CSV file - ROBUST VERSION
function loadRiceData() {
  return new Promise((resolve, reject) => {
    const results = [];
    console.log('📁 Starting CSV load...');
    
    // Try different possible file locations
    const csvPaths = [
      path.join(__dirname, 'rice_prices.csv'),
      path.join(__dirname, 'data', 'rice_prices.csv'),
      'rice_prices.csv'
    ];
    
    let csvFile = null;
    for (const csvPath of csvPaths) {
      if (fs.existsSync(csvPath)) {
        csvFile = csvPath;
        console.log(`✅ Found CSV file at: ${csvPath}`);
        break;
      }
    }
    
    if (!csvFile) {
      console.error('❌ CSV file not found in any location');
      reject(new Error('CSV file not found'));
      return;
    }
    
    fs.createReadStream(csvFile)
      .pipe(csv())
      .on('data', (data) => {
        try {
          // Skip empty rows and merge conflicts
          if (!data || Object.keys(data).length === 0) return;
          if (data['<<<<<<< HEAD'] || data['======='] || data['>>>>>>>']) {
            console.log('🚫 Skipping merge conflict row');
            return;
          }
          
          // Extract data from CSV columns
          let date, type, category, price;
          
          // Try different possible column names
          const dateKeys = Object.keys(data).filter(key => 
            key.toLowerCase().includes('date') || key.toLowerCase().includes('petsa')
          );
          const typeKeys = Object.keys(data).filter(key => 
            key.toLowerCase().includes('type') || key.toLowerCase().includes('uri')
          );
          const categoryKeys = Object.keys(data).filter(key => 
            key.toLowerCase().includes('category') || key.toLowerCase().includes('kategorya')
          );
          const priceKeys = Object.keys(data).filter(key => 
            key.toLowerCase().includes('price') || key.toLowerCase().includes('presyo')
          );
          
          date = dateKeys.length > 0 ? data[dateKeys[0]] : data[Object.keys(data)[0]];
          type = typeKeys.length > 0 ? data[typeKeys[0]] : data[Object.keys(data)[1]];
          category = categoryKeys.length > 0 ? data[categoryKeys[0]] : data[Object.keys(data)[2]];
          price = priceKeys.length > 0 ? data[priceKeys[0]] : data[Object.keys(data)[3]];
          
          // Parse and validate data
          let parsedDate;
          try {
            parsedDate = new Date(date);
            if (isNaN(parsedDate.getTime())) {
              // Try parsing as MM/DD/YYYY or other formats
              const parts = date.split('/');
              if (parts.length === 3) {
                parsedDate = new Date(parts[2], parts[0] - 1, parts[1]);
              }
            }
          } catch (e) {
            console.log('⚠️ Invalid date, using current date:', date);
            parsedDate = new Date();
          }
          
          const cleanPrice = parseFloat(price?.toString().replace(/[^\d.-]/g, '') || '0');
          
          if (type && category && !isNaN(cleanPrice) && cleanPrice > 0) {
            const record = {
              date: parsedDate,
              type: type.trim(),
              category: category.trim(),
              price: cleanPrice,
              unit: 'PHP/kg'
            };
            
            results.push(record);
          }
        } catch (error) {
          console.error('❌ Error parsing row:', error);
        }
      })
      .on('end', () => {
        console.log(`✅ Loaded ${results.length} valid records from CSV`);
        
        // Sort by date (newest first)
        results.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        lastUpdate = new Date();
        resolve(results);
      })
      .on('error', (error) => {
        console.error('❌ CSV read error:', error);
        reject(error);
      });
  });
}

// Get current prices (latest date)
function getCurrentPrices() {
  if (riceData.length === 0) {
    return { current_prices: [], as_of_date: new Date() };
  }
  
  const latestDate = new Date(Math.max(...riceData.map(item => item.date.getTime())));
  const currentData = riceData.filter(item => item.date.getTime() === latestDate.getTime());
  
  console.log(`📊 Current prices: ${currentData.length} records for ${latestDate.toDateString()}`);
  
  return {
    current_prices: currentData,
    as_of_date: latestDate
  };
}

// Get historical data with pagination
function getHistoricalData(filters = {}) {
  let filteredData = [...riceData]; // Start with all data
  
  // Apply filters
  if (filters.type && filters.type !== 'all') {
    filteredData = filteredData.filter(item => item.type === filters.type);
  }
  
  if (filters.category && filters.category !== 'all') {
    filteredData = filteredData.filter(item => item.category === filters.category);
  }
  
  // Sort by date (newest first)
  filteredData.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  const totalRecords = filteredData.length;
  
  // Pagination logic
  if (filters.page && filters.page_size) {
    const page = parseInt(filters.page);
    const pageSize = parseInt(filters.page_size);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    
    const paginatedData = filteredData.slice(startIndex, endIndex);
    
    return {
      data: paginatedData,
      pagination: {
        current_page: page,
        page_size: pageSize,
        total_records: totalRecords,
        total_pages: Math.ceil(totalRecords / pageSize),
        has_next: endIndex < totalRecords,
        has_prev: page > 1
      }
    };
  }
  
  // Limit if no pagination specified
  if (filters.limit) {
    filteredData = filteredData.slice(0, parseInt(filters.limit));
  }
  
  return {
    data: filteredData,
    pagination: {
      total_records: totalRecords
    }
  };
}

// Get data statistics
function getDataStats() {
  const validData = riceData.filter(item => item.price > 0);
  const dates = [...new Set(validData.map(item => item.date.toISOString().split('T')[0]))].sort();
  
  const types = {};
  riceData.forEach(item => {
    if (!types[item.type]) types[item.type] = new Set();
    types[item.type].add(item.category);
  });
  
  return {
    total_records: riceData.length,
    valid_records: validData.length,
    date_range: {
      start: dates[0] || 'N/A',
      end: dates[dates.length - 1] || 'N/A',
      total_days: dates.length
    },
    rice_types: Object.keys(types),
    categories: Object.values(types).map(set => Array.from(set)).flat(),
    last_update: lastUpdate
  };
}

// API Routes

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'RiceUp Backend API - Price Monitoring System',
    version: '1.0.0',
    data: getDataStats(),
    endpoints: {
      health: '/api/health',
      types: '/api/prices/types',
      current: '/api/prices/current',
      historical: '/api/prices/historical',
      stats: '/api/prices/stats',
      predict: '/api/predict (POST)'
    }
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const stats = getDataStats();
  res.json({
    success: true,
    data: {
      status: 'OK',
      server_time: new Date().toISOString(),
      ...stats,
      uptime: process.uptime()
    }
  });
});

// Get available rice types and categories
app.get('/api/prices/types', (req, res) => {
  try {
    const types = {};
    riceData.forEach(item => {
      if (!types[item.type]) types[item.type] = new Set();
      types[item.type].add(item.category);
    });
    
    const result = {};
    Object.keys(types).forEach(type => {
      result[type] = Array.from(types[type]);
    });
    
    res.json({ 
      success: true, 
      data: result 
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get current prices
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
      error: error.message
    });
  }
});

// Get historical data with pagination
app.get('/api/prices/historical', (req, res) => {
  try {
    const { type, category, limit, page, page_size = '20' } = req.query;
    
    const result = getHistoricalData({ 
      type, 
      category, 
      limit,
      page: page || '1',
      page_size 
    });
    
    res.json({
      success: true,
      data: {
        historical_data: result.data,
        pagination: result.pagination
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get data statistics
app.get('/api/prices/stats', (req, res) => {
  try {
    res.json({
      success: true,
      data: getDataStats()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PRICE PREDICTION ENDPOINT
app.post('/api/predict', (req, res) => {
  try {
    const { type, category, weeks_ahead = 1 } = req.body;
    
    if (!type || !category) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: type and category'
      });
    }
    
    const filteredData = riceData.filter(item => 
      item.type === type && 
      item.category === category && 
      item.price > 0
    );
    
    if (filteredData.length < 2) {
      return res.status(400).json({
        success: false,
        error: `Not enough historical data for ${type} - ${category}. Only ${filteredData.length} data points found.`
      });
    }
    
    // Sort by date and prepare data for regression
    filteredData.sort((a, b) => a.date - b.date);
    const regressionData = filteredData.map((item, index) => [index, item.price]);
    
    // Perform linear regression
    const result = regression.linear(regressionData);
    const predictedPrice = result.predict(filteredData.length + parseInt(weeks_ahead) - 1)[1];
    
    // Ensure positive price
    const finalPredictedPrice = Math.max(0, predictedPrice);
    
    res.json({
      success: true,
      data: {
        predicted_price: parseFloat(finalPredictedPrice.toFixed(2)),
        confidence: parseFloat(result.r2.toFixed(4)),
        data_points: filteredData.length,
        type: type,
        category: category,
        weeks_ahead: parseInt(weeks_ahead)
      }
    });
  } catch (error) {
    console.error('Prediction error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// SOLUTION 4: OPTIMIZED HISTORICAL DATA ENDPOINT WITH YEAR FILTERING
app.get('/api/prices/historical/optimized', (req, res) => {
  try {
    const { type, category, year, limit = '1000' } = req.query;
    
    let filteredData = [...riceData];
    
    // Apply filters more efficiently
    if (type && type !== 'all') {
      filteredData = filteredData.filter(item => item.type === type);
    }
    
    if (category && category !== 'all') {
      filteredData = filteredData.filter(item => item.category === category);
    }
    
    if (year) {
      const targetYear = parseInt(year);
      filteredData = filteredData.filter(item => 
        new Date(item.date).getFullYear() === targetYear
      );
    }
    
    // Sort by date (newest first)
    filteredData.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Apply limit
    const limitedData = filteredData.slice(0, parseInt(limit));
    
    res.json({
      success: true,
      data: {
        historical_data: limitedData,
        total_records: filteredData.length,
        displayed_records: limitedData.length,
        date_range: {
          start: limitedData[limitedData.length - 1]?.date || 'N/A',
          end: limitedData[0]?.date || 'N/A'
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

// Debug endpoint to check CSV data
app.get('/api/debug/csv-sample', (req, res) => {
  try {
    const csvPath = path.join(__dirname, 'rice_prices.csv');
    
    if (!fs.existsSync(csvPath)) {
      return res.json({ 
        success: false, 
        error: 'CSV file not found',
        available_files: fs.readdirSync(__dirname)
      });
    }
    
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n').slice(0, 10);
    
    res.json({
      success: true,
      sample_data: lines,
      total_lines: content.split('\n').length,
      file_size: content.length,
      file_path: csvPath
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Initialize data and start server
async function startServer() {
  try {
    console.log('🚀 Starting RiceUp Backend Server...');
    console.log('📁 Current directory:', __dirname);
    console.log('📁 Files in directory:', fs.readdirSync(__dirname));
    
    // Load data
    riceData = await loadRiceData();
    console.log('✅ Data loaded successfully');
    console.log('📊 Data Statistics:', getDataStats());
    
    // Start server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🎯 Server running on port ${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
      console.log(`📊 API ready: http://localhost:${PORT}/`);
      console.log(`📈 Optimized endpoint: http://localhost:${PORT}/api/prices/historical/optimized`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start the server
startServer();
