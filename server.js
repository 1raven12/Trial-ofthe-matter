'use strict';
const express  = require('express');
const http     = require('http');
const { Server: SocketIO } = require('socket.io');
const fs       = require('fs');
const path     = require('path');
const crypto   = require('crypto');
const os       = require('os');

const app        = express();
const httpServer = http.createServer(app);
const io         = new SocketIO(httpServer, {
  pingTimeout:  20000,
  pingInterval: 10000,
});

const PORT      = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'groups.json');

// ── Timer constants ─────────────────────────────────────────────────────────
const REG_SECS   = 30 * 60;   // 1800 — regulation time (30 min)
const MAX_SECS   = 60 * 60;   // 3600 — hard stop (60 min total)
const OT_THRESH  = MAX_SECS - REG_SECS;  // 1800 — timerSec below this = overtime

// ── Scoring constant ────────────────────────────────────────────────────────
const WRONG_PTS = 50;  // penalty per wrong answer
const HINT_PTS  = 50;  // penalty per hint used

// ── Hidden bonus questions ────────────────────────────────────────────────────
const HQ_BONUS = 20;  // bonus points per correct hidden question
const HQ_ANSWERS = {
  hq_receiving_1:  'a',  // Food Quality — egg float test
  hq_receiving_2:  'c',  // Air Quality — green = good
  hq_production_1: 'b',  // Water Quality — unusual odor
  hq_production_2: 'b',  // Manufacturing Quality — barcode tracking
  hq_qclab_1:      'b',  // Environmental Quality — trees filter pollution
  hq_qclab_2:      'b',  // Product Quality — electronics inspection
  hq_qaoffice_1:   'b',  // Quality Systems — expiration dates
  hq_qaoffice_2:   'a',  // Digital Security — updates fix vulnerabilities
  hq_dispatch_1:   'a',  // Honey Quality — crystallization = natural
  hq_dispatch_2:   'a',  // Quality Control — random sampling
};
const HQ_IDS = Object.keys(HQ_ANSWERS);

app.use(express.json());
app.use(express.static(__dirname));

// ── Token store ────────────────────────────────────────────────────────────
const groupTokens = new Map();  // token → { groupId, loginTime }
const adminTokens = new Set();

// ── Per-group live game session ────────────────────────────────────────────
const groupSessions = new Map();

// ── Per-group chat history ─────────────────────────────────────────────────
const groupChats = new Map();

// ── Per-group lobby ready state ────────────────────────────────────────────
const groupReadyState = new Map();

// ── Race-condition guard for pre-game joins ────────────────────────────────
const groupJoiningLock = new Map();  // groupId → Set<memberName>

// ── Session persistence ────────────────────────────────────────────────────
const SESSIONS_FILE = path.join(__dirname, 'data', 'sessions.json');

function saveSessions() {
  const obj = {};
  groupSessions.forEach((sess, groupId) => { obj[groupId] = sess; });
  try { fs.writeFileSync(SESSIONS_FILE, JSON.stringify(obj)); } catch (e) {}
}

function loadSessions() {
  if (!fs.existsSync(SESSIONS_FILE)) return;
  try {
    const obj = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
    const data = load();
    Object.entries(obj).forEach(([groupId, sess]) => {
      const group = data.groups.find(g => g.id === groupId);
      if (group && group.status === 'playing') {
        // Server just restarted — all players disconnected; mark paused
        if (!sess.paused) {
          sess.paused   = true;
          sess.pausedAt = Date.now();
        }
        groupSessions.set(groupId, sess);
      }
    });
  } catch (e) { console.warn('Could not load sessions:', e.message); }
}

// ── Data helpers ───────────────────────────────────────────────────────────
function load() { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
function save(d) { fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2)); }

// ── Auth middleware ────────────────────────────────────────────────────────
function requireGroup(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const sess = groupTokens.get(token);
  if (!sess) return res.status(401).json({ error: 'Unauthorized' });
  if (Date.now() - sess.loginTime > 4 * 60 * 60 * 1000) {
    groupTokens.delete(token);
    return res.status(401).json({ error: 'Session expired. Please login again.' });
  }
  req.groupId = sess.groupId;
  next();
}

