// Initialize Supabase Client
// Debug mode - set to true to enable verbose logging
const DEBUG_MODE = true;

// Global variables
let supabase;
let auctionItems = [];
let categories = new Set();
let connectionStatus = false;
let currentFilter = 'all';
let errorLogEntries = [];

// Debug logging helper
function debugLog(...args) {
    if (DEBUG_MODE) {
        console.log('[DEBUG]', ...args);
    }
}

// Log bid to history
async function logBidToHistory(item, bidAmount, bidderName, tableNumber) {
    try {
        if (!supabase) {
            console.error('Supabase client not initialized');
            return;
        }
        
        console.log('Logging bid to history:', { item, bidAmount, bidderName, tableNumber });
        
        // Get the previous bid amount from the item
        const previousBid = item.current_bid || 0;
        
        const { data, error } = await supabase
            .from('bid_history')
            .insert([
                {
                    item_id: item.id,
                    item_title: item.title || item.name, // Use title or fallback to name
                    previous_bid: previousBid,
                    bid_amount: bidAmount,
                    bidder_name: bidderName,
                    table_number: tableNumber,
                    created_at: new Date().toISOString() // Match the column name used in bid-history.html
                }
            ]);
            
        if (error) {
            console.error('Error logging bid to history:', error);
            return;
        }
        
        console.log('Bid successfully logged to history');
    } catch (error) {
        console.error('Exception logging bid to history:', error);
    }
}

