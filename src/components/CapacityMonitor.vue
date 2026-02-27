<template>
  <div class="capacity-monitor" v-if="showMonitor">
    <div class="monitor-header">
      <h4>容量监控</h4>
      <button @click="toggleMonitor" class="close-btn" title="关闭">×</button>
    </div>

    <div class="monitor-content">
      <!-- 数据库容量进度条 -->
      <div class="capacity-item">
        <div class="item-header">
          <span class="item-label">数据库容量</span>
          <span class="item-value">{{ dbUsage }}%</span>
        </div>
        <div class="progress-bar">
          <div 
            class="progress-fill" 
            :style="{ width: dbUsage + '%' }"
            :class="`status-${dbStatus}`"
          ></div>
        </div>
        <div class="item-detail">
          {{ dbUsageMB }} MB / {{ dbLimitMB }} MB
        </div>
      </div>

      <!-- 警告信息 -->
      <div v-if="dbStatus === 'warning'" class="warning-box">
        <span class="warning-icon">⚠️</span>
        <span class="warning-text">数据库使用量已达 {{ dbUsage }}%，即将触发自动清理</span>
      </div>

      <div v-if="dbStatus === 'critical'" class="critical-box">
        <span class="critical-icon">🚨</span>
        <span class="critical-text">数据库容量已满！自动清理已启动</span>
      </div>

      <!-- 统计信息 -->
      <div v-if="stats" class="statistics">
        <div class="stat-item">
          <span class="stat-label">消息数</span>
          <span class="stat-value">{{ formatNumber(stats.messageCount) }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">图片数</span>
          <span class="stat-value">{{ formatNumber(stats.imageCount) }}</span>
        </div>
        <div v-if="stats.userCount > 0" class="stat-item">
          <span class="stat-label">用户数</span>
          <span class="stat-value">{{ formatNumber(stats.userCount) }}</span>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="monitor-actions">
        <button @click="refresh" class="btn-refresh" title="刷新数据">
          🔄 刷新
        </button>
        <button @click="manualCleanup" class="btn-cleanup" title="手动清理">
          🧹 手动清理
        </button>
      </div>

      <!-- 更新时间 -->
      <div class="update-time">
        最后更新: {{ lastUpdateTime }}
      </div>
    </div>
  </div>

  <!-- 浮动按钮（折叠时） -->
  <button 
    v-if="!showMonitor"
    @click="toggleMonitor"
    class="monitor-toggle-btn"
    title="打开容量监控"
  >
    📊
  </button>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'
import { 
  checkDatabaseUsage, 
  getStatistics, 
  manualCleanup,
  initCleanupService 
} from '../services/cleanupService.js'

export default {
  name: 'CapacityMonitor',
  props: {
    autoHide: {
      type: Boolean,
      default: true
    },
    refreshInterval: {
      type: Number,
      default: 300000 // 5 分钟
    }
  },
  setup(props, { emit }) {
    // 状态
    const showMonitor = ref(false)
    const dbUsageMB = ref(0)
    const dbUsage = ref(0)
    const dbStatus = ref('safe')
    const dbLimitMB = ref(200)
    const stats = ref(null)
    const lastUpdateTime = ref('加载中...')
    const isRefreshing = ref(false)
    const isCleaning = ref(false)
    let refreshTimer = null
    let cleanupStopFn = null

    /**
     * 刷新数据
     */
    async function refresh() {
      if (isRefreshing.value) return

      try {
        isRefreshing.value = true

        // 获取数据库使用情况
        const { usageMB, percentUsed, status } = await checkDatabaseUsage()
        dbUsageMB.value = usageMB
        dbUsage.value = Math.round(percentUsed)
        dbStatus.value = status

        // 获取统计信息
        const statsData = await getStatistics()
        if (statsData) {
          stats.value = statsData
        }

        // 更新时间
        const now = new Date()
        lastUpdateTime.value = now.toLocaleTimeString('zh-CN')

        // 如果自动隐藏且容量低于 70%，隐藏监控面板
        if (props.autoHide && dbUsage.value < 70) {
          // 但如果面板已打开，保持打开
          if (!showMonitor.value) {
            // 不操作，保持关闭状态
          }
        }

        emit('updated', { dbUsage: dbUsage.value, status: dbStatus.value })
      } catch (err) {
        console.error('刷新数据失败:', err)
        lastUpdateTime.value = '刷新失败'
      } finally {
        isRefreshing.value = false
      }
    }

    /**
     * 手动清理
     */
    async function handleManualCleanup() {
      if (isCleaning.value) {
        alert('正在清理中，请稍候...')
        return
      }

      if (!confirm('确认手动清理历史消息吗？')) {
        return
      }

      try {
        isCleaning.value = true
        console.log('执行手动清理...')

        const result = await manualCleanup()
        console.log('清理结果:', result)

        if (result.cleaned) {
          alert(`清理完成！删除了 ${result.deleted || 0} 条消息`)
          // 刷新数据
          setTimeout(refresh, 1000)
        } else {
          alert('容量未超过清理阈值，不需要清理')
        }

        emit('cleaned', result)
      } catch (err) {
        console.error('清理失败:', err)
        alert('清理失败: ' + err.message)
      } finally {
        isCleaning.value = false
      }
    }

    /**
     * 切换监控面板显示
     */
    function toggleMonitor() {
      showMonitor.value = !showMonitor.value
      if (showMonitor.value) {
        refresh()
      }
    }

    /**
     * 格式化数字（添加千位分隔符）
     */
    function formatNumber(num) {
      return num?.toLocaleString?.('zh-CN') || num || 0
    }

    /**
     * 初始化
     */
    function init() {
      // 初始刷新
      refresh()

      // 定期刷新
      refreshTimer = setInterval(refresh, props.refreshInterval)

      // 启动后台清理服务
      cleanupStopFn = initCleanupService(300000) // 5 分钟检查一次
    }

    /**
     * 清理资源
     */
    function cleanup() {
      if (refreshTimer) {
        clearInterval(refreshTimer)
      }
      if (cleanupStopFn) {
        cleanupStopFn()
      }
    }

    // 生命周期
    onMounted(() => {
      init()
    })

    onUnmounted(() => {
      cleanup()
    })

    return {
      showMonitor,
      dbUsageMB,
      dbUsage,
      dbStatus,
      dbLimitMB,
      stats,
      lastUpdateTime,
      isRefreshing,
      isCleaning,
      refresh,
      toggleMonitor,
      manualCleanup: handleManualCleanup,
      formatNumber
    }
  }
}
</script>

<style scoped>
/* 监控面板 */
.capacity-monitor {
  position: fixed;
  bottom: 80px;
  right: 20px;
  width: 300px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 999;
  font-size: 12px;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid #eee;
  background: #f9f9f9;
}

.monitor-header h4 {
  margin: 0;
  font-size: 14px;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #999;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #eee;
  color: #333;
}

.monitor-content {
  padding: 12px;
}

/* 容量项 */
.capacity-item {
  margin-bottom: 16px;
}

.item-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}

