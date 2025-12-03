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

// Make functions globally available
window.toggleAccessCode = toggleAccessCode;
window.revealMission = revealMission;
window.uploadPhoto = uploadPhoto;
window.previewPhoto = previewPhoto;
window.verifyPhoto = verifyPhoto;
window.submitTrivia = submitTrivia;

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
  document.getElementById('display-name').textContent = hackerName;

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

  } catch (err) {
    console.error('Failed to fetch player data:', err);
  }
}

// Start polling for player updates
let pollingInterval = null;

function startPlayerPolling(playerId) {
  // Initial fetch
  fetchPlayerData(playerId);
  fetchVerifications(playerId);

  // Poll every 3 seconds
  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = setInterval(() => {
    fetchPlayerData(playerId);
    fetchVerifications(playerId);
  }, 3000);
}
