# Expo 快速开发脚手架

当前仓库已经整理成一个以 Expo Router + Tailwind v4 + EAS 为主线的快速开发脚手架，覆盖：

- 多端 UI 骨架：`src/app/(tabs)` 四主 tab 页面
- API Routes：`src/app/api/*.ts`
- 统一请求/错误处理：`src/lib/api/*`
- 团队工程化：`husky`、`lint-staged`、GitHub CI、Issue/PR 模板
- 应用能力占位：React Query、认证占位、埋点接口
- 路由级错误边界与 404 页面
- EAS Build / Hosting / Update 脚本与工作流模板

## 快速开始

1. 安装依赖

   ```bash
   npm install
   ```

2. 复制环境变量模板

   ```bash
   cp .env.example .env
   ```

3. 本地开发

   ```bash
   npm run start
   npm run web
   ```

4. 本地验证 API Routes

   ```bash
   npm run serve
   curl http://localhost:8081/api/health
   curl -X POST http://localhost:8081/api/echo -H "Content-Type: application/json" -d '{"message":"hello"}'
   ```

## 当前脚手架结构

```text
src/
  app/
    (tabs)/          # 主 tab 页面
    api/             # Expo Router API Routes
    entry/[slug].tsx # 二级详情页占位
    +not-found.tsx   # 404 页面
    _layout.tsx      # 根 Stack + ErrorBoundary
  components/        # UI 组件与错误边界
  config/            # 环境变量与运行时配置
  data/              # 页面静态数据
  lib/api/           # API 客户端与服务端工具
  lib/telemetry/     # 埋点客户端入口
  providers/         # Query / Auth Provider
  tw/                # react-native-css 包装组件
```

## 开发约定

### 1. API 处理

- API Route 文件放在 `src/app/api/*+api.ts`
- 服务端统一工具放在 `src/lib/api/server.ts`
- 客户端统一请求入口放在 `src/lib/api/client.ts`
- 服务端错误优先抛 `StatusError`

### 2. 自定义组件

- 通用视觉组件放在 `src/components`
- 基础跨平台元素统一从 `src/tw` 导出，避免直接在页面里散落 `useCssElement`
- 需要自定义原生能力时，先走 `npx expo prebuild` / CNG；不要直接把平台文件塞进仓库根目录

### 3. 错误处理

- 路由级错误边界：`src/app/_layout.tsx`
- 404 页面：`src/app/+not-found.tsx`
- API 错误：`StatusError` + 统一 JSON envelope

### 4. 团队工程化

- Git 提交前钩子：`.husky/pre-commit`
- 增量检查：`lint-staged`
- CI：`.github/workflows/ci.yml`
- 模板：`.github/ISSUE_TEMPLATE/*`、`.github/pull_request_template.md`

### 5. 应用能力占位

- 数据层：`@tanstack/react-query`
- 认证占位：`src/providers/auth-provider.tsx`
- 埋点接口：`src/app/api/telemetry+api.ts`

## 打包与部署

### 类型与静态检查

```bash
npm run lint
npm run typecheck
```

### 测试

```bash
npm test -- --runInBand
```

说明：
- 当前 Jest 基线覆盖 API routes、client、provider、router 装配、关键页面状态与跳转。
- 详细测试边界与约定见 [docs/testing.md](./docs/testing.md)。

### Web / API Hosting

```bash
npm run build:web
npm run deploy:web
```

说明：
- 当前 `app.json` 已将 `expo.web.output` 设为 `server`，这是 Expo API Routes 的前提。
- 生产原生构建如果要使用相对 `fetch('/api/...')`，需要部署服务端并配置 Expo Router `origin`，或使用 `EXPO_UNSTABLE_DEPLOY_SERVER=1` 自动关联服务端部署。

### EAS Build

```bash
npm run build:preview:ios
npm run build:preview:android
npm run build:production
```

### OTA 更新

```bash
npm run update:preview
npm run update:production
```

## 官方文档基线

- Expo API Routes: https://docs.expo.dev/router/web/api-routes/
- Expo Router Error handling: https://docs.expo.dev/router/error-handling/
- Custom native code: https://docs.expo.dev/workflow/customizing/
- Deploy web apps: https://docs.expo.dev/deploy/web/
- EAS Update: https://docs.expo.dev/eas-update/introduction/