.item-label {
  font-weight: 500;
  color: #333;
}

.item-value {
  color: #666;
  font-weight: 600;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #eee;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 4px;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-fill.status-safe {
  background: #4ade80; /* 绿色 */
}

.progress-fill.status-warning {
  background: #facc15; /* 黄色 */
}

.progress-fill.status-critical {
  background: #ef4444; /* 红色 */
}

.item-detail {
  font-size: 11px;
  color: #999;
}

/* 警告提示 */
.warning-box,
.critical-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  margin-bottom: 12px;
  font-size: 11px;
}

.warning-box {
  background: #fef3c7;
  border: 1px solid #fcd34d;
  color: #92400e;
}

.critical-box {
  background: #fee2e2;
  border: 1px solid #fca5a5;
  color: #991b1b;
}

.warning-icon,
.critical-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.warning-text,
.critical-text {
  flex: 1;
}

/* 统计信息 */
.statistics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 8px;
  background: #f9f9f9;
  border-radius: 6px;
  margin-bottom: 12px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-label {
  font-size: 11px;
  color: #999;
  margin-bottom: 2px;
}

.stat-value {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

/* 操作按钮 */
.monitor-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.btn-refresh,
.btn-cleanup {
  flex: 1;
  padding: 6px;
  font-size: 11px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-refresh:hover {
  background: #f0f0f0;
  border-color: #999;
}

.btn-cleanup:hover {
  background: #4ade80;
  color: white;
  border-color: #4ade80;
}

.btn-refresh:active,
.btn-cleanup:active {
  transform: scale(0.95);
}

/* 更新时间 */
.update-time {
  text-align: center;
  font-size: 10px;
  color: #ccc;
  border-top: 1px solid #eee;
  padding-top: 8px;
}

/* 浮动按钮（折叠时） */
.monitor-toggle-btn {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: white;
  border: 2px solid #ddd;
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
  z-index: 998;
}

.monitor-toggle-btn:hover {
  background: #f0f0f0;
  border-color: #999;
  transform: scale(1.1);
}

.monitor-toggle-btn:active {
  transform: scale(0.95);
}

/* 响应式 */
@media (max-width: 600px) {
  .capacity-monitor {
    width: calc(100vw - 40px);
    bottom: 70px;
    right: 20px;
    left: 20px;
  }

  .statistics {
    grid-template-columns: 1fr 1fr 1fr;
  }
}
</style>
