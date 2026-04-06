/**
 * main.js
 * Application entry point — wires up file uploads, rendering, and tab logic
 */

import { parseWhatsApp } from './parsers/whatsapp.js';
import { parseInstagram } from './parsers/instagram.js';
import { parseTwitter } from './parsers/twitter.js';
import { parseIMessage } from './parsers/imessage.js';
import {
  analyzeMessages,
  searchKeyword,
  getTrendingKeywords,
  generateDemoData,
  getInitials,
  formatTime,
} from './utils/analytics.js';

// ─────────────────────────────────────────
// STATE
// ─────────────────────────────────────────

let appState = {
  allMessages: [],
  analysisResult: null,
  charts: {},
};

const AVATAR_COLORS = [
  { bg: 'rgba(232,255,107,0.15)', text: '#E8FF6B' },
  { bg: 'rgba(107,255,184,0.15)', text: '#6BFFB8' },
  { bg: 'rgba(107,181,255,0.15)', text: '#6BB5FF' },
  { bg: 'rgba(255,184,107,0.15)', text: '#FFB86B' },
  { bg: 'rgba(255,107,107,0.15)', text: '#FF6B6B' },
  { bg: 'rgba(200,107,255,0.15)', text: '#C86BFF' },
];
const avatarColorMap = {};
function getAvatarColor(name) {
  if (!avatarColorMap[name]) {
    const idx = Object.keys(avatarColorMap).length % AVATAR_COLORS.length;
    avatarColorMap[name] = AVATAR_COLORS[idx];
  }
  return avatarColorMap[name];
}

// ─────────────────────────────────────────
// LOADING OVERLAY
// ─────────────────────────────────────────

function showLoading(text = 'Analyzing your chats...') {
  const existing = document.getElementById('loadingOverlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'loadingOverlay';
  overlay.className = 'loading-overlay';
  overlay.innerHTML = `<div class="spinner"></div><div class="loading-text">${text}</div>`;
  document.body.appendChild(overlay);
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.remove();
}

// ─────────────────────────────────────────
// SCREEN NAVIGATION
// ─────────────────────────────────────────

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

// ─────────────────────────────────────────
// FILE UPLOAD HANDLERS
// ─────────────────────────────────────────

document.querySelectorAll('.upload-card input[type="file"]').forEach(input => {
  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const card = input.closest('.upload-card');
    const sourceType = input.dataset.type;

    card.querySelector('.uc-status').textContent = 'Reading...';

    try {
      const text = await file.text();
      let parsed = [];

      switch (sourceType) {
        case 'whatsapp': parsed = parseWhatsApp(text); break;
        case 'instagram': parsed = parseInstagram(text); break;
        case 'twitter': parsed = parseTwitter(text); break;
        case 'imessage': parsed = parseIMessage(text, file.name); break;
      }

      if (parsed.length === 0) {
        throw new Error('No messages found. Check the file format.');
      }

      appState.allMessages = [...appState.allMessages, ...parsed];

      card.classList.add('connected');
      card.querySelector('.uc-status').textContent = `● ${parsed.length.toLocaleString()} msgs`;
      card.querySelector('.uc-name').textContent = card.querySelector('.uc-name').textContent;

    } catch (err) {
      card.classList.add('error');
      card.querySelector('.uc-status').textContent = err.message.slice(0, 40);
      console.error('Parse error:', err);
    }
  });
});

// ─────────────────────────────────────────
// DEMO DATA
// ─────────────────────────────────────────

document.getElementById('loadDemoBtn').addEventListener('click', () => {
  showLoading('Generating demo data...');
  setTimeout(() => {
    appState.allMessages = generateDemoData();
    runAnalysis();
  }, 100);
});

// ─────────────────────────────────────────
// ANALYSIS RUNNER
// ─────────────────────────────────────────

function runAnalysis() {
  showLoading('Analyzing your friendships...');

  setTimeout(() => {
    try {
      appState.analysisResult = analyzeMessages(appState.allMessages, 'You');
      renderDashboard(appState.analysisResult);
      showScreen('screen-dashboard');
    } catch (err) {
      alert('Error analyzing messages: ' + err.message);
      console.error(err);
    } finally {
      hideLoading();
    }
  }, 150);
}

