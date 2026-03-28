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

function buildFileUrl(fileName) {
  return `https://${BUCKET}.cos.${REGION}.myqcloud.com/picture/${encodeURIComponent(fileName)}`;
}

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
    console.log('【deleteImage 开始执行】收到参数:', !!ctx.args);
    const { fileName, catName, indexToDelete, currentCount } = ctx.args || {};
    const warnings = [];
    const deleteIndex = Number(indexToDelete);
    const totalCount = Number(currentCount);

    // 无 COS 密钥时，至少支持“按 fileName 删除单图”（用于客户端兜底后的尾图清理）
    if (!SECRET_ID || !SECRET_KEY) {
      if (fileName) {
        if (!isSafeFileName(fileName)) {
          return { success: false, error: 'Invalid file name' };
        }
        const fileApi = ctx && ctx.mpserverless && ctx.mpserverless.file;
        if (!fileApi || typeof fileApi.deleteFile !== 'function') {
          return { success: false, error: 'Missing COS secrets in environment variables' };
        }
        const filePathUrl = buildFileUrl(fileName);
        await fileApi.deleteFile(filePathUrl);
        return { success: true, warnings: ['Deleted via ctx.mpserverless.file.deleteFile'] };
      }
      return {
        success: false,
        error: 'Missing COS secrets in environment variables'
      };
    }

    // 1) 新调用优先：删除附加图并自动重排，如 name2.jpg 删除后，name3.jpg -> name2.jpg
    const canReindex =
      isSafeCatName(catName) &&
      Number.isInteger(deleteIndex) &&
      Number.isInteger(totalCount) &&
      deleteIndex >= 1 &&
      totalCount >= 1 &&
      deleteIndex <= totalCount;

    if (canReindex) {
      const selectedKey = `picture/${catName}${deleteIndex}.jpg`;
      console.log('【删除指定图】', selectedKey);
      const selectedDeleted = await deleteObjectSafe(selectedKey);
      if (selectedDeleted.skipped) {
        warnings.push(`Selected file not found: ${selectedKey}`);
      }

      // 把后续图片整体前移并删除原图，保证编号连续
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
    }

    // 2) 兼容旧调用：仅按 fileName 删除（不重排）
    if (fileName) {
      if (!isSafeFileName(fileName)) {
        console.log('【错误】非法文件名:', fileName);
        return { success: false, error: 'Invalid file name' };
      }

      const key = `picture/${fileName}`;
      console.log('【准备删除（旧模式）】Key:', key);
      const deleted = await deleteObjectSafe(key);
      if (deleted.skipped) {
        warnings.push('File not found, skip delete');
      } else {
        console.log('【删除成功（旧模式）】', key);
      }
      return { success: true, warnings };
    }

    return {
      success: false,
      error: 'Missing required parameters'
    };

  } catch (err) {
    console.error('【deleteImage 异常】', err.message, err.stack);
    const detail = `${err && err.code ? `[${err.code}] ` : ''}${err && err.message ? err.message : ''}`.trim();
    return { 
      success: false,
      error: 'Delete failed',
      message: detail || 'Delete failed'
    };
  }
};
