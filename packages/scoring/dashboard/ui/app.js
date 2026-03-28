/* eslint-env browser */

const tabs = [...document.querySelectorAll('.tab')];
const panels = {
  overview: document.getElementById('panel-overview'),
  runtime: document.getElementById('panel-runtime'),
  timeline: document.getElementById('panel-timeline'),
  score: document.getElementById('panel-score'),
  sft: document.getElementById('panel-sft'),
};

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function activateTab(tabName) {
  for (const tab of tabs) {
    tab.classList.toggle('is-active', tab.dataset.tab === tabName);
  }
  for (const [name, panel] of Object.entries(panels)) {
    panel.classList.toggle('is-hidden', name !== tabName);
  }
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => activateTab(tab.dataset.tab));
});

function renderOverview(data) {
  panels.overview.innerHTML = `
    <h2>Overview</h2>
    <div class="metric-grid">
      <div class="metric-card"><span>Status</span><strong>${escapeHtml(data.status)}</strong></div>
      <div class="metric-card"><span>Health</span><strong>${escapeHtml(data.health_score ?? 'N/A')}</strong></div>
      <div class="metric-card"><span>Trend</span><strong>${escapeHtml(data.trend)}</strong></div>
      <div class="metric-card"><span>Veto Count</span><strong>${escapeHtml(data.veto_count)}</strong></div>
    </div>
  `;
}

function renderRuntime(data) {
  panels.runtime.innerHTML = `
    <h2>Runtime Context</h2>
    <dl class="detail-list">
      <div><dt>Run ID</dt><dd>${escapeHtml(data.run_id ?? 'N/A')}</dd></div>
      <div><dt>Status</dt><dd>${escapeHtml(data.status)}</dd></div>
      <div><dt>Current Stage</dt><dd>${escapeHtml(data.current_stage ?? 'N/A')}</dd></div>
      <div><dt>Story Key</dt><dd>${escapeHtml(data.scope?.story_key ?? 'N/A')}</dd></div>
      <div><dt>Context Path</dt><dd>${escapeHtml(data.scope?.resolved_context_path ?? 'N/A')}</dd></div>
    </dl>
  `;
}

