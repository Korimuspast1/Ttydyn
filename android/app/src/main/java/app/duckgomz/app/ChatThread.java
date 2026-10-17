package app.duckgomz.app;

import com.google.firebase.Timestamp;
import com.google.firebase.firestore.DocumentSnapshot;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class ChatThread {
    public final String id;
    public final String type;
    public final String title;
    public final String lastMessage;
    public final long updatedAt;
    public final List<String> members;
    public final Map<String, String> memberNames;

    public ChatThread(String id, String type, String title, String lastMessage, long updatedAt,
                      List<String> members, Map<String, String> memberNames) {
        this.id = id == null ? "" : id;
        this.type = type == null ? "direct" : type;
        this.title = title == null ? "" : title;
        this.lastMessage = lastMessage == null ? "" : lastMessage;
        this.updatedAt = updatedAt;
        this.members = members == null ? new ArrayList<>() : new ArrayList<>(members);
        this.memberNames = memberNames == null ? new HashMap<>() : new HashMap<>(memberNames);
    }

    public boolean isGroup() {
        return "group".equals(type);
    }

    public boolean isBot() {
        return "bot".equals(type);
    }

    public String displayName(String currentUid) {
        if (isBot()) return "Duckgomz";
        if (isGroup()) return title.isEmpty() ? "Group" : title;
        for (String member : members) {
            if (!member.equals(currentUid)) {
                String name = memberNames.get(member);
                if (name != null && !name.isEmpty()) return "@" + name;
            }
        }
        return "Private chat";
    }

    public static ChatThread fromDocument(DocumentSnapshot document) {
        List<String> members = new ArrayList<>();
        Object rawMembers = document.get("members");
        if (rawMembers instanceof List<?>) {
            for (Object value : (List<?>) rawMembers) {
                if (value instanceof String) members.add((String) value);
            }
        }

        Map<String, String> memberNames = new HashMap<>();
        Object rawNames = document.get("memberNames");
        if (rawNames instanceof Map<?, ?>) {
            for (Map.Entry<?, ?> entry : ((Map<?, ?>) rawNames).entrySet()) {
                if (entry.getKey() instanceof String && entry.getValue() instanceof String) {
                    memberNames.put((String) entry.getKey(), (String) entry.getValue());
                }
            }
        }

        Timestamp updated = document.getTimestamp("updatedAt");
        return new ChatThread(
                document.getId(),
                document.getString("type"),
                document.getString("title"),
                document.getString("lastMessage"),
                updated == null ? 0 : updated.toDate().getTime(),
                members,
                memberNames
        );
    }
}
