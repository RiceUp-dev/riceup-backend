// Add this endpoint to your backend index.js file:

// Optimized historical data endpoint with year filtering
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
