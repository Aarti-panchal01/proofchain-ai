const express = require('express');
const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

const genAI = new GoogleGenerativeAI("AIzaSyDWUwEDbRdzDKi-tk6zfdGOSqU7rZ0g7SA");

app.use(express.json());
app.use(express.static('public'));

const PORT = 3000;

/* =========================
   FETCH GITHUB DATA
========================= */
async function fetchGitHubData(url) {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) throw new Error("Invalid GitHub URL");

  const [_, owner, repo] = match;

  const base = `https://api.github.com/repos/${owner}/${repo}`;

  const repoRes = await fetch(base);
  if (!repoRes.ok) throw new Error("GitHub repo not found");

  const repoData = await repoRes.json();

  return {
    name: repoData.name,
    description: repoData.description,
    stars: repoData.stargazers_count,
    forks: repoData.forks_count,
    language: repoData.language
  };
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
   MAIN API
========================= */
app.post('/api/analyze', async (req, res) => {
  try {
    let { input } = req.body;

    if (input.includes("github.com")) {
      const data = await fetchGitHubData(input);
      input = JSON.stringify(data, null, 2);
    }

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

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ]
    });

    const text = result.response.candidates[0].content.parts[0].text;

    res.json({
      result: text,
      proofId: generateProofId(input)
    });

  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ error: "AI failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Running at http://localhost:${PORT}`);
});
