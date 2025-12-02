import React from "react";
import { PeerData, PredictionResult, StudentAttention } from "../../types/videoRoom";

interface VideoGridProps {
  myVideoRef: React.RefObject<HTMLVideoElement>;
  username: string;
  micOn: boolean;
  toggleMic: () => void;
  isTeacher: boolean;
  loadingAttention: boolean;
  attentionStatus: string;
  predictionData: PredictionResult | null;
  peers: PeerData[];
  studentsAttention: Map<string, StudentAttention>;
}

const VideoGrid: React.FC<VideoGridProps> = ({
  myVideoRef,
  username,
  micOn,
  toggleMic,
  isTeacher,
  loadingAttention,
  attentionStatus,
  predictionData,
  peers,
  studentsAttention,
}) => {
  return (
    <div className="video-grid">
      <div className="video-card my-video">
        <div className="video-container">
          <video ref={myVideoRef} autoPlay muted playsInline />

          <div className="video-controls-overlay">
            <button className={`control-btn ${micOn ? "on" : "off"}`} onClick={toggleMic}>
              {micOn ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="1" y1="1" x2="23" y2="23" />
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </button>
          </div>

          {!isTeacher && (
            <div
              className={`attention-indicator ${
                loadingAttention
                  ? "loading"
                  : attentionStatus.toLowerCase().includes("atento") &&
                    !attentionStatus.toLowerCase().includes("des")
                  ? "atento"
                  : "desatento"
              }`}
            >
              {loadingAttention ? "..." : attentionStatus || "Aguardando"}
            </div>
          )}

          {isTeacher && <div className="role-indicator">Professor</div>}
          <div className="name-badge">{username} (Você)</div>
        </div>

        {!isTeacher && predictionData && predictionData.success && (
          <div className="probability-bars">
            <div className="prob-row">
              <span className="prob-label">Atento</span>
              <div className="prob-track">
                <div className="prob-fill atento" style={{ width: `${predictionData.prob_atento}%` }} />
              </div>
              <span className="prob-value">{predictionData.prob_atento}%</span>
            </div>
            <div className="prob-row">
              <span className="prob-label">Desatento</span>
              <div className="prob-track">
                <div className="prob-fill desatento" style={{ width: `${predictionData.prob_desatento}%` }} />
              </div>
              <span className="prob-value">{predictionData.prob_desatento}%</span>
            </div>
          </div>
        )}
      </div>

      {peers.map((peer) => {
        const studentAttention = studentsAttention.get(peer.id);
        const hasVideoTrack = peer.stream && peer.stream.getVideoTracks().length > 0;
        return (
          <div key={peer.id} className="video-card">
            <div className="video-container">
              {peer.stream && hasVideoTrack ? (
                <video
                  autoPlay
                  playsInline
                  ref={(el) => {
                    if (el && peer.stream && el.srcObject !== peer.stream) {
                      el.srcObject = peer.stream;
                      el.play().catch(() => {});
                    }
                  }}
                />
              ) : (
                <div className="video-off">
                  <div className="avatar-circle">{peer.name.charAt(0).toUpperCase()}</div>
                  <span>{peer.stream ? "Câmera desativada" : "Conectando..."}</span>
                </div>
              )}

              {isTeacher && studentAttention && (
                <div className={`attention-indicator ${studentAttention.isAttentive ? "atento" : "desatento"}`}>
                  {studentAttention.isAttentive ? "Atento" : "Desatento"}
                </div>
              )}

              <div className="name-badge">{peer.name}</div>
            </div>

            {isTeacher && studentAttention && (
              <div className="probability-bars">
                <div className="prob-row">
                  <span className="prob-label">Atento</span>
                  <div className="prob-track">
                    <div className="prob-fill atento" style={{ width: `${studentAttention.probAttentive}%` }} />
                  </div>
                  <span className="prob-value">{studentAttention.probAttentive.toFixed(1)}%</span>
                </div>
                <div className="prob-row">
                  <span className="prob-label">Desatento</span>
                  <div className="prob-track">
                    <div className="prob-fill desatento" style={{ width: `${studentAttention.probInattentive}%` }} />
                  </div>
                  <span className="prob-value">{studentAttention.probInattentive.toFixed(1)}%</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default VideoGrid;

