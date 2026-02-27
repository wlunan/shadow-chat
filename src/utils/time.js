/**
 * 时间格式化工具
 */

/**
 * 将时间戳格式化为 HH:mm
 * @param {string|Date} timestamp - ISO 字符串或 Date 对象
 * @returns {string} HH:mm 格式
 */
export function formatTime(timestamp) {
  const date = new Date(timestamp)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * 获取相对时间描述（如 2 分钟前）
 * @param {string|Date} timestamp
 * @returns {string}
 */
export function getRelativeTime(timestamp) {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)

  if (diffSec < 60) return '刚刚'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小时前`

  return formatTime(timestamp)
}
