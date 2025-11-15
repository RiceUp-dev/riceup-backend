// 🔄 BACKEND URL - UPDATE THIS WITH YOUR ACTUAL RENDER URL
const API_URL = 'https://riceup-backend.onrender.com';
let backendOnline = false;

// Store available types and current data globally
let availableRiceTypes = {};
let currentPricesData = [];
let currentFilter = 'all';

// Price History with Pagination
let historyData = [];
let currentHistoryPage = 1;
const HISTORY_PAGE_SIZE = 10;
let showAllData = false;

// Enhanced fetch with timeout and retry
async function fetchWithTimeout(url, options = {}) {
  const { timeout = 15000, retries = 1 } = options; // 15 second timeout, 1 retry
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      if (attempt === retries) throw error;
      console.log(`Retrying ${url}... (attempt ${attempt + 1})`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
    }
  }
}

// Safe element getter with null checking
function getElementSafe(id) {
  const element = document.getElementById(id);
  if (!element) {
    console.warn(`Element with id '${id}' not found`);
  }
  return element;
}

// Update debug info
function updateDebugInfo(message, isError = false) {
  const debugContent = getElementSafe('debugContent');
  if (debugContent) {
    debugContent.innerHTML = message;
    debugContent.style.color = isError ? '#dc3545' : '#28a745';
  }
}

