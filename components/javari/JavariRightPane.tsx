"use client";

import React from "react";
import styles from "@/app/javari/javari.module.css";
import JavariAvatar from "./JavariAvatar";
import { CouncilTimelineStep, ModelContributorScore } from "@/app/api/javari/router/types";

interface JavariRightPaneProps {
  avatarState: string;
  activeModel: string;
  creditBalance: number;
  supermodeEnabled: boolean;
  onToggleSupermode: () => void;
  timeline?: CouncilTimelineStep[];
  contributors?: ModelContributorScore[];
}

export default function JavariRightPane({
  avatarState,
  activeModel,
  creditBalance,
  supermodeEnabled,
  onToggleSupermode,
  timeline = [],
  contributors = []
}: JavariRightPaneProps) {
  
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <aside className={styles.rightPane}>
      {/* Avatar */}
      <JavariAvatar state={avatarState as any} />

      {/* SuperMode Toggle */}
      <div className={styles.supermodeToggleContainer}>
        <button
          onClick={onToggleSupermode}
          className={`${styles.supermodeToggle} ${
            supermodeEnabled ? styles.supermodeToggleActive : ""
          }`}
          aria-label={`SuperMode ${supermodeEnabled ? "enabled" : "disabled"}`}
          aria-pressed={supermodeEnabled}
        >
          <span className={styles.supermodeToggleLabel}>
            {supermodeEnabled ? "SuperMode: ACTIVE ⚡" : "SuperMode: OFF"}
          </span>
        </button>
        
        {supermodeEnabled && (
          <div className={styles.supermodeBadge} role="status" aria-live="polite">
            <span className={styles.supermodeBadgeIcon}>⚡</span>
            <span className={styles.supermodeBadgeText}>
              AI Council Mode
            </span>
          </div>
        )}
      </div>

      {/* Active Model Display */}
      <div className={styles.modelInfo}>
        <div className={styles.modelLabel}>Active Model</div>
        <div className={styles.modelName}>{activeModel}</div>
      </div>

      {/* Credit Balance */}
      <div className={styles.creditInfo}>
        <div className={styles.creditLabel}>Credits</div>
        <div 
          className={styles.creditValue}
          style={{
            color: creditBalance <= 0 ? "#ef4444" : 
                   creditBalance < 10 ? "#f59e0b" : 
                   creditBalance < 50 ? "#fbbf24" : "#10b981"
          }}
        >
          {creditBalance.toFixed(2)}
        </div>
      </div>

      {/* SuperMode: Contributors List */}
      {supermodeEnabled && contributors.length > 0 && (
        <div className={styles.contributorsSection}>
          <h3 className={styles.contributorsTitle}>Council Members</h3>
          <div className={styles.contributorsList}>
            {contributors.map((contributor, idx) => (
              <div 
                key={idx}
                className={`${styles.contributorCard} ${
                  contributor.selected ? styles.contributorCardSelected : ""
                }`}
              >
                <div className={styles.contributorHeader}>
                  <span className={styles.contributorModel}>
                    {contributor.model.split(":")[1] || contributor.model}
                  </span>
                  {contributor.selected && (
                    <span className={styles.contributorBadge}>Selected</span>
                  )}
                </div>
                <div className={styles.contributorScore}>
                  Score: {(contributor.score * 100).toFixed(0)}%
                </div>
                <div className={styles.contributorReasoning}>
                  {contributor.reasoning}
                </div>
                <div className={styles.contributorEvidence}>
                  Evidence: {contributor.evidence_count}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SuperMode: Execution Timeline */}
      {supermodeEnabled && timeline.length > 0 && (
        <div className={styles.timelineSection}>
          <h3 className={styles.timelineTitle}>Execution Timeline</h3>
          <div className={styles.timelineList}>
            {timeline.map((step, idx) => (
              <div key={idx} className={styles.timelineStep}>
                <div className={styles.timelineMarker}></div>
                <div className={styles.timelineContent}>
                  <div className={styles.timelineAction}>{step.action}</div>
                  <div className={styles.timelineMeta}>
                    <span className={styles.timelineTime}>
                      {formatTime(step.timestamp)}
                    </span>
                    <span className={styles.timelineDuration}>
                      {formatDuration(step.duration_ms)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
