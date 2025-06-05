// Initialize Supabase Client
let supabase;
let auctionItems = [];
let categories = new Set();
let connectionStatus = false;
let currentFilter = 'all';
let errorLogEntries = [];

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
        
        // Add download link to error modal if it's visible
        if (errorModal && errorModal.style.display === 'block') {
            // Remove any existing download links
            const existingLinks = errorMessageEl.parentNode.querySelectorAll('.error-log-download');
            existingLinks.forEach(link => link.remove());
            
            const downloadLink = document.createElement('a');
            downloadLink.href = downloadUrl;
            downloadLink.download = `error_log_${new Date().getTime()}.md`;
            downloadLink.className = 'btn btn-secondary mt-2 me-2 error-log-download';
            downloadLink.textContent = 'Download Error Log';
            downloadLink.style.display = 'inline-block';
            
            // Add to modal
            const buttonContainer = errorMessageEl.parentNode;
            buttonContainer.appendChild(downloadLink);
            
            // Add view all logs button
            const viewAllLogsButton = document.createElement('button');
            viewAllLogsButton.textContent = 'View All Error Logs';
            viewAllLogsButton.className = 'btn btn-info mt-2 me-2 error-log-download';
            viewAllLogsButton.style.display = 'inline-block';
            viewAllLogsButton.onclick = function() {
                viewAllErrorLogs();
            };
            buttonContainer.appendChild(viewAllLogsButton);
        }
        
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

// DOM Elements
const auctionItemsContainer = document.getElementById('auction-items');
const connectionStatusEl = document.getElementById('connection-status');
const categoryFilterEl = document.getElementById('category-filter');
const searchInputEl = document.getElementById('search-input');
const searchButtonEl = document.getElementById('search-button');
const itemModal = document.getElementById('item-modal');
const bidConfirmationModal = document.getElementById('bid-confirmation-modal');
const errorModal = document.getElementById('error-modal');
const errorMessageEl = document.getElementById('error-message');
const currentYearEl = document.getElementById('current-year');

// Set current year in footer
currentYearEl.textContent = new Date().getFullYear();

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize elements
        initElements();
        
        // Verify Supabase configuration
        console.log('=== SUPABASE CONFIGURATION ===');
        console.log('SUPABASE_URL:', SUPABASE_URL);
        console.log('SUPABASE_ANON_KEY length:', SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.length : 0);
        console.log('window.supabase available:', typeof window.supabase);
        
        // Connect to Supabase
        const connected = await connectToSupabase();
        
        if (connected) {
            // Load auction items
            await loadAuctionItems();
            
            // Set up event listeners
            setupEventListeners();
            
            // Set up real-time updates
            setupRealTimeUpdates();
        } else {
            console.warn('Failed to connect to Supabase, loading demo data instead');
            // Set up event listeners first
            setupEventListeners();
            // Load demo data if connection failed
            loadDemoData();
        }
    } catch (error) {
        console.error('Error initializing app:', error);
        updateConnectionStatus(false);
        showError('Failed to initialize the application. Please refresh the page.');
    }
});

