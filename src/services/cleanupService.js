/**
 * 数据库容量管理服务
 * 自动清理超出限制的历史消息
 * 
 * 配置:
 * - DB_LIMIT_MB: Supabase 免费版数据库限制 (200 MB)
 * - STORAGE_LIMIT_MB: Supabase 免费版存储限制 (1 GB)
 * - CLEANUP_THRESHOLD: 触发清理的容量百分比 (90%)
 * - KEEP_MESSAGES: 保留最近的消息数 (100,000)
 * - KEEP_DAYS: 保留最近多少天的消息 (90 天)
 */

import { supabase } from './supabase.js'

// 配置常量
const DB_LIMIT_MB = 200
const STORAGE_LIMIT_MB = 1024
const CLEANUP_THRESHOLD = 0.9
const KEEP_MESSAGES = 100000
const KEEP_DAYS = 90

// 状态跟踪
let lastCleanupTime = 0
const CLEANUP_INTERVAL = 60000 // 最少间隔 1 分钟

/**
 * 获取数据库使用情况
 * @returns {Promise<Object>} { usageMB, percentUsed, status }
 */
export async function checkDatabaseUsage() {
  try {
    const { data, error } = await supabase
      .rpc('get_table_size', { table_name: 'messages' })

    if (error) {
      console.error('获取数据库大小失败:', error)
      return { usageMB: 0, percentUsed: 0, status: 'error' }
    }

    // 数据库大小（返回字节）
    const sizeBytes = data || 0
    const sizeMB = sizeBytes / (1024 * 1024)

    // 计算百分比
    const percentUsed = (sizeMB / DB_LIMIT_MB) * 100

    return {
      usageMB: Math.round(sizeMB * 100) / 100,
      percentUsed: Math.round(percentUsed * 100) / 100,
      status: getCapacityStatus(percentUsed)
    }
  } catch (err) {
    console.error('检查数据库使用情况异常:', err)
    return { usageMB: 0, percentUsed: 0, status: 'error' }
  }
}

/**
 * 获取容量状态
 * @param {number} percentUsed - 使用百分比 (0-100)
 * @returns {string} 'safe' | 'warning' | 'critical'
 */
function getCapacityStatus(percentUsed) {
  if (percentUsed >= 100) return 'critical'
  if (percentUsed >= 80) return 'warning'
  return 'safe'
}

/**
 * 清理旧消息（按日期）
 * @param {number} days - 保留多少天的消息，删除更旧的
 * @returns {Promise<Object>} { deleted, error }
 */
export async function cleanupOldMessages(days = KEEP_DAYS) {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    const { data, error: deleteError } = await supabase
      .from('messages')
      .delete()
      .lt('created_at', cutoffDate.toISOString())

    if (deleteError) {
      console.error('删除旧消息失败:', deleteError)
      return { deleted: 0, error: deleteError.message }
    }

    return { deleted: data?.length || 0, error: null }
  } catch (err) {
    console.error('清理旧消息异常:', err)
    return { deleted: 0, error: err.message }
  }
}

/**
 * 仅保留最近的 N 条消息
 * 删除超过限制的较旧消息
 * @param {number} keepCount - 保留多少条消息
 * @returns {Promise<Object>} { deleted, remaining, error }
 */
export async function keepOnlyRecentMessages(keepCount = KEEP_MESSAGES) {
  try {
    // 第 1 步：获取消息总数
    const { count, error: countError } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.error('获取消息总数失败:', countError)
      return { deleted: 0, remaining: 0, error: countError.message }
    }

    const totalMessages = count || 0

    // 第 2 步：如果超过限制，删除最旧的消息
    if (totalMessages > keepCount) {
      const toDelete = totalMessages - keepCount

      // 获取要删除的消息 ID
      const { data: messagesToDelete, error: selectError } = await supabase
        .from('messages')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(toDelete)

      if (selectError) {
        console.error('获取要删除的消息失败:', selectError)
        return { deleted: 0, remaining: totalMessages, error: selectError.message }
      }

      // 删除这些消息
      if (messagesToDelete && messagesToDelete.length > 0) {
        const ids = messagesToDelete.map(msg => msg.id)

        const { error: deleteError } = await supabase
          .from('messages')
          .delete()
          .in('id', ids)

        if (deleteError) {
          console.error('删除消息失败:', deleteError)
          return { deleted: 0, remaining: totalMessages, error: deleteError.message }
        }

        return {
          deleted: toDelete,
          remaining: keepCount,
          error: null
        }
      }
    }

    return { deleted: 0, remaining: totalMessages, error: null }
  } catch (err) {
    console.error('清理消息异常:', err)
    return { deleted: 0, remaining: 0, error: err.message }
  }
}

/**
 * 自动清理（当容量超过阈值时）
 * 使用两步策略：先按日期，再按数量
 * @returns {Promise<Object>} { cleaned, status, error }
 */
