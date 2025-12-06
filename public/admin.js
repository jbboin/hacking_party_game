// Track boss mode state globally
let isBossMode = false;

// Load game state
async function loadGameState() {
  try {
    const response = await fetch('/api/game');
    const data = await response.json();
    const wasBossMode = isBossMode;
    isBossMode = data.bossPhase || false;
    updateGameUI(data.started, data.bossPhase, data.firewallHP);
    // Reload guests if boss mode changed (to update buttons)
    if (wasBossMode !== isBossMode) {
      loadGuests();
    }
  } catch (error) {
    console.error('Failed to load game state:', error);
  }
}

// Update game UI based on state
function updateGameUI(isRunning, bossPhase = false, firewallHP = 5) {
  const statusEl = document.getElementById('game-status');
  const startBtn = document.getElementById('start-game-btn');
  const stopBtn = document.getElementById('stop-game-btn');
  const bossBtn = document.getElementById('boss-phase-btn');
  const bossControlsBox = document.getElementById('boss-controls-box');
  const scoresSection = document.getElementById('scores-section');

  if (bossPhase) {
    statusEl.textContent = 'GAME: BOSS PHASE';
    statusEl.className = 'game-status boss';
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    bossBtn.classList.add('hidden');
    bossControlsBox.classList.remove('hidden');
    if (scoresSection) scoresSection.classList.add('hidden');
    updateFirewallHPDisplay(firewallHP);
  } else if (isRunning) {
    statusEl.textContent = 'GAME: RUNNING';
    statusEl.className = 'game-status running';
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    bossBtn.classList.remove('hidden');
    bossControlsBox.classList.add('hidden');
    if (scoresSection) scoresSection.classList.remove('hidden');
  } else {
    statusEl.textContent = 'GAME: STOPPED';
    statusEl.className = 'game-status stopped';
    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    bossBtn.classList.add('hidden');
    bossControlsBox.classList.add('hidden');
    if (scoresSection) scoresSection.classList.remove('hidden');
  }
}

// Update firewall HP display
function updateFirewallHPDisplay(hp) {
  const hpValueEl = document.getElementById('firewall-hp-value');
  if (hpValueEl) hpValueEl.textContent = hp;

  // Highlight the active HP button (0-5)
  for (let i = 0; i <= 5; i++) {
    const btn = document.getElementById(`hp-btn-${i}`);
    if (btn) {
      if (i === hp) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  }
}

// Set firewall HP
async function setFirewallHP(hp) {
  try {
    const response = await fetch('/api/boss/firewall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hp })
    });
    const data = await response.json();
    if (data.success) {
      updateFirewallHPDisplay(hp);
      console.log('Firewall HP set to:', hp);
    }
  } catch (error) {
    console.error('Failed to set firewall HP:', error);
  }
}

// Send AI guidance (queued for next batch, then cleared)
async function sendAiGuidance() {
  const input = document.getElementById('ai-guidance-input');
  const guidance = input.value.trim();

  if (!guidance) return;

  try {
    const response = await fetch('/api/boss/guidance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guidance })
    });
    const data = await response.json();
    if (data.success) {
      input.value = ''; // Clear input after sending
      console.log('AI guidance queued:', guidance);
    }
  } catch (error) {
    console.error('Failed to send AI guidance:', error);
  }
}

// Start game
async function startGame() {
  try {
    const response = await fetch('/api/game/start', { method: 'POST' });
    const data = await response.json();
    updateGameUI(data.started);
    console.log('Game started! Missions assigned.');
  } catch (error) {
    console.error('Failed to start game:', error);
  }
}

// Stop game
async function stopGame() {
  if (!confirm('Stop the game? Players will stop receiving missions.')) return;
  try {
    const response = await fetch('/api/game/stop', { method: 'POST' });
    const data = await response.json();
    updateGameUI(data.started, data.bossPhase);
    console.log('Game stopped.');
  } catch (error) {
    console.error('Failed to stop game:', error);
  }
}

