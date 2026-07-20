package services;

import constants.RepositoryConstants;
import storage.FileManager;

import java.io.File;

public class BranchService {

    private final FileManager fileManager =
            new FileManager();

    public void createBranch(String branchName) {

        String branchFile =
                RepositoryConstants.REPOSITORY_FOLDER
                        + File.separator
                        + RepositoryConstants.BRANCHES_FOLDER
                        + File.separator
                        + branchName + ".txt";

        File file = new File(branchFile);

        if (file.exists()) {

            System.out.println("Branch already exists.");
            return;

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
}