package services;

import constants.RepositoryConstants;
import models.Commit;
import storage.FileManager;
import utils.DateUtil;
import utils.HashUtil;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.UUID;

public class CommitService {

    private final FileManager fileManager = new FileManager();

    public void commit(String message, String authorName, String authorEmail) {
        if (message == null || message.isBlank()) {
            throw new IllegalArgumentException("Commit message is required.");
        }
        if (authorName == null || authorName.isBlank() || authorName.length() > 120
                || authorEmail == null || authorEmail.length() > 254) {
            throw new IllegalArgumentException("Commit author details are invalid.");
        }

        Path stagingDirectory = Path.of(
                RepositoryConstants.REPOSITORY_FOLDER,
                RepositoryConstants.STAGING_FOLDER
        );
        if (!Files.isDirectory(stagingDirectory)) {
            throw new IllegalStateException("Repository not initialized.");
        }

        try (var stagedPaths = Files.walk(stagingDirectory)) {
            var stagedFiles = stagedPaths
                    .filter(Files::isRegularFile)
                    .sorted(Comparator.naturalOrder())
                    .toList();
            if (stagedFiles.isEmpty()) {
                throw new IllegalStateException("Nothing to commit.");
            }

            String currentBranch = fileManager.readFile(
                    RepositoryConstants.REPOSITORY_FOLDER + File.separator + RepositoryConstants.HEAD_FILE
            ).trim();
            if (currentBranch.isBlank() || currentBranch.contains("/") || currentBranch.contains("\\")) {
                throw new IllegalStateException("Invalid current branch.");
            }

            String timestamp = DateUtil.getCurrentDateTime();
            String parentCommit = getPreviousCommitId(currentBranch);
            String commitId = HashUtil.generateHash(
                    parentCommit + "\n" + timestamp + "\n" + message + "\n"
                            + authorName + "\n" + authorEmail + "\n" + UUID.randomUUID()
            );

            Commit commit = new Commit(commitId, message.trim(), timestamp, parentCommit, currentBranch);

            Path commitFolder = Path.of(
                    RepositoryConstants.REPOSITORY_FOLDER,
                    RepositoryConstants.COMMITS_FOLDER,
                    commit.getId()
            );
            Path snapshotFolder = commitFolder.resolve("snapshot");
            Files.createDirectories(snapshotFolder);

            if (!parentCommit.isBlank()) {
                Path previousSnapshot = Path.of(
                        RepositoryConstants.REPOSITORY_FOLDER,
                        RepositoryConstants.COMMITS_FOLDER,
                        parentCommit,
                        "snapshot"
                );
                if (!Files.isDirectory(previousSnapshot)) {
                    throw new IllegalStateException("Parent commit snapshot is missing.");
                }
                fileManager.copyDirectory(previousSnapshot.toFile(), snapshotFolder.toFile());
            }

            for (Path stagedFile : stagedFiles) {
                Path relativePath = stagingDirectory.relativize(stagedFile);
                if (relativePath.getNameCount() > 1
                        && relativePath.getName(0).toString().equals("deleted")) {
                    Path deletedPath = snapshotFolder.resolve("working").resolve(
                            relativePath.subpath(1, relativePath.getNameCount())).normalize();
                    if (!deletedPath.startsWith(snapshotFolder)) {
                        throw new IllegalArgumentException("Invalid staged deletion path.");
                    }
                    deleteRecursively(deletedPath);
                    continue;
                }
                Path snapshotFile = snapshotFolder.resolve(relativePath).normalize();
                if (!snapshotFile.startsWith(snapshotFolder)) {
                    throw new IllegalArgumentException("Invalid staged file path.");
                }
                Files.createDirectories(snapshotFile.getParent());
                fileManager.copyFile(stagedFile.toString(), snapshotFile.toString());
            }

            String metadata = "Commit ID : " + commit.getId()
                    + "\n\nMessage : " + commit.getMessage()
                    + "\n\nTimestamp : " + commit.getTimestamp()
                    + "\n\nParent : " + commit.getParentCommit()
                    + "\n\nBranch : " + commit.getBranch()
                    + "\n\nAuthor Name : " + authorName
                    + "\n\nAuthor Email : " + authorEmail;
            fileManager.writeToFile(commitFolder.resolve("metadata.txt").toString(), metadata);
            fileManager.writeToFile(
                    Path.of(RepositoryConstants.REPOSITORY_FOLDER, RepositoryConstants.BRANCHES_FOLDER,
                            currentBranch + ".txt").toString(),
                    commit.getId()
            );
            fileManager.deleteAllFiles(stagingDirectory.toString());

            System.out.println("Commit Successful");
            System.out.println("Commit ID : " + commit.getId());
        } catch (IOException error) {
            throw new IllegalStateException("Could not create commit snapshot.", error);
        }
    }

    private void deleteRecursively(Path path) throws IOException {
        if (!Files.exists(path)) return;
        if (Files.isDirectory(path)) {
            try (var children = Files.list(path)) {
                for (Path child : children.toList()) deleteRecursively(child);
            }
        }
        Files.delete(path);
    }

    private String getPreviousCommitId(String currentBranch) {
        String branchFile = Path.of(
                RepositoryConstants.REPOSITORY_FOLDER,
                RepositoryConstants.BRANCHES_FOLDER,
                currentBranch + ".txt"
        ).toString();
        return fileManager.readFile(branchFile).trim();
    }
}