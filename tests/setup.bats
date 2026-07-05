#!/usr/bin/env bats
# tests/setup.bats — BATS test suite for setup.sh

###############################################################################
# Helpers
###############################################################################

# Source only the function definitions from setup.sh, without executing main.
# We override main() to a no-op so that `source`ing the file is safe.
load_script() {
  # Provide stub for any external tool we don't want to call in tests
  export SCRIPT_TMPDIR="${BATS_TEST_TMPDIR:-/tmp/bats-$$}"
  mkdir -p "$SCRIPT_TMPDIR"

  # Prevent main() from running on source
  # shellcheck disable=SC1090
  source <(sed 's/^main "\$@"$/: # main "$@" disabled/' \
              "${BATS_TEST_DIRNAME}/../setup.sh")
}

setup() {
  # Each test runs inside an isolated temp directory.
  TEST_DIR="$(mktemp -d)"
  cd "$TEST_DIR"

  # Reset env vars that setup.sh reads, so tests are independent.
  unset HERMES_API_BASE_URL HERMES_API_KEY HERMES_MODEL
  unset ANTHROPIC_BASE_URL  ANTHROPIC_API_KEY

  # Re-source the script with defaults so function definitions are fresh.
  load_script
}

teardown() {
  rm -rf "$TEST_DIR"
}

###############################################################################
# 1. Default configuration
###############################################################################

@test "default API base URL is localhost Ollama endpoint" {
  run bash -c '
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    echo "$HERMES_API_BASE"
  '
  [ "$status" -eq 0 ]
  [ "$output" = "http://localhost:11434/v1" ]
}

@test "default model is NousResearch Hermes-3-Llama-3.1-8B" {
  run bash -c '
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    echo "$HERMES_MODEL"
  '
  [ "$status" -eq 0 ]
  [ "$output" = "NousResearch/Hermes-3-Llama-3.1-8B" ]
}

@test "default API key is 'ollama'" {
  run bash -c '
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    echo "$HERMES_API_KEY"
  '
  [ "$status" -eq 0 ]
  [ "$output" = "ollama" ]
}

@test "HERMES_API_BASE_URL env var overrides the default API base" {
  run bash -c '
    HERMES_API_BASE_URL=https://custom.example.com/v1
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    echo "$HERMES_API_BASE"
  '
  [ "$status" -eq 0 ]
  [ "$output" = "https://custom.example.com/v1" ]
}

@test "HERMES_MODEL env var overrides the default model" {
  run bash -c '
    HERMES_MODEL=custom-model-70B
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    echo "$HERMES_MODEL"
  '
  [ "$status" -eq 0 ]
  [ "$output" = "custom-model-70B" ]
}

@test "HERMES_API_KEY env var overrides the default key" {
  run bash -c '
    HERMES_API_KEY=sk-secret
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    echo "$HERMES_API_KEY"
  '
  [ "$status" -eq 0 ]
  [ "$output" = "sk-secret" ]
}

###############################################################################
# 2. Helper functions
###############################################################################

@test "info() prints to stdout with [INFO] prefix" {
  run info "hello world"
  [ "$status" -eq 0 ]
  [ "$output" = "[INFO]  hello world" ]
}

@test "warn() prints to stderr with [WARN] prefix" {
  # Redirect stderr to stdout for capture.
  run bash -c '
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    warn "something wrong" 2>&1
  '
  [ "$status" -eq 0 ]
  [ "$output" = "[WARN]  something wrong" ]
}

@test "error() prints to stderr with [ERROR] prefix and exits 1" {
  run bash -c '
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    error "fatal problem" 2>&1
  '
  [ "$status" -eq 1 ]
  [ "$output" = "[ERROR] fatal problem" ]
}

@test "error() always exits with code 1 regardless of message" {
  run bash -c '
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    error "" 2>/dev/null
  '
  [ "$status" -eq 1 ]
}

###############################################################################
# 3. check_claude_installed
###############################################################################

@test "check_claude_installed succeeds when claude is on PATH" {
  # Create a fake 'claude' stub.
  local bin_dir="$TEST_DIR/bin"
  mkdir -p "$bin_dir"
  printf '#!/bin/sh\necho "1.0.0"\n' > "$bin_dir/claude"
  chmod +x "$bin_dir/claude"

  run bash -c '
    export PATH="'"$bin_dir"':$PATH"
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    check_claude_installed 2>&1
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"[INFO]"* ]]
  [[ "$output" == *"Claude Code CLI found"* ]]
}

