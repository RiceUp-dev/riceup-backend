const express = require('express');
const cors = require('cors');
const csv = require('csv-parser');
const regression = require('regression');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Store rice price data
let riceData = [];
let lastUpdate = null;

// Load and parse CSV data
function loadRiceData() {
  return new Promise((resolve, reject) => {
    const results = [];
    
    const csvFilePath = path.join(__dirname, 'rice_prices.csv');
    
    // If CSV file exists locally, use it
    if (fs.existsSync(csvFilePath)) {
      console.log('📁 Loading data from rice_prices.csv file...');
      fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (data) => {
          // Clean and parse the data - handle both NFA_RICE and KADIWA_RICE_FOR_ALL
          if (data.price && data.price !== '0' && data.type !== 'NFA_RICE') {
            // Convert KADIWA_RICE_FOR_ALL to KADIWA for consistency
            const riceType = data.type === 'KADIWA_RICE_FOR_ALL' ? 'KADIWA' : data.type;
            
            results.push({
              date: new Date(data.date),
              type: riceType,
              category: data.category,
              price: parseFloat(data.price),
              unit: data.unit
            });
          }
        })
        .on('end', () => {
          riceData = results;
          lastUpdate = new Date();
          console.log(`✅ Successfully loaded ${riceData.length} rice price records from rice_prices.csv`);
          
          if (results.length > 0) {
            const sortedResults = [...results].sort((a, b) => a.date - b.date);
            console.log(`📊 Data covers period from ${sortedResults[0].date.toDateString()} to ${sortedResults[sortedResults.length-1].date.toDateString()}`);
            
            // Log available types and counts
            const typeCounts = {};
            results.forEach(item => {
              typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
            });
            console.log('📈 Data breakdown by type:', typeCounts);
          }
          
          resolve(results);
        })
        .on('error', (error) => {
          console.error('❌ Error reading CSV file:', error);
          reject(error);
        });
    } else {
      console.log('⚠️  No rice_prices.csv file found, using embedded sample data');
      // If no local CSV, use minimal sample data
      const sampleData = [
        { date: new Date('2024-01-01'), type: 'KADIWA', category: 'Well_Milled', price: 40, unit: 'PHP/kg' },
        { date: new Date('2024-01-01'), type: 'LOCAL', category: 'Special', price: 61.05, unit: 'PHP/kg' },
        { date: new Date('2024-01-01'), type: 'LOCAL', category: 'Premium', price: 55.02, unit: 'PHP/kg' },
        { date: new Date('2024-01-01'), type: 'IMPORTED', category: 'Special', price: 61.04, unit: 'PHP/kg' },
        { date: new Date('2024-01-01'), type: 'IMPORTED', category: 'Premium', price: 57.45, unit: 'PHP/kg' },
        { date: new Date('2024-06-01'), type: 'KADIWA', category: 'Well_Milled', price: 35, unit: 'PHP/kg' },
        { date: new Date('2024-06-01'), type: 'LOCAL', category: 'Special', price: 60.62, unit: 'PHP/kg' },
        { date: new Date('2024-06-01'), type: 'LOCAL', category: 'Premium', price: 54.81, unit: 'PHP/kg' },
        { date: new Date('2024-06-01'), type: 'IMPORTED', category: 'Special', price: 60.59, unit: 'PHP/kg' },
        { date: new Date('2024-06-01'), type: 'IMPORTED', category: 'Premium', price: 57.13, unit: 'PHP/kg' },
      ];
      
      riceData = sampleData;
      lastUpdate = new Date();
      console.log(`📊 Loaded ${riceData.length} sample rice price records`);
      resolve(sampleData);
    }
  });
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

