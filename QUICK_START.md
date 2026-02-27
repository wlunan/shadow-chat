# 🚀 Shadow Chat - 5 分钟快速启动指南

## ⚡ 前提条件

- ✅ Node.js 16+ 已安装（npm 随之安装）
- ✅ Supabase 账户（免费，访问 https://supabase.com）
- ✅ 现代浏览器

---

## 第 1 步：配置环境变量（2 分钟）

### 1.1 创建 Supabase 项目

1. 打开 https://supabase.com → 登录/注册
2. 点击"New Project"
3. 输入项目名称、选择区域、设置密码
4. 等待项目初始化（约 2 分钟）

### 1.2 复制连接信息

项目启动后，点击右下角"Settings"（齿轮图标）:

```
Settings → API
┌─────────────────────────────────────┐
│ Project URL (复制这个)              │
│ https://abc123.supabase.co          │
│                                     │
│ anon public key (复制这个)          │
│ eyJhbGciOiJIUzI1NiIs...           │
└─────────────────────────────────────┘
```

### 1.3 配置本地环境

```bash
# 进入项目目录
cd shadow-chat

# 复制模板
cp .env.local.example .env.local

# 编辑 .env.local（用文本编辑器打开）
# 粘贴刚才复制的 URL 和 Key
```

**结果：** `.env.local` 文件看起来应该像这样：
```
VITE_SUPABASE_URL=https://abc123.supabase.co
VITE_SUPABASE_KEY=eyJhbGciOiJIUzI1NiIs...
```

---

## 第 2 步：初始化数据库（2 分钟）

### 2.1 打开 SQL 编辑器

在 Supabase 项目页面：
```
SQL Editor → New Query
```

### 2.2 执行初始化脚本

复制以下代码并粘贴到 SQL 编辑器，然后点击"Run"：

```sql
-- 创建 rooms 表
create table if not exists rooms (
  id bigint generated always as identity primary key,
  name text not null,
  created_at timestamp with time zone default now()
);

-- 创建 messages 表
create table if not exists messages (
  id bigint generated always as identity primary key,
  room_id bigint references rooms(id) on delete cascade,
  user_id text,
  nickname text,
  type text not null default 'text',
  content text not null,
  file_size bigint,
  created_at timestamp with time zone default now()
);

-- 创建索引
create index if not exists idx_messages_room_time
on messages(room_id, created_at desc);

-- 插入默认房间
insert into rooms(name) values('Default Room')
on conflict do nothing;

-- 启用 RLS
alter table messages enable row level security;

-- 创建策略
create policy "Allow all to select messages"
on messages for select using (true);

create policy "Allow all to insert messages"
on messages for insert with check (true);
```

✅ **看到"Query successful"就表示成功了**

### 2.3 创建 Storage Bucket

在 Supabase 项目页面：
```
Storage → Create a new bucket
```

- Bucket 名称：`chat-images`
- 选择"Public"
- 点击"Save"

---

## 第 3 步：启动开发（1 分钟）

```bash
# 进入项目目录（如果还没进入）
cd shadow-chat

# 安装依赖（如果还没安装）
npm install

# 启动开发服务器
npm run dev
```

**预期输出：**
```
VITE v5.4.21  dev server running at:

  ➜  Local:   http://localhost:5173/
```

✅ **浏览器应该自动打开 http://localhost:5173**

---

## 完成！🎉

现在可以：

1. **发送文本消息**
   - 在输入框输入
   - 按 Enter 发送（或 Ctrl+Enter 换行）

2. **发送图片消息**
   - 点击"📷 上传图片"按钮
   - 选择 PNG/JPEG/WebP 格式的图片（最大 1MB）
   - 自动上传并发送

3. **测试实时同步**
   - 打开多个浏览器标签页
   - 在一个页面发送消息
   - 其他页面立即显示（实时同步）

---

## 🆘 遇到问题？

### ❌ "缺少环境变量"

**解决**: 检查 `.env.local` 是否存在且内容正确
```bash
# 检查文件是否存在
cat .env.local

# 应该看到类似内容：
# VITE_SUPABASE_URL=https://xxx.supabase.co
# VITE_SUPABASE_KEY=xxx
```

### ❌ 图片上传失败

**解决**: 检查 Supabase 的 Storage 设置
1. 打开 Supabase → Storage
2. 确认有 `chat-images` bucket
3. 点击 bucket → Policies
4. 确认有允许所有操作的策略

### ❌ 消息不显示

**解决**: 检查数据库
1. 打开 Supabase → SQL Editor → New Query
2. 运行：`select * from messages limit 10;`
3. 应该看到消息记录

### ❌ npm install 失败

**解决**: 清除缓存重试
```bash
npm cache clean --force
npm install
```

---

## 📚 更多信息

| 文件 | 用途 |
|------|------|
| **README.md** | 项目概述 |
| **SETUP.md** | 详细安装指南 |
| **QUICKREF.md** | 快速参考 |
| **DEVNOTES.md** | 开发指南 |

---

## 🎯 下一步

✅ 基础使用完成了！

可选项：
- 修改样式（src/components/*.vue 中的 `<style>` 块）
- 添加新功能（参考 DEVNOTES.md）
- 部署到生产（`npm run build`，然后上传到 Vercel/Netlify）

---

**祝您使用愉快！** 🚀
