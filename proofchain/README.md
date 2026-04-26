# ProofChain AI

AI-powered developer verification. Paste a GitHub repo or resume → get an instant trust score and skill breakdown.

## Setup

1. Clone this repo
2. Run `npm install`
3. Copy `.env.example` to `.env` and fill in your `ANTHROPIC_API_KEY`
4. Optionally add `GITHUB_TOKEN` for higher GitHub API rate limits
5. Run `npm start`
6. Open http://localhost:3000

## How it works

- GitHub URL → fetches repo metadata, languages, commits, and README via GitHub API
- Resume text → sent directly to Claude for analysis
- Claude returns a JSON object with trust score, skill breakdown, strengths, and weaknesses
- A SHA-256 Proof ID is generated from the input + timestamp

## Stack

- Express.js backend (Node.js 20)
- Vanilla HTML/CSS/JS frontend
- Anthropic Claude API (`claude-sonnet-4-20250514`)
- Native fetch for GitHub API calls
