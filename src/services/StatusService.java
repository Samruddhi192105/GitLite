package services;

import constants.RepositoryConstants;
import storage.FileManager;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;

public class StatusService {

    private final FileManager fileManager = new FileManager();

    public void showStatus() {
        if (!fileManager.exists(RepositoryConstants.REPOSITORY_FOLDER)) {
            System.out.println("Repository not initialized.");
            return;
        }

        Path root = Path.of("").toAbsolutePath();
        Path repository = root.resolve(RepositoryConstants.REPOSITORY_FOLDER);
        Path staging = repository.resolve(RepositoryConstants.STAGING_FOLDER);
        Path working = root.resolve("working");
        String branch = fileManager.readFile(
                repository.resolve(RepositoryConstants.HEAD_FILE).toString()).trim();
        String commitId = fileManager.readFile(
                repository.resolve(RepositoryConstants.BRANCHES_FOLDER)
                        .resolve(branch + ".txt").toString()).trim();
        Path snapshot = commitId.isBlank()
                ? null
                : repository.resolve(RepositoryConstants.COMMITS_FOLDER)
                        .resolve(commitId).resolve("snapshot/working");

        try {
            List<Path> stagedFiles = listFiles(staging);
            List<Path> workingFiles = listFiles(working);
            List<Path> trackedFiles = snapshot == null ? List.of() : listFiles(snapshot);

            System.out.println();
            System.out.println("========== GitLite Status ==========");
            System.out.println("Repository : Initialized");
            System.out.println("HEAD : " + branch + (commitId.isBlank() ? " (no commits yet)" : " -> " + commitId));
            System.out.println();
            System.out.println("Staged Files");
            System.out.println("----------------");
            if (stagedFiles.isEmpty()) System.out.println("No staged files");
            for (Path file : stagedFiles) {
                Path stagedPath = staging.relativize(file);
                if (stagedPath.getNameCount() > 1 && stagedPath.getName(0).toString().equals("deleted")) {
                    System.out.println("deleted: " + displayPath(stagedPath.subpath(1, stagedPath.getNameCount())));
                } else {
                    System.out.println(displayPath(stagedPath));
                }
            }

            System.out.println();
            System.out.println("Unstaged Changes");
            System.out.println("----------------");
            int changes = 0;
            for (Path file : workingFiles) {
                Path relative = working.relativize(file);
                Path stagedFile = staging.resolve("working").resolve(relative);
                Path trackedFile = snapshot == null ? null : snapshot.resolve(relative);
                if (Files.isRegularFile(stagedFile)) {
                    if (Files.mismatch(file, stagedFile) != -1L) {
                        System.out.println("Modified after staging: " + displayPath(relative));
                        changes++;
                    }
                } else if (trackedFile == null || !Files.isRegularFile(trackedFile)) {
                    System.out.println("Untracked: " + displayPath(relative));
                    changes++;
                } else if (Files.mismatch(file, trackedFile) != -1L) {
                    System.out.println("Modified: " + displayPath(relative));
                    changes++;
                }
            }
            if (snapshot != null) {
                for (Path trackedFile : trackedFiles) {
                    Path relative = snapshot.relativize(trackedFile);
                    if (!Files.isRegularFile(working.resolve(relative))) {
                        if (Files.exists(staging.resolve("deleted").resolve(relative))) continue;
                        System.out.println("Deleted: " + displayPath(relative));
                        changes++;
                    }
                }
            }
            if (changes == 0) System.out.println("No unstaged changes");

            System.out.println();
            System.out.println("Total Staged Files : " + stagedFiles.size());
            System.out.println("====================================");
        } catch (IOException error) {
            throw new IllegalStateException("Could not inspect repository status.", error);
        }
    }

    private List<Path> listFiles(Path directory) throws IOException {
        if (!Files.isDirectory(directory)) return List.of();
        try (var paths = Files.walk(directory)) {
            return paths.filter(Files::isRegularFile).sorted(Comparator.naturalOrder()).toList();
        }
    }

    private String displayPath(Path path) {
        return path.toString().replace(File.separatorChar, '/');
    }
}
