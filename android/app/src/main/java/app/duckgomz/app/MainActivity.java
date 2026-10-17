package app.duckgomz.app;

import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.database.Cursor;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.bottomsheet.BottomSheetDialog;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.card.MaterialCardView;
import com.google.android.material.textfield.TextInputEditText;
import com.google.android.material.textfield.TextInputLayout;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseUser;

import org.json.JSONArray;
import org.json.JSONException;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

public class MainActivity extends AppCompatActivity {
    private static final int BLUE = Color.rgb(66, 133, 244);
    private static final int TEXT = Color.rgb(32, 41, 56);
    private static final int MUTED = Color.rgb(119, 131, 149);
    private static final int BG = Color.rgb(245, 248, 252);
    private static final String ACCOUNT_DOMAIN = "@duckgomz.app";
    private static final String BOT_NAME = "Duckgomz";
    private static final String BOT_USERNAME = "@duckgomz";
    private static final int MAX_FILE_BYTES = 20 * 1024 * 1024;

    private FrameLayout root;
    private FirebaseAuth firebaseAuth;
    private SharedPreferences preferences;
    private ActivityResultLauncher<Intent> filePicker;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ArrayList<ChatMessage> messages = new ArrayList<>();
    private String username = "";
    private String authError = "";
    private boolean registerMode = true;
    private RecyclerView messageList;
    private MessageAdapter messageAdapter;
    private EditText composer;
    private TextView authErrorView;
    private boolean activityDestroyed;
    private boolean storageAvailable = true;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        applySystemBars();
        preferences = getSharedPreferences("duckgomz", MODE_PRIVATE);
        firebaseAuth = FirebaseAuth.getInstance();
        root = new FrameLayout(this);
        root.setBackgroundColor(BG);
        setContentView(root);
        installSystemBarInsets();

