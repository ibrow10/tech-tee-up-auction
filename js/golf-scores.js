// Initialize Supabase Client
const DEBUG_MODE = true;

// Global variables
let supabase;
let connectionStatus = false;
let golfScores = [];
const COURSE_PAR = 69; // Par for this specific course

// DOM elements - will be initialized in initElements()
let scoresTableBody;
let connectionStatusEl;
let scoreModal;
let teamSelect;
let scoreForm;
let errorModal;
let errorMessageEl;
let currentYearEl;

// Debug logging helper
function debugLog(...args) {
    if (DEBUG_MODE) {
        console.log(...args);
    }
}

// Initialize DOM elements
function initElements() {
    console.log('Initializing DOM elements...');
    try {
        // Get references to DOM elements
        scoresTableBody = document.getElementById('scores-table-body');
        scoreModal = document.getElementById('score-modal');
        teamSelect = document.getElementById('team-select');
        scoreForm = document.getElementById('score-form');
        errorModal = document.getElementById('error-modal');
        errorMessageEl = document.getElementById('error-message');
        currentYearEl = document.querySelector('.copyright');
        
        // Log which elements were found or not found for debugging
        console.log('DOM Elements initialized:', {
            scoresTableBody: !!scoresTableBody,
            scoreModal: !!scoreModal,
            teamSelect: !!teamSelect,
            scoreForm: !!scoreForm,
            errorModal: !!errorModal,
            errorMessageEl: !!errorMessageEl,
            currentYearEl: !!currentYearEl
        });
        
        // Update current year in footer
        updateCurrentYear();
        
        // Check for critical elements and warn if missing
        if (!scoresTableBody) {
            console.error('Critical element missing: scores-body container not found');
        }
    } catch (error) {
        console.error('Error initializing DOM elements:', error);
    }
}

// Update current year in footer
function updateCurrentYear() {
    if (currentYearEl) {
        const year = new Date().getFullYear();
        currentYearEl.textContent = `© ${year} Tech Tee Up. All rights reserved.`;
    }
}

// Fix header logo and charity logos
function fixHeaderLogo() {
    try {
        console.log('Fixing header logo and charity logos...');
        
        // Fix main logo - ensure it's the orange version
        const headerLogo = document.querySelector('.header-logo');
        if (headerLogo && headerLogo.src.includes('tech-tee-up-white.png')) {
            console.log('Updating header logo to orange version');
            headerLogo.src = 'images/tech-tee-up-orange.png';
        }
        
        // Check if charity logos container exists
        const logoContainer = document.querySelector('.logo-container');
        let charityLogosContainer = document.querySelector('.header-charity-logos');
        
        if (logoContainer && !charityLogosContainer) {
            console.log('Creating charity logos container');
            // Create charity logos container if it doesn't exist
            charityLogosContainer = document.createElement('div');
            charityLogosContainer.className = 'header-charity-logos';
            
            // Create and add charity logos
            const charityLogos = [
                { src: 'images/CHT MASTER LOGO.png', alt: 'Children\'s Heartbeat Trust' },
                { src: 'images/Just Ask logo.png', alt: 'Just Ask' },
                { src: 'images/6585_OLH_Wicklow-Hospice_landscape_RGB_AW_Small.svg', alt: 'Our Lady\'s Hospice' }
            ];
            
            charityLogos.forEach(logo => {
                const img = document.createElement('img');
                img.src = logo.src;
                img.alt = logo.alt;
                img.className = 'header-charity-logo';
                charityLogosContainer.appendChild(img);
            });
            
            logoContainer.appendChild(charityLogosContainer);
        }
        
        // Remove connection status if it exists
        const connectionStatusEl = document.getElementById('connection-status');
        if (connectionStatusEl) {
            console.log('Removing connection status element');
            connectionStatusEl.remove();
        }
        
        // Update navigation links if needed
        const navLinks = document.querySelector('.nav-links');
        if (navLinks) {
            // Check if we need to update the navigation links
            const links = navLinks.querySelectorAll('a');
            let needsUpdate = true;
            
            // Check if we already have the correct links
            if (links.length === 2) {
                const auctionLink = Array.from(links).find(link => link.textContent === 'Auction');
                const raffleLink = Array.from(links).find(link => link.textContent === 'Raffle');
                if (auctionLink && raffleLink) {
                    needsUpdate = false;
                }
            }
            
            if (needsUpdate) {
                console.log('Updating navigation links');
                navLinks.innerHTML = `
                    <a href="index.html" class="nav-link">Auction</a>
                    <a href="raffle-prizes.html" class="nav-link">Raffle</a>
                `;
            }
        }
        
        console.log('Header fixed successfully');
    } catch (error) {
        console.error('Error fixing header:', error);
    }
}

