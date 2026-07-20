package commands;

import services.BranchService;

public class BranchCommand {

    private final BranchService branchService =
            new BranchService();

    public void execute(String branchName) {

        branchService.createBranch(branchName);

    }
}