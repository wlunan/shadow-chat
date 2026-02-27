/**
 * 图片上传服务
 * 封装 Supabase Storage 相关操作
 */
import { supabase } from './supabase.js'

const BUCKET_NAME = 'chat-images'
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_SIZE = 1024 * 1024 // 1MB

/**
 * 验证图片文件
 * @param {File} file
 * @returns {Object} { valid, error }
 */
function validateImage(file) {
  if (!file) {
    return { valid: false, error: '文件不存在' }
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: '不支持的图片格式。支持: PNG、JPEG、WebP' }
  }

  if (file.size > MAX_SIZE) {
    return { valid: false, error: '图片过大。最大大小: 1MB' }
  }

  return { valid: true, error: null }
}

/**
 * 上传图片到 Supabase Storage
 * @param {File} file - 图片文件
 * @param {string} userId - 用户 ID
 * @returns {Promise<Object>} { url, fileSize, error }
 */
export async function uploadImage(file, userId) {
  // 验证文件
  const validation = validateImage(file)
  if (!validation.valid) {
    return {
      url: null,
      fileSize: null,
      error: validation.error
    }
  }

  try {
    // 生成上传路径: userId/timestamp_filename
    const timestamp = Date.now()
    const fileName = `${timestamp}_${file.name}`
    const filePath = `${userId}/${fileName}`

    // 上传文件
    const { data, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('图片上传失败:', uploadError)
      return {
        url: null,
        fileSize: null,
        error: '图片上传失败'
      }
    }

    // 获取公开 URL
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath)

    return {
      url: publicUrlData.publicUrl,
      fileSize: file.size,
      error: null
    }
  } catch (err) {
    console.error('上传图片异常:', err)
    return {
      url: null,
      fileSize: null,
      error: '上传图片异常'
    }
  }
}
