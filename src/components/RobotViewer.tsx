import React, { useRef, useEffect, useMemo } from "react";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import {
  useAppStore,
  selectRobotConfig,
  selectIsSpeaking,
  selectGameState,
  selectCurrentEmote,
} from "../store/useAppStore";
import { initialPartsLibrary } from "../data/partsLibrary";
import type { EmoteAction } from "../types";

type RobotViewerProps = Record<string, never>;

// Define a type for the AnimationMixer 'finished' event
type MixerFinishedEvent = {
  action: THREE.AnimationAction;
  direction: number; // Direction of playback (1 for forward, -1 for backward)
  // Add other potential properties if needed based on Three.js documentation
};

const getModelPath = (partId: string): string | undefined => {
  const part = initialPartsLibrary.find((p) => p.id === partId);
  return part?.modelPath;
};

// Map EmoteAction names to actual animation clip names
const emoteToActionNameMap: Record<NonNullable<EmoteAction>, string> = {
  smile: "Emote_Smile",
  laugh: "Emote_Laugh",
  think: "Emote_Think",
  sad: "Emote_Sad",
  wave: "Emote_Wave",
  nod: "Emote_Nod",
};

const RobotViewer: React.FC<RobotViewerProps> = () => {
  const groupRef = useRef<THREE.Group>(null);
  const robotConfig = useAppStore(selectRobotConfig);
  const isSpeaking = useAppStore(selectIsSpeaking);
  const gameState = useAppStore(selectGameState);
  const currentEmote = useAppStore(selectCurrentEmote);
  const triggerEmote = useAppStore((store) => store.triggerEmote);
  const personality = robotConfig.personalityCore;

  const prevGameStateRef = useRef<typeof gameState>();
  useEffect(() => {
    prevGameStateRef.current = gameState;
  }, [gameState]);
  const prevGameState = prevGameStateRef.current;

  // --- Load models ---
  const headPath = useMemo(
    () => getModelPath(robotConfig.head),
    [robotConfig.head]
  );
  const torsoPath = useMemo(
    () => getModelPath(robotConfig.torso),
    [robotConfig.torso]
  );
  const armsPath = useMemo(
    () => getModelPath(robotConfig.arms),
    [robotConfig.arms]
  );
  const legsPath = useMemo(
    () => getModelPath(robotConfig.legs),
    [robotConfig.legs]
  );

  const { scene: headScene } = useGLTF(headPath || "");
  const { scene: torsoScene, animations: torsoAnims } = useGLTF(
    torsoPath || ""
  );
  const { scene: armsScene } = useGLTF(armsPath || "");
  const { scene: legsScene } = useGLTF(legsPath || "");

  const head = useMemo(() => headScene?.clone(), [headScene]);
  const torso = useMemo(() => torsoScene?.clone(), [torsoScene]);
  const arms = useMemo(() => armsScene?.clone(), [armsScene]);
  const legs = useMemo(() => legsScene?.clone(), [legsScene]);

  // --- Animation Setup ---
  const { actions, mixer, names } = useAnimations(torsoAnims, groupRef);
  const currentActionRef = useRef<string | null>(null);
  // Use the specific event type for the listener ref
  const emoteFinishListenerRef = useRef<
    ((e: MixerFinishedEvent) => void) | null
  >(null);

  // Function to play an animation, fading out others
  const playAnimation = (
    name: string,
    loop: THREE.AnimationActionLoopStyles = THREE.LoopRepeat
  ) => {
    if (!actions || !mixer) return;

    const targetAction = actions[name];
    if (!targetAction) {
      console.warn(`Animation "${name}" not found.`);
      if (loop === THREE.LoopOnce) {
        playIdleAnimation();
        triggerEmote(null);
      }
      return;
    }

    if (currentActionRef.current === name && loop === THREE.LoopRepeat) {
      if (!targetAction.isRunning()) targetAction.play();
      return;
    }

    Object.entries(actions).forEach(([actionName, action]) => {
      if (action && action.isRunning() && actionName !== name) {
        action.fadeOut(0.3);
      }
    });

    targetAction
      .reset()
      .setLoop(loop, loop === THREE.LoopRepeat ? Infinity : 1)
      .fadeIn(0.3)
      .play();
    currentActionRef.current = name;

    if (emoteFinishListenerRef.current) {
      mixer.removeEventListener("finished", emoteFinishListenerRef.current);
      emoteFinishListenerRef.current = null;
    }

    if (loop === THREE.LoopOnce) {
      // Use the specific event type here
      const listener = (e: MixerFinishedEvent) => {
        if (e.action === targetAction) {
          console.log(`Animation "${name}" finished, returning to Idle.`);
          playIdleAnimation();
          triggerEmote(null);
          // No need to remove listener here, it's handled above
        }
      };
      emoteFinishListenerRef.current = listener;
      mixer.addEventListener("finished", listener);
    }
  };

  // Function to determine and play the correct idle animation
  const playIdleAnimation = () => {
    const personalityIdleName = `Idle_${personality}`;
    const defaultIdleName = "Idle";
    let idleActionName = "";

    const foundPersonalityName = names.find(
      (name) => name.toLowerCase() === personalityIdleName.toLowerCase()
    );
    if (foundPersonalityName && actions[foundPersonalityName]) {
      idleActionName = foundPersonalityName;
    } else {
      const foundDefaultName = names.find(
        (name) => name.toLowerCase() === defaultIdleName.toLowerCase()
      );
      if (foundDefaultName && actions[foundDefaultName]) {
        idleActionName = foundDefaultName;
      }
    }

    if (idleActionName) {
      playAnimation(idleActionName, THREE.LoopRepeat);
    } else {
      console.warn(`Idle animation (default or for ${personality}) not found.`);
      currentActionRef.current = null;
    }
  };

  // Effect to handle Idle and Entrance animations
  useEffect(() => {
    if (prevGameState === "robot_generating" && gameState === "idle") {
      const personalityEntranceName = `Entrance_${personality}`;
      const defaultEntranceName = "Entrance_Standard";
      let entranceActionName = "";

      const foundPersonalityName = names.find(
        (name) => name.toLowerCase() === personalityEntranceName.toLowerCase()
      );
      if (foundPersonalityName && actions[foundPersonalityName]) {
        entranceActionName = foundPersonalityName;
      } else {
        const foundDefaultName = names.find(
          (name) => name.toLowerCase() === defaultEntranceName.toLowerCase()
        );
        if (foundDefaultName && actions[foundDefaultName]) {
          entranceActionName = foundDefaultName;
        }
      }

      if (entranceActionName) {
        playAnimation(entranceActionName, THREE.LoopOnce);
      } else {
        playIdleAnimation();
      }
    } else if (
      gameState === "idle" &&
      !currentEmote &&
      !currentActionRef.current?.startsWith("Idle")
    ) {
      playIdleAnimation();
    }
  }, [
    gameState,
    prevGameState,
    actions,
    mixer,
    names,
    personality,
    currentEmote,
  ]);

  // Effect to handle Emote triggers
  useEffect(() => {
    if (currentEmote) {
      const actionName = emoteToActionNameMap[currentEmote];
      if (actionName) {
        playAnimation(actionName, THREE.LoopOnce);
      } else {
        console.warn(`No animation mapped for emote: ${currentEmote}`);
        triggerEmote(null);
      }
    }
  }, [currentEmote, actions, mixer, triggerEmote]); // Removed playAnimation from deps

  // --- Lip Sync (Simplified) ---
  const mouthMeshRef = useRef<THREE.Mesh | null>(null);

  useEffect(() => {
    mouthMeshRef.current = null;
    head?.traverse((child) => {
      if (
        (child as THREE.Mesh).isMesh &&
        child.morphTargetDictionary?.["MouthOpen"] !== undefined &&
        child.morphTargetInfluences
      ) {
        mouthMeshRef.current = child as THREE.Mesh;
      }
    });
  }, [head]);

  useFrame(({ clock }) => {
    const mesh = mouthMeshRef.current;
    if (mesh instanceof THREE.Mesh && mesh.morphTargetInfluences) {
      const mouthOpenIndex = mesh.morphTargetDictionary?.["MouthOpen"];
      if (mouthOpenIndex !== undefined) {
        if (isSpeaking && !currentEmote) {
          // Don't lip sync during emotes
          const influence = (Math.sin(clock.elapsedTime * 20) + 1) / 2;
          mesh.morphTargetInfluences[mouthOpenIndex] = influence * 0.8;
        } else {
          mesh.morphTargetInfluences[mouthOpenIndex] = 0;
        }
      }
    }
  });
  // --- End Lip Sync ---

  // --- Basic Positioning ---
  const torsoHeight = 1.0;
  const headHeight = 0.5;
  const legHeight = 0.8;
  const headY = torsoHeight / 2 + headHeight / 2 - 0.1;
  const armsY = 0;
  const legsY = -(torsoHeight / 2 + legHeight / 2) + 0.1;
  // --- End Positioning ---

  // Apply shadows
  useEffect(() => {
    [head, torso, arms, legs].forEach((model) => {
      model?.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    });
  }, [head, torso, arms, legs]);

  // Render only if all parts are loaded
  if (!head || !torso || !arms || !legs) {
    return null;
  }

  return (
    <group ref={groupRef} position={[0, 0.8, 0]} dispose={null}>
      <primitive
        object={head}
        position={[0, headY, 0]}
        key={robotConfig.head}
      />
      <primitive object={torso} position={[0, 0, 0]} key={robotConfig.torso} />
      <primitive
        object={arms}
        position={[0, armsY, 0]}
        key={robotConfig.arms}
      />
      <primitive
        object={legs}
        position={[0, legsY, 0]}
        key={robotConfig.legs}
      />
    </group>
  );
};

// Preload all possible models
initialPartsLibrary.forEach((part) => {
  if (part.modelPath) {
    useGLTF.preload(part.modelPath);
  }
});

export default RobotViewer;
