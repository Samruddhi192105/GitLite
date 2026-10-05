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

        Path source = repositoryRoot.resolve(filePath).normalize();
        Path workingDirectory = repositoryRoot.resolve("working");
        if (!source.startsWith(workingDirectory) || source.startsWith(repositoryDirectory)) {
            throw new IllegalArgumentException("Only files inside working/ can be staged.");
        }
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
            throw new IllegalArgumentException("File not found: " + filePath);
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
        System.out.println(stagedPath + " staged successfully.");
    }

}