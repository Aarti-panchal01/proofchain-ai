# ProofChain AI — Complete Build Instructions for Codex
# READ THIS ENTIRE FILE BEFORE WRITING A SINGLE LINE OF CODE.
# Every decision is already made. Do not improvise. Do not ask questions.
# Build exactly what is described. Nothing more, nothing less.

---

## WHAT YOU ARE BUILDING

A single full-stack web application called **ProofChain AI**.

A user pastes a GitHub repository URL or freeform resume/bio text.
The app sends it to the Claude AI API, which returns a structured JSON analysis.
The app displays a beautiful "Verification Card" showing:
- An overall Trust Score (0–100)
- A skill breakdown with individual scores
- A one-paragraph AI summary
- A "Proof ID" (a SHA-256 hash of the input + timestamp, displayed as a badge)
- A shareable link (just the current URL with a query param)

That's the entire product. No login. No database. No blockchain. No queue. No worker.
Everything runs in one Node.js process. State lives in memory for the session.

---

## TECH STACK — NON-NEGOTIABLE

- **Runtime:** Node.js 20
- **Framework:** Express.js (NOT Next.js, NOT Fastify — Express)
- **Frontend:** Vanilla HTML + CSS + vanilla JavaScript served as static files from Express
- **AI:** Anthropic Claude API (`claude-sonnet-4-20250514`) via the `@anthropic-ai/sdk` npm package
- **GitHub data fetching:** Native `fetch()` hitting the GitHub REST API (no octokit)
- **Hashing:** Node.js built-in `crypto` module, SHA-256
- **Styling:** Hand-written CSS in a single `public/style.css` file. NO Tailwind. NO Bootstrap. NO component libraries.
- **No TypeScript.** Plain `.js` files only.
- **No database.** No Redis. No Qdrant. No Celery. No Docker (unless specified).
- **No React.** No Vue. No Svelte. Pure DOM manipulation.

---

## PROJECT STRUCTURE — CREATE EXACTLY THIS

```
/proofchain/
├── package.json
├── .env.example
├── .gitignore
├── README.md
├── server.js                  ← Express app, all routes, all logic
└── public/
    ├── index.html             ← Single page app (one HTML file)
    ├── style.css              ← All styles (one CSS file)
    └── app.js                 ← All frontend JS (one JS file)
```

No subdirectories beyond `public/`. No `src/`. No `lib/`. No `routes/`. No `controllers/`.
Everything backend lives in `server.js`. Everything frontend lives in `public/`.

---

## ENVIRONMENT VARIABLES

Create `.env.example` with exactly these keys:

```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GITHUB_TOKEN=your_github_personal_access_token_here
PORT=3000
```

The server reads these via `process.env`. Use the `dotenv` package (`require('dotenv').config()` at top of `server.js`).

`GITHUB_TOKEN` is optional — if missing, GitHub API calls proceed unauthenticated (60 req/hr limit, fine for demo).

---

## package.json — WRITE THIS EXACTLY

```json
{
  "name": "proofchain-ai",
  "version": "1.0.0",
  "description": "AI-powered skill and project verification",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.24.0",
    "dotenv": "^16.4.5",
    "express": "^4.19.2"
  }
}
```

No other dependencies. Do not add `axios`, `cors`, `helmet`, `node-fetch`, or anything else.

---

## server.js — COMPLETE IMPLEMENTATION

Write `server.js` with exactly these sections in order:

### Section 1: Imports and setup
```javascript
require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
```

### Section 2: GitHub data fetcher function
Write an async function `fetchGitHubData(githubUrl)` that:
1. Parses the URL to extract `owner` and `repo` from a URL like `https://github.com/owner/repo` or `https://github.com/owner/repo/tree/main` — use a regex: `/github\.com\/([^\/]+)\/([^\/\?#]+)/`
2. Makes these fetch calls in parallel using `Promise.all`:
   - `https://api.github.com/repos/{owner}/{repo}` — gets repo metadata (description, stars, forks, language, created_at, updated_at)
   - `https://api.github.com/repos/{owner}/{repo}/languages` — gets language breakdown object
   - `https://api.github.com/repos/{owner}/{repo}/commits?per_page=10` — gets last 10 commits
   - `https://api.github.com/repos/{owner}/{repo}/readme` — gets README (base64 encoded, decode it)
