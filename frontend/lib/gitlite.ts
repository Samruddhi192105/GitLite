import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

function listFilesRelative(directory: string, baseDirectory = directory): string[] {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listFilesRelative(fullPath, baseDirectory);
    }
    if (!entry.isFile()) return [];
    return [path.relative(baseDirectory, fullPath).split(path.sep).join("/")];
  });
}

export interface GitCommit {
  id: string;
  shortId: string;
  message: string;
  timestamp: string;
  parent: string;
  branch: string;
  author: {
    name: string;
    username: string;
    avatarUrl: string;
  };
  files: string[];
}

export interface GitStatus {
  initialized: boolean;
  currentBranch: string;
  headCommitId: string;
  stagedFiles: string[];
  workingFiles: string[];
  unstagedFiles: string[];
  branches: string[];
  totalCommits: number;
}

export interface RepoItem {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  lastCommitMessage?: string;
  lastCommitAge?: string;
}

export interface FileDetails {
  name: string;
  path: string;
  size: number;
  lineCount: number;
  content: string;
  lines: string[];
  isBinary: boolean;
  lastModified?: string;
}

function formatCommitAge(timestamp: string): string {
  const committedAt = Date.parse(timestamp);
  if (!Number.isFinite(committedAt)) return "Unknown time";

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - committedAt) / 1000));
  if (elapsedSeconds < 60) return "just now";
  if (elapsedSeconds < 3600) {
    const minutes = Math.floor(elapsedSeconds / 60);
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  if (elapsedSeconds < 86400) {
    const hours = Math.floor(elapsedSeconds / 3600);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  if (elapsedSeconds < 2_592_000) {
    const days = Math.floor(elapsedSeconds / 86400);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  if (elapsedSeconds < 31_536_000) {
    const months = Math.floor(elapsedSeconds / 2_592_000);
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }
  const years = Math.floor(elapsedSeconds / 31_536_000);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function latestCommitForPath(
  repositoryRoot: string,
  commitsById: Map<string, GitCommit>,
  startingCommitId: string,
  itemPath: string,
  isDirectory: boolean
): GitCommit | undefined {
  const matchesItem = (file: string) =>
    isDirectory ? file.startsWith(`${itemPath}/`) : file === itemPath;
  let current = commitsById.get(startingCommitId);

  while (current) {
    const parent = current.parent ? commitsById.get(current.parent) : undefined;
    const currentFiles = current.files.filter(matchesItem);
    const parentFiles = new Set((parent?.files || []).filter(matchesItem));
    const changed = currentFiles.length !== parentFiles.size ||
      currentFiles.some((file) => {
        if (!parentFiles.has(file)) return true;
        if (!parent) return true;
        const currentFile = path.join(
          getGitLiteDir(repositoryRoot),
          "commits",
          current!.id,
          "snapshot",
          file
        );
        const parentFile = path.join(
          getGitLiteDir(repositoryRoot),
          "commits",
          parent.id,
          "snapshot",
          file
        );
        return !fs.readFileSync(currentFile).equals(fs.readFileSync(parentFile));
      });

    if (changed) return current;
    current = parent;
  }

  return undefined;
}

export function hasSymlinkInPath(baseDirectory: string, targetPath: string): boolean {
  const relativePath = path.relative(path.resolve(baseDirectory), path.resolve(targetPath));
  if (relativePath === ".." || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) return true;

  let currentPath = path.resolve(baseDirectory);
  for (const segment of relativePath.split(path.sep).filter(Boolean)) {
    currentPath = path.join(currentPath, segment);
    if (fs.existsSync(currentPath) && fs.lstatSync(currentPath).isSymbolicLink()) {
      return true;
    }
  }
  return false;
}

export function getRootDir(): string {
  // If running inside 'frontend', parent directory is root GitLite
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, ".gitlite"))) {
    return cwd;
  }
  const parent = path.resolve(cwd, "..");
  if (fs.existsSync(path.join(parent, ".gitlite")) || fs.existsSync(path.join(parent, "src"))) {
    return parent;
  }
  return cwd;
}

export function getGitLiteDir(repositoryRoot: string = getRootDir()): string {
  return path.join(repositoryRoot, ".gitlite");
}

export function getWorkingDir(repositoryRoot: string = getRootDir()): string {
  const dir = path.join(repositoryRoot, "working");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export async function runGitLiteCommand(
  args: string[],
  repositoryRoot: string = getRootDir()
): Promise<{ stdout: string; stderr: string; success: boolean }> {
  const root = path.resolve(repositoryRoot);
  const classPath = process.env.GITLITE_CLASSES_DIR
    ? path.resolve(process.env.GITLITE_CLASSES_DIR)
    : path.join(getRootDir(), "frontend", ".gitlite-classes");

  try {
    const { stdout, stderr } = await execFileAsync(
      "java",
      ["-cp", classPath, "Main", ...args],
      { cwd: root, windowsHide: true, maxBuffer: 1024 * 1024 }
    );
    return { stdout, stderr, success: true };
  } catch (error: unknown) {
    const executionError = error as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
    };
    return {
      stdout: executionError.stdout || "",
      stderr: executionError.stderr || executionError.message || "Execution error",
      success: false,
    };
  }
}

