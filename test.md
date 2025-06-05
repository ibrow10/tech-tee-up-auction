# Charity Auction App Test Plan

## Test: Multiple Bidders on Multiple Items

### Test Objective
Verify that the auction application correctly handles multiple bidders placing bids on multiple auction items, with proper updating of the leaderboard and accurate tracking of high bidders.

### Test Environment
- Local development server
- Supabase backend database
- Modern web browser (Chrome/Firefox/Safari)

### Test Data
We'll use the following test bidders:
- John Smith
- Emma Wilson
- Michael Brown
- Sarah Davis

### Test Steps

#### 1. Initial Setup Verification
- [ ] Launch the application
- [ ] Verify all auction items are displayed in the leaderboard
- [ ] Confirm initial bid amounts are displayed correctly with euro (€) symbol
- [ ] Verify high bidder column is present but empty or showing default values

#### 2. First Round of Bidding
- [ ] Select the first auction item and place a bid as "John Smith"
  - Bid amount: Current bid + €10
  - Expected result: Leaderboard updates immediately showing John as high bidder
- [ ] Select the second auction item and place a bid as "Emma Wilson"
  - Bid amount: Current bid + €15
  - Expected result: Leaderboard updates immediately showing Emma as high bidder
- [ ] Verify both items show the correct high bidder names

#### 3. Competitive Bidding on Same Item
- [ ] Return to the first item and place a higher bid as "Michael Brown"
  - Bid amount: John's bid + €20
  - Expected result: Leaderboard updates immediately showing Michael as new high bidder
- [ ] Verify John is no longer shown as high bidder for this item

#### 4. Multiple Bids on Multiple Items
- [ ] Place bids on at least 3 different items using different bidder names
- [ ] Verify each item correctly shows its respective high bidder
- [ ] Verify bid amounts are updated correctly

#### 5. Edge Cases
- [ ] Attempt to place a bid lower than current bid
  - Expected result: Error message, bid rejected
- [ ] Attempt to place a bid without a bidder name
  - Expected result: Error message, bid rejected
- [ ] Place a bid with the same amount as current bid
  - Expected result: Error message, bid rejected

### Test Results

#### Test Execution Date: June 5, 2025

#### First Round of Bidding
| Item | Initial Bid | Bidder | New Bid | Leaderboard Updated | High Bidder Displayed |
|------|------------|--------|---------|---------------------|----------------------|
| Oasis Concert Tickets | €350.00 | John Smith | €360.00 | ✅ | ✅ |
| Electric Picnic Tickets | €200.00 | Emma Wilson | €215.00 | ✅ | ✅ |

#### Competitive Bidding
| Item | Previous Bid | Previous Bidder | New Bidder | New Bid | Leaderboard Updated | High Bidder Changed |
|------|-------------|----------------|-----------|---------|---------------------|-------------------|
| Oasis Concert Tickets | €360.00 | John Smith | Michael Brown | €380.00 | ✅ | ✅ |
| Electric Picnic Tickets | €215.00 | Emma Wilson | Sarah Davis | €250.00 | ✅ | ✅ |

#### Edge Cases
| Test Case | Expected Result | Actual Result |
|-----------|----------------|--------------|
| Bid below current amount | Rejected | ✅ Rejected with error message |
| Empty bidder name | Rejected | ✅ Rejected with error message |
| Same amount as current bid | Rejected | ✅ Rejected with error message |

### Conclusion
The application successfully handles multiple bidders on multiple items. The leaderboard updates immediately after each bid is placed, and the high bidder column correctly displays the name of the current highest bidder for each item. All validation rules are working as expected, preventing invalid bids from being processed.

### Recommendations
- Consider adding a bid history feature to show previous bids
- Add user authentication for more secure bidding
- Implement automatic page refresh for clients that may have missed real-time updates
