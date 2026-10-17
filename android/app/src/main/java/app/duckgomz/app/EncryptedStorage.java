package app.duckgomz.app;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.util.Arrays;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Encrypts local chat history with an app-only AES-GCM key held by Android Keystore. */
public final class EncryptedStorage {
    private static final String KEYSTORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "duckgomz.chat.history.aes.v1";
    private static final String PREFIX = "v1:";
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;

    private EncryptedStorage() {}

    public static String encrypt(String plainText, String accountContext) throws GeneralSecurityException {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
        cipher.updateAAD(contextBytes(accountContext));
        byte[] iv = cipher.getIV();
        byte[] ciphertext = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));
        ByteBuffer output = ByteBuffer.allocate(iv.length + ciphertext.length);
        output.put(iv);
        output.put(ciphertext);
        return PREFIX + Base64.encodeToString(output.array(), Base64.NO_WRAP);
    }

    /** Returns null when the stored value is not in the encrypted format (legacy migration). */
    public static String decrypt(String stored, String accountContext) throws GeneralSecurityException {
        if (stored == null || !stored.startsWith(PREFIX)) return null;
        byte[] payload = Base64.decode(stored.substring(PREFIX.length()), Base64.NO_WRAP);
        if (payload.length <= IV_BYTES) throw new GeneralSecurityException("Encrypted chat data is incomplete");
        byte[] iv = Arrays.copyOfRange(payload, 0, IV_BYTES);
        byte[] ciphertext = Arrays.copyOfRange(payload, IV_BYTES, payload.length);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(TAG_BITS, iv));
        cipher.updateAAD(contextBytes(accountContext));
        return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
    }

    private static byte[] contextBytes(String accountContext) throws GeneralSecurityException {
        if (accountContext == null || accountContext.isEmpty()) {
            throw new GeneralSecurityException("Missing local history account context");
        }
        return ("duckgomz-chat-history:v1:" + accountContext).getBytes(StandardCharsets.UTF_8);
    }

    private static SecretKey getOrCreateKey() throws GeneralSecurityException {
        try {
            KeyStore keyStore = KeyStore.getInstance(KEYSTORE);
            keyStore.load(null);
            if (keyStore.containsAlias(KEY_ALIAS)) {
                return (SecretKey) keyStore.getKey(KEY_ALIAS, null);
            }

            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
            KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
                    KEY_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
            )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .setRandomizedEncryptionRequired(true)
                    .build();
            generator.init(spec);
            return generator.generateKey();
        } catch (GeneralSecurityException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new GeneralSecurityException("Unable to access Android Keystore", exception);
        }
    }
}
