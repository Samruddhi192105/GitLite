package storage;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

public class FileManager {

    // Create directory
    public boolean createDirectory(String path) {

        File directory = new File(path);

        if (directory.exists()) {
            return false;
        }

        return directory.mkdirs();
    }

    // Create file
    public boolean createFile(String path) {

        File file = new File(path);

        try {

            if (file.exists()) {
                return false;
            }

            return file.createNewFile();

        } catch (IOException e) {
            throw new IllegalStateException("Could not create file: " + path, e);

        }

    }

    // Copy file
    public boolean copyFile(String source, String destination) {

        try {

            Files.copy(
                    new File(source).toPath(),
                    new File(destination).toPath(),
                    StandardCopyOption.REPLACE_EXISTING);

            return true;

        } catch (IOException e) {
            throw new IllegalStateException("Could not copy file from " + source + " to " + destination, e);

        }

    }

    // Delete file
    public boolean deleteFile(String path) {

        File file = new File(path);

        return file.delete();

    }

    // Check if file exists
    public boolean exists(String path) {

        return new File(path).exists();

    }

    public void writeToFile(String path, String content) {
        try {
            Files.writeString(new File(path).toPath(), content, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Could not write file: " + path, e);
        }
    }

    public String readFile(String path) {
        try {
            return Files.readString(new File(path).toPath(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Could not read file: " + path, e);
        }
    }

    public File[] listFiles(String path) {

    File folder = new File(path);

    return folder.listFiles();

    }

    public void deleteAllFiles(String path) {
        File folder = new File(path);
        if (Files.isSymbolicLink(folder.toPath())) {
            throw new IllegalStateException("Cannot recursively delete a symbolic link: " + path);
        }
        File[] files = folder.listFiles();
        if (files == null) return;

        for (File file : files) {
            if (Files.isSymbolicLink(file.toPath())) {
                try {
                    Files.delete(file.toPath());
                } catch (IOException error) {
                    throw new IllegalStateException("Could not remove symbolic link: " + file.getPath(), error);
                }
            } else if (file.isDirectory()) {
                deleteAllFiles(file.getPath());
                if (!file.delete()) {
                    throw new IllegalStateException("Could not remove directory: " + file.getPath());
                }
            } else if (!file.delete()) {
                throw new IllegalStateException("Could not remove file: " + file.getPath());
            }
        }
    }

    public String[] readLines(String path) {
        try {
            return Files.readAllLines(Path.of(path), StandardCharsets.UTF_8).toArray(new String[0]);
        } catch (IOException error) {
            throw new IllegalStateException("Could not read lines from file: " + path, error);
        }
    }

    public void copyDirectory(File source, File destination) {
        if (Files.isSymbolicLink(source.toPath())) {
            throw new IllegalStateException("Cannot copy a symbolic link: " + source.getPath());
        }
        if (!source.exists()) return;
        if (!destination.exists() && !destination.mkdirs()) {
            throw new IllegalStateException("Could not create directory: " + destination.getPath());
        }

        File[] files = source.listFiles();
        if (files == null) {
            throw new IllegalStateException("Could not list directory: " + source.getPath());
        }

        for (File file : files) {
            File target = new File(destination, file.getName());
            if (Files.isSymbolicLink(file.toPath())) {
                throw new IllegalStateException("Cannot copy symbolic link: " + file.getPath());
            }
            if (file.isDirectory()) {
                copyDirectory(file, target);
            } else {
                copyFile(file.getPath(), target.getPath());
            }
        }
    }

}