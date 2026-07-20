package commands;

import services.CheckoutService;

public class CheckoutCommand {

    private final CheckoutService checkoutService =
            new CheckoutService();

    public void execute(String commitId) {

        checkoutService.checkout(commitId);

    }
}