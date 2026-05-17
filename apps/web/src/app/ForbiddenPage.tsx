import { Link } from "react-router-dom";

export function ForbiddenPage() {
  return (
    <section className="panel">
      <h1>403</h1>
      <p>Your current account does not have permission to access this page.</p>
      <Link className="button" to="/workshops">
        Back to workshop list
      </Link>
    </section>
  );
}