function requireAdmin(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (!token || !adminTokens.has(token)) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ── Timer helpers (pause-aware) ────────────────────────────────────────────
function calcSecsRemaining(groupId) {
  const sess = groupSessions.get(groupId);
  if (!sess || !sess.startedAt) return MAX_SECS;
  const now = Date.now();
  let pausedMs = sess.totalPausedMs || 0;
  if (sess.paused && sess.pausedAt) pausedMs += now - sess.pausedAt;
  const elapsed = Math.floor((now - sess.startedAt - pausedMs) / 1000);
  return Math.max(0, MAX_SECS - elapsed);
}

// ── Score calculation ──────────────────────────────────────────────────────
// timerSec: remaining seconds out of MAX_SECS (3600)
// OT_THRESH = 1800: when timerSec < OT_THRESH, we are in overtime
function calcScore({ puzzlesDone, wrongAnswers, hintPenalty, timerSec, won, resumed, hiddenBonus }) {
  const isOvertime      = timerSec < OT_THRESH;
  const ptPerPuzzle     = resumed ? 100 : (isOvertime ? 180 : 200);
  const regSecsLeft     = isOvertime ? 0 : (timerSec - OT_THRESH);
  const timeBonus       = (won && !isOvertime) ? regSecsLeft * 2 : 0;
  const overtimeSecs    = isOvertime ? (OT_THRESH - timerSec) : 0;
  const overtimeMins    = Math.ceil(overtimeSecs / 60);
  const overtimePenalty = overtimeMins * 30;

  return Math.max(0,
    (puzzlesDone  * ptPerPuzzle) +
    timeBonus +
    (hiddenBonus  || 0) -
    (wrongAnswers * WRONG_PTS) -
    (hintPenalty  || 0) -
    overtimePenalty
  );
}

// ── Online members helper ──────────────────────────────────────────────────
function getOnlineMembers(groupId) {
  const room = io.sockets.adapter.rooms.get(groupId);
  if (!room) return [];
  const seen = new Set();
  for (const sid of room) {
    const s = io.sockets.sockets.get(sid);
    if (s && s.memberName) seen.add(s.memberName);
  }
  return [...seen];
}

// ── HTTP Routes ────────────────────────────────────────────────────────────

// List all groups (for login dropdown)
app.get('/api/groups', (req, res) => {
  const data = load();
  res.json(data.groups.map(g => ({
    id:                g.id,
    name:              g.name,
    status:            g.status,
    permanentlyLocked: !!g.permanentlyLocked,
    trialGroup:        !!g.trialGroup,
  })));
});

// Group member login
app.post('/api/login', (req, res) => {
  const { groupId, pin, groupSize } = req.body || {};
  const size = Number(groupSize);

  if (!groupId || !pin) return res.status(400).json({ error: 'Group and PIN required.', code: 'login.required_fields' });
  if (![3, 4, 5].includes(size)) return res.status(400).json({ error: 'Invalid group size.', code: 'login.group_size_error' });

  const data  = load();
  const group = data.groups.find(g => g.id === groupId);
  if (!group || group.pin !== String(pin)) {
    return res.status(401).json({ error: 'Invalid group or PIN.', code: 'login.fail' });
  }

  // Permanently locked groups (non-trial, completed)
  if (group.permanentlyLocked) {
    return res.json({ status: 'completed', groupName: group.name });
  }

  // Group already has a size set — validate match
  if (group.requiredSize && group.requiredSize !== size) {
    return res.status(400).json({ error: `This group already set ${group.requiredSize} players.`, code: 'login.size_mismatch', required: group.requiredSize });
  }

  // Pre-game join count check
  const sess = groupSessions.get(groupId);
  if (!sess) {
    const onlineNow = getOnlineMembers(groupId);
    const joining   = groupJoiningLock.get(groupId) || new Set();
    const existing  = new Set([...onlineNow, ...joining]);
    const effectiveLimit = group.requiredSize || size;
    if (existing.size >= effectiveLimit) {
      return res.status(403).json({ error: `Group is full (${effectiveLimit} players already connected).`, code: 'login.group_full', required: effectiveLimit });
    }
  }

  // Set requiredSize on first login
  if (!group.requiredSize) {
    group.requiredSize = size;
    save(data);
  }

  const token = crypto.randomBytes(22).toString('hex');
  groupTokens.set(token, { groupId, loginTime: Date.now() });

  res.json({ token, groupName: group.name, status: group.status, requiredSize: group.requiredSize });
});

// Mark game as started (legacy route, still supported)
app.post('/api/game/start', requireGroup, (req, res) => {
  const data  = load();
  const group = data.groups.find(g => g.id === req.groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.permanentlyLocked) return res.status(403).json({ error: 'Already completed.' });

  const isFirstStart = group.status !== 'playing';
  if (isFirstStart) {
    group.status    = 'playing';
    group.startedAt = new Date().toISOString();
    save(data);
  }

  if (!groupSessions.has(req.groupId)) {
    const online = getOnlineMembers(req.groupId);
    groupSessions.set(req.groupId, {
      solved: {}, playerSolved: {}, hiddenAnswers: {}, inventory: [], notes: [],
      puzzlesDone: 0, wrongAnswers: 0, hintPenalty: 0,
      startedAt: Date.now(),
      lockedRoster: online,
      groupSize: group.requiredSize || online.length,
      paused: false, pausedAt: null, totalPausedMs: 0,
      resumed: !!group.resumed,
    });
  }

  res.json({ ok: true, timerSec: calcSecsRemaining(req.groupId) });
});

// ── Required puzzles list (must match ROOM_PUZZLES + finale) ─────────────
const REQUIRED_PUZZLES = [
  'coa_verified','inspection_done','ncr_filed','calibration_done',
  'capa_done','iso15378_done','iso9001_done','motto_challenge',
  'motto_production','motto_qaoffice','batch_retrieved','game_won',
];

// Submit final score
app.post('/api/game/submit', requireGroup, (req, res) => {
  const { won } = req.body || {};
  const data  = load();
  const group = data.groups.find(g => g.id === req.groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.status === 'completed' && group.permanentlyLocked) {
    return res.json({ score: group.score, alreadyDone: true });
  }

  const sess = groupSessions.get(req.groupId);
  if (!sess) return res.status(400).json({ error: 'No active session found.' });

  // Validate win claim server-side
  if (won) {
    if (sess.paused) return res.status(400).json({ error: 'Cannot submit while game is paused.' });
    const missingGroup = REQUIRED_PUZZLES.filter(k => !sess.solved[k]);
    if (missingGroup.length > 0) {
      return res.status(400).json({ error: 'Not all puzzles completed.', missing: missingGroup });
    }
    // Per-player check
    const roster = sess.lockedRoster || [];
    if (roster.length > 0) {
      const incomplete = roster.filter(name => {
        const my = (sess.playerSolved || {})[name] || {};
        return REQUIRED_PUZZLES.some(k => sess.solved[k] && !my[k]);
      });
      if (incomplete.length > 0) {
        return res.status(400).json({ error: 'Not all players completed all puzzles.', players: incomplete });
      }
    }
  }

  const puzzlesDone  = sess.puzzlesDone  || 0;
  const wrongAnswers = sess.wrongAnswers || 0;
  const hintPenalty  = sess.hintPenalty  || 0;
  const secsLeft     = calcSecsRemaining(req.groupId);
  const resumed      = !!sess.resumed;

  const hiddenAnswers  = sess.hiddenAnswers || {};
  const hiddenFound    = Object.keys(hiddenAnswers).length;
  const hiddenCorrect  = Object.values(hiddenAnswers).filter(a => a && a.isCorrect).length;
  const hiddenBonus    = hiddenCorrect * HQ_BONUS;

  const score = calcScore({ puzzlesDone, wrongAnswers, hintPenalty, timerSec: secsLeft, won: !!won, resumed, hiddenBonus });

  const startedAtMs  = sess.startedAt || Date.now();
  const completedAt  = new Date().toISOString();
  const timeSpentSec = Math.round((Date.now() - startedAtMs) / 1000);

  group.status           = 'completed';
  group.score            = score;
  group.puzzlesDone      = puzzlesDone;
  group.wrongAnswers     = wrongAnswers;
  group.hintPenalty      = hintPenalty;
  group.won              = !!won;
  group.secondsRemaining = secsLeft;
  group.timeSpentSec     = timeSpentSec;
  group.completedAt      = completedAt;

  // Permanently lock non-trial groups after completion
  if (!group.trialGroup) {
    group.permanentlyLocked = true;
  }

  // Append to trial history
  if (!Array.isArray(group.trials)) group.trials = [];
  group.trials.push({
    trialNumber:    group.trials.length + 1,
    score, puzzlesDone, wrongAnswers, hintPenalty,
    hiddenFound, hiddenCorrect, hiddenBonus,
    won: !!won, secondsRemaining: secsLeft,
    timeSpentSec, completedAt, resumed,
  });

  save(data);

  io.to(req.groupId).emit('game_over', {
    won: !!won, score, puzzlesDone, wrongAnswers, secondsRemaining: secsLeft,
    hiddenFound, hiddenCorrect, hiddenBonus,
  });

  res.json({ score, puzzlesDone, wrongAnswers, secondsRemaining: secsLeft, timeSpentSec, hiddenFound, hiddenCorrect, hiddenBonus });
});

// Admin-only leaderboard — returns every trial as a separate row
app.get('/api/leaderboard', requireAdmin, (req, res) => {
  const data = load();
  const rows = [];

  data.groups.forEach(g => {
    const trialList = Array.isArray(g.trials) ? g.trials : [];
    if (trialList.length > 0) {
      trialList.forEach(t => {
        rows.push({
          name: g.name, trialNumber: t.trialNumber,
          score: t.score, puzzlesDone: t.puzzlesDone, won: t.won,
          wrongAnswers: t.wrongAnswers, hintPenalty: t.hintPenalty || 0,
          secondsRemaining: t.secondsRemaining, timeSpentSec: t.timeSpentSec,
          completedAt: t.completedAt, resumed: t.resumed,
        });
      });
    } else if (g.status === 'completed') {
      rows.push({
        name: g.name, trialNumber: 1,
        score: g.score, puzzlesDone: g.puzzlesDone, won: g.won,
        wrongAnswers: g.wrongAnswers, hintPenalty: g.hintPenalty || 0,
        secondsRemaining: g.secondsRemaining, timeSpentSec: g.timeSpentSec,
        completedAt: g.completedAt, resumed: false,
      });
    }
  });

  rows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(a.completedAt) - new Date(b.completedAt);
  });

  res.json(rows);
});