3. All fetch calls include header `Authorization: token ${process.env.GITHUB_TOKEN}` if `GITHUB_TOKEN` is set, otherwise omit it
4. All fetch calls include header `User-Agent: ProofChain-AI`
5. If the README fetch fails (404), set readme to empty string — do not throw
6. If the repo fetch returns a non-200 status, throw an Error with message `GitHub repo not found or is private`
7. Returns an object:
```javascript
{
  name: repo.name,
  description: repo.description || '',
  stars: repo.stargazers_count,
  forks: repo.forks_count,
  primaryLanguage: repo.language || 'Unknown',
  languages: languagesObj,         // e.g. { JavaScript: 45231, Python: 12000 }
  createdAt: repo.created_at,
  updatedAt: repo.updated_at,
  commitMessages: commits.slice(0,10).map(c => c.commit.message.split('\n')[0]),
  readmeSnippet: readmeText.slice(0, 800)   // first 800 chars only
}
```

### Section 3: Claude analysis function
Write an async function `analyzeWithClaude(inputType, inputData)` where:
- `inputType` is either `'github'` or `'text'`
- `inputData` is either the GitHub data object (from Section 2) or a raw string (resume/bio text)

Build a `userMessage` string as follows:

If `inputType === 'github'`:
```
Analyze this GitHub repository data and evaluate the developer's skills and project quality.

Repository: ${inputData.name}
Description: ${inputData.description}
Primary Language: ${inputData.primaryLanguage}
All Languages: ${JSON.stringify(inputData.languages)}
Stars: ${inputData.stars} | Forks: ${inputData.forks}
Created: ${inputData.createdAt} | Last Updated: ${inputData.updatedAt}
Recent Commit Messages:
${inputData.commitMessages.map((m, i) => `${i+1}. ${m}`).join('\n')}
README Preview:
${inputData.readmeSnippet}
```

If `inputType === 'text'`:
```
Analyze this developer's resume/profile and evaluate their skills and credibility.

Profile Text:
${inputData}
```

Then append to `userMessage` regardless of type:
```

Respond with ONLY a valid JSON object. No markdown, no backticks, no explanation. Just the JSON.

The JSON must have exactly this structure:
{
  "trustScore": <integer 0-100, overall credibility/quality score>,
  "summary": "<2-3 sentence plain English summary of this developer/project. Be specific, not generic.>",
  "skills": [
    { "name": "<skill name>", "score": <integer 0-100>, "note": "<one short sentence about this skill>" },
    ... (return between 4 and 7 skills)
  ],
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "weaknesses": ["<weakness or gap 1>", "<weakness or gap 2>"],
  "verdict": "<one punchy sentence verdict, like a senior engineer's final take>"
}
```

Call Claude:
```javascript
const message = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  system: 'You are a senior engineering hiring manager and open source contributor with 15 years of experience. You evaluate developer profiles and codebases with precision and honesty. You always respond with valid JSON only — no markdown, no explanation.',
  messages: [{ role: 'user', content: userMessage }]
});
```

Extract the text: `const rawText = message.content[0].text.trim();`

Parse it: `const result = JSON.parse(rawText);`

If JSON.parse throws, throw Error: `AI returned invalid JSON. Try again.`

Return `result`.

### Section 4: Proof ID generator function
Write a function `generateProofId(inputString)`:
```javascript
function generateProofId(inputString) {
  const timestamp = Date.now().toString();
  const hash = crypto.createHash('sha256').update(inputString + timestamp).digest('hex');
  return 'PC-' + hash.slice(0, 16).toUpperCase();
}
```

### Section 5: API Routes

**Route 1: POST `/api/analyze`**

Request body:
```json
{ "type": "github", "input": "https://github.com/owner/repo" }
// OR
{ "type": "text", "input": "I am a developer with 5 years of experience..." }
```

Implementation:
```javascript
app.post('/api/analyze', async (req, res) => {
  try {
    const { type, input } = req.body;

    if (!type || !input) {
      return res.status(400).json({ error: 'Missing type or input' });
    }
    if (!['github', 'text'].includes(type)) {
      return res.status(400).json({ error: 'type must be "github" or "text"' });
    }
    if (typeof input !== 'string' || input.trim().length < 10) {
      return res.status(400).json({ error: 'Input too short' });
    }

    let inputData;
    if (type === 'github') {
      inputData = await fetchGitHubData(input.trim());
    } else {
      inputData = input.trim();
    }

    const analysis = await analyzeWithClaude(type, inputData);
    const proofId = generateProofId(input.trim());

    return res.json({
      proofId,
      type,
      inputLabel: type === 'github' ? inputData.name : 'Resume/Profile',
      analysis,
      generatedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error('Analysis error:', err.message);
    return res.status(500).json({ error: err.message || 'Analysis failed' });
  }
});
```

