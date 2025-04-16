# 迭代计划与细化 Story 清单 (草稿 v3 - 强化 AC)

**项目:** 蒸汽朋克 AI 机器人互动体验 V2 (Project Cogsworth)
**版本:** 0.1 (基于需求清单 v1)

**总体原则:** 优先构建核心体验闭环 (MVP)，然后逐步丰富细节、效果和特性。采用敏捷迭代方式（假设 2 周为一 Sprint）。

**Iteration 0: 环境搭建与基础**

- **目标:** 搭建项目骨架，引入核心依赖。
- **Stories:**
  - **Story 0.1:** 初始化 React + TypeScript 项目 (使用 Vite)。
    - _AC:_
      - `npm create vite@latest project-cogsworth --template react-ts` 命令成功执行。
      - 项目能通过 `npm run dev` 启动，并在浏览器中显示默认的 Vite React 页面。
      - `tsconfig.json` 文件存在且配置基本正确。
      - ESLint 和 Prettier (如果使用) 配置完成并能正常工作。
  - **Story 0.2:** 安装并配置核心依赖库。
    - _AC:_
      - `package.json` 中包含 `three`, `@react-three/fiber`, `@react-three/drei`, `zustand` (或 `jotai`), `howler` 依赖。
      - 在示例组件中 `import` 这些库不会导致编译或运行时错误。
      - TypeScript 类型定义 (`@types/...`) 已安装且编辑器能提供正确的类型提示。
      - 样式方案 (如 Tailwind CSS) 已配置，能在组件中应用样式类并生效。
  - **Story 0.3:** 建立基础项目结构。
    - _AC:_
      - `src` 目录下存在 `components`, `store`, `hooks`, `assets`, `styles` 等子目录。
      - `App.tsx` 存在并作为应用入口。
      - `components` 目录下存在 `MachineInterface.tsx`, `CRTScreen.tsx`, `Dashboard.tsx` 等基础组件文件（内容可为空或占位符）。
      - `store` 目录下存在状态管理配置文件（如 `useAppStore.ts`）。
  - **Story 0.4:** 设置基础后端代理端点 (用于测试)。
    - _AC:_
      - 存在一个 `/api/ping` 端点（无论用 Serverless Functions 还是本地 Node/Express 实现）。
      - 在前端使用 `fetch` 或 `axios` 调用 `/api/ping` 能收到 `200 OK` 响应，响应体包含预期内容（如 `{ message: 'pong' }`）。

**Iteration 1: MVP - 核心界面与机器人展示**

- **目标:** 实现基本界面布局，能展示一个静态的、预设部件组成的机器人。
- **Stories:**
  - **Story 1.1:** 实现基础双栏布局。
    - _AC:_
      - `MachineInterface.tsx` 使用 CSS (Flexbox/Grid) 将界面分为左右两栏。
      - 左栏宽度约占 40-45%，右栏约占 55-60%。
      - 在不同屏幕尺寸下（至少桌面端）布局保持稳定。
  - **Story 1.2:** 在 CRT 区域渲染基础 3D 场景。
    - _AC:_
      - `CRTScreen.tsx` 包含一个 R3F `Canvas` 组件。
      - 场景中至少包含一个环境光 (`<ambientLight>`) 和一个平行光 (`<directionalLight>`)。
      - 使用 `<OrbitControls />` (Drei) 可以通过鼠标拖拽旋转 3D 场景视角。
      - 背景色为纯色（如黑色或深灰）。
  - **Story 1.3:** 加载并展示静态占位机器人。
    - _AC:_
      - `assets/models` 目录下存在 4 个占位符 glTF 文件 (e.g., `placeholder_head.gltf`, `placeholder_torso.gltf`, etc.)。
      - `RobotViewer.tsx` 使用 `useGLTF.preload()` 预加载模型。
      - `RobotViewer.tsx` 成功加载并渲染这 4 个模型，并将它们大致组合在场景中心位置。
      - 模型有基础的材质和颜色，不会显示为纯白或透明。
  - **Story 1.4:** 实现 Dashboard 区域的占位组件。
    - _AC:_
      - `Dashboard.tsx` 中渲染 `GachaControls`, `StatusMeters`, `ChatConsole`, `PhysicalControls` 组件。
      - 每个占位组件在界面上显示其名称或一个简单的占位符图形/文本，占据预期的布局位置。
  - **Story 1.5:** 定义核心数据结构。
    - _AC:_
      - `store/types.ts` (或类似文件) 中定义 `PartDefinition`, `RobotConfig` TypeScript 接口。
      - `store/partsLibrary.ts` (或类似文件) 中定义一个包含至少 4 个占位部件定义的数组 `initialPartsLibrary: PartDefinition[]`。
      - `store/useAppStore.ts` (或类似文件) 中定义 `robotConfig` 状态，并有初始值。

