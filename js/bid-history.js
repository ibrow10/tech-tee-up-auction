// Log bid history to Supabase
async function logBidToHistory(item, bidAmount, bidderName, tableNumber) {
    try {
        // Make sure we have access to the supabase client
        if (typeof supabase === 'undefined') {
            console.error('Supabase client is not available');
            return false;
        }
        
        // Create a bid history entry object
        const bidEntry = {
            item_id: item.id,
            item_title: item.title || item.name || 'Unnamed Item',
            previous_bid: Math.round(item.current_bid),
            bid_amount: Math.round(bidAmount),
            bidder_name: bidderName,
            table_number: tableNumber,
            created_at: new Date().toISOString()
        };
        
        console.log('Attempting to save bid history:', bidEntry);
        
        // Insert the bid history entry into Supabase
        const { data, error } = await supabase
            .from('bid_history')
            .insert([bidEntry]);
        
        if (error) {
            console.error('Error saving bid history to Supabase:', error);
            return false;
        }
        
        console.log('Bid logged to history in Supabase:', data);
        return true;
    } catch (error) {
        console.error('Failed to log bid to history:', error);
        return false;
    }
}

// Function to view bid history page
function viewBidHistory() {
    window.open('bid-history.html', '_blank');
}