**Route 2: GET `/` — serve index.html**
Express static middleware already handles this. No extra route needed.

### Section 6: Server start
```javascript
app.listen(PORT, () => {
  console.log(`ProofChain AI running at http://localhost:${PORT}`);
});
```

---

## public/index.html — COMPLETE IMPLEMENTATION

Write a single HTML file. Do NOT use any framework. Link to `style.css` and `app.js`.

The HTML structure must be exactly:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ProofChain AI — Developer Verification</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>

  <!-- HEADER -->
  <header class="site-header">
    <div class="logo">
      <span class="logo-icon">⬡</span>
      <span class="logo-text">ProofChain <span class="logo-accent">AI</span></span>
    </div>
    <p class="tagline">Verify developer credibility in 10 seconds.</p>
  </header>

  <!-- MAIN CONTENT -->
  <main class="container">

    <!-- INPUT CARD -->
    <section class="card input-card" id="input-section">
      <h2 class="card-title">Analyze a Developer</h2>

      <!-- TAB SWITCHER -->
      <div class="tab-group" role="tablist">
        <button class="tab active" data-tab="github" role="tab" aria-selected="true">
          GitHub Repo
        </button>
        <button class="tab" data-tab="text" role="tab" aria-selected="false">
          Resume / Bio
        </button>
      </div>

      <!-- GITHUB INPUT -->
      <div class="input-panel" id="panel-github">
        <label class="input-label" for="github-url">GitHub Repository URL</label>
        <input
          type="url"
          id="github-url"
          class="text-input"
          placeholder="https://github.com/torvalds/linux"
          autocomplete="off"
        />
        <p class="input-hint">Public repositories only. Private repos cannot be analyzed.</p>
      </div>

      <!-- TEXT INPUT -->
      <div class="input-panel hidden" id="panel-text">
        <label class="input-label" for="resume-text">Paste Resume or Bio</label>
        <textarea
          id="resume-text"
          class="text-input textarea"
          placeholder="Paste your resume, LinkedIn bio, or any text describing your skills and experience..."
          rows="7"
        ></textarea>
        <p class="input-hint">Minimum 50 characters. The more detail, the better the analysis.</p>
      </div>

      <button class="btn-analyze" id="analyze-btn">
        <span class="btn-text">Analyze Now</span>
        <span class="btn-spinner hidden" aria-hidden="true"></span>
      </button>

      <p class="error-msg hidden" id="error-msg" role="alert"></p>
    </section>

    <!-- RESULT CARD (hidden until analysis done) -->
    <section class="card result-card hidden" id="result-section">

      <!-- PROOF BADGE -->
      <div class="proof-badge-row">
        <div class="proof-badge">
          <span class="proof-icon">✓</span>
          <div class="proof-text">
            <span class="proof-label">Proof ID</span>
            <span class="proof-id" id="proof-id">PC-XXXXXXXXXXXXXXXX</span>
          </div>
        </div>
        <div class="proof-meta">
          <span class="proof-timestamp" id="proof-timestamp"></span>
        </div>
      </div>

      <!-- SUBJECT NAME -->
      <h2 class="result-title" id="result-title">Analysis Result</h2>

      <!-- TRUST SCORE -->
      <div class="trust-score-section">
        <div class="trust-score-ring" id="trust-ring">
          <svg viewBox="0 0 120 120" class="ring-svg" aria-hidden="true">
            <circle class="ring-bg" cx="60" cy="60" r="50"/>
            <circle class="ring-fill" id="ring-circle" cx="60" cy="60" r="50"
              stroke-dasharray="314"
              stroke-dashoffset="314"
            />
          </svg>
          <div class="ring-label">
            <span class="ring-number" id="trust-number">0</span>
            <span class="ring-sub">/ 100</span>
          </div>
        </div>
        <div class="trust-info">
          <h3 class="trust-title">Trust Score</h3>
          <p class="trust-summary" id="trust-summary"></p>
          <p class="verdict-text" id="verdict-text"></p>
        </div>
      </div>

      <!-- SKILL BREAKDOWN -->
      <div class="skills-section">
        <h3 class="section-heading">Skill Breakdown</h3>
        <div class="skill-list" id="skill-list">
          <!-- Injected by JS -->
        </div>
      </div>

      <!-- STRENGTHS + WEAKNESSES -->
      <div class="sw-row">
        <div class="sw-card strengths-card">
          <h3 class="section-heading">Strengths</h3>
          <ul class="sw-list" id="strengths-list"></ul>
        </div>
        <div class="sw-card weaknesses-card">
          <h3 class="section-heading">Gaps</h3>
          <ul class="sw-list" id="weaknesses-list"></ul>
        </div>
      </div>

      <!-- SHARE ROW -->
      <div class="share-row">
        <button class="btn-secondary" id="share-btn">Copy Share Link</button>
        <button class="btn-secondary" id="new-analysis-btn">New Analysis</button>
      </div>

    </section>

  </main>

  <footer class="site-footer">
    <p>ProofChain AI · Built for MLH · Powered by Claude</p>
  </footer>

  <script src="app.js"></script>
</body>
</html>
```

