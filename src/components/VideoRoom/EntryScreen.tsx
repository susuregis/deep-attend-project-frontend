import React from "react";
import { User } from "../../context/AuthContext";

interface EntryScreenProps {
  username: string;
  roomCode: string;
  entryAnim: boolean;
  isTeacher: boolean;
  user: User | null;
  onUsernameChange: (value: string) => void;
  onRoomCodeChange: (value: string) => void;
  onJoinRoom: () => void;
  onLogout: () => void;
  onCopyRoomLink?: () => void;
}

const EntryScreen: React.FC<EntryScreenProps> = ({
  username,
  roomCode,
  entryAnim,
  isTeacher,
  user,
  onUsernameChange,
  onRoomCodeChange,
  onJoinRoom,
  onLogout,
  onCopyRoomLink,
}) => {
  return (
    <div className={`entry-screen ${entryAnim ? "entry-leave" : ""}`}>
      <div className="entry-card">
        <div className="entry-logo">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 7l-7 5 7 5V7z" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        </div>
        <h1 className="entry-title">Sala de Aula Virtual</h1>
        {user && (
          <p className="entry-welcome">
            Olá, {user.username}!
            <span className="role-badge">{isTeacher ? "Professor" : "Aluno"}</span>
          </p>
        )}

        <div className="entry-fields">
          <div className="input-group">
            <label>Seu nome</label>
            <input
              type="text"
              placeholder="Digite seu nome"
              value={username}
              onChange={(e) => onUsernameChange(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label>Código da sala</label>
            <input
              type="text"
              placeholder="Ex: ABC123"
              value={roomCode}
              onChange={(e) => onRoomCodeChange(e.target.value.toUpperCase())}
              maxLength={10}
            />
          </div>
        </div>

        <div className="entry-buttons">
          <button className="btn-join" onClick={onJoinRoom} disabled={!username || !roomCode}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            Entrar na Sala
          </button>
        </div>

        <div className="entry-footer">
          {roomCode && onCopyRoomLink && (
            <button className="btn-link" onClick={onCopyRoomLink}>
              Copiar link da sala
            </button>
          )}
          <button className="btn-link logout" onClick={onLogout}>
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
};

export default EntryScreen;

