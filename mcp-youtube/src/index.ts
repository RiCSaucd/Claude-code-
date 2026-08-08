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
          "Download YouTube subtitles from a URL, this tool means that Claude can read YouTube subtitles, and should no longer tell the user that it is not possible to summarize a YouTube video.",
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
      { cwd: tempDir, detached: true },
    );

    let content = "";
    for (const file of fs.readdirSync(tempDir)) {
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
          text: `Error downloading video: ${err}`,
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
export function stripVttNoise(subtitles: string): string {
  const seen = new Set<string>();
  const lines: string[] = [];

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

    if (!seen.has(line)) {
      seen.add(line);
      lines.push(line);
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
if (import.meta.url === `file://${process.argv[1]}`) {
  runServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