---

## public/style.css — COMPLETE IMPLEMENTATION

Write this entire CSS file. Every rule matters for the visual quality.

```css
/* ── Reset + Base ─────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:         #0d0f14;
  --surface:    #161b25;
  --surface2:   #1e2535;
  --border:     #2a3147;
  --accent:     #6366f1;
  --accent2:    #818cf8;
  --success:    #22c55e;
  --warning:    #f59e0b;
  --danger:     #ef4444;
  --text:       #e2e8f0;
  --text-muted: #64748b;
  --text-dim:   #94a3b8;
  --radius:     12px;
  --font: 'Segoe UI', system-ui, -apple-system, sans-serif;
}

html { font-size: 16px; scroll-behavior: smooth; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  line-height: 1.6;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ── Utilities ────────────────────────────────────────── */
.hidden { display: none !important; }

/* ── Header ───────────────────────────────────────────── */
.site-header {
  text-align: center;
  padding: 3rem 1rem 2rem;
}

.logo {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.5px;
  margin-bottom: 0.5rem;
}

.logo-icon {
  color: var(--accent);
  font-size: 2rem;
  line-height: 1;
}

.logo-text { color: var(--text); }
.logo-accent { color: var(--accent2); }

.tagline {
  color: var(--text-muted);
  font-size: 1rem;
  letter-spacing: 0.01em;
}

/* ── Container ────────────────────────────────────────── */
.container {
  max-width: 720px;
  margin: 0 auto;
  padding: 0 1.25rem 4rem;
  flex: 1;
}

/* ── Card ─────────────────────────────────────────────── */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 2rem;
  margin-bottom: 1.5rem;
}

.card-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1.25rem;
  color: var(--text);
}

/* ── Tabs ─────────────────────────────────────────────── */
.tab-group {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  background: var(--bg);
  border-radius: 8px;
  padding: 4px;
}

.tab {
  flex: 1;
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.9rem;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: var(--font);
}

.tab:hover { color: var(--text); }

.tab.active {
  background: var(--surface2);
  color: var(--text);
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

/* ── Input Panel ──────────────────────────────────────── */
.input-panel { margin-bottom: 1.25rem; }

.input-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-dim);
  margin-bottom: 0.5rem;
}

.text-input {
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  color: var(--text);
  font-size: 0.95rem;
  font-family: var(--font);
  outline: none;
  transition: border-color 0.2s;
}

.text-input:focus { border-color: var(--accent); }

.textarea { resize: vertical; min-height: 120px; }

.input-hint {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: 0.4rem;
}

/* ── Analyze Button ───────────────────────────────────── */
.btn-analyze {
  width: 100%;
  padding: 0.9rem 1.5rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  font-family: var(--font);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  transition: background 0.2s, transform 0.1s;
  margin-top: 0.25rem;
}

.btn-analyze:hover:not(:disabled) { background: #5254e7; }
.btn-analyze:active:not(:disabled) { transform: scale(0.99); }
.btn-analyze:disabled { opacity: 0.6; cursor: not-allowed; }

/* Spinner */
.btn-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Error ────────────────────────────────────────────── */
.error-msg {
  margin-top: 0.75rem;
  padding: 0.6rem 1rem;
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.3);
  border-radius: 6px;
  color: #fca5a5;
  font-size: 0.875rem;
}

/* ── Proof Badge ──────────────────────────────────────── */
.proof-badge-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.proof-badge {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: rgba(99,102,241,0.12);
  border: 1px solid rgba(99,102,241,0.3);
  border-radius: 8px;
  padding: 0.5rem 0.9rem;
}

.proof-icon {
  color: var(--success);
  font-size: 1.1rem;
  font-weight: 700;
}

.proof-label {
  display: block;
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.proof-id {
  display: block;
  font-size: 0.875rem;
  font-family: 'Courier New', monospace;
  color: var(--accent2);
  font-weight: 600;
}

.proof-timestamp {
  font-size: 0.8rem;
  color: var(--text-muted);
}

/* ── Result Title ─────────────────────────────────────── */
.result-title {
  font-size: 1.4rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  color: var(--text);
}

/* ── Trust Score Ring ─────────────────────────────────── */
.trust-score-section {
  display: flex;
  align-items: center;
  gap: 2rem;
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: var(--bg);
  border-radius: var(--radius);
  border: 1px solid var(--border);
}

.trust-score-ring {
  position: relative;
  width: 120px;
  height: 120px;
  flex-shrink: 0;
}

.ring-svg { width: 120px; height: 120px; transform: rotate(-90deg); }

.ring-bg {
  fill: none;
  stroke: var(--surface2);
  stroke-width: 10;
}

.ring-fill {
  fill: none;
  stroke: var(--accent);
  stroke-width: 10;
  stroke-linecap: round;
  transition: stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1),
              stroke 0.3s ease;
}

.ring-label {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.ring-number {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text);
  line-height: 1;
}

.ring-sub {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-top: 2px;
}

.trust-info { flex: 1; }

.trust-title {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

.trust-summary {
  font-size: 0.95rem;
  color: var(--text-dim);
  line-height: 1.6;
  margin-bottom: 0.75rem;
}

.verdict-text {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--accent2);
  font-style: italic;
}

/* ── Skills ───────────────────────────────────────────── */
.skills-section { margin-bottom: 1.75rem; }

.section-heading {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: 0.9rem;
}

.skill-list { display: flex; flex-direction: column; gap: 0.75rem; }

.skill-item {}

.skill-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.3rem;
}

.skill-name {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text);
}

.skill-score-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-muted);
}

.skill-bar-bg {
  height: 6px;
  background: var(--surface2);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 0.25rem;
}

.skill-bar-fill {
  height: 100%;
  border-radius: 3px;
  width: 0%;
  transition: width 1s cubic-bezier(0.4,0,0.2,1);
}

.skill-note {
  font-size: 0.78rem;
  color: var(--text-muted);
}

/* ── Strengths / Weaknesses ───────────────────────────── */
.sw-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1.75rem;
}

@media (max-width: 480px) { .sw-row { grid-template-columns: 1fr; } }

.sw-card {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.25rem;
}

.sw-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sw-list li {
  font-size: 0.875rem;
  color: var(--text-dim);
  padding-left: 1.25rem;
  position: relative;
  line-height: 1.5;
}

.strengths-card .sw-list li::before {
  content: '↑';
  position: absolute;
  left: 0;
  color: var(--success);
  font-size: 0.75rem;
  font-weight: 700;
  top: 1px;
}

.weaknesses-card .sw-list li::before {
  content: '→';
  position: absolute;
  left: 0;
  color: var(--warning);
  font-size: 0.75rem;
  font-weight: 700;
  top: 1px;
}

/* ── Share Row ────────────────────────────────────────── */
.share-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.btn-secondary {
  padding: 0.6rem 1.25rem;
  background: var(--surface2);
  color: var(--text-dim);
  border: 1px solid var(--border);
  border-radius: 7px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  font-family: var(--font);
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: var(--border);
  color: var(--text);
}

/* ── Footer ───────────────────────────────────────────── */
.site-footer {
  text-align: center;
  padding: 1.5rem;
  color: var(--text-muted);
  font-size: 0.8rem;
  border-top: 1px solid var(--border);
}

/* ── Score color thresholds (applied by JS) ───────────── */
.score-high  { stroke: #22c55e; }
.score-mid   { stroke: #f59e0b; }
.score-low   { stroke: #ef4444; }

.bar-high  { background: #22c55e; }
.bar-mid   { background: #f59e0b; }
.bar-low   { background: #ef4444; }
```

