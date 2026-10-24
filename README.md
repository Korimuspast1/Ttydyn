# Duckgomz for Android

Duckgomz is a native Android messaging app written in Java. It uses a dark, Telegram-inspired conversation layout without Telegram logos or branding. Users sign in with a username and password, find other accounts by username, and create private one-to-one chats or private groups. There are no channels. A clearly labelled Duckgomz demo-bot conversation remains local to the device.

## Features

- Username and password registration/sign-in; no phone number or user-facing email address.
- Usernames are 4–32 characters, use Latin letters, digits, and `_`, start with a letter, and end with a letter or digit. The reserved username `duckgomz` is used by the local demo bot.
- Real-time chat lists and message updates between signed-in accounts using Firebase Cloud Firestore.
- Private groups with up to 20 members; members can add other users by username.
- File attachments stored in Firebase Storage, limited to 20 MB per file; images preview inline, with file type/size labels, an open action, and a save-to-device action.
- Chat appearance controls for all chats: five color themes, dark/dim/light chat modes, message text size, bubble corners, sender-name color, and a locally selected wallpaper.
- Privacy controls for new private-chat requests (enforced by Firestore rules), hiding chat-list previews, blocking screenshots/screen recording, and clearing the encrypted device cache.
- Four main tabs: Chats, Contacts, Settings, and Profile. Search in Chats or Contacts starts a private chat by username; the Chats “+” action creates groups only. Channels are intentionally not included.
- Springy press feedback on buttons and tappable rows, plus a glossy, elastic bottom-tab indicator inspired by iPhone Liquid Glass movement.
- Original Duckgomz geometric-duck branding, including the selected launcher icon in `artifacts/Duckgomz-icon.png` and original vector assets in `android/app/src/main/assets/svg/`.
- A device-local Duckgomz demo bot. Its messages and attachment metadata are stored in an AES-GCM encrypted local history using an Android Keystore key.
- A best-effort encrypted local cache for recent cloud messages. Cloud messages and attachments are **not end-to-end encrypted**.

The adapted username validation and its license attribution are documented in `THIRD_PARTY_NOTICES.md` and `LICENSE`.

## Firebase setup

The Android app is configured for Firebase project `ppstore-24ea8` and package `app.duckgomz.app`; the project-provided `android/app/google-services.json` is required for the build.

Before real accounts can chat:

1. In Firebase Console, enable **Authentication → Sign-in method → Email/Password**.
2. Create a **Cloud Firestore** database in Native mode.
3. Create the project's **Cloud Storage** bucket. The bucket name is read from `google-services.json`.
4. Install Firebase CLI, select the same Firebase project, and publish the rules shipped in this repository:

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use ppstore-24ea8
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```

   If your Firebase CLI version uses a different project selection flow, pass `--project ppstore-24ea8` to the deploy command.

The repository includes `firestore.rules`, `storage.rules`, `firestore.indexes.json`, and `firebase.json`. The rules allow authenticated users to look up a username by its exact document ID, restrict chat reads to chat members, and restrict attachment reads to members of the corresponding chat. Do not replace them with public/test-mode rules. Review and deploy rule changes before publishing a production build.

### Data model

- `usernames/{lowercaseUsername}` maps an available username to its Firebase Auth UID.
- `users/{uid}` stores the account's public username, creation timestamp, and `allowDirectMessages` privacy flag. A new private chat can be created only when the target account allows new chat requests.
- `chats/{chatId}` stores chat type, title, member UIDs, member usernames, and a short last-message preview.
- `chats/{chatId}/messages/{messageId}` stores message text or attachment metadata.
- `chatAttachments/{chatId}/{messageId}` stores uploaded file contents in Firebase Storage.

Firebase Authentication uses a technical address of the form `username@duckgomz.app`, because Firebase's Email/Password provider requires an email-shaped identifier. The app derives it internally; users enter only a username and password. Firebase Authentication and cloud services use TLS in transit. Cloud data is stored by Firebase and this app does **not** implement end-to-end encryption. The local AES-GCM cache uses a device Keystore key and is separate from Firebase's server-side data.

## Build

Use JDK 17 and Android SDK 36:

```bash
cd android
./gradlew assembleDebug
```

The debug APK is written to:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

The GitHub Actions workflow also builds and publishes the APK artifact for the active branch. A device/emulator test and Firebase Console configuration are still necessary before treating the app as production-ready.
