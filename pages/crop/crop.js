Page({
  data: {
    src: '',
    name: '',
    cropSize: 300,
    outputSize: 512,
    baseWidth: 0,
    baseHeight: 0,
    x: 0,
    y: 0,
    scale: 1,
    minScale: 1,
    maxScale: 13
  },

  onLoad(options) {
    const src = decodeURIComponent(options.src || '');
    const name = decodeURIComponent(options.name || '');
    if (!src) {
      wx.showToast({ title: '缺少图片路径', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }

    const sys = wx.getSystemInfoSync();
    const cropSize = Math.round(Math.min(sys.windowWidth * 0.86, 360));

    this.setData({ src, cropSize, name });

    wx.getImageInfo({
      src,
      success: (res) => {
        const { width, height } = res;
        const fitScale = Math.max(cropSize / width, cropSize / height);
        const baseWidth = Math.round(width * fitScale);
        const baseHeight = Math.round(height * fitScale);
        const x = (cropSize - baseWidth) / 2;
        const y = (cropSize - baseHeight) / 2;

        this.setData({
          baseWidth,
          baseHeight,
          x,
          y,
          scale: 1
        });
        this._liveScale = 1;
      },
      fail: (err) => {
        console.error('getImageInfo failed', err);
        wx.showToast({ title: '图片加载失败', icon: 'none' });
      }
    });
  },

  onMoveChange(e) {
    const { x, y } = e.detail || {};
    if (typeof x === 'number' && typeof y === 'number') {
      this.setData({ x, y });
    }
  },

  onScaleChange(e) {
    const detail = e.detail || {};
    const nextData = {};
    if (typeof detail.scale === 'number') {
      // 只记录实时缩放值用于导出，不回写到视图，避免出现“持续放大”回路。
      this._liveScale = detail.scale;
    }
    if (typeof detail.x === 'number') nextData.x = detail.x;
    if (typeof detail.y === 'number') nextData.y = detail.y;
    if (Object.keys(nextData).length) {
      this.setData(nextData);
    }
  },

  renderToCanvas() {
    return new Promise((resolve) => {
      const { src, cropSize, outputSize, baseWidth, baseHeight, x, y } = this.data;
      const scale = this._liveScale || this.data.scale || 1;
      const ctx = wx.createCanvasContext('crop-output-canvas', this);
      const ratio = outputSize / cropSize;

      ctx.clearRect(0, 0, outputSize, outputSize);
      ctx.save();
      ctx.beginPath();
      ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
      ctx.clip();

      ctx.drawImage(
        src,
        x * ratio,
        y * ratio,
        baseWidth * scale * ratio,
        baseHeight * scale * ratio
      );

      ctx.restore();
      ctx.draw(false, resolve);
    });
  },

  async confirmCrop() {
    wx.showLoading({ title: '生成中...' });
    try {
      await this.renderToCanvas();

      wx.canvasToTempFilePath({
        canvasId: 'crop-output-canvas',
        width: this.data.outputSize,
        height: this.data.outputSize,
        destWidth: this.data.outputSize,
        destHeight: this.data.outputSize,
        fileType: 'png',
        success: (res) => {
          wx.hideLoading();
          try {
            const eventChannel = this.getOpenerEventChannel();
            if (eventChannel) {
              eventChannel.emit('onCroppedImage', {
                path: res.tempFilePath,
                name: this.data.name || ''
              });
            }
          } catch (err) {
            console.warn('eventChannel emit failed', err);
          }
          wx.navigateBack();
        },
        fail: (err) => {
          wx.hideLoading();
          console.error('生成裁剪图失败', err);
          wx.showToast({ title: '裁剪失败', icon: 'none' });
        }
      }, this);
    } catch (err) {
      wx.hideLoading();
      console.error('裁剪异常', err);
      wx.showToast({ title: '裁剪失败', icon: 'none' });
    }
  }
});
