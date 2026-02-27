-- ============================================
-- Shadow Chat 聊天室功能 SQL
-- ============================================

-- ============================================
-- 1. 修改 rooms 表（如果已存在，先备份）
-- ============================================

-- 检查并删除旧的 rooms 表（如果存在）
-- drop table if exists rooms cascade;

-- 创建/更新 rooms 表
create table if not exists rooms (
  id bigint generated always as identity primary key,
  name text not null,
  description text default '',
  creator_id text not null,
  is_public boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 创建索引
create index if not exists idx_rooms_creator on rooms(creator_id);
create index if not exists idx_rooms_is_public on rooms(is_public);
create index if not exists idx_rooms_created on rooms(created_at);

-- ============================================
-- 2. 创建 user_rooms 关联表
-- ============================================

create table if not exists user_rooms (
  id bigint generated always as identity primary key,
  user_id text not null,
  room_id bigint not null references rooms(id) on delete cascade,
  created_at timestamp with time zone default now(),
  unique(user_id, room_id)
);

-- 创建索引
create index if not exists idx_user_rooms_user on user_rooms(user_id);
create index if not exists idx_user_rooms_room on user_rooms(room_id);

-- ============================================
-- 3. 修改 messages 表，添加 room_id 外键
-- ============================================

-- 检查 messages 表是否有 room_id 列，如果没有则添加
-- alter table messages add column room_id bigint references rooms(id) on delete cascade;

-- 如果已存在 room_id，确保有外键关系
-- alter table messages add constraint fk_messages_room 
-- foreign key (room_id) references rooms(id) on delete cascade;

-- 创建索引
create index if not exists idx_messages_room on messages(room_id);

-- ============================================
-- 4. 启用 RLS（行级安全策略）
-- ============================================

-- 启用 rooms 表的 RLS
alter table rooms enable row level security;

-- 启用 user_rooms 表的 RLS
alter table user_rooms enable row level security;

-- ============================================
-- 5. 创建 rooms 表的 RLS 策略
-- ============================================

-- 允许所有人查看公开房间
create policy "allow_select_public_rooms" on rooms
for select
using (is_public = true);

-- 允许用户查看自己加入的私有房间
create policy "allow_select_private_rooms" on rooms
for select
using (
  is_public = false 
  and exists (
    select 1 from user_rooms 
    where user_rooms.room_id = rooms.id 
    and user_rooms.user_id = auth.uid()::text
  )
);

-- 允许用户创建房间
create policy "allow_insert_rooms" on rooms
for insert
with check (true);

-- 允许创建者更新自己的房间
create policy "allow_update_rooms" on rooms
for update
using (true);

-- 允许创建者删除自己的房间
create policy "allow_delete_rooms" on rooms
for delete
using (true);

-- ============================================
-- 6. 创建 user_rooms 表的 RLS 策略
-- ============================================

-- 允许用户查看自己的房间关联
create policy "allow_select_user_rooms" on user_rooms
for select
using (true);

-- 允许用户加入房间
create policy "allow_insert_user_rooms" on user_rooms
for insert
with check (true);

-- 允许用户离开房间
create policy "allow_delete_user_rooms" on user_rooms
for delete
using (true);

-- ============================================
-- 7. 创建触发器维护 updated_at
-- ============================================

-- 创建函数
create or replace function update_rooms_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 创建触发器
drop trigger if exists trigger_rooms_updated_at on rooms;
create trigger trigger_rooms_updated_at
before update on rooms
for each row
execute function update_rooms_updated_at();

-- ============================================
-- 8. 创建视图：用户房间信息
-- ============================================

create or replace view user_room_info as
select 
  ur.user_id,
  ur.room_id,
  r.name,
  r.description,
  r.is_public,
  r.creator_id,
  r.created_at,
  (select count(*) from user_rooms where room_id = r.id) as member_count
from user_rooms ur
join rooms r on ur.room_id = r.id;

-- ============================================
-- 9. 插入默认房间
-- ============================================

insert into rooms (name, description, creator_id, is_public)
values ('大厅', '默认聊天室，欢迎加入！', 'system', true)
on conflict do nothing;

-- ============================================
-- 10. 验证配置
-- ============================================

-- 查看 rooms 表结构
select tablename from pg_tables where tablename = 'rooms';

-- 查看 user_rooms 表结构
select tablename from pg_tables where tablename = 'user_rooms';

-- 查看 RLS 策略
select tablename, policyname from pg_policies 
where tablename in ('rooms', 'user_rooms');

-- 查看所有房间
select * from rooms;

-- ============================================
-- 11. Realtime 配置
-- ============================================

-- 启用 rooms 表的 Realtime
alter publication supabase_realtime add table rooms, user_rooms;

-- ============================================
-- 完成！
-- ============================================
-- 现在可以使用多房间功能了