// Summary for admin cards
app.get('/api/summary', (req, res) => {
  const data = load();
  res.json({
    total:     data.groups.length,
    pending:   data.groups.filter(g => g.status === 'pending').length,
    playing:   data.groups.filter(g => g.status === 'playing').length,
    completed: data.groups.filter(g => g.status === 'completed').length,
  });
});

// Admin login
app.post('/api/admin/login', (req, res) => {
  const data = load();
  // Prefer ADMIN_PASSWORD env var; fall back to groups.json field
  const adminPw = process.env.ADMIN_PASSWORD || data.adminPassword;
  if (!req.body || req.body.password !== adminPw) {
    return res.status(401).json({ error: 'Incorrect admin password.' });
  }
  const token = crypto.randomBytes(22).toString('hex');
  adminTokens.add(token);
  res.json({ token });
});

// Admin: full group data
app.get('/api/admin/groups', requireAdmin, (req, res) => {
  const data = load();
  const groups = data.groups.map(g => {
    const sess = groupSessions.get(g.id);
    return {
      ...g,
      liveMembers:      getOnlineMembers(g.id).length,
      livePaused:       sess ? !!sess.paused : false,
      liveRoster:       sess ? (sess.lockedRoster || []) : [],
      livePlayerSolved: sess ? (sess.playerSolved || {}) : {},
      livePuzzles:      sess ? sess.puzzlesDone : (g.puzzlesDone || 0),
      liveWrong:        sess ? sess.wrongAnswers : (g.wrongAnswers || 0),
    };
  });
  res.json(groups);
});

