/* ── State ─────────────────────────────────────────────── */
let currentTab = 'github';

/* ── DOM refs ──────────────────────────────────────────── */
const tabs = document.querySelectorAll('.tab');
const panelGithub = document.getElementById('panel-github');
const panelText = document.getElementById('panel-text');
const githubInput = document.getElementById('github-url');
const textInput = document.getElementById('resume-text');
const analyzeBtn = document.getElementById('analyze-btn');
const btnText = analyzeBtn.querySelector('.btn-text');
const btnSpinner = analyzeBtn.querySelector('.btn-spinner');
const errorMsg = document.getElementById('error-msg');
const inputSection = document.getElementById('input-section');
const resultSection = document.getElementById('result-section');

/* ── Tab switching ─────────────────────────────────────── */
tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    currentTab = tab.dataset.tab;
    tabs.forEach((t) => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    panelGithub.classList.toggle('hidden', currentTab !== 'github');
    panelText.classList.toggle('hidden', currentTab !== 'text');
    hideError();
  });
});

/* ── Analyze button ────────────────────────────────────── */
analyzeBtn.addEventListener('click', runAnalysis);

githubInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') runAnalysis();
});

async function runAnalysis() {
  const input = currentTab === 'github' ? githubInput.value.trim() : textInput.value.trim();

  if (!input) {
    showError(currentTab === 'github' ? 'Please enter a GitHub URL.' : 'Please paste some text.');
    return;
  }

  if (currentTab === 'github' && !input.includes('github.com')) {
    showError('Please enter a valid GitHub repository URL.');
    return;
  }

  if (currentTab === 'text' && input.length < 50) {
    showError('Please provide at least 50 characters of text.');
    return;
  }

  setLoading(true);
  hideError();

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: currentTab, input })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Analysis failed. Please try again.');
    }

    renderResult(data);
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
}

/* ── Render result ─────────────────────────────────────── */
function renderResult(data) {
  const { proofId, inputLabel, analysis, generatedAt } = data;

  // Proof badge
  document.getElementById('proof-id').textContent = proofId;
  document.getElementById('proof-timestamp').textContent = formatDate(generatedAt);

  // Title
  document.getElementById('result-title').textContent = inputLabel;

  // Trust score ring
  const score = Math.max(0, Math.min(100, analysis.trustScore));
  const circumference = 314; // 2 * π * 50
  const offset = circumference - (score / 100) * circumference;
  const ring = document.getElementById('ring-circle');
  // Set color class
  ring.className = 'ring-fill ' + scoreClass(score, 'ring');
  // Animate (small delay so CSS transition fires)
  setTimeout(() => {
    ring.style.strokeDashoffset = offset;
  }, 80);

  // Animate number
  animateNumber(document.getElementById('trust-number'), 0, score, 1200);

  // Summary + verdict
  document.getElementById('trust-summary').textContent = analysis.summary;
  document.getElementById('verdict-text').textContent = `"${analysis.verdict}"`;

  // Skills
  const skillList = document.getElementById('skill-list');
  skillList.innerHTML = '';
  (analysis.skills || []).forEach((skill, i) => {
    const s = Math.max(0, Math.min(100, skill.score));
    const item = document.createElement('div');
    item.className = 'skill-item';
    item.innerHTML = `
      <div class="skill-header">
        <span class="skill-name">${escHtml(skill.name)}</span>
        <span class="skill-score-label">${s}</span>
      </div>
      <div class="skill-bar-bg">
        <div class="skill-bar-fill ${scoreClass(s, 'bar')}" id="bar-${i}" style="width:0%"></div>
      </div>
      <div class="skill-note">${escHtml(skill.note)}</div>
    `;
    skillList.appendChild(item);
    // Animate bar after paint
    setTimeout(() => {
      document.getElementById(`bar-${i}`).style.width = s + '%';
    }, 100 + i * 60);
  });

  // Strengths
  const strengthsList = document.getElementById('strengths-list');
  strengthsList.innerHTML = (analysis.strengths || []).map((s) => `<li>${escHtml(s)}</li>`).join('');

  // Weaknesses
  const weaknessesList = document.getElementById('weaknesses-list');
  weaknessesList.innerHTML = (analysis.weaknesses || []).map((w) => `<li>${escHtml(w)}</li>`).join('');

  // Show result, hide input (smooth scroll)
  inputSection.classList.add('hidden');
  resultSection.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Copy share link ── */
document.getElementById('share-btn').addEventListener('click', () => {
  const proofId = document.getElementById('proof-id').textContent;
  const url = `${window.location.origin}/?proof=${proofId}`;
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.getElementById('share-btn');
    const orig = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  });
});

