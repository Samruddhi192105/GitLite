import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.Comparator;

public final class GitLiteIntegrationTest {
    private static final Pattern COMMIT_ID = Pattern.compile("Commit ID : ([a-f0-9]{64})");
    private static Path classDirectory;
    private static Path repository;

    public static void main(String[] args) throws Exception {
        classDirectory = Path.of(args[0]).toAbsolutePath();
        repository = Files.createTempDirectory("gitlite-repository-test-");

        try {
            initializeRepository();
            run(0, "branch", "empty");
            createNestedAndSameNameFiles();
            assertContains(run(0, "status"), "No unstaged changes");
            String initialCommit = commitStagedFiles("initial files");
            assertContains(run(0, "status"), "No unstaged changes");
            assertSnapshotContains("working/one/notes.txt", "first file");
            assertSnapshotContains("working/two/notes.txt", "second file");
            run(0, "branch", "feature");
            run(0, "switch", "feature");
            writeWorkingFile("working/one/notes.txt", "feature change");
            assertContains(run(0, "status"), "Modified: one/notes.txt");
            run(0, "add", "working/one/notes.txt");
            assertContains(run(0, "status"), "No unstaged changes");
            writeWorkingFile("working/one/notes.txt", "changed after staging");
            assertContains(run(0, "status"), "Modified after staging: one/notes.txt");
            writeWorkingFile("working/one/notes.txt", "feature change");
            String featureCommit = commitStagedFiles("feature update");
            assertSnapshotContains(featureCommit, "working/one/notes.txt", "feature change");
            assertMetadataBranch(featureCommit, "feature");
            assertMetadataAuthor(featureCommit, "Integration Tester", "tester@example.test");

            run(0, "switch", "main");
            assertWorkingFile("working/one/notes.txt", "first file");
            run(0, "move", "working/one/notes.txt", "working/moved/notes.txt");
            String moveCommit = commitStagedFiles("move nested file");
            assertSnapshotContains(moveCommit, "working/moved/notes.txt", "first file");
            assertSnapshotMissing(moveCommit, "working/one/notes.txt");
            run(0, "remove", "working/moved/notes.txt");
            assertContains(run(0, "status"), "deleted: moved/notes.txt");
            String deleteCommit = commitStagedFiles("delete moved file");
            assertSnapshotMissing(deleteCommit, "working/moved/notes.txt");

            run(0, "switch", "empty");
            assertMissingWorkingFile("working/one/notes.txt");
            run(0, "switch", "main");
            assertMissingWorkingFile("working/one/notes.txt");
            assertMissingWorkingFile("working/moved/notes.txt");

            run(0, "checkout", initialCommit);
            assertWorkingFile("working/one/notes.txt", "first file");
            writeWorkingFile("working/one/notes.txt", "uncommitted change");
            run(1, "switch", "feature");
            assertWorkingFile("working/one/notes.txt", "uncommitted change");
            run(1, "branch", "../outside");
            run(1, "add", "../outside.txt");
            run(1, "init");
            testAddAll();

            System.out.println("Java integration tests passed.");
        } finally {
            deleteTree(repository);
        }
    }

    private static void testAddAll() throws Exception {
        writeWorkingFile("working/browser-upload/new.txt", "uploaded content");
        writeWorkingFile("working/.git/config", "local git metadata");
        writeWorkingFile("working/.gitlite/config", "local GitLite metadata");
        assertContains(run(0, "addall"), "working files staged");
        if (!Files.isRegularFile(repository.resolve(".gitlite/staging/working/browser-upload/new.txt"))) {
            throw new AssertionError("addall did not stage uploaded project files");
        }
        if (Files.exists(repository.resolve(".gitlite/staging/working/.git"))
                || Files.exists(repository.resolve(".gitlite/staging/working/.gitlite"))) {
            throw new AssertionError("addall must not stage local metadata directories");
        }
    }

    private static void initializeRepository() throws Exception {
        run(0, "init");
        if (!Files.isDirectory(repository.resolve(".gitlite/branches"))) {
            throw new AssertionError("init did not create branch metadata");
        }
        run(1, "init");
    }

    private static void createNestedAndSameNameFiles() throws Exception {
        writeWorkingFile("working/one/notes.txt", "first file");
        writeWorkingFile("working/two/notes.txt", "second file");
        String beforeStage = run(0, "status");
        assertContains(beforeStage, "Untracked: one/notes.txt");
        assertContains(beforeStage, "Untracked: two/notes.txt");
        run(0, "add", "working/one/notes.txt");
        run(0, "add", "working/two/notes.txt");
        String status = run(0, "status");
        assertContains(status, "working/one/notes.txt");
        assertContains(status, "working/two/notes.txt");
        if (status.contains("working/working/")) {
            throw new AssertionError("staged paths should not repeat the working/ prefix");
        }
        assertContains(status, "No unstaged changes");
    }