// Admin: reset a group — preserves trial history
app.post('/api/admin/reset', requireAdmin, (req, res) => {
  const { groupId } = req.body || {};
  const data  = load();
  const group = data.groups.find(g => g.id === groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const trials = Array.isArray(group.trials) ? group.trials : [];

  group.status           = 'pending';
  group.score            = null;
  group.puzzlesDone      = 0;
  group.wrongAnswers     = 0;
  group.hintPenalty      = 0;
  group.won              = false;
  group.secondsRemaining = 0;
  group.timeSpentSec     = 0;
  group.completedAt      = null;
  group.startedAt        = null;
  group.resumed          = false;
  group.trials           = trials;
  group.requiredSize     = null;
  group.permanentlyLocked = false;
  group.lockedRoster     = [];

  groupSessions.delete(groupId);
  groupChats.delete(groupId);
  groupReadyState.delete(groupId);
  groupJoiningLock.delete(groupId);

  for (const [tok, sess] of groupTokens) {
    if (sess.groupId === groupId) groupTokens.delete(tok);
  }

  io.to(groupId).emit('kicked', { reason: 'Group has been reset by admin.' });

  save(data);
  saveSessions();  // persist session deletion immediately
  res.json({ ok: true });
});

// Admin: resume a group from where they left off (reduced scoring: 100 pts/puzzle)
app.post('/api/admin/resume', requireAdmin, (req, res) => {
  const { groupId } = req.body || {};
  const data  = load();
  const group = data.groups.find(g => g.id === groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.status !== 'completed' && group.status !== 'playing') {
    return res.status(400).json({ error: 'Group must be completed or mid-game to resume.' });
  }

  group.status  = 'playing';
  group.resumed = true;
  group.permanentlyLocked = false;
  if (!group.startedAt) group.startedAt = new Date().toISOString();

  if (!groupSessions.has(groupId)) {
    groupSessions.set(groupId, {
      solved:       group.solved || {},
      playerSolved: {},
      hiddenAnswers: {},
      inventory:    group.inventory || [],
      notes:        group.notes || [],
      puzzlesDone:  group.puzzlesDone || 0,
      wrongAnswers: 0,
      hintPenalty:  0,
      startedAt:    Date.now() - (REG_SECS * 1000),
      lockedRoster: group.lockedRoster || [],
      groupSize:    group.requiredSize || 0,
      paused: false, pausedAt: null, totalPausedMs: 0,
      resumed: true,
    });
  } else {
    const sess = groupSessions.get(groupId);
    sess.resumed      = true;
    sess.wrongAnswers = 0;
    sess.hintPenalty  = 0;
    sess.paused       = false;
    sess.pausedAt     = null;
  }

  save(data);
  res.json({ ok: true, message: 'Group resumed. Scoring reduced to 100 pts/puzzle.' });
});

// Admin: add group
app.post('/api/admin/groups', requireAdmin, (req, res) => {
  const { name, pin } = req.body || {};
  if (!name || !pin) return res.status(400).json({ error: 'Name and PIN required.' });
  const data = load();
  const id   = 'g_' + Date.now();
  data.groups.push({
    id, name, pin: String(pin),
    trialGroup: false, requiredSize: null,
    permanentlyLocked: false, lockedRoster: [],
    status: 'pending', score: null, puzzlesDone: 0,
    wrongAnswers: 0, hintPenalty: 0, won: false,
    secondsRemaining: 0, timeSpentSec: 0,
    completedAt: null, startedAt: null,
    resumed: false, trials: [],
  });
  save(data);
  res.json({ id });
});

// ── Socket.io auth middleware ──────────────────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Unauthorized'));

  const sess = groupTokens.get(token);
  if (!sess) return next(new Error('Unauthorized'));
  if (Date.now() - sess.loginTime > 4 * 60 * 60 * 1000) {
    groupTokens.delete(token);
    return next(new Error('Session expired'));
  }

  const groupId    = sess.groupId;
  const memberName = String(socket.handshake.auth.memberName || 'Member').slice(0, 24);
  socket.groupId   = groupId;
  socket.memberName = memberName;

  // If game in progress: only allow locked roster members
  const gs = groupSessions.get(groupId);
  if (gs && gs.lockedRoster && gs.lockedRoster.length > 0) {
    if (!gs.lockedRoster.includes(memberName)) {
      return next(new Error('Session roster is locked. Only original team members may rejoin.'));
    }
    return next();
  }

  // Pre-game: enforce group size limit (race-condition safe)
  const data  = load();
  const group = data.groups.find(g => g.id === groupId);
  if (group && group.requiredSize) {
    const onlineNow = getOnlineMembers(groupId);
    if (!onlineNow.includes(memberName)) {
      // Track this connection as "joining"
      if (!groupJoiningLock.has(groupId)) groupJoiningLock.set(groupId, new Set());
      const joining = groupJoiningLock.get(groupId);
      joining.add(memberName);
      socket._addedToJoining = true;

      const totalAttempting = new Set([...onlineNow, ...joining]);
      if (totalAttempting.size > group.requiredSize) {
        joining.delete(memberName);
        if (joining.size === 0) groupJoiningLock.delete(groupId);
        return next(new Error(`Group is full (${group.requiredSize} players maximum).`));
      }
    }
  }

  next();
});

