//app.js
import MPServerless from '@alicloud/mpserverless-sdk';
const mpServerless = new MPServerless({
  uploadFile: wx.uploadFile,
  request: wx.request,
  getAuthCode: wx.login,
  getFileInfo: wx.getFileInfo,
  getImageInfo: wx.getImageInfo,
}, {
  appId: 'wx653eb5aab59d0f19', // 小程序应用标识
  spaceId: 'mp-52090e7c-a0fe-4bc1-87ec-0ae1a4902d93', // 服务空间标识
  clientSecret: 'KVBTDI/0fd4D+4XyHmHsVw==', // 服务空间 secret key
  endpoint: 'https://api.next.bspapp.com', // 服务空间地址，从小程序 serverless 控制台处获得
});

App({
  onLaunch: async function () {

    if (wx.canIUse('getUpdateManager')) {
      const updateManager = wx.getUpdateManager()
      updateManager.onCheckForUpdate(function (res) {
        if (res.hasUpdate) {
          updateManager.onUpdateReady(function () {
            wx.showModal({
              title: '更新提示',
              content: '新版本已经准备好，是否重启应用？',
              success: function (res) {
                if (res.confirm) {
                  updateManager.applyUpdate()
                }
              }
            })
          })
          updateManager.onUpdateFailed(function () {
            wx.showModal({
              title: '已经有新版本了哟~',
              content: '新版本已经上线啦~，请您删除当前小程序，重新搜索打开哟~'
            })
          })
        }
      })
    } else {
      wx.showModal({
        title: '提示',
        content: '当前微信版本过低，无法使用该功能，请升级到最新微信版本后重试。'
      })
    }

    await mpServerless.user.authorize({
      authProvider: 'wechat_openapi',
    });

  },

  globalData: {
    isAdministrator: false,
    Administrator: undefined,
    url: "https://whutnr-1311545081.cos.ap-guangzhou.myqcloud.com/picture/",
  },
  mpServerless
})

wx.showShareMenu({
  withShareTicket: true
})

wx.setInnerAudioOption({
  obeyMuteSwitch: false
});

