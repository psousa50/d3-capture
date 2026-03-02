import pino from "pino";

export const logger = pino({
  level: "debug",
  transport: {
    targets: [
      { target: "pino/file", options: { destination: 1 }, level: process.env.LOG_LEVEL ?? "info" },
      { target: "pino/file", options: { destination: ".logs/app.log", mkdir: true }, level: "debug" },
    ],
  },
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

export const sttLogger = pino({
  level: "debug",
  transport: {
    targets: [
      { target: "pino/file", options: { destination: 1 }, level: stdoutLevel },
      { target: "pino/file", options: { destination: ".logs/stt.log", mkdir: true }, level: "debug" },
    ],
  },
});