@test "check_claude_installed exits 1 when claude is not on PATH" {
  # claude is not installed in this environment, so the system PATH suffices.
  run bash -c '
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    check_claude_installed 2>&1
  '
  [ "$status" -eq 1 ]
  [[ "$output" == *"[ERROR]"* ]]
  [[ "$output" == *"Claude Code CLI not found"* ]]
}

@test "check_claude_installed error message contains install instructions" {
  run bash -c '
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    check_claude_installed 2>&1
  '
  [[ "$output" == *"npm install -g @anthropic-ai/claude-code"* ]]
}

@test "check_claude_installed shows version when claude --version works" {
  local bin_dir="$TEST_DIR/bin"
  mkdir -p "$bin_dir"
  printf '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "2.3.1"; fi\n' > "$bin_dir/claude"
  chmod +x "$bin_dir/claude"

  run bash -c '
    export PATH="'"$bin_dir"':$PATH"
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    check_claude_installed
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"2.3.1"* ]]
}

###############################################################################
# 4. check_api_reachable
###############################################################################

@test "check_api_reachable prints reachable message when curl succeeds" {
  # Stub curl to succeed
  local bin_dir="$TEST_DIR/bin"
  mkdir -p "$bin_dir"
  printf '#!/bin/sh\nexit 0\n' > "$bin_dir/curl"
  chmod +x "$bin_dir/curl"

  run bash -c '
    export PATH="'"$bin_dir"':$PATH"
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    check_api_reachable 2>&1
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"API endpoint is reachable"* ]]
}

@test "check_api_reachable prints warning when curl fails" {
  local bin_dir="$TEST_DIR/bin"
  mkdir -p "$bin_dir"
  printf '#!/bin/sh\nexit 1\n' > "$bin_dir/curl"
  chmod +x "$bin_dir/curl"

  run bash -c '
    export PATH="'"$bin_dir"':$PATH"
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    check_api_reachable 2>&1
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"[WARN]"* ]]
  [[ "$output" == *"Could not reach"* ]]
}

@test "check_api_reachable warning includes Ollama serve hint" {
  local bin_dir="$TEST_DIR/bin"
  mkdir -p "$bin_dir"
  printf '#!/bin/sh\nexit 1\n' > "$bin_dir/curl"
  chmod +x "$bin_dir/curl"

  run bash -c '
    export PATH="'"$bin_dir"':$PATH"
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    check_api_reachable 2>&1
  '
  [[ "$output" == *"ollama serve"* ]]
}

@test "check_api_reachable does not exit on curl failure (non-fatal)" {
  local bin_dir="$TEST_DIR/bin"
  mkdir -p "$bin_dir"
  printf '#!/bin/sh\nexit 1\n' > "$bin_dir/curl"
  chmod +x "$bin_dir/curl"

  run bash -c '
    export PATH="'"$bin_dir"':$PATH"
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    check_api_reachable 2>&1
    echo "still running"
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"still running"* ]]
}

###############################################################################
# 5. export_env_vars
###############################################################################

@test "export_env_vars sets ANTHROPIC_BASE_URL from HERMES_API_BASE" {
  run bash -c '
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    HERMES_API_BASE="http://test-host/v1"
    export_env_vars >/dev/null 2>&1
    echo "$ANTHROPIC_BASE_URL"
  '
  [ "$status" -eq 0 ]
  [ "$output" = "http://test-host/v1" ]
}

@test "export_env_vars sets ANTHROPIC_API_KEY from HERMES_API_KEY" {
  run bash -c '
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    HERMES_API_KEY="sk-test-key"
    export_env_vars >/dev/null 2>&1
    echo "$ANTHROPIC_API_KEY"
  '
  [ "$status" -eq 0 ]
  [ "$output" = "sk-test-key" ]
}

@test "export_env_vars logs the variables it sets" {
  run bash -c '
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    HERMES_API_BASE="http://test-host/v1"
    HERMES_API_KEY="sk-test-key"
    export_env_vars
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"ANTHROPIC_BASE_URL=http://test-host/v1"* ]]
  [[ "$output" == *"ANTHROPIC_API_KEY=sk-test-key"* ]]
}

###############################################################################
# 6. write_env_file
###############################################################################

@test "write_env_file creates .env.hermes in the current directory" {
  run bash -c '
    cd '"$TEST_DIR"'
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    write_env_file >/dev/null 2>&1
    [ -f .env.hermes ] && echo "exists"
  '
  [ "$status" -eq 0 ]
  [ "$output" = "exists" ]
}