    private static String commitStagedFiles(String message) throws Exception {
        String output = run(0, "commit", message, "--author-name", "Integration Tester",
                "--author-email", "tester@example.test");
        Matcher matcher = COMMIT_ID.matcher(output);
        if (!matcher.find()) {
            throw new AssertionError("commit output did not contain a full hash: " + output);
        }
        return matcher.group(1);
    }

    private static void assertSnapshotContains(String relativePath, String expected) throws IOException {
        String branchHead = Files.readString(repository.resolve(".gitlite/branches/main.txt"));
        assertSnapshotContains(branchHead, relativePath, expected);
    }

    private static void assertSnapshotContains(String commitId, String relativePath, String expected)
            throws IOException {
        String actual = Files.readString(repository.resolve(".gitlite/commits")
                .resolve(commitId).resolve("snapshot").resolve(relativePath));
        if (!expected.equals(actual)) {
            throw new AssertionError("unexpected snapshot contents for " + relativePath);
        }
    }

    private static void assertSnapshotMissing(String commitId, String relativePath) {
        if (Files.exists(repository.resolve(".gitlite/commits")
                .resolve(commitId).resolve("snapshot").resolve(relativePath))) {
            throw new AssertionError("snapshot should not contain deleted file " + relativePath);
        }
    }

    private static void assertMetadataBranch(String commitId, String expected) throws IOException {
        String metadata = Files.readString(repository.resolve(".gitlite/commits")
                .resolve(commitId).resolve("metadata.txt"));
        if (!metadata.contains("Branch : " + expected)) {
            throw new AssertionError("commit metadata should record branch " + expected);
        }
    }

    private static void assertMetadataAuthor(String commitId, String name, String email) throws IOException {
        String metadata = Files.readString(repository.resolve(".gitlite/commits")
                .resolve(commitId).resolve("metadata.txt"));
        if (!metadata.contains("Author Name : " + name)
                || !metadata.contains("Author Email : " + email)) {
            throw new AssertionError("commit metadata should record the authenticated author");
        }
    }

    private static void writeWorkingFile(String relativePath, String contents) throws IOException {
        Path target = repository.resolve(relativePath);
        Files.createDirectories(target.getParent());
        Files.writeString(target, contents, StandardCharsets.UTF_8);
    }

    private static void assertWorkingFile(String relativePath, String expected) throws IOException {
        String actual = Files.readString(repository.resolve(relativePath));
        if (!expected.equals(actual)) {
            throw new AssertionError("unexpected working file contents for " + relativePath);
        }
    }

    private static void assertContains(String output, String expected) {
        if (!output.contains(expected)) {
            throw new AssertionError("expected output to contain: " + expected + "\n" + output);
        }
    }

    private static void assertMissingWorkingFile(String relativePath) {
        if (Files.exists(repository.resolve(relativePath))) {
            throw new AssertionError("switching to an empty branch should remove tracked working files");
        }
    }

    private static String run(int expectedExit, String... args) throws Exception {
        String[] command = new String[4 + args.length];
        command[0] = "java";
        command[1] = "-cp";
        command[2] = classDirectory.toString();
        command[3] = "Main";
        System.arraycopy(args, 0, command, 4, args.length);
        ProcessBuilder builder = new ProcessBuilder(command)
                .directory(repository.toFile())
                .redirectErrorStream(true);
        Process process = builder.start();
        if (!process.waitFor(20, java.util.concurrent.TimeUnit.SECONDS)) {
            process.destroyForcibly();
            throw new AssertionError("command timed out: " + String.join(" ", args));
        }

        byte[] output = process.getInputStream().readAllBytes();
        String text = new String(output, StandardCharsets.UTF_8);
        if (process.exitValue() != expectedExit) {
            throw new AssertionError("command exit mismatch for " + String.join(" ", args)
                    + ": expected " + expectedExit + ", got " + process.exitValue() + "\n" + text);
        }
        return text;
    }

    private static void deleteTree(Path root) throws IOException {
        if (!Files.exists(root)) return;
        try (var paths = Files.walk(root)) {
            for (Path item : paths.sorted(java.util.Comparator.reverseOrder()).toList()) {
                Files.deleteIfExists(item);
            }
        }
    }
}
