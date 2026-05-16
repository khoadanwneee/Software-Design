import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CreditCard, Ticket } from "lucide-react";
import { ApiClientError } from "@unihub/api-client";
import { AiSummaryStatus, Role, type WorkshopDto } from "@unihub/shared-types";
import { createClientId } from "@unihub/shared-utils";
import { api } from "../../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { AiSummaryRichText, AiSummaryStatusBadge } from "../ai-summary/AiSummaryRichText";
import { useWorkshopSeatAvailability } from "./useWorkshopSeatAvailability";

export function WorkshopDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["workshop", id], queryFn: () => api.workshopApi.detail(id!), enabled: Boolean(id) });

  if (query.isLoading) {
    return <p>Loading...</p>;
  }

  if (!query.data || !id) {
    return <p className="error">{query.error?.message ?? "Workshop not found"}</p>;
  }

  return <WorkshopDetailContent id={id} workshop={query.data} userRoles={user?.roles ?? []} message={message} setMessage={setMessage} />;
}

function WorkshopDetailContent({
  id,
  workshop,
  userRoles,
  message,
  setMessage
}: {
  id: string;
  workshop: WorkshopDto;
  userRoles: Role[];
  message: string | null;
  setMessage: (message: string | null) => void;
}) {
  const navigate = useNavigate();
  const seat = useWorkshopSeatAvailability(workshop);
  const isStudent = userRoles.includes(Role.STUDENT);
  const canRegister = isStudent && seat.status === "PUBLISHED" && seat.remainingSeats > 0;

  const registerFree = useMutation({
    mutationFn: () => api.registrationApi.createFree({ workshopId: id, idempotencyKey: createClientId("reg") }),
    onSuccess: (registration) => navigate(`/registrations/${registration.id}/qr`),
    onError: (error) => setMessage(error instanceof ApiClientError ? error.message : "Registration failed")
  });

  const registerPaid = useMutation({
    mutationFn: () => api.registrationApi.createPaid({ workshopId: id, idempotencyKey: createClientId("pay") }),
    onSuccess: (registration) => {
      if (registration.paymentUrl) {
        window.location.assign(registration.paymentUrl);
        return;
      }
      if (registration.status === "CONFIRMED") {
        navigate(`/registrations/${registration.id}/qr`);
        return;
      }
      setMessage("Ban da co giao dich thanh toan cho workshop nay. Vui long kiem tra trang QR.");
    },
    onError: (error) => setMessage(error instanceof ApiClientError ? error.message : "Payment failed")
  });

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
            Chỗ: {seat.registeredCount}/{seat.capacity}
          </p>
          <p>Diễn giả: {workshop.speakers.map((speaker) => speaker.fullName).join(", ")}</p>
        </div>
        <div className="panel">
          <div className="panel-title-row">
            <h2>AI Summary</h2>
            <AiSummaryStatusBadge status={workshop.aiSummary?.status} />
          </div>
          {workshop.aiSummary?.status === AiSummaryStatus.DONE && workshop.aiSummary.summary ? (
            <AiSummaryRichText summary={workshop.aiSummary.summary} />
          ) : (
            <p>{summaryDisplay(workshop)}</p>
          )}
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
        <p className="notice">{seat.remainingSeats <= 0 ? "Hết chỗ." : "Workshop không mở đăng ký."}</p>
      )}
    </article>
  );
}

function summaryDisplay(workshop: WorkshopDto) {
  if (workshop.aiSummary?.status === AiSummaryStatus.DONE && workshop.aiSummary.summary) {
    return workshop.aiSummary.summary;
  }

  if (
    workshop.aiSummary?.status === AiSummaryStatus.PENDING ||
    workshop.aiSummary?.status === AiSummaryStatus.PROCESSING
  ) {
    return "Đang tạo tóm tắt AI.";
  }

  return "Chưa có tóm tắt AI.";
}
