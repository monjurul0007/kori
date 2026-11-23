import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";

import { Toaster } from "@/components/ui/sonner";

import { IosInstallSheet } from "./IosInstallSheet";
import { InstallCard } from "./InstallCard";
import { installStore, listenForInstall } from "./installStore";
import { OfflineBanner } from "./OfflineBanner";
import { UpdateToast } from "./UpdateToast";
import { useInstallPrompt } from "./useInstallPrompt";

const sw = vi.hoisted(() => ({ needRefresh: false, update: vi.fn() }));
vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: [sw.needRefresh, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: sw.update,
  }),
}));

function setMatchMedia(standalone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: standalone && query.includes("standalone"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

function fireInstallEvent() {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt,
    userChoice: Promise.resolve({ outcome: "accepted" as const }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return prompt;
}

beforeAll(() => {
  listenForInstall();
  // jsdom lacks pointer capture, which sonner calls when a toast is pressed.
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});
beforeEach(() => {
  installStore.reset();
  localStorage.clear();
  setMatchMedia(false);
  sw.needRefresh = false;
  sw.update.mockReset();
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Linux; Android 14)");
});
afterEach(() => {
  vi.restoreAllMocks();
  act(() => {
    toast.dismiss();
  });
});

describe("UpdateToast", () => {
  it("shows a Reload toast when a new version is waiting", async () => {
    sw.needRefresh = true;
    render(
      <>
        <Toaster />
        <UpdateToast />
      </>,
    );
    expect(await screen.findByText("A new version of Kori is ready")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(sw.update).toHaveBeenCalledWith(true);
  });

  it("shows nothing when there's no update", () => {
    render(
      <>
        <Toaster />
        <UpdateToast />
      </>,
    );
    expect(screen.queryByText("A new version of Kori is ready")).not.toBeInTheDocument();
  });
});

describe("install prompt", () => {
  it("captures beforeinstallprompt and the Install button calls prompt()", async () => {
    render(<InstallCard />);
    expect(screen.queryByRole("button", { name: "Install Kori" })).not.toBeInTheDocument();
    const prompt = fireInstallEvent();
    await userEvent.click(await screen.findByRole("button", { name: "Install Kori" }));
    expect(prompt).toHaveBeenCalledOnce();
  });

  it("remembers a dismissal", async () => {
    render(<InstallCard />);
    fireInstallEvent();
    await userEvent.click(await screen.findByRole("button", { name: /dismiss/i }));
    expect(screen.queryByRole("button", { name: "Install Kori" })).not.toBeInTheDocument();
    expect(localStorage.getItem("kori.installDismissedAt")).not.toBeNull();
  });

  it("stays hidden for 30 days, then comes back", () => {
    const day = 86_400_000;
    localStorage.setItem("kori.installDismissedAt", String(Date.now() - 29 * day));
    const { unmount } = render(<InstallCard />);
    fireInstallEvent();
    expect(screen.queryByRole("button", { name: "Install Kori" })).not.toBeInTheDocument();
    unmount();
    localStorage.setItem("kori.installDismissedAt", String(Date.now() - 31 * day));
    render(<InstallCard />);
    expect(screen.getByRole("button", { name: "Install Kori" })).toBeInTheDocument();
  });

  it("offers nothing in standalone mode", () => {
    setMatchMedia(true);
    const { result } = renderHook(() => useInstallPrompt());
    fireInstallEvent();
    expect(result.current.canPrompt).toBe(false);
    expect(result.current.platform).toBeNull();
  });

  it("hides everything after appinstalled", () => {
    const { result } = renderHook(() => useInstallPrompt());
    fireInstallEvent();
    expect(result.current.platform).toBe("chromium");
    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(result.current.canPrompt).toBe(false);
  });

  it("shows the instructions sheet on iOS", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)",
    );
    render(
      <MemoryRouter>
        <InstallCard />
        <IosInstallSheet />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Install Kori" }));
    expect(await screen.findByText(/Tap Share, then Add to Home Screen/)).toBeInTheDocument();
  });
});

describe("OfflineBanner", () => {
  it("toggles with the online and offline events", () => {
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    online.mockReturnValue(false);
    fireEvent(window, new Event("offline"));
    expect(screen.getByRole("status")).toHaveTextContent("You're offline.");
    online.mockReturnValue(true);
    fireEvent(window, new Event("online"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
