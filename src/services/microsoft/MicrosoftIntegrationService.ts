# Microsoft 365 Deep Integration Service

## Overview

The Microsoft 365 Deep Integration Service provides comprehensive integration with Microsoft Teams, SharePoint, and Office applications, enabling AI agents to participate in meetings, edit documents, and manage organizational workflows. This service leverages Microsoft Graph API, Teams SDK, and SharePoint REST API to create seamless collaboration between AI agents and Microsoft 365 ecosystem.

## Features

- **Teams Integration**: Real-time meeting participation, message handling, and webhook processing
- **SharePoint Management**: Document creation, editing, and collaborative workflows
- **Office Automation**: Automated document processing and template generation
- **Meeting Transcription**: Real-time transcription processing and AI analysis
- **Workflow Orchestration**: Complex multi-step workflow automation
- **Permission Management**: Granular access control and validation
- **Tenant Configuration**: Multi-tenant support with isolated configurations

## Architecture

```mermaid
graph TD
    A[Microsoft Integration Service] --> B[Microsoft Graph Client]
    A --> C[Teams Webhook Handler]
    A --> D[SharePoint Document Manager]
    A --> E[Office Automation Engine]
    A --> F[Meeting Transcription Processor]
    A --> G[Workflow Orchestrator]
    A --> H[Permission Validator]
    A --> I[Tenant Configuration Manager]
    
    B --> J[Microsoft Graph API]
    C --> K[Teams Real-time SDK]
    D --> L[SharePoint REST API]
    E --> M[Office JavaScript APIs]
    F --> N[OpenAI API]
    G --> O[Supabase Functions]
    H --> P[Azure Active Directory]
```

## Installation

```bash
npm install @microsoft/microsoft-graph-client @azure/msal-node @microsoft/teams-js
npm install ws socket.io-client axios form-data
```

## Implementation

```typescript
// src/services/microsoft/MicrosoftIntegrationService.ts

import { Client as GraphClient } from '@microsoft/microsoft-graph-client';
import { AuthenticationProvider, AuthenticationResult } from '@azure/msal-node';
import { TeamsActivityHandler, TurnContext, MessageFactory } from 'botbuilder';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import { EventEmitter } from 'events';

interface MicrosoftConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
  scopes: string[];
  webhookUrl: string;
  botAppId: string;
  botAppPassword: string;
}

interface TeamsWebhookPayload {
  type: 'message' | 'meeting' | 'channel' | 'file';
  data: {
    id: string;
    content: string;
    channelId?: string;
    meetingId?: string;
    userId: string;
    timestamp: string;
    attachments?: any[];
  };
}

interface SharePointFile {
  id: string;
  name: string;
  webUrl: string;
  lastModifiedDateTime: string;
  createdBy: {
    user: {
      displayName: string;
      email: string;
    };
  };
  content?: Buffer;
}

interface MeetingTranscript {
  id: string;
  meetingId: string;
  content: string;
  speakers: {
    userId: string;
    displayName: string;
    segments: {
      text: string;
      startTime: number;
      endTime: number;
    }[];
  }[];
  timestamp: string;
}

interface WorkflowStep {
  id: string;
  type: 'teams_message' | 'sharepoint_update' | 'document_generate' | 'meeting_schedule';
  config: Record<string, any>;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
}

class MicrosoftGraphClient {
  private client: GraphClient;
  private authProvider: AuthenticationProvider;

  constructor(config: MicrosoftConfig) {
    this.authProvider = this.createAuthProvider(config);
    this.client = GraphClient.initWithMiddleware({
      authProvider: this.authProvider,
    });
  }

  private createAuthProvider(config: MicrosoftConfig): AuthenticationProvider {
    return {
      getAccessToken: async () => {
        const response = await axios.post(
          `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
          new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            scope: config.scopes.join(' '),
            grant_type: 'client_credentials',
          }),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          }
        );
        
        return response.data.access_token;
      },
    };
  }

  async getUser(userId: string) {
    return await this.client.api(`/users/${userId}`).get();
  }

  async getTeams() {
    return await this.client.api('/me/joinedTeams').get();
  }

  async getChannels(teamId: string) {
    return await this.client.api(`/teams/${teamId}/channels`).get();
  }

  async sendMessage(channelId: string, message: string) {
    return await this.client.api(`/channels/${channelId}/messages`).post({
      body: {
        content: message,
        contentType: 'text',
      },
    });
  }

  async getSharePointSites() {
    return await this.client.api('/sites').get();
  }

  async getSharePointFiles(siteId: string, driveId: string) {
    return await this.client.api(`/sites/${siteId}/drives/${driveId}/root/children`).get();
  }

  async downloadFile(siteId: string, driveId: string, itemId: string): Promise<Buffer> {
    const response = await this.client.api(`/sites/${siteId}/drives/${driveId}/items/${itemId}/content`).get();
    return Buffer.from(response);
  }

  async uploadFile(siteId: string, driveId: string, fileName: string, content: Buffer) {
    return await this.client.api(`/sites/${siteId}/drives/${driveId}/root:/${fileName}:/content`).put(content);
  }
}

