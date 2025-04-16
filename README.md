# ChatRobot (open_ic)

A web application featuring a chat interface with a customizable 3D robot avatar, built with React, TypeScript, Vite, and Three.js.

## ✨ Features

- Interactive chat interface.
- Real-time 3D visualization of a robot model.
- Customization controls for different robot parts (head, torso, arms, legs).

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript
- **Build Tool:** Vite
- **3D Rendering:** Three.js, @react-three/fiber, @react-three/drei
- **Linting:** ESLint

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or later recommended)
- Yarn (v1.22 or later)

### Installation

1.  Clone the repository:
    ```bash
    git clone git@github.com:theBigGavin/ChatRobot.git
    ```
2.  Navigate to the project directory:
    ```bash
    cd ChatRobot
    ```
3.  Install dependencies:
    ```bash
    yarn install
    ```

### Running the Development Server

To start the development server with Hot Module Replacement (HMR):

```bash
yarn dev
```

Open your browser and navigate to the URL provided (usually `http://localhost:5173`).

## 📦 Building for Production

To create an optimized production build:

```bash
yarn build
```

The output files will be generated in the `dist/` directory. You can preview the production build locally using:

```bash
yarn preview
```

## ✨ Linting

To check the code for linting errors:

```bash
yarn lint
```

## 📄 License

This project is currently unlicensed.
