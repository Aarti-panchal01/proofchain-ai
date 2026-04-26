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

/* ── Share button ──────────────────────────────────────── */
document.getElementById('share-btn').addEventListener('click', () => {
  const proofId = document.getElementById('proof-id').textContent;
  const url = `${window.location.origin}/?proof=${proofId}`;
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.getElementById('share-btn');
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => {
      btn.textContent = original;
    }, 2000);
  });
});

/* ── New analysis button ───────────────────────────────── */
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
