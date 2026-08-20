// «Мої доручення» — the screen a foreman lands on the instant he signs in.
// Copy, flow, and every decision this screen makes are PORTED from
// `apps/app/app/(app)/page.tsx` and its `src/lib/field/assignments.ts` — see
// that file's header for why the decisions (the two empty states, the
// all-projects-failed fallback, the `showProjectName` rule, the subtitle
// composition) live there and not here. What remains here is I/O and JSX,
// same split `page.tsx` itself settled on.
//
// THE ONE THING `page.tsx` DOES NOT HAVE TO DO THAT THIS SCREEN DOES: decide
// when to fetch at all. `page.tsx` is a React Server Component — it runs once
// per request, with the session already resolved into cookies before it ever
// executes. This screen runs on a mounted client, so it owns its own
// `requireSession()` gate and its own retry (`reloadToken`) the server
// component gets for free from a fresh request.
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { color, type ThemeName } from "@goproceed/tokens";

import { apiGet, readProblem, requireSession } from "../lib/api";
import { supabase } from "../lib/supabase";
import { ApiError, loadMyAssignments, type Fetcher } from "../lib/field/load-assignments";
import {
  buildMyAssignmentsScreen, failedProjectMessage, rowSubtitle,
  type MyAssignmentsScreen,
} from "../lib/field/assignments";

// Inlined from @goproceed/contracts (not a mobile app dependency) — same
// shape `./assignments.ts` and `./load-assignments.ts` each inline, kept in
// sync with them by hand. Only used here to type `FailedProjectsNotice`'s
// prop without an unsafe cast: `MyAssignmentsScreen["failedProjects"]` is
// structurally this shape, and TypeScript's structural typing accepts it
// with no `as` needed.
interface ProjectListRow {
  projectId: string;
  workspaceId: string;
  name: string;
  code: string | null;
}

// Pinned, same convention and same caveat as token-proof.tsx/login.tsx: this
// screen does not yet follow the device's own theme.
const THEME: ThemeName = "light";

const LOGIN_WITH_NEXT_ROOT = "/login?next=%2F";

/**
 * Adapts mobile's `apiGet` (returns a raw `Response`, never throws) to the
 * parsed-or-throw `Fetcher` shape `loadMyAssignments` is written against —
 * the same shape `apps/app`'s server-side `apiGet<T>` has natively. This is
 * the one real call site; `load-assignments.test.ts` injects its own fake
 * instead of this one, so that suite never touches `fetch` or Supabase.
 */
const fetchJson: Fetcher = async (path) => {
  const res = await apiGet(path);
  if (!res.ok) throw new ApiError(res.status, await readProblem(res));
  return res.json();
};

type LoadState =
  | { status: "loading" }
  | { status: "redirecting" }
  | { status: "ready"; screen: MyAssignmentsScreen };

export function MyAssignments() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  // Bumped by the "Оновити" retry button to force the effect below to run
  // again — a plain re-render would not, since its dependency array is
  // otherwise empty.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const session = await requireSession();
      if (cancelled) return;
      if (!session) {
        setState({ status: "redirecting" });
        router.replace(LOGIN_WITH_NEXT_ROOT);
        return;
      }

      const result = await loadMyAssignments(fetchJson);
      if (cancelled) return;

      if (result.kind === "session_expired") {
        setState({ status: "redirecting" });
        // Best-effort: the redirect below is what actually protects the
        // screen either way, so a signOut() failure (offline, already
        // signed out elsewhere) must not block it.
        void supabase.auth.signOut().catch(() => {});
        router.replace(LOGIN_WITH_NEXT_ROOT);
        return;
      }

      if (result.kind === "error") {
        setState({ status: "ready", screen: { kind: "error" } });
        return;
      }

      setState({
        status: "ready",
        screen: buildMyAssignmentsScreen(result.projects, result.byProject),
      });
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [router, reloadToken]);

  const handleRetry = useCallback(() => {
    setState({ status: "loading" });
    setReloadToken((t) => t + 1);
  }, []);

  if (state.status !== "ready") {
    // "loading" and "redirecting" render nothing distinguishable — the
    // redirect (or the eventual ready state) follows within one effect tick,
    // and a flash of "loading" text for either would be less honest than
    // nothing, not more.
    return <View style={styles.page} />;
  }

  const screen = state.screen;

  if (screen.kind === "error") {
    return <ErrorState onRetry={handleRetry} />;
  }

  if (screen.kind === "no_projects") {
    return <EmptyState message={screen.message} />;
  }

  const failedNotice = screen.failedProjects.length > 0
    ? <FailedProjectsNotice projects={screen.failedProjects} />
    : null;

  if (screen.kind === "empty") {
    return <EmptyState message={screen.message}>{failedNotice}</EmptyState>;
  }

  // No auto-redirect even with exactly one row: a surprise navigation the
  // instant a phone screen finishes loading is worse than one extra tap, and
  // it would also make this screen impossible to get back to — same call
  // `page.tsx` makes.
  return (
    <View style={styles.page}>
      <View style={styles.content}>
        <Text role="heading" aria-level={1} style={styles.heading}>Мої доручення</Text>
        {failedNotice}
        <View style={styles.list}>
          {screen.rows.map((row) => (
            <Link key={row.assignmentId} href={`/a/${row.assignmentId}`} asChild>
              <Pressable style={styles.row}>
                <Text style={styles.rowTitle}>{row.description}</Text>
                <Text style={styles.rowSubtitle}>
                  {rowSubtitle(row, screen.showProjectName)}
                </Text>
              </Pressable>
            </Link>
          ))}
        </View>
      </View>
    </View>
  );
}

