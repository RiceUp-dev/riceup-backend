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
    
    console.log('📁 Looking for CSV file at:', csvFilePath);
    
    // Check if CSV file exists
    if (!fs.existsSync(csvFilePath)) {
      console.log('❌ CSV file not found! Available files:', fs.readdirSync(__dirname));
      // Use embedded data as fallback
      useEmbeddedData(resolve, reject);
      return;
    }

    console.log('✅ CSV file found! Starting to parse...');
    
    let rowCount = 0;
    let validRowCount = 0;
    let errorCount = 0;
    
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (row) => {
        rowCount++;
        
        try {
          // Log first 3 rows for debugging
          if (rowCount <= 3) {
            console.log(`📄 Sample row ${rowCount}:`, row);
          }
          
          // Skip NFA_RICE and rows with price 0 or empty
          if (row.type === 'NFA_RICE' || !row.price || row.price === '0' || row.price === '') {
            return;
          }
          
          // Convert KADIWA_RICE_FOR_ALL to KADIWA for consistency
          const riceType = row.type === 'KADIWA_RICE_FOR_ALL' ? 'KADIWA' : row.type;
          
          // Parse price - handle different formats
          let priceValue;
          if (typeof row.price === 'string') {
            priceValue = parseFloat(row.price.trim());
          } else {
            priceValue = parseFloat(row.price);
          }
          
          // Validate price
          if (isNaN(priceValue) || priceValue <= 0) {
            console.log(`⚠️  Invalid price in row ${rowCount}:`, row.price);
            return;
          }
          
          // Parse date
          let dateValue;
          try {
            dateValue = new Date(row.date);
            if (isNaN(dateValue.getTime())) {
              console.log(`⚠️  Invalid date in row ${rowCount}:`, row.date);
              return;
            }
          } catch (dateError) {
            console.log(`⚠️  Date parse error in row ${rowCount}:`, row.date);
            return;
          }
          
          results.push({
            date: dateValue,
            type: riceType,
            category: row.category,
            price: priceValue,
            unit: row.unit || 'PHP/kg'
          });
          validRowCount++;
          
        } catch (error) {
          errorCount++;
          console.log(`❌ Error processing row ${rowCount}:`, error.message);
        }
      })
      .on('end', () => {
        console.log(`\n📊 CSV Processing Complete:`);
        console.log(`   Total rows processed: ${rowCount}`);
        console.log(`   Valid records: ${validRowCount}`);
        console.log(`   Errors: ${errorCount}`);
        
        riceData = results;
        lastUpdate = new Date();
        
        if (results.length > 0) {
          const sortedResults = [...results].sort((a, b) => a.date - b.date);
          console.log(`📅 Data covers: ${sortedResults[0].date.toDateString()} to ${sortedResults[sortedResults.length-1].date.toDateString()}`);
          
          // Log type breakdown
          const typeCounts = {};
          results.forEach(item => {
            typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
          });
          console.log('🏷️  Type breakdown:', typeCounts);
        } else {
          console.log('❌ No valid data loaded from CSV! Using embedded data...');
          useEmbeddedData(resolve, reject);
          return;
        }
        
        resolve(results);
      })
      .on('error', (error) => {
        console.error('❌ CSV read error:', error);
        useEmbeddedData(resolve, reject);
      });
  });
}

// Use embedded data as fallback
function useEmbeddedData(resolve, reject) {
  console.log('🔄 Using embedded sample data...');
  
  const sampleData = [
    { date: new Date('2024-01-01'), type: 'KADIWA', category: 'Well_Milled', price: 40, unit: 'PHP/kg' },
    { date: new Date('2024-01-01'), type: 'KADIWA', category: 'Premium', price: 43, unit: 'PHP/kg' },
    { date: new Date('2024-01-01'), type: 'KADIWA', category: 'Regular_Milled', price: 33, unit: 'PHP/kg' },
    { date: new Date('2024-01-01'), type: 'KADIWA', category: 'P20', price: 20, unit: 'PHP/kg' },
    { date: new Date('2024-01-01'), type: 'LOCAL', category: 'Special', price: 61.05, unit: 'PHP/kg' },
    { date: new Date('2024-01-01'), type: 'LOCAL', category: 'Premium', price: 55.02, unit: 'PHP/kg' },
    { date: new Date('2024-01-01'), type: 'LOCAL', category: 'Well_Milled', price: 50.90, unit: 'PHP/kg' },
    { date: new Date('2024-01-01'), type: 'LOCAL', category: 'Regular_Milled', price: 51.83, unit: 'PHP/kg' },
    { date: new Date('2024-01-01'), type: 'IMPORTED', category: 'Special', price: 61.04, unit: 'PHP/kg' },
    { date: new Date('2024-01-01'), type: 'IMPORTED', category: 'Premium', price: 57.45, unit: 'PHP/kg' },
    { date: new Date('2024-01-01'), type: 'IMPORTED', category: 'Well_Milled', price: 53.67, unit: 'PHP/kg' },
    { date: new Date('2024-01-01'), type: 'IMPORTED', category: 'Regular_Milled', price: 50.40, unit: 'PHP/kg' },
    { date: new Date('2024-06-01'), type: 'KADIWA', category: 'Well_Milled', price: 35, unit: 'PHP/kg' },
    { date: new Date('2024-06-01'), type: 'LOCAL', category: 'Special', price: 60.62, unit: 'PHP/kg' },
    { date: new Date('2024-06-01'), type: 'LOCAL', category: 'Premium', price: 54.81, unit: 'PHP/kg' },
    { date: new Date('2024-06-01'), type: 'IMPORTED', category: 'Special', price: 60.59, unit: 'PHP/kg' },
    { date: new Date('2024-06-01'), type: 'IMPORTED', category: 'Premium', price: 57.13, unit: 'PHP/kg' },
  ];
  
  riceData = sampleData;
  lastUpdate = new Date();
  console.log(`✅ Loaded ${sampleData.length} sample records`);
  resolve(sampleData);
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
  
  // Calculate confidence level
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
    trend: slope > 0 ? 'upward' : slope < 0 ? 'downward' : 'stable'
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

// Get current prices
app.get('/prices/current', (req, res) => {
  try {
    const latestDates = {};
    
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

// Get historical prices
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
    
    filteredData.sort((a, b) => b.date - a.date);
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
    available_types: Object.keys(getAvailableTypes()).length
  });
});

// Initialize and start server
loadRiceData().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 RiceUp Backend Server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    console.log(`📍 Available types: http://localhost:${PORT}/prices/types`);
    console.log(`📍 Current prices: http://localhost:${PORT}/prices/current`);
    console.log(`\n📊 Ready to serve rice price predictions!`);
  });
}).catch(error => {
  console.error('❌ Failed to load rice data:', error);
  process.exit(1);
});
