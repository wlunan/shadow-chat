/**
 * 媒体上传服务
 * 支持图片上传（自动压缩）和视频上传
 */
import { supabase } from './supabase.js'
import { compressImage, getFileExtension } from './imageCompress.js'

const BUCKET_NAME = 'chat-images'
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
const MAX_IMAGE_SIZE = 3 * 1024 * 1024 // 3MB
const MAX_VIDEO_SIZE = 10 * 1024 * 1024 // 10MB

/**
 * 生成安全的文件名（去掉特殊字符）
 */
function generateSafeFileName(file) {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(7)
  
  // 获取文件扩展名
  let ext = 'bin'
  if (file.name.includes('.')) {
    const parts = file.name.split('.')
    ext = parts[parts.length - 1].toLowerCase()
    // 只允许字母数字
    ext = ext.replace(/[^a-z0-9]/g, '')
  }
  
  return `${timestamp}_${random}.${ext}`
}

/**
 * 验证媒体文件
 * @param {File} file
 * @returns {Object} { valid, error, type }
 */
function validateMedia(file) {
  if (!file) {
    return { valid: false, error: '文件不存在', type: null }
  }

  let type = null
  if (IMAGE_TYPES.includes(file.type)) {
    type = 'image'
    if (file.size > MAX_IMAGE_SIZE) {
      return { valid: false, error: '图片过大。最大大小: 3MB', type }
    }
  } else if (VIDEO_TYPES.includes(file.type)) {
    type = 'video'
    if (file.size > MAX_VIDEO_SIZE) {
      return { valid: false, error: '视频过大。最大大小: 10MB', type }
    }
  } else {
    return { valid: false, error: '不支持的文件格式。支持: 图片（PNG、JPEG、WebP）、视频（MP4、WebM、MOV）', type }
  }

  return { valid: true, error: null, type }
}

/**
 * 上传图片到 Supabase Storage（自动压缩）
 * @param {File} file - 图片文件
 * @param {string} userId - 用户 ID
 * @returns {Promise<Object>} { url, fileSize, mediaType, error }
 */
export async function uploadImage(file, userId) {
  // 验证文件
  const validation = validateMedia(file)
  if (!validation.valid) {
    return {
      url: null,
      fileSize: null,
      mediaType: 'image',
      error: validation.error
    }
  }

  if (validation.type !== 'image') {
    return {
      url: null,
      fileSize: null,
      mediaType: 'image',
      error: '请选择图片文件'
    }
  }

  try {
    // 压缩图片
    let compressResult
    try {
      compressResult = await compressImage(file)
      console.log(`📸 图片压缩: ${(compressResult.originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressResult.compressedSize / 1024 / 1024).toFixed(2)}MB (${compressResult.compressionRatio}%)`)
    } catch (err) {
      console.warn('图片压缩失败，使用原文件:', err)
      compressResult = {
        blob: file,
        format: file.type,
        originalSize: file.size,
        compressedSize: file.size
      }
    }

    // 生成上传路径
    const timestamp = Date.now()
    const extension = getFileExtension(compressResult.format)
    const fileName = `${timestamp}_${Math.random().toString(36).substring(7)}.${extension}`
    const filePath = `${userId}/${fileName}`

    // 上传压缩后的文件
    const { data, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, compressResult.blob, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('图片上传失败:', uploadError)
      return {
        url: null,
        fileSize: null,
        mediaType: 'image',
        error: '图片上传失败'
      }
    }

    // 获取公开 URL
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath)

    return {
      url: publicUrlData.publicUrl,
      fileSize: compressResult.compressedSize,
      mediaType: 'image',
      error: null
    }
  } catch (err) {
    console.error('上传图片异常:', err)
    return {
      url: null,
      fileSize: null,
      mediaType: 'image',
      error: '上传图片异常'
    }
  }
}

/**
 * 上传视频到 Supabase Storage
 * @param {File} file - 视频文件
 * @param {string} userId - 用户 ID
 * @returns {Promise<Object>} { url, fileSize, mediaType, error }
 */
export async function uploadVideo(file, userId) {
  // 验证文件
  const validation = validateMedia(file)
  if (!validation.valid) {
    return {
      url: null,
      fileSize: null,
      mediaType: 'video',
      error: validation.error
    }
  }

  if (validation.type !== 'video') {
    return {
      url: null,
      fileSize: null,
      mediaType: 'video',
      error: '请选择视频文件'
    }
  }

  try {
    // 生成安全的上传路径（去掉特殊字符）
    const fileName = generateSafeFileName(file)
    const filePath = `${userId}/${fileName}`

    // 上传文件
    const { data, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('视频上传失败:', uploadError)
      return {
        url: null,
        fileSize: null,
        mediaType: 'video',
        error: '视频上传失败'
      }
    }

    // 获取公开 URL
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath)

    return {
      url: publicUrlData.publicUrl,
      fileSize: file.size,
      mediaType: 'video',
      error: null
    }
  } catch (err) {
    console.error('上传视频异常:', err)
    return {
      url: null,
      fileSize: null,
      mediaType: 'video',
      error: '上传视频异常'
    }
  }
}
