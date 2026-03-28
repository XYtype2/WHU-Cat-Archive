Page({
  data: {
    activeTab: 'feed' // 默认显示“投喂/绝育”
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({
      activeTab: tab
    })
  },

   // 跳转到扭蛋机页面
   goToGashapon() {
    wx.navigateTo({
      url: '/pages/gashapon/gashapon'
    });
  },

  onShareAppMessage() {
    return {
      title: '猫咪知识科普',
      path: '/pages/informations/informations'
    };
  }
})
