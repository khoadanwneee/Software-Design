import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CreditCard, Ticket } from "lucide-react";
import { ApiClientError } from "@unihub/api-client";
import { Role } from "@unihub/shared-types";
import { createClientId } from "@unihub/shared-utils";
import { api } from "../../lib/api";
import { useAuth } from "../auth/AuthProvider";

export function WorkshopDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["workshop", id], queryFn: () => api.workshopApi.detail(id!), enabled: Boolean(id) });

  const registerFree = useMutation({
    mutationFn: () => api.registrationApi.createFree({ workshopId: id!, idempotencyKey: createClientId("reg") }),
    onSuccess: (registration) => navigate(`/registrations/${registration.id}/qr`),
    onError: (error) => setMessage(error instanceof ApiClientError ? error.message : "Registration failed")
  });

  const registerPaid = useMutation({
    mutationFn: () => api.registrationApi.createPaid({ workshopId: id!, idempotencyKey: createClientId("pay") }),
    onSuccess: (registration) => setMessage(registration.paymentUrl ? `Payment URL: ${registration.paymentUrl}` : "Payment created"),
    onError: (error) => setMessage(error instanceof ApiClientError ? error.message : "Payment failed")
  });

  if (query.isLoading) {
    return <p>Loading...</p>;
  }

  if (!query.data) {
    return <p className="error">{query.error?.message ?? "Workshop not found"}</p>;
  }

  const workshop = query.data;
  const isStudent = user?.roles.includes(Role.STUDENT);
  const canRegister = isStudent && workshop.status === "PUBLISHED" && workshop.remainingSeats > 0;

  return (
    <article className="detail">
      <Link to="/workshops">Back</Link>
      <h1>{workshop.title}</h1>
      <p>{workshop.description}</p>
      <div className="detail-grid">
        <div className="panel">
          <h2>Thông tin</h2>
          <p>Phòng: {workshop.room.name}</p>
          <p>Thời gian: {new Date(workshop.startTime).toLocaleString("vi-VN")}</p>
          <p>
            Chỗ: {workshop.registeredCount}/{workshop.capacity}
          </p>
          <p>Diễn giả: {workshop.speakers.map((speaker) => speaker.fullName).join(", ")}</p>
        </div>
        <div className="panel">
          <h2>AI Summary</h2>
          <p>{workshop.aiSummary?.summaryText ?? `Status: ${workshop.aiSummary?.status ?? "UNAVAILABLE"}`}</p>
        </div>
      </div>
      {message ? <p className="notice">{message}</p> : null}
      {canRegister ? (
        workshop.priceAmount > 0 ? (
          <button onClick={() => registerPaid.mutate()} disabled={registerPaid.isPending}>
            <CreditCard size={18} /> Đăng ký có phí
          </button>
        ) : (
          <button onClick={() => registerFree.mutate()} disabled={registerFree.isPending}>
            <Ticket size={18} /> Đăng ký miễn phí
          </button>
        )
      ) : (
        <p className="notice">Workshop không mở đăng ký.</p>
      )}
    </article>
  );
}
