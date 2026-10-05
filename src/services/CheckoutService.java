package services;

import constants.RepositoryConstants;
import storage.FileManager;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;

public class CheckoutService {

    private final FileManager fileManager =
            new FileManager();

    // Used when user runs: checkout <commit-id>
    public void checkout(String commitId) {
        checkoutByCommitId(commitId);
        String currentBranch = fileManager.readFile(
                Path.of(RepositoryConstants.REPOSITORY_FOLDER, RepositoryConstants.HEAD_FILE).toString()
        ).trim();
        fileManager.writeToFile(
                Path.of(RepositoryConstants.REPOSITORY_FOLDER, RepositoryConstants.BRANCHES_FOLDER,
                        currentBranch + ".txt").toString(),
                commitId
        );
        System.out.println("Checked out commit " + commitId + " on branch '" + currentBranch + "'.");
    }

    // Used internally by branch switching
    public void checkoutByCommitId(String commitId) {
        if (commitId == null || !commitId.matches("[a-fA-F0-9]{64}")) {
            throw new IllegalArgumentException("Commit ID must be a full SHA-256 hash.");
        }

        Path repositoryPath = Path.of(RepositoryConstants.REPOSITORY_FOLDER);
        Path commitFolder = repositoryPath.resolve(RepositoryConstants.COMMITS_FOLDER).resolve(commitId);
        Path snapshot = commitFolder.resolve("snapshot");
        if (!Files.isDirectory(snapshot)) {
            throw new IllegalArgumentException("Commit or snapshot not found: " + commitId);
        }

        ensureCleanWorkingTree(repositoryPath);
        restoreSnapshot(snapshot);
    }

    public void checkoutEmptyBranch() {
        Path repositoryPath = Path.of(RepositoryConstants.REPOSITORY_FOLDER);
        ensureCleanWorkingTree(repositoryPath);
        clearWorkingTree();
    }

    private void ensureCleanWorkingTree(Path repositoryPath) {
        Path staging = repositoryPath.resolve(RepositoryConstants.STAGING_FOLDER);
        try (var stagedPaths = Files.walk(staging)) {
            if (stagedPaths.anyMatch(Files::isRegularFile)) {
                throw new IllegalStateException("Cannot switch or check out with staged changes. Commit them first.");
            }
        } catch (IOException error) {
            throw new IllegalStateException("Could not inspect staged changes.", error);
        }

        String currentBranch = fileManager.readFile(
                repositoryPath.resolve(RepositoryConstants.HEAD_FILE).toString()
        ).trim();
        String currentCommit = fileManager.readFile(
                repositoryPath.resolve(RepositoryConstants.BRANCHES_FOLDER)
                        .resolve(currentBranch + ".txt").toString()
        ).trim();
        Path working = Path.of("working");
        Path currentSnapshot = currentCommit.isBlank()
                ? null
                : repositoryPath.resolve(RepositoryConstants.COMMITS_FOLDER)
                        .resolve(currentCommit).resolve("snapshot");
        Path currentWorkingSnapshot = currentSnapshot == null
                ? null
                : currentSnapshot.resolve("working");

        try {
            List<String> workingFiles = listRelativeFiles(working);
            List<String> trackedFiles = currentWorkingSnapshot == null
                    ? List.of()
                    : listRelativeFiles(currentWorkingSnapshot);
            if (!workingFiles.equals(trackedFiles)) {
                throw new IllegalStateException(
                        "Cannot switch or check out with uncommitted or untracked working files. Commit or remove them first."
                );
            }
            if (currentSnapshot != null) {
                for (String relativeFile : trackedFiles) {
                    if (Files.mismatch(working.resolve(relativeFile),
                            currentWorkingSnapshot.resolve(relativeFile)) != -1L) {
                        throw new IllegalStateException(
                                "Cannot switch or check out with uncommitted changes. Commit them first."
                        );
                    }
                }
            }
        } catch (IOException error) {
            throw new IllegalStateException("Could not verify the working tree.", error);
        }
    }

    private List<String> listRelativeFiles(Path directory) throws IOException {
        if (!Files.isDirectory(directory)) return List.of();
        try (var paths = Files.walk(directory)) {
            return paths
                    .filter(Files::isRegularFile)
                    .map(directory::relativize)
                    .map(Path::toString)
                    .sorted(Comparator.naturalOrder())
                    .toList();
        }
    }

    private void clearWorkingTree() {
        File working = new File("working");
        if (Files.isSymbolicLink(working.toPath())) {
            throw new IllegalStateException("The working directory cannot be a symbolic link.");
        }
        if (!working.exists() && !working.mkdirs()) {
            throw new IllegalStateException("Could not create working directory.");
        }
        fileManager.deleteAllFiles(working.getPath());
    }

    private void restoreSnapshot(Path snapshot) {
        clearWorkingTree();
        Path workingSnapshot = snapshot.resolve("working");
        if (Files.isDirectory(workingSnapshot)) {
            fileManager.copyDirectory(workingSnapshot.toFile(), new File("working"));
        }
    }
}