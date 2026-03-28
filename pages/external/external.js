// Page({
//   data: {
//     formUrl: 'https://docs.qq.com/form/page/DY0ZGWWhCSE9PaFNQ#/fill',
//     imagePath: 'https://whutnr-1311545081.cos.ap-guangzhou.myqcloud.com/picture/form_qr1.jpg'
//   },

//   copyUrl() {
//     const url = this.data.formUrl;
//     wx.setClipboardData({
//       data: url,
//       success: () => {
//         wx.showToast({
//           title: '链接已复制',
//           icon: 'success'
//         });
//       },
//       fail: () => {
//         wx.showToast({
//           title: '复制失败',
//           icon: 'none'
//         });
//       }
//     });
//   },
  
//   previewImage() {
//     const imgSrc = this.data.imagePath;
//     wx.previewImage({
//       urls: [imgSrc], // 需要预览的图片链接列表
//       current: imgSrc, // 当前显示图片的链接/索引
//     });
//   }
// });
// pages/catmap/index.js
const app = getApp();

Page({
  data: {
    hasAccess: false,
    loading: true,
    searchKeyword: '',
    center: {
      latitude: 30.536708,   // 默认中心（武汉）
      longitude: 114.365808
    },
    scale: 16, 
    markers: [],
    catIds: [],
    allCats: [],
    COS_BASE_URL: 'https://whutnr-1311545081.cos.ap-guangzhou.myqcloud.com/picture',
    isLocateMode: false,       // 是否处于“补位置”模式
    unlocatedCats: [],         // 未定位的猫列表
    selectedUnlocatedCat: null,
    applyNickname: '' ,
    showApplyForm: false, 
    isApplyBtnDisabled: true,
    showCatSelectModal: false, // 控制选择弹窗
    candidateCats: [] ,         // 弹窗中的候选猫
  },

  onLoad() {
    this.checkAccess();
  },

  // 检查用户是否在白名单
  async checkAccess() {
    const openid = wx.getStorageSync('openid');
    if (!openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    try {
      const res = await app.mpServerless.db.collection('map_whitelist')
        .findOne({ openid });

      if (res.result) {
        this.setData({ hasAccess: true });
        await this.loadCatsWithLocation();
        await this.loadUnlocatedCats();
      } else {
        this.setData({ 
          hasAccess: false,
          showApplyForm: true,
          applyNickname: ''
        });
      }
    } catch (err) {
      console.error('权限检查失败', err);
      wx.showToast({ title: '系统错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    } finally {
      this.setData({ loading: false });
    }
  },

  // 加载有坐标的猫咪
  async loadCatsWithLocation() {
    try {
      const res = await app.mpServerless.db.collection('WHUTNR')
        .find({ 
          locationGeo: { $exists: true },
          status:  { $in: ['健康', '在校'] } 
        });

      let cats = res.result || [];
      cats = cats.filter(cat => {
        const geo = cat.locationGeo;
        if (!geo || typeof geo !== 'object') return false;
        if (!geo.coordinates || !Array.isArray(geo.coordinates)) return false;
        if (geo.coordinates.length < 2) return false;
        const [lng, lat] = geo.coordinates;
        return typeof lng === 'number' && typeof lat === 'number';
      });

      this.setData({ allCats: cats });
      this.filterAndRenderMarkers();
    } catch (err) {
      console.error('加载猫咪位置失败', err);
      wx.showToast({ title: '地图加载失败', icon: 'none' });
    }
  },

  // 加载没有坐标的猫
  async loadUnlocatedCats() {
    try {
      const res = await app.mpServerless.db.collection('WHUTNR')
        .find({
          status: { $nin: ['送养', '失踪', '离世'] }
        });

      const allCandidates = res.result || [];
      const unlocated = allCandidates.filter(cat => {
        const geo = cat.locationGeo;
        if (geo === undefined || geo === null) return true;
        if (typeof geo === 'object' && Object.keys(geo).length === 0) return true;
        if (!geo.coordinates || !Array.isArray(geo.coordinates)) return true;
        if (geo.coordinates.length < 2) return true;
        const [lng, lat] = geo.coordinates;
        if (typeof lng !== 'number' || typeof lat !== 'number') return true;
        if (lng === 0 && lat === 0) return true;
        return false;
      });

      console.log('【成功】找到无坐标猫数量:', unlocated.length);
      this.setData({ unlocatedCats: unlocated });
    } catch (err) {
      console.error('查询无坐标猫失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ unlocatedCats: [] });
    }
  },

  onMarkerTap(e) {
    const markerIndex = e.detail.markerId;
    const catId = this.data.catIds[markerIndex];
    const cat = this.data.allCats.find(c => c._id === catId);
    
    if (!cat) return;
  
    const { isLocateMode } = this.data;
  
    if (isLocateMode) {
      // 处于定位模式：点击 marker 即选中该猫，准备修改位置
      wx.showModal({
        title: '修改位置',
        content: `要重新设置「${cat.name}」的位置吗？`,
        success: (res) => {
          if (res.confirm) {
            this.setData({
              selectedUnlocatedCat: cat
            });
            wx.showToast({
              title: `点击地图设置【${cat.name}】的新位置`,
              icon: 'none',
              duration: 2500
            });
          }
        }
      });
    } else {
      // 非定位模式：跳转详情页
      wx.navigateTo({
        url: `/pages/catDetail/catDetail?_id=${cat._id}`
      });
    }
  },

  filterAndRenderMarkers() {
    const { allCats, searchKeyword, isLocateMode } = this.data; // 👈 解构 isLocateMode
    let filteredCats = allCats;
  
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase();
      filteredCats = allCats.filter(cat =>
        cat.name && cat.name.toLowerCase().includes(kw)
      );
    }
  
    const catIds = filteredCats.map(cat => cat._id);
    const markers = filteredCats.map((cat, index) => {
      const coords = cat.locationGeo?.coordinates || [0, 0];
      const [lng, lat] = coords;
      return {
        id: index,
        latitude: lat,
        longitude: lng,
        title: cat.name,
        callout: {
          content: `${cat.name}`,
          display: 'ALWAYS',
          textAlign: 'center'
        },
        iconPath: `${this.data.COS_BASE_URL}/${encodeURIComponent(cat.name)}.png`,
        width: 38,
        height: 38
      };
    });
  
    const updateData = { markers, catIds };
  
    // ⚠️ 仅在「非编辑模式」下才允许自动居中！
    if (!isLocateMode && filteredCats.length === 1) {
      const cat = filteredCats[0];
      if (cat.locationGeo?.coordinates?.length >= 2) {
        const [lng, lat] = cat.locationGeo.coordinates;
        if (typeof lng === 'number' && typeof lat === 'number') {
          updateData.center = { latitude: lat, longitude: lng };
          updateData.scale = 17;
        }
      }
    }
  
    this.setData(updateData);
  },

  onSearchInput(e) {
    const keyword = e.detail.value;
    this.setData({ searchKeyword: keyword }, () => {
      const { isLocateMode } = this.data;
  
      // 只有在非定位模式下，才过滤地图上的标记
      if (!isLocateMode) {
        this.filterAndRenderMarkers();
      }
  
      // 定位模式下：只处理未定位猫的搜索（用于弹窗）
      if (isLocateMode && keyword.trim()) {
        const kw = keyword.trim().toLowerCase();
        const candidates = this.data.unlocatedCats.filter(cat =>
          cat.name && cat.name.toLowerCase().includes(kw)
        );
  
        if (candidates.length > 0 && candidates.length <= 6) {
          this.showCatSelectionModal(candidates);
        } else if (candidates.length > 6) {
          wx.showToast({ title: '结果过多，请精确搜索', icon: 'none' });
        }
      }
    });
  },

  clearSearch() {
    this.setData({ searchKeyword: '' }, () => {
      this.filterAndRenderMarkers();
    });
  },

  switchCenter(e) {
    const { lat, lng } = e.currentTarget.dataset;
    this.setData({
      center: {
        latitude: parseFloat(lat),
        longitude: parseFloat(lng)
      },
      scale: 15
    });
  },

  // 地图点击：仅在定位模式且已选猫时生效
  onMapClick(e) {
    if (!this.data.isLocateMode || !this.data.selectedUnlocatedCat) {
      if (this.data.isLocateMode) {
        wx.showToast({ title: '请先选择一只猫', icon: 'none' });
      }
      return;
    }

    const { latitude, longitude } = e.detail;
    wx.showModal({
      title: '确认位置',
      content: `将「${this.data.selectedUnlocatedCat.name}」的位置设为该点？`,
      success: async (res) => {
        if (res.confirm) {
          await this.bindLocationToCat(
            this.data.selectedUnlocatedCat._id,
            longitude,
            latitude
          );
          // 重置状态
          this.setData({
            selectedUnlocatedCat: null,
            showCatSelectModal: false
          });
          await this.loadCatsWithLocation();
          await this.loadUnlocatedCats();
        }
      }
    });
  },

  toggleLocateMode() {
    const newMode = !this.data.isLocateMode;
    if (newMode) {
      if (this.data.unlocatedCats.length === 0) {
        wx.showToast({ title: '暂无可定位的猫', icon: 'none' });
        return;
      }
      wx.showToast({
        title: '请在上方搜索框输入猫名',
        icon: 'none',
        duration: 2000
      });
    }
    this.setData({ 
      isLocateMode: newMode,
      selectedUnlocatedCat: null,
      showCatSelectModal: false
    });
  },

  showCatSelectionModal(candidates) {
    this.setData({
      showCatSelectModal: true,
      candidateCats: candidates
    });
  },

  hideCatSelectModal() {
    this.setData({ showCatSelectModal: false });
  },

  selectCatForLocate(e) {
    const cat = e.currentTarget.dataset.cat;
    this.setData({
      selectedUnlocatedCat: cat,
      showCatSelectModal: false
    });
    wx.showToast({
      title: `已选【${cat.name}】，点击地图设位置`,
      icon: 'none'
    });
  },

  async bindLocationToCat(catId, lng, lat) {
    try {
      await app.mpServerless.db.collection('WHUTNR').updateOne(
        { _id: catId },
        {
          $set: {
            locationGeo: {
              type: 'Point',
              coordinates: [lng, lat]
            }
          }
        }
      );

      wx.showToast({ title: '位置绑定成功！', icon: 'success' });
      await this.loadCatsWithLocation();
      await this.loadUnlocatedCats();
    } catch (err) {
      console.error('绑定位置失败', err);
      wx.showToast({ title: '绑定失败', icon: 'none' });
    }
  },

  onNicknameInput(e) {
    const val = e.detail.value.trim();
    this.setData({ 
      applyNickname: e.detail.value,
      isApplyBtnDisabled: !val
    });
  },

  async submitApply() {
    const { applyNickname } = this.data;
    const nickname = applyNickname.trim();
    const openid = wx.getStorageSync('openid');

    if (!nickname || !openid) {
      wx.showToast({ title: '请输入昵称并确保已登录', icon: 'none' });
      return;
    }

    try {
      const existing = await app.mpServerless.db.collection('map_access_requests')
        .findOne({
          openid: openid,
          status: { $in: ['pending', 'approved'] }
        });

      if (existing.result) {
        wx.showToast({ title: '您已提交过申请，请勿重复提交', icon: 'none' });
        return;
      }

      await app.mpServerless.db.collection('map_access_requests').insertOne({
        openid: openid,
        nickname: nickname,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      wx.showToast({ title: '申请已提交，请等待审核', icon: 'success' });
      this.setData({ applyNickname: '', isApplyBtnDisabled: true });
    } catch (err) {
      console.error('提交申请失败', err);
      wx.showToast({ title: '提交失败，请重试', icon: 'none' });
    }
  },

  onImageError(e) {
    console.warn('头像加载失败', e);
  },

  moveToUserLocation() {
    wx.showLoading({ title: '定位中...' });

    wx.getLocation({
      type: 'gcj02', // 必须用 gcj02，和腾讯地图坐标系一致
      success: (res) => {
        const { latitude, longitude } = res;
        console.log('【定位】获取到用户位置:', latitude, longitude);

        this.setData({
          center: { latitude, longitude },
          scale: 16 // 可调整缩放级别，16 是较合适的街道视图
        }, () => {
          wx.hideLoading();
          wx.showToast({
            title: '已定位到当前位置',
            icon: 'success',
            duration: 1000
          });
        });
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('定位失败:', err);

        // 判断是否因权限被拒
        if (err.errCode === 0 || err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '定位权限未开启',
            content: '请允许访问位置信息，才能定位到您的当前位置。',
            showCancel: true,
            confirmText: '去设置',
            success(res) {
              if (res.confirm) {
                wx.openSetting({
                  success(settingRes) {
                    if (settingRes.authSetting['scope.userLocation']) {
                      wx.showToast({ title: '授权成功' });
                    }
                  }
                });
              }
            }
          });
        } else {
          wx.showToast({ title: '定位失败，请重试', icon: 'none' });
        }
      }
    });
  },

});