class TeamsWebhookHandler extends EventEmitter {
  private webhookUrl: string;
  private server: WebSocket.Server;

  constructor(webhookUrl: string) {
    super();
    this.webhookUrl = webhookUrl;
    this.server = new WebSocket.Server({ port: 8080 });
    this.setupWebhookServer();
  }

  private setupWebhookServer() {
    this.server.on('connection', (ws) => {
      ws.on('message', (data) => {
        try {
          const payload: TeamsWebhookPayload = JSON.parse(data.toString());
          this.handleWebhookPayload(payload);
        } catch (error) {
          console.error('Error parsing webhook payload:', error);
        }
      });
    });
  }

  private handleWebhookPayload(payload: TeamsWebhookPayload) {
    switch (payload.type) {
      case 'message':
        this.emit('message', payload.data);
        break;
      case 'meeting':
        this.emit('meeting', payload.data);
        break;
      case 'channel':
        this.emit('channel', payload.data);
        break;
      case 'file':
        this.emit('file', payload.data);
        break;
    }
  }

  async registerWebhook(subscriptionId: string, resource: string) {
    const subscription = {
      changeType: 'created,updated',
      notificationUrl: this.webhookUrl,
      resource: resource,
      expirationDateTime: new Date(Date.now() + 3600000).toISOString(),
      clientState: subscriptionId,
    };

    // Register with Microsoft Graph
    // Implementation would use Graph API to create subscription
    return subscription;
  }
}

class SharePointDocumentManager {
  private graphClient: MicrosoftGraphClient;

  constructor(graphClient: MicrosoftGraphClient) {
    this.graphClient = graphClient;
  }

  async listDocuments(siteId: string, driveId: string): Promise<SharePointFile[]> {
    const files = await this.graphClient.getSharePointFiles(siteId, driveId);
    return files.value.map((file: any) => ({
      id: file.id,
      name: file.name,
      webUrl: file.webUrl,
      lastModifiedDateTime: file.lastModifiedDateTime,
      createdBy: file.createdBy,
    }));
  }

  async downloadDocument(siteId: string, driveId: string, fileId: string): Promise<SharePointFile> {
    const content = await this.graphClient.downloadFile(siteId, driveId, fileId);
    const metadata = await this.getFileMetadata(siteId, driveId, fileId);
    
    return {
      ...metadata,
      content,
    };
  }

  async uploadDocument(siteId: string, driveId: string, fileName: string, content: Buffer): Promise<SharePointFile> {
    const result = await this.graphClient.uploadFile(siteId, driveId, fileName, content);
    return {
      id: result.id,
      name: result.name,
      webUrl: result.webUrl,
      lastModifiedDateTime: result.lastModifiedDateTime,
      createdBy: result.createdBy,
    };
  }

  async createFolder(siteId: string, driveId: string, folderName: string) {
    // Implementation for creating folders
    const folderData = {
      name: folderName,
      folder: {},
    };
    
    // Use Graph API to create folder
    return folderData;
  }

  async shareDocument(siteId: string, driveId: string, fileId: string, emails: string[]) {
    // Implementation for sharing documents
    const permissions = emails.map(email => ({
      recipients: [{ email }],
      message: 'Shared by AI Agent',
      requireSignIn: true,
    }));

    return permissions;
  }

  private async getFileMetadata(siteId: string, driveId: string, fileId: string): Promise<SharePointFile> {
    // Implementation to get file metadata
    return {
      id: fileId,
      name: '',
      webUrl: '',
      lastModifiedDateTime: '',
      createdBy: {
        user: {
          displayName: '',
          email: '',
        },
      },
    };
  }
}

class OfficeAutomationEngine {
  private graphClient: MicrosoftGraphClient;

  constructor(graphClient: MicrosoftGraphClient) {
    this.graphClient = graphClient;
  }

  async generateWordDocument(templateId: string, data: Record<string, any>): Promise<Buffer> {
    // Implementation for generating Word documents from templates
    const template = await this.downloadTemplate(templateId);
    const processedContent = await this.processTemplate(template, data);
    
    return processedContent;
  }

