# 全站动态内容说明

站点采用 Cloudflare Pages Functions + KV。空投项目、稳定币理财、工具箱和教程数据不再依赖重新提交 GitHub，管理员保存后公开页会立即读取最新数据。

## 组成

- 公开页：`wealth/index.html`
- 公开页渲染：`wealth-page.js`
- 统一私有管理页：`wealth/admin/index.html`
- 统一后台入口：`/admin/`
- 理财接口：`functions/api/cex-yields.js`
- 空投接口：`functions/api/airdrop-projects.js`
- 工具与教程接口：`functions/api/site-content.js`
- 管理接口：`functions/wealth/admin/api/cex-yields.js`
- 空投种子数据：`data/airdrop-projects.json`
- 工具与教程种子数据：`data/site-content.json`
- 首次部署的默认数据：`data/cex-yields.json`
- 交易所 Logo：`assets/exchanges/`
- 页面监控模块：`lib/yield-monitor.js`
- 定时监控 Worker：`workers/yield-monitor/`

## 实际行为

1. 公开页分别请求 `/api/cex-yields`、`/api/airdrop-projects` 和 `/api/site-content`。
2. 接口优先读取 Cloudflare KV 的 `cex-yields` 数据。
3. KV 尚无数据时，接口回退到 `data/cex-yields.json`。
4. 管理员在 `/admin/` 新增、编辑或删除内容后，接口立即写入 KV。
5. 草稿只在管理后台显示，只有标记为“发布”的活动会进入公开接口。
6. 页面根据浏览器当前时间计算剩余天数和活动状态，并自动隐藏 `endAt` 已过期的活动。
7. 最后核验超过 72 小时后，公开页和后台会提示复核。
8. 每次保存前自动备份上一版本，备份保留 60 天，可在管理页恢复。
9. 独立 Worker 每 6 小时检查五家交易所官方 Earn 页面；页面变化和访问异常进入后台提醒，不会自动发布活动。

## Cloudflare 配置

Cloudflare Pages 项目必须设置：

```text
KV binding: CEX_YIELDS
Secret: ADMIN_TOKEN
Secret: ADMIN_EMAIL
Variable: ACCESS_AUTH_ENABLED=true
```

Cloudflare Access 应用 `Ethan Wealth Admin` 保护 `ethanweb3.com/wealth/admin`，并使用 `Owner only` 策略限制管理员邮箱。`ADMIN_TOKEN` 仅作为本地测试和紧急备用，不要提交到 GitHub，也不要发送给其他人。

## 管理活动

访问：

```text
https://你的域名/admin/
```

通过 Cloudflare Access 邮箱验证后可：

- 统一查看全站数据概览
- 新增、编辑和删除空投项目
- 维护工具箱必备入口和实战工具
- 维护教程阶段、说明和详细链接

- 新增活动
- 先保存草稿，核验后再发布
- 编辑年利率、到期时间和官方链接
- 一键更新最后核验时间
- 按已发布、草稿和需要复核筛选
- 删除活动
- 更新公开风险提示
- 查看并恢复历史版本
- 查看官方页面监控状态并手动立即检查

保存成功后不需要重新部署网站。

## 本地测试

```bash
npx wrangler pages dev . \
  --kv CEX_YIELDS \
  --binding ADMIN_TOKEN=local-test-token
```

然后访问：

```text
http://127.0.0.1:8788/wealth/
http://127.0.0.1:8788/wealth/admin/
```

## 关于自动发现活动

当前版本实现的是数据库驱动的即时更新，不是未经审核的自动抓取。交易所活动页常有登录、地区限制、人机验证和动态接口，自动抓取到的利率也可能只适用于部分用户。

后续若增加 Cron Worker，应把新发现的活动放进“待审核”队列，由管理员核验官方链接、地区、额度和期限后再发布，不能直接自动公开金融数据。
