package commands;

import services.CommitService;

public class CommitCommand {

    private final CommitService commitService =
            new CommitService();

    public void execute(String message, String authorName, String authorEmail) {

        commitService.commit(message, authorName, authorEmail);

    }

}