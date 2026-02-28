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
        placeholder="输入消息... "
        class="text-input"
        :disabled="isSending"
      ></textarea>

      <!-- 按钮区域 -->
      <div class="button-group">
        <!-- 媒体上传按钮 -->
        <label class="upload-btn" :class="{ disabled: isSending }">
          <input
            ref="mediaInput"
            type="file"
            accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
            @change="handleMediaSelect"
            :disabled="isSending"
            hidden
          />
          {{ imageUploading ? '上传中...' : '📷 上传媒体' }}
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
      <span v-else>支持文本（最多 300 字）、图片（<3MB）、视频（<10MB）</span>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { sendTextMessage, sendImageMessage } from '../services/chatService.js'
import { uploadImage, uploadVideo } from '../services/storageService.js'
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
const mediaInput = ref(null)

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
async function handleMediaSelect(e) {
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
    // 判断文件类型
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')

    if (!isImage && !isVideo) {
      errorMessage.value = '只支持图片和视频文件'
      return
    }

    let uploadResult
    if (isImage) {
      // 上传图片（自动压缩）
      uploadResult = await uploadImage(file, user.id)
    } else {
      // 上传视频
      uploadResult = await uploadVideo(file, user.id)
    }

    if (uploadResult.error) {
      errorMessage.value = uploadResult.error
      return
    }

    const mediaType = uploadResult.mediaType || (isVideo ? 'video' : 'image')

    // 发送媒体消息
    const sendResult = await sendImageMessage(
      uploadResult.url,
      uploadResult.fileSize,
      user.id,
      props.nickname || user.nickname,
      props.roomId,
      mediaType
    )

    if (sendResult.success) {
      const label = isImage ? '图片' : '视频'
      successMessage.value = `${label}已发送`
      setTimeout(() => {
        successMessage.value = ''
      }, 2000)
      emit('message-sent')
    } else {
      errorMessage.value = sendResult.error || '发送失败'
    }
  } catch (err) {
    console.error('上传媒体异常:', err)
    errorMessage.value = '上传异常'
  } finally {
    imageUploading.value = false
    isSending.value = false
    // 重置文件输入
    if (mediaInput.value) {
      mediaInput.value.value = ''
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
  padding: 10px 12px;
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
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.text-input {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-family: inherit;
  font-size: 13px;
  resize: none;
  height: 36px;
  min-height: 36px;
  max-height: 120px;
  line-height: 1.35;
  transition: border-color 0.2s, box-shadow 0.2s;
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
  gap: 6px;
  align-items: center;
}

.upload-btn,
.send-btn {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
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
  min-width: 72px;
}

.send-btn:hover:not(:disabled) {
  background: #0d7adc;
  border-color: #0d7adc;
}

.input-hint {
  font-size: 11px;
  color: #999;
  text-align: right;
}
</style>
