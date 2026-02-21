import { spawn } from "child_process";
import { createInterface } from "readline";
import { LLMProvider, StreamParams, Message } from "./types";

function formatMessages(messages: Message[]): string {
  if (messages.length === 1) return messages[0].content;

  return messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");
}

export class ClaudeCodeProvider implements LLMProvider {
  private model: string;

  constructor(model = "sonnet") {
    this.model = model;
  }

  async *stream(params: StreamParams): AsyncIterable<string> {
    const args = [
      "-p",
      "--verbose",
      "--output-format", "stream-json",
      "--include-partial-messages",
      "--system-prompt", params.system,
      "--model", this.model,
      "--tools", "",
      "--no-session-persistence",
    ];

    const child = spawn("claude", args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, CLAUDECODE: undefined },
    });

    child.stdin.write(formatMessages(params.messages));
    child.stdin.end();

    const rl = createInterface({ input: child.stdout });

    let error = "";
    child.stderr.on("data", (chunk: Buffer) => {
      error += chunk.toString();
    });

    try {
      for await (const line of rl) {
        if (!line.trim()) continue;

        let msg: { type: string; event?: { type: string; delta?: { type: string; text?: string } } };
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }

        if (
          msg.type === "stream_event" &&
          msg.event?.type === "content_block_delta" &&
          msg.event.delta?.type === "text_delta" &&
          msg.event.delta.text
        ) {
          yield msg.event.delta.text;
        }
      }
    } finally {
      rl.close();
    }

    const exitCode = await new Promise<number | null>((resolve) => {
      if (child.exitCode !== null) return resolve(child.exitCode);
      child.on("close", resolve);
    });

    if (exitCode !== 0) {
      throw new Error(`claude-code exited with code ${exitCode}: ${error.trim()}`);
    }
  }
}
