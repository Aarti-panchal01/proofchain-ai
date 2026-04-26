require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const Groq = require('groq-sdk');

const app = express();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(express.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

async function fetchGitHubData(githubUrl) {
  const match = githubUrl.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
  if (!match) {
    throw new Error('Invalid GitHub URL format');
  }

  const owner = match[1];
  const repoName = match[2].replace(/\.git$/, '');
  const baseUrl = `https://api.github.com/repos/${owner}/${repoName}`;

  const headers = {
    'User-Agent': 'ProofChain-AI',
    Accept: 'application/vnd.github+json'
  };

  const token = process.env.GITHUB_TOKEN;
  if (token && token !== 'your_github_personal_access_token_here') {
    headers.Authorization = `token ${token}`;
  }

  const [repoRes, languagesRes, commitsRes, readmeRes] = await Promise.all([
    fetch(baseUrl, { headers }),
    fetch(`${baseUrl}/languages`, { headers }),
    fetch(`${baseUrl}/commits?per_page=10`, { headers }),
    fetch(`${baseUrl}/readme`, { headers })
  ]);

  if (!repoRes.ok) {
    if (repoRes.status === 401) {
      throw new Error('GitHub token is invalid. Remove or update GITHUB_TOKEN in .env');
    }
    if (repoRes.status === 403) {
      throw new Error('GitHub API rate limit exceeded. Add a valid GITHUB_TOKEN and try again.');
    }
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

async function analyzeWithGroq(type, inputData) {
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

  const completion = await groq.chat.completions.create({
    model: 'llama3-70b-8192',
    messages: [
      {
        role: 'system',
        content: 'You are a senior engineering hiring manager. Always respond with valid JSON only — no markdown, no backticks, no explanation.'
      },
      {
        role: 'user',
        content: `Analyze the following and return ONLY a JSON object with exactly this structure:
{
  "trustScore": <integer 0-100>,
  "summary": "<2-3 sentence specific summary>",
  "skills": [
    { "name": "<skill>", "score": <integer 0-100>, "note": "<one sentence>" },
    { "name": "<skill>", "score": <integer 0-100>, "note": "<one sentence>" },
    { "name": "<skill>", "score": <integer 0-100>, "note": "<one sentence>" },
    { "name": "<skill>", "score": <integer 0-100>, "note": "<one sentence>" },
    { "name": "<skill>", "score": <integer 0-100>, "note": "<one sentence>" }
  ],
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "weaknesses": ["<gap 1>", "<gap 2>"],
  "verdict": "<one punchy sentence>"
}

${context}`
      }
    ],
    temperature: 0.7,
    max_tokens: 1024
  });

  let text = completion.choices[0].message.content.trim();
  text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  return JSON.parse(text);
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

    const analysis = await analyzeWithGroq(type, inputData);
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
