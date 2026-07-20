package commands;

import services.RepositoryService;

public class InitCommand {

    private final RepositoryService repositoryService =
            new RepositoryService();

    public void execute() {

        repositoryService.initializeRepository();

        System.out.println("Repository initialized successfully.");

    }
}