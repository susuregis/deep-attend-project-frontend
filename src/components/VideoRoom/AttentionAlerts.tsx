import React from "react";

interface AttentionAlert {
  id: string;
  name: string;
  timestamp: Date;
}

interface AttentionAlertsProps {
  alerts: AttentionAlert[];
  onClear: () => void;
}

const AttentionAlerts: React.FC<AttentionAlertsProps> = ({ alerts, onClear }) => {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="attention-alerts-container">
      <div className="attention-alerts-header">
        <span className="alert-icon">⚠️</span>
        <span>Alertas de Atenção</span>
        <button className="clear-alerts-btn" onClick={onClear} title="Limpar alertas">
          ✕
        </button>
      </div>
      <div className="attention-alerts-list">
        {alerts.map((alert, index) => (
          <div key={`${alert.id}-${index}`} className="attention-alert-item">
            <span className="alert-badge">!</span>
            <span className="alert-name">{alert.name}</span>
            <span className="alert-message">não está prestando atenção</span>
            <span className="alert-time">
              {alert.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AttentionAlerts;