// Log error to file
async function logErrorToFile(errorType, errorMessage, details = {}) {
    try {
        // Create log entry
        const timestamp = new Date().toISOString();
        const logEntry = `
### Error at ${timestamp}

- **Type**: ${errorType}
- **Message**: ${errorMessage}
${details ? `- **Details**: \`${JSON.stringify(details)}\`` : ''}
`;
        
        // Store in localStorage for persistent access
        const existingLogs = localStorage.getItem('errorLogs') || '';
        localStorage.setItem('errorLogs', existingLogs + logEntry);
        
        // Add to in-memory collection
        errorLogEntries.push({
            timestamp,
            type: errorType,
            message: errorMessage,
            details
        });
        
        // Create a downloadable error log for the user
        const errorLogContent = `# Masters Tournament Charity Auction App - Error Log

## Generated at ${timestamp}

${logEntry}`;
        
        // Create blob and download link
        const blob = new Blob([errorLogContent], { type: 'text/markdown' });
        const downloadUrl = URL.createObjectURL(blob);
        
        // Create a download link for the error log
        const downloadLink = document.createElement('a');
        downloadLink.href = downloadUrl;
        downloadLink.download = `error_log_${new Date().getTime()}.md`;
        downloadLink.textContent = 'Download Error Log';
        downloadLink.style.display = 'none'; // Hidden link
        document.body.appendChild(downloadLink);
        
        // Show toast notification with option to download log
        const toastMessage = 'Error logged. Click here to download the error log.';
        showToastNotification('error', toastMessage, () => {
            // Trigger download when toast is clicked
            downloadLink.click();
        });
        
        // Clean up the link after toast is dismissed
        setTimeout(() => {
            document.body.removeChild(downloadLink);
        }, 5500); // Toast duration (5000) + animation (500)
        
        return true;
    } catch (err) {
        console.error('Failed to log error:', err);
        return false;
    }
}

// View all error logs
function viewAllErrorLogs() {
    const logs = localStorage.getItem('errorLogs') || '';
    
    // Create a full error log markdown document
    const fullErrorLog = `# Masters Tournament Charity Auction App - Error Log

## Generated at ${new Date().toISOString()}

${logs || '\n*No errors logged yet.*\n'}`;
    
    // Create blob and open in new tab
    const blob = new Blob([fullErrorLog], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
}

// DOM elements - will be initialized in initElements()
let auctionItemsContainer;
let connectionStatusEl;
let categoryFilterEl;
let searchInputEl;
let searchButtonEl;
let itemModal;
// Bid confirmation modal removed - using toast notifications
let currentYearEl;

// Initialize DOM elements
function initElements() {
    console.log('Initializing DOM elements...');
    try {
        // Get references to DOM elements
        auctionItemsContainer = document.getElementById('auction-items');
        connectionStatusEl = document.getElementById('connection-status');
        categoryFilterEl = document.getElementById('category-filter');
        searchInputEl = document.getElementById('search-input');
        searchButtonEl = document.getElementById('search-button');
        itemModal = document.getElementById('item-modal');
        // Bid confirmation modal removed - using toast notifications
        currentYearEl = document.getElementById('current-year');
        
        // Log which elements were found or not found for debugging
        console.log('DOM Elements initialized:', {
            auctionItemsContainer: !!auctionItemsContainer,
            connectionStatusEl: !!connectionStatusEl,
            categoryFilterEl: !!categoryFilterEl,
            searchInputEl: !!searchInputEl,
            searchButtonEl: !!searchButtonEl,
            itemModal: !!itemModal,
            // Bid confirmation modal removed - using toast notifications
            currentYearEl: !!currentYearEl
        });
        
        // Set current year in footer if the element exists
        if (currentYearEl) {
            currentYearEl.textContent = new Date().getFullYear();
        }
        
        // Check for critical elements and warn if missing
        if (!auctionItemsContainer) {
            console.error('Critical element missing: auction-items container not found');
        }
        // Error modal check removed - using toast notifications only
    } catch (error) {
        console.error('Error initializing DOM elements:', error);
    }
}

// Check if DOM is ready and wait if needed
function ensureDomReady() {
    return new Promise(resolve => {
        if (document.readyState === 'loading') {
            debugLog('DOM still loading, waiting for DOMContentLoaded event');
            document.addEventListener('DOMContentLoaded', () => {
                debugLog('DOM now loaded via event');
                resolve();
            });
        } else {
            debugLog('DOM already loaded, proceeding immediately');
            resolve();
        }
    });
}

// Initialize the application
async function initApp() {
    try {
        debugLog('=== Initializing Application ===');
        
        // Make sure DOM is ready
        await ensureDomReady();
        
        // Initialize elements
        initElements();
        
        // Initialize with a default status if none exists
        if (!localStorage.getItem('auctionStatus')) {
            localStorage.setItem('auctionStatus', 'paused'); // Start paused by default
        }
        console.log('Current auction status:', localStorage.getItem('auctionStatus'));
        
        // Verify Supabase configuration
        debugLog('=== SUPABASE CONFIGURATION ===');
        debugLog('SUPABASE_URL:', SUPABASE_URL);
        debugLog('SUPABASE_ANON_KEY length:', SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.length : 0);
        debugLog('window.supabase available:', typeof window.supabase);
        
        // Connect to Supabase
        const connected = await connectToSupabase();
        
        if (connected) {
            // Load auction items
            await loadAuctionItems();
            
            // Set up event listeners
            setupEventListeners();
            
            // Set up real-time updates
            setupRealTimeUpdates();
            
            // Update auction status display
            updateAuctionStatusDisplay();
        } else {
            console.warn('Failed to connect to Supabase');
            // Set up event listeners first
            setupEventListeners();
            
            // Show error message
            showError('Unable to connect to the database. Please check your connection and try again.');
            
            // Update auction status display
            updateAuctionStatusDisplay();
        }
    } catch (error) {
        console.error('Error initializing app:', error);
        updateConnectionStatus(false);
        showError('Failed to initialize the application. Please refresh the page.');
    }
}

// Call initApp when the DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);

// Connect to Supabase
async function connectToSupabase() {
    try {
        debugLog('=== connectToSupabase ===');
        debugLog('Connecting to Supabase with URL:', SUPABASE_URL);
        debugLog('Anon key available:', SUPABASE_ANON_KEY ? 'Yes (length: ' + SUPABASE_ANON_KEY.length + ')' : 'No');
        debugLog('window.supabase available:', typeof window.supabase);
        debugLog('window.supabase methods:', window.supabase ? Object.keys(window.supabase) : 'N/A');
        debugLog('Current hostname:', window.location.hostname);
        debugLog('Current protocol:', window.location.protocol);
        
        // Check if Supabase client library is loaded
        if (!window.supabase || typeof window.supabase.createClient !== 'function') {
            console.error('Supabase client library not loaded or createClient method not available!');
            console.log('window object keys:', Object.keys(window));
            updateConnectionStatus(false);
            await showError('Supabase client library failed to load. Please check your internet connection and reload the page.');
            return false;
        }
        
        try {
            // Store Supabase URL and key in localStorage for the bid history page
            localStorage.setItem('SUPABASE_URL', SUPABASE_URL);
            localStorage.setItem('SUPABASE_ANON_KEY', SUPABASE_ANON_KEY);
            
            // Create Supabase client
            console.log('Creating Supabase client...');
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('Supabase client created successfully:', !!supabase);
            console.log('Supabase client methods:', Object.keys(supabase));
        } catch (clientError) {
            console.error('Error creating Supabase client:', clientError);
            updateConnectionStatus(false);
            await showError(`Failed to create Supabase client: ${clientError.message}. Please check your configuration.`);
            return false;
        }
        
        // Test the connection with a query that matches the actual table structure
        console.log('Testing connection with a query that matches the actual schema...');
        let data, error;
        
        try {
            const response = await supabase.from('auction_items').select('id, title, description, starting_price, current_bid, high_bidder').limit(1);
            data = response.data;
            error = response.error;
            console.log('Test query response:', response);
        } catch (queryError) {
            console.error('Exception during test query:', queryError);
            error = {
                message: queryError.message,
                name: queryError.name,
                stack: queryError.stack
            };
        }
        
        if (error) {
            console.error('Supabase connection test failed:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            console.error('Error details:', error.details);
            updateConnectionStatus(false);
            
            // Log the error to our error.md file
            await logErrorToFile('Supabase Connection Error', error.message || 'Unknown error', {
                errorCode: error.code,
                errorDetails: error.details,
                url: window.location.href,
                hostname: window.location.hostname,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent
            });
            
            // Show specific error based on the error type
            if (error.code === '401') {
                await showError('Authentication failed. The Supabase API key may be invalid or expired.');
            } else if (error.message && (error.message.includes('cors') || error.message.includes('fetch'))) {
                await showError(`Connection error detected. This is likely due to CORS restrictions or network issues. For GitHub Pages, we recommend deploying to Netlify instead.`);
            } else if (window.location.hostname.includes('github.io')) {
                await showError(`GitHub Pages cannot connect to Supabase. This is likely due to CORS restrictions or the need for HTTPS. Consider deploying to Netlify instead.`);
            } else {
                await showError(`Database connection failed: ${error.message || 'Unknown error'}. Please check your internet connection and try again.`);
            }
            
            return false;
        }
        
        console.log('Supabase connection successful!', data);
        updateConnectionStatus(true);
        return true;
    } catch (error) {
        console.error('Error connecting to Supabase:', error);
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        updateConnectionStatus(false);
        
        // Show user-friendly error message
        showError('Failed to connect to database. Please check your internet connection or try again later.');
        
        return false;
    }
}

// Load auction items
async function loadAuctionItems() {
    try {
        // Debug info about current state
        debugLog('=== loadAuctionItems ===');
        debugLog('Current URL:', window.location.href);
        debugLog('Hostname:', window.location.hostname);
        debugLog('Supabase client initialized:', !!supabase);
        debugLog('Connection status:', connectionStatus);
        debugLog('DOM ready:', document.readyState);
        debugLog('Auction items container exists:', !!auctionItemsContainer);
        
        // Verify Supabase client is initialized
        if (!supabase) {
            console.error('Supabase client not initialized');
            await showError('Database connection not initialized. Please refresh the page.');
            // Try to initialize Supabase
            const connected = await connectToSupabase();
            if (!connected) {
                return;
            }
        }
        
        console.log('Loading auction items from database...');
        
        // Try a simple query first to test connection
        const testQuery = await supabase.from('auction_items').select('count', { count: 'exact', head: true });
        console.log('Test query result:', testQuery);
        
        if (testQuery.error) {
            console.error('Test query failed:', testQuery.error);
            await showError(`Database connection test failed: ${testQuery.error.message}`);
            return;
        }
        
        // Now fetch the actual data
        const { data, error } = await supabase
            .from('auction_items')
            .select('id, title, description, starting_price, current_bid, high_bidder, table_number, image_url, category, created_at, updated_at')
            .order('current_bid', { ascending: false });
        
        if (error) {
            console.error('Error loading auction items:', error);
            await showError(`Failed to load auction items: ${error.message}`);
            // Log the error to our error file
            await logErrorToFile('Load Items Error', error.message || 'Unknown error', {
                url: window.location.href,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                error: JSON.stringify(error)
            });
            return;
        }
        
        console.log('Auction items loaded:', data);
        
        // Validate data
        if (!data || !Array.isArray(data)) {
            console.error('Invalid data format received:', data);
            await showError('Invalid data format received from database');
            return;
        }
        
        auctionItems = data;
        
        // If no items were found, show error message
        if (auctionItems.length === 0) {
            console.warn('No auction items found in the database');
            await showError('No auction items found in the database. Please check your connection and try again.');
            return;
        }
        
        // Convert string prices to numbers if needed and validate data
        auctionItems = auctionItems.map(item => {
            // Ensure all required fields exist
            const processedItem = {
                ...item,
                id: item.id || `temp-${Math.random().toString(36).substring(2, 9)}`,
                title: item.title || item.name || 'Unnamed Item',
                description: item.description || 'No description available',
                current_bid: typeof item.current_bid === 'string' ? parseFloat(item.current_bid) || 0 : (item.current_bid || 0),
                starting_price: typeof item.starting_price === 'string' ? parseFloat(item.starting_price) || 0 : (item.starting_price || 0),
                high_bidder: item.high_bidder || '-',
                category: item.category || 'Uncategorized'
            };
            
            // If current_bid is not set, use starting_price
            if (!processedItem.current_bid && processedItem.starting_price) {
                processedItem.current_bid = processedItem.starting_price;
            }
            
            return processedItem;
        });
        
        console.log('Processed auction items:', auctionItems);
        
        // Extract categories
        categories = new Set();
        auctionItems.forEach(item => {
            if (item.category) {
                categories.add(item.category);
            }
        });
        
        // Update connection status
        updateConnectionStatus(true);
        
        // Render items
        renderAuctionItems(auctionItems);
        populateCategoryFilter();
    } catch (error) {
        console.error('Error in loadAuctionItems:', error);
        await showError('An unexpected error occurred while loading auction items.');
        // Log the error to our error.md file
        await logErrorToFile('Load Items Error', error.message || 'Unknown error', {
            url: window.location.href,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
        });
        // Show error message
        await showError('An unexpected error occurred while loading auction items.');
    }
}

// Render auction items to the DOM
function renderAuctionItems(items) {
    debugLog('=== renderAuctionItems ===');
    debugLog('Items to render:', items ? items.length : 0);
    
    // Check if container exists
    if (!auctionItemsContainer) {
        console.error('Auction items container not found in the DOM');
        // Try to get the container again
        auctionItemsContainer = document.getElementById('auction-items');
        if (!auctionItemsContainer) {
            console.error('Still cannot find auction items container, aborting render');
            return;
        }
        debugLog('Found auction items container on retry');
    }
    
    // Clear loading spinner and previous content
    debugLog('Clearing auction items container');
    auctionItemsContainer.innerHTML = '';
    
    // Check if items exist and have length
    if (!items || !Array.isArray(items) || items.length === 0) {
        console.warn('No auction items to display');
        auctionItemsContainer.innerHTML = '<div class="no-items">No auction items found</div>';
        return;
    }
    
    debugLog('Found', items.length, 'items to render');
    
    try {
        // Sort items by current bid from highest to lowest
        const sortedItems = [...items].sort((a, b) => {
            // Handle cases where current_bid might be undefined or not a number
            const bidA = typeof a.current_bid === 'number' ? a.current_bid : parseFloat(a.current_bid) || 0;
            const bidB = typeof b.current_bid === 'number' ? b.current_bid : parseFloat(b.current_bid) || 0;
            return bidB - bidA;
        });
        
        console.log('Sorted items:', sortedItems);
        
        // Create and append each item element with its position index
        sortedItems.forEach((item, index) => {
            try {
                const itemElement = createAuctionItemElement(item, index);
                if (itemElement) {
                    auctionItemsContainer.appendChild(itemElement);
                }
            } catch (itemError) {
                console.error(`Error creating auction item element for item ${item.id || index}:`, itemError);
            }
        });
    } catch (error) {
        console.error('Error rendering auction items:', error);
        auctionItemsContainer.innerHTML = '<div class="error">Error displaying auction items</div>';
    }
}

// Create auction item element
function createAuctionItemElement(item, index) {
    try {
        // Validate item object
        if (!item || typeof item !== 'object') {
            console.error('Invalid item object:', item);
            return null;
        }
        
        // Log item data for debugging
        debugLog(`Creating element for item ${index}:`, {
            id: item.id || `missing-id-${index}`,
            title: item.title || 'Missing Title',
            category: item.category || 'No Category',
            current_bid: item.current_bid || 'No Bid',
            high_bidder: item.high_bidder || 'No Bidder'
        });
        
        // Ensure we have at least minimal valid data
        if (!item.id && !item.title && !item.current_bid) {
            console.error('Item missing critical data:', item);
            return null;
        }
        
        const itemElement = document.createElement('div');
        itemElement.className = 'lead-row';
        itemElement.dataset.id = item.id || `temp-${index}`;
        
        // Position number (like the Masters leaderboard)
        const position = document.createElement('div');
        position.className = 'position';
        position.textContent = index + 1;
        
        // Item details column
        const itemInfo = document.createElement('div');
        itemInfo.className = 'item-info';
        
        // Title with proper styling
        const title = document.createElement('p');
        title.className = 'item-title';
        // Use title from database (instead of name which was in the old schema)
        title.textContent = item.title || item.name || 'Unnamed Item';
        itemInfo.appendChild(title);
        
        // Add category as a subtitle
        if (item.category) {
            const category = document.createElement('p');
            category.className = 'item-category';
            category.textContent = item.category;
            itemInfo.appendChild(category);
        }
        
        // Current bid column (red box)
        const bidBox = document.createElement('div');
        bidBox.className = 'current-bid-box';
        
        // Handle case where current_bid might not be a number
        let currentBid = 0;
        if (typeof item.current_bid === 'number') {
            currentBid = item.current_bid;
        } else if (item.current_bid) {
            currentBid = parseFloat(item.current_bid) || 0;
        } else if (typeof item.starting_price === 'number') {
            currentBid = item.starting_price;
        } else if (item.starting_price) {
            currentBid = parseFloat(item.starting_price) || 0;
        }
        
        bidBox.textContent = `€${Math.round(currentBid)}`;
        
        // Table number column (instead of high bidder name)
        const bidderInfo = document.createElement('div');
        bidderInfo.className = 'high-bidder';
        bidderInfo.textContent = item.table_number ? `Table ${item.table_number}` : '-';
        
        // Bid button (green pill)
        const bidButton = document.createElement('button');
        bidButton.className = 'btn-bid';
        bidButton.textContent = 'Bid';
        bidButton.dataset.id = item.id || `temp-${index}`;
        
        // Assemble the item element
        itemElement.appendChild(position);
        itemElement.appendChild(itemInfo);
        itemElement.appendChild(bidBox);
        itemElement.appendChild(bidderInfo);
        itemElement.appendChild(bidButton);
        
        return itemElement;
    } catch (error) {
        console.error(`Error creating auction item element for index ${index}:`, error);
        return null;
    }
}

// Populate category filter
function populateCategoryFilter() {
    // Clear existing options except "All Categories"
    while (categoryFilterEl.options.length > 1) {
        categoryFilterEl.remove(1);
    }
    
    // Add categories
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilterEl.appendChild(option);
    });
}

// Set up event listeners
function setupEventListeners() {
    // Category filter change
    if (categoryFilterEl) {
        categoryFilterEl.addEventListener('change', filterItems);
    }
    
    // Search button click
    if (searchButtonEl) {
        searchButtonEl.addEventListener('click', filterItems);
    }
    
    // Search input enter key
    if (searchInputEl) {
        searchInputEl.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                filterItems();
            }
        });
    }
    
    // Auction control buttons
    const startButton = document.getElementById('start-auction');
    const pauseButton = document.getElementById('pause-auction');

    if (startButton) {
        startButton.addEventListener('click', () => {
            localStorage.setItem('auctionStatus', 'active');
            updateAuctionStatusDisplay();
            console.log('Auction started');
        });
    }

    if (pauseButton) {
        pauseButton.addEventListener('click', () => {
            localStorage.setItem('auctionStatus', 'paused');
            updateAuctionStatusDisplay();
            console.log('Auction paused');
        });
    }
    
    // Bid button click
    auctionItemsContainer.addEventListener('click', (e) => {
        // Check if bid button was clicked
        if (e.target.classList.contains('btn-bid')) {
            const itemId = parseInt(e.target.dataset.id);
            showItemDetails(itemId);
        }
    });
    
    // Close modals
    document.querySelectorAll('.close-modal').forEach(el => {
        el.addEventListener('click', () => {
            itemModal.style.display = 'none';
            // bidConfirmationModal removed - using toast notifications only
            // errorModal removed - using toast notifications only
        });
    });
    
    // Bid confirmation modal removed - using toast notifications only
    
    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === itemModal) {
            itemModal.style.display = 'none';
        }
        // Bid confirmation modal removed - using toast notifications only
    });
}

// Filter items based on category and search
function filterItems() {
    const categoryValue = categoryFilterEl.value;
    const searchValue = searchInputEl.value.toLowerCase().trim();
    
    let filteredItems = [...auctionItems];
    
    // Filter by category
    if (categoryValue !== 'all') {
        filteredItems = filteredItems.filter(item => item.category === categoryValue);
    }
    
    // Filter by search term
    if (searchValue) {
        filteredItems = filteredItems.filter(item => 
            (item.title && item.title.toLowerCase().includes(searchValue)) || 
            (item.description && item.description.toLowerCase().includes(searchValue))
        );
    }
    
    renderAuctionItems(filteredItems);
}

// Show item details in modal
function showItemDetails(itemId) {
    const item = auctionItems.find(item => item.id === itemId);
    
    if (!item) {
        showError('Item not found');
        return;
    }
    
    // Make sure the modal is displayed
    itemModal.style.display = 'flex';
    
    const modalContent = document.getElementById('modal-content');
    const imageUrl = item.image_url || 'images/placeholder.jpg';
    // Use current_bid for minimum bid calculation - €10 above current bid
    const minimumBid = Math.round(parseFloat(item.current_bid) + 10);
    
    modalContent.innerHTML = `
        <div class="item-detail">
            <div class="item-detail-info">
                ${item.category ? `<span class="item-category">${item.category}</span>` : ''}
                <h2 class="item-detail-title">${item.title}</h2>
                <p class="item-detail-description">${item.description || 'No description available'}</p>
                <div class="item-detail-bid-info">
                    <div>
                            <p><strong>Current Bid:</strong> €${Math.round(item.current_bid)}</p>
                    </div>
                    <div>
                            <p><strong>Minimum Bid:</strong> €${minimumBid}</p>
                    </div>
                </div>
                <form class="item-detail-bid-form" id="bid-form">
                    <input type="hidden" id="item-id" value="${item.id}">
                    <input type="text" id="bidder-name" class="bidder-name-input" placeholder="Your Name" required>
                    <input type="number" id="table-number" class="table-number-input" placeholder="Table Number" required min="1">
                    <div class="bid-amount-container">
                        <input type="number" id="bid-amount" class="bid-amount-input" min="${minimumBid}" step="1" value="${minimumBid}" placeholder="Bid Amount" required>
                        <button type="submit" class="place-bid-button">Place Bid</button>
                    </div>
                    <div class="bid-suggestions">
                        <button type="button" class="bid-suggestion" data-amount="${Math.round(parseFloat(item.current_bid) + 10)}">+€10</button>
                        <button type="button" class="bid-suggestion" data-amount="${Math.round(parseFloat(item.current_bid) + 25)}">+€25</button>
                        <button type="button" class="bid-suggestion" data-amount="${Math.round(parseFloat(item.current_bid) + 50)}">+€50</button>
                        <button type="button" class="bid-suggestion" data-amount="${Math.round(parseFloat(item.current_bid) + 100)}">+€100</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    // Set up bid form submission
    const bidForm = document.getElementById('bid-form');
    bidForm.addEventListener('submit', handleBidSubmission);
    
    // Set up bid suggestions
    const suggestions = document.querySelectorAll('.bid-suggestion');
    suggestions.forEach(suggestion => {
        suggestion.addEventListener('click', () => {
            document.getElementById('bid-amount').value = suggestion.dataset.amount;
        });
    });
    
    // Show modal
    itemModal.style.display = 'block';
}

