# 构建与部署指南

本项目基于 Expo SDK 55，支持 iOS、Android、Web 和 PWA 四个平台。

## 目录

- [环境要求](#环境要求)
- [项目结构](#项目结构)
- [开发调试](#开发调试)
- [iOS 构建与上架](#ios-构建与上架)
- [Android 构建与上架](#android-构建与上架)
- [Web / PWA 构建与部署](#web--pwa-构建与部署)
- [EAS Build 配置说明](#eas-build-配置说明)
- [版本管理](#版本管理)
- [CI/CD 集成](#cicd-集成)
- [常见问题](#常见问题)

---

## 环境要求

| 工具 | 版本要求 | 说明 |
|------|----------|------|
| Node.js | >= 18 | 推荐 LTS 版本 |
| npm | >= 9 | 随 Node.js 安装 |
| EAS CLI | >= 15.0.0 | `npm install -g eas-cli` |
| Xcode | >= 15 | iOS 本地构建需要（仅 macOS） |
| Android Studio | latest | Android 本地构建需要 |
| CocoaPods | >= 1.15 | iOS 依赖管理（仅 macOS） |

### 开发者账号

| 平台 | 费用 | 注册地址 |
|------|------|----------|
| Expo | 免费 | https://expo.dev/signup |
| Apple Developer Program | $99/年 | https://developer.apple.com/programs/ |
| Google Play Console | $25（一次性） | https://play.google.com/console |

---

## 项目结构

```
.
├── app.json                 # Expo 应用配置（图标、名称、平台参数）
├── eas.json                 # EAS Build / Submit 配置
├── metro.config.js          # Metro bundler 配置
├── eslint.config.js         # ESLint 代码检查配置
├── tsconfig.json            # TypeScript 配置
├── package.json             # 依赖与脚本
├── .eas/workflows/          # EAS 工作流模板
├── .github/workflows/       # GitHub CI
├── public/                  # Web 静态资源（PWA 文件）
│   ├── manifest.json        # PWA Web App Manifest
│   ├── sw.js                # Service Worker
│   └── icons/               # PWA 图标 (192x192, 512x512)
├── src/
│   ├── app/                 # 页面路由（Expo Router 文件路由）
│   │   ├── _layout.tsx      # 根布局
│   │   ├── +html.tsx        # Web HTML 模板（PWA meta 注入）
│   │   ├── api/             # API Routes
│   │   ├── (tabs)/          # 四主 tab 页面
│   │   └── entry/           # 二级详情页
│   ├── components/          # 可复用组件
│   ├── constants/           # 常量（主题等）
│   ├── config/              # 应用级环境变量与配置入口
│   ├── hooks/               # 自定义 Hooks
│   ├── lib/                 # API 与基础设施工具
│   └── types/               # TypeScript 类型声明
├── assets/                  # 图片、图标、字体等静态资源
├── ios/                     # iOS 原生项目（prebuild 生成，已 gitignore）
├── android/                 # Android 原生项目（prebuild 生成，已 gitignore）
└── dist/                    # Web 构建输出（已 gitignore）
```

---

## 开发调试

```bash
# 安装依赖
npm install

# 启动开发服务器（支持扫码在真机调试）
npm start

# 启动 Web 开发服务器
npm run web

# 本地运行 iOS（需要 macOS + Xcode）
npm run ios

# 本地运行 Android（需要 Android Studio）
npm run android

# 代码检查
npm run lint

# TypeScript 类型检查
npx tsc --noEmit
```

---

## iOS 构建与上架

### 前置准备

1. 注册 [Apple Developer Program](https://developer.apple.com/programs/)
2. 在 [App Store Connect](https://appstoreconnect.apple.com) 创建 App，获取 **ASC App ID**
3. 记录你的 **Apple Team ID**（可在 developer.apple.com 的 Membership 页面找到）

### 方式一：EAS Build 云端构建（推荐）

无需 macOS，Expo 云端服务器构建。

```bash
# 登录 Expo 和 Apple Developer
eas login
eas build --platform ios --profile production
```

首次构建时 EAS 会提示：
- 登录 Apple Developer 账号
- 自动创建/管理 Distribution Certificate 和 Provisioning Profile（选 **Let EAS handle it**）

构建完成后获得 `.ipa` 文件下载链接。

#### 提交到 App Store

**自动提交：**

先在 `eas.json` 中配置真实的 Apple 账号信息：

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "你的AppleID@example.com",
        "ascAppId": "App Store Connect 中的 App ID（纯数字）",
        "appleTeamId": "你的 Team ID"
      }
    }
  }
}
```

然后执行：

```bash
eas submit --platform ios --profile production
```

或构建时自动提交：

```bash
eas build --platform ios --profile production --auto-submit
```

**手动提交：**

1. 下载构建好的 `.ipa` 文件
2. macOS 上使用 [Transporter](https://apps.apple.com/app/transporter/id1450874784) 上传
3. 或命令行：`xcrun altool --upload-app -f app.ipa -t ios -u APPLE_ID -p APP_SPECIFIC_PASSWORD`

### 方式二：本地构建

```bash
# 生成原生项目
npx expo prebuild --platform ios

# 安装 CocoaPods 依赖
cd ios && pod install && cd ..

# 在 Xcode 中打开项目
open ios/HelloWorld.xcworkspace
```

在 Xcode 中：
1. 选择 **Generic iOS Device** 作为目标
2. **Product** -> **Archive**
3. Archive 完成后 -> **Distribute App** -> **App Store Connect**

### App Store Connect 信息填写

| 必填项 | 说明 |
|--------|------|
| 应用名称 | 商店显示名称，支持多语言本地化 |
| 副标题 | 30 字以内的简短描述 |
| 描述 | 完整的功能介绍 |
| 截图 | 至少 6.7" (iPhone 15 Pro Max) 和 6.5" 两套 |
| 关键词 | 搜索关键词，逗号分隔，100 字符以内 |
| 隐私政策 URL | **必须提供**，指向你的隐私政策页面 |
| 技术支持 URL | 用户获取帮助的页面 |
| 年龄分级 | 填写内容问卷后自动计算 |
| App 审核信息 | 如需登录，提供测试账号密码 |

提交后等待 Apple 审核，通常 **1-3 个工作日**。

---

## Android 构建与上架

### 前置准备

1. 注册 [Google Play Console](https://play.google.com/console)
2. 创建应用
3. （自动提交时需要）创建 Google Cloud Service Account：
   - 进入 [Google Cloud Console](https://console.cloud.google.com)
   - 创建 Service Account，下载 JSON 密钥
   - 在 Google Play Console -> **设置** -> **API 访问权限** 中关联该 Service Account
   - 授予 **Release Manager** 权限
   - 将密钥文件保存为 `google-service-account.json`（已在 .gitignore 中）

### 方式一：EAS Build 云端构建（推荐）

```bash
eas build --platform android --profile production
```

- 首次构建 EAS 会自动生成 Android 签名密钥并安全托管
- 构建输出为 `.aab` 格式（Google Play 要求的 App Bundle）

#### 提交到 Google Play

**自动提交：**

```bash
eas submit --platform android --profile production
```

或构建时自动提交：

```bash
eas build --platform android --profile production --auto-submit
```

**手动提交：**

1. 下载 `.aab` 文件
2. 登录 Google Play Console
3. 进入应用 -> **发布** -> **正式版** -> **创建新版本** -> 上传 `.aab`

### 方式二：本地构建

```bash
# 生成原生项目
npx expo prebuild --platform android

# 构建 Release AAB
cd android && ./gradlew bundleRelease && cd ..

# 输出文件位置
# android/app/build/outputs/bundle/release/app-release.aab
```

### Google Play Console 信息填写

| 必填项 | 说明 |
|--------|------|
| 商品详情 | 标题（30 字）、简短描述（80 字）、完整描述（4000 字） |
| 截图 | 手机至少 2 张；7 寸和 10 寸平板各至少 1 张 |
| 高分辨率图标 | 512 x 512 PNG |
| 置顶大图 | 1024 x 500 PNG（可选但推荐） |
| 内容分级 | 填写 IARC 问卷 |
| 目标受众 | 声明是否面向儿童 |
| 隐私权政策 | **必须提供** URL |
| 数据安全 | 声明应用收集和共享的数据类型 |

### 发布轨道

Google Play 支持分阶段发布：

```
内部测试 (Internal)     最多 100 人，无需审核
    ↓
封闭测试 (Closed)       邀请制，需审核
    ↓
开放测试 (Open)         所有人可参与，需审核
    ↓
正式发布 (Production)   上架商店
```

建议先从内部测试开始逐步推进。

---

## Web / PWA 构建与部署

### 构建

```bash
npm run build:web
```

输出到 `dist/` 目录，包含：
- 静态 HTML 页面（SSG，支持 SEO）
- JS/CSS bundle（带内容哈希）
- PWA 文件（manifest.json、sw.js、icons）

### PWA 功能

本项目已配置完整的 PWA 支持：

| 功能 | 文件 | 说明 |
|------|------|------|
| Web App Manifest | `public/manifest.json` | 应用名称、图标、主题色、独立模式 |
| Service Worker | `public/sw.js` | 网络优先 + 缓存回退策略 |
| PWA 图标 | `public/icons/` | 192x192 和 512x512 |
| Meta 标签 | `src/app/+html.tsx` | theme-color、apple-mobile-web-app-capable 等 |

用户在移动端浏览器中可通过 **"添加到主屏幕"** 将应用安装为 PWA。

### 部署方式

#### Vercel（推荐）

```bash
npm install -g vercel
vercel dist/
```

或关联 Git 仓库后自动部署。

#### Netlify

```bash
npm install -g netlify-cli
netlify deploy --dir=dist --prod
```

#### Cloudflare Pages

```bash
npm install -g wrangler
wrangler pages deploy dist/
```

#### GitHub Pages

在仓库 Settings -> Pages 中设置 Source 为 GitHub Actions，创建工作流：

```yaml
# .github/workflows/deploy-web.yml
name: Deploy Web
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build:web
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - uses: actions/deploy-pages@v4
```

#### Nginx 自建服务器

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/helloworld/dist;
    index index.html;

    # SPA 路由回退
    location / {
        try_files $uri $uri.html $uri/ /index.html;
    }

    # 静态资源长期缓存
    location /_expo/static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Service Worker 不缓存
    location /sw.js {
        expires off;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
```

---

## EAS Build 配置说明

`eas.json` 包含三个构建配置：

### development - 开发调试

```bash
eas build --profile development --platform ios    # iOS 模拟器
eas build --profile development --platform android # Android APK
```

- 包含 Development Client（支持热重载）
- iOS 构建为模拟器版本
- 用于日常开发调试

### preview - 内部测试

```bash
eas build --profile preview --platform ios     # iOS Ad Hoc（真机）
eas build --profile preview --platform android  # Android APK
```

- iOS 使用 Ad Hoc 分发（需要注册设备 UDID）
- Android 输出 APK 方便直接安装
- 用于团队内部测试

### production - 正式发布

```bash
eas build --profile production --platform ios     # iOS IPA -> App Store
eas build --profile production --platform android  # Android AAB -> Google Play
```

- 版本号自动递增（`autoIncrement: true`）
- iOS 构建 IPA 用于 App Store 提交
- Android 构建 AAB (App Bundle) 用于 Google Play 提交

### 同时构建双平台

```bash
eas build --profile production --platform all
```

### 构建并自动提交

```bash
eas build --profile production --platform all --auto-submit
```

---

## 版本管理

### 版本号说明

| 字段 | 位置 | 说明 |
|------|------|------|
| `version` | app.json | 用户可见版本号（如 1.0.0），遵循语义化版本 |
| `ios.buildNumber` | app.json | iOS 构建号，每次提交 App Store 必须递增 |
| `android.versionCode` | app.json | Android 版本代码，每次提交 Google Play 必须递增 |

### 使用 EAS 自动管理版本号

`eas.json` 中已配置：

```json
{
  "cli": {
    "appVersionSource": "remote"
  },
  "build": {
    "production": {
      "autoIncrement": true
    }
  }
}
```

EAS 会自动跟踪并递增 `buildNumber` 和 `versionCode`，无需手动修改。

### 手动发版流程

```bash
# 1. 更新用户可见版本号
# 修改 app.json 中的 "version": "1.1.0"

# 2. 构建（buildNumber/versionCode 自动递增）
eas build --platform all --profile production

# 3. 提交上架
eas submit --platform all --profile production
```

---

## CI/CD 集成

### GitHub Actions 自动构建示例

```yaml
# .github/workflows/eas-build.yml
name: EAS Build
on:
  push:
    tags:
      - 'v*'  # 推送 tag 时触发（如 v1.0.0）

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      # 类型检查 + Lint
      - run: npx tsc --noEmit
      - run: npx expo lint

      # 构建双平台
      - run: eas build --platform all --profile production --non-interactive

      # 自动提交到商店（可选）
      # - run: eas submit --platform all --profile production --non-interactive
```

需要在 GitHub Secrets 中配置 `EXPO_TOKEN`（从 https://expo.dev/accounts/[username]/settings/access-tokens 获取）。

---

## 常见问题

### Q: 首次构建 iOS 需要做什么？

EAS 首次构建会引导你登录 Apple Developer 账号并自动创建证书。选择 **Let Expo handle it** 即可。你也可以使用 `eas credentials` 手动管理证书。

### Q: Android 签名密钥丢了怎么办？

如果使用 EAS 托管签名密钥，可以随时通过 `eas credentials` 下载备份。请务必妥善保管——上传到 Google Play 的签名密钥无法更换。

### Q: 如何在本地不使用 EAS 构建？

```bash
# 生成原生项目
npx expo prebuild

# iOS - 在 Xcode 中 Archive
open ios/HelloWorld.xcworkspace

# Android - Gradle 构建
cd android && ./gradlew bundleRelease
```

### Q: PWA 的 Service Worker 如何更新？

修改 `public/sw.js` 中的 `CACHE_NAME`（如从 `helloworld-v1` 改为 `helloworld-v2`），重新部署后浏览器会自动获取新版本并清理旧缓存。

### Q: 如何添加推送通知？

```bash
npx expo install expo-notifications
```

然后在 `app.json` 的 plugins 中添加配置，参考 [Expo Push Notifications 文档](https://docs.expo.dev/push-notifications/overview/)。

### Q: 如何回退到之前的版本？

- **iOS**: 在 App Store Connect 中移除当前版本，重新提交旧版本的 IPA
- **Android**: 在 Google Play Console 中暂停发布，创建新版本上传旧 AAB（versionCode 必须更大）
- **Web**: 重新部署对应 Git commit 的构建产物
- **OTA 更新**: 使用 `eas update --branch production` 可以绕过商店审核推送 JS 更新

### Q: 构建失败怎么排查？

```bash
# 查看构建日志
eas build:list
eas build:view [BUILD_ID]

# 清理并重新生成原生项目
npx expo prebuild --clean

# 验证配置
npx expo-doctor
```
