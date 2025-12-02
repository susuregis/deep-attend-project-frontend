import React, { useState, useEffect, useRef } from 'react';
import './AIAssistantV2.css';
import { ToastContainer, useToast } from './Toast';
import { API_URL } from '../config/api';

interface Message {
  role: 'user' | 'assistant';
  message: string;
  timestamp: string;
  sources?: string[];
}

interface AIAssistantV2Props {
  roomCode: string;
  token: string;
  isTeacher: boolean;
}

const AIAssistantV2: React.FC<AIAssistantV2Props> = ({ roomCode, token, isTeacher }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasContext, setHasContext] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadText, setUploadText] = useState('');
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen && roomCode && token) {
      checkContext();
      loadHistory();
    }
  }, [isOpen, roomCode]);

  const checkContext = async () => {
    try {
      // Try v2 first, fallback to v1
      let response = await fetch(`${API_URL}/ai/v2/context/${roomCode}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // If v2 doesn't exist (404), try v1
      if (response.status === 404) {
        response = await fetch(`${API_URL}/ai/context/${roomCode}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }

      const data = await response.json();
      setHasContext(data.has_context);
    } catch (error) {
      console.error('Error checking context:', error);
    }
  };

  const loadHistory = async () => {
    try {
      // Try v2 first, fallback to v1
      let response = await fetch(`${API_URL}/ai/v2/history/${roomCode}?limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // If v2 doesn't exist (404), try v1
      if (response.status === 404) {
        response = await fetch(`${API_URL}/ai/history/${roomCode}?limit=50`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }

      const data = await response.json();
      setMessages(data.conversation || []);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const handleUpload = async () => {
    if (!uploadText.trim() && uploadFiles.length === 0) {
      toast.warning('Atenção', 'Adicione pelo menos um arquivo ou digite algum texto');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();

      // Add text if provided
      if (uploadText.trim()) {
        formData.append('context', uploadText);
      }

      // Add files if provided
      uploadFiles.forEach(file => {
        formData.append('files', file);
      });

      // Use v2 endpoint (supports files + text)
      const response = await fetch(`${API_URL}/ai/v2/context/${roomCode}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        const filesInfo = uploadFiles.length > 0
          ? `${uploadFiles.length} arquivo(s) processado(s)`
          : 'Texto adicionado';
        toast.success(
          'Materiais salvos!',
          `${filesInfo}. Os alunos já podem fazer perguntas sobre o conteúdo.`
        );
        setHasContext(true);
        setShowUpload(false);
        setUploadText('');
        setUploadFiles([]);
      } else if (response.status === 401) {
        toast.error('Sessão expirou', 'Faça login novamente');
        localStorage.clear();
        window.location.reload();
      } else {
        const error = await response.json();
        toast.error('Erro ao salvar', error.detail || 'Tente novamente');
      }
    } catch (error) {
      console.error('Error uploading:', error);
      toast.error('Erro de conexão', 'Não foi possível enviar os materiais');
    } finally {
      setUploading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || loading) return;

    const userMessage = inputMessage;
    setInputMessage('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('room_code', roomCode);
      formData.append('question', userMessage);

      // Try v2 first, fallback to v1
      let response = await fetch(`${API_URL}/ai/v2/ask`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      // If v2 doesn't exist (404), try v1
      if (response.status === 404) {
        response = await fetch(`${API_URL}/ai/ask`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
      }

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [
          ...prev,
          {
            role: 'user',
            message: userMessage,
            timestamp: data.timestamp
          },
          {
            role: 'assistant',
            message: data.answer,
            timestamp: data.timestamp,
            sources: data.sources
          }
        ]);
      } else if (response.status === 401) {
        toast.error('Sessão expirou', 'Faça login novamente');
        localStorage.clear();
        window.location.reload();
      } else {
        const error = await response.json();
        toast.error('Erro', error.detail || 'Não foi possível enviar a mensagem');
        setInputMessage(userMessage);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Erro de conexão', 'Não foi possível enviar a mensagem');
      setInputMessage(userMessage);
    } finally {
      setLoading(false);
    }
  };

  // Don't render if no room code or no token
  if (!roomCode || !token) {
    return null;
  }

  return (
    <>
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* Floating Button */}
      <button
        className={`ai-floating-btn ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Assistente de IA"
      >
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <path d="M9 10h.01M12 10h.01M15 10h.01" />
          </svg>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="ai-chat-window">
          {/* Header */}
          <div className="ai-chat-header">
            <div className="ai-header-left">
              <div className="ai-avatar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="3" />
                  <line x1="12" y1="2" x2="12" y2="5" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                  <line x1="4.93" y1="4.93" x2="7.05" y2="7.05" />
                  <line x1="16.95" y1="16.95" x2="19.07" y2="19.07" />
                  <line x1="2" y1="12" x2="5" y2="12" />
                  <line x1="19" y1="12" x2="22" y2="12" />
                </svg>
              </div>
              <div className="ai-header-info">
                <div className="ai-title">Assistente IA</div>
                <div className="ai-status">{hasContext ? 'Online' : 'Aguardando materiais'}</div>
              </div>
            </div>
            {isTeacher && (
              <button
                className="ai-upload-btn"
                onClick={() => setShowUpload(!showUpload)}
                title="Adicionar materiais"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </button>
            )}
          </div>

          {/* Upload Panel */}
          {isTeacher && showUpload && (
            <div className="ai-upload-panel">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.txt,.md"
                onChange={(e) => {
                  if (e.target.files) {
                    setUploadFiles(Array.from(e.target.files));
                  }
                }}
                style={{display: 'none'}}
              />

              <button
                className="file-picker-btn"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '10px 16px',
                  marginBottom: '10px',
                  backgroundColor: '#7c3aed',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Escolher Arquivos (PDF, Word, Excel, PowerPoint, TXT)
              </button>

              {uploadFiles.length > 0 && (
                <div style={{
                  marginBottom: '10px',
                  padding: '10px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '8px',
                  fontSize: '13px'
                }}>
                  <div style={{fontWeight: '600', marginBottom: '6px'}}>
                    {uploadFiles.length} arquivo(s) selecionado(s):
                  </div>
                  <ul style={{margin: 0, paddingLeft: '20px'}}>
                    {uploadFiles.map((file, i) => (
                      <li key={i}>{file.name}</li>
                    ))}
                  </ul>
                  <button
                    onClick={() => setUploadFiles([])}
                    style={{
                      marginTop: '8px',
                      padding: '4px 12px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Remover arquivos
                  </button>
                </div>
              )}

              <textarea
                className="upload-textarea"
                placeholder="Cole aqui texto adicional (opcional)..."
                value={uploadText}
                onChange={(e) => setUploadText(e.target.value)}
                rows={8}
              />

              <button
                className="upload-submit-btn"
                onClick={handleUpload}
                disabled={uploading || (!uploadText.trim() && uploadFiles.length === 0)}
              >
                {uploading ? 'Processando...' : 'Salvar Materiais'}
              </button>
            </div>
          )}

          {/* Messages */}
          <div className="ai-messages">
            {!hasContext && !isTeacher && (
              <div className="ai-empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p>O professor ainda não adicionou materiais</p>
              </div>
            )}

            {messages.length === 0 && hasContext && (
              <div className="ai-empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <p>Como posso ajudar você?</p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`ai-message ${msg.role}`}>
                <div className="message-bubble">
                  <div className="message-text">{msg.message}</div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="message-sources">
                      <span>Fontes:</span>
                      {msg.sources.map((source, i) => (
                        <span key={i} className="source-tag">{source}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="message-time">
                  {new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {hasContext && (
            <div className="ai-input-area">
              <input
                type="text"
                placeholder="Digite sua pergunta..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                disabled={loading}
              />
              <button onClick={sendMessage} disabled={loading || !inputMessage.trim()}>
                {loading ? (
                  <svg className="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default AIAssistantV2;
