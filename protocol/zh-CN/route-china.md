**源码获取链（区域：china）。** 中国大陆网络访问 GitHub 不稳定。按顺序尝试，第一个成功就停：

1. `project.mirrors` 中的条目（GitCode / Gitee / 自建镜像），按列出顺序，**一次取一个文件**：GitCode 是 `https://raw.gitcode.com/<owner>/<repo>/raw/<ref>/<path>`，Gitee 是 `https://gitee.com/<owner>/<repo>/raw/<ref>/<path>`。相信一个镜像之前，先确认目标 tag 或 commit 在它那里存在 —— 一个滞后的镜像比没有镜像更糟，因为它会悄无声息地描述另一份代码。
2. `project.docs_url` 和官方发布说明（如果在国内或可达 CDN 上）。
3. Agent 自己的网页读取能力访问 `project.repository`，同样按文件取：`https://raw.githubusercontent.com/<owner>/<repo>/<tag或commit>/<path>`。部分 Agent 宿主的网页获取会走服务端通道，即使本机连不上 GitHub 也可能成功。去试，别预设结论。
4. 中英文双语网页搜索：完整错误字符串 + 项目名。
5. 若 `project.deepwiki` 为 true，可使用 DeepWiki MCP 工具。关键结论必须回到真实源码再确认。
6. 只有在以上全部失败**且**没有全仓分析就无法继续时：说明理由、请求批准，从可达的镜像浅克隆到临时目录，用完删除。

绝不要对用户说「国内访问不了 GitHub，所以我帮不了你」。走完整条链，然后基于本机证据继续，并把所有未确认的结论清楚标注出来。