// Handle bid submission
async function handleBidSubmission(e) {
    e.preventDefault();
    
    // Force refresh of auction status from localStorage
    const auctionStatus = localStorage.getItem('auctionStatus');
    console.log('Current auction status in app.js:', auctionStatus);
    
    // Debug - show the raw localStorage value
    console.log('Raw localStorage value:', localStorage.getItem('auctionStatus'));
    
    // If auction is paused or not active, don't allow bids
    if (auctionStatus === 'paused') {
        console.log('Auction is paused, preventing bid');
        showToastNotification('error', 'The auction has been paused');
        return;
    } else if (auctionStatus !== 'active' && auctionStatus !== null) {
        console.log('Auction is not started, preventing bid');
        showToastNotification('error', 'The auction has not started yet');
        return;
    }
    
    console.log('Auction is active, allowing bid');
    
    const itemId = parseInt(document.getElementById('item-id').value);
    const bidderName = document.getElementById('bidder-name').value.trim();
    const tableNumber = parseInt(document.getElementById('table-number').value);
    const bidAmount = parseFloat(document.getElementById('bid-amount').value);
    
    if (!bidderName) {
        showError('Please enter your name');
        return;
    }
    
    if (!tableNumber || isNaN(tableNumber)) {
        showError('Please enter a valid table number');
        return;
    }
    
    if (!bidAmount || isNaN(bidAmount)) {
        showError('Please enter a valid bid amount');
        return;
    }
    
    try {
        const result = await placeBid(itemId, bidAmount, bidderName, tableNumber);
        
        if (result.success) {
            // Close item modal
            itemModal.style.display = 'none';
            
            // Immediately update the item in the leaderboard
            const updatedItem = result.data[0];
            updateItemDisplay(updatedItem);
            
            // Show improved toast notification with bid details
            const topBidAmount = updatedItem.current_bid ? `€${updatedItem.current_bid.toFixed(2)}` : 'No bids yet';
            const topBidder = updatedItem.high_bidder ? `Table ${updatedItem.table_number || tableNumber}` : 'None';
            
            // Create custom styled toast notification
            const toastMessage = `Your bid has been placed. The top bid for this item is ${topBidAmount} from ${topBidder}.`;
            
            // Use custom styling for success toast
            const toast = showToastNotification('success', toastMessage);
            
            // Add extra styling to make it more attractive
            if (toast) {
                toast.style.borderLeft = '4px solid #28a745';
                toast.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                
                // Add a checkmark icon
                const content = toast.querySelector('.toast-content');
                if (content) {
                    const checkIcon = document.createElement('span');
                    checkIcon.innerHTML = '✓ ';
                    checkIcon.style.fontWeight = 'bold';
                    checkIcon.style.marginRight = '5px';
                    content.prepend(checkIcon);
                }
            }
        } else {
            showError(result.message || 'Failed to place bid');
        }
    } catch (error) {
        console.error('Error placing bid:', error);
        showError('An error occurred while placing your bid. Please try again.');
        await logErrorToFile('Bid Error', 'An error occurred while placing your bid.', {
            url: window.location.href,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
        });
    }
}

