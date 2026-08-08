# mcp-youtube

A [Model Context Protocol](https://modelcontextprotocol.io) server that lets
Claude read YouTube video subtitles, so it can summarize and answer questions
about video content.

## How it works

The server exposes a single tool, `download_youtube_url`, which uses
[`yt-dlp`](https://github.com/yt-dlp/yt-dlp) to fetch the English subtitles
(manual or auto-generated) for a video, cleans out timing/markup noise, and
returns the transcript text.

## Prerequisites

- [Node.js](https://nodejs.org) 18+
- [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) available on your `PATH`
  - macOS: `brew install yt-dlp`
  - Linux: `pipx install yt-dlp` (or your package manager)
  - Windows: `winget install yt-dlp`

## Installation

Add it to your MCP client configuration (e.g. `claude_desktop_config.json`
for Claude Desktop):

```json
{
  "mcpServers": {
    "youtube": {
      "command": "npx",
      "args": ["-y", "@anaisbetts/mcp-youtube"]
    }
  }
}
```

Or with Claude Code:

```bash
claude mcp add youtube -- npx -y @anaisbetts/mcp-youtube
```

## Development

```bash
bun install       # install dependencies
bun test          # run tests
bun build --target node src/index.ts --outdir dist   # build
```

## License

MIT