// Back button
document.getElementById('backBtn').addEventListener('click', () => {
  // Destroy charts to free memory
  Object.values(appState.charts).forEach(c => { try { c.destroy(); } catch { } });
  appState.charts = {};
  showScreen('screen-upload');
});

// ─────────────────────────────────────────
// TAB SWITCHING
// ─────────────────────────────────────────

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');
  });
});

// ─────────────────────────────────────────
// DASHBOARD RENDER
// ─────────────────────────────────────────

function renderDashboard(result) {
  renderOverview(result);
  renderPeople(result);
  renderTone(result);
  renderAwards(result);
  renderSearch(result);
}

// ── OVERVIEW ──

function renderOverview(result) {
  const { overview, people } = result;

  document.getElementById('overview-callout').innerHTML =
    `You've exchanged <strong>${overview.totalMessages.toLocaleString()} messages</strong> across <strong>${overview.uniqueSenders} people</strong>. Your busiest month was <strong>${overview.busiestMonth}</strong>.`;

  const statsData = [
    { val: formatLargeNum(overview.totalMessages), label: 'Total messages', cls: 'yellow' },
    { val: overview.uniqueSenders, label: 'People', cls: 'green' },
    { val: formatTime(overview.avgResponseTime), label: 'Avg response time', cls: 'blue' },
    { val: formatLargeNum(overview.totalEmoji), label: 'Emoji sent', cls: 'orange' },
    { val: overview.avgWordsPerMessage, label: 'Avg words/msg', cls: 'red' },
    { val: Object.keys(overview.platforms).length, label: 'Platforms', cls: 'yellow' },
  ];

  document.getElementById('overview-stats').innerHTML = statsData
    .map(s => `<div class="stat-card ${s.cls}"><div class="sc-val">${s.val}</div><div class="sc-label">${s.label}</div></div>`)
    .join('');

  // Activity chart
  if (appState.charts.activity) appState.charts.activity.destroy();
  const actCtx = document.getElementById('activityChart').getContext('2d');
  appState.charts.activity = new Chart(actCtx, {
    type: 'bar',
    data: {
      labels: Array.from({ length: 12 }, (_, i) => `W${i + 1}`),
      datasets: [{
        data: overview.weeklyActivity,
        backgroundColor: 'rgba(232,255,107,0.7)',
        borderRadius: 4,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(240,240,240,0.4)', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(240,240,240,0.4)', font: { size: 10 } } }
      }
    }
  });

  // Day heatmap
  const hm = document.getElementById('dayHeatmap');
  hm.innerHTML = '';
  overview.dayHeatmap.forEach(v => {
    const d = document.createElement('div');
    d.className = 'tl-day';
    d.style.background = `rgba(232,255,107,${0.07 + v * 0.55})`;
    hm.appendChild(d);
  });

  // Top people (top 3)
  const topPeople = people.filter(p => !p.isMe).slice(0, 3);
  document.getElementById('top-people-list').innerHTML = topPeople.map(renderPersonRow).join('');
}

// ── PEOPLE ──

function renderPeople(result) {
  const { people } = result;
  const others = people.filter(p => !p.isMe);

  document.getElementById('all-people-list').innerHTML = others.map(renderPersonRow).join('');

  // Initiator chart
  const top6 = others.slice(0, 6);
  const totalInitiated = top6.map(p => p.initiatedCount || 0);
  const total = top6.map(p => p.messageCount);

  // Convert to percentage "they initiated" vs "you initiated"
  const theyPct = top6.map((p, i) => {
    return total[i] > 0 ? Math.round((p.initiatedCount / Math.max(p.initiatedCount, 1)) * 50 + 25) : 50;
  });
  const youPct = theyPct.map(v => 100 - v);

  if (appState.charts.initiator) appState.charts.initiator.destroy();

  // Set dynamic height
  const wrap = document.getElementById('initiator-wrap');
  wrap.style.height = `${Math.max(200, top6.length * 42 + 60)}px`;

  const iCtx = document.getElementById('initiatorChart').getContext('2d');
  appState.charts.initiator = new Chart(iCtx, {
    type: 'bar',
    data: {
      labels: top6.map(p => p.name.split(' ')[0]),
      datasets: [
        { label: 'You started', data: youPct, backgroundColor: 'rgba(232,255,107,0.7)', borderRadius: 4 },
        { label: 'They started', data: theyPct, backgroundColor: 'rgba(107,181,255,0.4)', borderRadius: 4 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: {
          stacked: true, max: 100,
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: 'rgba(240,240,240,0.4)', font: { size: 10 }, callback: v => v + '%' }
        },
        y: {
          stacked: true,
          grid: { display: false },
          ticks: { color: 'rgba(240,240,240,0.5)', font: { size: 11 } }
        }
      }
    }
  });
}