// Place a bid on an item
async function placeBid(itemId, bidAmount, bidderName, tableNumber) {
    try {
        // Round to whole numbers
        bidAmount = Math.round(bidAmount);
        tableNumber = Math.round(tableNumber);
        
        debugLog('Placing bid:', { itemId, bidAmount, bidderName, tableNumber });
        
        // Find the item
        const item = auctionItems.find(item => item.id === itemId);
        if (!item) {
            await showError('Item not found');
            return { success: false, message: 'Item not found' };
        }
        
        // Validate bid amount
        if (bidAmount <= item.current_bid) {
            await showError(`Your bid must be higher than the current bid of €${item.current_bid.toFixed(2)}`);
            return { success: false, message: `Your bid must be higher than the current bid of €${item.current_bid.toFixed(2)}` };
        }
        
        // Proceed with updating the item in Supabase
        
        debugLog(`Placing bid of €${bidAmount} by ${bidderName} (Table ${tableNumber}) on item ${itemId}`);
        
        // Update the item in Supabase
        const { data, error } = await supabase
            .from('auction_items')
            .update({ 
                current_bid: bidAmount,
                high_bidder: bidderName,
                table_number: tableNumber,
                updated_at: new Date().toISOString()
            })
            .eq('id', itemId)
            .select();
        
        if (error) {
            console.error('Error placing bid:', error);
            await logErrorToFile('Bid Placement Error', error.message || 'Unknown error', {
                itemId,
                bidAmount,
                bidderName,
                tableNumber,
                url: window.location.href,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent
            });
            await showError(`Failed to place bid: ${error.message}`);
            return { success: false, message: error.message };
        }
        
        // Update local data
        const updatedItem = data[0];
        const itemIndex = auctionItems.findIndex(item => item.id === itemId);
        if (itemIndex !== -1) {
            auctionItems[itemIndex] = updatedItem;
        }
        
        // Log the bid to Supabase bid history
        await logBidToHistory(item, bidAmount, bidderName, tableNumber);
        
        renderAuctionItems(auctionItems);
        return { success: true, data }; // Return success with updated data
    } catch (error) {
        console.error('Error in placeBid:', error);
        await logErrorToFile('Bid Placement Exception', error.message || 'Unknown error', {
            itemId,
            bidAmount,
            bidderName,
            tableNumber,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
        });
        await showError('An unexpected error occurred while placing your bid.');
        return { success: false, message: 'An unexpected error occurred while placing your bid.' };
    }
}

