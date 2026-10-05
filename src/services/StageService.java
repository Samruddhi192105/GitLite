package services;

import constants.RepositoryConstants;
import storage.FileManager;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

public class StageService {

    private final FileManager fileManager = new FileManager();

    public void addFile(String filePath) {
        Path repositoryRoot = Path.of("").toAbsolutePath().normalize();
        Path repositoryDirectory = repositoryRoot.resolve(RepositoryConstants.REPOSITORY_FOLDER);
        if (!Files.isDirectory(repositoryDirectory)) {
            throw new IllegalStateException("Repository not initialized.");
        }

        Path workingDirectory = repositoryRoot.resolve("working");
        Path source = resolveSource(repositoryRoot, repositoryDirectory, workingDirectory, filePath);
        stageFile(repositoryRoot, repositoryDirectory, workingDirectory, source);
        System.out.println(repositoryRoot.relativize(source) + " staged successfully.");
    }

    public int addAll() {
        Path repositoryRoot = Path.of("").toAbsolutePath().normalize();
        Path repositoryDirectory = repositoryRoot.resolve(RepositoryConstants.REPOSITORY_FOLDER);
        Path workingDirectory = repositoryRoot.resolve("working");
        if (!Files.isDirectory(repositoryDirectory) || !Files.isDirectory(workingDirectory)) {
            throw new IllegalStateException("Repository or working directory is missing.");
        }
        int count = 0;
        try (var paths = Files.walk(workingDirectory)) {
            for (Path source : paths.toList()) {
                if (Files.isSymbolicLink(source)) {
                    throw new IllegalArgumentException("Symbolic links cannot be staged.");
                }
                if (!Files.isRegularFile(source)) continue;
                if (isLocalMetadataFile(workingDirectory.relativize(source))) continue;
                stageFile(repositoryRoot, repositoryDirectory, workingDirectory, source);
                count++;
            }
        } catch (IOException error) {
            throw new IllegalStateException("Could not stage repository files.", error);
        }
        System.out.println(count + " working files staged.");
        return count;
    }

    private boolean isLocalMetadataFile(Path relativePath) {
        for (Path segment : relativePath) {
            String name = segment.toString();
            if (name.equalsIgnoreCase(".git") || name.equalsIgnoreCase(".gitlite")) return true;
        }
        return false;
    }

    private Path resolveSource(
            Path repositoryRoot,
            Path repositoryDirectory,
            Path workingDirectory,
            String filePath
    ) {
        Path source = repositoryRoot.resolve(filePath).normalize();
        if (!source.startsWith(workingDirectory) || source.startsWith(repositoryDirectory)) {
            throw new IllegalArgumentException("Only files inside working/ can be staged.");
        }
        return source;
    }

    private void stageFile(Path repositoryRoot, Path repositoryDirectory, Path workingDirectory, Path source) {
        if (Files.isSymbolicLink(workingDirectory)) {
            throw new IllegalArgumentException("The working directory cannot be a symbolic link.");
        }
        Path cursor = workingDirectory;
        for (Path segment : workingDirectory.relativize(source)) {
            cursor = cursor.resolve(segment);
            if (Files.isSymbolicLink(cursor)) {
                throw new IllegalArgumentException("Symbolic links cannot be staged.");
            }
        }
        if (!Files.isRegularFile(source)) {
            throw new IllegalArgumentException("File not found: " + source);
        }

        Path stagingDirectory = repositoryDirectory.resolve(RepositoryConstants.STAGING_FOLDER);
        Path stagedPath = repositoryRoot.relativize(source);
        Path stagedFile = stagingDirectory.resolve(stagedPath).normalize();
        if (!stagedFile.startsWith(stagingDirectory)) {
            throw new IllegalArgumentException("Invalid staging path.");
        }

        try {
            Files.createDirectories(stagedFile.getParent());
        } catch (IOException error) {
            throw new IllegalStateException("Could not create staging directory.", error);
        }
        fileManager.copyFile(source.toString(), stagedFile.toString());
    }

}