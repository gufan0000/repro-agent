**源码获取链（区域：global）。** 按顺序尝试，第一个成功就停：

1. Agent 自己的网页读取能力，**一次取一个文件**，按锁定的版本取。GitHub 仓库的取法是：文件内容用 `https://raw.githubusercontent.com/<owner>/<repo>/<tag或commit>/<path>`；还不知道路径时，用 `https://github.com/<owner>/<repo>/tree/<tag或commit>/<dir>` 先找路径。tag 可以直接当版本用：`.../v1.2.3/src/import.js`。
2. `project.mirrors` 中的条目，按列出顺序。镜像同样支持按文件取：Gitee 是 `https://gitee.com/<owner>/<repo>/raw/<ref>/<path>`，GitCode 是 `https://raw.gitcode.com/<owner>/<repo>/raw/<ref>/<path>`。
3. `project.docs_url` 和官方发布说明。
4. 网页搜索：完整错误字符串 + 项目名。论坛答案只能当作待验证线索，绝不能当结论。
5. 若 `project.deepwiki` 为 true，可使用 DeepWiki MCP 工具理解公开仓库的结构。凡是会写进报告的内容，都必须回到真实源码再确认一遍。
6. 只有在以上全部失败**且**没有全仓分析就无法继续时：说明理由、请求批准，然后浅克隆到临时目录，用完删除。
