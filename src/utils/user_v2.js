/**
 * 用户身份管理 - 支持昵称修改
 * 支持用户表和本地存储双向同步
 */

import { supabase } from '../services/supabase.js'

const USER_STORAGE_KEY = 'shadow_chat_user'

/**
 * 初始化用户
 * 流程：先查本地存储 → 再查数据库 → 生成新用户
 * @returns {Object} { id, nickname }
 */
export async function initUser() {
  // 第 1 步：检查本地存储
  const stored = localStorage.getItem(USER_STORAGE_KEY)
  if (stored) {
    return JSON.parse(stored)
  }

  // 第 2 步：生成新用户
  const user = {
    id: crypto.randomUUID(),
    nickname: generateRandomNickname()
  }

  // 第 3 步：保存到数据库和本地
  await saveUserToDatabase(user)
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
 * 保存用户到数据库
 * @param {Object} user - 用户对象 { id, nickname }
 * @returns {Promise<Object>} { success, error }
 */
export async function saveUserToDatabase(user) {
  try {
    const { error } = await supabase
      .from('users')
      .upsert(
        { id: user.id, nickname: user.nickname },
        { onConflict: 'id' }
      )

    if (error) {
      console.error('保存用户到数据库失败:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    console.error('保存用户到数据库异常:', err)
    return { success: false, error: err.message }
  }
}

/**
 * 更新用户昵称
 * 同时更新数据库和本地存储
 * @param {string} userId - 用户 ID
 * @param {string} newNickname - 新昵称
 * @returns {Promise<Object>} { success, nickname, error }
 */
export async function updateNickname(userId, newNickname) {
  try {
    // 第 1 步：验证输入
    if (!newNickname || newNickname.trim().length === 0) {
      return { success: false, error: '昵称不能为空' }
    }

    if (newNickname.length > 20) {
      return { success: false, error: '昵称最多 20 字' }
    }

    const trimmed = newNickname.trim()

    // 第 2 步：更新数据库
    const { error } = await supabase
      .from('users')
      .update({ nickname: trimmed })
      .eq('id', userId)

    if (error) {
      console.error('更新昵称失败:', error)
      return { success: false, error: '更新失败' }
    }

    // 第 3 步：更新本地存储
    const user = getCurrentUser()
    user.nickname = trimmed
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))

    return { success: true, nickname: trimmed }
  } catch (err) {
    console.error('更新昵称异常:', err)
    return { success: false, error: '更新异常' }
  }
}

/**
 * 从数据库获取用户信息
 * @param {string} userId - 用户 ID
 * @returns {Promise<Object>} 用户信息或 null
 */
export async function getUserFromDatabase(userId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = 未找到记录，这是正常的
      console.error('获取用户信息失败:', error)
      return null
    }

    return data
  } catch (err) {
    console.error('获取用户信息异常:', err)
    return null
  }
}

/**
 * 同步本地用户到数据库
 * 用于恢复本地存储中的用户到数据库
 * @returns {Promise<Object>} { success, error }
 */
export async function syncLocalUserToDatabase() {
  try {
    const user = getCurrentUser()
    const dbUser = await getUserFromDatabase(user.id)

    if (!dbUser) {
      // 用户不在数据库中，保存
      return await saveUserToDatabase(user)
    }

    return { success: true }
  } catch (err) {
    console.error('同步用户失败:', err)
    return { success: false, error: err.message }
  }
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
 * 清除本地存储和数据库中的用户信息
 * @returns {Promise<Object>} 新生成的用户
 */
export async function resetUser() {
  try {
    localStorage.removeItem(USER_STORAGE_KEY)
    // 注意：不删除数据库中的用户，只删除本地存储
    // 如需完全删除，需要手动在 Supabase 中删除
  } catch (err) {
    console.error('重置用户失败:', err)
  }
  return initUser()
}

/**
 * 验证昵称格式
 * @param {string} nickname - 昵称
 * @returns {Object} { valid, error }
 */
export function validateNickname(nickname) {
  if (!nickname || nickname.trim().length === 0) {
    return { valid: false, error: '昵称不能为空' }
  }

  if (nickname.length > 20) {
    return { valid: false, error: '昵称最多 20 字' }
  }

  if (nickname.includes('<') || nickname.includes('>')) {
    return { valid: false, error: '昵称不能包含 < 或 >' }
  }

  return { valid: true, error: null }
}

/**
 * 获取用户显示名
 * @param {Object} user - 用户对象
 * @returns {string} 显示名
 */
export function getUserDisplayName(user) {
  return user?.nickname || '匿名用户'
}

/**
 * 检查用户是否已初始化
 * @returns {boolean}
 */
export function isUserInitialized() {
  return localStorage.getItem(USER_STORAGE_KEY) !== null
}

/**
 * 获取用户初始化状态
 * @returns {Object} { initialized, user, error }
 */
export function getUserStatus() {
  try {
    const initialized = isUserInitialized()
    const user = initialized ? getCurrentUser() : null

    return {
      initialized,
      user,
      error: null
    }
  } catch (err) {
    return {
      initialized: false,
      user: null,
      error: err.message
    }
  }
}
