# AI 伙伴模拟器 - 产品需求文档 (V0.1 - MVP)

## 1. 产品定位与目标用户

- **产品名称 (暂定)**: AI 伙伴模拟器
- **定位**: 一个基于 Web 的个性化 3D AI 伙伴创建与交互平台。
- **核心价值**: 让用户能够轻松创造属于自己的、独一无二的 3D 机器人形象，并通过自然语言进行交流，获得陪伴感和趣味性。
- **目标用户**: 对 AI 技术、虚拟形象、个性化定制感兴趣的年轻用户、创意爱好者、或寻求新奇数字体验的用户。

## 2. MVP (Minimum Viable Product) 功能列表

- **用户引导流程**:
  - `FEAT-001`: 首次访问时，展示简洁的欢迎页面，介绍产品核心功能。
  - `FEAT-002`: 引导用户开始创建第一个机器人。
- **机器人创建与定制 (核心)**:
  - `FEAT-003`: 提供一个可视化编辑器界面。
  - `FEAT-004`: 提供不少于 3 种头、3 种躯干、2 种手臂、2 种腿部的预设 3D 部件供选择。
  - `FEAT-005`: 提供基础颜色选择器，允许用户修改选定部件的颜色。
  - `FEAT-006`: 在编辑器中实时预览机器人的外观组合效果。
  - `FEAT-007`: 提供“随机组合”按钮，快速生成一个随机外观。
  - `FEAT-008`: 提供“完成”按钮，保存当前机器人配置。
  - `FEAT-009`: 将用户创建的机器人配置数据存储在浏览器的 LocalStorage 中，以便下次访问时加载。
- **主交互界面**:
  - `FEAT-010`: 左侧或主要区域为 3D 视口，清晰展示用户创建的机器人模型。
  - `FEAT-011`: 机器人应有基础的待机动画（例如轻微浮动、呼吸感）。
  - `FEAT-012`: 右侧或下方为聊天界面，包含：
    - 对话记录展示区：按时间顺序显示用户和机器人的对话。
    - 文本输入框：供用户输入聊天内容。
    - 发送按钮。
- **基础文本聊天 (核心)**:
  - `FEAT-013`: 用户在输入框输入文本后，点击发送或按回车键。
  - `FEAT-014`: 前端将用户输入文本发送给选定的 LLM API (如 GPT-3.5-turbo 或 Gemini) (通过后端代理/Serverless Function)。
  - `FEAT-015`: 接收 LLM API 返回的文本回复。
  - `FEAT-016`: 将用户输入和机器人的文本回复追加到对话记录区。
- **语音回复 (TTS) (核心)**:
  - `FEAT-017`: 将 LLM 返回的文本回复发送给选定的 TTS API (Web Speech API 或 OpenAI TTS 等) (通过后端代理/Serverless Function)。
  - `FEAT-018`: 接收 TTS API 返回的音频数据或播放指令。
  - `FEAT-019`: 自动播放机器人回复的语音。
  - `FEAT-020 (可选增强)`: 播放语音时，机器人模型有简单的口型同步动画或指示（如头部轻微晃动）。

## 3. 核心用户流程

```mermaid
graph TD
    A[访问 Web 应用] --> B{检测 LocalStorage 中是否有机器人配置?};
    B -- 否 --> C[显示引导页 & 创建按钮];
    B -- 是 --> D[加载配置并直接进入主界面];
    C --> E[进入机器人定制界面];
    E --> F[用户选择部件/调整颜色];
    F --> G{预览满意?};
    G -- 是 --> H[保存配置到 LocalStorage];
    G -- 否 --> F;
    H --> D;

    subgraph 主界面
        I[3D 视口显示机器人(含待机动画)]
        J[聊天界面(记录区 + 输入框)]
        K[用户在输入框输入文本并发送] --> L{调用 LLM API(通过代理)};
        L -- 返回文本 --> M[更新聊天记录区];
        M --> N{调用 TTS API(通过代理)};
        N -- 返回音频 --> O[播放机器人语音(可选口型同步)];
    end
    D --> I & J;
    J --> K;
```

## 4. 技术选型建议 (Web MVP)

- **前端框架**: React 或 Vue
- **3D 库**: Three.js
- **UI 组件库**: Material UI (MUI) / Element Plus
- **状态管理**: Zustand / Pinia
- **LLM API**: OpenAI API (GPT-3.5-turbo)
- **TTS API**: Web Speech Synthesis API 或 OpenAI TTS API
- **3D 模型格式**: GLTF/GLB
- **部署/代理**: Vercel / Netlify (Serverless Functions)
- **API Key 处理**: 通过 Serverless Functions 或后端代理调用外部 API。

## 5. 架构设计 (Web MVP - 前端为主)

```mermaid
 graph LR
    subgraph "浏览器 (Client Frontend)"
        A[UI框架(React/Vue + MUI/Element+)] --> B(3D库 Three.js);
        A --> C(聊天/设置 UI 组件);
        B --> D(WebGL 渲染器 -> 3D场景 & GLB模型);
        C -- 用户交互 --> E[状态管理器 (Zustand/Pinia)];
        E -- 更新UI --> A;
        E -- 控制3D --> B;
        E -- 读/写 --> F[LocalStorage (机器人配置)];

        E -- 准备请求 --> G[API 调用模块];
        G -- 发送请求 --> H[Serverless Function (Vercel/Netlify) 或 轻量后端代理];
        H -- LLM 请求 --> I[LLM Service (OpenAI)];
        I -- LLM 响应 --> H;
        H -- TTS 请求 --> J[TTS Service (OpenAI/Web Speech)];
        J -- TTS 响应 --> H;
        H -- 返回数据 --> G;
        G -- 更新状态/触发播放 --> E;
        E -- 控制播放 --> K[Web Audio API / HTML Audio];
    end

    style E fill:#f9f,stroke:#333,stroke-width:2px
    style H fill:#ccf,stroke:#333,stroke-width:2px
```

## 6. 后续迭代方向 (MVP 之后)

- 增强定制 (更多部件、纹理、配件)
- 动作指令与动画系统
- 环境交互
- 用户账户与云端存储
- AI 能力升级 (AI 生成模型、语音识别等)
