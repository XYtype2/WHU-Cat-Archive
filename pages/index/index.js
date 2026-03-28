const app = getApp();

Page({
  data: {
    userId: undefined,
    healthy_cat: [],
    fostered_cat: [],
    unknown_cat: [],
    dead_cat: [],
    screenWidth: 0,
    screenHeight: 0,
    imgwidth: 0,
    imgheight: 0,
    navbar: ['在校', '领养', '失踪', '死亡'],
    currentTab: 0,
    url: app.globalData.url,
    showPawButton: true,//猫爪
    showFeedingModal: false,

    // 新增：学部分区
    subDepartments: ['全部', '文理学部', '信息学部', '工学部', '其它校区'],
    currentSubTab: 0,
    randomCat: null,   // ← 随机猫数据
    showBackToTop: false 
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
  navbarTap(e) {
    this.setData({
      currentTab: e.currentTarget.dataset.idx,
      currentSubTab: 0 // 切换大类时重置学部
    });
    this.loadAllCats();

    if (e.currentTarget.dataset.idx == 0) {
      this.loadRandomCat();
    }
  },

   // 打开弹窗
   showFeedingNotice() {
    this.setData({ showFeedingModal: true });
  },
  // 关闭弹窗
   closeFeedingModal() {
    this.setData({ showFeedingModal: false });
  },

  // 新增：点击学部分区
  subNavbarTap(e) {
    this.setData({
      currentSubTab: e.currentTarget.dataset.idx,
      fostered_cat: [],
      unknown_cat: [],
      dead_cat: [],
    });
    this.loadAllCats();
  },

  async onLoad(options) {
    this.loadRandomCat();
    if (Object.keys(options).length !== 0) {
      this.setData({
        currentTab: parseInt(options.currentTab),
      });
    }

    this.loadAllCats();

    // 获取用户ID和管理员信息（不变）
    const { result } = await app.mpServerless.user.getInfo();
    this.setData({ userId: result.user.userId });
    app.mpServerless.db.collection('WHUTNRAdministrator').find({
      userId: result.user.userId
    }).then(res => {
      if (res.result.length > 0) {
        app.globalData.isAdministrator = true;
        app.globalData.Administrator = res.result[0].name;
      }
    }).catch(console.error);

    app.mpServerless.db.collection('NewPeople').insertOne({
      userId: result.user.userId,
      time: Date()
    }).catch(console.error);
  },

  onReachBottom() {
    this.loadAllCats();
  },

  // 统一加载函数（根据 tab 和 学部 自动加载）
  loadAllCats() {
    const dept = this.data.subDepartments[this.data.currentSubTab];
    const filterDept = dept === '全部' ? {} : { department: dept };

    if (this.data.currentTab === 0) {
      this.loadCatsByStatus(['健康', '在校'], 'healthy_cat', filterDept);
    } else if (this.data.currentTab === 1) {
      this.loadCatsByStatus('送养', 'fostered_cat', filterDept);
    } else if (this.data.currentTab === 2) {
      this.loadCatsByStatus('失踪', 'unknown_cat', filterDept);
    } else if (this.data.currentTab === 3) {
      this.loadCatsByStatus('离世', 'dead_cat', filterDept);
    }
  },

  // 可复用的加载函数
  loadCatsByStatus(status, listName, filterDept) {
    const currentList = this.data[listName];
    const condition = { status, ...filterDept };

    app.mpServerless.db.collection('WHUTNR').find(condition, {
      sort: { deliveryTime: -1 },
      skip: currentList.length,
      limit: 20,
    }).then(res => {
      this.setData({
        [listName]: currentList.concat(res.result)
      });
    }).catch(console.error);
  },

  editCat(e) {
    const _id = e.currentTarget.dataset._id;
    if (app.globalData.isAdministrator) {
      wx.navigateTo({
        url: '/pages/editCat/editCat?_id=' + _id,
      });
    }
  },

  imageTap(e) {
    if (app.globalData.isAdministrator) {
      wx.navigateTo({
        url: '/pages/addCat/addCat'
      });
    }
  },


  // goToForm() {
  //   wx.navigateToMiniProgram({
  //     appId: 'wxd45c635d754dbf59', // 腾讯文档
  //     extraData: {
  //       url: 'https://docs.qq.com/form/page/DY0ZGWWhCSE9PaFNQ#/fill'  // 直接放原始链接
  //     },
  //     success(res) {
  //       console.log("打开成功");
  //     },
  //     fail(err) {
  //       console.error("打开失败：", err);
  //     }
  //   });
  // }
  goToForm() {
    // 跳转到 external 页面
    wx.navigateTo({
      url: '/pages/external/external'
    });
  },

  // goToTencentDoc() {
  //   wx.navigateToMiniProgram({
  //     appId: 'wxd45c635d754dbf59',     // 腾讯文档官方 AppID
  //     path: 'page/DY0ZGWWhCSE9PaFNQ#/fill',
  //     // query: 'id=DY0ZGWWhCSE9PaFNQ&mode=fill',
  //     success: () => {
  //       console.log('成功跳转至腾讯文档');
  //     },
  //     fail: (err) => {
  //       console.warn('跳转失败，回退到 external 页面', err);
  //       // 失败时兜底：跳转到你已有的 external 页面
  //       wx.navigateTo({
  //         url: '/pages/external/external'
  //       });
  //     }
  //   });
    
  // },

  loadRandomCat() {
    // 从数据库随机抽一只猫
    app.mpServerless.db.collection('WHUTNR').aggregate([
      // { $match: { status: "健康" } },  // 过滤在校猫
      { $sample: { size: 1 } }         // 随机抽样
    ]).then(res => {
      if (res.result.length > 0) {
        this.setData({
          randomCat: res.result[0]
        });
      }
    }).catch(console.error);
  },
  goToRandomCat() {
    const id = this.data.randomCat._id;
    wx.navigateTo({
      url: `/pages/catDetail/catDetail?_id=${id}`
    });
  },
  copy: function (e) {
    var self = this;
    wx.setClipboardData({
      data: 'https://docs.qq.com/form/page/DY0ZGWWhCSE9PaFNQ', //需要复制的内容
      success: function (res) {
        // self.setData({copyTip:true}),

      }
    })
  },
  
  goUpload() {
    wx.navigateTo({
      url: '/pages/upload/upload'
    });
  },
  
});
