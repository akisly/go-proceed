// «Обов'язкові фіксації» — the obligation screen. ADR-007 decision 4, both
// obligations now present: what must be photographed, in the standard's own
// wording, BEFORE work starts (this screen), and the capture control that
// takes the photo (`./capture.tsx`'s `CaptureIsland`, rendered inside each
// `ObligationCard` below).
//
// PORT of apps/app/app/(app)/a/[assignmentId]/page.tsx. ALL THE DECISIONS
// LIVE IN `buildObligationScreen` (`../lib/field/obligations.ts`), tested
// there with no RN/jsdom — see that file's header. This screen fetches,
// hands the response to that function unmodified, and renders exactly what
// comes back — it makes no decision of its own about order, wording, or what
// an empty list means.
//
// GOES THROUGH `/v1`, NOT AROUND IT — same reasoning as `../lib/api.ts`'s own
// header comment: the route re-checks membership and `project.view` on every
// call, so this screen and the PWA are authorised by the same code.
//
// THE ONE THING `page.tsx` DOES NOT HAVE TO DO THAT THIS SCREEN DOES: decide
// when to fetch at all. `page.tsx` is a React Server Component — the session
// is already resolved into cookies before it ever executes. This screen runs
// on a mounted client, so it owns its own `requireSession()` gate before
// fetching — the same delta `../screens/my-assignments.tsx`'s own header
// names for the same reason.
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { color, type ThemeName } from "@goproceed/tokens";

import { apiGet, readProblem, requireSession, type Problem } from "../lib/api";
import { supabase } from "../lib/supabase";
import { buildObligationScreen, type ObligationItem } from "../lib/field/obligations";
import { normRefVerificationLabel } from "../lib/field/norm-ref-labels";
import { CaptureIsland } from "./capture";

// Inlined from @goproceed/contracts (not a mobile app dependency) — same
// shapes `../lib/field/obligations.ts` inlines, kept in sync with it by hand.
interface NormativeCitation {
  text: string;
  // Kept in sync BY HAND with `packages/contracts/src/requirement-library.ts`'s
  // `verificationTag` — this app has no dependency on `@goproceed/contracts` to
  // import it from (see the file header). Widened to three values by migration
  // 0059/ADR-010: `PROJECT_DOCUMENTATION` names an origin (a workspace's own
  // робоча документація), not a verification strength, and is never a
  // downgrade target or source for the other two.
  verification: "VERIFIED_PRIMARY" | "VERIFIED_SECONDARY" | "PROJECT_DOCUMENTATION";
  source: string;
}

type RequirementTimingValue =
  "before_work" | "during" | "before_concealment" | "after" | "before_package";
type EvidenceKindValue = "photo" | "measurement" | "document" | "checkbox";

interface RequirementOccurrenceView {
  occurrenceId: string;
  workAssignmentId: string;
  ruleVersionId: string;
  ordinal: number;
  stage: { stageId: string | null; stageKey: string; isConcealed: boolean | null };
  interventionType: "hold" | "witness" | "review";
  blockingScope: "none" | "blocks_stage_closure" | "blocks_package_inclusion" | "blocks_both";
  timing: RequirementTimingValue;
  evidenceKind: EvidenceKindValue;
  acceptanceCriterion: string;
  performerRole: string;
  approverRole: string;
  approverIsExternal: boolean;
  minEvidenceCount: number;
  maxEvidenceCount: number | null;
  allowedMedia: { mimeTypes: string[]; maxByteSize: number } | null;
  normRef: NormativeCitation | null;
  materialisedAt: string;
}

interface ListRequirementOccurrencesResponse {
  workAssignmentId: string;
  contractVersionId: string;
  occurrences: RequirementOccurrenceView[];
  coverage: "covered" | "no_bindings" | "no_matching_rule" | "work_type_unresolved";
}

