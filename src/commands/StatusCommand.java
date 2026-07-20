package commands;

import services.StatusService;

public class StatusCommand {

    private final StatusService statusService =
            new StatusService();

    public void execute() {

        statusService.showStatus();

    }

}