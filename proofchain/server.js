require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

function generateProofId(inputString) {
  const timestamp = Date.now().toString();
  const hash = crypto.createHash('sha256').update(inputString + timestamp).digest('hex');
  return 'PC-' + hash.slice(0, 16).toUpperCase();
}

app.post('/api/analyze', async (req, res) => {
  try {
    const { input } = req.body;

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `
    Analyze this developer input and return:
    - score (0-100)
    - strengths (3 points)
    - weaknesses (3 points)
    - summary

    Input:
    ${input}
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    res.json({
      result: text,
      proofId: 'PC-' + Math.random().toString(36).substring(2, 10).toUpperCase()
    });
  } catch (error) {
    console.error('Gemini error:', error);
    res.status(500).json({ error: 'AI processing failed' });
  }
});

app.listen(PORT, () => {
  console.log(`ProofChain AI running at http://localhost:${PORT}`);
});