        filePicker = registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
            if (result.getResultCode() == RESULT_OK && result.getData() != null && result.getData().getData() != null) {
                onPickedFile(result.getData());
            }
        });

        FirebaseUser currentUser = firebaseAuth.getCurrentUser();
        if (currentUser != null) {
            username = usernameFromUser(currentUser);
            loadMessages();
            showChatList();
        } else {
            registerMode = true;
            showAuthScreen();
        }
    }

    @Override
    protected void onDestroy() {
        activityDestroyed = true;
        handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }

    private void applySystemBars() {
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setStatusBarColor(Color.rgb(247, 249, 252));
        window.setNavigationBarColor(Color.WHITE);
        window.getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        );
    }

    private void installSystemBarInsets() {
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return windowInsets;
        });
        ViewCompat.requestApplyInsets(root);
    }

    private void showAuthScreen() {
        root.removeAllViews();
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setClipToPadding(false);
        scroll.setBackgroundColor(Color.rgb(244, 247, 251));
        root.addView(scroll, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(dp(22), dp(24), dp(22), dp(26));
        page.setGravity(Gravity.CENTER_HORIZONTAL);
        scroll.addView(page, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        LinearLayout brand = new LinearLayout(this);
        brand.setOrientation(LinearLayout.HORIZONTAL);
        brand.setGravity(Gravity.CENTER_VERTICAL);
        page.addView(brand, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        brand.addView(createBrandMark(dp(42)), new LinearLayout.LayoutParams(dp(42), dp(42)));
        TextView brandName = text("duckgomz", 20, TEXT, true);
        brandName.setLetterSpacing(-.035f);
        LinearLayout.LayoutParams brandNameParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        brandNameParams.leftMargin = dp(10);
        brand.addView(brandName, brandNameParams);
        TextView brandTag = text("MESSENGER", 9, Color.rgb(111, 140, 179), true);
        brandTag.setLetterSpacing(.12f);
        brandTag.setPadding(dp(9), dp(6), dp(9), dp(6));
        brandTag.setBackground(rounded(Color.rgb(232, 241, 254), Color.TRANSPARENT, 30));
        LinearLayout.LayoutParams tagParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        tagParams.leftMargin = dp(11);
        brand.addView(brandTag, tagParams);

        LinearLayout hero = new LinearLayout(this);
        hero.setOrientation(LinearLayout.VERTICAL);
        hero.setPadding(dp(22), dp(20), dp(22), dp(20));
        hero.setBackground(gradient(new int[]{Color.rgb(227, 239, 255), Color.rgb(238, 247, 250)}, dp(22)));
        LinearLayout.LayoutParams heroParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        heroParams.topMargin = dp(24);
        page.addView(hero, heroParams);
        TextView eyebrow = text("ПРОСТОЕ ОБЩЕНИЕ", 9, Color.rgb(56, 117, 207), true);
        eyebrow.setLetterSpacing(.14f);
        hero.addView(eyebrow);
        TextView heroTitle = text("Ваше имя.\nВаши сообщения.", 27, Color.rgb(34, 54, 82), true);
        heroTitle.setLineSpacing(dp(1), 1f);
        LinearLayout.LayoutParams heroTitleParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        heroTitleParams.topMargin = dp(12);
        hero.addView(heroTitle, heroTitleParams);
        TextView heroCopy = text("Создай аккаунт по имени пользователя и паролю — без номера телефона.", 13, Color.rgb(94, 116, 145), false);
        heroCopy.setLineSpacing(dp(3), 1f);
        LinearLayout.LayoutParams heroCopyParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        heroCopyParams.topMargin = dp(9);
        hero.addView(heroCopy, heroCopyParams);
        LinearLayout noPhonePill = new LinearLayout(this);
        noPhonePill.setOrientation(LinearLayout.HORIZONTAL);
        noPhonePill.setGravity(Gravity.CENTER_VERTICAL);
        noPhonePill.setPadding(dp(10), dp(7), dp(11), dp(7));
        noPhonePill.setBackground(rounded(Color.WHITE, Color.rgb(222, 234, 250), dp(20)));
        TextView shield = text("✓", 12, Color.rgb(57, 146, 102), true);
        noPhonePill.addView(shield);
        TextView noPhone = text("Регистрация без телефона", 10, Color.rgb(80, 110, 148), true);
        LinearLayout.LayoutParams noPhoneParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        noPhoneParams.leftMargin = dp(7);
        noPhonePill.addView(noPhone, noPhoneParams);
        LinearLayout.LayoutParams pillParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        pillParams.topMargin = dp(16);
        hero.addView(noPhonePill, pillParams);

        MaterialCardView card = new MaterialCardView(this);
        card.setCardBackgroundColor(Color.WHITE);
        card.setRadius(dp(22));
        card.setStrokeWidth(dp(1));
        card.setStrokeColor(ColorStateList.valueOf(Color.rgb(232, 237, 244)));
        card.setCardElevation(dp(2));
        LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        cardParams.topMargin = dp(19);
        page.addView(card, cardParams);

        LinearLayout form = new LinearLayout(this);
        form.setOrientation(LinearLayout.VERTICAL);
        form.setPadding(dp(21), dp(21), dp(21), dp(20));
        card.addView(form, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView cardEyebrow = text("ЛИЧНЫЙ АККАУНТ", 9, Color.rgb(126, 140, 160), true);
        cardEyebrow.setLetterSpacing(.12f);
        form.addView(cardEyebrow);
        TextView title = text(registerMode ? "Создать аккаунт" : "С возвращением", 23, TEXT, true);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        titleParams.topMargin = dp(9);
        form.addView(title, titleParams);
        TextView subtitle = text(registerMode
                ? "Придумай имя пользователя — оно станет твоим логином."
                : "Войди по имени пользователя и паролю.", 12, MUTED, false);
        subtitle.setLineSpacing(dp(2), 1f);
        LinearLayout.LayoutParams subtitleParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        subtitleParams.topMargin = dp(5);
        form.addView(subtitle, subtitleParams);

        LinearLayout tabs = new LinearLayout(this);
        tabs.setOrientation(LinearLayout.HORIZONTAL);
        tabs.setPadding(dp(4), dp(4), dp(4), dp(4));
        tabs.setBackground(rounded(Color.rgb(242, 245, 249), Color.TRANSPARENT, dp(12)));
        LinearLayout.LayoutParams tabsParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(43));
        tabsParams.topMargin = dp(19);
        form.addView(tabs, tabsParams);
        TextView registerTab = tabText("Регистрация", registerMode);
        TextView loginTab = tabText("Войти", !registerMode);
        tabs.addView(registerTab, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1));
        tabs.addView(loginTab, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1));
        registerTab.setOnClickListener(view -> { if (!registerMode) { registerMode = true; authError = ""; showAuthScreen(); } });
        loginTab.setOnClickListener(view -> { if (registerMode) { registerMode = false; authError = ""; showAuthScreen(); } });

        TextInputLayout usernameLayout = createInput("Имя пользователя", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD);
        TextInputEditText usernameInput = (TextInputEditText) usernameLayout.getEditText();
        usernameInput.setSingleLine(true);
        usernameInput.setImeOptions(EditorInfo.IME_ACTION_NEXT);
        addField(form, usernameLayout, dp(18));
        TextView usernameHint = text("4–32 символа: латинские буквы, цифры и _", 10, Color.rgb(147, 157, 171), false);
        LinearLayout.LayoutParams usernameHintParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        usernameHintParams.topMargin = dp(6);
        form.addView(usernameHint, usernameHintParams);

        TextInputLayout passwordLayout = createInput("Пароль", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        TextInputEditText passwordInput = (TextInputEditText) passwordLayout.getEditText();
        passwordInput.setSingleLine(true);
        passwordInput.setImeOptions(registerMode ? EditorInfo.IME_ACTION_NEXT : EditorInfo.IME_ACTION_DONE);
        addField(form, passwordLayout, dp(17));
        TextView passwordHint = text("Не менее 8 символов", 10, Color.rgb(147, 157, 171), false);
        LinearLayout.LayoutParams passwordHintParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        passwordHintParams.topMargin = dp(6);
        form.addView(passwordHint, passwordHintParams);

        TextInputLayout repeatLayout = null;
        TextInputEditText repeatInput = null;
        if (registerMode) {
            repeatLayout = createInput("Повтори пароль", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
            repeatInput = (TextInputEditText) repeatLayout.getEditText();
            repeatInput.setSingleLine(true);
            repeatInput.setImeOptions(EditorInfo.IME_ACTION_DONE);
            addField(form, repeatLayout, dp(17));
        }

        TextView error = text(authError, 11, Color.rgb(179, 38, 30), false);
        error.setLineSpacing(dp(2), 1f);
        error.setVisibility(authError.isEmpty() ? View.GONE : View.VISIBLE);
        authErrorView = error;
        LinearLayout.LayoutParams errorParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        errorParams.topMargin = dp(13);
        form.addView(error, errorParams);

        TextInputEditText finalRepeatInput = repeatInput;
        MaterialButton submit = new MaterialButton(this);
        submit.setText(registerMode ? "Создать аккаунт  →" : "Войти  →");
        submit.setAllCaps(false);
        submit.setTextSize(14);
        submit.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        submit.setTextColor(Color.WHITE);
        submit.setCornerRadius(dp(14));
        submit.setBackgroundTintList(ColorStateList.valueOf(BLUE));
        submit.setInsetTop(0);
        submit.setInsetBottom(0);
        LinearLayout.LayoutParams submitParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(50));
        submitParams.topMargin = dp(18);
        form.addView(submit, submitParams);
        submit.setOnClickListener(view -> submitAuth(usernameInput, passwordInput, finalRepeatInput, submit));
        passwordInput.setOnEditorActionListener((view, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_DONE && !registerMode) {
                submitAuth(usernameInput, passwordInput, null, submit);
                return true;
            }
            return false;
        });

        LinearLayout noteRow = new LinearLayout(this);
        noteRow.setOrientation(LinearLayout.HORIZONTAL);
        noteRow.setGravity(Gravity.TOP);
        LinearLayout.LayoutParams noteRowParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        noteRowParams.topMargin = dp(17);
        form.addView(noteRow, noteRowParams);
        TextView noteIcon = text("✓", 14, Color.rgb(52, 151, 104), true);
        noteRow.addView(noteIcon);
        TextView noteText = text("Без номера телефона. Имя пользователя используется для входа.", 10, Color.rgb(118, 132, 151), false);
        noteText.setLineSpacing(dp(2), 1f);
        LinearLayout.LayoutParams noteTextParams = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1);
        noteTextParams.leftMargin = dp(8);
        noteRow.addView(noteText, noteTextParams);

        TextView footer = text("Вход через Firebase · локальная история зашифрована на устройстве", 9, Color.rgb(144, 155, 170), false);
        footer.setGravity(Gravity.CENTER);
        footer.setLineSpacing(dp(2), 1f);
        LinearLayout.LayoutParams footerParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        footerParams.topMargin = dp(15);
        page.addView(footer, footerParams);
    }

    private TextInputLayout createInput(String hint, int inputType) {
        TextInputLayout layout = new TextInputLayout(this);
        layout.setHint(hint);
        layout.setBoxBackgroundMode(TextInputLayout.BOX_BACKGROUND_OUTLINE);
        layout.setBoxCornerRadii(dp(12), dp(12), dp(12), dp(12));
        layout.setBoxStrokeColor(Color.rgb(214, 222, 232));
        layout.setHintTextColor(ColorStateList.valueOf(Color.rgb(115, 129, 149)));
        layout.setEndIconMode(TextInputLayout.END_ICON_NONE);
        TextInputEditText editText = new TextInputEditText(layout.getContext());
        editText.setInputType(inputType);
        editText.setTextSize(14);
        editText.setTextColor(TEXT);
        editText.setPadding(dp(12), dp(14), dp(12), dp(12));
        layout.addView(editText, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(51)));
        return layout;
    }

    private void addField(LinearLayout parent, TextInputLayout field, int topMargin) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        params.topMargin = topMargin;
        parent.addView(field, params);
    }

    private TextView tabText(String label, boolean selected) {
        TextView tab = text(label, 12, selected ? Color.rgb(38, 94, 176) : Color.rgb(124, 136, 152), true);
        tab.setGravity(Gravity.CENTER);
        tab.setBackground(rounded(selected ? Color.WHITE : Color.TRANSPARENT, Color.TRANSPARENT, dp(9)));
        if (selected) tab.setElevation(dp(1));
        return tab;
    }

    private void submitAuth(TextInputEditText usernameInput, TextInputEditText passwordInput,
                            TextInputEditText repeatInput, MaterialButton submit) {
        String enteredUsername = usernameInput.getText() == null ? "" : usernameInput.getText().toString().trim();
        String cleanUsername = enteredUsername.startsWith("@") ? enteredUsername.substring(1) : enteredUsername;
        String validationError = UsernameRules.validate(cleanUsername);
        if (validationError != null) {
            setAuthError(validationError);
            return;
        }
        String password = passwordInput.getText() == null ? "" : passwordInput.getText().toString();
        if (password.length() < 8) {
            setAuthError("Пароль должен содержать не менее 8 символов.");
            return;
        }
        boolean creatingAccount = registerMode;
        if (creatingAccount) {
            String repeat = repeatInput == null || repeatInput.getText() == null ? "" : repeatInput.getText().toString();
            if (!password.equals(repeat)) {
                setAuthError("Пароли не совпадают.");
                return;
            }
        }

        String normalized = UsernameRules.normalize(cleanUsername);
        String authEmail = normalized + ACCOUNT_DOMAIN;
        View focused = getCurrentFocus();
        if (focused != null) {
            Object service = getSystemService(INPUT_METHOD_SERVICE);
            if (service instanceof InputMethodManager) {
                ((InputMethodManager) service).hideSoftInputFromWindow(focused.getWindowToken(), 0);
            }
        }
        authError = "";
        setAuthError("");
        submit.setEnabled(false);
        submit.setText("Подожди…");
        if (creatingAccount) {
            firebaseAuth.createUserWithEmailAndPassword(authEmail, password).addOnCompleteListener(this, task -> {
                if (task.isSuccessful()) finishAuthentication(normalized);
                else {
                    submit.setEnabled(true);
                    submit.setText("Создать аккаунт  →");
                    setAuthError(friendlyAuthError(task.getException()));
                }
            });
        } else {
            firebaseAuth.signInWithEmailAndPassword(authEmail, password).addOnCompleteListener(this, task -> {
                if (task.isSuccessful()) finishAuthentication(normalized);
                else {
                    submit.setEnabled(true);
                    submit.setText("Войти  →");
                    setAuthError(friendlyAuthError(task.getException()));
                }
            });
        }
    }

    private void setAuthError(String message) {
        authError = message == null ? "" : message;
        if (authErrorView == null) return;
        authErrorView.setText(authError);
        authErrorView.setVisibility(authError.isEmpty() ? View.GONE : View.VISIBLE);
    }

    private String friendlyAuthError(Exception exception) {
        String code = "";
        String raw = exception == null || exception.getMessage() == null ? "" : exception.getMessage();
        if (exception instanceof FirebaseAuthException) code = ((FirebaseAuthException) exception).getErrorCode();
        String value = (code + " " + raw).toLowerCase(Locale.ROOT);
        if (value.contains("email_already_in_use") || value.contains("email address is already in use")) {
            return "Это имя пользователя уже занято.";
        }
        if (value.contains("user_not_found") || value.contains("wrong_password") || value.contains("invalid_credential") || value.contains("invalid login credentials")) {
            return "Неверное имя пользователя или пароль.";
        }
        if (value.contains("weak_password")) return "Пароль слишком простой. Используй не менее 8 символов.";
        if (value.contains("operation_not_allowed")) {
            return "В Firebase не включена регистрация по паролю. Включи Email/Password в Authentication → Sign-in method.";
        }
        if (value.contains("network")) return "Нет соединения с интернетом. Попробуй ещё раз.";
        if (value.contains("invalid_email")) return "Не удалось обработать имя пользователя. Попробуй другое.";
        return raw.isEmpty() ? "Не получилось выполнить вход. Попробуй ещё раз." : raw;
    }

    private void finishAuthentication(String authenticatedUsername) {
        username = authenticatedUsername;
        registerMode = false;
        authError = "";
        loadMessages();
        showChatList();
    }

    private String usernameFromUser(FirebaseUser user) {
        String email = user.getEmail();
        if (email != null && email.toLowerCase(Locale.ROOT).endsWith(ACCOUNT_DOMAIN)) {
            return email.substring(0, email.length() - ACCOUNT_DOMAIN.length());
        }
        if (user.getDisplayName() != null && !user.getDisplayName().trim().isEmpty()) return user.getDisplayName().trim();
        return "пользователь";
    }

    private void showChatList() {
        root.removeAllViews();
        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(dp(20), dp(23), dp(20), dp(18));
        page.setBackgroundColor(BG);
        root.addView(page, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        LinearLayout top = new LinearLayout(this);
        top.setOrientation(LinearLayout.HORIZONTAL);
        top.setGravity(Gravity.CENTER_VERTICAL);
        page.addView(top, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        top.addView(createBrandMark(dp(43)), new LinearLayout.LayoutParams(dp(43), dp(43)));
        LinearLayout brandCopy = new LinearLayout(this);
        brandCopy.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams brandCopyParams = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1);
        brandCopyParams.leftMargin = dp(10);
        top.addView(brandCopy, brandCopyParams);
        TextView brand = text("duckgomz", 18, TEXT, true);
        brand.setLetterSpacing(-.04f);
        brandCopy.addView(brand);
        brandCopy.addView(text("СООБЩЕНИЯ РЯДОМ", 8, Color.rgb(139, 151, 168), true));
        TextView accountAvatar = text(username.isEmpty() ? "U" : username.substring(0, 1).toUpperCase(Locale.ROOT), 13, Color.rgb(51, 103, 177), true);
        accountAvatar.setGravity(Gravity.CENTER);
        accountAvatar.setBackground(circle(Color.rgb(225, 237, 255), Color.rgb(205, 222, 247), dp(1)));
        top.addView(accountAvatar, new LinearLayout.LayoutParams(dp(39), dp(39)));

        LinearLayout heading = new LinearLayout(this);
        heading.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams headingParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        headingParams.topMargin = dp(30);
        page.addView(heading, headingParams);
        TextView eyebrow = text("ВАШИ ДИАЛОГИ", 9, Color.rgb(145, 157, 174), true);
        eyebrow.setLetterSpacing(.13f);
        heading.addView(eyebrow);
        LinearLayout headingLine = new LinearLayout(this);
        headingLine.setOrientation(LinearLayout.HORIZONTAL);
        headingLine.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams headingLineParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        headingLineParams.topMargin = dp(4);
        heading.addView(headingLine, headingLineParams);
        headingLine.addView(text("Чаты", 27, TEXT, true));
        TextView oneChat = text("1 чат", 10, Color.rgb(93, 121, 159), true);
        oneChat.setPadding(dp(9), dp(5), dp(9), dp(5));
        oneChat.setBackground(rounded(Color.rgb(233, 241, 253), Color.TRANSPARENT, dp(10)));
        LinearLayout.LayoutParams countParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        countParams.leftMargin = dp(10);
        headingLine.addView(oneChat, countParams);
        TextView subtitle = text("Здесь сейчас только официальный бот Duckgomz.", 12, MUTED, false);
        LinearLayout.LayoutParams subParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        subParams.topMargin = dp(7);
        heading.addView(subtitle, subParams);

        MaterialCardView chatCard = new MaterialCardView(this);
        chatCard.setCardBackgroundColor(Color.WHITE);
        chatCard.setRadius(dp(18));
        chatCard.setStrokeWidth(dp(1));
        chatCard.setStrokeColor(ColorStateList.valueOf(Color.rgb(227, 233, 242)));
        chatCard.setCardElevation(dp(1));
        chatCard.setClickable(true);
        chatCard.setFocusable(true);
        LinearLayout.LayoutParams chatCardParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        chatCardParams.topMargin = dp(18);
        page.addView(chatCard, chatCardParams);
        LinearLayout chatRow = new LinearLayout(this);
        chatRow.setOrientation(LinearLayout.HORIZONTAL);
        chatRow.setGravity(Gravity.CENTER_VERTICAL);
        chatRow.setPadding(dp(14), dp(14), dp(13), dp(14));
        chatCard.addView(chatRow, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        chatRow.addView(createBotAvatar(dp(54)), new LinearLayout.LayoutParams(dp(54), dp(54)));
        LinearLayout chatCopy = new LinearLayout(this);
        chatCopy.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams chatCopyParams = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1);
        chatCopyParams.leftMargin = dp(12);
        chatRow.addView(chatCopy, chatCopyParams);
        LinearLayout chatNameLine = new LinearLayout(this);
        chatNameLine.setOrientation(LinearLayout.HORIZONTAL);
        chatNameLine.setGravity(Gravity.CENTER_VERTICAL);
        chatCopy.addView(chatNameLine);
        TextView botName = text(BOT_NAME, 15, TEXT, true);
        chatNameLine.addView(botName);
        LinearLayout.LayoutParams verifiedParams = new LinearLayout.LayoutParams(dp(17), dp(17));
        verifiedParams.leftMargin = dp(5);
        chatNameLine.addView(createVerifiedMark(dp(17)), verifiedParams);
        TextView preview = text(lastMessagePreview(), 11, Color.rgb(119, 132, 151), false);
        preview.setSingleLine(true);
        preview.setEllipsize(android.text.TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams previewParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        previewParams.topMargin = dp(6);
        chatCopy.addView(preview, previewParams);
        LinearLayout right = new LinearLayout(this);
        right.setOrientation(LinearLayout.VERTICAL);
        right.setGravity(Gravity.RIGHT | Gravity.CENTER_VERTICAL);
        chatRow.addView(right, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        TextView time = text("сейчас", 9, Color.rgb(151, 161, 176), false);
        right.addView(time);
        TextView arrow = text("›", 23, Color.rgb(155, 167, 184), false);
        arrow.setGravity(Gravity.RIGHT);
        LinearLayout.LayoutParams arrowParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        arrowParams.topMargin = dp(4);
        right.addView(arrow, arrowParams);
        chatCard.setOnClickListener(view -> showConversation());

        View spacer = new View(this);
        page.addView(spacer, new LinearLayout.LayoutParams(1, 0, 1));
        MaterialCardView accountCard = new MaterialCardView(this);
        accountCard.setCardBackgroundColor(Color.WHITE);
        accountCard.setRadius(dp(16));
        accountCard.setStrokeWidth(dp(1));
        accountCard.setStrokeColor(ColorStateList.valueOf(Color.rgb(230, 235, 242)));
        accountCard.setCardElevation(0);
        page.addView(accountCard, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        LinearLayout accountRow = new LinearLayout(this);
        accountRow.setOrientation(LinearLayout.HORIZONTAL);
        accountRow.setGravity(Gravity.CENTER_VERTICAL);
        accountRow.setPadding(dp(13), dp(11), dp(8), dp(11));
        accountCard.addView(accountRow, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        TextView userInitial = text(username.substring(0, 1).toUpperCase(Locale.ROOT), 12, Color.rgb(41, 96, 173), true);
        userInitial.setGravity(Gravity.CENTER);
        userInitial.setBackground(circle(Color.rgb(231, 240, 255), Color.TRANSPARENT, 0));
        accountRow.addView(userInitial, new LinearLayout.LayoutParams(dp(34), dp(34)));
        LinearLayout accountText = new LinearLayout(this);
        accountText.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams accountTextParams = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1);
        accountTextParams.leftMargin = dp(10);
        accountRow.addView(accountText, accountTextParams);
        accountText.addView(text("Твой аккаунт", 10, Color.rgb(115, 128, 146), false));
        TextView userNameText = text("@" + username, 12, Color.rgb(48, 62, 82), true);
        LinearLayout.LayoutParams userNameParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        userNameParams.topMargin = dp(2);
        accountText.addView(userNameText, userNameParams);
        ImageButton logout = new ImageButton(this);
        logout.setImageResource(R.drawable.ic_logout);
        logout.setColorFilter(Color.rgb(123, 137, 155));
        logout.setBackground(rippleRounded(Color.TRANSPARENT, dp(10)));
        logout.setContentDescription("Выйти из аккаунта");
        accountRow.addView(logout, new LinearLayout.LayoutParams(dp(40), dp(40)));
        logout.setOnClickListener(view -> signOut());
    }

    private String lastMessagePreview() {
        if (messages.isEmpty()) return "Напиши официальному боту";
        ChatMessage last = messages.get(messages.size() - 1);
        if (last.hasFile()) return "📎 " + last.fileName;
        return last.text.isEmpty() ? "Новое сообщение" : last.text.replace('\n', ' ');
    }

    private void showConversation() {
        root.removeAllViews();
        LinearLayout screen = new LinearLayout(this);
        screen.setOrientation(LinearLayout.VERTICAL);
        screen.setBackgroundColor(Color.rgb(247, 249, 252));
        root.addView(screen, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(8), dp(7), dp(12), dp(7));
        toolbar.setBackgroundColor(Color.WHITE);
        screen.addView(toolbar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(68)));
        ImageButton back = new ImageButton(this);
        back.setImageResource(R.drawable.ic_arrow_back);
        back.setColorFilter(Color.rgb(82, 96, 115));
        back.setBackground(rippleRounded(Color.TRANSPARENT, dp(12)));
        back.setContentDescription("Назад к чатам");
        toolbar.addView(back, new LinearLayout.LayoutParams(dp(42), dp(46)));
        back.setOnClickListener(view -> showChatList());
        FrameLayout avatar = createBotAvatar(dp(44));
        LinearLayout.LayoutParams avatarParams = new LinearLayout.LayoutParams(dp(44), dp(44));
        avatarParams.leftMargin = dp(5);
        toolbar.addView(avatar, avatarParams);
        LinearLayout titleBlock = new LinearLayout(this);
        titleBlock.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1);
        titleParams.leftMargin = dp(10);
        toolbar.addView(titleBlock, titleParams);
        LinearLayout titleLine = new LinearLayout(this);
        titleLine.setOrientation(LinearLayout.HORIZONTAL);
        titleLine.setGravity(Gravity.CENTER_VERTICAL);
        titleBlock.addView(titleLine);
        titleLine.addView(text(BOT_NAME, 15, TEXT, true));
        LinearLayout.LayoutParams titleVerifiedParams = new LinearLayout.LayoutParams(dp(16), dp(16));
        titleVerifiedParams.leftMargin = dp(5);
        titleLine.addView(createVerifiedMark(dp(16)), titleVerifiedParams);
        TextView sub = text("официальный бот", 10, Color.rgb(125, 139, 158), false);
        LinearLayout.LayoutParams subParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        subParams.topMargin = dp(3);
        titleBlock.addView(sub, subParams);
        titleBlock.setOnClickListener(view -> showBotProfile());
        ImageButton profileInfo = new ImageButton(this);
        profileInfo.setImageResource(R.drawable.ic_info);
        profileInfo.setColorFilter(Color.rgb(104, 119, 138));
        profileInfo.setBackground(rippleRounded(Color.TRANSPARENT, dp(12)));
        profileInfo.setContentDescription("Профиль Duckgomz");
        toolbar.addView(profileInfo, new LinearLayout.LayoutParams(dp(42), dp(44)));
        profileInfo.setOnClickListener(view -> showBotProfile());

        View separator = new View(this);
        separator.setBackgroundColor(Color.rgb(236, 240, 245));
        screen.addView(separator, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)));

        LinearLayout notice = new LinearLayout(this);
        notice.setOrientation(LinearLayout.HORIZONTAL);
        notice.setGravity(Gravity.CENTER);
        notice.setPadding(dp(12), dp(9), dp(12), dp(9));
        notice.setBackgroundColor(Color.rgb(242, 247, 255));
        screen.addView(notice, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        TextView noticeIcon = text("✓", 11, Color.rgb(63, 128, 220), true);
        notice.addView(noticeIcon);
        TextView noticeText = text("Официальный аккаунт Duckgomz", 10, Color.rgb(94, 119, 153), true);
        LinearLayout.LayoutParams noticeTextParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        noticeTextParams.leftMargin = dp(6);
        notice.addView(noticeText, noticeTextParams);

        messageList = new RecyclerView(this);
        messageList.setClipToPadding(false);
        messageList.setPadding(0, dp(8), 0, dp(8));
        messageList.setBackgroundColor(Color.rgb(247, 249, 252));
        messageList.setLayoutManager(new LinearLayoutManager(this));
        messageList.setItemAnimator(null);
        messageAdapter = new MessageAdapter(this, this::openAttachment);
        messageList.setAdapter(messageAdapter);
        screen.addView(messageList, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        messageAdapter.setMessages(messages);
        if (!messages.isEmpty()) messageList.scrollToPosition(messages.size() - 1);

        LinearLayout composerArea = new LinearLayout(this);
        composerArea.setOrientation(LinearLayout.VERTICAL);
        composerArea.setPadding(dp(9), dp(9), dp(9), dp(7));
        composerArea.setBackgroundColor(Color.WHITE);
        screen.addView(composerArea, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        LinearLayout composerRow = new LinearLayout(this);
        composerRow.setOrientation(LinearLayout.HORIZONTAL);
        composerRow.setGravity(Gravity.BOTTOM | Gravity.CENTER_VERTICAL);
        composerArea.addView(composerRow, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        ImageButton attach = new ImageButton(this);
        attach.setImageResource(R.drawable.ic_attach);
        attach.setColorFilter(Color.rgb(115, 131, 151));
        attach.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        attach.setPadding(dp(12), dp(12), dp(12), dp(12));
        attach.setBackground(rippleRounded(Color.TRANSPARENT, dp(14)));
        attach.setContentDescription("Прикрепить файл");
        composerRow.addView(attach, new LinearLayout.LayoutParams(dp(45), dp(46)));
        attach.setOnClickListener(view -> openFilePicker());

        composer = new EditText(this);
        composer.setTextSize(14);
        composer.setTextColor(TEXT);
        composer.setHintTextColor(Color.rgb(148, 158, 172));
        composer.setHint("Сообщение");
        composer.setSingleLine(false);
        composer.setMinLines(1);
        composer.setMaxLines(5);
        composer.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        composer.setImeOptions(EditorInfo.IME_ACTION_SEND);
        composer.setPadding(dp(13), dp(11), dp(13), dp(11));
        composer.setBackground(rounded(Color.rgb(246, 248, 251), Color.rgb(233, 237, 243), dp(17)));
        LinearLayout.LayoutParams composerParams = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1);
        composerParams.leftMargin = dp(3);
        composerRow.addView(composer, composerParams);
        composer.setOnEditorActionListener((textView, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_SEND) {
                sendTextMessage();
                return true;
            }
            return false;
        });

        ImageButton send = new ImageButton(this);
        send.setImageResource(R.drawable.ic_send);
        send.setColorFilter(Color.WHITE);
        send.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        send.setPadding(dp(12), dp(12), dp(12), dp(12));
        send.setBackground(circle(BLUE, Color.TRANSPARENT, 0));
        send.setContentDescription("Отправить сообщение");
        LinearLayout.LayoutParams sendParams = new LinearLayout.LayoutParams(dp(46), dp(46));
        sendParams.leftMargin = dp(7);
        composerRow.addView(send, sendParams);
        send.setOnClickListener(view -> sendTextMessage());

        TextView localHint = text(storageAvailable
                ? "Локальный чат · история зашифрована на устройстве"
                : "Хранилище недоступно · данные не изменены",
                9, storageAvailable ? Color.rgb(142, 153, 168) : Color.rgb(175, 78, 72), false);
        localHint.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams localHintParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        localHintParams.topMargin = dp(7);
        composerArea.addView(localHint, localHintParams);
    }

    private void sendTextMessage() {
        if (composer == null) return;
        String text = composer.getText() == null ? "" : composer.getText().toString().trim();
        if (text.isEmpty()) return;
        ChatMessage outgoing = new ChatMessage(UUID.randomUUID().toString(), false, text, System.currentTimeMillis(), "", "", "", 0);
        if (!addMessage(outgoing)) return;
        composer.setText("");
        scheduleLocalBotReply(false, "");
    }

    private void sendFileMessage(String fileName, String uri, String mimeType, long size) {
        ChatMessage outgoing = new ChatMessage(UUID.randomUUID().toString(), false, "", System.currentTimeMillis(), fileName, uri, mimeType, size);
        if (!addMessage(outgoing)) return;
        scheduleLocalBotReply(true, fileName);
    }

    private boolean addMessage(ChatMessage message) {
        if (!storageAvailable) {
            showStorageError();
            return false;
        }
        messages.add(message);
        if (!saveMessages()) {
            messages.remove(messages.size() - 1);
            showStorageError();
            return false;
        }
        if (messageAdapter != null) {
            messageAdapter.addMessage(message);
            if (messageList != null) messageList.post(() -> messageList.scrollToPosition(messageAdapter.getItemCount() - 1));
        }
        return true;
    }

    private void scheduleLocalBotReply(boolean attachedFile, String fileName) {
        handler.postDelayed(() -> {
            if (activityDestroyed) return;
            String replyText = attachedFile
                    ? "Файл «" + fileName + "» добавлен в тестовую переписку. Для передачи файлов другим пользователям понадобится подключить сервер."
                    : "Спасибо за сообщение! Это тестовая версия Duckgomz: сообщение сохранено на устройстве. ✨";
            ChatMessage reply = new ChatMessage(UUID.randomUUID().toString(), true, replyText, System.currentTimeMillis(), "", "", "", 0);
            addMessage(reply);
        }, 900);
    }

    private void openFilePicker() {
        if (!storageAvailable) {
            showStorageError();
            return;
        }
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        filePicker.launch(intent);
    }

    private void onPickedFile(Intent data) {
        Uri uri = data.getData();
        if (uri == null) return;
        try {
            getContentResolver().takePersistableUriPermission(uri, data.getFlags() & Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (SecurityException ignored) {
            // The picker can return a temporary URI permission; the selected file still works for this session.
        }
        String name = queryFileName(uri);
        long size = queryFileSize(uri);
        if (size > MAX_FILE_BYTES) {
            Toast.makeText(this, "Максимальный размер файла — 20 МБ", Toast.LENGTH_LONG).show();
            return;
        }
        String mime = getContentResolver().getType(uri);
        sendFileMessage(name, uri.toString(), mime == null ? "application/octet-stream" : mime, size);
    }

    private String queryFileName(Uri uri) {
        Cursor cursor = null;
        try {
            cursor = getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null);
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (index >= 0) return cursor.getString(index);
            }
        } catch (Exception ignored) {
        } finally {
            if (cursor != null) cursor.close();
        }
        String last = uri.getLastPathSegment();
        return last == null ? "Вложенный файл" : last;
    }

    private long queryFileSize(Uri uri) {
        Cursor cursor = null;
        try {
            cursor = getContentResolver().query(uri, new String[]{OpenableColumns.SIZE}, null, null, null);
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (index >= 0 && !cursor.isNull(index)) return cursor.getLong(index);
            }
        } catch (Exception ignored) {
        } finally {
            if (cursor != null) cursor.close();
        }
        return 0;
    }

    private void openAttachment(ChatMessage message) {
        if (message.fileUri.isEmpty()) {
            Toast.makeText(this, "Файл недоступен", Toast.LENGTH_SHORT).show();
            return;
        }
        try {
            Uri uri = Uri.parse(message.fileUri);
            Intent open = new Intent(Intent.ACTION_VIEW);
            open.setDataAndType(uri, message.mimeType.isEmpty() ? "*/*" : message.mimeType);
            open.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(open, "Открыть файл"));
        } catch (Exception exception) {
            Toast.makeText(this, "Не найдено приложение для открытия файла", Toast.LENGTH_SHORT).show();
        }
    }

    private void showBotProfile() {
        BottomSheetDialog dialog = new BottomSheetDialog(this);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER_HORIZONTAL);
        content.setPadding(dp(22), dp(12), dp(22), dp(28));
        content.setBackgroundColor(Color.WHITE);

        View handle = new View(this);
        handle.setBackground(rounded(Color.rgb(218, 224, 232), Color.TRANSPARENT, dp(8)));
        LinearLayout.LayoutParams handleParams = new LinearLayout.LayoutParams(dp(38), dp(4));
        handleParams.bottomMargin = dp(15);
        content.addView(handle, handleParams);

        FrameLayout avatar = createBotAvatar(dp(82));
        LinearLayout.LayoutParams avatarParams = new LinearLayout.LayoutParams(dp(82), dp(82));
        avatarParams.topMargin = dp(6);
        content.addView(avatar, avatarParams);
        FrameLayout verifiedOverlay = createVerifiedMark(dp(22));
        FrameLayout.LayoutParams verifiedOverlayParams = new FrameLayout.LayoutParams(dp(22), dp(22), Gravity.RIGHT | Gravity.BOTTOM);
        avatar.addView(verifiedOverlay, verifiedOverlayParams);

        LinearLayout nameLine = new LinearLayout(this);
        nameLine.setOrientation(LinearLayout.HORIZONTAL);
        nameLine.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams nameLineParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        nameLineParams.topMargin = dp(15);
        content.addView(nameLine, nameLineParams);
        nameLine.addView(text(BOT_NAME, 21, TEXT, true));
        LinearLayout.LayoutParams checkParams = new LinearLayout.LayoutParams(dp(21), dp(21));
        checkParams.leftMargin = dp(6);
        nameLine.addView(createVerifiedMark(dp(21)), checkParams);

        TextView botHandle = text(BOT_USERNAME, 12, Color.rgb(116, 132, 154), false);
        LinearLayout.LayoutParams handleTextParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        handleTextParams.topMargin = dp(4);
        content.addView(botHandle, handleTextParams);

        TextView officialPill = text("✓  ОФИЦИАЛЬНЫЙ АККАУНТ", 9, Color.rgb(52, 126, 91), true);
        officialPill.setLetterSpacing(.04f);
        officialPill.setPadding(dp(11), dp(7), dp(11), dp(7));
        officialPill.setBackground(rounded(Color.rgb(237, 248, 241), Color.rgb(217, 239, 226), dp(20)));
        LinearLayout.LayoutParams pillParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        pillParams.topMargin = dp(12);
        content.addView(officialPill, pillParams);

        TextView description = text("Демонстрационный бот Duckgomz. Сообщения и прикреплённые файлы пока остаются на этом устройстве.", 13, Color.rgb(98, 111, 130), false);
        description.setGravity(Gravity.CENTER);
        description.setLineSpacing(dp(3), 1f);
        LinearLayout.LayoutParams descriptionParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        descriptionParams.topMargin = dp(16);
        content.addView(description, descriptionParams);

        MaterialCardView infoCard = new MaterialCardView(this);
        infoCard.setCardBackgroundColor(Color.rgb(246, 249, 253));
        infoCard.setRadius(dp(15));
        infoCard.setStrokeWidth(dp(1));
        infoCard.setStrokeColor(ColorStateList.valueOf(Color.rgb(233, 238, 245)));
        infoCard.setCardElevation(0);
        LinearLayout.LayoutParams infoParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        infoParams.topMargin = dp(17);
        content.addView(infoCard, infoParams);
        LinearLayout infoRow = new LinearLayout(this);
        infoRow.setOrientation(LinearLayout.HORIZONTAL);
        infoRow.setGravity(Gravity.CENTER_VERTICAL);
        infoRow.setPadding(dp(13), dp(12), dp(13), dp(12));
        infoCard.addView(infoRow, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        TextView shield = text("✓", 15, Color.rgb(58, 129, 218), true);
        shield.setGravity(Gravity.CENTER);
        shield.setBackground(circle(Color.rgb(231, 241, 255), Color.TRANSPARENT, 0));
        infoRow.addView(shield, new LinearLayout.LayoutParams(dp(34), dp(34)));
        TextView note = text("Галочка подтверждает официальный аккаунт Duckgomz.", 11, Color.rgb(104, 122, 145), false);
        note.setLineSpacing(dp(2), 1f);
        LinearLayout.LayoutParams noteParams = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1);
        noteParams.leftMargin = dp(10);
        infoRow.addView(note, noteParams);

        MaterialButton done = new MaterialButton(this);
        done.setText("Вернуться в чат");
        done.setAllCaps(false);
        done.setTextSize(14);
        done.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        done.setTextColor(Color.WHITE);
        done.setCornerRadius(dp(14));
        done.setBackgroundTintList(ColorStateList.valueOf(BLUE));
        done.setInsetTop(0);
        done.setInsetBottom(0);
        LinearLayout.LayoutParams doneParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(49));
        doneParams.topMargin = dp(18);
        content.addView(done, doneParams);
        done.setOnClickListener(view -> dialog.dismiss());
        dialog.setContentView(content);
        dialog.show();
    }

    private void signOut() {
        firebaseAuth.signOut();
        username = "";
        messages.clear();
        registerMode = false;
        authError = "";
        showAuthScreen();
    }

    private void loadMessages() {
        messages.clear();
        storageAvailable = true;
        String storageKey;
        try {
            storageKey = messageKey();
        } catch (RuntimeException exception) {
            storageAvailable = false;
            storageKey = null;
        }

        if (storageAvailable) {
            String stored = preferences.getString(storageKey, null);
            String legacyKey = legacyMessageKey();
            if (stored != null) {
                try {
                    String plaintext = EncryptedStorage.decrypt(stored, storageKey);
                    if (plaintext == null) throw new GeneralSecurityException("Unknown local history format");
                    readMessages(plaintext);
                    if (preferences.contains(legacyKey) && !preferences.edit().remove(legacyKey).commit()) {
                        storageAvailable = false;
                        messages.clear();
                    }
                } catch (Exception exception) {
                    messages.clear();
                    storageAvailable = false;
                }
            } else {
                String legacy = preferences.getString(legacyKey, null);
                if (legacy != null) {
                    try {
                        readMessages(legacy);
                        if (saveMessages()) {
                            if (!preferences.edit().remove(legacyKey).commit()) {
                                storageAvailable = false;
                                messages.clear();
                            }
                        } else {
                            messages.clear();
                        }
                    } catch (Exception exception) {
                        messages.clear();
                        storageAvailable = false;
                    }
                }
            }
        }

        if (messages.isEmpty() && storageAvailable) {
            messages.add(welcomeMessage());
            saveMessages();
        }
        if (!storageAvailable) {
            if (messages.isEmpty()) messages.add(welcomeMessage());
            showStorageError();
        }
    }

    private void readMessages(String serialized) throws JSONException {
        JSONArray array = new JSONArray(serialized);
        for (int index = 0; index < array.length(); index++) {
            messages.add(ChatMessage.fromJson(array.getJSONObject(index)));
        }
    }

    private ChatMessage welcomeMessage() {
        return new ChatMessage(
                "welcome-" + username,
                true,
                "Привет! 👋\n\nДобро пожаловать в Duckgomz. Я демонстрационный бот. Напиши сообщение или прикрепи файл — пока переписка хранится только на этом устройстве. Нажми на имя вверху, чтобы посмотреть мой профиль.",
                System.currentTimeMillis(), "", "", "", 0
        );
    }

    private boolean saveMessages() {
        if (!storageAvailable) return false;
        JSONArray array = new JSONArray();
        for (ChatMessage message : messages) {
            try {
                array.put(message.toJson());
            } catch (JSONException exception) {
                storageAvailable = false;
                return false;
            }
        }
        try {
            String encrypted = EncryptedStorage.encrypt(array.toString(), messageKey());
            boolean saved = preferences.edit().putString(messageKey(), encrypted).commit();
            if (!saved) storageAvailable = false;
            return saved;
        } catch (GeneralSecurityException | RuntimeException exception) {
            storageAvailable = false;
            return false;
        }
    }

    private String messageKey() {
        FirebaseUser currentUser = firebaseAuth.getCurrentUser();
        String accountId = currentUser == null ? username.toLowerCase(Locale.ROOT) : currentUser.getUid();
        if (accountId.isEmpty()) throw new IllegalStateException("No authenticated account for local chat history");
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(accountId.getBytes(StandardCharsets.UTF_8));
            return "chat_v1_" + Base64.encodeToString(digest, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("Unable to create opaque local history key", exception);
        }
    }

    private String legacyMessageKey() {
        return "messages_" + username.toLowerCase(Locale.ROOT);
    }

    private void showStorageError() {
        Toast.makeText(this,
                "Локальная история недоступна для безопасного чтения или записи. Сохранённые данные не изменены.",
                Toast.LENGTH_LONG).show();
    }

    private FrameLayout createBrandMark(int size) {
        FrameLayout frame = new FrameLayout(this);
        ImageView mark = new ImageView(this);
        mark.setImageResource(R.drawable.ic_duckgomz_mark);
        mark.setScaleType(ImageView.ScaleType.FIT_CENTER);
        frame.addView(mark, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        return frame;
    }

    private FrameLayout createBotAvatar(int size) {
        FrameLayout frame = new FrameLayout(this);
        GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.TL_BR,
                new int[]{Color.rgb(103, 166, 248), Color.rgb(43, 111, 218)});
        bg.setShape(GradientDrawable.OVAL);
        frame.setBackground(bg);
        ImageView plane = new ImageView(this);
        plane.setImageResource(R.drawable.ic_duckgomz_plane);
        plane.setScaleType(ImageView.ScaleType.FIT_CENTER);
        int inset = Math.max(dp(6), size / 4);
        FrameLayout.LayoutParams planeParams = new FrameLayout.LayoutParams(size - inset * 2, size - inset * 2, Gravity.CENTER);
        frame.addView(plane, planeParams);
        return frame;
    }

    private FrameLayout createVerifiedMark(int size) {
        FrameLayout frame = new FrameLayout(this);
        GradientDrawable background = new GradientDrawable();
        background.setShape(GradientDrawable.OVAL);
        background.setColor(BLUE);
        frame.setBackground(background);
        ImageView check = new ImageView(this);
        check.setImageResource(R.drawable.ic_verified_check);
        check.setColorFilter(Color.WHITE);
        check.setScaleType(ImageView.ScaleType.FIT_CENTER);
        int inset = Math.max(dp(2), size / 5);
        FrameLayout.LayoutParams checkParams = new FrameLayout.LayoutParams(size - inset * 2, size - inset * 2, Gravity.CENTER);
        frame.addView(check, checkParams);
        return frame;
    }

    private TextView text(String value, float sizeSp, int color, boolean bold) {
        TextView text = new TextView(this);
        text.setText(value);
        text.setTextSize(sizeSp);
        text.setTextColor(color);
        text.setTypeface(Typeface.create("sans-serif", bold ? Typeface.BOLD : Typeface.NORMAL));
        return text;
    }

    private GradientDrawable rounded(int color, int strokeColor, float radius) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(radius);
        if (strokeColor != Color.TRANSPARENT) drawable.setStroke(dp(1), strokeColor);
        return drawable;
    }

    private GradientDrawable gradient(int[] colors, float radius) {
        GradientDrawable drawable = new GradientDrawable(GradientDrawable.Orientation.TL_BR, colors);
        drawable.setCornerRadius(radius);
        return drawable;
    }

    private GradientDrawable circle(int color, int strokeColor, int strokeWidth) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.OVAL);
        drawable.setColor(color);
        if (strokeColor != Color.TRANSPARENT && strokeWidth > 0) drawable.setStroke(strokeWidth, strokeColor);
        return drawable;
    }

    private android.graphics.drawable.Drawable rippleRounded(int color, int radius) {
        return rounded(color, Color.TRANSPARENT, radius);
    }

    private int dp(float value) {
        return (int) (value * getResources().getDisplayMetrics().density + .5f);
    }
}
