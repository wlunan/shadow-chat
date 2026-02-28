<template>
  <div class="message-item" :class="{ 'own-message': isOwn }">
    <div class="message-content">
      <!-- 消息头信息 -->
      <div class="message-header">
        <span class="nickname" @click="mentionUser" :class="{ clickable: !isOwn }">
          {{ message.nickname }}
        </span>
        <span class="time">{{ formatTime(message.created_at) }}</span>
      </div>

      <!-- 消息体 -->
      <div class="message-body">
        <!-- 文本消息 -->
        <div v-if="message.type === 'text'" class="text-message" v-html="renderMessage(message.content)"></div>

        <!-- 图片消息 -->
        <div v-else-if="mediaType === 'image'" class="image-message">
          <img
            :src="message.content"
            :alt="message.nickname"
            @click="openImagePreview"
            class="image-thumbnail"
            loading="lazy"
          />
        </div>

        <!-- 视频消息 -->
        <div v-else-if="mediaType === 'video'" class="video-message" @click.stop>
          <video
            :src="message.content"
            controls
            playsinline
            preload="metadata"
            class="video-player"
          ></video>
        </div>
      </div>
    </div>

    <!-- 图片预览模态框 -->
    <div v-if="showImagePreview" class="image-preview-modal" @click="closeImagePreview">
      <div class="image-preview-container">
        <img :src="message.content" :alt="message.nickname" class="image-preview" />
        <button class="close-preview-btn" @click.stop="closeImagePreview">✕</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { formatTime } from '../utils/time.js'

const props = defineProps({
  message: {
    type: Object,
    required: true
  },
  isOwn: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['mention-user'])

const showImagePreview = ref(false)

/**
 * 判定是否为视频（兼容旧数据 type=image 但 URL 是视频）
 */
function isVideoUrl(url) {
  if (!url) return false
  const lower = url.toLowerCase().split('?')[0]
  return ['.mp4', '.webm', '.mov', '.mkv', '.m4v'].some(ext => lower.endsWith(ext))
}

const mediaType = computed(() => {
  if (props.message.type === 'video') return 'video'
  if (props.message.type === 'image' && isVideoUrl(props.message.content)) return 'video'
  if (props.message.type === 'image') return 'image'
  return props.message.type
})

/**
 * 打开图片预览
 */
function openImagePreview() {
  showImagePreview.value = true
}

/**
 * 关闭图片预览
 */
function closeImagePreview() {
  showImagePreview.value = false
}

/**
 * @用户
 */
function mentionUser() {
  if (!props.isOwn) {
    emit('mention-user', props.message.nickname)
  }
}

/**
 * 渲染消息内容（支持 @用户）
 */
function renderMessage(content) {
  // 转义 HTML
  const escaped = content.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  
  // 高亮 @用户
  const withMentions = escaped.replace(/@(\S+)/g, '<span class="mention">@$1</span>')
  
  return withMentions
}
</script>

<style scoped>
.message-item {
  display: flex;
  justify-content: flex-start;
  width: 100%;
}

.message-item.own-message {
  justify-content: flex-end;
}

.message-content {
  max-width: 60%;
  background: #e8e8e8;
  border-radius: 8px;
  padding: 10px 14px;
}

.own-message .message-content {
  background: #1890ff;
  color: #fff;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  font-size: 12px;
}

.nickname {
  font-weight: 500;
  margin-right: 10px;
}

.nickname.clickable {
  cursor: pointer;
  transition: opacity 0.2s;
}

.nickname.clickable:hover {
  opacity: 0.7;
  text-decoration: underline;
}

.own-message .nickname {
  color: rgba(255, 255, 255, 0.8);
}

.time {
  font-size: 11px;
  opacity: 0.6;
}

.own-message .time {
  color: rgba(255, 255, 255, 0.7);
}

.message-body {
  word-break: break-word;
  line-height: 1.5;
}

.text-message {
  font-size: 14px;
}

/* @用户高亮 */
.text-message :deep(.mention) {
  color: #1890ff;
  font-weight: 600;
  background: rgba(24, 144, 255, 0.1);
  padding: 2px 4px;
  border-radius: 3px;
}

.own-message .text-message :deep(.mention) {
  color: #fff;
  background: rgba(255, 255, 255, 0.2);
}

.image-message {
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-message {
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-player {
  max-width: 260px;
  max-height: 200px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

/* 图片缩略图：固定大小，模糊处理 */
.image-thumbnail {
  width: 150px;
  height: 150px;
  object-fit: cover;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  filter: blur(3px);
  opacity: 0.8;
}

.image-thumbnail:hover {
  filter: blur(1px);
  opacity: 0.95;
  transform: scale(1.05);
}

/* 图片预览模态框 */
.image-preview-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  cursor: pointer;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.image-preview-container {
  position: relative;
  max-width: 90%;
  max-height: 90%;
  cursor: default;
}

.image-preview {
  max-width: 100%;
  max-height: 90vh;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.close-preview-btn {
  position: absolute;
  top: -40px;
  right: 0;
  background: rgba(255, 255, 255, 0.9);
  border: none;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-preview-btn:hover {
  background: #fff;
  transform: scale(1.1);
}

@media (max-width: 768px) {
  .message-content {
    max-width: 80%;
  }

  .image-thumbnail {
    width: 120px;
    height: 120px;
  }

  .close-preview-btn {
    top: 10px;
    right: 10px;
  }
}
</style>
