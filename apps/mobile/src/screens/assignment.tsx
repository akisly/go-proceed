import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshControl, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useNetworkState } from "expo-network";
import { Image } from "expo-image";
import { listRequirementOccurrencesWithReferenceImagesResponse, type ListRequirementOccurrencesWithReferenceImagesResponse,
  type RequirementReferenceImage } from "@goproceed/contracts";
import { apiGet, readProblem } from "../lib/api";
import { openedAssignment } from "../lib/field/opened-assignment";
import { mediaList, megabytes } from "../lib/native/item-labels";
import { API_ORIGIN } from "../lib/env";
import { buildObligationScreen } from "../lib/field/obligations";
import { normRefVerificationLabel } from "../lib/field/norm-ref-labels";
import { AppText, Button, Card, Loading, Notice, Page } from "../ui/primitives";
import { HeaderActions } from "../ui/header-actions";
import { useSessionGate } from "../ui/session-gate";
import { palette, unit } from "../ui/theme";

/** A refusal the server explained in Ukrainian; anything else gets generic copy. */
class ServerRefusal extends Error {}
/** A malformed id: retrying cannot help. */
class InvalidAssignment extends Error {}

export function Assignment() {
  const { assignmentId } = useLocalSearchParams<{ assignmentId?: string }>();
  // The full name is the page heading (a header title truncates the part that tells
  // two similar assignments apart), so the header keeps its generic title.
  return <><Stack.Screen options={{ headerRight: () => <HeaderActions /> }} />
    <AssignmentDetail key={assignmentId} assignmentId={assignmentId ?? ""} heading /></>;
}

