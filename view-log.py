#!/usr/bin/env python3
import json
import signal
import sys
from datetime import datetime
from textwrap import indent

signal.signal(signal.SIGPIPE, signal.SIG_DFL)

COLOURS = {
    "reset": "\033[0m",
    "bold": "\033[1m",
    "dim": "\033[2m",
    "cyan": "\033[36m",
    "green": "\033[32m",
    "yellow": "\033[33m",
    "magenta": "\033[35m",
    "blue": "\033[34m",
    "white": "\033[37m",
    "grey": "\033[90m",
    "red": "\033[31m",
}

PROVIDER_COLOURS = {
    "anthropic": "magenta",
    "groq": "cyan",
    "openai": "green",
}

ROLE_COLOURS = {
    "system": "yellow",
    "user": "blue",
    "assistant": "green",
}


def c(colour, text):
    return f"{COLOURS[colour]}{text}{COLOURS['reset']}"


def fmt_time(ms):
    return datetime.fromtimestamp(ms / 1000).strftime("%H:%M:%S")


def truncate(text, max_len=300):
    text = text.strip()
    if len(text) <= max_len:
        return text
    return text[:max_len] + c("dim", f" ... ({len(text)} chars total)")


def print_separator():
    print(c("dim", "─" * 80))


def print_request(entry, verbose):
    provider = entry.get("provider", "?")
    provider_colour = PROVIDER_COLOURS.get(provider, "white")
    time_str = fmt_time(entry["time"])

    print()
    print_separator()
    print(
        f"{c('bold', '▶ REQUEST')}  "
        f"{c(provider_colour, provider)}  "
        f"{c('dim', time_str)}"
    )
    print_separator()

    system = entry.get("system", "")
    if system:
        label = c("yellow", "SYSTEM")
        if verbose:
            print(f"\n  {label}")
            print(indent(system.strip(), "  "))
        else:
            first_line = system.strip().split("\n")[0]
            print(f"\n  {label}  {c('dim', truncate(first_line, 120))}")

    for msg in entry.get("messages", []):
        role = msg.get("role", "?")
        content = msg.get("content", "")
        role_colour = ROLE_COLOURS.get(role, "white")
        label = c(role_colour, role.upper())

        if isinstance(content, list):
            parts = []
            for block in content:
                if isinstance(block, dict):
                    parts.append(block.get("text", json.dumps(block)[:200]))
                else:
                    parts.append(str(block))
            content = "\n".join(parts)

        if verbose:
            print(f"\n  {label}")
            print(indent(content.strip(), "  "))
        else:
            print(f"\n  {label}")
            print(indent(truncate(content, 500), "  "))


def print_response(entry, verbose):
    provider = entry.get("provider", "?")
    provider_colour = PROVIDER_COLOURS.get(provider, "white")
    time_str = fmt_time(entry["time"])
    chars = entry.get("chars", "?")

    print(
        f"\n  {c('green', '◀ RESPONSE')}  "
        f"{c(provider_colour, provider)}  "
        f"{c('dim', f'{time_str}  {chars} chars')}"
    )

    response = entry.get("response", "")
    if verbose:
        print(indent(response.strip(), "  "))
    else:
        print(indent(truncate(response, 500), "  "))


def main():
    verbose = "--verbose" in sys.argv or "-v" in sys.argv
    positional = [a for a in sys.argv[1:] if not a.startswith("-")]
    log_path = positional[0] if positional else ".logs/prompts.log"

    try:
        with open(log_path) as f:
            lines = f.readlines()
    except FileNotFoundError:
        print(f"File not found: {log_path}")
        sys.exit(1)

    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue

        msg_type = entry.get("msg")
        if msg_type == "request":
            print_request(entry, verbose)
        elif msg_type == "response":
            print_response(entry, verbose)

    print()
    print_separator()
    print(c("dim", f"  {len(lines)} log entries"))
    print()


if __name__ == "__main__":
    main()
