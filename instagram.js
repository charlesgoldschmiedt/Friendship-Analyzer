/**
 * parsers/instagram.js
 * Parses Instagram DM exports (messages.json)
 *
 * How to export:
 *   Settings → Your activity → Download your information
 *   Select "Messages", choose JSON format
 *   Unzip archive → messages/inbox/{conversation}/message_1.json
 *
 * Format:
 * {
 *   "participants": [{"name": "..."}, ...],
 *   "messages": [{
 *     "sender_name": "...",
 *     "timestamp_ms": 1234567890000,
 *     "content": "...",
 *     "type": "Generic"
 *   }]
 * }
 */

/**
 * @param {string} jsonText - Raw content of message_1.json
 * @returns {Array<{sender, text, timestamp, platform}>}
 */
export function parseInstagram(jsonText) {
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch {
    throw new Error('Invalid Instagram JSON format. Make sure you selected JSON during export.');
  }

  if (!data.messages || !Array.isArray(data.messages)) {
    throw new Error('No messages found in Instagram export file.');
  }

  const messages = [];

  for (const msg of data.messages) {
    // Skip reactions, shares, clips, etc.
    if (msg.type !== 'Generic' && msg.type !== 'Share') continue;
    if (!msg.content && !msg.share) continue;

    const text = msg.content
      || (msg.share?.link ? `[Shared link: ${msg.share.link}]` : null)
      || null;

    if (!text) continue;

    // Instagram encodes names with latin1/unicode escapes in older exports
    const sender = decodeFBString(msg.sender_name || 'Unknown');
    const decodedText = decodeFBString(text);

    messages.push({
      sender,
      text: decodedText,
      timestamp: new Date(msg.timestamp_ms),
      platform: 'instagram',
    });
  }

  // Instagram exports newest-first; reverse to chronological
  messages.reverse();
  return messages;
}

/**
 * Facebook/Instagram encodes Unicode characters as latin1 escape sequences.
 * e.g. "\u00c3\u00a9" → "é"
 */
function decodeFBString(str) {
  if (!str) return str;
  try {
    return decodeURIComponent(escape(str));
  } catch {
    return str;
  }
}
