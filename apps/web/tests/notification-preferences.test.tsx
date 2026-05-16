import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationPreferenceDto } from "@unihub/shared-types";
import { NotificationsPage } from "../src/features/notifications/NotificationsPage";

const mocks = vi.hoisted(() => {
  const state = {
    preferences: { inApp: true, email: true, telegram: false }
  };
  return {
    state,
    updatePreferences: vi.fn(async (next: NotificationPreferenceDto) => {
      state.preferences = next;
      return state.preferences;
    })
  };
});

vi.mock("../src/lib/api", () => ({
  api: {
    notificationApi: {
      list: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, totalPages: 1 })),
      unreadCount: vi.fn(async () => ({ count: 0 })),
      markRead: vi.fn(),
      markAllRead: vi.fn(async () => ({ updated: 0 })),
      getPreferences: vi.fn(async () => mocks.state.preferences),
      updatePreferences: mocks.updatePreferences
    }
  }
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Notification preferences UI", () => {
  beforeEach(() => {
    mocks.state.preferences = { inApp: true, email: true, telegram: false };
    mocks.updatePreferences.mockClear();
  });

  it("optimistically toggles and persists email preference", async () => {
    renderPage();

    const emailToggle = await screen.findByLabelText("Email");
    expect(emailToggle).toBeChecked();

    await userEvent.click(emailToggle);

    await waitFor(() => {
      expect(mocks.updatePreferences).toHaveBeenCalledWith({ inApp: true, email: false, telegram: false });
    });
  });
});
