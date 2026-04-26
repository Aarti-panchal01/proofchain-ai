require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const genAI = new GoogleGenerativeAI("AIzaSyDWUwEDbRdzDKi-tk6zfdGOSqU7rZ0g7SA");

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

async function analyzeWithGemini(inputType, inputData) {
  let userMessage = '';

  if (inputType === 'github') {
    userMessage = `Analyze this GitHub repository data and evaluate the developer's skills and project quality.\n\nRepository: ${inputData.name}\nDescription: ${inputData.description}\nPrimary Language: ${inputData.primaryLanguage}\nAll Languages: ${JSON.stringify(inputData.languages)}\nStars: ${inputData.stars} | Forks: ${inputData.forks}\nCreated: ${inputData.createdAt} | Last Updated: ${inputData.updatedAt}\nRecent Commit Messages:\n${inputData.commitMessages.map((m, i) => `${i + 1}. ${m}`).join('\n')}\nREADME Preview:\n${inputData.readmeSnippet}`;
  }

  if (inputType === 'text') {
    userMessage = `Analyze this developer's resume/profile and evaluate their skills and credibility.\n\nProfile Text:\n${inputData}`;
  }

  userMessage += `\n\nRespond with ONLY a valid JSON object. No markdown, no backticks, no explanation. Just the JSON.\n\nThe JSON must have exactly this structure:\n{\n  "trustScore": <integer 0-100, overall credibility/quality score>,\n  "summary": "<2-3 sentence plain English summary of this developer/project. Be specific, not generic.>",\n  "skills": [\n    { "name": "<skill name>", "score": <integer 0-100>, "note": "<one short sentence about this skill>" },\n    ... (return between 4 and 7 skills)\n  ],\n  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],\n  "weaknesses": ["<weakness or gap 1>", "<weakness or gap 2>"],\n  "verdict": "<one punchy sentence verdict, like a senior engineer's final take>"\n}`;

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const result = await model.generateContent(userMessage);
  const rawText = result.response.text().trim();

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new Error('AI returned invalid JSON. Try again.');
  }

  return parsed;
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

    const analysis = await analyzeWithGemini(type, inputData);
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
const PORT = 3000;

/* =========================
   FETCH GITHUB DATA (FINAL FIX)
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

    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent": "proofchain-app",
        "Accept": "application/vnd.github+json"
      }
    });

    if (!res.ok) {
      const text = await res.text();
      console.log("GitHub RAW ERROR:", text);
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
app.post('/api/analyze', async (req, res) => {
  try {
    let { input } = req.body;

    if (!input) {
      return res.status(400).json({ error: "No input provided" });
    }

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
app.listen(PORT, () => {
  console.log(`🚀 Running at http://localhost:${PORT}`);
});
