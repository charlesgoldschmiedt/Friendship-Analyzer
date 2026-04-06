/**
 * utils/analytics.js
 * Core analytics engine — computes all friendship stats from raw messages
 */

// ─────────────────────────────────────────
// TONE KEYWORD DICTIONARIES
// ─────────────────────────────────────────

const TONE_KEYWORDS = {
  warm: ['love', 'miss', 'care', 'appreciate', 'thank', 'grateful', 'wonderful', 'amazing', 'sweet', 'kind', 'proud', 'happy', 'joy', 'heart', '❤️', '🥰', '😍', '💕', '🫶'],
  playful: ['lol', 'lmao', 'haha', 'hehe', 'lmfao', '😂', '🤣', '😛', '😜', 'omg', 'literally', 'dead', '💀', 'ngl', 'tbh', 'lowkey'],
  sarcastic: ['sure', 'obviously', 'clearly', 'yeah right', 'totally', 'absolutely', 'great job', 'wow thanks', '🙄', 'oh wow', 'fascinating'],
  supportive: ['you got this', 'proud of you', 'believe in you', 'here for you', 'you okay', 'u ok', 'how are you', 'thinking of you', 'rooting for', 'you can do it', '🤗', '💪'],
  direct: ['no', 'stop', 'dont', 'actually', 'wrong', 'incorrect', 'not really', 'disagree', 'wait', 'hold on'],
  confrontational: ['angry', 'mad', 'upset', 'frustrated', 'annoying', 'hate', 'stupid', 'ridiculous', 'unbelievable', 'seriously', 'whatever', '😤', '😠', '🤬'],
};

const STOP_WORDS = new Set([
  'the','and','for','that','this','with','have','from','they','will','been','were','their',
  'what','when','your','just','like','also','then','than','but','not','are','can','its',
  'all','any','get','out','one','had','our','was','who','how','him','his','her','she',
  'him','you','too','via','yet','did','due','got','put','let','set','bit','big','yes',
  'nah','okay','ok','hey','oh','ah','uh','um','hmm','well','yeah','yep','nope','hm',
]);

// ─────────────────────────────────────────
// MAIN ANALYSIS FUNCTION
// ─────────────────────────────────────────

/**
 * @param {Array<{sender, text, timestamp, platform}>} messages
 * @param {string} myName - The user's own name/identifier in the chat
 * @returns {Object} Full analytics object
 */
export function analyzeMessages(messages, myName = 'You') {
  if (!messages || messages.length === 0) {
    throw new Error('No messages to analyze.');
  }

  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);

  return {
    overview: computeOverview(sorted),
    people: computePeopleStats(sorted, myName),
    tone: computeToneStats(sorted, myName),
    awards: computeAwards(sorted, myName),
    keywords: buildKeywordIndex(sorted),
    rawMessages: sorted,
  };
}

// ─────────────────────────────────────────
// OVERVIEW
// ─────────────────────────────────────────