// Linear regression prediction
function predictPrice(riceType, category, weeksAhead = 1) {
  // Filter data for the specific rice type and category
  const filteredData = riceData.filter(item => 
    item.type === riceType && item.category === category
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
  const confidence = Math.max(0, Math.min(1, result.r2)); // Clamp between 0 and 1
  
  // Predict future price
  const lastDate = filteredData[filteredData.length - 1].date;
  const predictionDate = new Date(lastDate);
  predictionDate.setDate(predictionDate.getDate() + (weeksAhead * 7));
  
  const predictionDays = (predictionDate - firstDate) / (1000 * 60 * 60 * 24);
  const predictedPrice = slope * predictionDays + intercept;
  
  // Ensure price doesn't go negative
  const finalPrice = Math.max(0, parseFloat(predictedPrice.toFixed(2)));
  
  return {
    predicted_price: finalPrice,
    prediction_date: predictionDate.toISOString().split('T')[0],
    confidence: confidence,
    data_points: filteredData.length,
    trend: slope > 0 ? 'upward' : slope < 0 ? 'downward' : 'stable',
    slope: parseFloat(slope.toFixed(6))
  };
}

// API Routes

// Get available rice types
app.get('/prices/types', (req, res) => {
  try {
    const types = getAvailableTypes();
    res.json(types);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current prices (latest prices for each type/category)
app.get('/prices/current', (req, res) => {
  try {
    const currentPrices = {};
    const latestDates = {};
    
    // Find the latest date for each type/category combination
    riceData.forEach(item => {
      const key = `${item.type}-${item.category}`;
      if (!latestDates[key] || item.date > latestDates[key].date) {
        latestDates[key] = {
          date: item.date,
          price: item.price,
          type: item.type,
          category: item.category,
          unit: item.unit
        };
      }
    });
    
    const currentPricesArray = Object.values(latestDates);
    
    res.json({
      current_prices: currentPricesArray,
      as_of_date: lastUpdate.toISOString(),
      total_records: riceData.length,
      available_types: Object.keys(latestDates).length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get historical prices with optional filtering
app.get('/prices/historical', (req, res) => {
  try {
    const { type, category } = req.query;
    
    let filteredData = [...riceData];
    
    if (type && type !== 'all') {
      filteredData = filteredData.filter(item => item.type === type);
    }
    
    if (category && category !== 'all') {
      filteredData = filteredData.filter(item => item.category === category);
    }
    
    // Sort by date (newest first)
    filteredData.sort((a, b) => b.date - a.date);
    
    // Limit to last 100 records for performance
    const limitedData = filteredData.slice(0, 100);
    
    res.json({
      historical_data: limitedData,
      total_records: filteredData.length,
      filtered_records: limitedData.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Price prediction endpoint
app.post('/predict', (req, res) => {
  try {
    const { type, category, weeks_ahead = 1 } = req.body;
    
    if (!type || !category) {
      return res.status(400).json({
        error: 'Missing required parameters: type and category'
      });
    }
    
    console.log(`🔮 Prediction request: ${type} - ${category} (${weeks_ahead} weeks ahead)`);
    
    const prediction = predictPrice(type, category, parseInt(weeks_ahead));
    
    console.log(`✅ Prediction result: ₱${prediction.predicted_price} (confidence: ${(prediction.confidence * 100).toFixed(1)}%)`);
    
    res.json({
      success: true,
      ...prediction,
      type,
      category
    });
    
  } catch (error) {
    console.error('❌ Prediction error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get prediction insights for a specific rice type
app.get('/predict/insights/:type/:category', (req, res) => {
  try {
    const { type, category } = req.params;
    
    const filteredData = riceData.filter(item => 
      item.type === type && item.category === category
    );
    
    if (filteredData.length === 0) {
      return res.status(404).json({ error: 'No data found for the specified type and category' });
    }
    
    // Sort by date
    filteredData.sort((a, b) => a.date - b.date);
    
    const insights = {
      type,
      category,
      total_data_points: filteredData.length,
      date_range: {
        start: filteredData[0].date.toISOString().split('T')[0],
        end: filteredData[filteredData.length - 1].date.toISOString().split('T')[0]
      },
      price_range: {
        min: Math.min(...filteredData.map(d => d.price)),
        max: Math.max(...filteredData.map(d => d.price)),
        current: filteredData[filteredData.length - 1].price
      }
    };
    
    res.json(insights);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    last_update: lastUpdate,
    total_records: riceData.length,
    available_types: Object.keys(getAvailableTypes()).length,
    memory_usage: process.memoryUsage(),
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'RiceUp Backend API',
    version: '1.0.0',
    endpoints: {
      'GET /health': 'Health check',
      'GET /prices/types': 'Available rice types',
      'GET /prices/current': 'Current prices', 
      'GET /prices/historical': 'Historical prices',
      'POST /predict': 'Price prediction',
      'GET /predict/insights/:type/:category': 'Prediction insights'
    }
  });
});

// Initialize and start server
loadRiceData().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 RiceUp Backend Server running on port ${PORT}`);
    console.log(`📍 Available endpoints:`);
    console.log(`   GET  /health - Health check`);
    console.log(`   GET  /prices/types - Available rice types`);
    console.log(`   GET  /prices/current - Current prices`);
    console.log(`   GET  /prices/historical - Historical prices`);
    console.log(`   POST /predict - Price prediction`);
    console.log(`\n📊 Server ready to serve rice price predictions!`);
  });
}).catch(error => {
  console.error('❌ Failed to load rice data:', error);
  process.exit(1);
});