const express = require('express');
const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

/* 🔥 PUT YOUR GEMINI API KEY HERE */
const genAI = new GoogleGenerativeAI("AIzaSyDWUwEDbRdzDKi-tk6zfdGOSqU7rZ0g7SA");

app.use(express.json());
app.use(express.static('public'));

const PORT = 3000;

/* =========================
   FETCH GITHUB DATA (FIXED)
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

    const res = await fetch(apiUrl);

    if (!res.ok) {
      throw new Error("GitHub repo not found");
    }

    const data = await res.json();

    return {
      name: data.name,
      description: data.description,
      stars: data.stargazers_count,
      forks: data.forks_count,
      language: data.language
    };

  } catch (err) {
    console.error("GitHub fetch error:", err);
    throw new Error("GitHub repo not found or is private");
  }
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
   MAIN ANALYSIS ROUTE
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
    res.status(500).json({ error: err.message || "AI failed" });
  }
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`Running at http://localhost:${PORT}`);
});
