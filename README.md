# Shadow Chat - 匿名聊天室

一个基于 Vue 3 + Vite 的实时匿名聊天室前端，支持文本和图片消息。

## 技术栈

- Vue 3 (Composition API)
- Vite
- Supabase (数据库 + 存储)
- 原生 JavaScript

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env.local` 文件：

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your-public-anon-key
```

### 3. 启动开发服务器

```bash
npm run dev
```

浏览器会自动打开 http://localhost:5173

### 4. 生产构建

```bash
npm run build
npm run preview
```

## 项目结构

```
src/
  ├── main.js                 # 入口文件
  ├── App.vue                 # 根组件
  ├── services/
  │   ├── supabase.js        # Supabase 客户端初始化
  │   ├── chatService.js     # 聊天业务逻辑
  │   └── storageService.js  # 图片上传服务
  ├── utils/
  │   ├── user.js            # 用户管理工具
  │   └── time.js            # 时间格式化工具
  └── components/
      ├── ChatWindow.vue     # 消息列表容器
      ├── ChatInput.vue      # 输入框组件
      └── MessageItem.vue    # 单条消息组件
index.html
vite.config.js
package.json
.env.local.example
.gitignore
```

## 数据库设置

在 Supabase 控制台执行以下 SQL：

```sql
-- 创建房间表
create table rooms (
  id bigint generated always as identity primary key,
  name text not null,
  created_at timestamp with time zone default now()
);

-- 创建消息表
create table messages (
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
create index idx_messages_room_time
on messages(room_id, created_at desc);

-- 插入默认房间
insert into rooms(name) values('Default Room');
```

## 存储配置

在 Supabase Storage 中创建 Bucket：

- Bucket 名称：`chat-images`
- 权限：Public (对认证用户)
- 策略：允许所有认证用户上传和读取

## 功能特性

✅ 实时消息同步  
✅ 图片上传和显示  
✅ 用户身份持久化  
✅ 自动滚动到最新消息  
✅ XSS 基础防护  
✅ 发送频率限制  

## 使用说明

1. 首次打开应用时，系统自动生成唯一 UUID 和随机昵称
2. 输入文本消息并按 Enter 发送（≥1 秒发送间隔）
3. 点击"上传图片"按钮上传图片文件（支持 PNG/JPEG/WebP，最大 1MB）
4. 点击消息中的图片可在新窗口查看

## 开发指南

### 添加新功能

1. 业务逻辑放在 `services/` 下的对应文件
2. 工具函数放在 `utils/` 下
3. 组件放在 `components/` 下，命名遵循 PascalCase
4. 在组件中通过导入服务来使用功能

### 扩展为多房间版本

- 修改 `App.vue` 添加房间选择组件
- 在 `chatService.js` 中参数化 `room_id`
- 数据库和存储路径已设计为支持多房间扩展

## 🔧 故障排除

### 图片上传失败 - 403 Unauthorized

**错误信息：** `new row violates row-level security policy`

**快速修复：** 在 Supabase SQL Editor 执行
```sql
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all to select messages" ON public.messages;
DROP POLICY IF EXISTS "Allow all to insert messages" ON public.messages;
```

然后刷新浏览器重试。

**详细指南：** 参考 `FIX_RLS_GUIDE.md`

## 许可证

MIT
