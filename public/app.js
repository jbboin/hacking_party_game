// Terminal name mapping (cryptic location hints)
const terminalNames = {
  'permafrost': 'PERMAFROST',
  'radiation-pod': 'RADIATION-POD',
  'player-one': 'PLAYER-ONE',
  'junk-sector': 'JUNK-SECTOR',
  'pixel-wall': 'PIXEL-WALL',
  'char-module': 'CHAR-MODULE',
  'evacuation-bay': 'EVACUATION-BAY',
  'centrifuge': 'CENTRIFUGE',
  'rain-chamber': 'RAIN-CHAMBER',
  'airlock': 'AIRLOCK',
  'nutrient-bank': 'NUTRIENT-BANK'
};

// Hacker name suggestions for the uninspired
const hackerNames = [
  'ZeroDay','Ph4ntom','CipherGhost','NullByt3','DarkProxy','Shad0wRoot','ByteStorm',
  'NetWraith','Crypt0Vex','SilentPing','BlackHat9','Gh0stShell','DataReaper','NeonViru5',
  'QuantumFade','RoguePacket','BinaryWraith','Ech0Void','MalwareMax','FirewallBreaker',
  'DeadPix3l','SynapseHack','Tr0jan','CodeNinja','DarkFirewall','StackOverlord','R00tKit',
  'CyberSpectre','HexShadow','NetGl1tch','Anon404','VoidRunner','CrashDaemon','B1tPhantom',
  'LogicBomb','SilkThread','IceBreaker','GhostProtocol','DarkMatt3r','ScriptKiddy',
  'ByteBandit','TerminalFr0st','RedPill','SpoofMaster','W0rmHole','CachePoison',
  'DigitalDrift','OmegaHash','Zer0Cool','AcidBurn'
];

// Track mission state to detect new missions
let lastMissionId = localStorage.getItem('lastMissionId') || null;

// Toggle access code visibility
function toggleAccessCode() {
  const codeEl = document.getElementById('access-code');
  const hintEl = document.querySelector('.tap-hint');

  if (codeEl.classList.contains('hidden-code')) {
    codeEl.classList.remove('hidden-code');
    codeEl.classList.add('revealed');
    hintEl.textContent = '(tap to hide)';
  } else {
    codeEl.classList.add('hidden-code');
    codeEl.classList.remove('revealed');
    hintEl.textContent = '(tap to reveal)';
  }
}

// Reveal mission content
function revealMission() {
  const unreadEl = document.getElementById('mission-unread');
  const revealedEl = document.getElementById('mission-revealed');

  unreadEl.classList.add('hidden');
  revealedEl.classList.remove('hidden');

  // Save revealed state to localStorage
  localStorage.setItem('missionRevealed', 'true');
}

// Upload photo for photo mission
async function uploadPhoto() {
  const fileInput = document.getElementById('photo-input');
  const file = fileInput.files[0];
  const playerId = localStorage.getItem('hackerId');

  if (!file) {
    alert('Please select a photo first');
    return;
  }

  const uploadBtn = document.getElementById('upload-photo-btn');
  uploadBtn.disabled = true;
  uploadBtn.textContent = 'UPLOADING...';

  const formData = new FormData();
  formData.append('photo', file);
  formData.append('playerId', playerId);

  try {
    const response = await fetch('/api/photo/upload', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.success) {
      // Clear the file input
      fileInput.value = '';
      document.getElementById('photo-preview').classList.add('hidden');
      document.getElementById('photo-preview').src = '';
      // Mission will update via polling
    } else {
      alert(data.error || 'Upload failed');
    }
  } catch (err) {
    console.error('Upload failed:', err);
    alert('Failed to upload photo');
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'UPLOAD PHOTO';
  }
}

