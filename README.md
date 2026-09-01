# 极简记账 (iOS Minimal Expense & Ledger)

<p align="center">
  <img src="./public/icon-192.png" width="96" height="96" alt="Logo" style="border-radius: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);" />
</p>

<p align="center">
  <b>iOS 质感优先的极简跨端多币种记账与资产管理应用</b>
</p>

<p align="center">
  <a href="https://ios-accounting-app.pages.dev">🌐 在线体验 (Demo)</a> •
  <a href="#-ios-安装与添加到主屏幕教程">📱 iOS 安装教程</a> •
  <a href="#-核心特性">✨ 核心特性</a> •
  <a href="#-技术栈">🛠️ 技术栈</a>
</p>

---

## 🌟 在线体验与访问

- **公网生产环境 (Cloudflare Pages)**：[https://ios-accounting-app.pages.dev](https://ios-accounting-app.pages.dev)
- **Local-First (本地优先)**：无需注册登录，数据完全存储在手机/浏览器本地 IndexedDB 中，安全私密，秒级响应，断网亦可顺畅记账。

---

## ✨ 核心特性

### 1. ⚡ 记账零摩擦与自定义计算键盘
- **闪电记录**：底部悬浮加号（+）一触即发，支持支出/收入快速切换。
- **内置算式运算器**：数字键盘自带 `+`、`-`、`×`、`÷` 及百分比即时换算，买单结账无需跳出切换计算器。
- **iOS 拟真触感与音效**：基于 Web Audio API 实现 iOS 键盘轻脆的点选音效与 Haptic 震动，可随时在设置中开关。

### 2. 💱 多币种原生支持与实时/离线汇率引擎
- **160+ 全球法币**：内置 CNY, USD, EUR, JPY, GBP, HKD, AUD, CAD, KRW 等全球法定货币。
- **双模汇率引擎**：联网时一键同步汇率市场基准价，离线断网自动启用本地缓存与基准汇率兜底。
- **汇率历史锚定**：每笔流水同时保存「交易币种及金额」、「记账时汇率」与「折算主币种金额」，避免未来汇率浮动破坏历史报表严肃性。

### 3. 📊 多维资产总览与动态数据分析
- **净资产看板**：汇总多币种账户，自动折算为主币种展示「总资产」、「总负债」与「净资产」。
- **收支走势分析**：贝塞尔曲线收支走势图与多色圆环占比图，直观展现日、周、月财务健康度。
- **资产划转**：支持各币种账户间互转（例如人民币卡购汇转账至美元卡）。

### 4. 🌓 原生 iOS 视觉质感与暗黑模式
- 精心设计的 iOS Cupertino 毛玻璃 Dock 栏与卡片层次。
- 完整适配 **浅色 (Light)**、**深色 (Dark)** 与 **跟随系统 (System)** 模式，沉浸式深黑 OLED 背景。

### 5. 🛡️ 数据主权与导出导入
- **一键导出 CSV**：生成带有 UTF-8 BOM 的标准财务报表，Excel、Numbers 或飞书表格直接打开不乱码。
- **数据恢复与重置**：支持 CSV 数据快速批量恢复，提供全量数据安全清空功能。

---

## 📱 iOS 安装与「添加到主屏幕」教程

本项目全面配置了 **Apple Web Clip** 与 **PWA 规范**，在 iPhone / iPad 上安装仅需 3 秒，无需证书与签名，永久有效：

1. 打开 iPhone / iPad 上的 **Safari 浏览器**，访问：[https://ios-accounting-app.pages.dev](https://ios-accounting-app.pages.dev)
2. 点击 Safari 底部中央的 **「分享」** 按钮（矩形框带向上箭头 ⎋）。
3. 向上轻滑菜单，选择 **「添加到主屏幕」** (Add to Home Screen)。
4. 右上角点击 **「添加」**。
5. 返回桌面即可看到独立的「极简记账」应用图标，点击进入即为 **完全沉浸式全屏 App**（自动隐藏地址栏与导航条）。

---

## 🛠️ 技术栈

- **Core & UI**：React 19, TypeScript, Tailwind CSS, Lucide React, Framer Motion
- **Database**：Dexie.js (IndexedDB Local-First Engine)
- **Deployment & Hosting**：Cloudflare Pages / Wrangler
- **Build Tool**：Vite 6

---

## 💻 本地开发指南

```bash
# 1. 克隆代码仓库
git clone https://github.com/zonlic0925-boop/ios-accounting-app.git
cd ios-accounting-app

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev

# 4. 构建生产代码
npm run build

# 5. 预览生产环境
npm run preview
```

---

## 📄 开源许可证

MIT License © 2026
