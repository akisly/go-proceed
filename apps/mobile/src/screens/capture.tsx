import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, BackHandler, Platform, Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { File, Paths } from "expo-file-system";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { listRequirementOccurrencesWithReferenceImagesResponse } from "@goproceed/contracts";
import { apiGet } from "../lib/api";
import { mediaList, megabytes } from "../lib/native/item-labels";
import type { CaptureImport } from "../lib/native/runtime";
import { MobileGlassSurface } from "../ui/mobile-glass-surface";
import { AppText, Button, Loading, Notice, Page } from "../ui/primitives";
import { useSessionGate } from "../ui/session-gate";
import { corners, palette, touchHeight, unit } from "../ui/theme";

const MAX_BYTES = 20 * 1024 * 1024;
const DEFAULT_TYPES = ["image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"];
type Target = { workspaceId: string; criterion: string; mimeTypes: string[]; maxBytes: number };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A plaintext copy the vault did not take; the launch/background sweep is only the backstop. */
function dropPlaintext(uri: string): void {
  try {
    // Only camera/picker copies under Caches, never anything else a URI could name.
    const file = new File(uri);
    const cache = Paths.cache.uri.endsWith("/") ? Paths.cache.uri : `${Paths.cache.uri}/`;
    if (!file.uri.startsWith(cache) || file.uri.includes("/../")) return;
    if (file.exists) file.delete();
  } catch { /* swept later */ }
}
type Phase = "idle" | "saving" | "saved" | "failed";

