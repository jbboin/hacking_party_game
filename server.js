const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'guests.json');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const PHOTOS_DIR = path.join(__dirname, 'public', 'photos');
const TRIVIA_FILE = path.join(__dirname, 'trivia.csv');

// Load trivia questions from CSV
function loadTrivia() {
  try {
    if (fs.existsSync(TRIVIA_FILE)) {
      const content = fs.readFileSync(TRIVIA_FILE, 'utf8');
      const lines = content.trim().split('\n');
      // Skip header line
      const questions = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        // Parse CSV line (handles quoted fields)
        const match = line.match(/^"([^"]+)",(.+)$/);
        if (match) {
          questions.push({
            question: match[1],
            answer: match[2].trim()
          });
        } else {
          // Simple CSV without quotes
          const parts = line.split(',');
          if (parts.length >= 2) {
            questions.push({
              question: parts[0],
              answer: parts.slice(1).join(',').trim()
            });
          }
        }
      }
      console.log(`Loaded ${questions.length} trivia questions`);
      return questions;
    }
  } catch (err) {
    console.error('Error loading trivia:', err);
  }
  return [];
}

const triviaQuestions = loadTrivia();

// Ensure photos directory exists
if (!fs.existsSync(PHOTOS_DIR)) {
  fs.mkdirSync(PHOTOS_DIR, { recursive: true });
}

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PHOTOS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `photo-${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images allowed'));
    }
  }
});

// Access codes pool - hacker-themed words
const ACCESS_CODES = [
  'CIPHER', 'MATRIX', 'GHOST', 'BINARY', 'VECTOR',
  'NEURAL', 'QUANTUM', 'SHADOW', 'PHOENIX', 'VORTEX',
  'NEXUS', 'OMEGA', 'ENIGMA', 'PULSE', 'CRYPTO',
  'DAEMON', 'KERNEL', 'PROXY', 'FIREWALL', 'BREACH'
];

// Terminal definitions
const TERMINALS = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];

// Photo poses for photo missions
const PHOTO_POSES = [
  'doing a thumbs up',
  'making a silly face',
  'doing a high five',
  'striking a superhero pose',
  'pretending to be robots',
  'doing a fist bump',
  'making peace signs',
  'doing a funny dance move',
  'pretending to hack a computer',
  'making surprised faces'
];

// Mission types
const MISSION_TYPES = ['terminal', 'photo', 'trivia'];

// Cooldown duration (5 minutes in milliseconds)
const MISSION_COOLDOWN_MS = 5 * 60 * 1000;

// Game state
let gameState = {
  started: false,
  missions: {} // { odPlayerId: { targetPlayerId, terminalId, completed, cooldownUntil } }
};

// Get a random access code not already used
function getUniqueAccessCode(existingCodes) {
  const available = ACCESS_CODES.filter(c => !existingCodes.includes(c));
  if (available.length === 0) {
    // If all codes used, generate a random one
    return 'CODE' + Math.random().toString(36).substring(2, 6).toUpperCase();
  }
  return available[Math.floor(Math.random() * available.length)];
}

// Load guests from file or start fresh
function loadGuests() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const guests = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      const existingCodes = guests.map(g => g.accessCode).filter(Boolean);
      // Ensure all guests have score and accessCode
      return guests.map(g => ({
        ...g,
        score: g.score || 0,
        accessCode: g.accessCode || getUniqueAccessCode(existingCodes)
      }));
    }
  } catch (err) {
    console.error('Error loading guests:', err);
  }
  return [];
}

// Save guests to file
function saveGuests() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(guests, null, 2));
}

// Load settings from file
function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }
  return { rate: 1 }; // 1 point = 1%
}

// Save settings to file
function saveSettings() {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

// Calculate team scores from individual players
function getTeamScores() {
  const redScore = guests.filter(g => g.team === 'red').reduce((sum, g) => sum + (g.score || 0), 0);
  const blueScore = guests.filter(g => g.team === 'blue').reduce((sum, g) => sum + (g.score || 0), 0);
  // Percentages are stored separately and accumulate with rate
  const redPercent = guests.filter(g => g.team === 'red').reduce((sum, g) => sum + (g.percent || 0), 0);
  const bluePercent = guests.filter(g => g.team === 'blue').reduce((sum, g) => sum + (g.percent || 0), 0);
  return {
    red: redScore,
    blue: blueScore,
    redPercent: Math.min(100, redPercent),
    bluePercent: Math.min(100, bluePercent),
    rate: settings.rate
  };
}

let guests = loadGuests();
let settings = loadSettings();
console.log(`Loaded ${guests.length} existing guests`);
console.log(`Rate: 1 pt = ${settings.rate}%`);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: Register a new hacker
app.post('/api/register', (req, res) => {
  const { hackerName, team } = req.body;

  if (!hackerName || hackerName.trim() === '') {
    return res.status(400).json({ error: 'Hacker name is required' });
  }

  if (!team || !['red', 'blue'].includes(team)) {
    return res.status(400).json({ error: 'Team selection is required' });
  }

  const trimmedName = hackerName.trim();

  // Check if name already exists
  if (guests.some(g => g.hackerName.toLowerCase() === trimmedName.toLowerCase())) {
    return res.status(409).json({ error: 'This hacker name is already taken!' });
  }

  // Assign unique access code
  const existingCodes = guests.map(g => g.accessCode).filter(Boolean);
  const accessCode = getUniqueAccessCode(existingCodes);

  const guest = {
    id: Date.now(),
    hackerName: trimmedName,
    team,
    score: 0,
    accessCode,
    joinedAt: new Date().toISOString()
  };

  guests.push(guest);
  saveGuests();
  console.log(`New hacker joined: ${trimmedName} (${team} pill)`);

  // If game is running, assign missions
  if (gameState.started) {
    // Assign mission to new player
    assignMission(guest.id);
    // Also assign missions to teammates who were waiting (had no mission)
    const teammates = guests.filter(g => g.team === team && g.id !== guest.id);
    teammates.forEach(t => {
      if (!gameState.missions[t.id]) {
        assignMission(t.id);
      }
    });
  }

  res.json({ success: true, guest });
});

// API: Get all guests (for admin)
app.get('/api/guests', (req, res) => {
  res.json(guests);
});

// API: Delete a guest (for admin)
app.delete('/api/guests/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = guests.findIndex(g => g.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Guest not found' });
  }

  const deleted = guests.splice(index, 1)[0];
  saveGuests();
  console.log(`Deleted hacker: ${deleted.hackerName}`);

  res.json({ success: true });
});

// API: Update a guest's score
app.post('/api/guests/:id/score', (req, res) => {
  const id = parseInt(req.params.id);
  const { points } = req.body;
  const guest = guests.find(g => g.id === id);

  if (!guest) {
    return res.status(404).json({ error: 'Guest not found' });
  }

  const pts = parseInt(points) || 0;
  guest.score = (guest.score || 0) + pts;
  // Add percentage based on current rate
  guest.percent = (guest.percent || 0) + (pts * settings.rate);
  saveGuests();
  console.log(`${guest.hackerName}: ${pts > 0 ? '+' : ''}${pts} pts (${pts * settings.rate}%) -> total: ${guest.score} pts (${guest.percent}%)`);

  res.json({ success: true, guest, scores: getTeamScores() });
});

// API: Get team scores (calculated from players)
app.get('/api/scores', (req, res) => {
  res.json(getTeamScores());
});

// API: Set rate (1 point = X%)
app.post('/api/scores/rate', (req, res) => {
  const { rate } = req.body;
  const newRate = parseFloat(rate);

  if (!newRate || newRate <= 0) {
    return res.status(400).json({ error: 'Rate must be greater than 0' });
  }

  settings.rate = newRate;
  saveSettings();
  console.log(`Rate set to 1 pt = ${newRate}%`);

  res.json({ success: true, scores: getTeamScores() });
});

// API: Reset all scores
app.post('/api/scores/reset', (req, res) => {
  guests.forEach(g => {
    g.score = 0;
    g.percent = 0;
  });
  saveGuests();
  console.log('All scores reset');
  res.json({ success: true, scores: getTeamScores() });
});

// ==================== GAME & MISSIONS ====================

// Assign a mission to a player (withCooldown: add 5min delay before mission is active)
function assignMission(playerId, withCooldown = false) {
  const player = guests.find(g => g.id === playerId);
  if (!player) return null;

  // Randomly choose mission type
  const missionType = MISSION_TYPES[Math.floor(Math.random() * MISSION_TYPES.length)];

  let mission;

  if (missionType === 'trivia') {
    // Trivia mission - doesn't require teammate
    if (triviaQuestions.length === 0) {
      // Fallback to terminal if no trivia questions
      return assignMission(playerId, withCooldown);
    }

    // Get player's answered questions to avoid repeats
    const player = guests.find(g => g.id === playerId);
    const answeredTrivia = player?.answeredTrivia || [];

    // Get available questions (not yet answered by this player)
    const availableIndices = triviaQuestions
      .map((_, idx) => idx)
      .filter(idx => !answeredTrivia.includes(idx));

    // If all questions answered, reset and start over
    if (availableIndices.length === 0) {
      if (player) {
        player.answeredTrivia = [];
        saveGuests();
      }
      availableIndices.push(...triviaQuestions.map((_, idx) => idx));
    }

    const questionIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    const trivia = triviaQuestions[questionIndex];
    mission = {
      type: 'trivia',
      questionIndex: questionIndex,
      question: trivia.question,
      completed: false
    };
  } else {
    // Terminal and Photo missions require teammates
    const teammates = guests.filter(g => g.team === player.team && g.id !== playerId);
    if (teammates.length === 0) {
      // No teammates - try trivia instead if available
      if (triviaQuestions.length > 0) {
        const questionIndex = Math.floor(Math.random() * triviaQuestions.length);
        const trivia = triviaQuestions[questionIndex];
        mission = {
          type: 'trivia',
          questionIndex: questionIndex,
          question: trivia.question,
          completed: false
        };
      } else {
        return null;
      }
    } else {
      // Pick a random teammate
      const target = teammates[Math.floor(Math.random() * teammates.length)];

      if (missionType === 'photo') {
        // Photo mission
        const pose = PHOTO_POSES[Math.floor(Math.random() * PHOTO_POSES.length)];
        mission = {
          type: 'photo',
          targetPlayerId: target.id,
          targetPlayerName: target.hackerName,
          pose: pose,
          completed: false
        };
      } else {
        // Terminal mission
        const terminal = TERMINALS[Math.floor(Math.random() * TERMINALS.length)];
        mission = {
          type: 'terminal',
          targetPlayerId: target.id,
          targetPlayerName: target.hackerName,
          terminalId: terminal,
          completed: false
        };
      }
    }
  }

  // Add cooldown if requested (after earning a point)
  if (withCooldown) {
    mission.cooldownUntil = Date.now() + MISSION_COOLDOWN_MS;
  }

  gameState.missions[playerId] = mission;
  return mission;
}

// API: Get game state
app.get('/api/game', (req, res) => {
  res.json({
    started: gameState.started,
    terminals: TERMINALS
  });
});

// API: Start game (assigns missions to all players)
app.post('/api/game/start', (req, res) => {
  gameState.started = true;
  gameState.missions = {};

  // Assign missions to all players
  guests.forEach(g => {
    assignMission(g.id);
  });

  console.log('Game started! Missions assigned to all players.');
  res.json({ success: true, started: true });
});

// API: Stop game
app.post('/api/game/stop', (req, res) => {
  gameState.started = false;
  console.log('Game stopped.');
  res.json({ success: true, started: false });
});

// API: Get player's mission and access code
app.get('/api/player/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const player = guests.find(g => g.id === id);

  if (!player) {
    return res.status(404).json({ error: 'Player not found' });
  }

  const mission = gameState.missions[id] || null;

  res.json({
    id: player.id,
    hackerName: player.hackerName,
    team: player.team,
    accessCode: player.accessCode,
    score: player.score,
    gameStarted: gameState.started,
    mission: mission
  });
});

// API: Validate terminal password
app.post('/api/terminal/:terminalId/validate', (req, res) => {
  const { terminalId } = req.params;
  const { playerId, code } = req.body;

  if (!TERMINALS.includes(terminalId)) {
    return res.status(400).json({ error: 'Invalid terminal' });
  }

  const player = guests.find(g => g.id === playerId);
  if (!player) {
    return res.status(404).json({ error: 'Player not found' });
  }

  const mission = gameState.missions[playerId];
  if (!mission) {
    return res.json({ success: false, error: 'No active mission' });
  }

  if (mission.completed) {
    return res.json({ success: false, error: 'Mission already completed' });
  }

  // Check if correct terminal
  if (mission.terminalId !== terminalId) {
    console.log(`${player.hackerName} tried wrong terminal (${terminalId}, needed ${mission.terminalId})`);
    return res.json({ success: false, error: 'Wrong terminal! Check your mission.' });
  }

  // Check if correct code
  const targetPlayer = guests.find(g => g.id === mission.targetPlayerId);
  if (!targetPlayer) {
    return res.json({ success: false, error: 'Target player not found' });
  }

  if (code.toUpperCase() !== targetPlayer.accessCode.toUpperCase()) {
    console.log(`${player.hackerName} entered wrong code at Terminal ${terminalId}`);
    return res.json({ success: false, error: 'Invalid access code!' });
  }

  // Success! Award point and assign new mission
  mission.completed = true;
  player.score = (player.score || 0) + 1;
  player.percent = (player.percent || 0) + settings.rate;
  saveGuests();

  console.log(`${player.hackerName} completed mission! +1 point`);

  // Assign new mission with 5-minute cooldown
  const newMission = assignMission(playerId, true);

  res.json({
    success: true,
    message: 'ACCESS GRANTED! Mission complete.',
    newMission: newMission,
    scores: getTeamScores()
  });
});

// API: Upload photo for photo mission
app.post('/api/photo/upload', upload.single('photo'), (req, res) => {
  const playerId = parseInt(req.body.playerId);

  if (!req.file) {
    return res.status(400).json({ error: 'No photo uploaded' });
  }

  const player = guests.find(g => g.id === playerId);
  if (!player) {
    // Delete uploaded file
    fs.unlinkSync(req.file.path);
    return res.status(404).json({ error: 'Player not found' });
  }

  const mission = gameState.missions[playerId];
  if (!mission || mission.type !== 'photo') {
    fs.unlinkSync(req.file.path);
    return res.json({ success: false, error: 'No active photo mission' });
  }

  if (mission.completed || mission.pendingVerification) {
    fs.unlinkSync(req.file.path);
    return res.json({ success: false, error: 'Mission already completed or pending' });
  }

  const targetPlayer = guests.find(g => g.id === mission.targetPlayerId);

  // Save photo metadata with pending status
  const photoId = Date.now();
  const photoData = {
    id: photoId,
    filename: req.file.filename,
    playerId: player.id,
    playerName: player.hackerName,
    targetPlayerId: mission.targetPlayerId,
    targetPlayerName: targetPlayer ? targetPlayer.hackerName : 'Unknown',
    pose: mission.pose,
    team: player.team,
    status: 'pending', // pending, approved, rejected
    uploadedAt: new Date().toISOString()
  };

  // Append to photos.json
  const photosFile = path.join(__dirname, 'photos.json');
  let photos = [];
  try {
    if (fs.existsSync(photosFile)) {
      photos = JSON.parse(fs.readFileSync(photosFile, 'utf8'));
    }
  } catch (err) {
    photos = [];
  }
  photos.push(photoData);
  fs.writeFileSync(photosFile, JSON.stringify(photos, null, 2));

  // Set mission to pending verification (don't complete yet)
  mission.pendingVerification = true;
  mission.pendingPhotoId = photoId;

  console.log(`${player.hackerName} uploaded photo with ${targetPlayer?.hackerName || 'Unknown'} - awaiting verification`);

  res.json({
    success: true,
    message: 'Photo uploaded! Waiting for verification.',
    pendingVerification: true
  });
});

// API: Get pending verification requests for a player
app.get('/api/player/:id/verifications', (req, res) => {
  const id = parseInt(req.params.id);

  const photosFile = path.join(__dirname, 'photos.json');
  let photos = [];
  try {
    if (fs.existsSync(photosFile)) {
      photos = JSON.parse(fs.readFileSync(photosFile, 'utf8'));
    }
  } catch (err) {
    photos = [];
  }

  // Find photos where this player is the target and status is pending
  const pendingVerifications = photos.filter(p => p.targetPlayerId === id && p.status === 'pending');

  res.json(pendingVerifications);
});

// API: Approve or reject a photo
app.post('/api/photo/:photoId/verify', (req, res) => {
  const photoId = parseInt(req.params.photoId);
  const { verifierId, approved } = req.body;

  const photosFile = path.join(__dirname, 'photos.json');
  let photos = [];
  try {
    if (fs.existsSync(photosFile)) {
      photos = JSON.parse(fs.readFileSync(photosFile, 'utf8'));
    }
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load photos' });
  }

  const photoIndex = photos.findIndex(p => p.id === photoId);
  if (photoIndex === -1) {
    return res.status(404).json({ error: 'Photo not found' });
  }

  const photo = photos[photoIndex];

  // Verify the verifier is the target player
  if (photo.targetPlayerId !== verifierId) {
    return res.status(403).json({ error: 'Only the teammate in the photo can verify' });
  }

  if (photo.status !== 'pending') {
    return res.json({ success: false, error: 'Photo already verified' });
  }

  const player = guests.find(g => g.id === photo.playerId);
  const mission = gameState.missions[photo.playerId];

  if (approved) {
    // Approve: award point and complete mission
    photo.status = 'approved';

    if (player) {
      player.score = (player.score || 0) + 1;
      player.percent = (player.percent || 0) + settings.rate;
      saveGuests();
    }

    if (mission) {
      mission.completed = true;
      mission.pendingVerification = false;
      // Assign new mission with 5-minute cooldown
      assignMission(photo.playerId, true);
    }

    console.log(`Photo verified! ${player?.hackerName || 'Unknown'} +1 point`);
  } else {
    // Reject: allow player to try again
    photo.status = 'rejected';

    if (mission) {
      mission.pendingVerification = false;
      mission.pendingPhotoId = null;
    }

    console.log(`Photo rejected for ${player?.hackerName || 'Unknown'}`);
  }

  fs.writeFileSync(photosFile, JSON.stringify(photos, null, 2));

  res.json({
    success: true,
    approved,
    scores: getTeamScores()
  });
});

// API: Submit trivia answer
app.post('/api/trivia/answer', (req, res) => {
  const { playerId, answer } = req.body;

  const player = guests.find(g => g.id === playerId);
  if (!player) {
    return res.status(404).json({ error: 'Player not found' });
  }

  const mission = gameState.missions[playerId];
  if (!mission || mission.type !== 'trivia') {
    return res.json({ success: false, error: 'No active trivia mission' });
  }

  if (mission.completed) {
    return res.json({ success: false, error: 'Mission already completed' });
  }

  // Get the correct answer
  const trivia = triviaQuestions[mission.questionIndex];
  if (!trivia) {
    return res.json({ success: false, error: 'Question not found' });
  }

  // Normalize function: lowercase, strip punctuation, collapse whitespace
  const normalize = (str) => str
    .toLowerCase()
    .replace(/[-]/g, ' ')          // Replace hyphens with spaces
    .replace(/[.,!?'":]/g, '')     // Remove other punctuation
    .replace(/\s+/g, ' ')          // Collapse whitespace
    .trim();

  const normalizedAnswer = normalize(answer);
  const correctAnswers = trivia.answer.split('/').map(a => normalize(a));

  // Minimum 3 characters to prevent "e" matching everything
  if (normalizedAnswer.length < 3) {
    return res.json({ success: false, error: 'Answer too short! Try again.' });
  }

  // Check if answer matches: user's answer must contain the correct answer
  const isCorrect = correctAnswers.some(correct => {
    return normalizedAnswer.includes(correct);
  });

  if (!isCorrect) {
    console.log(`${player.hackerName} wrong trivia answer: "${answer}" (expected: "${trivia.answer}")`);
    return res.json({
      success: false,
      error: 'Wrong answer! Try again.',
      hint: trivia.answer.length <= 10 ? `Hint: ${trivia.answer.length} characters` : null
    });
  }

  // Correct! Award point and assign new mission
  mission.completed = true;
  player.score = (player.score || 0) + 1;
  player.percent = (player.percent || 0) + settings.rate;

  // Track answered question to avoid repeats
  if (!player.answeredTrivia) {
    player.answeredTrivia = [];
  }
  player.answeredTrivia.push(mission.questionIndex);

  saveGuests();

  console.log(`${player.hackerName} answered trivia correctly! +1 point (${player.answeredTrivia.length}/${triviaQuestions.length} questions answered)`);

  // Assign new mission with cooldown
  const newMission = assignMission(playerId, true);

  res.json({
    success: true,
    message: 'Correct! Mission complete.',
    newMission: newMission,
    scores: getTeamScores()
  });
});

// API: Reroll mission for a player (admin function)
app.post('/api/player/:id/reroll', (req, res) => {
  const id = parseInt(req.params.id);
  const player = guests.find(g => g.id === id);

  if (!player) {
    return res.status(404).json({ error: 'Player not found' });
  }

  if (!gameState.started) {
    return res.json({ success: false, error: 'Game not started' });
  }

  // Assign new mission without cooldown (admin override)
  const newMission = assignMission(id, false);

  if (!newMission) {
    return res.json({ success: false, error: 'Could not assign mission (no teammates?)' });
  }

  console.log(`Admin rerolled mission for ${player.hackerName}`);

  res.json({
    success: true,
    mission: newMission
  });
});

// API: Reset gallery (delete all photos)
app.post('/api/photos/reset', (req, res) => {
  const photosFile = path.join(__dirname, 'photos.json');

  // Delete all photo files
  try {
    if (fs.existsSync(photosFile)) {
      const photos = JSON.parse(fs.readFileSync(photosFile, 'utf8'));
      photos.forEach(photo => {
        const filePath = path.join(PHOTOS_DIR, photo.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    }
    // Clear the photos.json file
    fs.writeFileSync(photosFile, JSON.stringify([], null, 2));
    console.log('Gallery reset - all photos deleted');
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to reset gallery:', err);
    res.status(500).json({ error: 'Failed to reset gallery' });
  }
});

// API: Get all photos (for gallery) - only approved ones
app.get('/api/photos', (req, res) => {
  const photosFile = path.join(__dirname, 'photos.json');
  try {
    if (fs.existsSync(photosFile)) {
      const photos = JSON.parse(fs.readFileSync(photosFile, 'utf8'));
      // Only return approved photos
      res.json(photos.filter(p => p.status === 'approved'));
    } else {
      res.json([]);
    }
  } catch (err) {
    res.json([]);
  }
});

// Serve terminal page
app.get('/terminal/:terminalId', (req, res) => {
  const { terminalId } = req.params;
  if (!TERMINALS.includes(terminalId)) {
    return res.status(404).send('Terminal not found');
  }
  res.sendFile(path.join(__dirname, 'public', 'terminal.html'));
});

// Serve admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Serve QR code page
app.get('/qr', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'qr.html'));
});

// Serve scoreboard page
app.get('/scoreboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'scoreboard.html'));
});

// Serve gallery page
app.get('/gallery', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'gallery.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Admin view: http://localhost:${PORT}/admin`);
  console.log(`Scoreboard: http://localhost:${PORT}/scoreboard`);
  console.log(`Photo Gallery: http://localhost:${PORT}/gallery`);
});