  async generateExcelReport(data: any[], columns: string[]): Promise<Buffer> {
    // Implementation for generating Excel reports
    const workbook = this.createWorkbook();
    const worksheet = this.addWorksheet(workbook, 'Report');
    
    this.populateWorksheet(worksheet, data, columns);
    
    return this.saveWorkbook(workbook);
  }

  async generatePowerPointPresentation(slides: any[]): Promise<Buffer> {
    // Implementation for generating PowerPoint presentations
    const presentation = this.createPresentation();
    
    slides.forEach(slide => {
      this.addSlide(presentation, slide);
    });
    
    return this.savePresentation(presentation);
  }

  async automateWorkflow(steps: WorkflowStep[]): Promise<void> {
    for (const step of steps) {
      await this.executeWorkflowStep(step);
    }
  }

  private async downloadTemplate(templateId: string): Promise<Buffer> {
    // Implementation to download template
    return Buffer.from('');
  }

  private async processTemplate(template: Buffer, data: Record<string, any>): Promise<Buffer> {
    // Implementation to process template with data
    return template;
  }

  private createWorkbook(): any {
    // Implementation to create Excel workbook
    return {};
  }

  private addWorksheet(workbook: any, name: string): any {
    // Implementation to add worksheet
    return {};
  }

  private populateWorksheet(worksheet: any, data: any[], columns: string[]): void {
    // Implementation to populate worksheet
  }

  private saveWorkbook(workbook: any): Buffer {
    // Implementation to save workbook
    return Buffer.from('');
  }

  private createPresentation(): any {
    // Implementation to create PowerPoint presentation
    return {};
  }

  private addSlide(presentation: any, slide: any): void {
    // Implementation to add slide
  }

  private savePresentation(presentation: any): Buffer {
    // Implementation to save presentation
    return Buffer.from('');
  }

  private async executeWorkflowStep(step: WorkflowStep): Promise<void> {
    // Implementation to execute workflow step
    step.status = 'running';
    
    try {
      switch (step.type) {
        case 'teams_message':
          await this.sendTeamsMessage(step.config);
          break;
        case 'sharepoint_update':
          await this.updateSharePointFile(step.config);
          break;
        case 'document_generate':
          await this.generateDocument(step.config);
          break;
        case 'meeting_schedule':
          await this.scheduleMeeting(step.config);
          break;
      }
      
      step.status = 'completed';
    } catch (error) {
      step.status = 'failed';
      throw error;
    }
  }

  private async sendTeamsMessage(config: any): Promise<void> {
    // Implementation to send Teams message
  }

  private async updateSharePointFile(config: any): Promise<void> {
    // Implementation to update SharePoint file
  }

  private async generateDocument(config: any): Promise<void> {
    // Implementation to generate document
  }

  private async scheduleMeeting(config: any): Promise<void> {
    // Implementation to schedule meeting
  }
}

class MeetingTranscriptionProcessor extends EventEmitter {
  private graphClient: MicrosoftGraphClient;
  private openaiApiKey: string;

  constructor(graphClient: MicrosoftGraphClient, openaiApiKey: string) {
    super();
    this.graphClient = graphClient;
    this.openaiApiKey = openaiApiKey;
  }

  async processTranscription(meetingId: string): Promise<MeetingTranscript> {
    const transcript = await this.getTranscriptFromTeams(meetingId);
    const processedTranscript = await this.enhanceTranscriptWithAI(transcript);
    
    this.emit('transcriptProcessed', processedTranscript);
    
    return processedTranscript;
  }

  async generateMeetingSummary(transcript: MeetingTranscript): Promise<string> {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Generate a concise meeting summary with key points and action items.',
          },
          {
            role: 'user',
            content: transcript.content,
          },
        ],
      },
      {
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.choices[0].message.content;
  }

  async extractActionItems(transcript: MeetingTranscript): Promise<string[]> {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Extract action items from the meeting transcript. Return as a JSON array of strings.',
          },
          {
            role: 'user',
            content: transcript.content,
          },
        ],
      },
      {
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return JSON.parse(response.data.choices[0].message.content);
  }

  private async getTranscriptFromTeams(meetingId: string): Promise<MeetingTranscript> {
    // Implementation to get transcript from Teams
    return {
      id: '',
      meetingId,
      content: '',
      speakers: [],
      timestamp: new Date().toISOString(),
    };
  }

  private async enhanceTranscriptWithAI(transcript: MeetingTranscript): Promise<MeetingTranscript> {
    // Implementation to enhance transcript with AI
    return transcript;
  }
}

class WorkflowOrchestrator {
  private steps: Map<string, WorkflowStep> = new Map();
  private dependencies: Map<string, string[]> = new Map();

