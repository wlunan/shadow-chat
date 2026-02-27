/**
 * 用户身份管理
 * 首次打开应用自动生成 UUID 和随机昵称，存储在 localStorage
 */

const USER_STORAGE_KEY = 'shadow_chat_user'

/**
 * 初始化用户
 * @returns {Object} { id, nickname }
 */
export function initUser() {
  const stored = localStorage.getItem(USER_STORAGE_KEY)

  if (stored) {
    return JSON.parse(stored)
  }

  // 生成新用户
  const user = {
    id: crypto.randomUUID(),
    nickname: generateRandomNickname()
  }

  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
  return user
}

/**
 * 获取当前用户
 * @returns {Object} { id, nickname }
 */
export function getCurrentUser() {
  const stored = localStorage.getItem(USER_STORAGE_KEY)
  if (!stored) {
    return initUser()
  }
  return JSON.parse(stored)
}

/**
 * 生成随机昵称
 * 格式: 用户 + 4 位随机数字
 * @returns {string}
 */
function generateRandomNickname() {
  const randomNum = Math.floor(Math.random() * 10000)
  return `用户${randomNum}`
}

/**
 * 重置用户（仅用于开发测试）
 */
export function resetUser() {
  localStorage.removeItem(USER_STORAGE_KEY)
  return initUser()
}
