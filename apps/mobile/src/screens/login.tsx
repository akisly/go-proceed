import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { authStorage, supabase } from "../lib/supabase";
import { LoginFlow, initialLoginFlowState } from "../lib/login-flow";
import { nativeNext } from "../lib/native/destinations";
import { useNativeRuntime } from "../lib/native/runtime";
import { AppText, Button, Card, Notice, Page } from "../ui/primitives";
import { confirmWipe, wipeNote, type WipeNote } from "../ui/vault-wipe";
import { corners, fonts, palette, touchHeight, typeSize, unit } from "../ui/theme";

export function Login() {
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string | string[] }>();
  const next = nativeNext(typeof params.next === "string" ? params.next : "/");
  const runtime = useNativeRuntime();
  const { session } = runtime;
  const [note, setNote] = useState<WipeNote | null>(null);
  const [wiping, setWiping] = useState(false);
  // A wipe started on the profile screen signed out and landed here: say its outcome once.
  const { lastWipe, clearLastWipe } = runtime;
  useEffect(() => { if (lastWipe) { setNote(wipeNote(lastWipe)); clearLastWipe(); } }, [lastWipe, clearLastWipe]);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [state, setState] = useState(initialLoginFlowState);
  const busy = state.pending || wiping;
  const nextRef = useRef(next);
  nextRef.current = next;
  const flowRef = useRef<LoginFlow | null>(null);
  flowRef.current ??= new LoginFlow({
    signInWithOtp: address => supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: false } }),
    verifyOtp: (address, token) => { authStorage.reopenForSignIn(); return supabase.auth.verifyOtp({ email: address, token, type: "email" }); },
    onSignedIn: () => router.replace(nativeNext(nextRef.current) as Href),
  }, setState);
  const flow = flowRef.current;
  useEffect(() => { if (session) router.replace(next as Href); }, [session, next, router]);
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <Page contentContainerStyle={{ justifyContent: "center", width: "100%", maxWidth: 520, alignSelf: "center" }}>
      <View style={{ gap: unit * 2, paddingVertical: unit * 6 }}>
        <AppText variant="display" style={{ fontFamily: fonts.brand, color: palette["text-primary"] }}>GoProceed</AppText>
        <AppText secondary>Фіксуйте роботу. Зберігайте підтвердження.</AppText>
      </View>
      <Card>
        <AppText variant="h2">{state.phase === "email" ? "Увійдіть у робочий простір" : "Перевірте пошту"}</AppText>
        <AppText secondary>{state.phase === "email" ? "Вхід за одноразовим кодом, який ми надішлемо на вашу електронну пошту." : `Код надіслано на ${state.sentTo}.`}</AppText>
        <AppText>{state.phase === "email" ? "Електронна пошта" : "Код із листа"}</AppText>
        {state.phase === "email" ? <TextInput testID="otp-email" accessibilityLabel="Електронна пошта"
          value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false}
          keyboardType="email-address" autoComplete="email" editable={!busy} style={inputStyle}
          onSubmitEditing={() => { if (email.trim() && !busy) void flow.submitEmail(email.trim()); }} /> :
          <TextInput testID="otp-code" accessibilityLabel="Код із листа" value={code} onChangeText={setCode}
            keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} editable={!busy}
            autoFocus style={[inputStyle, { fontVariant: ["tabular-nums"] }]} />}
        {state.message ? <Notice error announce>{state.message}</Notice> : null}
        <Button testID={state.phase === "email" ? "otp-email-submit" : "otp-code-submit"}
          label={state.pending ? "Зачекайте…" : state.phase === "email" ? "Надіслати код" : "Увійти"}
          disabled={busy || (state.phase === "email" ? !email.trim() : code.length !== 6)}
          onPress={() => { void (state.phase === "email" ? flow.submitEmail(email.trim()) : flow.submitCode(code)); }} />
        {state.phase === "code" ? <Button secondary label="Змінити адресу пошти" disabled={busy}
          onPress={() => { setCode(""); flow.changeEmail(); }} /> : null}
      </Card>
      {runtime.status === "error" && runtime.errorReason === "installation" ?
        <Notice error>Застосунок не зміг підготуватися до роботи. Звільніть місце на телефоні й перезапустіть застосунок.</Notice> : null}
      {runtime.status === "error" && runtime.errorReason === "vault" ? <Card>
        <Notice error>Захищене сховище на цьому телефоні не відкривається, тому знімати фото зараз не можна. Увійти можна: ненадіслані фото залишаться заблокованими.</Notice>
        {/* A sign-in finishing during a wipe would be signed straight back out: one at a time. */}
        <Button destructive label={wiping ? "Стираємо…" : "Стерти фото на пристрої"} disabled={busy}
          onPress={() => confirmWipe(runtime, false, () => { setWiping(true); setNote(null); }, (result) => { setWiping(false); setNote(result); })} />
      </Card> : null}
      {note ? <Notice error={note.error} announce>{note.text}</Notice> : null}
      <AppText variant="meta" secondary>Доступ надає адміністратор вашого робочого простору.</AppText>
    </Page>
  </KeyboardAvoidingView>;
}

const inputStyle = { minHeight: touchHeight, borderWidth: 1, borderColor: palette["border-default"],
  borderRadius: corners.control, padding: unit * 3, backgroundColor: palette["bg-surface"],
  color: palette["text-primary"], fontFamily: fonts.regular, fontSize: typeSize.body };
