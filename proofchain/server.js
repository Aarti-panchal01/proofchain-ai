require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

const genAI = new GoogleGenerativeAI("AIzaSyAH6235Tc085vuD_sUKO6dcJdnVH2q9G_Q");

app.use(express.json());
app.use(express.static('public'));

const PORT = 3000;

/* =========================
   FETCH GITHUB DATA
========================= */
async function fetchGitHubData(githubUrl) {
  const match = githubUrl.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
  if (!match) throw new Error('Invalid GitHub URL');

  const owner = match[1];
  const repo = match[2];

  const base = `https://api.github.com/repos/${owner}/${repo}`;

  const [repoRes, langRes, commitRes] = await Promise.all([
    fetch(base),
    fetch(`${base}/languages`),
    fetch(`${base}/commits?per_page=5`)
  ]);

  if (!repoRes.ok) throw new Error('Repo not found');

  const repoData = await repoRes.json();
  const languages = langRes.ok ? await langRes.json() : {};
  const commits = commitRes.ok ? await commitRes.json() : [];

  return {
    name: repoData.name,
    description: repoData.description,
    stars: repoData.stargazers_count,
    forks: repoData.forks_count,
    language: repoData.language,
    languages,
    commits: commits.map(c => c.commit.message)
  };
}

/* =========================
   GENERATE PROOF ID
========================= */
function generateProofId(input) {
  return 'PC-' + crypto
    .createHash('sha256')
    .update(input + Date.now())
    .digest('hex')
    .slice(0, 10)
    .toUpperCase();
}

/* =========================
   MAIN ANALYSIS ROUTE
========================= */
app.post('/api/analyze', async (req, res) => {
  try {
    const { input } = req.body;

    let finalInput = input;

    if (input.includes('github.com')) {
      const data = await fetchGitHubData(input);
      finalInput = JSON.stringify(data, null, 2);
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash"
    });

    const prompt = `
Analyze this developer profile.

Return:
- Score (0-100)
- 3 Strengths
- 2 Weaknesses
- Short Summary

Input:
${finalInput}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    res.json({
      result: text,
      proofId: generateProofId(input)
    });

  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ error: "AI failed" });
  }
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`Running at http://localhost:${PORT}`);
});
