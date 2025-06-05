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
        // Initialize Supabase client
        await connectToSupabase();
        
        // Load auction items
        await loadAuctionItems();
        
        // Set up event listeners
        setupEventListeners();
        
        // Set up real-time updates
        setupRealTimeUpdates();
    } catch (error) {
        console.error('Error initializing app:', error);
        updateConnectionStatus(false);
        showError('Failed to initialize the application. Please refresh the page.');
    }
});

// Connect to Supabase
async function connectToSupabase() {
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        updateConnectionStatus(true);
        return true;
    } catch (error) {
        console.error('Error connecting to Supabase:', error);
        updateConnectionStatus(false);
        throw new Error('Failed to connect to database');
    }
}

// Load auction items from Supabase
async function loadAuctionItems() {
    try {
        const { data, error } = await supabase
            .from('auction_items')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (data) {
            auctionItems = data;
            
            // Extract categories
            categories = new Set();
            data.forEach(item => {
                if (item.category) {
                    categories.add(item.category);
                }
            });
            
            // Populate category filter
            populateCategoryFilter();
            
            // Render items
            renderAuctionItems(auctionItems);
        }
    } catch (error) {
        console.error('Error loading auction items:', error);
        showError('Failed to load auction items. Please try again later.');
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
    itemElement.className = 'auction-item';
    itemElement.dataset.id = item.id;
    
    // Position number (like the Masters leaderboard)
    const position = document.createElement('div');
    position.className = 'item-position';
    position.textContent = index + 1;
    
    // Item details column
    const itemDetails = document.createElement('div');
    itemDetails.className = 'item-details';
    
    // Title row with category badge
    const titleRow = document.createElement('div');
    titleRow.className = 'item-title-row';
    
    const title = document.createElement('h3');
    title.className = 'item-title';
    title.textContent = item.title.toUpperCase();
    titleRow.appendChild(title);
    
    itemDetails.appendChild(titleRow);
    
    // Add category as a subtitle
    if (item.category) {
        const category = document.createElement('span');
        category.className = 'item-category';
        category.textContent = item.category;
        itemDetails.appendChild(category);
    }
    
    // Description (shortened for Masters-style)
    const description = document.createElement('p');
    description.className = 'item-description';
    // Truncate description to keep it short like Masters leaderboard
    const shortDesc = item.description ? 
        (item.description.length > 60 ? item.description.substring(0, 60) + '...' : item.description) : 
        'No description available';
    description.textContent = shortDesc;
    itemDetails.appendChild(description);
    
    // Current bid column (red like Masters scoreboard)
    const bidInfo = document.createElement('div');
    bidInfo.className = 'bid-info';
    
    const currentBid = document.createElement('span');
    currentBid.className = 'current-bid';
    currentBid.textContent = `€${item.current_bid.toFixed(2)}`;
    bidInfo.appendChild(currentBid);
    
    // High bidder column (separate from bid info)
    const bidderInfo = document.createElement('div');
    bidderInfo.className = 'bidder-info';
    
    const highBidderName = document.createElement('span');
    highBidderName.className = 'high-bidder-name';
    highBidderName.textContent = item.high_bidder || '-';
    bidderInfo.appendChild(highBidderName);
    
    // Bid button column (smaller for Masters style)
    const bidButton = document.createElement('button');
    bidButton.className = 'bid-button view-details';
    bidButton.textContent = 'BID';
    bidButton.dataset.id = item.id;
    
    // Assemble the item element
    itemElement.appendChild(position);
    itemElement.appendChild(itemDetails);
    itemElement.appendChild(bidInfo);
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
    
    // View item details
    auctionItemsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('view-details')) {
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
                        <button type="button" class="suggestion" data-amount="${(parseFloat(item.current_bid) + 5).toFixed(2)}">+€5</button>
                        <button type="button" class="suggestion" data-amount="${(parseFloat(item.current_bid) + 10).toFixed(2)}">+€10</button>
                        <button type="button" class="suggestion" data-amount="${(parseFloat(item.current_bid) + 25).toFixed(2)}">+€25</button>
                        <button type="button" class="suggestion" data-amount="${(parseFloat(item.current_bid) + 50).toFixed(2)}">+€50</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    // Set up bid form submission
    const bidForm = document.getElementById('bid-form');
    bidForm.addEventListener('submit', handleBidSubmission);
    
    // Set up bid suggestions
    const suggestions = document.querySelectorAll('.suggestion');
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
            const updatedElement = document.querySelector(`.auction-item[data-id="${updatedItem.id}"]`);
            if (updatedElement) {
                const currentBidEl = updatedElement.querySelector('.current-bid');
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
    } else {
        console.error('Error:', message);
    }
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
