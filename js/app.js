/**
 * AI 行政效能演講 - 核心數據庫與即時通訊引擎 (App Data & Broadcast Engine)
 */

(function (window) {
  'use strict';

  const STORAGE_KEY_RESPONSES = 'ai_survey_responses_v1';
  const STORAGE_KEY_CONFIG = 'ai_survey_config_v1';
  const BROADCAST_CHANNEL_NAME = 'ai_survey_live_channel';

  // 預設配置
  const defaultConfig = {
    mode: 'post', // 'pre' (課前) 或 'post' (課後)
    surveyOpen: true,
    title: 'AI 行政效能提升實務演講',
    speaker: 'AI 行政效能講師',
    date: new Date().toISOString().split('T')[0]
  };

  class SurveyAppEngine {
    constructor() {
      this.channel = null;
      this.listeners = [];
      this.initBroadcastChannel();
      this.initStorageListener();
    }

    // 初始化 HTML5 BroadcastChannel 跨頁面即時通訊
    initBroadcastChannel() {
      if ('BroadcastChannel' in window) {
        this.channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          this.notifyListeners(event.data);
        };
      }
      this.initCloudRelaySSE();
    }

    // 初始化跨網路雲端 SSE 即時監聽 (支援 4G/5G 手機與學校 Wi-Fi 看板跨網連線)
    initCloudRelaySSE() {
      try {
        const sseUrl = 'https://ntfy.sh/fyu_ai_lecture_survey_2026_room/sse';
        const eventSource = new EventSource(sseUrl);
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data && data.message) {
              const payload = JSON.parse(data.message);
              if (payload.type === 'NEW_RESPONSE_REMOTE') {
                const responses = this.getResponses();
                // 避免重複加入
                if (!responses.some(r => r.id === payload.newResponse.id)) {
                  responses.unshift(payload.newResponse);
                  localStorage.setItem(STORAGE_KEY_RESPONSES, JSON.stringify(responses));
                  this.notifyListeners({
                    type: 'NEW_RESPONSE',
                    payload: {
                      newResponse: payload.newResponse,
                      allResponses: responses
                    }
                  });
                }
              } else if (payload.type === 'CONFIG_UPDATED_REMOTE') {
                localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(payload.config));
                this.notifyListeners({ type: 'CONFIG_UPDATED', payload: payload.config });
              }
            }
          } catch (e) {
            // Ignore non-json or ping messages
          }
        };
      } catch (err) {
        console.warn('Cloud SSE Relay not available offline:', err);
      }
    }

    // 發送雲端廣播中繼
    sendCloudRelay(type, data) {
      try {
        fetch('https://ntfy.sh/fyu_ai_lecture_survey_2026_room', {
          method: 'POST',
          body: JSON.stringify({ type, ...data })
        }).catch(() => {});
      } catch (e) {}
    }

    // 監聽 LocalStorage 變動 (備用跨頁面機制)
    initStorageListener() {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY_RESPONSES || e.key === STORAGE_KEY_CONFIG) {
          this.notifyListeners({
            type: 'DATA_UPDATED',
            payload: this.getResponses(),
            config: this.getConfig()
          });
        }
      });
    }

    // 註冊監聽者
    subscribe(callback) {
      if (typeof callback === 'function') {
        this.listeners.push(callback);
      }
    }

    // 通知所有本機監聽者
    notifyListeners(data) {
      this.listeners.forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error('Error in listener callback:', err);
        }
      });
    }

    // 發送廣播事件
    broadcast(type, payload = {}) {
      const message = { type, payload, config: this.getConfig(), timestamp: Date.now() };
      if (this.channel) {
        this.channel.postMessage(message);
      }
      this.notifyListeners(message);
    }

    // 取得當前系統配置
    getConfig() {
      const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
      return raw ? { ...defaultConfig, ...JSON.parse(raw) } : defaultConfig;
    }

    // 更新系統配置
    updateConfig(newConfig) {
      const updated = { ...this.getConfig(), ...newConfig };
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(updated));
      this.broadcast('CONFIG_UPDATED', updated);
      return updated;
    }

    // 取得所有問卷回饋數據
    getResponses() {
      const raw = localStorage.getItem(STORAGE_KEY_RESPONSES);
      return raw ? JSON.parse(raw) : [];
    }

    // 新增一份問卷回饋
    addResponse(responseItem) {
      const currentConfig = this.getConfig();
      const newEntry = {
        id: 'resp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        stage: currentConfig.mode, // 'pre' or 'post'
        timestamp: new Date().toISOString(),
        timeStr: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        department: responseItem.department || '未透露單位',
        ...responseItem
      };

      const responses = this.getResponses();
      responses.unshift(newEntry); // 新進資料排最前
      localStorage.setItem(STORAGE_KEY_RESPONSES, JSON.stringify(responses));

      // 觸發新提交廣播 (含有動畫識別標籤)
      this.broadcast('NEW_RESPONSE', {
        newResponse: newEntry,
        allResponses: responses
      });

      // 跨網路雲端推播 (使 4G/5G 手機即時推播至學校 Wi-Fi/大螢幕)
      this.sendCloudRelay('NEW_RESPONSE_REMOTE', { newResponse: newEntry });

      return newEntry;
    }

    // 清除所有問卷資料
    clearAllResponses() {
      localStorage.removeItem(STORAGE_KEY_RESPONSES);
      this.broadcast('DATA_CLEARED', { allResponses: [] });
    }

    // 生成模擬測試數據
    generateMockData(count = 35) {
      const departments = [
        '教務處', '學生事務處 (學務處)', '總務處', '研究發展處 (研發處)', '人事室', '主計室 / 會計室', '資訊中心', '圖書館',
        '護理系 (含碩博班)', '助產與婦潔保健系', '高齡長期照護事業系',
        '醫學檢驗生物技術系', '物理治療系', '香妝與保健造型學系', '職業安全衛生系',
        '環境工程與科學系', '保健營養系', '生物科技系',
        '幼兒保育系', '健康美容學系', '休閒與遊憩事業管理系', '資訊管理系', '應用外語系', '通識教育中心'
      ];
      const prePainPoints = ['公文與簽呈撰寫耗時', '會議紀錄整理緩慢', '海報與簡報製作缺靈感', '數據分析與報表統計', '跨部門溝通郵件草擬', '法規與活動計劃書發想'];
      const postGainTopics = ['ChatGPT 提示詞萬能公式', '公文自動摘要與草擬', 'Excel 數據快捷清理', '一鍵生成會議精華紀錄', 'AI 圖像與海報生成', '簡報大綱自動生成'];
      const commentsPre = [
        '希望能學到如何用 AI 快速處理日常公文！',
        '非常期待學習能節省會議紀錄時間的工具！',
        '對 ChatGPT 如何應用在學術行政很感興趣。',
        '希望能了解 AI 在資料統計與報表自動化的實際範例。',
        '平時公文處理佔太多時間，希望能提升 50% 效率！'
      ];
      const commentsPost = [
        '今天的課程超級實用！公文提示詞範本回辦公室立刻可以用！',
        '會議紀錄自動摘要的功能真的太驚艷了，大推講師！',
        '原來 AI 寫簡報大綱這麼快，以後準備簡報不再頭痛。',
        '滿滿乾貨！課前跟課後的 AI 觀念完全顛覆，受益匪淺。',
        '實作範例非常接地氣，完全符合我們行政同仁的需求！',
        '講師講解非常清晰，期待學校能繼續舉辦 AI 進階班！',
        '現場即時看板填寫互動感超強，看到大家滿意度這麼高很有同感！'
      ];

      const responses = [];
      const now = Date.now();

      for (let i = count; i >= 1; i--) {
        const stage = Math.random() > 0.35 ? 'post' : 'pre';
        const isPost = stage === 'post';
        const dept = departments[Math.floor(Math.random() * departments.length)];
        
        // 課前評分 1-3 分 (較低)
        const preSkill = Math.floor(Math.random() * 3) + 1;
        // 課後評分 4-5 分 (顯著提升)
        const postSkill = Math.min(5, preSkill + Math.floor(Math.random() * 3) + 2);

        const timeOffset = (count - i) * 15 * 1000;
        const entryTime = new Date(now - timeOffset);

        responses.push({
          id: 'mock_' + i + '_' + Math.random().toString(36).substr(2, 4),
          stage: stage,
          timestamp: entryTime.toISOString(),
          timeStr: entryTime.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
          department: dept,
          // 課前欄位
          preSkill: preSkill,
          prePainPoints: [prePainPoints[Math.floor(Math.random() * prePainPoints.length)], prePainPoints[Math.floor(Math.random() * prePainPoints.length)]],
          preExpectation: isPost ? '' : commentsPre[Math.floor(Math.random() * commentsPre.length)],
          // 課後欄位
          postSatisfaction: isPost ? Math.floor(Math.random() * 2) + 4 : null, // 4-5 星
          postSkill: isPost ? postSkill : null,
          postGainTopics: isPost ? [postGainTopics[Math.floor(Math.random() * postGainTopics.length)], postGainTopics[Math.floor(Math.random() * postGainTopics.length)]] : [],
          postFeedback: isPost ? commentsPost[Math.floor(Math.random() * commentsPost.length)] : ''
        });
      }

      localStorage.setItem(STORAGE_KEY_RESPONSES, JSON.stringify(responses));
      this.broadcast('DATA_UPDATED', { allResponses: responses });
      return responses;
    }

    // 匯出 CSV 檔
    exportCSV() {
      const responses = this.getResponses();
      if (!responses.length) return false;

      const headers = ['ID', '階段', '填寫時間', '部門', '課前AI熟練度(1-5)', '課前痛點', '課前期待', '課後滿意度(1-5)', '課後AI信心度(1-5)', '課後最收穫主題', '課後回饋與建議'];
      const rows = responses.map(r => [
        r.id,
        r.stage === 'pre' ? '課前' : '課後',
        r.timeStr,
        `"${r.department || ''}"`,
        r.preSkill || '',
        `"${(r.prePainPoints || []).join(';')}"`,
        `"${(r.preExpectation || '').replace(/"/g, '""')}"`,
        r.postSatisfaction || '',
        r.postSkill || '',
        `"${(r.postGainTopics || []).join(';')}"`,
        `"${(r.postFeedback || '').replace(/"/g, '""')}"`
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `AI行政效能問卷結果_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    }
  }

  // 掛載到全局 window
  window.SurveyEngine = new SurveyAppEngine();
})(window);
