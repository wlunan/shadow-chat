<template>
  <div class="room-selector">
    <!-- 当前房间显示 -->
    <div class="current-room">
      <span class="room-name">{{ currentRoom?.name || '未选择房间' }}</span>
      <button class="btn-menu" @click="togglePanel" title="管理聊天室">
        {{ showPanel ? '✕' : '☰' }}
      </button>
    </div>

    <!-- 房间管理面板 -->
    <div v-if="showPanel" class="room-panel">
      <!-- 标签页 -->
      <div class="panel-tabs">
        <button
          :class="{ active: activeTab === 'my-rooms' }"
          @click="activeTab = 'my-rooms'"
          class="tab-btn"
        >
          📋 我的房间 ({{ myRooms.length }}/{{ MAX_USER_ROOMS }})
        </button>
        <button
          :class="{ active: activeTab === 'public' }"
          @click="activeTab = 'public'"
          class="tab-btn"
        >
          🌐 公开房间
        </button>
      </div>

      <!-- 标签页内容 -->
      <div class="panel-content">
        <!-- 我的房间 -->
        <div v-if="activeTab === 'my-rooms'" class="tab-pane">
          <div class="room-list">
            <div
              v-for="room in myRooms"
              :key="room.id"
              :class="{ active: currentRoom?.id === room.id }"
              class="room-item"
              @click="selectRoom(room)"
            >
              <div class="room-info">
                <span class="room-title">{{ room.name }}</span>
                <span class="room-count">{{ getRoomCount(room.id) }} 人</span>
              </div>
              <div class="room-actions">
                <button
                  v-if="room.creator_id === currentUserId"
                  @click.stop="openDeleteConfirm(room)"
                  class="btn-delete"
                  title="删除房间"
                >
                  🗑️
                </button>
                <button
                  v-else
                  @click.stop="leaveRoomConfirm(room)"
                  class="btn-leave"
                  title="离开房间"
                >
                  👋
                </button>
              </div>
            </div>

            <!-- 创建新房间表单 -->
            <div class="create-room-form">
              <input
                v-model="newRoomName"
                type="text"
                placeholder="输入房间名称..."
                maxlength="50"
                @keyup.enter="handleCreateRoom"
                class="room-input"
              />
              <button
                @click="handleCreateRoom"
                :disabled="isCreating || newRoomName.trim().length === 0"
                class="btn-create"
              >
                {{ isCreating ? '创建中...' : '✨ 创建' }}
              </button>
            </div>

            <div v-if="createError" class="error-message">
              {{ createError }}
            </div>
          </div>
        </div>

        <!-- 公开房间 -->
        <div v-if="activeTab === 'public'" class="tab-pane">
          <div v-if="publicRooms.length === 0" class="empty-state">
            暂无可加入的公开房间
          </div>

          <div v-else class="room-list">
            <div
              v-for="room in publicRooms"
              :key="room.id"
              :class="{ joined: isRoomJoined(room.id) }"
              class="room-item public"
            >
              <div class="room-info">
                <span class="room-title">{{ room.name }}</span>
                <span class="room-desc">{{ room.description }}</span>
                <span class="room-count">{{ getRoomCount(room.id) }} 人</span>
              </div>
              <button
                v-if="isRoomJoined(room.id)"
                @click="selectRoom(room)"
                class="btn-joined"
              >
                ✓ 已加入
              </button>
              <button v-else @click="handleJoinRoom(room)" class="btn-join">
                + 加入
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
    </div>

    <!-- 删除确认对话框 -->
    <div v-if="deleteConfirm.show" class="confirm-dialog">
      <div class="dialog-overlay" @click="deleteConfirm.show = false"></div>
      <div class="dialog-content">
        <div class="dialog-header">
          <h3>删除房间</h3>
        </div>
        <div class="dialog-body">
          <p>确定要删除 "<strong>{{ deleteConfirm.room?.name }}</strong>" 吗？</p>
          <p style="color: #999; font-size: 12px">此操作不可撤销，房间内的所有消息将被删除。</p>
        </div>
        <div class="dialog-footer">
          <button @click="deleteConfirm.show = false" class="btn-cancel">
            取消
          </button>
          <button @click="handleDeleteRoom" class="btn-delete-confirm">
            删除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  getUserRooms,
  createRoom,
  joinRoom,
  leaveRoom,
  deleteRoom,
  getPublicRooms,
  getRoomMemberCount
} from '../services/roomService.js'

