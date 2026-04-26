require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

const genAI = new GoogleGenerativeAI("AIzaSyAH6235Tc085vuD_sUKO6dcJdnVH2q9G_Q");

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

  const [repoRes, languagesRes, commitsRes] = await Promise.all([
    fetch(baseUrl, { headers }),
    fetch(`${baseUrl}/languages`, { headers }),
    fetch(`${baseUrl}/commits?per_page=10`, { headers })
  ]);

  if (!repoRes.ok) {
    throw new Error('GitHub repo not found or is private');
  }

  const repo = await repoRes.json();
  const languagesObj = languagesRes.ok ? await languagesRes.json() : {};
  const commits = commitsRes.ok ? await commitsRes.json() : [];

  return {
    name: repo.name,
    description: repo.description || '',
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    primaryLanguage: repo.language || 'Unknown',
    languages: languagesObj,
    commitMessages: commits.slice(0, 10).map((c) => c.commit.message)
  };
}

function generateProofId(input) {
  return 'PC-' + crypto.createHash('sha256').update(input + Date.now()).digest('hex').slice(0, 12).toUpperCase();
}

app.post('/api/analyze', async (req, res) => {
  try {
    const { input } = req.body;

    let finalInput = input;

    // If GitHub link → fetch repo data
    if (input.includes('github.com')) {
      const data = await fetchGitHubData(input);
      finalInput = JSON.stringify(data, null, 2);
    }

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
Analyze this developer and return:
- score (0-100)
- strengths (3)
- weaknesses (2-3)
- short summary

Input:
${finalInput}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    res.json({
      result: text,
      proofId: generateProofId(input)
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "AI failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