---

## public/app.js — COMPLETE IMPLEMENTATION

Write the entire frontend JavaScript. No framework. Pure DOM.

```javascript
/* ── State ─────────────────────────────────────────────── */
let currentTab = 'github';

/* ── DOM refs ──────────────────────────────────────────── */
const tabs          = document.querySelectorAll('.tab');
const panelGithub   = document.getElementById('panel-github');
const panelText     = document.getElementById('panel-text');
const githubInput   = document.getElementById('github-url');
const textInput     = document.getElementById('resume-text');
const analyzeBtn    = document.getElementById('analyze-btn');
const btnText       = analyzeBtn.querySelector('.btn-text');
const btnSpinner    = analyzeBtn.querySelector('.btn-spinner');
const errorMsg      = document.getElementById('error-msg');
const inputSection  = document.getElementById('input-section');
const resultSection = document.getElementById('result-section');

/* ── Tab switching ─────────────────────────────────────── */
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    currentTab = tab.dataset.tab;
    tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    panelGithub.classList.toggle('hidden', currentTab !== 'github');
    panelText.classList.toggle('hidden', currentTab !== 'text');
    hideError();
  });
});

/* ── Analyze button ────────────────────────────────────── */
analyzeBtn.addEventListener('click', runAnalysis);

githubInput.addEventListener('keydown', e => { if (e.key === 'Enter') runAnalysis(); });

async function runAnalysis() {
  const input = currentTab === 'github'
    ? githubInput.value.trim()
    : textInput.value.trim();

  if (!input) {
    showError(currentTab === 'github' ? 'Please enter a GitHub URL.' : 'Please paste some text.');
    return;
  }

  if (currentTab === 'github' && !input.includes('github.com')) {
    showError('Please enter a valid GitHub repository URL.');
    return;
  }

  if (currentTab === 'text' && input.length < 50) {
    showError('Please provide at least 50 characters of text.');
    return;
  }

  setLoading(true);
  hideError();

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: currentTab, input })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Analysis failed. Please try again.');
    }

    renderResult(data);

  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
}

/* ── Render result ─────────────────────────────────────── */
function renderResult(data) {
  const { proofId, inputLabel, analysis, generatedAt } = data;

  // Proof badge
  document.getElementById('proof-id').textContent = proofId;
  document.getElementById('proof-timestamp').textContent = formatDate(generatedAt);

  // Title
  document.getElementById('result-title').textContent = inputLabel;

  // Trust score ring
  const score = Math.max(0, Math.min(100, analysis.trustScore));
  const circumference = 314; // 2 * π * 50
  const offset = circumference - (score / 100) * circumference;
  const ring = document.getElementById('ring-circle');
  // Set color class
  ring.className = 'ring-fill ' + scoreClass(score, 'ring');
  // Animate (small delay so CSS transition fires)
  setTimeout(() => {
    ring.style.strokeDashoffset = offset;
  }, 80);

  // Animate number
  animateNumber(document.getElementById('trust-number'), 0, score, 1200);

  // Summary + verdict
  document.getElementById('trust-summary').textContent = analysis.summary;
  document.getElementById('verdict-text').textContent = `"${analysis.verdict}"`;

  // Skills
  const skillList = document.getElementById('skill-list');
  skillList.innerHTML = '';
  (analysis.skills || []).forEach((skill, i) => {
    const s = Math.max(0, Math.min(100, skill.score));
    const item = document.createElement('div');
    item.className = 'skill-item';
    item.innerHTML = `
      <div class="skill-header">
        <span class="skill-name">${escHtml(skill.name)}</span>
        <span class="skill-score-label">${s}</span>
      </div>
      <div class="skill-bar-bg">
        <div class="skill-bar-fill ${scoreClass(s, 'bar')}" id="bar-${i}" style="width:0%"></div>
      </div>
      <div class="skill-note">${escHtml(skill.note)}</div>
    `;
    skillList.appendChild(item);
    // Animate bar after paint
    setTimeout(() => {
      document.getElementById(`bar-${i}`).style.width = s + '%';
    }, 100 + i * 60);
  });

  // Strengths
  const strengthsList = document.getElementById('strengths-list');
  strengthsList.innerHTML = (analysis.strengths || [])
    .map(s => `<li>${escHtml(s)}</li>`).join('');

  // Weaknesses
  const weaknessesList = document.getElementById('weaknesses-list');
  weaknessesList.innerHTML = (analysis.weaknesses || [])
    .map(w => `<li>${escHtml(w)}</li>`).join('');

  // Show result, hide input (smooth scroll)
  inputSection.classList.add('hidden');
  resultSection.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Share button ──────────────────────────────────────── */
document.getElementById('share-btn').addEventListener('click', () => {
  const proofId = document.getElementById('proof-id').textContent;
  const url = `${window.location.origin}/?proof=${proofId}`;
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.getElementById('share-btn');
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = original; }, 2000);
  });
});

/* ── New analysis button ───────────────────────────────── */
document.getElementById('new-analysis-btn').addEventListener('click', () => {
  resultSection.classList.add('hidden');
  inputSection.classList.remove('hidden');
  githubInput.value = '';
  textInput.value = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ── Helpers ───────────────────────────────────────────── */
function setLoading(on) {
  analyzeBtn.disabled = on;
  btnText.textContent = on ? 'Analyzing...' : 'Analyze Now';
  btnSpinner.classList.toggle('hidden', !on);
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove('hidden');
}

function hideError() {
  errorMsg.classList.add('hidden');
  errorMsg.textContent = '';
}

function scoreClass(score, prefix) {
  if (score >= 70) return prefix + '-high';
  if (score >= 40) return prefix + '-mid';
  return prefix + '-low';
}

function animateNumber(el, from, to, duration) {
  const start = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(from + (to - from) * eased);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}
```

