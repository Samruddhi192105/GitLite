package services;

import constants.RepositoryConstants;
import storage.FileManager;

import java.io.File;

public class StatusService {

    private final FileManager fileManager =
            new FileManager();

    public void showStatus() {

        if (!fileManager.exists(
                RepositoryConstants.REPOSITORY_FOLDER)) {

            System.out.println("Repository not initialized.");

            return;
        }

        System.out.println();
        System.out.println("========== GitLite Status ==========");
        System.out.println();

        System.out.println("Repository : Initialized");

        String head =
                fileManager.readFile(
                        RepositoryConstants.REPOSITORY_FOLDER
                                + File.separator
                                + RepositoryConstants.HEAD_FILE);

        if (head.isBlank()) {

            System.out.println("HEAD : No commits yet");

        } else {

            System.out.println("HEAD : " + head);

        }

        System.out.println();
        System.out.println("Staged Files");
        System.out.println("----------------");

        File[] stagedFiles =
                fileManager.listFiles(
                        RepositoryConstants.REPOSITORY_FOLDER
                                + File.separator
                                + RepositoryConstants.STAGING_FOLDER);

        int count = 0;

        if (stagedFiles != null) {

            for (File file : stagedFiles) {

                System.out.println(file.getName());

                count++;

            }

        }

        if (count == 0) {

            System.out.println("No staged files");

        }

        System.out.println();
        System.out.println("Total Staged Files : " + count);

        System.out.println();
        System.out.println("====================================");

    }

}