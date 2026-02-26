import { useEffect, useState } from 'react';
import { getChatHistory, sendChat } from '../services/health.service';

function ChatbotPage() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [chats, setChats] = useState([]);

  const loadHistory = async () => {
    try {
      const res = await getChatHistory();
      setChats(res.data || []);
    } catch (_err) {
      setChats([]);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await sendChat({ question });
      setQuestion('');
      await loadHistory();
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
        {chats.length === 0 && <p>No chats yet.</p>}
        {chats.map((item) => (
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
      </div>
    </section>
  );
}

export default ChatbotPage;
