// Log bid history to file
async function logBidToHistory(item, bidAmount, bidderName, tableNumber) {
    try {
        const timestamp = new Date().toISOString();
        const formattedDate = new Date().toLocaleString();
        
        // Format the bid entry
        const bidEntry = `\n## Bid on "${item.title}" - ${formattedDate}\n\n` +
            `* **Item ID:** ${item.id}\n` +
            `* **Previous Bid:** €${Math.round(item.current_bid)}\n` +
            `* **New Bid:** €${Math.round(bidAmount)}\n` +
            `* **Bidder:** ${bidderName}\n` +
            `* **Table:** ${tableNumber}\n`;
        
        // Fetch existing content
        const response = await fetch('bid-history.md');
        let existingContent = '';
        
        if (response.ok) {
            existingContent = await response.text();
        } else {
            console.log('Creating new bid history file');
            existingContent = '# Bid History\n\nThis file contains a history of all bids placed in the auction.\n';
        }
        
        // Append new bid
        const newContent = existingContent + bidEntry;
        
        // Save to file using Blob and download
        const blob = new Blob([newContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bid-history.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('Bid logged to history file');
    } catch (error) {
        console.error('Failed to log bid to history file:', error);
    }
}
