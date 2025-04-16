# ChatRobot (open_ic)

一个 Web 应用程序，具有聊天界面和可定制的 3D 机器人化身，使用 React、TypeScript、Vite 和 Three.js 构建。

## ✨ 特性

- 交互式聊天界面。
- 机器人模型的实时 3D 可视化。
- 不同机器人部件（头部、躯干、手臂、腿部）的定制控件。

## 🛠️ 技术栈

- **前端:** React 19, TypeScript
- **构建工具:** Vite
- **3D 渲染:** Three.js, @react-three/fiber, @react-three/drei
- **代码检查:** ESLint

## 🚀 快速开始

### 环境要求

- Node.js (推荐 v18 或更高版本)
- Yarn (v1.22 或更高版本)

### 安装

1.  克隆仓库：
    ```bash
    git clone git@github.com:theBigGavin/ChatRobot.git
    ```
2.  进入项目目录：
    ```bash
    cd ChatRobot
    ```
3.  安装依赖：
    ```bash
    yarn install
    ```

### 运行开发服务器

启动具有热模块替换 (HMR) 功能的开发服务器：

```bash
yarn dev
```

打开浏览器并访问提供的 URL (通常是 `http://localhost:5173`)。

## 📦 构建生产版本

创建优化的生产构建：

```bash
yarn build
```

输出文件将生成在 `dist/` 目录中。你可以使用以下命令在本地预览生产构建：

```bash
yarn preview
```

## ✨ 代码检查

检查代码中的 lint 错误：

```bash
yarn lint
```

## 📄 许可证

该项目当前未指定许可证。
