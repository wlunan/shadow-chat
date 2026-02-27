<template>
  <div class="app">
    <!-- 头部 -->
    <header class="app-header">
      <h1>💬 Shadow Chat</h1>
      <div class="user-info">
        <span class="user-badge" @click="openNicknameDialog" title="点击编辑昵称">
          {{ currentUser.nickname }}
          <span class="edit-icon">✏️</span>
        </span>
      </div>
    </header>

    <!-- 聊天室选择器 -->
    <RoomSelector
      :currentUserId="currentUser.id"
      :currentRoom="currentRoom"
      @room-selected="handleRoomSelected"
    />

    <!-- 昵称编辑对话框 -->
    <div v-if="showNicknameDialog" class="nickname-dialog">
      <div class="dialog-overlay" @click="closeNicknameDialog"></div>
      <div class="dialog-content">
        <div class="dialog-header">
          <h3>编辑昵称</h3>
          <button @click="closeNicknameDialog" class="btn-close">×</button>
        </div>
        <div class="dialog-body">
          <input
            v-model="newNickname"
            type="text"
            placeholder="输入新昵称"
            maxlength="20"
            class="nickname-input"
            autofocus
            @keyup.enter="updateUserNickname"
          />
          <div class="input-hint">最多 20 字符 ({{ newNickname.length }}/20)</div>
          <div v-if="nicknameError" class="error-message">{{ nicknameError }}</div>
        </div>
        <div class="dialog-footer">
          <button @click="closeNicknameDialog" class="btn-cancel">取消</button>
          <button @click="updateUserNickname" :disabled="isUpdatingNickname" class="btn-confirm">
            {{ isUpdatingNickname ? '更新中...' : '确认' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 主容器 -->
    <main class="app-main">
      <ChatWindow 
        :messages="messages" 
        :currentUserId="currentUser.id"
        @load-more="handleLoadMore"
        @mention-user="handleMentionUser"
      />
    </main>

    <!-- 底部输入 -->
    <footer class="app-footer">
      <ChatInput 
        ref="chatInputRef"
        :roomId="currentRoom?.id"
        @message-sent="loadAndRefresh" 
      />
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import ChatWindow from './components/ChatWindow.vue'
import ChatInput from './components/ChatInput.vue'
import RoomSelector from './components/RoomSelector.vue'
import { initUser, getCurrentUser } from './utils/user.js'
import { updateNickname } from './utils/user_v2.js'
import { loadRecentMessages, subscribeMessages, unsubscribeMessages } from './services/chatService.js'
import { DEFAULT_ROOM_ID } from './services/supabase.js'

// 初始化用户
const currentUser = ref(initUser())
const messages = ref([])
const isLoading = ref(false)
const chatInputRef = ref(null)

// 昵称编辑相关
const showNicknameDialog = ref(false)
const newNickname = ref('')
const nicknameError = ref('')
const isUpdatingNickname = ref(false)

// 聊天室相关
const currentRoom = ref({
  id: DEFAULT_ROOM_ID,
  name: '大厅'
})
const currentRoomSub = ref(null)

/**
 * 加载消息并刷新界面
 */
async function loadAndRefresh() {
  try {
    // 加载此聊天室的消息
    messages.value = await loadRecentMessages(currentRoom.value.id)
  } catch (err) {
    console.error('加载消息失败:', err)
  }
}

/**
 * 处理 @用户
 */
function handleMentionUser(nickname) {
  if (chatInputRef.value) {
    chatInputRef.value.insertMention(nickname)
  }
}

/**
 * 下载历史消息
 */
function handleLoadMore(olderMessages) {
  // 将斧消息插入到数组开头
  messages.value = [...olderMessages, ...messages.value]
}

/**
 * 处理聊天室选择
 */
async function handleRoomSelected(room) {
  currentRoom.value = room
  messages.value = []
  await loadAndRefresh()
  
  // 取消旧的订阅，并订阅新聊天室
  if (currentRoomSub.value) {
    unsubscribeMessages()
  }
  
  // 订阅新聊天室的消息
  subscribeMessages(currentRoom.value.id, (newMessage) => {
    console.log('📩 App 收到新消息:', newMessage)
    messages.value.push(newMessage)
  })
}

/**
 * 打开昵称编辑对话框
 */
function openNicknameDialog() {
  showNicknameDialog.value = true
  newNickname.value = currentUser.value.nickname
  nicknameError.value = ''
}

/**
 * 关闭昵称编辑对话框
 */
function closeNicknameDialog() {
  showNicknameDialog.value = false
  newNickname.value = ''
  nicknameError.value = ''
}

/**
 * 更新用户昵称
 */
async function updateUserNickname() {
  if (isUpdatingNickname.value) return

  try {
    isUpdatingNickname.value = true
    nicknameError.value = ''

    const result = await updateNickname(currentUser.value.id, newNickname.value)

    if (result.success) {
      currentUser.value.nickname = result.nickname
      closeNicknameDialog()
    } else {
      nicknameError.value = result.error || '更新失败'
    }
  } finally {
    isUpdatingNickname.value = false
  }
}

/**
 * 生命周期：挂载
 * - 自动加载默认聊天室（大厅）的消息
 * - 订阅新消息
 */
onMounted(async () => {
  isLoading.value = true

  try {
    // 自动加载默认聊天室的消息
    await loadAndRefresh()

    // 订阅默认聊天室的新消息
    subscribeMessages(currentRoom.value.id, (newMessage) => {
      console.log('📩 App 收到新消息:', newMessage)
      messages.value.push(newMessage)
    })
  } catch (err) {
    console.error('初始化聊天失败:', err)
  } finally {
    isLoading.value = false
  }
})

/**
 * 生命周期：卸载
 * - 取消订阅（防止内存泄漏）
 */
onUnmounted(() => {
  unsubscribeMessages()
})
</script>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  background: #f5f5f5;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.app-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-badge {
  background: rgba(255, 255, 255, 0.2);
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.user-badge:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

.edit-icon {
  font-size: 11px;
  opacity: 0.7;
}

.app-main {
  flex: 1;
  overflow: hidden;
  background: white;
}

.app-footer {
  background: white;
  border-top: 1px solid #e0e0e0;
}

/* 昵称编辑对话框 */
.nickname-dialog {
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
  animation: slideIn 0.2s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
}

.dialog-header h3 {
  margin: 0;
  font-size: 16px;
  color: #333;
}

.btn-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
  padding: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-close:hover {
  background: #f5f5f5;
  color: #333;
}

.dialog-body {
  padding: 20px;
}

.nickname-input {
  width: 100%;
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  margin-bottom: 8px;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.nickname-input:focus {
  outline: none;
  border-color: #667eea;
}

.input-hint {
  font-size: 12px;
  color: #999;
  margin-bottom: 12px;
}

.error-message {
  color: #ef4444;
  font-size: 12px;
  background: #fee2e2;
  padding: 8px 12px;
  border-radius: 6px;
  margin-top: 8px;
}

.dialog-footer {
  display: flex;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid #eee;
  justify-content: flex-end;
}

.btn-cancel,
.btn-confirm {
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-cancel {
  background: #f5f5f5;
  color: #666;
}

.btn-cancel:hover {
  background: #e8e8e8;
}

.btn-confirm {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-confirm:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .app-header {
    padding: 12px 16px;
  }

  .app-header h1 {
    font-size: 18px;
  }

  .user-badge {
    font-size: 12px;
    padding: 4px 10px;
  }

  .dialog-content {
    width: 95%;
  }
}
</style>