**Iteration 2: MVP - 核心抽卡流程 (无动画)**

- **目标:** 实现基本的抽卡逻辑，能在轮盘区显示随机部件，并更新机器人模型。
- **Stories:**
  - **Story 2.1:** 实现部件随机选择逻辑。
    - _AC:_
      - 存在一个函数 `getRandomParts(partsLibrary)`，输入部件库，输出一个包含 4 个部件 ID 的对象 `{ head: string, torso: string, arms: string, legs: string }`。
      - 随机选择考虑 `rarity` 属性（如果已定义，初始可假设都为 'common'）。
      - 多次调用该函数会返回不同的组合结果。
  - **Story 2.2:** 实现抽卡触发与结果展示。
    - _AC:_
      - `GachaControls` 中有一个可点击的按钮 (模拟红色按钮)。
      - 点击按钮后，调用 `getRandomParts` 函数。
      - `GachaControls` 的 4 个轮盘区域（可以是简单文本）更新显示所选部件的 `name` 或 `id`。
  - **Story 2.3:** 实现机器人模型动态更新。
    - _AC:_
      - `GachaControls` 中有第二个可点击按钮 (模拟绿色按钮)。
      - 点击确认按钮后，全局状态 `robotConfig` 被更新为抽卡结果中的部件 ID。
      - `RobotViewer` 组件能响应 `robotConfig` 的变化，卸载旧部件模型，加载并组合显示新部件模型。
      - CRT 中的机器人外观与抽卡结果一致。

**Iteration 3: MVP - 核心聊天交互 (无同步)**

- **目标:** 实现基本的聊天输入和 AI 回复展示。
- **Stories:**
  - **Story 3.1:** 实现用户消息输入与发送。
    - _AC:_
      - `UserInput.tsx` 中的输入框能接收用户输入的文本。
      - 按下 Enter 键后：
        - 输入框内容被清空。
        - `chatHistory` 状态数组新增一条记录，包含用户输入的文本和 `sender: 'user'` 标识。
  - **Story 3.2:** 实现聊天历史记录展示。
    - _AC:_
      - `ChatHistory.tsx` 能正确渲染 `chatHistory` 数组中的所有消息。
      - 用户消息和机器人消息能通过样式区分（例如，不同的前缀或对齐方式）。
      - 当新消息添加到列表底部时，视图自动滚动到底部。
  - **Story 3.3:** 集成后端代理调用 AI。
    - _AC:_
      - 发送用户消息后，前端向 `/api/chat` 发送一个包含 `userInput` 的 POST 请求。
      - 后端代理成功接收请求，调用配置好的外部 AI API，并将 AI 生成的文本回复返回给前端。
      - 网络请求错误能被捕获并给出提示（如控制台打印错误）。
  - **Story 3.4:** 展示 AI 回复。
    - _AC:_
      - 前端成功接收到 `/api/chat` 的响应后。
      - `chatHistory` 状态数组新增一条记录，包含 AI 回复的文本和 `sender: 'robot'` 标识。
      - AI 回复正确显示在聊天历史记录区。

**Iteration 4: 氛围增强 - 视觉效果 (CRT & 仪表)**

