# Tech Tee Up Charity Auction App

A lightweight, real-time charity auction web application using Supabase for backend and GitHub Pages for hosting. This app allows multiple users to bid simultaneously from different devices with instant updates. The application features a Masters Tournament-style leaderboard with euro currency support.

## Features

- Real-time bidding with instant updates across all devices
- Responsive design that works on mobile, tablet, and desktop
- Item categorization and search functionality
- Bid validation and user feedback
- Connection status monitoring and auto-reconnect

## Setup Instructions

### 1. GitHub Pages Deployment

1. The application is deployed on GitHub Pages at: [https://ibrow10.github.io/tech-tee-up-auction/](https://ibrow10.github.io/tech-tee-up-auction/)
2. Any changes pushed to the main branch will automatically deploy to GitHub Pages

### 2. Supabase Setup

1. Create a free Supabase account at [supabase.com](https://supabase.com)
2. Create a new project (choose a region closest to your event location)
3. Go to Settings → API to get your project URL and anon key
4. Create the database table using the SQL below:

```sql
CREATE TABLE auction_items (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  starting_price DECIMAL(10,2) NOT NULL,
  current_bid DECIMAL(10,2),
  high_bidder TEXT,
  image_url TEXT,
  category TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Set current_bid equal to starting_price for new items
CREATE OR REPLACE FUNCTION set_current_bid()
  RETURNS TRIGGER AS
$$
BEGIN
  NEW.current_bid := NEW.starting_price;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_current_bid_trigger
  BEFORE INSERT ON auction_items
  FOR EACH ROW
  EXECUTE FUNCTION set_current_bid();

-- Enable Row Level Security
ALTER TABLE auction_items ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read" ON auction_items FOR SELECT USING (true);

-- Allow public bid updates
CREATE POLICY "Allow bid updates" ON auction_items FOR UPDATE USING (true);
```

### 2. Configuration

1. Open `js/config.js` and update with your Supabase credentials:
```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

### 3. Adding Auction Items

You can add auction items directly in the Supabase dashboard:

1. Go to Table Editor
2. Select the `auction_items` table
3. Click "Insert" and add your auction items

Or you can create an admin interface by implementing the optional admin features outlined in the development plan.

### 4. Deployment

#### Local Testing
Simply open the `index.html` file in your browser, or use a local server:

```bash
# Using Python
python -m http.server

# Using Node.js
npx serve
```

#### GitHub Pages Deployment
1. Create a GitHub repository
2. Push your code to the repository
3. Go to Settings → Pages
4. Select the branch to deploy (usually `main`)
5. Your site will be available at `https://[username].github.io/[repository-name]/`

## Security Considerations

- This app uses Supabase's Row Level Security (RLS) to control data access
- The current configuration allows anyone to view items and place bids
- For more secure implementations, consider adding authentication for bidding

## Advanced Features (Optional)

- Admin interface for managing auction items
- Bid history tracking
- Authentication for bidders
- Auction timer with automatic closing
- Email notifications for outbid users

## Troubleshooting

- If real-time updates aren't working, check your Supabase connection settings
- Ensure your browser supports WebSockets
- Check the browser console for any JavaScript errors
- Verify that your RLS policies are correctly configured

## License

This project is open source and available under the MIT License.
