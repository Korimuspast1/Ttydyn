package app.duckgomz.app;

import org.json.JSONException;
import org.json.JSONObject;

public final class ChatMessage {
    public final String id;
    public final boolean fromBot;
    public final String text;
    public final long timestamp;
    public final String fileName;
    public final String fileUri;
    public final String mimeType;
    public final long fileSize;

    public ChatMessage(String id, boolean fromBot, String text, long timestamp,
                       String fileName, String fileUri, String mimeType, long fileSize) {
        this.id = id;
        this.fromBot = fromBot;
        this.text = text == null ? "" : text;
        this.timestamp = timestamp;
        this.fileName = fileName == null ? "" : fileName;
        this.fileUri = fileUri == null ? "" : fileUri;
        this.mimeType = mimeType == null ? "application/octet-stream" : mimeType;
        this.fileSize = fileSize;
    }

    public boolean hasFile() {
        return !fileUri.isEmpty() || !fileName.isEmpty();
    }

    public JSONObject toJson() throws JSONException {
        JSONObject object = new JSONObject();
        object.put("id", id);
        object.put("fromBot", fromBot);
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
                object.optString("text", ""),
                object.optLong("timestamp", System.currentTimeMillis()),
                object.optString("fileName", ""),
                object.optString("fileUri", ""),
                object.optString("mimeType", "application/octet-stream"),
                object.optLong("fileSize", 0)
        );
    }
}
