var _id = "1";
const app = getApp();

Page({
  data: {
    cat: {},
    url: app.globalData.url,
    relatedCatsId: [],
    photoArray: [],
    audioArr: [],
    likeCount: 0,
    hasLiked: false,
    showGiftPanel: false,
    groupedBadges: [],
    showBackpackPanel: false,
    userBackpack: [],
    loadingBackpack: false,
    selectedBadgeId: '', 
  },

  onLoad(options) {
    const app = getApp();
    _id = options._id;

    // 获取猫的基本信息
    app.mpServerless.db.collection('WHUTNR').findOne({ _id }).then(res => {
      if (!res.result) {
        wx.showToast({ title: '猫咪信息不存在', icon: 'none' });
        return;
      }

      const catData = res.result;

      this.setData({ cat: catData }, () => {
        let photoArray = [];
        if (this.data.cat.addPhotoNumber > 0) {
          for (let i = 1; i <= this.data.cat.addPhotoNumber; i++) {
            photoArray.push(i);
          }
        }
        this.setData({ photoArray });

        let audioArr = [];
        if (this.data.cat.audioNumber > 0) {
          for (let i = 1; i <= this.data.cat.audioNumber; i++) {
            audioArr.push(i);
          }
        }
        this.setData({ audioArr });

        if (this.data.cat.relatedCats) {
          var relatedCats = this.data.cat.relatedCats.split(" ")
          for (var i = 0; i < relatedCats.length; ++i) {
            app.mpServerless.db.collection('WHUTNR').find({
              name: relatedCats[i],
            }, {}).then(res => {
              this.setData({
                relatedCatsId: this.data.relatedCatsId.concat(res.result),
              });
            })
          }
          this.setData({
            relatedCats: relatedCats,
          });
        }
        this.silentLoginAndCheckLike();
      });

    }).catch(err => {
      console.error('加载猫详情失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  silentLoginAndCheckLike() {
    const cached = wx.getStorageSync('openid');
    if (cached) {
      this.openid = cached;
      this.checkLikeStatusByOpenid();
      return;
    }

    wx.login({
      success: (res) => {
        if (!res.code) return;
        app.mpServerless.function.invoke('getOpenid', { code: res.code })
          .then(r => {
            if (r.result?.success && r.result.openid) {
              this.openid = r.result.openid;
              wx.setStorageSync('openid', this.openid); 
              this.checkLikeStatusByOpenid();
            } else {
              this.loadLikeCountOnly();
            }
          })
          .catch(this.loadLikeCountOnly);
      },
      fail: this.loadLikeCountOnly
    });
  },

  loadLikeCountOnly() {
    app.mpServerless.db.collection('cat_likes_count')
      .findOne({ catId: _id })
      .then(res => {
        this.setData({ 
          likeCount: res.result ? res.result.count : 0,
          hasLiked: false 
        });
      })
      .catch(() => {
        this.setData({ likeCount: 0, hasLiked: false });
      });
  },

  checkLikeStatusByOpenid() {
    if (!this.openid) return;

    Promise.all([
      app.mpServerless.db.collection('cat_likes').findOne({ openid: this.openid, catId: _id }),
      app.mpServerless.db.collection('cat_likes_count').findOne({ catId: _id })
    ]).then(([likeRes, countRes]) => {
      this.setData({
        hasLiked: !!likeRes.result,
        likeCount: countRes.result ? countRes.result.count : 0
      });
    }).catch(() => {
      this.loadLikeCountOnly();
    });
  },

  likeCat() {
    if (!this.openid) {
      wx.showToast({ title: '请稍候...', icon: 'none' });
      return;
    }

    if (this.data.hasLiked) {
      wx.showLoading({ title: '取消中...' });
      app.mpServerless.db.collection('cat_likes')
        .deleteOne({ openid: this.openid, catId: _id })
        .then(() => {
          return app.mpServerless.db.collection('cat_likes_count')
            .updateOne(
              { catId: _id },
              { $inc: { count: -1 } }
            );
        })
        .then(() => {
          const newCount = Math.max(0, this.data.likeCount - 1);
          this.setData({ hasLiked: false, likeCount: newCount });
          wx.hideLoading();
          wx.showToast({ title: '已取消点赞', icon: 'success' });
        })
        .catch(err => {
          wx.hideLoading();
          console.error('取消点赞失败', err);
          wx.showToast({ title: '操作失败', icon: 'none' });
        });
    } else {
      wx.showLoading({ title: '点赞中...' });
      app.mpServerless.db.collection('cat_likes')
        .insertOne({
          openid: this.openid,
          catId: _id,
          timestamp: Date.now()
        })
        .then(() => {
          return app.mpServerless.db.collection('cat_likes_count')
            .findOne({ catId: _id });
        })
        .then(res => {
          if (res.result) {
            return app.mpServerless.db.collection('cat_likes_count')
              .updateOne({ catId: _id }, { $inc: { count: 1 } });
          } else {
            return app.mpServerless.db.collection('cat_likes_count')
              .insertOne({ catId: _id, count: 1 });
          }
        })
        .then(() => {
          this.setData({ 
            hasLiked: true, 
            likeCount: this.data.likeCount + 1 
          });
          wx.hideLoading();
          wx.showToast({ title: '感谢点赞！', icon: 'success' });
        })
        .catch(err => {
          wx.hideLoading();
          console.error('点赞失败', err);
          wx.showToast({ title: '点赞失败', icon: 'none' });
        });
    }
  },

  openGiftPanel() {
    if (!this.openid) {
      wx.showToast({ title: '请稍候...', icon: 'none' });
      return;
    }
    this.loadCatBadges();
  },

  loadCatBadges() {
    app.mpServerless.db.collection('cat_gifts')
      .find({ catId: _id })
      .then(res => {
        const gifts = res.result || [];
        const badgeIds = [...new Set(gifts.map(g => g.badgeId))];

        if (badgeIds.length === 0) {
          this.setData({ groupedBadges: [] });
          return;
        }

        return app.mpServerless.db.collection('badges')
          .find({ badgeId: { $in: badgeIds } })
          .then(badgeMetaRes => {
            const badgeMap = {};
            (badgeMetaRes.result || []).forEach(b => {
              badgeMap[b.badgeId] = b;
            });

            const countMap = {};
            gifts.forEach(g => {
              if (!countMap[g.badgeId]) countMap[g.badgeId] = 0;
              countMap[g.badgeId]++;
            });

            const grouped = Object.keys(countMap).map(badgeId => ({
              badgeId,
              count: countMap[badgeId],
              icon: badgeMap[badgeId]?.icon || '/pages/images/default_badge.png',
              name: badgeMap[badgeId]?.name || '徽章'
            }));

            this.setData({ groupedBadges: grouped });
          });
      })
      .then(() => {
        this.setData({ showGiftPanel: true });
      });
  },

  closeAllPanels() {
    this.setData({
      showGiftPanel: false,
      showBackpackPanel: false,
    });
  },

  closeBackpackPanel() {
    this.setData({ showBackpackPanel: false });
  },

  openBackpackPanel() {
    this.setData({ loadingBackpack: true });
    const openid = this.openid;
    if (!openid) {
      wx.showToast({ title: '请稍候...', icon: 'none' });
      return;
    }

    app.mpServerless.db.collection('user_badges')
      .find({ openid })
      .then(res => {
        const userBadges = res.result || [];
        const badgeIds = userBadges.map(b => b.badgeId);

        if (badgeIds.length === 0) {
          this.setData({
            userBackpack: [],
            showBackpackPanel: true,
            loadingBackpack: false
          });
          return;
        }

        return app.mpServerless.db.collection('badges')
          .find({ badgeId: { $in: badgeIds } })
          .then(metaRes => {
            const metaMap = {};
            (metaRes.result || []).forEach(m => {
              metaMap[m.badgeId] = m;
            });

            const backpack = userBadges.map(b => ({
              ...b,
              icon: metaMap[b.badgeId]?.icon || '/pages/images/default_badge.png',
              name: metaMap[b.badgeId]?.name || '徽章'
            }));

            this.setData({
              userBackpack: backpack,
              showBackpackPanel: true,
              loadingBackpack: false
            });
          });
      })
      .catch(() => {
        this.setData({ loadingBackpack: false });
        wx.showToast({ title: '加载背包失败', icon: 'none' });
      });
  },

  // 点击徽章时选中
  selectBadgeForSend(e) {
    const badgeId = e.currentTarget.dataset.badgeid;
    this.setData({
      selectedBadgeId: this.data.selectedBadgeId === badgeId ? '' : badgeId
    });
  },

  // 确认赠送（需先选中）
  confirmSendSelectedBadge() {
    if (!this.data.selectedBadgeId) {
      wx.showToast({ title: '请先选择一个徽章', icon: 'none' });
      return;
    }
    // 调用原 sendBadge 逻辑，传 selectedBadgeId
    this.sendBadge({ currentTarget: { dataset: { badgeid: this.data.selectedBadgeId } } });
  },

  sendBadge(e) {
    const badgeId = e.currentTarget.dataset.badgeid;
    const openid = this.openid;

    if (!openid) {
      wx.showToast({ title: '登录中，请稍候...', icon: 'none' });
      return;
    }

    this._executeSendBadge(badgeId);
  },

  _executeSendBadge(badgeId, nickName, avatarUrl) {
    const app = getApp();
    const openid = this.openid;

    return app.mpServerless.db.collection('user_badges')
      .findOne({ openid, badgeId })
      .then(res => {
        const current = res.result;
        if (!current || current.count <= 0) {
          wx.showToast({ title: '你没有这个徽章', icon: 'none' });
          return Promise.reject();
        }

        return Promise.all([
          app.mpServerless.db.collection('user_badges')
            .updateOne({ openid, badgeId }, { $inc: { count: -1 } }),
          app.mpServerless.db.collection('cat_gifts').insertOne({
            catId: _id,
            badgeId,
            senderOpenid: openid,
            timestamp: Date.now()
          })
        ]);
      })
      .then(() => {
        wx.showToast({ title: '赠送成功！', icon: 'success' });
        this.loadCatBadges();
        this.openBackpackPanel();

        app.mpServerless.db.collection('user_badges')
          .deleteMany({ openid, count: { $lte: 0 } });
      })
      .catch(err => {
        if (err) console.error('送礼失败:', err);
      });
  },

  goToGashapon() {
    this.closeBackpackPanel();
    wx.navigateTo({ url: '/pages/gashapon/gashapon' });
  },

  closeGiftPanel() {
    this.setData({ showGiftPanel: false });
  },

  audioPlay(e) {
    var that = this,
      id = e.currentTarget.dataset.id,
      key = e.currentTarget.dataset.key,
      audioArr = that.data.audioArr;

    audioArr.forEach((v, i, array) => {
      v.bl = false;
      if (i == key) {
        v.bl = true;
      }
    });
    that.setData({
      audioArr: audioArr,
      audKey: key,
    });

    myaudio.autoplay = true;
    var audKey = that.data.audKey,
      vidSrc = audioArr[audKey].src;
    myaudio.src = vidSrc;

    myaudio.play();

    myaudio.onPlay(() => {
      console.log('开始播放');
    });

    myaudio.onEnded(() => {
      console.log('自动播放完毕');
      audioArr[key].bl = false;
      that.setData({
        audioArr: audioArr,
      });
    });

    myaudio.onError((err) => {
      console.log(err);
      audioArr[key].bl = false;
      that.setData({
        audioArr: audioArr,
      });
      return;
    });
  },

  audioStop(e) {
    var that = this,
      key = e.currentTarget.dataset.key,
      audioArr = that.data.audioArr;

    audioArr.forEach((v, i, array) => {
      v.bl = false;
    });
    that.setData({
      audioArr: audioArr
    });

    myaudio.stop();

    myaudio.onStop(() => {
      console.log('停止播放');
    });
  },

  previewImage: function (e) {
    let that = this;
    let src = e.currentTarget.dataset.src;
    wx.previewImage({
      current: src,
      urls: [src]
    });
  },

  onShareAppMessage: function (res) {
    if (res.from === 'button') {
      console.log(res.target);
    }
    return {
      title: this.data.cat.name,
      path: '/pages/catDetail/catDetail?_id=' + this.data.cat._id,
      success: function (res) {
        console.log('转发成功');
      },
      fail: function (res) {
        console.log('转发失败');
      }
    };
  },

  onShareTimeline: function (res) {
    if (res.from === 'button') {
      console.log(res.target);
    }
    return {
      title: this.data.cat.name,
      path: '/pages/catDetail/catDetail?_id=' + this.data.cat._id,
      success: function (res) {
        console.log('转发成功');
      },
      fail: function (res) {
        console.log('转发失败');
      }
    };
  },
});

// 创建 audio 控件
const myaudio = wx.createInnerAudioContext();