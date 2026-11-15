import { it, expect } from "vitest";
import { cn } from "@/lib/utils";

it("merges tailwind classes", () => expect(cn("p-2", "p-4")).toBe("p-4"));
