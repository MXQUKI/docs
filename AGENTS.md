# AGENTS.md

## 仓库定位

本仓库是 NICE Robotics 官方产品文档网站，使用 Astro + Starlight 构建。`src/content/docs` 是唯一文档事实源。

## 沟通规则

- 默认用中文沟通，回答简洁、直接、具体。
- 不确定时标明置信度：高 / 中 / 低 / 未知。
- 不编造事实、接口、配置、命令、依赖、路径、日期或数据。
- 如果用户或自己的判断不对，直接指出原因。

## 修改前必须做

- 先查看 `agent-logs/HANDOFF.md`，理解当前状态、最近变更、未完成事项和风险。
- 查看 `git status --short --branch`，区分已有改动和本任务改动。
- 维护 README、仓库说明或 GitHub 仓库基础文档时，使用 `.agent/skills/nice-github-repo/SKILL.md`。
- 不要把本仓库需要的 skill 安装到全局；本仓库使用 `.agent/skills/`。

## 项目目标

- 用 Astro 和 Starlight 维护 NICE Robotics 官方产品文档网站。
- 保持现有 UI/UX 视觉体验稳定，不把重构变成重新设计。
- 后续维护者只通过新增或修改 MDX、图片和下载资源更新文档。
- 默认部署到 NI Corporate Vercel，默认生产域名为 `docs.nicerobotics.hk`。

## 技术栈约束

- 首选 Astro 推荐栈。
- 主框架使用 Astro + Starlight。
- 内容使用 Markdown/MDX 和 Starlight content collection。
- 默认静态输出。
- TypeScript 必须使用。
- 样式使用 Tailwind CSS 4。
- 组件样式优先写在组件内。
- 全局 CSS 只保留主题变量、Starlight 必要覆盖和基础 Markdown 样式。
- 搜索使用 Starlight 内建 Pagefind。
- 默认不引入 Supabase、SSR、Edge Runtime 或额外 Vercel adapter。
- 只有存在明确性能、权限、缓存或服务端集成收益时，才重新评估额外服务。

## 内容维护规则

- `src/content/docs` 是唯一文档事实源。
- 网站三语内容：简体原路径、繁体 `zh-hant/`、英文 `en/`。改动产品事实时同步审阅两套译文，遵循 `agent-logs/I18N-GLOSSARY.md` 的术语；保留数字、SKU、资源链接和警告内容。
- 新增或改动章节后保持三语层级和顺序对应；完成审阅再用 `npm run i18n:record -- <页面相对路径，不含扩展名>` 更新翻译记录，不得直接刷新记录掩盖过期译文。
- 新增页面只新增 `.mdx` 和所需静态资源。
- 图片放到 `public/assets/docs/<section>/<page>/`。
- PDF、STEP 等下载资源放到 `public/downloads/<section>/<page>/`。
- 新页面通过 frontmatter 控制标题、描述、图标和侧栏顺序。
- 不要为了新增页面修改导航组件、侧栏组件或全局 CSS。
- 首页快捷展示卡片必须有真实、可用、能代表目标页面的预览图；如果目标分类或页面没有任何可用预览图，不允许把它放到首页快捷展示。
- 不要为了让没有预览图的页面上首页而使用占位图、无关图片或临时裁剪图。
- 不要编造 SKU、规格、链接、价格、库存、交期、认证或兼容性。

## MDX 规则

允许：

- 标准 Markdown。
- 页面 frontmatter。
- `src/components/mdx` 导出的组件。

禁止：

- 手写 `<div>`、`<table>`、`<figure>`、`<img>`。
- 手写 `className`、`style`、`data-*`。
- 在标题中放按钮或链接。
- 为单个页面写一次性视觉结构。
- 绕过已有组件复制 HTML 片段。

如果现有组件不够，先创建通用组件，再在 MDX 中使用。

## Frontmatter 规则

常规页面至少包含：

```yaml
---
title: 页面标题
description: 页面描述
icon: gem
sidebar:
  order: 10
---
```

- `title` 用于页面标题。
- `description` 用于搜索和元信息。
- `icon` 用于页面标题和侧栏图标。
- `sidebar.order` 用于同栏目排序。
- `tableOfContents: false` 只在不需要右侧目录时使用。
- `template: splash` 只在首页等特殊宽版页面使用。

## 组件规则

- MDX 作者优先使用 `src/components/mdx`。
- `ProductTable` 必须支持不同产品的不同列，不固定为单一 SKU 表结构。
- 子页面或子产品索引组件命名为 `SubpageGallery`。
- 图片使用 `DocImage`，默认要兼顾浅色和深色模式可读性。
- 购买入口使用 `BuyButton`。
- Onshape 入口使用 `OnshapeLink`。
- PDF、STEP 等资源入口使用 `ResourceLink`。

## 样式规则

- 新组件样式优先使用 Tailwind。
- 不新增临时全局业务 CSS。
- 不通过文件名、URL 片段或 DOM 形状猜测内容语义。
- 不用 `table:has(...)`、`img[src$=...]` 等选择器表达业务规则。
- 保持现有品牌色、布局、间距、深浅色模式和移动端体验。

## 验证规则

修改后至少运行：

```powershell
npm run lint:content
npm run lint:i18n
npm run test:i18n
npm run check
npm run build
```

涉及视觉变化时，还要用 Playwright 检查：

- 首页。
- 传动页。
- 硬件页。
- 结构页。
- 轮子页。
- 桌面视口。
- 移动视口。
- 浅色模式。
- 深色模式。

## Git 与交接规则

- 保持 diff 小而清晰。
- 不做与当前任务无关的重构。
- 禁止未经授权使用 `git reset --hard`、`git checkout --`、批量删除等破坏性命令。
- 每次完成对话或关键修改后，更新 `agent-logs/HANDOFF.md`。
- handoff 必须包含更新时间，格式包含时区、年、月、日和秒，例如：`2026-06-08 18:38:08 +08:00`。
- handoff 应简洁说明当前状态、刚完成的变更、验证结果、未完成事项和关键风险。

## README 规则

- `README.md` 默认使用 `zh-CN`。
- `README.md` 文件开头只能有一个一级标题，标题必须是 `docs`。
- 一级标题下方必须包含 `NICE Robotics` 和 `Lang zh-CN` badge。
- README 必须区分“给人看的工具/使用方法”和“给 AI 看的工具/使用方法”。
