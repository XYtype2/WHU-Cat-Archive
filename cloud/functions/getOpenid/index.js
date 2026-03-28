const axios = require('axios'); // 阿里云 Node.js 环境自带 axios

module.exports = async (ctx) => {
  const { code } = ctx.body;
  if (!code) {
    return { success: false, error: '缺少 code 参数' };
  }

  const APPID = process.env.WECHAT_APPID;
  const APPSECRET = process.env.WECHAT_SECRET;

  try {
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${APPID}&secret=${APPSECRET}&js_code=${code}&grant_type=authorization_code`;
    const response = await axios.get(url);
    const data = response.data;

    if (data.errcode) {
      return { success: false, error: data.errmsg || '微信返回错误' };
    }

    return { success: true, openid: data.openid };
  } catch (err) {
    return { success: false, error: err.message || '网络请求失败' };
  }
};