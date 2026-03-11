import React, { createContext, useContext, useReducer, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Box, Sphere, Plane } from '@react-three/drei';
import * as THREE from 'three';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import io, { Socket } from 'socket.io-client';
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';

/**
 * Conference Hall Types and Interfaces
 */
interface ConferenceState {
  currentEvent: ConferenceEvent | null;
  events: ConferenceEvent[];
  participants: Participant[];
  isPresenting: boolean;
  streamingEnabled: boolean;
  recordingEnabled: boolean;
  moderationEnabled: boolean;
  chatMessages: ChatMessage[];
  polls: Poll[];
  reactions: Reaction[];
  networkingRooms: NetworkingRoom[];
  accessibilitySettings: AccessibilitySettings;
}

interface ConferenceEvent {
  id: string;
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  presenterId: string;
  status: 'scheduled' | 'live' | 'ended';
  maxParticipants: number;
  tags: string[];
}

interface Participant {
  id: string;
  name: string;
  avatar: string;
  position: THREE.Vector3;
  role: 'presenter' | 'moderator' | 'attendee';
  isActive: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
  networkingRoomId?: string;
}

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  content: string;
  timestamp: Date;
  type: 'message' | 'question' | 'system';
  isModerated: boolean;
}

interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  isActive: boolean;
  endTime?: Date;
}

interface PollOption {
  id: string;
  text: string;
  votes: number;
}

interface Reaction {
  id: string;
  userId: string;
  type: 'applause' | 'heart' | 'thumbs_up' | 'thumbs_down' | 'question';
  timestamp: Date;
  position: THREE.Vector3;
}

interface NetworkingRoom {
  id: string;
  name: string;
  participants: string[];
  maxParticipants: number;
  isActive: boolean;
}

interface AccessibilitySettings {
  closedCaptions: boolean;
  highContrast: boolean;
  largeText: boolean;
  keyboardNavigation: boolean;
  screenReaderMode: boolean;
}

type ConferenceAction =
  | { type: 'SET_CURRENT_EVENT'; payload: ConferenceEvent }
  | { type: 'ADD_PARTICIPANT'; payload: Participant }
  | { type: 'REMOVE_PARTICIPANT'; payload: string }
  | { type: 'UPDATE_PARTICIPANT'; payload: Partial<Participant> & { id: string } }
  | { type: 'ADD_CHAT_MESSAGE'; payload: ChatMessage }
  | { type: 'ADD_POLL'; payload: Poll }
  | { type: 'UPDATE_POLL'; payload: Partial<Poll> & { id: string } }
  | { type: 'ADD_REACTION'; payload: Reaction }
  | { type: 'TOGGLE_STREAMING'; payload: boolean }
  | { type: 'TOGGLE_RECORDING'; payload: boolean }
  | { type: 'UPDATE_ACCESSIBILITY'; payload: Partial<AccessibilitySettings> }
  | { type: 'JOIN_NETWORKING_ROOM'; payload: { userId: string; roomId: string } }
  | { type: 'LEAVE_NETWORKING_ROOM'; payload: { userId: string; roomId: string } };

/**
 * Conference Hall Context
 */
const ConferenceHallContext = createContext<{
  state: ConferenceState;
  dispatch: React.Dispatch<ConferenceAction>;
  supabaseClient: SupabaseClient;
  socketClient: Socket;
  agoraClient: IAgoraRTCClient;
  startPresentation: () => Promise<void>;
  endPresentation: () => Promise<void>;
  shareScreen: () => Promise<void>;
  sendChatMessage: (content: string, type?: 'message' | 'question') => Promise<void>;
  createPoll: (question: string, options: string[]) => Promise<void>;
  sendReaction: (type: Reaction['type']) => void;
  joinNetworkingRoom: (roomId: string) => Promise<void>;
  leaveNetworkingRoom: () => Promise<void>;
} | null>(null);

/**
 * Conference State Reducer
 */