/** EXIF DateTimeOriginal is local wall time without a zone; read it as device-local. */
function exifTime(exif: Record<string, unknown> | null | undefined): string | null {
  const value = exif?.DateTimeOriginal;
  const match = typeof value === "string" ? /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value) : null;
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match.map(Number);
  const date = new Date(y!, mo! - 1, d!, h!, mi!, s!);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function Capture() {
  const params = useLocalSearchParams<{ assignmentId?: string; occurrenceId?: string }>();
  const assignmentId = typeof params.assignmentId === "string" ? params.assignmentId : "";
  const occurrenceId = typeof params.occurrenceId === "string" ? params.occurrenceId : "";
  const runtime = useSessionGate(`/a/${assignmentId}`);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const busy = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const subject = runtime.session?.user.id;
  const { activateWorkspace } = runtime;

  // Access is re-read here: a deep link or a stale screen is not an authorization.
  useEffect(() => {
    let current = true;
    if (!subject) return;
    setLoadFailed(false);
    void (async () => {
      try {
        if (!UUID.test(assignmentId) || !UUID.test(occurrenceId)) throw new Error("invalid");
        const response = await apiGet(`/v1/assignments/${assignmentId}/requirement-occurrences?referenceImages=v1`);
        if (!response.ok) throw new Error("access");
        const data = listRequirementOccurrencesWithReferenceImagesResponse.parse(await response.json());
        const occurrence = data.occurrences.find((item) => item.occurrenceId === occurrenceId);
        if (!occurrence || !data.captureAllowed) throw new Error("access");
        await activateWorkspace(data.workspaceId);
        if (!current) return;
        setTarget({
          workspaceId: data.workspaceId,
          criterion: occurrence.acceptanceCriterion,
          mimeTypes: occurrence.allowedMedia?.mimeTypes ?? DEFAULT_TYPES,
          maxBytes: Math.min(occurrence.allowedMedia?.maxByteSize ?? MAX_BYTES, MAX_BYTES),
        });
      } catch { if (current) setLoadFailed(true); }
    })();
    return () => { current = false; };
  }, [assignmentId, occurrenceId, subject, activateWorkspace]);

  // iOS has no live regions: announce the moments that decide whether to retake.
  // Android already reads the live regions below, so it would hear these twice.
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    if (phase === "saving") AccessibilityInfo.announceForAccessibility("Зберігаємо фото на пристрої");
    if (phase === "saved") AccessibilityInfo.announceForAccessibility("Фото збережено на пристрої");
  }, [phase]);
  useEffect(() => { if (message && Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(message); }, [message]);
  // Leaving mid-save would drop a failure the user must act on (retake).
  useEffect(() => {
    if (phase !== "saving") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, [phase]);

  async function commit(input: Omit<CaptureImport, "assignmentId" | "occurrenceId" | "maxBytes" | "workspaceId">) {
    if (!target) return;
    setPhase("saving"); setMessage(null);
    try {
      await runtime.importPhoto({ ...input, assignmentId, occurrenceId, maxBytes: target.maxBytes, workspaceId: target.workspaceId });
      setPhase("saved");
    } catch {
      dropPlaintext(input.uri);
      setPhase("failed");
      setMessage(input.originMethod === "photo_picker"
        ? `Фото не збережено. Оберіть інше фото до ${megabytes(target.maxBytes)} або зробіть знімок камерою.`
        : `Фото не збережено. Спробуйте ще раз або оберіть фото з галереї до ${megabytes(target.maxBytes)}.`);
    }
  }

  async function shoot() {
    if (busy.current || !camera.current || !target) return;
    busy.current = true;
    const release = runtime.holdCapture();
    try {
      const claimedCaptureTime = new Date().toISOString();
      const picture = await camera.current.takePictureAsync({ exif: false, imageType: "jpg", shutterSound: true });
      await commit({ uri: picture.uri, originMethod: "native_camera", mimeType: "image/jpeg", claimedCaptureTime });
    } catch {
      setPhase("failed"); setMessage("Камера не зробила знімок. Спробуйте ще раз.");
    } finally { release(); busy.current = false; }
  }

  async function pick() {
    if (busy.current || !target) return;
    busy.current = true;
    const release = runtime.holdCapture();
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"], allowsEditing: false, allowsMultipleSelection: false, exif: true, quality: 1,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
      });
      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return;
      const mimeType = asset.mimeType ?? "";
      if (!target.mimeTypes.includes(mimeType)) {
        dropPlaintext(asset.uri); setPhase("failed"); setMessage(`Цей формат не приймається. Дозволено: ${mediaList(target.mimeTypes)}.`); return;
      }
      if (asset.fileSize && asset.fileSize > target.maxBytes) {
        dropPlaintext(asset.uri); setPhase("failed"); setMessage(`Фото більше за ${megabytes(target.maxBytes)}. Оберіть інше або зробіть знімок камерою.`); return;
      }
      await commit({ uri: asset.uri, originMethod: "photo_picker", mimeType,
        claimedCaptureTime: exifTime(asset.exif) ?? new Date().toISOString() });
    } catch {
      setPhase("failed"); setMessage("Не вдалося відкрити фото. Спробуйте ще раз.");
    } finally { release(); busy.current = false; }
  }

  const close = () => { if (router.canGoBack()) router.back(); else router.replace(`/a/${assignmentId}`); };

  if (!runtime.session || (!target && !loadFailed)) return <Page><Loading /></Page>;
  if (loadFailed || !target) return <Page>
    <Notice error>Не вдалося підтвердити доступ до цієї вимоги. Перевірте з’єднання та зверніться до керівника, якщо доступ змінився.</Notice>
    <Button label="Закрити" onPress={close} />
  </Page>;
  if (runtime.status !== "ready") return <Page>
    <Notice error>Захищене сховище недоступне. Знімання заблоковано до відновлення сховища.</Notice>
    <Button label="Закрити" onPress={close} />
  </Page>;
  if (!permission) return <Page><Loading /></Page>;
  const saving = phase === "saving";
  const savedCard = <>
    <AppText variant="h3" accessibilityLiveRegion="polite">Фото збережено на пристрої</AppText>
    <AppText secondary>Надішлемо його, поки застосунок відкритий і є з’єднання. Стан видно в розділі «Надсилання» на екрані доручень.</AppText>
    <Button label="Готово" onPress={close} />
    <Button secondary label="Ще одне фото" onPress={() => { setPhase("idle"); setMessage(null); setCameraReady(false); }} />
  </>;
  if (!permission.granted) return <Page>
    {phase === "saved" ? savedCard : <>
      <AppText variant="h2">Потрібен доступ до камери</AppText>
      <AppText secondary>GoProceed знімає фото лише тоді, коли ви натискаєте кнопку знімка.</AppText>
      {permission.canAskAgain ? <Button label="Дозволити камеру" disabled={saving} onPress={() => { void requestPermission(); }} />
        : <Notice>Доступ вимкнено в налаштуваннях пристрою. Увімкніть камеру для GoProceed або оберіть наявне фото.</Notice>}
      {saving ? <Loading label="Зберігаємо фото на пристрої… Не закривайте застосунок." /> : null}
      {message ? <Notice error>{message}</Notice> : null}
      <Button secondary label="Обрати з галереї" disabled={saving} onPress={() => { void pick(); }} />
      <Button secondary label="Закрити" disabled={saving} onPress={close} />
    </>}
  </Page>;

  const jpegAllowed = target.mimeTypes.includes("image/jpeg");
  return <View style={{ flex: 1, backgroundColor: palette["bg-inverse"] }}>
    {phase !== "saved" ? <CameraView ref={camera} style={{ flex: 1 }} facing="back" mode="picture"
      onCameraReady={() => setCameraReady(true)} onMountError={() => { setPhase("failed"); setMessage("Камера недоступна. Оберіть наявне фото."); }} /> : <View style={{ flex: 1 }} />}
    <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + unit * 2, left: insets.left + unit * 3, right: insets.right + unit * 3 }}>
      <MobileGlassSurface overCamera style={{ padding: unit * 3, gap: unit * 2, flexDirection: "row", alignItems: "center" }}>
        <ScrollView style={{ flex: 1, maxHeight: expanded ? touchHeight * 4 : undefined }}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded }}
            accessibilityHint={expanded ? "Згорнути вимогу" : "Показати вимогу повністю"}
            onPress={() => setExpanded((value) => !value)}>
            <AppText selectable={false} numberOfLines={expanded ? undefined : 3}>{target.criterion}</AppText>
          </Pressable>
        </ScrollView>
        <Pressable accessibilityRole="button" accessibilityLabel="Закрити камеру" accessibilityState={{ disabled: saving }} disabled={saving} onPress={close}
          style={{ minHeight: touchHeight, minWidth: touchHeight, alignItems: "center", justifyContent: "center", opacity: saving ? 0.5 : 1 }}>
          <AppText selectable={false} variant="h2">✕</AppText>
        </Pressable>
      </MobileGlassSurface>
    </View>
    <View pointerEvents="box-none" style={{ position: "absolute", bottom: insets.bottom + unit * 3, left: insets.left + unit * 3, right: insets.right + unit * 3, gap: unit * 3 }}>
      {saving ? <MobileGlassSurface overCamera style={{ padding: unit * 3 }}>
        <Loading label="Зберігаємо фото на пристрої… Не закривайте застосунок." />
      </MobileGlassSurface> : null}
      {phase === "saved" ? <MobileGlassSurface overCamera style={{ padding: unit * 4, gap: unit * 3 }}>{savedCard}</MobileGlassSurface> : null}
      {message ? <Notice error>{message}</Notice> : null}
      {!jpegAllowed && phase !== "saved" ? <Notice>Для цієї вимоги камера не підходить за форматом. Оберіть фото з галереї.</Notice> : null}
      {phase !== "saved" ? <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1, alignItems: "flex-start" }}><MobileGlassSurface overCamera style={{ borderRadius: corners.pill }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Обрати фото з галереї" accessibilityState={{ disabled: saving }} disabled={saving} onPress={() => { void pick(); }}
            style={{ minHeight: touchHeight, paddingHorizontal: unit * 4, justifyContent: "center", opacity: saving ? 0.5 : 1 }}>
            <AppText selectable={false}>Галерея</AppText>
          </Pressable>
        </MobileGlassSurface></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Зробити знімок"
          accessibilityState={{ disabled: saving || !cameraReady || !jpegAllowed }}
          disabled={saving || !cameraReady || !jpegAllowed} onPress={() => { void shoot(); }}
          style={({ pressed }) => ({ width: touchHeight * 1.6, height: touchHeight * 1.6, borderRadius: corners.pill,
            borderWidth: unit, borderColor: palette["border-inverse"],
            backgroundColor: palette[pressed ? "action-primary-hover" : "action-primary-bg"],
            opacity: saving || !cameraReady || !jpegAllowed ? 0.5 : 1 })} />
        <View style={{ flex: 1 }} />
      </View> : null}
    </View>
  </View>;
}
