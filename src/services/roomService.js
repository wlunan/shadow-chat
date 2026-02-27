/**
 * 聊天室管理服务
 * 支持创建、加入、删除、查询聊天室
 * - 公共聊天室最多 10 个
 * - 每个用户最多加入 3 个聊天室
 */

import { supabase } from './supabase.js'

const MAX_TOTAL_ROOMS = 10      // 公共聊天室总数限制
const MAX_USER_ROOMS = 3        // 每个用户最多加入的房间数

/**
 * 获取当前用户的聊天室列表
 * @param {string} userId - 用户 ID
 * @returns {Promise<Array>}
 */
export async function getUserRooms(userId) {
  try {
    const { data, error } = await supabase
      .from('user_rooms')
      .select('room:rooms(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('获取用户聊天室失败:', error)
      return []
    }

    return data.map(item => item.room).filter(Boolean)
  } catch (err) {
    console.error('获取用户聊天室异常:', err)
    return []
  }
}

/**
 * 创建新聊天室
 * @param {string} userId - 创建者 ID
 * @param {string} roomName - 聊天室名称
 * @param {string} description - 聊天室描述（可选）
 * @returns {Promise<Object>} { success, roomId, error }
 */
export async function createRoom(userId, roomName, description = '') {
  try {
    // 验证输入
    if (!roomName || roomName.trim().length === 0) {
      return { success: false, error: '聊天室名称不能为空' }
    }

    if (roomName.length > 50) {
      return { success: false, error: '聊天室名称最多 50 字' }
    }

    // 检查公共聊天室总数限制
    const { data: allRooms, error: countError } = await supabase
      .from('rooms')
      .select('id')
      .eq('is_public', true)

    if (countError || allRooms.length >= MAX_TOTAL_ROOMS) {
      return { success: false, error: `公共聊天室已满（最多 ${MAX_TOTAL_ROOMS} 个）` }
    }

    // 检查用户是否已达到加入房间数量限制
    const userRooms = await getUserRooms(userId)
    if (userRooms.length >= MAX_USER_ROOMS) {
      return { success: false, error: `最多只能加入 ${MAX_USER_ROOMS} 个聊天室` }
    }

    // 创建聊天室
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .insert({
        name: roomName.trim(),
        description: description.trim(),
        creator_id: userId
      })
      .select()
      .single()

    if (roomError) {
      console.error('创建聊天室失败:', roomError)
      return { success: false, error: '创建失败' }
    }

    // 自动加入聊天室
    const { error: joinError } = await supabase
      .from('user_rooms')
      .insert({
        user_id: userId,
        room_id: roomData.id
      })

    if (joinError) {
      console.error('加入聊天室失败:', joinError)
      return { success: false, error: '加入失败' }
    }

    return { success: true, roomId: roomData.id, room: roomData }
  } catch (err) {
    console.error('创建聊天室异常:', err)
    return { success: false, error: '创建异常' }
  }
}

/**
 * 加入聊天室
 * @param {string} userId - 用户 ID
 * @param {number} roomId - 聊天室 ID
 * @returns {Promise<Object>} { success, error }
 */
export async function joinRoom(userId, roomId) {
  try {
    // 检查用户是否已加入
    const { data: existing } = await supabase
      .from('user_rooms')
      .select('id')
      .eq('user_id', userId)
      .eq('room_id', roomId)
      .single()

    if (existing) {
      return { success: false, error: '已经加入过这个聊天室' }
    }

    // 检查用户房间数量
    const userRooms = await getUserRooms(userId)
    if (userRooms.length >= MAX_USER_ROOMS) {
      return { success: false, error: `最多只能加入 ${MAX_USER_ROOMS} 个聊天室` }
    }

    // 加入聊天室
    const { error } = await supabase
      .from('user_rooms')
      .insert({
        user_id: userId,
        room_id: roomId
      })

    if (error) {
      console.error('加入聊天室失败:', error)
      return { success: false, error: '加入失败' }
    }

    return { success: true }
  } catch (err) {
    console.error('加入聊天室异常:', err)
    return { success: false, error: '加入异常' }
  }
}

