# Team NICE 三语申请页部署与维护

网站沿用 Astro + Starlight 静态输出，问卷由 SurveyJS Form Library 渲染。独立 Node.js Vercel Functions 校验答案、暂存提交并写入飞书；没有引入 Astro SSR adapter。

## 页面与内容

- 简体：`/team-nice/frc-2027/`
- 繁体：`/zh-hant/team-nice/frc-2027/`
- 英文：`/en/team-nice/frc-2027/`
- 三份介绍 MDX 和 `src/content/docs/_data/frc-2027.json` 是申请内容源；后者保存最新版飞书问卷的 40 个主问题、4 个“其他”补充输入、三语文本、原有飞书字段 ID、类型和选项值。
- 选项显示文本随语言改变，实际提交值始终使用飞书现有简体选项。长文本不翻译。
- 台湾繁体遵循 `I18N-GLOSSARY.md`：使用“送出申請、聯絡人、電子郵件、志工、社群媒體、零組件、抵用券、矽膠、螺帽、3D 列印”；保留人民币金额、FRC 专有名词和原有资格条件，不换算币种。
- 章节 UI 在 `src/forms/frc.ts`，交互提示在 `src/content/i18n/*.json`，新增提示须同时更新 `src/content.config.ts`。
- 标题、内容或规则变更必须检查三语，然后更新 JSON 中 `version`。介绍页面变更后执行 `npm run i18n:record -- team-nice/frc-2027`，首页变更再加 `index`。
- 用户明确选择以当前飞书表单为唯一基准。当前版本包含消费金额、调整后的联系人身份和产品选项；选购因素按最新版为多选题，不再使用旧版排序题。备用联系人均选填，三个确认组按说明必须全部勾选。不要恢复旧 Wiki 中已被用户改动的题目设置。
- `sourceRule` 保留接口返回的逐题条件，前后端从同一规则生成/计算显隐。Q1 选“其他”、Q4 选“否”时按原条件隐藏后续题目，不另加“禁止提交”的拒绝规则。服务器清理隐藏问题残留值后只校验当前路径的有效必填题。
- 用 `lark-cli base +form-questions-list` 导出最新问题到本地 JSON 后，可运行 `node scripts/check-application-source.mjs <导出文件>` 核对 40 题顺序、标题、说明、类型、必填、选项及显示逻辑；“其他”补充字段单独核对真实字段 ID。

## 正式收集前配置

Vercel 项目：NI Corporate / docs。默认生产域名保持 `docs.nicerobotics.hk`。Preview 与 Production 使用分开的数据库和回执/定时任务密钥。日常 Preview 关闭真实提交；如需重新开启联调，应使用独立飞书测试表，或取得明确授权后仅写入带显著测试标记的合成记录。所有操作先在预览环境验收。

1. 准备支持 Neon HTTP driver 的 PostgreSQL 连接（推荐 Neon），执行 `db/applications.sql`。本实现使用 `@neondatabase/serverless`，不能把任意 PostgreSQL TCP 地址直接当作已兼容。
2. 飞书企业自建应用需要应用身份权限 `base:record:create`、`base:record:retrieve`、`base:field:read`，并获得目标多维表格的必要文档权限。启用高级权限时须确认可管理/搜索范围，避免查询已有提交时返回不完整记录。
3. 目标数据表已由用户增加文本字段“网站提交唯一标识”，ID 为 `fldAVl0ahk`，配置 `FEISHU_SUBMISSION_ID_FIELD`。该字段不复用任何问卷答案字段。
4. 依 `.env.example` 在 Vercel 中配置机密和非机密环境变量。机密不要填写到 Git 仓库、MDX、公开变量或日志中。`RECEIPT_SIGNING_SECRET`、`CRON_SECRET` 使用不同的随机值，至少 32 字符。
5. 设置明确时区的 `APPLICATION_DEADLINE`，例如 ISO 8601 带 `+08:00` 或 `Z` 的时间；为空表示不设置截止。`APPLICATIONS_OPEN` 默认关闭，只有完整接入验收后设为 `true`。
6. 在测试表实际提交三语申请，验证相同字段、相同选项、多选存储、重复点击、飞书暂时故障恢复和截止后已有回执查询。
7. 确认原文内容和部署环境后发布生产版本。不要通过网页“提交成功”的字样代替飞书真实记录核对。

