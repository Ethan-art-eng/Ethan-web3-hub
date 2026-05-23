# 动态化部署说明

当前站点已经把币圈理财数据改成 API 驱动：

- 前端页面：`wealth/index.html`
- 前端渲染：`wealth-page.js`
- 默认数据：`data/cex-yields.json`
- Cloudflare Pages Function：`functions/api/cex-yields.js`

## 当前行为

在 GitHub Pages 或本地静态预览中，页面会读取：

```text
data/cex-yields.json
```

迁移到 Cloudflare Pages 后，页面会优先读取：

```text
/api/cex-yields
```

这个接口会先查 Cloudflare KV，如果 KV 里没有数据，再回退到默认 JSON。

## Cloudflare 配置

在 Cloudflare Pages 项目里添加：

```text
KV binding name: CEX_YIELDS
Environment variable: ADMIN_TOKEN
```

`ADMIN_TOKEN` 是更新数据接口的管理密钥，不要公开。

仓库里已经包含 `wrangler.toml` 的基础配置。KV binding 建议直接在 Cloudflare Pages 后台添加，绑定名称必须是 `CEX_YIELDS`。

## 更新数据接口

部署到 Cloudflare Pages 后，可以用下面的方式更新交易所理财数据：

```bash
curl -X PUT "https://ethanweb3.com/api/cex-yields" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  --data @data/cex-yields.json
```

更新成功后，前台页面会自动读取 KV 里的最新数据，不需要重新提交代码。

## 下一步

真正的自动抓取可以继续加一个 Cloudflare Cron Worker，定时检查交易所页面或第三方数据源，再写入 `CEX_YIELDS`。交易所页面经常有人机验证和地区限制，自动抓取前需要先确认稳定数据源。
