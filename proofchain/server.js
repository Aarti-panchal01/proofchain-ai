require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

async function fetchGitHubData(githubUrl) {
  const match = githubUrl.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
  if (!match) {
    throw new Error('Invalid GitHub URL format');
  }

  const owner = match[1];
  const repoName = match[2];
  const baseUrl = `https://api.github.com/repos/${owner}/${repoName}`;

  const headers = {
    'User-Agent': 'ProofChain-AI'
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
  }

  const [repoRes, languagesRes, commitsRes, readmeRes] = await Promise.all([
    fetch(baseUrl, { headers }),
    fetch(`${baseUrl}/languages`, { headers }),
    fetch(`${baseUrl}/commits?per_page=10`, { headers }),
    fetch(`${baseUrl}/readme`, { headers })
  ]);

  if (!repoRes.ok) {
    throw new Error('GitHub repo not found or is private');
  }

  const repo = await repoRes.json();
  const languagesObj = languagesRes.ok ? await languagesRes.json() : {};
  const commits = commitsRes.ok ? await commitsRes.json() : [];

  let readmeText = '';
  if (readmeRes.ok) {
    const readmeData = await readmeRes.json();
    if (readmeData.content) {
      readmeText = Buffer.from(readmeData.content, 'base64').toString('utf8');
    }
  } else if (readmeRes.status !== 404) {
    readmeText = '';
  }

  return {
    name: repo.name,
    description: repo.description || '',
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    primaryLanguage: repo.language || 'Unknown',
    languages: languagesObj,
    createdAt: repo.created_at,
    updatedAt: repo.updated_at,
    commitMessages: commits.slice(0, 10).map((c) => c.commit.message.split('\n')[0]),
    readmeSnippet: readmeText.slice(0, 800)
  };
}

async function analyzeWithClaude(inputType, inputData) {
  let userMessage = '';

  if (inputType === 'github') {
    userMessage = `Analyze this GitHub repository data and evaluate the developer's skills and project quality.\n\nRepository: ${inputData.name}\nDescription: ${inputData.description}\nPrimary Language: ${inputData.primaryLanguage}\nAll Languages: ${JSON.stringify(inputData.languages)}\nStars: ${inputData.stars} | Forks: ${inputData.forks}\nCreated: ${inputData.createdAt} | Last Updated: ${inputData.updatedAt}\nRecent Commit Messages:\n${inputData.commitMessages.map((m, i) => `${i + 1}. ${m}`).join('\n')}\nREADME Preview:\n${inputData.readmeSnippet}`;
  }

  if (inputType === 'text') {
    userMessage = `Analyze this developer's resume/profile and evaluate their skills and credibility.\n\nProfile Text:\n${inputData}`;
  }

  userMessage += `\n\nRespond with ONLY a valid JSON object. No markdown, no backticks, no explanation. Just the JSON.\n\nThe JSON must have exactly this structure:\n{\n  "trustScore": <integer 0-100, overall credibility/quality score>,\n  "summary": "<2-3 sentence plain English summary of this developer/project. Be specific, not generic.>",\n  "skills": [\n    { "name": "<skill name>", "score": <integer 0-100>, "note": "<one short sentence about this skill>" },\n    ... (return between 4 and 7 skills)\n  ],\n  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],\n  "weaknesses": ["<weakness or gap 1>", "<weakness or gap 2>"],\n  "verdict": "<one punchy sentence verdict, like a senior engineer's final take>"\n}`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: 'You are a senior engineering hiring manager and open source contributor with 15 years of experience. You evaluate developer profiles and codebases with precision and honesty. You always respond with valid JSON only — no markdown, no explanation.',
    messages: [{ role: 'user', content: userMessage }]
  });

  const rawText = message.content[0].text.trim();

  let result;
  try {
    result = JSON.parse(rawText);
  } catch (err) {
    throw new Error('AI returned invalid JSON. Try again.');
  }

  return result;
}

function generateProofId(inputString) {
  const timestamp = Date.now().toString();
  const hash = crypto.createHash('sha256').update(inputString + timestamp).digest('hex');
  return 'PC-' + hash.slice(0, 16).toUpperCase();
}

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

app.listen(PORT, () => {
  console.log(`ProofChain AI running at http://localhost:${PORT}`);
});
