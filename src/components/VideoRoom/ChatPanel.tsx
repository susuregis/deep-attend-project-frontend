import React, { KeyboardEvent } from "react";
import { ChatMessage } from "../../types/videoRoom";

interface ChatPanelProps {
  chatMessages: ChatMessage[];
  message: string;
  onMessageChange: (value: string) => void;
  onSendMessage: () => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  chatMessages,
  message,
  onMessageChange,
  onSendMessage,
  containerRef,
}) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      onSendMessage();
    }
  };

  return (
    <div className="chat-section">
      <div className="chat-messages" ref={containerRef}>
        {chatMessages.length === 0 ? (
          <div className="empty-chat">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p>Nenhuma mensagem ainda</p>
            <span>Seja o primeiro a enviar!</span>
          </div>
        ) : (
          chatMessages.map((msg) => (
            <div key={msg.id} className={`chat-msg ${msg.isMe ? "me" : "other"}`}>
              <div className="msg-header">
                <span className="msg-sender">{msg.isMe ? "Você" : msg.sender}</span>
                <span className="msg-time">{msg.time}</span>
              </div>
              <div className="msg-text">{msg.text}</div>
            </div>
          ))
        )}
      </div>
      <div className="chat-input-area">
        <input
          type="text"
          placeholder="Digite sua mensagem..."
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button onClick={onSendMessage} disabled={!message.trim()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ChatPanel;

