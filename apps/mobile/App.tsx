import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { ApiClientError, createApiClient } from "@unihub/api-client";
import { OfflineSyncStatus, Role, type AuthUser, type OfflineCheckinRecord } from "@unihub/shared-types";
import { parseQrPayload } from "@unihub/shared-utils";
import { CameraView, useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, NativeModules, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

const ACCESS_TOKEN_KEY = "unihub.mobile.accessToken";
const USER_KEY = "unihub.mobile.user";
const DEVICE_ID_KEY = "unihub.mobile.deviceId";
const OFFLINE_QUEUE_KEY = "unihub.mobile.offlineQueue";
type Session = { accessToken: string; user: AuthUser };
type TabKey = "SCAN" | "HISTORY";

function resolveApiBaseUrl() {
  const envBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (envBaseUrl) return envBaseUrl;
  const fallbackHost = "192.168.1.7";
  const scriptUrl = NativeModules.SourceCode?.scriptURL as string | undefined;
  if (scriptUrl) {
    try {
      const host = new URL(scriptUrl).hostname;
      if (host && host !== "localhost" && host !== "127.0.0.1") return `http://${host}:4000/api`;
      return `http://${fallbackHost}:4000/api`;
    } catch {
      return `http://${fallbackHost}:4000/api`;
    }
  }
  return `http://${fallbackHost}:4000/api`;
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function prettyTime(ts: string) {
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return ts;
  return date.toLocaleString();
}

function statusText(status: OfflineSyncStatus) {
  if (status === OfflineSyncStatus.PENDING) return "Saved offline";
  if (status === OfflineSyncStatus.SYNCED) return "Check-in successful";
  if (status === OfflineSyncStatus.DUPLICATE) return "Already checked in";
  if (status === OfflineSyncStatus.CONFLICT) return "Conflict";
  return "Failed";
}

function fallbackStatusMessage(status: OfflineSyncStatus) {
  if (status === OfflineSyncStatus.PENDING) return "Check-in saved offline.";
  if (status === OfflineSyncStatus.SYNCED) return "Check-in successful.";
  if (status === OfflineSyncStatus.DUPLICATE) return "This QR has already been checked in.";
  if (status === OfflineSyncStatus.CONFLICT) return "Sync conflict occurred.";
  return "Check-in failed.";
}

function statusColor(status: OfflineSyncStatus) {
  if (status === OfflineSyncStatus.SYNCED) return "#1f8f4f";
  if (status === OfflineSyncStatus.PENDING) return "#b56b00";
  if (status === OfflineSyncStatus.DUPLICATE) return "#2457c5";
  if (status === OfflineSyncStatus.CONFLICT) return "#ad2727";
  return "#7a1f1f";
}

async function getOrCreateDeviceId() {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const next = createId();
  await AsyncStorage.setItem(DEVICE_ID_KEY, next);
  return next;
}

async function loadOfflineQueue() {
  const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
  if (!raw) return [] as OfflineCheckinRecord[];
  try {
    return JSON.parse(raw) as OfflineCheckinRecord[];
  } catch {
    return [] as OfflineCheckinRecord[];
  }
}

async function saveOfflineQueue(records: OfflineCheckinRecord[]) {
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(records));
}

export default function App() {
  const [apiBaseUrl] = useState(resolveApiBaseUrl);
  const [email, setEmail] = useState("staff@unihub.dev");
  const [password, setPassword] = useState("12345678");
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [busy, setBusy] = useState(false);
  const [scannerEnabled, setScannerEnabled] = useState(true);
  const [lastResult, setLastResult] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [queueRecords, setQueueRecords] = useState<OfflineCheckinRecord[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("SCAN");
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const lastScanAtRef = useRef(0);

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl: apiBaseUrl,
        getAccessToken: () => session?.accessToken ?? null
      }),
    [apiBaseUrl, session]
  );

  async function refreshQueueState() {
    const queue = await loadOfflineQueue();
    const sorted = [...queue].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setQueueRecords(sorted.slice(0, 20));
    setPendingCount(queue.filter((q) => q.syncStatus === OfflineSyncStatus.PENDING).length);
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [token, userRaw] = await Promise.all([AsyncStorage.getItem(ACCESS_TOKEN_KEY), AsyncStorage.getItem(USER_KEY)]);
        if (!mounted) return;
        if (token && userRaw) setSession({ accessToken: token, user: JSON.parse(userRaw) as AuthUser });
        await refreshQueueState();
      } finally {
        if (mounted) setLoadingSession(false);
      }
    })();

    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session && isOnline) void syncOfflineQueue();
  }, [session, isOnline]);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert("Missing information", "Please enter email and password.");
      return;
    }
    setBusy(true);
    try {
      const res = await api.authApi.login({ email: email.trim(), password });
      const okRole = res.user.roles.includes(Role.CHECKIN_STAFF) || res.user.roles.includes(Role.ADMIN);
      if (!okRole) {
        Alert.alert("Insufficient permission", "Mobile check-in is only available for staff or admin.");
        return;
      }
      const next = { accessToken: res.accessToken, user: res.user };
      await AsyncStorage.multiSet([
        [ACCESS_TOKEN_KEY, next.accessToken],
        [USER_KEY, JSON.stringify(next.user)]
      ]);
      setSession(next);
      setLastResult("Login successful.");
      if (!cameraPermission?.granted) await requestCameraPermission();
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, USER_KEY]);
    setSession(null);
    setLastResult("Logged out.");
  }

  async function syncOfflineQueue() {
    if (!session) return;
    const queue = await loadOfflineQueue();
    const pending = queue.filter((q) => q.syncStatus === OfflineSyncStatus.PENDING);
    if (pending.length === 0) {
      await refreshQueueState();
      return;
    }

    try {
      const res = await api.checkinApi.syncOffline({ events: pending });
      const byId = new Map(res.results.map((r) => [r.clientCheckinId, r]));
      const updated = queue.map((q) => {
        const hit = byId.get(q.clientCheckinId);
        if (!hit) return q;
        return {
          ...q,
          syncStatus: hit.status,
          lastError: hit.message ?? hit.errorCode ?? null,
          updatedAt: new Date().toISOString()
        };
      });
      await saveOfflineQueue(updated);
      await refreshQueueState();
      setLastResult("Offline sync completed.");
      if (res.results.length > 0) {
        const lines = res.results.map((result) => {
          const label = statusText(result.status);
          const message = result.message ?? result.errorCode ?? fallbackStatusMessage(result.status);
          return `${label}: ${message}`;
        });
        Alert.alert("Sync results", lines.join("\n"));
      }
    } catch (error) {
      const updated = queue.map((q) =>
        q.syncStatus === OfflineSyncStatus.PENDING
          ? {
              ...q,
              retryCount: q.retryCount + 1,
              syncStatus: q.retryCount + 1 >= 3 ? OfflineSyncStatus.FAILED : OfflineSyncStatus.PENDING,
              lastError: error instanceof Error ? error.message : "Sync failed",
              updatedAt: new Date().toISOString()
            }
          : q
      );
      await saveOfflineQueue(updated);
      await refreshQueueState();
      setLastResult("Sync failed. It will retry when connection is back.");
      Alert.alert("Sync failed", error instanceof Error ? error.message : "Sync failed");
    }
  }

  async function saveLocalOfflineCheckin(payload: string, workshopId: string) {
    if (!session) return;
    const now = new Date().toISOString();
    const deviceId = await getOrCreateDeviceId();
    const record: OfflineCheckinRecord = {
      clientCheckinId: createId(),
      qrPayload: payload,
      workshopId,
      staffId: session.user.id,
      deviceId,
      checkedInAt: now,
      syncStatus: OfflineSyncStatus.PENDING,
      retryCount: 0,
      lastError: null,
      createdAt: now,
      updatedAt: now
    };

    const queue = await loadOfflineQueue();
    queue.push(record);
    await saveOfflineQueue(queue);
    await refreshQueueState();
    setLastResult("Offline check-in saved.");
    Alert.alert(statusText(OfflineSyncStatus.PENDING), fallbackStatusMessage(OfflineSyncStatus.PENDING));
  }

  async function runCheckin(payload: string) {
    if (!session) return false;
    const trimmedPayload = payload.trim();
    if (!trimmedPayload) return false;

    let workshopId = "";
    try {
      const parsed = parseQrPayload(trimmedPayload);
      workshopId = parsed.workshopId ?? "";
    } catch {
      Alert.alert("Invalid QR", "QR payload is invalid.");
      return false;
    }

    if (!workshopId) {
      Alert.alert("Missing workshop", "QR does not contain workshop_id, so check-in cannot proceed.");
      return false;
    }

    setBusy(true);
    try {
      if (isOnline) {
        const result = await api.checkinApi.checkin({
          qrPayload: trimmedPayload,
          workshopId,
          idempotencyKey: createId()
        });
        const status = result.status as OfflineSyncStatus;
        setLastResult(`Check-in ${status}`);
        Alert.alert(statusText(status), fallbackStatusMessage(status));
      } else {
        await saveLocalOfflineCheckin(trimmedPayload, workshopId);
      }
      return true;
    } catch (error) {
      if (error instanceof ApiClientError) {
        setLastResult(error.message);
        Alert.alert("Check-in failed", error.message);
        return false;
      }
      await saveLocalOfflineCheckin(trimmedPayload, workshopId);
      setLastResult("Online request failed, switched to offline fallback.");
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function onQrDetected(payload: string) {
    if (!scannerEnabled || busy) return;
    const now = Date.now();
    if (now - lastScanAtRef.current < 1200) return;

    lastScanAtRef.current = now;
    setScannerEnabled(false);
    const ok = await runCheckin(payload);
    setScannerEnabled(true);
    if (!ok) return;
  }

  if (loadingSession) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#0d5642" />
        <Text style={styles.note}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>UniHub Gate Check-in</Text>
          {session ? <Text style={styles.subtitle}>{isOnline ? "Online" : "Offline"} | Pending: {pendingCount}</Text> : null}
        </View>

        {!session ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Login</Text>
            <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="Email" />
            <TextInput style={styles.input} secureTextEntry value={password} onChangeText={setPassword} placeholder="Password" />
            <Pressable style={styles.buttonPrimary} disabled={busy} onPress={handleLogin}>
              <Text style={styles.buttonPrimaryText}>{busy ? "Logging in..." : "Login"}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.tabRow}>
              <Pressable style={[styles.tabBtn, activeTab === "SCAN" && styles.tabBtnActive]} onPress={() => setActiveTab("SCAN")}>
                <Text style={[styles.tabText, activeTab === "SCAN" && styles.tabTextActive]}>Check-in</Text>
              </Pressable>
              <Pressable style={[styles.tabBtn, activeTab === "HISTORY" && styles.tabBtnActive]} onPress={() => setActiveTab("HISTORY")}>
                <Text style={[styles.tabText, activeTab === "HISTORY" && styles.tabTextActive]}>Offline history</Text>
              </Pressable>
            </View>

            {activeTab === "SCAN" ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Scan QR</Text>
                {!cameraPermission?.granted ? (
                  <Pressable style={styles.buttonPrimary} onPress={() => requestCameraPermission()}>
                    <Text style={styles.buttonPrimaryText}>Grant camera permission</Text>
                  </Pressable>
                ) : (
                  <View style={styles.scannerWrap}>
                    <CameraView
                      style={styles.scanner}
                      facing="back"
                      barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                      onBarcodeScanned={(event) => void onQrDetected(event.data)}
                    />
                  </View>
                )}
                <View style={styles.rowButtons}>
                  <Pressable style={styles.buttonSecondaryCompact} disabled={busy || !isOnline} onPress={() => void syncOfflineQueue()}>
                    <Text style={styles.buttonSecondaryText}>Sync</Text>
                  </Pressable>
                  <Pressable style={styles.buttonSecondaryCompact} disabled={busy} onPress={handleLogout}>
                    <Text style={styles.buttonSecondaryText}>Logout</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Offline saved history</Text>
                {queueRecords.length === 0 ? (
                  <Text style={styles.note}>No local records yet.</Text>
                ) : (
                  queueRecords.map((item) => (
                    <View key={item.clientCheckinId} style={styles.queueItem}>
                      <Text style={styles.queueMeta}>Workshop: {item.workshopId}</Text>
                      <Text style={styles.queueMeta}>Time: {prettyTime(item.createdAt)}</Text>
                      <Text style={[styles.badge, { backgroundColor: statusColor(item.syncStatus) }]}>{statusText(item.syncStatus)}</Text>
                    </View>
                  ))
                )}
              </View>
            )}
          </>
        )}

        {lastResult ? <Text style={styles.note}>{lastResult}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f6f7f2" },
  content: { padding: 16, gap: 14, paddingBottom: 28 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10, backgroundColor: "#f6f7f2" },
  header: { padding: 14, borderRadius: 14, backgroundColor: "#e9f5ef", borderWidth: 1, borderColor: "#cfe7dd" },
  title: { fontSize: 26, fontWeight: "800", color: "#153f30" },
  subtitle: { marginTop: 4, fontSize: 13, color: "#2e6b55" },
  tabRow: { flexDirection: "row", gap: 8 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "#aac2b6", alignItems: "center", backgroundColor: "#fff" },
  tabBtnActive: { backgroundColor: "#0f5d45", borderColor: "#0f5d45" },
  tabText: { color: "#244e3d", fontWeight: "700" },
  tabTextActive: { color: "#fff" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 14, gap: 10, borderWidth: 1, borderColor: "#e3e5e9" },
  cardTitle: { fontSize: 19, fontWeight: "700", color: "#122a20" },
  input: { borderWidth: 1, borderColor: "#c8d6cc", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#fcfefc" },
  scannerWrap: { borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#b7c9bd" },
  scanner: { width: "100%", height: 320 },
  buttonPrimary: { backgroundColor: "#0f5d45", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  buttonPrimaryText: { color: "#fff", fontWeight: "700" },
  buttonSecondaryCompact: { flex: 1, borderWidth: 1, borderColor: "#9eb3a8", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  buttonSecondaryText: { color: "#244e3d", fontWeight: "700", fontSize: 12 },
  rowButtons: { flexDirection: "row", gap: 8 },
  queueItem: { borderWidth: 1, borderColor: "#d9dfda", borderRadius: 10, padding: 10, backgroundColor: "#f9fbf9", gap: 6 },
  queueMeta: { fontSize: 12, color: "#3f5148" },
  badge: { color: "#fff", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, fontSize: 12, fontWeight: "700", alignSelf: "flex-start" },
  note: { color: "#4b5e54", fontSize: 13 }
});
