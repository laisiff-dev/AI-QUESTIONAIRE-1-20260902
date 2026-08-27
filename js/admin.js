/**
 * AI 行政效能演講 - 講師控制台邏輯 (Admin Controller)
 */

(function (window) {
  'use strict';

  function initAdmin() {
    console.log('Initializing Admin Controller...');

    // 訂閱數據引擎廣播
    window.SurveyEngine.subscribe((event) => {
      renderAdminView();
    });

    renderAdminView();
    setupAdminActions();
  }

  function renderAdminView() {
    const config = window.SurveyEngine.getConfig();
    const responses = window.SurveyEngine.getResponses();

    const modeBadge = document.getElementById('admin-current-mode');
    const totalCountEl = document.getElementById('admin-total-count');
    const preCountEl = document.getElementById('admin-pre-count');
    const postCountEl = document.getElementById('admin-post-count');
    const modeBtnPre = document.getElementById('btn-mode-pre');
    const modeBtnPost = document.getElementById('btn-mode-post');

    if (modeBadge) {
      if (config.mode === 'pre') {
        modeBadge.className = 'badge badge-amber';
        modeBadge.textContent = '當前開放：課前問卷';
      } else {
        modeBadge.className = 'badge badge-success';
        modeBadge.textContent = '當前開放：課後問卷';
      }
    }

    if (modeBtnPre && modeBtnPost) {
      if (config.mode === 'pre') {
        modeBtnPre.classList.add('btn-primary');
        modeBtnPre.classList.remove('btn-secondary');
        modeBtnPost.classList.add('btn-secondary');
        modeBtnPost.classList.remove('btn-primary');
      } else {
        modeBtnPost.classList.add('btn-primary');
        modeBtnPost.classList.remove('btn-secondary');
        modeBtnPre.classList.add('btn-secondary');
        modeBtnPre.classList.remove('btn-primary');
      }
    }

    const preList = responses.filter(r => r.stage === 'pre');
    const postList = responses.filter(r => r.stage === 'post');

    if (totalCountEl) totalCountEl.textContent = responses.length;
    if (preCountEl) preCountEl.textContent = preList.length;
    const customUrlInput = document.getElementById('admin-custom-url-input');
    if (customUrlInput && !customUrlInput.value) {
      customUrlInput.value = config.customSurveyUrl || (window.location.protocol === 'file:' ? 'http://192.168.1.100:8080/participant.html' : window.location.origin + window.location.pathname.replace('admin.html', 'participant.html'));
    }

    renderResponseTable(responses);
  }

  function renderResponseTable(responses) {
    const tableBody = document.getElementById('admin-table-body');
    if (!tableBody) return;

    if (!responses.length) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem;">尚無問卷資料。您可以點擊「生成 35 份模擬問卷」來快速測試！</td></tr>`;
      return;
    }

    let html = '';
    responses.slice(0, 10).forEach(r => {
      const isPost = r.stage === 'post';
      const stageTag = isPost ? '<span class="badge badge-primary">課後</span>' : '<span class="badge badge-amber">課前</span>';
      const detail = isPost 
        ? `滿意度:${r.postSatisfaction || 5}★ | 回饋: ${(r.postFeedback || '無').substring(0, 20)}...`
        : `AI痛點: ${(r.prePainPoints || []).join(', ')} | 期待: ${(r.preExpectation || '無').substring(0, 20)}...`;

      html += `
        <tr>
          <td>${r.timeStr}</td>
          <td>${stageTag}</td>
          <td>${r.department || '未提供'}</td>
          <td>${isPost ? (r.postSkill || '-') : (r.preSkill || '-')} / 5</td>
          <td>${detail}</td>
        </tr>
      `;
    });

    tableBody.innerHTML = html;
  }

  function setupAdminActions() {
    // 1. 切換至課前問卷模式
    document.getElementById('btn-mode-pre')?.addEventListener('click', () => {
      window.SurveyEngine.updateConfig({ mode: 'pre' });
    });

    // 2. 切換至課後問卷模式
    document.getElementById('btn-mode-post')?.addEventListener('click', () => {
      window.SurveyEngine.updateConfig({ mode: 'post' });
    });

    // 3. 一鍵生成模擬數據
    document.getElementById('btn-generate-mock')?.addEventListener('click', () => {
      window.SurveyEngine.generateMockData(35);
      alert('已成功生成 35 份模擬同仁填寫數據！可前往大螢幕看板查看即時效果。');
    });

    // 4. 清除所有數據
    document.getElementById('btn-clear-data')?.addEventListener('click', () => {
      if (confirm('確定要清除所有收到的問卷資料嗎？（此動作不可復原）')) {
        window.SurveyEngine.clearAllResponses();
      }
    });

    // 5. 匯出 CSV
    document.getElementById('btn-export-csv')?.addEventListener('click', () => {
      const success = window.SurveyEngine.exportCSV();
      if (!success) alert('目前沒有可匯出的問卷資料。');
    });

    // 6. 儲存自訂 QR Code 網址
    document.getElementById('btn-save-url')?.addEventListener('click', () => {
      const input = document.getElementById('admin-custom-url-input');
      if (!input) return;
      const url = input.value.trim();
      if (!url) return;
      window.SurveyEngine.updateConfig({ customSurveyUrl: url });
      alert('已成功設定 QR Code 目標網址！\n大螢幕看板掃描 QR Code 將指向：\n' + url);
    });
  }

  document.addEventListener('DOMContentLoaded', initAdmin);

})(window);
