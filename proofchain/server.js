require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(express.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

/* =========================
   FETCH GITHUB DATA
========================= */
async function fetchGitHubData(url) {
  try {
    const cleanUrl = url.trim().replace(/\/$/, '');
    const parts = cleanUrl.split('/');

    const owner = parts[3];
    const repo = parts[4];

    if (!owner || !repo) {
      throw new Error("Invalid GitHub URL");
    }

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;

    const headers = {
      "User-Agent": "proofchain-app",
      "Accept": "application/vnd.github+json"
    };

    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
    }

    const res = await fetch(apiUrl, { headers });

    console.log("GitHub STATUS:", res.status);

    if (!res.ok) {
      const text = await res.text();
      console.log("GitHub ERROR:", text);
      throw new Error("GitHub repo not found or API blocked");
    }

    const data = await res.json();

    return {
      name: data.name,
      description: data.description || '',
      stars: data.stargazers_count,
      forks: data.forks_count,
      language: data.language
    };

  } catch (err) {
    console.error("GitHub fetch error:", err.message);
    throw err;
  }
}

/* =========================
   ANALYZE WITH GEMINI
========================= */
async function analyzeWithGemini(input) {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash"
  });

  const prompt = `
Analyze this developer:

Return:
- Score (0-100)
- 3 strengths
- 2 weaknesses
- Short summary

Input:
${input}
`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

/* =========================
   GENERATE PROOF ID
========================= */
function generateProofId(input) {
  return "PC-" + crypto
    .createHash("sha256")
    .update(input + Date.now())
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();
}

/* =========================
   MAIN ROUTE
========================= */
app.post('/api/analyze', async (req, res) => {
  try {
    const { input } = req.body;

    if (!input) {
      return res.status(400).json({ error: "No input provided" });
    }

    let finalInput = input;

    if (input.includes("github.com")) {
      const data = await fetchGitHubData(input);
      finalInput = JSON.stringify(data, null, 2);
    }

    const result = await analyzeWithGemini(finalInput);

    res.json({
      result,
      proofId: generateProofId(input)
    });

  } catch (err) {
    console.error("ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`🚀 Running at http://localhost:${PORT}`);
});
