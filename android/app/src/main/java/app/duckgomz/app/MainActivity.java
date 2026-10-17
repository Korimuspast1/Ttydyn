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
import android.text.InputFilter;
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
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;
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
import com.google.firebase.firestore.QuerySnapshot;
import com.google.firebase.firestore.SetOptions;
import com.google.firebase.firestore.WriteBatch;
import com.google.firebase.storage.FirebaseStorage;
import com.google.firebase.storage.StorageMetadata;
import com.google.firebase.storage.StorageReference;

import org.json.JSONArray;
import org.json.JSONException;

import java.io.File;
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
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

public class MainActivity extends AppCompatActivity {
    private static final int BLUE = Color.rgb(91, 121, 247);
    private static final int BG = Color.rgb(32, 33, 47);
    private static final int SURFACE = Color.rgb(42, 44, 62);
    private static final int SURFACE_ALT = Color.rgb(49, 51, 71);
    private static final int TEXT = Color.rgb(244, 245, 250);
    private static final int MUTED = Color.rgb(161, 166, 184);
    private static final int DIVIDER = Color.rgb(57, 59, 77);
    private static final int CHAT_BG = Color.rgb(31, 32, 46);
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

        filePicker = registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
            if (result.getResultCode() == RESULT_OK && result.getData() != null && result.getData().getData() != null) {
                onPickedFile(result.getData());
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
        removeMessageListener();
        removeChatListListener();
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
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
        form.setPadding(0, dp(48), 0, dp(8));
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
        addField(form, usernameLayout, dp(34));

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
        switchMode.setOnClickListener(view -> {
            registerMode = !registerMode;
            authError = "";
            showAuthScreen();
        });

        TextView phoneNote = text("No phone number required", 11, Color.rgb(128, 134, 154), false);
        phoneNote.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams noteParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        noteParams.topMargin = dp(38);
        page.addView(phoneNote, noteParams);
    }

