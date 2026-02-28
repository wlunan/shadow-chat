/**
 * 图片压缩服务
 * 将图片转换为 WebP/JPEG 格式并压缩
 */

/**
 * 检查浏览器是否支持 WebP
 */
function supportsWebP() {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  return canvas.toDataURL('image/webp').includes('webp')
}

/**
 * 压缩图片
 * @param {File} file - 原始文件
 * @param {number} maxWidth - 最大宽度（像素），默认 1920
 * @param {number} maxHeight - 最大高度（像素），默认 1920
 * @param {number} quality - 压缩质量（0-1），默认 0.8
 * @returns {Promise<{blob: Blob, format: string}>} 压缩后的 blob 和格式
 */
export async function compressImage(file, maxWidth = 1920, maxHeight = 1920, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const img = new Image()

      img.onload = () => {
        // 计算缩放比例
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height)
            height = maxHeight
          }
        }

        // 创建 Canvas
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        // 选择输出格式
        const format = supportsWebP() ? 'image/webp' : 'image/jpeg'

        // 转换为 Blob
        canvas.toBlob(
          (blob) => {
            resolve({
              blob,
              format,
              originalSize: file.size,
              compressedSize: blob.size,
              compressionRatio: ((1 - blob.size / file.size) * 100).toFixed(2)
            })
          },
          format,
          quality
        )
      }

      img.onerror = () => {
        reject(new Error('图片加载失败'))
      }

      img.src = e.target.result
    }

    reader.onerror = () => {
      reject(new Error('文件读取失败'))
    }

    reader.readAsDataURL(file)
  })
}

/**
 * 获取合适的文件名后缀
 */
export function getFileExtension(format) {
  return format === 'image/webp' ? 'webp' : 'jpg'
}
