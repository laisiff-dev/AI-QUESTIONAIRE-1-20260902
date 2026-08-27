/**
 * AI 行政效能演講 - 同仁手機問卷填寫邏輯 (Participant Form Controller)
 */

(function (window) {
  'use strict';

  let currentStage = 'post'; // 預設或動態從 SurveyEngine 獲取
  let selectedPreSkill = 3;
  let selectedPostSatisfaction = 5;
  let selectedPostSkill = 5;

  function initParticipantForm() {
    console.log('Initializing Participant Form...');

    const urlParams = new URLSearchParams(window.location.search);
    const forcedStage = urlParams.get('stage');

    if (forcedStage === 'pre' || forcedStage === 'post') {
      currentStage = forcedStage;
    } else {
      // 訂閱設定變更 (講師動態切換階段時，手機頁面同步切換模式)
      window.SurveyEngine.subscribe((event) => {
        if (event.type === 'CONFIG_UPDATED' || event.type === 'DATA_UPDATED') {
          const config = window.SurveyEngine.getConfig();
          if (config.mode !== currentStage) {
            currentStage = config.mode;
            renderFormStage(currentStage);
          }
        }
      });

      const initialConfig = window.SurveyEngine.getConfig();
      currentStage = initialConfig.mode;
    }

    renderFormStage(currentStage);

    setupStarRatings();
    setupTagChips();
    setupFormSubmit();
  }

  // 根據 currentStage (pre / post) 渲染對應問卷內容
  function renderFormStage(stage) {
    const stagePreEl = document.getElementById('stage-pre-fields');
    const stagePostEl = document.getElementById('stage-post-fields');
    const stageTitleBadge = document.getElementById('form-stage-badge');
    const formTitle = document.getElementById('form-main-title');

    if (stage === 'pre') {
      if (stagePreEl) stagePreEl.style.display = 'block';
      if (stagePostEl) stagePostEl.style.display = 'none';
      if (stageTitleBadge) {
        stageTitleBadge.className = 'badge badge-amber';
        stageTitleBadge.textContent = '⚡ 課前問卷：期待與痛點調查';
      }
      if (formTitle) formTitle.textContent = '課前學習期待調查';
    } else {
      if (stagePreEl) stagePreEl.style.display = 'none';
      if (stagePostEl) stagePostEl.style.display = 'block';
      if (stageTitleBadge) {
        stageTitleBadge.className = 'badge badge-success';
        stageTitleBadge.textContent = '🎉 課後問卷：滿意度與學習收穫';
      }
      if (formTitle) formTitle.textContent = '課後滿意度與回饋問卷';
    }
  }

  // 設定星級評分組件
  function setupStarRatings() {
    // 課前熟練度
    bindStars('pre-skill-stars', (val) => {
      selectedPreSkill = val;
    }, 3);

    // 課後滿意度
    bindStars('post-satisfaction-stars', (val) => {
      selectedPostSatisfaction = val;
    }, 5);

    // 課後信心度
    bindStars('post-skill-stars', (val) => {
      selectedPostSkill = val;
    }, 5);
  }

  function bindStars(containerId, onChange, defaultVal = 5) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const stars = container.querySelectorAll('.star');
    updateStarUI(stars, defaultVal);

    stars.forEach((star) => {
      star.addEventListener('click', () => {
        const val = parseInt(star.getAttribute('data-value'), 10);
        updateStarUI(stars, val);
        onChange(val);
      });

      star.addEventListener('mouseenter', () => {
        const val = parseInt(star.getAttribute('data-value'), 10);
        highlightStarHover(stars, val);
      });

      container.addEventListener('mouseleave', () => {
        const currentVal = parseInt(container.getAttribute('data-selected') || defaultVal, 10);
        updateStarUI(stars, currentVal);
      });
    });
  }

  function updateStarUI(stars, value) {
    const container = stars[0]?.parentElement;
    if (container) container.setAttribute('data-selected', value);

    stars.forEach((star) => {
      const val = parseInt(star.getAttribute('data-value'), 10);
      if (val <= value) {
        star.classList.add('selected');
        star.textContent = '★';
      } else {
        star.classList.remove('selected');
        star.textContent = '☆';
      }
    });
  }

  function highlightStarHover(stars, hoverVal) {
    stars.forEach((star) => {
      const val = parseInt(star.getAttribute('data-value'), 10);
      if (val <= hoverVal) {
        star.classList.add('hovered');
      } else {
        star.classList.remove('hovered');
      }
    });
  }

  // 設定標籤點擊多選 (Tag Chips)
  function setupTagChips() {
    document.querySelectorAll('.tag-container').forEach(container => {
      container.querySelectorAll('.tag-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          chip.classList.toggle('active');
        });
      });
    });
  }

  // 取得選取的標籤陣列
  function getSelectedTags(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    const activeChips = container.querySelectorAll('.tag-chip.active');
    return Array.from(activeChips).map(c => c.textContent.trim());
  }

  // 設定表單提交 logic
  function setupFormSubmit() {
    const form = document.getElementById('survey-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const department = document.getElementById('field-department')?.value || '輔英科大同仁';

      let responsePayload = {
        department: department
      };

      if (currentStage === 'pre') {
        responsePayload.preSkill = selectedPreSkill;
        responsePayload.prePainPoints = getSelectedTags('pre-pain-points-tags');
        responsePayload.preExpectation = document.getElementById('field-pre-expectation')?.value.trim() || '';
      } else {
        responsePayload.postSatisfaction = selectedPostSatisfaction;
        responsePayload.postSkill = selectedPostSkill;
        responsePayload.postGainTopics = getSelectedTags('post-gain-topics-tags');
        responsePayload.postFeedback = document.getElementById('field-post-feedback')?.value.trim() || '';
      }

      // 透過數據引擎儲存並發送廣播！
      window.SurveyEngine.addResponse(responsePayload);

      // 觸發本地慶祝特效
      if (typeof confetti === 'function') {
        confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 } });
      }

      // 顯示完成 Modal / 感謝畫面
      showThankYouModal();
    });
  }

  // 顯示感謝 Modal
  function showThankYouModal() {
    const modal = document.getElementById('thankyou-modal');
    if (modal) {
      modal.classList.add('show');
    }
  }

  // 關閉 Modal 並重置表單
  window.closeThankYouModal = function () {
    const modal = document.getElementById('thankyou-modal');
    if (modal) modal.classList.remove('show');
    
    // 重置文字輸入框
    const preExp = document.getElementById('field-pre-expectation');
    const postFb = document.getElementById('field-post-feedback');
    if (preExp) preExp.value = '';
    if (postFb) postFb.value = '';

    // 取消所有標籤選取
    document.querySelectorAll('.tag-chip.active').forEach(c => c.classList.remove('active'));
  };

  document.addEventListener('DOMContentLoaded', initParticipantForm);

})(window);
