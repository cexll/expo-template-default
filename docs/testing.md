# Testing

本仓库当前测试层只覆盖脚手架核心路径，不追求大而全。

## Scope

- API routes：校验成功分支、输入校验和错误分支。
- API client / telemetry client：校验请求协议、网络失败和响应解析失败。
- Providers：校验 `AuthProvider` 与 `AppProviders` 的基本状态与注入行为。
- Router 集成：校验根布局中的 Provider 装配和 tabs 入口可渲染。
- Screen 行为：校验首页状态机、`me` 页认证交互、详情页 slug 映射、关键列表跳转。
- Error / 404：校验 `AppErrorBoundary` 和 `+not-found` 的兜底渲染。

## Commands

```bash
npm test -- --runInBand
npm run lint
npm run typecheck
```

`--runInBand` 是当前仓库的默认推荐测试方式。Expo Router、React Native 和全局 mock 混在一起时，并行跑测试的收益不大，噪音更高。

## Conventions

- 页面测试优先直接渲染真实页面组件，只 mock 外部依赖，例如 `expo-router`、`expo-status-bar`、网络请求。
- Router 测试优先使用 `expo-router/testing-library`，不要手写一套假的导航容器。
- 对异步首屏请求，测试里要么 `waitFor` 收敛到最终状态，要么把 Promise 保持 pending 并用 `act` 清理，避免 React warning。
- `react-native-css`、CSS 文件和部分 Expo 依赖已经在 Jest 基线里做了最小 mock；新增测试优先复用现有基线，不要再加一层测试框架抽象。

## Current Gaps

- 还没有覆盖 `contacts` / `discover` 之外更深的导航链路，例如 tabs 切换历史与返回栈协同。
- 还没有覆盖 web-only 或 native-only 平台分支。
- 还没有引入 E2E。只有在路由、状态和 API 协议的单元/集成测试稳定后，才考虑加 Detox 或浏览器自动化。
