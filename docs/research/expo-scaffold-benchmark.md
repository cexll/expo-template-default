# Expo 快速脚手架对标分析

## 对标仓库

### 1. expo/expo

- 角色：官方事实基线
- 采纳：
  - 紧跟 `create-expo-app` 的默认工程结构
  - 配置尽量围绕 `app.json`、`eas.json`、`expo-router` 主线展开
  - 避免为了“模板感”引入脱离官方升级路径的重型封装
- 不采纳：
  - 不把整个官方模板体系复制进仓库，只保留当前项目需要的最小集合

### 2. roninoss/create-expo-stack

- 角色：初始化能力矩阵参考
- 采纳：
  - 把脚手架能力拆成模块化维度，例如 UI、API、部署、认证、数据层
  - 文档中明确“哪些能力已内置、哪些能力建议按需接入”
- 不采纳：
  - 不把当前仓库改造成交互式项目生成器，先把仓库自身做成高质量模板

### 3. ixartz/React-Native-Boilerplate

- 角色：工程化配套参考
- 采纳：
  - CI、lint、typecheck、编辑器配置、脚本入口
  - 清晰的开发/构建/部署文档
- 不采纳：
  - 暂不一次性引入 Jest、Detox、Storybook、Redux 等整套重量级设施

### 4. expo/expo-github-action

- 角色：官方 CI 集成参考
- 采纳：
  - GitHub Actions 中使用官方 Action 安装 Expo / EAS CLI
  - 在 PR 阶段验证 lint、typecheck、web export
- 不采纳：
  - 当前阶段不直接在 CI 里触发生产部署，避免把 secret 与发布策略绑死

### 5. EvanBacon/expo-router-spotify

- 角色：服务端能力与 Router 结合参考
- 采纳：
  - 使用 Expo Router API routes 承担服务端安全边界
  - 相对 `fetch('/api/...')` 与服务端统一错误处理
- 不采纳：
  - 暂不引入复杂认证流和第三方 OAuth，避免脚手架过早业务化

## 当前仓库应采纳的骨架

### 已完成

- Expo Router 主路由与 Tabs
- NativeWind / Tailwind v4 样式链
- API Routes 与 `expo-server`
- 路由级错误边界与 404 页面
- EAS Build / Hosting / Update 脚本

### 下一优先级

1. CI 主线
   - PR 跑 `lint` / `typecheck` / `expo export --platform web --no-ssg`
2. 配置主线
   - `src/config/app.ts` 统一读取公共环境变量
3. 数据主线
   - 选一个轻量数据层（SWR 或 TanStack Query），但按需接入
4. 能力模板化
   - 把“认证 / 数据层 / 监控 / 分析”整理成可插拔模块，而不是默认依赖

## 明确不做的事

- 不把仓库膨胀成“全家桶 boilerplate”
- 不为了模板完整性引入多套状态管理
- 不在当前阶段加入未验证收益的原生模块示例
- 不复制过时的 Expo Router 写法
