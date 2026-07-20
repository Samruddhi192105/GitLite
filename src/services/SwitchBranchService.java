package services;

import constants.RepositoryConstants;
import storage.FileManager;

import java.io.File;

public class SwitchBranchService {

    private final FileManager fileManager =
            new FileManager();

    private final CheckoutService checkoutService =
            new CheckoutService();

    public void switchBranch(String branchName) {

        String branchFile =
                RepositoryConstants.REPOSITORY_FOLDER
                        + File.separator
                        + RepositoryConstants.BRANCHES_FOLDER
                        + File.separator
                        + branchName
                        + ".txt";

        File file = new File(branchFile);

        if (!file.exists()) {

            System.out.println("Branch does not exist.");
            return;

        }

        String commitId =
                fileManager.readFile(branchFile).trim();

        // Restore files only if the branch has commits
        if (!commitId.isBlank()) {

            checkoutService.checkoutByCommitId(commitId);

        }

        // Update HEAD with current branch name
        fileManager.writeToFile(
                RepositoryConstants.REPOSITORY_FOLDER
                        + File.separator
                        + RepositoryConstants.HEAD_FILE,
                branchName
        );

        System.out.println();
        System.out.println("Switched to branch '" + branchName + "'");
    }
}