function computeOverview(messages) {
  const totalMessages = messages.length;
  const uniqueSenders = new Set(messages.map(m => m.sender)).size;

  // Weekly message counts (last 12 weeks)
  const now = new Date();
  const twelveWeeksAgo = new Date(now - 12 * 7 * 24 * 60 * 60 * 1000);
  const weekBuckets = Array(12).fill(0);
  for (const msg of messages) {
    if (msg.timestamp >= twelveWeeksAgo) {
      const weeksAgo = Math.floor((now - msg.timestamp) / (7 * 24 * 60 * 60 * 1000));
      const bucket = 11 - Math.min(weeksAgo, 11);
      weekBuckets[bucket]++;
    }
  }

  // Day of week heatmap (0=Mon ... 6=Sun)
  const dayBuckets = Array(7).fill(0);
  for (const msg of messages) {
    const day = (msg.timestamp.getDay() + 6) % 7; // Convert Sun=0 to Mon=0
    dayBuckets[day]++;
  }
  const maxDay = Math.max(...dayBuckets);
  const dayHeatmap = dayBuckets.map(v => maxDay > 0 ? v / maxDay : 0);

  // Platform breakdown
  const platforms = {};
  for (const msg of messages) {
    platforms[msg.platform || 'unknown'] = (platforms[msg.platform || 'unknown'] || 0) + 1;
  }

  // Average response time (minutes)
  const avgResponseTime = computeAvgResponseTime(messages);

  // Busiest month
  const monthCounts = {};
  for (const msg of messages) {
    const key = `${msg.timestamp.getFullYear()}-${msg.timestamp.getMonth()}`;
    monthCounts[key] = (monthCounts[key] || 0) + 1;
  }
  const busiestMonthKey = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  let busiestMonth = 'Unknown';
  if (busiestMonthKey) {
    const [year, month] = busiestMonthKey.split('-').map(Number);
    busiestMonth = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  // Media / emoji stats
  const emojiRegex = /[\u{1F300}-\u{1FFFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
  let totalEmoji = 0;
  let totalWords = 0;
  for (const msg of messages) {
    const emojis = msg.text.match(emojiRegex);
    if (emojis) totalEmoji += emojis.length;
    totalWords += msg.text.split(/\s+/).filter(Boolean).length;
  }

  return {
    totalMessages,
    uniqueSenders,
    weeklyActivity: weekBuckets,
    dayHeatmap,
    platforms,
    avgResponseTime,
    busiestMonth,
    totalEmoji,
    totalWords,
    avgWordsPerMessage: Math.round(totalWords / totalMessages),
  };
}

function computeAvgResponseTime(messages) {
  const responseTimes = [];
  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1];
    const curr = messages[i];
    if (curr.sender !== prev.sender) {
      const diff = (curr.timestamp - prev.timestamp) / 60000; // minutes
      if (diff > 0 && diff < 1440) { // Only count if under 24 hours
        responseTimes.push(diff);
      }
    }
  }
  if (responseTimes.length === 0) return 0;
  const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  return Math.round(avg);
}

// ─────────────────────────────────────────
// PEOPLE STATS
// ─────────────────────────────────────────

function computePeopleStats(messages, myName) {
  const senderMap = {};

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const s = msg.sender;
    if (!senderMap[s]) {
      senderMap[s] = {
        name: s,
        messageCount: 0,
        wordCount: 0,
        initiatedCount: 0,
        responseTimes: [],
        platforms: new Set(),
        firstMessage: msg.timestamp,
        lastMessage: msg.timestamp,
        avgMessageLength: 0,
        longestMessage: 0,
        emojiCount: 0,
      };
    }
    const stats = senderMap[s];
    stats.messageCount++;
    const words = msg.text.split(/\s+/).filter(Boolean);
    stats.wordCount += words.length;
    stats.longestMessage = Math.max(stats.longestMessage, msg.text.length);
    stats.platforms.add(msg.platform || 'unknown');
    stats.lastMessage = msg.timestamp;

    const emojiRegex = /[\u{1F300}-\u{1FFFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    const emojis = msg.text.match(emojiRegex);
    if (emojis) stats.emojiCount += emojis.length;

    // Detect conversation initiation (gap > 3 hours from previous message)
    if (i === 0) {
      stats.initiatedCount++;
    } else {
      const gapMinutes = (msg.timestamp - messages[i - 1].timestamp) / 60000;
      if (gapMinutes > 180 || messages[i - 1].sender === s) {
        // Only count if they're opening a new thread after silence
        if (gapMinutes > 180) stats.initiatedCount++;
      }
    }

    // Response time: if this person responded to someone else
    if (i > 0 && messages[i - 1].sender !== s) {
      const diff = (msg.timestamp - messages[i - 1].timestamp) / 60000;
      if (diff > 0 && diff < 1440) {
        stats.responseTimes.push(diff);
      }
    }
  }

  // Finalize stats
  const totalMessages = messages.length;
  const people = Object.values(senderMap).map(p => {
    const avgResponseTime = p.responseTimes.length > 0
      ? Math.round(p.responseTimes.reduce((a, b) => a + b, 0) / p.responseTimes.length)
      : null;

    const avgMessageLength = Math.round(p.wordCount / p.messageCount);

    // Bond score: weighted combination of factors
    const freqScore = Math.min(100, (p.messageCount / totalMessages) * 100 * 5);
    const responseScore = avgResponseTime ? Math.max(0, 100 - (avgResponseTime / 60) * 10) : 50;
    const consistencyScore = computeConsistency(p.firstMessage, p.lastMessage, p.messageCount);
    const bondScore = Math.round(freqScore * 0.4 + responseScore * 0.3 + consistencyScore * 0.3);

    return {
      name: p.name,
      initials: getInitials(p.name),
      messageCount: p.messageCount,
      wordCount: p.wordCount,
      avgMessageLength,
      longestMessage: p.longestMessage,
      initiatedCount: p.initiatedCount,
      avgResponseTime,
      platforms: Array.from(p.platforms),
      firstMessage: p.firstMessage,
      lastMessage: p.lastMessage,
      emojiCount: p.emojiCount,
      bondScore: Math.min(99, Math.max(1, bondScore)),
      isMe: p.name === myName,
    };
  });

  // Sort by bond score descending, skip "You"
  people.sort((a, b) => b.bondScore - a.bondScore);

  return people;
}

function computeConsistency(firstDate, lastDate, count) {
  const daySpan = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24));
  const messagesPerDay = count / daySpan;
  return Math.min(100, messagesPerDay * 20);
}