function renderTimeline(data) {
  panels.timeline.innerHTML = `
    <h2>Stage Timeline</h2>
    <table>
      <thead><tr><th>Stage</th><th>Status</th><th>Score</th><th>Veto</th><th>Iterations</th></tr></thead>
      <tbody>
        ${data.map((entry) => `
          <tr>
            <td>${escapeHtml(entry.stage)}</td>
            <td>${escapeHtml(entry.status)}</td>
            <td>${escapeHtml(entry.phase_score ?? 'N/A')}</td>
            <td>${entry.veto_triggered ? 'yes' : 'no'}</td>
            <td>${escapeHtml(entry.iteration_count ?? 'N/A')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderScore(data) {
  panels.score.innerHTML = `
    <h2>Score Detail</h2>
    <table>
      <thead><tr><th>Stage</th><th>Score</th><th>Raw</th><th>Checks</th><th>Timestamp</th></tr></thead>
      <tbody>
        ${data.records.map((entry) => `
          <tr>
            <td>${escapeHtml(entry.stage)}</td>
            <td>${escapeHtml(entry.phase_score)}</td>
            <td>${escapeHtml(entry.raw_phase_score ?? 'N/A')}</td>
            <td>${escapeHtml(entry.check_item_count)}</td>
            <td>${escapeHtml(entry.timestamp)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderSft(data) {
  const targetAvailabilityRows = Object.entries(data.target_availability || {})
    .map(([target, availability]) => `
      <tr>
        <td>${escapeHtml(target)}</td>
        <td>${escapeHtml(availability.compatible ?? 0)}</td>
        <td>${escapeHtml(availability.incompatible ?? 0)}</td>
      </tr>
    `)
    .join('');

  const rejectionReasons = (data.rejection_reasons || []).length > 0
    ? `
      <table>
        <thead><tr><th>Reason</th><th>Count</th></tr></thead>
        <tbody>
          ${data.rejection_reasons.map((entry) => `
            <tr>
              <td>${escapeHtml(entry.reason)}</td>
              <td>${escapeHtml(entry.count)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    : '<p>No rejection reasons recorded yet.</p>';

  const lastBundle = data.last_bundle
    ? `
      <dl class="detail-list">
        <div><dt>Bundle ID</dt><dd>${escapeHtml(data.last_bundle.bundle_id)}</dd></div>
        <div><dt>Target</dt><dd>${escapeHtml(data.last_bundle.export_target)}</dd></div>
        <div><dt>Created At</dt><dd>${escapeHtml(data.last_bundle.created_at)}</dd></div>
        <div><dt>Manifest</dt><dd>${escapeHtml(data.last_bundle.manifest_path)}</dd></div>
      </dl>
    `
    : '<p>No bundle has been exported yet.</p>';

  const redactionCards = `
    <div class="metric-grid">
      <div class="metric-card"><span>Clean</span><strong>${escapeHtml(data.redaction_status_counts?.clean ?? 0)}</strong></div>
      <div class="metric-card"><span>Redacted</span><strong>${escapeHtml(data.redaction_status_counts?.redacted ?? 0)}</strong></div>
      <div class="metric-card"><span>Blocked</span><strong>${escapeHtml(data.redaction_status_counts?.blocked ?? 0)}</strong></div>
    </div>
  `;

  const redactionRuleRows = (data.redaction_applied_rules || []).length > 0
    ? `
      <table>
        <thead><tr><th>Rule</th><th>Count</th></tr></thead>
        <tbody>
          ${data.redaction_applied_rules.map((entry) => `
            <tr>
              <td>${escapeHtml(entry.rule)}</td>
              <td>${escapeHtml(entry.count)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    : '<p>No redaction rules applied yet.</p>';

  const redactionFindingRows = (data.redaction_finding_kinds || []).length > 0
    ? `
      <table>
        <thead><tr><th>Finding Kind</th><th>Count</th></tr></thead>
        <tbody>
          ${data.redaction_finding_kinds.map((entry) => `
            <tr>
              <td>${escapeHtml(entry.kind)}</td>
              <td>${escapeHtml(entry.count)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    : '<p>No redaction findings recorded yet.</p>';

  const redactionPreviewRows = (data.redaction_preview || []).length > 0
    ? `
      <table>
        <thead><tr><th>Sample</th><th>Status</th><th>Rules</th><th>Finding Kinds</th><th>Rejection Reasons</th></tr></thead>
        <tbody>
          ${data.redaction_preview.map((entry) => `
            <tr>
              <td>${escapeHtml(entry.sample_id)}</td>
              <td>${escapeHtml(entry.status)}</td>
              <td>${escapeHtml((entry.applied_rules || []).join(', ') || 'N/A')}</td>
              <td>${escapeHtml((entry.finding_kinds || []).join(', ') || 'N/A')}</td>
              <td>${escapeHtml((entry.rejection_reasons || []).join(', ') || 'N/A')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    : '<p>No redaction preview samples yet.</p>';

  panels.sft.innerHTML = `
    <h2>SFT Builder Summary</h2>
    <div class="metric-grid">
      <div class="metric-card"><span>Total</span><strong>${escapeHtml(data.total_candidates)}</strong></div>
      <div class="metric-card"><span>Accepted</span><strong>${escapeHtml(data.accepted)}</strong></div>
      <div class="metric-card"><span>Rejected</span><strong>${escapeHtml(data.rejected)}</strong></div>
      <div class="metric-card"><span>Downgraded</span><strong>${escapeHtml(data.downgraded)}</strong></div>
    </div>
    <h3>Target Availability</h3>
    <table>
      <thead><tr><th>Target</th><th>Compatible</th><th>Incompatible</th></tr></thead>
      <tbody>${targetAvailabilityRows}</tbody>
    </table>
    <h3>Last Bundle</h3>
    ${lastBundle}
    <h3>Rejection Reasons</h3>
    ${rejectionReasons}
    <h3>Redaction Status</h3>
    ${redactionCards}
    <h3>Redaction Rules</h3>
    ${redactionRuleRows}
    <h3>Redaction Finding Kinds</h3>
    ${redactionFindingRows}
    <h3>Redaction Preview</h3>
    ${redactionPreviewRows}
  `;
}

async function refresh() {
  const [overview, runtimeContext, timeline, scoreDetail, sftSummary] = await Promise.all([
    fetch('/api/overview').then((response) => response.json()),
    fetch('/api/runtime-context').then((response) => response.json()),
    fetch('/api/stage-timeline').then((response) => response.json()),
    fetch('/api/score-detail').then((response) => response.json()),
    fetch('/api/sft-summary').then((response) => response.json()),
  ]);

  renderOverview(overview);
  renderRuntime(runtimeContext);
  renderTimeline(timeline);
  renderScore(scoreDetail);
  renderSft(sftSummary);
}

activateTab('overview');
refresh();
setInterval(refresh, 2000);
