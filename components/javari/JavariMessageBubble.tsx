"use client";

import React from "react";
import styles from "@/app/javari/javari.module.css";
import { ModelContributorScore } from "@/app/api/javari/router/types";

interface Message {
  role: "user" | "assistant";
  content: string;
  time: string;
  supermode?: boolean;
  contributors?: ModelContributorScore[];
  validated?: boolean;
}

interface JavariMessageBubbleProps {
  msg: Message;
}

export default function JavariMessageBubble({ msg }: JavariMessageBubbleProps) {
  if (msg.role === "user") {
    return (
      <div className={styles.messageBubbleUser}>
        <div className={styles.messageContent}>{msg.content}</div>
        <div className={styles.messageTime}>{msg.time}</div>
      </div>
    );
  }

  const selectedContributors = msg.contributors?.filter(c => c.selected) || [];
  const hasCouncilData = msg.supermode && selectedContributors.length > 0;

  return (
    <div className={styles.messageBubbleAssistant}>
      <div className={styles.messageContent}>
        {msg.content}
      </div>

      {hasCouncilData && (
        <div className={styles.councilMetadata}>
          <div className={styles.councilBadge}>
            <span className={styles.councilBadgeIcon}>⚡</span>
            <span className={styles.councilBadgeText}>
              SuperMode Response
            </span>
            {msg.validated && (
              <span className={styles.validatedBadge}>✓ Validated</span>
            )}
          </div>

          <details className={styles.councilDetails}>
            <summary className={styles.councilSummary}>
              View Council Contributors ({selectedContributors.length})
            </summary>
            <div className={styles.councilContributorsList}>
              {selectedContributors.map((contributor, idx) => (
                <div key={idx} className={styles.councilContributor}>
                  <div className={styles.councilContributorName}>
                    {contributor.model.split(":")[1] || contributor.model}
                  </div>
                  <div className={styles.councilContributorScore}>
                    Score: {(contributor.score * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      <div className={styles.messageTime}>{msg.time}</div>
    </div>
  );
}