const conferenceReducer = (state: ConferenceState, action: ConferenceAction): ConferenceState => {
  switch (action.type) {
    case 'SET_CURRENT_EVENT':
      return { ...state, currentEvent: action.payload };
    case 'ADD_PARTICIPANT':
      return { ...state, participants: [...state.participants, action.payload] };
    case 'REMOVE_PARTICIPANT':
      return {
        ...state,
        participants: state.participants.filter(p => p.id !== action.payload)
      };
    case 'UPDATE_PARTICIPANT':
      return {
        ...state,
        participants: state.participants.map(p =>
          p.id === action.payload.id ? { ...p, ...action.payload } : p
        )
      };
    case 'ADD_CHAT_MESSAGE':
      return { ...state, chatMessages: [...state.chatMessages, action.payload] };
    case 'ADD_POLL':
      return { ...state, polls: [...state.polls, action.payload] };
    case 'UPDATE_POLL':
      return {
        ...state,
        polls: state.polls.map(p =>
          p.id === action.payload.id ? { ...p, ...action.payload } : p
        )
      };
    case 'ADD_REACTION':
      return { ...state, reactions: [...state.reactions, action.payload] };
    case 'TOGGLE_STREAMING':
      return { ...state, streamingEnabled: action.payload };
    case 'TOGGLE_RECORDING':
      return { ...state, recordingEnabled: action.payload };
    case 'UPDATE_ACCESSIBILITY':
      return {
        ...state,
        accessibilitySettings: { ...state.accessibilitySettings, ...action.payload }
      };
    case 'JOIN_NETWORKING_ROOM':
      return {
        ...state,
        participants: state.participants.map(p =>
          p.id === action.payload.userId
            ? { ...p, networkingRoomId: action.payload.roomId }
            : p
        )
      };
    case 'LEAVE_NETWORKING_ROOM':
      return {
        ...state,
        participants: state.participants.map(p =>
          p.id === action.payload.userId
            ? { ...p, networkingRoomId: undefined }
            : p
        )
      };
    default:
      return state;
  }
};

/**
 * Conference Hall Provider Component
 */
