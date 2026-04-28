import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../../lib/api";

export function RegistrationQrPage() {
  const { id } = useParams();
  const query = useQuery({ queryKey: ["registration-qr", id], queryFn: () => api.registrationApi.qr(id!), enabled: Boolean(id) });

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
