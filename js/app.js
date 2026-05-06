/* ===========================
   WhatsBot Manager - app.js
=========================== */

const API_URL = 'https://new-bot-4nsf.onrender.com';

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

  const targetNav = document.querySelector(".nav-item[data-page='" + page + "']");
  const targetPage = document.getElementById("page-" + page);

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
            label: ctx => " " + ctx.raw + " mensagens"
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

// ---- BOT REALTIME STATUS ----
async function updateBotStatus() {
  try {
    const response = await fetch(API_URL + "/api/status");
    const data = await response.json();

    const badge = document.getElementById('botStatusBadge');
    const globalDot = document.querySelector('#globalBotStatus .status-dot');
    const globalText = document.querySelector('#globalBotStatus .status-text');
    const qrPlaceholder = document.querySelector('.qr-placeholder');

    if (data.connection === 'open') {
      badge.className = 'status-badge online';
      badge.innerHTML = '<span class="status-dot online"></span> Online';
      globalDot.className = 'status-dot online';
      globalText.textContent = 'Bot Online';
      qrPlaceholder.innerHTML = '<div class="success-icon"><i class="fa-solid fa-circle-check" style="font-size: 48px; color: #25d366;"></i></div><p style="margin-top:10px">WhatsApp Conectado!</p>';
    } else if (data.connection === 'qr' && data.qrImage) {
      badge.className = 'status-badge online';
      badge.innerHTML = '<span class="status-dot online"></span> Aguardando QR Code';
      globalDot.className = 'status-dot online';
      globalText.textContent = 'Aguardando QR Code';
      qrPlaceholder.innerHTML = "<img src='" + data.qrImage + "' alt='QR Code' style='max-width: 250px; border-radius: 8px;'><p style='margin-top:10px'>Escaneie para conectar</p>";
    } else {
      badge.className = 'status-badge offline';
      badge.innerHTML = '<span class="status-dot offline"></span> Desconectado';
      globalDot.className = 'status-dot offline';
      globalText.textContent = 'Bot Offline';
      qrPlaceholder.innerHTML = '<div class="qr-placeholder-inner"><i class="fa-solid fa-qrcode"></i></div><p>Aguardando servidor...</p>';
    }
  } catch (error) {
    console.error('Erro ao buscar status:', error);
  }
}

// Atualizar status a cada 5 segundos
setInterval(updateBotStatus, 5000);
updateBotStatus();

// ---- TOAST ----
function showToast(msg, type = 'success') {
  const toast = document.createElement('div');
  toast.className = "toast " + type;
  toast.innerHTML = "<i class='fa-solid " + (type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-circle-exclamation') + "'></i><span>" + msg + "</span>";
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 100);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  initChart();
  updateBotStatus();
});
