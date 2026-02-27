/**
 * 聊天业务逻辑服务
 * 封装消息加载、发送、实时订阅等功能
 */
import { supabase, DEFAULT_ROOM_ID } from './supabase.js'

let subscription = null

/**
 * 简单 XSS 过滤
 * @param {string} text
 * @returns {string}
 */
function sanitizeText(text) {
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * 加载最近 150 条消息
 * @returns {Promise<Array>}
 */
export async function loadRecentMessages() {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', DEFAULT_ROOM_ID)
      .order('created_at', { ascending: false })
      .limit(150)

    if (error) {
      console.error('加载消息失败:', error)
      return []
    }

    // 反序返回（最新消息在末尾）
    return data.reverse()
  } catch (err) {
    console.error('加载消息异常:', err)
    return []
  }
}

/**
 * 加载更早的消息（懒加载）
 * @param {string} beforeTimestamp - 在此时间之前的消息
 * @param {number} limit - 加载数量，默认 150
 * @returns {Promise<Array>}
 */
export async function loadOlderMessages(beforeTimestamp, limit = 150) {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', DEFAULT_ROOM_ID)
      .lt('created_at', beforeTimestamp)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('加载历史消息失败:', error)
      return []
    }

    // 反序返回（最新消息在末尾）
    return data.reverse()
  } catch (err) {
    console.error('加载历史消息异常:', err)
    return []
  }
}

/**
 * 发送文本消息
 * @param {string} content - 消息内容
 * @param {string} userId - 用户 ID
 * @param {string} nickname - 用户昵称
 * @returns {Promise<Object>} { success, error }
 */
export async function sendTextMessage(content, userId, nickname) {
  // 验证内容
  if (!content || content.trim().length === 0) {
    return { success: false, error: '消息不能为空' }
  }

  if (content.length > 300) {
    return { success: false, error: '消息长度不能超过 300 字' }
  }

  try {
    const sanitized = sanitizeText(content.trim())

    const { error } = await supabase.from('messages').insert({
      room_id: DEFAULT_ROOM_ID,
      user_id: userId,
      nickname: nickname,
      type: 'text',
      content: sanitized
    })

    if (error) {
      console.error('发送文本消息失败:', error)
      return { success: false, error: '发送失败' }
    }

    return { success: true, error: null }
  } catch (err) {
    console.error('发送文本消息异常:', err)
    return { success: false, error: '发送异常' }
  }
}

/**
 * 发送图片消息
 * @param {string} imageUrl - 图片 URL
 * @param {number} fileSize - 文件大小（字节）
 * @param {string} userId - 用户 ID
 * @param {string} nickname - 用户昵称
 * @returns {Promise<Object>} { success, error }
 */
export async function sendImageMessage(imageUrl, fileSize, userId, nickname) {
  try {
    const { error } = await supabase.from('messages').insert({
      room_id: DEFAULT_ROOM_ID,
      user_id: userId,
      nickname: nickname,
      type: 'image',
      content: imageUrl,
      file_size: fileSize
    })

    if (error) {
      console.error('发送图片消息失败:', error)
      return { success: false, error: '发送失败' }
    }

    return { success: true, error: null }
  } catch (err) {
    console.error('发送图片消息异常:', err)
    return { success: false, error: '发送异常' }
  }
}

/**
 * 订阅新消息
 * @param {Function} callback - 接收到新消息时的回调函数
 * @returns {void}
 */
export function subscribeMessages(callback) {
  // 避免重复订阅
  if (subscription) {
    unsubscribeMessages()
  }

  try {
    console.log('🔌 开始订阅新消息...', `room_id=${DEFAULT_ROOM_ID}`)
    
    subscription = supabase
      .channel(`messages:room:${DEFAULT_ROOM_ID}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${DEFAULT_ROOM_ID}`
        },
        (payload) => {
          console.log('✅ 收到新消息:', payload.new)
          // 调用回调函数，传入新消息
          callback(payload.new)
        }
      )
      .subscribe((status) => {
        console.log('🔔 订阅状态:', status)
      })
  } catch (err) {
    console.error('❌ 订阅消息失败:', err)
  }
}

/**
 * 取消订阅
 * @returns {void}
 */
export function unsubscribeMessages() {
  if (subscription) {
    console.log('🔌 取消消息订阅')
    subscription.unsubscribe()
    subscription = null
  }
}