// ─────────────────────────────────────────
// TONE ANALYSIS
// ─────────────────────────────────────────

function computeToneStats(messages, myName) {
  const myMessages = messages.filter(m => m.sender === myName);

  const globalTone = scoreTone(myMessages);

  // Per-person tone
  const conversationPartners = [...new Set(messages.filter(m => m.sender !== myName).map(m => m.sender))];

  const perPersonTone = conversationPartners.map(person => {
    // Get my messages in conversations that included this person
    const convoMessages = getConversationWith(messages, myName, person);
    const myInConvo = convoMessages.filter(m => m.sender === myName);
    const tone = scoreTone(myInConvo);
    const dominantTone = getDominantTone(tone);
    return { name: person, tone, dominantTone };
  });

  // Top words (excluding stop words)
  const wordFreq = {};
  for (const msg of myMessages) {
    const words = msg.text.toLowerCase().split(/[\s\W]+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
    for (const word of words) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  }
  const topWords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word, count]) => ({ word, count }));

  return { globalTone, perPersonTone, topWords };
}

function scoreTone(messages) {
  const scores = {};
  let total = 0;

  for (const [tone, keywords] of Object.entries(TONE_KEYWORDS)) {
    let count = 0;
    for (const msg of messages) {
      const text = msg.text.toLowerCase();
      for (const kw of keywords) {
        if (text.includes(kw.toLowerCase())) count++;
      }
    }
    scores[tone] = count;
    total += count;
  }

  if (total === 0) return Object.fromEntries(Object.keys(TONE_KEYWORDS).map(k => [k, 0]));

  return Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, Math.round((v / total) * 100)]));
}

