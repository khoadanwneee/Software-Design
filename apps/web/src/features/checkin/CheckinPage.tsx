import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, RefreshCw, Save } from "lucide-react";
import { ApiClientError } from "@unihub/api-client";
import { OfflineSyncStatus, type OfflineCheckinRecord } from "@unihub/shared-types";
import { createClientId, nowIso } from "@unihub/shared-utils";
import { api } from "../../lib/api";
import { useOnlineStatus } from "../../lib/useOnlineStatus";
import { useAuth } from "../auth/AuthProvider";
import { saveOfflineCheckin } from "../offline/db";
import { getOrCreateDeviceId, syncPendingCheckins } from "../offline/sync";

export function CheckinPage() {
  const online = useOnlineStatus();
  const { user } = useAuth();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [workshopId, setWorkshopId] = useState("");
  const [manualQr, setManualQr] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const workshops = useQuery({ queryKey: ["workshops"], queryFn: () => api.workshopApi.list() });
  const deviceId = useMemo(() => getOrCreateDeviceId(), []);

  useEffect(() => {
    return () => {
      void scannerRef.current?.stop().catch(() => undefined);
    };
  }, []);

  async function startScanner() {
    if (!workshopId) {
      setStatus("Chọn workshop trước khi scan.");
      return;
    }
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;
    await scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      (decodedText) => {
        void scanner.stop().finally(() => {
          scannerRef.current = null;
          void handleQrPayload(decodedText);
        });
      },
      () => undefined
    );
  }

  async function handleQrPayload(qrPayload: string) {
    if (!workshopId || !user) {
      return;
    }

    if (!online) {
      await storeOffline(qrPayload);
      setStatus("Đã lưu offline.");
      return;
    }

    try {
      const result = await api.checkinApi.checkin({
        qrPayload,
        workshopId,
        idempotencyKey: createClientId("checkin")
      });
      setStatus(`Check-in ${result.status}: ${result.checkinId}`);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setStatus(error.message);
        return;
      }
      await storeOffline(qrPayload);
      setStatus("Mất kết nối khi gửi API, đã lưu offline.");
    }
  }

  async function storeOffline(qrPayload: string) {
    const timestamp = nowIso();
    const record: OfflineCheckinRecord = {
      clientCheckinId: createClientId("offline-checkin"),
      qrPayload,
      workshopId,
      staffId: user!.id,
      deviceId,
      checkedInAt: timestamp,
      syncStatus: OfflineSyncStatus.PENDING,
      retryCount: 0,
      lastError: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await saveOfflineCheckin(record);
  }

  return (
    <section>
      <div className="section-header">
        <h1>Check-in</h1>
        <Link className="button secondary" to="/checkin/queue">
          Queue
        </Link>
      </div>
      <div className="panel checkin-panel">
        <label>
          Workshop
          <select value={workshopId} onChange={(event) => setWorkshopId(event.target.value)}>
            <option value="">Select workshop</option>
            {workshops.data?.map((workshop) => (
              <option key={workshop.id} value={workshop.id}>
                {workshop.title} - {workshop.room.name}
              </option>
            ))}
          </select>
        </label>
        <div id="qr-reader" className="qr-reader" />
        <div className="toolbar">
          <button onClick={startScanner}>
            <Camera size={18} /> Scan
          </button>
          <button
            className="secondary"
            onClick={() => {
              void syncPendingCheckins({ includeFailed: true }).then((result) =>
                setStatus(`Sync: ${result.synced} synced, ${result.failed} failed`)
              );
            }}
          >
            <RefreshCw size={18} /> Retry sync
          </button>
        </div>
        <label>
          Manual QR payload
          <textarea value={manualQr} onChange={(event) => setManualQr(event.target.value)} rows={4} />
        </label>
        <button
          className="secondary"
          onClick={() => {
            void handleQrPayload(manualQr);
          }}
        >
          <Save size={18} /> Submit
        </button>
        {status ? <p className="notice">{status}</p> : null}
      </div>
    </section>
  );
}
