// Load game state
async function loadGameState() {
  try {
    const response = await fetch('/api/game');
    const data = await response.json();
    updateGameUI(data.started);
  } catch (error) {
    console.error('Failed to load game state:', error);
  }
}

// Update game UI based on state
function updateGameUI(isRunning) {
  const statusEl = document.getElementById('game-status');
  const startBtn = document.getElementById('start-game-btn');
  const stopBtn = document.getElementById('stop-game-btn');

  if (isRunning) {
    statusEl.textContent = 'GAME: RUNNING';
    statusEl.className = 'game-status running';
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
  } else {
    statusEl.textContent = 'GAME: STOPPED';
    statusEl.className = 'game-status stopped';
    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
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
    updateGameUI(data.started);
    console.log('Game stopped.');
  } catch (error) {
    console.error('Failed to stop game:', error);
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

// Reset all scores
async function resetScores() {
  if (!confirm('Reset ALL player scores to 0?')) return;
  try {
    await fetch('/api/scores/reset', { method: 'POST' });
    loadScores();
    loadGuests();
  } catch (error) {
    console.error('Failed to reset scores:', error);
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

    // Sort by score descending
    const sorted = [...guests].sort((a, b) => (b.score || 0) - (a.score || 0));

    listEl.innerHTML = sorted.map((guest) => {
      const teamClass = guest.team === 'red' ? 'team-red-border' : 'team-blue-border';
      const teamTextClass = guest.team === 'red' ? 'team-red-text' : 'team-blue-text';

      return `
        <div class="guest-card ${teamClass}">
          <span class="guest-name">${escapeHtml(guest.hackerName)}</span>
          <div class="player-score-control">
            <button onclick="addPlayerPoints(${guest.id}, -1)">-</button>
            <span class="player-score ${teamTextClass}" id="player-score-${guest.id}">${guest.score || 0}</span>
            <button onclick="addPlayerPoints(${guest.id}, 1)">+</button>
          </div>
          <button class="btn-reroll" onclick="rerollMission(${guest.id})">REROLL</button>
          <button class="btn-delete" onclick="deleteGuest(${guest.id})">X</button>
        </div>
      `;
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
