import { describe, expect, it } from "vitest";
import { validateLogin, validateSignup } from "../lib/auth-validation";

describe("Studyholics visual validation", () => {
  it("requires login values", () => {
    expect(validateLogin({ username: " ", password: "" })).toHaveProperty("username");
    expect(validateLogin({ username: "julia", password: "example" })).toEqual({});
  });
  it("requires valid signup values and matching passwords", () => {
    const values = { name: "Julia Carvalho", email: "julia@example.com", password: "example123", confirmPassword: "example123" };
    expect(validateSignup(values)).toEqual({});
    expect(validateSignup({ ...values, email: "invalid" })).toHaveProperty("email");
    expect(validateSignup({ ...values, password: "short" })).toHaveProperty("password");
    expect(validateSignup({ ...values, confirmPassword: "different" })).toHaveProperty("confirmPassword");
    expect(validateSignup({ ...values, name: " " })).toHaveProperty("name");
  });
});