export async function getGitStatus(repositoryRoot: string = getRootDir()): Promise<GitStatus> {
  const gitDir = getGitLiteDir(repositoryRoot);
  const initialized = fs.existsSync(gitDir);

  if (!initialized) {
    return {
      initialized: false,
      currentBranch: "main",
      headCommitId: "",
      stagedFiles: [],
      workingFiles: [],
      unstagedFiles: [],
      branches: ["main"],
      totalCommits: 0,
    };
  }

  // Read HEAD
  let currentBranch = "main";
  const headFile = path.join(gitDir, "HEAD");
  if (fs.existsSync(headFile)) {
    currentBranch = fs.readFileSync(headFile, "utf-8").trim() || "main";
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(currentBranch)) {
    throw new Error("Repository HEAD contains an invalid branch name.");
  }

  // Read current branch commit ID
  let headCommitId = "";
  const branchCommitFile = path.join(gitDir, "branches", `${currentBranch}.txt`);
  if (fs.existsSync(branchCommitFile)) {
    headCommitId = fs.readFileSync(branchCommitFile, "utf-8").trim();
  }
  if (headCommitId && !/^[a-f0-9]{64}$/i.test(headCommitId)) {
    throw new Error("Repository branch points to an invalid commit ID.");
  }

  // Staged files
  const stagingDir = path.join(gitDir, "staging");
  let stagedFiles: string[] = [];
  if (fs.existsSync(stagingDir)) {
    stagedFiles = listFilesRelative(stagingDir).map((file) => {
      if (file.startsWith("deleted/")) return `deleted: ${file.slice("deleted/".length)}`;
      return file.startsWith("working/") ? file.slice("working/".length) : file;
    });
  }

  // Working files
  const workingDir = getWorkingDir(repositoryRoot);
  const workingFiles = listFilesRelative(workingDir);
  const currentSnapshot = headCommitId
    ? path.join(gitDir, "commits", headCommitId, "snapshot", "working")
    : "";
  const unstagedFiles = workingFiles.filter((file) => {
    const workingFile = path.join(workingDir, file);
    const stagedFile = path.join(stagingDir, "working", file);
    const baseFile = currentSnapshot ? path.join(currentSnapshot, file) : "";
    const comparisonFile = fs.existsSync(stagedFile) ? stagedFile : baseFile;
    if (!comparisonFile || !fs.existsSync(comparisonFile)) return true;
    if (fs.statSync(workingFile).size !== fs.statSync(comparisonFile).size) return true;
    return !fs.readFileSync(workingFile).equals(fs.readFileSync(comparisonFile));
  });

  // Branches
  const branchesDir = path.join(gitDir, "branches");
  let branches: string[] = ["main"];
  if (fs.existsSync(branchesDir)) {
    branches = fs
      .readdirSync(branchesDir)
      .filter(f => f.endsWith(".txt"))
      .map(f => f.replace(/\.txt$/, ""));
  }
  if (!branches.includes(currentBranch)) {
    branches.push(currentBranch);
  }

  // Count total commits
  const commitsDir = path.join(gitDir, "commits");
  let totalCommits = 0;
  if (fs.existsSync(commitsDir)) {
    totalCommits = fs.readdirSync(commitsDir).filter(f => !f.startsWith(".")).length;
  }

  return {
    initialized,
    currentBranch,
    headCommitId,
    stagedFiles,
    workingFiles,
    unstagedFiles,
    branches,
    totalCommits,
  };
}

export async function getAllCommits(repositoryRoot: string = getRootDir()): Promise<GitCommit[]> {
  const gitDir = getGitLiteDir(repositoryRoot);
  const commitsDir = path.join(gitDir, "commits");
  if (!fs.existsSync(commitsDir)) {
    return [];
  }

  const entries = fs.readdirSync(commitsDir, { withFileTypes: true });
  const commits: GitCommit[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const commitId = entry.name;
    const commitFolder = path.join(commitsDir, commitId);
    const metaFile = path.join(commitFolder, "metadata.txt");
    const snapshotDir = path.join(commitFolder, "snapshot");

    let message = "Commit " + commitId.substring(0, 7);
    let timestamp = new Date().toISOString();
    let parent = "";
    let branch = "main";
    let authorName = "GitLite User";
    let authorEmail = "";

    if (fs.existsSync(metaFile)) {
      const content = fs.readFileSync(metaFile, "utf-8");
      const lines = content.split("\n");
      for (const line of lines) {
        if (line.startsWith("Message :")) {
          message = line.replace("Message :", "").trim();
        } else if (line.startsWith("Timestamp :")) {
          timestamp = line.replace("Timestamp :", "").trim();
        } else if (line.startsWith("Parent :")) {
          parent = line.replace("Parent :", "").trim();
        } else if (line.startsWith("Branch :")) {
          branch = line.replace("Branch :", "").trim();
        } else if (line.startsWith("Author Name :")) {
          authorName = line.replace("Author Name :", "").trim();
        } else if (line.startsWith("Author Email :")) {
          authorEmail = line.replace("Author Email :", "").trim();
        }
      }
    }

    let files: string[] = [];
    if (fs.existsSync(snapshotDir)) {
      files = listFilesRelative(snapshotDir);
    }

    commits.push({
      id: commitId,
      shortId: commitId.substring(0, 7),
      message,
      timestamp,
      parent,
      branch,
      author: {
        name: authorName,
        username: authorEmail || authorName,
        avatarUrl: "",
      },
      files,
    });
  }

  // Sort descending by timestamp or directory mtime
  commits.sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return commits;
}

