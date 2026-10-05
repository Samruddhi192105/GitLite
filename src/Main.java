import commands.AddCommand;
import commands.CommitCommand;
import commands.InitCommand;
import commands.LogCommand;
import commands.StatusCommand;
import commands.SwitchBranchCommand;
import commands.CheckoutCommand;
import commands.BranchCommand;
import commands.BranchesCommand;
import services.MoveService;
import services.RemoveService;
import services.RemoteSyncService;

public class Main {

    public static void main(String[] args) {

        if (args.length == 0) {
            printUsage();
            System.exit(2);
            return;
        }

        String command = args[0].toLowerCase();

        try {
            switch (command) {

            case "init":

                InitCommand initCommand = new InitCommand();
                initCommand.execute();
                break;

            case "add":

                if (args.length < 2) {
                    throw new IllegalArgumentException("Usage: java Main add <filename>");
                }

                AddCommand addCommand = new AddCommand();
                addCommand.execute(args[1]);
                break;

            case "commit":

                if (args.length < 2) {
                    throw new IllegalArgumentException("Usage: java Main commit \"Commit Message\"");
                }

                StringBuilder message = new StringBuilder();
                String authorName = System.getProperty("user.name", "GitLite User");
                String authorEmail = System.getProperty("user.email", "");
                for (int i = 1; i < args.length; i++) {
                    if (args[i].equals("--author-name") || args[i].equals("--author-email")) {
                        if (i + 1 >= args.length) {
                            throw new IllegalArgumentException(args[i] + " requires a value.");
                        }
                        if (args[i].equals("--author-name")) {
                            authorName = args[++i];
                        } else {
                            authorEmail = args[++i];
                        }
                    } else {
                        if (message.length() > 0) message.append(" ");
                        message.append(args[i]);
                    }
                }

                CommitCommand commitCommand = new CommitCommand();
                commitCommand.execute(message.toString(), authorName, authorEmail);

                break;

            case "status":
                StatusCommand statusCommand = new StatusCommand();
                statusCommand.execute();
                break;

            case "log":

                LogCommand logCommand = new LogCommand();
                logCommand.execute();
                break;

            case "checkout":

                if (args.length < 2) {
                    throw new IllegalArgumentException("Usage: checkout <commit-id>");
                }

                CheckoutCommand checkoutCommand =
                        new CheckoutCommand();

                checkoutCommand.execute(args[1]);

                break;

            case "branch":

                if (args.length < 2) {
                    throw new IllegalArgumentException("Usage: branch <branch-name>");
                }

                BranchCommand branchCommand =
                        new BranchCommand();

                branchCommand.execute(args[1]);

                break;

            case "branches":

                BranchesCommand branchesCommand = new BranchesCommand();
                branchesCommand.execute();
                break;

            case "switch":

                if (args.length < 2) {
                    throw new IllegalArgumentException("Usage: switch <branch-name>");
                }

                SwitchBranchCommand switchBranchCommand =
                        new SwitchBranchCommand();

                switchBranchCommand.execute(args[1]);

                break;

            case "remove":
            case "rm":
                if (args.length < 2) {
                    throw new IllegalArgumentException("Usage: remove working/<filename>");
                }
                new RemoveService().remove(args[1]);
                break;

            case "move":
            case "mv":
                if (args.length < 3) {
                    throw new IllegalArgumentException("Usage: move working/<old-path> working/<new-path>");
                }
                new MoveService().move(args[1], args[2]);
                break;

            case "clone":
                if (args.length < 3) {
                    throw new IllegalArgumentException("Usage: clone <GitLite-remote-URL> <directory>");
                }
                new RemoteSyncService().cloneRepository(args[1], args[2]);
                break;

            case "push":
                new RemoteSyncService().push();
                break;

            case "pull":
                new RemoteSyncService().pull();
                break;

            default:
                throw new IllegalArgumentException("Unknown command: " + command);
            }
        } catch (RuntimeException error) {
            System.err.println(error.getMessage());
            System.exit(1);
        }

    }

    private static void printUsage() {

        System.out.println("==================================");
        System.out.println("        GitLite Version 1.0");
        System.out.println("==================================");
        System.out.println("Available Commands:");
        System.out.println();

        System.out.println("init");
        System.out.println("    Initialize a new repository");
        System.out.println();
        System.out.println("add <filename>");
        System.out.println("    Stage a file");
        System.out.println();
        System.out.println("commit \"message\"");
        System.out.println("    Create a new commit");
        System.out.println();

    }

}