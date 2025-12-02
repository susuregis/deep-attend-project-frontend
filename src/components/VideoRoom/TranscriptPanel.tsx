import React from "react";
import { TranscriptEntry } from "../../types/videoRoom";

interface TranscriptPanelProps {
  transcriptEntries: TranscriptEntry[];
  micOn: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  onClear: () => void;
  onCopy: () => void;
}

const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  transcriptEntries,
  micOn,
  containerRef,
  onClear,
  onCopy,
}) => {
  return (
    <div className="transcript-section">
      <div className="transcript-controls">
        <div className="transcript-status">
          {micOn ? (
            <>
              <span className="recording-dot" />
              <span>Transcrição em tempo real ativa</span>
            </>
          ) : (
            <span className="transcript-inactive">Ligue o microfone para iniciar a transcrição</span>
          )}
        </div>
      </div>
      <div className="transcript-content" ref={containerRef}>
        {transcriptEntries.length === 0 ? (
          <div className="empty-transcript">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            <p>Nenhuma transcrição ainda</p>
            <span>A transcrição aparecerá aqui em tempo real</span>
          </div>
        ) : (
          transcriptEntries.map((entry) => (
            <div key={entry.id} className={`transcript-entry ${entry.isMe ? "me" : "other"}`}>
              <span className="transcript-speaker">{entry.speaker}:</span>
              <span className="transcript-text">{entry.text}</span>
            </div>
          ))
        )}
      </div>
      {transcriptEntries.length > 0 && (
        <div className="transcript-actions">
          <button onClick={onClear}>Limpar</button>
          <button onClick={onCopy}>Copiar</button>
        </div>
      )}
    </div>
  );
};

export default TranscriptPanel;

