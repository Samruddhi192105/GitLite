package commands;

import services.CommitService;

public class CommitCommand {

    private final CommitService commitService =
            new CommitService();

    public void execute(String message) {

        commitService.commit(message);

    }

}