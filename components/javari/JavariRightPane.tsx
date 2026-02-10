"use client";
import React from "react";
import JavariAvatar from "./JavariAvatar";
import styles from "./javari.module.css";

export default function JavariRightPane({ 
  avatarState, 
  activeModel,
  creditBalance 
}: {
  avatarState: string;
  activeModel: string;
  creditBalance: number;
}) {
  // Color code based on credit balance
  const getCreditColor = () => {
    if (creditBalance === 0) return "#6b7280"; // Gray
    if (creditBalance < 10) return "#ef4444"; // Red
    if (creditBalance < 50) return "#f59e0b"; // Yellow
    return "#10b981"; // Green
  };

  const getCreditStatus = () => {
    if (creditBalance === 0) return "Out of Credits";
    if (creditBalance < 10) return "Low Balance";
    if (creditBalance < 50) return "Running Low";
    return "Active";
  };

  return (
    <aside className={styles.rightPane}>
      <JavariAvatar state={avatarState} model={activeModel} />

      <div className={styles.modelInfoBox}>
        <h3 className={styles.modelInfoTitle}>Model</h3>
        <div className={styles.modelBadge}>{activeModel}</div>
      </div>

      <div className={styles.creditInfoBox}>
        <h3 className={styles.creditInfoTitle}>Credits</h3>
        <div 
          className={styles.creditBalance}
          style={{ color: getCreditColor() }}
        >
          {creditBalance.toFixed(2)}
        </div>
        <div 
          className={styles.creditStatus}
          style={{ color: getCreditColor() }}
        >
          {getCreditStatus()}
        </div>
      </div>
    </aside>
  );
}
