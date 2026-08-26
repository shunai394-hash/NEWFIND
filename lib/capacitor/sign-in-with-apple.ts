import { registerPlugin } from "@capacitor/core";

export type NativeAppleSignInResult = {
  user: string;
  email: string | null;
  givenName: string | null;
  familyName: string | null;
  identityToken: string;
  authorizationCode: string;
};

export type NativeAppleSignInPlugin = {
  authorize(options: {
    nonce?: string;
    state?: string;
  }): Promise<NativeAppleSignInResult>;
};

export const NativeAppleSignIn = registerPlugin<NativeAppleSignInPlugin>(
  "SignInWithApple",
);
