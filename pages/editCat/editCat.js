var _id = "1";
const app = getApp();
const JPG_TARGET_KB = 250;
const JPG_SOFT_MAX_KB = 280;
const JPG_HARD_MAX_KB = 300;
const JPG_MAX_INPUT_BYTES = 10 * 1024 * 1024;
const JPG_QUALITY_STEPS = [92, 88, 84, 80, 76, 72, 68, 64, 60, 56, 52, 48, 44, 40, 36, 32, 28, 24, 20];
const JPG_SCALE_STEPS = [1, 0.88, 0.76, 0.64, 0.52, 0.4, 0.3, 0.24];

Page({
  data: {
    cat: {},
    url: app.globalData.url,
    classification: 0,
    
    // 新增学部相关
    departments: ['文理学部', '信息学部', '工学部', '其它校区'],
    currentDepartment: 0, // 默认选中第一个
    coordinateInput: '',
    
    pickers: {
      classification: ['狸花和狸白', '橘猫及橘白', '黑猫和奶牛', '玳瑁及三花', '纯白'],
      gender: ['', '公', '母'],
      addPhotoNumber: ['0','1','2','3','4','5','6','7','8','9','10'],
      audioNumber: ['0','1','2','3'],
      isSterilization: ['', '已绝育', '未绝育'],
      status: ['在校','送养','失踪','离世'],
      character: ['', '亲人可抱', '亲人不可抱 可摸', '薛定谔亲人', '吃东西时可以一直摸', '吃东西时可以摸一下', '怕人 安全距离 1m 以内', '怕人 安全距离 1m 以外'],
    },
    picker_selected: {},
    avatarUploaded: false,
    canvasWidth: 300,
    canvasHeight: 300,
  },

  // ========================= onLoad =========================
  onLoad: function (options) {
    _id = options._id;
    app.mpServerless.db.collection('WHUTNR').find({
      _id: _id,
    }, {}).then(res => {
      const cat = res.result[0];

      // 解析 locationGeo 为 "经度,纬度" 字符串
      let coordinateInput = '';
      if (cat.locationGeo && Array.isArray(cat.locationGeo.coordinates)) {
        const [lng, lat] = cat.locationGeo.coordinates;
        if (!isNaN(lng) && !isNaN(lat)) {
          coordinateInput = `${lng},${lat}`;
        }
      }

      // 初始化学部索引
      let deptIndex = 0;
      if (cat.department) {
        const idx = this.data.departments.findIndex(d => d === cat.department);
        if (idx !== -1) deptIndex = idx;
      }

      // 保存 cat 数据和学部索引
      this.setData({
        cat: cat,
        classification: cat.classification,
        currentDepartment: deptIndex,
        coordinateInput: coordinateInput
      });
    }).then(() => {
      // 原来的 picker_selected 初始化逻辑
      var picker_selected = {};
      const pickers = this.data.pickers;
      for (const key in pickers) {
        const items = pickers[key];
        const value = this.data.cat[key];
        const idx = items.findIndex((v) => v === value);
        if (idx === -1 && typeof value === "number") {
          picker_selected[key] = value;
        } else {
          picker_selected[key] = idx;
        }
      }
      this.setData({
        picker_selected: picker_selected,
      });
    }).catch(err => {
      console.error(err);
    });
  },

  // ========================= 学部选择 =========================
  bindDepartmentChange(e) {
    const index = e.detail.value;
    this.setData({
      currentDepartment: index,
      ['cat.department']: this.data.departments[index], // 保存到 cat 对象
    });
  },

  // ========================= 日期选择 =========================
  bindDateChange: function (e) {
    const key = e.currentTarget.dataset.key;
    const value = e.detail.value;
    this.setData({
      ['cat.' + key]: value
    });
  },

  // ========================= 普通 picker =========================
  bindPickerChange(e) {
    const key = e.currentTarget.dataset.key;
    const index = e.detail.value;
    var value = this.data.pickers[key][index];
    this.setData({
      ['cat.' + key]: value
    });
  },

  // ========================= 删除日期 =========================
  cancelDate(e) {
    const key = e.currentTarget.dataset.key;
    wx.showModal({
      title: '提示',
      content: '确定删除这个日期吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            ['cat.' + key]: ''
          });
        }
      }
    })
  },

  // ========================= 上传修改 =========================
  upload() {
    wx.showModal({
      title: '提示',
      content: '确定提交吗？',
      success: (res) => {
        if (res.confirm) {
          let locationGeo = null;
            const coordStr = this.data.coordinateInput.trim();
            if (coordStr) {
              const parts = coordStr.split(',').map(s => s.trim());
              if (parts.length === 2) {
                const lng = parseFloat(parts[0]);
                const lat = parseFloat(parts[1]);
                if (!isNaN(lng) && !isNaN(lat)) {
                  locationGeo = {
                    type: "Point",
                    coordinates: [lng, lat]  // [经度, 纬度]
                  };
                }
              }
            }
          app.mpServerless.db.collection('WHUTNR').updateMany({
              _id: this.data.cat._id
            }, {
              $set: {
                addPhotoNumber: this.data.cat.addPhotoNumber,
                audioNumber: this.data.cat.audioNumber,
                isAdoption: this.data.cat.isAdoption,
                nickName: this.data.cat.nickName,
                furColor: this.data.cat.furColor,
                classification: this.data.cat.classification,
                gender: this.data.cat.gender,
                status: this.data.cat.status,
                isSterilization: this.data.cat.isSterilization,
                sterilizationTime: this.data.cat.sterilizationTime,
                character: this.data.cat.character,
                firstSightingTime: this.data.cat.firstSightingTime,
                firstSightingLocation: this.data.cat.firstSightingLocation,
                appearance: this.data.cat.appearance,
                missingTime: this.data.cat.missingTime,
                relationship: this.data.cat.relationship,
                deliveryTime: this.data.cat.deliveryTime,
                deathTime: this.data.cat.deathTime,
                moreInformation: this.data.cat.moreInformation,
                notes: this.data.cat.notes,
                deathReason: this.data.cat.deathReason,
                location: this.data.cat.location,
                birthTime: this.data.cat.birthTime,
                relatedCats: this.data.cat.relatedCats,
                department: this.data.cat.department, // 保存学部
                lastEditTime: Date(),
                lastEditAdministrator: app.globalData.Administrator,
                photographer: this.data.cat.photographer,
                ...(locationGeo ? { locationGeo } : { locationGeo: null })
              }
            }).then(res => {
              wx.showToast({
                icon: 'success',
                title: '操作成功',
              });
            })
            .catch(err => {
              console.error(err);
              wx.showToast({
                icon: 'error',
                title: '操作失败',
              });
            });
        }
      }
    })
  },

  // ========================= 删除猫 =========================
  delete() {
    wx.showModal({
      title: '提示',
      confirmColor: 'red',
      content: '确定删除吗？',
      success: (res) => {
        if (res.confirm) {
          app.mpServerless.db.collection('WHUTNR').deleteOne({
            _id: this.data.cat._id
          }).then(res => {
            wx.showToast({
              icon: 'success',
              title: '操作成功',
            });
            wx.navigateBack()
          }).catch(err => {
            console.error(err);
          });
        }
      }
    })
  },

  // ========================= 文本输入 =========================
  inputText(e) {
    const key = e.currentTarget.dataset.key;
    const value = e.detail.value;
    this.setData({
      ['cat.' + key]: value
    });
  },

  // 处理经纬度输入
  inputCoordinate(e) {
    this.setData({
      coordinateInput: e.detail.value
    });
  },

  getFileSizeKB(filePath) {
    const fs = wx.getFileSystemManager();
    const stat = fs.statSync(filePath);
    return stat.size / 1024;
  },

  getImageInfoAsync(src) {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src,
        success: resolve,
        fail: reject
      });
    });
  },

  compressImageAsync(src, quality) {
    return new Promise((resolve, reject) => {
      wx.compressImage({
        src,
        quality,
        success: resolve,
        fail: reject
      });
    });
  },

  exportJpgByCanvas(src, width, height) {
    return new Promise((resolve, reject) => {
      const drawWidth = Math.max(64, Math.round(width));
      const drawHeight = Math.max(64, Math.round(height));
      this.setData({
        canvasWidth: drawWidth,
        canvasHeight: drawHeight
      }, () => {
        const ctx = wx.createCanvasContext('compress-canvas', this);
        ctx.clearRect(0, 0, drawWidth, drawHeight);
        ctx.drawImage(src, 0, 0, drawWidth, drawHeight);
        ctx.draw(false, () => {
          wx.canvasToTempFilePath({
            canvasId: 'compress-canvas',
            width: drawWidth,
            height: drawHeight,
            destWidth: drawWidth,
            destHeight: drawHeight,
            fileType: 'jpg',
            quality: 1,
            success: resolve,
            fail: reject
          }, this);
        });
      });
    });
  },

  async compressJpgByQualityOnly(tempFilePath) {
    let softFallback = null;
    let hardFallback = null;
    let bestSmallest = null;
    for (const quality of JPG_QUALITY_STEPS) {
      const compressed = await this.compressImageAsync(tempFilePath, quality);
      const compressedSizeKB = this.getFileSizeKB(compressed.tempFilePath);
      const candidate = {
        filePath: compressed.tempFilePath,
        sizeKB: compressedSizeKB,
        quality
      };

      if (!bestSmallest || compressedSizeKB < bestSmallest.sizeKB) {
        bestSmallest = candidate;
      }
      if (compressedSizeKB <= JPG_TARGET_KB) {
        return { best: candidate, bestSmallest };
      }
      if (!softFallback && compressedSizeKB <= JPG_SOFT_MAX_KB) {
        softFallback = candidate;
      }
      if (!hardFallback && compressedSizeKB <= JPG_HARD_MAX_KB) {
        hardFallback = candidate;
      }
    }

    return { best: softFallback || hardFallback || null, bestSmallest };
  },

  async compressJpgToLimit(tempFilePath) {
    const originalSizeBytes = wx.getFileSystemManager().statSync(tempFilePath).size;
    if (originalSizeBytes > JPG_MAX_INPUT_BYTES) {
      throw new Error('图片过大（超过10MB），请先在手机相册中裁剪后再上传');
    }

    const originalSizeKB = originalSizeBytes / 1024;
    if (originalSizeKB <= JPG_HARD_MAX_KB) {
      return { filePath: tempFilePath, sizeKB: originalSizeKB, quality: 100 };
    }

    const firstRound = await this.compressJpgByQualityOnly(tempFilePath);
    if (firstRound.best) {
      return firstRound.best;
    }

    let bestSmallest = firstRound.bestSmallest;
    const imageInfo = await this.getImageInfoAsync(tempFilePath);
    const originalWidth = imageInfo.width;
    const originalHeight = imageInfo.height;

    for (let i = 1; i < JPG_SCALE_STEPS.length; i++) {
      const ratio = JPG_SCALE_STEPS[i];
      const resizeWidth = Math.max(64, Math.round(originalWidth * ratio));
      const resizeHeight = Math.max(64, Math.round(originalHeight * ratio));
      const resized = await this.exportJpgByCanvas(tempFilePath, resizeWidth, resizeHeight);
      const resizedPath = resized.tempFilePath;
      const resizedSizeKB = this.getFileSizeKB(resizedPath);
      const resizedCandidate = {
        filePath: resizedPath,
        sizeKB: resizedSizeKB,
        quality: 100
      };

      if (!bestSmallest || resizedSizeKB < bestSmallest.sizeKB) {
        bestSmallest = resizedCandidate;
      }
      if (resizedSizeKB <= JPG_HARD_MAX_KB) {
        return resizedCandidate;
      }

      const round = await this.compressJpgByQualityOnly(resizedPath);
      if (round.best) {
        return round.best;
      }
      if (round.bestSmallest && (!bestSmallest || round.bestSmallest.sizeKB < bestSmallest.sizeKB)) {
        bestSmallest = round.bestSmallest;
      }
    }

    if (bestSmallest && bestSmallest.sizeKB <= JPG_HARD_MAX_KB) {
      return bestSmallest;
    }

    throw new Error(`压缩后仍超过 ${JPG_HARD_MAX_KB}KB，请先裁剪局部后再上传`);
  },

  async uploadLocalImageFile(filePath, fileName) {
    const fs = wx.getFileSystemManager();
    const buffer = fs.readFileSync(filePath);
    const base64Data = wx.arrayBufferToBase64(buffer);
    const response = await app.mpServerless.function.invoke('uploadImage', { fileName, base64Data });

    if (!response?.success) {
      throw new Error('云函数调用失败');
    }
    const result = response.result || {};
    if (!result.url) {
      throw new Error(result.error || result.message || '上传失败');
    }
    return result.url;
  },

  // ========================= 上传首图 =========================
  uploadMainImage() {
    this.uploadJpgImage('main');
  },

  // ========================= 上传附加图 =========================
  uploadAdditionalImage() {
    const { cat } = this.data;
    if (!cat.name || !cat.name.trim()) {
      wx.showToast({ title: '请先填写猫咪名字', icon: 'none' });
      return;
    }

    const currentCount = parseInt(cat.addPhotoNumber) || 0;
    if (currentCount >= 10) {
      wx.showToast({ title: '最多上传10张附加图', icon: 'none' });
      return;
    }

    this.uploadJpgImage('additional', currentCount + 1);
  },

  // ========================= 通用 JPG 上传 =========================
  uploadJpgImage(type, index = null, isReplace = false) {
    const { cat } = this.data;
    if (!cat.name?.trim()) {
      return wx.showToast({ title: '请先填写猫咪名字', icon: 'none' });
    }
  
    const name = cat.name.trim();
    const fileName = type === 'main' ? `${name}.jpg` : `${name}${index}.jpg`;
  
    wx.chooseImage({
      count: 1,
      sizeType: ['original'], // 获取原始图片
      success: async (res) => {
        const tempFilePath = res.tempFilePaths[0];
        wx.showLoading({ title: '处理中...' });

        try {
          // JPG 仅做质量压缩，不改宽高，避免拉伸变形和方向异常。
          const imageInfo = await this.getImageInfoAsync(tempFilePath);
          const imageType = String(imageInfo.type || '').toLowerCase();
          if (imageType !== 'jpg' && imageType !== 'jpeg') {
            throw new Error('仅支持上传 JPG/JPEG 图片');
          }

          const compressed = await this.compressJpgToLimit(tempFilePath);
          await this.uploadLocalImageFile(compressed.filePath, fileName);

          const nextData = {
            imageUpdateKey: Date.now()
          };
          if (type === 'additional' && !isReplace) {
            nextData['cat.addPhotoNumber'] = index.toString();
          }
          this.setData(nextData);

          wx.hideLoading();
          wx.showToast({
            title: `上传成功 ${Math.round(compressed.sizeKB)}KB`,
            icon: 'success'
          });
        } catch (err) {
          wx.hideLoading();
          console.error('上传失败:', err);
          wx.showToast({
            title: err.message || '上传失败',
            icon: 'none'
          });
        }
      },
      fail: () => wx.showToast({ title: '选择图片失败', icon: 'none' })
    });
  },

  // ========================= 上传圆形 PNG 头像 =========================
  uploadPngAvatar() {
    const { cat } = this.data;
    if (!cat.name?.trim()) {
      return wx.showToast({ title: '请先填写猫咪名字', icon: 'none' });
    }
  
    wx.chooseImage({
      count: 1,
      sizeType: ['original'],
      success: (res) => {
        const tempPath = res.tempFilePaths[0];
        this.checkAndUploadPng(tempPath, cat.name.trim());
      },
      fail: () => wx.showToast({ title: '选择图片失败', icon: 'none' })
    });
  },

  // 检查图片大小，决定是否压缩
  checkAndUploadPng(tempPath, name) {
    const fs = wx.getFileSystemManager();
    const stat = fs.statSync(tempPath);
    const fileSizeKB = stat.size / 1024;
  
    console.log(`原图大小: ${fileSizeKB.toFixed(1)} KB`);
  
    const fileName = `${name}.png`;
  
    if (fileSizeKB <= 30) {
      // ≤30KB，直接上传原图
      this.uploadDirectly(tempPath, fileName);
    } else {
      // >30KB，缩小尺寸压缩
      this.compressByCanvas(tempPath, fileName);
    }
  },
  
  // 直接上传（不经过 canvas）
  uploadDirectly(tempPath, fileName) {
    const fs = wx.getFileSystemManager();
    try {
      const buffer = fs.readFileSync(tempPath);
      const base64Data = wx.arrayBufferToBase64(buffer);
      this.doUpload(base64Data, fileName);
    } catch (err) {
      console.error('读取原图失败:', err);
      wx.showToast({ title: '读取图片失败', icon: 'error' });
    }
  },

  compressByCanvas(tempPath, fileName) {
    wx.getImageInfo({
      src: tempPath,
      success: (res) => {
        const { width, height, path } = res;
        const MAX_SIZE = 120;
        let drawWidth = width;
        let drawHeight = height;
  
        if (width > MAX_SIZE || height > MAX_SIZE) {
          const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
          drawWidth = Math.round(width * ratio);
          drawHeight = Math.round(height * ratio);
        }
  
        // 更新 canvas 尺寸，并在回调中绘图
        this.setData({
          canvasWidth: drawWidth,
          canvasHeight: drawHeight
        }, () => {
          const ctx = wx.createCanvasContext('compress-canvas', this);
          ctx.drawImage(path, 0, 0, drawWidth, drawHeight);
          ctx.draw(false, () => {
            wx.canvasToTempFilePath({
              canvasId: 'compress-canvas',
              width: drawWidth,
              height: drawHeight,
              destWidth: drawWidth,
              destHeight: drawHeight,
              fileType: 'png',
              success: (tempRes) => {
                console.log('压缩成功:', tempRes.tempFilePath);
                this.setData({ debugPreview: tempRes.tempFilePath }); // 调试预览
                this.uploadDirectly(tempRes.tempFilePath, fileName);
              },
              fail: (err) => {
                console.error('canvasToTempFilePath 失败:', err);
                wx.showToast({ title: '图片生成失败', icon: 'error' });
              }
            }, this);
          });
        });
      },
      fail: (err) => {
        console.error('getImageInfo 失败:', err);
        wx.showToast({ title: '图片加载失败', icon: 'error' });
      }
    });
  },
  
  // 实际上传逻辑
  doUpload(base64Data, fileName) {
    wx.showLoading({ title: '上传头像...' });
    app.mpServerless.function.invoke('uploadImage', {
      fileName,
      base64Data,
      contentType: 'image/png'
    }).then(res => {
      wx.hideLoading();
      if (res?.success) {
        wx.showToast({ title: '头像上传成功', icon: 'success' });
        this.setData({ imageUpdateKey: Date.now() }); // 刷新预览
      } else {
        throw new Error('上传返回失败');
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('上传失败:', err);
      wx.showToast({ title: '上传失败', icon: 'error' });
    });
  },

  // 图片预览
  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      urls: [url]
    });
  },

  // 更换某张附加图
  replaceAdditionalImage(e) {
    const index = e.currentTarget.dataset.index;
    this.uploadJpgImage('additional', index, true); // 复用之前的 uploadJpgImage
  },

  // 删除某张附加图
  deleteAdditionalImage(e) {
    const indexToDelete = Number(e.currentTarget.dataset.index);
    const { cat } = this.data;
    const currentCount = parseInt(cat.addPhotoNumber, 10) || 0;

    if (!cat.name?.trim() || !currentCount || indexToDelete < 1 || indexToDelete > currentCount) {
      wx.showToast({ title: '当前图片数量异常，请刷新后重试', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认删除',
      content: `确定要删除 ${cat.name}${indexToDelete}.jpg 吗？`,
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          app.mpServerless.function.invoke('deleteImage', {
            catName: cat.name.trim(),
            indexToDelete,
            currentCount
          }).then(response => {
            wx.hideLoading();
            if (!response?.success) {
              throw new Error('云函数调用失败');
            }
            const result = response.result || {};
            if (!result.success) {
              throw new Error(result.error || result.message || '删除失败');
            }

            const newCount = Number.isInteger(result.newCount) ? result.newCount : (currentCount - 1);
            this.setData({
              ['cat.addPhotoNumber']: Math.max(0, newCount).toString(),
              imageUpdateKey: Date.now()
            });
            app.mpServerless.db.collection('WHUTNR').updateMany({
              _id: cat._id
            }, {
              $set: {
                addPhotoNumber: Math.max(0, newCount).toString(),
                lastEditTime: Date(),
                lastEditAdministrator: app.globalData.Administrator
              }
            }).catch((dbErr) => {
              console.warn('删除后同步 addPhotoNumber 到数据库失败:', dbErr);
            });
            wx.showToast({ title: '删除成功', icon: 'success' });
          }).catch(err => {
            wx.hideLoading();
            console.error('删除失败:', err);
            wx.showToast({ title: err.message || '删除失败', icon: 'none' });
          });
        }
      }
    });
  },

})

// 创建 audio 控件
const myaudio = wx.createInnerAudioContext({
  useWebAudioImplement: true
});
