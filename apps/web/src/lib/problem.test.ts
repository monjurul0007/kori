import { ApiError, type Problem } from "@/api/client";

import { friendlyProblemMessage, problemFieldErrors, stripValueErrorPrefix } from "./problem";

function apiError(status: number, errors?: unknown): ApiError {
  const problem: Problem = {
    type: "about:blank",
    title: "Error",
    status,
    detail: "",
    errors,
  } as Problem;
  return new ApiError(problem, new Response(null, { status }));
}

const fieldFor = (loc: unknown[]) => (loc.includes("amount") ? ("amount" as const) : undefined);

describe("problemFieldErrors", () => {
  it("maps each error's loc to a field", () => {
    const error = apiError(422, [{ loc: ["body", "amount"], msg: "Must be above zero" }]);
    expect(problemFieldErrors(error, fieldFor)).toEqual([
      { field: "amount", message: "Must be above zero" },
    ]);
  });

  it("strips the pydantic prefix", () => {
    const error = apiError(422, [
      { loc: ["body", "amount"], msg: "Value error, Amount is too large" },
    ]);
    expect(problemFieldErrors(error, fieldFor)[0]?.message).toBe("Amount is too large");
  });

  it("rewrites the string length message", () => {
    const error = apiError(422, [
      { loc: ["body", "amount"], msg: "String should have at most 50 characters" },
    ]);
    expect(problemFieldErrors(error, fieldFor)[0]?.message).toBe("Use 50 characters or fewer");
  });

  it("leaves out errors that map to no field", () => {
    const error = apiError(422, [{ loc: ["body", "other"], msg: "Nope" }]);
    expect(problemFieldErrors(error, fieldFor)).toEqual([]);
  });

  it("falls back to a generic message when the server sent none", () => {
    const error = apiError(422, [{ loc: ["body", "amount"] }]);
    expect(problemFieldErrors(error, fieldFor)[0]?.message).toBe("Invalid value");
  });

  it("returns nothing for other statuses and other errors", () => {
    const server = apiError(500, [{ loc: ["body", "amount"], msg: "Boom" }]);
    expect(problemFieldErrors(server, fieldFor)).toEqual([]);
    expect(problemFieldErrors(new Error("offline"), fieldFor)).toEqual([]);
  });
});

describe("friendlyProblemMessage", () => {
  it("leaves other messages as they are", () => {
    expect(friendlyProblemMessage("Pick a category")).toBe("Pick a category");
  });

  it("strips only a leading prefix", () => {
    expect(stripValueErrorPrefix("Not a Value error, really")).toBe("Not a Value error, really");
  });
});
