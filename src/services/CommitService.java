package services;

import constants.RepositoryConstants;
import models.Commit;
import storage.FileManager;
import utils.DateUtil;
import utils.HashUtil;

import java.io.File;

public class CommitService {

    private final FileManager fileManager = new FileManager();

    public void commit(String message) {

        String stagingPath =
                RepositoryConstants.REPOSITORY_FOLDER
                        + File.separator
                        + RepositoryConstants.STAGING_FOLDER;

        File[] stagedFiles = fileManager.listFiles(stagingPath);

        if (stagedFiles == null || stagedFiles.length == 0) {

            System.out.println("Nothing to commit.");
            return;
        }

        String timestamp = DateUtil.getCurrentDateTime();

        String parentCommit = getPreviousCommitId();


        System.out.println("Parent Commit = " + parentCommit);


        String commitId =
                HashUtil.generateHash(timestamp + message);

        Commit commit = new Commit(
                commitId,
                message,
                timestamp,
                parentCommit,
                "main"
        );

        String commitFolder =
                RepositoryConstants.REPOSITORY_FOLDER
                        + File.separator
                        + RepositoryConstants.COMMITS_FOLDER
                        + File.separator
                        + commit.getId();

        fileManager.createDirectory(commitFolder);

        // Create snapshot folder
        String snapshotFolder =
                commitFolder
                        + File.separator
                        + "snapshot";

        fileManager.createDirectory(snapshotFolder);

        // Copy previous commit snapshot (if available)
        if (!parentCommit.isBlank()) {

            File previousSnapshot = new File(
                    RepositoryConstants.REPOSITORY_FOLDER
                            + File.separator
                            + RepositoryConstants.COMMITS_FOLDER
                            + File.separator
                            + parentCommit
                            + File.separator
                            + "snapshot"
            );



                System.out.println("Copying snapshot from:");
                System.out.println(previousSnapshot.getPath());    



            fileManager.copyDirectory(
                    previousSnapshot,
                    new File(snapshotFolder)
            );
        }

        // Copy staged files into new snapshot
        for (File file : stagedFiles) {

            fileManager.copyFile(
                    file.getPath(),
                    snapshotFolder
                            + File.separator
                            + file.getName()
            );
        }

        // Create metadata
        String metadata =
                "Commit ID : " + commit.getId()
                        + "\n\nMessage : " + commit.getMessage()
                        + "\n\nTimestamp : " + commit.getTimestamp()
                        + "\n\nParent : " + commit.getParentCommit()
                        + "\n\nBranch : " + commit.getBranch();

        fileManager.writeToFile(
                commitFolder
                        + File.separator
                        + "metadata.txt",
                metadata
        );

        // Update HEAD
        String currentBranch =
        fileManager.readFile(
                RepositoryConstants.REPOSITORY_FOLDER
                        + File.separator
                        + RepositoryConstants.HEAD_FILE
        ).trim();

        fileManager.writeToFile(
                RepositoryConstants.REPOSITORY_FOLDER
                        + File.separator
                        + RepositoryConstants.BRANCHES_FOLDER
                        + File.separator
                        + currentBranch
                        + ".txt",
                commit.getId()
        );

        // Clear staging area
        fileManager.deleteAllFiles(stagingPath);

        System.out.println();
        System.out.println("Commit Successful");
        System.out.println("Commit ID : " + commit.getId());
    }

    private String getPreviousCommitId() {

    String currentBranch =
            fileManager.readFile(
                    RepositoryConstants.REPOSITORY_FOLDER
                            + File.separator
                            + RepositoryConstants.HEAD_FILE
            ).trim();

    String branchFile =
            RepositoryConstants.REPOSITORY_FOLDER
                    + File.separator
                    + RepositoryConstants.BRANCHES_FOLDER
                    + File.separator
                    + currentBranch
                    + ".txt";

    return fileManager.readFile(branchFile).trim();
}
}