function EmptyState({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <View style={styles.page}>
      <View style={[styles.content, styles.centered]}>
        <Text role="heading" aria-level={1} style={styles.heading}>Мої доручення</Text>
        <Text style={styles.body}>{message}</Text>
        {children}
      </View>
    </View>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.page}>
      <View style={[styles.content, styles.centered]}>
        <Text role="heading" aria-level={1} style={styles.heading}>Мої доручення</Text>
        <Text style={styles.body}>
          Не вдалося завантажити ваші доручення. Спробуйте ще раз.
        </Text>
        <Pressable
          testID="my-assignments-retry"
          role="button"
          onPress={onRetry}
          style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
        >
          <Text style={styles.retryButtonText}>Оновити</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * `role="alert"` because this is new information about a load failure, not a
 * static label — a screen reader should announce it, not require scanning
 * for it. The sentence itself is `failedProjectMessage`, in the tested
 * module, so the "named, not silently dropped" guarantee is asserted rather
 * than only described.
 */
function FailedProjectsNotice({ projects }: { projects: ProjectListRow[] }) {
  return (
    <View role="alert" style={styles.noticeList}>
      {projects.map((project) => (
        <View key={project.projectId} style={styles.notice}>
          <Text style={styles.noticeText}>{failedProjectMessage(project)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: color[THEME]["bg-canvas"],
  },
  content: {
    flex: 1,
    maxWidth: 512,
    width: "100%",
    alignSelf: "center",
    padding: 24,
    gap: 24,
  },
  centered: {
    justifyContent: "center",
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
    gap: 12,
  },
  row: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: color[THEME]["border-subtle"],
    backgroundColor: color[THEME]["bg-surface"],
    padding: 16,
    gap: 4,
    // THE ANCHOR IS THIS PRESSABLE, NOT ITS CHILDREN — `<Link asChild>`
    // merges Link's `href`/navigation behaviour straight onto this
    // component, and on web (no conflicting `role`, unlike the obligation
    // screen's back-link) that renders it AS the `<a>` element itself, not
    // a wrapper around one. Both of these were previously left to browser
    // defaults and it showed: no host stylesheet resets an anchor's UA
    // color/underline in this app (no equivalent of apps/app's
    // `globals.css`), so this element's OWN computed style was Chrome's
    // `-webkit-link` blue and no text-decoration override at all —
    // invisible only because `rowTitle`/`rowSubtitle` (below) each set
    // their own explicit `color` on the nested `Text` children, overriding
    // what a reader actually sees while leaving the anchor's own style
    // wrong underneath. Caught by qa/field-web.mjs's `measureUaStyledLinks`
    // (ported from apps/app/qa/field.mjs), which measures the anchor
    // element itself for exactly this reason. `text-primary`, not
    // `text-link`: this row is a card, not inline link text — the SAME
    // token `rowTitle` below already uses, so the anchor's own color
    // matches what a reader already sees rather than introducing a third
    // color into one row.
    color: color[THEME]["text-primary"],
    textDecorationLine: "none",
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: color[THEME]["text-primary"],
  },
  rowSubtitle: {
    fontSize: 13,
    color: color[THEME]["text-secondary"],
  },
  noticeList: {
    gap: 8,
  },
  notice: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: color[THEME]["status-attention-border"],
    backgroundColor: color[THEME]["status-attention-surface"],
    padding: 12,
  },
  noticeText: {
    fontSize: 13,
    color: color[THEME]["status-attention-fg"],
  },
  retryButton: {
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
  retryButtonPressed: {
    backgroundColor: color[THEME]["action-ghost-hover"],
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: "500",
    color: color[THEME]["text-primary"],
  },
});
