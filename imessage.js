/**
 * parsers/imessage.js
 * Parses iMessage exports in CSV or JSON format
 *
 * Recommended export tool: iMazing (free trial)
 *   https://imazing.com → Select device → Messages → Export as CSV
 *
 * Expected CSV columns (iMazing format):
 *   Date, Sender, Text, Read Date, Delivered Date, etc.
 *
 * Also supports simple JSON array format:
 *   [{ "date": "...", "sender": "...", "text": "..." }, ...]
 */

/**
 * @param {string} content - CSV or JSON file content
 * @param {string} filename - Original filename (used to detect format)
 * @returns {Array<{sender, text, timestamp, platform}>}
 */
export function parseIMessage(content, filename = '') {
  const ext = filename.toLowerCase().split('.').pop();

  if (ext === 'json') return parseIMessageJSON(content);
  if (ext === 'csv') return parseIMessageCSV(content);

  // Auto-detect
  const trimmed = content.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return parseIMessageJSON(content);
  }
  return parseIMessageCSV(content);
}

function parseIMessageJSON(jsonText) {
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch {
    throw new Error('Invalid JSON format for iMessage export.');
  }

  if (!Array.isArray(data)) data = [data];

  return data
    .filter(m => m && (m.text || m.body || m.message))
    .map(m => ({
      sender: m.sender || m.from || m.author || 'Unknown',
      text: (m.text || m.body || m.message || '').trim(),
      timestamp: parseFlexibleDate(m.date || m.timestamp || m.datetime),
      platform: 'imessage',
    }))
    .filter(m => m.text.length > 0);
}

function parseIMessageCSV(csvText) {
  const lines = csvText.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

  // Map common column name variations
  const colMap = {
    sender: findCol(headers, ['sender', 'from', 'author', 'contact', 'phone number']),
    text: findCol(headers, ['text', 'message', 'body', 'content', 'message text']),
    date: findCol(headers, ['date', 'timestamp', 'datetime', 'date sent', 'message date']),
    isMe: findCol(headers, ['is from me', 'sent by me', 'outgoing', 'direction']),
  };

  const messages = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);

    const text = colMap.text !== -1 ? (cols[colMap.text] || '').trim() : '';
    if (!text || text === '<attachment>') continue;

    let sender = colMap.sender !== -1 ? (cols[colMap.sender] || '').trim() : 'Unknown';
    const dateStr = colMap.date !== -1 ? cols[colMap.date] : '';
    const isMe = colMap.isMe !== -1 ? cols[colMap.isMe] : null;

    // Normalize "Me" / "you" / outgoing markers
    if (isMe && (isMe === '1' || isMe === 'true' || isMe.toLowerCase() === 'yes')) {
      sender = 'You';
    }

    messages.push({
      sender,
      text,
      timestamp: parseFlexibleDate(dateStr),
      platform: 'imessage',
    });
  }

  return messages;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function findCol(headers, candidates) {
  for (const c of candidates) {
    const idx = headers.findIndex(h => h.includes(c));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseFlexibleDate(dateStr) {
  if (!dateStr) return new Date();
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
}
