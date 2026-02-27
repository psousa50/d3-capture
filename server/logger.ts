import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
});

const stdoutLevel = process.env.LOG_LEVEL ?? "info";

export const promptLogger = pino({
  level: "debug",
  transport: {
    targets: [
      { target: "pino/file", options: { destination: 1 }, level: stdoutLevel },
      { target: "pino/file", options: { destination: ".logs/prompts.log", mkdir: true }, level: "debug" },
    ],
  },
});

export const voxtralLogger = pino({
  level: "debug",
  transport: {
    targets: [
      { target: "pino/file", options: { destination: 1 }, level: stdoutLevel },
      { target: "pino/file", options: { destination: ".logs/voxtral.log", mkdir: true }, level: "debug" },
    ],
  },
});
