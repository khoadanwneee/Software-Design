import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Mail, MailOpen, Send } from "lucide-react";
import type { ReactNode } from "react";
import type { NotificationItem, NotificationListStatus, NotificationPreferenceDto } from "@unihub/shared-types";
import { api } from "../../lib/api";

const pageSize = 20;
const statusOptions: NotificationListStatus[] = ["ALL", "UNREAD", "READ"];

export function NotificationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const statusParam = searchParams.get("status");
  const status = statusOptions.includes(statusParam as NotificationListStatus)
    ? (statusParam as NotificationListStatus)
    : "ALL";
  const pageParam = Number(searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

  const notifications = useQuery({
    queryKey: ["notifications", status, page],
    queryFn: () => api.notificationApi.list({ status, page, limit: pageSize }),
    refetchInterval: 3000
  });

  const markAll = useMutation({
    mutationFn: () => api.notificationApi.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    }
  });

  function updateParam(name: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value && !(name === "page" && value === "1")) {
      next.set(name, value);
    } else {
      next.delete(name);
    }
    if (name === "status") {
      next.delete("page");
    }
    setSearchParams(next, { replace: true });
  }

  return (
    <section>
      <div className="section-header">
        <h1>Notifications</h1>
        <button
          onClick={() => markAll.mutate()}
          disabled={markAll.isPending || !notifications.data || notifications.data.items.length === 0}
        >
          <CheckCheck size={18} /> Mark all read
        </button>
      </div>
      <div className="panel filters-panel">
        <label>
          Status
          <select value={status} onChange={(event) => updateParam("status", event.target.value)}>
            <option value="ALL">All</option>
            <option value="UNREAD">Unread</option>
            <option value="READ">Read</option>
          </select>
        </label>
      </div>
      <NotificationPreferencesPanel />
      {notifications.isLoading ? <p>Loading...</p> : null}
      {notifications.error ? <p className="error">{notifications.error.message}</p> : null}
      {markAll.error ? <p className="error">{markAll.error.message}</p> : null}
      {!notifications.isLoading && notifications.data?.items.length === 0 ? (
        <p className="notice">No notifications match the current filter.</p>
      ) : null}
      <div className="notification-list">
        {notifications.data?.items.map((item) => (
          <NotificationRow key={item.id} item={item} />
        ))}
      </div>
      {notifications.data && notifications.data.totalPages > 1 ? (
        <div className="toolbar pagination">
          <button className="secondary" disabled={page <= 1} onClick={() => updateParam("page", String(page - 1))}>
            Previous
          </button>
          <span>
            Page {notifications.data.page} / {notifications.data.totalPages}
          </span>
          <button
            className="secondary"
            disabled={page >= notifications.data.totalPages}
            onClick={() => updateParam("page", String(page + 1))}
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}

function NotificationPreferencesPanel() {
  const queryClient = useQueryClient();
  const preferences = useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: () => api.notificationApi.getPreferences()
  });

  const updatePreferences = useMutation({
    mutationFn: (next: NotificationPreferenceDto) => api.notificationApi.updatePreferences(next),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: ["notifications", "preferences"] });
      const previous = queryClient.getQueryData<NotificationPreferenceDto>(["notifications", "preferences"]);
      queryClient.setQueryData(["notifications", "preferences"], next);
      return { previous };
    },
    onError: (_error, _next, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["notifications", "preferences"], context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", "preferences"] });
    }
  });

  const current = preferences.data;

  function toggle(name: keyof NotificationPreferenceDto) {
    if (!current) {
      return;
    }
    updatePreferences.mutate({ ...current, [name]: !current[name] });
  }

  return (
    <div className="panel notification-preferences">
      <div>
        <h2>Notification settings</h2>
        <p className="meta">Choose where UniHub sends workshop updates and reminders.</p>
      </div>
      {preferences.isLoading ? <p>Loading settings...</p> : null}
      {preferences.error ? <p className="error">{preferences.error.message}</p> : null}
      {updatePreferences.error ? <p className="error">{updatePreferences.error.message}</p> : null}
      {current ? (
        <div className="preference-toggle-list" aria-busy={updatePreferences.isPending}>
          <PreferenceToggle
            icon={<Bell size={18} />}
            label="In-app"
            checked={current.inApp}
            disabled={updatePreferences.isPending}
            onChange={() => toggle("inApp")}
          />
          <PreferenceToggle
            icon={<Mail size={18} />}
            label="Email"
            checked={current.email}
            disabled={updatePreferences.isPending}
            onChange={() => toggle("email")}
          />
          <PreferenceToggle
            icon={<Send size={18} />}
            label="Telegram"
            checked={current.telegram}
            disabled={updatePreferences.isPending}
            onChange={() => toggle("telegram")}
          />
        </div>
      ) : null}
    </div>
  );
}

function PreferenceToggle({
  icon,
  label,
  checked,
  disabled,
  onChange
}: {
  icon: ReactNode;
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <label className="preference-toggle">
      <span>
        {icon}
        {label}
      </span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} />
    </label>
  );
}

function NotificationRow({ item }: { item: NotificationItem }) {
  const queryClient = useQueryClient();
  const markRead = useMutation({
    mutationFn: () => api.notificationApi.markRead(item.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    }
  });

  return (
    <article className={item.status === "UNREAD" ? "notification-card unread" : "notification-card"}>
      <div>
        <div className="notification-title">
          <h2>{item.title}</h2>
          <span className={item.status === "UNREAD" ? "badge unread-badge" : "badge read-badge"}>{item.status}</span>
        </div>
        <p>{item.message}</p>
        <div className="meta">
          <span>{new Date(item.createdAt).toLocaleString("vi-VN")}</span>
          {item.workshopTitle ? <span>{item.workshopTitle}</span> : null}
        </div>
      </div>
      <div className="notification-actions">
        {item.actionUrl ? (
          <Link className="button secondary" to={item.actionUrl}>
            Open
          </Link>
        ) : null}
        {item.status === "UNREAD" ? (
          <button className="secondary" onClick={() => markRead.mutate()} disabled={markRead.isPending}>
            <MailOpen size={18} /> Mark read
          </button>
        ) : null}
      </div>
      {markRead.error ? <p className="error full">{markRead.error.message}</p> : null}
    </article>
  );
}