// Check backend connection first
async function checkBackendConnection() {
  try {
    console.log('🔍 Checking backend connection to:', API_URL);
    updateDebugInfo('Sinusuri ang koneksyon sa backend...');
    
    const response = await fetchWithTimeout(`${API_URL}/api/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Backend is online:', data);
      backendOnline = true;
      
      const connectionStatus = getElementSafe('connectionStatus');
      const successStatus = getElementSafe('successStatus');
      const successMessage = getElementSafe('successMessage');
      
      if (connectionStatus) connectionStatus.style.display = 'none';
      if (successStatus) successStatus.style.display = 'block';
      if (successMessage) {
        successMessage.textContent = `Nakakonekta sa backend! ${data.data?.total_records || 0} records loaded`;
      }
      
      updateDebugInfo(`✅ Backend connected: ${data.data?.status || 'OK'}`);
      return true;
    } else {
      throw new Error(`Backend responded with status: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Backend connection failed:', error);
    backendOnline = false;
    
    const connectionStatus = getElementSafe('connectionStatus');
    const successStatus = getElementSafe('successStatus');
    
    if (connectionStatus) {
      connectionStatus.style.display = 'block';
      connectionStatus.innerHTML = `
        <p><i class="fas fa-exclamation-triangle"></i> Hindi makakonekta sa server. Pakisubukan muli mamaya.</p>
        <button onclick="retryConnection()" style="
          margin-top: 10px;
          padding: 8px 16px;
          background: #6B8E23;
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
        ">
          <i class="fas fa-redo"></i> Subukan Muli
        </button>
      `;
    }
    if (successStatus) successStatus.style.display = 'none';
    
    updateDebugInfo(`❌ Connection failed: ${error.message}`, true);
    return false;
  }
}

// Add retry function
function retryConnection() {
  initializeApp();
}

// Load available rice types from backend - WITH HARDCODED FALLBACK
async function loadRiceTypes() {
  if (!backendOnline) {
    console.log('Backend offline, using hardcoded rice types');
    // Use hardcoded types based on your CSV data
    availableRiceTypes = {
      'KADIWA_RICE_FOR_ALL': ['Premium', 'Well_Milled', 'Regular_Milled', 'P20'],
      'LOCAL': ['Special', 'Premium', 'Well_Milled', 'Regular_Milled'],
      'IMPORTED': ['Special', 'Premium', 'Well_Milled', 'Regular_Milled'],
      'NFA_RICE': ['Well_Milled']
    };
    
    populateDropdowns(availableRiceTypes);
    updateDebugInfo('✅ Gamit ang mga hardcoded na uri ng bigas');
    return;
  }

  try {
    console.log('📥 Loading rice types from:', `${API_URL}/api/prices/types`);
    updateDebugInfo('Kumukuha ng mga uri ng bigas...');
    
    const response = await fetchWithTimeout(`${API_URL}/api/prices/types`, {
      timeout: 10000
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Received rice types response:', data);
      
      // Handle the response format from your backend
      if (data.success && data.data) {
        availableRiceTypes = data.data;
      } else {
        availableRiceTypes = data;
      }
      
      console.log('📋 Available rice types:', availableRiceTypes);
      populateDropdowns(availableRiceTypes);
      updateDebugInfo(`✅ Mga uri ng bigas ay nakuha na (${Object.keys(availableRiceTypes).length} types)`);
    } else {
      console.error('❌ API response not OK for types:', response.status);
      throw new Error(`API responded with status: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Error loading rice types:', error);
    
    // Use hardcoded types based on your CSV data
    console.log('🔄 Using hardcoded rice types based on CSV data');
    availableRiceTypes = {
      'KADIWA_RICE_FOR_ALL': ['Premium', 'Well_Milled', 'Regular_Milled', 'P20'],
      'LOCAL': ['Special', 'Premium', 'Well_Milled', 'Regular_Milled'],
      'IMPORTED': ['Special', 'Premium', 'Well_Milled', 'Regular_Milled'],
      'NFA_RICE': ['Well_Milled']
    };
    
    populateDropdowns(availableRiceTypes);
    updateDebugInfo('✅ Gamit ang mga hardcoded na uri ng bigas');
  }
}

function populateDropdowns(typesData) {
  const predictionTypeSelect = getElementSafe('predictionType');
  const historyCategorySelect = getElementSafe('historyCategory');
  
  if (!predictionTypeSelect || !historyCategorySelect) {
    console.error('Dropdown elements not found');
    return;
  }
  
  console.log('📋 Populating dropdowns with:', typesData);
  
  // Clear existing options
  predictionTypeSelect.innerHTML = '<option value="">Pumili ng Uri ng Bigas</option>';
  historyCategorySelect.innerHTML = '<option value="all">Lahat ng Kategorya</option>';
  
  let totalOptions = 0;
  
  for (const [riceType, categories] of Object.entries(typesData)) {
    if (Array.isArray(categories)) {
      categories.forEach(category => {
        // Skip NFA rice for predictions
        if (riceType === 'NFA_RICE') return;
        
        const displayName = getDisplayName(riceType, category);
        const value = `${riceType}|${category}`;
        
        // Add to prediction dropdown
        const predictionOption = new Option(displayName, value);
        predictionTypeSelect.add(predictionOption);
        
        // Add to history category dropdown
        const historyOption = new Option(displayName, value);
        historyCategorySelect.add(historyOption);
        
        totalOptions++;
      });
    }
  }
  
  console.log(`✅ Added ${totalOptions} options to dropdowns`);
}

function getDisplayName(type, category) {
  const typeNames = {
    'KADIWA_RICE_FOR_ALL': 'Kadiwa',
    'LOCAL': 'Local',
    'IMPORTED': 'Imported',
    'NFA_RICE': 'NFA'
  };
  
  const categoryNames = {
    'Well_Milled': 'Well Milled',
    'Special': 'Special',
    'Premium': 'Premium', 
    'Regular_Milled': 'Regular Milled',
    'P20': 'P20'
  };
  
  return `${typeNames[type] || type} - ${categoryNames[category] || category}`;
}

// Load current prices - FIXED VERSION
async function loadCurrentPrices() {
  if (!backendOnline) {
    showError('riceTypesContainer', 'Hindi makakonekta sa server upang kunin ang mga presyo.');
    showSampleData();
    return;
  }

  const loadingIndicator = getElementSafe('loadingIndicator');
  const riceContainer = getElementSafe('riceTypesContainer');
  
  if (!loadingIndicator || !riceContainer) {
    console.error('Required elements for loading prices not found');
    return;
  }
  
  loadingIndicator.style.display = 'block';
  riceContainer.innerHTML = '';
  riceContainer.appendChild(loadingIndicator);

  try {
    console.log('💰 Fetching current prices from:', `${API_URL}/api/prices/current`);
    updateDebugInfo('Kumukuha ng mga kasalukuyang presyo...');
    
    const response = await fetchWithTimeout(`${API_URL}/api/prices/current`, {
      timeout: 20000
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Received current prices response:', data);
      
      // Store the data globally
      currentPricesData = [];
      
      // Handle different response formats
      if (data.success && data.data) {
        currentPricesData = data.data.current_prices || [];
        console.log('📊 Current prices data:', currentPricesData);
        
        // Check data freshness
        checkDataFreshness(currentPricesData);
        
        const asOfDate = data.data.as_of_date;
        displayCurrentPrices(currentPricesData, 'all', asOfDate);
        updateDebugInfo(`✅ Mga kasalukuyang presyo ay nakuha na (${currentPricesData.length} records)`);
      } else {
        throw new Error('Invalid response format from server');
      }
    } else {
      const errorData = await response.json();
      throw new Error(errorData.error || `API responded with status: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Error loading prices:', error);
    showError('riceTypesContainer', `Hindi makakuha ng mga kasalukuyang presyo: ${error.message}`);
    updateDebugInfo(`❌ Hindi makakuha ng mga presyo: ${error.message}`, true);
    
    // Show sample data when backend fails
    showSampleData();
  }
}

// Fallback sample data display
function showSampleData() {
  const riceContainer = getElementSafe('riceTypesContainer');
  const priceBox = getElementSafe('pricePrintBox');
  
  if (!riceContainer || !priceBox) {
    console.error('Required elements for sample data not found');
    return;
  }
  
  const sampleData = [
    { type: 'LOCAL', category: 'Special', price: 58.50 },
    { type: 'LOCAL', category: 'Premium', price: 53.50 },
    { type: 'LOCAL', category: 'Well_Milled', price: 48.00 },
    { type: 'IMPORTED', category: 'Special', price: 57.00 },
    { type: 'IMPORTED', category: 'Premium', price: 52.00 },
    { type: 'KADIWA_RICE_FOR_ALL', category: 'Well_Milled', price: 40.00 }
  ];
  
  displayCurrentPrices(sampleData, 'all', new Date());
  
  const warningDiv = getElementSafe('dataWarning');
  if (warningDiv) {
    warningDiv.style.display = 'block';
    const warningText = getElementSafe('warningText');
    if (warningText) {
      warningText.textContent = '⚠️ Ipinapakita ang sample data. Ang backend ay hindi available.';
    }
  }
}

// Check if data is recent
function checkDataFreshness(prices) {
  if (!prices || prices.length === 0) return;
  
  const currentYear = new Date().getFullYear();
  let latestDate = null;
  
  prices.forEach(price => {
    if (price.date) {
      const priceDate = new Date(price.date);
      if (!latestDate || priceDate > latestDate) {
        latestDate = priceDate;
      }
    }
  });
  
  const warningDiv = getElementSafe('dataWarning');
  const warningText = getElementSafe('warningText');
  
  if (!warningDiv || !warningText) return;
  
  if (latestDate) {
    const latestDateStr = latestDate.toLocaleDateString('en-PH');
    const latestYear = latestDate.getFullYear();
    
    if (latestYear < currentYear) {
      warningText.textContent = `ℹ️ Pinakabagong datos: ${latestDateStr}`;
      warningDiv.style.display = 'block';
    } else {
      warningDiv.style.display = 'none';
    }
  }
}

// Display current prices
function displayCurrentPrices(prices, filterType, asOfDate) {
  const riceContainer = getElementSafe('riceTypesContainer');
  const priceBox = getElementSafe('pricePrintBox');
  const loadingIndicator = getElementSafe('loadingIndicator');
  const lastUpdated = getElementSafe('lastUpdated');

  if (!riceContainer || !priceBox) {
    console.error('Required elements for displaying prices not found');
    return;
  }

  if (loadingIndicator) loadingIndicator.style.display = 'none';
  riceContainer.innerHTML = '';

  if (!prices || prices.length === 0) {
    riceContainer.innerHTML = '<div class="error">Walang presyo na available.</div>';
    priceBox.innerHTML = '<p>Walang datos na available</p>';
    return;
  }

  // Filter prices if needed and exclude NFA rice
  let filteredPrices = prices.filter(price => price.type !== 'NFA_RICE');
  if (filterType !== 'all') {
    filteredPrices = filteredPrices.filter(price => price.type === filterType);
  }

  if (filteredPrices.length === 0) {
    riceContainer.innerHTML = '<div class="error">Walang presyo na available para sa napiling uri.</div>';
    priceBox.innerHTML = '<p>Walang datos para sa napiling uri</p>';
    return;
  }

  // Display each price
  filteredPrices.forEach(price => {
    const displayName = getDisplayName(price.type, price.category);
    const riceElement = document.createElement('div');
    riceElement.className = 'rice-type';
    riceElement.innerHTML = `
      <span class="rice-type-name">${displayName}</span>
      <span class="rice-type-price">₱${typeof price.price === 'number' ? price.price.toFixed(2) : price.price}/kg</span>
    `;
    riceContainer.appendChild(riceElement);
  });

  // Calculate average price
  const validPrices = filteredPrices.filter(price => price.price > 0);
  const averagePrice = validPrices.length > 0 ? 
    validPrices.reduce((sum, price) => {
      const priceValue = typeof price.price === 'number' ? price.price : parseFloat(price.price);
      return sum + priceValue;
    }, 0) / validPrices.length : 0;
  
  priceBox.innerHTML = `
    <p>Average Presyo:</p>
    <p>₱${averagePrice.toFixed(2)}/kg</p>
    <p><small>Batay sa ${validPrices.length} uri ng bigas</small></p>
  `;

  if (lastUpdated && asOfDate) {
    try {
      lastUpdated.textContent = `Huling na-update: ${new Date(asOfDate).toLocaleDateString('en-PH')}`;
    } catch (e) {
      lastUpdated.textContent = `Huling na-update: ${asOfDate}`;
    }
  }
}

// Filter current prices
function filterCurrentPrices() {
  const filterType = document.getElementById('priceTypeFilter').value;
  currentFilter = filterType;
  
  if (currentPricesData.length > 0) {
    const lastUpdated = getElementSafe('lastUpdated');
    const asOfDate = lastUpdated ? lastUpdated.textContent.replace('Huling na-update: ', '') : '';
    displayCurrentPrices(currentPricesData, filterType, asOfDate);
  }
}

// Price History Functions - FIXED VERSION
async function showPriceHistory() {
  if (!backendOnline) {
    showError('historyContent', 'Hindi makakonekta sa server upang kunin ang kasaysayan ng presyo.');
    return;
  }

  const historyContent = getElementSafe('historyContent');
  const historyLoading = getElementSafe('historyLoading');

  if (!historyContent || !historyLoading) {
    console.error('Required elements for history not found');
    return;
  }

  historyLoading.style.display = 'block';
  historyContent.innerHTML = '';

  try {
    console.log('📊 Fetching history from:', `${API_URL}/api/prices/historical?limit=100`);
    updateDebugInfo('Kumukuha ng kasaysayan ng presyo...');
    
    // Request 100 records
    const response = await fetchWithTimeout(`${API_URL}/api/prices/historical?limit=100`, {
      timeout: 15000
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Received history data response:', data);
      
      // Handle response format
      if (data.success && data.data) {
        historyData = data.data.historical_data || [];
        console.log(`📊 Loaded ${historyData.length} history records`);
      } else {
        historyData = data.historical_data || data.data || [];
      }
      
      // Sort by date (newest first) if not already sorted
      historyData.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      currentHistoryPage = 1;
      showAllData = false;
      filterHistory();
      updateDebugInfo(`✅ Kasaysayan ng presyo ay nakuha na (${historyData.length} records)`);
    } else {
      console.error('❌ API response not OK for history:', response.status);
      throw new Error(`API responded with status: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Error loading history:', error);
    showError('historyContent', `Hindi makakuha ng kasaysayan ng presyo: ${error.message}`);
    updateDebugInfo(`❌ Hindi makakuha ng kasaysayan: ${error.message}`, true);
  } finally {
    if (historyLoading) historyLoading.style.display = 'none';
  }
}

function filterHistory() {
  const historyType = document.getElementById('historyType').value;
  const historyCategory = document.getElementById('historyCategory').value;
  
  if (historyData.length > 0) {
    displayPriceHistory(historyData, historyType, historyCategory);
  }
}

function displayPriceHistory(data, historyType, historyCategory) {
  const historyContent = getElementSafe('historyContent');
  if (!historyContent) return;
  
  // Filter out NFA rice data
  let filteredData = data.filter(item => item.type !== 'NFA_RICE');
  
  // Apply type filter
  if (historyType !== 'all') {
    filteredData = filteredData.filter(item => item.type === historyType);
  }
  
  // Apply category filter
  if (historyCategory !== 'all') {
    const [type, category] = historyCategory.split('|');
    filteredData = filteredData.filter(item => 
      item.type === type && item.category === category
    );
  }
  
  if (!filteredData || filteredData.length === 0) {
    historyContent.innerHTML = '<div class="error">Walang datos na available para sa napiling uri at kategorya.</div>';
    return;
  }

  let displayData = filteredData;
  let totalPages = 1;
  let startIndex = 0;
  let endIndex = filteredData.length;

  if (!showAllData) {
    totalPages = Math.ceil(filteredData.length / HISTORY_PAGE_SIZE);
    startIndex = (currentHistoryPage - 1) * HISTORY_PAGE_SIZE;
    endIndex = Math.min(startIndex + HISTORY_PAGE_SIZE, filteredData.length);
    displayData = filteredData.slice(startIndex, endIndex);
  }

  let tableHTML = `
    <h4 style="text-align: center; margin-bottom: 15px; color: #5B3A29;">
      Kasaysayan ng Presyo - ${getHistoryTitle(historyType, historyCategory)}
      ${showAllData ? '<br><small>(Ipinapakita ang LAHAT ng datos)</small>' : ''}
    </h4>
  `;

  if (!showAllData) {
    tableHTML += `
      <div class="pagination-controls">
        <button onclick="previousHistoryPage()" ${currentHistoryPage === 1 ? 'disabled' : ''} class="pagination-btn">
          <i class="fas fa-arrow-left"></i> Mas Luma
        </button>
        <span class="pagination-info">
          Pahina ${currentHistoryPage} ng ${totalPages} (${filteredData.length} total)
        </span>
        <button onclick="nextHistoryPage()" ${currentHistoryPage === totalPages ? 'disabled' : ''} class="pagination-btn">
          Mas Bago <i class="fas fa-arrow-right"></i>
        </button>
      </div>
    `;
  }

  tableHTML += `
    <table class="history-table">
      <thead>
        <tr>
          <th>Petsa</th>
          <th>Uri</th>
          <th>Kategorya</th>
          <th>Presyo (₱/kg)</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  displayData.forEach((item) => {
    const priceValue = typeof item.price === 'number' ? item.price.toFixed(2) : parseFloat(item.price).toFixed(2);
    const itemDate = new Date(item.date);
    const dateDisplay = itemDate.toLocaleDateString('en-PH');
    
    tableHTML += `
      <tr>
        <td>${dateDisplay}</td>
        <td>${getDisplayName(item.type, '').split(' - ')[0]}</td>
        <td>${getDisplayName('', item.category).split(' - ')[1] || item.category}</td>
        <td><strong>₱${priceValue}</strong></td>
      </tr>
    `;
  });
  
  tableHTML += `
      </tbody>
    </table>
  `;
  
  historyContent.innerHTML = tableHTML;
}

function showAllHistory() {
  showAllData = true;
  const historyType = document.getElementById('historyType').value;
  const historyCategory = document.getElementById('historyCategory').value;
  displayPriceHistory(historyData, historyType, historyCategory);
}

function resetHistoryPagination() {
  showAllData = false;
  currentHistoryPage = 1;
  const historyType = document.getElementById('historyType').value;
  const historyCategory = document.getElementById('historyCategory').value;
  displayPriceHistory(historyData, historyType, historyCategory);
}

function nextHistoryPage() {
  const historyType = document.getElementById('historyType').value;
  const historyCategory = document.getElementById('historyCategory').value;
  
  let filteredData = historyData.filter(item => item.type !== 'NFA_RICE');
  if (historyType !== 'all') {
    filteredData = filteredData.filter(item => item.type === historyType);
  }
  if (historyCategory !== 'all') {
    const [type, category] = historyCategory.split('|');
    filteredData = filteredData.filter(item => 
      item.type === type && item.category === category
    );
  }
  
  const totalPages = Math.ceil(filteredData.length / HISTORY_PAGE_SIZE);
  if (currentHistoryPage < totalPages) {
    currentHistoryPage++;
    displayPriceHistory(historyData, historyType, historyCategory);
  }
}

function previousHistoryPage() {
  if (currentHistoryPage > 1) {
    currentHistoryPage--;
    const historyType = document.getElementById('historyType').value;
    const historyCategory = document.getElementById('historyCategory').value;
    displayPriceHistory(historyData, historyType, historyCategory);
  }
}

function getHistoryTitle(historyType, historyCategory) {
  if (historyCategory !== 'all') {
    const [type, category] = historyCategory.split('|');
    return getDisplayName(type, category);
  } else if (historyType !== 'all') {
    return getDisplayName(historyType, '');
  } else {
    return 'Lahat ng Uri ng Bigas';
  }
}

// Price Prediction
async function predictPrice() {
  if (!backendOnline) {
    alert('Hindi makakonekta sa server. Pakisubukan muli mamaya.');
    return;
  }

  const selectedValue = document.getElementById('predictionType').value;
  
  if (!selectedValue) {
    alert('Mangyaring pumili ng uri ng bigas muna.');
    return;
  }
  
  const [riceType, category] = selectedValue.split('|');
  const weeksAhead = parseInt(document.getElementById('predictionWeeks').value);
  const resultDiv = getElementSafe('predictionResult');
  const loadingDiv = getElementSafe('predictionLoading');
  const priceDiv = getElementSafe('predictedPrice');
  const detailsDiv = getElementSafe('predictionDetails');

  if (!resultDiv || !loadingDiv || !priceDiv || !detailsDiv) {
    alert('Error: Hindi mahanap ang mga elemento para sa hula.');
    return;
  }

  loadingDiv.style.display = 'block';
  resultDiv.style.display = 'none';

  try {
    console.log('🔮 Making prediction request to:', `${API_URL}/api/predict`);
    updateDebugInfo('Gumagawa ng hula sa presyo...');
    
    const response = await fetchWithTimeout(`${API_URL}/api/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: riceType,
        category: category,
        weeks_ahead: weeksAhead
      }),
      timeout: 20000
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Prediction result:', data);
      
      const predictedPrice = data.data?.predicted_price || data.predicted_price;
      if (predictedPrice) {
        const priceValue = parseFloat(predictedPrice);
        priceDiv.textContent = `₱${priceValue.toFixed(2)}/kg`;
        
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + (weeksAhead * 7));
        const futureDateStr = futureDate.toLocaleDateString('en-PH');
        
        detailsDiv.textContent = `Presyo ng ${getDisplayName(riceType, category)} para sa ${futureDateStr} (${weeksAhead} linggo mula ngayon)`;
        resultDiv.style.display = 'block';
        updateDebugInfo('✅ Hula sa presyo ay nakumpleto');
      } else {
        throw new Error('Walang prediction result na naibalik');
      }
    } else {
      const errorText = await response.text();
      throw new Error(`Prediction failed: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Prediction error:', error);
    priceDiv.textContent = '₱--.--/kg';
    detailsDiv.textContent = `Hindi makabuo ng hula: ${error.message}`;
    resultDiv.style.display = 'block';
    updateDebugInfo(`❌ Hindi makabuo ng hula: ${error.message}`, true);
  } finally {
    loadingDiv.style.display = 'none';
  }
}

// Utility functions
function showError(containerId, message) {
  const container = getElementSafe(containerId);
  if (container) {
    container.innerHTML = `<div class="error">${message}</div>`;
  }
}

// Initialize the application
async function initializeApp() {
  console.log('🚀 Initializing RiceUp application...');
  updateDebugInfo('Inisyal ang aplikasyon...');
  
  try {
    // First check backend connection
    const connected = await checkBackendConnection();
    
    if (connected) {
      // Load rice types FIRST (this populates the dropdowns)
      await loadRiceTypes();
      
      // Then load other data in parallel
      await Promise.all([
        loadCurrentPrices(),
        showPriceHistory()
      ]);
      
      console.log('✅ RiceUp application initialized successfully!');
      updateDebugInfo('✅ Aplikasyon ay handa na!');
    } else {
      console.error('❌ Application initialization failed: Backend offline');
      // Still try to load with fallback data
      await loadRiceTypes();
      showSampleData();
    }
  } catch (error) {
    console.error('❌ Application initialization error:', error);
    updateDebugInfo(`❌ Error sa aplikasyon: ${error.message}`, true);
    
    // Load with fallback data even if initialization fails
    await loadRiceTypes();
    showSampleData();
  }
}

// Start the application
window.onload = initializeApp;
