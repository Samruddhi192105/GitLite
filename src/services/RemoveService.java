package services;

import constants.RepositoryConstants;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

public class RemoveService {

    public void remove(String filePath) {
        Path repositoryRoot = Path.of("").toAbsolutePath().normalize();
        Path workingRoot = repositoryRoot.resolve("working");
        Path source = resolveWorkingPath(repositoryRoot, workingRoot, filePath);
        if (!Files.isRegularFile(source)) {
            throw new IllegalArgumentException("Working file not found: " + filePath);
        }

        String relativePath = workingRoot.relativize(source).toString();
        Path stagedFile = repositoryRoot.resolve(RepositoryConstants.REPOSITORY_FOLDER)
                .resolve(RepositoryConstants.STAGING_FOLDER).resolve("working").resolve(relativePath);
        Path deletionMarker = repositoryRoot.resolve(RepositoryConstants.REPOSITORY_FOLDER)
                .resolve(RepositoryConstants.STAGING_FOLDER).resolve("deleted").resolve(relativePath);
        try {
            Files.delete(source);
            Files.deleteIfExists(stagedFile);
            Files.createDirectories(deletionMarker.getParent());
            Files.writeString(deletionMarker, "");
        } catch (IOException error) {
            throw new IllegalStateException("Could not stage file deletion: " + filePath, error);
        }
        System.out.println("Deleted and staged " + filePath);
    }

    static Path resolveWorkingPath(Path repositoryRoot, Path workingRoot, String filePath) {
        if (Files.isSymbolicLink(workingRoot)) {
            throw new IllegalArgumentException("The working directory cannot be a symbolic link.");
        }
        if (filePath == null || filePath.isBlank()) {
            throw new IllegalArgumentException("A working file path is required.");
        }
        Path source = repositoryRoot.resolve(filePath).normalize();
        if (!source.startsWith(workingRoot) || source.equals(workingRoot)) {
            throw new IllegalArgumentException("File paths must remain inside working/.");
        }
        Path cursor = workingRoot;
        for (Path segment : workingRoot.relativize(source)) {
            cursor = cursor.resolve(segment);
            if (Files.isSymbolicLink(cursor)) {
                throw new IllegalArgumentException("Symbolic links cannot be changed.");
            }
        }
        return source;
    }
}