const props = defineProps({
  currentUserId: {
    type: String,
    required: true
  },
  currentRoom: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['room-selected', 'rooms-changed'])

const MAX_TOTAL_ROOMS = 10      // 公共聊天室总数限制
const MAX_USER_ROOMS = 3        // 每个用户最多加入的房间数

const showPanel = ref(false)
const activeTab = ref('my-rooms')
const myRooms = ref([])
const publicRooms = ref([])
const newRoomName = ref('')
const isCreating = ref(false)
const createError = ref('')
const errorMessage = ref('')

const deleteConfirm = ref({
  show: false,
  room: null
})

const roomMemberCounts = ref({})

/**
 * 获取房间成员数（缓存）
 */
function getRoomCount(roomId) {
  return roomMemberCounts.value[roomId] || 0
}

/**
 * 切换面板
 */
function togglePanel() {
  showPanel.value = !showPanel.value
  if (showPanel.value) {
    refreshRooms()
  }
}

/**
 * 刷新房间列表
 */
async function refreshRooms() {
  try {
    // 加载用户的房间
    myRooms.value = await getUserRooms(props.currentUserId)

    // 加载公开房间
    publicRooms.value = await getPublicRooms()

    // 获取房间成员数
    for (const room of [...myRooms.value, ...publicRooms.value]) {
      roomMemberCounts.value[room.id] = await getRoomMemberCount(room.id)
    }

    errorMessage.value = ''
    emit('rooms-changed', myRooms.value)
  } catch (err) {
    console.error('刷新房间失败:', err)
    errorMessage.value = '刷新失败'
  }
}

/**
 * 选择房间
 */
function selectRoom(room) {
  emit('room-selected', room)
  showPanel.value = false
}

/**
 * 创建房间
 */
async function handleCreateRoom() {
  if (isCreating.value) return
  if (newRoomName.value.trim().length === 0) {
    createError.value = '房间名称不能为空'
    return
  }

  isCreating.value = true
  createError.value = ''

  try {
    const result = await createRoom(
      props.currentUserId,
      newRoomName.value,
      ''
    )

    if (result.success) {
      newRoomName.value = ''
      selectRoom(result.room)
      await refreshRooms()
    } else {
      createError.value = result.error || '创建失败'
    }
  } finally {
    isCreating.value = false
  }
}

/**
 * 加入房间
 */
async function handleJoinRoom(room) {
  try {
    const result = await joinRoom(props.currentUserId, room.id)

    if (result.success) {
      selectRoom(room)
      await refreshRooms()
    } else {
      errorMessage.value = result.error || '加入失败'
    }
  } catch (err) {
    console.error('加入房间异常:', err)
    errorMessage.value = '加入异常'
  }
}

/**
 * 打开删除确认
 */
function openDeleteConfirm(room) {
  deleteConfirm.value = {
    show: true,
    room
  }
}

/**
 * 删除房间
 */
async function handleDeleteRoom() {
  const room = deleteConfirm.value.room
  if (!room) return

  try {
    const result = await deleteRoom(props.currentUserId, room.id)

    if (result.success) {
      deleteConfirm.value.show = false
      await refreshRooms()
      errorMessage.value = ''
    } else {
      errorMessage.value = result.error || '删除失败'
    }
  } catch (err) {
    console.error('删除房间异常:', err)
    errorMessage.value = '删除异常'
  }
}

/**
 * 离开房间确认
 */
function leaveRoomConfirm(room) {
  if (confirm(`确定要离开 "${room.name}" 吗？`)) {
    handleLeaveRoom(room)
  }
}

/**
 * 离开房间
 */
async function handleLeaveRoom(room) {
  try {
    const result = await leaveRoom(props.currentUserId, room.id)

    if (result.success) {
      await refreshRooms()
      if (props.currentRoom?.id === room.id) {
        // 如果离开的是当前房间，切换到第一个房间
        if (myRooms.value.length > 0) {
          selectRoom(myRooms.value[0])
        }
      }
    } else {
      errorMessage.value = result.error || '离开失败'
    }
  } catch (err) {
    console.error('离开房间异常:', err)
    errorMessage.value = '离开异常'
  }
}

/**
 * 检查是否已加入房间
 */
function isRoomJoined(roomId) {
  return myRooms.value.some(room => room.id === roomId)
}

/**
 * 组件挂载
 */
onMounted(() => {
  refreshRooms()
})
</script>

<style scoped>
.room-selector {
  position: relative;
  background: white;
  border-bottom: 1px solid #e0e0e0;
}

.current-room {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.room-name {
  font-weight: 500;
  font-size: 14px;
}

.btn-menu {
  background: none;
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-menu:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* 房间管理面板 */
.room-panel {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 999;
  max-height: 500px;
  display: flex;
  flex-direction: column;
}

.panel-tabs {
  display: flex;
  border-bottom: 1px solid #eee;
  background: #f9f9f9;
}

.tab-btn {
  flex: 1;
  padding: 12px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 13px;
  color: #666;
  border-bottom: 3px solid transparent;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #333;
}

.tab-btn.active {
  color: #667eea;
  border-bottom-color: #667eea;
  background: white;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
}

.tab-pane {
  padding: 8px;
}

.room-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.room-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid #eee;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
}

.room-item:hover {
  background: #f5f5f5;
  border-color: #667eea;
}

.room-item.active {
  background: #e8f0ff;
  border-color: #667eea;
}

.room-item.public {
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.room-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  width: 100%;
}

.room-item.public .room-info {
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.room-title {
  font-weight: 500;
  font-size: 13px;
  color: #333;
}

.room-desc {
  font-size: 11px;
  color: #999;
}

.room-count {
  font-size: 11px;
  color: #999;
  padding: 2px 6px;
  background: #f0f0f0;
  border-radius: 3px;
  white-space: nowrap;
}

.room-actions {
  display: flex;
  gap: 6px;
}

.btn-delete,
.btn-leave,
.btn-create,
.btn-join,
.btn-joined {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.2s;
}

.btn-delete:hover {
  background: #fee2e2;
  border-color: #ef4444;
  color: #ef4444;
}

.btn-leave:hover {
  background: #e8f0ff;
  border-color: #667eea;
}

.btn-create {
  background: #4ade80;
  color: white;
  border-color: #4ade80;
  width: 100%;
}

.btn-create:hover:not(:disabled) {
  background: #22c55e;
}

.btn-create:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-join {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.btn-join:hover {
  background: #5568d3;
}

.btn-joined {
  background: #e8f0ff;
  color: #667eea;
  border-color: #667eea;
  cursor: default;
}

.create-room-form {
  display: flex;
  gap: 6px;
  padding: 8px;
  border-top: 1px solid #eee;
  background: #fafafa;
}

.room-input {
  flex: 1;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
}

.room-input:focus {
  outline: none;
  border-color: #667eea;
}

.empty-state {
  padding: 20px;
  text-align: center;
  color: #999;
  font-size: 12px;
}

.error-message {
  padding: 8px 12px;
  background: #fee2e2;
  color: #ef4444;
  font-size: 11px;
  border-radius: 4px;
  margin: 8px;
}

/* 确认对话框 */
.confirm-dialog {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: -1;
}

.dialog-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  width: 90%;
  max-width: 400px;
  z-index: 1001;
}

.dialog-header {
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
}

.dialog-header h3 {
  margin: 0;
  font-size: 16px;
}

.dialog-body {
  padding: 16px 20px;
}

.dialog-body p {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #333;
}

.dialog-footer {
  display: flex;
  gap: 10px;
  padding: 12px 20px;
  border-top: 1px solid #eee;
  justify-content: flex-end;
}

.btn-cancel {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.btn-cancel:hover {
  background: #f5f5f5;
}

.btn-delete-confirm {
  padding: 8px 16px;
  border: none;
  background: #ef4444;
  color: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.btn-delete-confirm:hover {
  background: #dc2626;
}

@media (max-width: 600px) {
  .room-panel {
    max-height: 400px;
  }

  .room-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .room-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
