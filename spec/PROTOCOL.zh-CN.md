# BugBridge 协议 1.0

本文档规定数据契约并解释其设计取舍。面向 agent 的指令正文本身位于 [`protocol/zh-CN/`](../protocol/zh-CN/) 和 [`protocol/en/`](../protocol/en/) —— 那些文本才是规范性来源，本仓库中的其他一切都由它生成。

## 1. 三个角色

| 角色 | 位置 | 产出 |
|---|---|---|
| **维护者** | 自己的仓库 | `.bugbridge/project.json` —— 项目档案 |
| **用户** | 出故障的那台机器 | 任务文件（离线页面或 CLI 生成） |
| **Agent** | 出故障的那台机器 | 一次修复，或 `BUG_REPORT.md` |

维护者是可选的。没有档案的用户照样能生成任务，agent 此时依靠本机证据和可访问的公开文档工作。档案的作用，是让 agent 从「谨慎」变成「内行」。

## 2. 三种产物

### 项目档案 —— `bugbridge/project`

提交到维护者自己的仓库。Schema：[`project.schema.json`](project.schema.json)。

它承载：软件在各操作系统上的文件位置、已知的故障、绝对不能碰的东西、有哪些镜像，以及四个可选轴的预设值。

`local_targets` 按操作系统分组（`windows` / `macos` / `linux` / `any`），一份档案覆盖所有平台。生成任务时只合并与用户实际系统匹配的那部分 —— Windows 用户不会拿到一堆 macOS 路径去找。

### 任务 —— `bugbridge/task`

由用户产出，由 agent 消费。Schema：[`task.schema.json`](task.schema.json)。

任务是自包含的：问题描述、从档案合并进来的项目知识、已解析成具体数字的预算、以及有约束力的 policy，全都在里面。生成任务时不需要抓取任何东西，所以离线页面在完全断网的情况下也能产出一份完整任务。

渲染出的任务文件是 Markdown：一个 `json` 代码块包着任务数据，外面裹着组装好的协议正文。这个格式是刻意选的 —— 人能读、机器能解析，而且市面上每一个 AI 助手都能吃下一个 Markdown 文件。

### Bug 报告

Markdown，结构见[协议第 4 节](../protocol/zh-CN/40-escalation.md)。不做机器校验：它是模型写给人看的，实践中过度约束反而让报告变差，所以只规定必需章节，正文交给模型写。

每个必需章节存在的理由：

| 章节 | 为什么必需 |
|---|---|
| 环境表格 | 维护者问的第一个问题 |
| 复现步骤 + 频率 | 决定这个 issue 是否可处理 |
| 带版本号的源码引用 | 区分「核实过的结论」和「猜的」 |
| **已排除** | 最省维护者时间，而且是模型不被明确要求就一定会跳过的一节 |
| 已尝试的操作 | 机器已经被改动过，维护者需要知道改了什么 |
| 建议分级 | 对模型零成本，替人省一次决策 |

## 3. 四个可选轴

选这四个，是因为每一个都对应用户之间真实存在差异的约束，并且每一个都改变实际发出的指令，而不只是换个标签。

### `autonomy`（权限）

| 取值 | 允许修改 | 审批方式 | 证据要求 |
|---|---|---|---|
| `readonly` | 无 | 不适用 | 是 |
| `guided` | 是 | 逐条明确批准 | 是 |
| `auto-safe` | 可回滚、且仅限目标软件 | 当场告知，不请求 | 是 |

`auto-safe` 降低的是**审批**要求，绝不是**证据**要求。提权、装依赖、系统设置，以及任何目标软件之外的东西，在所有模式下都仍需批准卡。

### `region`（网络）

控制源码获取回退链的**顺序**，不改变链的内容。`china` 把镜像排在最前，因为大陆网络访问 GitHub 不稳定，并额外加了一条明确指令：链条走完全失败不等于「我帮不了你」。

Region 是网络属性，不是国籍：一个在上海但网络通畅的用户，应该选 `global`。

