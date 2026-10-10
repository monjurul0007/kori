import { act, fireEvent, render, screen } from "@testing-library/react";

import { SearchInput } from "./SearchInput";

describe("SearchInput", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const type = (text: string) =>
    fireEvent.change(screen.getByLabelText("Search transactions"), { target: { value: text } });

  it("waits 300 ms after the last keystroke", () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} />);
    type("st");
    act(() => vi.advanceTimersByTime(299));
    expect(onChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("st");
  });

  it("restarts the wait on each keystroke and sends only the last value", () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} />);
    type("s");
    act(() => vi.advanceTimersByTime(200));
    type("st");
    act(() => vi.advanceTimersByTime(200));
    expect(onChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(100));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("st");
  });

  it("follows the value when the URL changes elsewhere", () => {
    const { rerender } = render(<SearchInput value="star" onChange={() => {}} />);
    expect(screen.getByLabelText("Search transactions")).toHaveValue("star");
    rerender(<SearchInput value="" onChange={() => {}} />);
    expect(screen.getByLabelText("Search transactions")).toHaveValue("");
  });

  it("does not fire when the text matches the current value", () => {
    const onChange = vi.fn();
    render(<SearchInput value="star" onChange={onChange} />);
    act(() => vi.advanceTimersByTime(1000));
    expect(onChange).not.toHaveBeenCalled();
  });
});
