-- Function to calculate net_score and to_par fields
CREATE OR REPLACE FUNCTION calculate_golf_scores()
RETURNS TRIGGER AS $$
DECLARE
    course_par INTEGER := 69; -- Set course par to 69
BEGIN
    -- Calculate net_score (gross_score - handicap)
    IF NEW.gross_score IS NOT NULL THEN
        NEW.net_score := NEW.gross_score - NEW.handicap;
        
        -- Calculate to_par (net_score - course_par)
        NEW.to_par := NEW.net_score - course_par;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS calculate_golf_scores_trigger ON golf_scores;

-- Create trigger to run before insert or update
CREATE TRIGGER calculate_golf_scores_trigger
BEFORE INSERT OR UPDATE ON golf_scores
FOR EACH ROW
EXECUTE FUNCTION calculate_golf_scores();

-- Update existing records to ensure calculated fields are populated
UPDATE golf_scores SET gross_score = gross_score WHERE gross_score IS NOT NULL;
