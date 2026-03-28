//index.js

Page({
  data: {
    screenWidth: 0,
    screenHeight: 0,
    imgwidth: 0,
    imgheight: 0,
    imagePath: 'https://whutnr-1311545081.cos.ap-guangzhou.myqcloud.com/picture/xiaozhushou.jpg'
  },
  //转发功能
  onShareAppMessage: function () {
    let users = wx.getStorageSync('user');
    if (res.from === 'button') {}
    return {
      path: 'pages/about/about', // 路径，传递参数到指定页面。
      success: function (res) {}
    }
  },

  // 转发到朋友圈
  onShareTimeline: function (res) {
    if (ops.from === 'button') {
      // 来自页面内转发按钮
      console.log(ops.target)
    }
    return {
      path: 'pages/about/about', // 路径，传递参数到指定页面。
      success: function (res) {
        // 转发成功
        console.log("转发成功:" + JSON.stringify(res));
      },
      fail: function (res) {
        // 转发失败
        console.log("转发失败:" + JSON.stringify(res));
      }
    }
  },

  onPullDownRefresh: function () {
    wx.stopPullDownRefresh()
  },        

  copy1: function (e) {
    var self = this;
    wx.setClipboardData({
      data: 'WHUTNR', //需要复制的内容
      success: function (res) {
        // self.setData({copyTip:true}),

      }
    })
  },
  copy3: function (e) {
    var self = this;
    wx.setClipboardData({
      data: '武大TNR小分队', //需要复制的内容
      success: function (res) {
        // self.setData({copyTip:true}),

      }
    })
  },
  copy4: function (e) {
    var self = this;
    wx.setClipboardData({
      data: '武大猫猫头', //需要复制的内容
      success: function (res) {
        // self.setData({copyTip:true}),

      }
    })
  },
  copy5: function (e) {
    var self = this;
    wx.setClipboardData({
      data: '珞珈山的猫', //需要复制的内容
      success: function (res) {
        // self.setData({copyTip:true}),

      }
    })
  },
  copy2: function (e) {
    var self = this;
    wx.setClipboardData({
      data: 'https://gitee.com/circlelq/yan-yuan-mao-su-cha-shou-ce', //需要复制的内容
      success: function (res) {
        // self.setData({copyTip:true}),
      }
    })
  },
  codeimgdata: {
    images: "https://pku-lostangel.oss-cn-beijing.aliyuncs.com/二维码.jpg",
    imgList: ["https://pku-lostangel.oss-cn-beijing.aliyuncs.com/二维码.jpg"]
  },
  previewImg: function (e) {
    console.log(1);
    var current = this.codeimgdata.images
    wx.previewImage({
      current: current,
      urls: this.codeimgdata.imgList
    })
  },

  // 跳转高校动保
  naviToMini: function (e) {
    wx.navigateToMiniProgram({
      appId: 'wx0fb7b06a5065be09',
      // path: 'pages/index/index',
      envVersion: 'release',
      success(res) {
        // 打开成功
      }
    })
  },

  previewImage() {
    const imgSrc = this.data.imagePath;
    wx.previewImage({
      urls: [imgSrc], // 需要预览的图片链接列表
      current: imgSrc, // 当前显示图片的链接/索引
    });
  },

  goToCatMap() {
    // 检查是否登录（可选）
    const openid = wx.getStorageSync('openid');
    if (!openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    // 跳转到猫咪地图
    wx.navigateTo({
      url: '/pages/external/external'
    });
  },

})