@test "write_env_file writes ANTHROPIC_BASE_URL with current HERMES_API_BASE" {
  run bash -c '
    cd '"$TEST_DIR"'
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    HERMES_API_BASE="http://my-server/v1"
    write_env_file >/dev/null 2>&1
    grep "ANTHROPIC_BASE_URL" .env.hermes
  '
  [ "$status" -eq 0 ]
  [ "$output" = "ANTHROPIC_BASE_URL=http://my-server/v1" ]
}

@test "write_env_file writes ANTHROPIC_API_KEY with current HERMES_API_KEY" {
  run bash -c '
    cd '"$TEST_DIR"'
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    HERMES_API_KEY="sk-mykey"
    write_env_file >/dev/null 2>&1
    grep "ANTHROPIC_API_KEY" .env.hermes
  '
  [ "$status" -eq 0 ]
  [ "$output" = "ANTHROPIC_API_KEY=sk-mykey" ]
}

@test "write_env_file writes HERMES_MODEL with current model" {
  run bash -c '
    cd '"$TEST_DIR"'
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    HERMES_MODEL="my-custom-model"
    write_env_file >/dev/null 2>&1
    grep "HERMES_MODEL" .env.hermes
  '
  [ "$status" -eq 0 ]
  [ "$output" = "HERMES_MODEL=my-custom-model" ]
}

@test "write_env_file output is valid shell syntax (sourceable)" {
  run bash -c '
    cd '"$TEST_DIR"'
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    write_env_file >/dev/null 2>&1
    bash -n .env.hermes
    echo "syntax OK"
  '
  [ "$status" -eq 0 ]
  [ "$output" = "syntax OK" ]
}

@test "write_env_file logs the file path it wrote" {
  run bash -c '
    cd '"$TEST_DIR"'
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    write_env_file
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *".env.hermes"* ]]
}

@test "write_env_file overwrites an existing .env.hermes" {
  run bash -c '
    cd '"$TEST_DIR"'
    echo "OLD_VAR=old" > .env.hermes
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    HERMES_API_BASE="http://new/v1"
    write_env_file >/dev/null 2>&1
    grep "ANTHROPIC_BASE_URL" .env.hermes
  '
  [ "$status" -eq 0 ]
  [ "$output" = "ANTHROPIC_BASE_URL=http://new/v1" ]
}

###############################################################################
# 7. pull_ollama_model
###############################################################################

@test "pull_ollama_model skips pull when ollama is not on PATH" {
  # ollama is not installed in this environment, so the system PATH suffices.
  run bash -c '
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    pull_ollama_model
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"Ollama not found"* ]]
  [[ "$output" == *"skipping model pull"* ]]
}

@test "pull_ollama_model includes Ollama download link when not found" {
  run bash -c '
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    pull_ollama_model
  '
  [[ "$output" == *"https://ollama.com/download"* ]]
}

@test "pull_ollama_model calls ollama pull when ollama is on PATH" {
  local bin_dir="$TEST_DIR/bin"
  mkdir -p "$bin_dir"
  # Stub ollama to record arguments
  printf '#!/bin/sh\necho "ollama called: $*"\n' > "$bin_dir/ollama"
  chmod +x "$bin_dir/ollama"

  run bash -c '
    export PATH="'"$bin_dir"':$PATH"
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    pull_ollama_model
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"ollama called: pull"* ]]
  [[ "$output" == *"NousResearch/Hermes-3-Llama-3.1-8B"* ]]
}

@test "pull_ollama_model warns (does not exit) when ollama pull fails" {
  local bin_dir="$TEST_DIR/bin"
  mkdir -p "$bin_dir"
  printf '#!/bin/sh\nexit 1\n' > "$bin_dir/ollama"
  chmod +x "$bin_dir/ollama"

  run bash -c '
    export PATH="'"$bin_dir"':$PATH"
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    pull_ollama_model 2>&1
    echo "still running"
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"[WARN]"* ]]
  [[ "$output" == *"still running"* ]]
}

@test "pull_ollama_model uses the configured model name" {
  local bin_dir="$TEST_DIR/bin"
  mkdir -p "$bin_dir"
  printf '#!/bin/sh\necho "pulling: $2"\n' > "$bin_dir/ollama"
  chmod +x "$bin_dir/ollama"

  run bash -c '
    export PATH="'"$bin_dir"':$PATH"
    HERMES_MODEL="custom-model-name"
    source <(sed "s/^main \"\\\$@\"\$/: # disabled/" '"${BATS_TEST_DIRNAME}/../setup.sh"')
    pull_ollama_model
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"custom-model-name"* ]]
}

