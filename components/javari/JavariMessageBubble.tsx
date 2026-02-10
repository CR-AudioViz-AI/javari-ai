"use client";
import React from "react";
import styles from "./javari.module.css";

export default function JavariMessageBubble({ msg }) {
  const isUser = msg.role === "user";

  return (
    <div
      className={`${styles.bubbleWrapper} ${
        isUser ? styles.userWrap : styles.aiWrap
      }`}
    >
      <div
        className={`${styles.messageBubble} ${
          isUser ? styles.userBubble : styles.aiBubble
        }`}
      >
        {msg.content}
      </div>
      <div
        className={`${styles.timestamp} ${
          isUser ? styles.userTS : styles.aiTS
        }`}
      >
        {msg.time}
      </div>
    </div>
  );
}
