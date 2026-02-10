"use client";
import React from "react";
import styles from "./javari.module.css";

export default function JavariAvatar({ state, model }) {
  return (
    <div className={styles.avatarContainer}>
      <div className={`${styles.avatarCircle} ${styles[state]}`}>
        <img
          src="/assets/javari-avatar.png"
          alt="Javari AI"
          className={styles.avatarImage}
        />
      </div>

      <div className={styles.avatarStatusBox}>
        <div className={styles.avatarTitle}>Javari AI</div>
        <div className={styles.avatarSubtitle}>
          {state === "thinking" && "Thinking…"}
          {state === "speaking" && `Responding (${model})…`}
          {state === "idle" && "Ready"}
        </div>
      </div>
    </div>
  );
}
