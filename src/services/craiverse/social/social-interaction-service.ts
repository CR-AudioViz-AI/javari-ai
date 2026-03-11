import { RealtimeChannel } from '@supabase/supabase-js';
import { supabaseClient } from '../../../lib/supabase/client';
import { realtimeManager } from '../../../lib/supabase/realtime';
import { SocialWebSocketManager } from '../../../lib/websocket/social-ws';
import { socialStore } from '../../../stores/craiverse/social-store';
import { userService } from '../auth/user-service';
import { virtualSpaceService } from '../spaces/virtual-space-service';
import { notificationService } from '../../notifications/notification-service';
import { presenceCache } from '../../../lib/redis/presence-cache';
import {
  SocialUser,
  FriendRequest,
  SocialGroup,
  CollaborativeActivity,
  ChatMessage,
  PresenceStatus,
  SocialRelationship,
  ActivityParticipant,
  SocialEvent,
  GroupInvitation,
  ActivitySync,
  VirtualSpacePresence
} from '../../../types/craiverse/social';

/**
 * Social Interaction Service
 * Manages all social features in CRAIverse including friends, groups, messaging, and presence
 */
export class SocialInteractionService {
  private realtimeChannel: RealtimeChannel | null = null;
  private wsManager: SocialWebSocketManager;
  private eventHandlers = new Map<string, Set<Function>>();

  constructor() {
    this.wsManager = new SocialWebSocketManager();
    this.initialize();
  }

  /**
   * Initialize the social interaction service
   */
  private async initialize(): Promise<void> {
    try {
      // Initialize real-time subscriptions
      await this.setupRealtimeSubscriptions();
      
      // Initialize WebSocket connections
      await this.wsManager.initialize();
      
      // Setup event handlers
      this.setupEventHandlers();
      
      // Initialize presence tracking
      await this.initializePresenceTracking();
      
      console.log('SocialInteractionService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SocialInteractionService:', error);
      throw new Error(`Social service initialization failed: ${error}`);
    }
  }

  /**
   * Setup real-time subscriptions for social events
   */
  private async setupRealtimeSubscriptions(): Promise<void> {
    this.realtimeChannel = realtimeManager.subscribe('social_events', {
      onPresenceSync: (state) => this.handlePresenceSync(state),
      onPresenceJoin: (key, presence) => this.handlePresenceJoin(key, presence),
      onPresenceLeave: (key, presence) => this.handlePresenceLeave(key, presence),
      onMessage: (payload) => this.handleRealtimeMessage(payload)
    });
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    this.wsManager.on('friend_request', this.handleFriendRequest.bind(this));
    this.wsManager.on('group_invitation', this.handleGroupInvitation.bind(this));
    this.wsManager.on('chat_message', this.handleChatMessage.bind(this));
    this.wsManager.on('activity_sync', this.handleActivitySync.bind(this));
    this.wsManager.on('presence_update', this.handlePresenceUpdate.bind(this));
  }

  /**
   * Initialize presence tracking for current user
   */
  private async initializePresenceTracking(): Promise<void> {
    const currentUser = await userService.getCurrentUser();
    if (!currentUser) return;

    const presence: PresenceStatus = {
      userId: currentUser.id,
      status: 'online',
      lastSeen: new Date(),
      currentSpace: null,
      activity: null
    };

    await this.updatePresence(presence);
  }

