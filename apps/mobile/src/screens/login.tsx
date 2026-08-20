// Copy, flow and call shapes are `apps/app/app/(auth)/login/otp-form.tsx` and
// its `page.tsx` — asserted verbatim by QA, so nothing here is paraphrased.
// The two phases and the re-entrancy guard live in `../lib/login-flow.ts`
// (see that file's header for why); this screen owns only the two live
// `TextInput` values and renders whatever the flow reports back.
import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { color, type ThemeName } from "@goproceed/tokens";

import { supabase } from "../lib/supabase";
import { safeNext } from "../lib/safe-next";
import { LoginFlow, initialLoginFlowState, type LoginFlowState } from "../lib/login-flow";

// Pinned, same convention and same caveat as token-proof.tsx: this screen
// does not yet follow the device's own theme.
const THEME: ThemeName = "light";

export function Login() {
  const router = useRouter();

  // `page.tsx`'s own rule, mirrored exactly: a repeated `?next=a&next=b`
  // parses to a string[] on the web, and expo-router's typed params carry
  // the same possibility — anything but a single plain string is treated as
  // absent, never coerced or picked-first.
  const params = useLocalSearchParams<{ next?: string | string[] }>();
  const next = typeof params.next === "string" ? params.next : undefined;
  // Read at the moment `onSignedIn` actually fires, not captured once at
  // construction — `flowRef` below is built lazily on first render and then
  // reused for the screen's whole lifetime, so a plain closure over `next`
  // here would freeze whatever `next` was on that first render. A ref kept
  // current on every render avoids that without recreating the flow (and
  // its in-flight guard) on every `next` change.
  const nextRef = useRef(next);
  nextRef.current = next;

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [state, setState] = useState<LoginFlowState>(initialLoginFlowState);

  // Lazily assigned (`??=`), not `useRef(new LoginFlow(...))` — the latter's
  // argument is evaluated on every render even though only the first one is
  // kept, which would construct and immediately discard a fresh LoginFlow
  // (and a fresh in-flight guard) on every render. Same pattern
  // `otp-form.tsx` uses for its `SubmitGuard` via `guardRef`.
  const flowRef = useRef<LoginFlow | null>(null);
  flowRef.current ??= new LoginFlow(
    {
      // The Supabase-specific call shapes live here, at the one real call
      // site — `login-flow.ts` takes a bare email/code and knows nothing
      // about Supabase. `shouldCreateUser: false` is LOAD-BEARING, not a
      // default left in place: see otp-form.tsx's identical comment — a
      // pilot member is invited and granted capabilities by an
      // administrator, and `true` here would let this screen mint a new
      // Supabase Auth user for anyone who types an address.
      signInWithOtp: (address) =>
        supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: false } }),
      verifyOtp: (address, token) =>
        supabase.auth.verifyOtp({ email: address, token, type: "email" }),
      onSignedIn: () => {
        // `.replace`, not `.push`: the one-time code just spent should not
        // sit one back-button press away from a resubmit attempt. This
        // build is web-first only (see `../lib/supabase.ts`'s header), so
        // `window.location.origin` is available here the same way it is at
        // `otp-form.tsx`'s call site.
        //
        // `as Href`, NOT A NARROWER TYPE — `safeNext` resolves an arbitrary
        // caller-supplied `?next=` value against the current origin and
        // returns whatever same-origin path/query/hash results (see that
        // function's own header); it is deliberately NOT restricted to this
        // app's known route table, so no object-form `Href` can describe it
        // statically. expo-router's own typed-routes docs endorse exactly
        // this cast for a runtime-computed string
        // (`<Link href={(\`/user\` + id) as Href} />`,
        // https://docs.expo.dev/router/reference/typed-routes/, read
        // 2026-08-21) — not a suppression, the one documented escape hatch
        // for a route that is genuinely dynamic.
        router.replace(safeNext(nextRef.current ?? "/", window.location.origin) as Href);
      },
    },
    setState,
  );
  const flow = flowRef.current;

  const { phase, sentTo, pending, message } = state;

  const handleSubmitEmail = useCallback(() => {
    void flow.submitEmail(email);
  }, [flow, email]);

  const handleSubmitCode = useCallback(() => {
    void flow.submitCode(code);
  }, [flow, code]);

  const handleChangeEmail = useCallback(() => {
    // `code` is this screen's own state — see login-flow.ts's `changeEmail`
    // comment for why it does not clear it itself.
    setCode("");
    flow.changeEmail();
  }, [flow]);

  return (
    <View style={styles.page}>
      <View style={styles.content}>
        <Text style={styles.heading}>GoProceed</Text>
        <Text style={styles.intro}>
          Вхід за одноразовим кодом, який ми надішлемо на вашу електронну пошту.
        </Text>

        {phase === "code" ? (
          <View style={styles.form}>
            <Text style={styles.sentLine}>
              Код надіслано на <Text style={styles.sentEmail}>{sentTo}</Text>.
            </Text>
            <View style={styles.field}>
              <Text style={styles.label}>Код із листа</Text>
              <TextInput
                id="otp-code"
                testID="otp-code"
                accessibilityLabel="Код із листа"
                value={code}
                onChangeText={setCode}
                inputMode="numeric"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                maxLength={6}
                editable={!pending}
                autoFocus
                style={styles.input}
              />
            </View>
            {message ? (
              <Text role="alert" style={styles.error}>{message}</Text>
            ) : null}
            <Button
              testID="otp-code-submit"
              label={pending ? "Перевіряємо…" : "Увійти"}
              onPress={handleSubmitCode}
              disabled={pending || code.length === 0}
              variant="primary"
            />
            <Button
              testID="otp-change-email"
              label="Змінити адресу пошти"
              onPress={handleChangeEmail}
              disabled={pending}
              variant="ghost"
            />
          </View>
        ) : (
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Електронна пошта</Text>
              <TextInput
                id="otp-email"
                testID="otp-email"
                accessibilityLabel="Електронна пошта"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                inputMode="email"
                autoComplete="email"
                editable={!pending}
                autoFocus
                style={styles.input}
              />
            </View>
            {message ? (
              <Text role="alert" style={styles.error}>{message}</Text>
            ) : null}
            <Button
              testID="otp-email-submit"
              label={pending ? "Надсилаємо…" : "Надіслати код"}
              onPress={handleSubmitEmail}
              disabled={pending || email.length === 0}
              variant="primary"
            />
          </View>
        )}
      </View>
    </View>
  );
}

