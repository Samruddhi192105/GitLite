package services;

import constants.RepositoryConstants;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

public class MoveService {

    public void move(String oldPath, String newPath) {
        Path repositoryRoot = Path.of("").toAbsolutePath().normalize();
        Path workingRoot = repositoryRoot.resolve("working");
        Path source = RemoveService.resolveWorkingPath(repositoryRoot, workingRoot, oldPath);
        Path destination = RemoveService.resolveWorkingPath(repositoryRoot, workingRoot, newPath);
        if (!Files.isRegularFile(source)) {
            throw new IllegalArgumentException("Working file not found: " + oldPath);
        }
        if (Files.exists(destination)) {
            throw new IllegalArgumentException("Destination already exists: " + newPath);
        }

        Path gitDirectory = repositoryRoot.resolve(RepositoryConstants.REPOSITORY_FOLDER);
        Path staging = gitDirectory.resolve(RepositoryConstants.STAGING_FOLDER);
        Path relativeSource = workingRoot.relativize(source);
        Path relativeDestination = workingRoot.relativize(destination);
        Path stagedSource = staging.resolve("working").resolve(relativeSource);
        Path stagedDestination = staging.resolve("working").resolve(relativeDestination);
        Path deletionMarker = staging.resolve("deleted").resolve(relativeSource);
        try {
            Files.createDirectories(destination.getParent());
            Files.move(source, destination);
            Files.deleteIfExists(stagedSource);
            Files.createDirectories(stagedDestination.getParent());
            Files.copy(destination, stagedDestination, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            Files.createDirectories(deletionMarker.getParent());
            Files.writeString(deletionMarker, "");
        } catch (IOException error) {
            throw new IllegalStateException("Could not move and stage file: " + oldPath, error);
        }
        System.out.println("Moved and staged " + oldPath + " as " + newPath);
    }
}
