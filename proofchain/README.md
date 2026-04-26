# ProofChain AI

**AI-powered developer verification from GitHub or resume in seconds**

## 🚀 Overview

ProofChain AI analyzes a developer’s GitHub repository or resume text and generates a structured credibility report in seconds.

It helps teams make faster, smarter trust decisions by turning raw profile data into clear signals: trust score, skill confidence, strengths, and gaps.

In hiring, hackathons, and technical screening, credibility is often subjective. ProofChain AI makes it measurable.

## ✨ Features

- 🔍 GitHub repo analysis
- 🧾 Resume / bio analysis
- 📊 AI-generated trust score
- 🧩 Skill-by-skill breakdown
- ✅ Strengths & weaknesses summary
- 🔐 Unique Proof ID generation for each analysis

## 🧠 How It Works

1. **Input**: User submits either a GitHub repo URL or free-form resume/profile text.
2. **Backend Fetch**: Server pulls repository metadata from GitHub API (when GitHub mode is selected).
3. **AI Analysis**: Input context is sent to Groq using the `llama3-70b-8192` model.
4. **Structured Output**: AI returns strict JSON with trust score, summary, skills, strengths, weaknesses, and verdict.
5. **UI Rendering**: Frontend visualizes the result as a verification card with share and export actions.

## 🛠 Tech Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express
- **AI**: Groq (`llama3-70b-8192`, LLaMA 3 family)
- **APIs**: GitHub REST API

## ⚡ Setup Instructions

```bash
git clone <your-repo-url>
cd proofchain
npm install
```

Create a `.env` file in the `proofchain` folder:

```env
GROQ_API_KEY=your_key
PORT=3000
```

Run the app:

```bash
npm start
```

Open: `http://localhost:3000`

## 🧪 Example Usage

Input:

```text
https://github.com/expressjs/express
```

Expected output (example):

```json
{
  "proofId": "PC-91AF3C1D20B4A9F1",
  "type": "github",
  "inputLabel": "express",
  "analysis": {
    "trustScore": 86,
    "summary": "Mature, widely adopted Node.js framework with strong contributor history.",
    "skills": [
      { "name": "Node.js", "score": 90, "note": "Production-grade backend fundamentals." },
      { "name": "API Design", "score": 87, "note": "Clear routing and middleware patterns." }
    ],
    "strengths": ["Strong ecosystem", "High maintainability", "Real-world adoption"],
    "weaknesses": ["Limited type safety", "Legacy compatibility overhead"],
    "verdict": "High-confidence engineering credibility signal."
  },
  "generatedAt": "2026-04-26T00:00:00.000Z"
}
```

## 🎯 Use Cases

- 👩‍💼 Hiring and recruiter screening
- 🏆 Hackathon judging support
- 📈 Developer credibility scoring for teams and communities

## 🔥 Future Improvements

- 🪪 Wallet / identity layer
- ⛓ On-chain proof anchoring
- 🧮 Multi-repo aggregation and longitudinal scoring

## 👤 Author

**Aarti Panchal**  
Founder, ProofChain

## 📌 Notes

- Clean, reviewer-friendly output focused on credibility signals
- Designed for fast demos and production-path extensibility
- Structured JSON pipeline keeps the system deterministic and integrable
