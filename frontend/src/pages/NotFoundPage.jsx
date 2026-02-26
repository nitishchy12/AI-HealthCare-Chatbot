import { Link } from 'react-router-dom';

function NotFoundPage() {
  return (
    <section className="page card">
      <h2>404 - Page not found</h2>
      <p>The page you are looking for does not exist.</p>
      <Link className="btn" to="/">Go to home</Link>
    </section>
  );
}

export default NotFoundPage;
