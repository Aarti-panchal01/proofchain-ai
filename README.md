# ⬡ ProofChain AI

**Verify developer credibility in 10 seconds.**

Paste a public GitHub repo URL + a developer's resume or bio → get a Trust Score (0–100), skill breakdown, strengths, and gaps — powered by Groq + Llama 3.3.

🔗 **Live:** [proofchain-ai.vercel.app](https://proofchain-ai.vercel.app)

---

## What it does

ProofChain AI analyzes a developer's public GitHub repository and resume/bio together, then returns:

- **Trust Score** — 0 to 100, with a plain-English explanation
- **Skill Breakdown** — languages and domains detected, each scored individually
- **Strengths** — what the project/profile signals clearly
- **Gaps** — what's missing or unclear
- **Proof ID** — a unique shareable verification link (e.g. `PC-D74138A6DFEE3061`)
- **PDF export** and **Twitter/X share** built in

Analysis runs in under 10 seconds via Groq's inference API.

---

## Screenshots

### Trust Score — Next.js analyzed (98/100)
<img width="1271" height="724" alt="image" src="https://github.com/user-attachments/assets/d9c3cdf4-0e00-48d9-b5b9-60d46cbd9e07" />

### Skill Breakdown
<img width="1133" height="873" alt="image" src="https://github.com/user-attachments/assets/a1d01ebe-6d16-4868-b0ac-6cb6dbeacf5f" />


---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| AI / LLM | Groq API + Llama 3.3 70B |
| Deployment | Vercel |

No backend server. The Groq API call is made directly from the frontend with a structured prompt — the response is parsed and rendered client-side.

---

## How it works

1. User inputs a **public GitHub repo URL** and a **resume or bio** (min. 50 chars)
2. A structured prompt combining both inputs is sent to **Llama 3.3 via Groq API**
3. The model returns a JSON object with score, skill scores, strengths, and gaps
4. A unique **Proof ID** is generated and attached to the result
5. User can copy a share link, download as PDF, or share on X

---

## Run locally

```bash
git clone https://github.com/Aarti-panchal01/proofchain-ai
cd proofchain-ai/proofchain
```

Open `index.html` in your browser — or use Live Server in VS Code.

To use your own Groq API key:
1. Get a free key at [console.groq.com](https://console.groq.com)
2. Replace the key in the API call inside `script.js`

> Note: For production, move the API key to a server-side function or environment variable. Do not commit your key.

---

## Example output

```
Repo analyzed: github.com/vercel/next.js
Trust Score: 98 / 100

"Next.js is a reliable and performant React framework
with a strong community and frequent updates."

Skill Breakdown:
  JavaScript     95  ████████████████████
  Web Dev        90  ██████████████████
  TypeScript     80  ████████████████
  CSS            70  ██████████████
  Rust           60  ████████████

Strengths: Large Community, Frequent Updates, High Performance
Gaps:      Complexity, Steep Learning Curve
```

---

## Project structure

```
proofchain-ai/
└── proofchain/
    ├── index.html      # Main UI
    ├── style.css       # Styles
    └── script.js       # Groq API call, prompt logic, result rendering
```

---

## Why I built this

Verifying a developer's actual skills from a GitHub profile and resume is hard and slow.
I wanted to see if an LLM with the right prompt could do it in seconds — turns out it can.

Built by [Aarti Panchal](https://aarti-panchal.site) · [LinkedIn](https://linkedin.com/in/aarti-panchal-93196a319) · [GitHub](https://github.com/Aarti-panchal01)
