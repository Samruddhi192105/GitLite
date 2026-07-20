package services;

import constants.RepositoryConstants;
import models.Repository;
import storage.FileManager;

import java.io.File;

public class RepositoryService {

    private final FileManager fileManager = new FileManager();

    public Repository initializeRepository() {

        // Create repository folder
        fileManager.createDirectory(
                RepositoryConstants.REPOSITORY_FOLDER);

        // Create commits folder
        fileManager.createDirectory(
                RepositoryConstants.REPOSITORY_FOLDER
                        + File.separator
                        + RepositoryConstants.COMMITS_FOLDER);

        // Create staging folder
        fileManager.createDirectory(
                RepositoryConstants.REPOSITORY_FOLDER
                        + File.separator
                        + RepositoryConstants.STAGING_FOLDER);

        // Create branches folder
        fileManager.createDirectory(
                RepositoryConstants.REPOSITORY_FOLDER
                        + File.separator
                        + RepositoryConstants.BRANCHES_FOLDER);

        // Create HEAD file
        fileManager.createFile(
        RepositoryConstants.REPOSITORY_FOLDER
                + File.separator
                + RepositoryConstants.HEAD_FILE);

        fileManager.writeToFile(
                RepositoryConstants.REPOSITORY_FOLDER
                + File.separator
                + RepositoryConstants.HEAD_FILE,
                "main");

        // Create config file
        fileManager.createFile(
                RepositoryConstants.REPOSITORY_FOLDER
                        + File.separator
                        + "config");

        // Create default branch file
        fileManager.createFile(
                RepositoryConstants.REPOSITORY_FOLDER
                        + File.separator
                        + RepositoryConstants.BRANCHES_FOLDER
                        + File.separator
                        + "main.txt");

        // Initially no commits on main branch
        fileManager.writeToFile(
                RepositoryConstants.REPOSITORY_FOLDER
                        + File.separator
                        + RepositoryConstants.BRANCHES_FOLDER
                        + File.separator
                        + "main.txt",
                "");

        return new Repository(
                RepositoryConstants.REPOSITORY_FOLDER,
                "main",
                null
        );
    }
}