import { NextRequest, NextResponse } from "next/server";
import { runGitLiteCommand, getWorkingDir, getGitStatus, hasSymlinkInPath } from "@/lib/gitlite";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getAuthSession } from "@/lib/auth";
import { authorizeRepository } from "@/lib/repository-access";

async function commandResponse(
  args: string[],
  root: string,
  author: { name: string; email: string }
) {
  const commandArgs = args[0] === "commit"
    ? [...args, "--author-name", author.name, "--author-email", author.email]
    : args;
  const result = await runGitLiteCommand(commandArgs, root);
  const status = await getGitStatus(root);
  return NextResponse.json(
    { ...result, status },
    { status: result.success ? 200 : 400 }
  );
}

function resolveWorkingFile(root: string, requestedPath: unknown): string {
  if (typeof requestedPath !== "string" || !requestedPath.trim()) {
    throw new Error("A working file path is required.");
  }
  const normalizedPath = requestedPath.replace(/\\/g, "/");
  const segments = normalizedPath.split("/");
  if (segments[0] === "working") segments.shift();
  if (segments.length === 0 || segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("File paths must remain inside working/.");
  }

  const workingDir = getWorkingDir(root);
  if (fs.lstatSync(workingDir).isSymbolicLink()) {
    throw new Error("The working directory cannot be a symbolic link.");
  }
  const target = path.resolve(workingDir, ...segments);
  if (target === workingDir || !target.startsWith(`${workingDir}${path.sep}`)) {
    throw new Error("File paths must remain inside working/.");
  }
  if (hasSymlinkInPath(workingDir, target)) {
    throw new Error("File paths cannot pass through symbolic links.");
  }
  return target;
}

