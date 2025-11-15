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

// Load data from CSV file - ULTRA ROBUST VERSION
function loadRiceData() {
  return new Promise((resolve, reject) => {
    const results = [];
    console.log('📁 Starting CSV load...');
    
    fs.createReadStream('rice_prices.csv')
      .pipe(csv())
      .on('data', (data) => {
        try {
          // Skip rows that look like merge conflicts
          if (data['<<<<<<< HEAD'] || data['======='] || data['>>>>>>>']) {
            console.log('🚫 Skipping merge conflict row:', data);
            return;
          }
          
          // Handle ALL possible price column names
          let priceValue;
          const priceKeys = Object.keys(data).filter(key => 
            key.toLowerCase().includes('price') || 
            key.trim().toLowerCase() === 'price'
          );
          
          if (priceKeys.length > 0) {
            priceValue = data[priceKeys[0]];
            console.log(`🔍 Found price column: "${priceKeys[0]}" = ${priceValue}`);
          } else {
            // Try to get price from any numeric column
            const numericKeys = Object.keys(data).filter(key => {
              const val = data[key];
              return !isNaN(parseFloat(val)) && isFinite(val) && val !== '';
            });
            if (numericKeys.length > 0) {
              priceValue = data[numericKeys[0]];
              console.log(`🔍 Using numeric column as price: "${numericKeys[0]}" = ${priceValue}`);
            } else {
              priceValue = '0';
            }
          }
          
          // Parse price
          const cleanPrice = parseFloat(priceValue.toString().trim());
          
          const record = {
            date: new Date(data.date),
            type: data.type,
            category: data.category,
            price: isNaN(cleanPrice) ? 0 : cleanPrice,
            unit: data.unit || 'PHP/kg'
          };
          
          // Only log first few to avoid spam
          if (results.length < 2) {
            console.log(`✅ PARSED: ${record.date.toDateString()} | ${record.type} | ${record.category} | ₱${record.price}`);
          }
          
          results.push(record);
        } catch (error) {
          console.error('❌ Error parsing row:', data, error);
        }
      })
      .on('end', () => {
        console.log(`✅ Loaded ${results.length} records total`);
        
        const validRecords = results.filter(item => item.price > 0);
        console.log(`💰 Valid price records: ${validRecords.length}`);
        
        if (validRecords.length === 0 && results.length > 0) {
          console.log('❌ ALL PRICES ARE ZERO - checking first few rows:');
          results.slice(0, 5).forEach(item => {
            console.log(`   ${item.date.toDateString()} | ${item.type} | ${item.category} | ₱${item.price}`);
          });
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

// Initialize data
loadRiceData()
  .then(data => {
    riceData = data;
    console.log('📊 Data load complete');
  })
  .catch(error => {
    console.error('❌ Data load failed:', error);
  });

// Get current prices
function getCurrentPrices() {
  if (riceData.length === 0) {
    return { current_prices: [], as_of_date: new Date() };
  }
  
  const validData = riceData.filter(item => item.price > 0);
  if (validData.length === 0) {
    console.log('❌ No valid price data available');
    return { current_prices: [], as_of_date: new Date() };
  }
  
  const latestDate = new Date(Math.max(...validData.map(item => item.date.getTime())));
  const currentData = validData.filter(item => item.date.getTime() === latestDate.getTime());
  
  console.log(`📊 Current prices: ${currentData.length} records for ${latestDate.toDateString()}`);
  
  return {
    current_prices: currentData,
    as_of_date: latestDate
  };
}

// Get historical data
function getHistoricalData(filters = {}) {
  let filteredData = riceData.filter(item => item.price > 0);
  
  if (filters.type && filters.type !== 'all') {
    filteredData = filteredData.filter(item => item.type === filters.type);
  }
  
  if (filters.category && filters.category !== 'all') {
    filteredData = filteredData.filter(item => item.category === filters.category);
  }
  
  filteredData.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  if (filters.limit) {
    filteredData = filteredData.slice(0, parseInt(filters.limit));
  }
  
  return filteredData;
}

// API Routes
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'RiceUp Backend API',
    data_status: {
      total_records: riceData.length,
      last_update: lastUpdate
    }
  });
});

app.get('/api/health', (req, res) => {
  const currentPrices = getCurrentPrices();
  res.json({
    success: true,
    data: {
      status: 'OK',
      total_records: riceData.length,
      current_records: currentPrices.current_prices.length,
      last_update: lastUpdate
    }
  });
});

app.get('/api/prices/types', (req, res) => {
  const types = {};
  riceData.forEach(item => {
    if (!types[item.type]) types[item.type] = new Set();
    types[item.type].add(item.category);
  });
  
  const result = {};
  Object.keys(types).forEach(type => {
    result[type] = Array.from(types[type]);
  });
  
  res.json({ success: true, data: result });
});

app.get('/api/prices/current', (req, res) => {
  res.json({ success: true, data: getCurrentPrices() });
});

app.get('/api/prices/historical', (req, res) => {
  const { type, category, limit } = req.query;
  const historicalData = getHistoricalData({ type, category, limit });
  res.json({
    success: true,
    data: {
      historical_data: historicalData,
      total_records: historicalData.length
    }
  });
});

app.post('/api/predict', (req, res) => {
  try {
    const { type, category, weeks_ahead = 1 } = req.body;
    
    if (!type || !category) {
      return res.status(400).json({
        success: false,
        error: 'Missing type or category'
      });
    }
    
    const filteredData = riceData.filter(item => 
      item.type === type && item.category === category && item.price > 0
    );
    
    if (filteredData.length < 2) {
      throw new Error('Not enough data');
    }
    
    filteredData.sort((a, b) => a.date - b.date);
    const regressionData = filteredData.map((item, index) => [index, item.price]);
    const result = regression.linear(regressionData);
    const predictedPrice = result.predict(filteredData.length + weeks_ahead - 1)[1];
    
    res.json({
      success: true,
      data: {
        predicted_price: Math.max(0, predictedPrice),
        confidence: result.r2,
        data_points: filteredData.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug endpoint
app.get('/api/debug/csv-sample', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const csvPath = path.join(__dirname, 'rice_prices.csv');
    console.log('📁 Checking CSV file at:', csvPath);
    
    if (!fs.existsSync(csvPath)) {
      console.log('❌ CSV file not found');
      return res.json({ success: false, error: 'CSV file not found' });
    }
    
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n').slice(0, 5);
    
    console.log('📝 First 5 lines:', lines);
    
    res.json({
      success: true,
      lines: lines,
      file_size: content.length
    });
    
  } catch (error) {
    console.error('❌ Debug error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
