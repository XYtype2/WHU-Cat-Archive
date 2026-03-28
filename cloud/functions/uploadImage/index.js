// index.js - 强化版
const COS = require('cos-nodejs-sdk-v5');
const SECRET_ID = process.env.TENCENT_SECRET_ID || process.env.COS_SECRET_ID || '';
const SECRET_KEY = process.env.TENCENT_SECRET_KEY || process.env.COS_SECRET_KEY || '';

const cos = new COS({
  SecretId: SECRET_ID,
  SecretKey: SECRET_KEY
});

module.exports = async (ctx) => {
  try {
    if (!SECRET_ID || !SECRET_KEY) {
      return { error: 'Missing COS secrets in environment variables' };
    }

    console.log('【开始执行】收到参数:', !!ctx.args); // 检查是否有 args

    const { fileName, base64Data } = ctx.args || {};

    if (!fileName || !base64Data) { 
      console.log('【参数缺失】', { fileName, base64Data });
      return { error: 'Missing fileName or base64Data' };
    }

    console.log('【参数正常】fileName:', fileName, 'base64 length:', base64Data.length);

    let cleanBase64 = base64Data;
    if (base64Data.startsWith('data:')) {
      const commaIndex = base64Data.indexOf(',');
      if (commaIndex !== -1) {
        cleanBase64 = base64Data.substring(commaIndex + 1);
      }
    }

    // 检查 base64 长度是否合理
    if (cleanBase64.length < 100) {
      return { error: 'Base64 data too short' };
    }

    console.log('【开始转 Buffer】');
    const buffer = Buffer.from(cleanBase64, 'base64');
    console.log('【Buffer 大小】', buffer.length, 'bytes');

    let contentType = 'image/jpeg';
    if (fileName.endsWith('.png')) contentType = 'image/png';
    else if (fileName.endsWith('.gif')) contentType = 'image/gif';

    console.log('【开始上传 COS】');
    await cos.putObject({
      Bucket: 'whutnr-1311545081',
      Region: 'ap-guangzhou',
      Key: `picture/${fileName}`,
      Body: buffer,
      ContentType: contentType
    });

    console.log('【上传成功】生成 URL');
    const url = `https://whutnr-1311545081.cos.ap-guangzhou.myqcloud.com/picture/${encodeURIComponent(fileName)}`;
    return { url };

  } catch (err) {
    console.error('【云函数异常】', err.message, err.stack);
    return { 
      error: 'Upload failed',
      message: err.message 
    };
  }
};
