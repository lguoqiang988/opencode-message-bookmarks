# opencode-collapse-user-messages

在 OpenCode 桌面端会话右侧加一条**消息书签栏**（类似 WorkBuddy）：每条你发送的消息对应一根小横线，
鼠标移上去展开消息列表，点一下就能跳到那条消息。

## 效果

- 会话右侧（时间线右边缘）一列小横线，一条对应一条用户消息。
- 鼠标移到横线上：左侧弹出面板，按顺序列出本次会话里你发过的所有消息（单行省略）。
- 当前滚动位置对应的那条会加粗加长，面板里对应行也会高亮并在右侧显示一小段横线。
- 点击任意横线或面板里的条目，会话滚动到那条消息，并把它放在标题栏下方。
- 消息很多时面板内部可滚动，横线列会自动跟随当前阅读位置。

## 安装

已安装到全局配置 `~/.config/opencode/opencode.jsonc`：

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["D:/OpenCode/plugins/opencode-collapse-user-messages"],
}
```

保存配置后 OpenCode 会自动加载，不需要重启。插件在 **Settings → Extensions → Plugins** 里显示为
`message-bookmarks`。

## 开关

命令面板执行 **Toggle message bookmarks / 切换消息书签栏** 可随时显示或隐藏，状态会记住。

## 实现方式

桌面端 GUI 插件（`./gui-experimental`）：

| 文件 | 作用 |
| --- | --- |
| `src/index.ts` | 服务端部分，只声明插件 id |
| `src/gui.tsx` | 注入样式、注册 `session.header` 插槽和开关命令 |
| `src/rail.tsx` | 书签栏与弹出面板（Solid 组件，Portal 到 body，`position: fixed`） |
| `src/jump.ts` | 读取时间线位置、计算当前消息、跳转到指定消息 |
| `src/rail.css` | 样式，颜色全部取自主题变量 |

几个关键点：

- **数据**：`ctx.client.message.list({ sessionID, type: "user", order: "desc" })` 拿到本次会话的用户消息，
  倒序取最近 200 条再反转，每 8 秒刷新一次（窗口可见时）。
- **定位**：插槽挂在 `session.header`，组件用一个隐藏节点 `closest('[data-slot="session-timeline-scroll"]')`
  找到自己所属的时间线滚动容器，再用 `getBoundingClientRect()` 把书签栏固定到它的右边缘，`ResizeObserver`
  跟随侧栏开关和窗口大小。
- **当前消息**：读时间线里可见的 `[data-timeline-row][data-message-id]`（这个属性是「该行所属的那条用户消息」），
  取离视口顶部最近的一条。
- **跳转**：时间线是虚拟列表，远处的消息在 DOM 里根本不存在，直接 `scrollIntoView` 没用。做法是
  1. 目标行已经挂载 → 直接精确滚动；
  2. 否则用「当前可见行属于哪条用户消息」做二分查找，逼近这条消息所在轮次的起点（每一行都带
     `data-message-id`，值是它所属的那条用户消息），再把它对齐到标题栏下方；
  3. 还找不到就退回应用自己的消息导航命令 `message.previous` / `message.next`（`ctx.commands.run`），
     一条条走到目标，应用自己负责展开、加载更早的历史、维护虚拟列表。

## 开发

```bash
npm install
npm run build     # 产出 dist/gui-experimental.cjs
npm run dev       # vite build --watch，改动会热重载到桌面端窗口
npm run typecheck
```

## 已知限制

- 只在桌面端（Electron）和浏览器里生效；终端 TUI 没有这套 DOM，插件不包含 TUI 部分。
- 跳转依赖应用自己的命令 id `message.previous` / `message.next`，OpenCode 改 id 时这里要跟着改。
- 消息列表只取最近 200 条用户消息（分页最多 1000 条），更早的历史不在书签栏里。
- 窄窗口（< 900px）下书签栏隐藏，避免挡住正文。
