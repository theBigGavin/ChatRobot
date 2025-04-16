# 详细设计文档 (草稿)

**项目:** 蒸汽朋克 AI 机器人互动体验 V2 (Project Cogsworth)
**版本:** 0.1 (基于需求清单 v1)

**1. 系统架构概述**

- **前端 (浏览器):** 负责 UI 渲染、3D 场景管理、用户交互、状态管理、调用后端代理。
  - 技术栈: React, TypeScript, React Three Fiber (R3F), Drei, Zustand/Jotai, Howler.js, CSS (Tailwind/Modules)。
- **后端代理 (Serverless/Node.js):** 负责安全调用外部 API、处理简单业务逻辑。
  - 技术栈: Node.js (Express/NestJS) 或 Serverless Functions (Vercel/Netlify)。
- **外部服务:**
  - **AI 模型:** 云 AI 服务 API (如 OpenAI GPT, Google Gemini)。
  - **TTS 服务:** Web Speech API (初期) -> 云 TTS 服务 (后期，如 AWS Polly, Google TTS)。

**2. 前端组件设计 (React)**

- **`App.tsx`:** 顶层组件，负责整体布局和路由（如果需要）。
- **`MachineInterface.tsx`:** 模拟机器外壳，包含左右两侧布局。
- **`CRTScreen.tsx` (左侧):**
  - 内嵌 `RobotViewer.tsx`。
  - 负责实现 CRT 屏幕的视觉效果（着色器后处理：球形失真、扫描线、辉光、抖动、干扰等）。
  - 管理屏幕启动/唤醒动画序列。
  - 接收并应用辉光强度变化。
- **`RobotViewer.tsx` (内嵌于 CRT):**
  - 使用 R3F 搭建 3D 场景。
  - 加载并管理机器人模型（基于当前配置）。
  - 播放机器人动画（入场、待机、表情动作、口型同步）。
  - 管理 3D 场景光照和背景（动态实验室）。
- **`Dashboard.tsx` (右侧):**
  - 组织仪表盘内各区域 (`GachaControls`, `StatusMeters`, `ChatConsole`, `PhysicalControls`)。
- **`GachaControls.tsx` (右上):**
  - 显示 4 个部件轮盘 (`PartReel.tsx` x4)。
  - 包含红/绿核心按钮 (`CoreButton.tsx`)。
  - 管理抽卡动画流程状态。
- **`PartReel.tsx`:** 单个部件轮盘，负责滚动动画和显示结果。
- **`CoreButton.tsx`:** 红/绿核心按钮，处理点击事件和状态变化（颜色、灯效）。
- **`StatusMeters.tsx` (右中):**
  - 包含 `PressureMeter.tsx`, `HeatIndicator.tsx`, `SyncMeter.tsx` 等仪表组件。
  - 接收状态数据并更新仪表显示。
- **`MeterComponents.tsx` (各种仪表):** 实现具体的仪表盘视觉和动画。
- **`ChatConsole.tsx` (右下):**
  - 显示聊天历史 (`ChatHistory.tsx`)。
  - 包含用户输入区 (`UserInput.tsx`)。
  - 管理文字流式打印、光标、滚动。
- **`ChatHistory.tsx`:** 渲染聊天记录。
- **`UserInput.tsx`:** 处理用户输入、提示符、打字音效。
- **`PhysicalControls.tsx` (右侧/下方):**
  - 包含 `ToggleSwitch.tsx`, `RotaryKnob.tsx`, `AuxButton.tsx` 等物理控件组件。
  - 处理用户交互并触发相应状态变更或事件。

**3. 状态管理 (Zustand/Jotai Store)**

- **`robotConfig`:** 当前机器人的部件 ID、性格核心、声音参数。
- **`robotState`:** 当前机器人的同步率等级、记忆模块数据（简化）。
- **`chatHistory`:** 聊天消息列表 `[{sender: 'user'|'robot', text: string, timestamp: number}]`。
- **`gameState`:** 当前应用状态（如 `idle`, `gacha_spinning`, `gacha_confirming`, `robot_generating`, `chatting`）。
- **`uiSettings`:** 环境音开关状态、辉光模式等。
- **`partsLibrary`:** (可从配置加载) 所有可用部件的定义（ID, 名称, 模型路径, 稀有度, 标签）。

**4. 3D 渲染与动画 (R3F/Three.js)**

- **模型加载:** 使用 `useGLTF` (Drei) 加载 glTF 格式的部件模型。
- **模型组合:** 根据 `robotConfig` 动态加载并定位各个部件模型，确保接口对齐。
- **动画系统:**
  - 使用 Three.js `AnimationMixer` 播放动画。
  - 为机器人创建动画状态机（Idle, Talking, Emote_Happy, Emote_Sad, Entrance_A, etc.）。
  - 口型同步 (简化): 根据音量驱动嘴部骨骼或混合变形 (Morph Targets)。
  - 表情动作: 根据映射关系触发特定动画片段，使用 `crossFadeTo` 平滑过渡。
- **CRT 效果:** 使用 R3F 的 `EffectComposer` 和自定义着色器通道 (Shader Passes) 实现：
  - `FilmPass` (修改版): 实现扫描线、噪点、闪烁。
  - `BloomPass`: 实现辉光。
  - `ShaderPass` (自定义): 实现球形失真、色差、干扰条纹。
- **动态背景:** 使用分层的平面或简单几何体，应用视差滚动脚本，播放循环纹理动画或顶点动画。

**5. AI 与 TTS 交互**

- **后端代理 API:**
  - `/api/chat`:
    - 输入: `{ userInput: string, personalityCore: string, history: ChatMessage[] }`
    - 输出: `{ robotResponse: string }` (包含文本和 Emoji)
  - `/api/tts` (后期优化):
    - 输入: `{ text: string, voiceParams: object }`
    - 输出: `{ audioUrl: string, timestamps: WordTimestamp[] | PhonemeTimestamp[] }`
- **前端逻辑:**
  - 调用 `/api/chat` 获取回复。
  - **初期:** 将回复文本直接送入 `Web Speech API` (`speechSynthesis.speak`)。同时启动基于平均速率的文字打印和基于音量的口型同步。
  - **后期:** 调用 `/api/tts` 获取音频 URL 和时间戳。使用 Howler.js 播放音频，并根据时间戳精确驱动文字打印和口型动画。
  - 解析回复中的 Emoji，根据映射关系和时间戳（估算或精确）触发身体动作。

**6. 数据结构示例**

- **`PartDefinition`:** `{ id: string, name: string, type: 'head'|'torso'|'arms'|'legs', modelPath: string, rarity: 'common'|'uncommon'|'rare'|'epic', tags: string[] }`
- **`RobotConfig`:** `{ head: string, torso: string, arms: string, legs: string, personalityCore: string, voiceParams: { rate: number, pitch: number, timbre: string } }`
- **`RobotState`:** `{ syncRate: number, syncLevel: number, memory: { userName?: string, recentTopics?: string[], preferences?: string[] } }`

**7. 关键逻辑**

- **抽卡概率:** 根据部件稀有度配置概率表，进行加权随机抽取。
- **同步率计算:** 定义互动行为（聊天时长、特定反馈、完成任务）对应的同步率增长值。实现缓慢衰减逻辑。
- **Emoji 映射:** 维护一个 `Map<string, string>` 将 Emoji 映射到动画名称。
- **语音同步 (简化):**
  - 文字速率 = `audioDuration / textLength`。
  - 口型开合度 = `normalize(audioVolume)`。
  - 动作触发 = `emojiDetected ? setTimeout(playAnimation, delay) : null`。
