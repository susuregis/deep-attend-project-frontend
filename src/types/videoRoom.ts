import SimplePeer from "simple-peer";

export interface PeerData {
  peer: SimplePeer.Instance;
  stream: MediaStream | null;
  id: string;
  name: string;
}

export interface PredictionResult {
  success: boolean;
  atento: boolean;
  classe: string;
  confianca: number;
  prob_atento: number;
  prob_desatento: number;
  probabilidades: { [key: string]: number };
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
  isMe: boolean;
}

export interface StudentAttention {
  odId: string;
  name: string;
  isAttentive: boolean | null;
  probAttentive: number;
  probInattentive: number;
}

export interface TranscriptEntry {
  id: string;
  speaker: string;
  text: string;
  isMe: boolean;
  timestamp: string;
}

