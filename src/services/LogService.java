package services;

import constants.RepositoryConstants;
import storage.FileManager;

import java.io.File;
import java.util.Arrays;
import java.util.Comparator;

public class LogService {

    private final FileManager fileManager =
            new FileManager();

    public void showLog() {

        String commitsPath =
                RepositoryConstants.REPOSITORY_FOLDER
                        + File.separator
                        + RepositoryConstants.COMMITS_FOLDER;

        File[] commits =
                fileManager.listFiles(commitsPath);

        if (commits == null || commits.length == 0) {

            System.out.println("No commits found.");

            return;

        }

        Arrays.sort(commits,
                Comparator.comparingLong(File::lastModified)
                        .reversed());

        System.out.println();
        System.out.println("========== Commit History ==========");
        System.out.println();

        for (File commit : commits) {

            File metadata =
                    new File(commit, "metadata.txt");

            String[] lines =
                    fileManager.readLines(metadata.getPath());

            for (String line : lines) {

                System.out.println(line);

            }

            System.out.println();
            System.out.println("------------------------------------");
            System.out.println();

        }

    }

}