export const ConferenceHallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(conferenceReducer, {
    currentEvent: null,
    events: [],
    participants: [],
    isPresenting: false,
    streamingEnabled: false,
    recordingEnabled: false,
    moderationEnabled: true,
    chatMessages: [],
    polls: [],
    reactions: [],
    networkingRooms: [],
    accessibilitySettings: {
      closedCaptions: false,
      highContrast: false,
      largeText: false,
      keyboardNavigation: true,
      screenReaderMode: false
    }
  });

  const supabaseClient = useMemo(() => 
    createClient(
      process.env.REACT_APP_SUPABASE_URL || '',
      process.env.REACT_APP_SUPABASE_ANON_KEY || ''
    ), []
  );

  const socketClient = useMemo(() => 
    io(process.env.REACT_APP_SOCKET_URL || 'localhost:3001'), []
  );

  const agoraClient = useMemo(() => 
    AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }), []
  );

  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);

  useEffect(() => {
    const setupRealtime = async () => {
      try {
        const channel = supabaseClient
          .channel('conference_hall')
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages'
          }, (payload) => {
            dispatch({ type: 'ADD_CHAT_MESSAGE', payload: payload.new as ChatMessage });
          })
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'reactions'
          }, (payload) => {
            dispatch({ type: 'ADD_REACTION', payload: payload.new as Reaction });
          })
          .subscribe();

        socketClient.on('participant_joined', (participant: Participant) => {
          dispatch({ type: 'ADD_PARTICIPANT', payload: participant });
        });

        socketClient.on('participant_left', (participantId: string) => {
          dispatch({ type: 'REMOVE_PARTICIPANT', payload: participantId });
        });

        socketClient.on('participant_updated', (participant: Partial<Participant> & { id: string }) => {
          dispatch({ type: 'UPDATE_PARTICIPANT', payload: participant });
        });

        return () => {
          channel.unsubscribe();
          socketClient.disconnect();
        };
      } catch (error) {
        console.error('Failed to setup realtime connections:', error);
      }
    };

    setupRealtime();
  }, [supabaseClient, socketClient]);

  const startPresentation = useCallback(async (): Promise<void> => {
    try {
      const [videoTrack, audioTrack] = await Promise.all([
        AgoraRTC.createCameraVideoTrack(),
        AgoraRTC.createMicrophoneAudioTrack()
      ]);

      await agoraClient.join(
        process.env.REACT_APP_AGORA_APP_ID || '',
        state.currentEvent?.id || 'default',
        process.env.REACT_APP_AGORA_TOKEN || null
      );

      await agoraClient.publish([videoTrack, audioTrack]);

      setLocalVideoTrack(videoTrack);
      setLocalAudioTrack(audioTrack);

      socketClient.emit('presentation_started', {
        eventId: state.currentEvent?.id,
        presenterId: 'current_user_id'
      });
    } catch (error) {
      console.error('Failed to start presentation:', error);
      throw error;
    }
  }, [agoraClient, socketClient, state.currentEvent]);

  const endPresentation = useCallback(async (): Promise<void> => {
    try {
      if (localVideoTrack) {
        localVideoTrack.close();
        setLocalVideoTrack(null);
      }
      if (localAudioTrack) {
        localAudioTrack.close();
        setLocalAudioTrack(null);
      }

      await agoraClient.leave();

      socketClient.emit('presentation_ended', {
        eventId: state.currentEvent?.id
      });
    } catch (error) {
      console.error('Failed to end presentation:', error);
      throw error;
    }
  }, [agoraClient, socketClient, localVideoTrack, localAudioTrack, state.currentEvent]);

  const shareScreen = useCallback(async (): Promise<void> => {
    try {
      const screenTrack = await AgoraRTC.createScreenVideoTrack();
      await agoraClient.unpublish(localVideoTrack ? [localVideoTrack] : []);
      await agoraClient.publish([screenTrack]);

      socketClient.emit('screen_sharing_started', {
        eventId: state.currentEvent?.id
      });
    } catch (error) {
      console.error('Failed to share screen:', error);
      throw error;
    }
  }, [agoraClient, localVideoTrack, socketClient, state.currentEvent]);

  const sendChatMessage = useCallback(async (content: string, type: 'message' | 'question' = 'message'): Promise<void> => {
    try {
      const message: Omit<ChatMessage, 'id'> = {
        userId: 'current_user_id',
        username: 'Current User',
        content,
        timestamp: new Date(),
        type,
        isModerated: false
      };

      const { data, error } = await supabaseClient
        .from('chat_messages')
        .insert(message);

      if (error) throw error;

      if (state.moderationEnabled) {
        const moderationResponse = await fetch('/api/moderate-content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, type })
        });

        if (!moderationResponse.ok) {
          console.warn('Content moderation failed');
        }
      }
    } catch (error) {
      console.error('Failed to send chat message:', error);
      throw error;
    }
  }, [supabaseClient, state.moderationEnabled]);

  const createPoll = useCallback(async (question: string, options: string[]): Promise<void> => {
    try {
      const poll: Omit<Poll, 'id'> = {
        question,
        options: options.map((text, index) => ({
          id: `option_${index}`,
          text,
          votes: 0
        })),
        isActive: true
      };

      const { data, error } = await supabaseClient
        .from('polls')
        .insert(poll);

      if (error) throw error;

      socketClient.emit('poll_created', poll);
    } catch (error) {
      console.error('Failed to create poll:', error);
      throw error;
    }
  }, [supabaseClient, socketClient]);

  const sendReaction = useCallback((type: Reaction['type']): void => {
    try {
      const reaction: Omit<Reaction, 'id'> = {
        userId: 'current_user_id',
        type,
        timestamp: new Date(),
        position: new THREE.Vector3(
          Math.random() * 10 - 5,
          Math.random() * 5 + 2,
          Math.random() * 10 - 5
        )
      };

      socketClient.emit('reaction_sent', reaction);
    } catch (error) {
      console.error('Failed to send reaction:', error);
    }
  }, [socketClient]);

  const joinNetworkingRoom = useCallback(async (roomId: string): Promise<void> => {
    try {
      socketClient.emit('join_networking_room', {
        userId: 'current_user_id',
        roomId
      });

      dispatch({
        type: 'JOIN_NETWORKING_ROOM',
        payload: { userId: 'current_user_id', roomId }
      });
    } catch (error) {
      console.error('Failed to join networking room:', error);
      throw error;
    }
  }, [socketClient]);

  const leaveNetworkingRoom = useCallback(async (): Promise<void> => {
    try {
      const currentParticipant = state.participants.find(p => p.id === 'current_user_id');
      if (currentParticipant?.networkingRoomId) {
        socketClient.emit('leave_networking_room', {
          userId: 'current_user_id',
          roomId: currentParticipant.networkingRoomId
        });

        dispatch({
          type: 'LEAVE_NETWORKING_ROOM',
          payload: { userId: 'current_user_id', roomId: currentParticipant.networkingRoomId }
        });
      }
    } catch (error) {
      console.error('Failed to leave networking room:', error);
      throw error;
    }
  }, [socketClient, state.participants]);

  const contextValue = {
    state,
    dispatch,
    supabaseClient,
    socketClient,
    agoraClient,
    startPresentation,
    endPresentation,
    shareScreen,
    sendChatMessage,
    createPoll,
    sendReaction,
    joinNetworkingRoom,
    leaveNetworkingRoom
  };

  return (
    <ConferenceHallContext.Provider value={contextValue}>
      {children}
    </ConferenceHallContext.Provider>
  );
};