    private TextInputLayout createInput(String hint, int inputType) {
        TextInputLayout layout = new TextInputLayout(this);
        layout.setHint(hint);
        layout.setBoxBackgroundMode(TextInputLayout.BOX_BACKGROUND_OUTLINE);
        layout.setBoxCornerRadii(dp(12), dp(12), dp(12), dp(12));
        layout.setBoxStrokeColor(Color.rgb(76, 79, 101));
        layout.setHintTextColor(ColorStateList.valueOf(MUTED));
        layout.setBoxBackgroundColor(Color.TRANSPARENT);
        if (hint.toLowerCase(Locale.ROOT).contains("password")) {
            layout.setEndIconMode(TextInputLayout.END_ICON_PASSWORD_TOGGLE);
            layout.setEndIconTintList(ColorStateList.valueOf(MUTED));
        } else {
            layout.setEndIconMode(TextInputLayout.END_ICON_NONE);
        }
        TextInputEditText editText = new TextInputEditText(layout.getContext());
        editText.setInputType(inputType);
        editText.setTextSize(16);
        editText.setTextColor(TEXT);
        editText.setHintTextColor(MUTED);
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
            transaction.set(profileRef, profile, SetOptions.merge());
            return null;
        }).addOnSuccessListener(unused -> {
            if (activityDestroyed) return;
            username = normalizedUsername;
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
        currentTab = tab;
        conversationOpen = false;
        activeThread = null;
        activeBotChat = false;
        removeMessageListener();
        messageList = null;
        messageAdapter = null;
        composer = null;
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

        if (tab == TAB_CHATS || tab == TAB_CONTACTS) {
            ImageButton add = imageButton(R.drawable.ic_plus, "Create chat");
            add.setColorFilter(Color.WHITE);
            add.setBackground(rippleRounded(BLUE, dp(20)));
            add.setElevation(dp(7));
            FrameLayout.LayoutParams addParams = new FrameLayout.LayoutParams(dp(58), dp(58), Gravity.RIGHT | Gravity.BOTTOM);
            addParams.rightMargin = dp(18);
            addParams.bottomMargin = dp(18);
            body.addView(add, addParams);
            add.setOnClickListener(view -> showCreateChatOptions());
        }
        screen.addView(createBottomNavigation(tab));
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
            ImageButton search = imageButton(R.drawable.ic_search, "Find a user");
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
                ImageButton addContact = imageButton(R.drawable.ic_plus, "Add contact");
                addContact.setColorFilter(TEXT);
                toolbar.addView(addContact, new LinearLayout.LayoutParams(dp(44), dp(44)));
                addContact.setOnClickListener(view -> showNewDirectChatSheet());
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
            TextView hint = text("Your private chats and groups will appear here.", 12, MUTED, false);
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
        String previewText = chatPreview(thread);
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

    private LinearLayout createBottomNavigation(int selected) {
        LinearLayout nav = new LinearLayout(this);
        nav.setOrientation(LinearLayout.HORIZONTAL);
        nav.setGravity(Gravity.CENTER_VERTICAL);
        nav.setPadding(dp(5), dp(5), dp(5), dp(5));
        nav.setBackground(rounded(SURFACE, Color.TRANSPARENT, dp(27)));
        LinearLayout.LayoutParams navParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(66));
        navParams.leftMargin = dp(12);
        navParams.rightMargin = dp(12);
        navParams.topMargin = dp(4);
        navParams.bottomMargin = dp(7);
        nav.setLayoutParams(navParams);
        int[] icons = new int[]{R.drawable.ic_tab_chats, R.drawable.ic_tab_contacts, R.drawable.ic_tab_settings, R.drawable.ic_tab_profile};
        String[] labels = new String[]{"Chats", "Contacts", "Settings", "Profile"};
        for (int index = 0; index < labels.length; index++) {
            final int tab = index;
            boolean active = index == selected;
            LinearLayout item = new LinearLayout(this);
            item.setOrientation(LinearLayout.VERTICAL);
            item.setGravity(Gravity.CENTER);
            item.setPadding(dp(5), dp(4), dp(5), dp(3));
            item.setBackground(rounded(active ? Color.rgb(52, 57, 83) : Color.TRANSPARENT, Color.TRANSPARENT, dp(22)));
            nav.addView(item, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f));
            ImageView icon = new ImageView(this);
            icon.setImageResource(icons[index]);
            icon.setColorFilter(active ? Color.rgb(119, 146, 255) : MUTED);
            item.addView(icon, new LinearLayout.LayoutParams(dp(23), dp(23)));
            TextView label = text(labels[index], 10, active ? Color.rgb(131, 154, 255) : MUTED, active);
            LinearLayout.LayoutParams labelParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            labelParams.topMargin = dp(2);
            item.addView(label, labelParams);
            item.setContentDescription(labels[index]);
            item.setOnClickListener(view -> showMainTab(tab));
        }
        return nav;
    }

    private void addSettings(LinearLayout content) {
        TextView section = text("PREFERENCES", 10, MUTED, true);
        section.setLetterSpacing(.08f);
        LinearLayout.LayoutParams sectionParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        sectionParams.setMargins(dp(18), dp(18), dp(18), dp(9));
        content.addView(section, sectionParams);
        addSettingsRow(content, R.drawable.ic_tab_settings, "Appearance", "Dark theme", () -> showToast("Duckgomz is using the dark theme."));
        addRowDivider(content, dp(58));
        addSettingsRow(content, R.drawable.ic_info, "Privacy & Security", "Cloud chats are not end-to-end encrypted", this::showPrivacySheet);
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

    private void showPrivacySheet() {
        BottomSheetDialog dialog = new BottomSheetDialog(this);
        LinearLayout sheet = createSheet("Privacy & Security");
        TextView copy = text("Local history is encrypted with a device-only Android Keystore key. Cloud messages and files are sent over TLS and stored in Firebase. This app does not provide end-to-end encryption.", 14, MUTED, false);
        copy.setLineSpacing(dp(4), 1f);
        sheet.addView(copy, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        addSheetButton(sheet, "Close", dialog::dismiss, true);
        showDarkSheet(dialog, sheet);
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

    private void showCreateChatOptions() {
        BottomSheetDialog dialog = new BottomSheetDialog(this);
        LinearLayout sheet = createSheet("New conversation");
        addSheetAction(sheet, R.drawable.ic_tab_chats, "New private chat", "Find someone by username", () -> {
            dialog.dismiss();
            showNewDirectChatSheet();
        });
        addSheetAction(sheet, R.drawable.ic_group, "New group", "Create a private group", () -> {
            dialog.dismiss();
            showNewGroupSheet();
        });
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
                    found.add(new UserIdentity(uid, canonicalName));
                    resolveUsernames(names, index + 1, found, callback);
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
                showToast("Could not start the chat. Check Firestore security rules.");
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
        root.removeAllViews();
        root.setBackgroundColor(CHAT_BG);
        LinearLayout screen = new LinearLayout(this);
        screen.setOrientation(LinearLayout.VERTICAL);
        screen.setBackgroundColor(CHAT_BG);
        root.addView(screen, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(7), dp(5), dp(10), dp(5));
        toolbar.setBackgroundColor(SURFACE);
        screen.addView(toolbar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(60)));
        ImageButton back = imageButton(R.drawable.ic_arrow_back, "Back to chats");
        back.setColorFilter(TEXT);
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
        TextView title = text(activeThread.displayName(currentUid()), 16, TEXT, true);
        title.setSingleLine(true);
        title.setEllipsize(android.text.TextUtils.TruncateAt.END);
        titleRow.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        TextView subtitle = text(threadSubtitle(activeThread), 11, MUTED, false);
        LinearLayout.LayoutParams subtitleParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        subtitleParams.topMargin = dp(2);
        titleBlock.addView(subtitle, subtitleParams);
        titleBlock.setOnClickListener(view -> showThreadInfo(activeThread));
        ImageButton info = imageButton(R.drawable.ic_info, "Chat details");
        info.setColorFilter(MUTED);
        toolbar.addView(info, new LinearLayout.LayoutParams(dp(42), dp(44)));
        info.setOnClickListener(view -> showThreadInfo(activeThread));

        View divider = new View(this);
        divider.setBackgroundColor(DIVIDER);
        screen.addView(divider, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)));

        messageList = new RecyclerView(this);
        messageList.setClipToPadding(false);
        messageList.setPadding(0, dp(9), 0, dp(9));
        messageList.setBackgroundColor(CHAT_BG);
        messageList.setLayoutManager(new LinearLayoutManager(this));
        messageList.setItemAnimator(null);
        messageAdapter = new MessageAdapter(this, this::openAttachment, activeThread.isGroup());
        messageList.setAdapter(messageAdapter);
        messageAdapter.setMessages(messages);
        screen.addView(messageList, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        if (!messages.isEmpty()) messageList.scrollToPosition(messages.size() - 1);

        LinearLayout composerArea = new LinearLayout(this);
        composerArea.setOrientation(LinearLayout.VERTICAL);
        composerArea.setPadding(dp(7), dp(7), dp(7), dp(6));
        composerArea.setBackgroundColor(SURFACE);
        screen.addView(composerArea, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        LinearLayout composerRow = new LinearLayout(this);
        composerRow.setOrientation(LinearLayout.HORIZONTAL);
        composerRow.setGravity(Gravity.BOTTOM | Gravity.CENTER_VERTICAL);
        composerArea.addView(composerRow, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        ImageButton attach = imageButton(R.drawable.ic_attach, "Attach file");
        attach.setColorFilter(MUTED);
        composerRow.addView(attach, new LinearLayout.LayoutParams(dp(44), dp(46)));
        attach.setOnClickListener(view -> openFilePicker());

        composer = new EditText(this);
        composer.setTextSize(15);
        composer.setTextColor(TEXT);
        composer.setHintTextColor(MUTED);
        composer.setHint("Message");
        composer.setSingleLine(false);
        composer.setMinLines(1);
        composer.setMaxLines(5);
        composer.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        composer.setFilters(new InputFilter[]{new InputFilter.LengthFilter(4096)});
        composer.setImeOptions(EditorInfo.IME_ACTION_SEND);
        composer.setPadding(dp(14), dp(11), dp(14), dp(11));
        composer.setBackground(rounded(SURFACE_ALT, Color.TRANSPARENT, dp(22)));
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
        send.setBackground(rippleRounded(BLUE, dp(18)));
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
        dialog.setContentView(content);
        dialog.show();
        View bottom = dialog.findViewById(com.google.android.material.R.id.design_bottom_sheet);
        if (bottom != null) bottom.setBackground(rounded(SURFACE, Color.TRANSPARENT, dp(20)));
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
        return button;
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
        UserIdentity(String uid, String username) {
            this.uid = uid;
            this.username = username;
        }
    }
}