###############################################################################
# 8. main integration
###############################################################################

@test "main runs all setup steps and exits successfully" {
  local bin_dir="$TEST_DIR/bin"
  mkdir -p "$bin_dir"

  # Stub claude
  printf '#!/bin/sh\necho "1.0.0"\n' > "$bin_dir/claude"
  chmod +x "$bin_dir/claude"

  # Stub curl (reachable)
  printf '#!/bin/sh\nexit 0\n' > "$bin_dir/curl"
  chmod +x "$bin_dir/curl"

  # No ollama stub → skips model pull

  run bash -c '
    export PATH="'"$bin_dir"':$PATH"
    cd '"$TEST_DIR"'
    bash '"${BATS_TEST_DIRNAME}/../setup.sh"' 2>&1
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"Setup complete"* ]]
}

@test "main creates .env.hermes file" {
  local bin_dir="$TEST_DIR/bin"
  mkdir -p "$bin_dir"
  printf '#!/bin/sh\necho "1.0.0"\n' > "$bin_dir/claude"
  chmod +x "$bin_dir/claude"
  printf '#!/bin/sh\nexit 0\n' > "$bin_dir/curl"
  chmod +x "$bin_dir/curl"

  run bash -c '
    export PATH="'"$bin_dir"':$PATH"
    cd '"$TEST_DIR"'
    bash '"${BATS_TEST_DIRNAME}/../setup.sh"' 2>&1
    [ -f .env.hermes ] && echo "env file created"
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"env file created"* ]]
}

@test "main exits 1 when claude CLI is missing" {
  # claude is not installed in this environment.
  run bash -c '
    bash '"${BATS_TEST_DIRNAME}/../setup.sh"' 2>&1
  '
  [ "$status" -eq 1 ]
  [[ "$output" == *"Claude Code CLI not found"* ]]
}

@test "main respects custom HERMES_API_BASE_URL in .env.hermes" {
  local bin_dir="$TEST_DIR/bin"
  mkdir -p "$bin_dir"
  printf '#!/bin/sh\necho "1.0.0"\n' > "$bin_dir/claude"
  chmod +x "$bin_dir/claude"
  printf '#!/bin/sh\nexit 0\n' > "$bin_dir/curl"
  chmod +x "$bin_dir/curl"

  run bash -c '
    export PATH="'"$bin_dir"':$PATH"
    export HERMES_API_BASE_URL="https://custom-endpoint/v1"
    cd '"$TEST_DIR"'
    bash '"${BATS_TEST_DIRNAME}/../setup.sh"' >/dev/null 2>&1
    grep "ANTHROPIC_BASE_URL" .env.hermes
  '
  [ "$status" -eq 0 ]
  [ "$output" = "ANTHROPIC_BASE_URL=https://custom-endpoint/v1" ]
}

@test "main respects custom HERMES_MODEL in .env.hermes" {
  local bin_dir="$TEST_DIR/bin"
  mkdir -p "$bin_dir"
  printf '#!/bin/sh\necho "1.0.0"\n' > "$bin_dir/claude"
  chmod +x "$bin_dir/claude"
  printf '#!/bin/sh\nexit 0\n' > "$bin_dir/curl"
  chmod +x "$bin_dir/curl"

  run bash -c '
    export PATH="'"$bin_dir"':$PATH"
    export HERMES_MODEL="my-overridden-model"
    cd '"$TEST_DIR"'
    bash '"${BATS_TEST_DIRNAME}/../setup.sh"' >/dev/null 2>&1
    grep "HERMES_MODEL" .env.hermes
  '
  [ "$status" -eq 0 ]
  [ "$output" = "HERMES_MODEL=my-overridden-model" ]
}

@test "main prints startup banner with model and API info" {
  local bin_dir="$TEST_DIR/bin"
  mkdir -p "$bin_dir"
  printf '#!/bin/sh\necho "1.0.0"\n' > "$bin_dir/claude"
  chmod +x "$bin_dir/claude"
  printf '#!/bin/sh\nexit 0\n' > "$bin_dir/curl"
  chmod +x "$bin_dir/curl"

  run bash -c '
    export PATH="'"$bin_dir"':$PATH"
    cd '"$TEST_DIR"'
    bash '"${BATS_TEST_DIRNAME}/../setup.sh"' 2>&1
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"Claude Code"* ]]
  [[ "$output" == *"Hermes Setup"* ]]
  [[ "$output" == *"Model"* ]]
  [[ "$output" == *"API"* ]]
}
