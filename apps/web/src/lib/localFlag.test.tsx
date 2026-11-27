import { act, renderHook } from "@testing-library/react";

import { readLocalFlag, setLocalFlag, useLocalFlag } from "./localFlag";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("useLocalFlag", () => {
  it("starts off and turns on when set", () => {
    const { result } = renderHook(() => useLocalFlag("test.start"));
    expect(result.current[0]).toBe(false);
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem("test.start")).toBe("1");
  });

  it("reads a flag saved earlier", () => {
    localStorage.setItem("test.saved", "1");
    const { result } = renderHook(() => useLocalFlag("test.saved"));
    expect(result.current[0]).toBe(true);
  });

  it("updates every reader of the same key", () => {
    const first = renderHook(() => useLocalFlag("test.shared"));
    const second = renderHook(() => useLocalFlag("test.shared"));
    act(() => first.result.current[1]());
    expect(second.result.current[0]).toBe(true);
  });

  it("stays off and doesn't throw when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readLocalFlag("test.blocked")).toBe(false);
    const { result } = renderHook(() => useLocalFlag("test.blocked"));
    expect(result.current[0]).toBe(false);
    expect(() => act(() => setLocalFlag("test.blocked"))).not.toThrow();
    expect(result.current[0]).toBe(false);
  });
});
