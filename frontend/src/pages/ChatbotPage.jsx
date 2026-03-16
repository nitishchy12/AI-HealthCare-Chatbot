import { useEffect, useState } from 'react';
import { clearChatHistory, getChatHistory, sendChat } from '../services/health.service';

function ChatbotPage() {
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

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await sendChat({ question });
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

  const riskClass = (risk) => risk === 'High' ? 'risk-high' : risk === 'Medium' ? 'risk-medium' : 'risk-low';
  const asList = (value) => Array.isArray(value) ? value : value ? [value] : [];
  const latestChat = chats[0];
  const summaryAction = latestChat?.riskLevel === 'High'
    ? 'Seek urgent medical help and use the recommended hospitals below.'
    : latestChat?.riskLevel === 'Medium'
      ? 'Monitor symptoms closely and book a doctor consultation if they continue.'
      : 'Rest, hydration, and observation are recommended for now.';

  return (
    <section className="page">
      <div className="card">
        <div className="section-head">
          <div>
            <h2>Health Chatbot</h2>
            <p className="muted-text">Start a fresh health check whenever you want a clean assessment trail.</p>
          </div>
          <button className="btn secondary-btn" type="button" onClick={onNewAssessment}>Start New Health Assessment</button>
        </div>
        <form onSubmit={onSubmit} className="form">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask symptoms or health awareness question"
            required
            minLength={5}
          />
          <button className="btn" disabled={loading} type="submit">{loading ? 'Generating...' : 'Ask AI'}</button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>

      {latestChat && (
        <div className="card summary-card">
          <p className="eyebrow">Health Assessment Summary</p>
          <div className="summary-grid">
            <div>
              <strong>Symptoms detected</strong>
              <ul className="clean-list">
                {asList(latestChat.aiResponse?.symptoms).map((entry) => <li key={entry}>{entry}</li>)}
              </ul>
            </div>
            <div>
              <strong>Risk Level</strong>
              <p><span className={`risk-badge ${latestChat.riskLevel?.toLowerCase()}`}>{latestChat.riskLevel}</span></p>
              <strong>Recommended Action</strong>
              <p>{summaryAction}</p>
              <strong>Next Steps</strong>
              <p>Monitor symptoms for 2 to 3 days, or act sooner if warning signs appear.</p>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h3>Chat History</h3>
        {historyLoading && (
          <div>
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </div>
        )}
        {!historyLoading && chats.length === 0 && <p>No chats yet.</p>}
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
              <strong>Possible Causes</strong>
              <ul className="clean-list">
                {asList(item.aiResponse?.possibleCauses).map((entry) => <li key={entry}>{entry}</li>)}
              </ul>
            </div>

            <div className="chat-block">
              <strong>Prevention</strong>
              <ul className="clean-list">
                {asList(item.aiResponse?.prevention).map((entry) => <li key={entry}>{entry}</li>)}
              </ul>
            </div>

            <div className="chat-block">
              <strong>When to Consult Doctor</strong>
              <ul className="clean-list">
                {asList(item.aiResponse?.whenToConsultDoctor).map((entry) => <li key={entry}>{entry}</li>)}
              </ul>
            </div>

            <p><strong>Risk:</strong> <span className={`risk-badge ${item.riskLevel?.toLowerCase()}`}>{item.riskLevel}</span></p>

            {item.aiResponse?.emergencyAlert && (
              <div className="emergency-banner">
                {item.aiResponse.emergencyAlert}
              </div>
            )}

            {Array.isArray(item.aiResponse?.recommendedHospitals) && item.aiResponse.recommendedHospitals.length > 0 && (
              <div className="chat-block">
                <strong>Recommended Hospitals</strong>
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