export async function autoCleanup() {
  try {
    console.log('开始自动清理...')

    // 第 1 步：检查容量
    const { usageMB, percentUsed } = await checkDatabaseUsage()
    console.log(`当前使用: ${usageMB} MB (${percentUsed}%)`)

    // 第 2 步：如果未超过阈值，跳过清理
    if (percentUsed < (CLEANUP_THRESHOLD * 100)) {
      console.log('容量未超过阈值，跳过清理')
      return { cleaned: false, status: 'safe', error: null }
    }

    console.log('容量超过阈值，开始清理...')

    // 第 3 步：先删除 90 天以前的消息
    const oldResult = await cleanupOldMessages(KEEP_DAYS)
    console.log(`删除了 ${oldResult.deleted} 条旧消息`)

    // 第 4 步：再删除超过数量限制的消息
    const countResult = await keepOnlyRecentMessages(KEEP_MESSAGES)
    console.log(`清理数量限制，删除 ${countResult.deleted} 条消息，保留 ${countResult.remaining} 条`)

    // 第 5 步：再次检查容量
    const finalUsage = await checkDatabaseUsage()
    console.log(`清理后使用: ${finalUsage.usageMB} MB (${finalUsage.percentUsed}%)`)

    return {
      cleaned: true,
      status: finalUsage.status,
      deleted: oldResult.deleted + countResult.deleted,
      error: null
    }
  } catch (err) {
    console.error('自动清理异常:', err)
    return { cleaned: false, status: 'error', error: err.message }
  }
}

/**
 * 检查并清理（如果需要）
 * 防止频繁清理，添加时间间隔检查
 * @returns {Promise<Object>} { needsCleanup, result }
 */
export async function checkAndCleanupIfNeeded() {
  try {
    const now = Date.now()

    // 防止频繁清理
    if (now - lastCleanupTime < CLEANUP_INTERVAL) {
      return { needsCleanup: false, result: null }
    }

    const { percentUsed } = await checkDatabaseUsage()

    if (percentUsed >= (CLEANUP_THRESHOLD * 100)) {
      lastCleanupTime = now
      const result = await autoCleanup()
      return { needsCleanup: true, result }
    }

    return { needsCleanup: false, result: null }
  } catch (err) {
    console.error('检查清理条件异常:', err)
    return { needsCleanup: false, result: null }
  }
}

/**
 * 获取聊天统计信息
 * @returns {Promise<Object>} { messageCount, userCount, dbUsageMB, percentUsed, imageCount }
 */
export async function getStatistics() {
  try {
    // 获取消息数
    const { count: messageCount, error: msgError } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })

    if (msgError) {
      console.error('获取消息统计失败:', msgError)
      return null
    }

    // 获取用户数
    const { count: userCount, error: userError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })

    if (userError) {
      console.error('获取用户统计失败:', userError)
      // 用户表可能不存在，这是正常的
    }

    // 获取数据库大小
    const { data: sizeBytes, error: sizeError } = await supabase
      .rpc('get_table_size', { table_name: 'messages' })

    if (sizeError) {
      console.error('获取数据库大小失败:', sizeError)
    }

    const usageMB = (sizeBytes || 0) / (1024 * 1024)

    // 估算图片数（内容中包含 https:// 的消息）
    const { data: imageMessages, error: imgError } = await supabase
      .from('messages')
      .select('*', { count: 'exact' })
      .like('content', '%https://%')

    if (imgError) {
      console.error('获取图片统计失败:', imgError)
    }

    return {
      messageCount: messageCount || 0,
      userCount: userCount || 0,
      dbUsageMB: Math.round(usageMB * 100) / 100,
      percentUsed: Math.round((usageMB / DB_LIMIT_MB) * 100 * 100) / 100,
      imageCount: imageMessages?.length || 0
    }
  } catch (err) {
    console.error('获取统计信息异常:', err)
    return null
  }
}

/**
 * 获取容量监控数据（用于前端显示）
 * @returns {Promise<Object>} 监控数据
 */
export async function getCapacityMonitorData() {
  try {
    const usage = await checkDatabaseUsage()
    const stats = await getStatistics()

    return {
      database: {
        usageMB: usage.usageMB,
        limitMB: DB_LIMIT_MB,
        percentUsed: usage.percentUsed,
        status: usage.status,
        threshold: CLEANUP_THRESHOLD * 100
      },
      storage: {
        limitMB: STORAGE_LIMIT_MB,
        estimatedImageCount: stats?.imageCount || 0
      },
      statistics: stats,
      timestamp: new Date().toISOString()
    }
  } catch (err) {
    console.error('获取监控数据异常:', err)
    return null
  }
}

/**
 * 主动触发清理（手动调用）
 * @returns {Promise<Object>} 清理结果
 */
export async function manualCleanup() {
  try {
    console.log('执行手动清理...')
    lastCleanupTime = 0 // 重置时间，允许立即清理
    return await autoCleanup()
  } catch (err) {
    console.error('手动清理异常:', err)
    return { cleaned: false, status: 'error', error: err.message }
  }
}

/**
 * 获取清理配置
 * @returns {Object}
 */
export function getCleanupConfig() {
  return {
    DB_LIMIT_MB,
    STORAGE_LIMIT_MB,
    CLEANUP_THRESHOLD,
    KEEP_MESSAGES,
    KEEP_DAYS,
    CLEANUP_INTERVAL: `${CLEANUP_INTERVAL / 1000}s`
  }
}

/**
 * 初始化清理服务
 * 定期检查容量并自动清理
 * @param {number} intervalMs - 检查间隔（毫秒）
 * @returns {Function} 停止监控的函数
 */
export function initCleanupService(intervalMs = 300000) {
  // 每 5 分钟检查一次
  const intervalId = setInterval(async () => {
    try {
      await checkAndCleanupIfNeeded()
    } catch (err) {
      console.error('清理服务错误:', err)
    }
  }, intervalMs)

  // 返回停止函数
  return () => {
    clearInterval(intervalId)
    console.log('清理服务已停止')
  }
}