// Check if DOM is ready and wait if needed
function ensureDomReady() {
    return new Promise((resolve) => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                resolve();
            });
        } else {
            resolve();
        }
    });
}

// Initialize the application
async function initApp() {
    try {
        console.log('Initializing Golf Scores App...');
        
        // Initialize DOM elements
        initElements();
        
        // Fix header logo if needed
        fixHeaderLogo();
        
        // Set up event listeners (do this regardless of connection status)
        setupEventListeners();
        
        // Connect to Supabase
        try {
            const connected = await connectToSupabase();
            updateConnectionStatus(connected);
            
            if (connected) {
                // Load golf scores from database
                await loadGolfScores();
                
                // Set up real-time updates
                setupRealTimeUpdates();
            } else {
                // Fall back to demo data if connection fails
                loadDemoData();
            }
        } catch (error) {
            console.error('Database connection error:', error);
            loadDemoData();
        }
    } catch (error) {
        console.error('Error initializing app:', error);
        showError('Failed to initialize the application. Please refresh the page and try again.');
    }
}

// Call initApp when the DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);

// Connect to Supabase
async function connectToSupabase() {
    try {
        debugLog('Connecting to Supabase...');
        
        // Check if SUPABASE_URL and SUPABASE_ANON_KEY are defined in config.js
        if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_ANON_KEY === 'undefined') {
            console.warn('Supabase configuration is missing. Please check config.js file.');
            return false;
        }
        
        // Initialize Supabase client
        try {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('Supabase client created');
        } catch (e) {
            console.error('Error creating Supabase client:', e);
            return false;
        }
        
        // Sign in anonymously to handle RLS policies
        try {
            // Try to sign in with a dummy email to get authenticated session
            // This will work with Supabase's anonymous auth if enabled
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: 'tech-tee-up@example.com',
                password: 'tech-tee-up-password'
            });
            
            if (authError) {
                console.warn('Could not authenticate, trying to continue as anonymous:', authError);
                // Continue anyway, we'll see if we can still read data
            } else {
                console.log('Successfully authenticated with Supabase');
            }
        } catch (authE) {
            console.warn('Auth error, continuing as anonymous:', authE);
            // Continue anyway
        }
        
        // Test connection by making a simple query
        try {
            const { data, error } = await supabase
                .from('golf_scores')
                .select('id')
                .limit(1);
            
            if (error) {
                console.warn('Error querying database:', error);
                return false;
            }
            
            console.log('Successfully queried database, connection working');
        } catch (e) {
            console.error('Error testing database connection:', e);
            return false;
        }
        
        debugLog('Successfully connected to Supabase!');
        updateConnectionStatus(true);
        return true;
    } catch (error) {
        console.error('Error connecting to Supabase:', error);
        updateConnectionStatus(false);
        return false;
    }
}

// Load golf scores from database
async function loadGolfScores() {
    try {
        console.log('Loading golf scores from database...');
        debugLog('Loading golf scores from database...');
        
        if (!supabase) {
            throw new Error('Database connection not established');
        }
        
        const { data, error } = await supabase
            .from('golf_scores')
            .select('*');

        if (error) {
            throw error;
        }

        console.log('Golf scores data received:', data);
        
        if (data && data.length > 0) {
            console.log(`Loaded ${data.length} golf scores`);
            debugLog(`Loaded ${data.length} golf scores`);
            
            // Log all team names from the database for debugging
            console.log('Team names in database (EXACT VALUES):', data.map(score => score.team_name));
            
            // Process the scores
            golfScores = data.map(score => {
                return {
                    id: score.id,
                    teamName: score.team_name,
                    team_name: score.team_name, // Keep the original team_name for reference
                    grossScore: score.gross_score,
                    handicap: score.handicap,
                    netScore: score.net_score,
                    toPar: score.to_par
                };
            });
            
            console.log('Processed golf scores:', golfScores);
            
            renderGolfScores();
            populateTeamSelect();
        } else {
            console.log('No golf scores found in database');
            debugLog('No golf scores found in database');
            golfScores = [];
            renderGolfScores();
        }
    } catch (error) {
        console.error('Error loading golf scores:', error);
        showError('Failed to load golf scores. Please try again later.');
    }
}

