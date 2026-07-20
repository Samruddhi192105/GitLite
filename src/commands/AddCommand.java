package commands;

import services.StageService;

public class AddCommand {

    private final StageService stageService =
            new StageService();

    public void execute(String fileName) {

        stageService.addFile(fileName);

    }

}