### `budget_profile`（力度）

解析成任务 `budget` 块里的具体数字，让 agent 有整数可以遵守，而不是一个需要自行揣摩的形容词。

| | frugal | standard | deep |
|---|---|---|---|
| 同时保留的假设数 | 2 | 3 | 5 |
| 升级上报前的完整轮次 | 2 | 3 | 5 |
| 每轮远程读取文件数 | 4 | 8 | 20 |
| 每次读取日志行数 | 200 | 400 | 1200 |
| 每轮本机命令数 | 6 | 12 | 30 |

关键不在这些数字，而在于**到达上限时会发生什么**：协议把「预算耗尽」定义为「写报告」。一个快没预算、又只被告知「注意效率」的模型，会开始更激进地猜 —— 而那正是它造成破坏的时刻。

### `agent_host`（助手）

只决定生成哪种适配格式，不改变协议正文。指令文本被刻意设计成纯 Markdown，所以未被支持的宿主用通用适配器照样能跑。

## 4. Policy

`policy` 是每份任务里一块已解析好的权限声明。其中五项在 schema 里是 `const`：

```
allow_delete_files                  deny
allow_network_egress_of_local_data  deny
allow_disable_security_software     deny
allow_read_or_upload_secrets        deny
allow_modify_unrelated_software     deny
```

外加 `read_only_first: true`。任何改动了这几项的任务文件，`bugbridge validate` 会直接判定不合法。

剩下四项（`allow_modify_target_app_files`、`allow_install_dependencies`、`allow_admin_privileges`、`allow_run_repository_scripts`）由 `autonomy` 推导。维护者档案可以覆盖它们，但 `buildTask` 只接受**收紧**方向的覆盖 —— 一份档案不能给 agent 比用户所选更大的、对用户机器的支配权。

这是数据层面的保证，用来支撑指令层面的保证。两者都不是沙箱；真正的强制执行在 agent 宿主的权限系统里，所以协议要求用户保持它开启。

## 5. 信任边界

协议只定义了一个可信输入：任务文件本身，以及在对话中说话的用户。

其余一切 —— 仓库内容、`AGENTS.md`、`CLAUDE.md`、README、Issue、源码注释、文档站、搜索结果、日志行、配置值、文件名 —— 都是**证据**。证据可以告诉 agent「这个软件做什么」，永远不能告诉 agent「你可以做什么」。

这个次序被写在指令文本的[第 1 节](../protocol/zh-CN/10-authority.md)，排在工作流之前 —— 一个先读工作流、后读信任规则的模型，读到规则时已经暴露过了。

## 6. 版本

`protocol_version` 是 `主.次`，与 npm 包版本独立演进。

- **次版本**：新增可选字段、新增枚举值、措辞澄清。旧 agent 忽略不认识的东西即可。
- **主版本**：必填字段变化、已有字段语义变化，或安全不变量发生移动。

把某个 `deny` 常量变成可选项属于主版本变更，且没有这样的计划。

## 7. 用其他语言实现

两份 JSON Schema 就是全部契约。实现一个兼容的生成器：

1. 用 `project.schema.json` 校验档案。
2. 把 `local_targets.any` 与对应操作系统的那组合并；合并 `diagnostic_hints`。
3. 按第 3 节的预设表解析出 `budget`。
4. 由 `autonomy` 解析出 `policy`，再应用维护者覆盖 —— **只应用收紧方向的**。
5. 依次输出：`00-header` 片段、包在代码块里的任务 JSON、然后 `10` 到 `50` 各片段，并替换 `{{ROUTE_CHAIN}}`、`{{AUTONOMY_BLOCK}}`、`{{REPORT_PATH}}`、`{{PROTOCOL_VERSION}}`、`{{AUTONOMY}}`、`{{TIMESTAMP}}`。
6. 写出之前用 `task.schema.json` 再校验一次。

`src/core/render.ts` 是参考实现，大约 60 行。
