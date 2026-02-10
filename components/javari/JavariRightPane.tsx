"use client";
import React from "react";
import JavariAvatar from "./JavariAvatar";
import styles from "./javari.module.css";

export default function JavariRightPane({ avatarState, activeModel }) {
  return (
    <aside className={styles.rightPane}>
      <JavariAvatar state={avatarState} model={activeModel} />

      <div className={styles.modelInfoBox}>
        <h3 className={styles.modelInfoTitle}>Model</h3>
        <div className={styles.modelBadge}>{activeModel}</div>
      </div>
    </aside>
  );
}
