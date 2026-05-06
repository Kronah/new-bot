/* ===========================
   WhatsBot Manager - app.js
=========================== */

// ---- NAVIGATION ----
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');
const pageTitle = document.getElementById('pageTitle');

const pageTitles = {
  'dashboard': 'Dashboard',
  'bot-status': 'Status do Bot',
  'auto-messages': 'Mensagens Automáticas',
  'contacts': 'Contatos',
  'flows': 'Fluxos de Atendimento',
  'logs': 'Logs do Sistema',
  'settings': 'Configurações'
};

navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const page = item.dataset.page;
    navigateTo(page);
    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('mobile-open');
  });
});

function navigateTo(page) {
  navItems.forEach(i => i.classList.remove('active'));
  pages.forEach(p => p.classList.remove('active'));

  const targetNav = document.querySelector(`.nav-item[data-page="${page}"]`);
  const targetPage = document.getElementById(`page-${page}`);

  if (targetNav) targetNav.classList.add('active');
  if (targetPage) targetPage.classList.add('active');
  if (pageTitle) pageTitle.textContent = pageTitles[page] || page;
}

// ---- SIDEBAR TOGGLE ----
const sidebar = document.getElementById('sidebar');
const mainContent = document.getElementById('mainContent');
const sidebarToggle = document.getElementById('sidebarToggle');
const mobileToggle = document.getElementById('mobileToggle');

sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
  mainContent.classList.toggle('expanded');
});

mobileToggle.addEventListener('click', () => {
  sidebar.classList.toggle('mobile-open');
});

// Close sidebar on outside click (mobile)
document.addEventListener('click', (e) => {
  if (window.innerWidth <= 768) {
    if (!sidebar.contains(e.target) && !mobileToggle.contains(e.target)) {
      sidebar.classList.remove('mobile-open');
    }
  }
});

// ---- CHART ----
function initChart() {
  const ctx = document.getElementById('messagesChart');
  if (!ctx) return;

  const labels = ['08h','09h','10h','11h','12h','13h','14h','15h','16h','17h','18h'];
  const data = [12, 28, 45, 67, 89, 54, 112, 98, 76, 43, 21];

  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Mensagens',
        data,
        borderColor: '#25d366',
        backgroundColor: 'rgba(37,211,102,0.08)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#25d366',
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1c2128',
          borderColor: '#30363d',
          borderWidth: 1,
          titleColor: '#e6edf3',
          bodyColor: '#8b949e',
          callbacks: {
            label: ctx => ` ${ctx.raw} mensagens`
          }
        }
      },
      scales: {
        x: {
          grid: { color: '#21262d' },
          ticks: { color: '#8b949e', font: { size: 11 } }
        },
        y: {
          grid: { color: '#21262d' },
          ticks: { color: '#8b949e', font: { size: 11 } },
          beginAtZero: true
        }
      }
    }
  });
}

// ---- BOT TOGGLE ----
let botOnline = true;

function toggleBot() {
  botOnline = !botOnline;
  const badge = document.getElementById('botStatusBadge');
  const btn = document.getElementById('btnStopBot');
  const globalDot = document.querySelector('#globalBotStatus .status-dot');
  const globalText = document.querySelector('#globalBotStatus .status-text');

  if (botOnline) {
    badge.className = 'status-badge online';
    badge.innerHTML = '<span class="status-dot online"></span> Online';
    btn.innerHTML = '<i class="fa-solid fa-stop"></i> Parar Bot';
    btn.className = 'btn btn-danger';
    globalDot.className = 'status-dot online';
    globalText.textContent = 'Bot Online';
    showToast('Bot iniciado com sucesso!', 'success');
  } else {
    badge.className = 'status-badge offline';
    badge.innerHTML = '<span class="status-dot offline"></span> Offline';
    btn.innerHTML = '<i class="fa-solid fa-play"></i> Iniciar Bot';
    btn.className = 'btn btn-primary';
    globalDot.className = 'status-dot offline';
    globalText.textContent = 'Bot Offline';
    showToast('Bot parado.', 'warn');
  }
}

