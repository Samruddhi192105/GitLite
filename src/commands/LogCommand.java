package commands;

import services.LogService;

public class LogCommand {

    private final LogService logService =
            new LogService();

    public void execute() {

        logService.showLog();

    }

}