# Handoff

更新时间：2026-10-14 09:01:36 +02:00

## Team NICE 三语官网申请页（预览已部署，生产未发布）

- 分支 `codex/frc-trilingual-application`，基于原 `main` 的 `b671d35`。保留 Astro + Starlight 静态输出，新增 SurveyJS 问卷与独立 Node.js Vercel Functions。
- 页面：`/team-nice/frc-2027/`、`/zh-hant/team-nice/frc-2027/`、`/en/team-nice/frc-2027/`；三语首页新增文本入口，不新增无产品预览图的卡片。
- 用户最终指定**以当前飞书问卷为唯一内容和逻辑基准**，不再采用原来的 39 题 Wiki 快照。已经读取并逐项核对 40 个主问题，另接入 4 个“其他”补充字段。选购因素为多选而非排序；新增了赛季消费金额题，联系人身份和产品选项使用最新版。
- `src/content/docs/_data/frc-2027.json` 保存三语题目和原始 `sourceRule`；前后端分别从该规则生成/计算显隐，服务器清除隐藏答案后只校验有效题目。未额外添加“其他项目/未授权不能提交”的拒绝规则。三个声明组按原说明全部勾选。
- 台湾本地化采用“送出申請、聯絡人、電子郵件、志工、社群媒體、抵用券、矽膠、螺帽、3D 列印”等；保留人民币金额及原政策。切换网站语言通过共享 sessionStorage 草稿恢复答案和进度；存储禁用时阻止带答案跳转以避免丢失，并明确提示。
- 后端使用 Neon 持久化暂存、原子幂等键/任务租约、同源校验/限流、飞书记录 API `client_token`、异常重试/对账及回执鉴权。同步成功 24 小时后清除暂存正文。详见 `agent-logs/APPLICATIONS.md`。
- 已在 NI Corporate 创建并连接**免费**的新加坡区 Neon `nice-frc-applications-preview`，仅 Preview 环境，已执行 `db/applications.sql`。用户自行配置飞书 App Secret；机密只在 Vercel/.gitignore 排除的本地文件中，未提交仓库。
- 用户新增飞书文本字段“网站提交唯一标识”=`fldAVl0ahk`。应用 `cli_aacde17526f85bd1` 已开通权限并修复文档级权限。
- 真实 Vercel→Neon→飞书联调成功：同一申请 `4ce7b19c-a6a1-4a29-ab53-057bf30a3231` 从 `91403` 暂存失败恢复为 `synced`；飞书只有一条记录 `reczz28NCSjEQYEo`，明确标注“【网站联调测试，请忽略】三语申请接口验证”。重放请求保持同一记录，带凭证的状态接口确认成功。测试记录保留供核对，未擅自删除。
- 最新预览：`https://docs-950bmsec7-ni-corporate.vercel.app`，部署 `dpl_HHVDGiEqUENm5Mfh1fFNMT9YzUbD` READY。Preview 已重新关闭正式提交，只提供标注清楚的演示填写；生产域名和 main 未改变。生产数据库、生产密钥和收集开关需上线时独立配置。
- 验证通过：40题源一致性检查；content/i18n lint；7项原语言/API测试；8项申请单测（含所有语言/分支组合）；Astro check 0 errors/warnings/hints；build；12组申请页面设备/主题检查及显隐/恢复/提交/回执浏览器测试。原站点三语导航、搜索、桌面/手机、深浅模式回归已完成一轮。
- 运行提示：既有 Astro markdown/404 构建提示仍在，申请页 SurveyJS 包有较大 chunk 提示（仅申请页加载）。安装审计提示现有 Astro/Sharp 等框架和传递依赖存在安全公告，未在该功能中做大版本框架升级；生产发布前应单独评估。

---

更新时间：2026-10-13 15:12:14+08:00

## 三语产品文档（已发布并完成生产验收）

