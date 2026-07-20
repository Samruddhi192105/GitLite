package commands;

import services.BranchService;

public class BranchesCommand {

    private final BranchService branchService = new BranchService();

    public void execute() {
        branchService.listBranches();
    }
}