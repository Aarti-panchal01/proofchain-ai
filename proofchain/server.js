require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(express.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

/* ── GitHub fetch ─────────────────────────────────── */
async function fetchGitHubData(url) {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
  if (!match) throw new Error('Invalid GitHub URL');

  const owner = match[1];
  const repo  = match[2].replace(/\.git$/, '');

  const headers = {
    'User-Agent': 'ProofChain-AI',
    'Accept': 'application/vnd.github+json'
  };

  const token = process.env.GITHUB_TOKEN;
  if (token && token.length > 10 && !token.startsWith('your_')) {
    headers['Authorization'] = `token ${token}`;
  }

  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  console.log('GitHub status:', repoRes.status);

  if (!repoRes.ok) {
    const body = await repoRes.text();
    console.error('GitHub error body:', body);
    throw new Error(`GitHub API returned ${repoRes.status} — repo may be private or URL is wrong`);
  }

  const data = await repoRes.json();

  // Fetch languages (best effort)
  let languages = {};
  try {
    const langRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, { headers });
    if (langRes.ok) languages = await langRes.json();
  } catch (_) {}

  return {
    name: data.name,
    description: data.description || '',
    stars: data.stargazers_count,
    forks: data.forks_count,
    primaryLanguage: data.language || 'Unknown',
    languages,
    updatedAt: data.updated_at
  };
}

/* ── Gemini analysis ──────────────────────────────── */
async function analyzeWithGemini(type, inputData) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  let context;
  if (type === 'github') {
    context = `
GitHub Repository: ${inputData.name}
Description: ${inputData.description}
Primary Language: ${inputData.primaryLanguage}
All Languages: ${JSON.stringify(inputData.languages)}
Stars: ${inputData.stars} | Forks: ${inputData.forks}
Last Updated: ${inputData.updatedAt}
`;
  } else {
    context = `Developer Profile / Resume:\n${inputData}`;
  }

  const prompt = `
You are a senior engineering hiring manager. Analyze the following and respond with ONLY a valid JSON object — no markdown, no backticks, no explanation before or after.

${context}

Return exactly this JSON structure:
{
  "trustScore": <integer 0-100>,
  "summary": "<2-3 sentence plain English summary, be specific>",
  "skills": [
    { "name": "<skill>", "score": <integer 0-100>, "note": "<one short sentence>" },
    { "name": "<skill>", "score": <integer 0-100>, "note": "<one short sentence>" },
    { "name": "<skill>", "score": <integer 0-100>, "note": "<one short sentence>" },
    { "name": "<skill>", "score": <integer 0-100>, "note": "<one short sentence>" },
    { "name": "<skill>", "score": <integer 0-100>, "note": "<one short sentence>" }
  ],
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "weaknesses": ["<gap 1>", "<gap 2>"],
  "verdict": "<one punchy sentence, senior engineer final take>"
}
`;

  const result = await model.generateContent(prompt);
  let text = result.response.text().trim();

  // Strip markdown fences if Gemini wraps in them
  text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

  return JSON.parse(text);
}

/* ── Proof ID ─────────────────────────────────────── */
function generateProofId(input) {
  return 'PC-' + crypto
    .createHash('sha256')
    .update(input + Date.now().toString())
    .digest('hex')
    .slice(0, 16)
    .toUpperCase();
}

/* ── Main route ───────────────────────────────────── */
app.post('/api/analyze', async (req, res) => {
  try {
    const { type, input } = req.body;

    if (!type || !input) {
      return res.status(400).json({ error: 'Missing type or input' });
    }

    let inputData;
    if (type === 'github') {
      inputData = await fetchGitHubData(input.trim());
    } else {
      inputData = input.trim();
    }

    const analysis = await analyzeWithGemini(type, inputData);

    return res.json({
      proofId: generateProofId(input),
      type,
      inputLabel: type === 'github' ? inputData.name : 'Resume / Profile',
      analysis,
      generatedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error('Analysis error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/* ── Start ────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`ProofChain AI running at http://localhost:${PORT}`);
});
