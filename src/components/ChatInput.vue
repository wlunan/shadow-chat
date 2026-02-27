<template>
  <div class="chat-input">
    <!-- 错误提示 -->
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <!-- 成功提示 -->
    <div v-if="successMessage" class="success-message">
      {{ successMessage }}
    </div>

    <!-- 输入区域 -->
    <div class="input-wrapper">
      <!-- 文本输入框 -->
      <textarea
        v-model="textInput"
        @keydown.enter.ctrl="sendText"
        @keydown.enter.exact="handleEnter"
        placeholder="输入消息... (Ctrl+Enter 或 Enter 发送)"
        class="text-input"
        :disabled="isSending"
      ></textarea>

      <!-- 按钮区域 -->
      <div class="button-group">
        <!-- 图片上传按钮 -->
        <label class="upload-btn" :class="{ disabled: isSending }">
          <input
            ref="imageInput"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            @change="handleImageSelect"
            :disabled="isSending"
            hidden
          />
          {{ imageUploading ? '上传中...' : '📷 上传图片' }}
        </label>

        <!-- 发送文本消息按钮 -->
        <button @click="sendText" :disabled="isSending || !textInput.trim()" class="send-btn">
          {{ isSending ? '发送中...' : '💬 发送' }}
        </button>
      </div>
    </div>

    <!-- 输入框提示信息 -->
    <div class="input-hint">
      <span v-if="textInput.length > 0">{{ textInput.length }}/300</span>
      <span v-else>支持文本（最多 300 字）和图片（最大 1MB）</span>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { sendTextMessage, sendImageMessage } from '../services/chatService.js'
import { uploadImage } from '../services/storageService.js'
import { getCurrentUser } from '../utils/user.js'

const emit = defineEmits(['message-sent'])

const props = defineProps({
  roomId: {
    type: Number,
    default: null
  },
  nickname: {
    type: String,
    default: ''
  }
})

const textInput = ref('')
const isSending = ref(false)
const imageUploading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const imageInput = ref(null)

const user = getCurrentUser()

/**
 * 插入 @用户
 */
function insertMention(nickname) {
  const mention = `@${nickname} `
  textInput.value = textInput.value + mention
}

// 暴露方法给父组件
defineExpose({
  insertMention
})

/**
 * 处理 Enter 键按下（发送文本）
 * 单独按 Enter 发送，Ctrl+Enter 换行
 */
function handleEnter(e) {
  if (!e.shiftKey) {
    e.preventDefault()
    sendText()
  }
}

/**
 * 发送文本消息
 */
async function sendText() {
  if (isSending.value || imageUploading.value) return
  if (!textInput.value.trim()) return
  if (!props.roomId) {
    errorMessage.value = '请先选择聊天室'
    return
  }

  isSending.value = true
  clearMessages()

  try {
    const result = await sendTextMessage(textInput.value, user.id, props.nickname || user.nickname, props.roomId)

    if (result.success) {
      textInput.value = ''
      successMessage.value = '消息已发送'
      setTimeout(() => {
        successMessage.value = ''
      }, 2000)
      emit('message-sent')
    } else {
      errorMessage.value = result.error || '发送失败'
    }
  } catch (err) {
    console.error('发送消息异常:', err)
    errorMessage.value = '发送异常'
  } finally {
    isSending.value = false
  }
}

/**
 * 处理图片选择
 */
async function handleImageSelect(e) {
  const file = e.target.files?.[0]
  if (!file) return
  
  if (!props.roomId) {
    errorMessage.value = '请先选择聊天室'
    return
  }

  // 防止重复上传
  imageUploading.value = true
  isSending.value = true
  clearMessages()

  try {
    // 上传图片
    const uploadResult = await uploadImage(file, user.id)

    if (uploadResult.error) {
      errorMessage.value = uploadResult.error
      return
    }

    // 发送图片消息
    const sendResult = await sendImageMessage(
      uploadResult.url,
      uploadResult.fileSize,
      user.id,
      props.nickname || user.nickname,
      props.roomId
    )

    if (sendResult.success) {
      successMessage.value = '图片已发送'
      setTimeout(() => {
        successMessage.value = ''
      }, 2000)
      emit('message-sent')
    } else {
      errorMessage.value = sendResult.error || '发送失败'
    }
  } catch (err) {
    console.error('上传图片异常:', err)
    errorMessage.value = '上传异常'
  } finally {
    imageUploading.value = false
    isSending.value = false
    // 重置文件输入
    if (imageInput.value) {
      imageInput.value.value = ''
    }
  }
}

/**
 * 清除提示消息
 */
function clearMessages() {
  errorMessage.value = ''
  successMessage.value = ''
}
</script>

<style scoped>
.chat-input {
  padding: 15px;
  border-top: 1px solid #e0e0e0;
  background: #f9f9f9;
}

.error-message {
  padding: 10px;
  margin-bottom: 10px;
  background: #fee;
  color: #c33;
  border-radius: 4px;
  font-size: 13px;
  border-left: 3px solid #c33;
}

.success-message {
  padding: 10px;
  margin-bottom: 10px;
  background: #efe;
  color: #3c3;
  border-radius: 4px;
  font-size: 13px;
  border-left: 3px solid #3c3;
}

.input-wrapper {
  display: flex;
  gap: 10px;
  margin-bottom: 8px;
}

.text-input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: inherit;
  font-size: 13px;
  resize: none;
  height: 80px;
  transition: border-color 0.2s;
}

.text-input:focus {
  outline: none;
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

.text-input:disabled {
  background: #f5f5f5;
  color: #999;
}

.button-group {
  display: flex;
  gap: 8px;
}

.upload-btn,
.send-btn {
  padding: 10px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
  white-space: nowrap;
}

.upload-btn:hover:not(.disabled):not(:disabled),
.send-btn:hover:not(:disabled) {
  border-color: #1890ff;
  color: #1890ff;
  background: #f0f7ff;
}

.upload-btn.disabled,
.send-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.send-btn {
  background: #1890ff;
  color: #fff;
  border-color: #1890ff;
  min-width: 80px;
}

.send-btn:hover:not(:disabled) {
  background: #0d7adc;
  border-color: #0d7adc;
}

.input-hint {
  font-size: 12px;
  color: #999;
  text-align: right;
}
</style>
