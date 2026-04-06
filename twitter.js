/**
 * parsers/twitter.js
 * Parses Twitter/X DM export (direct-messages.js)
 *
 * How to export:
 *   Settings → Your account → Download an archive → Request archive
 *   Unzip → data/direct-messages.js
 *
 * Format: JavaScript file that sets a global variable:
 *   window.YTD.direct_messages.part0 = [ { dmConversation: {...} } ]
 *
 * This parser strips the JS wrapper and parses the JSON inside.
 */

/**
 * @param {string} rawText - Raw content of direct-messages.js
 * @returns {Array<{sender, text, timestamp, platform, conversationId}>}
 */
export function parseTwitter(rawText) {
  // Strip the JS variable assignment wrapper to get raw JSON
  let jsonText = rawText
    .replace(/^window\.YTD\.direct_messages\.part\d+\s*=\s*/, '')
    .replace(/^window\.YTD\.direct_message_group\.part\d+\s*=\s*/, '')
    .trim();

  // Remove trailing semicolon if present
  if (jsonText.endsWith(';')) jsonText = jsonText.slice(0, -1);

  let data;
  try {
    data = JSON.parse(jsonText);
  } catch {
    throw new Error('Could not parse Twitter DM file. Make sure it\'s the direct-messages.js from your archive.');
  }

  if (!Array.isArray(data)) {
    throw new Error('Unexpected Twitter DM format.');
  }

  const messages = [];

  for (const conversation of data) {
    const convo = conversation.dmConversation || conversation;
    const conversationId = convo.conversationId || 'unknown';
    const msgList = convo.messages || [];

    for (const entry of msgList) {
      const msg = entry.messageCreate || entry;
      if (!msg) continue;

      const text = msg.text;
      if (!text || text.trim() === '') continue;

      messages.push({
        sender: msg.senderId || 'unknown',
        text: text.trim(),
        timestamp: msg.createdAt ? new Date(msg.createdAt) : new Date(),
        platform: 'twitter',
        conversationId,
        senderId: msg.senderId,
        recipientId: msg.recipientId,
      });
    }
  }

  // Sort chronologically
  messages.sort((a, b) => a.timestamp - b.timestamp);
  return messages;
}

/**
 * Twitter exports use user IDs as senders rather than display names.
 * This function attempts to build a name map from the conversation context.
 * For accurate names, users would need to cross-reference with users.js in the archive.
 *
 * @param {Array} messages
 * @param {string} myId - The authenticated user's Twitter ID (optional)
 * @returns {Array} Messages with humanized sender names
 */
export function enrichTwitterSenders(messages, myId = null) {
  const idToName = {};

  if (myId) idToName[myId] = 'You';

  // Build a simple map: assign friendly names to unknown IDs
  let counter = 1;
  for (const msg of messages) {
    if (!idToName[msg.senderId]) {
      idToName[msg.senderId] = msg.senderId === myId ? 'You' : `Person ${counter++}`;
    }
  }

  return messages.map(m => ({
    ...m,
    sender: idToName[m.senderId] || m.sender,
  }));
}