本次开发已建立新加坡区 Neon 免费预览数据库并执行 SQL，配置了 Preview 环境变量。用户已开通应用权限并修复文档级写权限。真实 Vercel 接口已将测试申请 `4ce7b19c-a6a1-4a29-ab53-057bf30a3231` 从暂存恢复并写入现有飞书表，记录 ID 为 `reczz28NCSjEQYEo`；队伍名称明确标注“【网站联调测试，请忽略】三语申请接口验证”。重复请求继续返回同一回执。用户已授权发布；独立免费生产数据库 `nice-frc-applications-production` 已初始化，生产环境变量及正式收集开关已配置，等待部署与正式域名验收。Preview 已恢复关闭正式提交。

## 接口与数据

| 接口 | 作用 |
|---|---|
| `GET /api/applications` | 返回是否开放；Vercel Preview 未开放时允许只读演示填写流程 |
| `POST /api/applications` | 同源校验、持久化限流、100 KB 请求限制、服务端资格/必填/选项校验、提交幂等、飞书写入 |
| `GET /api/application-status?id=…` | 必须携带回执 Bearer 凭证，只返回该申请状态 |
| `GET /api/retry-applications` | 使用 `CRON_SECRET` 鉴权的定时任务；每次最多 5 个待处理申请 |

Vercel Cron 每 5 分钟执行一次，需支持该频率的套餐；Hobby 每天一次的限制不适用本配置。预览部署不运行生产 Cron。

提交先写入数据库，再尝试写入飞书。飞书临时故障返回 HTTP 202 和“已接收，处理中”，没有可靠暂存则不返回成功。仅飞书响应 `code=0` 且有 `record_id` 才标记 `synced`。

重复请求使用相同 UUID、答案快照及语言；同 UUID 不同内容返回冲突。飞书新增记录携带 UUIDv4 `client_token`。重试前按专用提交 UUID 字段搜索已有记录；超过 24 小时结果仍不确定的申请进入 `blocked`，交由人工核对，不依赖无限期的飞书幂等保证。

数据库包含：

- `nice_applications`：提交 UUID、答案 hash、短期答案 JSON、处理状态、尝试次数、租约、错误码及飞书记录 ID。
- `nice_application_rate`：按 10 分钟窗口计算的 HMAC 来源标识和请求计数，不保存原始 IP。

成功同步 24 小时后，Cron 清除暂存答案正文，保留回执及去重元数据；未同步的申请不能自动清除。数据库加密、备份与保留期按企业要求配置。日志不输出完整答案或凭据。关闭收集不影响截止前已接受申请的后续同步。

本期不根据 Team Number 强行拒绝新的申请；“每队原则上提交一份”仍需审核判断，避免恶意抢占队伍编号，也避免所有 `Pending` 队伍被误认为同一队。

## 故障恢复

- `pending`：等待下次重试。
- `syncing`：持有 60 秒租约；函数中断后可重新领取。
- `synced`：飞书已有确认记录。
- `blocked`：权限/字段/选项变动、长期结果不明或累计 12 次失败，需要管理员核对。

管理员按申请 UUID 查飞书专用字段。确认已存在一条正确记录后记录其 `record_id` 并标记成功；确认缺失且权限/结构已修复后，保持原 UUID 将任务重新排队。修复数据库状态前保留审计记录。轮换回执密钥会使旧回执查询凭证失效，应有计划地操作。

## 验证

```sh
npm run lint:content
npm run lint:i18n
npm run test:i18n
npm run test:applications
npm run check
npm run build
npm run preview -- --host 127.0.0.1 --port 4321
```

保持预览服务运行，在另一终端运行：

```sh
npm run test:application-browser
npm run test:browser
```

`test:application-browser` 使用已安装 Chrome，对本地 API 进行模拟，覆盖三语 × 桌面/手机 × 深浅主题、原问卷显示分支、恢复和完整提交；这不等于真实数据库/飞书联调。`test:browser` 的 Python 环境按 README 配置。

Vercel Preview 页面明确显示“预览版本”，提交按钮不会发送申请；服务端也保持收集关闭。生产环境缺少配置时只显示未开放提示。不得为了演示开启生产收集或使用真实个人信息作为测试数据。

首次验收还必须覆盖中国大陆、台湾地区及海外网络下的页面与提交接口。`vercel deploy` 预览成功不代表这些地区都已测试。
