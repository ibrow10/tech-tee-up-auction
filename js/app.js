// Initialize Supabase Client
let supabase;
let auctionItems = [];
let connectionStatus = true;
let categories = new Set();

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

// Connect to Supabase
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
        
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client created successfully');
        
        // Test the connection with a simple query
        console.log('Testing connection with a simple query...');
        const { data, error } = await supabase.from('auction_items').select('count', { count: 'exact', head: true });
        
        if (error) {
            console.error('Supabase connection test failed:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            console.error('Error details:', error.details);
            updateConnectionStatus(false);
            
            // Show specific error for GitHub Pages users
            if (window.location.hostname.includes('github.io')) {
                showError(`GitHub Pages cannot connect to Supabase due to CORS restrictions. Please visit the Supabase dashboard and add ${window.location.origin} to the allowed domains in API settings.`);
            } else {
                showError(`Database connection failed: ${error.message || 'Unknown error'}. Please check your internet connection and try again.`);
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

// Load auction items from Supabase
async function loadAuctionItems() {
    try {
        const { data, error } = await supabase
            .from('auction_items')
            .select('*')
            .order('current_bid', { ascending: false });
        
        if (error) {
            console.error('Error loading auction items:', error);
            showError('Failed to load auction items. Please try again later.');
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

// Show error modal
function showError(message) {
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
            
            // Add a button to load demo data
            const demoButton = document.createElement('button');
            demoButton.textContent = 'Load Demo Data Instead';
            demoButton.className = 'place-bid-button';
            demoButton.style.marginTop = '15px';
            demoButton.onclick = loadDemoData;
            errorMessageEl.appendChild(demoButton);
        }
    } else {
        console.error('Error:', message);
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
