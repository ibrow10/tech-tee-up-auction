-- Drop the existing golf_teams table
DROP TABLE IF EXISTS golf_teams;

-- Drop the existing golf_scores table
DROP TABLE IF EXISTS golf_scores;

-- Create a simplified golf_scores table
CREATE TABLE golf_scores (
    id SERIAL PRIMARY KEY,
    team_name TEXT NOT NULL,
    handicap NUMERIC(4,1) NOT NULL,
    gross_score INTEGER,
    net_score NUMERIC(4,1) GENERATED ALWAYS AS (gross_score - handicap) STORED,
    to_par NUMERIC(4,1) GENERATED ALWAYS AS (gross_score - handicap - 69) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add some sample data
INSERT INTO golf_scores (team_name, handicap, gross_score) VALUES
('Eagle Warriors', 10.5, 78),
('Birdie Hunters', 12.0, 82),
('Par Breakers', 3.0, 75),
('Fairway Legends', 8.0, 85),
('Sand Trappers', 15.0, 90),
('Putting Masters', 6.0, 80),
('Rough Riders', 14.0, 88),
('Tee Time Titans', 4.5, 76);

-- Enable Row Level Security
ALTER TABLE golf_scores ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY golf_scores_public_read ON golf_scores
    FOR SELECT
    USING (true);
    
-- Create policy for public update access
CREATE POLICY golf_scores_public_update ON golf_scores
    FOR UPDATE
    USING (true);

-- Create policy for authenticated users to have full access
CREATE POLICY golf_scores_auth_all ON golf_scores
    FOR ALL
    USING (auth.role() = 'authenticated');

-- Create a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_golf_scores_timestamp
BEFORE UPDATE ON golf_scores
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();
