package services;

import constants.RepositoryConstants;
import storage.FileManager;

import java.io.File;

public class CheckoutService {

    private final FileManager fileManager =
            new FileManager();

    // Used when user runs: checkout <commit-id>
    public void checkout(String commitId) {

        checkoutByCommitId(commitId);

        System.out.println();
        System.out.println("Checkout Successful!");
    }

    // Used internally by branch switching
    public void checkoutByCommitId(String commitId) {

        String commitFolder =
                RepositoryConstants.REPOSITORY_FOLDER
                        + File.separator
                        + RepositoryConstants.COMMITS_FOLDER
                        + File.separator
                        + commitId;

        File commit = new File(commitFolder);

        if (!commit.exists()) {

            System.out.println("Commit not found.");
            return;

        }

        String snapshotPath =
                commitFolder
                        + File.separator
                        + "snapshot";

        File snapshot = new File(snapshotPath);

        if (!snapshot.exists()) {

            System.out.println("Snapshot not found.");
            return;

        }

        File working = new File("working");

        if (!working.exists()) {
            working.mkdirs();
        }

        // Delete old working files
        File[] files = working.listFiles();

        if (files != null) {

            for (File file : files) {
                file.delete();
            }

        }

        // Restore snapshot
        fileManager.copyDirectory(snapshot, working);
    }
}