- **目标:** 开始加入蒸汽朋克视觉风格和动态效果。
- **Stories:**
  - **Story 4.1:** 实现基础 CRT 屏幕着色器效果。
    - _AC:_
      - CRT 屏幕渲染结果明显带有扫描线效果。
      - 较亮区域（如模型高光）有可见的辉光效果。
      - 屏幕边缘有轻微的桶形失真。
      - 效果可以通过开关或参数调节强度（用于调试）。
  - **Story 4.2:** 实现静态仪表盘仪表。
    - _AC:_
      - `StatusMeters.tsx` 中渲染出三个视觉上不同的仪表图形，符合蒸汽朋克风格（黄铜、刻度、指针/辉光管占位符）。
      - 仪表有对应的标签（压力、散热、同步率）。
  - **Story 4.3:** 实现 Console 聊天窗口基础样式。
    - _AC:_
      - 聊天窗口背景为黑色 (#000)。
      - 所有文本（历史记录、输入）为指定的绿色 (#00FF00 或类似)。
      - 使用指定的等宽字体。
      - 输入区显示 `⚙>` 提示符，后面跟着一个持续闪烁的绿色方块光标。
  - **Story 4.4:** 开始应用整体界面风格。
    - _AC:_
      - `MachineInterface` 组件具有米白色/灰色基调，并点缀有黄铜色边框或铆钉样式的细节。
      - `Dashboard` 组件背景色或边框与机器外壳协调，呈现多层次感。

**Iteration 5: 氛围增强 - 音频反馈**

- **目标:** 加入核心的交互音效。
- **Stories:**
  - **Story 5.1:** 集成音频管理库。
    - _AC:_
      - Howler.js 实例被创建并可全局访问（如通过 Context 或 Store）。
      - 可以成功加载 `.mp3` 或 `.wav` 格式的音效文件。
      - 调用播放函数能听到声音。
  - **Story 5.2:** 实现抽卡按钮音效。
    - _AC:_ 点击红色和绿色抽卡按钮时播放对应的机械音效。
  - **Story 5.3:** 实现轮盘音效（占位）。
    - _AC:_ 在触发抽卡时播放循环的旋转音效，在部件“选定”时播放锁定的音效；确认生成时播放组合音效。
  - **Story 5.4:** 实现打字音效。
    - _AC:_ 在聊天输入框每输入一个字符，播放一次短促清脆的“咔嗒”音效。

**Iteration 6: 机器人个性初显**

- **目标:** 引入性格核心和基础的个性化表现。
- **Stories:**
  - **Story 6.1:** 在抽卡逻辑中加入性格核心随机分配。
    - _AC:_ `getRandomParts` 函数现在也返回一个 `personalityCore` 字符串（从预定义列表随机选）。`robotConfig` 状态包含 `personalityCore` 字段。
  - **Story 6.2:** 将性格核心传递给 AI Prompt。
    - _AC:_ 调用 `/api/chat` 时，请求体包含 `personalityCore` 参数。后端代理能将此信息整合到发送给 AI 的最终 Prompt 中。
  - **Story 6.3:** 实现基础待机动画。
    - _AC:_ 机器人模型包含一个名为 "Idle" (或类似) 的动画片段。`RobotViewer` 能在机器人无其他动作时循环播放此动画。
  - **Story 6.4 (可选):** 实现基于性格的待机动画切换。
    - _AC:_ 存在多个待机动画片段 (e.g., "Idle_Optimistic", "Idle_Logical")。`RobotViewer` 根据 `robotConfig.personalityCore` 选择并播放对应的待机动画。

**Iteration 7: 抽卡仪式感**

- **目标:** 实现完整的抽卡动画和视听反馈流程。
- **Stories:**
  - **Story 7.1:** 实现轮盘视觉滚动动画。
    - _AC:_ 点击红色按钮后，`PartReel` 组件内的部件图标/名称快速上下滚动或模糊滚动，持续几秒后停止并显示最终结果。
  - **Story 7.2:** 实现抽卡过程中的仪表盘反馈动画。
    - _AC:_ 轮盘旋转期间，`PressureMeter` 指针大幅摆动，`HeatIndicator` 辉光上升，状态灯快速闪烁。
  - **Story 7.3:** 实现确认生成时的仪式感效果。
    - _AC:_ 点击绿色按钮时：
      - 触发短暂的屏幕震动效果（可通过 CSS 或 JS 实现）。
      - 核心仪表指针/辉光达到峰值并闪烁。
      - CRT 屏幕播放预设的启动动画序列（雪花->扫描线->稳定）。
      - 同步播放预设的组合/激活音效。

**Iteration 8: 聊天体验提升 (简化同步)**

- **目标:** 实现简化的语音同步功能。
- **Stories:**
  - **Story 8.1:** 集成基础 TTS (Web Speech API)。
    - _AC:_ 收到 AI 回复文本后，调用 `speechSynthesis.speak()` 能听到浏览器合成的语音读出该文本。可以选择不同的可用语音。
  - **Story 8.2:** 实现流式文字打印（简化版）。
    - _AC:_ 机器人回复时，文本在聊天窗口中逐字或逐词出现，其总显示时间与 `speechSynthesis` 的 `onend` 事件触发时间大致匹配。伴随打印音效。
  - **Story 8.3:** 实现简化口型同步。
    - _AC:_ 在 `speechSynthesis` 说话期间，机器人模型的嘴部骨骼或 Morph Target 根据一个简化的逻辑（如固定频率开合，或基于估算的音量）进行开合运动。

**Iteration 9 onwards: 逐步完善与优化 (选择性细化)**
_(AC 示例)_

- **Story 9.1:** 实现同步率系统 (仪表、计算、基础奖励)。
  - _AC:_ `SyncMeter` 能根据 `robotState.syncRate` 更新显示。与机器人成功交互一次（完成一次问答）后 `syncRate` 数值增加。达到 Level 2 阈值时，`SyncMeter` 上的 Level 2 指示灯亮起。
- **Story 9.3:** 实现表情动作联动 (Emoji 解析与动画触发)。
  - _AC:_ 当 AI 回复包含 `😊` 时，机器人播放 "Emote_Smile" 动画。当包含 `🤔` 时，播放 "Emote_Think" 动画。动画播放时机大致在对应文本出现时。
