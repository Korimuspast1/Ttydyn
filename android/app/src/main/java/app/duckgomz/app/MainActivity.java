package app.duckgomz.app;

import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.OpenableColumns;
import android.util.LruCache;
import android.text.InputFilter;
import android.text.InputType;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.TextView;
import android.widget.Toast;
import android.view.animation.DecelerateInterpolator;
import android.view.animation.OvershootInterpolator;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;
import androidx.dynamicanimation.animation.DynamicAnimation;
import androidx.dynamicanimation.animation.SpringAnimation;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.gms.tasks.Task;
import com.google.android.material.bottomsheet.BottomSheetDialog;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.textfield.TextInputEditText;
import com.google.android.material.textfield.TextInputLayout;
import com.google.android.material.switchmaterial.SwitchMaterial;
import com.google.firebase.Timestamp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.DocumentReference;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FirebaseFirestoreSettings;
import com.google.firebase.firestore.ListenerRegistration;
import com.google.firebase.firestore.Query;
import com.google.firebase.firestore.SetOptions;
import com.google.firebase.firestore.WriteBatch;
import com.google.firebase.storage.FirebaseStorage;
import com.google.firebase.storage.StorageMetadata;
import com.google.firebase.storage.StorageReference;

import org.json.JSONArray;
import org.json.JSONException;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends AppCompatActivity {
    private static final int BLUE = Color.rgb(91, 121, 247);
    private static final int BG = Color.rgb(32, 33, 47);
    private static final int SURFACE = Color.rgb(42, 44, 62);
    private static final int SURFACE_ALT = Color.rgb(49, 51, 71);
    private static final int TEXT = Color.rgb(244, 245, 250);
    private static final int MUTED = Color.rgb(161, 166, 184);
    private static final int DIVIDER = Color.rgb(57, 59, 77);
    private static final String[] CHAT_THEME_NAMES = new String[]{"Midnight", "Ocean", "Violet", "Forest", "Ember"};
    private static final int[] CHAT_THEME_BACKGROUNDS = new int[]{
            Color.rgb(31, 32, 46), Color.rgb(20, 39, 48), Color.rgb(35, 27, 48),
            Color.rgb(22, 39, 33), Color.rgb(47, 32, 28)
    };
    private static final int[] CHAT_THEME_BUBBLES = new int[]{
            Color.rgb(83, 107, 225), Color.rgb(36, 125, 151), Color.rgb(126, 82, 183),
            Color.rgb(56, 139, 104), Color.rgb(181, 97, 69)
    };
    private static final int[] NAME_COLORS = new int[]{
            Color.rgb(145, 164, 255), Color.rgb(73, 190, 220), Color.rgb(196, 136, 255),
            Color.rgb(123, 214, 162), Color.rgb(255, 160, 128), Color.rgb(250, 213, 117)
    };
    private static final String ACCOUNT_DOMAIN = "@duckgomz.app";
    private static final String BOT_NAME = "Duckgomz";
    private static final String BOT_USERNAME = "@duckgomz";
    private static final String BOT_CHAT_ID = "__duckgomz_local_bot__";
    private static final int MAX_FILE_BYTES = 20 * 1024 * 1024;
    private static boolean firestoreConfigured;
    private static final int TAB_CHATS = 0;
    private static final int TAB_CONTACTS = 1;
    private static final int TAB_SETTINGS = 2;
    private static final int TAB_PROFILE = 3;

    private FrameLayout root;
    private FirebaseAuth firebaseAuth;
    private FirebaseFirestore firestore;
    private FirebaseStorage firebaseStorage;
    private SharedPreferences preferences;
    private ActivityResultLauncher<Intent> filePicker;
    private ActivityResultLauncher<Intent> wallpaperPicker;
    private ActivityResultLauncher<Intent> saveAttachmentPicker;
    private ChatMessage pendingSaveMessage;
    private final ExecutorService ioExecutor = Executors.newFixedThreadPool(2);
    private final LruCache<String, Bitmap> imagePreviewCache = new LruCache<String, Bitmap>(8 * 1024 * 1024) {
        @Override
        protected int sizeOf(String key, Bitmap value) {
            return value.getByteCount();
        }
    };
    private final Set<String> pendingImagePreviews = new HashSet<>();
    private Bitmap loadedWallpaperBitmap;
    private String loadedWallpaperUri = "";
    private ImageView wallpaperPreview;
    private ImageView chatWallpaperView;
    private SwitchMaterial directMessageToggle;
    private ListenerRegistration chatListListener;
    private ListenerRegistration messageListener;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ArrayList<ChatMessage> messages = new ArrayList<>();
    private final ArrayList<ChatMessage> botMessages = new ArrayList<>();
    private final ArrayList<ChatThread> remoteThreads = new ArrayList<>();
    private String username = "";
    private String authError = "";
    private boolean registerMode = true;
    private boolean activityDestroyed;
    private boolean conversationOpen;
    private boolean activeBotChat;
    private boolean storageAvailable = true;
    private boolean cloudErrorShown;
    private boolean allowDirectMessages = true;
    private boolean hideChatPreviews;
    private boolean blockScreenshots;
    private boolean chatCustomizationOpen;
    private boolean privacySettingsOpen;
    private boolean customizationReturnToConversation;
    private int currentTab = TAB_CHATS;
    private ChatThread activeThread;
    private RecyclerView messageList;
    private MessageAdapter messageAdapter;
    private EditText composer;
    private TextView authErrorView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        applySystemBars();
        preferences = getSharedPreferences("duckgomz", MODE_PRIVATE);
        hideChatPreviews = preferences.getBoolean("hide_chat_previews", false);
        blockScreenshots = preferences.getBoolean("block_screenshots", false);
        applyScreenshotPrivacy();
        firebaseAuth = FirebaseAuth.getInstance();
        firestore = FirebaseFirestore.getInstance();
        synchronized (MainActivity.class) {
            if (!firestoreConfigured) {
                FirebaseFirestoreSettings firestoreSettings = new FirebaseFirestoreSettings.Builder()
                        .setPersistenceEnabled(false)
                        .build();
                firestore.setFirestoreSettings(firestoreSettings);
                firestoreConfigured = true;
            }
        }
        firebaseStorage = FirebaseStorage.getInstance();

        root = new FrameLayout(this);
        root.setBackgroundColor(BG);
        setContentView(root);
        installSystemBarInsets();
        loadWallpaperFromPreferences();

        filePicker = registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
            if (result.getResultCode() == RESULT_OK && result.getData() != null && result.getData().getData() != null) {
                onPickedFile(result.getData());
            }
        });
        wallpaperPicker = registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
            if (result.getResultCode() == RESULT_OK && result.getData() != null && result.getData().getData() != null) {
                onWallpaperPicked(result.getData());
            }
        });
        saveAttachmentPicker = registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
            if (result.getResultCode() == RESULT_OK && result.getData() != null && result.getData().getData() != null) {
                saveAttachmentToUri(result.getData().getData());
            } else {
                pendingSaveMessage = null;
            }
        });

        FirebaseUser currentUser = firebaseAuth.getCurrentUser();
        if (currentUser == null) {
            showAuthScreen();
        } else {
            username = usernameFromUser(currentUser);
            showLoadingScreen();
            ensureAccountProfile(username, false, null);
        }
    }

    @Override
    protected void onDestroy() {
        activityDestroyed = true;
        handler.removeCallbacksAndMessages(null);
        ioExecutor.shutdownNow();
        removeMessageListener();
        removeChatListListener();
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (chatCustomizationOpen || privacySettingsOpen) {
            closeSettingsSubpage();
            return;
        }
        if (conversationOpen) {
            showMainTab(currentTab);
            return;
        }
        super.onBackPressed();
    }

    private void applySystemBars() {
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setStatusBarColor(BG);
        window.setNavigationBarColor(BG);
        window.getDecorView().setSystemUiVisibility(0);
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

    private void showLoadingScreen() {
        root.removeAllViews();
        LinearLayout loading = new LinearLayout(this);
        loading.setOrientation(LinearLayout.VERTICAL);
        loading.setGravity(Gravity.CENTER);
        loading.setBackgroundColor(BG);
        root.addView(loading, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        ProgressBar progress = new ProgressBar(this);
        progress.setIndeterminateTintList(ColorStateList.valueOf(BLUE));
        loading.addView(progress, new LinearLayout.LayoutParams(dp(38), dp(38)));
        TextView label = text("Connecting…", 13, MUTED, false);
        LinearLayout.LayoutParams labelParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        labelParams.topMargin = dp(14);
        loading.addView(label, labelParams);
    }

    private void showAuthScreen() {
        root.removeAllViews();
        root.setBackgroundColor(BG);
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setClipToPadding(false);
        scroll.setBackgroundColor(BG);
        root.addView(scroll, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setGravity(Gravity.CENTER_HORIZONTAL);
        page.setPadding(dp(26), dp(28), dp(26), dp(24));
        scroll.addView(page, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        page.addView(toolbar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(46)));
        ImageView brandMark = new ImageView(this);
        brandMark.setImageResource(R.drawable.ic_duckgomz_mark);
        brandMark.setScaleType(ImageView.ScaleType.FIT_CENTER);
        toolbar.addView(brandMark, new LinearLayout.LayoutParams(dp(38), dp(38)));
        TextView brandName = text("Duckgomz", 18, TEXT, true);
        LinearLayout.LayoutParams brandNameParams = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1);
        brandNameParams.leftMargin = dp(10);
        toolbar.addView(brandName, brandNameParams);
        ImageButton authMenu = imageButton(R.drawable.ic_more, "More options");
        authMenu.setColorFilter(MUTED);
        toolbar.addView(authMenu, new LinearLayout.LayoutParams(dp(42), dp(42)));
        authMenu.setOnClickListener(view -> showAboutSheet());

        LinearLayout form = new LinearLayout(this);
        form.setOrientation(LinearLayout.VERTICAL);
        form.setPadding(0, dp(34), 0, dp(8));
        page.addView(form, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView title = text(registerMode ? "Create account" : "Sign in", 27, TEXT, true);
        title.setGravity(Gravity.CENTER);
        form.addView(title, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        TextView subtitle = text(registerMode ? "Choose a username and password" : "Enter your username and password", 14, MUTED, false);
        subtitle.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams subtitleParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        subtitleParams.topMargin = dp(9);
        form.addView(subtitle, subtitleParams);

        TextInputLayout usernameLayout = createInput("Username", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD);
        TextInputEditText usernameInput = (TextInputEditText) usernameLayout.getEditText();
        usernameInput.setSingleLine(true);
        usernameInput.setImeOptions(EditorInfo.IME_ACTION_NEXT);
        addField(form, usernameLayout, dp(27));

        TextInputLayout passwordLayout = createInput("Password", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        TextInputEditText passwordInput = (TextInputEditText) passwordLayout.getEditText();
        passwordInput.setSingleLine(true);
        passwordInput.setImeOptions(registerMode ? EditorInfo.IME_ACTION_NEXT : EditorInfo.IME_ACTION_DONE);
        addField(form, passwordLayout, dp(16));

        TextInputEditText repeatInput = null;
        if (registerMode) {
            TextInputLayout repeatLayout = createInput("Confirm password", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
            repeatInput = (TextInputEditText) repeatLayout.getEditText();
            repeatInput.setSingleLine(true);
            repeatInput.setImeOptions(EditorInfo.IME_ACTION_DONE);
            addField(form, repeatLayout, dp(16));
        }

        TextView error = text(authError, 12, Color.rgb(255, 126, 137), false);
        error.setLineSpacing(dp(2), 1f);
        error.setVisibility(authError.isEmpty() ? View.GONE : View.VISIBLE);
        authErrorView = error;
        LinearLayout.LayoutParams errorParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        errorParams.topMargin = dp(14);
        form.addView(error, errorParams);

        TextInputEditText finalRepeatInput = repeatInput;
        ImageButton submit = imageButton(R.drawable.ic_arrow_forward, registerMode ? "Create account" : "Sign in");
        submit.setColorFilter(Color.WHITE);
        submit.setBackground(rippleRounded(BLUE, dp(17)));
        submit.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        LinearLayout submitRow = new LinearLayout(this);
        submitRow.setOrientation(LinearLayout.HORIZONTAL);
        submitRow.setGravity(Gravity.RIGHT | Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams submitRowParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        submitRowParams.topMargin = dp(25);
        form.addView(submitRow, submitRowParams);
        submitRow.addView(submit, new LinearLayout.LayoutParams(dp(62), dp(56)));
        submit.setOnClickListener(view -> submitAuth(usernameInput, passwordInput, finalRepeatInput, submit));
        passwordInput.setOnEditorActionListener((view, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_DONE && !registerMode) {
                submitAuth(usernameInput, passwordInput, null, submit);
                return true;
            }
            return false;
        });

        TextView switchMode = text(registerMode ? "Already have an account?  Sign in" : "New to Duckgomz?  Create account", 13, MUTED, false);
        switchMode.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams switchParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        switchParams.topMargin = dp(22);
        form.addView(switchMode, switchParams);
        attachPressAnimation(switchMode);
        switchMode.setOnClickListener(view -> {
            registerMode = !registerMode;
            authError = "";
            showAuthScreen();
        });

    }

    private TextInputLayout createInput(String hint, int inputType) {
        TextInputLayout layout = new TextInputLayout(this);
        layout.setHint(hint);
        layout.setBoxBackgroundMode(TextInputLayout.BOX_BACKGROUND_OUTLINE);
        layout.setBoxCornerRadii(dp(12), dp(12), dp(12), dp(12));
        int[][] strokeStates = new int[][]{new int[]{android.R.attr.state_focused}, new int[]{}};
        int[] strokeColors = new int[]{BLUE, Color.rgb(116, 123, 151)};
        layout.setBoxStrokeColorStateList(new ColorStateList(strokeStates, strokeColors));
        layout.setHintTextColor(ColorStateList.valueOf(Color.rgb(193, 199, 216)));
        layout.setBoxBackgroundColor(Color.rgb(45, 47, 66));
        if (hint.toLowerCase(Locale.ROOT).contains("password")) {
            layout.setEndIconMode(TextInputLayout.END_ICON_PASSWORD_TOGGLE);
            layout.setEndIconTintList(ColorStateList.valueOf(Color.rgb(191, 197, 216)));
        } else {
            layout.setEndIconMode(TextInputLayout.END_ICON_NONE);
        }
        TextInputEditText editText = new TextInputEditText(layout.getContext());
        editText.setInputType(inputType);
        editText.setTextSize(16);
        editText.setTextColor(TEXT);
        editText.setHintTextColor(Color.rgb(193, 199, 216));
        editText.setPadding(dp(14), dp(15), dp(14), dp(12));
        layout.addView(editText, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(58)));
        return layout;
    }

    private void addField(LinearLayout parent, TextInputLayout field, int topMargin) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        params.topMargin = topMargin;
        parent.addView(field, params);
    }

    private void submitAuth(TextInputEditText usernameInput, TextInputEditText passwordInput,
                            TextInputEditText repeatInput, ImageButton submit) {
        String enteredUsername = usernameInput.getText() == null ? "" : usernameInput.getText().toString().trim();
        String cleanUsername = enteredUsername.startsWith("@") ? enteredUsername.substring(1) : enteredUsername;
        String validationError = UsernameRules.validate(cleanUsername);
        if (validationError != null) {
            setAuthError(validationError);
            return;
        }
        String password = passwordInput.getText() == null ? "" : passwordInput.getText().toString();
        if (password.length() < 8) {
            setAuthError("Use at least 8 characters for your password.");
            return;
        }
        boolean creatingAccount = registerMode;
        if (creatingAccount) {
            String repeat = repeatInput == null || repeatInput.getText() == null ? "" : repeatInput.getText().toString();
            if (!password.equals(repeat)) {
                setAuthError("Passwords do not match.");
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
        submit.setAlpha(.65f);
        if (creatingAccount) {
            firebaseAuth.createUserWithEmailAndPassword(authEmail, password).addOnCompleteListener(this, task -> {
                if (task.isSuccessful()) ensureAccountProfile(normalized, true, submit);
                else {
                    submit.setEnabled(true);
                    submit.setAlpha(1f);
                    setAuthError(friendlyAuthError(task.getException()));
                }
            });
        } else {
            firebaseAuth.signInWithEmailAndPassword(authEmail, password).addOnCompleteListener(this, task -> {
                if (task.isSuccessful()) ensureAccountProfile(normalized, false, submit);
                else {
                    submit.setEnabled(true);
                    submit.setAlpha(1f);
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
            return "That username is already in use.";
        }
        if (value.contains("user_not_found") || value.contains("wrong_password") || value.contains("invalid_credential") || value.contains("invalid login credentials")) {
            return "Incorrect username or password.";
        }
        if (value.contains("weak_password")) return "Choose a stronger password with at least 8 characters.";
        if (value.contains("operation_not_allowed")) {
            return "Enable Email/Password sign-in in Firebase Authentication settings.";
        }
        if (value.contains("network")) return "No internet connection. Try again.";
        if (value.contains("invalid_email")) return "This username could not be used. Try another one.";
        return raw.isEmpty() ? "Could not sign in. Please try again." : raw;
    }

    private void ensureAccountProfile(String normalizedUsername, boolean newAccount, ImageButton submit) {
        FirebaseUser user = firebaseAuth.getCurrentUser();
        if (user == null) {
            onAccountSetupFailed(new IllegalStateException("No signed-in account."), newAccount, submit);
            return;
        }
        String uid = user.getUid();
        DocumentReference usernameRef = firestore.collection("usernames").document(normalizedUsername);
        DocumentReference profileRef = firestore.collection("users").document(uid);
        firestore.runTransaction(transaction -> {
            DocumentSnapshot usernameSnapshot = transaction.get(usernameRef);
            DocumentSnapshot profileSnapshot = transaction.get(profileRef);
            if (usernameSnapshot.exists() && !uid.equals(usernameSnapshot.getString("uid"))) {
                throw new IllegalStateException("username_taken");
            }
            if (!usernameSnapshot.exists()) {
                Map<String, Object> usernameData = new HashMap<>();
                usernameData.put("uid", uid);
                usernameData.put("username", normalizedUsername);
                transaction.set(usernameRef, usernameData);
            }
            Map<String, Object> profile = new HashMap<>();
            profile.put("uid", uid);
            profile.put("username", normalizedUsername);
            profile.put("usernameLower", normalizedUsername);
            if (!profileSnapshot.exists()) profile.put("createdAt", FieldValue.serverTimestamp());
            if (!profileSnapshot.contains("allowDirectMessages")) profile.put("allowDirectMessages", true);
            transaction.set(profileRef, profile, SetOptions.merge());
            return null;
        }).addOnSuccessListener(unused -> {
            if (activityDestroyed) return;
            username = normalizedUsername;
            loadCloudPrivacySettings(uid);
            registerMode = false;
            authError = "";
            if (submit != null) {
                submit.setEnabled(true);
                submit.setAlpha(1f);
            }
            loadBotMessages();
            startChatListListener();
            showMainTab(TAB_CHATS);
        }).addOnFailureListener(error -> onAccountSetupFailed(error, newAccount, submit));
    }

    private void onAccountSetupFailed(Exception error, boolean newAccount, ImageButton submit) {
        FirebaseUser current = firebaseAuth.getCurrentUser();
        if (newAccount && current != null) {
            current.delete().addOnCompleteListener(task -> {
                firebaseAuth.signOut();
                showAuthSetupError(error, submit);
            });
        } else {
            firebaseAuth.signOut();
            showAuthSetupError(error, submit);
        }
    }

    private void showAuthSetupError(Exception exception, ImageButton submit) {
        if (activityDestroyed) return;
        if (submit != null) {
            submit.setEnabled(true);
            submit.setAlpha(1f);
        }
        String raw = exception == null || exception.getMessage() == null ? "" : exception.getMessage();
        String value = raw.toLowerCase(Locale.ROOT);
        authError = value.contains("username_taken")
                ? "That username is already in use."
                : "Cloud setup failed. Enable Cloud Firestore and install the Duckgomz security rules, then try again.";
        showAuthScreen();
    }

    private String usernameFromUser(FirebaseUser user) {
        String email = user.getEmail();
        if (email != null && email.toLowerCase(Locale.ROOT).endsWith(ACCOUNT_DOMAIN)) {
            return email.substring(0, email.length() - ACCOUNT_DOMAIN.length()).toLowerCase(Locale.ROOT);
        }
        if (user.getDisplayName() != null && !user.getDisplayName().trim().isEmpty()) {
            return user.getDisplayName().trim().toLowerCase(Locale.ROOT);
        }
        return "account";
    }

    private void signOut() {
        removeMessageListener();
        removeChatListListener();
        firebaseAuth.signOut();
        username = "";
        messages.clear();
        botMessages.clear();
        remoteThreads.clear();
        activeThread = null;
        conversationOpen = false;
        currentTab = TAB_CHATS;
        registerMode = false;
        authError = "";
        showAuthScreen();
    }

    private void startChatListListener() {
        removeChatListListener();
        FirebaseUser current = firebaseAuth.getCurrentUser();
        if (current == null) return;
        chatListListener = firestore.collection("chats")
                .whereArrayContains("members", current.getUid())
                .addSnapshotListener((snapshot, error) -> {
                    if (error != null) {
                        if (!cloudErrorShown) {
                            cloudErrorShown = true;
                            showToast("Cloud chats are unavailable. Check Firestore setup and rules.");
                        }
                        return;
                    }
                    if (snapshot == null) return;
                    remoteThreads.clear();
                    for (DocumentSnapshot document : snapshot.getDocuments()) {
                        remoteThreads.add(ChatThread.fromDocument(document));
                    }
                    Collections.sort(remoteThreads, (first, second) -> Long.compare(second.updatedAt, first.updatedAt));
                    cloudErrorShown = false;
                    if (!conversationOpen && (currentTab == TAB_CHATS || currentTab == TAB_CONTACTS)) {
                        showMainTab(currentTab);
                    }
                });
    }

    private void removeChatListListener() {
        if (chatListListener != null) {
            chatListListener.remove();
            chatListListener = null;
        }
    }

    private void removeMessageListener() {
        if (messageListener != null) {
            messageListener.remove();
            messageListener = null;
        }
    }

    private void showChatList() {
        showMainTab(TAB_CHATS);
    }

    private void showMainTab(int tab) {
        int previousTab = currentTab;
        boolean animateTabChange = tab != previousTab;
        currentTab = tab;
        conversationOpen = false;
        chatCustomizationOpen = false;
        privacySettingsOpen = false;
        customizationReturnToConversation = false;
        directMessageToggle = null;
        activeThread = null;
        activeBotChat = false;
        removeMessageListener();
        messageList = null;
        messageAdapter = null;
        composer = null;
        chatWallpaperView = null;
        wallpaperPreview = null;
        root.removeAllViews();
        root.setBackgroundColor(BG);

        LinearLayout screen = new LinearLayout(this);
        screen.setOrientation(LinearLayout.VERTICAL);
        screen.setBackgroundColor(BG);
        root.addView(screen, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        addMainToolbar(screen, tab);

        FrameLayout body = new FrameLayout(this);
        screen.addView(body, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setClipToPadding(false);
        body.addView(scroll, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(0, dp(4), 0, dp(88));
        scroll.addView(content, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        if (tab == TAB_CHATS) {
            addChatRows(content);
        } else if (tab == TAB_CONTACTS) {
            addContactRows(content);
        } else if (tab == TAB_SETTINGS) {
            addSettings(content);
        } else {
            addProfile(content);
        }

        if (tab == TAB_CHATS) {
            ImageButton add = imageButton(R.drawable.ic_plus, "Create a group");
            add.setColorFilter(Color.WHITE);
            add.setBackground(rippleRounded(BLUE, dp(20)));
            add.setElevation(dp(7));
            FrameLayout.LayoutParams addParams = new FrameLayout.LayoutParams(dp(58), dp(58), Gravity.RIGHT | Gravity.BOTTOM);
            addParams.rightMargin = dp(18);
            addParams.bottomMargin = dp(18);
            body.addView(add, addParams);
            add.setOnClickListener(view -> showNewGroupSheet());
        }
        screen.addView(createBottomNavigation(tab, previousTab, animateTabChange));
        if (animateTabChange) {
            screen.setAlpha(.96f);
            screen.setTranslationY(dp(5));
            screen.animate()
                    .alpha(1f)
                    .translationY(0f)
                    .setDuration(260)
                    .setInterpolator(new DecelerateInterpolator(1.4f))
                    .start();
        }
    }

    private void addMainToolbar(LinearLayout screen, int tab) {
        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(16), dp(5), dp(10), dp(5));
        toolbar.setBackgroundColor(BG);
        screen.addView(toolbar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(62)));

        if (tab == TAB_CHATS) {
            ImageView mark = new ImageView(this);
            mark.setImageResource(R.drawable.ic_duckgomz_mark);
            mark.setScaleType(ImageView.ScaleType.FIT_CENTER);
            toolbar.addView(mark, new LinearLayout.LayoutParams(dp(40), dp(40)));
            TextView title = text("Duckgomz", 20, TEXT, true);
            LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
            titleParams.leftMargin = dp(11);
            toolbar.addView(title, titleParams);
            ImageButton search = imageButton(R.drawable.ic_search, "Find a username to start a private chat");
            search.setColorFilter(TEXT);
            toolbar.addView(search, new LinearLayout.LayoutParams(dp(44), dp(44)));
            search.setOnClickListener(view -> showNewDirectChatSheet());
            ImageButton more = imageButton(R.drawable.ic_more, "More options");
            more.setColorFilter(TEXT);
            toolbar.addView(more, new LinearLayout.LayoutParams(dp(40), dp(44)));
            more.setOnClickListener(view -> showAccountActions());
        } else {
            TextView title = text(tabTitle(tab), 22, TEXT, true);
            toolbar.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
            if (tab == TAB_CONTACTS) {
                ImageButton findContact = imageButton(R.drawable.ic_search, "Find a username to start a private chat");
                findContact.setColorFilter(TEXT);
                toolbar.addView(findContact, new LinearLayout.LayoutParams(dp(44), dp(44)));
                findContact.setOnClickListener(view -> showNewDirectChatSheet());
            } else if (tab == TAB_PROFILE) {
                ImageButton more = imageButton(R.drawable.ic_more, "More options");
                more.setColorFilter(TEXT);
                toolbar.addView(more, new LinearLayout.LayoutParams(dp(44), dp(44)));
                more.setOnClickListener(view -> showAccountActions());
            }
        }
        View divider = new View(this);
        divider.setBackgroundColor(DIVIDER);
        screen.addView(divider, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)));
    }

    private String tabTitle(int tab) {
        if (tab == TAB_CONTACTS) return "Contacts";
        if (tab == TAB_SETTINGS) return "Settings";
        if (tab == TAB_PROFILE) return "Profile";
        return "Chats";
    }

    private void addChatRows(LinearLayout content) {
        content.addView(makeChatRow(botThread(), false));
        addRowDivider(content, dp(78));
        if (remoteThreads.isEmpty()) {
            TextView hint = text("Tap search to start a private chat by username, or + to create a group.", 12, MUTED, false);
            hint.setGravity(Gravity.CENTER);
            hint.setPadding(dp(30), dp(24), dp(30), dp(20));
            content.addView(hint, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
            return;
        }
        for (int index = 0; index < remoteThreads.size(); index++) {
            ChatThread thread = remoteThreads.get(index);
            content.addView(makeChatRow(thread, false));
            if (index < remoteThreads.size() - 1) addRowDivider(content, dp(78));
        }
    }

    private void addContactRows(LinearLayout content) {
        ArrayList<ChatThread> directThreads = new ArrayList<>();
        for (ChatThread thread : remoteThreads) {
            if ("direct".equals(thread.type)) directThreads.add(thread);
        }
        Collections.sort(directThreads, Comparator.comparing(thread -> thread.displayName(currentUid()).toLowerCase(Locale.ROOT)));
        if (directThreads.isEmpty()) {
            addEmptyState(content, "No contacts yet", "Find someone by username to start a private chat.");
            return;
        }
        for (int index = 0; index < directThreads.size(); index++) {
            content.addView(makeChatRow(directThreads.get(index), true));
            if (index < directThreads.size() - 1) addRowDivider(content, dp(78));
        }
    }

    private void addEmptyState(LinearLayout content, String title, String description) {
        LinearLayout empty = new LinearLayout(this);
        empty.setOrientation(LinearLayout.VERTICAL);
        empty.setGravity(Gravity.CENTER);
        empty.setPadding(dp(28), dp(56), dp(28), dp(36));
        TextView heading = text(title, 18, TEXT, true);
        heading.setGravity(Gravity.CENTER);
        empty.addView(heading);
        TextView copy = text(description, 13, MUTED, false);
        copy.setGravity(Gravity.CENTER);
        copy.setLineSpacing(dp(3), 1f);
        LinearLayout.LayoutParams copyParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        copyParams.topMargin = dp(8);
        empty.addView(copy, copyParams);
        content.addView(empty, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
    }

    private View makeChatRow(ChatThread thread, boolean contactRow) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(16), dp(10), dp(14), dp(10));
        row.setMinimumHeight(dp(76));
        row.setBackground(rippleRounded(Color.TRANSPARENT, dp(8)));
        FrameLayout avatar = createThreadAvatar(thread, dp(54));
        row.addView(avatar, new LinearLayout.LayoutParams(dp(54), dp(54)));

        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams copyParams = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        copyParams.leftMargin = dp(13);
        row.addView(copy, copyParams);

        LinearLayout titleRow = new LinearLayout(this);
        titleRow.setOrientation(LinearLayout.HORIZONTAL);
        titleRow.setGravity(Gravity.CENTER_VERTICAL);
        copy.addView(titleRow);
        TextView name = text(thread.displayName(currentUid()), 16, TEXT, true);
        name.setSingleLine(true);
        name.setEllipsize(android.text.TextUtils.TruncateAt.END);
        titleRow.addView(name, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        String previewText = hideChatPreviews ? "Message preview hidden" : chatPreview(thread);
        TextView preview = text(previewText, 13, MUTED, false);
        preview.setSingleLine(true);
        preview.setEllipsize(android.text.TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams previewParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        previewParams.topMargin = dp(4);
        copy.addView(preview, previewParams);

        if (!contactRow) {
            LinearLayout details = new LinearLayout(this);
            details.setOrientation(LinearLayout.VERTICAL);
            details.setGravity(Gravity.RIGHT | Gravity.TOP);
            TextView time = text(displayTime(thread.updatedAt), 10, MUTED, false);
            details.addView(time);
            row.addView(details, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        }

        attachPressAnimation(row);
        row.setOnClickListener(view -> openThread(thread));
        row.setContentDescription((contactRow ? "Open contact " : "Open chat ") + thread.displayName(currentUid()));
        return row;
    }

    private void addRowDivider(LinearLayout parent, int leftMargin) {
        View divider = new View(this);
        divider.setBackgroundColor(DIVIDER);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1));
        params.leftMargin = leftMargin;
        parent.addView(divider, params);
    }

    private FrameLayout createThreadAvatar(ChatThread thread, int size) {
        FrameLayout frame = new FrameLayout(this);
        if (thread.isBot()) {
            frame.setBackground(circle(Color.rgb(57, 72, 95), Color.TRANSPARENT, 0));
            ImageView duck = new ImageView(this);
            duck.setImageResource(R.drawable.ic_duckgomz_duck);
            duck.setScaleType(ImageView.ScaleType.FIT_CENTER);
            FrameLayout.LayoutParams duckParams = new FrameLayout.LayoutParams(size - dp(8), size - dp(8), Gravity.CENTER);
            frame.addView(duck, duckParams);
            return frame;
        }
        if (thread.isGroup()) {
            frame.setBackground(circle(Color.rgb(73, 84, 131), Color.TRANSPARENT, 0));
            ImageView group = new ImageView(this);
            group.setImageResource(R.drawable.ic_group);
            group.setColorFilter(Color.WHITE);
            group.setPadding(dp(11), dp(11), dp(11), dp(11));
            frame.addView(group, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            return frame;
        }
        int[] palette = new int[]{Color.rgb(75, 105, 167), Color.rgb(64, 126, 133), Color.rgb(126, 87, 139), Color.rgb(128, 94, 71)};
        int colorIndex = Math.abs(thread.id.hashCode() % palette.length);
        frame.setBackground(circle(palette[colorIndex], Color.TRANSPARENT, 0));
        TextView initial = text(firstChar(thread.displayName(currentUid())), 18, Color.WHITE, true);
        initial.setGravity(Gravity.CENTER);
        frame.addView(initial, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        return frame;
    }

    private String firstChar(String value) {
        if (value == null || value.trim().isEmpty()) return "?";
        String clean = value.startsWith("@") ? value.substring(1) : value;
        return clean.substring(0, 1).toUpperCase(Locale.ROOT);
    }

    private FrameLayout createBottomNavigation(int selected, int previous, boolean animateSelection) {
        FrameLayout nav = new FrameLayout(this);
        nav.setClipChildren(false);
        nav.setClipToPadding(false);
        nav.setPadding(dp(5), dp(5), dp(5), dp(5));
        nav.setBackground(liquidTrayDrawable());
        LinearLayout.LayoutParams navParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(66));
        navParams.leftMargin = dp(12);
        navParams.rightMargin = dp(12);
        navParams.topMargin = dp(4);
        navParams.bottomMargin = dp(7);
        nav.setLayoutParams(navParams);

        FrameLayout indicator = new FrameLayout(this);
        indicator.setBackground(liquidIndicatorDrawable());
        indicator.setClipChildren(true);
        indicator.setClipToOutline(true);
        indicator.setElevation(dp(5));
        FrameLayout.LayoutParams indicatorParams = new FrameLayout.LayoutParams(dp(48), dp(56), Gravity.TOP | Gravity.START);
        nav.addView(indicator, indicatorParams);

        View gloss = new View(this);
        gloss.setBackground(liquidGlossDrawable());
        indicator.addView(gloss, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(27), Gravity.TOP));
        View sweep = new View(this);
        sweep.setBackground(glassSweepDrawable());
        sweep.setAlpha(0f);
        indicator.addView(sweep, new FrameLayout.LayoutParams(dp(42), ViewGroup.LayoutParams.MATCH_PARENT, Gravity.TOP | Gravity.START));

        LinearLayout items = new LinearLayout(this);
        items.setOrientation(LinearLayout.HORIZONTAL);
        items.setGravity(Gravity.CENTER_VERTICAL);
        nav.addView(items, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        int[] icons = new int[]{R.drawable.ic_tab_chats, R.drawable.ic_tab_contacts, R.drawable.ic_tab_settings, R.drawable.ic_tab_profile};
        String[] labels = new String[]{"Chats", "Contacts", "Settings", "Profile"};
        for (int index = 0; index < labels.length; index++) {
            final int tab = index;
            boolean active = index == selected;
            LinearLayout item = new LinearLayout(this);
            item.setOrientation(LinearLayout.VERTICAL);
            item.setGravity(Gravity.CENTER);
            item.setPadding(dp(5), dp(4), dp(5), dp(3));
            item.setBackground(rippleRounded(Color.TRANSPARENT, dp(22)));
            items.addView(item, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f));
            ImageView icon = new ImageView(this);
            icon.setImageResource(icons[index]);
            icon.setColorFilter(active ? Color.rgb(224, 231, 255) : MUTED);
            item.addView(icon, new LinearLayout.LayoutParams(dp(23), dp(23)));
            TextView label = text(labels[index], 10, active ? Color.rgb(236, 240, 255) : MUTED, active);
            LinearLayout.LayoutParams labelParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            labelParams.topMargin = dp(2);
            item.addView(label, labelParams);
            item.setContentDescription(labels[index]);
            attachPressAnimation(item);
            item.setOnClickListener(view -> {
                if (tab != currentTab) showMainTab(tab);
            });
            if (animateSelection && active) {
                icon.setScaleX(.88f);
                icon.setScaleY(.88f);
                icon.setAlpha(.76f);
                icon.animate().scaleX(1f).scaleY(1f).alpha(1f)
                        .setStartDelay(90)
                        .setDuration(360)
                        .setInterpolator(new OvershootInterpolator(1.15f))
                        .start();
            }
        }

        nav.addOnLayoutChangeListener(new View.OnLayoutChangeListener() {
            private boolean positioned;

            @Override
            public void onLayoutChange(View view, int left, int top, int right, int bottom,
                                      int oldLeft, int oldTop, int oldRight, int oldBottom) {
                if (positioned || right - left <= 0) return;
                positioned = true;
                nav.removeOnLayoutChangeListener(this);
                int availableWidth = nav.getWidth() - nav.getPaddingLeft() - nav.getPaddingRight();
                int itemWidth = availableWidth / labels.length;
                if (itemWidth <= 0) return;
                int pillWidth = itemWidth - dp(6);
                FrameLayout.LayoutParams params = (FrameLayout.LayoutParams) indicator.getLayoutParams();
                params.width = pillWidth;
                params.height = dp(56);
                params.leftMargin = selected * itemWidth + dp(3);
                params.topMargin = 0;
                indicator.setLayoutParams(params);
                if (animateSelection && previous >= 0 && previous < labels.length) {
                    float startOffset = (previous - selected) * itemWidth;
                    playLiquidIndicator(indicator, sweep, startOffset, pillWidth);
                }
            }
        });
        return nav;
    }

    private Drawable liquidTrayDrawable() {
        GradientDrawable tray = new GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                new int[]{Color.argb(142, 105, 120, 166), Color.argb(158, 54, 59, 91), Color.argb(186, 34, 36, 57)});
        tray.setCornerRadius(dp(29));
        tray.setStroke(dp(1), Color.argb(74, 239, 243, 255));
        return tray;
    }

    private Drawable liquidIndicatorDrawable() {
        GradientDrawable pill = new GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                new int[]{Color.argb(111, 211, 225, 255), Color.argb(83, 125, 151, 255), Color.argb(94, 82, 103, 226)});
        pill.setCornerRadius(dp(23));
        pill.setStroke(dp(1), Color.argb(132, 239, 244, 255));
        return pill;
    }

    private Drawable liquidGlossDrawable() {
        GradientDrawable gloss = new GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                new int[]{Color.argb(90, 255, 255, 255), Color.argb(28, 255, 255, 255), Color.TRANSPARENT});
        gloss.setCornerRadius(dp(23));
        return gloss;
    }

    private Drawable glassSweepDrawable() {
        return new GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                new int[]{Color.TRANSPARENT, Color.argb(150, 238, 244, 255), Color.argb(74, 168, 190, 255), Color.TRANSPARENT});
    }

    private void playLiquidIndicator(FrameLayout indicator, View sweep, float startOffset, int pillWidth) {
        indicator.setTranslationX(startOffset);
        indicator.setScaleX(.94f);
        indicator.setScaleY(.92f);
        indicator.setAlpha(.94f);

        SpringAnimation glide = new SpringAnimation(indicator, DynamicAnimation.TRANSLATION_X, 0f);
        glide.getSpring().setStiffness(1050f).setDampingRatio(.72f);
        glide.addUpdateListener((animation, value, velocity) -> {
            float stretch = Math.min(.24f, Math.abs(velocity) / 4200f);
            indicator.setScaleX(1f + stretch);
            indicator.setScaleY(1f - stretch * .28f);
        });
        glide.addEndListener((animation, canceled, value, velocity) -> {
            indicator.setScaleX(1f);
            indicator.setScaleY(1f);
            indicator.setAlpha(1f);
        });
        glide.start();

        sweep.setTranslationX(-pillWidth * .8f);
        sweep.animate().cancel();
        sweep.animate()
                .translationX(pillWidth * 1.2f)
                .alpha(.78f)
                .setStartDelay(35)
                .setDuration(460)
                .setInterpolator(new DecelerateInterpolator(1.6f))
                .withEndAction(() -> {
                    sweep.setAlpha(0f);
                    sweep.setTranslationX(-pillWidth * .8f);
                })
                .start();
    }

    private void addSettings(LinearLayout content) {
        TextView section = text("PREFERENCES", 10, MUTED, true);
        section.setLetterSpacing(.08f);
        LinearLayout.LayoutParams sectionParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        sectionParams.setMargins(dp(18), dp(18), dp(18), dp(9));
        content.addView(section, sectionParams);
        addSettingsRow(content, R.drawable.ic_tab_settings, "Chat appearance", "Themes, wallpaper, text size and message shape", () -> showChatAppearance(false));
        addRowDivider(content, dp(58));
        addSettingsRow(content, R.drawable.ic_info, "Privacy & Security", "Control chat requests, previews and screenshots", this::showPrivacySettings);
        addRowDivider(content, dp(58));
        addSettingsRow(content, R.drawable.ic_tab_profile, "Account", "@" + username, () -> showMainTab(TAB_PROFILE));

        MaterialButton signOut = primaryButton("Sign out");
        signOut.setBackgroundTintList(ColorStateList.valueOf(Color.rgb(68, 48, 62)));
        signOut.setTextColor(Color.rgb(255, 151, 163));
        LinearLayout.LayoutParams signOutParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(50));
        signOutParams.setMargins(dp(18), dp(28), dp(18), dp(16));
        content.addView(signOut, signOutParams);
        signOut.setOnClickListener(view -> signOut());
    }

    private void addSettingsRow(LinearLayout content, int iconId, String title, String subtitle, Runnable action) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(18), dp(13), dp(18), dp(13));
        row.setBackground(rippleRounded(Color.TRANSPARENT, dp(8)));
        content.addView(row, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        ImageView icon = new ImageView(this);
        icon.setImageResource(iconId);
        icon.setColorFilter(Color.rgb(145, 163, 255));
        row.addView(icon, new LinearLayout.LayoutParams(dp(24), dp(24)));
        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams copyParams = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        copyParams.leftMargin = dp(15);
        row.addView(copy, copyParams);
        copy.addView(text(title, 15, TEXT, false));
        TextView detail = text(subtitle, 12, MUTED, false);
        detail.setSingleLine(true);
        detail.setEllipsize(android.text.TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams detailParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        detailParams.topMargin = dp(3);
        copy.addView(detail, detailParams);
        attachPressAnimation(row);
        row.setOnClickListener(view -> action.run());
    }

    private void addProfile(LinearLayout content) {
        LinearLayout profile = new LinearLayout(this);
        profile.setOrientation(LinearLayout.VERTICAL);
        profile.setGravity(Gravity.CENTER_HORIZONTAL);
        profile.setPadding(dp(24), dp(42), dp(24), dp(26));
        content.addView(profile, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView avatar = text(firstChar(username), 31, Color.WHITE, true);
        avatar.setGravity(Gravity.CENTER);
        avatar.setBackground(circle(Color.rgb(73, 91, 147), Color.TRANSPARENT, 0));
        profile.addView(avatar, new LinearLayout.LayoutParams(dp(92), dp(92)));
        TextView handle = text("@" + username, 20, TEXT, true);
        handle.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams handleParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        handleParams.topMargin = dp(17);
        profile.addView(handle, handleParams);
        TextView type = text("Username account", 13, MUTED, false);
        type.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams typeParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        typeParams.topMargin = dp(5);
        profile.addView(type, typeParams);

        MaterialButton signOut = primaryButton("Sign out");
        signOut.setBackgroundTintList(ColorStateList.valueOf(Color.rgb(68, 48, 62)));
        signOut.setTextColor(Color.rgb(255, 151, 163));
        LinearLayout.LayoutParams signOutParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(50));
        signOutParams.topMargin = dp(34);
        profile.addView(signOut, signOutParams);
        signOut.setOnClickListener(view -> signOut());
    }

    private LinearLayout createSettingsPage(String title) {
        chatWallpaperView = null;
        wallpaperPreview = null;
        root.removeAllViews();
        root.setBackgroundColor(BG);
        LinearLayout screen = new LinearLayout(this);
        screen.setOrientation(LinearLayout.VERTICAL);
        screen.setBackgroundColor(BG);
        root.addView(screen, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(7), dp(5), dp(16), dp(5));
        screen.addView(toolbar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(60)));
        ImageButton back = imageButton(R.drawable.ic_arrow_back, "Back");
        back.setColorFilter(TEXT);
        toolbar.addView(back, new LinearLayout.LayoutParams(dp(44), dp(44)));
        back.setOnClickListener(view -> closeSettingsSubpage());
        TextView heading = text(title, 19, TEXT, true);
        LinearLayout.LayoutParams headingParams = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        headingParams.leftMargin = dp(8);
        toolbar.addView(heading, headingParams);
        View divider = new View(this);
        divider.setBackgroundColor(DIVIDER);
        screen.addView(divider, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)));

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setClipToPadding(false);
        screen.addView(scroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(18), dp(13), dp(18), dp(30));
        scroll.addView(content, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        return content;
    }

    private void closeSettingsSubpage() {
        boolean returnToChat = customizationReturnToConversation && activeThread != null;
        chatCustomizationOpen = false;
        privacySettingsOpen = false;
        customizationReturnToConversation = false;
        directMessageToggle = null;
        if (returnToChat) {
            conversationOpen = true;
            activeBotChat = activeThread.isBot();
            showConversation();
            if (!activeBotChat) listenToMessages(activeThread);
        } else {
            showMainTab(TAB_SETTINGS);
        }
    }

    private void showPrivacySettings() {
        privacySettingsOpen = true;
        chatCustomizationOpen = false;
        customizationReturnToConversation = false;
        LinearLayout content = createSettingsPage("Privacy & Security");
        addPageSection(content, "MESSAGES");
        TextView intro = text("Choose who can start conversations with you and what appears on this device.", 13, MUTED, false);
        intro.setLineSpacing(dp(3), 1f);
        content.addView(intro, pageItemParams(0, 0, 0, 8));

        directMessageToggle = addSwitchSetting(content, "Allow new private chats",
                "Other Duckgomz users can create a new one-to-one chat with your account.", allowDirectMessages);
        bindDirectMessageToggle(directMessageToggle);
        directMessageToggle.setEnabled(false);
        loadCloudPrivacySettings(currentUid());
        addPageDivider(content);

        SwitchMaterial previewToggle = addSwitchSetting(content, "Hide chat previews",
                "Replace the latest-message text in your Chats and Contacts lists on this device.", hideChatPreviews);
        previewToggle.setOnCheckedChangeListener((button, enabled) -> {
            hideChatPreviews = enabled;
            preferences.edit().putBoolean("hide_chat_previews", enabled).apply();
        });
        addPageDivider(content);

        SwitchMaterial screenshotToggle = addSwitchSetting(content, "Block screenshots and screen recording",
                "Use Android's secure-window protection while Duckgomz is open on this device.", blockScreenshots);
        screenshotToggle.setOnCheckedChangeListener((button, enabled) -> {
            blockScreenshots = enabled;
            preferences.edit().putBoolean("block_screenshots", enabled).apply();
            applyScreenshotPrivacy();
        });

        addPageSection(content, "ON-DEVICE DATA");
        TextView encryptionNotice = text("The local message cache is encrypted with an Android Keystore key. Cloud messages and attachments use TLS and are stored in Firebase. Duckgomz does not provide end-to-end encryption.", 13, MUTED, false);
        encryptionNotice.setLineSpacing(dp(4), 1f);
        encryptionNotice.setPadding(dp(14), dp(13), dp(14), dp(13));
        encryptionNotice.setBackground(rounded(SURFACE, Color.TRANSPARENT, dp(12)));
        content.addView(encryptionNotice, pageItemParams(0, 8, 0, 8));

        MaterialButton clearCache = primaryButton("Clear encrypted message cache");
        clearCache.setBackgroundTintList(ColorStateList.valueOf(Color.rgb(68, 48, 62)));
        clearCache.setTextColor(Color.rgb(255, 151, 163));
        content.addView(clearCache, pageItemParams(0, 5, 0, 0));
        clearCache.setOnClickListener(view -> confirmClearEncryptedCache());
    }

    private void loadCloudPrivacySettings(String uid) {
        if (uid == null || uid.isEmpty() || firestore == null) return;
        firestore.collection("users").document(uid).get()
                .addOnSuccessListener(document -> {
                    if (document.exists() && document.contains("allowDirectMessages")) {
                        allowDirectMessages = Boolean.TRUE.equals(document.getBoolean("allowDirectMessages"));
                    }
                    if (directMessageToggle != null) {
                        directMessageToggle.setOnCheckedChangeListener(null);
                        directMessageToggle.setChecked(allowDirectMessages);
                        bindDirectMessageToggle(directMessageToggle);
                        directMessageToggle.setEnabled(true);
                    }
                })
                .addOnFailureListener(error -> {
                    if (directMessageToggle != null) directMessageToggle.setEnabled(true);
                });
    }

    private void bindDirectMessageToggle(SwitchMaterial toggle) {
        toggle.setOnCheckedChangeListener((button, enabled) -> {
            FirebaseUser current = firebaseAuth.getCurrentUser();
            if (current == null) {
                restoreDirectMessageToggle(toggle, allowDirectMessages);
                return;
            }
            boolean previous = allowDirectMessages;
            toggle.setEnabled(false);
            firestore.collection("users").document(current.getUid())
                    .update("allowDirectMessages", enabled)
                    .addOnSuccessListener(unused -> {
                        allowDirectMessages = enabled;
                        toggle.setEnabled(true);
                    })
                    .addOnFailureListener(error -> {
                        restoreDirectMessageToggle(toggle, previous);
                        showToast("Privacy setting was not saved. Check your connection and Firestore rules.");
                    });
        });
    }

    private void restoreDirectMessageToggle(SwitchMaterial toggle, boolean value) {
        toggle.setOnCheckedChangeListener(null);
        toggle.setChecked(value);
        toggle.setEnabled(true);
        bindDirectMessageToggle(toggle);
    }

    private SwitchMaterial addSwitchSetting(LinearLayout parent, String title, String description, boolean checked) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(2), dp(11), dp(2), dp(11));
        parent.addView(row, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams copyParams = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        copyParams.rightMargin = dp(12);
        row.addView(copy, copyParams);
        copy.addView(text(title, 14, TEXT, true));
        TextView detail = text(description, 12, MUTED, false);
        detail.setLineSpacing(dp(2), 1f);
        LinearLayout.LayoutParams detailParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        detailParams.topMargin = dp(4);
        copy.addView(detail, detailParams);

        SwitchMaterial toggle = new SwitchMaterial(this);
        toggle.setUseMaterialThemeColors(false);
        toggle.setThumbTintList(new ColorStateList(
                new int[][]{new int[]{android.R.attr.state_checked}, new int[]{}},
                new int[]{Color.rgb(182, 194, 255), Color.rgb(137, 141, 159)}));
        toggle.setTrackTintList(new ColorStateList(
                new int[][]{new int[]{android.R.attr.state_checked}, new int[]{}},
                new int[]{Color.rgb(79, 96, 160), Color.rgb(70, 72, 89)}));
        row.addView(toggle, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        toggle.setChecked(checked);
        row.setOnClickListener(view -> toggle.toggle());
        return toggle;
    }

    private void confirmClearEncryptedCache() {
        BottomSheetDialog dialog = new BottomSheetDialog(this);
        LinearLayout sheet = createSheet("Clear local message cache?");
        TextView message = text("This removes only encrypted message copies stored on this device. Cloud messages and files are not deleted.", 13, MUTED, false);
        message.setLineSpacing(dp(4), 1f);
        sheet.addView(message, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        MaterialButton cancel = primaryButton("Cancel");
        cancel.setBackgroundTintList(ColorStateList.valueOf(SURFACE_ALT));
        LinearLayout.LayoutParams cancelParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48));
        cancelParams.topMargin = dp(10);
        sheet.addView(cancel, cancelParams);
        cancel.setOnClickListener(view -> dialog.dismiss());
        MaterialButton clear = primaryButton("Clear cache");
        clear.setBackgroundTintList(ColorStateList.valueOf(Color.rgb(92, 49, 61)));
        clear.setTextColor(Color.rgb(255, 161, 172));
        LinearLayout.LayoutParams clearParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48));
        clearParams.topMargin = dp(9);
        sheet.addView(clear, clearParams);
        clear.setOnClickListener(view -> {
            dialog.dismiss();
            Map<String, ?> all = preferences.getAll();
            SharedPreferences.Editor editor = preferences.edit();
            for (String key : all.keySet()) {
                if (key.startsWith("chat_v1_") || key.startsWith("history_v1_") || key.startsWith("messages_")) {
                    editor.remove(key);
                }
            }
            editor.apply();
            imagePreviewCache.evictAll();
            clearCacheDirectory(new File(getCacheDir(), "image_previews"));
            clearCacheDirectory(new File(getCacheDir(), "attachments"));
            botMessages.clear();
            botMessages.add(welcomeMessage());
            storageAvailable = true;
            saveBotMessages();
            showToast("Encrypted message cache cleared from this device.");
        });
        showDarkSheet(dialog, sheet);
    }

    private void clearCacheDirectory(File directory) {
        if (directory == null || !directory.isDirectory()) return;
        File[] files = directory.listFiles();
        if (files == null) return;
        for (File file : files) {
            if (file.isFile()) file.delete();
        }
    }

    private void applyScreenshotPrivacy() {
        if (getWindow() == null) return;
        if (blockScreenshots) getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
    }

    private void addPageSection(LinearLayout content, String title) {
        TextView label = text(title, 10, MUTED, true);
        label.setLetterSpacing(.08f);
        content.addView(label, pageItemParams(0, 19, 0, 7));
    }

    private void addPageDivider(LinearLayout content) {
        View divider = new View(this);
        divider.setBackgroundColor(DIVIDER);
        LinearLayout.LayoutParams params = pageItemParams(0, 0, 0, 0);
        params.height = dp(1);
        content.addView(divider, params);
    }

    private LinearLayout.LayoutParams pageItemParams(int left, int top, int right, int bottom) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        params.setMargins(dp(left), dp(top), dp(right), dp(bottom));
        return params;
    }

    private void showChatAppearance(boolean fromConversation) {
        boolean returnToChat = fromConversation && activeThread != null;
        if (returnToChat && conversationOpen) {
            conversationOpen = false;
            removeMessageListener();
        }
        customizationReturnToConversation = returnToChat;
        chatCustomizationOpen = true;
        privacySettingsOpen = false;
        directMessageToggle = null;
        LinearLayout content = createSettingsPage("Chat appearance");

        TextView intro = text("Customize the look of messages across all your chats.", 13, MUTED, false);
        content.addView(intro, pageItemParams(0, 0, 0, 4));
        addPageSection(content, "COLOR THEME");
        int selectedTheme = chatThemeIndex();
        addColorChoices(content, CHAT_THEME_NAMES, CHAT_THEME_BUBBLES, selectedTheme, index -> {
            preferences.edit().putInt("chat_theme_index", index).apply();
            showChatAppearance(customizationReturnToConversation);
        });

        addPageSection(content, "MODE");
        String[] modeNames = new String[]{"Dark", "Dim", "Light"};
        addModeChoices(content, modeNames, chatMode(), index -> {
            preferences.edit().putInt("chat_mode", index).apply();
            showChatAppearance(customizationReturnToConversation);
        });

        addPageSection(content, "MESSAGE TEXT");
        addAppearanceSlider(content, "Text size", 13, 23, preferences.getInt("chat_text_size", 15), "sp",
                value -> preferences.edit().putInt("chat_text_size", value).apply());
        addAppearanceSlider(content, "Bubble corner radius", 8, 30, preferences.getInt("chat_bubble_radius", 18), "dp",
                value -> preferences.edit().putInt("chat_bubble_radius", value).apply());

        addPageSection(content, "SENDER NAME COLOR");
        String[] colorNames = new String[]{"Blue", "Cyan", "Violet", "Mint", "Coral", "Gold"};
        addColorChoices(content, colorNames, NAME_COLORS, nameColorIndex(), index -> {
            preferences.edit().putInt("chat_name_color", index).apply();
            showChatAppearance(customizationReturnToConversation);
        });

        addPageSection(content, "CHAT WALLPAPER");
        FrameLayout wallpaperFrame = new FrameLayout(this);
        wallpaperFrame.setBackground(rounded(SURFACE_ALT, Color.TRANSPARENT, dp(14)));
        wallpaperFrame.setClipToOutline(true);
        LinearLayout.LayoutParams wallpaperParams = pageItemParams(0, 1, 0, 0);
        wallpaperParams.height = dp(132);
        content.addView(wallpaperFrame, wallpaperParams);
        wallpaperPreview = new ImageView(this);
        wallpaperPreview.setScaleType(ImageView.ScaleType.CENTER_CROP);
        wallpaperFrame.addView(wallpaperPreview, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        TextView wallpaperHint = text("No wallpaper selected · tap to choose", 12, MUTED, true);
        wallpaperHint.setGravity(Gravity.CENTER);
        wallpaperFrame.addView(wallpaperHint, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        wallpaperFrame.setOnClickListener(view -> openWallpaperPicker());
        refreshWallpaperPreview();

        LinearLayout wallpaperActions = new LinearLayout(this);
        wallpaperActions.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout.LayoutParams actionsParams = pageItemParams(0, 8, 0, 0);
        content.addView(wallpaperActions, actionsParams);
        MaterialButton chooseWallpaper = primaryButton("Choose wallpaper");
        chooseWallpaper.setTextSize(12);
        wallpaperActions.addView(chooseWallpaper, new LinearLayout.LayoutParams(0, dp(44), 1f));
        chooseWallpaper.setOnClickListener(view -> openWallpaperPicker());
        MaterialButton removeWallpaper = primaryButton("Remove");
        removeWallpaper.setTextSize(12);
        removeWallpaper.setBackgroundTintList(ColorStateList.valueOf(SURFACE_ALT));
        LinearLayout.LayoutParams removeParams = new LinearLayout.LayoutParams(0, dp(44), .65f);
        removeParams.leftMargin = dp(8);
        wallpaperActions.addView(removeWallpaper, removeParams);
        removeWallpaper.setOnClickListener(view -> clearChatWallpaper());

        MaterialButton reset = primaryButton("Reset chat appearance");
        reset.setBackgroundTintList(ColorStateList.valueOf(SURFACE_ALT));
        content.addView(reset, pageItemParams(0, 24, 0, 0));
        reset.setOnClickListener(view -> resetChatAppearance());
    }

    private void addColorChoices(LinearLayout parent, String[] labels, int[] colors, int selected, IndexListener listener) {
        HorizontalScrollView horizontal = new HorizontalScrollView(this);
        horizontal.setHorizontalScrollBarEnabled(false);
        horizontal.setVerticalScrollBarEnabled(false);
        horizontal.setFillViewport(false);
        horizontal.setClipToPadding(false);
        LinearLayout.LayoutParams horizontalParams = pageItemParams(0, 0, 0, 0);
        horizontalParams.height = dp(76);
        parent.addView(horizontal, horizontalParams);
        LinearLayout choices = new LinearLayout(this);
        choices.setOrientation(LinearLayout.HORIZONTAL);
        horizontal.addView(choices, new HorizontalScrollView.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.MATCH_PARENT));
        for (int index = 0; index < labels.length; index++) {
            final int choice = index;
            LinearLayout option = new LinearLayout(this);
            option.setOrientation(LinearLayout.VERTICAL);
            option.setGravity(Gravity.CENTER_HORIZONTAL);
            option.setPadding(dp(5), dp(3), dp(5), 0);
            choices.addView(option, new LinearLayout.LayoutParams(dp(66), ViewGroup.LayoutParams.MATCH_PARENT));
            TextView swatch = new TextView(this);
            swatch.setGravity(Gravity.CENTER);
            swatch.setBackground(circle(colors[index], index == selected ? Color.WHITE : Color.TRANSPARENT, dp(index == selected ? 2 : 0)));
            option.addView(swatch, new LinearLayout.LayoutParams(dp(34), dp(34)));
            TextView label = text(labels[index], 10, index == selected ? TEXT : MUTED, index == selected);
            label.setGravity(Gravity.CENTER);
            label.setSingleLine(true);
            LinearLayout.LayoutParams labelParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            labelParams.topMargin = dp(4);
            option.addView(label, labelParams);
            option.setBackground(rippleRounded(Color.TRANSPARENT, dp(9)));
            option.setOnClickListener(view -> listener.onSelected(choice));
        }
    }

    private void addModeChoices(LinearLayout parent, String[] names, int selected, IndexListener listener) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout.LayoutParams rowParams = pageItemParams(0, 0, 0, 0);
        rowParams.height = dp(44);
        parent.addView(row, rowParams);
        for (int index = 0; index < names.length; index++) {
            final int choice = index;
            TextView mode = text(names[index], 13, index == selected ? Color.WHITE : MUTED, index == selected);
            mode.setGravity(Gravity.CENTER);
            mode.setBackground(rippleRounded(index == selected ? BLUE : SURFACE_ALT, dp(14)));
            LinearLayout.LayoutParams modeParams = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f);
            if (index > 0) modeParams.leftMargin = dp(7);
            row.addView(mode, modeParams);
            mode.setOnClickListener(view -> listener.onSelected(choice));
        }
    }

    private void addAppearanceSlider(LinearLayout parent, String label, int minimum, int maximum,
                                     int current, String unit, IndexListener listener) {
        LinearLayout block = new LinearLayout(this);
        block.setOrientation(LinearLayout.VERTICAL);
        block.setPadding(0, dp(4), 0, dp(8));
        parent.addView(block, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        LinearLayout heading = new LinearLayout(this);
        heading.setOrientation(LinearLayout.HORIZONTAL);
        heading.setGravity(Gravity.CENTER_VERTICAL);
        block.addView(heading, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        TextView title = text(label, 13, TEXT, false);
        heading.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        TextView valueLabel = text(current + " " + unit, 12, Color.rgb(177, 190, 255), true);
        heading.addView(valueLabel);
        SeekBar seekBar = new SeekBar(this);
        seekBar.setMax(maximum - minimum);
        seekBar.setProgress(Math.max(0, Math.min(maximum - minimum, current - minimum)));
        seekBar.setProgressTintList(ColorStateList.valueOf(BLUE));
        seekBar.setThumbTintList(ColorStateList.valueOf(Color.rgb(185, 197, 255)));
        block.addView(seekBar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(35)));
        seekBar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            private int value = current;
            @Override
            public void onProgressChanged(SeekBar bar, int progress, boolean fromUser) {
                value = minimum + progress;
                valueLabel.setText(value + " " + unit);
            }
            @Override
            public void onStartTrackingTouch(SeekBar bar) { }
            @Override
            public void onStopTrackingTouch(SeekBar bar) {
                listener.onSelected(value);
            }
        });
    }

    private void openWallpaperPicker() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("image/*");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        try {
            wallpaperPicker.launch(intent);
        } catch (Exception error) {
            showToast("Could not open the image picker.");
        }
    }

    private void onWallpaperPicked(Intent result) {
        Uri uri = result.getData();
        if (uri == null) return;
        try {
            int flags = result.getFlags() & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            getContentResolver().takePersistableUriPermission(uri, flags & Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (Exception ignored) {
        }
        loadedWallpaperUri = uri.toString();
        preferences.edit().putString("chat_wallpaper_uri", loadedWallpaperUri).apply();
        decodeWallpaperAsync(uri);
    }

    private void refreshWallpaperPreview() {
        if (wallpaperPreview == null) return;
        if (loadedWallpaperBitmap != null) {
            wallpaperPreview.setImageBitmap(loadedWallpaperBitmap);
            wallpaperPreview.setVisibility(View.VISIBLE);
        } else {
            wallpaperPreview.setImageDrawable(null);
            wallpaperPreview.setVisibility(View.INVISIBLE);
        }
        View parent = (View) wallpaperPreview.getParent();
        if (parent instanceof FrameLayout && ((FrameLayout) parent).getChildCount() > 1) {
            ((FrameLayout) parent).getChildAt(1).setVisibility(loadedWallpaperBitmap == null ? View.VISIBLE : View.GONE);
        }
    }

    private void loadWallpaperFromPreferences() {
        loadedWallpaperUri = preferences.getString("chat_wallpaper_uri", "");
        if (loadedWallpaperUri.isEmpty()) return;
        decodeWallpaperAsync(Uri.parse(loadedWallpaperUri));
    }

    private void decodeWallpaperAsync(Uri uri) {
        String key = uri.toString();
        ioExecutor.execute(() -> {
            Bitmap bitmap = null;
            Exception failure = null;
            try {
                bitmap = decodeWallpaper(uri);
                if (bitmap == null) throw new IOException("Unsupported image.");
            } catch (Exception error) {
                failure = error;
            }
            Bitmap decoded = bitmap;
            Exception decodeError = failure;
            handler.post(() -> {
                if (!key.equals(loadedWallpaperUri) || activityDestroyed) return;
                if (decodeError != null || decoded == null) {
                    showToast("The selected wallpaper could not be loaded.");
                    return;
                }
                loadedWallpaperBitmap = decoded;
                refreshWallpaperPreview();
                if (conversationOpen && chatWallpaperView != null) {
                    chatWallpaperView.setImageBitmap(decoded);
                }
            });
        });
    }

    private Bitmap decodeWallpaper(Uri uri) throws IOException {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        try (InputStream input = getContentResolver().openInputStream(uri)) {
            if (input == null) throw new IOException("Wallpaper cannot be opened.");
            BitmapFactory.decodeStream(input, null, bounds);
        }
        int sample = 1;
        int maximum = Math.max(bounds.outWidth, bounds.outHeight);
        while (maximum / sample > 1600) sample *= 2;
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inSampleSize = sample;
        options.inPreferredConfig = Bitmap.Config.RGB_565;
        try (InputStream input = getContentResolver().openInputStream(uri)) {
            if (input == null) throw new IOException("Wallpaper cannot be opened.");
            return BitmapFactory.decodeStream(input, null, options);
        }
    }

    private void clearChatWallpaper() {
        loadedWallpaperUri = "";
        loadedWallpaperBitmap = null;
        preferences.edit().remove("chat_wallpaper_uri").apply();
        refreshWallpaperPreview();
    }

    private void resetChatAppearance() {
        loadedWallpaperUri = "";
        loadedWallpaperBitmap = null;
        preferences.edit()
                .remove("chat_theme_index")
                .remove("chat_mode")
                .remove("chat_text_size")
                .remove("chat_bubble_radius")
                .remove("chat_name_color")
                .remove("chat_wallpaper_uri")
                .apply();
        showChatAppearance(customizationReturnToConversation);
    }

    private int chatThemeIndex() {
        return Math.max(0, Math.min(CHAT_THEME_NAMES.length - 1, preferences.getInt("chat_theme_index", 0)));
    }

    private int chatMode() {
        return Math.max(0, Math.min(2, preferences.getInt("chat_mode", 0)));
    }

    private int nameColorIndex() {
        return Math.max(0, Math.min(NAME_COLORS.length - 1, preferences.getInt("chat_name_color", 0)));
    }

    private int chatBackgroundColor() {
        int mode = chatMode();
        if (mode == 2) return Color.rgb(235, 237, 243);
        if (mode == 1) return Color.rgb(17, 18, 27);
        return CHAT_THEME_BACKGROUNDS[chatThemeIndex()];
    }

    private int chatSurfaceColor() {
        int mode = chatMode();
        if (mode == 2) return Color.rgb(247, 248, 251);
        if (mode == 1) return Color.rgb(25, 26, 38);
        return SURFACE;
    }

    private int chatForegroundColor() {
        return chatMode() == 2 ? Color.rgb(33, 36, 50) : TEXT;
    }

    private int chatSecondaryColor() {
        return chatMode() == 2 ? Color.rgb(95, 100, 116) : MUTED;
    }

    private int chatIncomingColor() {
        int mode = chatMode();
        if (mode == 2) return Color.WHITE;
        if (mode == 1) return Color.rgb(37, 39, 54);
        return Color.rgb(43, 45, 62);
    }

    private int chatOutgoingColor() {
        return CHAT_THEME_BUBBLES[chatThemeIndex()];
    }

    private void showAccountActions() {
        BottomSheetDialog dialog = new BottomSheetDialog(this);
        LinearLayout sheet = createSheet("Account");
        TextView handle = text("@" + username, 15, MUTED, false);
        LinearLayout.LayoutParams handleParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        handleParams.bottomMargin = dp(14);
        sheet.addView(handle, handleParams);
        addSheetButton(sheet, "Settings", () -> {
            dialog.dismiss();
            showMainTab(TAB_SETTINGS);
        }, false);
        addSheetButton(sheet, "Sign out", () -> {
            dialog.dismiss();
            signOut();
        }, true);
        showDarkSheet(dialog, sheet);
    }

    private void showNewDirectChatSheet() {
        BottomSheetDialog dialog = new BottomSheetDialog(this);
        LinearLayout sheet = createSheet("New private chat");
        TextInputLayout usernameField = createInput("Username", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD);
        TextInputEditText usernameInput = (TextInputEditText) usernameField.getEditText();
        usernameInput.setSingleLine(true);
        usernameInput.setImeOptions(EditorInfo.IME_ACTION_DONE);
        sheet.addView(usernameField, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        MaterialButton start = primaryButton("Start chat");
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(50));
        buttonParams.topMargin = dp(16);
        sheet.addView(start, buttonParams);
        start.setOnClickListener(view -> startDirectChat(usernameInput.getText() == null ? "" : usernameInput.getText().toString(), dialog, start));
        showDarkSheet(dialog, sheet);
    }

    private void showNewGroupSheet() {
        BottomSheetDialog dialog = new BottomSheetDialog(this);
        LinearLayout sheet = createSheet("New group");
        TextInputLayout titleField = createInput("Group name", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        TextInputEditText titleInput = (TextInputEditText) titleField.getEditText();
        titleInput.setSingleLine(true);
        titleField.setEndIconMode(TextInputLayout.END_ICON_NONE);
        sheet.addView(titleField, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        TextInputLayout membersField = createInput("Add usernames (comma separated)", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        TextInputEditText membersInput = (TextInputEditText) membersField.getEditText();
        membersInput.setSingleLine(false);
        membersInput.setMinLines(2);
        membersInput.setMaxLines(3);
        membersField.setEndIconMode(TextInputLayout.END_ICON_NONE);
        LinearLayout.LayoutParams membersParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        membersParams.topMargin = dp(13);
        sheet.addView(membersField, membersParams);
        MaterialButton create = primaryButton("Create group");
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(50));
        buttonParams.topMargin = dp(16);
        sheet.addView(create, buttonParams);
        create.setOnClickListener(view -> createGroup(
                titleInput.getText() == null ? "" : titleInput.getText().toString(),
                membersInput.getText() == null ? "" : membersInput.getText().toString(),
                dialog, create));
        showDarkSheet(dialog, sheet);
    }

    private void showAddMembersSheet(ChatThread thread) {
        BottomSheetDialog dialog = new BottomSheetDialog(this);
        LinearLayout sheet = createSheet("Add people");
        TextInputLayout membersField = createInput("Usernames (comma separated)", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        TextInputEditText membersInput = (TextInputEditText) membersField.getEditText();
        membersInput.setSingleLine(false);
        membersInput.setMinLines(2);
        membersInput.setMaxLines(3);
        membersField.setEndIconMode(TextInputLayout.END_ICON_NONE);
        sheet.addView(membersField, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        MaterialButton add = primaryButton("Add people");
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(50));
        buttonParams.topMargin = dp(16);
        sheet.addView(add, buttonParams);
        add.setOnClickListener(view -> addMembers(
                thread,
                membersInput.getText() == null ? "" : membersInput.getText().toString(),
                dialog, add));
        showDarkSheet(dialog, sheet);
    }

    private List<String> parseUsernameList(String raw) {
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        String trimmed = raw == null ? "" : raw.trim();
        if (trimmed.isEmpty()) return new ArrayList<>();
        for (String part : trimmed.split("[,\\s]+")) {
            if (part.trim().isEmpty()) continue;
            String value = part.trim();
            String error = UsernameRules.validate(value);
            if (error != null) throw new IllegalArgumentException(error);
            unique.add(UsernameRules.normalize(value));
        }
        return new ArrayList<>(unique);
    }

    private interface UserResolutionCallback {
        void onResolved(ArrayList<UserIdentity> users, String error);
    }

    private interface IndexListener {
        void onSelected(int index);
    }

    private void resolveUsernames(List<String> names, int index, ArrayList<UserIdentity> found, UserResolutionCallback callback) {
        if (index >= names.size()) {
            callback.onResolved(found, null);
            return;
        }
        String name = names.get(index);
        firestore.collection("usernames").document(name).get()
                .addOnSuccessListener(document -> {
                    if (!document.exists()) {
                        callback.onResolved(found, "No Duckgomz account was found for @" + name + ".");
                        return;
                    }
                    String uid = document.getString("uid");
                    String canonicalName = document.getString("username");
                    if (uid == null || canonicalName == null) {
                        callback.onResolved(found, "That account could not be loaded. Try again.");
                        return;
                    }
                    firestore.collection("users").document(uid).get()
                            .addOnSuccessListener(profile -> {
                                boolean allowNewChats = !profile.contains("allowDirectMessages")
                                        || Boolean.TRUE.equals(profile.getBoolean("allowDirectMessages"));
                                found.add(new UserIdentity(uid, canonicalName, allowNewChats));
                                resolveUsernames(names, index + 1, found, callback);
                            })
                            .addOnFailureListener(error -> callback.onResolved(found, "Could not load that account's privacy settings. Try again."));
                })
                .addOnFailureListener(error -> callback.onResolved(found, "Could not find that username. Check your connection."));
    }

    private void startDirectChat(String rawUsername, BottomSheetDialog dialog, MaterialButton button) {
        String name = UsernameRules.normalize(rawUsername);
        String validationError = UsernameRules.validate(name);
        if (validationError != null) {
            showToast(validationError);
            return;
        }
        button.setEnabled(false);
        resolveUsernames(Collections.singletonList(name), 0, new ArrayList<>(), (users, error) -> {
            if (error != null || users.isEmpty()) {
                button.setEnabled(true);
                showToast(error == null ? "Could not find that username." : error);
                return;
            }
            UserIdentity other = users.get(0);
            FirebaseUser current = firebaseAuth.getCurrentUser();
            if (current == null) return;
            if (other.uid.equals(current.getUid())) {
                button.setEnabled(true);
                showToast("You cannot start a chat with your own account.");
                return;
            }
            ArrayList<String> members = new ArrayList<>(Arrays.asList(current.getUid(), other.uid));
            HashMap<String, String> names = new HashMap<>();
            names.put(current.getUid(), username);
            names.put(other.uid, other.username);
            String id = directChatId(current.getUid(), other.uid);
            DocumentReference chatRef = firestore.collection("chats").document(id);
            Map<String, Object> data = chatData("direct", "", members, names, current.getUid());
            firestore.runTransaction(transaction -> {
                DocumentSnapshot existing = transaction.get(chatRef);
                if (!existing.exists()) {
                    if (!other.allowDirectMessages) throw new IllegalStateException("direct_messages_disabled");
                    transaction.set(chatRef, data);
                } else {
                    Object rawMembers = existing.get("members");
                    if (!(rawMembers instanceof List<?>) || !((List<?>) rawMembers).contains(current.getUid()) || !((List<?>) rawMembers).contains(other.uid)) {
                        throw new IllegalStateException("This private chat is not available.");
                    }
                }
                return null;
            }).addOnSuccessListener(unused -> {
                dialog.dismiss();
                openThread(new ChatThread(id, "direct", "", "", System.currentTimeMillis(), members, names));
            }).addOnFailureListener(failure -> {
                button.setEnabled(true);
                String message = String.valueOf(failure.getMessage());
                if (message.contains("direct_messages_disabled")) {
                    showToast("This user has turned off new private chat requests.");
                } else {
                    showToast("Could not start the chat. Check your connection and Firestore rules.");
                }
            });
        });
    }

    private void createGroup(String rawTitle, String rawUsernames, BottomSheetDialog dialog, MaterialButton button) {
        String title = rawTitle == null ? "" : rawTitle.trim();
        if (title.isEmpty() || title.length() > 64) {
            showToast("Enter a group name (1–64 characters).");
            return;
        }
        List<String> names;
        try {
            names = parseUsernameList(rawUsernames);
        } catch (IllegalArgumentException error) {
            showToast(error.getMessage());
            return;
        }
        if (names.isEmpty()) {
            showToast("Add at least one username.");
            return;
        }
        if (names.size() > 19) {
            showToast("A group can have up to 20 members.");
            return;
        }
        button.setEnabled(false);
        resolveUsernames(names, 0, new ArrayList<>(), (users, error) -> {
            if (error != null) {
                button.setEnabled(true);
                showToast(error);
                return;
            }
            FirebaseUser current = firebaseAuth.getCurrentUser();
            if (current == null) return;
            ArrayList<String> members = new ArrayList<>();
            HashMap<String, String> memberNames = new HashMap<>();
            members.add(current.getUid());
            memberNames.put(current.getUid(), username);
            for (UserIdentity identity : users) {
                if (!members.contains(identity.uid)) {
                    members.add(identity.uid);
                    memberNames.put(identity.uid, identity.username);
                }
            }
            if (members.size() < 2) {
                button.setEnabled(true);
                showToast("Add at least one other account.");
                return;
            }
            DocumentReference chatRef = firestore.collection("chats").document();
            Map<String, Object> data = chatData("group", title, members, memberNames, current.getUid());
            chatRef.set(data).addOnSuccessListener(unused -> {
                dialog.dismiss();
                openThread(new ChatThread(chatRef.getId(), "group", title, "", System.currentTimeMillis(), members, memberNames));
            }).addOnFailureListener(failure -> {
                button.setEnabled(true);
                showToast("Could not create the group. Check Firestore security rules.");
            });
        });
    }

    private void addMembers(ChatThread thread, String rawUsernames, BottomSheetDialog dialog, MaterialButton button) {
        List<String> names;
        try {
            names = parseUsernameList(rawUsernames);
        } catch (IllegalArgumentException error) {
            showToast(error.getMessage());
            return;
        }
        if (names.isEmpty()) {
            showToast("Enter at least one username.");
            return;
        }
        button.setEnabled(false);
        resolveUsernames(names, 0, new ArrayList<>(), (users, error) -> {
            if (error != null) {
                button.setEnabled(true);
                showToast(error);
                return;
            }
            DocumentReference chatRef = firestore.collection("chats").document(thread.id);
            firestore.runTransaction(transaction -> {
                DocumentSnapshot snapshot = transaction.get(chatRef);
                if (!snapshot.exists()) throw new IllegalStateException("Chat no longer exists.");
                Object rawMembers = snapshot.get("members");
                ArrayList<String> members = new ArrayList<>();
                if (rawMembers instanceof List<?>) {
                    for (Object member : (List<?>) rawMembers) if (member instanceof String) members.add((String) member);
                }
                FirebaseUser current = firebaseAuth.getCurrentUser();
                if (current == null || !members.contains(current.getUid())) throw new IllegalStateException("You are not a member of this chat.");
                HashMap<String, String> namesMap = new HashMap<>();
                Object rawNames = snapshot.get("memberNames");
                if (rawNames instanceof Map<?, ?>) {
                    for (Map.Entry<?, ?> entry : ((Map<?, ?>) rawNames).entrySet()) {
                        if (entry.getKey() instanceof String && entry.getValue() instanceof String) {
                            namesMap.put((String) entry.getKey(), (String) entry.getValue());
                        }
                    }
                }
                for (UserIdentity identity : users) {
                    if (!members.contains(identity.uid)) {
                        members.add(identity.uid);
                        namesMap.put(identity.uid, identity.username);
                    }
                }
                if (members.size() > 20) throw new IllegalStateException("A group can have up to 20 members.");
                Map<String, Object> update = new HashMap<>();
                update.put("members", members);
                update.put("memberNames", namesMap);
                update.put("updatedAt", FieldValue.serverTimestamp());
                transaction.update(chatRef, update);
                return members.size();
            }).addOnSuccessListener(count -> {
                dialog.dismiss();
                showToast("Group updated.");
            }).addOnFailureListener(failure -> {
                button.setEnabled(true);
                showToast("Could not add members. Check your connection and Firestore rules.");
            });
        });
    }

    private Map<String, Object> chatData(String type, String title, List<String> members,
                                         Map<String, String> memberNames, String createdBy) {
        Map<String, Object> data = new HashMap<>();
        data.put("type", type);
        data.put("title", title);
        data.put("members", new ArrayList<>(members));
        data.put("memberNames", new HashMap<>(memberNames));
        data.put("createdBy", createdBy);
        data.put("createdAt", FieldValue.serverTimestamp());
        data.put("updatedAt", FieldValue.serverTimestamp());
        data.put("lastMessageAt", FieldValue.serverTimestamp());
        data.put("lastMessage", "");
        data.put("lastSenderId", "");
        return data;
    }

    private String directChatId(String firstUid, String secondUid) {
        String first = firstUid.compareTo(secondUid) <= 0 ? firstUid : secondUid;
        String second = firstUid.compareTo(secondUid) <= 0 ? secondUid : firstUid;
        return "d_" + opaqueDigest(first + ":" + second);
    }

    private void openThread(ChatThread thread) {
        removeMessageListener();
        activeThread = thread;
        activeBotChat = thread.isBot();
        conversationOpen = true;
        messages.clear();
        if (activeBotChat) {
            messages.addAll(botMessages);
        } else {
            messages.addAll(loadRemoteCache(thread.id));
        }
        showConversation();
        if (!activeBotChat) listenToMessages(thread);
    }

    private void showConversation() {
        int conversationBackground = chatBackgroundColor();
        int conversationSurface = chatSurfaceColor();
        int conversationText = chatForegroundColor();
        int conversationMuted = chatSecondaryColor();
        boolean lightMode = chatMode() == 2;
        root.removeAllViews();
        root.setBackgroundColor(conversationBackground);
        LinearLayout screen = new LinearLayout(this);
        screen.setOrientation(LinearLayout.VERTICAL);
        screen.setBackgroundColor(conversationBackground);
        root.addView(screen, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(7), dp(5), dp(10), dp(5));
        toolbar.setBackgroundColor(conversationSurface);
        screen.addView(toolbar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(60)));
        ImageButton back = imageButton(R.drawable.ic_arrow_back, "Back to chats");
        back.setColorFilter(conversationText);
        toolbar.addView(back, new LinearLayout.LayoutParams(dp(42), dp(46)));
        back.setOnClickListener(view -> showMainTab(currentTab));

        FrameLayout avatar = createThreadAvatar(activeThread, dp(42));
        LinearLayout.LayoutParams avatarParams = new LinearLayout.LayoutParams(dp(42), dp(42));
        avatarParams.leftMargin = dp(3);
        toolbar.addView(avatar, avatarParams);
        LinearLayout titleBlock = new LinearLayout(this);
        titleBlock.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams titleBlockParams = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        titleBlockParams.leftMargin = dp(10);
        toolbar.addView(titleBlock, titleBlockParams);
        LinearLayout titleRow = new LinearLayout(this);
        titleRow.setOrientation(LinearLayout.HORIZONTAL);
        titleRow.setGravity(Gravity.CENTER_VERTICAL);
        titleBlock.addView(titleRow);
        TextView title = text(activeThread.displayName(currentUid()), 16, conversationText, true);
        title.setSingleLine(true);
        title.setEllipsize(android.text.TextUtils.TruncateAt.END);
        titleRow.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        TextView subtitle = text(threadSubtitle(activeThread), 11, conversationMuted, false);
        LinearLayout.LayoutParams subtitleParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        subtitleParams.topMargin = dp(2);
        titleBlock.addView(subtitle, subtitleParams);
        attachPressAnimation(titleBlock);
        titleBlock.setOnClickListener(view -> showThreadInfo(activeThread));
        ImageButton info = imageButton(R.drawable.ic_info, "Chat details");
        info.setColorFilter(conversationMuted);
        toolbar.addView(info, new LinearLayout.LayoutParams(dp(42), dp(44)));
        info.setOnClickListener(view -> showThreadInfo(activeThread));

        View divider = new View(this);
        divider.setBackgroundColor(lightMode ? Color.rgb(218, 220, 228) : DIVIDER);
        screen.addView(divider, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)));

        FrameLayout messageArea = new FrameLayout(this);
        screen.addView(messageArea, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        chatWallpaperView = new ImageView(this);
        chatWallpaperView.setScaleType(ImageView.ScaleType.CENTER_CROP);
        if (loadedWallpaperBitmap != null) chatWallpaperView.setImageBitmap(loadedWallpaperBitmap);
        chatWallpaperView.setBackgroundColor(conversationBackground);
        messageArea.addView(chatWallpaperView, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        messageList = new RecyclerView(this);
        messageList.setClipToPadding(false);
        messageList.setPadding(0, dp(9), 0, dp(9));
        messageList.setBackgroundColor(Color.TRANSPARENT);
        messageList.setLayoutManager(new LinearLayoutManager(this));
        messageList.setItemAnimator(null);
        messageAdapter = new MessageAdapter(this, new MessageAdapter.FileClickListener() {
            @Override
            public void onFileClick(ChatMessage message) {
                openAttachment(message);
            }
            @Override
            public void onDownloadClick(ChatMessage message) {
                beginSaveAttachment(message);
            }
            @Override
            public void loadImagePreview(ChatMessage message, ImageView target) {
                MainActivity.this.loadImagePreview(message, target);
            }
        }, activeThread.isGroup());
        messageAdapter.setAppearance(
                preferences.getInt("chat_text_size", 15),
                preferences.getInt("chat_bubble_radius", 18),
                lightMode,
                chatIncomingColor(),
                chatOutgoingColor(),
                lightMode ? Color.rgb(37, 40, 54) : Color.rgb(244, 245, 250),
                Color.WHITE,
                lightMode ? Color.rgb(98, 101, 117) : Color.rgb(185, 190, 207),
                NAME_COLORS[nameColorIndex()]);
        messageList.setAdapter(messageAdapter);
        messageAdapter.setMessages(messages);
        messageArea.addView(messageList, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        if (!messages.isEmpty()) messageList.scrollToPosition(messages.size() - 1);

        LinearLayout composerArea = new LinearLayout(this);
        composerArea.setOrientation(LinearLayout.VERTICAL);
        composerArea.setPadding(dp(7), dp(7), dp(7), dp(6));
        composerArea.setBackgroundColor(conversationSurface);
        screen.addView(composerArea, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        LinearLayout composerRow = new LinearLayout(this);
        composerRow.setOrientation(LinearLayout.HORIZONTAL);
        composerRow.setGravity(Gravity.BOTTOM | Gravity.CENTER_VERTICAL);
        composerArea.addView(composerRow, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        ImageButton attach = imageButton(R.drawable.ic_attach, "Attach file");
        attach.setColorFilter(conversationMuted);
        composerRow.addView(attach, new LinearLayout.LayoutParams(dp(44), dp(46)));
        attach.setOnClickListener(view -> openFilePicker());

        composer = new EditText(this);
        composer.setTextSize(15);
        composer.setTextColor(conversationText);
        composer.setHintTextColor(conversationMuted);
        composer.setHint("Message");
        composer.setSingleLine(false);
        composer.setMinLines(1);
        composer.setMaxLines(5);
        composer.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        composer.setFilters(new InputFilter[]{new InputFilter.LengthFilter(4096)});
        composer.setImeOptions(EditorInfo.IME_ACTION_SEND);
        composer.setPadding(dp(14), dp(11), dp(14), dp(11));
        composer.setBackground(rounded(lightMode ? Color.rgb(231, 233, 240) : SURFACE_ALT, Color.TRANSPARENT, dp(22)));
        LinearLayout.LayoutParams composerParams = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        composerRow.addView(composer, composerParams);
        composer.setOnEditorActionListener((textView, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_SEND) {
                sendTextMessage();
                return true;
            }
            return false;
        });

        ImageButton send = imageButton(R.drawable.ic_send, "Send message");
        send.setColorFilter(Color.WHITE);
        send.setBackground(rippleRounded(chatOutgoingColor(), dp(18)));
        LinearLayout.LayoutParams sendParams = new LinearLayout.LayoutParams(dp(46), dp(46));
        sendParams.leftMargin = dp(7);
        composerRow.addView(send, sendParams);
        send.setOnClickListener(view -> sendTextMessage());

        if (!storageAvailable && activeBotChat) {
            TextView warning = text("Local history is unavailable.", 10, Color.rgb(255, 145, 155), false);
            warning.setGravity(Gravity.CENTER);
            composerArea.addView(warning, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        }
    }

    private String threadSubtitle(ChatThread thread) {
        if (thread.isBot()) return "Local demo bot";
        if (thread.isGroup()) return "Group · " + thread.members.size() + " members";
        return thread.displayName(currentUid());
    }

    private void listenToMessages(ChatThread thread) {
        removeMessageListener();
        messageListener = firestore.collection("chats").document(thread.id).collection("messages")
                .orderBy("createdAt", Query.Direction.ASCENDING)
                .limitToLast(200)
                .addSnapshotListener((snapshot, error) -> {
                    if (error != null) {
                        showToast("Messages could not be loaded. Check your connection and Firestore rules.");
                        return;
                    }
                    if (snapshot == null || activeThread == null || !activeThread.id.equals(thread.id) || !conversationOpen) return;
                    messages.clear();
                    for (DocumentSnapshot document : snapshot.getDocuments()) messages.add(messageFromDocument(document));
                    if (messageAdapter != null) messageAdapter.setMessages(messages);
                    if (messageList != null && !messages.isEmpty()) messageList.scrollToPosition(messages.size() - 1);
                    saveRemoteCache(thread.id);
                });
    }

    private ChatMessage messageFromDocument(DocumentSnapshot document) {
        String senderId = document.getString("senderId");
        String senderName = document.getString("senderUsername");
        String text = document.getString("text");
        String fileName = document.getString("fileName");
        String filePath = document.getString("filePath");
        String mime = document.getString("mimeType");
        Long fileSize = document.getLong("fileSize");
        Timestamp created = document.getTimestamp("createdAt");
        boolean incoming = senderId == null || !senderId.equals(currentUid());
        return new ChatMessage(
                document.getId(), incoming, senderName == null ? "" : senderName,
                text == null ? "" : text,
                created == null ? System.currentTimeMillis() : created.toDate().getTime(),
                fileName == null ? "" : fileName,
                filePath == null ? "" : filePath,
                mime == null ? "application/octet-stream" : mime,
                fileSize == null ? 0 : fileSize
        );
    }

    private void sendTextMessage() {
        if (composer == null) return;
        String value = composer.getText() == null ? "" : composer.getText().toString().trim();
        if (value.isEmpty()) return;
        if (activeBotChat) {
            ChatMessage outgoing = new ChatMessage(UUID.randomUUID().toString(), false, username, value,
                    System.currentTimeMillis(), "", "", "", 0);
            addBotMessage(outgoing);
            composer.setText("");
            scheduleLocalBotReply(false, "");
            return;
        }
        EditText targetComposer = composer;
        String chatId = activeThread == null ? null : activeThread.id;
        if (chatId == null) return;
        targetComposer.setEnabled(false);
        Task<Void> sendTask = commitCloudMessage(chatId, UUID.randomUUID().toString(), value, "", "", "", 0);
        sendTask.addOnSuccessListener(unused -> {
            if (targetComposer.getText() != null && value.equals(targetComposer.getText().toString().trim())) {
                targetComposer.setText("");
            }
            targetComposer.setEnabled(true);
        }).addOnFailureListener(error -> {
            targetComposer.setEnabled(true);
            showToast("Message not sent. Try again when your connection is back.");
        });
    }

    private Task<Void> commitCloudMessage(String chatId, String messageId, String text, String filePath,
                                         String fileName, String mimeType, long fileSize) {
        FirebaseUser current = firebaseAuth.getCurrentUser();
        if (current == null || chatId == null || chatId.isEmpty()) throw new IllegalStateException("No active chat.");
        DocumentReference chatRef = firestore.collection("chats").document(chatId);
        DocumentReference messageRef = chatRef.collection("messages").document(messageId);
        boolean fileMessage = filePath != null && !filePath.isEmpty();
        Map<String, Object> data = new HashMap<>();
        data.put("senderId", current.getUid());
        data.put("senderUsername", username);
        data.put("type", fileMessage ? "file" : "text");
        data.put("text", text == null ? "" : text);
        data.put("filePath", fileMessage ? filePath : "");
        data.put("fileName", fileMessage ? fileName : "");
        data.put("mimeType", fileMessage ? mimeType : "");
        data.put("fileSize", fileMessage ? fileSize : 0L);
        data.put("createdAt", FieldValue.serverTimestamp());

        String lastMessage = fileMessage ? "Attachment · " + fileName : text;
        if (lastMessage.length() > 120) lastMessage = lastMessage.substring(0, 117) + "…";
        Map<String, Object> update = new HashMap<>();
        update.put("lastMessage", lastMessage);
        update.put("lastMessageAt", FieldValue.serverTimestamp());
        update.put("lastSenderId", current.getUid());
        update.put("updatedAt", FieldValue.serverTimestamp());

        WriteBatch batch = firestore.batch();
        batch.set(messageRef, data);
        batch.update(chatRef, update);
        return batch.commit();
    }

    private void sendFileMessage(String fileName, Uri uri, String mimeType, long size) {
        if (activeBotChat) {
            ChatMessage outgoing = new ChatMessage(UUID.randomUUID().toString(), false, username, "",
                    System.currentTimeMillis(), fileName, uri.toString(), mimeType, size);
            addBotMessage(outgoing);
            scheduleLocalBotReply(true, fileName);
            return;
        }
        ChatThread sendingThread = activeThread;
        if (sendingThread == null) return;
        String chatId = sendingThread.id;
        String messageId = UUID.randomUUID().toString();
        StorageReference fileRef = firebaseStorage.getReference()
                .child("chatAttachments").child(chatId).child(messageId);
        StorageMetadata metadata = new StorageMetadata.Builder()
                .setContentType(mimeType)
                .setCustomMetadata("ownerUid", currentUid())
                .build();
        Toast.makeText(this, "Uploading attachment…", Toast.LENGTH_SHORT).show();
        fileRef.putFile(uri, metadata).addOnSuccessListener(taskSnapshot -> {
            Task<Void> sendTask = commitCloudMessage(chatId, messageId, "", fileRef.getPath(), fileName, mimeType, size);
            sendTask.addOnFailureListener(error -> {
                fileRef.delete();
                showToast("The upload finished, but the message could not be sent.");
            });
        }).addOnFailureListener(error -> showToast("File upload failed. Check your Firebase Storage setup."));
    }

    private void addBotMessage(ChatMessage message) {
        botMessages.add(message);
        messages.add(message);
        if (!saveBotMessages()) showStorageError();
        if (messageAdapter != null) {
            messageAdapter.addMessage(message);
            if (messageList != null) messageList.post(() -> messageList.scrollToPosition(messageAdapter.getItemCount() - 1));
        }
    }

    private void scheduleLocalBotReply(boolean attachedFile, String fileName) {
        handler.postDelayed(() -> {
            if (activityDestroyed || !conversationOpen || !activeBotChat) return;
            String reply = attachedFile
                    ? "Attached on this device: " + fileName
                    : "Thanks for your message. This is a local Duckgomz demo reply.";
            ChatMessage response = new ChatMessage(UUID.randomUUID().toString(), true, BOT_USERNAME, reply,
                    System.currentTimeMillis(), "", "", "", 0);
            addBotMessage(response);
        }, 800);
    }

    private void openFilePicker() {
        if (activeBotChat && !storageAvailable) {
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
            // Some document providers grant access only for the current session.
        }
        String name = queryFileName(uri);
        long size = queryFileSize(uri);
        if (size > MAX_FILE_BYTES) {
            showToast("Maximum file size is 20 MB.");
            return;
        }
        String mime = getContentResolver().getType(uri);
        sendFileMessage(name, uri, mime == null ? "application/octet-stream" : mime, size);
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
        return last == null ? "Attachment" : last;
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

    private void beginSaveAttachment(ChatMessage message) {
        if (message == null || message.fileUri == null || message.fileUri.isEmpty()) {
            showToast("Attachment is unavailable.");
            return;
        }
        pendingSaveMessage = message;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(message.mimeType == null || message.mimeType.isEmpty() ? "application/octet-stream" : message.mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, safeAttachmentName(message.fileName));
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        try {
            saveAttachmentPicker.launch(intent);
        } catch (Exception error) {
            pendingSaveMessage = null;
            showToast("Could not open the save dialog.");
        }
    }

    private String safeAttachmentName(String value) {
        String name = value == null ? "" : value.trim();
        name = name.replaceAll("[\\\\/:*?\"<>|]", "_");
        return name.isEmpty() ? "attachment" : name;
    }

    private void saveAttachmentToUri(Uri destination) {
        ChatMessage message = pendingSaveMessage;
        pendingSaveMessage = null;
        if (message == null || destination == null) return;
        if (message.fileUri.startsWith("chatAttachments/")) {
            File directory = new File(getCacheDir(), "attachments");
            if (!directory.exists() && !directory.mkdirs()) {
                showToast("Could not prepare the attachment.");
                return;
            }
            File temporary = new File(directory, "save_" + UUID.randomUUID());
            firebaseStorage.getReference().child(message.fileUri).getFile(temporary)
                    .addOnSuccessListener(snapshot -> copyAttachmentToDestination(temporary, destination))
                    .addOnFailureListener(error -> {
                        temporary.delete();
                        showToast("Could not download this attachment.");
                    });
        } else {
            ioExecutor.execute(() -> {
                try (InputStream input = openLocalAttachment(message.fileUri)) {
                     OutputStream output = getContentResolver().openOutputStream(destination, "w");
                     if (output == null) throw new IOException("Destination could not be opened.");
                     try (OutputStream target = output) {
                         copyStream(input, target);
                     }
                } catch (Exception error) {
                    handler.post(() -> showToast("Could not save this attachment."));
                    return;
                }
                handler.post(() -> showToast("Attachment saved."));
            });
        }
    }

    private void copyAttachmentToDestination(File source, Uri destination) {
        if (activityDestroyed) {
            source.delete();
            return;
        }
        ioExecutor.execute(() -> {
            boolean copied = false;
            try (InputStream input = new FileInputStream(source)) {
                OutputStream output = getContentResolver().openOutputStream(destination, "w");
                if (output == null) throw new IOException("Destination could not be opened.");
                try (OutputStream target = output) {
                    copyStream(input, target);
                }
                copied = true;
            } catch (Exception ignored) {
            } finally {
                source.delete();
            }
            boolean success = copied;
            handler.post(() -> showToast(success ? "Attachment saved." : "Could not save this attachment."));
        });
    }

    private InputStream openLocalAttachment(String value) throws IOException {
        Uri uri = Uri.parse(value);
        if ("file".equals(uri.getScheme())) return new FileInputStream(new File(uri.getPath()));
        InputStream input = getContentResolver().openInputStream(uri);
        if (input == null) throw new IOException("Attachment cannot be opened.");
        return input;
    }

    private void copyStream(InputStream input, OutputStream output) throws IOException {
        byte[] buffer = new byte[16 * 1024];
        int length;
        while ((length = input.read(buffer)) != -1) output.write(buffer, 0, length);
        output.flush();
    }

    private void loadImagePreview(ChatMessage message, ImageView target) {
        String key = message.fileUri;
        if (key == null || key.isEmpty() || target == null) return;
        target.setTag(key);
        Bitmap cached = imagePreviewCache.get(key);
        if (cached != null) {
            target.clearColorFilter();
            target.setImageBitmap(cached);
            return;
        }
        if (!pendingImagePreviews.add(key)) return;
        if (key.startsWith("chatAttachments/")) {
            File directory = new File(getCacheDir(), "image_previews");
            if (!directory.exists() && !directory.mkdirs()) {
                pendingImagePreviews.remove(key);
                return;
            }
            File previewFile = new File(directory, opaqueDigest(key) + "_" + UUID.randomUUID() + ".tmp");
            firebaseStorage.getReference().child(key).getFile(previewFile)
                    .addOnSuccessListener(snapshot -> decodePreviewFileAsync(key, previewFile, target))
                    .addOnFailureListener(error -> {
                        pendingImagePreviews.remove(key);
                        previewFile.delete();
                    });
        } else {
            ioExecutor.execute(() -> {
                Bitmap bitmap = null;
                try {
                    bitmap = decodePreviewUri(Uri.parse(key));
                } catch (Exception ignored) {
                }
                Bitmap decoded = bitmap;
                handler.post(() -> finishImagePreview(key, decoded, target));
            });
        }
    }

    private void decodePreviewFileAsync(String key, File file, ImageView target) {
        if (activityDestroyed) {
            pendingImagePreviews.remove(key);
            return;
        }
        ioExecutor.execute(() -> {
            Bitmap bitmap = decodePreviewFile(file);
            file.delete();
            handler.post(() -> finishImagePreview(key, bitmap, target));
        });
    }

    private Bitmap decodePreviewUri(Uri uri) throws IOException {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        try (InputStream input = openLocalAttachment(uri.toString())) {
            BitmapFactory.decodeStream(input, null, bounds);
        }
        BitmapFactory.Options options = previewOptions(bounds);
        try (InputStream input = openLocalAttachment(uri.toString())) {
            return BitmapFactory.decodeStream(input, null, options);
        }
    }

    private Bitmap decodePreviewFile(File file) {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(file.getAbsolutePath(), bounds);
        return BitmapFactory.decodeFile(file.getAbsolutePath(), previewOptions(bounds));
    }

    private BitmapFactory.Options previewOptions(BitmapFactory.Options bounds) {
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inSampleSize = 1;
        int maximum = Math.max(bounds.outWidth, bounds.outHeight);
        while (maximum > 1200) {
            options.inSampleSize *= 2;
            maximum /= 2;
        }
        options.inPreferredConfig = Bitmap.Config.ARGB_8888;
        return options;
    }

    private void finishImagePreview(String key, Bitmap bitmap, ImageView target) {
        pendingImagePreviews.remove(key);
        if (bitmap == null || activityDestroyed) return;
        imagePreviewCache.put(key, bitmap);
        if (target != null && key.equals(target.getTag())) {
            target.clearColorFilter();
            target.setImageBitmap(bitmap);
        }
    }

    private void openAttachment(ChatMessage message) {
        if (message.fileUri.isEmpty()) {
            showToast("Attachment is unavailable.");
            return;
        }
        if (message.fileUri.startsWith("chatAttachments/")) {
            downloadCloudAttachment(message);
            return;
        }
        try {
            Uri uri = Uri.parse(message.fileUri);
            openWithExternalApp(uri, message.mimeType, "Open attachment");
        } catch (Exception error) {
            showToast("No app is available to open this attachment.");
        }
    }

    private void downloadCloudAttachment(ChatMessage message) {
        File directory = new File(getCacheDir(), "attachments");
        if (!directory.exists() && !directory.mkdirs()) {
            showToast("Could not prepare the attachment.");
            return;
        }
        String extension = "";
        int dot = message.fileName.lastIndexOf('.');
        if (dot >= 0 && dot > message.fileName.lastIndexOf('/') && dot > message.fileName.lastIndexOf('\\')) {
            extension = message.fileName.substring(dot).replaceAll("[^A-Za-z0-9.]", "");
            if (extension.length() > 12) extension = "";
        }
        File output = new File(directory, UUID.randomUUID() + extension);
        firebaseStorage.getReference().child(message.fileUri).getFile(output)
                .addOnSuccessListener(taskSnapshot -> {
                    try {
                        Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", output);
                        openWithExternalApp(uri, message.mimeType, "Open attachment");
                        handler.postDelayed(() -> output.delete(), 60L * 60L * 1000L);
                    } catch (Exception error) {
                        showToast("No app is available to open this attachment.");
                    }
                })
                .addOnFailureListener(error -> showToast("Could not download this attachment."));
    }

    private void openWithExternalApp(Uri uri, String mimeType, String chooserTitle) {
        Intent open = new Intent(Intent.ACTION_VIEW);
        open.setDataAndType(uri, mimeType == null || mimeType.isEmpty() ? "*/*" : mimeType);
        open.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivity(Intent.createChooser(open, chooserTitle));
    }

    private void showThreadInfo(ChatThread thread) {
        if (thread == null) return;
        if (thread.isBot()) {
            showBotProfile();
            return;
        }
        BottomSheetDialog dialog = new BottomSheetDialog(this);
        String title = thread.displayName(currentUid());
        LinearLayout sheet = createSheet(title);
        if (thread.isGroup()) {
            TextView memberCount = text(thread.members.size() + " members", 13, MUTED, false);
            LinearLayout.LayoutParams countParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            countParams.bottomMargin = dp(10);
            sheet.addView(memberCount, countParams);
            for (String member : thread.members) {
                String handle = thread.memberNames.get(member);
                if (handle != null) sheet.addView(text("@" + handle, 14, TEXT, false));
            }
            addSheetButton(sheet, "Add people", () -> {
                dialog.dismiss();
                showAddMembersSheet(thread);
            }, false);
        } else {
            TextView detail = text("Private chat · messages sync through Firebase", 13, MUTED, false);
            sheet.addView(detail, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        }
        addSheetButton(sheet, "Chat appearance", () -> {
            dialog.dismiss();
            showChatAppearance(true);
        }, false);
        addSheetButton(sheet, "Close", dialog::dismiss, true);
        showDarkSheet(dialog, sheet);
    }

    private void showBotProfile() {
        BottomSheetDialog dialog = new BottomSheetDialog(this);
        LinearLayout sheet = createSheet("Duckgomz");
        LinearLayout profile = new LinearLayout(this);
        profile.setOrientation(LinearLayout.VERTICAL);
        profile.setGravity(Gravity.CENTER_HORIZONTAL);
        profile.setPadding(0, dp(5), 0, dp(12));
        sheet.addView(profile, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        FrameLayout avatar = createThreadAvatar(botThread(), dp(76));
        profile.addView(avatar, new LinearLayout.LayoutParams(dp(76), dp(76)));
        TextView name = text(BOT_NAME, 19, TEXT, true);
        LinearLayout.LayoutParams nameParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        nameParams.topMargin = dp(14);
        profile.addView(name, nameParams);
        TextView handle = text(BOT_USERNAME, 13, MUTED, false);
        profile.addView(handle);
        TextView description = text("Built-in Duckgomz demo bot · replies stay on this device", 12, MUTED, false);
        description.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams descriptionParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        descriptionParams.topMargin = dp(13);
        profile.addView(description, descriptionParams);
        addSheetButton(sheet, "Chat appearance", () -> {
            dialog.dismiss();
            showChatAppearance(true);
        }, false);
        addSheetButton(sheet, "Close", dialog::dismiss, true);
        showDarkSheet(dialog, sheet);
    }

    private void showAboutSheet() {
        BottomSheetDialog dialog = new BottomSheetDialog(this);
        LinearLayout sheet = createSheet("Duckgomz");
        TextView about = text("Private chats and groups · username sign-in · no phone number", 13, MUTED, false);
        about.setLineSpacing(dp(3), 1f);
        sheet.addView(about, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        addSheetButton(sheet, "Close", dialog::dismiss, true);
        showDarkSheet(dialog, sheet);
    }

    private LinearLayout createSheet(String title) {
        LinearLayout sheet = new LinearLayout(this);
        sheet.setOrientation(LinearLayout.VERTICAL);
        sheet.setPadding(dp(22), dp(22), dp(22), dp(26));
        sheet.setBackground(rounded(SURFACE, Color.TRANSPARENT, dp(20)));
        TextView heading = text(title, 20, TEXT, true);
        LinearLayout.LayoutParams headingParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        headingParams.bottomMargin = dp(18);
        sheet.addView(heading, headingParams);
        return sheet;
    }

    private void showDarkSheet(BottomSheetDialog dialog, View content) {
        ScrollView sheetScroller = new ScrollView(this);
        sheetScroller.setFillViewport(false);
        sheetScroller.setVerticalScrollBarEnabled(false);
        sheetScroller.setClipToPadding(false);
        sheetScroller.setBackgroundColor(Color.TRANSPARENT);
        sheetScroller.addView(content, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        dialog.setContentView(sheetScroller);
        dialog.show();
        Window sheetWindow = dialog.getWindow();
        if (sheetWindow != null) {
            sheetWindow.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            if (blockScreenshots) sheetWindow.addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            sheetWindow.setStatusBarColor(BG);
            sheetWindow.setNavigationBarColor(SURFACE);
            sheetWindow.getDecorView().setSystemUiVisibility(0);
            sheetWindow.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
            WindowManager.LayoutParams attributes = sheetWindow.getAttributes();
            attributes.dimAmount = .48f;
            sheetWindow.setAttributes(attributes);
        }
        View bottom = dialog.findViewById(com.google.android.material.R.id.design_bottom_sheet);
        if (bottom != null) {
            bottom.setBackground(rounded(SURFACE, Color.TRANSPARENT, dp(20)));
            bottom.setElevation(dp(12));
        }
    }

    private void addSheetButton(LinearLayout sheet, String label, Runnable action, boolean primary) {
        MaterialButton button = primaryButton(label);
        if (!primary) button.setBackgroundTintList(ColorStateList.valueOf(SURFACE_ALT));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(49));
        params.topMargin = dp(10);
        sheet.addView(button, params);
        button.setOnClickListener(view -> action.run());
    }

    private void addSheetAction(LinearLayout sheet, int iconId, String title, String subtitle, Runnable action) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(8), dp(11), dp(8), dp(11));
        row.setBackground(rippleRounded(Color.TRANSPARENT, dp(10)));
        sheet.addView(row, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        ImageView icon = new ImageView(this);
        icon.setImageResource(iconId);
        icon.setColorFilter(Color.rgb(145, 163, 255));
        row.addView(icon, new LinearLayout.LayoutParams(dp(30), dp(30)));
        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams copyParams = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        copyParams.leftMargin = dp(13);
        row.addView(copy, copyParams);
        copy.addView(text(title, 15, TEXT, true));
        TextView detail = text(subtitle, 12, MUTED, false);
        LinearLayout.LayoutParams detailParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        detailParams.topMargin = dp(3);
        copy.addView(detail, detailParams);
        attachPressAnimation(row);
        row.setOnClickListener(view -> action.run());
    }

    private void loadBotMessages() {
        botMessages.clear();
        storageAvailable = true;
        String key;
        try {
            key = messageKey();
        } catch (RuntimeException error) {
            storageAvailable = false;
            key = null;
        }
        if (storageAvailable) {
            String stored = preferences.getString(key, null);
            String legacyKey = legacyMessageKey();
            if (stored != null) {
                try {
                    String plaintext = EncryptedStorage.decrypt(stored, key);
                    if (plaintext == null) throw new GeneralSecurityException("Unknown local history format");
                    readMessages(plaintext, botMessages);
                    if (preferences.contains(legacyKey) && !preferences.edit().remove(legacyKey).commit()) {
                        storageAvailable = false;
                        botMessages.clear();
                    }
                } catch (Exception error) {
                    botMessages.clear();
                    storageAvailable = false;
                }
            } else {
                String legacy = preferences.getString(legacyKey, null);
                if (legacy != null) {
                    try {
                        readMessages(legacy, botMessages);
                        if (saveBotMessages()) {
                            if (!preferences.edit().remove(legacyKey).commit()) {
                                storageAvailable = false;
                                botMessages.clear();
                            }
                        } else {
                            botMessages.clear();
                        }
                    } catch (Exception error) {
                        botMessages.clear();
                        storageAvailable = false;
                    }
                }
            }
        }
        if (botMessages.isEmpty() && storageAvailable) {
            botMessages.add(welcomeMessage());
            saveBotMessages();
        }
        if (!storageAvailable) {
            if (botMessages.isEmpty()) botMessages.add(welcomeMessage());
            showStorageError();
        }
    }

    private ChatMessage welcomeMessage() {
        return new ChatMessage(
                "welcome-" + username,
                true,
                BOT_USERNAME,
                "Welcome to Duckgomz 👋\n\nThis is a local demo bot.",
                System.currentTimeMillis(), "", "", "", 0
        );
    }

    private void readMessages(String serialized, List<ChatMessage> target) throws JSONException {
        JSONArray array = new JSONArray(serialized);
        for (int index = 0; index < array.length(); index++) {
            target.add(ChatMessage.fromJson(array.getJSONObject(index)));
        }
    }

    private boolean saveBotMessages() {
        if (!storageAvailable) return false;
        JSONArray array = new JSONArray();
        try {
            for (ChatMessage message : botMessages) array.put(message.toJson());
            String key = messageKey();
            String encrypted = EncryptedStorage.encrypt(array.toString(), key);
            boolean saved = preferences.edit().putString(key, encrypted).commit();
            if (!saved) storageAvailable = false;
            return saved;
        } catch (JSONException | GeneralSecurityException | RuntimeException error) {
            storageAvailable = false;
            return false;
        }
    }

    private List<ChatMessage> loadRemoteCache(String chatId) {
        ArrayList<ChatMessage> result = new ArrayList<>();
        String key = remoteHistoryKey(chatId);
        String stored = preferences.getString(key, null);
        if (stored == null) return result;
        try {
            String plaintext = EncryptedStorage.decrypt(stored, key);
            if (plaintext != null) readMessages(plaintext, result);
        } catch (Exception error) {
            showToast("The encrypted message cache could not be opened. Cloud history will reload.");
        }
        return result;
    }

    private void saveRemoteCache(String chatId) {
        JSONArray array = new JSONArray();
        try {
            for (ChatMessage message : messages) array.put(message.toJson());
            String key = remoteHistoryKey(chatId);
            String encrypted = EncryptedStorage.encrypt(array.toString(), key);
            preferences.edit().putString(key, encrypted).apply();
        } catch (Exception error) {
            showToast("Could not update the encrypted local cache.");
        }
    }

    private String messageKey() {
        FirebaseUser current = firebaseAuth.getCurrentUser();
        if (current == null) throw new IllegalStateException("No authenticated account.");
        return "chat_v1_" + opaqueDigest(current.getUid());
    }

    private String legacyMessageKey() {
        return "messages_" + username.toLowerCase(Locale.ROOT);
    }

    private String remoteHistoryKey(String chatId) {
        FirebaseUser current = firebaseAuth.getCurrentUser();
        if (current == null) throw new IllegalStateException("No authenticated account.");
        return "history_v1_" + opaqueDigest(current.getUid() + "\u0000" + chatId);
    }

    private String opaqueDigest(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return android.util.Base64.encodeToString(digest, android.util.Base64.URL_SAFE | android.util.Base64.NO_WRAP | android.util.Base64.NO_PADDING);
        } catch (GeneralSecurityException error) {
            throw new IllegalStateException("Unable to create local storage key.", error);
        }
    }

    private void showStorageError() {
        showToast("Local history storage is unavailable. Saved data has not been changed.");
    }

    private ChatThread botThread() {
        ChatMessage last = botMessages.isEmpty() ? null : botMessages.get(botMessages.size() - 1);
        String preview = last == null ? "Start a conversation" : (last.hasFile() ? "Attachment · " + last.fileName : last.text.replace('\n', ' '));
        long updated = last == null ? System.currentTimeMillis() : last.timestamp;
        String uid = currentUid();
        return new ChatThread(BOT_CHAT_ID, "bot", BOT_NAME, preview, updated,
                Collections.singletonList(uid), Collections.singletonMap(uid, username));
    }

    private String chatPreview(ChatThread thread) {
        if (thread.isBot()) {
            if (botMessages.isEmpty()) return "Start a conversation";
            ChatMessage last = botMessages.get(botMessages.size() - 1);
            if (last.hasFile()) return "Attachment · " + last.fileName;
            return last.text.replace('\n', ' ');
        }
        if (!thread.lastMessage.isEmpty()) return thread.lastMessage;
        return thread.isGroup() ? "Group created" : "Start a conversation";
    }

    private String displayTime(long timestamp) {
        if (timestamp <= 0) return "";
        return new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date(timestamp));
    }

    private String currentUid() {
        FirebaseUser current = firebaseAuth == null ? null : firebaseAuth.getCurrentUser();
        return current == null ? "" : current.getUid();
    }

    private ImageButton imageButton(int icon, String description) {
        ImageButton button = new ImageButton(this);
        button.setImageResource(icon);
        button.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        button.setPadding(dp(10), dp(10), dp(10), dp(10));
        button.setBackground(rippleRounded(Color.TRANSPARENT, dp(14)));
        button.setContentDescription(description);
        attachPressAnimation(button);
        return button;
    }

    private MaterialButton primaryButton(String label) {
        MaterialButton button = new MaterialButton(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextSize(14);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setTextColor(Color.WHITE);
        button.setCornerRadius(dp(14));
        button.setBackgroundTintList(ColorStateList.valueOf(BLUE));
        button.setInsetTop(0);
        button.setInsetBottom(0);
        attachPressAnimation(button);
        return button;
    }

    private void attachPressAnimation(View target) {
        target.setOnTouchListener((view, event) -> {
            int action = event.getActionMasked();
            if (action == MotionEvent.ACTION_DOWN) {
                if (!view.isEnabled()) return false;
                view.animate().cancel();
                view.animate()
                        .scaleX(.93f)
                        .scaleY(.93f)
                        .alpha(.84f)
                        .translationY(dp(1))
                        .setDuration(90)
                        .setInterpolator(new DecelerateInterpolator(2f))
                        .start();
            } else if (action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_CANCEL) {
                view.animate().cancel();
                view.animate()
                        .scaleX(1f)
                        .scaleY(1f)
                        .alpha(1f)
                        .translationY(0f)
                        .setDuration(380)
                        .setInterpolator(new OvershootInterpolator(.85f))
                        .start();
            }
            return false;
        });
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

    private GradientDrawable circle(int color, int strokeColor, int strokeWidth) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.OVAL);
        drawable.setColor(color);
        if (strokeColor != Color.TRANSPARENT && strokeWidth > 0) drawable.setStroke(strokeWidth, strokeColor);
        return drawable;
    }

    private android.graphics.drawable.Drawable rippleRounded(int color, int radius) {
        return new android.graphics.drawable.RippleDrawable(
                ColorStateList.valueOf(Color.rgb(75, 78, 102)),
                rounded(color, Color.TRANSPARENT, radius), null);
    }

    private void showToast(String value) {
        Toast.makeText(this, value, Toast.LENGTH_LONG).show();
    }

    private int dp(float value) {
        return (int) (value * getResources().getDisplayMetrics().density + .5f);
    }

    private static final class UserIdentity {
        final String uid;
        final String username;
        final boolean allowDirectMessages;
        UserIdentity(String uid, String username, boolean allowDirectMessages) {
            this.uid = uid;
            this.username = username;
            this.allowDirectMessages = allowDirectMessages;
        }
    }
}
