const express = require('express');
const cors = require('cors');
const regression = require('regression');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// COMPREHENSIVE EMBEDDED DATA - This will always work
const riceData = [
  // KADIWA - Premium (6 months of data)
  { date: new Date('2024-01-01'), type: 'KADIWA', category: 'Premium', price: 43.00, unit: 'PHP/kg' },
  { date: new Date('2024-02-01'), type: 'KADIWA', category: 'Premium', price: 43.00, unit: 'PHP/kg' },
  { date: new Date('2024-03-01'), type: 'KADIWA', category: 'Premium', price: 43.00, unit: 'PHP/kg' },
  { date: new Date('2024-04-01'), type: 'KADIWA', category: 'Premium', price: 43.00, unit: 'PHP/kg' },
  { date: new Date('2024-05-01'), type: 'KADIWA', category: 'Premium', price: 43.00, unit: 'PHP/kg' },
  { date: new Date('2024-06-01'), type: 'KADIWA', category: 'Premium', price: 43.00, unit: 'PHP/kg' },
  
  // KADIWA - Well_Milled
  { date: new Date('2024-01-01'), type: 'KADIWA', category: 'Well_Milled', price: 40.00, unit: 'PHP/kg' },
  { date: new Date('2024-02-01'), type: 'KADIWA', category: 'Well_Milled', price: 38.00, unit: 'PHP/kg' },
  { date: new Date('2024-03-01'), type: 'KADIWA', category: 'Well_Milled', price: 35.00, unit: 'PHP/kg' },
  { date: new Date('2024-04-01'), type: 'KADIWA', category: 'Well_Milled', price: 35.00, unit: 'PHP/kg' },
  { date: new Date('2024-05-01'), type: 'KADIWA', category: 'Well_Milled', price: 35.00, unit: 'PHP/kg' },
  { date: new Date('2024-06-01'), type: 'KADIWA', category: 'Well_Milled', price: 35.00, unit: 'PHP/kg' },
  
  // KADIWA - Regular_Milled
  { date: new Date('2024-01-01'), type: 'KADIWA', category: 'Regular_Milled', price: 33.00, unit: 'PHP/kg' },
  { date: new Date('2024-02-01'), type: 'KADIWA', category: 'Regular_Milled', price: 33.00, unit: 'PHP/kg' },
  { date: new Date('2024-03-01'), type: 'KADIWA', category: 'Regular_Milled', price: 33.00, unit: 'PHP/kg' },
  { date: new Date('2024-04-01'), type: 'KADIWA', category: 'Regular_Milled', price: 33.00, unit: 'PHP/kg' },
  { date: new Date('2024-05-01'), type: 'KADIWA', category: 'Regular_Milled', price: 33.00, unit: 'PHP/kg' },
  { date: new Date('2024-06-01'), type: 'KADIWA', category: 'Regular_Milled', price: 33.00, unit: 'PHP/kg' },
  
  // KADIWA - P20
  { date: new Date('2024-01-01'), type: 'KADIWA', category: 'P20', price: 24.50, unit: 'PHP/kg' },
  { date: new Date('2024-02-01'), type: 'KADIWA', category: 'P20', price: 20.00, unit: 'PHP/kg' },
  { date: new Date('2024-03-01'), type: 'KADIWA', category: 'P20', price: 20.00, unit: 'PHP/kg' },
  { date: new Date('2024-04-01'), type: 'KADIWA', category: 'P20', price: 20.00, unit: 'PHP/kg' },
  { date: new Date('2024-05-01'), type: 'KADIWA', category: 'P20', price: 20.00, unit: 'PHP/kg' },
  { date: new Date('2024-06-01'), type: 'KADIWA', category: 'P20', price: 20.00, unit: 'PHP/kg' },
  
  // LOCAL - Special
  { date: new Date('2024-01-01'), type: 'LOCAL', category: 'Special', price: 61.05, unit: 'PHP/kg' },
  { date: new Date('2024-02-01'), type: 'LOCAL', category: 'Special', price: 61.19, unit: 'PHP/kg' },
  { date: new Date('2024-03-01'), type: 'LOCAL', category: 'Special', price: 61.03, unit: 'PHP/kg' },
  { date: new Date('2024-04-01'), type: 'LOCAL', category: 'Special', price: 60.90, unit: 'PHP/kg' },
  { date: new Date('2024-05-01'), type: 'LOCAL', category: 'Special', price: 60.79, unit: 'PHP/kg' },
  { date: new Date('2024-06-01'), type: 'LOCAL', category: 'Special', price: 60.62, unit: 'PHP/kg' },
  
  // LOCAL - Premium
  { date: new Date('2024-01-01'), type: 'LOCAL', category: 'Premium', price: 55.02, unit: 'PHP/kg' },
  { date: new Date('2024-02-01'), type: 'LOCAL', category: 'Premium', price: 55.21, unit: 'PHP/kg' },
  { date: new Date('2024-03-01'), type: 'LOCAL', category: 'Premium', price: 55.37, unit: 'PHP/kg' },
  { date: new Date('2024-04-01'), type: 'LOCAL', category: 'Premium', price: 55.46, unit: 'PHP/kg' },
  { date: new Date('2024-05-01'), type: 'LOCAL', category: 'Premium', price: 55.01, unit: 'PHP/kg' },
  { date: new Date('2024-06-01'), type: 'LOCAL', category: 'Premium', price: 54.81, unit: 'PHP/kg' },
  
  // LOCAL - Well_Milled
  { date: new Date('2024-01-01'), type: 'LOCAL', category: 'Well_Milled', price: 50.90, unit: 'PHP/kg' },
  { date: new Date('2024-02-01'), type: 'LOCAL', category: 'Well_Milled', price: 52.05, unit: 'PHP/kg' },
  { date: new Date('2024-03-01'), type: 'LOCAL', category: 'Well_Milled', price: 51.94, unit: 'PHP/kg' },
  { date: new Date('2024-04-01'), type: 'LOCAL', category: 'Well_Milled', price: 52.16, unit: 'PHP/kg' },
  { date: new Date('2024-05-01'), type: 'LOCAL', category: 'Well_Milled', price: 51.53, unit: 'PHP/kg' },
  { date: new Date('2024-06-01'), type: 'LOCAL', category: 'Well_Milled', price: 51.46, unit: 'PHP/kg' },
  
  // LOCAL - Regular_Milled
  { date: new Date('2024-01-01'), type: 'LOCAL', category: 'Regular_Milled', price: 51.83, unit: 'PHP/kg' },
  { date: new Date('2024-02-01'), type: 'LOCAL', category: 'Regular_Milled', price: 50.96, unit: 'PHP/kg' },
  { date: new Date('2024-03-01'), type: 'LOCAL', category: 'Regular_Milled', price: 49.67, unit: 'PHP/kg' },
  { date: new Date('2024-04-01'), type: 'LOCAL', category: 'Regular_Milled', price: 49.86, unit: 'PHP/kg' },
  { date: new Date('2024-05-01'), type: 'LOCAL', category: 'Regular_Milled', price: 49.41, unit: 'PHP/kg' },
  { date: new Date('2024-06-01'), type: 'LOCAL', category: 'Regular_Milled', price: 48.88, unit: 'PHP/kg' },
  
  // IMPORTED - Special
  { date: new Date('2024-01-01'), type: 'IMPORTED', category: 'Special', price: 61.04, unit: 'PHP/kg' },
  { date: new Date('2024-02-01'), type: 'IMPORTED', category: 'Special', price: 61.00, unit: 'PHP/kg' },
  { date: new Date('2024-03-01'), type: 'IMPORTED', category: 'Special', price: 60.95, unit: 'PHP/kg' },
  { date: new Date('2024-04-01'), type: 'IMPORTED', category: 'Special', price: 60.28, unit: 'PHP/kg' },
  { date: new Date('2024-05-01'), type: 'IMPORTED', category: 'Special', price: 60.57, unit: 'PHP/kg' },
  { date: new Date('2024-06-01'), type: 'IMPORTED', category: 'Special', price: 60.59, unit: 'PHP/kg' },
  
  // IMPORTED - Premium
  { date: new Date('2024-01-01'), type: 'IMPORTED', category: 'Premium', price: 57.45, unit: 'PHP/kg' },
  { date: new Date('2024-02-01'), type: 'IMPORTED', category: 'Premium', price: 57.70, unit: 'PHP/kg' },
  { date: new Date('2024-03-01'), type: 'IMPORTED', category: 'Premium', price: 57.90, unit: 'PHP/kg' },
  { date: new Date('2024-04-01'), type: 'IMPORTED', category: 'Premium', price: 57.74, unit: 'PHP/kg' },
  { date: new Date('2024-05-01'), type: 'IMPORTED', category: 'Premium', price: 57.39, unit: 'PHP/kg' },
  { date: new Date('2024-06-01'), type: 'IMPORTED', category: 'Premium', price: 57.13, unit: 'PHP/kg' },
  
  // IMPORTED - Well_Milled
  { date: new Date('2024-01-01'), type: 'IMPORTED', category: 'Well_Milled', price: 53.67, unit: 'PHP/kg' },
  { date: new Date('2024-02-01'), type: 'IMPORTED', category: 'Well_Milled', price: 54.26, unit: 'PHP/kg' },
  { date: new Date('2024-03-01'), type: 'IMPORTED', category: 'Well_Milled', price: 53.77, unit: 'PHP/kg' },
  { date: new Date('2024-04-01'), type: 'IMPORTED', category: 'Well_Milled', price: 52.68, unit: 'PHP/kg' },
  { date: new Date('2024-05-01'), type: 'IMPORTED', category: 'Well_Milled', price: 52.89, unit: 'PHP/kg' },
  { date: new Date('2024-06-01'), type: 'IMPORTED', category: 'Well_Milled', price: 53.50, unit: 'PHP/kg' },
  
  // IMPORTED - Regular_Milled
  { date: new Date('2024-01-01'), type: 'IMPORTED', category: 'Regular_Milled', price: 50.40, unit: 'PHP/kg' },
  { date: new Date('2024-02-01'), type: 'IMPORTED', category: 'Regular_Milled', price: 50.00, unit: 'PHP/kg' },
  { date: new Date('2024-03-01'), type: 'IMPORTED', category: 'Regular_Milled', price: 49.48, unit: 'PHP/kg' },
  { date: new Date('2024-04-01'), type: 'IMPORTED', category: 'Regular_Milled', price: 49.63, unit: 'PHP/kg' },
  { date: new Date('2024-05-01'), type: 'IMPORTED', category: 'Regular_Milled', price: 49.74, unit: 'PHP/kg' },
  { date: new Date('2024-06-01'), type: 'IMPORTED', category: 'Regular_Milled', price: 49.85, unit: 'PHP/kg' }
];

const lastUpdate = new Date();

console.log(`✅ Pre-loaded ${riceData.length} rice price records`);
console.log(`📊 Data ready for predictions!`);

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
  const confidence = Math.max(0, Math.min(1, result.r2));
  
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
    
    const prediction = predictPrice(type, category, parseInt(weeks_ahead));
    
    res.json({
      success: true,
      ...prediction,
      type,
      category
    });
    
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
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
      'POST /predict': 'Price prediction'
    },
    data_status: {
      total_records: riceData.length,
      available_types: Object.keys(getAvailableTypes()).length
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 RiceUp Backend Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📍 Available types: http://localhost:${PORT}/prices/types`);
  console.log(`📍 Current prices: http://localhost:${PORT}/prices/current`);
  console.log(`\n📊 Ready! Loaded ${riceData.length} rice price records`);
});
