import { useEffect } from 'react';

function GlobalToast({ message, onClose }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className="toast" role="alert" aria-live="assertive">
      <span>{message}</span>
      <button type="button" onClick={onClose}>x</button>
    </div>
  );
}

export default GlobalToast;