// Calculate net score (gross score minus handicap)
function calculateNetScore(grossScore, handicap) {
    return Math.round((grossScore - handicap) * 10) / 10;
}

// Calculate score to par (net score minus course par)
function calculateScoreToPar(grossScore, handicap) {
    const netScore = calculateNetScore(grossScore, handicap);
    return netScore - COURSE_PAR;
}

// Render golf scores in the table
function renderGolfScores() {
    if (!scoresTableBody) return;
    
    // Clear existing rows
    scoresTableBody.innerHTML = '';
    
    if (golfScores.length === 0) {
        // Show no scores message
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6">No scores available yet.</td>';
        scoresTableBody.appendChild(row);
        return;
    }
    
    // Filter out scores without net scores
    const validScores = golfScores.filter(score => score.netScore !== null && score.netScore !== undefined);
    
    // Sort scores by net score (ascending)
    const sortedScores = [...validScores].sort((a, b) => {
        // Primary sort by net score
        if (a.netScore !== b.netScore) {
            return a.netScore - b.netScore;
        }
        // Secondary sort by team name if net scores are equal
        return a.teamName.localeCompare(b.teamName);
    });
    
    // Add any scores without net scores at the end
    const incompleteScores = golfScores.filter(score => score.netScore === null || score.netScore === undefined);
    const allSortedScores = [...sortedScores, ...incompleteScores];
    
    // Render each score row with animation
    allSortedScores.forEach((score, index) => {
        const row = document.createElement('tr');
        
        // Format to par value with + or - sign
        let toParFormatted = score.toPar === 0 ? 'E' : 
                            score.toPar > 0 ? `+${score.toPar}` : 
                            score.toPar.toString();
        
        // Determine row class based on score
        let rowClass = '';
        if (score.toPar < 0) rowClass = 'under-par';
        else if (score.toPar > 0) rowClass = 'over-par';
        else rowClass = 'at-par';
        
        row.className = rowClass;
        
        // Add position number and all score data
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${score.teamName}</td>
            <td>${score.grossScore || 'N/A'}</td>
            <td>${score.handicap}</td>
            <td>${score.netScore ? score.netScore.toFixed(1) : 'N/A'}</td>
            <td>${score.toPar !== null ? toParFormatted : 'N/A'}</td>
        `;
        
        // Add a subtle fade-in effect
        row.style.opacity = '0';
        scoresTableBody.appendChild(row);
        
        // Trigger animation after a small delay based on index
        setTimeout(() => {
            row.style.transition = 'opacity 0.3s ease-in';
            row.style.opacity = '1';
        }, index * 50);
    });
}

// Populate team select dropdown
function populateTeamSelect() {
    if (!teamSelect) return;
    
    // Clear existing options except the default one
    teamSelect.innerHTML = '<option value="">Select a team</option>';
    
    // Get unique team names directly from the original data
    const uniqueTeams = [];
    
    // Use the original team_name values from the database
    golfScores.forEach(score => {
        // Use the original team_name from the database
        const originalTeamName = score.team_name;
        
        if (!uniqueTeams.some(team => team.value === originalTeamName)) {
            uniqueTeams.push({
                display: score.teamName, // For display
                value: originalTeamName  // For form submission - exact value from database
            });
        }
    });
    
    // Sort teams alphabetically by display name
    uniqueTeams.sort((a, b) => a.display.localeCompare(b.display));
    
    // Add team options
    uniqueTeams.forEach(team => {
        const option = document.createElement('option');
        option.value = team.value;     // Use the exact value from the database
        option.textContent = team.display;
        teamSelect.appendChild(option);
    });
    
    console.log('Populated team select with options:', uniqueTeams);
}

// Set up event listeners
function setupEventListeners() {
    // Enter score button
    const enterScoreBtn = document.getElementById('enter-score-btn');
    if (enterScoreBtn) {
        enterScoreBtn.addEventListener('click', () => {
            scoreModal.style.display = 'block';
        });
    }
    
    // Close modal buttons
    const closeButtons = document.querySelectorAll('.close-modal');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            scoreModal.style.display = 'none';
            errorModal.style.display = 'none';
        });
    });
    
    // Error modal close button
    const closeErrorBtn = document.querySelector('.close-error');
    if (closeErrorBtn) {
        closeErrorBtn.addEventListener('click', () => {
            errorModal.style.display = 'none';
        });
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === scoreModal) {
            scoreModal.style.display = 'none';
        }
        if (e.target === errorModal) {
            errorModal.style.display = 'none';
        }
    });
    
    // Score form submission
    if (scoreForm) {
        scoreForm.addEventListener('submit', handleScoreSubmit);
    }
}

// Handle score form submission
async function handleScoreSubmit(e) {
    e.preventDefault();
    
    try {
        const teamName = teamSelect.value;
        const grossScore = parseInt(document.getElementById('gross-score').value);
        
        console.log('Submitting score:', { teamName, grossScore });
        
        if (!teamName) {
            throw new Error('Please select a team');
        }
        
        if (isNaN(grossScore) || grossScore < 18) {
            throw new Error('Please enter a valid gross score (minimum 18)');
        }
        
        // Show loading state
        const submitButton = document.querySelector('#score-form button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        submitButton.textContent = 'Updating...';
        submitButton.disabled = true;
        
        // Check if we have a valid Supabase connection
        if (!supabase) {
            throw new Error('Database connection not established');
        }
        
        // Get all teams from the database to verify what's available
        console.log('Fetching all teams from database to verify...');
        const { data: allTeams, error: fetchError } = await supabase
            .from('golf_scores')
            .select('id, team_name');
            
        if (fetchError) {
            throw new Error(`Error fetching teams: ${fetchError.message}`);
        }
        
        console.log('All teams in database:', allTeams.map(t => t.team_name));
        
        // Find the team in the database
        let dbTeam = allTeams.find(t => t.team_name === teamName);
        
        if (!dbTeam) {
            // Try case-insensitive match as fallback
            const caseInsensitiveMatch = allTeams.find(
                t => t.team_name.toLowerCase() === teamName.toLowerCase()
            );
            
            if (caseInsensitiveMatch) {
                console.log(`Found case-insensitive match for '${teamName}':`, caseInsensitiveMatch);
                dbTeam = caseInsensitiveMatch;
            } else {
                throw new Error(`Team '${teamName}' not found in database. Available teams: ${allTeams.map(t => t.team_name).join(', ')}`);
            }
        }
        
        console.log(`Updating score for team ID ${dbTeam.id} (${dbTeam.team_name})`);
        
        // Update using the team's ID for exact matching
        const { data, error } = await supabase
            .from('golf_scores')
            .update({ gross_score: grossScore })
            .eq('id', dbTeam.id)
            .select();
        
        console.log('Database update response:', { data, error });
        
        if (error) {
            throw error;
        }
        
        if (!data || data.length === 0) {
            throw new Error(`No records updated for team '${dbTeam.team_name}' (ID: ${dbTeam.id}). Please check if this team exists in the database.`);
        }
        
        console.log('Updated record:', data[0]);
        
        // Close modal and reset form
        scoreModal.style.display = 'none';
        scoreForm.reset();
        
        console.log('Score updated successfully, refreshing leaderboard...');
        
        // Refresh the leaderboard with the latest data from the database
        await loadGolfScores();
        
        // Reset button state
        submitButton.textContent = originalButtonText;
        submitButton.disabled = false;
        
        console.log('Leaderboard refreshed with updated scores');
        
        console.log('Score updated successfully');
        debugLog('Score updated successfully');
    } catch (error) {
        console.error('Error updating score:', error);
        showError(error.message || 'Failed to update score. Please try again.');
        
        // Reset button state in case of error
        const submitButton = document.querySelector('#score-form button[type="submit"]');
        if (submitButton) {
            submitButton.textContent = 'Submit Score';
            submitButton.disabled = false;
        }
    }
}

// Submit score to database
async function submitScore(teamId, grossScore, handicap) {
    try {
        // Check if a score already exists for this team
        const { data: existingScores, error: checkError } = await supabase
            .from('golf_scores')
            .select('id')
            .eq('team_id', teamId);
        
        if (checkError) {
            throw checkError;
        }
        
        let result;
        
        if (existingScores && existingScores.length > 0) {
            // Update existing score
            result = await supabase
                .from('golf_scores')
                .update({
                    gross_score: grossScore,
                    handicap: handicap
                })
                .eq('team_id', teamId);
        } else {
            // Insert new score
            result = await supabase
                .from('golf_scores')
                .insert({
                    team_id: teamId,
                    gross_score: grossScore,
                    handicap: handicap
                });
        }
        
        if (result.error) {
            throw result.error;
        }
        
        // No need to reload scores as real-time updates will handle it
        console.log('Score submitted successfully!');
    } catch (error) {
        console.error('Error in submitScore:', error);
        throw new Error('Failed to save score to database. Please try again.');
    }
}

// Set up real-time updates
function setupRealTimeUpdates() {
    supabase
        .channel('golf_scores_changes')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'golf_scores' }, 
            handleScoreChange)
        .subscribe();
}

// Handle real-time score changes
async function handleScoreChange(payload) {
    console.log('Real-time update received:', payload);
    
    // Reload all scores to ensure we have the latest data
    await loadGolfScores();
}

// Update connection status - only tracks status internally now
function updateConnectionStatus(connected, statusText) {
    // Just update the global state variable
    connectionStatus = connected;
    
    // Log connection status for debugging
    if (DEBUG_MODE) {
        if (connected) {
            console.log(`Connection status: ${statusText || 'Connected'}`);
        } else {
            console.warn(`Connection status: ${statusText || 'Disconnected'}`);
        }
    }
}

// Show error message
function showError(message) {
    console.error('Error:', message);
    
    if (errorModal && errorMessageEl) {
        errorMessageEl.textContent = message;
        errorModal.style.display = 'block';
    } else {
        alert(message);
    }
}

// Load demo data if connection fails
function loadDemoData() {
    console.log('Loading demo golf scores data...');
    
    // Show a message to the user that we're in demo mode
    showError('Failed to connect to the database. Using demo data instead.');
    
    // Demo scores with the new structure
    golfScores = [
        {
            id: 1,
            teamName: 'Eagle Warriors',
            grossScore: 78,
            handicap: 10.5,
            netScore: 67.5,
            toPar: -1.5 // Based on par 69
        },
        {
            id: 2,
            teamName: 'Birdie Hunters',
            grossScore: 82,
            handicap: 12,
            netScore: 70,
            toPar: 1 // Based on par 69
        },
        {
            id: 3,
            teamName: 'Par Breakers',
            grossScore: 75,
            handicap: 3,
            netScore: 72,
            toPar: 3 // Based on par 69
        },
        {
            id: 4,
            teamName: 'Fairway Legends',
            grossScore: 85,
            handicap: 8,
            netScore: 77,
            toPar: 8 // Based on par 69
        },
        {
            id: 5,
            teamName: 'Sand Trappers',
            grossScore: 90,
            handicap: 15,
            netScore: 75,
            toPar: 6 // Based on par 69
        },
        {
            id: 6,
            teamName: 'Putting Masters',
            grossScore: 80,
            handicap: 6,
            netScore: 74,
            toPar: 5 // Based on par 69
        },
        {
            id: 7,
            teamName: 'Rough Riders',
            grossScore: 88,
            handicap: 14,
            netScore: 74,
            toPar: 5 // Based on par 69
        },
        {
            id: 8,
            teamName: 'Tee Time Titans',
            grossScore: 76,
            handicap: 4.5,
            netScore: 71.5,
            toPar: 2.5 // Based on par 69
        }
    ];
    
    // Render scores and populate team select
    renderGolfScores();
    populateTeamSelect();
    
    // Update connection status to show we're in demo mode
    updateConnectionStatus(false, 'Demo Mode');
}

// Retry connection if disconnected
setInterval(() => {
    if (!connectionStatus) {
        console.log('Attempting to reconnect to database...');
        connectToSupabase().then(connected => {
            if (connected) {
                console.log('Reconnected to database!');
                Promise.all([loadGolfScores(), loadTeams()]);
            }
        });
    }
}, 30000); // Try every 30 seconds
