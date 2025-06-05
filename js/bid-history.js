// Log bid history to localStorage
async function logBidToHistory(item, bidAmount, bidderName, tableNumber) {
    try {
        const timestamp = new Date().toISOString();
        const formattedDate = new Date().toLocaleString();
        
        // Create a bid history entry object
        const bidEntry = {
            timestamp: timestamp,
            formattedDate: formattedDate,
            itemId: item.id,
            itemTitle: item.title || item.name || 'Unnamed Item',
            previousBid: Math.round(item.current_bid),
            newBid: Math.round(bidAmount),
            bidderName: bidderName,
            tableNumber: tableNumber
        };
        
        // Get existing bid history from localStorage
        let bidHistory = [];
        const storedHistory = localStorage.getItem('bidHistory');
        
        if (storedHistory) {
            try {
                bidHistory = JSON.parse(storedHistory);
            } catch (e) {
                console.error('Error parsing stored bid history:', e);
                bidHistory = [];
            }
        }
        
        // Add new bid to history
        bidHistory.push(bidEntry);
        
        // Store updated history back to localStorage
        localStorage.setItem('bidHistory', JSON.stringify(bidHistory));
        
        console.log('Bid logged to history in localStorage');
    } catch (error) {
        console.error('Failed to log bid to history:', error);
    }
}

// Function to view bid history (can be called from console)
function viewBidHistory() {
    try {
        const storedHistory = localStorage.getItem('bidHistory');
        
        if (!storedHistory) {
            console.log('No bid history found');
            return [];
        }
        
        const bidHistory = JSON.parse(storedHistory);
        console.table(bidHistory);
        return bidHistory;
    } catch (error) {
        console.error('Error viewing bid history:', error);
        return [];
    }
}

// Function to clear bid history (can be called from console)
function clearBidHistory() {
    localStorage.removeItem('bidHistory');
    console.log('Bid history cleared');
}
