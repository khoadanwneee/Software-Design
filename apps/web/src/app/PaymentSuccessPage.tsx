import { Link } from "react-router-dom";

export function PaymentSuccessPage() {
  return (
    <section className="panel">
      <h1>Payment successful</h1>
      <p>Your transaction has been recorded. You can view your QR code on the registration page.</p>
      <Link className="button" to="/workshops">
        Back to workshop list
      </Link>
    </section>
  );
}
