# 多聊天室功能设置指南

## 功能概述

Shadow Chat 现已支持多个聊天室，每个用户最多可以加入 10 个聊天室。

### 功能特性

✅ **创建聊天室** - 用户可创建自己的聊天室  
✅ **加入聊天室** - 浏览并加入公开聊天室  
✅ **切换聊天室** - 实时切换不同的聊天室  
✅ **删除聊天室** - 创建者可删除自己创建的聊天室  
✅ **离开聊天室** - 用户可离开任何加入的聊天室  
✅ **房间限制** - 最多 10 个聊天室，防止账户被过度占用  

---

## 快速设置（5 分钟）

### 第 1 步：执行 SQL 脚本

在 Supabase SQL Editor 中执行 `sql/rooms_setup.sql` 的全部内容：

```bash
# 复制 sql/rooms_setup.sql 的内容
# 打开 Supabase → SQL Editor → New Query
# 粘贴所有 SQL 代码并执行
```

**预期结果**：
```
✓ CREATE TABLE rooms
✓ CREATE TABLE user_rooms  
✓ CREATE POLICIES
✓ ALTER PUBLICATION
```

### 第 2 步：验证数据库

在 SQL Editor 中运行验证查询：

```sql
-- 检查 rooms 表
select * from rooms;

-- 应该看到 1 条默认房间记录：
-- id | name | description | creator_id | is_public | created_at
-- 1  | 大厅 | 默认聊天室...| system    | true     | ...
```

### 第 3 步：刷新前端

1. 打开 `http://localhost:5174`（或你的应用地址）
2. 应该在顶部看到"聊天室选择器"
3. 点击 ☰ 按钮打开聊天室面板

### 第 4 步：测试功能

**创建房间**：
1. 点击 ☰ 按钮
2. 在"我的房间"标签页输入房间名称
3. 点击"✨ 创建"

**加入房间**：
1. 点击 ☰ 按钮
2. 切换到"🌐 公开房间"标签页
3. 点击"+ 加入"

**切换房间**：
1. 在房间列表中点击房间名称
2. 消息列表自动更新

**删除房间**（仅创建者）：
1. 在自己创建的房间上点击 🗑️
2. 确认删除

---

## 技术细节

### 数据库结构

```
rooms 表
├── id (bigint) - 房间 ID
├── name (text) - 房间名称  
├── description (text) - 房间描述
├── creator_id (text) - 创建者 ID
├── is_public (boolean) - 是否公开
├── created_at (timestamp) - 创建时间
└── updated_at (timestamp) - 更新时间

user_rooms 表（关联表）
├── id (bigint) - 记录 ID
├── user_id (text) - 用户 ID
├── room_id (bigint) - 房间 ID（外键）
└── created_at (timestamp) - 加入时间
```

### 消息存储

消息表（messages）已修改：
- `room_id` - 房间 ID（外键）
- `user_id` - 用户 ID
- `nickname` - 用户昵称（快照）

### API 接口

#### 获取用户房间列表
```javascript
import { getUserRooms } from '@/services/roomService'

const rooms = await getUserRooms(userId)
```

#### 创建房间
```javascript
import { createRoom } from '@/services/roomService'

const result = await createRoom(userId, '房间名称', '描述')
if (result.success) {
  console.log('创建成功，房间 ID:', result.roomId)
}
```

#### 加入房间
```javascript
import { joinRoom } from '@/services/roomService'

const result = await joinRoom(userId, roomId)
if (result.success) {
  console.log('加入成功')
}
```

#### 离开房间
```javascript
import { leaveRoom } from '@/services/roomService'

const result = await leaveRoom(userId, roomId)
if (result.success) {
  console.log('离开成功')
}
```

#### 删除房间
```javascript
import { deleteRoom } from '@/services/roomService'

const result = await deleteRoom(userId, roomId)
if (result.success) {
  console.log('删除成功')
}
```

---

## 常见问题

### Q: 创建或加入房间时出现"最多只能"错误

**A**: 用户最多可以加入 10 个聊天室。如要创建更多房间，请先离开一些房间。

可在 `src/services/roomService.js` 中修改 `MAX_ROOMS = 10` 常量。

### Q: 删除房间后消息去哪了？

**A**: 删除房间时，该房间的所有消息也会被级联删除（在 `sql/rooms_setup.sql` 中配置）。

### Q: 如何修改 RLS 政策？

**A**: 在 `sql/rooms_setup.sql` 中有完整的 RLS 配置。可根据需要修改：
```sql
-- 允许所有人查看公开房间
create policy "allow_select_public_rooms" on rooms
for select
using (is_public = true);
```

### Q: 房间实时同步不工作？

**A**: 确认已执行 SQL 脚本中的以下行：
```sql
alter publication supabase_realtime add table rooms, user_rooms;
```

### Q: 想添加房间权限管理怎么办？

**A**: 可在 `user_rooms` 表中添加 `role` 列（管理员/成员），然后修改 RLS 政策。

---

## 迁移指南（从单房间到多房间）

如果你之前已经有单房间数据，可以这样迁移：

```sql
-- 1. 确保 DEFAULT_ROOM_ID = 1 的房间存在
insert into rooms (id, name, description, creator_id, is_public)
values (1, '大厅', '默认聊天室', 'system', true)
on conflict do nothing;

-- 2. 检查 messages 表是否有 room_id
select count(*) from messages where room_id is null;

-- 3. 如有 NULL，更新为默认房间
update messages set room_id = 1 where room_id is null;
```

---

## 性能优化

### 索引

已自动创建以下索引（在 SQL 脚本中）：
- `idx_rooms_creator` - 查询用户创建的房间
- `idx_user_rooms_user` - 查询用户的房间
- `idx_user_rooms_room` - 查询房间的成员

### 查询优化

```javascript
// ✅ 高效：一次查询获取用户和房间信息
const { data } = await supabase
  .from('user_rooms')
  .select('room:rooms(*)')
  .eq('user_id', userId)

// ❌ 低效：多次查询
for (const room of rooms) {
  await supabase.from('rooms').select().eq('id', room.id)
}
```

---

## 故障排查清单

- [ ] SQL 脚本已执行
- [ ] 数据库中有 `rooms` 和 `user_rooms` 表
- [ ] RLS 策略已启用
- [ ] Realtime 已启用（alter publication）
- [ ] 前端可以打开聊天室选择面板
- [ ] 可以创建和加入房间
- [ ] 消息按房间隔离显示
- [ ] 切换房间时消息自动更新

---

## 下一步

- [ ] 配置 RLS 权限为你的需求
- [ ] 添加房间描述和头像
- [ ] 实现房间通知（新消息提醒）
- [ ] 添加房间搜索功能
- [ ] 实现房间主题/分类

---

**版本**: 2.0  
**更新时间**: 2026-02-27
