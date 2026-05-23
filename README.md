# 链上笔记 Web3 Hub

这是一个 Web3 内容导航网站。当前主站仍可静态托管，币圈理财数据已经预留 Cloudflare Pages Functions 动态接口，用于整理：

- 理财项目
- 空投项目
- 课程路线
- 教程文章
- 风险清单

## 文件说明

- `index.html`：页面结构。
- `styles.css`：视觉样式。
- `content.js`：项目、空投、课程和教程数据。以后主要更新这里。
- `script.js`：筛选、搜索和视觉网络图。
- `data/cex-yields.json`：交易所稳定币理财默认数据。
- `wealth-page.js`：币圈理财页动态渲染逻辑。
- `functions/api/cex-yields.js`：Cloudflare Pages 动态 API，可读取 KV 数据。
- `DYNAMIC.md`：Cloudflare Pages + KV 部署说明。

## 更新内容

新增项目：编辑 `content.js` 里的 `projects`。

新增空投：编辑 `airdrops`。

新增课程：编辑 `courses`。

新增教程：编辑 `tutorials`。

更新交易所理财数据：先编辑 `data/cex-yields.json`。迁移到 Cloudflare Pages + KV 后，可以通过 `/api/cex-yields` 更新，不需要重新提交网页代码。

## 内容原则

所有内容都应该记录：

- 参与规则
- 收益来源
- 资金路径
- 退出条件
- 主要风险
- 信息来源

不要写成收益承诺或投资建议。