---

## README.md — WRITE THIS

```markdown
# ProofChain AI

AI-powered developer verification. Paste a GitHub repo or resume → get an instant trust score and skill breakdown.

## Setup

1. Clone this repo
2. Run `npm install`
3. Copy `.env.example` to `.env` and fill in your `ANTHROPIC_API_KEY`
4. Optionally add `GITHUB_TOKEN` for higher GitHub API rate limits
5. Run `npm start`
6. Open http://localhost:3000

## How it works

- GitHub URL → fetches repo metadata, languages, commits, and README via GitHub API
- Resume text → sent directly to Claude for analysis
- Claude returns a JSON object with trust score, skill breakdown, strengths, and weaknesses
- A SHA-256 Proof ID is generated from the input + timestamp

## Stack

- Express.js backend (Node.js 20)
- Vanilla HTML/CSS/JS frontend
- Anthropic Claude API (`claude-sonnet-4-20250514`)
- Native fetch for GitHub API calls
```

---

## .gitignore — WRITE THIS

```
node_modules/
.env
*.log
```

---

## EXECUTION SEQUENCE FOR CODEX

Run these shell commands in order after creating all files:

```bash
cd proofchain
npm install
cp .env.example .env
# At this point the human fills in ANTHROPIC_API_KEY in .env
npm start
```