- PR [#3](https://github.com/nicerobotics/docs/pull/3) 已合并到 `main`（`3580ca41c0cff36ae98aed245accf08f69494041`）；简体原路径保留，新增 `/zh-hant/`、`/en/`，16 个源页面对应 32 篇完整译文，共 48 个内容页面。
- 语言框使用文字与翻译图标，无旗帜；切换保留产品、查询参数和对应章节。导航、侧栏、按钮、搜索和元信息已本地化。
- 仅首次从站外进入 `/` 自动选择：手动偏好（365 天）→浏览器任意明确简体标记→浏览器支持语言排序→IP 兜底。产品直达页与语言前缀首页不跳转。
- 新增独立 Node.js `GET /api/locale`，只读取 Vercel 地区头、只返回语言、禁止缓存；超时 1.2 秒或用户已操作不跳转。全站仍静态输出。
- `agent-logs/I18N-GLOSSARY.md` 包含三语术语、来源与待斟酌商品名。图片和下载文件共用；SKU、数值、外部资源和警告逐项比对。
- 补正原简体齿轮页的径节定义，与同表 `T / PD` 公式一致，并补明同径节/同总齿数是保持轴距的条件。产品规格未改动。
- 翻译版本 SHA256 与章节映射记录在 `src/i18n/translation-status.json`；构建前强制检查缺译、过期译文、数值及链接。更新事实须同步审阅两套译文后使用 `i18n:record`。
- 已通过：content lint、i18n lint、7 项语言/API 单测、Astro check（0 errors/warnings/hints）、build（48 个内容页面 + 404，三套各 16 页的 Pagefind 索引）。
- Python Playwright 验证通过：全部 48 页静态链接/资源/锚点/SEO 审计；首页语言与故障场景；三语 × 桌面/手机 × 浅色/深色 × 6 页 = 72 组页面检查，菜单、同页切换、查询参数与三语搜索。浏览器存储被拒时仍能切换；主题初始化也容错。
- 本机预览 `http://127.0.0.1:4321/`；浏览器测试使用临时 Python venv，运行说明已写入 README。
- 已发布到 NI Corporate / docs (`prj_Y5hrSGAEBBI9098IzW2wcVKNsgwD`)，生产域名 `docs.nicerobotics.hk`，Node 24；应用发布 `dpl_4ZQsBGgZMk43PHT9WGGczbENxT7C` 为 READY，对应合并提交 `3580ca4`。本次交接提交只更新此文件，不改应用行为。
- 预览运行时曾因 `.ts` 导入在 Vercel 编译后的 JS 中保留而返回 500；`e4c90e2` 已把地区映射保留在 Function 入口，仅保留类型导入。预览及生产实际接口均为 200，响应 `private, no-store`，对应修复/生产部署的 error/fatal 日志查询无记录。
- 生产浏览器已验证三语首页、四类产品、Pagefind 搜索、同产品三向语言切换、查询参数与章节映射；全部 48 个生产页面和简体旧链接已检查。线上地区结果只验证实际访问出口，CN/TW/HK/MO/MY 等映射由接口单测覆盖。
- 首版待斟酌商品名集中在 `I18N-GLOSSARY.md`；原图/PDF/STEP 中的中文保持原样，关键内容有网页译文。无后续技术阻塞。
- 保留原有未提交交接内容。下方为之前的交接记录。

---

# Handoff

更新时间：2026-10-09 11:38:54 +08:00

## 本轮 SKU 更正

- 将滚轴系统页面“硅胶防滑胶带”（50mm × 3m）的 SKU 从 `NICE-07-05-002` 更正为 `NICE-07-05-007`。
- 其他滚筒产品的 `NICE-07-05-002` 引用保持不变。
- `npm run lint:content`、`npm run check`、`npm run build` 均通过；构建 HTML 中已核对胶带 SKU 和尺寸。
- 已提交并推送 `91f4289` 到 `main`；NI Corporate / docs 生产部署 `dpl_8BAVpsVG1GJXdyMHB7Pst45L3cdQ` 状态为 READY。
- 已读取生产页面 `https://docs.nicerobotics.hk/wheels/roller-system/`，确认表格为 `NICE-07-05-007 / 50mm / 3m`。已有 Markdown 弃用及 404 构建提示仍存在。

## 当前状态

- 仓库：`C:\Personal\nice\code\docs`，NICE Robotics 官方产品文档网站，Astro + Starlight 静态站。
- 本仓库已经作为唯一文档事实源维护，后续只通过新增或修改 `src/content/docs/**/*.mdx`、图片和下载资源更新内容。
- 旧外部同步脚本和旧字段残留已经清理；当前文档内容不再依赖外部同步仓库或旧平台语法。
- 现有 UI/UX 视觉经桌面、16:9、深色模式和移动端截图抽查，整体保持上一阶段效果。
- 页面底部横向滚动条问题已修复：页面根节点会裁掉非内容级横向溢出，宽表和公式仍保留组件内部横向滚动。
- 非快速索引的正文图片背景已改为纯白；快速索引卡片图片背景保持原样。

## 本轮完成

- 更新 `src/content/docs/structure/ban-cai.mdx` 的“数控铣削”参考加工参数：
  - 标明适用刀具为 `D4 单刃铣刀`。
  - 参数表仅保留主轴转速 `24000 rpm`、切削进给率 `4000 mm/min`。
  - 两项参数对应每齿进给量约 `0.167 mm`，与用户提供的 CAM 参数图一致。
- 按用户反馈重新调整 `public/assets/docs/wheels/silicone-tube.png`：
  - 恢复上一版大斜向主体构图，不再使用缩小后的小段管材效果。
  - 整体左移，并在透明画布右侧保留约 280px 安全边距，避免首页快速索引卡片右侧贴边。
  - 保持 2400×1350 透明 PNG，无不透明白底。
- 使用用户新提供的 SRPP/板材源图重生成 `public/assets/docs/structure/ban-cai.png`：
  - 将近白背景抠除为透明 PNG。
  - 统一放入 2400×1350 的 16:9 透明画布。
  - 同一张资源继续用于首页“板材”快速索引卡片和 `/structure/ban-cai/` 正文首图。
- 使用用户补发的硅胶软管原图重生成 `public/assets/docs/wheels/silicone-tube.png`：
  - 保持水平镜像后的管材/防撞条式摆法。
  - 将主体高度从原先几乎贴满图片区域缩小到约 960px，避免首页卡片中显得比管材主体明显更大。
  - 保持 2400×1350 透明 PNG，无白底。
- 替换硅胶软管产品图：
  - 使用用户提供的新图重生成 `public/assets/docs/wheels/silicone-tube.png`。
  - 对新图做水平镜像，并按 16:9 透明画布裁切成类似管材/防撞条的摆法。
  - 首页快速索引中的“硅胶软管”卡片增加 `align: "left"`。
- 修正 SRPP 复合板正文首图左侧小角贴边问题：继续增加 `public/assets/docs/structure/ban-cai.png` 的透明安全边距。
- 修正首页快速索引用的两张产品图资源：
  - `public/assets/docs/wheels/silicone-tube.png` 去除白色不透明背景，保留透明 PNG，并裁到产品边界后补透明边距。
  - `public/assets/docs/structure/ban-cai.png` 增加透明安全边距，避免板材左侧小角在卡片中贴边/被裁。
- 更新 `src/content/docs/structure/ban-cai.mdx` 中“加工方式”区域：
  - 激光切割参数表新增并填入 80W 激光切割参数：最大功率 `95%`、最小功率 `90%`、速度 `15mm/s`、切割次数 `3次`。
  - 根据参数内容调整表格列：`激光规格`、`最大功率`、`最小功率`、`速度`、`切割次数`。
  - 将“参考加工参数”从 tab 内容内移到 `Tabs` 组件上方，并使用 `class="text-center"` 居中；移除激光切割和数控铣削 tab 内重复说明文字。
- 已启动本地预览并使用内置浏览器打开 `/structure/ban-cai/`，确认“参考加工参数”位于“激光切割 / 数控铣削”上方且居中。
- 移除 `/wheels/roller-system/` 配置卡片中直接展示的图片原始文件名：
  - `HUBonly.png`
  - `SinglePulley.png`
  - `DoublePulley.png`
- 仅修改 `src/content/docs/wheels/roller-system.mdx` 中对应 `SubpageGallery` item 的 `subtitle` 字段；未改组件实现，首页快速索引的 SKU 副标题不受影响。
- 使用用户提供的新产品图恢复首页快速索引中的“板材”和“硅胶软管”入口：
  - 新增 `public/assets/docs/structure/ban-cai.png`。
  - 新增 `public/assets/docs/wheels/silicone-tube.png`。
  - `src/content/docs/index.mdx` 中加入“板材”和“硅胶软管”卡片。
  - `src/content/docs/structure/ban-cai.mdx` 开头加入板材 `DocImage`。
  - `src/content/docs/wheels/silicone-tube.mdx` 开头加入硅胶软管 `DocImage`。
- 修复移动宽度下 footer 仍使用桌面绝对定位导致 NICE logo 与“联系我们”重叠的问题；footer 移动端堆叠断点改为 `50rem`，与移动导航断点对齐。
- 将 `DocImage` 的 `wide` 变体调整为真正填满正文宽度，并把滚轴系统页面配置图设为 `variant="wide"`，避免高分辨率配置图显示过小。
- 将滚轴系统页面三张配置卡片的链接从 `#` 改为对应安装指南锚点：单滚轴塞、滚轴塞+滚轴同步带轮、滚轴塞+双滚轴同步带轮。
- 移除移动端侧栏底部重复的暗亮切换按钮；暗亮切换入口保留在顶部 header。
- 首页快速索引调整：
  - 撤下“板材”卡片。
  - 撤下“硅胶软管”卡片。
  - 将“滚轴系统”卡片配图从 `RollerSystem.png` 改为 `SinglePulley.png`。
- 新增首页快捷展示规则：目标分类或页面必须有真实可用预览图；没有预览图时不允许放首页，也不要使用占位图或无关图片。
- 已启动本地预览：`http://127.0.0.1:4321/`。
- 修正 XPE 防撞条 SKU：
  - 首页快速索引防撞条系列 SKU 从 `NICE-06-01` 改为 `NICE-06-09`。
  - `src/content/docs/structure/bumper.mdx` 产品表单品 SKU 从 `NICE-06-01-001` 改为 `NICE-06-09-001`。
- 将站点生产域名从 `doc.nicerobotics.hk` 更新为 `docs.nicerobotics.hk`：
  - `astro.config.mjs` 的 `site` 已更新，后续 canonical URL、Open Graph URL 和 sitemap 会使用新域名。
  - `README.md` 和 `AGENTS.md` 中的默认生产域名说明已同步更新。
  - 联系邮箱 `contact@nicerobotics.hk` 与站点域名无关，保持不变。
- 删除旧同步脚本，移除 `package.json` 中对应命令。
- 新增 `scripts/lint-content.mjs` 和 `npm run lint:content`，用于阻止旧关键词、脚手架 HTML、临时 class 写回文档内容。
- 将 frontmatter 中的旧图标字段统一为 `icon`，并让侧栏图标从内容集合读取，减少新增页面时的隐性代码映射。
- 新增 MDX 组件库：`BuyButton`、`ResourceLink`、`OnshapeLink`、`DocImage`、`SubpageGallery`、`ProductTable`、`SpecList`、`MathBlock`、`Callout`。
- 批量迁移现有 MDX：去掉内容文件中的原始布局 HTML、手写表格、图片 figure、按钮 class 和公式快照，改用封装组件。
- 重写 `README.md` 和 `AGENTS.md`，明确人类维护者和 agent 新增文档的方法、组件用法、验证命令和维护边界。
- 精简全局 CSS 中旧业务组件样式，组件样式优先放到 Astro/Tailwind 组件内；全局 CSS 主要保留布局、Starlight 覆盖和站点级视觉规则。
- 修复页面级横向滚动风险：
  - `--nice-shell-edge` 从 viewport 宽度计算改为百分比计算。
  - 右侧目录 fixed 定位从 viewport 宽度计算改为百分比计算。
  - footer 保留全宽视觉，但 padding 改用 shared shell edge。
  - `html`、`body`、`.page`、`.main-frame` 增加页面级横向裁切，避免 full-bleed 元素在 Windows 经典滚动条环境中撑出页面横向滚动条。
- 将 `DocImage` 和全局 markdown 图片兜底背景改为纯白；未修改 `SubpageGallery` 快速索引卡片背景。
- 修复正文标题后紧跟的 `BuyButton` 被折到下一行的问题：按钮增加稳定类名、不收缩和不换行约束；标题 wrapper 在紧邻购买按钮时改为同排 inline-flex。
- 最后一轮拉取五个历史源内容仓库并补同步新增内容：
  - 新增 `src/content/docs/structure/ban-cai.mdx`，迁移板材 / SRPP 复合板内容。
  - 补充滚轴系统页面中的“硅胶防滑胶带”段落、滚轴系统图纸 PDF 链接和 `NICE-D-07-05-01.pdf` 资源。
  - 将滚轴系统安装步骤中的旧居中段落改为 `DocImage` 的 `caption`，并让内容 lint 阻止后续写回 `<p align>`。
  - 首页快速索引新增 5 个入口：板材、塑芯硅胶轮、实心飞轮、硅胶软管、滚轴系统。
  - 文档 MDX 文件名统一从下划线改为连字符：`bearing-shaft`、`nut-strips`、`tube-plugs`、`sprocket-chain`。
  - 保留旧下划线路径到新连字符路径的 redirects，避免已有外链失效。
- 修复带购买按钮标题和普通标题的排版不一致问题：标题保持 flow 内同排布局，不再使用绝对定位；h2/h3/h4 明确按 24px / 20px / 17.28px 递减。
- 修复 `ProductTable` 表头和列之间的白色竖线：组件级强制 `border-spacing: 0`，外层统一裁切圆角，避免表头背景被单元格间距切开。
- 修复 `/wheels/roller-system/` 首次进入页面后点击右侧目录“硅胶防滑胶带”会停在前面滚筒系统区域的问题：
  - 根因是首进时懒加载图片缺少稳定尺寸占位，且该章节位于页面末尾附近，浏览器锚点滚动容易被最大滚动位置截断。
  - `DocImage` 构建时读取 `public` 下本地图片真实尺寸，输出 `width` / `height`，并保留 `h-auto`，避免宽高属性改变实际显示尺寸。
  - 给带右侧目录的正文保留尾部滚动余量，确保末尾章节也能被锚点滚动到可判定的视口位置。
  - 已撤回第一次误判中不必要的 `scroll-margin-top` 改动；拆分验证显示它不是修复该问题所必需。
  - 修复提交已推送到远端：`90691b7 Fix roller system TOC anchor stability`。

## 验证结果

- `npm run lint:content` 通过。
- `ASTRO_TELEMETRY_DISABLED=1 npm run check` 通过，0 errors、0 warnings、0 hints。
- `ASTRO_TELEMETRY_DISABLED=1 npm run build` 通过，生成 17 个页面，Pagefind 搜索索引构建成功。
- 本地构建产物浏览器验证通过：桌面 1440×900、移动 390×844 的浅色/深色模式均显示 D4 单刃铣刀、`24000 rpm` 和 `4000 mm/min`，页面横向溢出均为 0。
- `npm run lint:content` 通过。
- `npm run check` 通过，0 errors、0 warnings、0 hints。
- `npm run build` 通过，生成 17 个页面，Pagefind 搜索索引构建成功。
- 使用内置浏览器打开 `http://127.0.0.1:4321/`，滚动到快速索引底部并等待懒加载图片绘制完成，确认“硅胶软管”卡片恢复大图构图，右侧留白正常，控制台无 error/warn。
- 使用 `sharp` 检查 `silicone-tube.png`：自然尺寸 2400×1350，右侧透明边距约 280px，不含不透明白底像素。
- `npm run lint:content` 通过。
- `npm run check` 通过，0 errors、0 warnings、0 hints。
- `npm run build` 通过，生成 17 个页面，Pagefind 搜索索引构建成功。
- 使用内置浏览器打开 `http://127.0.0.1:4321/` 并滚动到快速索引底部，确认：
  - “板材”卡片加载 `/assets/docs/structure/ban-cai.png`，自然尺寸为 2400×1350。
  - “硅胶软管”卡片加载 `/assets/docs/wheels/silicone-tube.png`，自然尺寸为 2400×1350，主体比例比上一版更小且没有贴边。
- 使用内置浏览器打开 `http://127.0.0.1:4321/structure/ban-cai/`，确认正文首图加载完成，图片背景为纯白承托，左侧角不再被切掉。
- 使用 `sharp` 检查图片 alpha：两张新图均为带 alpha 的 PNG，且不含不透明白底像素。
- `npm run lint:content` 通过。
- `npm run check` 通过，0 errors、0 warnings、0 hints。
- `npm run build` 通过，生成 17 个页面，Pagefind 搜索索引构建成功。
- 使用构建产物 + Playwright 截图检查：首页“硅胶软管”卡片为镜像后的右下圆头构图；`/structure/ban-cai/` 正文首图左侧小角不再贴边。
- 使用 `sharp` 检查图片 alpha：硅胶软管图白色不透明像素为 0，透明像素约 77 万；板材图产品 alpha 左边界从 0 改为 120px。
- `npm run lint:content` 通过。
- `npm run check` 通过，0 errors、0 warnings、0 hints。
- `npm run build` 通过，生成 17 个页面，Pagefind 搜索索引构建成功。
- 使用构建产物 + Playwright 截图检查暗色首页卡片：硅胶软管不再显示白底，板材左侧不再贴边。
- `ASTRO_TELEMETRY_DISABLED=1 npm run check` 通过，0 errors、0 warnings、0 hints。
- `ASTRO_TELEMETRY_DISABLED=1 npm run build` 通过，生成 17 个页面，Pagefind 搜索索引构建成功。
- 使用内置浏览器验证 `http://127.0.0.1:4321/structure/ban-cai/#加工方式`：
  - 页面包含 `80W`、`95%`、`90%`、`15mm/s`、`3次`。
  - “参考加工参数”在 `starlight-tabs` 之前，computed `text-align` 为 `center`。
- `npm run lint:content` 通过。
- `env ASTRO_TELEMETRY_DISABLED=1 npm run check` 通过，0 errors、0 warnings、0 hints。
- `env ASTRO_TELEMETRY_DISABLED=1 npm run build` 通过，生成 17 个页面，Pagefind 搜索索引构建成功。
- 构建产物 `dist/wheels/roller-system/index.html` 中三张配置卡片只保留中文标题，未渲染图片文件名副标题。
- 使用内置浏览器打开 `http://127.0.0.1:4321/wheels/roller-system/` 验证：桌面默认视口和 390px 移动视口下，三张配置卡片均只显示中文标题，页面可见文本不再包含 `HUBonly.png`、`SinglePulley.png`、`DoublePulley.png`。
- 独立 Playwright 深色模式验证未执行成功：本机缺少 Playwright Chromium 二进制，未额外下载依赖；本轮改动只移除 MDX 文本字段，不涉及深色样式。
- `rg` 确认首页快速索引和对应文档正文均已引用 `ban-cai.png` 与 `silicone-tube.png`。
- 使用 Node 临时托管 `dist` 并用 Playwright 检查：首页已出现“板材 NICE-06-02”和“硅胶软管 NICE-07-04”卡片，两个卡片图片加载完成；`/structure/ban-cai/` 和 `/wheels/silicone-tube/` 正文首图加载完成。
- 使用内置浏览器在 733px 宽度打开 `http://127.0.0.1:4321/wheels/roller-system/` 页底，确认 footer logo 与联系方式不再重叠。
- 使用内置浏览器打开 `http://127.0.0.1:4321/wheels/roller-system/` 验证，滚轴系统配置图已按正文宽度展示。
- 使用内置浏览器验证滚轴系统三张配置卡片的 `href` 均指向对应安装指南锚点，并确认三个锚点 URL 可直达对应小节。
- 使用内置浏览器打开 `http://127.0.0.1:4321/structure/tube/` 并展开移动端侧栏，确认“防撞条”下方不再出现暗亮切换按钮，顶部 header 暗亮切换按钮仍存在。
- `npm run lint:content` 通过。
- `ASTRO_TELEMETRY_DISABLED=1 npm run check` 通过，0 errors、0 warnings、0 hints。
- `ASTRO_TELEMETRY_DISABLED=1 npm run build` 通过。
- 使用内置浏览器打开 `http://127.0.0.1:4321/` 验证：首页不再包含“板材”和“硅胶软管”卡片，“滚轴系统”卡片图片为 `/assets/docs/wheels/SinglePulley.png`。
- `rg` 确认防撞条相关 XPE SKU 已显示为 `NICE-06-09` 和 `NICE-06-09-001`。
- `npm run lint:content` 通过。
- `npm run check` 通过，0 errors、0 warnings、0 hints。
- `npm run build` 通过，生成 17 个页面，Pagefind 搜索索引构建成功。
- 构建产物中的 canonical、Open Graph 和 sitemap URL 已确认使用 `https://docs.nicerobotics.hk`。
- `npm run lint:content` 通过。
- 旧平台相关关键词扫描无匹配。
- `src/content/docs` 中脚手架 HTML 扫描无匹配。
- `npm run check` 通过，0 errors、0 warnings、0 hints。
- `npm run build` 通过。
- 使用 `astro preview` + Playwright 抽查 `/hardware/bearing_shaft/`，标题和紧随的购买按钮保持同一行，按钮位于标题右侧且垂直居中。
- `npm run lint:content` 通过，确认内容文件没有旧按钮 class、手写表格、手写图片、`<p align>` 等临时写法。
- `npm run check` 通过，0 errors、0 warnings、0 hints。
- `npm run build` 通过，生成 17 个内容页面；新增 `/structure/ban-cai/`，连字符新路由正常生成。
- Playwright 抽查通过：
  - `/transmission/sprocket-chain/` 的 `NICE 链轮` 标题和购买按钮同排，垂直居中误差约 1.8px。
  - `/hardware/bearing-shaft/` 的 `NICE 法兰轴承` 标题和购买按钮同排，垂直居中误差约 1.8px。
  - 首页快速索引包含板材和轮子四篇文档入口。
  - `/structure/ban-cai/` 可访问，并显示 SRPP 内容、购买按钮和产品表。
  - `/wheels/roller-system/` 包含“硅胶防滑胶带”标题、PDF 链接，且没有 `p[align]`。
- Playwright 复测 `/transmission/sprocket-chain/`：
  - 普通 h2“中心距”和带购买按钮 h2“NICE 链轮”到下一块内容的 gap 均为 20px。
  - 带按钮标题的按钮位于标题右侧，垂直居中误差约 1.8px。
  - h2 / h3 / h4 字号分别为 24px / 20px / 17.28px。
  - `ProductTable` computed `border-spacing` 为 `0px`，表头相邻单元格 gap 为 0，外框圆角为 8px。
- `ASTRO_TELEMETRY_DISABLED=1 npm run build` 通过。
- `ASTRO_TELEMETRY_DISABLED=1 npm run check` 通过，0 errors、0 warnings、0 hints。
- Playwright 复测 `/wheels/roller-system/` 首次进入后立即点击右侧目录“硅胶防滑胶带”：
  - 正常图片加载场景：URL hash 为 `#硅胶防滑胶带`，右侧目录高亮为“硅胶防滑胶带”。
  - 图片请求被拦截场景：URL hash 为 `#硅胶防滑胶带`，右侧目录高亮仍为“硅胶防滑胶带”。
  - 临时禁用尾部滚动余量会复现错误高亮，确认该样式是必要修复；临时禁用 `scroll-margin-top` 不影响修复，因此已撤回该改动。
- `npm run build` 通过，生成 16 个页面，Pagefind 搜索索引构建成功。
- Playwright 计算样式验证：正文图片 light/dark 背景均为 `rgb(255, 255, 255)`；快速索引图片背景仍为原卡片背景。
- 使用 `astro preview` + Playwright 抽查 `/`、`/transmission/gear/`、`/transmission/sprocket_chain/`、`/hardware/tube_plugs/`、`/hardware/bearing_shaft/`、`/structure/tube/`、`/structure/bumper/`、`/wheels/silicone-wheel/`、`/wheels/roller-system/`。
- 桌面、16:9、移动端页面级横向溢出均为 0；宽表在移动端仍能在组件内部横向滚动。
- 移动端目录按钮验证通过：侧栏正常展开，背景正常，页面级横向溢出仍为 0。
- footer 底部截图验证通过：footer 保持全宽，logo 未被遮挡，页面级横向溢出为 0。

## 已知提示

- 构建时仍有 Astro markdown 配置入口弃用提示，来源看起来在 Astro/Starlight 的内部链路或集成层，不影响当前产物。
- 构建末尾仍出现 `Entry docs → 404 was not found.` 提示；源码中未发现自定义错误路由配置，当前产物正常生成。

## 后续建议

- 新增页面时只写标准 MDX 和封装组件，不要写原始布局 HTML、临时 CSS class 或脚本。
- 如新增可下载资源，优先放到 `public/assets/docs/<section>/<page>/`，并通过 `ResourceLink` 或 `ProductTable` 引用。
- 如新增常见内容模式，先封装到 `src/components/mdx/`，再在 MDX 中使用。
- 不要随手新增页面级 `100vw`/负 margin full-bleed 写法；如确实需要全宽视觉，优先复用现有 shell 变量并验证页面级横向溢出。
- 下一轮可单独处理 Astro markdown 弃用提示和 404 构建提示；这不属于当前平台清理的阻塞项。
