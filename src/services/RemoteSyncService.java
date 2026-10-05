package services;

import constants.RepositoryConstants;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class RemoteSyncService {

    private static final int MAX_BUNDLE_BYTES = 20 * 1024 * 1024;
    private static final int MAX_BUNDLE_ENTRIES = 20_000;
    private static final byte[] MAGIC = {'G', 'L', 'B', '1'};
    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();

    public void cloneRepository(String remoteUrl, String targetPath) {
        String token = accessToken();
        URI remote = validateRemoteUrl(remoteUrl);
        Path target = Path.of(targetPath).toAbsolutePath().normalize();
        if (Files.isSymbolicLink(target)) throw new IllegalArgumentException("Clone destination cannot be a symbolic link.");
        if (Files.exists(target)) {
            try (var children = Files.list(target)) {
                if (children.findAny().isPresent()) {
                    throw new IllegalArgumentException("Clone destination must be empty.");
                }
            } catch (IOException error) {
                throw new IllegalStateException("Could not inspect clone destination.", error);
            }
        }

        RemoteResponse response = download(remote, "main", token);
        Map<String, byte[]> files = parseBundle(response.body());
        validateRepositoryBundle(files);
        installRepository(target, files, remote.toString());
        System.out.println("Cloned GitLite repository into " + target);
    }

    public void push() {
        Path root = Path.of("").toAbsolutePath().normalize();
        String remoteUrl = readRemoteUrl(root);
        String token = accessToken();
        String branch = currentBranch(root);
        requireCleanWorkingTree(root, branch);

        URI remote = validateRemoteUrl(remoteUrl);
        RemoteResponse remoteState = download(remote, branch, token);
        Map<String, byte[]> localFiles = createBundle(root);
        validateRepositoryBundle(localFiles);
        String localHead = branchHead(localFiles, branch);
        String remoteHead = remoteState.head();
        if (!isAncestor(localFiles, remoteHead, localHead)) {
            throw new IllegalStateException("Push rejected: the remote contains commits not in this local branch. Pull first.");
        }

        HttpRequest request = HttpRequest.newBuilder(remoteUri(remote, branch))
                .timeout(Duration.ofSeconds(60))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/vnd.gitlite.bundle")
                .header("X-GitLite-Expected-Head", remoteHead.isBlank() ? "empty" : remoteHead)
                .PUT(HttpRequest.BodyPublishers.ofByteArray(serializeBundle(localFiles)))
                .build();
        HttpResponse<String> result = send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        requireSuccess(result.statusCode(), result.body());
        System.out.println("Pushed " + branch + " to GitLite remote.");
    }

    public void pull() {
        Path root = Path.of("").toAbsolutePath().normalize();
        String remoteUrl = readRemoteUrl(root);
        String token = accessToken();
        String branch = currentBranch(root);
        requireCleanWorkingTree(root, branch);

        URI remote = validateRemoteUrl(remoteUrl);
        RemoteResponse response = download(remote, branch, token);
        Map<String, byte[]> remoteFiles = parseBundle(response.body());
        validateRepositoryBundle(remoteFiles);
        String localHead = branchHead(createBundle(root), branch);
        String remoteHead = branchHead(remoteFiles, branch);
        if (!isAncestor(remoteFiles, localHead, remoteHead)) {
            throw new IllegalStateException("Pull rejected: local and remote histories diverged. Merge support is not available yet.");
        }

        installRepository(root, remoteFiles, remote.toString());
        writeCurrentBranch(root, branch);
        restoreWorkingTree(root, branch, remoteHead);
        System.out.println("Pulled latest " + branch + " changes from GitLite remote.");
    }

    private String accessToken() {
        String token = System.getenv("GITLITE_TOKEN");
        if (token == null || !token.matches("glp_[A-Za-z0-9_-]{32,}")) {
            throw new IllegalStateException(
                    "Set GITLITE_TOKEN to a repository access token before running clone, push, or pull.");
        }
        return token;
    }

    private URI validateRemoteUrl(String value) {
        try {
            URI uri = URI.create(value);
            String path = uri.getPath();
            if (uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null
                    || !("https".equalsIgnoreCase(uri.getScheme())
                    || ("http".equalsIgnoreCase(uri.getScheme())
                    && ("localhost".equalsIgnoreCase(uri.getHost()) || "127.0.0.1".equals(uri.getHost()))))
                    || path == null || !path.matches("/api/remotes/[a-fA-F0-9]{24}/?")) {
                throw new IllegalArgumentException("Remote URL must be an HTTPS GitLite repository API URL.");
            }
            return URI.create(uri.toString().replaceAll("/+$", ""));
        } catch (IllegalArgumentException error) {
            throw new IllegalArgumentException("Invalid GitLite remote URL.", error);
        }
    }

    private URI remoteUri(URI remote, String branch) {
        return URI.create(remote + "?branch=" + URLEncoder.encode(branch, StandardCharsets.UTF_8));
    }

    private RemoteResponse download(URI remote, String branch, String token) {
        HttpRequest request = HttpRequest.newBuilder(remoteUri(remote, branch))
                .timeout(Duration.ofSeconds(60))
                .header("Authorization", "Bearer " + token)
                .GET()
                .build();
        HttpResponse<byte[]> response = send(request, HttpResponse.BodyHandlers.ofByteArray());
        requireSuccess(response.statusCode(), new String(response.body(), StandardCharsets.UTF_8));
        if (response.body().length > MAX_BUNDLE_BYTES) {
            throw new IllegalStateException("Remote repository exceeds the 20 MB sync limit.");
        }
        String head = response.headers().firstValue("X-GitLite-Head")
                .filter(value -> !value.equals("empty")).orElse("");
        return new RemoteResponse(response.body(), head);
    }

    private <T> HttpResponse<T> send(HttpRequest request, HttpResponse.BodyHandler<T> handler) {
        try {
            return HTTP.send(request, handler);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Remote operation was interrupted.", error);
        } catch (IOException error) {
            throw new IllegalStateException("Could not connect to the GitLite remote.", error);
        }
    }

    private void requireSuccess(int statusCode, String body) {
        if (statusCode < 200 || statusCode >= 300) {
            throw new IllegalStateException("GitLite remote returned HTTP " + statusCode + ": " + body);
        }
    }

    private Map<String, byte[]> createBundle(Path root) {
        Map<String, byte[]> files = new HashMap<>();
        collectFiles(root, Path.of(".gitlite"), files);
        collectFiles(root, Path.of("working"), files);
        files.remove(".gitlite/remote-url");
        if (files.isEmpty() || files.size() > MAX_BUNDLE_ENTRIES) {
            throw new IllegalStateException("Repository has an invalid number of files to sync.");
        }
        return files;
    }

    private void collectFiles(Path root, Path relativeDirectory, Map<String, byte[]> files) {
        Path directory = root.resolve(relativeDirectory);
        if (!Files.isDirectory(directory)) return;
        try (var paths = Files.walk(directory)) {
            for (Path file : paths.filter(Files::isRegularFile).toList()) {
                if (Files.isSymbolicLink(file)) {
                    throw new IllegalStateException("Repositories cannot contain symbolic links.");
                }
                String relative = root.relativize(file).toString().replace('\\', '/');
                if (relative.equals(".gitlite/remote-url")) continue;
                validateBundlePath(relative);
                byte[] contents = Files.readAllBytes(file);
                files.put(relative, contents);
            }
        } catch (IOException error) {
            throw new IllegalStateException("Could not read local repository files.", error);
        }
    }

    private byte[] serializeBundle(Map<String, byte[]> files) {
        try {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            try (DataOutputStream output = new DataOutputStream(bytes)) {
                output.write(MAGIC);
                output.writeInt(files.size());
                for (Map.Entry<String, byte[]> entry : files.entrySet().stream()
                        .sorted(Map.Entry.comparingByKey()).toList()) {
                    byte[] pathBytes = entry.getKey().getBytes(StandardCharsets.UTF_8);
                    if (pathBytes.length == 0 || pathBytes.length > 4096) {
                        throw new IllegalArgumentException("Repository path is too long.");
                    }
                    output.writeShort(pathBytes.length);
                    output.write(pathBytes);
                    output.writeLong(entry.getValue().length);
                    output.write(entry.getValue());
                    if (bytes.size() > MAX_BUNDLE_BYTES) {
                        throw new IllegalStateException("Repository exceeds the 20 MB sync limit.");
                    }
                }
            }
            return bytes.toByteArray();
        } catch (IOException error) {
            throw new IllegalStateException("Could not encode repository bundle.", error);
        }
    }

    private Map<String, byte[]> parseBundle(byte[] bundle) {
        if (bundle.length > MAX_BUNDLE_BYTES) throw new IllegalArgumentException("Repository exceeds the 20 MB sync limit.");
        Map<String, byte[]> files = new HashMap<>();
        try (DataInputStream input = new DataInputStream(new ByteArrayInputStream(bundle))) {
            byte[] magic = input.readNBytes(4);
            if (!java.util.Arrays.equals(magic, MAGIC)) throw new IllegalArgumentException("Invalid GitLite bundle.");
            int count = input.readInt();
            if (count < 1 || count > MAX_BUNDLE_ENTRIES) throw new IllegalArgumentException("Invalid bundle file count.");
            for (int index = 0; index < count; index++) {
                int pathLength = input.readUnsignedShort();
                if (pathLength < 1 || pathLength > 4096) throw new IllegalArgumentException("Invalid bundle path.");
                String relativePath = new String(input.readNBytes(pathLength), StandardCharsets.UTF_8);
                validateBundlePath(relativePath);
                long contentLength = input.readLong();
                if (contentLength < 0 || contentLength > MAX_BUNDLE_BYTES
                        || contentLength > input.available()) {
                    throw new IllegalArgumentException("Invalid bundle file size.");
                }
                byte[] contents = input.readNBytes((int) contentLength);
                if (contents.length != contentLength || files.putIfAbsent(relativePath, contents) != null) {
                    throw new IllegalArgumentException("Truncated or duplicate bundle entry.");
                }
            }
            if (input.available() != 0) throw new IllegalArgumentException("Bundle contains trailing data.");
        } catch (IOException error) {
            throw new IllegalArgumentException("Could not read GitLite bundle.", error);
        }
        return files;
    }

    private void validateBundlePath(String path) {
        String normalized = path.replace('\\', '/');
        if (normalized.startsWith("/") || normalized.matches("^[A-Za-z]:.*")
                || !(normalized.startsWith(".gitlite/") || normalized.startsWith("working/"))
                || normalized.equals(".gitlite/remote-url")) {
            throw new IllegalArgumentException("Bundle contains an invalid repository path.");
        }
        for (String segment : normalized.split("/")) {
            if (segment.isBlank() || segment.equals(".") || segment.equals("..")) {
                throw new IllegalArgumentException("Bundle contains a traversal path.");
            }
        }
    }

    private void validateRepositoryBundle(Map<String, byte[]> files) {
        String head = new String(files.getOrDefault(".gitlite/HEAD", new byte[0]), StandardCharsets.UTF_8).trim();
        validateBranch(head);
        if (!files.containsKey(".gitlite/branches/" + head + ".txt")) {
            throw new IllegalArgumentException("Bundle has no current branch pointer.");
        }
        branchHead(files, head);
        for (String path : files.keySet()) {
            if (path.startsWith(".gitlite/staging/")) {
                throw new IllegalArgumentException("Cannot sync a repository with staged files.");
            }
        }
    }

    private String branchHead(Map<String, byte[]> files, String branch) {
        validateBranch(branch);
        String value = new String(files.getOrDefault(".gitlite/branches/" + branch + ".txt", new byte[0]),
                StandardCharsets.UTF_8).trim();
        if (!value.isEmpty() && !value.matches("[a-fA-F0-9]{64}")) {
            throw new IllegalArgumentException("Repository contains an invalid commit pointer.");
        }
        return value;
    }

    private boolean isAncestor(Map<String, byte[]> files, String ancestor, String descendant) {
        if (ancestor.isEmpty()) return true;
        String current = descendant;
        Set<String> visited = new java.util.HashSet<>();
        while (!current.isEmpty() && visited.add(current)) {
            if (current.equalsIgnoreCase(ancestor)) return true;
            byte[] metadataBytes = files.get(".gitlite/commits/" + current + "/metadata.txt");
            if (metadataBytes == null) return false;
            String metadata = new String(metadataBytes, StandardCharsets.UTF_8);
            current = metadata.lines()
                    .filter(line -> line.startsWith("Parent :"))
                    .map(line -> line.substring("Parent :".length()).trim())
                    .findFirst().orElse("");
        }
        return false;
    }

    private String currentBranch(Path root) {
        try {
            String branch = Files.readString(root.resolve(".gitlite/HEAD"), StandardCharsets.UTF_8).trim();
            validateBranch(branch);
            return branch;
        } catch (IOException error) {
            throw new IllegalStateException("Run init or clone before using a remote.", error);
        }
    }

    private void validateBranch(String branch) {
        if (branch == null || !branch.matches("[A-Za-z0-9][A-Za-z0-9._-]{0,99}")) {
            throw new IllegalArgumentException("Repository contains an invalid branch name.");
        }
    }

    private String readRemoteUrl(Path root) {
        try {
            return Files.readString(root.resolve(".gitlite/remote-url"), StandardCharsets.UTF_8).trim();
        } catch (IOException error) {
            throw new IllegalStateException("No GitLite remote is configured. Clone the web repository first.", error);
        }
    }

    private void requireCleanWorkingTree(Path root, String branch) {
        Path staging = root.resolve(".gitlite/staging");
        try {
            if (Files.isDirectory(staging)) {
                try (var paths = Files.walk(staging)) {
                    if (paths.anyMatch(Files::isRegularFile)) {
                        throw new IllegalStateException("Commit or unstage changes before syncing.");
                    }
                }
            }
            String commit = Files.readString(root.resolve(".gitlite/branches").resolve(branch + ".txt"),
                    StandardCharsets.UTF_8).trim();
            Path snapshot = commit.isEmpty() ? null
                    : root.resolve(".gitlite/commits").resolve(commit).resolve("snapshot/working");
            Path working = root.resolve("working");
            List<Path> workingFiles = listFiles(working);
            List<Path> trackedFiles = snapshot == null ? List.of() : listFiles(snapshot);
            if (workingFiles.size() != trackedFiles.size()) {
                throw new IllegalStateException("Commit or remove untracked/modified files before syncing.");
            }
            for (int index = 0; index < workingFiles.size(); index++) {
                Path workingFile = workingFiles.get(index);
                Path relative = working.relativize(workingFile);
                Path trackedFile = snapshot.resolve(relative);
                if (!trackedFile.equals(trackedFiles.get(index))
                        || Files.mismatch(workingFile, trackedFile) != -1L) {
                    throw new IllegalStateException("Commit or remove untracked/modified files before syncing.");
                }
            }
        } catch (IOException error) {
            throw new IllegalStateException("Could not verify the local working tree.", error);
        }
    }

    private List<Path> listFiles(Path root) throws IOException {
        if (!Files.isDirectory(root)) return List.of();
        try (var paths = Files.walk(root)) {
            List<Path> result = new ArrayList<>();
            for (Path path : paths.toList()) {
                if (Files.isSymbolicLink(path)) {
                    throw new IllegalStateException("Repositories cannot contain symbolic links.");
                }
                if (Files.isRegularFile(path)) result.add(path);
            }
            result.sort(Comparator.naturalOrder());
            return result;
        }
    }

    private void installRepository(Path root, Map<String, byte[]> files, String remoteUrl) {
        Path absoluteRoot = root.toAbsolutePath().normalize();
        Path parent = absoluteRoot.getParent();
        if (parent == null) throw new IllegalArgumentException("Repository destination has no parent directory.");
        Path temporaryRoot;
        try {
            Files.createDirectories(parent);
            temporaryRoot = Files.createTempDirectory(parent, ".gitlite-sync-");
            for (Map.Entry<String, byte[]> entry : files.entrySet()) {
                validateBundlePath(entry.getKey());
                Path destination = temporaryRoot.resolve(entry.getKey()).normalize();
                if (!destination.startsWith(temporaryRoot)) {
                    throw new IllegalArgumentException("Bundle path escaped the temporary repository.");
                }
                Files.createDirectories(destination.getParent());
                Files.write(destination, entry.getValue());
            }
            Files.createDirectories(temporaryRoot.resolve(".gitlite/staging"));
            Files.createDirectories(temporaryRoot.resolve("working"));
        } catch (IOException error) {
            throw new IllegalStateException("Could not prepare repository files.", error);
        }

        Path backup = parent.resolve(".gitlite-backup-" + System.nanoTime());
        Path temporaryGit = temporaryRoot.resolve(".gitlite");
        Path temporaryWorking = temporaryRoot.resolve("working");
        boolean movedGit = false;
        boolean movedWorking = false;
        try {
            Files.createDirectories(backup);
            if (Files.exists(absoluteRoot.resolve(".gitlite"))) {
                Files.move(absoluteRoot.resolve(".gitlite"), backup.resolve(".gitlite"));
                movedGit = true;
            }
            if (Files.exists(absoluteRoot.resolve("working"))) {
                Files.move(absoluteRoot.resolve("working"), backup.resolve("working"));
                movedWorking = true;
            }
            Files.createDirectories(absoluteRoot);
            Files.move(temporaryGit, absoluteRoot.resolve(".gitlite"));
            Files.move(temporaryWorking, absoluteRoot.resolve("working"));
            Files.writeString(absoluteRoot.resolve(".gitlite/remote-url"), remoteUrl, StandardCharsets.UTF_8);
            deleteRecursively(backup);
            deleteRecursively(temporaryRoot);
        } catch (IOException error) {
            try {
                deleteRecursively(absoluteRoot.resolve(".gitlite"));
                deleteRecursively(absoluteRoot.resolve("working"));
                if (movedGit) Files.move(backup.resolve(".gitlite"), absoluteRoot.resolve(".gitlite"));
                if (movedWorking) Files.move(backup.resolve("working"), absoluteRoot.resolve("working"));
                deleteRecursively(backup);
                deleteRecursively(temporaryRoot);
            } catch (IOException rollbackError) {
                error.addSuppressed(rollbackError);
            }
            throw new IllegalStateException("Could not install repository files.", error);
        }
    }

    private void restoreWorkingTree(Path root, String branch, String commitId) {
        Path working = root.resolve("working");
        Path snapshot = commitId.isEmpty() ? null
                : root.resolve(".gitlite/commits").resolve(commitId).resolve("snapshot/working");
        try {
            deleteRecursively(working);
            Files.createDirectories(working);
            if (snapshot != null && Files.isDirectory(snapshot)) {
                try (var files = Files.walk(snapshot)) {
                    for (Path source : files.toList()) {
                        Path relative = snapshot.relativize(source);
                        Path destination = working.resolve(relative);
                        if (Files.isSymbolicLink(source)) {
                            throw new IllegalStateException("Remote snapshot contains a symbolic link.");
                        }
                        if (Files.isDirectory(source)) Files.createDirectories(destination);
                        else {
                            Files.createDirectories(destination.getParent());
                            Files.copy(source, destination, StandardCopyOption.REPLACE_EXISTING);
                        }
                    }
                }
            }
            writeCurrentBranch(root, branch);
        } catch (IOException error) {
            throw new IllegalStateException("Could not restore the synced working tree.", error);
        }
    }

    private void writeCurrentBranch(Path root, String branch) {
        validateBranch(branch);
        try {
            Files.writeString(root.resolve(".gitlite/HEAD"), branch, StandardCharsets.UTF_8);
        } catch (IOException error) {
            throw new IllegalStateException("Could not restore the current branch.", error);
        }
    }

    private void deleteRecursively(Path root) throws IOException {
        if (!Files.exists(root)) return;
        if (Files.isSymbolicLink(root)) {
            Files.delete(root);
            return;
        }
        try (var paths = Files.walk(root)) {
            for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) {
                Files.deleteIfExists(path);
            }
        }
    }

    private record RemoteResponse(byte[] body, String head) {}
}
