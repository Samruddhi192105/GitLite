import commands.AddCommand;
import commands.CommitCommand;
import commands.InitCommand;
import commands.LogCommand;
import commands.StatusCommand;
import commands.SwitchBranchCommand;
import commands.CheckoutCommand;
import commands.BranchCommand;
import commands.BranchesCommand;

public class Main {

    public static void main(String[] args) {

        if (args.length == 0) {
            printUsage();
            return;
        }

        String command = args[0].toLowerCase();

        switch (command) {

            case "init":

                InitCommand initCommand = new InitCommand();
                initCommand.execute();
                break;

            case "add":

                if (args.length < 2) {
                    System.out.println("Usage: java Main add <filename>");
                    return;
                }

                AddCommand addCommand = new AddCommand();
                addCommand.execute(args[1]);
                break;

            case "commit":

                if (args.length < 2) {
                    System.out.println("Usage: java Main commit \"Commit Message\"");
                    return;
                }

                StringBuilder message = new StringBuilder();

                for (int i = 1; i < args.length; i++) {

                    message.append(args[i]);

                    if (i != args.length - 1) {
                        message.append(" ");
                    }
                }

                CommitCommand commitCommand = new CommitCommand();
                commitCommand.execute(message.toString());

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

                    System.out.println("Usage: checkout <commit-id>");
                    return;

                }

                CheckoutCommand checkoutCommand =
                        new CheckoutCommand();

                checkoutCommand.execute(args[1]);

                break;

            case "branch":

                if (args.length < 2) {

                    System.out.println("Usage: branch <branch-name>");
                    return;

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

                    System.out.println("Usage: switch <branch-name>");
                    return;

                }

                SwitchBranchCommand switchBranchCommand =
                        new SwitchBranchCommand();

                switchBranchCommand.execute(args[1]);

                break;

            default:

                System.out.println("Unknown command: " + command);
                printUsage();

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