export function AssignmentDetail({ assignmentId, heading = false }: { assignmentId: string; heading?: boolean }) {
  const runtime = useSessionGate(`/a/${assignmentId}`);
  const router = useRouter();
  const network = useNetworkState();
  const [data, setData] = useState<ListRequirementOccurrencesWithReferenceImagesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  // Returning from the camera re-reads access but keeps the page and its scroll;
  // capture waits for the re-read, so authorization on focus still holds.
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  // Only a pull by the user shows the spinner: a background re-read must not move the page.
  const [pulling, setPulling] = useState(false);
  const [invalid, setInvalid] = useState(false);
  // Read through a ref so a dropped signal does not itself trigger a re-read.
  const offline = useRef(false);
  offline.current = network.isConnected === false;
  const wasOffline = useRef(false);
  useEffect(() => {
    if (network.isConnected === false) wasOffline.current = true;
    else if (network.isConnected === true && wasOffline.current) { wasOffline.current = false; setRevision((value) => value + 1); }
  }, [network.isConnected]);
  const subject = runtime.session?.user.id;
  const activateWorkspace = runtime.activateWorkspace;
  useFocusEffect(useCallback(() => {
    let current = true;
    if (!subject) return;
    setLoading(true); setVerified(false); setError(null);
    void (async () => {
      try {
        if (!/^[a-f\d-]{36}$/i.test(assignmentId)) throw new InvalidAssignment();
        const response = await apiGet(`/v1/assignments/${assignmentId}/requirement-occurrences?referenceImages=v1`);
        if (!response.ok) {
          const problem = await readProblem(response);
          throw new ServerRefusal(problem.detail ?? "Доручення недоступне. Зверніться до керівника, якщо доступ змінився.");
        }
        const result = listRequirementOccurrencesWithReferenceImagesResponse.parse(await response.json());
        if (!current) return;
        await activateWorkspace(result.workspaceId);
        if (current) { setData(result); setVerified(true); }
      } catch (reason) {
        if (!current) return;
        // Only the server saying no removes the requirements; a lost signal keeps them
        // on screen (capture stays off until a re-read succeeds).
        if (reason instanceof ServerRefusal || reason instanceof InvalidAssignment) setData(null);
        setInvalid(reason instanceof InvalidAssignment);
        setError(reason instanceof InvalidAssignment ? "Це посилання не веде до доручення. Відкрийте його зі списку."
          : reason instanceof ServerRefusal ? reason.message
          : offline.current ? "Немає з’єднання. Вимоги показано з останнього завантаження; знімання ввімкнеться, щойно з’явиться зв’язок."
          : "Не вдалося оновити вимоги. Спробуйте ще раз.");
      } finally { if (current) { setLoading(false); setPulling(false); } }
    })();
    return () => { current = false; };
  }, [assignmentId, subject, revision, activateWorkspace]));
  if (!runtime.session || (loading && !data)) return <Page><Loading /></Page>;
  if (!data) return <Page><Notice error>{error ?? "Доручення недоступне."}</Notice>
    {invalid ? null : <Button label="Спробувати ще раз" onPress={() => setRevision(value => value + 1)} />}</Page>;
  const model = buildObligationScreen(data);
  const opened = openedAssignment(assignmentId);
  const references = new Map(data.occurrences.map((o) => [o.occurrenceId, o.referenceImage]));
  return <Page refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => { setPulling(true); setRevision(value => value + 1); }} tintColor={palette["text-link"]} />}>
    {heading && opened ? <View style={{ gap: unit }}>
      <AppText variant="meta" secondary>{opened.projectName}</AppText>
      <AppText variant="h2">{opened.description}</AppText>
    </View> : null}
    {error ? <Notice error>{error}</Notice> : null}
    {!verified && !error ? <AppText variant="meta" secondary>Перевіряємо доступ…</AppText> : null}
    <AppText variant={heading && opened ? "h3" : "h2"}>Обов’язкові фіксації</AppText>
    <AppText secondary>{model.coverageMessage}</AppText>
    {!data.captureAllowed ? <Notice>У вас немає дозволу додавати фото. Зверніться до керівника проєкту.</Notice> : null}
    {data.captureAllowed && (runtime.status === "unavailable" || runtime.status === "error") ?
      <Notice error>Захищене сховище недоступне. Знімання заблоковано до відновлення сховища.</Notice> : null}
    {data.captureAllowed && runtime.status === "booting" ? <Notice>Готуємо захищене сховище…</Notice> : null}
    {model.items.map((item, index) => {
      const reference = references.get(item.occurrenceId);
      return <Card key={item.occurrenceId}>
        <AppText variant="meta" secondary>{index + 1}. {item.timingLabel}</AppText>
        <AppText variant="h3">{item.acceptanceCriterion}</AppText>
        {item.normRef ? <View style={{ padding: unit * 3, gap: unit * 2, backgroundColor: palette["bg-subtle"] }}>
          <AppText>{item.normRef.text}</AppText>
          <AppText variant="meta" secondary>{normRefVerificationLabel(item.normRef.verification)} · {item.normRef.source}</AppText>
        </View> : null}
        {/* After the requirement and its citation: an illustration never reads as part of the norm. */}
        {reference && runtime.session ? <ReferenceImage descriptor={reference} accessToken={runtime.session.access_token} /> : null}
        <AppText secondary>{item.evidenceKindLabel} · Кількість матеріалів: {item.maxEvidenceCount === null ? `мінімум ${item.minEvidenceCount}` : item.minEvidenceCount === item.maxEvidenceCount ? item.minEvidenceCount : `${item.minEvidenceCount}–${item.maxEvidenceCount}`}</AppText>
        {item.allowedMedia ? <AppText variant="meta" secondary>Формати: {mediaList(item.allowedMedia.mimeTypes)} · До {megabytes(Math.min(item.allowedMedia.maxByteSize, 20 * 1024 * 1024))}</AppText> : null}
        {item.evidenceKind === "photo" ? <Button label="Зробити фото"
          accessibilityLabel={`Зробити фото — вимога ${index + 1}, ${item.timingLabel}`}
          disabled={!data.captureAllowed || runtime.status !== "ready" || !verified}
          onPress={() => router.push({ pathname: "/camera", params: { assignmentId, occurrenceId: item.occurrenceId } })} /> : null}
      </Card>;
    })}
    <AppText variant="meta" secondary>{model.disclaimer}</AppText>
  </Page>;
}

function ReferenceImage({ descriptor, accessToken }: { descriptor: RequirementReferenceImage; accessToken: string }) {
  const [failed, setFailed] = useState(false);
  return <View style={{ gap: unit * 2 }}>
    <AppText variant="meta" secondary>Ілюстрація GoProceed · не норма і не доказ виконаної роботи</AppText>
    {failed ? <Notice>Ілюстрація зараз недоступна. Орієнтуйтеся на повну вимогу вище.</Notice> :
      <Image source={{ uri: `${API_ORIGIN.replace(/\/$/, "")}${descriptor.contentPath}`, headers: { Authorization: `Bearer ${accessToken}` } }}
        cachePolicy="none" accessibilityLabel={descriptor.altTextUk} accessible contentFit="contain"
        style={{ width: "100%", aspectRatio: descriptor.width / descriptor.height, maxHeight: 320, backgroundColor: palette["bg-subtle"] }}
        onError={() => setFailed(true)} />}
    {/* The image already carries this text as its label; a reader should hear it once. */}
    <AppText variant="meta" secondary accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{descriptor.altTextUk}</AppText>
  </View>;
}
