import { Link } from "react-router-dom";

export function ForbiddenPage() {
  return (
    <section className="panel">
      <h1>403</h1>
      <p>Tài khoản hiện tại không có quyền truy cập màn hình này.</p>
      <Link className="button" to="/workshops">
        Về danh sách workshop
      </Link>
    </section>
  );
}