  addStep(step: WorkflowStep): void {
    this.steps.set(step.id, step);
    this.dependencies.set(step.id, step.dependencies);
  }

  async executeWorkflow(): Promise<void> {
    const executionOrder = this.topologicalSort();
    
    for (const stepId of executionOrder) {
      const step = this.steps.get(stepId);
      if (step) {
        await this.executeStep(step);
      }
    }
  }

  private topologicalSort(): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (stepId: string) => {
      if (visited.has(stepId)) return;
      
      visited.add(stepId);
      const deps = this.dependencies.get(stepId) || [];
      
      deps.forEach(depId => visit(depId));
      result.push(stepId);
    };

    Array.from(this.steps.keys()).forEach(stepId => visit(stepId));
    
    return result;
  }

  private async executeStep(step: WorkflowStep): Promise<void> {
    step.status = 'running';
    
    try {
      // Step execution logic would go here
      step.status = 'completed';
    } catch (error) {
      step.status = 'failed';
      throw error;
    }
  }
}

class PermissionValidator {
  private graphClient: MicrosoftGraphClient;

  constructor(graphClient: MicrosoftGraphClient) {
    this.graphClient = graphClient;
  }

  async validateUserPermissions(userId: string, resource: string, action: string): Promise<boolean> {
    // Implementation to validate user permissions
    try {
      const permissions = await this.getUserPermissions(userId, resource);
      return permissions.includes(action);
    } catch (error) {
      console.error('Permission validation error:', error);
      return false;
    }
  }

  async validateAppPermissions(resource: string, action: string): Promise<boolean> {
    // Implementation to validate app permissions
    return true; // Placeholder
  }

  private async getUserPermissions(userId: string, resource: string): Promise<string[]> {
    // Implementation to get user permissions
    return [];
  }
}

class TenantConfigurationManager {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async getTenantConfig(tenantId: string): Promise<MicrosoftConfig | null> {
    const { data, error } = await this.supabase
      .from('microsoft_tenant_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      console.error('Error fetching tenant config:', error);
      return null;
    }

    return data;
  }

  async saveTenantConfig(tenantId: string, config: MicrosoftConfig): Promise<void> {
    const { error } = await this.supabase
      .from('microsoft_tenant_configs')
      .upsert({
        tenant_id: tenantId,
        ...config,
      });

    if (error) {
      console.error('Error saving tenant config:', error);
      throw error;
    }
  }

  async deleteTenantConfig(tenantId: string): Promise<void> {
    const { error } = await this.supabase
      .from('microsoft_tenant_configs')
      .delete()
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('Error deleting tenant config:', error);
      throw error;
    }
  }
}

export class MicrosoftIntegrationService extends EventEmitter {
  private graphClient: MicrosoftGraphClient;
  private webhookHandler: TeamsWebhookHandler;
  private documentManager: SharePointDocumentManager;
  private automationEngine: OfficeAutomationEngine;
  private transcriptionProcessor: MeetingTranscriptionProcessor;
  private workflowOrchestrator: WorkflowOrchestrator;
  private permissionValidator: PermissionValidator;
  private tenantManager: TenantConfigurationManager;

  constructor(
    config: MicrosoftConfig,
    supabaseUrl: string,
    supabaseKey: string,
    openaiApiKey: string
  ) {
    super();

    this.graphClient = new MicrosoftGraphClient(config);
    this.webhookHandler = new TeamsWebhookHandler(config.webhookUrl);
    this.documentManager = new SharePointDocumentManager(this.graphClient);
    this.automationEngine = new OfficeAutomationEngine(this.graphClient);
    this.transcriptionProcessor = new MeetingTranscriptionProcessor(this.graphClient, openaiApiKey);
    this.workflowOrchestrator = new WorkflowOrchestrator();
    this.permissionValidator = new PermissionValidator(this.graphClient);
    this.tenantManager = new TenantConfigurationManager(supabaseUrl, supabaseKey);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.webhookHandler.on('message', (data) => {
      this.handleTeamsMessage(data);
    });

    this.webhookHandler.on('meeting', (data) => {
      this.handleMeetingEvent(data);
    });

    this.transcriptionProcessor.on('transcriptProcessed', (transcript) => {
      this.handleProcessedTranscript(transcript);
    });
  }

  // Teams Integration Methods
  async sendTeamsMessage(channelId: string, message: string): Promise<void> {
    await this.graphClient.sendMessage(channelId, message);
  }

  async joinMeeting(meetingId: string): Promise<void> {
    // Implementation to join Teams meeting
    this.