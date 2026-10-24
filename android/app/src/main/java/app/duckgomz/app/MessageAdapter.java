package app.duckgomz.app;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.DecelerateInterpolator;
import android.view.animation.OvershootInterpolator;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
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
        void onDownloadClick(ChatMessage message);
        void loadImagePreview(ChatMessage message, ImageView target);
    }

    private static final int DEFAULT_TEXT = Color.rgb(244, 245, 250);
    private static final int DEFAULT_INCOMING = Color.rgb(43, 45, 62);
    private static final int DEFAULT_OUTGOING = Color.rgb(83, 107, 225);
    private static final int DEFAULT_SECONDARY = Color.rgb(185, 190, 207);
    private static final int DEFAULT_ACCENT = Color.rgb(145, 164, 255);

    private final Context context;
    private final FileClickListener fileClickListener;
    private final List<ChatMessage> messages = new ArrayList<>();
    private boolean groupChat;
    private boolean dayMode;
    private float messageTextSizeSp = 15f;
    private float bubbleCornerDp = 18f;
    private int incomingBubbleColor = DEFAULT_INCOMING;
    private int outgoingBubbleColor = DEFAULT_OUTGOING;
    private int incomingTextColor = DEFAULT_TEXT;
    private int outgoingTextColor = DEFAULT_TEXT;
    private int secondaryTextColor = DEFAULT_SECONDARY;
    private int senderAccentColor = DEFAULT_ACCENT;

    public MessageAdapter(Context context, FileClickListener fileClickListener, boolean groupChat) {
        this.context = context;
        this.fileClickListener = fileClickListener;
        this.groupChat = groupChat;
        setHasStableIds(true);
    }

    public void setGroupChat(boolean value) {
        groupChat = value;
        notifyDataSetChanged();
    }

    public void setAppearance(float textSizeSp, float cornerRadiusDp, boolean useDayMode,
                              int incomingColor, int outgoingColor, int incomingText,
                              int outgoingText, int secondaryColor, int senderAccent) {
        messageTextSizeSp = Math.max(13f, Math.min(25f, textSizeSp));
        bubbleCornerDp = Math.max(8f, Math.min(30f, cornerRadiusDp));
        dayMode = useDayMode;
        incomingBubbleColor = incomingColor;
        outgoingBubbleColor = outgoingColor;
        incomingTextColor = incomingText;
        outgoingTextColor = outgoingText;
        secondaryTextColor = secondaryColor;
        senderAccentColor = senderAccent;
        notifyDataSetChanged();
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
        float large = dp(bubbleCornerDp);
        float small = dp(Math.max(4f, bubbleCornerDp * .3f));
        GradientDrawable bubbleBackground = new GradientDrawable();
        bubbleBackground.setColor(incoming ? incomingBubbleColor : outgoingBubbleColor);
        bubbleBackground.setCornerRadii(incoming
                ? new float[]{large, large, large, large, large, large, small, small}
                : new float[]{large, large, large, large, small, small, large, large});
        bubble.setBackground(bubbleBackground);

        int maxWidth = dp(maxContentDp());
        if (groupChat && incoming && !message.senderUsername.isEmpty()) {
            TextView sender = new TextView(context);
            sender.setText("@" + message.senderUsername);
            sender.setTextColor(senderAccentColor);
            sender.setTextSize(12);
            sender.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
            LinearLayout.LayoutParams senderParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            senderParams.bottomMargin = dp(3);
            bubble.addView(sender, senderParams);
        }

        if (!message.text.trim().isEmpty()) {
            TextView text = new TextView(context);
            text.setText(message.text);
            text.setTextColor(incoming ? incomingTextColor : outgoingTextColor);
            text.setTextSize(messageTextSizeSp);
            text.setLineSpacing(dp(1), 1f);
            text.setMaxWidth(maxWidth);
            bubble.addView(text, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        }

        if (message.hasFile()) {
            if (isImage(message)) addImagePreview(bubble, message, maxWidth);

            LinearLayout file = new LinearLayout(context);
            file.setOrientation(LinearLayout.HORIZONTAL);
            file.setGravity(Gravity.CENTER_VERTICAL);
            file.setPadding(dp(8), dp(7), dp(5), dp(7));
            GradientDrawable fileBackground = new GradientDrawable();
            fileBackground.setColor(incoming
                    ? (dayMode ? Color.rgb(229, 232, 241) : Color.rgb(55, 58, 77))
                    : adjustColor(outgoingBubbleColor, dayMode ? .78f : .82f));
            fileBackground.setCornerRadius(dp(12));
            file.setBackground(fileBackground);
            LinearLayout.LayoutParams fileParams = new LinearLayout.LayoutParams(maxWidth, ViewGroup.LayoutParams.WRAP_CONTENT);
            fileParams.topMargin = message.text.trim().isEmpty() && !isImage(message) ? 0 : dp(7);
            bubble.addView(file, fileParams);
            file.setOnClickListener(view -> fileClickListener.onFileClick(message));

            ImageView fileIcon = new ImageView(context);
            fileIcon.setImageResource(R.drawable.ic_file);
            fileIcon.setColorFilter(senderAccentColor);
            fileIcon.setPadding(dp(4), dp(4), dp(4), dp(4));
            file.addView(fileIcon, new LinearLayout.LayoutParams(dp(31), dp(34)));

            LinearLayout fileCopy = new LinearLayout(context);
            fileCopy.setOrientation(LinearLayout.VERTICAL);
            fileCopy.setPadding(dp(7), 0, 0, 0);
            file.addView(fileCopy, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));

            TextView fileName = new TextView(context);
            fileName.setText(message.fileName.isEmpty() ? "Attachment" : message.fileName);
            fileName.setTextColor(incoming ? incomingTextColor : outgoingTextColor);
            fileName.setTextSize(12);
            fileName.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
            fileName.setMaxLines(1);
            fileName.setEllipsize(android.text.TextUtils.TruncateAt.END);
            fileCopy.addView(fileName);

            TextView fileInfo = new TextView(context);
            fileInfo.setText(fileExtension(message) + " · " + fileSize(message.fileSize));
            fileInfo.setTextColor(secondaryTextColor);
            fileInfo.setTextSize(10);
            LinearLayout.LayoutParams fileInfoParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            fileInfoParams.topMargin = dp(3);
            fileCopy.addView(fileInfo, fileInfoParams);

            ImageButton download = new ImageButton(context);
            download.setImageResource(R.drawable.ic_download);
            download.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
            download.setPadding(dp(8), dp(8), dp(8), dp(8));
            download.setBackground(makeRipple());
            download.setColorFilter(dayMode ? senderAccentColor : Color.rgb(225, 231, 255));
            download.setContentDescription("Save " + (message.fileName.isEmpty() ? "attachment" : message.fileName));
            file.addView(download, new LinearLayout.LayoutParams(dp(38), dp(38)));
            attachPressAnimation(download);
            download.setOnClickListener(view -> fileClickListener.onDownloadClick(message));
        }

        LinearLayout metadata = new LinearLayout(context);
        metadata.setOrientation(LinearLayout.HORIZONTAL);
        metadata.setGravity(Gravity.CENTER_VERTICAL | Gravity.RIGHT);
        LinearLayout.LayoutParams metaParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        metaParams.topMargin = dp(3);
        bubble.addView(metadata, metaParams);

        TextView time = new TextView(context);
        time.setText(new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date(message.timestamp)));
        time.setTextColor(incoming ? secondaryTextColor : Color.rgb(225, 231, 255));
        time.setTextSize(9);
        metadata.addView(time);

        row.addView(bubble, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
    }

    private void addImagePreview(LinearLayout bubble, ChatMessage message, int maxWidth) {
        ImageView preview = new ImageView(context);
        preview.setImageResource(R.drawable.ic_file);
        preview.setColorFilter(senderAccentColor);
        preview.setScaleType(ImageView.ScaleType.CENTER_CROP);
        preview.setBackground(rounded(dayMode ? Color.rgb(229, 232, 241) : Color.rgb(54, 56, 75), dp(11)));
        preview.setClipToOutline(true);
        preview.setContentDescription("Image preview: " + message.fileName);
        preview.setTag(message.id);
        LinearLayout.LayoutParams previewParams = new LinearLayout.LayoutParams(maxWidth, dp(184));
        previewParams.bottomMargin = dp(2);
        bubble.addView(preview, previewParams);
        preview.setOnClickListener(view -> fileClickListener.onFileClick(message));
        fileClickListener.loadImagePreview(message, preview);
    }

    private boolean isImage(ChatMessage message) {
        if (message.mimeType != null && message.mimeType.toLowerCase(Locale.ROOT).startsWith("image/")) return true;
        String name = message.fileName == null ? "" : message.fileName.toLowerCase(Locale.ROOT);
        return name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg")
                || name.endsWith(".webp") || name.endsWith(".gif") || name.endsWith(".bmp")
                || name.endsWith(".heic") || name.endsWith(".heif");
    }

    private String fileExtension(ChatMessage message) {
        String name = message.fileName == null ? "" : message.fileName;
        int dot = name.lastIndexOf('.');
        if (dot >= 0 && dot < name.length() - 1) return "." + name.substring(dot + 1).toUpperCase(Locale.ROOT);
        String mime = message.mimeType == null ? "" : message.mimeType.toLowerCase(Locale.ROOT);
        if (mime.equals("image/jpeg")) return ".JPG";
        if (mime.equals("image/png")) return ".PNG";
        if (mime.equals("image/webp")) return ".WEBP";
        if (mime.equals("image/gif")) return ".GIF";
        if (mime.equals("application/pdf")) return ".PDF";
        if (mime.equals("video/mp4")) return ".MP4";
        if (mime.equals("audio/mpeg")) return ".MP3";
        int slash = mime.indexOf('/');
        return slash >= 0 && slash < mime.length() - 1 ? "." + mime.substring(slash + 1).toUpperCase(Locale.ROOT) : ".FILE";
    }

    private String fileSize(long bytes) {
        if (bytes <= 0) return "File size unknown";
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format(Locale.getDefault(), "%.0f KB", bytes / 1024f);
        return String.format(Locale.getDefault(), "%.1f MB", bytes / (1024f * 1024f));
    }

    private int maxContentDp() {
        float density = context.getResources().getDisplayMetrics().density;
        int widthDp = (int) (context.getResources().getDisplayMetrics().widthPixels / density);
        return Math.max(168, Math.min(286, widthDp - 56));
    }

    private GradientDrawable rounded(int color, float radiusDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(radiusDp));
        return drawable;
    }

    private android.graphics.drawable.Drawable makeRipple() {
        return new android.graphics.drawable.RippleDrawable(
                ColorStateList.valueOf(Color.rgb(82, 87, 118)),
                rounded(Color.TRANSPARENT, 50), null);
    }

    private int adjustColor(int color, float factor) {
        return Color.rgb(Math.min(255, Math.round(Color.red(color) * factor)),
                Math.min(255, Math.round(Color.green(color) * factor)),
                Math.min(255, Math.round(Color.blue(color) * factor)));
    }

    private void attachPressAnimation(View view) {
        view.setOnTouchListener((target, event) -> {
            int action = event.getActionMasked();
            if (action == MotionEvent.ACTION_DOWN) {
                target.animate().cancel();
                target.animate().scaleX(.91f).scaleY(.91f).alpha(.84f)
                        .setDuration(80).setInterpolator(new DecelerateInterpolator(2f)).start();
            } else if (action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_CANCEL) {
                target.animate().cancel();
                target.animate().scaleX(1f).scaleY(1f).alpha(1f)
                        .setDuration(340).setInterpolator(new OvershootInterpolator(.8f)).start();
            }
            return false;
        });
    }

    private int dp(float value) {
        return (int) (value * context.getResources().getDisplayMetrics().density + .5f);
    }

    @Override
    public int getItemCount() {
        return messages.size();
    }

    static final class MessageHolder extends RecyclerView.ViewHolder {
        final LinearLayout row;
        MessageHolder(@NonNull LinearLayout itemView) {
            super(itemView);
            row = itemView;
        }
    }
}
