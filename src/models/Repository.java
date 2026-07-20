package models;

public class Repository {

    private String repositoryPath;
    private String currentBranch;
    private String headCommit;

    public Repository(String repositoryPath,
                      String currentBranch,
                      String headCommit) {

        this.repositoryPath = repositoryPath;
        this.currentBranch = currentBranch;
        this.headCommit = headCommit;
    }

    public String getRepositoryPath() {
        return repositoryPath;
    }

    public String getCurrentBranch() {
        return currentBranch;
    }

    public String getHeadCommit() {
        return headCommit;
    }

    public void setCurrentBranch(String currentBranch) {
        this.currentBranch = currentBranch;
    }

    public void setHeadCommit(String headCommit) {
        this.headCommit = headCommit;
    }
}