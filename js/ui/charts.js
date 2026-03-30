import { $ } from '../utils.js';

export let expChart, latChart, revChart;

export function buildCharts() {
  // Exposure history chart
  const expCtx = $('exp-chart');
  if (expCtx) {
    const labels = Array.from({ length: 12 }, (_, i) => (i * 2) + 'h');
    expChart = new Chart(expCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'EUR/USD', data: [900, 1050, 1100, 980, 1200, 1150, 1280, 1230, 1260, 1240, 1250, 1250].map(v => v * 1000), borderColor: '#00d4ff', borderWidth: 1.5, fill: false, tension: 0.4, pointRadius: 0 },
          { label: 'XAU/USD', data: [300, 320, 350, 400, 420, 460, 470, 480, 475, 482, 480, 480].map(v => v * 1000), borderColor: '#ffab00', borderWidth: 1.5, fill: false, tension: 0.4, pointRadius: 0 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#4a5568', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { ticks: { color: '#4a5568', font: { size: 9 }, callback: v => '$' + (v / 1000) + 'k' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        },
      },
    });
  }

  // Latency chart
  const latCtx = $('lat-chart');
  if (latCtx) {
    const pts = Array.from({ length: 30 }, () => +(Math.random() * 4 + 2).toFixed(1));
    latChart = new Chart(latCtx, {
      type: 'line',
      data: {
        labels: pts.map((_, i) => i),
        datasets: [{
          data: pts, borderColor: '#00e676', borderWidth: 1.5,
          fill: true, backgroundColor: 'rgba(0,230,118,0.05)',
          tension: 0.3, pointRadius: 0,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { display: false },
          y: { ticks: { color: '#4a5568', font: { size: 9 }, callback: v => v + 'ms' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        },
      },
    });
  }

  // Revenue chart
  const revCtx = $('revenue-chart');
  if (revCtx) {
    revChart = new Chart(revCtx, {
      type: 'bar',
      data: {
        labels: ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'],
        datasets: [
          { label: 'Gross', data: [61000, 72000, 84000, 91000, 99000, 107745], backgroundColor: 'rgba(0,212,255,0.2)', borderColor: '#00d4ff', borderWidth: 1 },
          { label: 'Net',   data: [22000, 31000, 38000, 43000, 49000, 53478],  backgroundColor: 'rgba(0,230,118,0.2)', borderColor: '#00e676', borderWidth: 1 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#4a5568', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { ticks: { color: '#4a5568', font: { size: 9 }, callback: v => '$' + (v / 1000) + 'k' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        },
      },
    });
  }
}