// Pinned, same convention and same caveat as the other screens: this screen
// does not yet follow the device's own theme.
const THEME: ThemeName = "light";

const GENERIC_LOAD_ERROR =
  "Не вдалося завантажити перелік обов'язкових фіксацій. Спробуйте ще раз.";

/**
 * Thrown for any non-OK `/v1` response — same shape as `../lib/field/
 * load-assignments.ts`'s `ApiError`, kept local here because this screen's
 * fetch is one hop, not a two-hop orchestration with its own module to test.
 */
class ApiError extends Error {
  constructor(readonly status: number, readonly problem: Problem) { super("api"); }
}

async function fetchOccurrences(assignmentId: string): Promise<ListRequirementOccurrencesResponse> {
  const res = await apiGet(`/v1/assignments/${assignmentId}/requirement-occurrences`);
  if (!res.ok) throw new ApiError(res.status, await readProblem(res));
  return res.json() as Promise<ListRequirementOccurrencesResponse>;
}

type LoadState =
  | { status: "loading" }
  | { status: "redirecting" }
  | { status: "ready"; screen: ReturnType<typeof buildObligationScreen> }
  | { status: "error"; detail: string | null };

export function Assignment() {
  const router = useRouter();
  const { assignmentId } = useLocalSearchParams<{ assignmentId: string }>();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    // Object-form `Href`, not a template string — `expo-router`'s typed
    // routes (`.expo/types/router.d.ts`, generated by `expo start`/`expo
    // export`) type `/login`'s href as `{ pathname: "/login"; params?:
    // UnknownInputParams }`, not as an arbitrary string; a template literal
    // here only satisfies that union when it is itself a compile-time
    // literal, which `` `/a/${assignmentId}` `` is not. This is the
    // encoding-free equivalent of the old `` `/login?next=${encodeURIComponent(...)}` ``
    // string — expo-router serialises `params` into the query string itself,
    // and `../screens/login.tsx`'s own `useLocalSearchParams<{ next?:
    // string | string[] }>()` decodes it back the same way regardless of
    // which side did the encoding. https://docs.expo.dev/router/reference/typed-routes/
    // (read 2026-08-21) — object hrefs, not string concatenation, for any
    // route carrying params.
    const loginWithNext: Href = { pathname: "/login", params: { next: `/a/${assignmentId}` } };

    async function run() {
      const session = await requireSession();
      if (cancelled) return;
      if (!session) {
        setState({ status: "redirecting" });
        router.replace(loginWithNext);
        return;
      }

      try {
        const response = await fetchOccurrences(assignmentId);
        if (cancelled) return;
        setState({ status: "ready", screen: buildObligationScreen(response) });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setState({ status: "redirecting" });
          // Best-effort: the redirect below is what actually protects the
          // screen either way, so a signOut() failure (offline, already
          // signed out elsewhere) must not block it.
          void supabase.auth.signOut().catch(() => {});
          router.replace(loginWithNext);
          return;
        }
        // Surfaces the route's own Ukrainian `detail` rather than a second,
        // hand-written translation of the same refusal — same rule
        // `page.tsx`'s own `problemDetail` follows.
        const detail = err instanceof ApiError ? err.problem.detail ?? null : null;
        setState({ status: "error", detail });
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [router, assignmentId]);

  if (state.status !== "ready") {
    if (state.status === "error") {
      return <ErrorState detail={state.detail} />;
    }
    // "loading" and "redirecting" render nothing distinguishable — same call
    // `my-assignments.tsx` makes, for the same reason.
    return <View style={styles.page} />;
  }

  const screen = state.screen;

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          {/*
           * A real Pressable (not a bare Link), so the back-navigation
           * target still meets the 44px touch floor — the audience for this
           * screen is a foreman on a phone, often gloved, not a mouse user
           * for whom a small text link is enough. Same reasoning as
           * `page.tsx`'s own comment on the equivalent Button.
           */}
          <Link href="/" asChild>
            <Pressable style={styles.backLink} role="button">
              <Text style={styles.backLinkText}>← Мої доручення</Text>
            </Pressable>
          </Link>
          <Text role="heading" aria-level={1} style={styles.heading}>
            Обов&#39;язкові фіксації
          </Text>
        </View>

        {/*
         * THE COVERAGE MESSAGE — shown unconditionally, for every one of the
         * four `coverage` values, `covered` included. Three of the four are
         * refusals with a named remedy; an empty `items` list below must
         * never be read on its own as "nothing is required here" — this
         * sentence is what stops that misreading.
         */}
        <Text style={styles.body}>{screen.coverageMessage}</Text>

        {screen.items.length > 0 && (
          <View style={styles.list}>
            {screen.items.map((item, index) => (
              <ObligationCard
                key={item.occurrenceId} item={item} index={index} assignmentId={assignmentId}
              />
            ))}
          </View>
        )}

        {/*
         * THE ДОВІДКОВИЙ DISCLAIMER — MANDATORY, NEVER COLLAPSED
         * (hidden-works-content-rules.md §"Required disclaimers"). Plain
         * text, always visible: no accordion, no `numberOfLines` truncation,
         * no nested `ScrollView` that could clip it — it is the last child of
         * the SAME `ScrollView` everything above it scrolls inside, so
         * reaching the bottom of this screen always reaches it.
         * `screen.disclaimer` is `DOVIDKOVYI_DISCLAIMER_TEXT`
         * (`../lib/field/disclaimer.ts`), imported (not typed) inside
         * `buildObligationScreen` and proven byte-identical to it in
         * `obligations.test.ts` — this screen never composes the string
         * itself, so there is no second copy that could drift from the
         * source. Rendered for EVERY `coverage` value, including the three
         * refusals above (`screen.disclaimer` is assigned unconditionally,
         * not per branch).
         */}
        <Text style={styles.disclaimer}>{screen.disclaimer}</Text>
      </ScrollView>
    </View>
  );
}

