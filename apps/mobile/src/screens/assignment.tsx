import { useCallback, useState } from "react";
import { RefreshControl, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { listRequirementOccurrencesWithReferenceImagesResponse, type ListRequirementOccurrencesWithReferenceImagesResponse,
  type RequirementReferenceImage } from "@goproceed/contracts";
import { apiGet } from "../lib/api";
import { API_ORIGIN } from "../lib/env";
import { buildObligationScreen } from "../lib/field/obligations";
import { normRefVerificationLabel } from "../lib/field/norm-ref-labels";
import { AppText, Button, Card, Loading, Notice, Page } from "../ui/primitives";
import { HeaderActions } from "../ui/header-actions";
import { useSessionGate } from "../ui/session-gate";
import { palette, unit } from "../ui/theme";

export function Assignment() {
  const { assignmentId } = useLocalSearchParams<{ assignmentId?: string }>();
  return <><Stack.Screen options={{ headerRight: () => <HeaderActions /> }} />
    <AssignmentDetail key={assignmentId} assignmentId={assignmentId ?? ""} /></>;
}

export function AssignmentDetail({ assignmentId }: { assignmentId: string }) {
  const runtime = useSessionGate(`/a/${assignmentId}`);
  const router = useRouter();
  const [data, setData] = useState<ListRequirementOccurrencesWithReferenceImagesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const subject = runtime.session?.user.id;
  const activateWorkspace = runtime.activateWorkspace;
  useFocusEffect(useCallback(() => {
    let current = true;
    if (!subject) return;
    setLoading(true); setData(null); setError(null);
    void (async () => {
      try {
        if (!/^[a-f\d-]{36}$/i.test(assignmentId)) throw new Error("invalid");
        const response = await apiGet(`/v1/assignments/${assignmentId}/requirement-occurrences?referenceImages=v1`);
        if (!response.ok) throw new Error("access");
        const result = listRequirementOccurrencesWithReferenceImagesResponse.parse(await response.json());
        if (!current) return;
        await activateWorkspace(result.workspaceId);
        if (current) setData(result);
      } catch {
        if (current) setError("Не вдалося завантажити вимоги або підтвердити доступ. Перевірте з’єднання та зверніться до керівника, якщо доступ змінився.");
      } finally { if (current) setLoading(false); }
    })();
    return () => { current = false; };
  }, [assignmentId, subject, revision, activateWorkspace]));
  if (!runtime.session || loading) return <Page><Loading /></Page>;
  if (!data) return <Page><Notice error>{error ?? "Доручення недоступне."}</Notice>
    <Button label="Спробувати ще раз" onPress={() => setRevision(value => value + 1)} /></Page>;
  const model = buildObligationScreen(data);
  return <Page refreshControl={<RefreshControl refreshing={loading} onRefresh={() => setRevision(value => value + 1)} />}>
    <AppText variant="h2">Обов’язкові фіксації</AppText>
    <AppText secondary>{model.coverageMessage}</AppText>
    {!data.captureAllowed ? <Notice>У вас немає дозволу додавати фото. Зверніться до керівника проєкту.</Notice> : null}
    {model.items.map((item, index) => {
      const reference = data.occurrences[index]?.referenceImage;
      return <Card key={item.occurrenceId}>
        <AppText variant="meta" style={{ color: palette["text-brand"] }}>{index + 1}. {item.timingLabel}</AppText>
        <AppText variant="h3">{item.acceptanceCriterion}</AppText>
        {reference && runtime.session ? <ReferenceImage descriptor={reference} accessToken={runtime.session.access_token} /> :
          item.evidenceKind === "photo" ? <AppText variant="meta" secondary>Приклад фото для цієї вимоги ще не додано.</AppText> : null}
        {item.normRef ? <View style={{ padding: unit * 3, gap: unit * 2, backgroundColor: palette["bg-subtle"] }}>
          <AppText>{item.normRef.text}</AppText>
          <AppText variant="meta" secondary>{normRefVerificationLabel(item.normRef.verification)} · {item.normRef.source}</AppText>
        </View> : null}
        <AppText secondary>{item.evidenceKindLabel} · Кількість матеріалів: {item.maxEvidenceCount === null ? `мінімум ${item.minEvidenceCount}` : item.minEvidenceCount === item.maxEvidenceCount ? item.minEvidenceCount : `${item.minEvidenceCount}–${item.maxEvidenceCount}`}</AppText>
        {item.allowedMedia ? <AppText variant="meta" secondary>Формати: {item.allowedMedia.mimeTypes.join(", ")} · До {Math.min(item.allowedMedia.maxByteSize, 20 * 1024 * 1024) / (1024 * 1024)} MiB</AppText> : null}
        {item.evidenceKind === "photo" ? <Button label="Зробити фото" disabled={!data.captureAllowed || runtime.status !== "ready"}
          onPress={() => router.push({ pathname: "/camera", params: { assignmentId, occurrenceId: item.occurrenceId } })} /> : null}
      </Card>;
    })}
    <AppText variant="meta" secondary>{model.disclaimer}</AppText>
  </Page>;
}

function ReferenceImage({ descriptor, accessToken }: { descriptor: RequirementReferenceImage; accessToken: string }) {
  const [failed, setFailed] = useState(false);
  return <View style={{ gap: unit * 2 }}>
    <AppText variant="meta" secondary>Приклад кадру · не доказ виконаної роботи</AppText>
    {failed ? <Notice>Приклад зараз недоступний. Орієнтуйтеся на повну вимогу вище.</Notice> :
      <Image source={{ uri: `${API_ORIGIN}${descriptor.contentPath}`, headers: { Authorization: `Bearer ${accessToken}` } }}
        cachePolicy="none" accessibilityLabel={descriptor.altTextUk} accessible contentFit="contain"
        style={{ width: "100%", aspectRatio: descriptor.width / descriptor.height, maxHeight: 320, backgroundColor: palette["bg-subtle"] }}
        onError={() => setFailed(true)} />}
    <AppText variant="meta" secondary>{descriptor.altTextUk}</AppText>
  </View>;
}