function renderPersonRow(person) {
  const ac = getAvatarColor(person.name);
  const bondColor = getBondColor(person.bondScore);
  const badge = getBadge(person);
  const platforms = person.platforms.join(', ');
  const sub = `${person.messageCount.toLocaleString()} msgs · ${platforms} · bond ${person.bondScore}`;

  return `<div class="person-row">
    <div class="avatar" style="background:${ac.bg};color:${ac.text}">${getInitials(person.name)}</div>
    <div class="person-info">
      <div class="person-name">${escHtml(person.name)}</div>
      <div class="person-sub">${sub}</div>
    </div>
    <div class="person-bar-wrap">
      <div class="person-bar-bg"><div class="person-bar-fill" style="width:${person.bondScore}%;background:${bondColor}"></div></div>
    </div>
    <div class="person-score" style="color:${bondColor}">${person.bondScore}</div>
  </div>`;
}

function getBondColor(score) {
  if (score >= 75) return '#E8FF6B';
  if (score >= 50) return '#6BFFB8';
  if (score >= 30) return '#6BB5FF';
  return '#FF6B6B';
}

function getBadge(person) {
  if (person.bondScore >= 85) return { label: 'ride or die', cls: 'yellow' };
  if (person.bondScore >= 65) return { label: 'consistent', cls: 'green' };
  if (person.bondScore >= 45) return { label: 'solid', cls: 'blue' };
  if (person.bondScore >= 25) return { label: 'situational', cls: 'orange' };
  return { label: 'ghost', cls: 'red' };
}

// ── TONE ──

function renderTone(result) {
  const { tone } = result;

  const toneColors = {
    warm: '#6BFFB8',
    playful: '#E8FF6B',
    sarcastic: '#FFB86B',
    supportive: '#6BB5FF',
    direct: 'rgba(240,240,240,0.4)',
    confrontational: '#FF6B6B',
  };

  const toneLabels = {
    warm: 'Warm / caring',
    playful: 'Playful / funny',
    sarcastic: 'Sarcastic',
    supportive: 'Supportive',
    direct: 'Direct / blunt',
    confrontational: 'Confrontational',
  };

  // Sort by score
  const sorted = Object.entries(tone.globalTone).sort((a, b) => b[1] - a[1]);

  document.getElementById('tone-bars').innerHTML = sorted.map(([key, val]) => `
    <div class="tone-row">
      <div class="tone-name">${toneLabels[key] || key}</div>
      <div class="tone-bar-bg"><div class="tone-bar-fill" style="width:${val}%;background:${toneColors[key] || '#fff'}"></div></div>
      <div class="tone-pct">${val}%</div>
    </div>`).join('');

  // Dominant tone text
  const dominant = sorted[0]?.[0] || 'neutral';
  document.getElementById('tone-callout').innerHTML =
    `AI-analyzed tone across all your outgoing messages. You come across as mostly <strong>${toneLabels[dominant] || dominant}</strong> — but it shifts depending on who you're talking to.`;

  // Per-person tone
  const toneEmojis = { warm: '🤗 wholesome', playful: '😂 funny', sarcastic: '😏 spicy', supportive: '💪 supportive', direct: '✂️ direct', confrontational: '😤 venting' };
  const toneBadgeCls = { warm: 'green', playful: 'yellow', sarcastic: 'yellow', supportive: 'blue', direct: 'blue', confrontational: 'red' };

  document.getElementById('tone-people').innerHTML = tone.perPersonTone.slice(0, 5).map(p => {
    const ac = getAvatarColor(p.name);
    const dt = p.dominantTone;
    return `<div class="person-row">
      <div class="avatar" style="background:${ac.bg};color:${ac.text}">${getInitials(p.name)}</div>
      <div class="person-info">
        <div class="person-name">${escHtml(p.name)}</div>
        <div class="person-sub">Dominant tone in your chats: ${dt}</div>
      </div>
      <span class="badge badge-${toneBadgeCls[dt] || 'blue'}">${toneEmojis[dt] || dt}</span>
    </div>`;
  }).join('');

  // Word cloud
  const wc = document.getElementById('wordCloud');
  wc.innerHTML = '';
  const maxCount = tone.topWords[0]?.count || 1;
  tone.topWords.forEach((w, i) => {
    const ac = AVATAR_COLORS[i % AVATAR_COLORS.length];
    const size = Math.max(12, Math.round(12 + (w.count / maxCount) * 12));
    const chip = document.createElement('span');
    chip.className = 'word-chip';
    chip.textContent = w.word;
    chip.style.background = ac.bg;
    chip.style.color = ac.text;
    chip.style.fontSize = size + 'px';
    wc.appendChild(chip);
  });
}

