const app = getApp();

// =============== Page 逻辑 ===============
Page({
  data: {
    step: 'title',
    title: '',
    author: '',
    content: '',
    tagsStr: '',
    logId: '',
    coverUrl: '',
    inlineImages: [],
    uploadedInlineUrls: [],
    footerImages: [],
    footerImageCount: 0,
    footerCountInput: '',
    isFooterCountSet: false,
    isEditing: false,
    originalId: '',
    baseCdn: 'https://whutnr-1311545081.cos.ap-guangzhou.myqcloud.com/picture/'
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ 
        isEditing: true,
        originalId: options.id,
        logId: options.id,
        step: 'content'
      });
      this.loadLog(options.id);
    }
  },

  onTitleInput(e) { this.setData({ title: e.detail.value }); },
  onAuthorInput(e) { this.setData({ author: e.detail.value }); },
  onContentInput(e) { this.setData({ content: e.detail.value }); },
  onTagsInput(e) { this.setData({ tagsStr: e.detail.value }); },

  async saveTitle() {
    const { title, author } = this.data;
    if (!title.trim()) {
      wx.showToast({ title: '请输入标题', icon: 'none' });
      return;
    }

    let newLogId;
    if (this.data.isEditing) {
      newLogId = this.data.originalId;
    } else {
      try {
        const res = await app.mpServerless.db.collection('WHULogs')
          .aggregate([{ $group: { _id: null, maxId: { $max: "$_id" } } }]);
        let maxId = res.result[0]?.maxId || 'log_000';
        if (!maxId.startsWith('log_')) maxId = 'log_000';
        const num = parseInt(maxId.replace('log_', ''), 10) || 0;
        newLogId = `log_${String(num + 1).padStart(3, '0')}`;
      } catch (err) {
        console.error('生成 ID 失败', err);
        wx.showToast({ title: '生成ID失败', icon: 'error' });
        return;
      }
    }

    this.setData({ logId: newLogId, step: 'content' });
  },

  extractInlineUrls(content) {
    if (!content) return [];
    const urls = [];
    const regex = /\[IMG:([^\]]+)\]/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      urls.push(match[1]);
    }
    return urls;
  },

  async uploadImage(type, index = null) {
    const { logId } = this.data;
    let fileName;
  
    if (type === 'cover') {
      fileName = `${logId}.jpg`;
    } else if (type === 'inline') {
      fileName = `${logId}_inline_${Date.now()}.jpg`;
    } else if (type === 'footer-replace') {
      fileName = `${logId}_img${index}.jpg`;
    }
  
    wx.chooseImage({
      count: 1,
      sizeType: ['original'], // 获取原始图片
      success: async (res) => {
        const tempFilePath = res.tempFilePaths[0];
        const fs = wx.getFileSystemManager();
        const stat = fs.statSync(tempFilePath);
        const fileSize = stat.size; // 单位：字节
  
        // 超过 1MB 不允许上传
        if (fileSize > 1024 * 1024) {
          wx.showToast({
            title: '图片不能超过 1MB',
            icon: 'none',
            duration: 2000
          });
          return;
        }
  
        wx.showLoading({ title: '上传中...' });
  
        try {
          // 直接读取原图，不压缩！
          const buffer = fs.readFileSync(tempFilePath);
          const base64Data = wx.arrayBufferToBase64(buffer);
  
          const response = await app.mpServerless.function.invoke('uploadImage', { fileName, base64Data });
  
          wx.hideLoading();
  
          if (!response?.success) {
            wx.showToast({ title: '服务异常', icon: 'error' });
            return;
          }
  
          const data = response.result;
          if (data && data.url) {
            if (type === 'cover') {
              this.setData({ coverUrl: data.url });
              wx.showToast({ title: '封面上传成功', icon: 'success' });
            } else if (type === 'inline') {
              const newUrl = data.url;
              const imgTag = `[IMG:${newUrl}]`;
  
              const uploadedInlineUrls = [...this.data.uploadedInlineUrls, newUrl];
              const inlineImages = uploadedInlineUrls.map(url => ({
                url,
                tag: `[IMG:${url}]`
              }));
  
              this.setData({ uploadedInlineUrls, inlineImages });
  
              // 自动保存到数据库
              if (logId) {
                const updatePromise = this.data.isEditing
                  ? app.mpServerless.db.collection('WHULogs').updateOne(
                      { _id: logId },
                      { $push: { uploadedInlineUrls: newUrl } }
                    )
                  : app.mpServerless.db.collection('WHULogs').updateOne(
                      { _id: logId },
                      {
                        $setOnInsert: {
                          createTime: new Date().toISOString(),
                          title: '',
                          content: '',
                          author: '',
                          tags: [],
                          footerImageCount: 0,
                          lastEditTime: new Date().toISOString()
                        },
                        $push: { uploadedInlineUrls: newUrl }
                      },
                      { upsert: true }
                    );
  
                updatePromise.catch(err => {
                  console.warn('自动保存文中图URL失败:', err);
                });
              }
  
              wx.setClipboardData({
                data: imgTag,
                success: () => {
                  wx.showToast({
                    title: '图片已保存，标签已复制',
                    icon: 'success',
                    duration: 2000
                  });
                }
              });
            } else if (type === 'footer-replace') {
              const newUrl = data.url;
              const footerImages = [...this.data.footerImages];
              footerImages[index - 1] = newUrl;
              this.setData({ footerImages });
              wx.showToast({ title: `第${index}张更新成功`, icon: 'success' });
            }
          } else {
            const errorMsg = data?.error || '上传失败';
            wx.showToast({ title: errorMsg, icon: 'error', duration: 3000 });
          }
        } catch (err) {
          wx.hideLoading();
          console.error('上传失败:', err);
          wx.showToast({ title: '上传失败', icon: 'error' });
        }
      },
      fail: () => {
        wx.showToast({ title: '选择图片失败', icon: 'error' });
      }
    });
  },

  uploadCover() { this.uploadImage('cover'); },
  uploadInlineImage() { this.uploadImage('inline'); },

  onFooterCountInput(e) {
    let val = e.detail.value;
    if (val === '') {
      this.setData({ footerCountInput: '' });
      return;
    }
    const num = parseInt(val, 10);
    if (num >= 1 && num <= 9) {
      this.setData({ footerCountInput: String(num) });
    } else {
      this.setData({ footerCountInput: '' });
      wx.showToast({ title: '请输入1-9', icon: 'none' });
    }
  },

  confirmFooterCount() {
    const count = parseInt(this.data.footerCountInput, 10);
    if (!count || count < 1 || count > 9) {
      wx.showToast({ title: '请输入有效数量（1-9）', icon: 'none' });
      return;
    }

    const { logId, baseCdn } = this.data;
    const footerImages = [];
    for (let i = 1; i <= count; i++) {
      footerImages.push(`${baseCdn}${logId}_img${i}.jpg`);
    }

    this.setData({
      footerImageCount: count,
      footerImages,
      isFooterCountSet: true
    });
  },

  resetFooterCount() {
    this.setData({
      footerCountInput: '',
      isFooterCountSet: false,
      footerImageCount: 0,
      footerImages: []
    });
  },

  replaceFooterImage(e) {
    const index = e.currentTarget.dataset.index;
    if (!index) return;
    this.uploadImage('footer-replace', index);
  },

  copyImgTag(e) {
    const tag = e.currentTarget.dataset.tag;
    wx.setClipboardData({
      data: tag,
      success: () => {
        wx.showToast({ title: '已复制到剪贴板', icon: 'success' });
      }
    });
  },

  previewImage(e) {
    const current = e.currentTarget.dataset.src || e.currentTarget.dataset.url || this.data.coverUrl;
    const urls = [current];
    wx.previewImage({ current, urls });
  },

  saveLog() {
    const { 
      title, author, content, tagsStr, logId, 
      isEditing, originalId, footerImageCount, 
      uploadedInlineUrls
    } = this.data;

    const tags = tagsStr
      .split(',')
      .map(t => t.trim())
      .filter(t => t);

    const inlineImageUrls = this.extractInlineUrls(content);

    const updateData = {
      title: title.trim(),
      content: content.trim(),
      tags,
      author: author.trim(),
      inlineImageUrls,
      uploadedInlineUrls,
      footerImageCount,
      lastEditTime: new Date().toISOString()
    };

    let promise;
    if (!isEditing) {
      updateData._id = logId;
      updateData.createTime = new Date().toISOString();
      promise = app.mpServerless.db.collection('WHULogs').insertOne(updateData);
    } else {
      promise = app.mpServerless.db.collection('WHULogs')
        .updateOne({ _id: originalId }, { $set: updateData });
    }

    promise.then(() => {
      wx.showToast({ title: isEditing ? '更新成功' : '创建成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1000);
    }).catch(err => {
      console.error('保存失败', err);
      wx.showToast({ title: '保存失败', icon: 'error' });
    });
  },

  loadLog(id) {
    const { baseCdn } = this.data;
    
    app.mpServerless.db.collection('WHULogs')
      .find({ _id: id })
      .then(res => {
        const log = res.result[0];
        if (log) {
          const coverUrl = `${baseCdn}${id}.jpg`;
          
          const footerImageCount = log.footerImageCount || 0;
          const footerImages = [];
          for (let i = 1; i <= footerImageCount; i++) {
            footerImages.push(`${baseCdn}${id}_img${i}.jpg`);
          }

          const uploadedInlineUrls = log.uploadedInlineUrls || [];
          const inlineImages = uploadedInlineUrls.map(url => ({
            url,
            tag: `[IMG:${url}]`
          }));

          this.setData({
            title: log.title || '',
            author: log.author || '',
            content: log.content || '',
            tagsStr: (log.tags || []).join(','),
            coverUrl,
            footerImages,
            footerImageCount,
            isFooterCountSet: footerImageCount > 0,
            inlineImages,
            uploadedInlineUrls,
            inlineImageUrls: log.inlineImageUrls || []
          });
        }
      })
      .catch(err => {
        console.error('加载失败', err);
        wx.showToast({ title: '加载失败', icon: 'error' });
      });
  },

  deleteLog() {
    wx.showModal({
      title: '确认删除？',
      content: '删除后无法恢复',
      success: (res) => {
        if (res.confirm) {
          app.mpServerless.db.collection('WHULogs')
            .deleteOne({ _id: this.data.originalId })
            .then(() => {
              wx.showToast({ title: '已删除', icon: 'success' });
              setTimeout(() => wx.navigateBack(), 1000);
            })
            .catch(err => {
              console.error('删除失败', err);
              wx.showToast({ title: '删除失败', icon: 'error' });
            });
        }
      }
    });
  }
});