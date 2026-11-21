import { describe, expect, it } from "vitest";
import { crawlCost, creditsOf, extractCost, mapCost, searchCost } from "../src/core/cost.js";

describe("searchCost", () => {
  it("charges 1 for every depth except advanced", () => {
    expect(searchCost("basic")).toBe(1);
    expect(searchCost("fast")).toBe(1);
    expect(searchCost("ultra-fast")).toBe(1);
    expect(searchCost("advanced")).toBe(2);
  });
});

describe("extractCost", () => {
  it("rounds a batch of five URLs up to one credit", () => {
    expect(extractCost(1, "basic")).toBe(1);
    expect(extractCost(5, "basic")).toBe(1);
    expect(extractCost(6, "basic")).toBe(2);
    expect(extractCost(20, "basic")).toBe(4);
    expect(extractCost(20, "advanced")).toBe(8);
  });
});

describe("mapCost", () => {
  it("charges per ten pages", () => {
    expect(mapCost(1, false)).toBe(1);
    expect(mapCost(10, false)).toBe(1);
    expect(mapCost(11, false)).toBe(2);
    expect(mapCost(50, false)).toBe(5);
    expect(mapCost(50, true)).toBe(10);
  });
});

describe("crawlCost", () => {
  it("adds mapping and extraction", () => {
    expect(crawlCost(10, false, "basic")).toBe(3);
    expect(crawlCost(10, false, "advanced")).toBe(5);
    expect(crawlCost(1, false, "basic")).toBe(2);
    expect(crawlCost(50, true, "basic")).toBe(20);
  });
});

describe("creditsOf", () => {
  it("reads usage.credits and keeps zero", () => {
    expect(creditsOf({ usage: { credits: 2 } })).toBe(2);
    expect(creditsOf({ usage: { credits: 0 } })).toBe(0);
    expect(creditsOf({ usage: {} })).toBeNull();
    expect(creditsOf({})).toBeNull();
    expect(creditsOf(null)).toBeNull();
  });
});
