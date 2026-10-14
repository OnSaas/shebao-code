# 社保码 · 演示站

参考「社保码 · 让社保更便捷」手机页面做的 demo，前后端全量运行在 Cloudflare Workers，配置数据存 KV。

线上：https://shebao-code.onw.workers.dev

## 功能

- 前台 `/`：手机样式社保码卡片（姓名、身份证号脱敏、二维码、三色通行状态、参保信息、更新时间），三色码说明（绿通行 / 黄限行 / 红禁止通行）、主要功能、适用场景，底部四个 tab（首页 / 社保服务 / 办事指南 / 我的），桌面端右侧补充说明区。
- 后台 `/admin`：单用户口令登录，配置前台展示内容 —— 姓名、身份证号（可选脱敏）、头像（上传，存 KV）、码色（绿/黄/红，自动套用对应状态文案与原因）、二维码内容、参保状态、参保类型、累计缴费年限、更新时间、缴费记录流水。

## 架构

| 部分 | 实现 |
| --- | --- |
| 页面 | `public/` 静态资源，由 Worker 的 Assets binding 提供 |
| 接口 | `src/worker.js`（`/api/*`、`/avatar`） |
| 存储 | KV namespace `SB_KV`：`profile`（JSON 配置）、`avatar`（头像二进制 + metadata.contentType） |
| 登录 | 管理员口令存 Worker secret `ADMIN_PASSWORD`，会话为 HMAC-SHA256 签名 Cookie（12 小时），签名密钥 `SESSION_SECRET` |
| 二维码 | `public/vendor/qrcode.js`（qrcode-generator，本地文件，不依赖外网 CDN） |

## 接口

- `GET  /api/profile` 前台展示数据（公开）
- `GET  /api/session` 登录状态
- `POST /api/login` `{password}` 登录
- `POST /api/logout` 退出
- `GET  /api/admin/profile` 读取完整配置（需登录）
- `PUT  /api/admin/profile` `{profile:{...}}` 保存（需登录，`updatedAt` 留空则自动生成）
- `POST /api/admin/avatar` 上传头像（原始字节 + `content-type`，<512KB，需登录）
- `DELETE /api/admin/avatar` 移除头像（需登录）
- `POST /api/admin/reset` 恢复默认演示数据（需登录）
- `GET  /avatar` 头像文件

## 部署

推送到 `main` 由 GitHub Actions（`.github/workflows/deploy.yml`）执行 `wrangler deploy`，使用组织级 secrets `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`。

首次部署后需要写两个 Worker secret（不会随代码进仓）：

```bash
npx wrangler secret put ADMIN_PASSWORD --name shebao-code
npx wrangler secret put SESSION_SECRET  --name shebao-code
```

本地开发：`npx wrangler dev`（`.dev.vars` 提供本地口令与签名密钥）。

演示用途，与任何真实社保系统无关。