// Connect to Supabase - with proxy fallback for GitHub Pages
async function connectToSupabase() {
    try {
        console.log('Connecting to Supabase with URL:', SUPABASE_URL);
        console.log('Anon key available:', SUPABASE_ANON_KEY ? 'Yes (length: ' + SUPABASE_ANON_KEY.length + ')' : 'No');
        console.log('window.supabase available:', window.supabase ? 'Yes' : 'No');
        
        if (!window.supabase) {
            console.error('Supabase client library not loaded!');
            updateConnectionStatus(false);
            showError('Supabase client library failed to load. Please check your internet connection.');
            return false;
        }
        
        // Create Supabase client
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client created successfully');
        
        // Test the connection with a simple query
        console.log('Testing connection with a simple query...');
        let data, error;
        
        // First try direct connection
        const result = await supabase.from('auction_items').select('count', { count: 'exact', head: true });
        data = result.data;
        error = result.error;
        
        // If direct connection fails with CORS error and we're on GitHub Pages, try a proxy approach
        if (error && window.location.hostname.includes('github.io') && 
            (error.message?.includes('cors') || error.code === 'CORS')) {
            
            console.log('Direct connection failed with CORS error, trying proxy approach...');
            
            // Show a notification that we're trying an alternative connection method
            const notification = document.createElement('div');
            notification.className = 'proxy-notification';
            notification.innerHTML = `
                <div style="position: fixed; top: 20px; right: 20px; background-color: #006747; color: white; padding: 15px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.2); z-index: 1000;">
                    <strong>Notice:</strong> Using alternative connection method...
                    <button onclick="this.parentNode.remove()" style="background: none; border: none; color: white; float: right; cursor: pointer; font-weight: bold;">×</button>
                </div>
            `;
            document.body.appendChild(notification);
            
            // In a real application, you would implement a proxy service here
            // For now, we'll just use demo data instead
            console.log('In a production app, would use a proxy service here');
            // Set a flag to indicate we're using the proxy approach
            window.usingProxyMode = true;
            // Clear the error to indicate "success" so we can load demo data as a fallback
            error = null;
            data = { count: 0 }; // This will trigger the empty data handler which loads demo data
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
            } else if (error.message && error.message.includes('cors')) {
                await showError(`CORS error detected. As of 2025, Supabase handles CORS automatically but has limitations. For GitHub Pages, we recommend deploying to Netlify instead.`);
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
        // If we're on GitHub Pages, we might be using the proxy approach
        // which returns empty data as a signal to use demo data
        if (window.location.hostname.includes('github.io') && window.usingProxyMode) {
            console.log('Using proxy mode, loading demo data');
            loadDemoData();
            return;
        }
        
        const { data, error } = await supabase
            .from('auction_items')
            .select('*')
            .order('current_bid', { ascending: false });
        
        if (error) {
            console.error('Error loading auction items:', error);
            showError('Failed to load auction items. Please try again later.');
            // Load demo data on error
            loadDemoData();
            return;
        }
        
        auctionItems = data;
        
        // If no items were found, load demo data
        if (!auctionItems || auctionItems.length === 0) {
            console.log('No auction items found, loading demo data instead');
            loadDemoData();
            return;
        }
        
        // Extract categories
        categories = new Set();
        auctionItems.forEach(item => {
            if (item.category) {
                categories.add(item.category);
            }
        });
        
        renderAuctionItems(auctionItems);
        populateCategoryFilter();
    } catch (error) {
        console.error('Error in loadAuctionItems:', error);
        showError('An unexpected error occurred while loading auction items.');
        // Load demo data on any error
        loadDemoData();
    }
}

// Render auction items to the DOM
function renderAuctionItems(items) {
    // Clear loading spinner
    auctionItemsContainer.innerHTML = '';
    
    if (items.length === 0) {
        auctionItemsContainer.innerHTML = '<div class="no-items">No auction items found</div>';
        return;
    }
    
    // Sort items by current bid from highest to lowest
    const sortedItems = [...items].sort((a, b) => b.current_bid - a.current_bid);
    
    // Create and append each item element with its position index
    sortedItems.forEach((item, index) => {
        const itemElement = createAuctionItemElement(item, index);
        auctionItemsContainer.appendChild(itemElement);
    });
}

// Create auction item element
function createAuctionItemElement(item, index) {
    const itemElement = document.createElement('div');
    itemElement.className = 'lead-row';
    itemElement.dataset.id = item.id;
    
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
    title.textContent = item.title;
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
    bidBox.textContent = `€${item.current_bid.toFixed(2)}`;
    
    // High bidder column
    const bidderInfo = document.createElement('div');
    bidderInfo.className = 'high-bidder';
    bidderInfo.textContent = item.high_bidder || '-';
    
    // Bid button (green pill)
    const bidButton = document.createElement('button');
    bidButton.className = 'btn-bid';
    bidButton.textContent = 'Bid';
    bidButton.dataset.id = item.id;
    
    // Assemble the item element
    itemElement.appendChild(position);
    itemElement.appendChild(itemInfo);
    itemElement.appendChild(bidBox);
    itemElement.appendChild(bidderInfo);
    itemElement.appendChild(bidButton);
    
    return itemElement;
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
    categoryFilterEl.addEventListener('change', filterItems);
    
    // Search button click
    searchButtonEl.addEventListener('click', filterItems);
    
    // Search input enter key
    searchInputEl.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            filterItems();
        }
    });
    
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
            bidConfirmationModal.style.display = 'none';
            errorModal.style.display = 'none';
        });
    });
    
    // Close confirmation modal
    document.querySelector('.close-confirmation').addEventListener('click', () => {
        bidConfirmationModal.style.display = 'none';
    });
    
    // Close error modal
    document.querySelector('.close-error').addEventListener('click', () => {
        errorModal.style.display = 'none';
    });
    
    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === itemModal) {
            itemModal.style.display = 'none';
        }
        if (e.target === bidConfirmationModal) {
            bidConfirmationModal.style.display = 'none';
        }
        if (e.target === errorModal) {
            errorModal.style.display = 'none';
        }
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
            item.title.toLowerCase().includes(searchValue) || 
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
    const minimumBid = (parseFloat(item.current_bid) + 5).toFixed(2);
    
    modalContent.innerHTML = `
        <div class="item-detail">
            <div class="item-detail-info">
                ${item.category ? `<span class="item-category">${item.category}</span>` : ''}
                <h2 class="item-detail-title">${item.title}</h2>
                <p class="item-detail-description">${item.description || 'No description available'}</p>
                <div class="item-detail-bid-info">
                    <div>
                        <p><strong>Current Bid:</strong> €${item.current_bid.toFixed(2)}</p>
                        ${item.high_bidder ? `<p><strong>High Bidder:</strong> ${item.high_bidder}</p>` : ''}
                    </div>
                    <div>
                        <p><strong>Minimum Bid:</strong> €${minimumBid}</p>
                    </div>
                </div>
                <form class="item-detail-bid-form" id="bid-form">
                    <input type="hidden" id="item-id" value="${item.id}">
                    <input type="text" id="bidder-name" class="bidder-name-input" placeholder="Your Name" required>
                    <div class="bid-amount-container">
                        <input type="number" id="bid-amount" class="bid-amount-input" min="${minimumBid}" step="0.01" value="${minimumBid}" placeholder="Bid Amount" required>
                        <button type="submit" class="place-bid-button">Place Bid</button>
                    </div>
                    <div class="bid-suggestions">
                        <button type="button" class="bid-suggestion" data-amount="${(parseFloat(item.current_bid) + 5).toFixed(2)}">+€5</button>
                        <button type="button" class="bid-suggestion" data-amount="${(parseFloat(item.current_bid) + 10).toFixed(2)}">+€10</button>
                        <button type="button" class="bid-suggestion" data-amount="${(parseFloat(item.current_bid) + 25).toFixed(2)}">+€25</button>
                        <button type="button" class="bid-suggestion" data-amount="${(parseFloat(item.current_bid) + 50).toFixed(2)}">+€50</button>
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
    
    const itemId = parseInt(document.getElementById('item-id').value);
    const bidderName = document.getElementById('bidder-name').value.trim();
    const bidAmount = parseFloat(document.getElementById('bid-amount').value);
    
    if (!bidderName) {
        showError('Please enter your name');
        return;
    }
    
    if (!bidAmount || isNaN(bidAmount)) {
        showError('Please enter a valid bid amount');
        return;
    }
    
    try {
        const result = await placeBid(itemId, bidAmount, bidderName);
        
        if (result.success) {
            // Close item modal
            itemModal.style.display = 'none';
            
            // Immediately update the item in the leaderboard
            const updatedItem = result.data[0];
            updateItemDisplay(updatedItem);
            
            // Show confirmation
            bidConfirmationModal.style.display = 'block';
            
            // Close confirmation after 3 seconds
            setTimeout(() => {
                bidConfirmationModal.style.display = 'none';
            }, 3000);
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

// Place bid
async function placeBid(itemId, bidAmount, bidderName) {
    try {
        // Get the latest item data to ensure we have the current bid
        const { data: latestItem, error: fetchError } = await supabase
            .from('auction_items')
            .select('*')
            .eq('id', itemId)
            .single();
        
        if (fetchError) throw fetchError;
        
        // Validate bid amount
        if (bidAmount <= latestItem.current_bid) {
            return {
                success: false,
                message: `Your bid must be higher than the current bid of €${latestItem.current_bid.toFixed(2)}`
            };
        }
        
        // Update the item with the new bid
        const { data, error } = await supabase
            .from('auction_items')
            .update({
                current_bid: bidAmount,
                high_bidder: bidderName,
                updated_at: new Date()
            })
            .eq('id', itemId)
            .select();
        
        if (error) throw error;
        
        return { success: true, data };
    } catch (error) {
        console.error('Error in placeBid:', error);
        await logErrorToFile('Place Bid Error', error.message, {
            url: window.location.href,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
        });
        return { success: false, message: error.message };
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
function updateConnectionStatus(connected) {
    connectionStatus = connected;
    
    if (connected) {
        connectionStatusEl.className = 'connected';
        connectionStatusEl.querySelector('.status-text').textContent = 'Connected';
    } else {
        connectionStatusEl.className = 'disconnected';
        connectionStatusEl.querySelector('.status-text').textContent = 'Disconnected';
    }
}

// Show error message
async function showError(message) {
    if (errorMessageEl && errorModal) {
        errorMessageEl.textContent = message;
        errorModal.style.display = 'block';
        
        // For GitHub Pages, add instructions on how to fix
        if (window.location.hostname.includes('github.io') && message.includes('CORS')) {
            const instructionsEl = document.createElement('div');
            instructionsEl.innerHTML = `
                <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #006747;">
                    <h4 style="margin-top: 0; color: #006747;">How to fix this issue:</h4>
                    <ol>
                        <li>Go to your Supabase dashboard</li>
                        <li>Navigate to Project Settings > API</li>
                        <li>Under "API Settings", find "Additional allowed origins"</li>
                        <li>Add <code>${window.location.origin}</code> to the list</li>
                        <li>Click Save and refresh this page</li>
                    </ol>
                    <p><strong>Note:</strong> If you don't have access to the Supabase dashboard, please contact the administrator.</p>
                </div>
            `;
            errorMessageEl.appendChild(instructionsEl);
        }
        if (message.includes('CORS')) {
            // Add more detailed instructions for CORS issues
            const instructionsEl = document.createElement('div');
            instructionsEl.innerHTML = `
                <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
                    <h5>How to Fix CORS Issues:</h5>
                    <ol>
                        <li>For GitHub Pages: Consider using a proxy service</li>
                        <li>For local testing: Ensure you're using HTTPS if required</li>
                        <li>For custom domains: Set up a reverse proxy or CDN edge middleware</li>
                    </ol>
                </div>
            `;
            errorMessageEl.appendChild(instructionsEl);
        }
        
        // Add button to load demo data
        const loadDemoButton = document.createElement('button');
        loadDemoButton.textContent = 'Load Demo Data Instead';
        loadDemoButton.className = 'btn btn-primary mt-3';
        loadDemoButton.style.display = 'inline-block';
        loadDemoButton.onclick = function() {
            errorModal.style.display = 'none';
            loadDemoData();
        };
        
        // Clear any existing buttons except error log buttons
        const existingButtons = errorMessageEl.parentNode.querySelectorAll('button:not(.error-log-download)');
        existingButtons.forEach(button => button.remove());
        
        // Add the button
        errorMessageEl.parentNode.appendChild(loadDemoButton);
    } else {
        console.error('Error:', message);
        // Still log the error even if modal isn't available
        await logErrorToFile('Connection Error', message, {
            url: window.location.href,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
        });
    }
}

// Load demo data when database connection fails (especially for GitHub Pages)
function loadDemoData() {
    // Close the error modal
    if (errorModal) {
        errorModal.style.display = 'none';
    }
    
    // Set connection status to demo mode
    connectionStatus = true;
    if (connectionStatusEl) {
        connectionStatusEl.className = 'demo';
        connectionStatusEl.querySelector('.status-text').textContent = 'Demo Mode';
    }
    
    // Sample auction items
    auctionItems = [
        {
            id: 'demo-1',
            title: '2x Masters Tournament Tickets',
            description: '2x seated tickets for the Masters Tournament, Sunday final round.',
            category: 'EVENTS',
            image_url: 'https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?ixlib=rb-4.0.3',
            current_bid: 450,
            min_bid: 455,
            high_bidder: 'John D.',
            created_at: new Date().toISOString()
        },
        {
            id: 'demo-2',
            title: 'Signed Rory McIlroy Cap',
            description: 'Official tournament cap signed by Rory McIlroy during the 2024 Masters.',
            category: 'MEMORABILIA',
            image_url: 'https://images.unsplash.com/photo-1593111774240-d529f12cf4bb?ixlib=rb-4.0.3',
            current_bid: 180,
            min_bid: 185,
            high_bidder: 'Sarah T.',
            created_at: new Date().toISOString()
        },
        {
            id: 'demo-3',
            title: 'Premium Golf Club Set',
            description: 'Complete set of Callaway Paradym clubs including driver, irons, wedges and putter.',
            category: 'EQUIPMENT',
            image_url: 'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?ixlib=rb-4.0.3',
            current_bid: 1200,
            min_bid: 1225,
            high_bidder: 'Michael B.',
            created_at: new Date().toISOString()
        },
        {
            id: 'demo-4',
            title: 'Golf Lesson with PGA Pro',
            description: '2-hour private lesson with PGA teaching professional at your local course.',
            category: 'EXPERIENCES',
            image_url: 'https://images.unsplash.com/photo-1494260239208-f20ea9c8a7cb?ixlib=rb-4.0.3',
            current_bid: 300,
            min_bid: 310,
            high_bidder: 'Emma L.',
            created_at: new Date().toISOString()
        }
    ];
    
    // Extract categories
    categories = new Set();
    auctionItems.forEach(item => {
        if (item.category) {
            categories.add(item.category);
        }
    });
    
    // Render items
    renderAuctionItems(auctionItems);
    populateCategoryFilter();
    
    // Show demo mode notification
    const notification = document.createElement('div');
    notification.className = 'demo-notification';
    notification.innerHTML = `
        <div style="position: fixed; bottom: 20px; right: 20px; background-color: #006747; color: white; padding: 15px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.2); z-index: 1000;">
            <strong>Demo Mode:</strong> Using sample data. Database connection unavailable.
            <button onclick="this.parentNode.remove()" style="background: none; border: none; color: white; float: right; cursor: pointer; font-weight: bold;">×</button>
        </div>
    `;
    document.body.appendChild(notification);
}

// Retry connection if disconnected
setInterval(() => {
    if (!connectionStatus) {
        console.log('Attempting to reconnect...');
        connectToSupabase()
            .then(success => {
                if (success) {
                    console.log('Reconnected successfully');
                    loadAuctionItems();
                    setupRealTimeUpdates();
                }
            })
            .catch(error => {
                console.error('Reconnection failed:', error);
            });
    }
}, 10000); // Try every 10 seconds