type ButtonVariant = "primary" | "ghost";

/**
 * Not a shared `packages/ui` component — this pilot's mobile app has none
 * yet, and the brief for this screen is two buttons, not a design system.
 * `role="button"` (not the deprecated `accessibilityRole`) plus `testID` is
 * what react-native-web forwards straight onto the rendered `<div>` with no
 * wrapper — see this task's report for the verified DOM shape.
 */
function Button({
  label, onPress, disabled, variant, testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant: ButtonVariant;
  testID: string;
}) {
  const isPrimary = variant === "primary";
  return (
    <Pressable
      testID={testID}
      role="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.buttonBase,
        isPrimary ? styles.buttonPrimary : styles.buttonGhost,
        pressed && !disabled ? (isPrimary ? styles.buttonPrimaryPressed : styles.buttonGhostPressed) : null,
        disabled ? styles.buttonDisabled : null,
      ]}
    >
      <Text style={isPrimary ? styles.buttonPrimaryText : styles.buttonGhostText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: color[THEME]["bg-canvas"],
  },
  content: {
    flex: 1,
    justifyContent: "center",
    maxWidth: 384,
    width: "100%",
    alignSelf: "center",
    padding: 24,
    gap: 32,
  },
  heading: {
    fontSize: 28,
    fontWeight: "600",
    color: color[THEME]["text-primary"],
  },
  intro: {
    fontSize: 15,
    lineHeight: 22,
    color: color[THEME]["text-secondary"],
    marginTop: 8,
  },
  form: {
    gap: 16,
  },
  sentLine: {
    fontSize: 15,
    color: color[THEME]["text-secondary"],
  },
  sentEmail: {
    fontWeight: "500",
    color: color[THEME]["text-primary"],
  },
  field: {
    gap: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: color[THEME]["text-primary"],
  },
  input: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: color[THEME]["border-default"],
    backgroundColor: color[THEME]["bg-surface"],
    color: color[THEME]["text-primary"],
    paddingHorizontal: 12,
    fontSize: 15,
  },
  error: {
    fontSize: 13,
    color: color[THEME]["status-blocked-fg"],
  },
  buttonBase: {
    minHeight: 44,
    minWidth: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  buttonPrimary: {
    backgroundColor: color[THEME]["action-primary-bg"],
  },
  buttonPrimaryPressed: {
    backgroundColor: color[THEME]["action-primary-hover"],
  },
  buttonPrimaryText: {
    color: color[THEME]["action-primary-fg"],
    fontSize: 15,
    fontWeight: "600",
  },
  buttonGhost: {
    backgroundColor: "transparent",
  },
  buttonGhostPressed: {
    backgroundColor: color[THEME]["action-ghost-hover"],
  },
  buttonGhostText: {
    color: color[THEME]["text-secondary"],
    fontSize: 15,
    fontWeight: "500",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
