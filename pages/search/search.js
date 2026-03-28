const app = getApp();

Page({
  data: {
    cat: [],
    inputValue: "",
    url: app.globalData.url,
  },

  // loadMorecat() {
  //   const cat = this.data.cat;
  //   app.mpServerless.db.collection('WHUTNR').find({
  //     name: {
  //       $regex: this.data.inputValue
  //     }
  //   }, {
  //     sort: {
  //       lastEditTime: -1
  //     },
  //     // skip: cat.length,
  //     // limit: 20,
  //   }).then(res => {
  //     const {
  //       result: data
  //     } = res;
  //     this.setData({
  //       cat: data
  //     });
  //   }).catch(console.error);
  // },

  loadMorecat() {
    const keyword = this.data.inputValue;
    if (!keyword) {
      this.setData({ cat: [] });
      return;
    }
  
    // 构建不区分大小写的模糊匹配正则
    const regex = { $regex: keyword, $options: 'i' };
  
    app.mpServerless.db.collection('WHUTNR')
      .find({
        $or: [
          { name: regex },
          { nickName: regex } // 直接对 nickName 字符串做模糊匹配
        ]
      }, {
        sort: { lastEditTime: -1 }
      })
      .then(res => {
        this.setData({ cat: res.result || [] });
      })
      .catch(console.error);
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {
    this.loadMorecat();
  },

  editCat(e) {
    const _id = e.currentTarget.dataset._id;
    if (app.globalData.isAdministrator) {
      wx.navigateTo({
        url: '/pages/editCat/editCat?_id=' + _id,
      });
    }
  },

  bindKeyInput: function (e) {
    if (e.detail.value == "") {
      this.setData({
        cat: []
      })
    } else {
      this.setData({
        inputValue: "(?i)" + "(.*)(" + e.detail.value.split('').join(')(.*)(') + ")(.*)"
      })
      this.loadMorecat();
    }
  },

  // 搜索栏输入名字后页面跳转
  bindconfirmT: function (e) {
    if (e.detail.value) {
      const cat = this.data.cat;
      app.mpServerless.db.collection('WHUTNR').find({
        // name: e.detail.value
        $or: [
          { name: regex },
          { nickName: regex } 
        ]
      }, {}).then(res => {
        wx.navigateTo({
          url: '/pages/catDetail/catDetail?_id=' + res.result[0]._id,
        })
      }).catch(console.error);
    }
  },
})