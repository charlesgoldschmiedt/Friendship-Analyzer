/**
 * parsers/whatsapp.js
 * Parses WhatsApp exported _chat.txt files
 *
 * Export format: Settings → Chat → Export Chat → Without Media
 * Typical line format:
 *   [MM/DD/YYYY, HH:MM:SS] Name: message
 *   or
 *   DD/MM/YYYY, HH:MM - Name: message  (older Android format)
 */

/**
 * @param {string} text - Raw content of _chat.txt
 * @returns {Array<{sender, text, timestamp, platform}>}
 */
export function parseWhatsApp(text) {
  const messages = [];

  // Handles both iOS and Android export formats
  const patterns = [
    // iOS: [12/25/2023, 3:45:22 PM] John: Hello
    /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]\s+([^:]+):\s+(.+)$/,
    // Android: 12/25/2023, 15:45 - John: Hello
    /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\s+-\s+([^:]+):\s+(.+)$/,
    // Android (DD/MM format): 25/12/2023, 15:45 - John: Hello
    /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2})\s+-\s+([^:]+):\s+([\s\S]+)$/,
  ];

  const systemMessages = [
    /Messages and calls are end-to-end encrypted/i,
    /created group/i,
    /added you/i,
    /changed the (subject|icon)/i,
    /left$/i,
    /removed$/i,
    /<Media omitted>/i,
    /This message was deleted/i,
    /security code changed/i,
    /changed their phone number/i,
  ];

  const lines = text.split('\n');
  let currentMessage = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let matched = false;
    for (const pattern of patterns) {
      const m = trimmed.match(pattern);
      if (m) {
        // Save previous message
        if (currentMessage) messages.push(currentMessage);

        const [, datePart, timePart, sender, messageText] = m;
        const timestamp = parseWhatsAppDate(datePart, timePart);

        // Skip system messages
        const isSystem = systemMessages.some(p => p.test(messageText));
        if (isSystem) { currentMessage = null; matched = true; break; }

        currentMessage = {
          sender: sender.trim(),
          text: messageText.trim(),
          timestamp,
          platform: 'whatsapp',
        };
        matched = true;
        break;
      }
    }

    // Multi-line message continuation
    if (!matched && currentMessage) {
      currentMessage.text += '\n' + trimmed;
    }
  }

  if (currentMessage) messages.push(currentMessage);

  return messages.filter(m => m.text && m.text.length > 0);
}

function parseWhatsAppDate(datePart, timePart) {
  try {
    const dateParts = datePart.split('/').map(Number);
    let month, day, year;

    // Detect MM/DD vs DD/MM by checking if first part > 12
    if (dateParts[0] > 12) {
      [day, month, year] = dateParts;
    } else {
      [month, day, year] = dateParts;
    }

    if (year < 100) year += 2000;

    // Parse time with AM/PM support
    let hours = 0, minutes = 0, seconds = 0;
    const timeCleaned = timePart.trim();
    const isPM = /PM/i.test(timeCleaned);
    const isAM = /AM/i.test(timeCleaned);
    const timeNumbers = timeCleaned.replace(/[AP]M/i, '').trim().split(':').map(Number);

    [hours, minutes, seconds = 0] = timeNumbers;
    if (isPM && hours !== 12) hours += 12;
    if (isAM && hours === 12) hours = 0;

    return new Date(year, month - 1, day, hours, minutes, seconds);
  } catch {
    return new Date();
  }
}
