import { S } from '../state.js';
import { $ } from '../utils.js';

// ── KYC Queue ────────────────────────────────────────────────
export function renderKycQueue() {
  const el = $('kyc-queue-body');
  if (!el) return;

  el.innerHTML = S.kyc.queue.map(c => {
    const statusTag = {
      pending:  '<span class="panel-tag tag-amber">PENDING</span>',
      approved: '<span class="panel-tag tag-green">APPROVED</span>',
      rejected: '<span class="panel-tag tag-red">REJECTED</span>',
      review:   '<span class="panel-tag tag-purple">MANUAL REVIEW</span>',
    }[c.status] || c.status;

    const riskTag = c.risk === 'high'
      ? '<span class="panel-tag tag-red">HIGH</span>'
      : c.risk === 'medium'
        ? '<span class="panel-tag tag-amber">MEDIUM</span>'
        : '<span class="panel-tag tag-green">LOW</span>';

    const pepFlag = c.pep ? '<span class="panel-tag tag-red" style="font-size:9px">PEP</span>' : '';
    const sanctionFlag = c.sanctioned ? '<span class="panel-tag tag-red" style="font-size:9px">SANCTION</span>' : '';

    return `<tr>
      <td style="padding-left:14px" class="mono">${c.id}</td>
      <td>${c.name} ${pepFlag}${sanctionFlag}</td>
      <td class="dim" style="font-size:11px">${c.country}</td>
      <td>${statusTag}</td>
      <td>${riskTag}</td>
      <td class="dim" style="font-size:11px;text-align:center">${c.submitted}</td>
      <td class="dim" style="font-size:11px;text-align:center">${c.waitHours}h</td>
      <td style="text-align:right;padding-right:14px">
        ${c.status === 'pending' || c.status === 'review' ? `
          <button class="hedge-btn" style="font-size:9px;padding:3px 8px;background:var(--green);color:#000" onclick="event.stopPropagation(); window.__approveKyc('${c.id}')">APPROVE</button>
          <button class="hedge-btn" style="font-size:9px;padding:3px 8px;margin-left:4px" onclick="event.stopPropagation(); window.__rejectKyc('${c.id}')">REJECT</button>
        ` : '—'}
      </td>
    </tr>`;
  }).join('');

  // Update KYC summary badges
  const pending = S.kyc.queue.filter(c => c.status === 'pending' || c.status === 'review').length;
  const badge = $('kyc-badge');
  if (badge) {
    badge.textContent = pending;
    badge.style.display = pending > 0 ? '' : 'none';
  }

  // Update stat cards
  setVal('kyc-total',    S.kyc.stats.total);
  setVal('kyc-approved', S.kyc.stats.approved);
  setVal('kyc-pending',  S.kyc.stats.pending);
  setVal('kyc-rejected', S.kyc.stats.rejected);
  setVal('kyc-avg-time', S.kyc.stats.avgHours + 'h');
}

// ── AML / Transaction Monitoring ────────────────────────────
export function renderAmlAlerts() {
  const el = $('aml-alerts-body');
  if (!el) return;

  el.innerHTML = S.compliance.amlAlerts.map(a => {
    const levelTag = {
      high:   '<span class="panel-tag tag-red">HIGH</span>',
      medium: '<span class="panel-tag tag-amber">MEDIUM</span>',
      low:    '<span class="panel-tag tag-green">LOW</span>',
    }[a.level];

    const typeTag = `<span class="panel-tag tag-purple" style="font-size:9px">${a.type}</span>`;

    const statusTag = a.filed
      ? '<span class="panel-tag tag-green" style="font-size:9px">SAR FILED</span>'
      : a.dismissed
        ? '<span class="panel-tag" style="font-size:9px;background:var(--bg3);color:var(--text3)">DISMISSED</span>'
        : '<span class="panel-tag tag-amber" style="font-size:9px">OPEN</span>';

    return `<tr>
      <td style="padding-left:14px" class="mono">${a.accountId}</td>
      <td>${a.name}</td>
      <td>${levelTag}</td>
      <td>${typeTag}</td>
      <td class="mono" style="text-align:right">$${a.amount.toLocaleString()}</td>
      <td class="dim" style="font-size:11px;text-align:center">${a.flagged}</td>
      <td>${statusTag}</td>
      <td style="text-align:right;padding-right:14px">
        ${!a.filed && !a.dismissed ? `
          <button class="hedge-btn" style="font-size:9px;padding:3px 8px;background:var(--red);color:#fff" onclick="window.__fileSar('${a.accountId}')">FILE SAR</button>
          <button class="hedge-btn" style="font-size:9px;padding:3px 8px;margin-left:4px" onclick="window.__dismissAml('${a.accountId}')">DISMISS</button>
        ` : '—'}
      </td>
    </tr>`;
  }).join('');

  // AML badge
  const open = S.compliance.amlAlerts.filter(a => !a.filed && !a.dismissed).length;
  const badge = $('aml-badge');
  if (badge) {
    badge.textContent = open;
    badge.style.display = open > 0 ? '' : 'none';
    badge.className = 'nav-badge' + (open > 0 ? ' red' : '');
  }
}

