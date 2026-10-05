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
        BranchService.validateBranchName(branchName);

        String branchFile =
                RepositoryConstants.REPOSITORY_FOLDER
                        + File.separator
                        + RepositoryConstants.BRANCHES_FOLDER
                        + File.separator
                        + branchName
                        + ".txt";

        File file = new File(branchFile);

        if (!file.exists()) {

            throw new IllegalArgumentException("Branch does not exist: " + branchName);

        }

        String commitId =
                fileManager.readFile(branchFile).trim();

        // Restore files only if the branch has commits
        if (!commitId.isBlank()) {
            checkoutService.checkoutByCommitId(commitId);
        } else {
            checkoutService.checkoutEmptyBranch();
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