export async function POST(request: NextRequest) {
  const session = getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
    }
    const { action } = body;

    if (typeof body.repoId !== "string") {
      return NextResponse.json({ error: "Repository ID is required." }, { status: 400 });
    }
    const context = await authorizeRepository(session, body.repoId);
    if (!context) {
      return NextResponse.json({ error: "Repository not found." }, { status: 404 });
    }

    if (typeof action !== "string" || !action) {
      return NextResponse.json({ error: "Action is required." }, { status: 400 });
    }

    if (action === "init") {
      return commandResponse(["init"], context.root, session);
    }

    if (action === "stage") {
      const { file } = body;
      if (typeof file !== "string" || !file) {
        return NextResponse.json({ error: "Filename is required." }, { status: 400 });
      }

      // Check if file is in working directory or root
      const requestedPath = path.resolve(context.root, file);
      const workingPath = path.join(getWorkingDir(context.root), file);
      const rootPath = path.resolve(context.root);
      if (requestedPath !== rootPath && !requestedPath.startsWith(`${rootPath}${path.sep}`)) {
        return NextResponse.json({ error: "File path is outside the repository." }, { status: 400 });
      }
      let targetPath = file;
      if (fs.existsSync(workingPath)) {
        targetPath = `working/${file}`;
      }

      return commandResponse(["add", targetPath], context.root, session);
    }

    if (action === "commit") {
      const { message } = body;
      if (typeof message !== "string" || !message.trim()) {
        return NextResponse.json({ error: "Commit message is required." }, { status: 400 });
      }

      return commandResponse(["commit", message.trim()], context.root, session);
    }

    if (action === "branch") {
      const { branchName } = body;
      if (typeof branchName !== "string" || !branchName.trim()) {
        return NextResponse.json({ error: "Branch name is required." }, { status: 400 });
      }

      return commandResponse(["branch", branchName.trim()], context.root, session);
    }

    if (action === "switch") {
      const { branchName } = body;
      if (typeof branchName !== "string" || !branchName.trim()) {
        return NextResponse.json({ error: "Branch name is required." }, { status: 400 });
      }

      return commandResponse(["switch", branchName.trim()], context.root, session);
    }

    if (action === "checkout") {
      const { commitId } = body;
      if (typeof commitId !== "string" || !commitId.trim()) {
        return NextResponse.json({ error: "Commit ID is required." }, { status: 400 });
      }

      return commandResponse(["checkout", commitId.trim()], context.root, session);
    }

    if (action === "createFile") {
      const { filename, content } = body;
      if (typeof filename !== "string" || !filename.trim()) {
        return NextResponse.json({ error: "Filename is required." }, { status: 400 });
      }
      if (content !== undefined && typeof content !== "string") {
        return NextResponse.json({ error: "File content must be text." }, { status: 400 });
      }

      const workingDir = getWorkingDir(context.root);
      if (fs.lstatSync(workingDir).isSymbolicLink()) {
        return NextResponse.json({ error: "The working directory cannot be a symbolic link." }, { status: 400 });
      }
      const filePath = path.join(workingDir, filename);
      const resolvedFilePath = path.resolve(filePath);
      if (!resolvedFilePath.startsWith(`${path.resolve(workingDir)}${path.sep}`)) {
        return NextResponse.json({ error: "File path must remain inside working/." }, { status: 400 });
      }
      if (hasSymlinkInPath(workingDir, resolvedFilePath)) {
        return NextResponse.json({ error: "File path cannot pass through a symbolic link." }, { status: 400 });
      }
      fs.mkdirSync(path.dirname(resolvedFilePath), { recursive: true });
      try {
        fs.writeFileSync(resolvedFilePath, typeof content === "string" ? content : "", {
          encoding: "utf-8",
          flag: "wx",
        });
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "EEXIST") {
          return NextResponse.json({ error: "A file with that name already exists." }, { status: 409 });
        }
        throw error;
      }

      const status = await getGitStatus(context.root);
      return NextResponse.json({
        success: true,
        stdout: `Created working/${filename} successfully`,
        status,
      });
    }

    if (action === "editFile") {
      if (typeof body.content !== "string" || Buffer.byteLength(body.content, "utf8") > 1024 * 1024) {
        return NextResponse.json({ error: "File content must be text under 1 MB." }, { status: 400 });
      }
      const target = resolveWorkingFile(context.root, body.filePath);
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
        return NextResponse.json({ error: "Working file not found." }, { status: 404 });
      }
      const temporaryPath = `${target}.${randomUUID()}.tmp`;
      try {
        fs.writeFileSync(temporaryPath, body.content, { encoding: "utf-8", flag: "wx" });
        fs.renameSync(temporaryPath, target);
      } catch (error) {
        if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
        throw error;
      }
      const status = await getGitStatus(context.root);
      return NextResponse.json({ success: true, status });
    }

    if (action === "deleteFile" || action === "renameFile") {
      const sourcePath = resolveWorkingFile(context.root, body.filePath);
      if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
        return NextResponse.json({ error: "Working file not found." }, { status: 404 });
      }

      const command = action === "deleteFile"
        ? ["remove", `working/${path.relative(getWorkingDir(context.root), sourcePath)}`]
        : (() => {
            const destination = resolveWorkingFile(context.root, body.newPath);
            if (fs.existsSync(destination)) {
              throw new Error("A file already exists at the new path.");
            }
            return [
              "move",
              `working/${path.relative(getWorkingDir(context.root), sourcePath)}`,
              `working/${path.relative(getWorkingDir(context.root), destination)}`,
            ];
          })();
      const result = await runGitLiteCommand(command, context.root);
      if (!result.success) {
        return NextResponse.json({ error: result.stderr || "File operation failed." }, { status: 400 });
      }
      const status = await getGitStatus(context.root);
      return NextResponse.json({ success: true, status });
    }

    if (action === "exec") {
      const { command } = body;
      if (typeof command !== "string" || !command.trim()) {
        return NextResponse.json({ error: "Command string is required." }, { status: 400 });
      }

      // Parse command string e.g. "gitlite add working/notes.txt" or "gitlite commit 'Initial'"
      let cmd = command.trim();
      if (cmd.startsWith("gitlite ")) {
        cmd = cmd.slice(8).trim();
      } else if (cmd.startsWith("java -cp out Main ")) {
        cmd = cmd.slice(18).trim();
      }

      // Split args safely respecting quotes
      const matchArgs = cmd.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
      const cleanArgs = matchArgs.map((arg: string) => {
        if ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))) {
          return arg.slice(1, -1);
        }
        return arg;
      });

      if (cleanArgs.length === 0) {
        return NextResponse.json({ success: true, stdout: "", stderr: "" });
      }

      const commandArgs = cleanArgs[0] === "commit"
        ? ["commit", cleanArgs.slice(1).join(" ")]
        : cleanArgs;
      return commandResponse(commandArgs, context.root, session);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    console.error("GitLite action failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Action failed." },
      { status: 500 }
    );
  }
}
