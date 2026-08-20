#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { spawnPromise } from "spawn-rx";
import { rimraf } from "rimraf";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const server = new Server(
  {
    name: "mcp-youtube",
    version: "0.7.3",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "download_youtube_url",
        description:
          "Downloads the English subtitles (manual or auto-generated) for a YouTube video and returns the transcript text, so the video's spoken content can be read and summarized.",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "URL of the YouTube video",
            },
          },
          required: ["url"],
        },
      },
    ],
  };
});

export function isYouTubeUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  return (
    host === "youtube.com" ||
    host.endsWith(".youtube.com") ||
    host === "youtu.be" ||
    host === "youtube-nocookie.com" ||
    host.endsWith(".youtube-nocookie.com")
  );
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "download_youtube_url") {
    return {
      content: [
        {
          type: "text",
          text: `Unknown tool: ${request.params.name}`,
        },
      ],
      isError: true,
    };
  }

  const { url } = request.params.arguments as { url: string };

  if (!isYouTubeUrl(url)) {
    return {
      content: [
        {
          type: "text",
          text: `Not a valid YouTube URL: ${url}. Expected an http(s) URL on youtube.com or youtu.be.`,
        },
      ],
      isError: true,
    };
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "youtube-"));

  try {
    await spawnPromise(
      "yt-dlp",
      [
        "--write-sub",
        "--write-auto-sub",
        "--skip-download",
        "--sub-lang",
        "en",
        "--convert-subs",
        "srt",
        url,
      ],
      { cwd: tempDir },
    );

    const subtitleFiles = fs
      .readdirSync(tempDir)
      .filter((file) => file.endsWith(".srt") || file.endsWith(".vtt"));

    if (subtitleFiles.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No English subtitles were found for ${url}.`,
          },
        ],
        isError: true,
      };
    }

    let content = "";
    for (const file of subtitleFiles) {
      const fileContent = fs.readFileSync(path.join(tempDir, file), "utf8");
      content += `${file}\n====================\n${stripVttNoise(fileContent)}\n`;
    }

    return {
      content: [{ type: "text", text: content }],
      isError: false,
    };
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: `Error downloading subtitles: ${err}`,
        },
      ],
      isError: true,
    };
  } finally {
    rimraf.sync(tempDir);
  }
});

// Auto-generated subtitle files repeat every cue several times and carry
// timing/positioning noise that wastes context; collapse them to plain text.
// Only consecutive duplicates are dropped, so a phrase legitimately repeated
// later in the video is preserved.
export function stripVttNoise(subtitles: string): string {
  const lines: string[] = [];
  let previous: string | null = null;

  for (const rawLine of subtitles.split(/\r?\n/)) {
    const line = rawLine
      .replace(/<[^>]+>/g, "")
      .replace(/\[Music\]|\[Applause\]/gi, "")
      .trim();

    if (
      line === "" ||
      /^\d+$/.test(line) ||
      /^WEBVTT/.test(line) ||
      /^(Kind|Language):/.test(line) ||
      /-->/.test(line)
    ) {
      continue;
    }

    if (line !== previous) {
      lines.push(line);
      previous = line;
    }
  }

  return lines.join("\n");
}

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Only start the stdio server when executed directly, so tests can import
// helpers without spinning it up.
const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  runServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
