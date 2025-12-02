import React, { useEffect, useRef, useState, useCallback } from "react";
import * as faceapi from "face-api.js";
import SimplePeer from "simple-peer";
import { connectSocket, getSocket, disconnectSocket } from "./socket";
import { useAuth } from "./context/AuthContext";
import EntryScreen from "./components/VideoRoom/EntryScreen";
import RoomHeader from "./components/VideoRoom/RoomHeader";
import AttentionAlerts from "./components/VideoRoom/AttentionAlerts";
import ParticipantsSidebar from "./components/VideoRoom/ParticipantsSidebar";
import ChatPanel from "./components/VideoRoom/ChatPanel";
import TranscriptPanel from "./components/VideoRoom/TranscriptPanel";
import VideoGrid from "./components/VideoRoom/VideoGrid";
import AIAssistantV2 from "./components/AIAssistantV2";
import { ToastContainer, useToast } from "./components/Toast";
import {
  PeerData,
  PredictionResult,
  ChatMessage,
  StudentAttention,
  TranscriptEntry,
} from "./types/videoRoom";
import { apiPost } from "./services/apiClient";
import "./VideoRoom.css";

const VideoRoom: React.FC = () => {
  const { user, token, logout } = useAuth();
  const toast = useToast();
  const [peers, setPeers] = useState<PeerData[]>([]);
  const [myStream, setMyStream] = useState<MediaStream | null>(null);
  const peersRef = useRef<PeerData[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [joined, setJoined] = useState<boolean>(false);
  const [username, setUsername] = useState<string>(user?.username || "");
  const [roomCode, setRoomCode] = useState<string>('');
  const [entryAnim, setEntryAnim] = useState(false);
  const [participants, setParticipants] = useState<Array<{id: string, name: string}>>([]);
  const [attentionStatus, setAttentionStatus] = useState<string>("");
  const [loadingAttention, setLoadingAttention] = useState(false);
  const [predictionData, setPredictionData] = useState<PredictionResult | null>(null);
  const cameraOn = true; // Câmera sempre ligada
  const [micOn, setMicOn] = useState<boolean>(true);
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'transcript' | 'chat'>('chat');
  const [studentsAttention, setStudentsAttention] = useState<Map<string, StudentAttention>>(new Map());
  const [attentionAlerts, setAttentionAlerts] = useState<Array<{id: string, name: string, timestamp: Date}>>([]);
  const alertedStudentsRef = useRef<Set<string>>(new Set()); // Para evitar alertas repetidos
  const myVideoRef = useRef<HTMLVideoElement | null>(null);
  const attentionInterval = useRef<NodeJS.Timeout | null>(null);
  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const socketRef = useRef<any>(null);
  const myStreamRef = useRef<MediaStream | null>(null);
  const participantsRef = useRef<Array<{id: string, name: string}>>([]);

  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';

  // Inicializa nome do usuário
  useEffect(() => {
    if (user?.username) {
      setUsername(user.username);
    }
  }, [user]);

  // Rola chat para baixo
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Rola transcrição para baixo
  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [transcriptEntries]);

  // Carrega modelos face-api (só alunos)
  useEffect(() => {
    if (isTeacher) return; // Professor não precisa detecção facial

    (async function loadModels() {
      try {
        const MODEL_URL = '/models';
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        setFaceModelsLoaded(true);
        console.log('face-api models loaded');
      } catch (e) {
        console.warn('face-api models could not be loaded', e);
        setFaceModelsLoaded(false);
      }
    })();
  }, [isTeacher]);

  // Captura e envia frame para atenção (só aluno)
  const captureAndSendFrame = useCallback(async () => {
    if (isTeacher) return; // Professor não faz detecção de atenção
    if (!myVideoRef.current || !cameraOn) return;
    const video = myVideoRef.current;

    let sendBlob: Blob | null = null;
    try {
      if (faceModelsLoaded) {
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 });
        const detection = await faceapi.detectSingleFace(video, options);
        if (detection && detection.box) {
          const box = detection.box;
          const cw = Math.max(64, Math.round(box.width));
          const ch = Math.max(64, Math.round(box.height));
          const canvas = document.createElement('canvas');
          canvas.width = cw;
          canvas.height = ch;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, box.x, box.y, box.width, box.height, 0, 0, cw, ch);
            sendBlob = await new Promise<Blob | null>(res => canvas.toBlob(b => res(b), 'image/jpeg'));
          }
        }
      }
    } catch (e) {
      console.warn('face detection failed', e);
      sendBlob = null;
    }

    if (!sendBlob) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 224;
      canvas.height = video.videoHeight || 224;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      sendBlob = await new Promise<Blob | null>(res => canvas.toBlob(b => res(b), 'image/jpeg'));
    }

    if (!sendBlob) return;
    setLoadingAttention(true);
    try {
      const formData = new FormData();
      formData.append('file', sendBlob, 'frame.jpg');
      const data = await apiPost('/predict', formData, { skipJson: true });
      setPredictionData(data);

      if (data.success) {
        // Compara probabilidades para status
        // prob_atento e prob_desatento são percentuais
        const isAttentive = data.prob_atento > data.prob_desatento;
        const statusLabel = isAttentive ? 'Atento' : 'Desatento';
        setAttentionStatus(statusLabel);

        // Envia status de atenção pelo socket
        const socket = getSocket();
        if (socket) {
          socket.emit('attention_update', {
            room: roomCode,
            name: username,
            is_attentive: isAttentive,
            confidence: data.confianca,
            prob_attentive: data.prob_atento / 100,
            prob_inattentive: data.prob_desatento / 100
          });
        }
      } else {
        setAttentionStatus('Erro');
      }
    } catch (e) {
      setAttentionStatus('Offline');
    } finally {
      setLoadingAttention(false);
    }
  }, [cameraOn, faceModelsLoaded, roomCode, username, isTeacher]);

  // Cria conexão peer
  const createPeer = useCallback((userId: string, userName: string, socket: any, stream: MediaStream | null, initiator: boolean, offerSignal?: any) => {
    // Limpa peers destruídos
    peersRef.current = peersRef.current.filter(p => !p.peer.destroyed);

    const existingPeer = peersRef.current.find(p => p.id === userId);

    // Se já existe peer para usuário
    if (existingPeer) {
      // Se chegou offer, destrói e recria
      if (offerSignal) {
        console.log(`Destroying existing peer for ${userId} to handle incoming offer`);
        try {
          existingPeer.peer.destroy();
        } catch (e) {
          console.log('Error destroying peer:', e);
        }
        peersRef.current = peersRef.current.filter(p => p.id !== userId);
        setPeers(prev => prev.filter(p => p.id !== userId));
      } else {
        // Sem offer e já tem peer - ignora
        console.log(`Peer already exists for ${userId}, skipping creation`);
        return;
      }
    }

    console.log(`Creating peer for ${userName} (${userId}), initiator: ${initiator}, hasStream: ${!!stream}, hasOffer: ${!!offerSignal}`);

    const peer = new SimplePeer({
      initiator,
      trickle: true,
      stream: stream || undefined,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
        ]
      }
    });

    peer.on('signal', (signal: any) => {
      // Verifica se peer não destruído antes de sinalizar
      if (peer.destroyed) {
        console.log(`Peer ${userId} destroyed, not sending signal`);
        return;
      }
      console.log(`Signaling to ${userId}, type: ${signal.type || 'candidate'}`);
      if (signal.type === 'offer') {
        socket.emit('offer', { target: userId, offer: signal });
      } else if (signal.type === 'answer') {
        socket.emit('answer', { target: userId, answer: signal });
      } else if (signal.candidate) {
        socket.emit('ice_candidate', { target: userId, candidate: signal });
      }
    });

    peer.on('stream', (remoteStream: MediaStream) => {
      const videoTracks = remoteStream.getVideoTracks();
      const audioTracks = remoteStream.getAudioTracks();
      console.log('Received stream from:', userId,
        'video tracks:', videoTracks.length,
        'audio tracks:', audioTracks.length,
        'video enabled:', videoTracks[0]?.enabled,
        'video readyState:', videoTracks[0]?.readyState
      );

      // Atualiza estado com nova stream
      setPeers(prev => {
        const newPeers = prev.filter(p => p.id !== userId);
        return [...newPeers, { peer, stream: remoteStream, id: userId, name: userName }];
      });

      const peerData = peersRef.current.find(p => p.id === userId);
      if (peerData) {
        peerData.stream = remoteStream;
      }
    });

    // Escuta evento de track para garantir vídeo
    peer.on('track', (track: MediaStreamTrack, stream: MediaStream) => {
      console.log('Received track from:', userId, 'kind:', track.kind, 'enabled:', track.enabled);
    });

    peer.on('connect', () => {
      console.log('Peer connected:', userId);
    });

    peer.on('error', (err: any) => {
      const errStr = String(err);
      // Ignora erros de estado esperados
      if (errStr.includes('stable') || errStr.includes('location') || errStr.includes('destroyed')) {
        console.log('Peer non-critical error for', userId, ':', errStr);
      } else {
        console.error('Peer error for', userId, ':', err);
      }
    });

    peer.on('close', () => {
      console.log('Peer closed:', userId);
      // Limpa refs ao fechar peer
      peersRef.current = peersRef.current.filter(p => p.id !== userId);
      setPeers(prev => prev.filter(p => p.id !== userId));
    });

    if (offerSignal) {
      try {
        peer.signal(offerSignal);
      } catch (e) {
        console.error('Error signaling offer:', e);
      }
    }

    const peerData: PeerData = { peer, stream: null, id: userId, name: userName };
    peersRef.current.push(peerData);
    setPeers(prev => {
      // Evita duplicatas
      if (prev.some(p => p.id === userId)) return prev;
      return [...prev, peerData];
    });
  }, []);

  // Atualiza ref da stream local
  useEffect(() => {
    myStreamRef.current = myStream;
  }, [myStream]);

  // Atualiza ref de participantes
  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  // Inicializa mídia ao entrar
  useEffect(() => {
    if (!joined) return;

    let isMounted = true;

    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        console.log('Media initialized with tracks:', stream.getTracks().length);
        setMyStream(stream);
        myStreamRef.current = stream;

        if (myVideoRef.current) {
          myVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Error accessing media devices:', err);
        // Seta stream vazia para conectar socket
        setMyStream(new MediaStream());
      }
    };

    initMedia();

    return () => {
      isMounted = false;
    };
  }, [joined]);

  // Efeito principal do socket
  useEffect(() => {
    // Espera stream inicializar
    if (!joined || !myStream) return;

    console.log('Setting up socket with stream ready');
    const socket = connectSocket();
    socketRef.current = socket;

    // Entra na sala com info de papel
    socket.emit("join_room", {
      room: roomCode,
      name: username,
      user_id: user?.id,
      role: user?.role || 'student'
    });

    // Inicia intervalo de atenção (só aluno)
    if (!isTeacher) {
      if (attentionInterval.current) clearInterval(attentionInterval.current);
      attentionInterval.current = setInterval(captureAndSendFrame, 4000);
    }

    // Socket event handlers
    socket.on("existing-users", ({ users }: { users: Array<{id: string, name: string}> }) => {
      console.log('Existing users:', users);
      users.forEach(u => {
        setParticipants(prev => {
          if (prev.some(p => p.id === u.id)) return prev;
          return [...prev, u];
        });
        // Novo usuário inicia conexão com usuários existentes (initiator: true)
        createPeer(u.id, u.name, socket, myStreamRef.current, true);
      });
    });

    socket.on("user-joined", ({ id, name }: { id: string, name?: string }) => {
      console.log('User joined:', id, name);
      const userName = name || 'Anônimo';
      setParticipants(prev => {
        if (prev.some(p => p.id === id)) return prev;
        return [...prev, { id, name: userName }];
      });
      // Não criar peer aqui - esperar a offer do novo usuário
      // O novo usuário vai criar como initiator via "existing-users" e enviar offer
      console.log(`User ${userName} joined, waiting for their offer...`);
    });

    socket.on("user-left", ({ id }: { id: string }) => {
      console.log('User left:', id);
      setParticipants(prev => prev.filter(p => p.id !== id));
      setPeers(prev => {
        const peerToRemove = prev.find(p => p.id === id);
        if (peerToRemove) {
          try { peerToRemove.peer.destroy(); } catch (e) {}
        }
        return prev.filter(p => p.id !== id);
      });
      peersRef.current = peersRef.current.filter(p => p.id !== id);

      // Remove from attention tracking
      setStudentsAttention(prev => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
    });

    socket.on("offer", ({ from, offer, name: senderName }: { from: string, offer: any, name?: string }) => {
      console.log('Received offer from:', from, 'name:', senderName);

      // Encontrar nome do participante - usar a ref para ter o valor mais atualizado
      const participantFromList = participantsRef.current.find(p => p.id === from);
      const existingPeer = peersRef.current.find(p => p.id === from);
      const name = senderName || participantFromList?.name || existingPeer?.name || 'Anônimo';

      console.log(`Creating peer for offer from ${from} with name: ${name}`);

      // Add to participants if not already there
      setParticipants(prev => {
        if (prev.some(p => p.id === from)) return prev;
        return [...prev, { id: from, name }];
      });

      // Criar peer como receptor (initiator: false) com a offer recebida
      createPeer(from, name, socket, myStreamRef.current, false, offer);
    });

    socket.on("answer", ({ from, answer }: { from: string, answer: any }) => {
      console.log('Received answer from:', from);
      const peerData = peersRef.current.find(p => p.id === from);
      if (peerData && !peerData.peer.destroyed) {
        // Verificar se o peer está esperando uma answer (estado have-local-offer)
        const pc = (peerData.peer as any)._pc as RTCPeerConnection | undefined;
        if (pc && pc.signalingState === 'have-local-offer') {
          try {
            peerData.peer.signal(answer);
            console.log('Answer signaled successfully to peer:', from);
          } catch (e) {
            console.error('Error signaling answer:', e);
          }
        } else {
          console.log(`Ignoring answer from ${from} - peer in wrong state: ${pc?.signalingState}`);
        }
      } else {
        console.log('No valid peer found for answer from:', from);
      }
    });

    socket.on("ice-candidate", ({ from, candidate }: { from: string, candidate: any }) => {
      const peerData = peersRef.current.find(p => p.id === from);
      if (peerData && candidate && !peerData.peer.destroyed) {
        const pc = (peerData.peer as any)._pc as RTCPeerConnection | undefined;
        // Só aplicar ICE candidates se não estiver em estado 'closed'
        if (pc && pc.signalingState !== 'closed') {
          try {
            peerData.peer.signal(candidate);
          } catch (e) {
            // Ignorar erros de ICE candidate em peers com problemas
            const errStr = String(e);
            if (!errStr.includes('destroyed') && !errStr.includes('stable')) {
              console.error('Error signaling ICE candidate:', e);
            }
          }
        }
      }
    });

    // Chat message handler
    socket.on("chat_message", (data: { sender: string, text: string, time: string }) => {
      const newMsg: ChatMessage = {
        id: Date.now().toString() + Math.random(),
        sender: data.sender,
        text: data.text,
        time: data.time,
        isMe: false
      };
      setChatMessages(prev => [...prev, newMsg]);
    });

    // Attention update from students (for teacher to see)
    socket.on("student_attention", (data: { odId: string, name: string, is_attentive: boolean, prob_attentive: number, prob_inattentive: number }) => {
      if (isTeacher) {
        const wasAttentive = studentsAttention.get(data.odId)?.isAttentive;

        setStudentsAttention(prev => {
          const newMap = new Map(prev);
          newMap.set(data.odId, {
            odId: data.odId,
            name: data.name,
            isAttentive: data.is_attentive,
            probAttentive: data.prob_attentive * 100,
            probInattentive: data.prob_inattentive * 100
          });
          return newMap;
        });

        // Criar alerta se o aluno ficou desatento (transição de atento para desatento)
        // Ou se é a primeira vez e já está desatento
        if (!data.is_attentive && (wasAttentive === true || wasAttentive === undefined)) {
          // Verificar se já não alertamos este aluno recentemente (últimos 30 segundos)
          if (!alertedStudentsRef.current.has(data.odId)) {
            alertedStudentsRef.current.add(data.odId);

            // Adicionar alerta
            setAttentionAlerts(prev => [
              { id: data.odId, name: data.name, timestamp: new Date() },
              ...prev.slice(0, 9) // Manter apenas os últimos 10 alertas
            ]);

            // Tocar som de alerta (opcional)
            try {
              const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleVUqQ3+k1+iLcCI3Pnisz+GYZys2SGei1/ScdDokPHKlyN6VXipBR3+RzeWCXSo7PmyXwtqOXCs7UHekyOCCWS0+SnCHwdqEXTY/YHmkuNKUaTlHVoibtMeIdEQ+UXmUtcmFaTtGV4CZqL6IfEU7SXaZqLl+bzpGVHCNo7p7bDxFVnWLorV2ZjxDRmaGlqlsXzxCQl+Ik6doXjpAQVqAj5xsXD1ARFR9jZdqWjpBQ1R5iZNmVjlAQVR1hpJjVTg+QFF0g5FhUjg+PU5wgI5eUDY8PEtufYxbTTU7OkdpeIlYSzQ5OENkdIZWRzM3NkBgcIRTRTE2NTtdboFQQjAzMjhZaX5NQC8yMTRWZnxLPy4wLzFSY3lJPS0uLi5QYHdHOywsLS1OXnVFOSsrKytMXHNDNysqKilKWnFBNSoqKShIWG4/NCkpKCdGVmw9MygoJyZFVWo7MicnJiVDU2g6MCYmJSRBUWY4LiUlJCM/T2Q2LSQkIyI9TWI0KyMjIiE7S2AyKiIiISA5SV4xKCEhICApI1MuJyAfHx4nIU8sJR8eHh0lH0opJB4dHRwjHUYoIh0cHBshG0MmIRwbGxofGUAkIBsaGhodF0ghHxoZGRgdF0ceHhkYGBcbFUQdHBgXFxYZE0EbGxcWFhUXEj4aGhYVFRQVEToYGRUUFBMTEDcXGBQTExISEDQVFxMSEhERDjEUFhIRERAQDC8TFREQEBAPCywSFBAQDw8OCikRExAPDw4NCSURExAODg4NCCYQEg8ODQ0MCCMPEg4NDQwLByEOEQ4NDAwLBh8NENDMywsLBR8MEMzLywsKBR0MEMvKygoKBBsKDcjJyQkJBBoJDMfIyAkJAxgIC8XIxwgJAxcHCsTHxwgIAhYGCcLGxgcIAhQFCMHFxQcIAhMEBsDExAYHAREEBcDDxAYHAQ8DBL7CwwUGAA4CAb3BwgQFAAwCAby/wQMEAAAKAQC8vr8CBAAAKAAA');
              audio.volume = 0.3;
              audio.play().catch(() => {});
            } catch (e) {}

            // Remover da lista de alertados após 30 segundos para permitir novo alerta
            setTimeout(() => {
              alertedStudentsRef.current.delete(data.odId);
            }, 30000);
          }
        } else if (data.is_attentive) {
          // Se voltou a prestar atenção, remover da lista de alertados
          alertedStudentsRef.current.delete(data.odId);
        }
      }
    });

    socket.on("session-ended", () => {
      toast.info("Aula encerrada", "A aula foi encerrada pelo professor.");
      leaveRoom(true);
    });

    // Receber transcrição em tempo real de outros participantes
    socket.on("transcript_update", (data: { speaker: string, text: string, odId: string, timestamp: string }) => {
      console.log('Transcrição recebida de:', data.speaker, '-', data.text);
      const newEntry: TranscriptEntry = {
        id: data.odId + '-' + Date.now().toString(),
        speaker: data.speaker,
        text: data.text,
        isMe: false,
        timestamp: data.timestamp
      };
      setTranscriptEntries(prev => {
        // Evitar duplicatas
        if (prev.some(e => e.id === newEntry.id)) return prev;
        return [...prev, newEntry];
      });
    });

    socket.on("ai-context-updated", (data: { room_code: string, has_context: boolean, message: string }) => {
      console.log('AI context updated:', data);
      // Show notification
      const msg: ChatMessage = {
        id: 'ai-' + Date.now(),
        sender: 'Sistema',
        text: data.message,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        isMe: false
      };
      setChatMessages(prev => [...prev, msg]);
    });

    return () => {
      socket.off("existing-users");
      socket.off("user-joined");
      socket.off("user-left");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.off("chat_message");
      socket.off("student_attention");
      socket.off("session-ended");
      socket.off("transcript_update");
      socket.off("ai-context-updated");

      if (attentionInterval.current) {
        clearInterval(attentionInterval.current);
      }
    };
  }, [joined, myStream, roomCode, username, user?.id, user?.role, createPeer, captureAndSendFrame, isTeacher]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (myStreamRef.current) {
        myStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Toggle microphone
  const toggleMic = () => {
    if (myStream) {
      const audioTrack = myStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !micOn;
        setMicOn(!micOn);
      }
    }
  };

  // Send chat message
  const sendMessage = () => {
    const socket = getSocket();
    if (socket && message.trim()) {
      const msgData = {
        room: roomCode,
        sender: username,
        text: message.trim(),
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };

      socket.emit("chat_message", msgData);

      const newMsg: ChatMessage = {
        id: Date.now().toString(),
        sender: username,
        text: message.trim(),
        time: msgData.time,
        isMe: true
      };
      setChatMessages(prev => [...prev, newMsg]);
      setMessage("");
    }
  };

  // Leave room
  const leaveRoom = (redirectToLogin: boolean = true) => {
    if (myStreamRef.current) {
      myStreamRef.current.getTracks().forEach(track => track.stop());
      myStreamRef.current = null;
    }
    if (myStream) {
      myStream.getTracks().forEach(track => track.stop());
      setMyStream(null);
    }

    peersRef.current.forEach(p => {
      try { p.peer.destroy(); } catch (e) {}
    });
    peersRef.current = [];

    if (attentionInterval.current) {
      clearInterval(attentionInterval.current);
      attentionInterval.current = null;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    disconnectSocket();
    socketRef.current = null;

    setJoined(false);
    setParticipants([]);
    setPeers([]);
    setChatMessages([]);
    setAttentionStatus('');
    setPredictionData(null);
    setTranscriptEntries([]);
    setStudentsAttention(new Map());
    setAttentionAlerts([]);

    window.history.replaceState({}, '', window.location.pathname);

    // Redirecionar para login (fazer logout)
    if (redirectToLogin) {
      logout();
    }
  };

  // End session (teacher only)
  const endSession = async () => {
    if (!isTeacher) return;

    const confirmed = window.confirm('Tem certeza que deseja encerrar a aula? Todos os participantes serão desconectados.');
    if (!confirmed) return;

    // Mostrar notificação de encerramento
    toast.info(
      'Encerrando aula',
      'A aula está sendo encerrada. Todos os participantes serão desconectados.'
    );

    // Notificar todos os participantes via Socket
    const socket = getSocket();
    if (socket) {
      socket.emit('end_session', { room: roomCode });
    }

    // Tentar encerrar via API (opcional, não bloqueia o redirecionamento)
    try {
      await apiPost(`/sessions/${roomCode}/end`, {}, { authToken: token });

      toast.success(
        'Aula encerrada',
        'A aula foi encerrada com sucesso. Redirecionando...'
      );
    } catch (error) {
      console.error('Error ending session via API:', error);
      toast.warning(
        'Aula encerrada localmente',
        'A chamada foi encerrada, mas houve um erro ao salvar no servidor.'
      );
    }

    // Aguardar 2 segundos para mostrar a notificação
    setTimeout(() => {
      leaveRoom(true);
    }, 2000);
  };


  // Join room
  const joinRoom = async () => {
    if (!username.trim()) {
      toast.warning('Nome obrigatório', 'Informe seu nome para entrar na sala.');
      return;
    }
    if (!roomCode.trim()) {
      toast.warning('Código obrigatório', 'Informe o código da sala para continuar.');
      return;
    }

    setEntryAnim(true);
    setTimeout(() => {
      setJoined(true);
      // Não adicionar 'me' aos participantes - será gerenciado separadamente
      setParticipants([]);

      const params = new URLSearchParams();
      params.set('room', roomCode);
      params.set('name', username);
      window.history.replaceState({}, '', `?${params.toString()}`);
    }, 300);
  };

  // Toggle transcription
  // Transcription is now automatic with microphone

  // Audio transcription using Web Speech API (browser native)
  useEffect(() => {
    if (!micOn || !joined) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
          recognitionRef.current = null;
        } catch (e) {
          console.log('Recognition cleanup error:', e);
        }
      }
      return;
    }

    // Check for Web Speech API support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('Web Speech API não suportada neste navegador');
      return;
    }

    // IMPORTANTE: O Web Speech API usa automaticamente o microfone padrão do sistema
    // Não há necessidade de passar um MediaStream, ele captura diretamente do microfone
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true; // Mostrar resultados parciais para feedback visual
    recognition.lang = 'pt-BR';
    recognition.maxAlternatives = 1;

    let interimTranscript = '';
    let isProcessing = false; // Flag para evitar processamento duplicado

    recognition.onresult = (event: any) => {
      // Evitar processamento se já estiver processando
      if (isProcessing) {
        console.log('[Transcrição] Ainda processando resultado anterior, ignorando...');
        return;
      }

      interimTranscript = '';
      let hasFinalResult = false;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript.trim();

        if (result.isFinal) {
          hasFinalResult = true;
          if (text && text.length > 0) {
            isProcessing = true;

            const timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const entryId = 'local-' + Date.now().toString() + '-' + Math.random();

            console.log(`[Transcrição Final] ${username}: "${text}"`);

            // Adicionar entrada local imediatamente
            const newEntry: TranscriptEntry = {
              id: entryId,
              speaker: username,
              text: text,
              isMe: true,
              timestamp
            };
            setTranscriptEntries(prev => {
              // Evitar duplicatas verificando se já existe texto similar nos últimos 2 segundos
              const recentEntries = prev.filter(e =>
                e.isMe &&
                Date.now() - parseInt(e.id.split('-')[1]) < 2000
              );
              const isDuplicate = recentEntries.some(e => e.text === text);

              if (isDuplicate) {
                console.log('[Transcrição] Duplicata detectada, ignorando');
                return prev;
              }

              return [...prev, newEntry];
            });

            // Enviar para outros participantes via Socket.IO
            const socket = getSocket();
            if (socket && socket.connected) {
              console.log('[Socket] Enviando transcrição para sala:', roomCode);
              socket.emit('transcript_update', {
                room: roomCode,
                speaker: username,
                text: text,
                timestamp
              });
            } else {
              console.warn('[Socket] Não conectado, transcrição não enviada');
            }

            // Liberar processamento após um pequeno delay
            setTimeout(() => {
              isProcessing = false;
            }, 500);
          }
        } else {
          // Resultado parcial (interim) - apenas log para debug
          interimTranscript += text;
        }
      }

      if (interimTranscript && !hasFinalResult) {
        console.log(`[Transcrição Parcial] ${username}: "${interimTranscript}..."`);
      }
    };

    recognition.onerror = (event: any) => {
      const errorType = event.error;
      console.log(`[Transcrição Erro] Tipo: ${errorType}`);

      // Liberar flag de processamento em caso de erro
      isProcessing = false;

      // Erros que não devem tentar reiniciar
      const nonRecoverableErrors = ['not-allowed', 'service-not-allowed'];

      if (nonRecoverableErrors.includes(errorType)) {
        console.error('[Transcrição] Erro não recuperável:', errorType);
        return;
      }

      // Para outros erros (exceto no-speech e aborted que são normais), reiniciar
      if (errorType !== 'no-speech' && errorType !== 'aborted') {
        console.log('[Transcrição] Tentando reiniciar após erro...');
        setTimeout(() => {
          if (micOn && joined && recognitionRef.current === recognition) {
            try {
              recognition.start();
              console.log('[Transcrição] Reiniciado após erro');
            } catch (e) {
              console.log('[Transcrição] Erro ao reiniciar:', e);
            }
          }
        }, 1000);
      }
    };

    recognition.onstart = () => {
      console.log('[Transcrição] Reconhecimento de voz iniciado');
      isProcessing = false; // Resetar flag quando iniciar
    };

    recognition.onend = () => {
      console.log('[Transcrição] Reconhecimento de voz encerrado');
      isProcessing = false; // Resetar flag quando encerrar

      // Reiniciar automaticamente se ainda estiver ativo
      if (micOn && joined && recognitionRef.current === recognition) {
        setTimeout(() => {
          try {
            recognition.start();
            console.log('[Transcrição] Reiniciado automaticamente');
          } catch (e) {
            const errMsg = String(e);
            // Ignorar erro "already started" que é comum
            if (!errMsg.includes('already started')) {
              console.log('[Transcrição] Erro ao reiniciar:', e);
            }
          }
        }, 500);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      console.log('Sistema de transcrição por voz iniciado (Web Speech API)');
    } catch (e) {
      console.error('Erro ao iniciar reconhecimento de voz:', e);
    }

    return () => {
      try {
        recognition.stop();
      } catch (e) {
        console.log('Error stopping recognition:', e);
      }
    };
  }, [micOn, joined, username, roomCode]);

  // Get attention stats for teacher
  const getAttentionStats = () => {
    const students = Array.from(studentsAttention.values());
    const total = students.length;
    const attentive = students.filter(s => s.isAttentive === true).length;
    const inattentive = students.filter(s => s.isAttentive === false).length;
    return { total, attentive, inattentive };
  };

  const stats = getAttentionStats();

  const handleCopyRoomLink = () => {
    if (!roomCode) return;
    const url = `${window.location.origin}?room=${roomCode}`;
    navigator.clipboard
      ?.writeText(url)
      .then(() => toast.success('Link copiado!', 'O link da sala foi copiado para sua área de transferência.'))
      .catch(() => toast.error('Erro ao copiar', 'Não foi possível copiar o link da sala.'));
  };

  const copyTranscript = () => {
    const text = transcriptEntries.map((entry) => `${entry.speaker}: ${entry.text}`).join('\n');
    navigator.clipboard
      ?.writeText(text)
      .then(() => toast.success('Transcrição copiada', 'O conteúdo foi copiado.'))
      .catch(() => toast.error('Erro ao copiar', 'Não foi possível copiar a transcrição.'));
  };

  if (!joined) {
    return (
      <>
        <EntryScreen
          username={username}
          roomCode={roomCode}
          entryAnim={entryAnim}
          isTeacher={isTeacher}
          user={user}
          onUsernameChange={setUsername}
          onRoomCodeChange={(value) => setRoomCode(value.toUpperCase())}
          onJoinRoom={joinRoom}
          onLogout={logout}
          onCopyRoomLink={roomCode ? handleCopyRoomLink : undefined}
        />
        <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
      </>
    );
  }

  return (
    <div className="video-room">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
      <div className="main-content">
        <RoomHeader
          roomCode={roomCode}
          participantCount={participants.length + 1}
          stats={isTeacher && stats.total > 0 ? { attentive: stats.attentive, inattentive: stats.inattentive } : undefined}
          isTeacher={isTeacher}
          onEndSession={endSession}
          onLeaveRoom={() => leaveRoom(true)}
        />
        {isTeacher && (
          <AttentionAlerts alerts={attentionAlerts} onClear={() => setAttentionAlerts([])} />
        )}
        <VideoGrid
          username={username}
          myVideoRef={myVideoRef}
          micOn={micOn}
          toggleMic={toggleMic}
          isTeacher={isTeacher}
          loadingAttention={loadingAttention}
          attentionStatus={attentionStatus}
          predictionData={predictionData}
          peers={peers}
          studentsAttention={studentsAttention}
        />
      </div>
      <aside className="sidebar">
        <ParticipantsSidebar
          username={username}
          participants={participants}
          studentsAttention={studentsAttention}
          isTeacher={isTeacher}
        />
        <div className="sidebar-tabs">
          <button className={`tab ${activeTab === "chat" ? "active" : ""}`} onClick={() => setActiveTab("chat")}>
            Chat
          </button>
          <button
            className={`tab ${activeTab === "transcript" ? "active" : ""}`}
            onClick={() => setActiveTab("transcript")}
          >
            Transcrição
          </button>
        </div>
        <div className="sidebar-content">
          {activeTab === "chat" ? (
            <ChatPanel
              chatMessages={chatMessages}
              message={message}
              onMessageChange={setMessage}
              onSendMessage={sendMessage}
              containerRef={chatContainerRef}
            />
          ) : (
            <TranscriptPanel
              transcriptEntries={transcriptEntries}
              micOn={micOn}
              containerRef={transcriptContainerRef}
              onClear={() => setTranscriptEntries([])}
              onCopy={copyTranscript}
            />
          )}
        </div>
      </aside>
      <AIAssistantV2 roomCode={roomCode} token={token || ""} isTeacher={isTeacher} />
    </div>
  );
};

export default VideoRoom;
