package app.duckgomz.app;

/*
 * Username rules adapted from Telegram for Android's
 * ChangeUsernameActivity.checkUserName implementation.
 * Upstream: https://github.com/DrKLO/Telegram/blob/f32ffeec763f0bdbf4bec25b52d654f77bff733d/TMessagesProj/src/main/java/org/telegram/ui/ChangeUsernameActivity.java
 * Copyright Nikolai Kudashov, 2013-2018. Licensed under GNU GPL v2 or later; see /LICENSE.
 * Adaptation: extracted the validation rules from Telegram's Android UI/network flow.
 */
public final class UsernameRules {
    private UsernameRules() {}

    public static String validate(String input) {
        if (input == null) return "Укажи имя пользователя.";
        String username = input.trim();
        if (username.startsWith("@")) username = username.substring(1);
        if (username.isEmpty()) return "Укажи имя пользователя.";
        if (username.startsWith("_") || username.endsWith("_")) {
            return "Имя не может начинаться или заканчиваться символом _.";
        }

        for (int i = 0; i < username.length(); i++) {
            char ch = username.charAt(i);
            if (i == 0 && ch >= '0' && ch <= '9') {
                return "Имя пользователя не может начинаться с цифры.";
            }
            boolean digit = ch >= '0' && ch <= '9';
            boolean lowercase = ch >= 'a' && ch <= 'z';
            boolean uppercase = ch >= 'A' && ch <= 'Z';
            if (!(digit || lowercase || uppercase || ch == '_')) {
                return "Разрешены только латинские буквы, цифры и _.";
            }
        }

        if (username.length() < 4) return "Минимальная длина имени — 4 символа.";
        if (username.length() > 32) return "Максимальная длина имени — 32 символа.";
        return null;
    }

    public static String normalize(String input) {
        String value = input == null ? "" : input.trim();
        if (value.startsWith("@")) value = value.substring(1);
        return value.toLowerCase(java.util.Locale.ROOT);
    }
}