function getDominantTone(toneScores) {
  const entries = Object.entries(toneScores).filter(([, v]) => v > 0);
  if (entries.length === 0) return 'neutral';
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

function getConversationWith(messages, myName, otherName) {
  return messages.filter(m => m.sender === myName || m.sender === otherName);
}

// ─────────────────────────────────────────
// AWARDS
// ─────────────────────────────────────────

function computeAwards(messages, myName) {
  const people = computePeopleStats(messages, myName).filter(p => !p.isMe);
  if (people.length === 0) return [];

  const toneStats = computeToneStats(messages, myName).perPersonTone;
  const toneMap = Object.fromEntries(toneStats.map(p => [p.name, p]));

  const awards = [];

  // MVP: highest bond score
  const mvp = people[0];
  if (mvp) awards.push({
    emoji: '🏆',
    title: 'MVP of the year',
    winner: mvp.name,
    reason: `Highest bond score (${mvp.bondScore}/99). ${mvp.messageCount.toLocaleString()} messages sent.`,
  });

  // Fastest responder
  const fastest = [...people].filter(p => p.avgResponseTime !== null).sort((a, b) => a.avgResponseTime - b.avgResponseTime)[0];
  if (fastest) awards.push({
    emoji: '⚡',
    title: 'Fastest responder',
    winner: fastest.name,
    reason: `Median response time: ${formatTime(fastest.avgResponseTime)}. They're basically always there.`,
  });

  // Slowest responder / ghoster
  const slowest = [...people].filter(p => p.avgResponseTime !== null).sort((a, b) => b.avgResponseTime - a.avgResponseTime)[0];
  if (slowest) awards.push({
    emoji: '👻',
    title: 'The ghoster',
    winner: slowest.name,
    reason: `Average response time: ${formatTime(slowest.avgResponseTime)}. Seen ✓✓`,
  });

  // Most messages
  const mosty = [...people].sort((a, b) => b.messageCount - a.messageCount)[0];
  if (mosty) awards.push({
    emoji: '💬',
    title: 'Most messages sent',
    winner: mosty.name,
    reason: `${mosty.messageCount.toLocaleString()} messages. They have a lot to say.`,
  });

  // Most emoji
  const emojiPerson = [...people].sort((a, b) => b.emojiCount - a.emojiCount)[0];
  if (emojiPerson) awards.push({
    emoji: '😂',
    title: 'Emoji enthusiast',
    winner: emojiPerson.name,
    reason: `${emojiPerson.emojiCount.toLocaleString()} emojis sent. Truly expressive.`,
  });

  // Longest messages (most verbose)
  const verbose = [...people].sort((a, b) => b.avgMessageLength - a.avgMessageLength)[0];
  if (verbose) awards.push({
    emoji: '📚',
    title: 'Over-explainer award',
    winner: verbose.name,
    reason: `Average message: ${verbose.avgMessageLength} words. They're not leaving anything out.`,
  });

  // Most confrontational by tone
  const confrontational = toneStats.sort((a, b) => (b.tone.confrontational || 0) - (a.tone.confrontational || 0))[0];
  if (confrontational) awards.push({
    emoji: '🔥',
    title: 'Most chaotic energy',
    winner: confrontational.name,
    reason: 'Highest confrontational tone score. The group chat instigator.',
  });

  // Most warm / heartfelt
  const heartfelt = toneStats.sort((a, b) => (b.tone.warm || 0) - (a.tone.warm || 0))[0];
  if (heartfelt) awards.push({
    emoji: '💌',
    title: 'Most heartfelt',
    winner: heartfelt.name,
    reason: 'Highest warmth score. Genuine, caring, always checks in.',
  });

  // Conversation starter
  const starter = [...people].sort((a, b) => b.initiatedCount - a.initiatedCount)[0];
  if (starter) awards.push({
    emoji: '🎤',
    title: 'Convo starter',
    winner: starter.name,
    reason: `Started ${starter.initiatedCount} conversations. Never waits for you to reach out first.`,
  });

  // Most non-confrontational
  const peaceful = toneStats.sort((a, b) => (a.tone.confrontational || 0) - (b.tone.confrontational || 0))[0];
  if (peaceful) awards.push({
    emoji: '🕊️',
    title: 'Most non-confrontational',
    winner: peaceful.name,
    reason: 'Near-zero conflict score. Absolute diplomat. Never starts drama.',
  });

  return awards;
}

// ─────────────────────────────────────────
// KEYWORD SEARCH INDEX
// ─────────────────────────────────────────

/**
 * Builds a searchable keyword index from all messages.
 * Call this once during analysis, then use searchKeyword() for fast lookups.
 */
function buildKeywordIndex(messages) {
  // Build word frequency map with positions
  const index = {}; // word → [{msgIndex, sender, timestamp}]

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const words = tokenize(msg.text);
    const seenInMsg = new Set();

    for (const word of words) {
      if (!index[word]) index[word] = [];
      if (!seenInMsg.has(word)) {
        index[word].push({ msgIndex: i, sender: msg.sender, timestamp: msg.timestamp });
        seenInMsg.add(word);
      }
    }
  }

  return index;
}

