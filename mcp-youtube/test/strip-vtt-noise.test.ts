import { describe, expect, it } from "bun:test";
import { isYouTubeUrl, stripVttNoise } from "../src/index";

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

  it("collapses consecutive repeated cues from auto-generated subtitles", () => {
    const input = [
      "00:00:00.000 --> 00:00:02.000",
      "hello world",
      "00:00:02.000 --> 00:00:04.000",
      "hello world",
      "and more",
    ].join("\n");

    expect(stripVttNoise(input)).toBe("hello world\nand more");
  });

  it("preserves repeated lines that are not adjacent", () => {
    const input = ["thank you", "for watching", "thank you"].join("\n");

    expect(stripVttNoise(input)).toBe("thank you\nfor watching\nthank you");
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

describe("isYouTubeUrl", () => {
  it("accepts standard YouTube URLs", () => {
    expect(isYouTubeUrl("https://www.youtube.com/watch?v=abc123")).toBe(true);
    expect(isYouTubeUrl("https://youtube.com/watch?v=abc123")).toBe(true);
    expect(isYouTubeUrl("https://m.youtube.com/watch?v=abc123")).toBe(true);
    expect(isYouTubeUrl("https://youtu.be/abc123")).toBe(true);
    expect(isYouTubeUrl("http://youtube.com/watch?v=abc123")).toBe(true);
  });

  it("rejects non-YouTube hosts", () => {
    expect(isYouTubeUrl("https://example.com/watch?v=abc123")).toBe(false);
    expect(isYouTubeUrl("https://evilyoutube.com/watch?v=abc123")).toBe(false);
    expect(isYouTubeUrl("https://youtube.com.evil.example/watch")).toBe(false);
  });

  it("rejects non-http(s) schemes and malformed URLs", () => {
    expect(isYouTubeUrl("file:///etc/passwd")).toBe(false);
    expect(isYouTubeUrl("ftp://youtube.com/video")).toBe(false);
    expect(isYouTubeUrl("not a url")).toBe(false);
  });
});