/* ── Download PDF ── */
document.getElementById('download-pdf-btn').addEventListener('click', () => {
  // Build a clean printable HTML page
  const proofId   = document.getElementById('proof-id').textContent;
  const title     = document.getElementById('result-title').textContent;
  const score     = document.getElementById('trust-number').textContent;
  const summary   = document.getElementById('trust-summary').textContent;
  const verdict   = document.getElementById('verdict-text').textContent;
  const timestamp = document.getElementById('proof-timestamp').textContent;

  // Collect skills
  const skillItems = document.querySelectorAll('.skill-item');
  let skillsHtml = '';
  skillItems.forEach(item => {
    const name  = item.querySelector('.skill-name').textContent;
    const score = item.querySelector('.skill-score-label').textContent;
    const note  = item.querySelector('.skill-note').textContent;
    const fill  = item.querySelector('.skill-bar-fill');
    const color = fill.classList.contains('bar-high') ? '#22c55e'
                : fill.classList.contains('bar-mid')  ? '#f59e0b' : '#ef4444';
    skillsHtml += `
      <div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-weight:600;color:#1e293b">${escHtml(name)}</span>
          <span style="font-weight:700;color:${color}">${escHtml(score)}/100</span>
        </div>
        <div style="height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${escHtml(score)}%;background:${color};border-radius:4px;"></div>
        </div>
        <div style="font-size:12px;color:#64748b;margin-top:3px;">${escHtml(note)}</div>
      </div>`;
  });

  // Collect strengths
  const strengthItems = document.querySelectorAll('#strengths-list li');
  let strengthsHtml = '';
  strengthItems.forEach(li => {
    strengthsHtml += `<li style="margin-bottom:6px;color:#166534;">✓ ${escHtml(li.textContent)}</li>`;
  });

  // Collect weaknesses
  const weaknessItems = document.querySelectorAll('#weaknesses-list li');
  let weaknessesHtml = '';
  weaknessItems.forEach(li => {
    weaknessesHtml += `<li style="margin-bottom:6px;color:#92400e;">→ ${escHtml(li.textContent)}</li>`;
  });

  const scoreColor = parseInt(score) >= 70 ? '#22c55e' : parseInt(score) >= 40 ? '#f59e0b' : '#ef4444';

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>ProofChain AI — ${escHtml(title)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #fff; color: #1e293b; padding: 40px; max-width: 700px; margin: 0 auto; }
  .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #e2e8f0; }
  .logo { font-size: 22px; font-weight: 800; color: #6366f1; }
  .proof { font-size: 11px; color: #64748b; text-align: right; }
  .proof-id { font-family: monospace; font-weight: 700; color: #6366f1; }
  .score-section { display: flex; align-items: center; gap: 24px; background: #f8fafc; border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid #e2e8f0; }
  .score-circle { width: 90px; height: 90px; border-radius: 50%; border: 8px solid ${scoreColor}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .score-num { font-size: 28px; font-weight: 800; color: ${scoreColor}; }
  .summary { font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 8px; }
  .verdict { font-size: 13px; font-style: italic; color: #6366f1; font-weight: 600; }
  h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 14px; margin-top: 24px; }
  .sw-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 8px; }
  .sw-box { background: #f8fafc; border-radius: 8px; padding: 16px; border: 1px solid #e2e8f0; }
  ul { list-style: none; padding: 0; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    <div class="logo">⬡ ProofChain AI</div>
    <div class="proof">
      <div class="proof-id">${escHtml(proofId)}</div>
      <div>${escHtml(timestamp)}</div>
    </div>
  </div>
  <div class="score-section">
    <div class="score-circle"><span class="score-num">${escHtml(score)}</span></div>
    <div>
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-bottom:6px;">Trust Score for ${escHtml(title)}</div>
      <div class="summary">${escHtml(summary)}</div>
      <div class="verdict">${escHtml(verdict)}</div>
    </div>
  </div>
  <h3>Skill Breakdown</h3>
  ${skillsHtml}
  <div class="sw-grid">
    <div class="sw-box">
      <h3>Strengths</h3>
      <ul>${strengthsHtml}</ul>
    </div>
    <div class="sw-box">
      <h3>Gaps</h3>
      <ul>${weaknessesHtml}</ul>
    </div>
  </div>
  <div class="footer">Generated by ProofChain AI · Powered by Groq + Llama 3.3 · Built for MLH</div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const blobUrl = URL.createObjectURL(blob);
  const printWin = window.open(blobUrl, '_blank');
  printWin.onload = () => {
    setTimeout(() => {
      printWin.print();
      URL.revokeObjectURL(blobUrl);
    }, 400);
  };
});

/* ── Share on X ── */
document.getElementById('share-x-btn').addEventListener('click', () => {
  const title   = document.getElementById('result-title').textContent;
  const score   = document.getElementById('trust-number').textContent;
  const proofId = document.getElementById('proof-id').textContent;
  const caption = `🔍 Just verified "${title}" on ProofChain AI!

✅ Trust Score: ${score}/100
🔐 Proof ID: ${proofId}

Verify developer credibility in 10 seconds with AI ⚡
#ProofChainAI #MLH #builtwithgroq`;
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(caption)}`;
  window.open(url, '_blank');
});

/* ── New analysis ── */
document.getElementById('new-analysis-btn').addEventListener('click', () => {
  resultSection.classList.add('hidden');
  inputSection.classList.remove('hidden');
  githubInput.value = '';
  textInput.value = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ── Helpers ───────────────────────────────────────────── */
function setLoading(on) {
  analyzeBtn.disabled = on;
  btnText.textContent = on ? 'Analyzing...' : 'Analyze Now';
  btnSpinner.classList.toggle('hidden', !on);
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove('hidden');
}

function hideError() {
  errorMsg.classList.add('hidden');
  errorMsg.textContent = '';
}

function scoreClass(score, prefix) {
  if (score >= 70) return prefix + '-high';
  if (score >= 40) return prefix + '-mid';
  return prefix + '-low';
}

function animateNumber(el, from, to, duration) {
  const start = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(from + (to - from) * eased);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
