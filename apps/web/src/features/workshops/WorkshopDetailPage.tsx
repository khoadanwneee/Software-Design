import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Ticket } from "lucide-react";
import { ApiClientError } from "@unihub/api-client";
import { Role, type WorkshopDto } from "@unihub/shared-types";
import { createClientId } from "@unihub/shared-utils";
import { api } from "../../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { useWorkshopSeatAvailability } from "./useWorkshopSeatAvailability";

export function WorkshopDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);

  const query = useQuery({ queryKey: ["workshop", id], queryFn: () => api.workshopApi.detail(id!), enabled: Boolean(id) });
  const myRegistrationQuery = useQuery({
    queryKey: ["my-registration", id],
    queryFn: () => api.registrationApi.myByWorkshop(id!),
    enabled: Boolean(id && user?.roles.includes(Role.STUDENT)),
    refetchOnMount: "always"
  });

  if (query.isLoading) {
    return <p>Loading...</p>;
  }

  if (!query.data || !id) {
    return <p className="error">{query.error?.message ?? "Workshop not found"}</p>;
  }

  return (
    <WorkshopDetailContent
      id={id}
      workshop={query.data}
      userRoles={user?.roles ?? []}
      myRegistration={myRegistrationQuery.data ?? null}
      message={message}
      setMessage={setMessage}
      onRegistrationConfirmed={(registrationId, workshopId) => {
        queryClient.setQueryData(["my-registration", workshopId], {
          id: registrationId,
          workshopId,
          status: "CONFIRMED"
        });
      }}
    />
  );
}

function WorkshopDetailContent({
  id,
  workshop,
  userRoles,
  myRegistration,
  message,
  setMessage,
  onRegistrationConfirmed
}: {
  id: string;
  workshop: WorkshopDto;
  userRoles: Role[];
  myRegistration: { id: string; workshopId: string; status: string } | null;
  message: string | null;
  setMessage: (message: string | null) => void;
  onRegistrationConfirmed: (registrationId: string, workshopId: string) => void;
}) {
  const navigate = useNavigate();
  const seat = useWorkshopSeatAvailability(workshop);
  const isStudent = userRoles.includes(Role.STUDENT);
  const canRegister = isStudent && seat.status === "PUBLISHED" && seat.remainingSeats > 0;
  const isRegisteredConfirmed = myRegistration?.status === "CONFIRMED";
  const isPendingPayment = myRegistration?.status === "PENDING_PAYMENT";

  const registerFree = useMutation({
    mutationFn: () => api.registrationApi.createFree({ workshopId: id, idempotencyKey: createClientId("reg") }),
    onSuccess: (registration) => {
      onRegistrationConfirmed(registration.id, id);
      navigate(`/registrations/${registration.id}/qr`);
    },
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
        onRegistrationConfirmed(registration.id, id);
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
          <h2>Thong tin</h2>
          <p>Phong: {workshop.room.name}</p>
          <p>Thoi gian: {new Date(workshop.startTime).toLocaleString("vi-VN")}</p>
          <p>
            Cho: {seat.registeredCount}/{seat.capacity}
          </p>
          <p>Dien gia: {workshop.speakers.map((speaker) => speaker.fullName).join(", ")}</p>
        </div>
        <div className="panel">
          <h2>AI Summary</h2>
          <p>{workshop.aiSummary?.summaryText ?? `Status: ${workshop.aiSummary?.status ?? "UNAVAILABLE"}`}</p>
        </div>
      </div>
      {message ? <p className="notice">{message}</p> : null}

      {isRegisteredConfirmed ? (
        <Link className="button" to={`/registrations/${myRegistration.id}/qr`}>
          <Ticket size={18} /> Xem QR
        </Link>
      ) : isPendingPayment ? (
        <button onClick={() => registerPaid.mutate()} disabled={registerPaid.isPending}>
          <CreditCard size={18} /> Tiep tuc thanh toan
        </button>
      ) : canRegister ? (
        workshop.priceAmount > 0 ? (
          <button onClick={() => registerPaid.mutate()} disabled={registerPaid.isPending}>
            <CreditCard size={18} /> Dang ky co phi
          </button>
        ) : (
          <button onClick={() => registerFree.mutate()} disabled={registerFree.isPending}>
            <Ticket size={18} /> Dang ky mien phi
          </button>
        )
      ) : (
        <p className="notice">{seat.remainingSeats <= 0 ? "Het cho." : "Workshop khong mo dang ky."}</p>
      )}
    </article>
  );
}