// ── Socket.io connection handler ───────────────────────────────────────────
io.on('connection', (socket) => {
  const { groupId, memberName } = socket;

  socket.join(groupId);

  // Remove from joining lock now that we're fully connected
  const joining = groupJoiningLock.get(groupId);
  if (joining) {
    joining.delete(memberName);
    if (joining.size === 0) groupJoiningLock.delete(groupId);
  }

  // Kick any other socket using the same token (single-session enforcement)
  const tokenMeta = groupTokens.get(socket.handshake.auth.token);
  if (tokenMeta && tokenMeta.socketId && tokenMeta.socketId !== socket.id) {
    const prev = io.sockets.sockets.get(tokenMeta.socketId);
    if (prev) prev.disconnect(true);
  }
  if (tokenMeta) tokenMeta.socketId = socket.id;

  const sess = groupSessions.get(groupId);
  socket.emit('state_init', {
    state: sess ? {
      solved:        sess.solved,
      playerSolved:  (sess.playerSolved || {})[memberName] || {},
      hiddenAnswers: sess.hiddenAnswers || {},
      inventory:     sess.inventory,
      notes:         sess.notes,
      puzzlesDone:   sess.puzzlesDone,
      wrongAnswers:  sess.wrongAnswers,
      hintPenalty:   sess.hintPenalty || 0,
      timerSec:      calcSecsRemaining(groupId),
      resumed:       !!sess.resumed,
      lockedRoster:  sess.lockedRoster || [],
      groupSize:     sess.groupSize || 0,
      paused:        !!sess.paused,
    } : null,
    chats:   groupChats.get(groupId) || [],
    members: getOnlineMembers(groupId),
  });

  socket.to(groupId).emit('member_join', {
    memberName,
    members: getOnlineMembers(groupId),
  });

  // Check if reconnect un-pauses the game
  const gs2 = groupSessions.get(groupId);
  if (gs2 && gs2.paused && Array.isArray(gs2.lockedRoster) && gs2.lockedRoster.length > 0) {
    const onlineNow = getOnlineMembers(groupId);
    const allBack   = gs2.lockedRoster.every(n => onlineNow.includes(n));
    if (allBack) {
      gs2.totalPausedMs = (gs2.totalPausedMs || 0) + (Date.now() - (gs2.pausedAt || Date.now()));
      gs2.pausedAt      = null;
      gs2.paused        = false;
      io.to(groupId).emit('game_resumed', { timerSec: calcSecsRemaining(groupId) });
    }
  }

  // ── Heartbeat ─────────────────────────────────────────────────────────────
  socket.on('heartbeat', () => {
    socket.lastHB = Date.now();
  });

  // ── Per-player puzzle completion ──────────────────────────────────────────
  socket.on('player_puzzle_done', ({ key, puzzlesDone }) => {
    const gs = groupSessions.get(groupId);
    if (!gs || gs.paused) return;  // block submissions while paused
    if (!REQUIRED_PUZZLES.includes(key)) return;  // reject unknown puzzle keys
    if (!gs.playerSolved) gs.playerSolved = {};
    if (!gs.playerSolved[memberName]) gs.playerSolved[memberName] = {};
    if (gs.playerSolved[memberName][key]) return;  // already done by me

    gs.playerSolved[memberName][key] = true;

    // Count how many locked roster members have completed this puzzle
    const roster = gs.lockedRoster || [memberName];
    const completedCount = roster.filter(n => gs.playerSolved[n]?.[key]).length;

    io.to(groupId).emit('player_puzzle_progress', {
      key, memberName, completedCount, total: roster.length,
    });

    // Check if ALL locked roster members completed this puzzle
    const allDone = roster.every(n => !!gs.playerSolved[n]?.[key]);
    if (allDone && !gs.solved[key]) {
      gs.solved[key]  = true;
      // Count only scored room puzzles (game_won is the win marker, not a scored puzzle)
      const scored = REQUIRED_PUZZLES.filter(k => k !== 'game_won' && gs.solved[k]).length;
      gs.puzzlesDone  = scored;
      saveSessions();
      io.to(groupId).emit('puzzle_solved', {
        key, puzzlesDone: gs.puzzlesDone, fromName: memberName,
      });
    }
  });


  // ── Item found ────────────────────────────────────────────────────────────
  socket.on('item_found', ({ itemId }) => {
    const gs = groupSessions.get(groupId);
    if (!gs || gs.paused || gs.inventory.includes(itemId)) return;
    gs.inventory.push(itemId);
    socket.to(groupId).emit('item_found', { itemId, fromName: memberName });
  });

  // ── Note added ────────────────────────────────────────────────────────────
  socket.on('note_added', ({ html, important }) => {
    const gs = groupSessions.get(groupId);
    if (!gs || gs.paused) return;
    // Sanitize: strip script/style blocks (including content), then all tags except <strong>
    const sanitized = String(html || '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<(?!\/?strong\b)[^>]*>/gi, '');
    const note = { html: sanitized, important: !!important };
    gs.notes.push(note);
    socket.to(groupId).emit('note_added', { ...note, fromName: memberName });
  });

  // ── Wrong answer ──────────────────────────────────────────────────────────
  socket.on('wrong_answer', () => {
    const gs = groupSessions.get(groupId);
    if (!gs || gs.paused) return;
    // Rate-limit: one wrong_answer per socket per 2 seconds to prevent spam
    if (!gs.wrongAnswerAt) gs.wrongAnswerAt = new Map();
    const last = gs.wrongAnswerAt.get(socket.id) || 0;
    if (Date.now() - last < 2000) return;
    gs.wrongAnswerAt.set(socket.id, Date.now());
    gs.wrongAnswers++;
    // Broadcast to entire group so every player sees who got it wrong and the penalty
    io.to(groupId).emit('wrong_answer_notify', {
      by:      memberName,
      penalty: WRONG_PTS,
      total:   gs.wrongAnswers,
    });
  });

  // ── Hint used ─────────────────────────────────────────────────────────────
  socket.on('hint_used', ({ room, timeCost }) => {
    const gs = groupSessions.get(groupId);
    if (!gs || gs.paused) return;
    gs.hintPenalty = (gs.hintPenalty || 0) + HINT_PTS;
    socket.to(groupId).emit('hint_broadcast', { room, timeCost, ptsCost: HINT_PTS, fromName: memberName });
  });

  // ── Hidden bonus question submission ─────────────────────────────────────
  socket.on('hidden_q_submit', ({ hqId, option }) => {
    const gs = groupSessions.get(groupId);
    if (!gs || gs.paused) return;
    if (!HQ_IDS.includes(hqId)) return;
    if (!gs.hiddenAnswers) gs.hiddenAnswers = {};

    // Already answered — resend current state to this socket only
    if (gs.hiddenAnswers[hqId] != null) {
      socket.emit('hidden_q_state', { hqId, result: gs.hiddenAnswers[hqId] });
      return;
    }

    const isCorrect = String(option).toLowerCase() === HQ_ANSWERS[hqId];
    // Derive roomId from hqId prefix, e.g. hq_receiving_1 → receiving
    const roomId = hqId.replace(/^hq_/, '').replace(/_\d+$/, '');
    gs.hiddenAnswers[hqId] = {
      groupId,
      bonusQuestionId: hqId,
      roomId,
      answeredBy:      memberName,
      isCorrect,
      bonusPts:        isCorrect ? HQ_BONUS : 0,
      submittedOption: String(option).toLowerCase(),
      correctOption:   HQ_ANSWERS[hqId],
      answeredAt:      Date.now(),
    };

    io.to(groupId).emit('hidden_q_state', { hqId, result: gs.hiddenAnswers[hqId] });
  });

  // ── Lobby: player ready ───────────────────────────────────────────────────
  socket.on('player_ready', () => {
    if (groupSessions.has(groupId)) return;

    if (!groupReadyState.has(groupId)) groupReadyState.set(groupId, new Map());
    const rs = groupReadyState.get(groupId);
    rs.set(socket.id, memberName);

    const data     = load();
    const group    = data.groups.find(g => g.id === groupId);
    const required = group ? (group.requiredSize || 0) : 0;

    const online = getOnlineMembers(groupId).length || 1;
    const readyNames  = [...rs.values()];
    const readyCount  = readyNames.length;

    if (required > 0 && online < required) {
      socket.emit('lobby_error', {
        code: 'wrong_count', required, online,
      });
      rs.delete(socket.id);
      return;
    }
    if (required > 0 && online > required) {
      socket.emit('lobby_error', {
        code: 'too_many', required, online,
      });
      rs.delete(socket.id);
      return;
    }
    if (online < 3) {
      socket.emit('lobby_error', {
        code: 'wrong_count', required: 3, online,
      });
      rs.delete(socket.id);
      return;
    }
    if (online > 5) {
      socket.emit('lobby_error', {
        code: 'too_many', required: 5, online,
      });
      rs.delete(socket.id);
      return;
    }

    io.to(groupId).emit('ready_update', { readyCount, total: online, readyNames });

    if (readyCount >= online) {
      if (!group || group.permanentlyLocked) return;

      if (group.status !== 'playing') {
        group.status    = 'playing';
        group.startedAt = new Date().toISOString();
        save(data);
      }

      if (!groupSessions.has(groupId)) {
        const roster = getOnlineMembers(groupId);
        groupSessions.set(groupId, {
          solved: {}, playerSolved: {}, hiddenAnswers: {}, inventory: [], notes: [],
          puzzlesDone: 0, wrongAnswers: 0, hintPenalty: 0,
          startedAt: Date.now(),
          lockedRoster: roster,
          groupSize: required || online,
          paused: false, pausedAt: null, totalPausedMs: 0,
          resumed: false,
        });
      }

      groupReadyState.delete(groupId);
      saveSessions();
      io.to(groupId).emit('game_start', { timerSec: MAX_SECS });
    }
  });

  // ── Group chat ────────────────────────────────────────────────────────────
  socket.on('chat', ({ text }) => {
    const txt = String(text || '').trim().slice(0, 200);
    if (!txt) return;
    const msg = { from: memberName, text: txt, ts: Date.now() };

    if (!groupChats.has(groupId)) groupChats.set(groupId, []);
    const chats = groupChats.get(groupId);
    chats.push(msg);
    if (chats.length > 60) chats.shift();

    io.to(groupId).emit('chat', msg);
  });

  // ── Hard stop: force game end after 60 min ────────────────────────────────
  socket.on('overtime_hardstop', () => {
    const gs = groupSessions.get(groupId);
    if (!gs || gs.solved.game_won) return;
    // Prevent clients from forcing game-over before time actually expires
    if (calcSecsRemaining(groupId) > 30) return;
    const secsLeft      = 0;
    const hiddenAnswers = gs.hiddenAnswers || {};
    const hiddenCorrect = Object.values(hiddenAnswers).filter(a => a && a.isCorrect).length;
    const hiddenFound   = Object.keys(hiddenAnswers).length;
    const hiddenBonus   = hiddenCorrect * HQ_BONUS;
    const score = calcScore({
      puzzlesDone:  gs.puzzlesDone,
      wrongAnswers: gs.wrongAnswers,
      hintPenalty:  gs.hintPenalty || 0,
      timerSec:     secsLeft,
      won:          false,
      resumed:      !!gs.resumed,
      hiddenBonus,
    });

    // Persist result to database
    try {
      const data  = load();
      const group = data.groups.find(g => g.id === groupId);
      if (group) {
        const timeSpentSec = Math.round((Date.now() - (gs.startedAt || Date.now())) / 1000);
        const completedAt  = new Date().toISOString();
        group.status           = 'completed';
        group.score            = score;
        group.puzzlesDone      = gs.puzzlesDone;
        group.wrongAnswers     = gs.wrongAnswers;
        group.hintPenalty      = gs.hintPenalty || 0;
        group.won              = false;
        group.secondsRemaining = 0;
        group.timeSpentSec     = timeSpentSec;
        group.completedAt      = completedAt;
        if (!group.trialGroup) group.permanentlyLocked = true;
        if (!Array.isArray(group.trials)) group.trials = [];
        group.trials.push({
          trialNumber: group.trials.length + 1,
          score, puzzlesDone: gs.puzzlesDone, wrongAnswers: gs.wrongAnswers,
          hintPenalty: gs.hintPenalty || 0, hiddenFound, hiddenCorrect, hiddenBonus,
          won: false, secondsRemaining: 0, timeSpentSec, completedAt, resumed: !!gs.resumed,
        });
        save(data);
      }
    } catch (e) { console.error('overtime_hardstop save failed:', e); }

    io.to(groupId).emit('game_over', {
      won: false, score, puzzlesDone: gs.puzzlesDone,
      wrongAnswers: gs.wrongAnswers, secondsRemaining: 0,
      hiddenFound, hiddenCorrect, hiddenBonus,
    });
  });

  // ── Disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    // Remove from ready state if in lobby
    const rs = groupReadyState.get(groupId);
    if (rs) {
      rs.delete(socket.id);
      if (rs.size === 0) groupReadyState.delete(groupId);
      else {
        const online = getOnlineMembers(groupId).length;
        io.to(groupId).emit('ready_update', {
          readyCount: rs.size, total: online,
          readyNames: [...rs.values()],
        });
      }
    }

    // If game in progress and player is on locked roster → PAUSE
    const gs = groupSessions.get(groupId);
    if (gs && !gs.paused && Array.isArray(gs.lockedRoster) && gs.lockedRoster.includes(memberName)) {
      gs.paused   = true;
      gs.pausedAt = Date.now();
      io.to(groupId).emit('game_paused', {
        memberName,
        lockedRoster: gs.lockedRoster,
      });
    }

    setTimeout(() => {
      const remaining = getOnlineMembers(groupId);
      socket.to(groupId).emit('member_leave', { memberName, members: remaining });
    }, 500);
  });
});

// ── Start ──────────────────────────────────────────────────────────────────
// Load persisted sessions (crash recovery) and start auto-save interval
loadSessions();
setInterval(saveSessions, 30 * 1000);

function getLanIP() {
  const nets = os.networkInterfaces();
  for (const list of Object.values(nets)) {
    for (const iface of list) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

httpServer.listen(PORT, '0.0.0.0', () => {
  const ip = getLanIP();
  console.log('\n🏭  MediSeal Quality Week — Game Server v4');
  console.log('─'.repeat(46));
  console.log(`  Local:    http://localhost:${PORT}`);
  console.log(`  Network:  http://${ip}:${PORT}   ← share with groups`);
  console.log(`  Admin:    http://${ip}:${PORT}/admin.html`);
  console.log('─'.repeat(46));
  console.log(`  Regulation: 30 min | Hard stop: 60 min | Overtime: −30 pts/min`);
  console.log(`  Wrong answer: −${WRONG_PTS} pts | Groups: 256 (Group 256 = trial)`);
  console.log(`  Admin password: see data/groups.json\n`);
});
