# Supabase Realtime 实时订阅设置

## 问题：前端需要手动刷新才能看到新消息

## 解决方案

### 1. 检查 Supabase Realtime 是否启用

#### 步骤 A: 启用表级别的 Realtime

1. 打开 Supabase Dashboard
2. 进入你的项目
3. 左侧菜单 → **Database** → **Replication**
4. 找到 `messages` 表
5. 确保 **Realtime** 列的开关是 **ON** ✅

如果是 OFF，点击开关启用它。

#### 步骤 B: 通过 SQL 启用（备选方案）

在 SQL Editor 中执行：

```sql
-- 启用 messages 表的 Realtime
alter publication supabase_realtime add table messages;

-- 验证是否启用
select * from pg_publication_tables where pubname = 'supabase_realtime';
```

预期结果应该包含 `messages` 表。

---

### 2. 验证前端订阅代码

打开浏览器控制台（F12），应该看到：

```
🔌 开始订阅新消息... room_id=1
🔔 订阅状态: SUBSCRIBED
```

当有新消息时，应该看到：

```
✅ 收到新消息: {id: xxx, content: "...", ...}
📩 App 收到新消息: {id: xxx, content: "...", ...}
```

---

### 3. 测试实时功能

#### 方法 1: 打开两个浏览器窗口

1. 在窗口 A 和窗口 B 都打开 `http://localhost:5174`
2. 在窗口 A 发送消息
3. 窗口 B 应该**立即**显示新消息（无需刷新）

#### 方法 2: 使用隐身窗口

1. 正常窗口打开应用
2. 隐身窗口打开应用（模拟另一个用户）
3. 在任一窗口发送消息
4. 另一个窗口应该实时收到

---

### 4. 常见问题排查

#### ❌ 订阅状态显示 "CHANNEL_ERROR"

**原因**: Realtime 未启用

**解决**: 
```sql
alter publication supabase_realtime add table messages;
```

#### ❌ 控制台没有任何订阅日志

**原因**: 代码未执行或有错误

**解决**: 
1. 检查浏览器控制台是否有错误
2. 确认 `onMounted` 生命周期已执行
3. 检查 Supabase 环境变量是否配置正确

#### ❌ 订阅成功但收不到消息

**原因**: 可能的原因：
1. RLS 策略阻止了实时更新
2. 订阅的 filter 条件不匹配

**解决**: 
```sql
-- 检查 RLS 策略
select * from pg_policies where tablename = 'messages';

-- 确保有 SELECT 策略允许所有用户
create policy "Allow all to select messages"
on messages for select using (true);
```

#### ❌ 只能看到自己的消息，看不到别人的

**原因**: 可能是浏览器缓存或 localStorage 问题

**解决**:
1. 清除浏览器缓存
2. 打开开发者工具 → Application → Local Storage → 清除
3. 刷新页面

---

### 5. 高级调试

#### 启用 Supabase 调试日志

在 `src/services/supabase.js` 中：

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  // 启用调试日志
  auth: {
    debug: true
  }
})
```

#### 监控 WebSocket 连接

1. 打开浏览器开发者工具
2. Network 标签
3. 筛选 WS (WebSocket)
4. 应该看到连接到 Supabase Realtime 的 WebSocket

---

### 6. 完整的工作流程

```
用户 A 发送消息
    ↓
前端调用 sendTextMessage()
    ↓
数据插入到 messages 表
    ↓
Supabase Realtime 检测到 INSERT
    ↓
通过 WebSocket 推送到所有订阅者
    ↓
用户 B 的浏览器收到消息
    ↓
执行回调函数 messages.value.push(newMessage)
    ↓
Vue 自动更新 UI
    ↓
用户 B 看到新消息（无需刷新）
```

---

### 7. 确认清单

- [ ] Supabase Database Replication 中 `messages` 表的 Realtime 已启用
- [ ] SQL 查询确认 `messages` 在 `supabase_realtime` publication 中
- [ ] 浏览器控制台显示 "🔌 开始订阅新消息..."
- [ ] 浏览器控制台显示 "🔔 订阅状态: SUBSCRIBED"
- [ ] 打开两个窗口测试，消息能实时同步
- [ ] Network 标签中能看到 WebSocket 连接

---

### 8. 如果还是不行

#### 方案 A: 使用轮询作为备选

在 `App.vue` 中添加定时刷新：

```javascript
onMounted(async () => {
  await loadAndRefresh()
  
  // 订阅实时消息
  subscribeMessages((newMessage) => {
    messages.value.push(newMessage)
  })
  
  // 备用方案：每 3 秒轮询一次
  const pollInterval = setInterval(async () => {
    const latestMessages = await loadRecentMessages()
    if (latestMessages.length > messages.value.length) {
      messages.value = latestMessages
    }
  }, 3000)
  
  // 清理
  onUnmounted(() => {
    clearInterval(pollInterval)
    unsubscribeMessages()
  })
})
```

#### 方案 B: 检查 Supabase 项目设置

1. Supabase Dashboard → Settings → API
2. 确认 **Realtime API** 是启用状态
3. 如果是免费版，确认没有超过并发连接限制

---

## 快速验证命令

在浏览器控制台执行：

```javascript
// 测试订阅是否工作
console.log('测试订阅...')

// 手动插入一条消息
const { data, error } = await window.supabase
  .from('messages')
  .insert({
    room_id: 1,
    user_id: 'test-user',
    nickname: '测试用户',
    type: 'text',
    content: '这是一条测试消息'
  })

// 如果订阅工作正常，应该立即在界面上看到这条消息
```

---

## 总结

**最常见的问题**: Realtime 未在数据库层面启用

**最快的解决方案**:
```sql
alter publication supabase_realtime add table messages;
```

执行后刷新页面，打开两个窗口测试即可。
