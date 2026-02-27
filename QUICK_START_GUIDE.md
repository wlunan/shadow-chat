# 快速开始 - 用户管理与容量优化实现

> ⏱️ 预计时间：30 分钟（仅执行 SQL + 基础集成）

## 🎯 3 步快速实现

### 第 1 步：执行数据库 SQL（5 分钟）

**位置**: `sql/users_and_cleanup.sql`

**操作**：
1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 左侧菜单 → **SQL Editor**
4. 点击 **New Query**
5. 复制 `sql/users_and_cleanup.sql` 的全部内容并粘贴
6. 点击 **Run** 执行

**预期结果**：
```
✓ CREATE TABLE users
✓ CREATE FUNCTION get_table_size
✓ CREATE FUNCTION cleanup_old_messages
✓ CREATE POLICY (users_select)
✓ CREATE POLICY (users_insert)
✓ CREATE POLICY (users_update)
```

---

### 第 2 步：添加前端文件（10 分钟）

将以下文件复制到项目中：

```
src/
├── utils/
│   └── user_v2.js                    (✅ 已创建)
├── services/
│   └── cleanupService.js             (✅ 已创建)
└── components/
    └── CapacityMonitor.vue           (✅ 已创建)

sql/
└── users_and_cleanup.sql             (✅ 已创建)
```

**状态**: 所有文件已创建，无需额外操作！

---

### 第 3 步：修改 App.vue（15 分钟）

**操作位置**: `src/App.vue`

#### A. 添加导入（脚本顶部）

```javascript
import CapacityMonitor from './components/CapacityMonitor.vue'
import { updateNickname } from './utils/user_v2.js'
import { checkAndCleanupIfNeeded } from './services/cleanupService.js'
```

#### B. 注册组件

```javascript
export default {
  name: 'App',
  components: {
    CapacityMonitor,
    // ... 其他组件
  }
}
```

#### C. 添加数据状态

```javascript
data() {
  return {
    // ... 现有数据
    showNicknameDialog: false,
    newNickname: '',
    nicknameError: '',
    isUpdatingNickname: false
  }
}
```

#### D. 添加关键方法

```javascript
methods: {
  // ... 现有方法
  
  openNicknameDialog() {
    this.showNicknameDialog = true
    this.newNickname = this.user.nickname
    this.nicknameError = ''
  },

  closeNicknameDialog() {
    this.showNicknameDialog = false
    this.newNickname = ''
    this.nicknameError = ''
  },

  async updateUserNickname() {
    if (this.isUpdatingNickname) return

    try {
      this.isUpdatingNickname = true
      this.nicknameError = ''

      const result = await updateNickname(this.user.id, this.newNickname)

      if (result.success) {
        this.user.nickname = result.nickname
        this.closeNicknameDialog()
      } else {
        this.nicknameError = result.error || '更新失败'
      }
    } finally {
      this.isUpdatingNickname = false
    }
  },

  onCapacityUpdated(data) {
    console.log('容量监控:', data)
  },

  onCapacityCleaned(result) {
    if (result.cleaned) {
      console.log('自动清理完成，删除了', result.deleted, '条消息')
    }
  }
}
```

#### E. 在发送消息后添加容量检查

在 `sendTextMessage()` 或 `sendImageMessage()` 方法中，消息成功发送后：

```javascript
// 发送成功后
if (response.success) {
  this.messageInput = ''
  this.scrollToBottom()
  
  // 新增：检查容量
  await checkAndCleanupIfNeeded()
}
```

#### F. 在模板中添加 UI

**添加昵称编辑对话框**（放在主容器内）：

```html
<!-- 昵称编辑对话框 -->
<dialog v-if="showNicknameDialog" class="nickname-dialog">
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
</dialog>
```

**添加容量监控组件**（放在主容器末尾）：

```html
<!-- 容量监控 -->
<CapacityMonitor @updated="onCapacityUpdated" @cleaned="onCapacityCleaned" />
```

**修改用户昵称显示**（找到显示用户昵称的地方）：

```html
<!-- 添加点击事件和编辑提示 -->
<div class="user-badge" @click="openNicknameDialog" style="cursor: pointer;">
  {{ user.nickname }}
  <span class="edit-hint">点击编辑</span>
</div>
```