// Set up real-time updates
function setupRealTimeUpdates() {
    const channel = supabase
        .channel('auction-updates')
        .on('postgres_changes', 
            { event: 'UPDATE', schema: 'public', table: 'auction_items' }, 
            (payload) => {
                updateItemDisplay(payload.new);
            }
        )
        .subscribe((status) => {
            console.log('Real-time subscription status:', status);
            updateConnectionStatus(status === 'SUBSCRIBED');
        });
}

// Update item display when real-time update received
function updateItemDisplay(updatedItem) {
    // Update the item in our local array
    const itemIndex = auctionItems.findIndex(item => item.id === updatedItem.id);
    if (itemIndex !== -1) {
        auctionItems[itemIndex] = { ...auctionItems[itemIndex], ...updatedItem };
        
        // Re-render all items to maintain sorted order
        renderAuctionItems(auctionItems);
        
        // Add animation to the updated item
        setTimeout(() => {
            const updatedElement = document.querySelector(`.lead-row[data-id="${updatedItem.id}"]`);
            if (updatedElement) {
                const currentBidEl = updatedElement.querySelector('.current-bid-box');
                if (currentBidEl) {
                    currentBidEl.classList.add('bid-updated');
                    
                    // Trigger animation if available
                    if (window.animateBidUpdate) {
                        window.animateBidUpdate(updatedItem.id);
                    }
                }
            }
        }, 100);
    } else {
        // If item doesn't exist in the array, reload all items
        loadAuctionItems();
    }
}

