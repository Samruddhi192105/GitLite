package commands;

import services.SwitchBranchService;

public class SwitchBranchCommand {

    private final SwitchBranchService switchBranchService =
            new SwitchBranchService();

    public void execute(String branchName) {

        switchBranchService.switchBranch(branchName);

    }
}