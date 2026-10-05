"use client";

import React, { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import RepoHeader, { ActiveTab } from "@/components/RepoHeader";
import BranchSelector from "@/components/BranchSelector";
import LatestCommitBar from "@/components/LatestCommitBar";
import FileTree from "@/components/FileTree";
import FileViewer from "@/components/FileViewer";
import SidebarAbout from "@/components/SidebarAbout";
import InteractiveTerminal from "@/components/InteractiveTerminal";
import StageCommitModal from "@/components/StageCommitModal";
import CommitsTimeline from "@/components/CommitsTimeline";
import Footer from "@/components/Footer";
import RemoteSetupModal from "@/components/RemoteSetupModal";
import { GitStatus, GitCommit, RepoItem, FileDetails } from "@/lib/gitlite";

export default function GitLiteDashboard({
  userName,
  repositoryId,
  repositoryName,
}: {
  userName: string;
  repositoryId: string;
  repositoryName: string;
}) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [activeTab, setActiveTab] = useState<ActiveTab>("code");
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [remoteSetupOpen, setRemoteSetupOpen] = useState(false);

  // GitLite Data
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [fileItems, setFileItems] = useState<RepoItem[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const [selectedFile, setSelectedFile] = useState<FileDetails | null>(null);
  const [viewMode, setViewMode] = useState<"project" | "snapshot">("project");
  const [snapshotCommitId, setSnapshotCommitId] = useState<string | undefined>(undefined);
  const [viewingCommitsHistory, setViewingCommitsHistory] = useState(false);
  const [actionError, setActionError] = useState("");

  // Theme toggle
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("light", next === "light");
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Fetch status
  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/gitlite/status?repoId=${encodeURIComponent(repositoryId)}`);
      if (!res.ok) throw new Error("Could not load repository status.");
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error("Error loading status:", err);
    }
  }, [repositoryId]);

  // Fetch commits
  const loadCommits = useCallback(async () => {
    try {
      const res = await fetch(`/api/gitlite/commits?repoId=${encodeURIComponent(repositoryId)}`);
      if (!res.ok) throw new Error("Could not load commit history.");
      const data = await res.json();
      setCommits(data);
    } catch (err) {
      console.error("Error loading commits:", err);
    }
  }, [repositoryId]);

  // Fetch files
  const loadFiles = useCallback(
    async (pathStr: string = currentPath, mode: "project" | "snapshot" = viewMode, commitId?: string) => {
      try {
        const queryParams = new URLSearchParams({
          path: pathStr,
          mode: mode,
          repoId: repositoryId,
        });
        if (commitId) {
          queryParams.append("commitId", commitId);
        }

        const res = await fetch(`/api/gitlite/files?${queryParams.toString()}`);
        if (!res.ok) throw new Error("Could not load repository files.");
        const data = await res.json();
        setFileItems(data.items || []);
      } catch (err) {
        console.error("Error loading files:", err);
      }
    },
    [currentPath, viewMode, repositoryId]
  );

  // Refresh everything
  const refreshAll = useCallback(async () => {
    await Promise.all([loadStatus(), loadCommits(), loadFiles()]);
  }, [loadStatus, loadCommits, loadFiles]);

  const runRepositoryAction = useCallback(async (body: Record<string, string>) => {
    setActionError("");
    try {
      const response = await fetch("/api/gitlite/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, repoId: repositoryId }),
      });
      const result = await response.json();
      if (!response.ok || result.success === false) {
        throw new Error(result.stderr || result.error || "Repository action failed.");
      }
      await refreshAll();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Repository action failed.");
    }
  }, [refreshAll, repositoryId]);

  useEffect(() => {
    Promise.all([loadStatus(), loadCommits(), loadFiles()]);
  }, [loadStatus, loadCommits, loadFiles]);

  // Open directory
  const handleOpenDirectory = (item: RepoItem) => {
    setSelectedFile(null);
    setCurrentPath(item.path);
    loadFiles(item.path, viewMode, snapshotCommitId);
  };

  // Open file
  const handleOpenFile = async (item: RepoItem) => {
    try {
      const queryParams = new URLSearchParams({
        path: item.path,
        mode: viewMode,
        isFile: "true",
        repoId: repositoryId,
      });
      if (snapshotCommitId) {
        queryParams.append("commitId", snapshotCommitId);
      }

      const res = await fetch(`/api/gitlite/files?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Could not open the selected file.");
      const data = await res.json();
      if (data.file) {
        setSelectedFile(data.file);
      }
    } catch (err) {
      console.error("Error loading file content:", err);
    }
  };

  const handleFileMutation = async (path?: string) => {
    await refreshAll();
    setSelectedFile(null);
    if (!path) return;
    try {
      const query = new URLSearchParams({
        path,
        mode: "project",
        isFile: "true",
        repoId: repositoryId,
      });
      const response = await fetch(`/api/gitlite/files?${query.toString()}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not reload the changed file.");
      if (result.file) setSelectedFile(result.file);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not reload the changed file.");
    }
  };

  // Navigate breadcrumbs
  const handleNavigateBreadcrumb = (index: number) => {
    setSelectedFile(null);
    if (index === -1) {
      setCurrentPath("");
      loadFiles("", viewMode, snapshotCommitId);
      return;
    }
    const parts = currentPath.split("/");
    const newPath = parts.slice(0, index + 1).join("/");
    setCurrentPath(newPath);
    loadFiles(newPath, viewMode, snapshotCommitId);
  };

  // Navigate up
  const handleNavigateUp = () => {
    setSelectedFile(null);
    const parts = currentPath.split("/");
    parts.pop();
    const newPath = parts.join("/");
    setCurrentPath(newPath);
    loadFiles(newPath, viewMode, snapshotCommitId);
  };

  // Select branch
  const handleSelectBranch = async (branchName: string) => {
    await runRepositoryAction({ action: "switch", branchName });
  };

  // Create branch
  const handleCreateBranch = async (newBranchName: string) => {
    await runRepositoryAction({ action: "branch", branchName: newBranchName });
  };

  // Checkout commit
  const handleCheckoutCommit = async (commitId: string) => {
    await runRepositoryAction({ action: "checkout", commitId });
  };

  // View snapshot
  const handleViewSnapshot = (commitId: string) => {
    setViewMode("snapshot");
    setSnapshotCommitId(commitId);
    setCurrentPath("");
    setSelectedFile(null);
    setViewingCommitsHistory(false);
    setActiveTab("code");
    loadFiles("", "snapshot", commitId);
  };

  const breadcrumbs = currentPath ? currentPath.split("/") : [];

  return (
    <div className={`min-h-screen bg-[#0d1117] text-[#e6edf3] font-sans antialiased ${theme === "light" ? "light" : ""}`}>
      {/* GitHub Authentic Header */}
      <Header
        onToggleTerminal={() => setTerminalOpen(!terminalOpen)}
        terminalOpen={terminalOpen}
        theme={theme}
        onToggleTheme={toggleTheme}
        userName={userName}
        repositoryName={repositoryName}
        onOpenRemoteSetup={() => setRemoteSetupOpen(true)}
      />

      {/* GitHub Repository Header */}
      <RepoHeader
        repositoryName={repositoryName}
        userName={userName}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab !== "code") {
            setViewingCommitsHistory(false);
          }
        }}
      />

      {/* Main Container */}
      <main className="max-w-[1520px] mx-auto px-4 py-6">
        {actionError && (
          <div role="alert" className="mb-5 flex items-start justify-between gap-4 rounded-lg border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-200">
            <span>{actionError}</span>
            <button onClick={() => setActionError("")} className="shrink-0 text-rose-200 hover:text-white" aria-label="Dismiss error">
              Dismiss
            </button>
          </div>
        )}
        {/* TAB 1: CODE */}
        {activeTab === "code" && (
          <>
            {viewingCommitsHistory ? (
              <CommitsTimeline
                commits={commits}
                onBack={() => setViewingCommitsHistory(false)}
                onCheckoutCommit={handleCheckoutCommit}
                onViewSnapshot={handleViewSnapshot}
              />
            ) : (
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Repository file explorer */}
                <div className="flex-1 min-w-0">
                  {/* Branch selector & Code button bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <BranchSelector
                      currentBranch={status?.currentBranch || "main"}
                      branches={status?.branches || ["main"]}
                      onSelectBranch={handleSelectBranch}
                      onCreateBranch={handleCreateBranch}
                      pathBreadcrumbs={breadcrumbs}
                      onNavigateBreadcrumb={handleNavigateBreadcrumb}
                      mode={viewMode}
                      onToggleMode={(m) => {
                        setViewMode(m);
                        setSnapshotCommitId(undefined);
                        setCurrentPath("");
                        setSelectedFile(null);
                        loadFiles("", m);
                      }}
                    />

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setStageModalOpen(true)}
                        className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400"
                      >
                        Stage &amp; Commit
                      </button>
                    </div>
                  </div>

                  {/* If viewing a single file, render FileViewer */}
                  {selectedFile ? (
                    <FileViewer
                      file={selectedFile}
                      onBack={() => setSelectedFile(null)}
                      repositoryId={repositoryId}
                      canEdit={viewMode === "project" && selectedFile.path.startsWith("working/")}
                      onMutation={handleFileMutation}
                    />
                  ) : (
                    <>
                      {/* Latest Commit Bar */}
                      <LatestCommitBar
                        latestCommit={commits[0] || null}
                        totalCommits={status?.totalCommits || commits.length}
                        onViewCommits={() => setViewingCommitsHistory(true)}
                      />

                      {/* File Tree Explorer Table */}
                      <FileTree
                        items={fileItems}
                        onOpenDirectory={handleOpenDirectory}
                        onOpenFile={handleOpenFile}
                        onNavigateUp={handleNavigateUp}
                        isSubdirectory={breadcrumbs.length > 0}
                      />

                    </>
                  )}
                </div>

                {/* Right Column: About Repository Sidebar */}
                <SidebarAbout
                  repositoryName={repositoryName}
                  currentBranch={status?.currentBranch || "main"}
                  totalCommits={status?.totalCommits || 0}
                  initialized={status?.initialized || false}
                />
              </div>
            )}
          </>
        )}

        {/* TAB 2: TERMINAL */}
        {activeTab === "terminal" && (
          <div className="my-4">
            <InteractiveTerminal
              repositoryId={repositoryId}
              isDocked={false}
              onCommandSuccess={refreshAll}
            />
          </div>
        )}
      </main>

      {/* Docked Collapsible Terminal at the bottom */}
      {terminalOpen && activeTab !== "terminal" && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-3 bg-black/50 backdrop-blur-sm">
          <div className="max-w-[1520px] mx-auto">
            <InteractiveTerminal
              repositoryId={repositoryId}
              isDocked={true}
              onClose={() => setTerminalOpen(false)}
              onCommandSuccess={refreshAll}
            />
          </div>
        </div>
      )}

      {/* Stage and Commit Modal */}
      {stageModalOpen && (
        <StageCommitModal
          repositoryId={repositoryId}
          status={status}
          onClose={() => setStageModalOpen(false)}
          onRefresh={refreshAll}
        />
      )}

      {remoteSetupOpen && (
        <RemoteSetupModal
          repositoryId={repositoryId}
          repositorySlug={repositoryName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-")}
          onClose={() => setRemoteSetupOpen(false)}
        />
      )}

      <Footer />
    </div>
  );
}
