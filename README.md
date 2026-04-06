# Social Bond Analyzer 🫶

> Find out who really shows up, who ghosts, who makes you laugh, and the stats behind every friendship.

A **fully local, privacy-first** web app that analyzes your exported chat data from iMessage, WhatsApp, Instagram DMs, and Twitter/X. No servers. No uploads. Everything runs in your browser.

---

## Features

### 📊 Overview Tab
- Total messages, people, response times, emoji counts
- 12-week message activity chart
- Day-of-week heatmap (when you text most)
- Top closest contacts

### 👥 People Tab
- Everyone ranked by **Bond Score** (frequency + response time + consistency + who initiates)
- Who starts conversations more — you or them?

### 🎭 Tone Tab
- AI tone breakdown: warm, playful, sarcastic, supportive, direct, confrontational
- How your tone shifts per person
- Your most-used words visualized as a word cloud

### 🏆 Awards Tab
- **MVP of the year** — highest bond score
- **Funniest** — most emoji / reactions
- **Biggest ghoster** — slowest to respond
- **Most chaotic** — highest confrontational tone
- **Most heartfelt** — highest warmth score
- **Fastest responder**, **Over-explainer**, **Convo starter**, and more
- Radar chart comparing your top 3 friendships

### 🔍 Keyword Search Tab
- Search any word, phrase, or emoji
- See **total uses**, **who used it most**, **usage over time** (monthly timeline chart)
- Recent message examples with keyword highlighted
- Context words — what else appears near that word
- One-click trending words from your own chats

---

## Getting Started

### Option 1: Open directly (no build step needed)

```bash
git clone https://github.com/YOUR_USERNAME/social-bond-analyzer.git
cd social-bond-analyzer
```

Then open `index.html` in a browser that supports ES modules. Chrome, Firefox, and Safari all work. You can also serve it locally:

```bash
# Python 3
python3 -m http.server 3000
# then open http://localhost:3000

# Node.js (npx)
npx serve .
# then open http://localhost:3000
```

> **Note:** You must use a local server (not `file://`) because ES modules require HTTP. The Python command above is the easiest way.

### Option 2: Try the demo

Click **"Try with demo data"** on the upload screen to explore with generated sample data — no file needed.

---

## Exporting Your Chat Data

### 💬 iMessage
1. Download [iMazing](https://imazing.com) (free trial is enough)
2. Connect your iPhone or select a local backup
3. Click **Messages** → select a conversation
4. Click **Export** → choose **CSV** or **JSON**
5. Upload the exported file in the app

### 📱 WhatsApp
1. Open any individual or group chat
2. Tap the contact/group name → **Export Chat**
3. Choose **Without Media** (the `.txt` file)
4. Upload `_chat.txt` in the app

*Supports both iOS and Android export formats.*

### 📸 Instagram DMs
1. Go to **Settings** → **Your activity** → **Download your information**
2. Select **Messages**, set format to **JSON**
3. Request the download (may take a few hours)
4. Unzip the archive → `messages/inbox/{conversation}/message_1.json`
5. Upload that JSON file in the app

### 𝕏 Twitter/X DMs
1. Go to **Settings** → **Your account** → **Download an archive**
2. Request the archive (may take a few hours/days)
3. Unzip → find `data/direct-messages.js`
4. Upload that file in the app

---

## Privacy

**All processing is 100% local.** Your messages are never sent anywhere. The app uses no backend, no analytics, no cookies. Everything runs in your browser's JavaScript engine.

---

## Project Structure

```
social-bond-analyzer/
├── index.html                  # Main app HTML
├── src/
│   ├── main.js                 # App controller, UI, rendering
│   ├── styles.css              # All styles
│   ├── parsers/
│   │   ├── whatsapp.js         # WhatsApp _chat.txt parser
│   │   ├── instagram.js        # Instagram messages.json parser
│   │   ├── twitter.js          # Twitter direct-messages.js parser
│   │   └── imessage.js         # iMessage CSV/JSON parser
│   └── utils/
│       └── analytics.js        # All stats computation + keyword search
└── README.md
```

---

## How the Bond Score Works

The **Bond Score** (0–99) is a weighted combination of:

| Factor | Weight | How it's measured |
|---|---|---|
| Message frequency | 40% | Your share of total messages with this person |
| Response speed | 30% | Average time to reply (lower = better score) |
| Consistency | 30% | Messages per day over the relationship span |

---

## How Keyword Search Works

The engine builds an **inverted index** at analysis time — mapping every unique word to the list of messages containing it. When you search:

1. **Single words** hit the index directly (fast)
2. **Phrases** do a substring scan over all messages
3. Emoji are matched as-is (Unicode-aware)

Results include:
- Total occurrence count (counts every instance in a message, not just unique messages)
- Per-sender breakdown with percentage
- Monthly usage timeline
- Most recent 5 examples with highlighting
- Context words (what words commonly appear near your search term)

---

## Extending the App

### Adding a new platform parser

Create `src/parsers/yourplatform.js` and export a `parseYourPlatform(text)` function that returns an array of:

```js
{
  sender: string,      // Display name of the sender
  text: string,        // Message text
  timestamp: Date,     // When it was sent
  platform: string,    // e.g. 'yourplatform'
}
```

Then import it in `main.js` and wire it to a new upload card in `index.html`.

### Adjusting tone keywords

Edit the `TONE_KEYWORDS` dictionary in `src/utils/analytics.js`. Each key maps to an array of words/emoji that signal that tone.

---

## Browser Compatibility

| Browser | Support |
|---|---|
| Chrome 90+ | ✅ Full |
| Firefox 90+ | ✅ Full |
| Safari 15+ | ✅ Full |
| Edge 90+ | ✅ Full |
| IE | ❌ Not supported |

---

## License

MIT — do whatever you want with it.
