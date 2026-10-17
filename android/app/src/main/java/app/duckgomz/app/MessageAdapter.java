package app.duckgomz.app;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.card.MaterialCardView;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public final class MessageAdapter extends RecyclerView.Adapter<MessageAdapter.MessageHolder> {
    public interface FileClickListener {
        void onFileClick(ChatMessage message);
    }

    private final Context context;
    private final FileClickListener fileClickListener;
    private final List<ChatMessage> messages = new ArrayList<>();

    public MessageAdapter(Context context, FileClickListener fileClickListener) {
        this.context = context;
        this.fileClickListener = fileClickListener;
        setHasStableIds(true);
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
        row.setPadding(dp(14), dp(5), dp(14), dp(5));
        row.setLayoutParams(new RecyclerView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        return new MessageHolder(row);
    }

    @Override
    public void onBindViewHolder(@NonNull MessageHolder holder, int position) {
        ChatMessage message = messages.get(position);
        LinearLayout row = holder.row;
        row.removeAllViews();
        row.setGravity(message.fromBot ? Gravity.START | Gravity.BOTTOM : Gravity.END | Gravity.BOTTOM);

        if (message.fromBot) {
            FrameLayout avatar = new FrameLayout(context);
            GradientDrawable avatarBg = new GradientDrawable(GradientDrawable.Orientation.TL_BR,
                    new int[]{Color.rgb(103, 166, 248), Color.rgb(43, 111, 218)});
            avatarBg.setShape(GradientDrawable.OVAL);
            avatar.setBackground(avatarBg);
            ImageView plane = new ImageView(context);
            plane.setImageResource(R.drawable.ic_duckgomz_plane);
            plane.setScaleType(ImageView.ScaleType.FIT_CENTER);
            int inset = dp(7);
            FrameLayout.LayoutParams planeParams = new FrameLayout.LayoutParams(dp(30) - inset * 2, dp(30) - inset * 2, Gravity.CENTER);
            avatar.addView(plane, planeParams);
            LinearLayout.LayoutParams avatarParams = new LinearLayout.LayoutParams(dp(30), dp(30));
            avatarParams.rightMargin = dp(8);
            avatarParams.bottomMargin = dp(2);
            row.addView(avatar, avatarParams);
        } else {
            View spacer = new View(context);
            row.addView(spacer, new LinearLayout.LayoutParams(0, 1, 1f));
        }

        MaterialCardView bubble = new MaterialCardView(context);
        bubble.setRadius(dp(17));
        bubble.setCardElevation(dp(1));
        bubble.setStrokeWidth(dp(1));
        bubble.setStrokeColor(message.fromBot ? Color.rgb(232, 237, 244) : Color.rgb(211, 228, 250));
        bubble.setCardBackgroundColor(message.fromBot ? Color.WHITE : Color.rgb(230, 241, 255));
        bubble.setUseCompatPadding(false);

        LinearLayout body = new LinearLayout(context);
        body.setOrientation(LinearLayout.VERTICAL);
        body.setPadding(dp(13), dp(10), dp(13), dp(6));

        if (!message.text.trim().isEmpty()) {
            TextView text = new TextView(context);
            text.setText(message.text);
            text.setTextColor(message.fromBot ? Color.rgb(47, 58, 75) : Color.rgb(38, 66, 104));
            text.setTextSize(14);
            text.setLineSpacing(dp(2), 1f);
            text.setMaxWidth(dp(maxContentDp()));
            body.addView(text, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        }

        if (message.hasFile()) {
            LinearLayout file = new LinearLayout(context);
            file.setOrientation(LinearLayout.HORIZONTAL);
            file.setGravity(Gravity.CENTER_VERTICAL);
            file.setPadding(dp(9), dp(8), dp(10), dp(8));
            GradientDrawable fileBg = new GradientDrawable();
            fileBg.setColor(message.fromBot ? Color.rgb(246, 249, 253) : Color.rgb(216, 233, 254));
            fileBg.setCornerRadius(dp(12));
            file.setBackground(fileBg);
            LinearLayout.LayoutParams fileParams = new LinearLayout.LayoutParams(dp(maxContentDp()), ViewGroup.LayoutParams.WRAP_CONTENT);
            fileParams.topMargin = message.text.trim().isEmpty() ? 0 : dp(8);
            body.addView(file, fileParams);

            ImageView fileIcon = new ImageView(context);
            fileIcon.setImageResource(R.drawable.ic_file);
            fileIcon.setColorFilter(Color.rgb(49, 125, 226));
            fileIcon.setPadding(dp(5), dp(5), dp(5), dp(5));
            file.addView(fileIcon, new LinearLayout.LayoutParams(dp(30), dp(32)));

            LinearLayout fileText = new LinearLayout(context);
            fileText.setOrientation(LinearLayout.VERTICAL);
            fileText.setPadding(dp(8), 0, 0, 0);
            fileText.setGravity(Gravity.CENTER_VERTICAL);
            file.addView(fileText, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

            TextView fileName = new TextView(context);
            fileName.setText(message.fileName.isEmpty() ? "Вложенный файл" : message.fileName);
            fileName.setTextColor(Color.rgb(48, 63, 84));
            fileName.setTextSize(12);
            fileName.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
            fileName.setMaxLines(1);
            fileName.setEllipsize(android.text.TextUtils.TruncateAt.END);
            fileText.addView(fileName);

            TextView fileSize = new TextView(context);
            fileSize.setText(fileSize(message.fileSize) + " · " + shortMime(message.mimeType));
            fileSize.setTextColor(Color.rgb(130, 143, 160));
            fileSize.setTextSize(10);
            LinearLayout.LayoutParams sizeParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            sizeParams.topMargin = dp(3);
            fileText.addView(fileSize, sizeParams);
            file.setOnClickListener(view -> fileClickListener.onFileClick(message));
        }

        LinearLayout metadata = new LinearLayout(context);
        metadata.setOrientation(LinearLayout.HORIZONTAL);
        metadata.setGravity(Gravity.CENTER_VERTICAL | Gravity.RIGHT);
        LinearLayout.LayoutParams metaParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        metaParams.topMargin = dp(5);
        body.addView(metadata, metaParams);

        TextView time = new TextView(context);
        time.setText(new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date(message.timestamp)));
        time.setTextColor(Color.rgb(139, 151, 167));
        time.setTextSize(9);
        metadata.addView(time);
        if (!message.fromBot) {
            ImageView checks = new ImageView(context);
            checks.setImageResource(R.drawable.ic_check_double);
            checks.setImageTintList(ColorStateList.valueOf(Color.rgb(73, 148, 241)));
            LinearLayout.LayoutParams checkParams = new LinearLayout.LayoutParams(dp(12), dp(12));
            checkParams.leftMargin = dp(3);
            metadata.addView(checks, checkParams);
        }

        bubble.addView(body, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        LinearLayout.LayoutParams bubbleParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        bubbleParams.weight = 0;
        row.addView(bubble, bubbleParams);
    }

    @Override
    public int getItemCount() {
        return messages.size();
    }

    private String fileSize(long bytes) {
        if (bytes <= 0) return "Файл";
        if (bytes < 1024) return bytes + " Б";
        if (bytes < 1024 * 1024) return String.format(Locale.getDefault(), "%.0f КБ", bytes / 1024f);
        return String.format(Locale.getDefault(), "%.1f МБ", bytes / (1024f * 1024f));
    }

    private String shortMime(String mime) {
        if (mime == null || mime.isEmpty()) return "Файл";
        if (mime.equals("application/pdf")) return "PDF";
        if (mime.startsWith("image/")) return "Изображение";
        if (mime.startsWith("video/")) return "Видео";
        if (mime.startsWith("audio/")) return "Аудио";
        return "Файл";
    }

    private int maxContentDp() {
        float density = context.getResources().getDisplayMetrics().density;
        int screenWidthDp = (int) (context.getResources().getDisplayMetrics().widthPixels / density);
        return Math.max(170, Math.min(268, screenWidthDp - 92));
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