function ObligationCard(
  { item, index, assignmentId }: { item: ObligationItem; index: number; assignmentId: string },
) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardEyebrow}>
        {index + 1}. {item.timingLabel}
      </Text>

      {/*
       * VERBATIM. The ДБН standard's own Ukrainian, copied at rule-version
       * publication (INV-073). No trim, no normalize, no smart-quote fix, no
       * truncation — `acceptanceCriterion` is rendered exactly as
       * `buildObligationScreen` returned it.
       */}
      <Text style={styles.cardBody}>{item.acceptanceCriterion}</Text>

      {item.normRef && (
        // Text, verification tag and source travel together — never the
        // text alone (INV-073's rendering half). A normative string with no
        // visible source is unrenderable per hidden-works-content-rules.md.
        // The tag renders as its Ukrainian LABEL, not the storage token
        // (TODOS 2026-08-27 residual 7): «за робочою документацією об'єкта»
        // is an origin a foreman can read; PROJECT_DOCUMENTATION is not.
        <View style={styles.normRefBox}>
          <Text style={styles.normRefText}>{item.normRef.text}</Text>
          <Text style={styles.normRefMeta}>
            {normRefVerificationLabel(item.normRef.verification)} · {item.normRef.source}
          </Text>
        </View>
      )}

      <View style={styles.kvList}>
        <KeyValueRow label="Вид доказу" value={item.evidenceKindLabel} />
        <KeyValueRow
          label="Кількість матеріалів"
          value={formatEvidenceCount(item.minEvidenceCount, item.maxEvidenceCount)}
        />
        {item.allowedMedia && (
          <KeyValueRow label="Формати файлів" value={item.allowedMedia.mimeTypes.join(", ")} />
        )}
      </View>

      {/*
       * ONLY FOR `photo` — mirrors `page.tsx`'s own gate exactly (see that
       * file's comment on why `document` is excluded despite also requiring
       * `allowedMedia`): ADR-007 decision 4 names the v0.1 client's second
       * obligation as «take the photo», one interaction, and no
       * document-capture flow is in scope. A RENDERED CONTROL IS NOT A
       * SATISFACTION CLAIM — `CaptureIsland`'s own copy is about the PHOTO's
       * upload state, never about the OBLIGATION being met.
       */}
      {item.evidenceKind === "photo" && (
        <CaptureIsland assignmentId={assignmentId} occurrenceId={item.occurrenceId} />
      )}
    </View>
  );
}

function KeyValueRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{value}</Text>
    </View>
  );
}

/**
 * "мінімум N" when `max === null` (no upper bound in the row — a nullable
 * column, not "unlimited" as a product decision); "N" when the range is a
 * single number; "N–M" otherwise. Not a decision `buildObligationScreen`
 * needs to make — the two numbers already arrive verbatim from the route —
 * only formatting of them for a caption.
 */
function formatEvidenceCount(min: number, max: number | null): string {
  if (max === null) return `мінімум ${min}`;
  if (min === max) return `${min}`;
  return `${min}–${max}`;
}

function ErrorState({ detail }: { detail: string | null }) {
  return (
    <View style={styles.page}>
      <View style={[styles.content, styles.centered]}>
        <Text role="heading" aria-level={1} style={styles.heading}>
          Обов&#39;язкові фіксації
        </Text>
        <Text style={styles.body}>{detail ?? GENERIC_LOAD_ERROR}</Text>
        <Link href="/" asChild>
          <Pressable style={styles.backToListButton} role="button">
            <Text style={styles.backToListButtonText}>До списку доручень</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: color[THEME]["bg-canvas"],
  },
  content: {
    flexGrow: 1,
    maxWidth: 512,
    width: "100%",
    alignSelf: "center",
    padding: 24,
    gap: 24,
  },
  centered: {
    justifyContent: "center",
  },
  header: {
    gap: 4,
  },
  backLink: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
  },
  backLinkText: {
    fontSize: 13,
    fontWeight: "500",
    color: color[THEME]["text-link"],
  },
  heading: {
    fontSize: 24,
    fontWeight: "600",
    color: color[THEME]["text-primary"],
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: color[THEME]["text-secondary"],
  },
  list: {
    gap: 16,
  },
  card: {
    gap: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: color[THEME]["border-default"],
    backgroundColor: color[THEME]["bg-surface"],
    padding: 16,
  },
  cardEyebrow: {
    fontSize: 12,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: color[THEME]["text-muted"],
  },
  cardBody: {
    fontSize: 15,
    lineHeight: 22,
    color: color[THEME]["text-primary"],
  },
  normRefBox: {
    gap: 4,
    borderRadius: 6,
    backgroundColor: color[THEME]["bg-muted"],
    padding: 12,
  },
  normRefText: {
    fontSize: 13,
    color: color[THEME]["text-secondary"],
  },
  normRefMeta: {
    fontSize: 12,
    color: color[THEME]["text-muted"],
  },
  kvList: {
    gap: 4,
  },
  kvRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  kvLabel: {
    fontSize: 13,
    color: color[THEME]["text-muted"],
  },
  kvValue: {
    flexShrink: 1,
    textAlign: "right",
    fontSize: 13,
    color: color[THEME]["text-secondary"],
  },
  disclaimer: {
    borderTopWidth: 1,
    borderTopColor: color[THEME]["border-subtle"],
    paddingTop: 16,
    fontSize: 13,
    color: color[THEME]["text-secondary"],
  },
  backToListButton: {
    alignSelf: "flex-start",
    minHeight: 44,
    minWidth: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: color[THEME]["border-default"],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  backToListButtonText: {
    fontSize: 15,
    fontWeight: "500",
    color: color[THEME]["text-primary"],
  },
});
