// pages/logsDetail/logsDetail.js
const app = getApp();

Page({
  data: {
    log: {
      author: '',
      createTime: ''
    },
    formattedCreateTime: '未知时间',
    renderedContent: [],     // 解析后的正文（文字+图片）
    appendImages: [],        // 候选附加图文件名（如 "log_001_img1.jpg"）
    validAppendImages: [],   // 当前有效的附加图（用于预览）
    urlPrefix: ''
  },

  formatTime(timeStr) {
    if (!timeStr) return '未知时间';
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return '无效时间';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  onLoad(options) {
    const id = options.id;
    if (!id) {
      wx.showToast({ title: '无效日志', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    const { url } = app.globalData;
    this.setData({ urlPrefix: url });

    wx.showShareMenu({
      menus: ['shareAppMessage']
    });

    this.loadLog(id);
  },

  loadLog(id) {
    app.mpServerless.db.collection('WHULogs')
      .find({ _id: id })
      .then(res => {
        const log = res.result[0];
        if (!log) {
          wx.showToast({ title: '日志不存在', icon: 'none' });
          setTimeout(() => wx.navigateBack(), 1500);
          return;
        }

        // 格式化时间
        const formattedCreateTime = this.formatTime(log.createTime);

        // 解析正文（支持 [IMG:xxx]）
        const renderedContent = this.parseContent(log.content || '');

        // 生成附加图文件名（_img1.jpg ~ _img6.jpg）
        const appendImages = [];
        for (let i = 1; i <= 9; i++) {
          appendImages.push(`${id}_img${i}.jpg`);
        }

        this.setData({
          log,
          formattedCreateTime,
          renderedContent,
          appendImages,
          validAppendImages: [...appendImages] // 初始全认为有效
        });
      })
      .catch(err => {
        console.error('加载失败', err);
        wx.showToast({ title: '加载失败', icon: 'error' });
      });
  },

  // 解析 [IMG:https://xxx] 标记
  parseContent(content) {
    if (!content.trim()) return [{ type: 'text', text: '' }];

    const blocks = [];
    const parts = content.split('[IMG:');

    parts.forEach((part, index) => {
      if (index === 0) {
        if (part.trim()) blocks.push({ type: 'text', text: part });
        return;
      }

      const closeIndex = part.indexOf(']');
      if (closeIndex === -1) {
        blocks.push({ type: 'text', text: '[IMG:' + part });
        return;
      }

      const url = part.substring(0, closeIndex).trim();
      const afterText = part.substring(closeIndex + 1);

      if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        blocks.push({ type: 'image', url });
      }

      if (afterText.trim()) {
        blocks.push({ type: 'text', text: afterText });
      }
    });

    return blocks;
  },

  // 预览文中图片
  previewInlineImage(e) {
    const current = e.currentTarget.dataset.src;
    // 只预览这一张（或可扩展收集所有 inline 图）
    wx.previewImage({ current, urls: [current] });
  },

  // 预览附加图（预览所有当前有效的图）
  previewAppendImage(e) {
    const index = e.currentTarget.dataset.index;
    const currentUrl = this.data.urlPrefix + this.data.appendImages[index];
    const urls = this.data.validAppendImages
      .filter(name => name !== null)
      .map(name => this.data.urlPrefix + name);
    wx.previewImage({ current: currentUrl, urls });
  },

  // 文中图加载失败（可选处理）
  onInlineImageError(e) {
    // 可记录或替换占位图，此处暂不处理
  },

  // 附加图加载失败 → 隐藏并更新 valid 列表
  onAppendImageError(e) {
    const index = e.currentTarget.dataset.index;
    const appendImages = [...this.data.appendImages];
    const validAppendImages = [...this.data.validAppendImages];

    appendImages[index] = null;
    validAppendImages[index] = null;

    this.setData({
      appendImages,
      validAppendImages
    });
  },

  onShareAppMessage() {
    const { log, urlPrefix } = this.data;
    const id = this.options?.id; // 获取页面参数 id

    return {
      title: log.title || '校园猫咪日志',
      path: `/pages/logsDetail/logsDetail?id=${id}`,
      imageUrl: id ? `${urlPrefix}${id}.jpg` : '' // 自动使用封面图
    };
  },
});