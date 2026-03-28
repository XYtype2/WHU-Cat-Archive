const app = getApp();

Page({
  data: {
    logs: [],
    filteredLogs: [],  
    selectedFilter: 'all',
    isAdmin: false,
    urlPrefix: '',
    bannerImages: [
      'https://whutnr-1311545081.cos.ap-guangzhou.myqcloud.com/picture/日志1.jpg',
      'https://whutnr-1311545081.cos.ap-guangzhou.myqcloud.com/picture/日志2.jpg',
      'https://whutnr-1311545081.cos.ap-guangzhou.myqcloud.com/picture/投喂.jpg'
    ]
  },

  onShow() {
    this.loadLogs();
  },

  onLoad() {
    const { isAdministrator, url } = app.globalData;
    this.setData({
      isAdmin: isAdministrator,
      urlPrefix: url
    });
    this.loadLogs();

    wx.showShareMenu({
      menus: ['shareAppMessage'] // 仅分享给好友
    });
  },

  loadLogs() {
    // wx.showLoading({ title: '加载中...' });
    app.mpServerless.db.collection('WHULogs')
      .find({}, { sort: { createTime: -1 } })
      .then(res => {
        const logs = res.result || [];

        // 为每条日志生成安全的摘要
        const processedLogs = logs.map(log => {
          let rawContent = log.content || '';
          
          // 移除所有 [IMG:...] 标记，只保留纯文本
          const pureText = rawContent.replace(/\[IMG:[^\]]*\]/g, '');
          
          // 截取前 50 字
          const summary = pureText.length > 32
            ? pureText.substring(0, 32) + '...' 
            : pureText;

          return { ...log, summary };
        });

        this.setData({ logs: processedLogs }, () => {
          this.applyFilter();
        });
        wx.hideLoading();
      })
      .catch(err => {
        console.error('加载失败', err);
        wx.showToast({ title: '加载失败', icon: 'error' });
        wx.hideLoading();
      });
  },

  setFilter(e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({ selectedFilter: filter }, () => {
      this.applyFilter();
    });
  },

  applyFilter() {
    const { logs, selectedFilter } = this.data;
  
    let filtered = [];
    if (selectedFilter === 'all') {
      filtered = logs;
    } else if (selectedFilter === '其它') {
      // 筛选：tags 中 **不包含** "绝育" 且 **不包含** "救助" 的日志
      filtered = logs.filter(log => {
        const tags = log.tags || [];
        return !tags.includes('绝育') && !tags.includes('救助');
      });
    } else {
      // 绝育 或 救助
      filtered = logs.filter(log => 
        log.tags && Array.isArray(log.tags) && log.tags.includes(selectedFilter)
      );
    }
  
    this.setData({ filteredLogs: filtered });
  },

  viewLog(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/logsDetail/logsDetail?id=${id}` });
  },

  onImageError(e) {},

  onPullDownRefresh() {
    this.loadLogs();
    wx.stopPullDownRefresh();
  },

  createLog() {
    const { isAdministrator } = app.globalData;

    if (!isAdministrator) {
      // 非管理员点击：友好提示
      wx.showToast({
        title: '仅管理员可新增日志',
        icon: 'none',
        duration: 1500
      });
      return;
    }

    // 管理员：正常跳转
    wx.navigateTo({ url: '/pages/editLog/editLog' });
  },

  onLongPress(e) {
    const id = e.currentTarget.dataset.id;
    
    // 非管理员禁止长按操作
    if (!app.globalData.isAdministrator) {
      return; // 或者可以提示“无权限”，但通常静默忽略更友好
    }

    // 弹出操作菜单
    wx.showActionSheet({
      itemList: ['编辑日志'],
      itemColor: '#1890ff',
      success: (res) => {
        if (res.tapIndex === 0) {
          // 点击“编辑日志”
          wx.navigateTo({
            url: `/pages/editLog/editLog?id=${id}`
          });
        }
        // tapIndex === 1 或点击遮罩：取消，不处理
      },
      fail(err) {
        console.log('actionSheet 失败', err);
      }
    });
  },

  onShareAppMessage() {
    return {
      title: '校园猫咪日志',
      path: '/pages/catLogs/catLogs'
    };
  }
});