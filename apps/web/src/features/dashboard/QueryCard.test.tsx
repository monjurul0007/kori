import { useQuery } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QueryCard } from "./QueryCard";
import { renderCard } from "./testHelpers";

let calls = 0;
function Probe({ fail }: { fail: boolean }) {
  const query = useQuery({
    queryKey: ["probe", fail],
    queryFn: async () => {
      calls += 1;
      if (fail && calls === 1) throw new Error("nope");
      return "hello";
    },
  });
  return (
    <QueryCard title="Probe" query={query}>
      {(data) => <p>{data} world</p>}
    </QueryCard>
  );
}

describe("QueryCard", () => {
  beforeEach(() => {
    calls = 0;
  });

  it("shows a skeleton, then the content", async () => {
    renderCard(<Probe fail={false} />);
    expect(screen.getByLabelText("Loading Probe")).toBeInTheDocument();
    expect(await screen.findByText("hello world")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Probe" })).toBeInTheDocument();
  });

  it("shows an error with a working retry", async () => {
    renderCard(<Probe fail />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load Probe.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("hello world")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
