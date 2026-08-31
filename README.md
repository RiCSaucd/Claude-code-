# Claude-code — Connect to Hermes

Connect **Claude Code** (Anthropic's CLI coding tool) to a
[NousResearch Hermes](https://huggingface.co/NousResearch) model via an
OpenAI-compatible API endpoint (Ollama, Together AI, OpenRouter, etc.).

---

## Quick start

### 1 — Install Claude Code

```bash
npm install -g @anthropic-ai/claude-code
```

### 2 — Start your Hermes server

**Ollama (local)**

```bash
# Install Ollama: https://ollama.com/download
ollama serve
ollama pull NousResearch/Hermes-3-Llama-3.1-8B
```

**Remote / cloud provider**  
Set `HERMES_API_BASE_URL` and `HERMES_API_KEY` to point at your provider's
OpenAI-compatible endpoint before running the setup script.

### 3 — Run the setup script

```bash
# Default: Ollama on localhost:11434
bash setup.sh

# Custom endpoint
HERMES_API_BASE_URL=https://api.example.com/v1 \
HERMES_API_KEY=sk-your-key \
HERMES_MODEL=NousResearch/Hermes-3-Llama-3.1-70B \
bash setup.sh
```

The script will:
- Verify that the Claude Code CLI is installed
- Pull the Hermes model via Ollama (if Ollama is available)
- Test connectivity to the API endpoint
- Write a `.env.hermes` file with the required environment variables

### 4 — Use Claude Code with Hermes

```bash
source .env.hermes
claude --model NousResearch/Hermes-3-Llama-3.1-8B
```

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `HERMES_API_BASE_URL` | `http://localhost:11434/v1` | OpenAI-compatible base URL |
| `HERMES_API_KEY` | `ollama` | API key (use `ollama` for local Ollama) |
| `HERMES_MODEL` | `NousResearch/Hermes-3-Llama-3.1-8B` | Model name to use |

Claude Code reads `ANTHROPIC_BASE_URL` and `ANTHROPIC_API_KEY` to connect to
custom endpoints. The setup script sets both automatically.

The `.claude/settings.json` file in this repository provides a reference
configuration for the Claude Code project settings.

---

## Repository structure

```
.
├── .claude/
│   └── settings.json   # Claude Code project configuration
├── setup.sh            # One-shot setup script
├── site-kit/           # CCC Site Kit scripts (see site-kit/README.md)
│   ├── build.sh
│   ├── deploy.sh
│   ├── use-stock.sh
│   └── README.md
└── README.md
```

---

## site-kit/

`site-kit/` holds the CCC Site Kit shell scripts and their README. It is
independent of the Hermes setup above.

Only the shell scripts and the README are present. The kit's README also refers
to `site.config.mjs`, `render.mjs`, `stamp.mjs`, and the `engine/`, `templates/`,
`render/`, `reference/`, and `stock/` folders, none of which are in this
repository yet, so the scripts are not runnable as-is.

The scripts also assume a macOS shell environment: they use `#!/bin/zsh`, and
`build.sh` calls `sips` (macOS only) plus `ffmpeg`, `ffprobe`, and `bc` without
checking that they exist.