// Preview selected photo
function previewPhoto(input) {
  const preview = document.getElementById('photo-preview');
  const uploadBtn = document.getElementById('upload-photo-btn');
  const cameraBtn = document.querySelector('.btn-camera');
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      preview.src = e.target.result;
      preview.classList.remove('hidden');
      if (uploadBtn) uploadBtn.classList.remove('hidden');
      if (cameraBtn) cameraBtn.classList.add('hidden');
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// Verify a photo (approve or reject)
async function verifyPhoto(photoId, approved) {
  const playerId = localStorage.getItem('hackerId');
  const btn = document.querySelector(`[data-photo-id="${photoId}"]`);
  if (btn) btn.disabled = true;

  try {
    const response = await fetch(`/api/photo/${photoId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verifierId: parseInt(playerId), approved })
    });

    const data = await response.json();
    if (data.success) {
      // Refresh verifications
      fetchVerifications(playerId);
    } else {
      alert(data.error || 'Verification failed');
    }
  } catch (err) {
    console.error('Verification failed:', err);
    alert('Failed to verify photo');
  }
}

// Fetch pending verification requests
async function fetchVerifications(playerId) {
  try {
    const response = await fetch(`/api/player/${playerId}/verifications`);
    const verifications = await response.json();

    const container = document.getElementById('verifications-container');
    const box = document.getElementById('verifications-box');

    if (verifications.length > 0) {
      box.classList.remove('hidden');
      container.innerHTML = verifications.map(v => `
        <div class="verification-card">
          <img src="/photos/${v.filename}" class="verification-photo" alt="Photo to verify">
          <div class="verification-info">
            <p><span class="teammate-name">${escapeHtml(v.playerName)}</span> wants verification</p>
            <p class="pose-name">"${escapeHtml(v.pose)}"</p>
          </div>
          <div class="verification-buttons">
            <button class="btn-approve" data-photo-id="${v.id}" onclick="verifyPhoto(${v.id}, true)">APPROVE</button>
            <button class="btn-reject" data-photo-id="${v.id}" onclick="verifyPhoto(${v.id}, false)">REJECT</button>
          </div>
        </div>
      `).join('');
    } else {
      box.classList.add('hidden');
      container.innerHTML = '';
    }
  } catch (err) {
    console.error('Failed to fetch verifications:', err);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatWithNewlines(text, isAiMessage = false) {
  let result = escapeHtml(text);

  // Highlight player names in bold with team color (case-insensitive)
  for (const player of bossPlayerInfo) {
    if (player.name) {
      const colorClass = player.team === 'blue' ? 'player-name-blue' : 'player-name-red';
      const escapedName = escapeHtml(player.name);
      // Use word boundary to match whole names only, case-insensitive
      const regex = new RegExp(`\\b${escapeRegex(escapedName)}\\b`, 'gi');
      result = result.replace(regex, `<span class="player-name ${colorClass}">$&</span>`);
    }
  }

  // Highlight access codes in bold green (only in AI messages, only from non-disconnected players)
  if (isAiMessage) {
    // Get access codes from non-disconnected players
    // Note: We include saved players because they may have JUST been saved by this message
    const activeAccessCodes = bossPlayerInfo
      .filter(p => p.accessCode && !p.disconnected)
      .map(p => p.accessCode);

    for (const code of activeAccessCodes) {
      const regex = new RegExp(`\\b${escapeRegex(code)}\\b`, 'gi');
      result = result.replace(regex, `<span class="access-code-highlight">$&</span>`);
    }
  }

  return result.replace(/\n/g, '<br>');
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Submit trivia answer
async function submitTrivia() {
  const answerInput = document.getElementById('trivia-answer');
  const answer = answerInput.value.trim();
  const playerId = localStorage.getItem('hackerId');

  if (!answer) {
    alert('Please enter an answer');
    return;
  }

  const submitBtn = document.getElementById('submit-trivia-btn');
  const errorEl = document.getElementById('trivia-error');
  submitBtn.disabled = true;
  submitBtn.textContent = 'CHECKING...';

  // Show checking message
  if (errorEl) {
    errorEl.textContent = 'Checking answer...';
    errorEl.classList.remove('hidden', 'error');
    errorEl.classList.add('checking');
  }

  try {
    const response = await fetch('/api/trivia/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: parseInt(playerId), answer })
    });

    const data = await response.json();

    if (data.success) {
      answerInput.value = '';
      if (errorEl) {
        errorEl.textContent = 'Correct! +1 point!';
        errorEl.classList.remove('hidden', 'checking', 'error');
        errorEl.classList.add('success');
      }
      // Immediately refresh to show new mission
      fetchPlayerData();
    } else {
      // Show error with optional hint
      let errorMsg = data.error || 'Wrong answer!';
      if (data.hint) {
        errorMsg += ` (${data.hint})`;
      }
      if (errorEl) {
        errorEl.textContent = errorMsg;
        errorEl.classList.remove('hidden', 'checking');
        errorEl.classList.add('error');
      } else {
        alert(errorMsg);
      }
    }
  } catch (err) {
    console.error('Trivia submission failed:', err);
    alert('Failed to submit answer');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'SUBMIT';
  }
}

// Submit hack attempt against enemy team
async function submitHack() {
  const codeInput = document.getElementById('hack-code-input');
  const code = codeInput.value.trim().toUpperCase();
  const playerId = localStorage.getItem('hackerId');
  const messageEl = document.getElementById('hack-message');

  if (!code) {
    messageEl.textContent = 'Enter an access code!';
    messageEl.classList.remove('hidden', 'success');
    messageEl.classList.add('error');
    return;
  }

  const submitBtn = document.getElementById('hack-submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'HACKING...';
  messageEl.classList.add('hidden');

  try {
    const response = await fetch('/api/hack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: parseInt(playerId), code })
    });

    const data = await response.json();

    if (data.success) {
      codeInput.value = '';
      messageEl.textContent = `ACCESS BREACHED! +1 point from ${data.hackedPlayer}`;
      messageEl.classList.remove('hidden', 'error');
      messageEl.classList.add('success');
      // Refresh player data to show new score
      fetchPlayerData(playerId);
    } else {
      messageEl.textContent = data.error || 'Hack failed!';
      messageEl.classList.remove('hidden', 'success');
      messageEl.classList.add('error');
    }
  } catch (err) {
    console.error('Hack failed:', err);
    messageEl.textContent = 'Connection error!';
    messageEl.classList.remove('hidden', 'success');
    messageEl.classList.add('error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'HACK';
  }
}

// Make functions globally available
window.toggleAccessCode = toggleAccessCode;
window.revealMission = revealMission;
window.uploadPhoto = uploadPhoto;
window.previewPhoto = previewPhoto;
window.verifyPhoto = verifyPhoto;
window.submitTrivia = submitTrivia;
window.submitHack = submitHack;

// Check if already registered and verify with server
async function checkExistingSession() {
  const storedHacker = localStorage.getItem('hackerName');
  const storedTeam = localStorage.getItem('team');
  const storedId = localStorage.getItem('hackerId');
  if (!storedHacker) return;

  // Verify this user still exists on server
  try {
    const response = await fetch('/api/guests');
    const guests = await response.json();
    const guest = guests.find(g => g.hackerName.toLowerCase() === storedHacker.toLowerCase());

    if (guest) {
      // Update stored ID and also set odGuestId for terminal pages
      localStorage.setItem('hackerId', guest.id);
      localStorage.setItem('odGuestId', guest.id);
      showWelcomeScreen(storedHacker, guest.team || storedTeam);
      // Start polling for player data
      startPlayerPolling(guest.id);
    } else {
      logout();
    }
  } catch (err) {
    showWelcomeScreen(storedHacker, storedTeam);
  }
}

checkExistingSession();

// Randomize name button
document.getElementById('randomize-btn').addEventListener('click', async () => {
  try {
    // Fetch existing players to avoid duplicates
    const response = await fetch('/api/guests');
    const guests = await response.json();
    const takenNames = guests.map(g => g.hackerName.toLowerCase());

    // Filter out taken names
    const availableNames = hackerNames.filter(name =>
      !takenNames.includes(name.toLowerCase())
    );

    if (availableNames.length === 0) {
      // All names taken, just pick any
      const randomName = hackerNames[Math.floor(Math.random() * hackerNames.length)];
      document.getElementById('hacker-name').value = randomName;
    } else {
      const randomName = availableNames[Math.floor(Math.random() * availableNames.length)];
      document.getElementById('hacker-name').value = randomName;
    }
  } catch (err) {
    // Fallback to any name if fetch fails
    const randomName = hackerNames[Math.floor(Math.random() * hackerNames.length)];
    document.getElementById('hacker-name').value = randomName;
  }
});

// Team selection
document.querySelectorAll('.btn-team').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn-team').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    document.getElementById('selected-team').value = btn.dataset.team;
    document.querySelector('.btn-hack').disabled = false;
  });
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const hackerName = document.getElementById('hacker-name').value.trim();
  const team = document.getElementById('selected-team').value;
  const errorEl = document.getElementById('error-message');
  const submitBtn = document.querySelector('.btn-hack');

  if (!hackerName) {
    errorEl.textContent = '> ERROR: Alias cannot be empty';
    return;
  }

  if (!team) {
    errorEl.textContent = '> ERROR: You must choose a pill';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span>[ CONNECTING... ]</span>';
  errorEl.textContent = '';

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hackerName, team })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    localStorage.setItem('hackerName', hackerName);
    localStorage.setItem('hackerId', data.guest.id);
    localStorage.setItem('odGuestId', data.guest.id); // For terminal pages
    localStorage.setItem('team', team);

    showWelcomeScreen(hackerName, team);

    // Display access code immediately
    if (data.guest.accessCode) {
      document.getElementById('access-code').textContent = data.guest.accessCode;
    }

    // Start polling for player data
    startPlayerPolling(data.guest.id);

  } catch (error) {
    errorEl.textContent = `> ERROR: ${error.message}`;
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>[ INITIALIZE ]</span>';
  }
});

function showWelcomeScreen(hackerName, team) {
  document.getElementById('register-screen').classList.add('hidden');
  document.getElementById('welcome-screen').classList.remove('hidden');

  const displayName = document.getElementById('display-name');
  displayName.textContent = hackerName;
  displayName.className = team === 'red' ? 'team-red-text' : 'team-blue-text';

  const badge = document.getElementById('team-badge');
  if (team === 'red') {
    badge.textContent = 'RED PILL TEAM';
    badge.className = 'team-badge team-red';
  } else {
    badge.textContent = 'BLUE PILL TEAM';
    badge.className = 'team-badge team-blue';
  }
}

function logout() {
  localStorage.removeItem('hackerName');
  localStorage.removeItem('hackerId');
  localStorage.removeItem('odGuestId');
  localStorage.removeItem('team');
  document.getElementById('welcome-screen').classList.add('hidden');
  document.getElementById('register-screen').classList.remove('hidden');
}

window.logout = logout;

// Fetch player data and update UI
async function fetchPlayerData(playerId) {
  try {
    const response = await fetch(`/api/player/${playerId}`);
    if (!response.ok) return;

    const data = await response.json();

    // If boss phase or core phase is active, skip updating mission/hack UI (they handle visibility)
    if (bossPhaseActive || corePhaseActive) {
      // Only update score during boss/core phase
      document.getElementById('player-score').textContent = data.score || 0;
      return;
    }

    // Update access code
    if (data.accessCode) {
      document.getElementById('access-code').textContent = data.accessCode;
    }

    // Update player score
    document.getElementById('player-score').textContent = data.score || 0;

    // Update mission display
    const missionBox = document.getElementById('mission-box');
    const missionContent = document.getElementById('mission-content');
    const waitingBox = document.getElementById('waiting-box');

    const missionUnread = document.getElementById('mission-unread');
    const missionRevealed = document.getElementById('mission-revealed');

    // Check for cooldown
    const hasCooldown = data.mission && data.mission.cooldownUntil && data.mission.cooldownUntil > Date.now();

    if (data.gameStarted && data.mission && !data.mission.completed && hasCooldown) {
      // Mission on cooldown - show countdown (green box)
      missionBox.classList.remove('hidden');
      missionBox.classList.remove('mission-active');
      waitingBox.classList.add('hidden');
      missionUnread.classList.add('hidden');
      missionRevealed.classList.remove('hidden');

      const remainingMs = data.mission.cooldownUntil - Date.now();
      const mins = Math.floor(remainingMs / 60000);
      const secs = Math.floor((remainingMs % 60000) / 1000);
      const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

      missionContent.innerHTML = `
        <p class="cooldown-message">> Mission complete! Take a break...</p>
        <p class="cooldown-timer">> Next mission in: <span class="countdown">${timeStr}</span></p>
      `;
    } else if (data.gameStarted && data.mission && !data.mission.completed) {
      // Show mission (yellow box - active mission)
      missionBox.classList.remove('hidden');
      missionBox.classList.add('mission-active');
      waitingBox.classList.add('hidden');

      // Check if this is a new mission
      const missionType = data.mission.type || 'terminal';
      let currentMissionId;
      if (missionType === 'photo') {
        currentMissionId = `photo-${data.mission.targetPlayerId}-${data.mission.pose}`;
      } else if (missionType === 'trivia') {
        currentMissionId = `trivia-${data.mission.questionIndex}`;
      } else {
        currentMissionId = `terminal-${data.mission.targetPlayerId}-${data.mission.terminalId}`;
      }
      const isNewMission = lastMissionId !== currentMissionId;
      const wasRevealed = localStorage.getItem('missionRevealed') === 'true';

      // Check if content needs to be rendered (new mission OR empty content on page load)
      const needsRender = isNewMission || missionContent.innerHTML.trim() === '';

      if (isNewMission) {
        // Reset to unread state for new mission
        missionUnread.classList.remove('hidden');
        missionRevealed.classList.add('hidden');
        lastMissionId = currentMissionId;
        localStorage.setItem('lastMissionId', currentMissionId);
        localStorage.setItem('missionRevealed', 'false');
      } else if (wasRevealed) {
        // Same mission, already revealed - keep it revealed
        missionUnread.classList.add('hidden');
        missionRevealed.classList.remove('hidden');
      }

      // Render content only when needed (new mission or first page load)
      // Also re-render if pendingVerification state changed
      const isPendingVerification = data.mission.pendingVerification === true;
      const wasPendingVerification = missionContent.innerHTML.includes('Waiting for');

      if (needsRender || (isPendingVerification !== wasPendingVerification)) {
        const teamClass = data.team === 'red' ? 'team-red-text' : 'team-blue-text';
        if (missionType === 'photo') {
          if (isPendingVerification) {
            // Photo uploaded, waiting for verification
            missionContent.innerHTML = `
              <p>> Photo uploaded!</p>
              <p class="pending-verification">> Waiting for <span class="teammate-name ${teamClass}">${data.mission.targetPlayerName}</span> to verify...</p>
              <p style="color: var(--gray); font-size: 0.9rem;">> Ask them to check their phone</p>
            `;
          } else {
            // Photo mission - need to upload
            missionContent.innerHTML = `
              <p>> Take a selfie with <span class="teammate-name ${teamClass}">${data.mission.targetPlayerName}</span></p>
              <p>> Pose: <span class="pose-name">${data.mission.pose}</span></p>
              <div class="photo-upload-section">
                <input type="file" id="photo-input" accept="image/*" capture="environment" onchange="previewPhoto(this)">
                <label for="photo-input" class="btn-camera">OPEN CAMERA</label>
                <img id="photo-preview" class="photo-preview hidden" alt="Preview">
                <button id="upload-photo-btn" class="btn-upload hidden" onclick="uploadPhoto()">SEND PHOTO</button>
              </div>
            `;
          }
        } else if (missionType === 'trivia') {
          // Trivia mission
          missionContent.innerHTML = `
            <p class="trivia-label">> TRIVIA QUESTION:</p>
            <p class="trivia-question">${escapeHtml(data.mission.question)}</p>
            <div class="trivia-answer-section">
              <input type="text" id="trivia-answer" class="trivia-input" placeholder="Type your answer..." autocomplete="off">
              <p id="trivia-error" class="trivia-error hidden"></p>
              <button id="submit-trivia-btn" class="btn-trivia" onclick="submitTrivia()">SUBMIT</button>
              <p class="trivia-hint">Real hackers don't trust megacorps like Google. Ask a fellow hacker instead.</p>
            </div>
          `;
        } else {
          // Terminal mission
          const terminalDisplay = terminalNames[data.mission.terminalId] || data.mission.terminalId.toUpperCase();
          missionContent.innerHTML = `
            <p>> Get the access code from <span class="teammate-name ${teamClass}">${data.mission.targetPlayerName}</span></p>
            <p>> Find the <span class="terminal-name">${terminalDisplay}</span> terminal</p>
            <p>> Scan the QR code and authenticate</p>
          `;
        }
      }
    } else if (data.gameStarted && data.mission && data.mission.completed) {
      // Mission completed, waiting for new one (green box)
      missionBox.classList.remove('hidden');
      missionBox.classList.remove('mission-active');
      waitingBox.classList.add('hidden');
      missionUnread.classList.add('hidden');
      missionRevealed.classList.remove('hidden');
      missionContent.innerHTML = '<p class="mission-completed">Mission complete! New mission loading...</p>';
    } else if (data.gameStarted && !data.mission) {
      // Game started but no mission (no teammates) (green box)
      missionBox.classList.remove('hidden');
      missionBox.classList.remove('mission-active');
      waitingBox.classList.add('hidden');
      missionUnread.classList.add('hidden');
      missionRevealed.classList.remove('hidden');
      missionContent.innerHTML = '<p style="color: #ff9900;">> Waiting for more teammates to join your team...</p>';
    } else if (!data.gameStarted) {
      // Game not started yet
      missionBox.classList.add('hidden');
      waitingBox.classList.remove('hidden');
      // Reset mission state when game stops
      lastMissionId = null;
      localStorage.removeItem('lastMissionId');
      localStorage.removeItem('missionRevealed');
    }

    // Show/hide hack box based on game state and set enemy team color
    const hackBox = document.getElementById('hack-box');
    const hackLabel = document.getElementById('hack-label');
    if (data.gameStarted) {
      hackBox.classList.remove('hidden');
      // Set the enemy team color
      const enemyTeam = data.team === 'red' ? 'blue' : 'red';
      hackBox.classList.remove('hack-red', 'hack-blue');
      hackBox.classList.add(`hack-${enemyTeam}`);
      hackLabel.textContent = `HACK ${enemyTeam.toUpperCase()} TEAM`;
    } else {
      hackBox.classList.add('hidden');
    }

  } catch (err) {
    console.error('Failed to fetch player data:', err);
  }
}

// Start polling for player updates
let pollingActive = false;
let pollTimeoutId = null;
let currentPlayerId = null;

function startPlayerPolling(playerId) {
  currentPlayerId = playerId;
  // Initial fetch
  fetchPlayerData(playerId);
  fetchVerifications(playerId);
  checkBossPhase(playerId);

  // Dynamic polling: 300ms when AI is streaming, 2000ms otherwise
  pollingActive = true;
  function poll() {
    if (!pollingActive) return;
    fetchPlayerData(currentPlayerId);
    // Skip verifications during boss phase
    if (!bossPhaseActive) {
      fetchVerifications(currentPlayerId);
    }
    checkBossPhase(currentPlayerId);
    // Poll at 300ms during streaming (typewriter handles smoothness), slower otherwise
    const delay = bossAiProcessing ? 300 : 2000;
    pollTimeoutId = setTimeout(poll, delay);
  }
  window._poll = poll; // Make poll accessible for immediate triggering
  pollTimeoutId = setTimeout(poll, bossAiProcessing ? 300 : 2000);
}

// Trigger immediate fast polling (cancels pending slow poll)
function triggerFastPolling() {
  bossAiProcessing = true;
  if (pollTimeoutId) {
    clearTimeout(pollTimeoutId);
    pollTimeoutId = null;
  }
  if (window._poll) {
    window._poll();
  }
}

// ================== BOSS PHASE CHAT ==================

let bossPhaseActive = false;
let bossWinningTeam = null;
let bossChatHistory = [];
let bossAiProcessing = false;
let animatedMessageCount = 0; // How many messages have been fully animated
let currentlyAnimatingIndex = -1; // Index of message currently being animated (-1 if none)
let isFirstLoad = true; // Skip animations on page load
let playerTeam = localStorage.getItem('team');
let bossPlayerInfo = []; // Player info for chat highlighting
let bossAccessCodes = []; // Access codes for AI highlighting

// ================== CORE PHASE CHAT ==================

let corePhaseActive = false;
let coreChatHistory = [];
let coreAiProcessing = false;
let coreAnimatedMessageCount = 0;
let coreCurrentlyAnimatingIndex = -1;
let coreIsFirstLoad = true;
let coreTypewriterTargetText = '';
let coreTypewriterDisplayedText = '';
let coreTypewriterAnimationId = null;

// Check boss phase status
async function checkBossPhase(playerId) {
  try {
    const response = await fetch('/api/game');
    const data = await response.json();

    const bossBox = document.getElementById('boss-phase-box');
    const coreBox = document.getElementById('core-phase-box');
    const inputContainer = document.getElementById('boss-input-container');
    const notWinningMsg = document.getElementById('boss-not-winning');
    const disconnectedBox = document.getElementById('disconnected-box');
    const savedBox = document.getElementById('saved-box');

    // Handle core phase (separate from boss phase)
    if (data.corePhase) {
      corePhaseActive = true;
      bossPhaseActive = false;
      playerTeam = localStorage.getItem('team');

      // Check player status - only saved players who aren't disconnected can participate
      let playerCanParticipate = false;
      if (playerId) {
        try {
          const playerResponse = await fetch(`/api/player/${playerId}`);
          const playerData = await playerResponse.json();
          // Player can participate if: saved AND not disconnected
          playerCanParticipate = playerData.saved && !playerData.disconnected;
        } catch (e) {
          console.error('Failed to check player status:', e);
        }
      }

      // Hide boss phase UI
      bossBox.classList.add('hidden');
      savedBox.classList.add('hidden');

      // Hide other elements
      document.getElementById('mission-box')?.classList.add('hidden');
      document.getElementById('hack-box')?.classList.add('hidden');
      document.getElementById('waiting-box')?.classList.add('hidden');
      document.getElementById('verifications-box')?.classList.add('hidden');
      document.getElementById('access-code-box')?.classList.add('hidden');
      document.getElementById('destruction-box')?.classList.add('hidden');

      if (!playerCanParticipate) {
        // Player can't participate (not saved, or disconnected) - show disconnected overlay
        coreBox.classList.add('hidden');
        disconnectedBox.classList.remove('hidden');
      } else {
        // Player is in the core - show core chat UI
        coreBox.classList.remove('hidden');
        disconnectedBox.classList.add('hidden');
        // Update core chat
        updateCoreChat(data);
      }
      return;
    }

    // Hide core phase box if not in core phase
    coreBox?.classList.add('hidden');
    // Clear core chat state if we were in core phase
    if (corePhaseActive) {
      coreChatHistory = [];
      coreAnimatedMessageCount = 0;
      coreCurrentlyAnimatingIndex = -1;
      coreIsFirstLoad = true;
      resetCoreTypewriter();
      lastCoreChatHtml = '';
    }
    corePhaseActive = false;

    if (data.bossPhase) {
      bossPhaseActive = true;
      bossWinningTeam = data.winningTeam;
      playerTeam = localStorage.getItem('team');

      // Check if player is on winning team
      const isWinningTeam = playerTeam === bossWinningTeam;

      // Check player status (disconnected, saved, firewallHP)
      let playerDisconnected = false;
      let playerSaved = false;
      let firewallHP = data.firewallHP;
      if (playerId && isWinningTeam) {
        try {
          const playerResponse = await fetch(`/api/player/${playerId}`);
          const playerData = await playerResponse.json();
          playerDisconnected = playerData.disconnected || false;
          playerSaved = playerData.saved || false;
          firewallHP = playerData.firewallHP;
        } catch (e) {
          console.error('Failed to check player status:', e);
        }
      }

      const destructionBox = document.getElementById('destruction-box');

      // Hide all overlays first
      disconnectedBox.classList.add('hidden');
      savedBox.classList.add('hidden');
      destructionBox.classList.add('hidden');

      if (playerDisconnected) {
        // Player eliminated - show disconnected overlay
        disconnectedBox.classList.remove('hidden');
        bossBox.classList.add('hidden');

        // Hide other elements
        document.getElementById('mission-box')?.classList.add('hidden');
        document.getElementById('hack-box')?.classList.add('hidden');
        document.getElementById('waiting-box')?.classList.add('hidden');
        document.getElementById('verifications-box')?.classList.add('hidden');
        document.getElementById('access-code-box')?.classList.add('hidden');
      } else if (playerSaved) {
        // Player saved - show saved overlay, hide input (waiting for core phase)
        savedBox.classList.remove('hidden');
        bossBox.classList.remove('hidden');
        inputContainer.classList.add('hidden');
        notWinningMsg.classList.add('hidden');

        // Hide other elements during boss phase
        document.getElementById('mission-box')?.classList.add('hidden');
        document.getElementById('hack-box')?.classList.add('hidden');
        document.getElementById('waiting-box')?.classList.add('hidden');
        document.getElementById('verifications-box')?.classList.add('hidden');
      } else if (isWinningTeam) {
        // Winning team (not disconnected, not saved): Show boss phase chat
        bossBox.classList.remove('hidden');
        inputContainer.classList.remove('hidden');
        notWinningMsg.classList.add('hidden');

        // Hide other elements during boss phase
        document.getElementById('mission-box')?.classList.add('hidden');
        document.getElementById('hack-box')?.classList.add('hidden');
        document.getElementById('waiting-box')?.classList.add('hidden');
        document.getElementById('verifications-box')?.classList.add('hidden');
      } else {
        // Losing team: Show disconnected overlay
        disconnectedBox.classList.remove('hidden');
        bossBox.classList.add('hidden');

        // Hide other elements
        document.getElementById('mission-box')?.classList.add('hidden');
        document.getElementById('hack-box')?.classList.add('hidden');
        document.getElementById('waiting-box')?.classList.add('hidden');
        document.getElementById('verifications-box')?.classList.add('hidden');
        document.getElementById('access-code-box')?.classList.add('hidden');
      }

      // Update chat and AI processing state from server
      const serverChat = data.bossChatHistory || [];
      const serverAiProcessing = data.aiProcessing || false;

      // Store player info and access codes for chat highlighting
      bossPlayerInfo = data.playerInfo || [];
      bossAccessCodes = data.accessCodes || [];

      // Filter out system messages with future timestamps (for staggered display)
      const now = Date.now();
      const filteredChat = serverChat.filter(msg => {
        // If message has no timestamp or is not a system message, show it immediately
        if (!msg.timestamp || msg.role !== 'system') return true;
        // Only show system messages whose timestamp has passed
        return msg.timestamp <= now;
      });

      // Update state
      const chatChanged = JSON.stringify(filteredChat) !== JSON.stringify(bossChatHistory);
      bossChatHistory = [...filteredChat];
      bossAiProcessing = serverAiProcessing;

      // On first load, skip animations - show all messages immediately
      if (isFirstLoad) {
        isFirstLoad = false;
        animatedMessageCount = bossChatHistory.length;
        renderBossChat();
        return;
      }

      // Check if we need to start animating a new message
      // Only start if not currently animating something
      if (currentlyAnimatingIndex === -1) {
        // First, include any non-AI messages that should show immediately
        while (animatedMessageCount < bossChatHistory.length &&
               bossChatHistory[animatedMessageCount].role !== 'ai') {
          animatedMessageCount++;
        }

        // Then check if there's an AI message to animate
        if (animatedMessageCount < bossChatHistory.length &&
            bossChatHistory[animatedMessageCount].role === 'ai') {
          currentlyAnimatingIndex = animatedMessageCount;
          // Render first to create the streaming div, THEN start animation
          renderBossChat();
          setTypewriterTarget(bossChatHistory[animatedMessageCount].content);
          return; // Already rendered
        }
      }

      // Re-render if chat changed or AI processing state changed
      if (chatChanged || serverAiProcessing !== bossAiProcessing) {
        renderBossChat();
      }

    } else {
      // Boss phase not active
      if (bossPhaseActive) {
        // Was active, now ended - clear state
        bossChatHistory = [];
        animatedMessageCount = 0;
        currentlyAnimatingIndex = -1;
        resetTypewriter();
      }
      bossPhaseActive = false;
      bossWinningTeam = null;
      bossBox.classList.add('hidden');
      disconnectedBox.classList.add('hidden');
      savedBox.classList.add('hidden');
    }
  } catch (err) {
    console.error('Failed to check boss phase:', err);
  }
}

// Typewriter animation state
let typewriterTargetText = '';     // Full text from server
let typewriterDisplayedText = '';  // Text currently shown (animated)
let typewriterAnimationId = null;  // Animation interval ID
const TYPEWRITER_CHAR_DELAY = 20;  // ms between characters

// Start or continue typewriter animation
function animateTypewriter() {
  if (typewriterAnimationId) return; // Already animating

  function tick() {
    if (typewriterDisplayedText.length < typewriterTargetText.length) {
      // Add next character
      typewriterDisplayedText = typewriterTargetText.slice(0, typewriterDisplayedText.length + 1);
      updateStreamingDisplay();
      typewriterAnimationId = setTimeout(tick, TYPEWRITER_CHAR_DELAY);
    } else {
      // Animation complete
      typewriterAnimationId = null;

      // Mark this message as animated
      if (currentlyAnimatingIndex >= 0) {
        // Include the animated message in the count
        animatedMessageCount = currentlyAnimatingIndex + 1;
        currentlyAnimatingIndex = -1;
        resetTypewriter();

        // Also include any non-AI messages that follow (they show immediately)
        while (animatedMessageCount < bossChatHistory.length &&
               bossChatHistory[animatedMessageCount].role !== 'ai') {
          animatedMessageCount++;
        }

        // Check if there's another AI message to animate
        if (animatedMessageCount < bossChatHistory.length &&
            bossChatHistory[animatedMessageCount].role === 'ai') {
          currentlyAnimatingIndex = animatedMessageCount;
          // Render first to create the streaming div, THEN start animation
          renderBossChat();
          setTypewriterTarget(bossChatHistory[animatedMessageCount].content);
          return; // Already rendered
        }
      }

      // Re-render to show updated state
      renderBossChat();
    }
  }
  tick();
}

// Update just the streaming text display (fast path)
function updateStreamingDisplay() {
  const container = document.getElementById('boss-chat-container');
  const streamingDiv = container.querySelector('.boss-chat-message.streaming .content');
  if (streamingDiv) {
    streamingDiv.innerHTML = formatWithNewlines(typewriterDisplayedText, true) + '<span class="streaming-cursor">_</span>';
    container.scrollTop = container.scrollHeight;
  }
}

// Set new target text for typewriter
function setTypewriterTarget(newText) {
  if (newText === typewriterTargetText) return; // No change

  // If new text is longer and starts with current, just extend
  if (newText.startsWith(typewriterTargetText)) {
    typewriterTargetText = newText;
    animateTypewriter();
  } else {
    // Text changed completely (shouldn't happen often) - reset
    typewriterTargetText = newText;
    typewriterDisplayedText = '';
    animateTypewriter();
  }
}

// Check if typewriter is still catching up (animation ongoing)
function isTypewriterCatchingUp() {
  return typewriterTargetText && typewriterDisplayedText.length < typewriterTargetText.length;
}

// Reset typewriter animation (only call when starting fresh, not when streaming ends)
function resetTypewriter() {
  if (typewriterAnimationId) {
    clearTimeout(typewriterAnimationId);
    typewriterAnimationId = null;
  }
  typewriterTargetText = '';
  typewriterDisplayedText = '';
}

function renderBossChat() {
  const container = document.getElementById('boss-chat-container');
  const catchingUp = isTypewriterCatchingUp();

  // Fast path: only update streaming text content
  const streamingDiv = container.querySelector('.boss-chat-message.streaming .content');
  if (catchingUp && streamingDiv) {
    // Typewriter animation handles updates via updateStreamingDisplay
    return;
  }

  // Show messages up to and including currentlyAnimatingIndex (if animating)
  // or up to animatedMessageCount (if not animating)
  const showUpTo = currentlyAnimatingIndex >= 0 ? currentlyAnimatingIndex : animatedMessageCount;

  let html = '';
  for (let i = 0; i < showUpTo; i++) {
    const msg = bossChatHistory[i];
    // System messages (disconnect notifications) get special styling
    if (msg.role === 'system') {
      html += `
      <div class="boss-chat-message system">
        <div class="system-content">${escapeHtml(msg.content)}</div>
      </div>
    `;
    } else if (msg.role === 'user') {
      // User messages - green, right-aligned
      html += `
      <div class="boss-chat-message user">
        <div class="sender">${escapeHtml(msg.senderName || 'HACKER')}</div>
        <div class="content">${formatWithNewlines(msg.content, false)}</div>
      </div>
    `;
    } else {
      // AI messages
      html += `
      <div class="boss-chat-message ai">
        <div class="sender">Q.W.E.E.N.</div>
        <div class="content">${formatWithNewlines(msg.content, true)}</div>
      </div>
    `;
    }
  }

  // Add animated AI message if currently animating
  if (currentlyAnimatingIndex >= 0) {
    const displayText = typewriterDisplayedText || '';
    html += `
    <div class="boss-chat-message ai streaming new-message">
      <div class="sender">Q.W.E.E.N.</div>
      <div class="content">${formatWithNewlines(displayText, true)}<span class="streaming-cursor">_</span></div>
    </div>
    `;
  } else if (bossAiProcessing) {
    // Show typing indicator while waiting for AI to respond (and not animating)
    html += `<div class="boss-typing-indicator new-message">Q.W.E.E.N. is processing<span>...</span></div>`;
  }

  container.innerHTML = html;
  container.scrollTop = container.scrollHeight;
}

// Track if currently sending a message
let bossSending = false;

// Update send button state
function updateBossSendButton() {
  const sendBtn = document.getElementById('boss-send-btn');
  const input = document.getElementById('boss-message-input');

  if (bossSending) {
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span class="spinner"></span>';
    input.disabled = true;
  } else {
    sendBtn.disabled = false;
    sendBtn.textContent = 'SEND';
    input.disabled = false;
  }
}

// Send message to the Rogue AI
async function sendBossMessage() {
  const input = document.getElementById('boss-message-input');
  const message = input.value.trim();
  const playerId = parseInt(localStorage.getItem('hackerId'));

  if (!message || bossSending) return;

  // Show spinner
  bossSending = true;
  updateBossSendButton();

  try {
    // Check if AI is currently processing
    const gameRes = await fetch('/api/game');
    const gameData = await gameRes.json();

    // If AI is processing, wait for it to finish first
    if (gameData.aiProcessing) {
      await waitForAIToFinish();
    }

    // Now send the message
    const response = await fetch('/api/boss/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, playerId })
    });

    const data = await response.json();

    if (data.success) {
      // Message was accepted - clear input
      input.value = '';
      // Don't update chat directly - let polling handle it so animation logic runs
      // Immediately start fast polling to catch the response
      triggerFastPolling();
    } else {
      // Show error - keep message in input
      console.error('Boss chat error:', data.error);
    }
  } catch (err) {
    console.error('Failed to send boss message:', err);
    // Keep message in input on error
  } finally {
    // Always stop spinner
    bossSending = false;
    updateBossSendButton();
    input.focus();
  }
}

// Wait for AI to finish processing
async function waitForAIToFinish() {
  return new Promise((resolve) => {
    const checkInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/game');
        const data = await res.json();

        if (!data.aiProcessing) {
          clearInterval(checkInterval);
          resolve();
        }
      } catch (err) {
        console.error('Error checking AI status:', err);
        clearInterval(checkInterval);
        resolve();
      }
    }, 300);
  });
}

// Make sendBossMessage available globally
window.sendBossMessage = sendBossMessage;

// Handle Enter key on boss input
document.addEventListener('DOMContentLoaded', () => {
  const bossInput = document.getElementById('boss-message-input');
  if (bossInput) {
    bossInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendBossMessage();
      }
    });
  }

  // Handle Enter key on destruction password input
  const destructionInput = document.getElementById('destruction-password');
  if (destructionInput) {
    destructionInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        submitDestructionPassword();
      }
    });
  }
});

// ================== DESTRUCTION PASSWORD ==================

// Submit destruction password
async function submitDestructionPassword() {
  const input = document.getElementById('destruction-password');
  const password = input.value.trim();
  const messageEl = document.getElementById('destruction-message');
  const submitBtn = document.getElementById('destruction-submit-btn');
  const playerId = parseInt(localStorage.getItem('hackerId'));

  if (!password) {
    messageEl.textContent = 'Enter a password!';
    messageEl.classList.remove('hidden', 'success');
    messageEl.classList.add('error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'DESTROYING...';
  messageEl.classList.add('hidden');

  try {
    const response = await fetch('/api/boss/destroy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, playerId })
    });

    const data = await response.json();

    if (data.success) {
      input.value = '';
      messageEl.textContent = 'AI DESTROYED! You win!';
      messageEl.classList.remove('hidden', 'error');
      messageEl.classList.add('success');
      // The game will end and redirect/show victory screen
    } else {
      messageEl.textContent = data.error || 'Wrong password!';
      messageEl.classList.remove('hidden', 'success');
      messageEl.classList.add('error');
    }
  } catch (err) {
    console.error('Destruction failed:', err);
    messageEl.textContent = 'Connection error!';
    messageEl.classList.remove('hidden', 'success');
    messageEl.classList.add('error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'DESTROY';
  }
}

window.submitDestructionPassword = submitDestructionPassword;

// ================== CORE PHASE CHAT ==================

const CORE_TYPEWRITER_DELAY = 20;

// Update core chat from server data
function updateCoreChat(data) {
  const serverChat = data.coreChatHistory || [];
  coreChatHistory = [...serverChat];
  coreAiProcessing = data.coreAiProcessing || false;

  // On first load, skip animations
  if (coreIsFirstLoad && serverChat.length > 0) {
    coreIsFirstLoad = false;
    coreAnimatedMessageCount = coreChatHistory.length;
    renderCoreChat();
    return;
  }

  // Check if we need to animate a new message
  if (coreCurrentlyAnimatingIndex === -1) {
    // Include non-AI messages immediately
    while (coreAnimatedMessageCount < coreChatHistory.length &&
           coreChatHistory[coreAnimatedMessageCount].role !== 'ai') {
      coreAnimatedMessageCount++;
    }

    // Check for AI message to animate
    if (coreAnimatedMessageCount < coreChatHistory.length &&
        coreChatHistory[coreAnimatedMessageCount].role === 'ai') {
      coreCurrentlyAnimatingIndex = coreAnimatedMessageCount;
      renderCoreChat();
      setCoreTypewriterTarget(coreChatHistory[coreAnimatedMessageCount].content);
      return;
    }
  }

  renderCoreChat();
}

// Core typewriter animation
function animateCoreTypewriter() {
  if (coreTypewriterAnimationId) return;

  function tick() {
    if (coreTypewriterDisplayedText.length < coreTypewriterTargetText.length) {
      coreTypewriterDisplayedText = coreTypewriterTargetText.slice(0, coreTypewriterDisplayedText.length + 1);
      updateCoreStreamingDisplay();
      coreTypewriterAnimationId = setTimeout(tick, CORE_TYPEWRITER_DELAY);
    } else {
      coreTypewriterAnimationId = null;

      if (coreCurrentlyAnimatingIndex >= 0) {
        coreAnimatedMessageCount = coreCurrentlyAnimatingIndex + 1;
        coreCurrentlyAnimatingIndex = -1;
        resetCoreTypewriter();

        // Include following non-AI messages
        while (coreAnimatedMessageCount < coreChatHistory.length &&
               coreChatHistory[coreAnimatedMessageCount].role !== 'ai') {
          coreAnimatedMessageCount++;
        }

        // Check for next AI message
        if (coreAnimatedMessageCount < coreChatHistory.length &&
            coreChatHistory[coreAnimatedMessageCount].role === 'ai') {
          coreCurrentlyAnimatingIndex = coreAnimatedMessageCount;
          renderCoreChat();
          setCoreTypewriterTarget(coreChatHistory[coreAnimatedMessageCount].content);
          return;
        }
      }

      renderCoreChat();
    }
  }
  tick();
}

function updateCoreStreamingDisplay() {
  const container = document.getElementById('core-chat-container');
  const streamingDiv = container?.querySelector('.core-chat-message.streaming .content');
  if (streamingDiv) {
    streamingDiv.innerHTML = escapeHtml(coreTypewriterDisplayedText).replace(/\n/g, '<br>') + '<span class="streaming-cursor">_</span>';
    container.scrollTop = container.scrollHeight;
  }
}

function setCoreTypewriterTarget(newText) {
  if (newText === coreTypewriterTargetText) return;

  if (newText.startsWith(coreTypewriterTargetText)) {
    coreTypewriterTargetText = newText;
    animateCoreTypewriter();
  } else {
    coreTypewriterTargetText = newText;
    coreTypewriterDisplayedText = '';
    animateCoreTypewriter();
  }
}

function isCoreTypewriterCatchingUp() {
  return coreTypewriterTargetText && coreTypewriterDisplayedText.length < coreTypewriterTargetText.length;
}

function resetCoreTypewriter() {
  if (coreTypewriterAnimationId) {
    clearTimeout(coreTypewriterAnimationId);
    coreTypewriterAnimationId = null;
  }
  coreTypewriterTargetText = '';
  coreTypewriterDisplayedText = '';
}

// Track last rendered core chat HTML to avoid unnecessary re-renders
let lastCoreChatHtml = '';

// Render core chat messages
function renderCoreChat() {
  const container = document.getElementById('core-chat-container');
  if (!container) return;

  const catchingUp = isCoreTypewriterCatchingUp();
  const streamingDiv = container.querySelector('.core-chat-message.streaming .content');
  if (catchingUp && streamingDiv) {
    return; // Typewriter handles updates
  }

  const showUpTo = coreCurrentlyAnimatingIndex >= 0 ? coreCurrentlyAnimatingIndex : coreAnimatedMessageCount;

  let html = '';
  for (let i = 0; i < showUpTo; i++) {
    const msg = coreChatHistory[i];
    // Skip GAME_MASTER messages (used internally to prompt AI)
    if (msg.senderName === 'GAME_MASTER' || msg.role === 'gamemaster') {
      continue;
    } else if (msg.role === 'system') {
      html += `
      <div class="core-chat-message system">
        <div class="system-content">${escapeHtml(msg.content)}</div>
      </div>
    `;
    } else if (msg.role === 'user') {
      html += `
      <div class="core-chat-message user">
        <div class="sender">${escapeHtml(msg.senderName || 'HACKER')}</div>
        <div class="content">${escapeHtml(msg.content).replace(/\n/g, '<br>')}</div>
      </div>
    `;
    } else {
      html += `
      <div class="core-chat-message ai">
        <div class="sender">Q.W.E.E.N.</div>
        <div class="content">${escapeHtml(msg.content).replace(/\n/g, '<br>')}</div>
      </div>
    `;
    }
  }

  // Animated AI message
  if (coreCurrentlyAnimatingIndex >= 0) {
    html += `
    <div class="core-chat-message ai streaming">
      <div class="sender">Q.W.E.E.N.</div>
      <div class="content">${escapeHtml(coreTypewriterDisplayedText).replace(/\n/g, '<br>')}<span class="streaming-cursor">_</span></div>
    </div>
    `;
  } else if (coreAiProcessing) {
    html += `<div class="core-typing-indicator">Q.W.E.E.N. is processing<span>...</span></div>`;
  }

  // Only update DOM and scroll if content changed
  if (html !== lastCoreChatHtml) {
    container.innerHTML = html;
    lastCoreChatHtml = html;
    container.scrollTop = container.scrollHeight;
  }
}

// Send message in core phase
let coreSending = false;

async function sendCoreMessage() {
  const input = document.getElementById('core-message-input');
  const message = input.value.trim();
  const sendBtn = document.getElementById('core-send-btn');

  if (!message || coreSending) return;

  coreSending = true;
  sendBtn.disabled = true;
  sendBtn.innerHTML = '<span class="spinner"></span>';
  input.disabled = true;

  try {
    const hackerName = localStorage.getItem('hackerName') || 'HACKER';
    const response = await fetch('/api/core/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, senderName: hackerName })
    });

    const data = await response.json();

    if (data.success) {
      input.value = '';
      // Trigger fast polling to catch the response
      triggerFastPolling();
    } else {
      console.error('Core chat error:', data.error);
    }
  } catch (err) {
    console.error('Failed to send core message:', err);
  } finally {
    coreSending = false;
    sendBtn.disabled = false;
    sendBtn.textContent = 'SEND';
    input.disabled = false;
    input.focus();
  }
}

window.sendCoreMessage = sendCoreMessage;

// Handle Enter key on core input
document.addEventListener('DOMContentLoaded', () => {
  const coreInput = document.getElementById('core-message-input');
  if (coreInput) {
    coreInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendCoreMessage();
      }
    });
  }
});