// Start boss phase
async function startBossPhase() {
  if (!confirm('Start the BOSS PHASE? The scoreboard will show the Rogue AI terminal.')) return;
  try {
    const response = await fetch('/api/game/boss', { method: 'POST' });
    const data = await response.json();
    updateGameUI(data.started, data.bossPhase);
    console.log('Boss phase started!');
  } catch (error) {
    console.error('Failed to start boss phase:', error);
  }
}

// Fetch and display scores
async function loadScores() {
  try {
    const response = await fetch('/api/scores');
    const scores = await response.json();
    document.getElementById('score-blue').textContent = scores.blue;
    document.getElementById('score-red').textContent = scores.red;
    document.getElementById('rate-input').value = scores.rate;
  } catch (error) {
    console.error('Failed to load scores:', error);
  }
}

// Set rate (1 pt = X%)
async function setRate() {
  const rate = parseFloat(document.getElementById('rate-input').value);
  if (!rate || rate <= 0) return;
  try {
    await fetch('/api/scores/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rate })
    });
  } catch (error) {
    console.error('Failed to set rate:', error);
  }
}

// Reset game (scores and player history)
async function resetGame() {
  if (!confirm('Reset ALL player scores, missions, and hack history?')) return;
  try {
    await fetch('/api/game/reset', { method: 'POST' });
    loadScores();
    loadGuests();
  } catch (error) {
    console.error('Failed to reset game:', error);
  }
}

// Reset gallery (delete all photos)
async function resetGallery() {
  if (!confirm('Delete ALL photos from the gallery? This cannot be undone.')) return;
  try {
    const response = await fetch('/api/photos/reset', { method: 'POST' });
    const data = await response.json();
    if (data.success) {
      alert('Gallery reset successfully');
    } else {
      alert(data.error || 'Failed to reset gallery');
    }
  } catch (error) {
    console.error('Failed to reset gallery:', error);
    alert('Failed to reset gallery');
  }
}