The app is then live at http://localhost:3000.

---

## WHAT CODEX MUST NOT DO

- Do NOT add TypeScript. Keep everything as `.js`.
- Do NOT add a database. No SQLite, no MongoDB, no PostgreSQL.
- Do NOT add authentication or sessions.
- Do NOT add Tailwind, Bootstrap, or any CSS framework.
- Do NOT add React, Vue, or any JS framework.
- Do NOT split the backend into multiple files. Everything lives in `server.js`.
- Do NOT add error logging libraries. Use `console.error` only.
- Do NOT add any dependency not listed in the package.json above.
- Do NOT add Docker. The app runs with `npm start`.
- Do NOT add tests.
- Do NOT add linting config.

---

## FINAL CHECKLIST — VERIFY BEFORE FINISHING

- [ ] `server.js` exists and has all 4 sections (imports, fetchGitHubData, analyzeWithClaude, routes)
- [ ] `public/index.html` exists with all IDs referenced in `app.js` present in the HTML
- [ ] `public/style.css` exists with all classes referenced in `index.html`
- [ ] `public/app.js` exists and references no missing DOM IDs
- [ ] `package.json` has exactly 3 dependencies: express, @anthropic-ai/sdk, dotenv
- [ ] `.env.example` exists
- [ ] `.gitignore` exists
- [ ] README.md exists
- [ ] Running `npm install && npm start` starts the server with no errors
```
