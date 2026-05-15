import { Link } from "react-router-dom";

export function PaymentSuccessPage() {
  return (
    <section className="panel">
      <h1>Thanh toan thanh cong</h1>
      <p>Giao dich da duoc ghi nhan. Ban co the xem ma QR trong trang dang ky.</p>
      <Link className="button" to="/workshops">
        Ve danh sach workshop
      </Link>
    </section>
  );
}

