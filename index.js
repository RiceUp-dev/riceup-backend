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

// Load data from CSV file - FIXED FOR YYYY/MM/DD FORMAT
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
    
    let rowCount = 0;
    fs.createReadStream(csvFile)
      .pipe(csv())
      .on('data', (data) => {
        try {
          rowCount++;
          // Skip empty rows and merge conflicts
          if (!data || Object.keys(data).length === 0) return;
          if (data['<<<<<<< HEAD'] || data['======='] || data['>>>>>>>']) {
            console.log('🚫 Skipping merge conflict row');
            return;
          }
          
          // Extract data from CSV columns
          let date, type, category, price;
          
          // Get all column names for debugging
          const columns = Object.keys(data);
          if (rowCount === 1) {
            console.log('📋 CSV Columns:', columns);
          }
          
          // More flexible column detection
          date = data['Date'] || data['date'] || data['DATE'] || data['Petsa'] || data['petsa'] || columns[0];
          type = data['Type'] || data['type'] || data['TYPE'] || data['Uri'] || data['uri'] || columns[1];
          category = data['Category'] || data['category'] || data['CATEGORY'] || data['Kategorya'] || data['kategorya'] || columns[2];
          price = data['Price'] || data['price'] || data['PRICE'] || data['Presyo'] || data['presyo'] || columns[3];
          
          // Parse and validate data - FIXED FOR YYYY/MM/DD FORMAT
          let parsedDate;
          try {
            // Your dates are in YYYY/MM/DD format
            const parts = date.split('/');
            if (parts.length === 3) {
              const year = parseInt(parts[0]);
              const month = parseInt(parts[1]) - 1; // Months are 0-indexed in JavaScript
              const day = parseInt(parts[2]);
              
              parsedDate = new Date(year, month, day);
              
              // Log first few dates for verification
              if (rowCount <= 5) {
                console.log(`📅 Parsed date: "${date}" -> ${parsedDate.toISOString().split('T')[0]}`);
              }
            } else {
              // Fallback for other formats
              parsedDate = new Date(date);
            }
            
            // Validate the date
            if (isNaN(parsedDate.getTime())) {
              console.log(`⚠️ Invalid date: "${date}", using logical date`);
              // Use a logical date based on row count
              const startDate = new Date('2023-01-01');
              startDate.setDate(startDate.getDate() + Math.floor(rowCount / 10));
              parsedDate = startDate;
            }
            
          } catch (e) {
            console.log('⚠️ Date parsing error:', date, e.message);
            // Fallback: use logical date progression
            const startDate = new Date('2023-01-01');
            startDate.setDate(startDate.getDate() + Math.floor(rowCount / 10));
            parsedDate = startDate;
          }
          
          const cleanPrice = parseFloat(price?.toString().replace(/[^\d.-]/g, '') || '0');
          
          if (type && category && !isNaN(cleanPrice) && cleanPrice > 0) {
            const record = {
              date: parsedDate,
              type: type.trim(),
              category: category.trim(),
              price: cleanPrice,
              unit: 'PHP/kg',
              original_date: date // Keep original for debugging
            };
            
            results.push(record);
          }
        } catch (error) {
          console.error('❌ Error parsing row:', error);
        }
      })
      .on('end', () => {
        console.log(`✅ Loaded ${results.length} valid records from ${rowCount} total rows`);
        
        // Sort by date (newest first)
        results.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Log date range
        if (results.length > 0) {
          const oldest = new Date(results[results.length - 1].date);
          const newest = new Date(results[0].date);
          console.log(`📅 Date range: ${oldest.toISOString().split('T')[0]} to ${newest.toISOString().split('T')[0]}`);
          
          // Log year distribution
          const yearCounts = {};
          results.forEach(item => {
            const year = new Date(item.date).getFullYear();
            yearCounts[year] = (yearCounts[year] || 0) + 1;
          });
          console.log('📊 Year distribution:', yearCounts);
        }
        
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
  console.log(`📊 Getting historical data. Total records: ${riceData.length}`);
  
  let filteredData = [...riceData]; // Start with ALL data
  
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
  
  // Calculate year distribution
  const years = {};
  riceData.forEach(item => {
    const year = new Date(item.date).getFullYear();
    years[year] = (years[year] || 0) + 1;
  });
  
  return {
    total_records: riceData.length,
    valid_records: validData.length,
    date_range: {
      start: dates[0] || 'N/A',
      end: dates[dates.length - 1] || 'N/A',
      total_days: dates.length
    },
    years_distribution: years,
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
      predict: '/api/predict (POST)',
      debug: '/api/debug/all-data'
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

// DEBUG ENDPOINT - Check all data
app.get('/api/debug/all-data', (req, res) => {
  try {
    // Group data by year to see what you actually have
    const dataByYear = {};
    riceData.forEach(item => {
      const year = new Date(item.date).getFullYear();
      if (!dataByYear[year]) {
        dataByYear[year] = [];
      }
      dataByYear[year].push(item);
    });
    
    // Count records per year
    const yearCounts = {};
    Object.keys(dataByYear).forEach(year => {
      yearCounts[year] = dataByYear[year].length;
    });
    
    res.json({
      success: true,
      data: {
        total_records: riceData.length,
        records_by_year: yearCounts,
        sample_records: riceData.slice(0, 10),
        available_years: Object.keys(dataByYear).sort((a, b) => b - a),
        date_range: {
          start: riceData[riceData.length - 1]?.date,
          end: riceData[0]?.date
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
    
    const stats = getDataStats();
    console.log('📊 Data Statistics:', stats);
    
    // Start server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🎯 Server running on port ${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
      console.log(`📊 API ready: http://localhost:${PORT}/`);
      console.log(`🐛 Debug endpoint: http://localhost:${PORT}/api/debug/all-data`);
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
