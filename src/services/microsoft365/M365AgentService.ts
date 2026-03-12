import { Client } from '@microsoft/microsoft-graph-client';
import { AuthenticationProvider } from '@azure/msal-node';
import { BotFrameworkAdapter, TurnContext, ActivityTypes } from 'botbuilder';
import { EventEmitter } from 'events';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
export interface M365AuthConfig {
export interface AgentConfig {
export interface MeetingContext {
export interface Participant {
export interface SharedFile {
export interface EmailContext {
export interface Attachment {
export interface DocumentContext {
export interface FlowContext {
export interface AgentActionResult {
export interface M365Subscription {
      // Subscribe to meeting events
      // Classify email using AI
      // Generate appropriate response
      // Analyze document with AI
      // Make AI decision based on trigger data
      // Trigger the flow with AI decision
    // Implementation would use MSAL or similar for Power Platform authentication
export default {}
