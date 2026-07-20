package models;

public class Commit {

    private String id;
    private String message;
    private String timestamp;
    private String parentCommit;
    private String branch;

    public Commit(String id,
                  String message,
                  String timestamp,
                  String parentCommit,
                  String branch) {

        this.id = id;
        this.message = message;
        this.timestamp = timestamp;
        this.parentCommit = parentCommit;
        this.branch = branch;
    }

    public String getId() {
        return id;
    }

    public String getMessage() {
        return message;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public String getParentCommit() {
        return parentCommit;
    }

    public String getBranch() {
        return branch;
    }
}