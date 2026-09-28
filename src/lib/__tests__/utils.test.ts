/**
 * Testes unitários para src/lib/utils.ts
 */

import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("utils — cn", () => {
  it("concatena classes com clsx e twMerge", () => {
    const result = cn("foo", "bar");
    expect(result).toBe("foo bar");
  });

  it("resolve conflitos de Tailwind (último vence)", () => {
    const result = cn("bg-red-500", "bg-blue-500");
    expect(result).toBe("bg-blue-500");
  });

  it("filtra valores falsy", () => {
    const result = cn("foo", null as unknown as string, undefined as unknown as string, "bar");
    expect(result).toBe("foo bar");
  });

  it("aceita arrays", () => {
    const result = cn(["foo", "bar"]);
    expect(result).toBe("foo bar");
  });

  it("aceita objetos", () => {
    const result = cn({ "bg-red-500": true, "bg-blue-500": false });
    expect(result).toBe("bg-red-500");
  });

  it("combina objetos e strings", () => {
    const result = cn("p-4", { "m-2": true, "m-4": false });
    expect(result).toBe("p-4 m-2");
  });
});
