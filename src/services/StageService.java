package services;

import constants.RepositoryConstants;
import storage.FileManager;

import java.io.File;

public class StageService {

    private final FileManager fileManager = new FileManager();

    public void addFile(String filePath) {

        // Check repository
        if (!fileManager.exists(RepositoryConstants.REPOSITORY_FOLDER)) {
            System.out.println("Repository not initialized.");
            return;
        }

        // Check file
        if (!fileManager.exists(filePath)) {
            System.out.println("File not found.");
            return;
        }

        File source = new File(filePath);

        String destination =
                RepositoryConstants.REPOSITORY_FOLDER
                + File.separator
                + RepositoryConstants.STAGING_FOLDER
                + File.separator
                + source.getName();

        boolean success = fileManager.copyFile(
                source.getPath(),
                destination
        );

        if (success) {
            System.out.println(source.getName() + " staged successfully.");
        } else {
            System.out.println("Failed to stage file.");
        }
    }

}