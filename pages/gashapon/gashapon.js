// pages/gashapon/gashapon.js
const app = getApp();

Page({
  data: {
    hasLogin: false,
    currentTab: 'gacha',
    badgesPool: [],
    userBadgeCounts: {},
    totalOwned: 0,
    ownedTypes: 0,
    url: app.globalData.url,
    loading: true,
    gachaTodayCount: 0,
    GACHA_DAILY_LIMIT: 10,

    // === 答题扭蛋相关 ===
    quizVisible: false,
    currentQuestion: null,
    selectedOptionIndex: -1,
    submitting: false,
    showResult: false,
    isCorrect: false,

    // === 抽卡动画相关 ===
    gachaAnimating: false,
    gachaResultBadge: null,
    gachaEffectText: '',
    animationData: {},
    isGachaLocked: false,

    gachaCardsPool: [],        // 所有可抽卡片
    userCardCounts: {}, 
    showCardDetailModal: false,
    selectedCard: null,
    showGiftHint: false,
    openid: '',
  },

  onLoad() {
    this.loadBadgesPool();
    this.silentLoginAndInit();
    this.loadGachaCardsPool();
  },

  checkLoginStatus() {
    const openid = wx.getStorageSync('openid');
    if (openid) {
      this.setData({ hasLogin: true, openid });
      this.loadUserBadges();
      this.loadGachaTodayCount();
      this.loadBackpackData();
    } else {
      this.setData({ hasLogin: false });
    }
  },
  silentLoginAndInit() {
    const cached = wx.getStorageSync('openid');
    if (cached) {
      this.setData({ 
        hasLogin: true, 
        openid: cached 
      });
      this.initUserData();
      return;
    }

    // 无缓存 → 主动登录
    wx.login({
      success: (res) => {
        if (!res.code) {
          console.warn('wx.login 获取 code 失败');
          this.loadBadgesOnly(); // 降级：只加载公共数据
          return;
        }

        wx.showLoading({ title: '登录中...' });
        app.mpServerless.function.invoke('getOpenid', { code: res.code })
          .then(r => {
            if (r.result?.openid) {
              const openid = r.result.openid;
              wx.setStorageSync('openid', openid);
              this.setData({ 
                hasLogin: true, 
                openid 
              });
              this.initUserData();
            } else {
              throw new Error('云函数未返回 openid');
            }
          })
          .catch(err => {
            console.error('自动登录失败:', err);
            wx.showToast({ title: '登录异常，请重试', icon: 'none', duration: 2000 });
            this.loadBadgesOnly();
          })
          .finally(() => {
            wx.hideLoading();
          });
      },
      fail: () => {
        console.error('wx.login 调用失败');
        wx.showToast({ title: '微信登录失败', icon: 'none' });
        this.loadBadgesOnly();
      }
    });
  },

  // 初始化用户专属数据
  initUserData() {
    this.loadUserBadges();
    this.loadGachaTodayCount();
    this.loadBackpackData();
  },

  // 仅加载公共数据（无需登录）
  loadBadgesOnly() {
    this.setData({ loading: false });
  },
  
  loadBadgesPool() {
    app.mpServerless.db.collection('badges')
      .find()
      .then(res => {
        this.setData({ badgesPool: res.result || [], loading: false });
      })
      .catch(err => {
        console.error('加载徽章池失败', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  loadUserBadges() {
    if (!this.data.openid) return;

    app.mpServerless.db.collection('user_badges')
      .find({ openid: this.data.openid })
      .then(res => {
        const badges = res.result || [];
        const badgeCountMap = {};
        let totalOwned = 0;
        badges.forEach(b => {
          badgeCountMap[b.badgeId] = b.count || 1;
          totalOwned += b.count || 1;
        });
        const ownedTypes = Object.keys(badgeCountMap).length;

        this.setData({ 
          userBadgeCounts: badgeCountMap,
          totalOwned,
          ownedTypes
        });
      })
      .catch(err => {
        console.error('加载用户徽章失败', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  loadGachaTodayCount() {
    const today = this.getTodayDateString(); 
    const { openid } = this.data;

    app.mpServerless.db.collection('gacha_records')
      .findOne({ openid, date: today })
      .then(res => {
        const count = res.result ? res.result.count : 0;
        this.setData({ gachaTodayCount: count });
      })
      .catch(err => {
        console.error('加载扭蛋记录失败', err);
        this.setData({ gachaTodayCount: 0 });
      });
  },

  getTodayDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  handleGachaTap() {
    if (!this.data.hasLogin) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    this.startGachaQuiz();
  },

  startGachaQuiz() {
    const { hasLogin, gachaTodayCount, GACHA_DAILY_LIMIT } = this.data;

    if (!hasLogin) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    if (gachaTodayCount >= GACHA_DAILY_LIMIT) {
      wx.showToast({ 
        title: `今日已达${GACHA_DAILY_LIMIT}次上限`, 
        icon: 'none' 
      });
      return;
    }

    this.loadRandomQuestion();
  },

  loadRandomQuestion() {
    wx.showLoading({ title: '加载题目...' });
    app.mpServerless.db.collection('quiz_questions')
      .aggregate([{ $sample: { size: 1 } }])
      .then(res => {
        wx.hideLoading();
        const question = res.result && res.result[0];
        if (question) {
          this.setData({
            currentQuestion: question,
            selectedOptionIndex: -1,
            quizVisible: true
          });
        } else {
          wx.showToast({ title: '暂无题目', icon: 'none' });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('加载题目失败', err);
        wx.showToast({ title: '题目加载失败', icon: 'none' });
      });
  },

  selectOption(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ selectedOptionIndex: index });
  },

  submitAnswer() {
    if (this.data.selectedOptionIndex === -1) {
      wx.showToast({ title: '请选择答案', icon: 'none' });
      return;
    }

    const isCorrect = this.data.selectedOptionIndex === this.data.currentQuestion.correctIndex;
  
    this.setData({ 
      submitting: true,
      isCorrect,
      showResult: true 
    });

    setTimeout(() => {
      this.setData({ submitting: false });
    }, 800);
  },

  // 新增方法：加载可抽卡池（仅非绝版）
  loadGachaCardsPool() {
    app.mpServerless.db.collection('gacha_cards')
      .find({ isDiscontinued: { $ne: true } }) // ← 关键：排除绝版
      .then(res => {
        this.setData({
          gachaCardsPool: res.result || []
        });
      })
      .catch(err => {
        console.error('加载抽卡池失败', err);
        wx.showToast({ title: '卡片池加载失败', icon: 'none' });
      });
  },

  closeQuizAndGacha() {
    const { isCorrect, badgesPool, gachaCardsPool } = this.data;
  
    if (isCorrect) {
      if (!badgesPool || badgesPool.length === 0) {
        wx.showToast({ title: '礼物池空啦', icon: 'none' });
        return;
      }
  
      const randomBadge = badgesPool[Math.floor(Math.random() * badgesPool.length)];
      const shouldGetCard = Math.random() < 0.2; // 20% 出卡
      let randomCard = null;
  
      if (shouldGetCard && gachaCardsPool && gachaCardsPool.length > 0) {
        randomCard = gachaCardsPool[Math.floor(Math.random() * gachaCardsPool.length)];
      }
  
      let displayImage = '';
      let displayText = '';
      let showGiftHint = false; // 默认不显示“送你一个...”
  
      if (randomCard) {
        // 20%：有卡片
        displayImage = randomCard.image || 'https://whutnr-1311545081.cos.ap-guangzhou.myqcloud.com/picture/default_card.jpg';
        displayText = randomCard.text || `获得 ${randomCard.name}`;
        showGiftHint = true; // ← 只有这时才显示“送你一个...”
      } else {
        // 80%：仅礼物
        displayImage = randomBadge.icon || 'https://whutnr-1311545081.cos.ap-guangzhou.myqcloud.com/picture/default_badge.png';
        displayText = `获得 ${randomBadge.name}`;
        showGiftHint = false; // ← 不显示“送你一个...”
      }
  
      this.setData({
        quizVisible: false,
        showResult: false,
        isCorrect: false,
        isGachaLocked: true,
        gachaAnimating: true,
        gachaResultBadge: randomBadge,
        gachaCardImage: displayImage,
        gachaEffectText: displayText,
        gachaResultCard: randomCard,
        showGiftHint: showGiftHint // ← 关键：控制底部提示
      });
  
      this.updateUserAndRecord(randomBadge, randomCard);
    } else {
      this.setData({
        selectedOptionIndex: -1,
        showResult: false,
        isCorrect: false
      });
    }
  },

  // 点击关闭动画
  closeGachaAnimation() {
    this.setData({
      gachaAnimating: false,
      isGachaLocked: false
    });
  },

  updateUserAndRecord(badge, card) {
    const { openid } = this.data;
    const today = this.getTodayDateString();
  
    // 1. 更新徽章（必做）
    const badgeUpdate = app.mpServerless.db.collection('user_badges')
      .updateOne(
        { openid, badgeId: badge.badgeId },
        { 
          $inc: { count: 1 },
          $setOnInsert: { 
            name: badge.name,
            icon: badge.icon,
            obtainedAt: Date.now()
          }
        },
        { upsert: true }
      );
  
    // 2. 更新卡片（仅当 card 存在时）
    const promises = [badgeUpdate];
    if (card && card.cardId) {
      const cardUpdate = app.mpServerless.db.collection('user_gacha_cards')
        .updateOne(
          { openid, cardId: card.cardId },
          { 
            $inc: { count: 1 },
            $setOnInsert: { 
              cardId: card.cardId, 
              name: card.name,
              image: card.image,
              text: card.text, // 如果有文案也存一下
              obtainedAt: Date.now()
            }
          },
          { upsert: true }
        );
      promises.push(cardUpdate);
    }
  
    // 3. 更新抽卡次数
    const recordUpdate = app.mpServerless.db.collection('gacha_records')
      .updateOne(
        { openid, date: today },
        { 
          $inc: { count: 1 },
          $setOnInsert: { createdAt: Date.now() }
        },
        { upsert: true }
      );
    promises.push(recordUpdate);
  
    // 并行执行
    Promise.all(promises)
      .then(() => {
        this.loadUserBadges();
        this.loadBackpackData();
        this.loadGachaTodayCount();
      })
      .catch(err => {
        console.error('后台更新失败（不影响动画）:', err);
      });
  },

  onShareAppMessage() {
    return {
      title: '来和我一起答题扭蛋吧！',
      path: '/pages/gashapon/gashapon', 
      imageUrl: 'https://whutnr-1311545081.cos.ap-guangzhou.myqcloud.com/picture/gashapon.jpg'
    };
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      currentTab: tab
    });
  },

  // 同时加载：非绝版卡片全集 + 用户拥有的卡片数量
  loadBackpackData() {
    const { openid } = this.data;
    if (!openid) return;
  
    // 1. 获取用户拥有的所有 cardId（包括绝版）
    return app.mpServerless.db.collection('user_gacha_cards')
      .find({ openid })
      .then(res => {
        const userCardRecords = res.result || [];
        const ownedCardIds = userCardRecords.map(r => r.cardId).filter(id => id);
        const countMap = {};
        userCardRecords.forEach(r => {
          if (r.cardId) countMap[r.cardId] = r.count || 1;
        });
  
        // 2. 查询这些 cardId 对应的完整卡片信息（不管是否绝版！）
        return app.mpServerless.db.collection('gacha_cards')
          .find({ cardId: { $in: ownedCardIds } })
          .then(ownedCardsRes => {
            const ownedCards = ownedCardsRes.result || [];
  
            // 3. 查询所有非绝版卡（用于图鉴）
            return app.mpServerless.db.collection('gacha_cards')
              .find({ isDiscontinued: { $ne: true } })
              .then(nonDiscontinuedRes => {
                const nonDiscontinuedCards = nonDiscontinuedRes.result || [];
  
                // 4. 合并：非绝版卡 + 已拥有的绝版卡
                const ownedCardMap = {};
                ownedCards.forEach(card => {
                  ownedCardMap[card.cardId] = card;
                });
  
                const nonDiscontinuedSet = new Set();
                nonDiscontinuedCards.forEach(card => {
                  nonDiscontinuedSet.add(card.cardId);
                });
  
                // 找出“已拥有但不在非绝版池中的卡” → 即绝版卡
                const ownedDiscontinuedCards = ownedCards.filter(card => 
                  !nonDiscontinuedSet.has(card.cardId)
                );
  
                // 最终展示列表 = 非绝版卡 + 已拥有的绝版卡
                const displayCards = [...nonDiscontinuedCards, ...ownedDiscontinuedCards];
  
                // 去重（理论上不会重复，但保险）
                const seen = new Set();
                const uniqueDisplayCards = [];
                for (const card of displayCards) {
                  if (!seen.has(card.cardId)) {
                    seen.add(card.cardId);
                    uniqueDisplayCards.push(card);
                  }
                }
  
                this.setData({
                  backpackDisplayCards: uniqueDisplayCards, // ← 新字段：用于背包展示
                  userCardCounts: countMap
                });
              });
          });
      })
      .catch(err => {
        console.error('加载背包数据失败', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },
  // 点击卡片显示详情
  showCardDetail(e) {
    const card = e.currentTarget.dataset.card;
    const count = this.data.userCardCounts[card.cardId] || 0;
  
    if (count <= 0) {
      wx.showToast({ title: '暂未获得此卡片', icon: 'none', duration: 1000 });
      return;
    }
  
    this.setData({
      selectedCard: card,
      showCardDetailModal: true
    });
  },

  // 关闭弹窗
  closeCardDetail() {
    this.setData({
      showCardDetailModal: false,
      selectedCard: null
    });
  },

  // 点击未拥有的卡片
  onNotOwnedCardTap() {
    wx.showToast({
      title: '暂未获得',
      icon: 'none',
      duration: 1000
    });
  }


});