/**
 * 离开聊天室
 * @param {string} userId - 用户 ID
 * @param {number} roomId - 聊天室 ID
 * @returns {Promise<Object>} { success, error }
 */
export async function leaveRoom(userId, roomId) {
  try {
    // 防止离开最后一个房间（可选）
    // 移除这个检查允许用户离开所有房间

    const { error } = await supabase
      .from('user_rooms')
      .delete()
      .eq('user_id', userId)
      .eq('room_id', roomId)

    if (error) {
      console.error('离开聊天室失败:', error)
      return { success: false, error: '离开失败' }
    }

    return { success: true }
  } catch (err) {
    console.error('离开聊天室异常:', err)
    return { success: false, error: '离开异常' }
  }
}

/**
 * 删除聊天室（仅创建者可删除）
 * @param {string} userId - 用户 ID
 * @param {number} roomId - 聊天室 ID
 * @returns {Promise<Object>} { success, error }
 */
export async function deleteRoom(userId, roomId) {
  try {
    // 验证用户是否是创建者
    const { data: room, error: fetchError } = await supabase
      .from('rooms')
      .select('creator_id')
      .eq('id', roomId)
      .single()

    if (fetchError || !room) {
      return { success: false, error: '聊天室不存在' }
    }

    if (room.creator_id !== userId) {
      return { success: false, error: '只有创建者才能删除聊天室' }
    }

    // 删除聊天室（级联删除相关数据）
    const { error } = await supabase
      .from('rooms')
      .delete()
      .eq('id', roomId)

    if (error) {
      console.error('删除聊天室失败:', error)
      return { success: false, error: '删除失败' }
    }

    return { success: true }
  } catch (err) {
    console.error('删除聊天室异常:', err)
    return { success: false, error: '删除异常' }
  }
}

/**
 * 获取所有公开聊天室（用于浏览和加入）
 * @returns {Promise<Array>}
 */
export async function getPublicRooms() {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('获取公开聊天室失败:', error)
      return []
    }

    return data || []
  } catch (err) {
    console.error('获取公开聊天室异常:', err)
    return []
  }
}

/**
 * 获取聊天室详情
 * @param {number} roomId - 聊天室 ID
 * @returns {Promise<Object>}
 */
export async function getRoomDetails(roomId) {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single()

    if (error) {
      console.error('获取聊天室详情失败:', error)
      return null
    }

    return data
  } catch (err) {
    console.error('获取聊天室详情异常:', err)
    return null
  }
}

/**
 * 更新聊天室信息
 * @param {number} roomId - 聊天室 ID
 * @param {string} userId - 用户 ID（验证权限）
 * @param {Object} updates - 更新内容 { name, description, is_public }
 * @returns {Promise<Object>} { success, error }
 */
export async function updateRoom(roomId, userId, updates) {
  try {
    // 验证权限
    const { data: room, error: fetchError } = await supabase
      .from('rooms')
      .select('creator_id')
      .eq('id', roomId)
      .single()

    if (fetchError || !room) {
      return { success: false, error: '聊天室不存在' }
    }

    if (room.creator_id !== userId) {
      return { success: false, error: '只有创建者才能修改聊天室' }
    }

    // 更新聊天室
    const { error } = await supabase
      .from('rooms')
      .update(updates)
      .eq('id', roomId)

    if (error) {
      console.error('更新聊天室失败:', error)
      return { success: false, error: '更新失败' }
    }

    return { success: true }
  } catch (err) {
    console.error('更新聊天室异常:', err)
    return { success: false, error: '更新异常' }
  }
}

/**
 * 获取聊天室成员数量
 * @param {number} roomId - 聊天室 ID
 * @returns {Promise<number>}
 */
export async function getRoomMemberCount(roomId) {
  try {
    const { count, error } = await supabase
      .from('user_rooms')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId)

    if (error) {
      console.error('获取房间成员数失败:', error)
      return 0
    }

    return count || 0
  } catch (err) {
    console.error('获取房间成员数异常:', err)
    return 0
  }
}
