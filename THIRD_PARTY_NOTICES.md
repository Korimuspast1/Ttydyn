# Third-party notices

## Telegram for Android

This app reuses and adapts a small part of Telegram for Android's username validation rules and three UI image assets (the verified check, attach, and send icons). The Telegram activity/networking code is not included.

- Username rules source: [ChangeUsernameActivity.java](https://github.com/DrKLO/Telegram/blob/f32ffeec763f0bdbf4bec25b52d654f77bff733d/TMessagesProj/src/main/java/org/telegram/ui/ChangeUsernameActivity.java), adapted in `android/app/src/main/java/app/duckgomz/app/UsernameRules.java`.
- Images: `verified_check.webp`, `input_attach.webp`, and `msg_send.webp` from [DrKLO/Telegram](https://github.com/DrKLO/Telegram/tree/master/TMessagesProj/src/main/res/drawable-mdpi).
- Upstream notice: Copyright Nikolai Kudashov, 2013–2018; GNU General Public License version 2 or later.
- The adaptations and this app are distributed under GNU GPL version 2. See `LICENSE`.

The app's branding and the rest of its screen layouts are original. Telegram trademarks are not used.
