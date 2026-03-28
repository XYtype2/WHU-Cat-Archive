const app = getApp();
var classification = "1";

Page({
  data: {
    cat: [],
    screenWidth: 0,
    screenHeight: 0,
    imgwidth: 0,
    imgheight: 0,
    url: app.globalData.url,
    subDepartments: ['全部', '文理学部', '信息学部', '工学部', '其它校区'],
    currentSubTab: 0,
    showBackToTop: false ,
    showPawButton: true, // 默认显示猫爪按钮
    showFeedingModal: false,
    showLocationFilter: false,   // 是否显示 location 筛选弹窗
    locationOptions: [],         // 所有可选 location（含“全部”）
    selectedLocation: '',        // 当前选中的 location（空字符串表示“全部”）
    showBubble: true
  },

  onPageScroll(e) {
    this.setData({ showBackToTop: e.scrollTop > 200 });
  },
  scrollToTop() {
    wx.pageScrollTo({ scrollTop: 0, duration: 300 });
  },
  toggleFeedingNotice() {
    this.setData({ showFeedingModal: !this.data.showFeedingModal });
  },

  // 打开弹窗
  showFeedingNotice() {
    this.setData({ showFeedingModal: true });
  },

  // 关闭弹窗
  closeFeedingModal() {
    this.setData({ showFeedingModal: false });
  },

  editCat(e) {
    const _id = e.currentTarget.dataset._id;
    if (app.globalData.isAdministrator) {
      wx.navigateTo({
        url: '/pages/editCat/editCat?_id=' + _id,
      });
    }
  },

  onLoad: function (options) {
    classification = options.classification;
    console.log('当前分类:', classification);
  
    // 检查是否首次显示气泡
    const hasShown = wx.getStorageSync('hasShownLocationBubble') || false;
  
    this.setData({
      showBubble: !hasShown // 只有没显示过才显示
    });
  
    // 如果是首次显示，5秒后自动隐藏 + 标记为已显示
    if (!hasShown) {
      setTimeout(() => {
        this.setData({ showBubble: false });
        // 永久标记：以后都不再显示
        wx.setStorageSync('hasShownLocationBubble', true);
      }, 8000);
    }
  
    this.loadMoreCat(); // 初次加载数据
  },

  onReachBottom: function () {
    this.loadMoreCat();
  },


  // loadMoreCat() {
  //   const cat = this.data.cat;
  //   app.mpServerless.db.collection('WHUTNR').find({
  //     status: "健康"
  //   }, {
  //     sort: {
  //       isAdoption: -1
  //     },
  //     skip: cat.length,
  //     limit: 20,
  //   }).then(res => {
  //     const {
  //       result: data
  //     } = res;
  //     this.setData({
  //       cat: cat.concat(data)
  //     });
  //   }).catch(console.error);
  // },
    // 点击学部切换
    subNavbarTap(e) {
      this.setData({
        currentSubTab: e.currentTarget.dataset.idx,
        cat: [], // 清空当前数据
        selectedLocation: '' // 重置为“全部”
      });
      this.loadMoreCat(); // 重新加载该学部的猫咪
    },
  
    // 根据分类 + 学部加载猫
    loadMoreCat() {
      const cat = this.data.cat;
      const dept = this.data.subDepartments[this.data.currentSubTab];
      const selectedLocation = this.data.selectedLocation;
    
      const condition = { status:  { $in: ['健康', '在校'] }  };
    
      // 学部筛选
      if (dept !== '全部') {
        condition.department = dept;
      }
    
      // 如果选了 location，用正则匹配（包含即可）
      if (selectedLocation) {
        // 转义特殊字符（虽然园区名一般没有，但安全起见）
        const escaped = selectedLocation.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        condition.location = { $regex: escaped }; // 包含 selectedLocation 即可
      }
    
      app.mpServerless.db.collection('WHUTNR').find(condition, {
        sort: { isAdoption: -1 },
        skip: cat.length,
        limit: 20,
      }).then(res => {
        this.setData({
          cat: cat.concat(res.result)
        });
      }).catch(err => {
        console.error('加载猫咪失败:', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
    },
    // 获取当前学部（或全部）下的所有唯一 location，并按自定义顺序排序
    fetchLocationOptions(department) {
      const condition = { status:  { $in: ['健康', '在校'] }  };
      if (department !== '全部') {
        condition.department = department;
      }
    
      const LOCATION_ORDER = [
        '梅园',
        '桂园',
        '枫园',
        '湖滨',
        '樱园',
        '竹园',
        '松园'
        // 按你希望的优先级排
      ];
    
      return app.mpServerless.db.collection('WHUTNR')
        .find(condition)
        .then(res => {
          // 步骤1：只收集「不包含顿号」的真实 location（即单一区域）
          const singleLocations = res.result
            .map(item => item.location)
            .filter(loc => loc && typeof loc === 'string' && !loc.includes('、'));
    
          // 步骤2：去重
          const uniqueSingle = [...new Set(singleLocations)];
    
          // 步骤3：按自定义顺序 + 字母排序
          const orderMap = {};
          LOCATION_ORDER.forEach((loc, i) => orderMap[loc] = i);
    
          const sorted = uniqueSingle.sort((a, b) => {
            const ia = orderMap[a] ?? Infinity;
            const ib = orderMap[b] ?? Infinity;
            if (ia === Infinity && ib === Infinity) {
              return a.localeCompare(b);
            }
            return ia - ib;
          });
    
          return ['全部', ...sorted];
        })
        .catch(err => {
          console.error('获取 location 列表失败:', err);
          return ['全部'];
        });
    },
    // 打开 location 筛选弹窗
    openLocationFilter() {
      const currentDept = this.data.subDepartments[this.data.currentSubTab];
      this.fetchLocationOptions(currentDept).then(options => {
        this.setData({
          locationOptions: options,
          showLocationFilter: true
        });
      });
    },
  
    // 选择某个 location
    selectLocation(e) {
      const loc = e.currentTarget.dataset.loc;
      const selectedLocation = loc === '全部' ? '' : loc;
  
      this.setData({
        selectedLocation: selectedLocation,
        showLocationFilter: false,
        cat: [] // 清空列表，重新加载
      });
  
      this.loadMoreCat();
    },
  
    // 关闭弹窗
    closeLocationFilter() {
      this.setData({ showLocationFilter: false });
    },
})