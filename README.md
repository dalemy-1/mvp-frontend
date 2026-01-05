# MVP 前端用户页（Next.js Pages Router）+ Supabase 主库

## 你已确认的前提
- 方案 A：一个用户只属于一个 team（登录后自动取唯一 team_id）
- 前端用户提交订单：**不允许** product_id 为空（必须选产品）

## 你需要准备的环境变量（Vercel / 本地）
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

> 注意：此 MVP 不包含注册（Sign up），只包含登录（Sign in）。

## 主要页面
- /login 登录
- /app 我的订单列表
- /orders/new 新建订单（必须选产品）
- /orders/[id] 订单详情：上传留评截图/填留评链接；上传返款截图
- /admin/orders/[id] 管理员页：按状态机按钮推进（调用 admin_set_order_status_v2）

## Storage 约定
Bucket: order-files  
Path:
teams/{team_id}/orders/{order_id}/{type}/{timestamp}_{filename}

type:
- order_screenshot
- review_screenshot
- payout_screenshot
- other

## 需要的 Supabase 表/函数
- 已执行：supabase_schema_v1.sql
- 已执行：supabase_schema_patch_v1_1_status_rpc.sql（可选）
- 已执行：supabase_schema_patch_v1_2_admin_status_v2.sql
- 已执行：supabase_schema_patch_v1_3_strict_guard_noop.sql

其中 MVP 依赖：
- public.team_members（查询 team_id、role）
- public.products（下拉选择产品）
- public.orders（insert / list / detail / update review_link）
- public.order_attachments（插入附件记录）
- Storage bucket: order-files（上传文件）
- RPC: public.admin_set_order_status_v2

## 如何集成到你的仓库
把本 zip 内的这些文件覆盖/新增到你的 Next.js 仓库（Pages Router）：
- /lib/**
- /pages/login.tsx
- /pages/index.tsx
- /pages/app.tsx
- /pages/orders/new.tsx
- /pages/orders/[id].tsx
- /pages/admin/orders/[id].tsx

如果你仓库已经有同名文件，请以你现有的路由为准，手动合并。