// Update connection status
function updateConnectionStatus(connected, statusText) {
    connectionStatus = connected;
    
    // Just update the global state if the element doesn't exist
    if (!connectionStatusEl) {
        console.warn('Connection status element not found');
        return;
    }
    
    try {
        if (connected) {
            connectionStatusEl.className = 'connected';
            const statusTextEl = connectionStatusEl.querySelector('.status-text');
            if (statusTextEl) {
                statusTextEl.textContent = statusText || 'Connected';
            }
        } else {
            connectionStatusEl.className = 'disconnected';
            const statusTextEl = connectionStatusEl.querySelector('.status-text');
            if (statusTextEl) {
                statusTextEl.textContent = statusText || 'Disconnected';
            }
        }
    } catch (error) {
        console.warn('Error updating connection status UI:', error);
    }
}

// Show error message
async function showError(message) {
    // Only show toast notification, no modal
    showToastNotification('error', 'Hold Your Horses: ' + message);
    
    // Log the error
    console.error('Error:', message);
    
    // Log error to file if available
    try {
        await logErrorToFile('Connection Error', message, {
            url: window.location.href,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
        });
    } catch (e) {
        console.error('Failed to log error:', e);
    }
}

// Show toast notification
function showToastNotification(type, message, onClick = null) {
    // Create toast container if it doesn't exist
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    
    // Create content
    const content = document.createElement('div');
    content.className = 'toast-content';
    content.textContent = message;
    
    // Add click handler if provided
    if (onClick) {
        content.style.cursor = 'pointer';
        content.addEventListener('click', (e) => {
            e.stopPropagation();
            onClick();
        });
    }
    
    // Create close button
    const closeBtn = document.createElement('span');
    closeBtn.className = 'toast-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = function(e) {
        e.stopPropagation();
        toast.remove();
    };
    
    // Assemble toast
    toast.appendChild(content);
    toast.appendChild(closeBtn);
    
    // Add to container
    container.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
    
    return toast;
}

// Update auction status display
function updateAuctionStatusDisplay() {
    const status = localStorage.getItem('auctionStatus');
    const statusDisplay = document.getElementById('status-text');
    
    if (statusDisplay) {
        statusDisplay.textContent = status === 'active' ? 'Active' : 'Paused';
        statusDisplay.className = 'status-text ' + (status === 'active' ? 'status-active' : 'status-paused');
    }
    
    // Update button states
    const startButton = document.getElementById('start-auction');
    const pauseButton = document.getElementById('pause-auction');
    
    if (startButton && pauseButton) {
        if (status === 'active') {
            startButton.classList.add('active-button');
            pauseButton.classList.remove('active-button');
        } else {
            startButton.classList.remove('active-button');
            pauseButton.classList.add('active-button');
        }
    }
}

// Retry connection if disconnected
setInterval(() => {
    if (!connectionStatus) {
        console.log('Attempting to reconnect to database...');
        connectToSupabase().then(connected => {
            if (connected) {
                console.log('Reconnected to database!');
                loadAuctionItems();
            }
        });
    }
}, 30000); // Try every 30 seconds
