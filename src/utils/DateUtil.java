package utils;

import java.time.Instant;

public class DateUtil {

    public static String getCurrentDateTime() {

        return Instant.now().toString();

    }

}