package utils;

import java.security.MessageDigest;

public class HashUtil {

    public static String generateHash(String text) {

        try {

            MessageDigest md =
                    MessageDigest.getInstance("SHA-256");

            byte[] hash =
                    md.digest(text.getBytes());

            StringBuilder builder =
                    new StringBuilder();

            for (byte b : hash) {

                builder.append(
                        String.format("%02x", b));

            }

            return builder.toString();

        }

        catch (Exception e) {

            return "";

        }

    }

}