export async function getDirectoryTree(
  subPath: string = "",
  mode: "project" | "snapshot" = "project",
  commitId?: string,
  repositoryRoot: string = getRootDir()
): Promise<RepoItem[]> {
  const root = path.resolve(repositoryRoot);
  let baseDir = root;

  if (mode === "snapshot" && commitId) {
    if (!/^[a-f0-9]{64}$/i.test(commitId)) return [];
    baseDir = path.resolve(getGitLiteDir(root), "commits", commitId, "snapshot");
  }
  const targetDir = path.resolve(baseDir, subPath);
  if (targetDir !== baseDir && !targetDir.startsWith(`${baseDir}${path.sep}`)) return [];

  if (!fs.existsSync(targetDir)) {
    return [];
  }

  const stat = fs.statSync(targetDir);
  if (!stat.isDirectory()) {
    return [];
  }

  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  const items: RepoItem[] = [];
  const commits = await getAllCommits(root);
  const commitsById = new Map(commits.map((commit) => [commit.id, commit]));
  let startingCommitId = commitId || "";
  if (mode === "project") {
    const headFile = path.join(getGitLiteDir(root), "HEAD");
    const branch = fs.existsSync(headFile) ? fs.readFileSync(headFile, "utf-8").trim() : "";
    const branchCommitFile = branch
      ? path.join(getGitLiteDir(root), "branches", `${branch}.txt`)
      : "";
    startingCommitId = branchCommitFile && fs.existsSync(branchCommitFile)
      ? fs.readFileSync(branchCommitFile, "utf-8").trim()
      : "";
  }

  // Exclude node_modules, .git, .next, etc. from top-level clutter
  const hiddenFolders = [".git", "node_modules", ".next", ".gitlite", "out", "frontend"];

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    if (subPath === "" && mode === "project" && hiddenFolders.includes(entry.name)) {
      continue;
    }
    const fullPath = path.join(targetDir, entry.name);
    const relPath = subPath ? `${subPath}/${entry.name}` : entry.name;
    const isDir = entry.isDirectory();

    let size = 0;
    if (!isDir) {
      try {
        size = fs.statSync(fullPath).size;
      } catch {}
    }

    const lastCommit = latestCommitForPath(
      root,
      commitsById,
      startingCommitId,
      relPath,
      isDir
    );

    items.push({
      name: entry.name,
      path: relPath,
      type: isDir ? "directory" : "file",
      size,
      lastCommitMessage: lastCommit?.message || "Not committed",
      lastCommitAge: lastCommit ? formatCommitAge(lastCommit.timestamp) : "Not committed",
    });
  }

  // Sort directories first, then files
  items.sort((a, b) => {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name);
    }
    return a.type === "directory" ? -1 : 1;
  });

  return items;
}

export function getFileDetails(
  filePath: string,
  mode: "project" | "snapshot" = "project",
  commitId?: string,
  repositoryRoot: string = getRootDir()
): FileDetails | null {
  const root = path.resolve(repositoryRoot);
  let baseDir = root;

  if (mode === "snapshot" && commitId) {
    if (!/^[a-f0-9]{64}$/i.test(commitId)) return null;
    baseDir = path.resolve(getGitLiteDir(root), "commits", commitId, "snapshot");
  }
  const fullPath = path.resolve(baseDir, filePath);

  if (fullPath === baseDir || !fullPath.startsWith(`${baseDir}${path.sep}`)) {
    return null;
  }

  if (!fs.existsSync(fullPath) || hasSymlinkInPath(baseDir, fullPath) || fs.statSync(fullPath).isDirectory()) {
    return null;
  }

  const bytes = fs.readFileSync(fullPath);
  let content = "";
  let isBinary = bytes.includes(0) || bytes.some((byte) =>
    (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d) || byte === 0x7f
  );
  if (!isBinary) {
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      isBinary = true;
    }
  }
  const stat = fs.statSync(fullPath);
  const lines = isBinary ? [] : content.split("\n");

  return {
    name: path.basename(fullPath),
    path: filePath,
    size: stat.size,
    lineCount: lines.length,
    content,
    lines,
    isBinary,
    lastModified: stat.mtime.toISOString(),
  };
}