// ── AWARDS ──

function renderAwards(result) {
  const { awards } = result;
  document.getElementById('awards-grid').innerHTML = awards.map(a => `
    <div class="mvp-card">
      <div class="mvp-emoji">${a.emoji}</div>
      <div class="mvp-title">${escHtml(a.title)}</div>
      <div class="mvp-winner">${escHtml(a.winner)}</div>
      <div class="mvp-reason">${escHtml(a.reason)}</div>
    </div>`).join('');

  // Radar chart for top 3
  const top3 = result.people.filter(p => !p.isMe).slice(0, 3);
  if (appState.charts.radar) appState.charts.radar.destroy();

  const radarCtx = document.getElementById('radarChart').getContext('2d');
  const radarColors = ['#E8FF6B', '#6BFFB8', '#6BB5FF'];

  appState.charts.radar = new Chart(radarCtx, {
    type: 'radar',
    data: {
      labels: ['Responsiveness', 'Depth', 'Consistency', 'Emoji use', 'Initiation', 'Volume'],
      datasets: top3.map((p, i) => {
        const color = radarColors[i];
        const maxMsgs = result.people[0]?.messageCount || 1;
        return {
          label: p.name,
          data: [
            p.avgResponseTime ? Math.round(Math.max(0, 100 - (p.avgResponseTime / 60) * 5)) : 50,
            Math.min(100, p.avgMessageLength * 5),
            Math.min(100, p.bondScore),
            Math.min(100, Math.round((p.emojiCount / (p.messageCount || 1)) * 50)),
            Math.min(100, Math.round((p.initiatedCount / (p.messageCount || 1)) * 200)),
            Math.round((p.messageCount / maxMsgs) * 100),
          ],
          borderColor: color,
          backgroundColor: color.replace(')', ', 0.08)').replace('rgb', 'rgba'),
          pointBackgroundColor: color,
          borderWidth: 1.5,
        };
      }),
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        r: {
          min: 0, max: 100,
          grid: { color: 'rgba(255,255,255,0.07)' },
          angleLines: { color: 'rgba(255,255,255,0.07)' },
          pointLabels: { color: 'rgba(240,240,240,0.5)', font: { size: 10 } },
          ticks: { display: false }
        }
      }
    }
  });
}

// ─────────────────────────────────────────
// KEYWORD SEARCH
// ─────────────────────────────────────────

function renderSearch(result) {
  // Trending keywords
  const trending = getTrendingKeywords(result.rawMessages);
  const trendingEl = document.getElementById('trendingChips');
  trendingEl.innerHTML = trending.map(t => `
    <div class="trending-chip" data-word="${escHtml(t.word)}">
      ${escHtml(t.word)} <span class="tc-count">${t.count}</span>
    </div>`).join('');

  trendingEl.querySelectorAll('.trending-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const word = chip.dataset.word;
      document.getElementById('keywordInput').value = word;
      doSearch(word);
    });
  });

  // Search button
  document.getElementById('searchBtn').addEventListener('click', () => {
    const q = document.getElementById('keywordInput').value.trim();
    if (q) doSearch(q);
  });

  document.getElementById('keywordInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = e.target.value.trim();
      if (q) doSearch(q);
    }
  });
}

