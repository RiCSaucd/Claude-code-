import { describe, expect, it } from "bun:test";
import { stripVttNoise } from "../src/index";

describe("stripVttNoise", () => {
  it("removes WEBVTT headers and timing lines", () => {
    const input = [
      "WEBVTT",
      "Kind: captions",
      "Language: en",
      "",
      "00:00:00.000 --> 00:00:02.000",
      "hello world",
    ].join("\n");

    expect(stripVttNoise(input)).toBe("hello world");
  });

  it("deduplicates repeated cues from auto-generated subtitles", () => {
    const input = [
      "00:00:00.000 --> 00:00:02.000",
      "hello world",
      "00:00:02.000 --> 00:00:04.000",
      "hello world",
      "and more",
    ].join("\n");

    expect(stripVttNoise(input)).toBe("hello world\nand more");
  });

  it("strips inline tags and sound annotations", () => {
    const input = [
      "<00:00:01.000><c>hello</c> there",
      "[Music]",
      "[Applause]",
    ].join("\n");

    expect(stripVttNoise(input)).toBe("hello there");
  });

  it("drops SRT sequence numbers", () => {
    const input = ["1", "00:00:00,000 --> 00:00:02,000", "first line"].join(
      "\n",
    );

    expect(stripVttNoise(input)).toBe("first line");
  });
});
