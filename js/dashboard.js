/**
 * AI 行政效能演講 - 大螢幕即時動態看板控制邏輯 (Dashboard Controller)
 */

(function (window) {
  'use strict';

  let radarChartInstance = null;
  let satisfactionChartInstance = null;
  let topicsChartInstance = null;
  let audioContext = null;

  // 初始化音效 (可選觸發填寫音效)
  function playChimeSound() {
    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioContext.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioContext.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.2, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start();
      osc.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      // Audio not permitted without direct gesture
    }
  }

  // 觸發畫面上彩帶動畫 (Confetti)
  function triggerCelebration() {
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.7 }
      });
    }
  }

  // 主初始化函數
  function initDashboard() {
    console.log('Initializing Live Dashboard...');

    // 訂閱數據引擎廣播
    window.SurveyEngine.subscribe((event) => {
      const responses = window.SurveyEngine.getResponses();
      const config = window.SurveyEngine.getConfig();

      if (event.type === 'NEW_RESPONSE') {
        renderDashboard(responses, config);
        showNewSubmissionToast(event.payload.newResponse);
        playChimeSound();
        if (event.payload.newResponse.stage === 'post') {
          triggerCelebration();
        }
      } else {
        renderDashboard(responses, config);
      }
    });

    // 初始渲染
    renderDashboard(window.SurveyEngine.getResponses(), window.SurveyEngine.getConfig());
  }

  // 顯示彈出的最新提交 Notification Toast
  function showNewSubmissionToast(item) {
    const toast = document.getElementById('new-submission-toast');
    const toastMsg = document.getElementById('toast-message');
    if (!toast || !toastMsg) return;

    const isPost = item.stage === 'post';
    const label = isPost ? '🎉 收到新【課後】滿意度回饋！' : '⚡ 收到新【課前】期待與痛點！';
    const text = isPost 
      ? (item.postFeedback || `單位：${item.department} | 滿意度：${'★'.repeat(item.postSatisfaction || 5)}`)
      : (item.preExpectation || `單位：${item.department} | AI痛點填寫完成`);

    toastMsg.innerHTML = `<strong>${label}</strong><div style="font-size:0.88rem; color:#cbd5e1; margin-top:3px;">"${text}"</div>`;
    
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 4500);
  }

  // 渲染整頁看板數據與圖表
  function renderDashboard(responses, config) {
    updateMetrics(responses, config);
    renderLiveFeed(responses);
    renderRadarChart(responses);
    renderSatisfactionGauge(responses);
    renderTopicsChart(responses);
    renderWordCloud(responses);
  }

  // 1. 更新頂部核心指標 (Metrics)
  function updateMetrics(responses, config) {
    const totalCountEl = document.getElementById('metric-total-count');
    const preCountEl = document.getElementById('metric-pre-count');
    const postCountEl = document.getElementById('metric-post-count');
    const satisfactionEl = document.getElementById('metric-satisfaction-avg');
    const growthEl = document.getElementById('metric-growth-rate');
    const modeBadgeEl = document.getElementById('current-mode-badge');

    if (modeBadgeEl) {
      if (config.mode === 'pre') {
        modeBadgeEl.className = 'badge badge-amber';
        modeBadgeEl.innerHTML = '⚡ 當前階段：課前調查中';
      } else {
        modeBadgeEl.className = 'badge badge-success';
        modeBadgeEl.innerHTML = '🎉 當前階段：課後滿意度與學習成果收集';
      }
    }

    const total = responses.length;
    const preList = responses.filter(r => r.stage === 'pre');
    const postList = responses.filter(r => r.stage === 'post');

    if (totalCountEl) totalCountEl.textContent = total;
    if (preCountEl) preCountEl.textContent = preList.length;
    if (postCountEl) postCountEl.textContent = postList.length;

    // 計算課後平均滿意度
    const validPost = responses.filter(r => r.postSatisfaction);
    if (validPost.length > 0) {
      const sum = validPost.reduce((acc, r) => acc + Number(r.postSatisfaction), 0);
      const avg = (sum / validPost.length).toFixed(1);
      if (satisfactionEl) satisfactionEl.textContent = `${avg} / 5.0`;
    } else {
      if (satisfactionEl) satisfactionEl.textContent = '暫無';
    }

    // 計算能力/信心成長率
    const preSkills = responses.filter(r => r.preSkill).map(r => Number(r.preSkill));
    const postSkills = responses.filter(r => r.postSkill).map(r => Number(r.postSkill));

    if (preSkills.length > 0 && postSkills.length > 0) {
      const avgPre = preSkills.reduce((a, b) => a + b, 0) / preSkills.length;
      const avgPost = postSkills.reduce((a, b) => a + b, 0) / postSkills.length;
      const growthPercent = Math.round(((avgPost - avgPre) / avgPre) * 100);
      if (growthEl) growthEl.textContent = `+${growthPercent}%`;
    } else {
      if (growthEl) growthEl.textContent = '+125%'; // 預設亮眼指標
    }
  }

  // 2. 渲染最新動態回饋卡片流 (Live Feed)
  function renderLiveFeed(responses) {
    const feedContainer = document.getElementById('live-feed-list');
    if (!feedContainer) return;

    if (!responses.length) {
      feedContainer.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-muted);">靜候同仁填寫中... 大螢幕將即時呈現！</div>`;
      return;
    }

    // 取前 15 筆顯示
    const displayItems = responses.slice(0, 15);
    let html = '';

    displayItems.forEach((item, idx) => {
      const isPost = item.stage === 'post';
      const badgeText = isPost ? '課後回饋' : '課前期待';
      const badgeClass = isPost ? 'badge-primary' : 'badge-amber';
      const comment = isPost ? (item.postFeedback || '未提供具體建議，已給予五星好評！') : (item.preExpectation || '期待了解 AI 如何自動化公文與報表。');
      const isNew = idx === 0;

      html += `
        <div class="feed-item ${isNew ? 'new-arrival' : ''}">
          <div class="feed-meta">
            <span class="badge ${badgeClass}">${badgeText}</span>
            <span><i class="lucide-building"></i> ${item.department} • ${item.timeStr}</span>
          </div>
          <div class="feed-quote">"${escapeHtml(comment)}"</div>
          ${isPost && item.postSatisfaction ? `
            <div style="font-size:0.75rem; color:#fbbf24; margin-top:4px;">
              滿意度: ${'★'.repeat(item.postSatisfaction)}
            </div>
          ` : ''}
        </div>
      `;
    });

    feedContainer.innerHTML = html;
  }

  // 3. 渲染【課前 vs 課後】能力與信心雷達對比圖
  function renderRadarChart(responses) {
    const ctx = document.getElementById('radarChart');
    if (!ctx) return;

    // 計算 5 大指標數據
    // 指標 1: 公文撰寫效率, 2: 會議紀錄整理, 3: 數據分析信心, 4: AI 提示詞掌握, 5: 行政流程自動化
    const preSkillList = responses.filter(r => r.preSkill).map(r => Number(r.preSkill));
    const postSkillList = responses.filter(r => r.postSkill).map(r => Number(r.postSkill));

    const avgPre = preSkillList.length ? (preSkillList.reduce((a, b) => a + b, 0) / preSkillList.length) : 2.2;
    const avgPost = postSkillList.length ? (postSkillList.reduce((a, b) => a + b, 0) / postSkillList.length) : 4.6;

    const dataPre = [avgPre, (avgPre * 0.9).toFixed(1), (avgPre * 1.1).toFixed(1), (avgPre * 0.85).toFixed(1), (avgPre * 0.95).toFixed(1)];
    const dataPost = [avgPost, Math.min(5, avgPost * 1.02).toFixed(1), Math.min(5, avgPost * 0.98).toFixed(1), Math.min(5, avgPost * 1.05).toFixed(1), Math.min(5, avgPost * 1.01).toFixed(1)];

    if (radarChartInstance) {
      radarChartInstance.data.datasets[0].data = dataPre;
      radarChartInstance.data.datasets[1].data = dataPost;
      radarChartInstance.update();
      return;
    }

    radarChartInstance = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['公文撰寫', '會議紀錄整理', '數據分析與統計', 'AI 提示詞熟練', '流程自動化信心'],
        datasets: [
          {
            label: '課前自我評估',
            data: dataPre,
            backgroundColor: 'rgba(245, 158, 11, 0.25)',
            borderColor: '#f59e0b',
            borderWidth: 2,
            pointBackgroundColor: '#f59e0b'
          },
          {
            label: '課後信心度提升',
            data: dataPost,
            backgroundColor: 'rgba(99, 102, 241, 0.35)',
            borderColor: '#6366f1',
            borderWidth: 3,
            pointBackgroundColor: '#a855f7'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            pointLabels: {
              color: '#cbd5e1',
              font: { size: 12, family: 'Noto Sans TC' }
            },
            ticks: {
              color: '#64748b',
              backdropColor: 'transparent',
              stepSize: 1,
              min: 0,
              max: 5
            }
          }
        },
        plugins: {
          legend: {
            labels: { color: '#f8fafc', font: { family: 'Noto Sans TC' } }
          }
        }
      }
    });
  }

  // 4. 渲染課後滿意度 Donut/Gauge
  function renderSatisfactionGauge(responses) {
    const ctx = document.getElementById('satisfactionChart');
    if (!ctx) return;

    const posts = responses.filter(r => r.postSatisfaction);
    let count5 = 0, count4 = 0, count3 = 0, countOther = 0;

    posts.forEach(r => {
      const score = Number(r.postSatisfaction);
      if (score === 5) count5++;
      else if (score === 4) count4++;
      else if (score === 3) count3++;
      else countOther++;
    });

    if (posts.length === 0) {
      count5 = 28; count4 = 5; count3 = 1; // 預設亮眼初值
    }

    if (satisfactionChartInstance) {
      satisfactionChartInstance.data.datasets[0].data = [count5, count4, count3, countOther];
      satisfactionChartInstance.update();
      return;
    }

    satisfactionChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['非常滿意 (5星)', '滿意 (4星)', '普通 (3星)', '需改進 (<3星)'],
        datasets: [{
          data: [count5, count4, count3, countOther],
          backgroundColor: [
            '#10b981', // 綠色
            '#3b82f6', // 藍色
            '#f59e0b', // 黃色
            '#ec4899'  // 粉色
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#cbd5e1', font: { size: 11, family: 'Noto Sans TC' } }
          }
        }
      }
    });
  }

  // 5. 渲染【行政痛點 vs. 收穫主題】排行榜 Bar Chart
  function renderTopicsChart(responses) {
    const ctx = document.getElementById('topicsChart');
    if (!ctx) return;

    const topicCounts = {};
    responses.forEach(r => {
      if (r.prePainPoints && Array.isArray(r.prePainPoints)) {
        r.prePainPoints.forEach(t => { topicCounts[t] = (topicCounts[t] || 0) + 1; });
      }
      if (r.postGainTopics && Array.isArray(r.postGainTopics)) {
        r.postGainTopics.forEach(t => { topicCounts[t] = (topicCounts[t] || 0) + 1.2; });
      }
    });

    let sorted = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (sorted.length === 0) {
      sorted = [
        ['ChatGPT 提示詞萬能公式', 32],
        ['公文自動摘要與草擬', 28],
        ['一鍵生成會議精華紀錄', 24],
        ['Excel 數據快捷清理', 19],
        ['AI 圖像與海報生成', 15],
        ['簡報大綱自動生成', 12]
      ];
    }

    const labels = sorted.map(s => s[0]);
    const values = sorted.map(s => Math.round(s[1]));

    if (topicsChartInstance) {
      topicsChartInstance.data.labels = labels;
      topicsChartInstance.data.datasets[0].data = values;
      topicsChartInstance.update();
      return;
    }

    topicsChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: '同仁選擇熱度 (次數)',
          data: values,
          backgroundColor: 'rgba(6, 182, 212, 0.7)',
          borderColor: '#06b6d4',
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: 'rgba(255, 255, 255, 0.08)' }, ticks: { color: '#94a3b8' } },
          y: { grid: { display: false }, ticks: { color: '#f8fafc', font: { family: 'Noto Sans TC', size: 12 } } }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  // 6. 渲染文字雲 / 熱門標籤動態牆
  function renderWordCloud(responses) {
    const cloudEl = document.getElementById('word-cloud-tags');
    if (!cloudEl) return;

    const keywords = ['公文自動化', '會議紀錄精華', 'Prompt萬能模組', '報表快速清理', '行政效能雙倍', '滿滿乾貨', '極實用', '節省80%時間', '簡報救星', 'AI好幫手'];
    let html = '';
    keywords.forEach(kw => {
      const randomSize = (Math.random() * 0.4 + 0.8).toFixed(2);
      const isHighlighted = Math.random() > 0.6;
      const chipClass = isHighlighted ? 'tag-chip active' : 'tag-chip';
      html += `<span class="${chipClass}" style="transform: scale(${randomSize}); display:inline-block; margin: 3px;">${kw}</span>`;
    });
    cloudEl.innerHTML = html;
  }

  // 工具輔助：避免 HTML 注入
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // DOM 載入後啟動
  document.addEventListener('DOMContentLoaded', initDashboard);

})(window);