/**
 * Search for a keyword across all messages.
 * @param {string} query - Search term (word, phrase, or emoji)
 * @param {Array} messages - Original messages array
 * @param {Object} index - Keyword index from buildKeywordIndex
 * @returns {Object} Keyword stats
 */
export function searchKeyword(query, messages, index) {
  const q = query.toLowerCase().trim();
  if (!q) return null;

  const isPhrase = q.includes(' ');

  let matchingMessages;

  if (isPhrase) {
    // Phrase search: scan all messages
    matchingMessages = messages
      .map((m, i) => ({ msg: m, index: i }))
      .filter(({ msg }) => msg.text.toLowerCase().includes(q));
  } else {
    // Single word: use index
    const tokens = tokenize(q);
    const primaryToken = tokens[0];
    const indexed = index[primaryToken] || [];

    // Also do a substring search for partial matches
    const substringMatches = messages
      .map((m, i) => ({ msg: m, index: i }))
      .filter(({ msg }) => msg.text.toLowerCase().includes(q));

    // Merge and deduplicate
    const seen = new Set(indexed.map(e => e.msgIndex));
    const extra = substringMatches.filter(({ index: i }) => !seen.has(i));
    matchingMessages = [
      ...indexed.map(e => ({ msg: messages[e.msgIndex], index: e.msgIndex })),
      ...extra,
    ];
  }

  if (matchingMessages.length === 0) {
    return { query, totalCount: 0, senderBreakdown: [], timelineData: [], examples: [], contextWords: [] };
  }

  // Count by sender
  const senderCounts = {};
  for (const { msg } of matchingMessages) {
    senderCounts[msg.sender] = (senderCounts[msg.sender] || 0) + 1;
  }
  const senderBreakdown = Object.entries(senderCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([sender, count]) => ({ sender, count, initials: getInitials(sender) }));

  // Timeline (by month)
  const monthCounts = {};
  for (const { msg } of matchingMessages) {
    const key = `${msg.timestamp.getFullYear()}-${String(msg.timestamp.getMonth() + 1).padStart(2, '0')}`;
    monthCounts[key] = (monthCounts[key] || 0) + 1;
  }
  const timelineData = Object.entries(monthCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([month, count]) => ({ month, count }));

  // Examples (most recent 5)
  const examples = matchingMessages
    .sort((a, b) => b.msg.timestamp - a.msg.timestamp)
    .slice(0, 5)
    .map(({ msg }) => ({
      sender: msg.sender,
      text: msg.text,
      timestamp: msg.timestamp,
      highlightedText: highlightKeyword(msg.text, q),
    }));

  // Context words (what appears near this keyword)
  const contextWords = getContextWords(matchingMessages.map(m => m.msg), q);

  // Total occurrences (count all instances, not just messages)
  let totalCount = 0;
  for (const { msg } of matchingMessages) {
    const matches = msg.text.toLowerCase().split(q).length - 1;
    totalCount += matches;
  }

  return {
    query,
    totalCount,
    totalMessages: matchingMessages.length,
    senderBreakdown,
    timelineData,
    examples,
    contextWords,
    firstUsed: matchingMessages.sort((a, b) => a.msg.timestamp - b.msg.timestamp)[0]?.msg.timestamp,
    lastUsed: matchingMessages.sort((a, b) => b.msg.timestamp - a.msg.timestamp)[0]?.msg.timestamp,
  };
}