// Add points to a player
async function addPlayerPoints(id, points) {
  try {
    const response = await fetch(`/api/guests/${id}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points })
    });
    const data = await response.json();
    // Update team totals
    document.getElementById('score-blue').textContent = data.scores.blue;
    document.getElementById('score-red').textContent = data.scores.red;
    // Update player score display
    const scoreEl = document.getElementById(`player-score-${id}`);
    if (scoreEl) scoreEl.textContent = data.guest.score;
  } catch (error) {
    console.error('Failed to update player score:', error);
  }
}

// Reroll mission for a player
async function rerollMission(id) {
  try {
    const response = await fetch(`/api/player/${id}/reroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    if (data.success) {
      console.log('Mission rerolled:', data.mission);
    } else {
      alert(data.error || 'Failed to reroll mission');
    }
  } catch (error) {
    console.error('Failed to reroll mission:', error);
  }
}

// Save a player (mark as infiltrated core)
async function savePlayer(id) {
  try {
    const response = await fetch(`/api/player/${id}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    if (data.success) {
      console.log('Player saved!');
      loadGuests();
    } else {
      alert(data.error || 'Failed to save player');
    }
  } catch (error) {
    console.error('Failed to save player:', error);
  }
}

// Disconnect a player (eliminate)
async function disconnectPlayer(id) {
  try {
    const response = await fetch(`/api/player/${id}/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    if (data.success) {
      console.log('Player disconnected!');
      loadGuests();
    } else {
      alert(data.error || 'Failed to disconnect player');
    }
  } catch (error) {
    console.error('Failed to disconnect player:', error);
  }
}

// Fetch and display guests
async function loadGuests() {
  const listEl = document.getElementById('guest-list');
  const countEl = document.getElementById('guest-count');
  const blueCountEl = document.getElementById('blue-count');
  const redCountEl = document.getElementById('red-count');

  try {
    const response = await fetch('/api/guests');
    const guests = await response.json();

    const blueTeam = guests.filter(g => g.team === 'blue');
    const redTeam = guests.filter(g => g.team === 'red');

    countEl.textContent = guests.length;
    blueCountEl.textContent = blueTeam.length;
    redCountEl.textContent = redTeam.length;

    if (guests.length === 0) {
      listEl.innerHTML = '<p class="empty-state">> No hackers have joined yet...</p>';
      return;
    }

    // Sort players
    let sorted;
    if (isBossMode) {
      // Boss mode: saved first, then active, then disconnected
      sorted = [...guests].sort((a, b) => {
        const getStatusOrder = (g) => {
          if (g.saved) return 0;
          if (g.disconnected) return 2;
          return 1; // active
        };
        return getStatusOrder(a) - getStatusOrder(b);
      });
    } else {
      // Normal mode: sort by score descending
      sorted = [...guests].sort((a, b) => (b.score || 0) - (a.score || 0));
    }

    listEl.innerHTML = sorted.map((guest) => {
      const teamClass = guest.team === 'red' ? 'team-red-border' : 'team-blue-border';
      const teamTextClass = guest.team === 'red' ? 'team-red-text' : 'team-blue-text';

      if (isBossMode) {
        // Boss mode: show SAVE/DISCONNECT buttons, status indicators
        const statusText = guest.saved ? '✓ SAVED' : (guest.disconnected ? '✗ DISCONNECTED' : '');
        const statusClass = guest.saved ? 'status-saved' : (guest.disconnected ? 'status-disconnected' : '');
        return `
          <div class="guest-card ${teamClass}">
            <div class="guest-info-col">
              <span class="guest-name">${escapeHtml(guest.hackerName)}</span>
              <span class="access-code">[${guest.accessCode || '???'}]</span>
            </div>
            <div class="guest-controls-col">
              ${statusText ? `<span class="player-status ${statusClass}">${statusText}</span>` : ''}
              ${!guest.saved && !guest.disconnected ? `
                <button class="btn-save" onclick="savePlayer(${guest.id})">SAVE</button>
                <button class="btn-disconnect" onclick="disconnectPlayer(${guest.id})">DISCONNECT</button>
              ` : ''}
              <button class="btn-delete" onclick="deleteGuest(${guest.id})">X</button>
            </div>
          </div>
        `;
      } else {
        // Normal mode: show score controls and reroll
        return `
          <div class="guest-card ${teamClass}">
            <div class="guest-info-col">
              <span class="guest-name">${escapeHtml(guest.hackerName)}</span>
              <span class="access-code">[${guest.accessCode || '???'}]</span>
            </div>
            <div class="guest-controls-col">
              <div class="player-score-control">
                <button onclick="addPlayerPoints(${guest.id}, -1)">-</button>
                <span class="player-score ${teamTextClass}" id="player-score-${guest.id}">${guest.score || 0}</span>
                <button onclick="addPlayerPoints(${guest.id}, 1)">+</button>
              </div>
              <button class="btn-reroll" onclick="rerollMission(${guest.id})">REROLL</button>
              <button class="btn-delete" onclick="deleteGuest(${guest.id})">X</button>
            </div>
          </div>
        `;
      }
    }).join('');

  } catch (error) {
    listEl.innerHTML = `<p class="error">> ERROR: Failed to load guests</p>`;
  }
}

// Delete a guest
async function deleteGuest(id) {
  try {
    await fetch(`/api/guests/${id}`, { method: 'DELETE' });
    loadGuests();
    loadScores();
  } catch (error) {
    console.error('Failed to delete guest:', error);
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initial load
loadGameState();
loadScores();
loadGuests();

// Refresh button
document.getElementById('refresh-btn').addEventListener('click', () => {
  loadGameState();
  loadScores();
  loadGuests();
});

// Auto-refresh every 5 seconds
setInterval(() => {
  loadGameState();
  loadScores();
  loadGuests();
}, 5000);
