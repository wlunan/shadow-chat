<template>
  <div class="chat-window">
    <div class="messages-container" ref="messagesContainer" @scroll="handleScroll">
      <!-- 加载更多按钮 -->
      <div v-if="hasMore && messages.length > 0" class="load-more-container">
        <button @click="loadMore" :disabled="isLoadingMore" class="load-more-btn">
          {{ isLoadingMore ? '加载中...' : '📜 加载更多 (150条)' }}
        </button>
      </div>

      <div v-if="messages.length === 0" class="empty-state">
        <p>暂无消息，开始聊天吧！</p>
      </div>

      <div v-for="message in messages" :key="message.id" class="message-wrapper">
        <MessageItem 
          :message="message" 
          :isOwn="message.user_id === currentUserId"
          @mention-user="handleMentionUser"
        />
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import MessageItem from './MessageItem.vue'
import { loadOlderMessages } from '../services/chatService.js'

const props = defineProps({
  messages: {
    type: Array,
    required: true
  },
  currentUserId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['load-more', 'mention-user'])

const messagesContainer = ref(null)
const isLoadingMore = ref(false)
const hasMore = ref(true)
const lastScrollHeight = ref(0)
const isUserScrolling = ref(false)


// 监听消息列表变化，自动滚动到底部（仅在不是加载更多时）
watch(
  () => props.messages.length,
  (newLength, oldLength) => {
    nextTick(() => {
      // 如果是新消息（不是加载历史），滚动到底部
      if (!isLoadingMore.value) {
        scrollToBottom()
      } else {
        // 加载历史后保持滚动位置
        maintainScrollPosition()
      }
    })
  }
)

// 组件挂载时滚动到底部
onMounted(() => {
  nextTick(() => {
    scrollToBottom()
  })
})

/**
 * 处理滚动事件
 */
function handleScroll(e) {
  const container = e.target
  isUserScrolling.value = true
  
  // 检测是否滚动到顶部
  if (container.scrollTop < 50 && hasMore.value && !isLoadingMore.value) {
    // 可以在这里自动加载，但我们使用按钮方式
  }
}

/**
 * 加载更多历史消息
 */
async function loadMore() {
  if (isLoadingMore.value || !hasMore.value || props.messages.length === 0) return

  isLoadingMore.value = true
  lastScrollHeight.value = messagesContainer.value.scrollHeight

  try {
    // 获取最早的消息时间戳
    const oldestMessage = props.messages[0]
    const olderMessages = await loadOlderMessages(oldestMessage.created_at, 150)

    if (olderMessages.length === 0) {
      hasMore.value = false
    } else {
      emit('load-more', olderMessages)
    }
  } catch (err) {
    console.error('加载更多失败:', err)
  } finally {
    isLoadingMore.value = false
  }
}

/**
 * 保持滚动位置（加载历史消息后）
 */
function maintainScrollPosition() {
  if (messagesContainer.value) {
    const newScrollHeight = messagesContainer.value.scrollHeight
    const heightDiff = newScrollHeight - lastScrollHeight.value
    messagesContainer.value.scrollTop = heightDiff
  }
}

/**
 * 滚动到消息列表底部
 */
function scrollToBottom() {
  if (messagesContainer.value && !isUserScrolling.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
  isUserScrolling.value = false
}

/**
 * 处理 @ 用户
 */
function handleMentionUser(nickname) {
  emit('mention-user', nickname)
}
</script>

<style scoped>
.chat-window {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.load-more-container {
  display: flex;
  justify-content: center;
  padding: 10px 0;
  margin-bottom: 10px;
}

.load-more-btn {
  padding: 8px 20px;
  background: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
  color: #666;
  transition: all 0.2s;
}

.load-more-btn:hover:not(:disabled) {
  background: #e8e8e8;
  border-color: #999;
  color: #333;
}

.load-more-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
  font-size: 14px;
}

.message-wrapper {
  display: flex;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 美化滚动条 */
.messages-container::-webkit-scrollbar {
  width: 6px;
}

.messages-container::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.messages-container::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 3px;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background: #999;
}
</style>