#### G. 添加最小化 CSS

在 `<style scoped>` 中添加：

```css
/* 昵称编辑对话框 */
.nickname-dialog {
  all: unset;
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dialog-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: -1;
}

.dialog-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  width: 90%;
  max-width: 400px;
  z-index: 1001;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #eee;
}

.dialog-header h3 {
  margin: 0;
}

.btn-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
  padding: 0;
}

.dialog-body {
  padding: 16px;
}

.nickname-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  margin-bottom: 8px;
  box-sizing: border-box;
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
  padding: 8px;
  border-radius: 4px;
}

.dialog-footer {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #eee;
  justify-content: flex-end;
}

.btn-cancel,
.btn-confirm {
  padding: 8px 16px;
  border-radius: 4px;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
  font-size: 14px;
}

.btn-confirm {
  background: #4ade80;
  color: white;
  border-color: #4ade80;
}

.edit-hint {
  display: none;
  font-size: 12px;
  color: #999;
  margin-left: 8px;
}

.user-badge:hover .edit-hint {
  display: inline;
}
```

---

## ✅ 验证实现

### 1. 启动开发服务器

```bash
npm run dev
```

### 2. 测试昵称修改

- 打开应用
- 点击用户昵称
- 输入新昵称并保存
- ✅ 应该看到昵称更新

### 3. 测试容量监控

- 点击底右角的 📊 按钮
- 应该显示数据库使用百分比
- 点击"刷新"按钮
- ✅ 数据应该更新

### 4. 查看数据库

进入 Supabase Dashboard：
- Tables → users，应该看到用户记录
- 点击用户，应该看到 nickname 已更新

---

## 🐛 常见错误

| 错误 | 解决 |
|------|------|
| `Cannot find module 'user_v2.js'` | 检查文件路径：应该是 `./utils/user_v2.js` 或改名为 `user.js` |
| `RLS policy error` | 确认 SQL 脚本已完全执行 |
| `users table not found` | 执行 `sql/users_and_cleanup.sql` |
| `CapacityMonitor 未显示` | 检查组件是否注册和模板中是否有 `<CapacityMonitor />` |
| 对话框背景不是黑色 | 检查 CSS 中 `.dialog-overlay` 的 z-index，应该小于 `.dialog-content` |

---

## 📊 容量数据参考

**200 MB 数据库可以存储**：

| 数据类型 | 数量 | 说明 |
|--------|------|------|
| 纯文本消息 | ~362,000 条 | 每条 ~550 字节 |
| 图片消息 | ~316,000 条 | 每条 ~650 字节（包含 URL） |
| 混合消息 | ~300,000-330,000 条 | 平衡文本和图片 |

**1 GB 存储可以存储**：

| 文件大小 | 数量 | 说明 |
|--------|------|------|
| 100 KB 图片 | ~10,000 张 | 小型压缩图片 |
| 200 KB 图片 | ~5,000 张 | 中等质量图片 |
| 500 KB 图片 | ~2,000 张 | 高质量图片 |

**清理策略**：
- 达到 90% 容量时自动清理
- 保留最近 100,000 条消息
- 或保留最近 90 天的消息（两者取多者）

---

## 🚀 下一步

完成基础实现后，可以考虑：

1. **用户头像**: 在 users 表中添加 avatar_url 字段
2. **用户设置**: 添加用户偏好设置（语言、主题等）
3. **数据导出**: 在清理前导出消息为 JSON/CSV
4. **通知系统**: 当容量接近限制时发送警告
5. **高级清理**: 按频率分析，智能保留活跃消息

---

## 📚 完整文档

- **详细分析**: `CAPACITY_AND_USERS.md`
- **实现检查清单**: `IMPLEMENTATION_CHECKLIST.md`
- **App.vue 修改详解**: `APP_VUE_MODIFICATIONS.md`
- **SQL 脚本**: `sql/users_and_cleanup.sql`

---

**💡 提示**: 如果遇到问题，检查以下几点：
1. SQL 脚本是否完全执行
2. 文件导入路径是否正确
3. 浏览器控制台是否有错误信息
4. Supabase 网络连接是否正常

**需要帮助?** 查看完整的 `IMPLEMENTATION_CHECKLIST.md` 获得详细的故障排查指南。

