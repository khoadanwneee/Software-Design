import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { ApiClientError, createApiClient } from "@unihub/api-client";
import { OfflineSyncStatus, Role, type AuthUser, type OfflineCheckinRecord } from "@unihub/shared-types";
import { parseQrPayload } from "@unihub/shared-utils";
import { CameraView, useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  NativeModules,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

const ACCESS_TOKEN_KEY = "unihub.mobile.accessToken";
const USER_KEY = "unihub.mobile.user";
const DEVICE_ID_KEY = "unihub.mobile.deviceId";
const OFFLINE_QUEUE_KEY = "unihub.mobile.offlineQueue";

type Session = { accessToken: string; user: AuthUser };
type CheckinMode = "ONLINE" | "OFFLINE";

function resolveApiBaseUrl() {
  const envBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (envBaseUrl) return envBaseUrl;

  const fallbackHost = "192.168.1.2";

  const scriptUrl = NativeModules.SourceCode?.scriptURL as string | undefined;
  if (scriptUrl) {
    try {
      const host = new URL(scriptUrl).hostname;
      if (host && host !== "localhost" && host !== "127.0.0.1") {
        return `http://${host}:4000/api`;
      }
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
  const [workshopId, setWorkshopId] = useState("");
  const [qrPayload, setQrPayload] = useState("");
  const [manualQr, setManualQr] = useState("");
  const [scannerEnabled, setScannerEnabled] = useState(true);
  const [lastResult, setLastResult] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const lastScanAtRef = useRef(0);

  function resetScanState() {
    setQrPayload("");
    setManualQr("");
    setScannerEnabled(true);
  }

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl: apiBaseUrl,
        getAccessToken: () => session?.accessToken ?? null
      }),
    [apiBaseUrl, session]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [token, userRaw, queue] = await Promise.all([
          AsyncStorage.getItem(ACCESS_TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
          loadOfflineQueue()
        ]);
        if (!mounted) return;
        if (token && userRaw) {
          setSession({ accessToken: token, user: JSON.parse(userRaw) as AuthUser });
        }
        setPendingCount(queue.filter((q) => q.syncStatus === OfflineSyncStatus.PENDING).length);
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
      Alert.alert("Thieu thong tin", "Vui long nhap email va mat khau.");
      return;
    }
    setBusy(true);
    try {
      const res = await api.authApi.login({ email: email.trim(), password });
      const okRole =
        res.user.roles.includes(Role.CHECKIN_STAFF) ||
        res.user.roles.includes(Role.ORGANIZER) ||
        res.user.roles.includes(Role.ADMIN);
      if (!okRole) {
        Alert.alert("Khong du quyen", "Tai khoan khong co quyen check-in.");
        return;
      }
      const next = { accessToken: res.accessToken, user: res.user };
      await AsyncStorage.multiSet([
        [ACCESS_TOKEN_KEY, next.accessToken],
        [USER_KEY, JSON.stringify(next.user)]
      ]);
      setSession(next);
      setLastResult("Dang nhap thanh cong.");
      if (!cameraPermission?.granted) {
        await requestCameraPermission();
      }
    } catch (error) {
      Alert.alert("Loi", error instanceof Error ? error.message : "Dang nhap that bai");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, USER_KEY]);
    setSession(null);
    setLastResult("Da dang xuat.");
  }

  async function syncOfflineQueue() {
    if (!session) return;
    const queue = await loadOfflineQueue();
    const pending = queue.filter((q) => q.syncStatus === OfflineSyncStatus.PENDING);
    if (pending.length === 0) {
      setPendingCount(0);
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
      setPendingCount(updated.filter((q) => q.syncStatus === OfflineSyncStatus.PENDING).length);
      setLastResult("Dong bo offline xong.");
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
      setPendingCount(updated.filter((q) => q.syncStatus === OfflineSyncStatus.PENDING).length);
      setLastResult("Sync loi, se thu lai khi co mang.");
    }
  }

  async function saveLocalOfflineCheckin(payload: string, targetWorkshopId: string) {
    if (!session) return;
    const now = new Date().toISOString();
    const deviceId = await getOrCreateDeviceId();
    const record: OfflineCheckinRecord = {
      clientCheckinId: createId(),
      qrPayload: payload,
      workshopId: targetWorkshopId,
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
    setPendingCount(queue.filter((q) => q.syncStatus === OfflineSyncStatus.PENDING).length);
    setLastResult("Da luu check-in offline.");
  }

  async function runCheckin(payload: string) {
    if (!session) return;
    const trimmedPayload = payload.trim();
    if (!trimmedPayload) {
      Alert.alert("Thieu du lieu", "Can QR payload.");
      return false;
    }

    let targetWorkshopId = workshopId.trim();
    try {
      const parsed = parseQrPayload(trimmedPayload);
      if (!targetWorkshopId && parsed.workshopId) {
        targetWorkshopId = parsed.workshopId;
      } else if (parsed.workshopId && parsed.workshopId !== targetWorkshopId) {
        Alert.alert("Sai workshop", "QR thuoc workshop khac. Hay chon dung workshop.");
        return false;
      }
    } catch {
      // Ignore parse errors; API will validate raw payload.
    }

    if (!targetWorkshopId) {
      Alert.alert("Thieu du lieu", "Can workshop id.");
      return false;
    }

    setBusy(true);
    const mode: CheckinMode = isOnline ? "ONLINE" : "OFFLINE";
    try {
      if (mode === "ONLINE") {
        const result = await api.checkinApi.checkin({
          qrPayload: trimmedPayload,
          workshopId: targetWorkshopId,
          idempotencyKey: createId()
        });
        const message = `Check-in ${result.status}`;
        setLastResult(message);
        Alert.alert("Thanh cong", message);
      } else {
        await saveLocalOfflineCheckin(trimmedPayload, targetWorkshopId);
        setLastResult("Da luu check-in offline.");
        Alert.alert("Da luu offline", "Se tu dong dong bo khi co mang.");
      }
      return true;
    } catch (error) {
      if (error instanceof ApiClientError) {
        setLastResult(error.message);
        Alert.alert("Check-in that bai", error.message);
        return false;
      }
      await saveLocalOfflineCheckin(trimmedPayload, targetWorkshopId);
      setLastResult("Online loi, da fallback offline.");
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function onQrDetected(payload: string) {
    if (!scannerEnabled || busy) return;
    const now = Date.now();
    if (now - lastScanAtRef.current < 2000) {
      return;
    }
    lastScanAtRef.current = now;
    setScannerEnabled(false);
    const trimmed = payload.trim();
    if (!trimmed) {
      setScannerEnabled(true);
      return;
    }
    try {
      const parsed = parseQrPayload(trimmed);
      if (parsed.workshopId && !workshopId.trim()) {
        setWorkshopId(parsed.workshopId);
      } else if (parsed.workshopId && parsed.workshopId !== workshopId.trim()) {
        Alert.alert("Sai workshop", "QR thuoc workshop khac. Hay chon dung workshop.");
        setScannerEnabled(true);
        return;
      }
    } catch {
      // Ignore parse errors; API will validate raw payload.
    }
    setQrPayload(trimmed);
    const ok = await runCheckin(trimmed);
    if (ok) {
      resetScanState();
    } else {
      setScannerEnabled(true);
    }
  }

  if (loadingSession) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.note}>Dang tai...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>UniHub Mobile Check-in</Text>
        <Text style={styles.subtitle}>{isOnline ? "Online" : "Offline"} | Pending: {pendingCount}</Text>

        {!session ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Dang nhap</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
            />
            <TextInput
              style={styles.input}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="Mat khau"
            />
            <Pressable style={styles.button} disabled={busy} onPress={handleLogin}>
              <Text style={styles.buttonText}>{busy ? "Dang dang nhap..." : "Dang nhap"}</Text>
            </Pressable>
            <Text style={styles.note}>API: {apiBaseUrl}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Scan QR Check-in</Text>
            <Text style={styles.note}>Xin chao {session.user.fullName}</Text>
            <TextInput
              style={styles.input}
              value={workshopId}
              onChangeText={setWorkshopId}
              placeholder="Workshop ID"
            />

            {!cameraPermission?.granted ? (
              <Pressable style={styles.button} onPress={() => requestCameraPermission()}>
                <Text style={styles.buttonText}>Cap quyen camera</Text>
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

            <Text style={styles.note}>QR vua scan: {qrPayload || "(chua co)"}</Text>
            <Pressable style={styles.secondaryButton} onPress={resetScanState}>
              <Text style={styles.secondaryButtonText}>Scan tiep</Text>
            </Pressable>

            <TextInput
              style={[styles.input, styles.multiline]}
              multiline
              numberOfLines={3}
              value={manualQr}
              onChangeText={setManualQr}
              placeholder="Nhap tay QR payload (du phong)"
            />
            <Pressable
              style={styles.button}
              disabled={busy}
              onPress={() =>
                void runCheckin(manualQr).then((ok) => {
                  if (ok) {
                    resetScanState();
                  }
                })
              }
            >
              <Text style={styles.buttonText}>{busy ? "Dang xu ly..." : "Check-in bang nhap tay"}</Text>
            </Pressable>

            <Pressable style={styles.secondaryButton} disabled={busy || !isOnline} onPress={() => void syncOfflineQueue()}>
              <Text style={styles.secondaryButtonText}>Dong bo thu cong</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} disabled={busy} onPress={handleLogout}>
              <Text style={styles.secondaryButtonText}>Dang xuat</Text>
            </Pressable>
          </View>
        )}

        {lastResult ? <Text style={styles.note}>{lastResult}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f2f4f8" },
  content: { padding: 20, gap: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  title: { fontSize: 28, fontWeight: "700", color: "#0b2a4a" },
  subtitle: { fontSize: 14, color: "#36587b" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, gap: 12 },
  cardTitle: { fontSize: 20, fontWeight: "600", color: "#102030" },
  input: {
    borderWidth: 1,
    borderColor: "#c7d2df",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff"
  },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  scannerWrap: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#9db0c5"
  },
  scanner: { width: "100%", height: 260 },
  button: { backgroundColor: "#0b2a4a", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700" },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#9db0c5",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  secondaryButtonText: { color: "#23405f", fontWeight: "600" },
  note: { color: "#455a70" }
});