function restartBot() {
  showToast('Reiniciando bot...', 'warn');
  setTimeout(() => showToast('Bot reiniciado com sucesso!', 'success'), 2000);
}

function generateQR() {
  const placeholder = document.querySelector('.qr-placeholder');
  placeholder.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(7,20px);gap:2px;padding:8px;background:#fff;border-radius:4px;">
      ${Array.from({length:49}, (_,i) => `<div style="width:20px;height:20px;background:${Math.random()>0.5?'#000':'#fff'};border-radius:2px;"></div>`).join('')}
    </div>
    <p style="margin-top:8px;">Escaneie com o WhatsApp</p>
    <small>Expira em 60 segundos</small>
  `;
  showToast('QR Code gerado! Escaneie com o WhatsApp.', 'success');
}

// ---- UPTIME COUNTER ----
let uptimeSeconds = 5 * 3600 + 32 * 60;

function updateUptime() {
  if (!botOnline) return;
  uptimeSeconds++;
  const h = Math.floor(uptimeSeconds / 3600);
  const m = Math.floor((uptimeSeconds % 3600) / 60);
  const el = document.getElementById('uptime-counter');
  if (el) el.textContent = `${h}h ${m}m`;
}

setInterval(updateUptime, 1000);

// ---- MESSAGES ----
let editingRow = null;

function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  editingRow = null;
  document.getElementById('modalMessageTitle') && (document.getElementById('modalMessageTitle').textContent = 'Nova Mensagem Automática');
  clearForm('modalAddMessage');
  clearForm('modalAddContact');
  clearForm('modalAddFlow');
}

function clearForm(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.querySelectorAll('input[type="text"], input[type="email"], textarea').forEach(el => {
    if (!el.id.includes('bot') && !el.id.includes('away') && !el.id.includes('contact')) el.value = '';
  });
}

function saveMessage() {
  const name = document.getElementById('msgName').value.trim();
  const trigger = document.getElementById('msgTrigger').value.trim();
  const content = document.getElementById('msgContent').value.trim();
  const active = document.getElementById('msgActive').checked;

  if (!name || !trigger || !content) {
    showToast('Preencha todos os campos obrigatórios.', 'error');
    return;
  }

  const statusBadge = active
    ? '<span class="badge-green">Ativo</span>'
    : '<span class="badge-orange">Pausado</span>';

  if (editingRow) {
    const cells = editingRow.querySelectorAll('td');
    cells[0].textContent = name;
    cells[1].innerHTML = `<code>${trigger}</code>`;
    cells[2].textContent = content;
    cells[3].innerHTML = statusBadge;
    showToast('Mensagem atualizada!', 'success');
  } else {
    const tbody = document.getElementById('messagesBody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${name}</td>
      <td><code>${trigger}</code></td>
      <td>${content}</td>
      <td>${statusBadge}</td>
      <td class="actions">
        <button class="btn-icon" onclick="editMessage(this)"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-icon danger" onclick="deleteRow(this)"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
    showToast('Mensagem criada com sucesso!', 'success');
  }

  closeModal('modalAddMessage');
}

function editMessage(btn) {
  const row = btn.closest('tr');
  editingRow = row;
  const cells = row.querySelectorAll('td');
  document.getElementById('msgName').value = cells[0].textContent;
  document.getElementById('msgTrigger').value = cells[1].textContent;
  document.getElementById('msgContent').value = cells[2].textContent;
  document.getElementById('modalMessageTitle').textContent = 'Editar Mensagem';
  openModal('modalAddMessage');
}

function filterMessages(query) {
  const rows = document.querySelectorAll('#messagesBody tr');
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(query.toLowerCase()) ? '' : 'none';
  });
}

// ---- CONTACTS ----
function saveContact() {
  const name = document.getElementById('contactName').value.trim();
  const number = document.getElementById('contactNumber').value.trim();

  if (!name || !number) {
    showToast('Nome e número são obrigatórios.', 'error');
    return;
  }

  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const colors = ['', 'blue', 'orange', 'purple'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const now = new Date();
  const dateStr = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}`;

  const tbody = document.getElementById('contactsBody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><div class="contact-name"><div class="avatar ${color}">${initials}</div>${name}</div></td>
    <td>${number}</td>
    <td>${dateStr}</td>
    <td>0</td>
    <td><span class="badge-green">Ativo</span></td>
    <td class="actions">
      <button class="btn-icon" onclick="viewContact(this)"><i class="fa-solid fa-eye"></i></button>
      <button class="btn-icon danger" onclick="deleteRow(this)"><i class="fa-solid fa-trash"></i></button>
    </td>
  `;
  tbody.appendChild(tr);
  closeModal('modalAddContact');
  showToast('Contato adicionado com sucesso!', 'success');
}

function viewContact(btn) {
  const row = btn.closest('tr');
  const cells = row.querySelectorAll('td');
  const name = cells[0].textContent.trim();
  const number = cells[1].textContent;
  showToast(`Contato: ${name} | ${number}`, 'success');
}

function filterContacts(query) {
  const rows = document.querySelectorAll('#contactsBody tr');
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(query.toLowerCase()) ? '' : 'none';
  });
}

function exportContacts() {
  const rows = document.querySelectorAll('#contactsBody tr');
  let csv = 'Nome,Número,Último Contato,Mensagens,Status\n';
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    const name = cells[0].textContent.trim();
    const number = cells[1].textContent.trim();
    const date = cells[2].textContent.trim();
    const msgs = cells[3].textContent.trim();
    const status = cells[4].textContent.trim();
    csv += `"${name}","${number}","${date}","${msgs}","${status}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'contatos_whatsbot.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Contatos exportados com sucesso!', 'success');
}

// ---- FLOWS ----
const flowIcons = {
  'fa-diagram-project': 'green',
  'fa-utensils': 'green',
  'fa-headset': 'blue',
  'fa-calendar-check': 'purple',
  'fa-tag': 'orange',
  'fa-truck': 'blue'
};

function saveFlow() {
  const name = document.getElementById('flowName').value.trim();
  const desc = document.getElementById('flowDesc').value.trim();
  const icon = document.getElementById('flowIcon').value;

  if (!name) {
    showToast('Nome do fluxo é obrigatório.', 'error');
    return;
  }

  const color = flowIcons[icon] || 'green';
  const grid = document.getElementById('flowsGrid');
  const addCard = grid.querySelector('.add-flow-card');

  const card = document.createElement('div');
  card.className = 'flow-card';
  card.innerHTML = `
    <div class="flow-icon ${color}"><i class="fa-solid ${icon}"></i></div>
    <div class="flow-info">
      <h3>${name}</h3>
      <p>${desc || 'Sem descrição.'}</p>
      <div class="flow-meta">
        <span><i class="fa-solid fa-code-branch"></i> 1 etapa</span>
        <span class="badge-green">Ativo</span>
      </div>
    </div>
    <div class="flow-actions">
      <button class="btn btn-sm btn-outline" onclick="editFlow(this)"><i class="fa-solid fa-pen"></i> Editar</button>
      <button class="btn btn-sm btn-danger" onclick="deleteFlow(this)"><i class="fa-solid fa-trash"></i></button>
    </div>
  `;

  grid.insertBefore(card, addCard);
  closeModal('modalAddFlow');
  showToast('Fluxo criado com sucesso!', 'success');
}

function editFlow(btn) {
  const card = btn.closest('.flow-card');
  const name = card.querySelector('h3').textContent;
  showToast(`Editando fluxo: ${name}`, 'warn');
}

function deleteFlow(btn) {
  const card = btn.closest('.flow-card');
  const name = card.querySelector('h3').textContent;
  if (confirm(`Deseja excluir o fluxo "${name}"?`)) {
    card.remove();
    showToast('Fluxo excluído.', 'warn');
  }
}

// ---- LOGS ----
function filterLogs(type, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const entries = document.querySelectorAll('.log-entry');
  entries.forEach(entry => {
    if (type === 'all' || entry.dataset.type === type) {
      entry.classList.remove('hidden');
    } else {
      entry.classList.add('hidden');
    }
  });
}

function clearLogs() {
  if (confirm('Deseja limpar todos os logs?')) {
    document.getElementById('logContainer').innerHTML = `
      <div class="log-entry info" data-type="info">
        <span class="log-time">${new Date().toLocaleTimeString('pt-BR')}</span>
        <span class="log-type info">INFO</span>
        <span class="log-msg">Logs limpos pelo administrador.</span>
      </div>
    `;
    showToast('Logs limpos com sucesso.', 'success');
  }
}

function exportLogs() {
  const entries = document.querySelectorAll('.log-entry:not(.hidden)');
  let text = 'WHATSBOT MANAGER - LOGS\n';
  text += `Exportado em: ${new Date().toLocaleString('pt-BR')}\n`;
  text += '='.repeat(60) + '\n\n';

  entries.forEach(entry => {
    const time = entry.querySelector('.log-time').textContent;
    const type = entry.querySelector('.log-type').textContent;
    const msg = entry.querySelector('.log-msg').textContent;
    text += `[${time}] [${type}] ${msg}\n`;
  });

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'whatsbot_logs.txt';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Logs exportados com sucesso!', 'success');
}

// ---- SETTINGS ----
function saveSettings() {
  const botName = document.getElementById('botName').value;
  showToast(`Configurações salvas! Bot: ${botName}`, 'success');
}

function confirmReset() {
  if (confirm('ATENÇÃO: Isso irá resetar TODAS as configurações. Deseja continuar?')) {
    showToast('Sistema resetado para configurações padrão.', 'warn');
  }
}

// ---- GENERIC HELPERS ----
function deleteRow(btn) {
  const row = btn.closest('tr');
  if (confirm('Deseja excluir este item?')) {
    row.remove();
    showToast('Item excluído.', 'warn');
  }
}

// ---- TOAST ----
let toastTimeout;

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

// ---- LIVE STATS SIMULATION ----
function simulateLiveStats() {
  const msgEl = document.getElementById('stat-messages');
  const pendEl = document.getElementById('stat-pending');

  if (msgEl) {
    let val = parseInt(msgEl.textContent.replace(/\D/g, ''));
    val += Math.floor(Math.random() * 3);
    msgEl.textContent = val.toLocaleString('pt-BR');
  }

  if (pendEl) {
    let val = parseInt(pendEl.textContent);
    val = Math.max(0, val + (Math.random() > 0.5 ? 1 : -1));
    pendEl.textContent = val;
  }
}

setInterval(simulateLiveStats, 5000);

// ---- LIVE LOG SIMULATION ----
const logMessages = [
  { type: 'info', msg: 'Nova mensagem recebida de +55 11 9{rand}-{rand2}.' },
  { type: 'info', msg: 'Gatilho "Boas-vindas" acionado.' },
  { type: 'info', msg: 'Fluxo "Cardápio" iniciado.' },
  { type: 'warn', msg: 'Mensagem sem gatilho correspondente.' },
  { type: 'info', msg: 'Atendimento encerrado com sucesso.' },
  { type: 'info', msg: 'Novo contato registrado.' },
  { type: 'warn', msg: 'Latência elevada: ' + (Math.floor(Math.random()*200)+200) + 'ms.' },
];

function addLiveLog() {
  const container = document.getElementById('logContainer');
  if (!container) return;

  const item = logMessages[Math.floor(Math.random() * logMessages.length)];
  const msg = item.msg
    .replace('{rand}', Math.floor(Math.random() * 90000 + 10000))
    .replace('{rand2}', Math.floor(Math.random() * 9000 + 1000));

  const now = new Date().toLocaleTimeString('pt-BR');
  const entry = document.createElement('div');
  entry.className = `log-entry ${item.type}`;
  entry.dataset.type = item.type;
  entry.innerHTML = `
    <span class="log-time">${now}</span>
    <span class="log-type ${item.type}">${item.type === 'info' ? 'INFO' : 'AVISO'}</span>
    <span class="log-msg">${msg}</span>
  `;

  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;

  // Keep max 50 entries
  while (container.children.length > 50) {
    container.removeChild(container.firstChild);
  }
}

setInterval(addLiveLog, 8000);

// ---- CLOSE MODAL ON OVERLAY CLICK ----
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('open');
      editingRow = null;
    }
  });
});

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  initChart();
  navigateTo('dashboard');
});
