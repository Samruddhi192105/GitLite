import java.io.IOException;
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.Comparator;
import java.util.Map;
import java.util.HashMap;
import java.util.concurrent.atomic.AtomicReference;
import com.sun.net.httpserver.HttpServer;

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
            runRemoteSyncIntegration();

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

            System.out.println("Java integration tests passed.");
        } finally {
            deleteTree(repository);
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

    private static void runRemoteSyncIntegration() throws Exception {
        Path cloneA = Files.createTempDirectory("gitlite-clone-a-");
        Path cloneB = Files.createTempDirectory("gitlite-clone-b-");
        Path remoteSource = Files.createTempDirectory("gitlite-empty-remote-");
        deleteTree(cloneA);
        deleteTree(cloneB);
        runAt(remoteSource, 0, Map.of(), "init");
        AtomicReference<byte[]> remoteBundle = new AtomicReference<>(encodeBundle(remoteSource));
        AtomicReference<String> remoteHead = new AtomicReference<>("");
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/remotes/0123456789abcdef01234567", exchange -> {
            try {
                if (!"Bearer glp_integration_token_012345678901234567890".equals(
                        exchange.getRequestHeaders().getFirst("Authorization"))) {
                    exchange.sendResponseHeaders(401, -1);
                    return;
                }
                if (exchange.getRequestMethod().equals("GET")) {
                    exchange.getResponseHeaders().add("X-GitLite-Head",
                            remoteHead.get().isBlank() ? "empty" : remoteHead.get());
                    byte[] body = remoteBundle.get();
                    exchange.sendResponseHeaders(200, body.length);
                    exchange.getResponseBody().write(body);
                } else if (exchange.getRequestMethod().equals("PUT")) {
                    String expectedHead = remoteHead.get().isBlank() ? "empty" : remoteHead.get();
                    if (!expectedHead.equals(exchange.getRequestHeaders()
                            .getFirst("X-GitLite-Expected-Head"))) {
                        exchange.sendResponseHeaders(409, -1);
                        return;
                    }
                    byte[] body = exchange.getRequestBody().readAllBytes();
                    remoteBundle.set(body);
                    remoteHead.set(bundleHead(body, "main"));
                    byte[] response = "{\"success\":true}".getBytes(StandardCharsets.UTF_8);
                    exchange.sendResponseHeaders(200, response.length);
                    exchange.getResponseBody().write(response);
                } else {
                    exchange.sendResponseHeaders(405, -1);
                }
            } finally {
                exchange.close();
            }
        });
        server.start();
        String url = "http://127.0.0.1:" + server.getAddress().getPort()
                + "/api/remotes/0123456789abcdef01234567";
        Map<String, String> environment = Map.of(
                "GITLITE_TOKEN", "glp_integration_token_012345678901234567890");
        try {
            runAt(repository, 0, environment, "clone", url, cloneA.toString());
            runAt(repository, 0, environment, "clone", url, cloneB.toString());

            writeWorkingFile(cloneA, "working/from-a.txt", "created on laptop A");
            runAt(cloneA, 0, environment, "add", "working/from-a.txt");
            commitAt(cloneA, "laptop A change");
            runAt(cloneA, 0, environment, "push");

            runAt(cloneB, 0, environment, "pull");
            assertWorkingFile(cloneB, "working/from-a.txt", "created on laptop A");
            writeWorkingFile(cloneB, "working/from-b.txt", "created on laptop B");
            runAt(cloneB, 0, environment, "add", "working/from-b.txt");
            commitAt(cloneB, "laptop B change");
            runAt(cloneB, 0, environment, "push");

            runAt(cloneA, 0, environment, "pull");
            assertWorkingFile(cloneA, "working/from-b.txt", "created on laptop B");
            runAt(cloneA, 1, Map.of("GITLITE_TOKEN", "glp_invalid_123456789012345678901234567890"),
                    "pull");
        } finally {
            server.stop(0);
            deleteTree(cloneA);
            deleteTree(cloneB);
            deleteTree(remoteSource);
        }
    }

    private static void commitAt(Path root, String message) throws Exception {
        String output = runAt(root, 0, Map.of("GITLITE_TOKEN", "glp_integration_token_012345678901234567890"),
                "commit", message, "--author-name", "Integration Tester",
                "--author-email", "tester@example.test");
        if (!COMMIT_ID.matcher(output).find()) {
            throw new AssertionError("commit output did not contain a SHA-256 hash");
        }
    }

    private static void writeWorkingFile(Path root, String relativePath, String contents) throws IOException {
        Path target = root.resolve(relativePath);
        Files.createDirectories(target.getParent());
        Files.writeString(target, contents, StandardCharsets.UTF_8);
    }

    private static void assertWorkingFile(Path root, String relativePath, String expected) throws IOException {
        String actual = Files.readString(root.resolve(relativePath));
        if (!expected.equals(actual)) {
            throw new AssertionError("unexpected working file contents for " + relativePath);
        }
    }

    private static byte[] encodeBundle(Path root) throws IOException {
        Map<String, byte[]> files = new HashMap<>();
        for (String directory : new String[]{".gitlite", "working"}) {
            Path base = root.resolve(directory);
            if (!Files.isDirectory(base)) continue;
            try (var paths = Files.walk(base)) {
                for (Path file : paths.filter(Files::isRegularFile).toList()) {
                    String name = root.relativize(file).toString().replace('\\', '/');
                    if (name.equals(".gitlite/remote-url")) continue;
                    files.put(name, Files.readAllBytes(file));
                }
            }
        }

        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (DataOutputStream output = new DataOutputStream(bytes)) {
            output.write(new byte[]{'G', 'L', 'B', '1'});
            output.writeInt(files.size());
            for (Map.Entry<String, byte[]> entry : files.entrySet().stream()
                    .sorted(Map.Entry.comparingByKey()).toList()) {
                byte[] name = entry.getKey().getBytes(StandardCharsets.UTF_8);
                output.writeShort(name.length);
                output.write(name);
                output.writeLong(entry.getValue().length);
                output.write(entry.getValue());
            }
        }
        return bytes.toByteArray();
    }

    private static String bundleHead(byte[] bundle, String branch) throws IOException {
        try (var input = new java.io.DataInputStream(new java.io.ByteArrayInputStream(bundle))) {
            input.skipNBytes(4);
            int count = input.readInt();
            String expected = ".gitlite/branches/" + branch + ".txt";
            for (int index = 0; index < count; index++) {
                int pathLength = input.readUnsignedShort();
                String path = new String(input.readNBytes(pathLength), StandardCharsets.UTF_8);
                long contentLength = input.readLong();
                byte[] contents = input.readNBytes(Math.toIntExact(contentLength));
                if (path.equals(expected)) return new String(contents, StandardCharsets.UTF_8).trim();
            }
        }
        throw new AssertionError("test remote bundle has no branch head");
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
        return runAt(repository, expectedExit, Map.of(), args);
    }

    private static String runAt(Path directory, int expectedExit, Map<String, String> environment,
                                String... args) throws Exception {
        String[] command = new String[4 + args.length];
        command[0] = "java";
        command[1] = "-cp";
        command[2] = classDirectory.toString();
        command[3] = "Main";
        System.arraycopy(args, 0, command, 4, args.length);
        ProcessBuilder builder = new ProcessBuilder(command)
                .directory(directory.toFile())
                .redirectErrorStream(true);
        builder.environment().putAll(environment);
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
