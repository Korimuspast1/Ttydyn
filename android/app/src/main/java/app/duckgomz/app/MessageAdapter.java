package app.duckgomz.app;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public final class MessageAdapter extends RecyclerView.Adapter<MessageAdapter.MessageHolder> {
    public interface FileClickListener {
        void onFileClick(ChatMessage message);
    }

    private static final int TEXT = Color.rgb(244, 245, 250);
    private static final int INCOMING = Color.rgb(43, 45, 62);
    private static final int OUTGOING = Color.rgb(83, 107, 225);
    private static final int SECONDARY = Color.rgb(185, 190, 207);
    private static final int ACCENT = Color.rgb(145, 164, 255);

    private final Context context;
    private final FileClickListener fileClickListener;
    private final List<ChatMessage> messages = new ArrayList<>();
    private boolean groupChat;

    public MessageAdapter(Context context, FileClickListener fileClickListener, boolean groupChat) {
        this.context = context;
        this.fileClickListener = fileClickListener;
        this.groupChat = groupChat;
        setHasStableIds(true);
    }

    public void setGroupChat(boolean value) {
        groupChat = value;
    }

    public void setMessages(List<ChatMessage> next) {
        messages.clear();
        messages.addAll(next);
        notifyDataSetChanged();
    }

    public void addMessage(ChatMessage message) {
        messages.add(message);
        notifyItemInserted(messages.size() - 1);
    }

    @Override
    public long getItemId(int position) {
        return messages.get(position).id.hashCode();
    }

    @NonNull
    @Override
    public MessageHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        LinearLayout row = new LinearLayout(context);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.BOTTOM);
        row.setPadding(dp(12), dp(3), dp(12), dp(3));
        row.setLayoutParams(new RecyclerView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        return new MessageHolder(row);
    }

    @Override
    public void onBindViewHolder(@NonNull MessageHolder holder, int position) {
        ChatMessage message = messages.get(position);
        LinearLayout row = holder.row;
        row.removeAllViews();
        boolean incoming = message.fromBot;
        row.setGravity(incoming ? Gravity.START | Gravity.BOTTOM : Gravity.END | Gravity.BOTTOM);
        if (!incoming) row.addView(new View(context), new LinearLayout.LayoutParams(0, 1, 1f));

        LinearLayout bubble = new LinearLayout(context);
        bubble.setOrientation(LinearLayout.VERTICAL);
        bubble.setPadding(dp(12), dp(8), dp(12), dp(5));
        float large = dp(18);
        float small = dp(5);
        GradientDrawable bubbleBackground = new GradientDrawable();
        bubbleBackground.setColor(incoming ? INCOMING : OUTGOING);
        bubbleBackground.setCornerRadii(incoming
                ? new float[]{large, large, large, large, large, large, small, small}
                : new float[]{large, large, large, large, small, small, large, large});
        bubble.setBackground(bubbleBackground);

        int maxWidth = dp(maxContentDp());
        if (groupChat && incoming && !message.senderUsername.isEmpty()) {
            TextView sender = new TextView(context);
            sender.setText("@" + message.senderUsername);
            sender.setTextColor(ACCENT);
            sender.setTextSize(12);
            sender.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
            LinearLayout.LayoutParams senderParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            senderParams.bottomMargin = dp(3);
            bubble.addView(sender, senderParams);
        }

        if (!message.text.trim().isEmpty()) {
            TextView text = new TextView(context);
            text.setText(message.text);
            text.setTextColor(TEXT);
            text.setTextSize(15);
            text.setLineSpacing(dp(1), 1f);
            text.setMaxWidth(maxWidth);
            bubble.addView(text, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        }

        if (message.hasFile()) {
            LinearLayout file = new LinearLayout(context);
            file.setOrientation(LinearLayout.HORIZONTAL);
            file.setGravity(Gravity.CENTER_VERTICAL);
            file.setPadding(dp(9), dp(8), dp(10), dp(8));
            GradientDrawable fileBackground = new GradientDrawable();
            fileBackground.setColor(incoming ? Color.rgb(55, 58, 77) : Color.rgb(71, 94, 205));
            fileBackground.setCornerRadius(dp(12));
            file.setBackground(fileBackground);
            LinearLayout.LayoutParams fileParams = new LinearLayout.LayoutParams(maxWidth, ViewGroup.LayoutParams.WRAP_CONTENT);
            fileParams.topMargin = message.text.trim().isEmpty() ? 0 : dp(7);
            bubble.addView(file, fileParams);

            ImageView fileIcon = new ImageView(context);
            fileIcon.setImageResource(R.drawable.ic_file);
            fileIcon.setColorFilter(ACCENT);
            fileIcon.setPadding(dp(4), dp(4), dp(4), dp(4));
            file.addView(fileIcon, new LinearLayout.LayoutParams(dp(31), dp(34)));

            LinearLayout fileCopy = new LinearLayout(context);
            fileCopy.setOrientation(LinearLayout.VERTICAL);
            fileCopy.setPadding(dp(8), 0, 0, 0);
            file.addView(fileCopy, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));

            TextView fileName = new TextView(context);
            fileName.setText(message.fileName.isEmpty() ? "Attachment" : message.fileName);
            fileName.setTextColor(TEXT);
            fileName.setTextSize(12);
            fileName.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
            fileName.setMaxLines(1);
            fileName.setEllipsize(android.text.TextUtils.TruncateAt.END);
            fileCopy.addView(fileName);

            TextView fileInfo = new TextView(context);
            fileInfo.setText(fileSize(message.fileSize) + " · " + shortMime(message.mimeType));
            fileInfo.setTextColor(SECONDARY);
            fileInfo.setTextSize(10);
            LinearLayout.LayoutParams fileInfoParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            fileInfoParams.topMargin = dp(3);
            fileCopy.addView(fileInfo, fileInfoParams);
            file.setOnClickListener(view -> fileClickListener.onFileClick(message));
        }

        LinearLayout metadata = new LinearLayout(context);
        metadata.setOrientation(LinearLayout.HORIZONTAL);
        metadata.setGravity(Gravity.CENTER_VERTICAL | Gravity.RIGHT);
        LinearLayout.LayoutParams metaParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        metaParams.topMargin = dp(3);
        bubble.addView(metadata, metaParams);

        TextView time = new TextView(context);
        time.setText(new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date(message.timestamp)));
        time.setTextColor(incoming ? SECONDARY : Color.rgb(220, 225, 255));
        time.setTextSize(9);
        metadata.addView(time);

        row.addView(bubble, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
    }

    @Override
    public int getItemCount() {
        return messages.size();
    }

    private String fileSize(long bytes) {
        if (bytes <= 0) return "File";
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format(Locale.getDefault(), "%.0f KB", bytes / 1024f);
        return String.format(Locale.getDefault(), "%.1f MB", bytes / (1024f * 1024f));
    }

    private String shortMime(String mime) {
        if (mime == null || mime.isEmpty()) return "File";
        if (mime.equals("application/pdf")) return "PDF";
        if (mime.startsWith("image/")) return "Image";
        if (mime.startsWith("video/")) return "Video";
        if (mime.startsWith("audio/")) return "Audio";
        return "File";
    }

    private int maxContentDp() {
        float density = context.getResources().getDisplayMetrics().density;
        int widthDp = (int) (context.getResources().getDisplayMetrics().widthPixels / density);
        return Math.max(168, Math.min(286, widthDp - 56));
    }

    private int dp(float value) {
        return (int) (value * context.getResources().getDisplayMetrics().density + .5f);
    }

    static final class MessageHolder extends RecyclerView.ViewHolder {
        final LinearLayout row;
        MessageHolder(@NonNull LinearLayout itemView) {
            super(itemView);
            row = itemView;
        }
    }
}