/**
 * Hook to use Conference Hall Context
 */
export const useConferenceHall = () => {
  const context = useContext(ConferenceHallContext);
  if (!context) {
    throw new Error('useConferenceHall must be used within ConferenceHallProvider');
  }
  return context;
};

/**
 * Virtual Stage Component
 */
const VirtualStage: React.FC = () => {
  const { state } = useConferenceHall();
  const groupRef = useRef<THREE.Group>(null);

  return (
    <group ref={groupRef} position={[0, 0, -15]}>
      <Plane args={[20, 10]} position={[0, 5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#2a2a2a" />
      </Plane>
      <Box args={[15, 8, 1]} position={[0, 4, -0.5]}>
        <meshStandardMaterial color="#1a1a1a" />
      </Box>
      {state.isPresenting && (
        <Text
          position={[0, 8, 1]}
          fontSize={2}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {state.currentEvent?.title || 'Live Presentation'}
        </Text>
      )}
      <pointLight position={[0, 10, 5]} intensity={1} color="white" />
      <spotLight
        position={[0, 15, 0]}
        angle={0.3}
        penumbra={1}
        intensity={2}
        target-position={[0, 0, 0]}
      />
    </group>
  );
};

/**
 * Audience Seating Component
 */
const AudienceSeating: React.FC = () => {
  const { state } = useConferenceHall();

  const seatPositions = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    const rows = 8;
    const seatsPerRow = 12;
    const seatSpacing = 2;
    const rowSpacing = 3;

    for (let row = 0; row < rows; row++) {
      for (let seat = 0; seat < seatsPerRow; seat++) {
        positions.push(new THREE.Vector3(
          (seat - seatsPerRow / 2) * seatSpacing,
          0.5,
          row * rowSpacing + 5
        ));
      }
    }
    return positions;
  }, []);

  return (
    <group>
      {seatPositions.map((position, index) => {
        const participant = state.participants[index];
        return (
          <group key={index} position={position}>
            <Box args={[1, 1, 1]}>
              <meshStandardMaterial color={participant ? "#4CAF50" : "#757575"} />
            </Box>
            {participant && (
              <Sphere args={[0.3]} position={[0, 1.5, 0]}>
                <meshStandardMaterial color="#FFB74D" />
              </Sphere>
            )}
            {participant && participant.isActive && (
              <Text
                position={[0, 2.2, 0]}
                fontSize={0.3}
                color="white"
                anchorX="center"
                anchorY="middle"
              >
                {participant.name}
              </Text>
            )}
          </group>
        );
      })}
    </group>
  );
};

/**
 * Presentation Canvas Component
 */
const PresentationCanvas: React.FC = () => {
  const { state } = useConferenceHall();
  const [currentSlide, setCurrentSlide] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && state.isPresenting) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
          state.currentEvent?.title || 'Presentation',
          canvas.width / 2,
          canvas.height / 2
        );
      }
    }
  }, [state.isPresenting, state.currentEvent, currentSlide]);

  return (
    <div className="presentation-canvas" style={{
      position: 'absolute',
      top: '20px',
      right: '20px',
      width: '400px',
      height: '225px',
      backgroundColor: '#000',
      border: '2px solid #333',
      borderRadius: '8px',
      overflow: 'hidden',
      display: state.isPresenting ? 'block' : 'none'
    }}>
      <canvas
        ref={canvasRef}
        width={400}
        height={225}
        style={{ width: '100%', height: '100%' }}
      />
      <div className="presentation-controls" style={{
        position: 'absolute',
        bottom: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '10px'
      }}>
        <button
          onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
          style={{
            backgroundColor: '#333',
            color: 'white',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Previous
        </button>
        <span style={{ color: 'white', alignSelf: 'center' }}>
          {currentSlide + 1}
        </span>
        <button
          onClick={() => setCurrentSlide