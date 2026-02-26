import { useEffect, useState } from 'react';
import { getChatHistory, sendChat } from '../services/health.service';

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

  const riskClass = (risk) => risk === 'High' ? 'risk-high' : risk === 'Medium' ? 'risk-medium' : 'risk-low';

  return (
    <section className="page">
      <div className="card">
        <h2>Health Chatbot</h2>
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
            <p><strong>Symptoms:</strong> {item.aiResponse?.symptoms}</p>
            <p><strong>Possible Causes:</strong> {item.aiResponse?.possibleCauses}</p>
            <p><strong>Prevention:</strong> {item.aiResponse?.prevention}</p>
            <p><strong>When to consult doctor:</strong> {item.aiResponse?.whenToConsultDoctor}</p>
            <p className={riskClass(item.riskLevel)}><strong>Risk:</strong> {item.riskLevel}</p>
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