// ── Withdrawal Approval Queue ────────────────────────────────
export function renderWithdrawalQueue() {
  const el = $('withdrawal-queue-body');
  if (!el) return;

  el.innerHTML = S.compliance.withdrawals.map(w => {
    const statusTag = {
      pending:  '<span class="panel-tag tag-amber">PENDING</span>',
      approved: '<span class="panel-tag tag-green">APPROVED</span>',
      rejected: '<span class="panel-tag tag-red">REJECTED</span>',
      flagged:  '<span class="panel-tag tag-red">FLAGGED</span>',
    }[w.status];

    const methodTag = `<span class="panel-tag" style="background:var(--bg3);color:var(--text2);font-size:9px">${w.method}</span>`;
    const flagIcon = w.firstWithdrawal ? '<span title="First withdrawal" style="color:var(--amber);font-size:10px">★</span> ' : '';

    return `<tr>
      <td style="padding-left:14px" class="mono">${w.accountId}</td>
      <td>${flagIcon}${w.name}</td>
      <td class="mono green" style="text-align:right">$${w.amount.toLocaleString()}</td>
      <td>${methodTag}</td>
      <td class="dim" style="font-size:11px;text-align:center">${w.requested}</td>
      <td>${statusTag}</td>
      <td style="text-align:right;padding-right:14px">
        ${w.status === 'pending' || w.status === 'flagged' ? `
          <button class="hedge-btn" style="font-size:9px;padding:3px 8px;background:var(--green);color:#000" onclick="window.__approveWithdrawal('${w.accountId}')">APPROVE</button>
          <button class="hedge-btn" style="font-size:9px;padding:3px 8px;margin-left:4px" onclick="window.__rejectWithdrawal('${w.accountId}')">REJECT</button>
        ` : '—'}
      </td>
    </tr>`;
  }).join('');

  // Withdrawal badge
  const pending = S.compliance.withdrawals.filter(w => w.status === 'pending' || w.status === 'flagged').length;
  const badge = $('withdrawal-badge');
  if (badge) {
    badge.textContent = pending;
    badge.style.display = pending > 0 ? '' : 'none';
  }
}

// ── Regulatory Reporting Status ──────────────────────────────
export function renderRegulatoryStatus() {
  const el = $('reg-status-body');
  if (!el) return;

  el.innerHTML = S.compliance.regulatory.map(r => {
    const statusTag = r.status === 'filed'
      ? '<span class="panel-tag tag-green">FILED</span>'
      : r.status === 'due'
        ? '<span class="panel-tag tag-amber">DUE</span>'
        : r.status === 'overdue'
          ? '<span class="panel-tag tag-red">OVERDUE</span>'
          : '<span class="panel-tag tag-blue">SCHEDULED</span>';

    return `<tr>
      <td style="padding-left:14px">${r.report}</td>
      <td class="dim" style="font-size:11px">${r.regulator}</td>
      <td class="dim" style="font-size:11px;text-align:center">${r.period}</td>
      <td class="dim" style="font-size:11px;text-align:center">${r.due}</td>
      <td>${statusTag}</td>
      <td class="dim" style="font-size:11px;text-align:right;padding-right:14px">${r.filedOn || '—'}</td>
    </tr>`;
  }).join('');
}

// ── Compliance summary stat helper ───────────────────────────
function setVal(id, val) {
  const el = $(id);
  if (el) el.textContent = val;
}

// ── Render all compliance panels ─────────────────────────────
export function renderCompliance() {
  renderKycQueue();
  renderAmlAlerts();
  renderWithdrawalQueue();
  renderRegulatoryStatus();
}
