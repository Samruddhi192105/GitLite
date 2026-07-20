package storage;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
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

            e.printStackTrace();
            return false;

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

            e.printStackTrace();
            return false;

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

        java.io.FileWriter writer =
                new java.io.FileWriter(path);

        writer.write(content);

        writer.close();

    } catch (Exception e) {

        e.printStackTrace();

    }

    }

    public String readFile(String path) {

    try {

        return Files.readString(
                new File(path).toPath());

    } catch (Exception e) {

        return "";

    }

    }

    public File[] listFiles(String path) {

    File folder = new File(path);

    return folder.listFiles();

    }

    public void deleteAllFiles(String path) {

    File folder = new File(path);

    File[] files = folder.listFiles();

    if (files == null)
        return;

    for (File file : files) {

        file.delete();

    }

    }

    public String[] readLines(String path) {

    try {

        return Files.readAllLines(
                new File(path).toPath())
                .toArray(new String[0]);

    } catch (Exception e) {

        return new String[0];

    }

    }

    public void copyDirectory(File source, File destination) {

    if (!source.exists()) {
        return;
    }

    if (!destination.exists()) {
        destination.mkdirs();
    }

    File[] files = source.listFiles();

    if (files == null) {
        return;
    }

    for (File file : files) {

        File target = new File(destination, file.getName());

        if (file.isDirectory()) {

            copyDirectory(file, target);

        } else {

            copyFile(file.getPath(), target.getPath());

        }
    }
    }

}