function doSearch(query) {
  const result = appState.analysisResult;
  if (!result) return;

  const searchData = searchKeyword(query, result.rawMessages, result.keywords);

  document.getElementById('search-empty').style.display = 'none';

  if (searchData.totalCount === 0) {
    document.getElementById('search-results').classList.add('hidden');
    document.getElementById('search-empty').style.display = 'block';
    document.getElementById('search-empty').innerHTML = `
      <div class="search-empty-icon">🤷</div>
      <div>No results for "<strong style="color:var(--c-primary)">${escHtml(query)}</strong>" — try a different word or phrase.</div>`;
    return;
  }

  document.getElementById('search-results').classList.remove('hidden');

  // Summary stats
  const firstDate = searchData.firstUsed ? searchData.firstUsed.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '?';
  const lastDate = searchData.lastUsed ? searchData.lastUsed.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '?';

  document.getElementById('search-summary').innerHTML = `
    <div class="summary-stat"><div class="ss-val">${searchData.totalCount.toLocaleString()}</div><div class="ss-label">Total uses</div></div>
    <div class="summary-divider"></div>
    <div class="summary-stat"><div class="ss-val">${searchData.totalMessages.toLocaleString()}</div><div class="ss-label">Messages</div></div>
    <div class="summary-divider"></div>
    <div class="summary-stat"><div class="ss-val">${searchData.senderBreakdown.length}</div><div class="ss-label">People used it</div></div>
    <div class="summary-divider"></div>
    <div class="summary-stat" style="min-width:80px"><div class="ss-val" style="font-size:13px">${firstDate}</div><div class="ss-label">First used</div></div>`;

  // Who used it most
  const topSenders = searchData.senderBreakdown.slice(0, 5);
  const maxCount = topSenders[0]?.count || 1;
  document.getElementById('keyword-people').innerHTML = `<div style="padding:0 14px">${topSenders.map((s, i) => {
    const ac = getAvatarColor(s.sender);
    return `<div class="kw-person-row">
      <div class="kw-rank">${i + 1}</div>
      <div class="kw-avatar" style="background:${ac.bg};color:${ac.text}">${getInitials(s.sender)}</div>
      <div class="kw-name">${escHtml(s.sender)}</div>
      <div>
        <div class="person-bar-bg" style="width:60px;margin-bottom:2px"><div class="person-bar-fill" style="width:${Math.round(s.count/maxCount*100)}%;background:${ac.text}"></div></div>
      </div>
      <div class="kw-count">${s.count}<span class="kw-pct"> (${Math.round(s.count/searchData.totalCount*100)}%)</span></div>
    </div>`;
  }).join('')}</div>`;

  // Timeline chart
  if (appState.charts.keywordTime) appState.charts.keywordTime.destroy();
  const ktCtx = document.getElementById('keywordTimeChart').getContext('2d');
  const labels = searchData.timelineData.map(d => d.month);
  const counts = searchData.timelineData.map(d => d.count);
  appState.charts.keywordTime = new Chart(ktCtx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: counts,
        borderColor: '#E8FF6B',
        backgroundColor: 'rgba(232,255,107,0.08)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#E8FF6B',
        tension: 0.4,
        fill: true,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(240,240,240,0.4)', font: { size: 9 }, maxRotation: 45 } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(240,240,240,0.4)', font: { size: 10 } } }
      }
    }
  });

  // Examples
  document.getElementById('keyword-examples').innerHTML = searchData.examples.map(ex => `
    <div class="example-bubble">
      <div class="example-meta">
        <span>${escHtml(ex.sender)}</span>
        <span>${ex.timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      </div>
      <div class="example-text">${ex.highlightedText}</div>
    </div>`).join('');

  // Context words
  document.getElementById('keyword-context').innerHTML = searchData.contextWords.map(cw => `
    <div class="context-chip">often with: <span>${escHtml(cw.word)}</span> (${cw.count}×)</div>`).join('');
}

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatLargeNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'k';
  return String(n);
}
