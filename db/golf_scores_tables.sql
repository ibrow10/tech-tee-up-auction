-- Create golf_teams table
CREATE TABLE IF NOT EXISTS public.golf_teams (
    id SERIAL PRIMARY KEY,
    team_name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create golf_scores table
CREATE TABLE IF NOT EXISTS public.golf_scores (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES public.golf_teams(id) ON DELETE CASCADE,
    gross_score INTEGER NOT NULL CHECK (gross_score >= 18),
    handicap NUMERIC(4,1) NOT NULL CHECK (handicap >= 0 AND handicap <= 54),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id)
);

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER set_updated_at_golf_teams
BEFORE UPDATE ON public.golf_teams
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_golf_scores
BEFORE UPDATE ON public.golf_scores
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample teams
INSERT INTO public.golf_teams (team_name)
VALUES 
    ('Eagle Warriors'),
    ('Birdie Hunters'),
    ('Par Breakers'),
    ('Fairway Legends'),
    ('Sand Trappers'),
    ('Putting Masters'),
    ('Rough Riders'),
    ('Tee Time Titans')
ON CONFLICT (team_name) DO NOTHING;

-- Enable row level security (RLS)
ALTER TABLE public.golf_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.golf_scores ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (read-only for teams)
CREATE POLICY "Allow public read access for teams" ON public.golf_teams
    FOR SELECT USING (true);

-- Create policies for authenticated users (full access)
CREATE POLICY "Allow authenticated users full access to teams" ON public.golf_teams
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow public read access for scores" ON public.golf_scores
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users full access to scores" ON public.golf_scores
    FOR ALL USING (auth.role() = 'authenticated');
