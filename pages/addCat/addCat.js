const app = getApp();
const JPG_TARGET_KB = 250;
const JPG_SOFT_MAX_KB = 280;
const JPG_HARD_MAX_KB = 300;
const JPG_MAX_INPUT_BYTES = 10 * 1024 * 1024;
const JPG_QUALITY_STEPS = [92, 88, 84, 80, 76, 72, 68, 64, 60, 56, 52, 48, 44, 40, 36, 32, 28, 24, 20];
const JPG_SCALE_STEPS = [1, 0.88, 0.76, 0.64, 0.52, 0.4, 0.3, 0.24];

Page({
  data: {
    cat: {
      status: '在校',
      classification: '狸花和狸白',
      addPhotoNumber: 0,
      audioNumber: 0,
      currentDepartment: 0,
      department: '文理学部',
      photographer: '',
      coordinateInput: ''
    },
    url: app.globalData.url,
    imageUpdateKey: 0,
    canvasWidth: 300,
    canvasHeight: 300,
    departments: ['文理学部', '信息学部', '工学部', '其它校区'],
    pickers: {
      classification: ['狸花和狸白', '橘猫及橘白', '黑猫和奶牛', '玳瑁及三花', '纯白'],
      isAdoption: ['', '推荐领养'],
      gender: ['', '公', '母'],
      addPhotoNumber: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
      audioNumber: ['0', '1', '2', '3'],
      isSterilization: ['', '已绝育', '未绝育'],
      status: ['在校', '送养', '失踪', '离世'],
      character: ['', '亲人可抱', '亲人不可抱 可摸', '薛定谔亲人', '吃东西时可以一直摸', '吃东西时可以摸一下', '怕人 安全距离 1m 以内', '怕人 安全距离 1m 以外'],
    },
    picker_selected: {},
  },

  onLoad() {},

  bindDateChange(e) {
    const key = e.currentTarget.dataset.key;
    const value = e.detail.value;
    this.setData({
      ['cat.' + key]: value
    });
  },

  bindPickerChange(e) {
    const key = e.currentTarget.dataset.key;
    const index = e.detail.value;
    const value = this.data.pickers[key][index];
    this.setData({
      ['cat.' + key]: value
    });
  },

  bindDepartmentChange(e) {
    const index = parseInt(e.detail.value, 10);
    const deptName = this.data.departments[index];
    this.setData({
      'cat.currentDepartment': index,
      'cat.department': deptName,
      currentDepartment: index,
    });
  },

  inputText(e) {
    const key = e.currentTarget.dataset.key;
    const value = e.detail.value;
    this.setData({
      ['cat.' + key]: value
    });
  },

  upload() {
    wx.showModal({
      title: '提示',
      content: '确定添加猫吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '更新中...' });
          let locationGeo = null;
          const coordStr = (this.data.cat.coordinateInput || '').trim();
          if (coordStr) {
            const parts = coordStr.split(',').map(s => s.trim());
            if (parts.length === 2) {
              const lng = parseFloat(parts[0]);
              const lat = parseFloat(parts[1]);
              if (!isNaN(lng) && !isNaN(lat)) {
                locationGeo = {
                  type: "Point",
                  coordinates: [lng, lat]
                };
              }
            }
          }

          const deptName = this.data.cat.department || '文理学部';

          app.mpServerless.db.collection('WHUTNR').insertOne({
            name: this.data.cat.name,
            addPhotoNumber: this.data.cat.addPhotoNumber,
            nickName: this.data.cat.nickName,
            audioNumber: this.data.cat.audioNumber,
            furColor: this.data.cat.furColor,
            classification: this.data.cat.classification,
            gender: this.data.cat.gender,
            isAdoption: this.data.cat.isAdoption,
            status: this.data.cat.status,
            isSterilization: this.data.cat.isSterilization,
            sterilizationTime: this.data.cat.sterilizationTime,
            character: this.data.cat.character,
            firstSightingTime: this.data.cat.firstSightingTime,
            appearance: this.data.cat.appearance,
            missingTime: this.data.cat.missingTime,
            relationship: this.data.cat.relationship,
            moreInformation: this.data.cat.moreInformation,
            notes: this.data.cat.notes,
            deliveryTime: this.data.cat.deliveryTime,
            deathTime: this.data.cat.deathTime,
            deathReason: this.data.cat.deathReason,
            location: this.data.cat.location,
            birthTime: this.data.cat.birthTime,
            relatedCats: this.data.cat.relatedCats,
            department: deptName,
            currentDepartment: this.data.cat.currentDepartment,
            lastEditTime: Date(),
            lastEditAdministrator: app.globalData.Administrator,
            photographer: this.data.cat.photographer,
            ...(locationGeo ? { locationGeo } : { locationGeo: null })
          }).then(() => {
            wx.hideLoading();
            wx.showToast({ icon: 'success', title: '操作成功' });
          }).catch(err => {
            wx.hideLoading();
            console.error(err);
            wx.showToast({ icon: 'error', title: '操作失败' });
          });
        }
      }
    });
  },

  inputCoordinate(e) {
    this.setData({
      'cat.coordinateInput': e.detail.value
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

  downloadFileAsync(url) {
    return new Promise((resolve, reject) => {
      wx.downloadFile({
        url,
        success: (res) => {
          if (res.statusCode === 200 && res.tempFilePath) {
            resolve(res.tempFilePath);
            return;
          }
          reject(new Error(`下载失败(${res.statusCode || 'unknown'})`));
        },
        fail: (err) => reject(err)
      });
    });
  },

  async reindexAdditionalImagesByUpload(catName, indexToDelete, currentCount) {
    const ts = Date.now();
    for (let i = indexToDelete + 1; i <= currentCount; i++) {
      const sourceFile = `${catName}${i}.jpg`;
      const targetFile = `${catName}${i - 1}.jpg`;
      const sourceUrl = `${this.data.url}${encodeURIComponent(sourceFile)}?_t=${ts}_${i}`;
      const tempPath = await this.downloadFileAsync(sourceUrl);
      await this.uploadLocalImageFile(tempPath, targetFile);
    }
  },

  async cleanupTailFileAfterFallback(catName, currentCount) {
    const tailFileName = `${catName}${currentCount}.jpg`;
    const response = await app.mpServerless.function.invoke('deleteImage', { fileName: tailFileName });
    if (!response?.success) return false;
    const result = response.result || {};
    return !!result.success;
  },

  uploadMainImage() {
    this.uploadJpgImage('main');
  },

  uploadAdditionalImage() {
    const { cat } = this.data;
    if (!cat.name || !cat.name.trim()) {
      wx.showToast({ title: '请先填写猫咪名字', icon: 'none' });
      return;
    }

    const currentCount = parseInt(cat.addPhotoNumber, 10) || 0;
    if (currentCount >= 10) {
      wx.showToast({ title: '最多上传10张附加图', icon: 'none' });
      return;
    }

    this.uploadJpgImage('additional', currentCount + 1);
  },

  uploadJpgImage(type, index = null, isReplace = false) {
    const { cat } = this.data;
    if (!cat.name?.trim()) {
      return wx.showToast({ title: '请先填写猫咪名字', icon: 'none' });
    }

    const name = cat.name.trim();
    const fileName = type === 'main' ? `${name}.jpg` : `${name}${index}.jpg`;

    wx.chooseImage({
      count: 1,
      sizeType: ['original'],
      success: async (res) => {
        const tempFilePath = res.tempFilePaths[0];
        wx.showLoading({ title: '处理中...' });

        try {
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

  uploadPngAvatar() {
    const { cat } = this.data;
    if (!cat.name?.trim()) {
      return wx.showToast({ title: '请先填写猫咪名字', icon: 'none' });
    }
    const name = cat.name.trim();
    wx.showActionSheet({
      itemList: [
        '在小程序内裁剪圆形头像（可放大）',
        '直接上传已裁好的头像'
      ],
      success: (res) => {
        const needCrop = res.tapIndex === 0;
        this.chooseAvatarSource(name, needCrop);
      }
    });
  },

  chooseAvatarSource(name, needCrop) {
    wx.chooseImage({
      count: 1,
      sizeType: ['original'],
      success: (res) => {
        const tempPath = res.tempFilePaths && res.tempFilePaths[0];
        if (!tempPath) {
          wx.showToast({ title: '未获取到图片', icon: 'none' });
          return;
        }

        if (!needCrop) {
          this.checkAndUploadPng(tempPath, name);
          return;
        }

        wx.navigateTo({
          url: `/pages/crop/crop?src=${encodeURIComponent(tempPath)}&name=${encodeURIComponent(name)}`,
          events: {
            onCroppedImage: (payload) => {
              const croppedPath = payload && payload.path;
              if (!croppedPath) {
                wx.showToast({ title: '裁剪结果无效', icon: 'none' });
                return;
              }
              this.checkAndUploadPng(croppedPath, name);
            }
          },
          fail: () => {
            wx.showToast({ title: '打开裁剪页失败', icon: 'none' });
          }
        });
      },
      fail: () => wx.showToast({ title: '选择图片失败', icon: 'none' })
    });
  },

  checkAndUploadPng(tempPath, name) {
    const fs = wx.getFileSystemManager();
    const stat = fs.statSync(tempPath);
    const fileSizeKB = stat.size / 1024;
    const fileName = `${name}.png`;

    if (fileSizeKB <= 30) {
      this.uploadDirectly(tempPath, fileName);
    } else {
      this.compressByCanvas(tempPath, fileName);
    }
  },

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
        this.setData({ imageUpdateKey: Date.now() });
      } else {
        throw new Error('上传返回失败');
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('上传失败:', err);
      wx.showToast({ title: '上传失败', icon: 'error' });
    });
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      urls: [url]
    });
  },

  replaceAdditionalImage(e) {
    const index = e.currentTarget.dataset.index;
    this.uploadJpgImage('additional', index, true);
  },

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
          const catName = cat.name.trim();
          const fileName = `${catName}${indexToDelete}.jpg`;
          app.mpServerless.function.invoke('deleteImage', {
            fileName,
            catName,
            indexToDelete,
            currentCount
          }).then(async (response) => {
            if (!response?.success) {
              throw new Error('云函数调用失败');
            }
            const result = response.result || {};

            // 常规路径：云函数已完成删除+重排
            if (result.success && Number.isInteger(result.newCount)) {
              this.setData({
                ['cat.addPhotoNumber']: Math.max(0, result.newCount).toString(),
                imageUpdateKey: Date.now()
              });
              wx.hideLoading();
              wx.showToast({ title: '删除成功', icon: 'success' });
              return;
            }

            const errorMsg = result.message || result.error || '删除失败';

            // 兜底路径：deleteImage 缺少密钥时，改用 uploadImage 重排，保证功能可用
            if (errorMsg.includes('Missing COS secrets') || errorMsg.includes('space_cloud_storage_not_found')) {
              await this.reindexAdditionalImagesByUpload(catName, indexToDelete, currentCount);
              const cleaned = await this.cleanupTailFileAfterFallback(catName, currentCount);
              this.setData({
                ['cat.addPhotoNumber']: Math.max(0, currentCount - 1).toString(),
                imageUpdateKey: Date.now()
              });
              wx.hideLoading();
              if (!cleaned) {
                wx.showToast({ title: '已重排，尾图清理失败', icon: 'none' });
                return;
              }
              wx.showToast({ title: '删除成功', icon: 'success' });
              return;
            }

            if (result.success && !Number.isInteger(result.newCount)) {
              throw new Error('云函数未完成重排，请先部署 deleteImage 最新版本');
            }

            throw new Error(errorMsg);
          }).catch(err => {
            wx.hideLoading();
            console.error('删除失败:', err);
            wx.showToast({ title: err.message || '删除失败', icon: 'none' });
          });
        }
      }
    });
  },
});

const myaudio = wx.createInnerAudioContext();
