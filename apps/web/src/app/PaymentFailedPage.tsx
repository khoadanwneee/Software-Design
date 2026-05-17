import { Link } from "react-router-dom";

export function PaymentFailedPage() {
  return (
    <section className="panel">
      <h1>Payment failed</h1>
      <p>Your transaction was not successful. Please try again or choose a different payment method.</p>
      <Link className="button" to="/workshops">
        Back to workshops
      </Link>
    </section>
  );
}
