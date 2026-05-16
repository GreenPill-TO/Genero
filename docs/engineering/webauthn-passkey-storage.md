# WebAuthn passkey creation and storage

The wallet uses the `WebAuthnCrypto` helper from the `cubid-wallet` package to create and use passkeys.

## Where passkeys are created

During enrolment, `WebAuthnCrypto.generateKeyPair` prepares `PublicKeyCredentialCreationOptions` and calls `navigator.credentials.create(...)`.

In that creation options payload, the relying party value is:

- `rp.id = window.location.hostname`

So the relying party ID is pulled at runtime from the current browser host name (the domain serving the page).

## Where passkey-related data is stored

The helper opens an IndexedDB database named `WebAuthnStorage` with two object stores:

- `credentialData`: stores metadata, including the WebAuthn `credentialId`
- `encryptedData`: stores encrypted payloads and related encryption metadata

After attestation, the returned credential ID is saved in `credentialData`. The app then encrypts the device share (AES-GCM) and stores ciphertext, IV, encrypted key material, and the linked credential ID in `encryptedData`.

The authenticator private key is never exported from the platform authenticator; only references/metadata plus encrypted application data are persisted in IndexedDB.
