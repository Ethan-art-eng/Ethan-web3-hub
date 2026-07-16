# 躺赚笔记 Web3 Hub

躺赚笔记是一个面向 Ethan 社区的 Web3 内容导航站，包含空投项目、教程、工具箱和币圈理财四个公开板块。

## 日常维护

访问 `https://ethanweb3.com/admin/`，通过 Cloudflare Access 验证后，可以直接维护：

- 空投项目：新增、编辑、删除项目及任务入口。
- 币圈理财：维护活动、年利率、到期时间、发布状态和官方来源。
- 工具箱：新增工具、分类、用途、Logo、邀请码和链接。
- 教程目录：新增或调整教程阶段、标题、说明和详情链接。

这些内容保存到 Cloudflare KV，公开页会立即读取新数据，不需要重新部署网站。

## 需要改文件的内容

- 首页文案与四个板块入口：`index.html`
- 教程正文：`courses/*/index.html`
- 全站统一视觉与手机布局：`ui-system.css`
- 公共搜索、顶部导航和手机菜单：`site-shell.js`
- 默认数据：`data/`

页面专属脚本：

- 空投项目：`airdrops-page.js`
- 教程目录与学习进度：`courses-page.js`、`course-detail.js`
- 工具箱搜索、收藏、分类和推荐：`toolbox-page.js`
- 币圈理财筛选、时间状态和详情：`wealth-page.js`

旧版样式集中在 `styles.css`，新调整优先写入 `ui-system.css`，不要继续把新规则分散到多个页面。

## 动态数据

- 空投数据：`/api/airdrop-projects`
- 工具与教程目录：`/api/site-content`
- 币圈理财：`/api/cex-yields`

接口优先读取 Cloudflare KV；KV 尚无数据时回退到 `data/` 中的默认 JSON。详细部署和权限说明见 `DYNAMIC.md`。

## 发布流程

1. 本地检查首页和四个公开板块。
2. 检查手机宽度下没有横向溢出。
3. 提交并推送到 GitHub `main`。
4. Cloudflare Pages 自动部署。
5. 部署后检查 `https://ethanweb3.com/` 和 `https://ethanweb3.com/admin/`。

## 内容原则

- 重要信息保留官方来源。
- 金融活动记录核验时间和到期时间。
- 过期活动自动从公开页隐藏。
- 第三方工具和任务入口需要提示授权、钓鱼和资金风险。
- 内容仅用于研究和教育，不构成投资建议。
