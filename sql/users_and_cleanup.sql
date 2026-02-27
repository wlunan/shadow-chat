-- ============================================
-- Shadow Chat 用户表 + 清理策略完整 SQL
-- ============================================

-- ============================================
-- 1. 创建 users 表（用户信息）
-- ============================================

create table if not exists users (
  id text primary key,
  nickname text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 启用 RLS
alter table users enable row level security;

-- 创建策略
create policy "allow_select_users" on users
for select
using (true);

create policy "allow_insert_users" on users
for insert
with check (true);

create policy "allow_update_users" on users
for update
using (true)
with check (true);

-- 创建索引
create index idx_users_id on users(id);
create index idx_users_created on users(created_at);

-- ============================================
-- 2. 修改 messages 表（添加外键）
-- ============================================

-- 为 messages 表添加用户外键（如果需要）
-- alter table messages
-- add column user_id_fk text references users(id) on delete cascade;

-- ============================================
-- 3. 清理旧消息的存储函数
-- ============================================

-- 创建函数：获取表大小（单位：字节）
create or replace function get_table_size(table_name text)
returns bigint as $$
declare
  size bigint;
begin
  execute 'select pg_total_relation_size(''' || table_name || ''')' into size;
  return size;
end;
$$ language plpgsql;

-- 创建函数：清理旧消息（保留最近 N 条）
create or replace function cleanup_old_messages(keep_count int default 100000)
returns table(deleted_count bigint) as $$
declare
  count_to_delete bigint;
  v_deleted_count bigint;
begin
  -- 计算要删除的消息数量
  select count(*) - keep_count into count_to_delete
  from messages;
  
  if count_to_delete <= 0 then
    return query select 0::bigint;
    return;
  end if;
  
  -- 删除最旧的消息
  delete from messages
  where id in (
    select id from messages
    order by created_at asc
    limit count_to_delete
  );
  
  get diagnostics v_deleted_count = row_count;
  return query select v_deleted_count;
end;
$$ language plpgsql;

-- 创建函数：清理旧消息（按天数）
create or replace function cleanup_messages_by_days(days int default 90)
returns table(deleted_count bigint) as $$
declare
  v_deleted_count bigint;
begin
  delete from messages
  where created_at < now() - interval '1 day' * days;
  
  get diagnostics v_deleted_count = row_count;
  return query select v_deleted_count;
end;
$$ language plpgsql;

-- ============================================
-- 4. 获取统计信息的函数
-- ============================================

create or replace function get_chat_statistics()
returns table(
  message_count bigint,
  user_count bigint,
  database_size_mb numeric,
  image_count bigint
) as $$
begin
  return query
  select
    (select count(*) from messages)::bigint,
    (select count(*) from users)::bigint,
    (pg_total_relation_size('messages') / 1024 / 1024)::numeric,
    (select count(*) from messages where type = 'image')::bigint;
end;
$$ language plpgsql;

-- ============================================
-- 5. 创建视图：容量监控
-- ============================================

create or replace view message_capacity_status as
select
  count(*) as total_messages,
  count(*) filter (where type = 'text') as text_messages,
  count(*) filter (where type = 'image') as image_messages,
  round(pg_total_relation_size('messages')::numeric / 1024 / 1024, 2) as size_mb,
  round(pg_total_relation_size('messages')::numeric / 1024 / 1024 / 200 * 100, 2) as usage_percent,
  case
    when pg_total_relation_size('messages')::numeric / 1024 / 1024 / 200 > 0.9 then '⚠️ 容量即将满 (>90%)'
    when pg_total_relation_size('messages')::numeric / 1024 / 1024 / 200 > 0.7 then '⚠️ 容量较高 (>70%)'
    else '✅ 容量充足'
  end as status
from messages;

-- ============================================
-- 6. 验证配置（执行这些查询检查）
-- ============================================

-- 检查表结构
select tablename, rowsecurity from pg_tables 
where tablename in ('users', 'messages')
order by tablename;

-- 检查索引
select indexname, tablename from pg_indexes 
where tablename in ('users', 'messages')
order by tablename;

-- 获取当前统计信息
select * from get_chat_statistics();

-- 查看容量状态
select * from message_capacity_status;

-- ============================================
-- 7. 清理任务（定期执行）
-- ============================================

-- 方案 A：清理 90 天前的消息
-- 在外部任务调度器或云函数中定期执行
-- select * from cleanup_messages_by_days(90);

-- 方案 B：保留最近 10 万条消息
-- select * from cleanup_old_messages(100000);

-- ============================================
-- 8. 示例数据（测试用）
-- ============================================

-- 插入测试用户
insert into users (id, nickname) values
  ('550e8400-e29b-41d4-a716-446655440000', '测试用户1'),
  ('550e8400-e29b-41d4-a716-446655440001', '测试用户2'),
  ('550e8400-e29b-41d4-a716-446655440002', '测试用户3')
on conflict do nothing;

-- ============================================
-- 9. 监控和维护
-- ============================================

-- 定期执行（建议每周）
-- select * from cleanup_old_messages(100000);

-- 定期查看状态
-- select * from message_capacity_status;

-- 如需进一步优化，可以：
-- 1. 为 created_at 添加索引：CREATE INDEX idx_messages_created ON messages(created_at);
-- 2. 为 type 添加索引：CREATE INDEX idx_messages_type ON messages(type);
-- 3. 定期 VACUUM 和 ANALYZE 数据库

-- ============================================
-- 完成！
-- ============================================
-- 现在您可以在前端使用这些函数：
-- - get_table_size('messages') 检查容量
-- - cleanup_old_messages(100000) 清理旧消息
-- - get_chat_statistics() 获取统计
-- - 查询 message_capacity_status 视图获取实时状态
