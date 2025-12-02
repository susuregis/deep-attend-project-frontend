import React from "react";

interface RoomHeaderProps {
  roomCode: string;
  participantCount: number;
  stats?: { attentive: number; inattentive: number };
  isTeacher: boolean;
  onEndSession: () => void;
  onLeaveRoom: () => void;
}

const RoomHeader: React.FC<RoomHeaderProps> = ({
  roomCode,
  participantCount,
  stats,
  isTeacher,
  onEndSession,
  onLeaveRoom,
}) => {
  return (
    <header className="room-header">
      <div className="header-left">
        <h1>Sala: {roomCode}</h1>
        <span className="participant-badge">{participantCount} participante(s)</span>
        {isTeacher && stats && (
          <span className="attention-stats">
            <span className="stat-attentive">{stats.attentive} atentos</span>
            <span className="stat-inattentive">{stats.inattentive} desatentos</span>
          </span>
        )}
      </div>
      <div className="header-right">
        {isTeacher ? (
          <button className="btn-end" onClick={onEndSession}>
            Encerrar Aula
          </button>
        ) : (
          <button className="btn-leave" onClick={onLeaveRoom}>
            Sair da Sala
          </button>
        )}
      </div>
    </header>
  );
};

export default RoomHeader;

