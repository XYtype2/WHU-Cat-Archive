// index.js - deleteImage 云函数
const COS = require('cos-nodejs-sdk-v5');

const BUCKET = 'whutnr-1311545081';
const REGION = 'ap-guangzhou';
const SECRET_ID = process.env.TENCENT_SECRET_ID || process.env.COS_SECRET_ID || '';
const SECRET_KEY = process.env.TENCENT_SECRET_KEY || process.env.COS_SECRET_KEY || '';

const cos = new COS({
  SecretId: SECRET_ID,
  SecretKey: SECRET_KEY
});

function isSafeFileName(fileName) {
  if (typeof fileName !== 'string' || !fileName) return false;
  if (fileName.length > 120) return false;
  if (fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) return false;
  return /\.(jpg|jpeg|png)$/i.test(fileName);
}

function isSafeCatName(catName) {
  if (typeof catName !== 'string' || !catName.trim()) return false;
  if (catName.length > 100) return false;
  if (catName.includes('/') || catName.includes('\\') || catName.includes('..')) return false;
  return true;
}

function deleteObject(Key) {
  return new Promise((resolve, reject) => {
    cos.deleteObject({ Bucket: BUCKET, Region: REGION, Key }, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(data);
    });
  });
}

function isNotFoundError(err) {
  if (!err) return false;
  const code = String(err.code || '');
  const message = String(err.message || '');
  return (
    code === 'NoSuchKey' ||
    code === 'NotFound' ||
    code === 'ResourceNotFound' ||
    message.includes('NoSuchKey') ||
    message.includes('Not Found') ||
    message.includes('404')
  );
}

async function deleteObjectSafe(Key) {
  try {
    await deleteObject(Key);
    return { ok: true, skipped: false };
  } catch (err) {
    if (isNotFoundError(err)) {
      return { ok: true, skipped: true };
    }
    throw err;
  }
}

function copyObject({ sourceKey, targetKey }) {
  const copySource = `${BUCKET}.cos.${REGION}.myqcloud.com/${encodeURI(sourceKey)}`;
  return new Promise((resolve, reject) => {
    cos.putObjectCopy({
      Bucket: BUCKET,
      Region: REGION,
      Key: targetKey,
      CopySource: copySource
    }, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(data);
    });
  });
}

async function copyObjectSafe({ sourceKey, targetKey }) {
  try {
    await copyObject({ sourceKey, targetKey });
    return { ok: true, skipped: false };
  } catch (err) {
    if (isNotFoundError(err)) {
      return { ok: true, skipped: true };
    }
    throw err;
  }
}

module.exports = async (ctx) => {
  try {
    if (!SECRET_ID || !SECRET_KEY) {
      return {
        success: false,
        error: 'Missing COS secrets in environment variables'
      };
    }

    console.log('【deleteImage 开始执行】收到参数:', !!ctx.args);
    const { fileName, catName, indexToDelete, currentCount } = ctx.args || {};
    const warnings = [];

    // 1) 兼容旧调用：直接按 fileName 删除
    if (fileName) {
      if (!isSafeFileName(fileName)) {
        console.log('【错误】非法文件名:', fileName);
        return { success: false, error: 'Invalid file name' };
      }

      const key = `picture/${fileName}`;
      console.log('【准备删除】Key:', key);
      const deleted = await deleteObjectSafe(key);
      if (deleted.skipped) {
        warnings.push('File not found, skip delete');
      } else {
        console.log('【删除成功】', key);
      }
      return { success: true, warnings };
    }

    // 2) 新调用：删除附加图并自动重排，如 name2.jpg 删除后，name3.jpg -> name2.jpg
    if (!isSafeCatName(catName)) {
      console.log('【错误】非法 catName:', catName);
      return { success: false, error: 'Invalid catName' };
    }

    const deleteIndex = Number(indexToDelete);
    const totalCount = Number(currentCount);

    if (
      !Number.isInteger(deleteIndex) ||
      !Number.isInteger(totalCount) ||
      deleteIndex < 1 ||
      totalCount < 1 ||
      deleteIndex > totalCount
    ) {
      return { success: false, error: 'Invalid indexToDelete/currentCount' };
    }

    // 先确保用户指定删除的那张一定被删除，避免“只改编号不删图”
    const selectedKey = `picture/${catName}${deleteIndex}.jpg`;
    console.log('【删除指定图】', selectedKey);
    const selectedDeleted = await deleteObjectSafe(selectedKey);
    if (selectedDeleted.skipped) {
      warnings.push(`Selected file not found: ${selectedKey}`);
    }

    // 再把后面的图前移，并删除原 source，避免残留重复图
    for (let i = deleteIndex + 1; i <= totalCount; i++) {
      const sourceKey = `picture/${catName}${i}.jpg`;
      const targetKey = `picture/${catName}${i - 1}.jpg`;
      console.log(`【重排复制】${sourceKey} -> ${targetKey}`);
      const copied = await copyObjectSafe({ sourceKey, targetKey });
      if (copied.skipped) {
        warnings.push(`Missing source file: ${sourceKey}`);
        continue;
      }
      const sourceDeleted = await deleteObjectSafe(sourceKey);
      if (sourceDeleted.skipped) {
        warnings.push(`Source already removed: ${sourceKey}`);
      }
    }

    return {
      success: true,
      newCount: totalCount - 1,
      warnings
    };

  } catch (err) {
    console.error('【deleteImage 异常】', err.message, err.stack);
    return { 
      success: false,
      error: 'Delete failed',
      message: err.message 
    };
  }
};
