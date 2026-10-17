package app.duckgomz.app;

import org.json.JSONException;
import org.json.JSONObject;

public final class ChatMessage {
    public final String id;
    /** True when this message is from the bot or another chat member. */
    public final boolean fromBot;
    public final String senderUsername;
    public final String text;
    public final long timestamp;
    public final String fileName;
    /** A content URI for the local bot chat, or a Firebase Storage object path for cloud chats. */
    public final String fileUri;
    public final String mimeType;
    public final long fileSize;

    public ChatMessage(String id, boolean fromBot, String text, long timestamp,
                       String fileName, String fileUri, String mimeType, long fileSize) {
        this(id, fromBot, "", text, timestamp, fileName, fileUri, mimeType, fileSize);
    }

    public ChatMessage(String id, boolean fromBot, String senderUsername, String text, long timestamp,
                       String fileName, String fileUri, String mimeType, long fileSize) {
        this.id = id == null ? "" : id;
        this.fromBot = fromBot;
        this.senderUsername = senderUsername == null ? "" : senderUsername;
        this.text = text == null ? "" : text;
        this.timestamp = timestamp;
        this.fileName = fileName == null ? "" : fileName;
        this.fileUri = fileUri == null ? "" : fileUri;
        this.mimeType = mimeType == null || mimeType.isEmpty() ? "application/octet-stream" : mimeType;
        this.fileSize = fileSize;
    }

    public boolean hasFile() {
        return !fileUri.isEmpty() || !fileName.isEmpty();
    }

    public JSONObject toJson() throws JSONException {
        JSONObject object = new JSONObject();
        object.put("id", id);
        object.put("fromBot", fromBot);
        object.put("senderUsername", senderUsername);
        object.put("text", text);
        object.put("timestamp", timestamp);
        object.put("fileName", fileName);
        object.put("fileUri", fileUri);
        object.put("mimeType", mimeType);
        object.put("fileSize", fileSize);
        return object;
    }

    public static ChatMessage fromJson(JSONObject object) throws JSONException {
        return new ChatMessage(
                object.optString("id", String.valueOf(System.nanoTime())),
                object.optBoolean("fromBot", false),
                object.optString("senderUsername", ""),
                object.optString("text", ""),
                object.optLong("timestamp", System.currentTimeMillis()),
                object.optString("fileName", ""),
                object.optString("fileUri", ""),
                object.optString("mimeType", "application/octet-stream"),
                object.optLong("fileSize", 0)
        );
    }
}