function getContextWords(messages, query) {
  const contextFreq = {};
  const qTokens = new Set(tokenize(query));

  for (const msg of messages) {
    const words = msg.text.toLowerCase().split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const word = words[i].replace(/[^\w]/g, '');
      if (word.includes(query.replace(/\s/g, '')) || qTokens.has(word)) {
        // Grab surrounding words
        for (let j = Math.max(0, i - 3); j <= Math.min(words.length - 1, i + 3); j++) {
          if (j !== i) {
            const w = words[j].replace(/[^\w]/g, '').toLowerCase();
            if (w.length > 2 && !STOP_WORDS.has(w) && !qTokens.has(w)) {
              contextFreq[w] = (contextFreq[w] || 0) + 1;
            }
          }
        }
      }
    }
  }

  return Object.entries(contextFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));
}

function highlightKeyword(text, keyword) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
}

// ─────────────────────────────────────────
// TRENDING KEYWORDS
// ─────────────────────────────────────────

/**
 * Compute top trending words/phrases from all messages.
 * @param {Array} messages
 * @param {number} limit
 * @returns {Array<{word, count}>}
 */
export function getTrendingKeywords(messages, limit = 15) {
  const wordFreq = {};
  for (const msg of messages) {
    const words = tokenize(msg.text).filter(w => w.length > 2 && !STOP_WORDS.has(w));
    for (const word of words) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  }

  return Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

// ─────────────────────────────────────────
// DEMO DATA GENERATOR
// ─────────────────────────────────────────

export function generateDemoData() {
  const people = [
    { name: 'Jamie L.', weight: 0.28 },
    { name: 'Marcus K.', weight: 0.18 },
    { name: 'Sofia R.', weight: 0.15 },
    { name: 'Dev T.', weight: 0.12 },
    { name: 'Priya S.', weight: 0.10 },
    { name: 'Alex M.', weight: 0.07 },
    { name: 'Jordan B.', weight: 0.06 },
    { name: 'Casey N.', weight: 0.04 },
  ];

  const sampleTexts = [
    'omg did you see that', 'lmaooo no way', 'wait what happened', 'fr fr that was wild',
    'I love you bestie', 'ok but hear me out', 'lowkey obsessed with this', 'haha yeah',
    'miss you sm', 'you ok?', 'bro what', 'this is sending me 💀', 'literally cannot',
    'ok that is so funny', 'wait tell me everything', 'no way are you serious',
    'hahaha oh my god', 'bestie I need to tell you something', 'honestly same',
    'ok but that is kind of amazing', 'lol what', 'you got this!', 'proud of you ngl',
    'ok this is unhinged', 'fascinating 🙄', 'whatever lol', 'yeah right sure',
    'omg same', 'wait hold on', 'actually that makes sense', 'no that is wrong lol',
    'love this energy', 'okay okay okay', 'hm interesting', 'mood',
    'I miss our friendship bursts tbh', 'we should hang soon', 'YES finally',
    'ok I am obsessed', 'sending this to everyone', 'you are literally the funniest',
    'this sent me into orbit 💀', 'lmfao okay', 'ok but for real though',
    'idk man', 'we stan', 'period.', 'no notes', 'slay tbh',
  ];

  const now = Date.now();
  const yearAgo = now - 365 * 24 * 60 * 60 * 1000;
  const messages = [];

  for (let i = 0; i < 2000; i++) {
    const person = weightedRandom(people);
    const isMe = Math.random() < 0.45;
    const ts = new Date(yearAgo + Math.random() * (now - yearAgo));

    messages.push({
      sender: isMe ? 'You' : person.name,
      text: sampleTexts[Math.floor(Math.random() * sampleTexts.length)],
      timestamp: ts,
      platform: Math.random() > 0.5 ? 'imessage' : 'whatsapp',
    });
  }

  return messages.sort((a, b) => a.timestamp - b.timestamp);
}

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

function tokenize(text) {
  return text.toLowerCase().split(/[\s\W]+/).filter(w => w.length > 0);
}

function getInitials(name) {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
}

function formatTime(minutes) {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}

function weightedRandom(items) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

export { getInitials, formatTime };
