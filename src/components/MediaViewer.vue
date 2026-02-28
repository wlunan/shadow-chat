<template>
  <div v-if="showModal" class="media-viewer-modal">
    <div class="modal-overlay" @click="closeModal"></div>
    
    <div class="modal-content">
      <!-- 头部 -->
      <div class="modal-header">
        <h3>媒体库 ({{ currentIndex + 1 }}/{{ filteredMedias.length }})</h3>
        <button @click="closeModal" class="btn-close">×</button>
      </div>

      <!-- 媒体显示区域 -->
      <div class="media-container">
        <div v-if="filteredMedias.length === 0" class="no-media">
          暂无媒体文件
        </div>

        <template v-else>
          <!-- 当前媒体 -->
          <div class="media-display" v-if="currentMedia">
            <img
              v-if="currentMedia.type === 'image'"
              :src="currentMedia.url"
              :alt="currentMedia.filename"
              class="media-img"
            />
            <video
              v-else
              :src="currentMedia.url"
              controls
              playsinline
              preload="metadata"
              class="media-video"
            ></video>
          </div>
          <div v-else class="no-media">点击下方缩略图查看大图 / 播放</div>

          <!-- 导航按钮 -->
          <div class="media-controls" v-if="currentMedia">
            <button 
              @click="prevMedia" 
              :disabled="currentIndex === 0"
              class="btn-nav"
            >
              ← 上一个
            </button>
            <button 
              @click="nextMedia" 
              :disabled="currentIndex === filteredMedias.length - 1"
              class="btn-nav"
            >
              下一个 →
            </button>
          </div>

          <!-- 媒体列表 -->
          <div class="media-list">
            <div 
              v-for="(media, index) in filteredMedias"
              :key="index"
              :class="['media-item', { active: index === currentIndex }]"
              @click="selectMedia(index)"
            >
              <div class="media-thumbnail">
                <img
                  v-if="media.type === 'image'"
                  :src="media.url"
                  :alt="media.filename"
                />
                <div v-else class="video-icon">
                  ▶
                </div>
              </div>
              <div class="media-info">
                <div class="media-type">{{ media.type === 'image' ? '📷 图片' : '🎬 视频' }}</div>
                <div class="media-time">{{ formatTime(media.timestamp) }}</div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  messages: {
    type: Array,
    default: () => []
  }
})

const showModal = ref(false)
const currentIndex = ref(-1)

// 过滤出所有媒体文件（图片和视频）
const filteredMedias = computed(() => {
  const medias = []
  
  props.messages.forEach((msg) => {
    if (msg.type !== 'image' && msg.type !== 'video') return
    if (!msg.content) return
    
    const isVideo = msg.type === 'video' || isVideoUrl(msg.content)

    medias.push({
      type: isVideo ? 'video' : 'image',
      url: msg.content,
      timestamp: msg.created_at,
      filename: `${isVideo ? 'video' : 'image'}_${msg.id}`,
      nickname: msg.nickname,
      userId: msg.user_id
    })
  })
  
  return medias
})

const currentMedia = computed(() => {
  if (currentIndex.value < 0 || currentIndex.value >= filteredMedias.value.length) return null
  return filteredMedias.value[currentIndex.value]
})

/**
 * 检查 URL 是否为视频
 */
function isVideoUrl(url) {
  if (!url) return false
  
  const videoExtensions = ['.mp4', '.webm', '.mov', '.mkv', '.m4v']
  const lowerUrl = url.toLowerCase()
  
  // 移除查询参数
  const urlWithoutQuery = lowerUrl.split('?')[0]
  
  return videoExtensions.some(ext => urlWithoutQuery.endsWith(ext))
}

/**
 * 打开媒体查看器
 */
function openModal() {
  showModal.value = true
  currentIndex.value = -1
}

/**
 * 关闭媒体查看器
 */
function closeModal() {
  showModal.value = false
}

/**
 * 选择媒体
 */
function selectMedia(index) {
  currentIndex.value = index
}

/**
 * 上一个媒体
 */
function prevMedia() {
  if (currentIndex.value > 0) {
    currentIndex.value--
  }
}

/**
 * 下一个媒体
 */
function nextMedia() {
  if (currentIndex.value < filteredMedias.value.length - 1) {
    currentIndex.value++
  }
}

/**
 * 格式化时间
 */
function formatTime(timestamp) {
  if (!timestamp) return ''
  
  const date = new Date(timestamp)
  const today = new Date()
  
  if (date.toDateString() === today.toDateString()) {
    // 今天：显示时间
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } else {
    // 其他日期：显示日期
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }
}

// 暴露方法给父组件
defineExpose({
  openModal,
  closeModal
})
</script>

<style scoped>
.media-viewer-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  cursor: pointer;
}

.modal-content {
  position: relative;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 900px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.btn-close {
  background: none;
  border: none;
  font-size: 28px;
  cursor: pointer;
  color: #999;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;
}

.btn-close:hover {
  background: #f0f0f0;
  color: #333;
}

.media-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: auto;
  padding: 16px;
}

.no-media {
  text-align: center;
  color: #999;
  padding: 40px 20px;
}

.media-display {
  flex: 0 0 auto;
  text-align: center;
  margin-bottom: 16px;
  max-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  border-radius: 8px;
  overflow: hidden;
}

.media-img {
  max-width: 100%;
  max-height: 400px;
  object-fit: contain;
}

.media-video {
  max-width: 100%;
  max-height: 400px;
  border-radius: 8px;
}

.media-controls {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

.btn-nav {
  padding: 8px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: opacity 0.2s;
}

.btn-nav:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-2px);
}

.btn-nav:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.media-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 8px;
  overflow-y: auto;
  max-height: 150px;
  padding: 8px;
  background: #fafafa;
  border-radius: 8px;
}

.media-item {
  cursor: pointer;
  border: 2px solid transparent;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s;
}

.media-item:hover {
  border-color: #667eea;
  transform: scale(1.05);
}

.media-item.active {
  border-color: #667eea;
  box-shadow: 0 0 8px rgba(102, 126, 234, 0.3);
}

.media-thumbnail {
  width: 100%;
  aspect-ratio: 1;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.media-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-icon {
  font-size: 24px;
  color: #667eea;
  font-weight: bold;
}

.media-info {
  padding: 4px;
  background: white;
  font-size: 11px;
  text-align: center;
}

.media-type {
  font-weight: 500;
  color: #333;
}

.media-time {
  color: #999;
  margin-top: 2px;
}
</style>
