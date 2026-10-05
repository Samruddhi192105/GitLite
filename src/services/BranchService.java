package services;

import constants.RepositoryConstants;
import storage.FileManager;

import java.io.File;

public class BranchService {

    private final FileManager fileManager =
            new FileManager();

    public void createBranch(String branchName) {
        validateBranchName(branchName);
        if (!fileManager.exists(RepositoryConstants.REPOSITORY_FOLDER)) {
            throw new IllegalStateException("Repository not initialized.");
        }

        String branchFile =
                RepositoryConstants.REPOSITORY_FOLDER
                        + File.separator
                        + RepositoryConstants.BRANCHES_FOLDER
                        + File.separator
                        + branchName + ".txt";

        File file = new File(branchFile);

        if (file.exists()) {

            throw new IllegalArgumentException("Branch already exists: " + branchName);

        }

        String currentBranch =
                fileManager.readFile(
                        RepositoryConstants.REPOSITORY_FOLDER
                                + File.separator
                                + RepositoryConstants.HEAD_FILE
                ).trim();

        String currentCommit =
                fileManager.readFile(
                        RepositoryConstants.REPOSITORY_FOLDER
                                + File.separator
                                + RepositoryConstants.BRANCHES_FOLDER
                                + File.separator
                                + currentBranch
                                + ".txt"
                ).trim();

        fileManager.writeToFile(
                branchFile,
                currentCommit
        );

        System.out.println("Branch created successfully.");
    }

    public void listBranches() {
        if (!fileManager.exists(RepositoryConstants.REPOSITORY_FOLDER)) {
            throw new IllegalStateException("Repository not initialized.");
        }

        String currentBranch =
                fileManager.readFile(
                        RepositoryConstants.REPOSITORY_FOLDER
                                + File.separator
                                + RepositoryConstants.HEAD_FILE
                ).trim();

        File branchFolder =
                new File(
                        RepositoryConstants.REPOSITORY_FOLDER
                                + File.separator
                                + RepositoryConstants.BRANCHES_FOLDER
                );

        File[] branches = branchFolder.listFiles();

        if (branches == null || branches.length == 0) {

            System.out.println("No branches found.");
            return;

        }

        System.out.println();
        System.out.println("Branches");
        System.out.println("--------");

        for (File branch : branches) {

            String branchName = branch.getName();

            if (branchName.endsWith(".txt")) {

                branchName =
                        branchName.substring(
                                0,
                                branchName.length() - 4);

            }

            if (branchName.equals(currentBranch)) {

                System.out.println("* " + branchName);

            } else {

                System.out.println("  " + branchName);

            }

        }
    }

    static void validateBranchName(String branchName) {
        if (branchName == null || !branchName.matches("[A-Za-z0-9][A-Za-z0-9._-]{0,99}")) {
            throw new IllegalArgumentException(
                    "Branch names must start with a letter or number and contain only letters, numbers, dots, underscores, or hyphens."
            );
        }
    }
}