import { useEffect, useState } from 'react';
import { clearChatHistory, getChatHistory, sendChat } from '../services/health.service';
import { connectSocket, disconnectSocket } from '../services/socket';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';

function ChatbotPage() {
  const { token } = useAuth();
  const { language, t } = useLanguage();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState('');
  const [chats, setChats] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 10 });

  const loadHistory = async (targetPage = page) => {
    setHistoryLoading(true);
    try {
      const res = await getChatHistory(targetPage, 10);
      setChats(res.data?.items || []);
      setPagination(res.data?.pagination || { page: 1, totalPages: 1, total: 0, limit: 10 });
      setPage(targetPage);
    } catch (_err) {
      setChats([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory(1);
  }, []);

  useEffect(() => {
    if (!token) return undefined;

    const socket = connectSocket(token);
    if (!socket) return undefined;

    const handleAssessment = () => {
      window.dispatchEvent(new CustomEvent('app:error', { detail: { message: t.liveUpdate } }));
      loadHistory(1);
    };

    socket.on('assessment:created', handleAssessment);

    return () => {
      socket.off('assessment:created', handleAssessment);
      disconnectSocket();
    };
  }, [token, t.liveUpdate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await sendChat({ question, language });
      setQuestion('');
      await loadHistory(1);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate response');
    } finally {
      setLoading(false);
    }
  };

  const onNewAssessment = async () => {
    setError('');
    await clearChatHistory();
    setChats([]);
    setPagination({ page: 1, totalPages: 1, total: 0, limit: 10 });
    setPage(1);
    setQuestion('');
  };

  const asList = (value) => (Array.isArray(value) ? value : value ? [value] : []);
  const latestChat = chats[0];
  const summaryAction = latestChat?.riskLevel === 'High'
    ? t.highAction
    : latestChat?.riskLevel === 'Medium'
      ? t.mediumAction
      : t.lowAction;

  return (
    <section className="page">
      <div className="card">
        <div className="section-head">
          <div>
            <h2>{t.chatbotTitle}</h2>
            <p className="muted-text">{t.chatbotSubtext}</p>
          </div>
          <button className="btn secondary-btn" type="button" onClick={onNewAssessment}>{t.newAssessment}</button>
        </div>
        <form onSubmit={onSubmit} className="form">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t.askPlaceholder}
            required
            minLength={5}
          />
          <button className="btn" disabled={loading} type="submit">{loading ? t.generating : t.askAi}</button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>

      {latestChat && (
        <div className="card summary-card">
          <p className="eyebrow">{t.summary}</p>
          <div className="summary-grid">
            <div>
              <strong>{t.symptomsDetected}</strong>
              <ul className="clean-list">
                {asList(latestChat.aiResponse?.symptoms).map((entry) => <li key={entry}>{entry}</li>)}
              </ul>
            </div>
            <div>
              <strong>{t.riskLevel}</strong>
              <p><span className={`risk-badge ${latestChat.riskLevel?.toLowerCase()}`}>{latestChat.riskLevel}</span></p>
              <strong>{t.recommendedAction}</strong>
              <p>{summaryAction}</p>
              <strong>{t.nextSteps}</strong>
              <p>{t.nextStepsBody}</p>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h3>{t.chatHistory}</h3>
        {historyLoading && (
          <div>
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </div>
        )}
        {!historyLoading && chats.length === 0 && <p>{t.noChats}</p>}
        {!historyLoading && chats.map((item) => (
          <article key={item._id} className="chat-item">
            <p><strong>Question:</strong> {item.question}</p>

            <div className="chat-block">
              <strong>Symptoms</strong>
              <ul className="clean-list">
                {asList(item.aiResponse?.symptoms).map((entry) => <li key={entry}>{entry}</li>)}
              </ul>
            </div>

            <div className="chat-block">
              <strong>{t.possibleCauses}</strong>
              <ul className="clean-list">
                {asList(item.aiResponse?.possibleCauses).map((entry) => <li key={entry}>{entry}</li>)}
              </ul>
            </div>

            <div className="chat-block">
              <strong>{t.prevention}</strong>
              <ul className="clean-list">
                {asList(item.aiResponse?.prevention).map((entry) => <li key={entry}>{entry}</li>)}
              </ul>
            </div>

            <div className="chat-block">
              <strong>{t.consultDoctor}</strong>
              <ul className="clean-list">
                {asList(item.aiResponse?.whenToConsultDoctor).map((entry) => <li key={entry}>{entry}</li>)}
              </ul>
            </div>

            <p><strong>Risk:</strong> <span className={`risk-badge ${item.riskLevel?.toLowerCase()}`}>{item.riskLevel}</span></p>
            <p className="meta-line"><strong>{t.confidence}:</strong> {Math.round((item.aiResponse?.confidenceScore || 0) * 100)}%</p>
            <p className="meta-line"><strong>{t.promptVersion}:</strong> {item.aiResponse?.promptVersion || 'rule-v2'}</p>

            {item.aiResponse?.emergencyAlert && (
              <div className="emergency-banner">
                {item.aiResponse.emergencyAlert}
              </div>
            )}

            {Array.isArray(item.aiResponse?.recommendedHospitals) && item.aiResponse.recommendedHospitals.length > 0 && (
              <div className="chat-block">
                <strong>{t.recommendedHospitals}</strong>
                <ul className="clean-list">
                  {item.aiResponse.recommendedHospitals.map((hospital) => (
                    <li key={`${hospital.name}-${hospital.city}`}>
                      {hospital.name} ({hospital.city}) - {hospital.specialization} - Rating {hospital.rating}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="disclaimer">{item.aiResponse?.disclaimer}</p>
          </article>
        ))}

        {!historyLoading && pagination.totalPages > 1 && (
          <div className="pager">
            <button type="button" onClick={() => loadHistory(page - 1)} disabled={page <= 1}>Previous</button>
            <span>Page {pagination.page} of {pagination.totalPages}</span>
            <button type="button" onClick={() => loadHistory(page + 1)} disabled={page >= pagination.totalPages}>Next</button>
          </div>
        )}
      </div>
    </section>
  );
}

export default ChatbotPage;
