import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Ticket } from "lucide-react";
import { ApiClientError } from "@unihub/api-client";
import { AiSummaryStatus, Role, type MyRegistrationDto, type WorkshopDto } from "@unihub/shared-types";
import { createClientId } from "@unihub/shared-utils";
import { api } from "../../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { AiSummaryRichText, AiSummaryStatusBadge } from "../ai-summary/AiSummaryRichText";
import { useWorkshopSeatAvailability } from "./useWorkshopSeatAvailability";

function refreshNotificationQueries(queryClient: ReturnType<typeof useQueryClient>) {
  const delays = [0, 1000, 2500, 5000];
  for (const delay of delays) {
    setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    }, delay);
  }
}

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
          status: "CONFIRMED",
          checkedInAt: null
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
  myRegistration: MyRegistrationDto | null;
  message: string | null;
  setMessage: (message: string | null) => void;
  onRegistrationConfirmed: (registrationId: string, workshopId: string) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const seat = useWorkshopSeatAvailability(workshop);
  const isStudent = userRoles.includes(Role.STUDENT);
  const canRegister = isStudent && seat.status === "PUBLISHED" && seat.remainingSeats > 0;
  const isRegisteredConfirmed = myRegistration?.status === "CONFIRMED";
  const isCheckedIn = Boolean(myRegistration?.checkedInAt);
  const isPendingPayment = myRegistration?.status === "PENDING_PAYMENT";

  const registerFree = useMutation({
    mutationFn: () => api.registrationApi.createFree({ workshopId: id, idempotencyKey: createClientId("reg") }),
    onSuccess: (registration) => {
      onRegistrationConfirmed(registration.id, id);
      refreshNotificationQueries(queryClient);
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
        refreshNotificationQueries(queryClient);
        navigate(`/registrations/${registration.id}/qr`);
        return;
      }
      setMessage("You already have a payment transaction for this workshop. Please check your QR page.");
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
          <h2>Details</h2>
          <p>Room: {workshop.room.name}</p>
          <p>Time: {new Date(workshop.startTime).toLocaleString("en-US")}</p>
          <p>
            Seats: {seat.registeredCount}/{seat.capacity}
          </p>
          <p>Speakers: {workshop.speakers.map((speaker) => speaker.fullName).join(", ")}</p>
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

      {isRegisteredConfirmed && isCheckedIn ? (
        <p className="notice">Checked in</p>
      ) : isRegisteredConfirmed ? (
        <Link className="button" to={`/registrations/${myRegistration.id}/qr`}>
          <Ticket size={18} /> View QR
        </Link>
      ) : isPendingPayment ? (
        <button onClick={() => registerPaid.mutate()} disabled={registerPaid.isPending}>
          <CreditCard size={18} /> Continue payment
        </button>
      ) : canRegister ? (
        workshop.priceAmount > 0 ? (
          <button onClick={() => registerPaid.mutate()} disabled={registerPaid.isPending}>
            <CreditCard size={18} /> Register (paid)
          </button>
        ) : (
          <button onClick={() => registerFree.mutate()} disabled={registerFree.isPending}>
            <Ticket size={18} /> Register (free)
          </button>
        )
      ) : (
        <p className="notice">{seat.remainingSeats <= 0 ? "No seats left." : "Workshop is not open for registration."}</p>
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
    return "Generating AI summary.";
  }

  return "No AI summary yet.";
}
