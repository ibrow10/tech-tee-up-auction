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
        
        // Check if the bid_history table exists
        const { error: checkError } = await supabase
            .from('bid_history')
            .select('id')
            .limit(1);
        
        if (checkError) {
            console.error('Error checking bid_history table:', checkError);
            console.warn('The bid_history table may not exist or you may not have permission to access it.');
            console.warn('Please run the SQL script in bid_history_table.sql in the Supabase SQL editor.');
            return false;
        }
        
        // Insert the bid history entry into Supabase
        const { data, error } = await supabase
            .from('bid_history')
            .insert([bidEntry]);
        
        if (error) {
            console.error('Error saving bid history to Supabase:', error);
            
            // Check for RLS policy issues
            if (error.message && (error.message.includes('permission denied') || error.message.includes('policy'))) {
                console.warn('This appears to be a Row Level Security (RLS) policy issue.');
                console.warn('Please modify the RLS policy to allow anonymous inserts with:');
                console.warn(`CREATE POLICY "Allow anonymous insert" ON bid_history FOR INSERT TO anon WITH CHECK (true);`);
            }
            
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
