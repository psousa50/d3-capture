import { Octokit } from "@octokit/rest";
import { logger } from "../../logger";

const log = logger.child({ module: "github-client" });

let octokit: Octokit | null = null;

export function getOctokit(): Octokit {
  if (!octokit) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN is required for GitHub storage backend");
    octokit = new Octokit({ auth: token });
  }
  return octokit;
}

export function repoConfig() {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (!owner || !repo) throw new Error("GITHUB_OWNER and GITHUB_REPO are required");
  return { owner, repo, branch: process.env.GITHUB_BRANCH ?? "main" };
}

function resolvePath(path: string): string {
  const root = process.env.GITHUB_ROOT;
  if (!root) return path;
  return `${root.replace(/\/+$/, "")}/${path}`;
}

const shaCache = new Map<string, string>();

export interface FileResult<T> {
  data: T;
  sha: string;
}

export async function readFile<T>(path: string): Promise<FileResult<T> | undefined> {
  const fullPath = resolvePath(path);
  try {
    const { owner, repo, branch } = repoConfig();
    const res = await getOctokit().repos.getContent({ owner, repo, path: fullPath, ref: branch });
    const file = res.data as { content: string; sha: string };
    const decoded = Buffer.from(file.content, "base64").toString("utf-8");
    shaCache.set(fullPath, file.sha);
    return { data: JSON.parse(decoded) as T, sha: file.sha };
  } catch (err: any) {
    if (err.status === 404) return undefined;
    throw err;
  }
}

export async function readRawFile(path: string): Promise<FileResult<string> | undefined> {
  const fullPath = resolvePath(path);
  try {
    const { owner, repo, branch } = repoConfig();
    const res = await getOctokit().repos.getContent({ owner, repo, path: fullPath, ref: branch });
    const file = res.data as { content: string; sha: string };
    const decoded = Buffer.from(file.content, "base64").toString("utf-8");
    shaCache.set(fullPath, file.sha);
    return { data: decoded, sha: file.sha };
  } catch (err: any) {
    if (err.status === 404) return undefined;
    throw err;
  }
}

async function writeFileOnce(
  fullPath: string,
  content: string,
  message: string,
  sha?: string,
): Promise<string> {
  const { owner, repo, branch } = repoConfig();
  const fileSha = sha ?? shaCache.get(fullPath);
  const res = await getOctokit().repos.createOrUpdateFileContents({
    owner,
    repo,
    path: fullPath,
    message,
    content: Buffer.from(content).toString("base64"),
    branch,
    ...(fileSha ? { sha: fileSha } : {}),
  });
  const newSha = (res.data.content as { sha: string }).sha;
  shaCache.set(fullPath, newSha);
  return newSha;
}

export async function writeFile(
  path: string,
  content: string,
  message: string,
  sha?: string,
): Promise<string> {
  const fullPath = resolvePath(path);
  try {
    return await writeFileOnce(fullPath, content, message, sha);
  } catch (err: any) {
    if (err.status === 409) {
      log.warn({ path: fullPath }, "SHA conflict, retrying");
      shaCache.delete(fullPath);
      const current = await readRawFile(path);
      return await writeFileOnce(fullPath, content, message, current?.sha);
    }
    throw err;
  }
}

export async function deleteFile(path: string, sha: string, message: string): Promise<void> {
  const fullPath = resolvePath(path);
  try {
    const { owner, repo, branch } = repoConfig();
    await getOctokit().repos.deleteFile({ owner, repo, path: fullPath, message, sha, branch });
    shaCache.delete(fullPath);
  } catch (err: any) {
    if (err.status === 404) return;
    throw err;
  }
}

export interface DirectoryEntry {
  name: string;
  path: string;
  type: "file" | "dir";
  sha: string;
}

export async function listDirectory(path: string): Promise<DirectoryEntry[]> {
  const fullPath = resolvePath(path);
  try {
    const { owner, repo, branch } = repoConfig();
    const res = await getOctokit().repos.getContent({ owner, repo, path: fullPath, ref: branch });
    if (!Array.isArray(res.data)) return [];
    const root = process.env.GITHUB_ROOT?.replace(/\/+$/, "");
    return (res.data as Array<{ name: string; path: string; type: string; sha: string }>).map(
      (e) => ({
        name: e.name,
        path: root ? e.path.slice(root.length + 1) : e.path,
        type: e.type as "file" | "dir",
        sha: e.sha,
      }),
    );
  } catch (err: any) {
    if (err.status === 404) return [];
    throw err;
  }
}

export async function deleteDirectory(path: string): Promise<void> {
  const entries = await listDirectory(path);
  for (const entry of entries) {
    if (entry.type === "dir") {
      await deleteDirectory(entry.path);
    } else {
      await deleteFile(entry.path, entry.sha, `delete ${entry.path}`);
    }
  }
}