  // Friend System Manager
  /**
   * Send a friend request to another user
   */
  async sendFriendRequest(targetUserId: string, message?: string): Promise<FriendRequest> {
    try {
      const currentUser = await userService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Check if relationship already exists
      const existingRelationship = await this.getRelationship(currentUser.id, targetUserId);
      if (existingRelationship) {
        throw new Error('Relationship already exists');
      }

      const friendRequest: FriendRequest = {
        id: crypto.randomUUID(),
        fromUserId: currentUser.id,
        toUserId: targetUserId,
        message,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save to database
      const { error } = await supabaseClient
        .from('friend_requests')
        .insert(friendRequest);

      if (error) throw error;

      // Send notification
      await notificationService.sendNotification({
        userId: targetUserId,
        type: 'friend_request',
        title: 'New Friend Request',
        message: `${currentUser.username} sent you a friend request`,
        data: { friendRequestId: friendRequest.id }
      });

      // Broadcast via WebSocket
      this.wsManager.broadcast('friend_request', {
        action: 'sent',
        friendRequest
      });

      // Update store
      socialStore.addFriendRequest(friendRequest);

      return friendRequest;
    } catch (error) {
      console.error('Failed to send friend request:', error);
      throw new Error(`Friend request failed: ${error}`);
    }
  }

  /**
   * Accept or reject a friend request
   */
  async respondToFriendRequest(requestId: string, accepted: boolean): Promise<void> {
    try {
      const { data: request, error } = await supabaseClient
        .from('friend_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (error || !request) {
        throw new Error('Friend request not found');
      }

      // Update request status
      await supabaseClient
        .from('friend_requests')
        .update({ 
          status: accepted ? 'accepted' : 'rejected',
          updatedAt: new Date()
        })
        .eq('id', requestId);

      if (accepted) {
        // Create friendship relationship
        await this.createFriendship(request.fromUserId, request.toUserId);
      }

      // Notify sender
      await notificationService.sendNotification({
        userId: request.fromUserId,
        type: 'friend_request_response',
        title: accepted ? 'Friend Request Accepted' : 'Friend Request Declined',
        message: `Your friend request was ${accepted ? 'accepted' : 'declined'}`,
        data: { requestId, accepted }
      });

      // Broadcast response
      this.wsManager.broadcast('friend_request', {
        action: 'responded',
        requestId,
        accepted
      });

      // Update store
      socialStore.updateFriendRequest(requestId, { 
        status: accepted ? 'accepted' : 'rejected' 
      });
    } catch (error) {
      console.error('Failed to respond to friend request:', error);
      throw new Error(`Friend request response failed: ${error}`);
    }
  }

  /**
   * Create friendship relationship
   */
  private async createFriendship(userId1: string, userId2: string): Promise<void> {
    const relationship: SocialRelationship = {
      id: crypto.randomUUID(),
      userId1,
      userId2,
      type: 'friend',
      status: 'active',
      createdAt: new Date()
    };

    const { error } = await supabaseClient
      .from('social_relationships')
      .insert(relationship);

    if (error) throw error;

    // Update store
    socialStore.addRelationship(relationship);
  }

  /**
   * Get user's friends list
   */
  async getFriends(userId: string): Promise<SocialUser[]> {
    try {
      const { data: relationships, error } = await supabaseClient
        .from('social_relationships')
        .select(`
          *,
          user1:users!social_relationships_userId1_fkey(*),
          user2:users!social_relationships_userId2_fkey(*)
        `)
        .or(`userId1.eq.${userId},userId2.eq.${userId}`)
        .eq('type', 'friend')
        .eq('status', 'active');

      if (error) throw error;

      const friends = relationships?.map(rel => {
        const friend = rel.userId1 === userId ? rel.user2 : rel.user1;
        return {
          ...friend,
          relationshipId: rel.id,
          friendSince: rel.createdAt
        } as SocialUser;
      }) || [];

      return friends;
    } catch (error) {
      console.error('Failed to get friends:', error);
      throw new Error(`Failed to retrieve friends: ${error}`);
    }
  }

  // Group Formation Handler
  /**
   * Create a new social group
   */
  async createGroup(groupData: {
    name: string;
    description?: string;
    isPrivate: boolean;
    maxMembers?: number;
    tags?: string[];
  }): Promise<SocialGroup> {
    try {
      const currentUser = await userService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const group: SocialGroup = {
        id: crypto.randomUUID(),
        name: groupData.name,
        description: groupData.description,
        ownerId: currentUser.id,
        members: [currentUser.id],
        isPrivate: groupData.isPrivate,
        maxMembers: groupData.maxMembers || 50,
        tags: groupData.tags || [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save to database
      const { error } = await supabaseClient
        .from('social_groups')
        .insert(group);

      if (error) throw error;

      // Allocate virtual space if needed
      const virtualSpace = await virtualSpaceService.allocateGroupSpace(group.id);
      if (virtualSpace) {
        group.virtualSpaceId = virtualSpace.id;
        await supabaseClient
          .from('social_groups')
          .update({ virtualSpaceId: virtualSpace.id })
          .eq('id', group.id);
      }

      // Update store
      socialStore.addGroup(group);

      // Broadcast group creation
      this.wsManager.broadcast('group_created', { group });

      return group;
    } catch (error) {
      console.error('Failed to create group:', error);
      throw new Error(`Group creation failed: ${error}`);
    }
  }

  /**
   * Invite user to group
   */
  async inviteToGroup(groupId: string, userId: string): Promise<GroupInvitation> {
    try {
      const currentUser = await userService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Verify group ownership or admin rights
      const group = await this.getGroup(groupId);
      if (!group || (group.ownerId !== currentUser.id && !group.admins?.includes(currentUser.id))) {
        throw new Error('Insufficient permissions');
      }

      const invitation: GroupInvitation = {
        id: crypto.randomUUID(),
        groupId,
        fromUserId: currentUser.id,
        toUserId: userId,
        status: 'pending',
        createdAt: new Date()
      };

      // Save invitation
      const { error } = await supabaseClient
        .from('group_invitations')
        .insert(invitation);

      if (error) throw error;

      // Send notification
      await notificationService.sendNotification({
        userId,
        type: 'group_invitation',
        title: 'Group Invitation',
        message: `You've been invited to join "${group.name}"`,
        data: { invitationId: invitation.id, groupId }
      });

      // Broadcast invitation
      this.wsManager.broadcast('group_invitation', {
        action: 'sent',
        invitation
      });

      return invitation;
    } catch (error) {
      console.error('Failed to invite to group:', error);
      throw new Error(`Group invitation failed: ${error}`);
    }
  }

  /**
   * Join or leave a group
   */
  async toggleGroupMembership(groupId: string, action: 'join' | 'leave'): Promise<void> {
    try {
      const currentUser = await userService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const group = await this.getGroup(groupId);
      if (!group) {
        throw new Error('Group not found');
      }

      const isMember = group.members.includes(currentUser.id);

      if (action === 'join' && !isMember) {
        if (group.members.length >= group.maxMembers) {
          throw new Error('Group is at maximum capacity');
        }

        // Add user to group
        const updatedMembers = [...group.members, currentUser.id];
        await supabaseClient
          .from('social_groups')
          .update({ 
            members: updatedMembers,
            updatedAt: new Date()
          })
          .eq('id', groupId);

        // Update store
        socialStore.updateGroup(groupId, { members: updatedMembers });

        // Join virtual space if exists
        if (group.virtualSpaceId) {
          await virtualSpaceService.joinSpace(group.virtualSpaceId, currentUser.id);
        }
      } else if (action === 'leave' && isMember) {
        // Remove user from group
        const updatedMembers = group.members.filter(id => id !== currentUser.id);
        await supabaseClient
          .from('social_groups')
          .update({ 
            members: updatedMembers,
            updatedAt: new Date()
          })
          .eq('id', groupId);

        // Update store
        socialStore.updateGroup(groupId, { members: updatedMembers });

        // Leave virtual space if exists
        if (group.virtualSpaceId) {
          await virtualSpaceService.leaveSpace(group.virtualSpaceId, currentUser.id);
        }
      }

      // Broadcast membership change
      this.wsManager.broadcast('group_membership', {
        action,
        groupId,
        userId: currentUser.id
      });
    } catch (error) {
      console.error('Failed to toggle group membership:', error);
      throw new Error(`Group membership operation failed: ${error}`);
    }
  }

  // Collaborative Activity Manager
  /**
   * Create a collaborative activity
   */
  async createActivity(activityData: {
    name: string;
    description?: string;
    type: string;
    maxParticipants?: number;
    groupId?: string;
    virtualSpaceId?: string;
    metadata?: Record<string, any>;
  }): Promise<CollaborativeActivity> {
    try {
      const currentUser = await userService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const activity: CollaborativeActivity = {
        id: crypto.randomUUID(),
        name: activityData.name,
        description: activityData.description,
        type: activityData.type,
        hostId: currentUser.id,
        participants: [{ 
          userId: currentUser.id, 
          role: 'host', 
          joinedAt: new Date() 
        }],
        maxParticipants: activityData.maxParticipants || 20,
        status: 'active',
        groupId: activityData.groupId,
        virtualSpaceId: activityData.virtualSpaceId,
        metadata: activityData.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save to database
      const { error } = await supabaseClient
        .from('collaborative_activities')
        .insert(activity);

      if (error) throw error;

      // Update store
      socialStore.addActivity(activity);

      // Broadcast activity creation
      this.wsManager.broadcast('activity_created', { activity });

      return activity;
    } catch (error) {
      console.error('Failed to create activity:', error);
      throw new Error(`Activity creation failed: ${error}`);
    }
  }

  /**
   * Join a collaborative activity
   */
  async joinActivity(activityId: string, role: string = 'participant'): Promise<void> {
    try {
      const currentUser = await userService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const activity = await this.getActivity(activityId);
      if (!activity) {
        throw new Error('Activity not found');
      }

      const isParticipant = activity.participants.some(p => p.userId === currentUser.id);
      if (isParticipant) {
        throw new Error('Already participating in activity');
      }

      if (activity.participants.length >= activity.maxParticipants) {
        throw new Error('Activity is at maximum capacity');
      }

      // Add participant
      const participant: ActivityParticipant = {
        userId: currentUser.id,
        role,
        joinedAt: new Date()
      };

      const updatedParticipants = [...activity.participants, participant];

      await supabaseClient
        .from('collaborative_activities')
        .update({ 
          participants: updatedParticipants,
          updatedAt: new Date()
        })
        .eq('id', activityId);

      // Update store
      socialStore.updateActivity(activityId, { participants: updatedParticipants });

      // Broadcast join
      this.wsManager.broadcast('activity_joined', {
        activityId,
        participant
      });

      // Initialize activity sync for participant
      await this.initializeActivitySync(activityId, currentUser.id);
    } catch (error) {
      console.error('Failed to join activity:', error);
      throw new Error(`Activity join failed: ${error}`);
    }
  }

  /**
   * Initialize activity synchronization for participant
   */
  private async initializeActivitySync(activityId: string, userId: string): Promise<void> {
    const syncData: ActivitySync = {
      activityId,
      userId,
      state: {},
      lastSync: new Date()
    };

    // Store in Redis for real-time sync
    await presenceCache.setActivitySync(activityId, userId, syncData);
  }

  // Real-time Messaging Engine
  /**
   * Send a chat message
   */
  async sendMessage(messageData: {
    content: string;
    type: 'text' | 'emoji' | 'media';
    recipientId?: string;
    groupId?: string;
    activityId?: string;
    metadata?: Record<string, any>;
  }): Promise<ChatMessage> {
    try {
      const currentUser = await userService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const message: ChatMessage = {
        id: crypto.randomUUID(),
        senderId: currentUser.id,
        content: messageData.content,
        type: messageData.type,
        recipientId: messageData.recipientId,
        groupId: messageData.groupId,
        activityId: messageData.activityId,
        metadata: messageData.metadata || {},
        timestamp: new Date(),
        status: 'sent'
      };

      // Save to database
      const { error } = await supabaseClient
        .from('chat_messages')
        .insert(message);

      if (error) throw error;

      // Broadcast message in real-time
      this.wsManager.broadcast('chat_message', { message });

      // Send push notification for direct messages
      if (messageData.recipientId) {
        await notificationService.sendNotification({
          userId: messageData.recipientId,
          type: 'direct_message',
          title: `Message from ${currentUser.username}`,
          message: messageData.content,
          data: { messageId: message.id }
        });
      }

      // Update store
      socialStore.addMessage(message);

      return message;
    } catch (error) {
      console.error('Failed to send message:', error);
      throw new Error(`Message sending failed: ${error}`);
    }
  }

  /**
   * Get chat messages for conversation
   */
  async getMessages(params: {
    recipientId?: string;
    groupId?: string;
    activityId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ChatMessage[]> {
    try {
      let query = supabaseClient
        .from('chat_messages')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(params.limit || 50);

      if (params.offset) {
        query = query.range(params.offset, params.offset + (params.limit || 50) - 1);
      }

      if (params.recipientId) {
        const currentUser = await userService.getCurrentUser();
        query = query.or(`and(senderId.eq.${currentUser?.id},recipientId.eq.${params.recipientId}),and(senderId.eq.${params.recipientId},recipientId.eq.${currentUser?.id})`);
      } else if (params.groupId) {
        query = query.eq('groupId', params.groupId);
      } else if (params.activityId) {
        query = query.eq('activityId', params.activityId);
      }

      const { data: messages, error } = await query;

      if (error) throw error;

      return messages || [];
    } catch (error) {
      console.error('Failed to get messages:', error);
      throw new Error(`Message retrieval failed: ${error}`);
    }
  }

  // Presence Tracker
  /**
   * Update user presence status
   */
  async updatePresence(presence: PresenceStatus): Promise<void> {
    try {
      // Update in Redis cache
      await presenceCache.setPresence(presence.userId, presence);

      // Update in real-time channel
      if (this.realtimeChannel) {
        await this.realtimeChannel.track(presence);
      }

      // Broadcast presence update
      this.wsManager.broadcast('presence_update', { presence });

      // Update store
      socialStore.updatePresence(presence.userId, presence);
    } catch (error) {
      console.error('Failed to update presence:', error);
      throw new Error(`Presence update failed: ${error}`);
    }
  }

  /**
   * Get online friends
   */
  async getOnlineFriends(userId: string): Promise<SocialUser[]> {
    try {
      const friends = await this.getFriends(userId);
      const onlineStatuses = await presenceCache.getBulkPresence(
        friends.map(f => f.id)
      );

      return friends.filter(friend => {
        const status = onlineStatuses.get(friend.id);
        return status && status.status === 'online';
      });
    } catch (error) {
      console.error('Failed to get online friends:', error);
      throw new Error(`Online friends retrieval failed: ${error}`);
    }
  }

  // Virtual Space Coordinator
  /**
   * Track user presence in virtual space
   */
  async trackSpace