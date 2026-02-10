"use client";

import React from "react";
import styles from "@/app/javari/javari.module.css";

type AvatarState = 
  | "idle" 
  | "thinking" 
  | "speaking" 
  | "supermodeIdle" 
  | "supermodeThinking" 
  | "supermodeSpeak";

interface JavariAvatarProps {
  state: AvatarState;
}

export default function JavariAvatar({ state }: JavariAvatarProps) {
  const getAvatarClass = () => {
    switch (state) {
      case "idle":
        return `${styles.avatar} ${styles.avatarIdle}`;
      case "thinking":
        return `${styles.avatar} ${styles.avatarThinking}`;
      case "speaking":
        return `${styles.avatar} ${styles.avatarSpeaking}`;
      case "supermodeIdle":
        return `${styles.avatar} ${styles.avatarSupermodeIdle}`;
      case "supermodeThinking":
        return `${styles.avatar} ${styles.avatarSupermodeThinking}`;
      case "supermodeSpeak":
        return `${styles.avatar} ${styles.avatarSupermodeSpeak}`;
      default:
        return `${styles.avatar} ${styles.avatarIdle}`;
    }
  };

  const getAuraClass = () => {
    if (state.startsWith("supermode")) {
      return `${styles.avatarAura} ${styles.avatarAuraSupermode}`;
    }
    return `${styles.avatarAura}`;
  };

  const getStateLabel = () => {
    switch (state) {
      case "idle":
        return "Ready";
      case "thinking":
        return "Thinking...";
      case "speaking":
        return "Responding";
      case "supermodeIdle":
        return "SuperMode Ready";
      case "supermodeThinking":
        return "Council Deliberating...";
      case "supermodeSpeak":
        return "Synthesizing";
      default:
        return "Ready";
    }
  };

  return (
    <div className={styles.avatarContainer}>
      <div className={getAuraClass()}></div>
      <div className={getAvatarClass()}>
        <div className={styles.avatarCore}>J</div>
      </div>
      <div className={styles.avatarLabel}>{getStateLabel()}</div>
    </div>
  );
}
