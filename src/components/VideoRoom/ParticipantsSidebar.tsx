import React from "react";
import { StudentAttention } from "../../types/videoRoom";

interface Participant {
  id: string;
  name: string;
}

interface ParticipantsSidebarProps {
  username: string;
  participants: Participant[];
  studentsAttention: Map<string, StudentAttention>;
  isTeacher: boolean;
}

const ParticipantsSidebar: React.FC<ParticipantsSidebarProps> = ({
  username,
  participants,
  studentsAttention,
  isTeacher,
}) => {
  return (
    <div className="sidebar-section participants-section">
      <h3>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        Participantes ({participants.length + 1})
      </h3>
      <div className="participants-list">
        <div className="participant-item">
          <div className="participant-avatar">{username.charAt(0).toUpperCase()}</div>
          <span>{username} (Você)</span>
        </div>
        {participants.map((participant) => {
          const studentAtt = studentsAttention.get(participant.id);
          return (
            <div key={participant.id} className="participant-item">
              <div className="participant-avatar">{participant.name.charAt(0).toUpperCase()}</div>
              <span>{participant.name}</span>
              {isTeacher && studentAtt && (
                <span className={`participant-status ${studentAtt.isAttentive ? "attentive" : "inattentive"}`}>
                  {studentAtt.isAttentive ? "●" : "○"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ParticipantsSidebar;

