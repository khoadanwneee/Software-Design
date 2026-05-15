import { Link } from "react-router-dom";

export function PaymentFailedPage() {
  return (
    <section className="panel">
      <h1>Thanh toan that bai</h1>
      <p>Giao dich chua thanh cong. Vui long thu lai hoac chon phuong thuc khac.</p>
      <Link className="button" to="/workshops">
        Quay lai workshop
      </Link>
    </section>
  );
}

