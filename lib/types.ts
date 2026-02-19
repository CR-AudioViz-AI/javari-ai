// lib/types.ts
// Barrel re-export for shared types used across lib/ and app/api/ layers
// Message is sourced from types/conversation.ts and re-exported here
// This file is the canonical @/lib/types import target for the Javari engine

export type { Message, Conversation, ConversationStatus } from "@/types/conversation";
