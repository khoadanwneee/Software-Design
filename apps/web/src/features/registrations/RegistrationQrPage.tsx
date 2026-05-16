import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../../lib/api";

export function RegistrationQrPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["registration-qr", id], queryFn: () => api.registrationApi.qr(id!), enabled: Boolean(id) });

  useEffect(() => {
    const timers = [0, 1000, 2500, 5000].map((delay) =>
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
        void queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
      }, delay)
    );

    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [queryClient]);

  return (
    <section className="panel qr-panel">
      <h1>QR Check-in</h1>
      {query.isLoading ? <p>Loading...</p> : null}
      {query.error ? <p className="error">{query.error.message}</p> : null}
      {query.data ? (
        <>
          <QRCodeSVG value={query.data.qrPayload} size={240} level="M" />
          <code>{query.data.registrationId}</code>
        </>
      ) : null}
      <Link className="button secondary" to="/workshops">
        Workshops
      </Link>
    </section>
  );
}
