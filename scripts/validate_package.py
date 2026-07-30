#!/usr/bin/env python3
"""Fail-closed structural and cross-contract checks for the AktFlow spec package.

This validator proves internal specification consistency only. It deliberately does
not convert unvalidated external gates or missing runtime evidence into a pass.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
TECH = ROOT / "technical"
DOCS = ROOT / "docs"
FAILURES: list[str] = []
METRICS: dict[str, int] = {}
HTTP_METHODS = {"get", "post", "put", "patch", "delete"}


def require(condition: bool, message: str) -> None:
    if not condition:
        FAILURES.append(message)


def split_refs(raw: str) -> list[str]:
    return [value.strip() for value in (raw or "").split("|") if value.strip()]


def require_refs(
    source: str,
    values: Iterable[str],
    allowed: set[str],
    *,
    sentinels: set[str] | None = None,
) -> None:
    sentinels = sentinels or {"none"}
    missing = sorted({value for value in values if value not in allowed and value not in sentinels})
    require(not missing, f"{source}: unresolved references {missing}")


def read_csv_contract(filename: str, required_headers: set[str]) -> list[dict[str, str]]:
    path = TECH / filename
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        headers = reader.fieldnames or []
        rows = list(reader)
    require(required_headers <= set(headers), f"{filename}: missing headers {sorted(required_headers - set(headers))}")
    require(bool(rows), f"{filename}: no data rows")
    for line_no, row in enumerate(rows, start=2):
        require(None not in row and all(value is not None for value in row.values()), f"{filename}:{line_no}: inconsistent column count")
        require(all(key is not None and key.strip() for key in row), f"{filename}:{line_no}: blank header mapping")
    return rows


def require_unique(rows: list[dict[str, str]], filename: str, fields: tuple[str, ...]) -> None:
    keys = [tuple(row.get(field, "").strip() for field in fields) for row in rows]
    require(all(all(part for part in key) for key in keys), f"{filename}: blank key in {fields}")
    duplicates = sorted(key for key, count in Counter(keys).items() if count > 1)
    require(not duplicates, f"{filename}: duplicate keys {duplicates[:10]}")


def resolve_local_ref(document: dict[str, Any], ref: str) -> Any:
    if not ref.startswith("#/"):
        return None
    current: Any = document
    for token in ref[2:].split("/"):
        token = token.replace("~1", "/").replace("~0", "~")
        if not isinstance(current, dict) or token not in current:
            return None
        current = current[token]
    return current


def walk_json(value: Any) -> Iterable[Any]:
    yield value
    if isinstance(value, dict):
        for child in value.values():
            yield from walk_json(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_json(child)


# ---------------------------------------------------------------------------
# Artifact inventory and links
# ---------------------------------------------------------------------------

required_files = [
    ROOT / "README.md",
    ROOT / "Makefile",
    *(DOCS / f"{index:02d}-{name}.md" for index, name in [
        (0, "product-brief"),
        (1, "prd"),
        (3, "personas-jtbd-workflows"),
        (4, "screen-specification"),
        (5, "design-system"),
        (6, "data-model-permissions"),
        (7, "technical-architecture"),
        (8, "api-integrations"),
        (9, "security-compliance"),
        (10, "billing-pricing"),
        (11, "analytics-events"),
        (12, "roadmap-delivery"),
        (13, "qa-acceptance"),
        (14, "gtm-pilot"),
        (15, "risks-decisions"),
        (17, "production-readiness-index"),
        (18, "domain-state-machines"),
        (19, "organizations-roles-access"),
        (20, "flow-catalog"),
        (21, "plans-entitlements-billing"),
        (22, "data-api-contract"),
        (23, "offline-media-protocol"),
        (24, "legal-regulatory-gates"),
        (25, "security-threat-model"),
        (26, "sre-operations"),
        (27, "qa-traceability"),
        (28, "pilot-ga-delivery"),
        (30, "validation-evidence-register"),
        (31, "architecture-decisions"),
        (32, "customer-country-adapters"),
        (33, "support-admin-plane"),
        (34, "production-gate-checklist"),
        (35, "data-access-tenancy"),
        (36, "security-verification-profile"),
    ]),
    *(TECH / filename for filename in [
        "schema.sql",
        "openapi.yaml",
        "permissions.csv",
        "events.csv",
        "state-catalog.csv",
        "state-transitions.csv",
        "terminology.csv",
        "entitlements.csv",
        "error-catalog.csv",
        "data-access-surface.csv",
        "data-retention-catalog.csv",
        "traceability.csv",
        "test-catalog.csv",
        "asvs-profile.csv",
        "mobile-security-profile.csv",
        "ui-actions.csv",
        "entity-aliases.csv",
        "command-availability.csv",
        "rate-limits.csv",
        "copy-catalog.csv",
    ]),
    ROOT / "prototype" / "src" / "App.jsx",
    ROOT / "prototype" / "src" / "pages" / "Rules.jsx",
    ROOT / "prototype" / "src" / "pages" / "Evidence.jsx",
    ROOT / "prototype" / "src" / "pages" / "BaselineControls.jsx",
    ROOT / "prototype" / "src" / "pages" / "Assignments.jsx",
    ROOT / "prototype" / "src" / "pages" / "Occurrence.jsx",
    ROOT / "prototype" / "qa" / "verify.mjs",
    ROOT / "prototype" / "qa-results.json",
    ROOT / "prototype" / "package-lock.json",
    *(ROOT / "design-references" / filename for filename in [
        "landing-concept.png",
        "dashboard-concept.png",
        "onboarding-concept.png",
        "mobile-field-concept.png",
    ]),
]
for path in required_files:
    require(path.exists(), f"missing required artifact: {path.relative_to(ROOT)}")

# Numbered documentation contract.
#
# The upper bound is DERIVED from what is on disk, not hard-coded: docs/NN-*.md
# must form one contiguous sequence starting at 00 and ending at the highest
# index present. Adding doc N+1 is therefore a normal, non-breaking act. The
# previous form asserted `== list(range(40))`, which turned every new document
# into a build break (docs/40-* did exactly that).
#
# Still fail-closed on: a missing index, a duplicate index, a malformed numeric
# prefix, or a sequence that does not start at 00.
numbered_docs: dict[int, list[str]] = defaultdict(list)
malformed_docs: list[str] = []
for path in sorted(DOCS.glob("*.md")):
    prefix = re.match(r"(\d+)(?=-)", path.name)
    if prefix is None:
        continue  # unnumbered docs/*.md are outside this contract, as before
    if len(prefix.group(1)) != 2:
        malformed_docs.append(path.name)
        continue
    numbered_docs[int(prefix.group(1))].append(path.name)

require(
    not malformed_docs,
    "docs: numbered documents need a two-digit prefix; malformed: "
    + ", ".join(sorted(malformed_docs)),
)
require(bool(numbered_docs), "docs: expected at least one numbered document (docs/NN-*.md)")

duplicate_docs = sorted(
    f"{index:02d} -> {', '.join(sorted(names))}"
    for index, names in numbered_docs.items()
    if len(names) > 1
)
require(not duplicate_docs, "docs: duplicate numbered indices: " + "; ".join(duplicate_docs))

# Archived per the user-approved cleanup (migration/goproceed-canonical-v0.1/
# document-disposition.csv): these indices moved to docs/legacy/ and are no
# longer part of the active numbered contract.
ARCHIVED_DOC_INDICES = {2, 16, 29, 37, 38, 39}

if numbered_docs:
    highest_doc = max(numbered_docs)
    missing_docs = [
        f"{index:02d}"
        for index in range(highest_doc + 1)
        if index not in numbered_docs and index not in ARCHIVED_DOC_INDICES
    ]
    require(
        not missing_docs,
        f"docs: expected one contiguous document for every index 00..{highest_doc:02d}; "
        f"missing: {', '.join(missing_docs)}",
    )

doc_numbers = sorted(numbered_docs)

link_pattern = re.compile(r"(?<!!)\[[^\]]+\]\(([^)]+)\)")
markdown_files = [ROOT / "README.md", *sorted(DOCS.glob("*.md")), ROOT / "prototype" / "README.md"]
for markdown in markdown_files:
    if not markdown.exists():
        continue
    text = markdown.read_text(encoding="utf-8")
    for raw_target in link_pattern.findall(text):
        target = raw_target.strip().split()[0].strip("<>")
        if target.startswith(("http://", "https://", "mailto:", "#", "sandbox:")):
            continue
        local_part = target.split("#", 1)[0]
        if local_part:
            resolved = (markdown.parent / local_part).resolve()
            require(resolved.exists(), f"broken link in {markdown.relative_to(ROOT)}: {target}")

prd_text = (DOCS / "01-prd.md").read_text(encoding="utf-8")
access_doc_text = (DOCS / "19-organizations-roles-access.md").read_text(encoding="utf-8")
api_contract_text = (DOCS / "22-data-api-contract.md").read_text(encoding="utf-8")
architecture_text = (DOCS / "07-technical-architecture.md").read_text(encoding="utf-8")
roadmap_text = (DOCS / "12-roadmap-delivery.md").read_text(encoding="utf-8")
delivery_text = (DOCS / "28-pilot-ga-delivery.md").read_text(encoding="utf-8")
state_machine_text = (DOCS / "18-domain-state-machines.md").read_text(encoding="utf-8")
require("MFA обязательно для каждого пользователя с live Pilot data" in prd_text, "docs/01: universal live-Pilot MFA boundary drifted")
require("Project archive is immutable and terminal" in prd_text and "There is no in-place restore" in prd_text, "docs/01: project archive/continuation contract drifted")
require("Evidence has no generic delete action" in prd_text and "soft-deleted" not in prd_text, "docs/01: evidence must use immutable invalidation/correction, not an unspecified soft delete")
require("GA-forward assignment grouping only" in access_doc_text, "docs/19: team/crew must remain explicitly GA-forward until modelled")
require("Tenant bearer tokens and tenant permissions never authorize these operations" in api_contract_text, "docs/22: platform billing authority separation missing")
require("Next.js **16.2.11 or newer security-patched 16.2.x**" in architecture_text, "docs/07: current Next.js security-patched floor missing")
require("Safe first live Pilot (months 5–9)" in roadmap_text and "Safe standalone GA (months 10–18+)" in roadmap_text, "docs/12: solo delivery stages drifted back to the optimistic schedule")
require("safe first live Pilot: 6–9 months solo" in delivery_text and "safe standalone GA: 12–18+ months solo" in delivery_text, "docs/28: honest solo planning range missing")
for money_algorithm_marker in ("PostgreSQL `SERIALIZABLE`", "SELECT ... FOR UPDATE", "ascending UUID order", "Direct multi-step BFF writes are forbidden"):
    require(money_algorithm_marker in state_machine_text, f"docs/18: money concurrency algorithm missing {money_algorithm_marker}")


# ---------------------------------------------------------------------------
# Machine-readable registries
# ---------------------------------------------------------------------------

contracts = {
    "permissions.csv": {"resource", "action", "owner", "external_reviewer", "scope_or_condition"},
    "events.csv": {"event_name", "version", "trigger", "required_properties", "pii_policy", "primary_metric"},
    "state-catalog.csv": {"domain", "state", "storage_scope", "release", "terminal", "ui_uk", "definition"},
    "state-transitions.csv": {"domain", "from_state", "command", "to_state", "actor", "guards", "side_effects", "reversal", "error_code"},
    "terminology.csv": {"term_key", "ui_uk", "definition", "never_means"},
    "entitlements.csv": {"feature_key", "meter", "unit", "pilot", "start", "control", "portfolio", "limit_behavior", "existing_data_behavior"},
    "error-catalog.csv": {"code", "http_status", "retryable", "user_action", "log_policy", "producer", "ui_surface"},
    "data-access-surface.csv": {"surface_id", "object_type", "schema", "object_name", "release", "consumer", "db_role", "privileges", "access_path", "rls_policy_family", "client_exposed", "status", "notes"},
    "data-retention-catalog.csv": {"object_name", "release", "retention_class_source", "allowed_classes", "personal_data", "legal_hold_behavior", "deletion_strategy", "policy_status", "external_gate", "notes"},
    "traceability.csv": {"requirement_id", "release", "priority", "flow_id", "primary_screens", "transition_domains", "permission_resources", "operation_ids", "data_entities", "audit_events", "test_ids", "external_gates", "rollout_flag", "owner"},
    "test-catalog.csv": {"test_id", "release", "layer", "priority", "title", "preconditions", "procedure", "expected", "evidence", "automation", "blocker", "owner"},
    "asvs-profile.csv": {"profile_item", "standard_ref", "required_level", "release", "applicability", "aktflow_control", "evidence", "test_ids", "status", "waiver_policy"},
    "mobile-security-profile.csv": {"profile_item", "standard_ref", "release", "scope", "aktflow_requirement", "verification", "test_ids", "status", "gate"},
    "rate-limits.csv": {"surface", "dimension", "limit", "window", "burst", "lock_or_backoff", "notes"},
    "copy-catalog.csv": {"key", "ui_uk", "screen", "state", "context"},
    "ui-actions.csv": {"action_id", "screen_id", "action_key", "release", "operation_id", "permission_resource", "transition_domain", "audit_event", "test_ids", "state_consequence"},
    "entity-aliases.csv": {"documented_name", "canonical_target", "release", "status", "implementation_boundary"},
    "command-availability.csv": {"rule_id", "priority", "command_class", "organization_states", "subscription_states", "project_states", "contract_states", "work_phase", "decision", "lease_effect", "test_ids", "notes"},
}
csv_rows = {filename: read_csv_contract(filename, headers) for filename, headers in contracts.items()}

for filename, fields in {
    "permissions.csv": ("resource", "action"),
    "events.csv": ("event_name",),
    "state-catalog.csv": ("domain", "state"),
    "state-transitions.csv": ("domain", "from_state", "command", "to_state"),
    "terminology.csv": ("term_key",),
    "entitlements.csv": ("feature_key",),
    "error-catalog.csv": ("code",),
    "data-access-surface.csv": ("surface_id",),
    "data-retention-catalog.csv": ("object_name",),
    "traceability.csv": ("requirement_id",),
    "test-catalog.csv": ("test_id",),
    "asvs-profile.csv": ("profile_item",),
    "mobile-security-profile.csv": ("profile_item",),
    "ui-actions.csv": ("action_id",),
    "entity-aliases.csv": ("documented_name",),
    "command-availability.csv": ("rule_id",),
}.items():
    require_unique(csv_rows[filename], filename, fields)

states = {(row["domain"], row["state"]) for row in csv_rows["state-catalog.csv"]}
state_domains = {domain for domain, _ in states}
catalog_by_domain: dict[str, set[str]] = defaultdict(set)
for domain, state in states:
    catalog_by_domain[domain].add(state)
errors = {row["code"] for row in csv_rows["error-catalog.csv"]}
tests = {row["test_id"] for row in csv_rows["test-catalog.csv"]}
events = {row["event_name"] for row in csv_rows["events.csv"]}
permission_resources = {row["resource"] for row in csv_rows["permissions.csv"]}
require({"saas_subscription", "platform_saas_billing"} <= permission_resources, "permissions.csv: tenant subscription and platform billing authorities must remain separate")
platform_permission = next((row for row in csv_rows["permissions.csv"] if row["resource"] == "platform_saas_billing" and row["action"] == "manage"), {})
require(
    bool(platform_permission)
    and all(platform_permission.get(role) == "no" for role in list(csv_rows["permissions.csv"][0])[2:-1])
    and "platform_billing" in platform_permission.get("scope_or_condition", ""),
    "permissions.csv: no tenant role may obtain platform SaaS billing mutation authority",
)
permissions_text = (TECH / "permissions.csv").read_text(encoding="utf-8")
require("assigned_team" not in permissions_text, "permissions.csv: narrow Pilot must not depend on an unmodelled assigned_team aggregate")
require(not any(row["resource"] == "evidence" and row["action"] in {"delete", "soft_delete"} for row in csv_rows["permissions.csv"]), "permissions.csv: evidence has no generic delete authority")

# A distinct tenant role must have a distinct permission vector. Identical vectors
# create untestable provisioning/UI semantics and should be merged explicitly.
permission_headers = list(csv_rows["permissions.csv"][0]) if csv_rows["permissions.csv"] else []
permission_roles = permission_headers[2:-1]
for left_index, left_role in enumerate(permission_roles):
    for right_role in permission_roles[left_index + 1:]:
        left_vector = [row[left_role] for row in csv_rows["permissions.csv"]]
        right_vector = [row[right_role] for row in csv_rows["permissions.csv"]]
        require(
            left_vector != right_vector,
            f"permissions.csv: roles {left_role} and {right_role} have identical permission vectors; merge or define the distinction",
        )

for row in csv_rows["state-catalog.csv"]:
    require(row["storage_scope"] in {"server", "device", "projection"}, f"state-catalog.csv: invalid storage scope for {row['domain']}.{row['state']}")
    require(row["release"] in {"Pilot", "GA"}, f"state-catalog.csv: invalid release for {row['domain']}.{row['state']}")
    require(row["terminal"] in {"true", "false"}, f"state-catalog.csv: terminal must be boolean for {row['domain']}.{row['state']}")

for row in csv_rows["state-transitions.csv"]:
    require((row["domain"], row["from_state"]) in states, f"state-transitions.csv: unknown from-state {row['domain']}.{row['from_state']}")
    require((row["domain"], row["to_state"]) in states, f"state-transitions.csv: unknown to-state {row['domain']}.{row['to_state']}")
    require(row["error_code"] in errors, f"state-transitions.csv: unknown error {row['error_code']}")

outgoing_state_keys = {
    (row["domain"], row["from_state"])
    for row in csv_rows["state-transitions.csv"]
}
for row in csv_rows["state-catalog.csv"]:
    if row["storage_scope"] not in {"server", "device"}:
        continue
    key = (row["domain"], row["state"])
    if row["terminal"] == "true":
        require(key not in outgoing_state_keys, f"state-catalog.csv: terminal state {row['domain']}.{row['state']} has an outgoing transition")
    else:
        require(key in outgoing_state_keys, f"state-catalog.csv: nonterminal state {row['domain']}.{row['state']} has no recovery/forward transition")

# Reachability is checked from an explicit initial-state registry rather than
# accepting any disconnected state that happens to have an outgoing edge.
declared_initial_states = {
    "organization": "trial",
    "invitation": "draft",
    "membership": "invited",
    "ownership_transfer": "requested",
    "project": "draft",
    "contract": "draft",
    "contract_version": "draft",
    "import_job": "queued",
    "import_row": "valid",
    "upload_intent": "authorized",
    "rule_version": "draft",
    "evidence_request": "open",
    "mobile_capture": "local_draft",
    "capture_session": "server_received",
    "variation": "draft",
    "period": "open",
    "package": "draft_snapshot",
    "external_share": "created",
    "acceptance": "pending",
    "receivable": "draft",
    "subscription": "pilot",
    "saas_invoice": "draft",
    "job": "queued",
    "notification_delivery": "queued",
    "integration": "active",
    "webhook_delivery": "queued",
    "export_job": "requested",
    "requirement_waiver": "active",
    "period_close_cycle": "preflight",
    "member_offboarding_plan": "draft",
    "package_decision_issue": "open",
    "numbering_series": "active",
    "deletion_job": "requested",
    "support_grant": "requested",
    "contract_terms": "draft",
    "work_assignment": "planned",
    "requirement_occurrence": "required",
    "reference_document": "draft",
    "typed_evidence": "received",
    "review_task": "open",
    "package_decision_item": "pending",
    "package_decision_set": "pending_reconciliation",
}
# These states are independently materialized roots, not transitions from the
# primary initial state. Keeping the list explicit prevents reachability checks
# from being weakened by inferred "anything without an incoming edge" logic.
declared_derived_roots = {
    "import_row": {"warning", "error", "ignored", "duplicate"},
    "subscription": {"trialing"},
}
stateful_domains = {
    row["domain"]
    for row in csv_rows["state-catalog.csv"]
    if row["storage_scope"] in {"server", "device"}
}
require(set(declared_initial_states) == stateful_domains, "state-catalog.csv: explicit initial-state registry is incomplete or stale")
transition_graph: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
commands_by_domain: dict[str, set[str]] = defaultdict(set)
for row in csv_rows["state-transitions.csv"]:
    transition_graph[row["domain"]][row["from_state"]].add(row["to_state"])
    commands_by_domain[row["domain"]].add(row["command"])
for domain, initial in declared_initial_states.items():
    require((domain, initial) in states, f"state-catalog.csv: declared initial state {domain}.{initial} is missing")
    reachable: set[str] = set()
    pending = [initial, *declared_derived_roots.get(domain, set())]
    while pending:
        current = pending.pop()
        if current in reachable:
            continue
        reachable.add(current)
        pending.extend(transition_graph[domain].get(current, set()) - reachable)
    require(
        reachable == catalog_by_domain[domain],
        f"state-transitions.csv: unreachable states in {domain}: {sorted(catalog_by_domain[domain] - reachable)}",
    )

for row in csv_rows["state-transitions.csv"]:
    reversal = row["reversal"]
    require(
        reversal in commands_by_domain[row["domain"]]
        or reversal == "none"
        or reversal.startswith(("new_", "create_")),
        f"state-transitions.csv: {row['domain']}.{row['command']} reversal {reversal} is neither a domain command nor explicit new aggregate/version",
    )

# A recovery label must be executable where it is claimed: a reversal command
# has to exist as an outgoing command of the transition's resulting state, not
# merely somewhere in the domain. Otherwise recovery documentation lies.
outgoing_commands: dict[tuple[str, str], set[str]] = defaultdict(set)
for row in csv_rows["state-transitions.csv"]:
    outgoing_commands[(row["domain"], row["from_state"])].add(row["command"])
for row in csv_rows["state-transitions.csv"]:
    reversal = row["reversal"]
    if reversal == "none" or reversal.startswith(("new_", "create_")):
        continue
    require(
        reversal in outgoing_commands[(row["domain"], row["to_state"])],
        f"state-transitions.csv: {row['domain']}.{row['from_state']}.{row['command']} reversal {reversal} is not executable from resulting state {row['to_state']}",
    )

# Terminal semantics and co-reachability. Forward reachability alone cannot see
# a lifecycle that traps a tenant in a non-terminal state (e.g. a suspended
# organization that can never be closed). Every non-terminal state of a domain
# that declares terminal states must retain a path to at least one terminal
# state, and terminal states must have no outgoing transitions at all.
terminal_state_keys = {
    (row["domain"], row["state"])
    for row in csv_rows["state-catalog.csv"]
    if row["terminal"] == "true"
}
for domain in declared_initial_states:
    domain_terminals = {state for state in catalog_by_domain[domain] if (domain, state) in terminal_state_keys}
    for state in catalog_by_domain[domain]:
        if (domain, state) in terminal_state_keys:
            require(
                not transition_graph[domain].get(state),
                f"state-transitions.csv: terminal state {domain}.{state} must not have outgoing transitions",
            )
            continue
        if not domain_terminals:
            continue  # cyclical-by-design domains (e.g. period) end through their parent lifecycle
        visited = {state}
        frontier = [state]
        reaches_terminal = False
        while frontier and not reaches_terminal:
            current = frontier.pop()
            for next_state in transition_graph[domain].get(current, set()):
                if next_state in domain_terminals:
                    reaches_terminal = True
                    break
                if next_state not in visited:
                    visited.add(next_state)
                    frontier.append(next_state)
        require(
            reaches_terminal,
            f"state-transitions.csv: non-terminal state {domain}.{state} has no path to any terminal state",
        )

project_archived = next((row for row in csv_rows["state-catalog.csv"] if row["domain"] == "project" and row["state"] == "archived"), {})
project_archive_transition = next((row for row in csv_rows["state-transitions.csv"] if row["domain"] == "project" and row["to_state"] == "archived"), {})
require(project_archived.get("terminal") == "true", "state-catalog.csv: project.archived must remain terminal")
require(not any(row["domain"] == "project" and row["from_state"] == "archived" for row in csv_rows["state-transitions.csv"]), "state-transitions.csv: archived project cannot be restored in place")
require(project_archive_transition.get("reversal") == "create_linked_project", "state-transitions.csv: archived project continuation must create a linked project")
require(
    not any(row["domain"] == "package" and row["from_state"] == "submitted" and row["command"] == "return" and row["to_state"] == "returned" for row in csv_rows["state-transitions.csv"]),
    "state-transitions.csv: package return must pass through pending line reconciliation",
)
require(
    {(row["from_state"], row["command"], row["to_state"]) for row in csv_rows["state-transitions.csv"] if row["domain"] == "package_decision_item"}
    >= {
        ("pending", "finalize_accepted", "accepted"),
        ("pending", "finalize_returned", "returned"),
        ("pending", "finalize_modified", "modified"),
    },
    "state-transitions.csv: pending package-line decisions lack explicit finalization transitions",
)
require(
    not any(row["domain"] == "work_item" for row in csv_rows["state-transitions.csv"])
    and {row["storage_scope"] for row in csv_rows["state-catalog.csv"] if row["domain"] == "work_item"} == {"projection"},
    "state registries: WorkItem is a derived projection; mutable execution commands belong only to WorkAssignment",
)
transition_by_key = {
    (row["domain"], row["from_state"], row["command"]): row
    for row in csv_rows["state-transitions.csv"]
}
for transition_key in {
    ("organization", "active", "suspend"),
    ("organization", "active", "begin_closing"),
    ("project", "active", "pause"),
    ("project", "active", "complete"),
    ("project", "completed", "archive"),
    ("contract", "active", "complete"),
    ("contract", "active", "terminate"),
    ("subscription", "active", "enter_grace"),
    ("subscription", "grace", "suspend"),
    ("subscription", "active", "cancel"),
    ("subscription", "pilot", "cancel"),
    ("work_assignment", "in_progress", "submit"),
    ("work_assignment", "submitted", "return"),
    ("work_assignment", "submitted", "complete"),
    ("work_assignment", "in_progress", "cancel"),
    ("work_assignment", "returned", "reassign"),
    ("work_assignment", "returned", "cancel"),
}:
    transition = transition_by_key.get(transition_key, {})
    require(
        "lease" in transition.get("side_effects", ""),
        f"state-transitions.csv: authorization-affecting transition {transition_key} must invalidate leases in its commit",
    )
for transition_key in {
    ("period", "closed", "reopen"),
    ("period_close_cycle", "committed", "reopen"),
}:
    guard = transition_by_key.get(transition_key, {}).get("guards", "")
    require(
        all(token in guard for token in ("no_submission", "no_external_decision", "no_acceptance", "no_receivable", "no_payment")),
        f"state-transitions.csv: {transition_key} must block every downstream commercial dependency",
    )
numbering_retire_guard = transition_by_key.get(
    ("numbering_series", "active", "retire"), {}
).get("guards", "")
require(
    "no_active_terms_reference" in numbering_retire_guard
    and "no_active_reservation" in numbering_retire_guard
    and "series_used" not in numbering_retire_guard,
    "state-transitions.csv: numbering retirement must handle unused/used unreferenced series without reusing history",
)

for row in csv_rows["error-catalog.csv"]:
    try:
        status = int(row["http_status"])
    except ValueError:
        status = 0
    require(400 <= status <= 599, f"error-catalog.csv: invalid HTTP status for {row['code']}")
    require(row["retryable"] in {"true", "false"}, f"error-catalog.csv: retryable must be boolean for {row['code']}")
    # Every stable code names its producer (pipeline stage, guard, command policy,
    # transition family or operation) — an error code no path can raise is untestable.
    require(bool(row.get("producer", "").strip()), f"error-catalog.csv: {row['code']} has no producer binding")

require(len(csv_rows["test-catalog.csv"]) >= 75, "test-catalog.csv: expected at least 75 executable test contracts")
for row in csv_rows["test-catalog.csv"]:
    require(re.fullmatch(r"T-[A-Z0-9]+(?:-[A-Z0-9]+)+", row["test_id"]) is not None, f"test-catalog.csv: invalid ID {row['test_id']}")
    require(row["priority"] in {"P0", "P1"}, f"test-catalog.csv: invalid priority for {row['test_id']}")
    require(row["release"] in {"Pilot", "GA", "Pilot-GA"}, f"test-catalog.csv: invalid release for {row['test_id']}")
    for field in ("preconditions", "procedure", "expected", "evidence", "automation", "blocker", "owner"):
        require(bool(row[field].strip()), f"test-catalog.csv: {row['test_id']} has blank {field}")
api_contract_test = next((row for row in csv_rows["test-catalog.csv"] if row["test_id"] == "T-API-001"), {})
require(
    "OpenAPI v2.9" in api_contract_test.get("preconditions", ""),
    "test-catalog.csv: T-API-001 package-owned version label must be v2.9",
)

command_rows = csv_rows["command-availability.csv"]
command_classes = {
    "read_scoped", "export", "payment_recovery", "support_security_recovery",
    "member_security_change", "process_already_received", "review_existing",
    "first_seen_offline_capture", "new_field_execution", "normal_project_mutation",
    "period_close_package", "commercial_correction",
    "organization_settings_mutation", "period_reopen", "archive_or_complete",
}
require(
    {row["command_class"] for row in command_rows} == command_classes | {"all_commands"},
    "command-availability.csv: command-class inventory is incomplete or stale",
)
selector_keys: set[tuple[str, ...]] = set()
for row in command_rows:
    ref = f"command-availability.csv:{row['rule_id']}"
    require(re.fullmatch(r"CA-[0-9]{3}", row["rule_id"]) is not None, f"{ref}: invalid rule ID")
    try:
        priority = int(row["priority"])
    except ValueError:
        priority = -1
    require(0 <= priority <= 999, f"{ref}: priority must be 0..999")
    require(row["decision"] in {"allow", "deny", "quarantine"}, f"{ref}: invalid decision")
    require(bool(row["lease_effect"].strip()) and bool(row["notes"].strip()), f"{ref}: lease effect and notes are required")
    for field, domain in (
        ("organization_states", "organization"),
        ("subscription_states", "subscription"),
        ("project_states", "project"),
        ("contract_states", "contract"),
    ):
        values = set(split_refs(row[field]))
        require(
            values == {"*"} or values <= catalog_by_domain[domain],
            f"{ref}: {field} has unknown states {sorted(values - catalog_by_domain[domain])}",
        )
    require_refs(ref + " tests", split_refs(row["test_ids"]), tests, sentinels=set())
    selector = tuple(row[field] for field in (
        "priority", "command_class", "organization_states", "subscription_states",
        "project_states", "contract_states", "work_phase",
    ))
    require(selector not in selector_keys, f"{ref}: duplicate decision selector")
    selector_keys.add(selector)
for command_class in command_classes:
    catchalls = [
        row for row in command_rows
        if row["command_class"] == command_class
        and all(row[field] == "*" for field in ("organization_states", "subscription_states", "project_states", "contract_states", "work_phase"))
    ]
    require(
        len(catchalls) == 1 and catchalls[0]["decision"] == "deny" and int(catchalls[0]["priority"]) >= 900,
        f"command-availability.csv: {command_class} needs one terminal default-deny rule",
    )

for profile_name in ("asvs-profile.csv", "mobile-security-profile.csv"):
    for row in csv_rows[profile_name]:
        require_refs(f"{profile_name}:{row['profile_item']}", split_refs(row["test_ids"]), tests)

entitlements_by_feature = {row["feature_key"]: row for row in csv_rows["entitlements.csv"]}
for ga_only_feature in ("variations", "external_review"):
    feature = entitlements_by_feature.get(ga_only_feature, {})
    require(feature.get("pilot") == "no", f"entitlements.csv: narrow Pilot must not grant GA-only {ga_only_feature}")
    require(feature.get("control") == "yes" and feature.get("portfolio") == "yes", f"entitlements.csv: GA plan grants missing for {ga_only_feature}")


# ---------------------------------------------------------------------------
# OpenAPI: completeness, errors, references, releases and flow ownership
# ---------------------------------------------------------------------------

openapi_path = TECH / "openapi.yaml"

def reject_duplicate_json_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


try:
    openapi = json.loads(
        openapi_path.read_text(encoding="utf-8"),
        object_pairs_hook=reject_duplicate_json_keys,
    )
except Exception as exc:  # pragma: no cover - diagnostic path
    openapi = {}
    FAILURES.append(f"openapi.yaml must remain JSON-compatible OpenAPI YAML: {exc}")

require(str(openapi.get("openapi", "")).startswith("3.1"), "openapi.yaml: OpenAPI 3.1 declaration required")
require(openapi.get("info", {}).get("version") == "2.9.0-spec", "openapi.yaml: canonical specification version must be 2.9.0-spec")
# Independent redocly lint evidence retired with the generated report
# (user-approved cleanup; see document-disposition.csv).

require(bool(openapi.get("security")), "openapi.yaml: global authenticated security requirement missing")
require(
    openapi.get("components", {}).get("securitySchemes", {}).get("platformBillingAuth", {}).get("type") == "http",
    "openapi.yaml: dedicated platformBillingAuth security scheme missing",
)
require(
    openapi.get("x-string-policy") == {
        "normalization": "NFC",
        "boundaryWhitespace": "reject",
        "requiredText": "non-empty-after-unicode-whitespace-check",
        "controlCharacters": "reject-unless-explicitly-multiline",
        "identifierCase": "case-sensitive-unless-schema-declares-normalized-field",
    },
    "openapi.yaml: canonical Unicode/string boundary policy missing or changed",
)
require(
    openapi.get("x-idempotency-policy") == {
        "standard_30d": {
            "ttlSeconds": 2592000,
            "scope": "authenticated actor + organization + operationId + Idempotency-Key",
        },
        "ledger_400d": {
            "ttlSeconds": 34560000,
            "scope": "organization + operationId + Idempotency-Key; durable clientOperationId remains authoritative after HTTP TTL",
        },
        "replayBehavior": "Same request hash returns the stored status/body until replayUntil; a different hash returns IDEMPOTENCY_CONFLICT; after expiry the command must still enforce domain uniqueness and durable ledger identity.",
    },
    "openapi.yaml: exact idempotency classes/TTLs or replay behavior changed",
)
require(
    openapi.get("x-canonical-registries") == {
        "states": "technical/state-catalog.csv",
        "errors": "technical/error-catalog.csv",
        "transitions": "technical/state-transitions.csv",
        "access": "technical/data-access-surface.csv",
        "retention": "technical/data-retention-catalog.csv",
        "uiActions": "technical/ui-actions.csv",
        "entityAliases": "technical/entity-aliases.csv",
        "commandAvailability": "technical/command-availability.csv",
    },
    "openapi.yaml: canonical registry pointers changed or are incomplete",
)

for node in walk_json(openapi):
    if isinstance(node, dict) and isinstance(node.get("$ref"), str) and node["$ref"].startswith("#/"):
        require(resolve_local_ref(openapi, node["$ref"]) is not None, f"openapi.yaml: unresolved ref {node['$ref']}")
    if isinstance(node, dict) and node.get("type") == "array":
        require(
            isinstance(node.get("maxItems"), int) and node["maxItems"] >= 0,
            "openapi.yaml: every inline and component array must declare a finite non-negative maxItems",
        )

flow_doc = (DOCS / "20-flow-catalog.md").read_text(encoding="utf-8")
flow_ids = set(re.findall(r"^##\s+\d+\.\s+(F\d{2})\b", flow_doc, re.MULTILINE))
screen_doc = (DOCS / "04-screen-specification.md").read_text(encoding="utf-8")
screen_ids = set(re.findall(r"^###\s+(S\d{2})\b", screen_doc, re.MULTILINE))
require(flow_ids == {f"F{index:02d}" for index in range(1, 23)}, "flow catalog must define exactly F01..F22")
require(screen_ids == {f"S{index:02d}" for index in range(1, 43)}, "screen specification must define exactly S01..S42")

operations: dict[str, tuple[str, str, dict[str, Any]]] = {}
release_counts: Counter[str] = Counter()
tag_names = {tag["name"] for tag in openapi.get("tags", []) if isinstance(tag, dict) and tag.get("name")}
parameters = openapi.get("components", {}).get("parameters", {})
platform_billing_operations = {"issueSaasInvoice", "recordSaasPayment", "transitionSaasInvoice", "reverseSaasPayment"}
public_or_capability_operations = {"submitPilotLead", "openExternalReviewSession", "createExternalDecision"}
tenant_context_exceptions = public_or_capability_operations | {"createOrganization", "acceptInvitation"}
etag_mutation_operations = {
    "updateOrganization", "updateMembership", "updateProject",
    "updateNotificationPreferences",
}
etag_header_operations = etag_mutation_operations | {
    "createOrganization", "getOrganization", "createProject", "getProject",
    "createWorkItem", "getNotificationPreferences", "transitionMembership",
}
durable_ledger_operations = {
    "recordAcceptance", "createReceivable", "transitionReceivable", "adjustReceivable",
    "releaseRetention", "recordPayment", "reversePayment", "createPaymentReconciliationImport",
    "issueSaasInvoice", "recordSaasPayment", "transitionSaasInvoice", "reverseSaasPayment",
    "reassignWorkAssignment", "acknowledgeAssignmentReference", "reassignReviewTask",
    "transitionContract", "transitionVariation", "revokeExternalShare",
}

def resolved_parameter(raw: dict[str, Any]) -> dict[str, Any]:
    if "$ref" in raw:
        resolved = resolve_local_ref(openapi, raw["$ref"])
        return resolved if isinstance(resolved, dict) else {}
    return raw


for path, path_item in (openapi.get("paths") or {}).items():
    if not isinstance(path_item, dict):
        continue
    path_level_parameters = path_item.get("parameters", [])
    for method, operation in path_item.items():
        if method.lower() not in HTTP_METHODS or not isinstance(operation, dict):
            continue
        op_id = operation.get("operationId", "")
        require(bool(op_id), f"openapi.yaml: {method.upper()} {path} missing operationId")
        if op_id:
            require(op_id not in operations, f"openapi.yaml: duplicate operationId {op_id}")
            operations[op_id] = (method.lower(), path, operation)
        release = operation.get("x-release")
        flow_value = operation.get("x-flow-id")
        operation_flows = split_refs(flow_value) if isinstance(flow_value, str) else []
        require(release in {"Pilot", "GA"}, f"openapi.yaml: {op_id} has invalid x-release {release}")
        if release in {"Pilot", "GA"}:
            release_counts[release] += 1
        require(bool(operation_flows) and set(operation_flows) <= flow_ids, f"openapi.yaml: {op_id} has unknown x-flow-id {flow_value}")
        require(bool(operation.get("summary")), f"openapi.yaml: {op_id} missing summary")
        require(len(operation.get("description", "").strip()) >= 120, f"openapi.yaml: {op_id} needs an implementation-useful generated-doc description")
        require(set(operation.get("tags", [])) <= tag_names and bool(operation.get("tags")), f"openapi.yaml: {op_id} missing/unknown tag")

        all_parameters = [resolved_parameter(raw) for raw in [*path_level_parameters, *operation.get("parameters", [])]]
        require(any(item.get("name") == "X-Request-Id" for item in all_parameters), f"openapi.yaml: {op_id} missing X-Request-Id request contract")
        if op_id not in tenant_context_exceptions:
            require(any(item.get("name") == "X-Organization-Id" for item in all_parameters), f"openapi.yaml: tenant operation {op_id} missing X-Organization-Id")
        if op_id in platform_billing_operations:
            require(operation.get("x-audience") == "platform_billing", f"openapi.yaml: {op_id} must require isolated platform_billing audience")
            require(operation.get("security") == [{"platformBillingAuth": []}], f"openapi.yaml: {op_id} must override tenant bearer auth with platformBillingAuth")
        else:
            require(operation.get("x-audience") != "platform_billing", f"openapi.yaml: unexpected platform_billing audience on {op_id}")
            require(operation.get("security") != [{"platformBillingAuth": []}], f"openapi.yaml: platformBillingAuth leaked to {op_id}")
        declared_path_parameters = {
            item.get("name")
            for item in all_parameters
            if item.get("in") == "path" and item.get("required") is True
        }
        placeholders = set(re.findall(r"\{([^}]+)\}", path))
        require(placeholders == declared_path_parameters, f"openapi.yaml: {op_id} path parameters {declared_path_parameters} != {placeholders}")
        request_body = operation.get("requestBody")
        if method.lower() == "get":
            require(request_body is None, f"openapi.yaml: GET {op_id} must not declare a request body")
        else:
            require(isinstance(request_body, dict) and request_body.get("required") is True, f"openapi.yaml: mutation {op_id} needs a required request body")
        if method.lower() == "post":
            require(any(item.get("name") == "Idempotency-Key" for item in all_parameters), f"openapi.yaml: POST {op_id} missing Idempotency-Key")
            expected_idempotency_class = "ledger_400d" if op_id in durable_ledger_operations else "standard_30d"
            require(operation.get("x-idempotency-class") == expected_idempotency_class, f"openapi.yaml: POST {op_id} needs {expected_idempotency_class} idempotency class")
        if method.lower() == "patch":
            require(any(item.get("name") == "If-Match" for item in all_parameters), f"openapi.yaml: PATCH {op_id} missing If-Match")
            body_schema = (((request_body or {}).get("content") or {}).get("application/json") or {}).get("schema", {})
            if isinstance(body_schema, dict) and "$ref" in body_schema:
                body_schema = resolve_local_ref(openapi, body_schema["$ref"])
            require(
                not isinstance(body_schema, dict) or "version" not in body_schema.get("properties", {}),
                f"openapi.yaml: PATCH {op_id} duplicates If-Match with a body version",
            )

        responses = operation.get("responses", {})
        require(any(str(code).startswith("2") for code in responses), f"openapi.yaml: {op_id} missing explicit 2xx")
        require(any(str(code).startswith("4") for code in responses), f"openapi.yaml: {op_id} missing explicit 4xx")
        require("429" in responses, f"openapi.yaml: {op_id} missing explicit 429 rate-limit response")
        if method.lower() != "get":
            require("409" in responses, f"openapi.yaml: mutation {op_id} missing explicit conflict response")
        require("default" in responses, f"openapi.yaml: {op_id} missing default problem response")
        for code, raw_response in responses.items():
            response = raw_response
            if isinstance(response, dict) and "$ref" in response:
                response = resolve_local_ref(openapi, response["$ref"])
            headers = response.get("headers", {}) if isinstance(response, dict) else {}
            require("X-Request-Id" in headers, f"openapi.yaml: {op_id} response {code} missing X-Request-Id")
            if str(code) == "429":
                require("Retry-After" in headers, f"openapi.yaml: {op_id} response 429 missing Retry-After")
            if method.lower() == "post" and str(code).startswith("2"):
                require("Idempotency-Replay-Until" in headers, f"openapi.yaml: POST {op_id} response {code} missing replay-until header")
            if op_id in etag_header_operations and str(code).startswith("2"):
                require("ETag" in headers, f"openapi.yaml: entity response {op_id} {code} missing ETag")
        for code, response in responses.items():
            if not (str(code).startswith(("4", "5")) or code == "default"):
                continue
            if isinstance(response, dict) and "$ref" in response:
                response = resolve_local_ref(openapi, response["$ref"])
            content = response.get("content", {}) if isinstance(response, dict) else {}
            require("application/problem+json" in content, f"openapi.yaml: {op_id} response {code} is not Problem Details")

require(len(operations) >= 116, "openapi.yaml: expected at least 116 target operations")
require(not ({"deleteEvidence", "softDeleteEvidence", "restoreProject"} & set(operations)), "openapi.yaml: generic evidence delete or in-place project restore contradicts immutable lifecycle")
require(set(openapi.get("components", {}).get("schemas", {})) >= {"Problem", "PilotLeadRequest", "PilotLeadReceipt"}, "openapi.yaml: canonical/public schemas missing")
problem_required = set(openapi.get("components", {}).get("schemas", {}).get("Problem", {}).get("required", []))
require({"type", "title", "status", "code", "requestId", "retryable", "fieldErrors"} <= problem_required, "openapi.yaml: Problem required fields incomplete")
problem_example = openapi.get("components", {}).get("schemas", {}).get("Problem", {}).get("example", {})
require({"type", "title", "status", "code", "requestId", "retryable", "fieldErrors"} <= set(problem_example), "openapi.yaml: canonical Problem example incomplete")

api_state_schemas = {
    "Organization": ("organization", "status", True),
    "Membership": ("membership", "status", True),
    "OwnershipTransfer": ("ownership_transfer", "state", True),
    "Project": ("project", "status", True),
    "Readiness": ("readiness", "state", True),
    "WorkItem": ("work_item", "status", True),
    "EvidenceRequest": ("evidence_request", "state", True),
    "EstimateImport": ("import_job", "state", True),
    "ImportRowResult": ("import_row", "state", True),
    "UploadCompletionReceipt": ("upload_intent", "state", False),
    "Requirement": ("requirement", "state", True),
    "CaptureSession": ("capture_session", "state", True),
    "ReportingPeriod": ("period", "state", True),
    "PackageVersion": ("package", "state", True),
    "Job": ("job", "state", True),
    "Subscription": ("subscription", "state", True),
    "SaasInvoice": ("saas_invoice", "state", True),
    "DeletionJob": ("deletion_job", "state", True),
    "Variation": ("variation", "state", True),
    "ExternalShare": ("external_share", "state", False),
    "Receivable": ("receivable", "state", True),
    "AcceptanceRecord": ("acceptance", "state", True),
    "Integration": ("integration", "state", True),
    "SupportGrant": ("support_grant", "status", True),
    "ContractTermsVersion": ("contract_terms", "state", True),
    "WorkAssignment": ("work_assignment", "state", True),
    "RequirementOccurrence": ("requirement_occurrence", "state", True),
    "ReferenceDocumentVersion": ("reference_document", "state", True),
    "TypedEvidenceRecord": ("typed_evidence", "validationState", True),
    "ReviewTask": ("review_task", "state", True),
    "PackageDecisionItem": ("package_decision_item", "state", True),
    "Waiver": ("requirement_waiver", "state", True),
    "MemberOffboardingPlan": ("member_offboarding_plan", "state", True),
    "PackageDecisionIssue": ("package_decision_issue", "state", True),
    "NumberingSeries": ("numbering_series", "state", True),
}
api_schemas = openapi.get("components", {}).get("schemas", {})
for schema_name, schema in api_schemas.items():
    data_schema = schema.get("properties", {}).get("data", {}) if isinstance(schema, dict) else {}
    if schema_name.endswith("Page") and data_schema.get("type") == "array":
        require(
            data_schema.get("maxItems") == 100
            and {"data", "nextCursor"} <= set(schema.get("required", []))
            and "nextCursor" in schema.get("properties", {}),
            f"openapi.yaml: {schema_name} must use the bounded cursor-page contract",
        )
for schema_name, schema in api_schemas.items():
    if not isinstance(schema, dict):
        continue
    schema_properties = set(schema.get("properties", {}))
    schema_required = set(schema.get("required", []))
    for rule_index, rule in enumerate(schema.get("allOf", [])):
        if not isinstance(rule, dict) or not isinstance(rule.get("if"), dict):
            continue
        conditional_properties = set(rule["if"].get("properties", {}))
        consequence_properties = set(rule.get("then", {}).get("properties", {}))
        require(
            (conditional_properties | consequence_properties) <= schema_properties,
            f"openapi.yaml: {schema_name}.allOf[{rule_index}] references properties outside its schema",
        )
        require(
            conditional_properties
            <= (schema_required | set(rule["if"].get("required", []))),
            f"openapi.yaml: {schema_name}.allOf[{rule_index}] may activate when its discriminator is absent",
        )
for operation_id, page_schema_name in {
    "listContractTermsVersions": "ContractTermsVersionPage",
    "listWorkAssignments": "WorkAssignmentPage",
    "listReferenceDocumentVersions": "ReferenceDocumentVersionPage",
    "listReviewTasks": "ReviewTaskPage",
    "listSavedViews": "SavedViewPage",
}.items():
    _, _, operation = operations[operation_id]
    resolved_parameters = [resolved_parameter(item) for item in operation.get("parameters", [])]
    parameter_names = {item.get("name") for item in resolved_parameters}
    response_schema = operation["responses"]["200"]["content"]["application/json"]["schema"]
    require(
        {"cursor", "limit"} <= parameter_names
        and response_schema.get("$ref") == f"#/components/schemas/{page_schema_name}",
        f"openapi.yaml: {operation_id} must remain fully traversable through {page_schema_name}",
    )
for operation_id, (method, _, operation) in operations.items():
    if method != "get":
        continue
    resolved_parameters = [resolved_parameter(item) for item in operation.get("parameters", [])]
    parameter_names = {item.get("name") for item in resolved_parameters}
    for code, response in operation.get("responses", {}).items():
        if not str(code).startswith("2") or not isinstance(response, dict):
            continue
        schema = response.get("content", {}).get("application/json", {}).get("schema", {})
        require(
            not (isinstance(schema, dict) and schema.get("type") == "array"),
            f"openapi.yaml: GET {operation_id} must not return a bare collection array",
        )
        response_ref = schema.get("$ref", "") if isinstance(schema, dict) else ""
        if response_ref.split("/")[-1].endswith("Page"):
            require(
                {"cursor", "limit"} <= parameter_names,
                f"openapi.yaml: paged GET {operation_id} must expose cursor and limit",
            )
for schema_name in ("Organization", "Membership", "Project", "WorkItem", "NotificationPreferences"):
    schema = api_schemas.get(schema_name, {})
    require("etag" in set(schema.get("required", [])), f"openapi.yaml: {schema_name} must require exact collection-safe etag")
    require(schema.get("properties", {}).get("etag", {}).get("pattern") == '^"v[1-9][0-9]*"$', f"openapi.yaml: {schema_name}.etag pattern drifted")
require(
    "reactivatedFromProjectId" in api_schemas.get("Project", {}).get("properties", {})
    and "reactivatedFromProjectId" in api_schemas.get("ProjectCreate", {}).get("properties", {}),
    "openapi.yaml: terminal archive continuation link missing from Project/ProjectCreate",
)
require(
    "activeDeletionJobId" in set(api_schemas.get("Organization", {}).get("required", []))
    and not api_schemas.get("Organization", {}).get("allOf"),
    "openapi.yaml: organization closure must be resumable and must not carry copied membership conditionals",
)
tenant_role_enum = set(api_schemas.get("TenantRole", {}).get("enum", []))
expected_tenant_roles = set(permission_roles) - {"external_reviewer"}
require(tenant_role_enum == expected_tenant_roles, f"openapi/permissions tenant-role mismatch: api-only={sorted(tenant_role_enum - expected_tenant_roles)} permissions-only={sorted(expected_tenant_roles - tenant_role_enum)}")
assignable_roles = set(api_schemas.get("AssignableTenantRole", {}).get("enum", []))
require(assignable_roles == expected_tenant_roles - {"owner"}, "openapi.yaml: assignable roles must exclude owner and include every other tenant role")
require(api_schemas.get("InvitationCreate", {}).get("properties", {}).get("role", {}).get("$ref") == "#/components/schemas/AssignableTenantRole", "openapi.yaml: invitation must use the non-owner role allowlist")
require(api_schemas.get("MembershipPatch", {}).get("properties", {}).get("role", {}).get("$ref") == "#/components/schemas/AssignableTenantRole", "openapi.yaml: generic membership patch must not assign owner")
require("status" not in api_schemas.get("MembershipPatch", {}).get("properties", {}), "openapi.yaml: membership lifecycle must not bypass transitionMembership")
project_scope = api_schemas.get("ProjectAccessScope", {})
require(
    {"projectId", "allLocations", "locationIds"} <= set(project_scope.get("required", []))
    and project_scope.get("properties", {}).get("locationIds", {}).get("uniqueItems") is True,
    "openapi.yaml: project access scope must make project/location ownership and all-locations mode explicit",
)
for scope_schema_name in ("Membership", "MembershipPatch", "InvitationCreate"):
    scope_schema = api_schemas.get(scope_schema_name, {})
    scope_props = scope_schema.get("properties", {})
    require(
        scope_props.get("projectScopes", {}).get("items", {}).get("$ref") == "#/components/schemas/ProjectAccessScope"
        and "locationScopes" not in scope_props,
        f"openapi.yaml: {scope_schema_name} must use nested project/location scopes without a disconnected location array",
    )
require(
    {"allProjects", "projectScopes"} <= set(api_schemas.get("InvitationCreate", {}).get("required", [])),
    "openapi.yaml: invitation scope mode cannot be inferred from omitted or empty arrays",
)
for patch_schema in ("OrganizationPatch", "ProjectPatch"):
    require("status" not in api_schemas.get(patch_schema, {}).get("properties", {}), f"openapi.yaml: {patch_schema} must not bypass a dedicated lifecycle command")
    require(api_schemas.get(patch_schema, {}).get("minProperties") == 1, f"openapi.yaml: {patch_schema} must reject an empty mutation")
require("updateWorkItem" not in operations and "WorkItemPatch" not in api_schemas, "openapi.yaml: immutable WorkItem baseline must not expose a generic mutation")
require(
    {"version", "projectionUpdatedAt"} <= set(api_schemas.get("WorkItem", {}).get("required", [])),
    "openapi.yaml: work item projection must expose version plus refresh timestamp",
)
require("contractShell" in set(api_schemas.get("ProjectCreate", {}).get("required", [])), "openapi.yaml: project creation must atomically require a contract shell")
required_business_operations = {
    "previewContractTermsVersion", "previewReferenceDocumentVersion", "previewWorkAssignments",
    "transitionWorkAssignment", "issueWorkAssignmentExecutionBundle", "transitionProject",
    "searchProjectRecords", "listSavedViews", "createSavedView", "previewLocationImport",
    "confirmLocationImport", "invalidateEvidenceObject", "createOccurrenceWaiver", "transitionMembership",
    "getWorkItemDetail", "listReadinessBlockers", "listProjectRuleVersions",
    "listPackageVersions", "listPackageVersionLines", "getPackageDecisionSet",
    "listAuditEvents", "declareOccurrenceTrigger", "resolveCaptureAuthorizationException",
    "confirmCaptureReportingDate", "revokeOccurrenceWaiver", "correctReviewDecision",
    "listMemberOffboardingDependencies", "createMemberOffboardingPlan",
    "getMemberOffboardingPlan", "listMemberOffboardingPlanItems",
    "saveMemberOffboardingResolutions",
    "removeMembershipProjectScope", "cancelExport", "resolvePackageDecisionIssue",
    "listInvitations", "listOwnershipTransfers", "listExternalShares",
    "listNumberingSeries", "createNumberingSeries",
    "listPayments", "getPayment", "listReceivableLedger", "listExportJobs",
    "listSaasPayments", "listSupportGrants",
}
require(required_business_operations <= set(operations), f"openapi.yaml: business-logic closure operations missing {sorted(required_business_operations - set(operations))}")
work_detail = api_schemas.get("WorkItemDetail", {})
work_detail_props = work_detail.get("properties", {})
work_detail_operation = operations.get("getWorkItemDetail", (None, None, {}))[2]
work_detail_parameters = work_detail_operation.get("parameters", [])
work_detail_parameter_names = {
    parameter.get("name")
    for parameter in work_detail_parameters
    if isinstance(parameter, dict) and parameter.get("name")
}
work_detail_parameter_refs = {
    parameter.get("$ref")
    for parameter in work_detail_parameters
    if isinstance(parameter, dict) and parameter.get("$ref")
}
require(
    "nextCursors" in set(work_detail.get("required", []))
    and all(
        work_detail_props.get(name, {}).get("maxItems") == 100
        for name in (
            "assignments", "quantityLedger", "evidenceTimeline", "requirements",
            "occurrences", "reviewHistory", "baselineLineage",
            "packageReferences", "auditTimeline",
        )
    )
    and "section" in work_detail_parameter_names
    and "#/components/parameters/Cursor" in work_detail_parameter_refs
    and "#/components/parameters/Limit" in work_detail_parameter_refs,
    "openapi.yaml: composite work detail must be bounded and independently pageable by section",
)
require(
    {"ownerUserId", "dueAt"} <= set(api_schemas.get("ReadinessBlocker", {}).get("required", []))
    and {"acceptanceRecordIds", "receivableIds", "paymentIds"}
    <= set(api_schemas.get("PackageReference", {}).get("required", [])),
    "openapi.yaml: blocker ownership/due date or work-detail commercial references may be omitted",
)
offboarding_item = api_schemas.get("OffboardingResolution", {})
offboarding_item_props = offboarding_item.get("properties", {})
offboarding_conditionals = json.dumps(offboarding_item.get("allOf", []), sort_keys=True)
offboarding_block_rule = next(
    (
        rule
        for rule in offboarding_item.get("allOf", [])
        if rule.get("if", {}).get("properties", {}).get("resolution", {}).get("const")
        == "block_revoke"
    ),
    {},
)
require(
    {"resourceType", "resourceId", "expectedVersion", "resolution"} <= set(offboarding_item.get("required", []))
    and "projectId" not in set(offboarding_item.get("required", []))
    and {"projectId", "offlineCapturePolicy"} <= set(offboarding_item_props)
    and '"integration_connection"' in offboarding_conditionals
    and '"transfer_admin"' in offboarding_conditionals
    and '"projectId"' in offboarding_conditionals
    and offboarding_block_rule.get("then", {}).get("properties", {}).get("replacementUserId", {}).get("type")
    == "null"
    and offboarding_block_rule.get("then", {}).get("properties", {}).get("offlineCapturePolicy", {}).get("type")
    == "null",
    "openapi.yaml: offboarding must distinguish organization-level integration ownership from project-level responsibilities",
)
offboarding_response = api_schemas.get("MemberOffboardingPreview", {})
require(
    {"planId", "membershipId", "membershipVersion", "projectIds", "dependencyHash", "dependencyCount", "resolvedCount"} <= set(offboarding_response.get("required", []))
    and "projectId" not in set(offboarding_response.get("required", [])),
    "openapi.yaml: member offboarding preview must be organization-level and enumerate affected projects",
)
offboarding_plan = api_schemas.get("MemberOffboardingPlan", {})
offboarding_dependency = api_schemas.get("OffboardingDependency", {})
offboarding_plan_item = api_schemas.get("MemberOffboardingPlanItem", {})
offboarding_plan_item_page = api_schemas.get("MemberOffboardingPlanItemPage", {})
offboarding_plan_items_response = (
    operations.get("listMemberOffboardingPlanItems", (None, None, {}))[2]
    .get("responses", {})
    .get("200", {})
    .get("content", {})
    .get("application/json", {})
    .get("schema", {})
)
require(
    {"id", "membershipId", "membershipVersion", "projectIds", "state", "version", "dependencyCount", "resolvedCount", "dependencyHash", "expiresAt"}
    <= set(offboarding_plan.get("required", []))
    and {"resourceType", "resourceId", "expectedVersion", "resolutionState", "codes"}
    <= set(offboarding_dependency.get("required", []))
    and "projectId" not in set(offboarding_dependency.get("required", []))
    and "projectId" in offboarding_dependency.get("properties", {})
    and {
        "id", "planId", "projectId", "resourceType", "resourceId",
        "expectedVersion", "state", "resolution", "codes", "updatedAt",
    }
    <= set(offboarding_plan_item.get("required", []))
    and set(offboarding_plan_item.get("properties", {}).get("state", {}).get("enum", []))
    == {"unresolved", "resolved", "blocked", "stale"}
    and {"planId", "planVersion", "dependencyHash", "totalCount", "data", "nextCursor"}
    <= set(offboarding_plan_item_page.get("required", []))
    and offboarding_plan_item_page.get("properties", {}).get("data", {}).get("maxItems")
    == 100
    and offboarding_plan_items_response.get("$ref")
    == "#/components/schemas/MemberOffboardingPlanItemPage",
    "openapi.yaml: staged offboarding plan must expose versioned organization-wide dependencies",
)
invitation_summary = api_schemas.get("InvitationSummary", {})
ownership_transfer_summary = api_schemas.get("OwnershipTransferSummary", {})
external_share_summary = api_schemas.get("ExternalShareSummary", {})
external_share_summary_rules = json.dumps(
    external_share_summary.get("allOf", []),
    sort_keys=True,
)
numbering_series_schema = api_schemas.get("NumberingSeries", {})
numbering_series_create = api_schemas.get("NumberingSeriesCreate", {})
numbering_series_create_receipt = api_schemas.get("NumberingSeriesCreateReceipt", {})
readback_response_refs = {
    operation_id: (
        operations.get(operation_id, (None, None, {}))[2]
        .get("responses", {})
        .get("200", {})
        .get("content", {})
        .get("application/json", {})
        .get("schema", {})
        .get("$ref")
    )
    for operation_id in (
        "listInvitations", "listOwnershipTransfers",
        "listExternalShares", "listNumberingSeries",
    )
}
require(
    {
        "id", "email", "role", "allProjects", "projectScopes",
        "state", "expiresAt", "acceptedAt", "createdAt",
    }
    <= set(invitation_summary.get("required", []))
    and {
        "id", "currentOwnerUserId", "successorUserId", "state",
        "requestedAt", "expiresAt", "completedAt",
    }
    <= set(ownership_transfer_summary.get("required", []))
    and {
        "id", "resourceType", "packageVersionId", "variationVersionId",
        "state", "permissions", "otpRequired", "expiresAt", "revokedAt", "createdAt",
    }
    <= set(external_share_summary.get("required", []))
    and '"const": "package"' in external_share_summary_rules
    and '"const": "variation"' in external_share_summary_rules
    and readback_response_refs == {
        "listInvitations": "#/components/schemas/InvitationSummaryPage",
        "listOwnershipTransfers": "#/components/schemas/OwnershipTransferSummaryPage",
        "listExternalShares": "#/components/schemas/ExternalShareSummaryPage",
        "listNumberingSeries": "#/components/schemas/NumberingSeriesPage",
    },
    "openapi.yaml: management commands need reconstructible scoped invitation/ownership/share/numbering reads",
)
require(
    {
        "id", "contractId", "seriesKey", "prefix", "padding", "nextSequence",
        "state", "version", "createdUnderContractVersion", "createdAt",
    }
    <= set(numbering_series_schema.get("required", []))
    and {
        "clientOperationId", "expectedContractVersion", "seriesKey", "prefix", "padding",
    }
    <= set(numbering_series_create.get("required", []))
    and {"series", "receiptHash"}
    <= set(numbering_series_create_receipt.get("required", [])),
    "openapi.yaml: numbering format creation/listing must bind exact contract version and durable receipt",
)
payment_schema = api_schemas.get("Payment", {})
payment_create_schema = api_schemas.get("PaymentCreate", {})
receivable_schema = api_schemas.get("Receivable", {})
receivable_ledger_entry = api_schemas.get("ReceivableLedgerEntry", {})
receivable_ledger_rules = json.dumps(
    receivable_ledger_entry.get("allOf", []),
    sort_keys=True,
)
export_job_summary = api_schemas.get("ExportJobSummary", {})
require(
    {
        "id", "clientOperationId", "projectId", "reference",
        "sourceFingerprint", "amount", "paidOn", "allocationTotalMinor",
        "reversalTotalMinor", "netAmountMinor", "allocations", "createdAt",
    }
    <= set(payment_schema.get("required", []))
    and payment_create_schema.get("properties", {}).get("allocations", {}).get("maxItems")
    == 500
    and payment_create_schema.get("properties", {}).get("allocations", {}).get("uniqueItems")
    is True
    and {
        "version", "adjustmentTotalMinor", "releasedRetentionMinor",
        "paidMinor", "reversedPaymentMinor", "outstandingMinor",
    }
    <= set(receivable_schema.get("required", []))
    and {
        "entryId", "entryType", "sourceId", "amountMinor", "currency",
        "occurredAt", "reasonCode", "relatedPaymentId", "relatedAdjustmentId",
        "relatedRetentionReleaseId", "relatedPaymentReversalId", "balanceAfterMinor",
    }
    <= set(receivable_ledger_entry.get("required", []))
    and all(
        f'"const": "{entry_type}"' in receivable_ledger_rules
        for entry_type in (
            "adjustment", "retention_release", "payment_allocation", "payment_reversal",
        )
    ),
    "openapi.yaml: commercial reads must reconstruct bounded allocations, reversals and receivable balance effects",
)
require(
    {
        "id", "projectId", "requestedBy", "scope", "format", "state",
        "version", "artifactSha256", "artifactByteSize",
        "artifactMimeType", "expiresAt", "createdAt",
    }
    <= set(export_job_summary.get("required", []))
    and "storageKey" not in export_job_summary.get("properties", {})
    and (
        operations.get("listExportJobs", (None, None, {}))[2]
        .get("responses", {})
        .get("200", {})
        .get("content", {})
        .get("application/json", {})
        .get("schema", {})
        .get("$ref")
        == "#/components/schemas/ExportJobSummaryPage"
    ),
    "openapi.yaml: export register must expose resumable state/version without storage keys",
)
saas_payment_schema = api_schemas.get("SaasPayment", {})
support_grant_schema = api_schemas.get("SupportGrant", {})
require(
    {
        "id", "saasInvoiceId", "amount", "paidOn", "sourceFingerprint",
        "recordedBy", "reversalTotalMinor", "netAmountMinor", "createdAt",
    }
    <= set(saas_payment_schema.get("required", []))
    and (
        operations.get("listSaasPayments", (None, None, {}))[2]
        .get("responses", {})
        .get("200", {})
        .get("content", {})
        .get("application/json", {})
        .get("schema", {})
        .get("$ref")
        == "#/components/schemas/SaasPaymentPage"
    ),
    "openapi.yaml: SaaS settlement history must reconstruct payment identity and aggregate reversals",
)
require(
    {
        "id", "caseId", "platformActorId", "scopes", "projectIds", "status",
        "expiresAt", "approvedBy", "revokedAt", "createdAt",
    }
    <= set(support_grant_schema.get("required", []))
    and (
        operations.get("listSupportGrants", (None, None, {}))[2]
        .get("responses", {})
        .get("200", {})
        .get("content", {})
        .get("application/json", {})
        .get("schema", {})
        .get("$ref")
        == "#/components/schemas/SupportGrantPage"
    ),
    "openapi.yaml: support grant banner/revoke must be reconstructible after response loss",
)
execution_bundle = api_schemas.get("AssignmentExecutionBundle", {})
lease_schema = api_schemas.get("OfflineAuthorizationLease", {})
require(
    "authorizationLease" in set(execution_bundle.get("required", []))
    and {"leaseId", "membershipVersion", "assignmentVersion", "authorizedUserId", "validUntil", "leaseHash", "authorizationContextHash", "parentStateVersions"} <= set(lease_schema.get("required", [])),
    "openapi.yaml: offline execution bundle must carry a bounded server-verifiable authorization lease",
)
capture_input_required = set(api_schemas.get("CaptureSessionInput", {}).get("required", []))
require(
    {"authorizationLeaseId", "authorizationLeaseHash"} <= capture_input_required,
    "openapi.yaml: capture submit must bind the exact offline authorization lease",
)
parent_versions = lease_schema.get("properties", {}).get("parentStateVersions", {})
require(
    {"organizationVersion", "subscriptionVersion", "projectVersion", "contractVersion"}
    <= set(parent_versions.get("required", []))
    and lease_schema.get("properties", {}).get("authorizationContextHash", {}).get("pattern") == "^[a-f0-9]{64}$",
    "openapi.yaml: offline lease must freeze every authorization-affecting parent version and context hash",
)
capture_session_schema = api_schemas.get("CaptureSession", {})
require(
    {"authorizationDisposition", "dateReviewState", "reportingDate", "firstServerReceivedAt"}
    <= set(capture_session_schema.get("required", []))
    and "first_seen_after_invalidation"
    in set(capture_session_schema.get("properties", {}).get("authorizationDisposition", {}).get("enum", [])),
    "openapi.yaml: post-invalidation first receipt and reporting-date review are not explicit",
)
occurrence_strategy_refs = {
    item.get("$ref")
    for item in api_schemas.get("OccurrenceStrategy", {}).get("oneOf", [])
}
require(
    occurrence_strategy_refs == {
        "#/components/schemas/OnceOccurrenceStrategy",
        "#/components/schemas/CalendarOccurrenceStrategy",
        "#/components/schemas/MaterialBatchOccurrenceStrategy",
        "#/components/schemas/QuantityThresholdOccurrenceStrategy",
    }
    and "occurrenceStrategy" in set(api_schemas.get("EvidenceRuleDraft", {}).get("required", [])),
    "openapi.yaml: deterministic occurrence strategy discriminator set is incomplete",
)
require(
    {"startPolicy", "endPolicy", "lateTriggerPolicy"}
    <= set(api_schemas.get("CalendarOccurrenceStrategy", {}).get("required", []))
    and "outOfOrderPolicy"
    in set(api_schemas.get("MaterialBatchOccurrenceStrategy", {}).get("required", []))
    and {"crossingPolicy", "correctionPolicy"}
    <= set(api_schemas.get("QuantityThresholdOccurrenceStrategy", {}).get("required", [])),
    "openapi.yaml: occurrence strategies lack start/end/late/out-of-order/correction semantics",
)
trigger_schema = api_schemas.get("OccurrenceTriggerCreate", {})
trigger_variants = {
    variant.get("properties", {}).get("type", {}).get("const")
    for variant in trigger_schema.get("properties", {}).get("trigger", {}).get("oneOf", [])
}
require(
    {"clientOperationId", "assignmentVersion", "ruleVersionId", "trigger"} <= set(trigger_schema.get("required", []))
    and trigger_variants == {"batch", "date", "quantity_threshold"},
    "openapi.yaml: explicit occurrence trigger command must be typed and idempotent",
)
occurrence_required = set(api_schemas.get("RequirementOccurrence", {}).get("required", []))
trigger_receipt_required = set(api_schemas.get("OccurrenceTriggerReceipt", {}).get("required", []))
declare_trigger_response = (
    operations.get("declareOccurrenceTrigger", (None, None, {}))[2]
    .get("responses", {}).get("201", {})
    .get("content", {}).get("application/json", {}).get("schema", {})
)
require(
    {
        "requirementId", "workItemId", "locationId", "occurrenceKey",
        "occurrenceType", "triggerSnapshot", "materialBatch",
        "quantityFrom", "quantityTo",
    }
    <= occurrence_required
    and {
        "triggerEventId", "clientOperationId", "triggerKey",
        "triggerHash", "replayed", "occurrence",
    }
    <= trigger_receipt_required
    and declare_trigger_response.get("$ref")
    == "#/components/schemas/OccurrenceTriggerReceipt",
    "openapi.yaml: occurrence trigger must return its canonical receipt and exact subject/result",
)
assignment_preview_response = (
    operations.get("previewWorkAssignments", (None, None, {}))[2]
    .get("responses", {}).get("200", {})
    .get("content", {}).get("application/json", {}).get("schema", {})
)
assignment_preview_row_required = set(
    api_schemas.get("WorkAssignmentImpactPreview", {})
    .get("properties", {}).get("rows", {}).get("items", {}).get("required", [])
)
require(
    assignment_preview_response.get("$ref")
    == "#/components/schemas/WorkAssignmentImpactPreview"
    and {
        "lineageRootId", "contractQuantityAcrossLineage",
        "plannedOpenAcrossLineage", "performedAcrossLineage",
        "availableAcrossLineage", "occurrenceCount",
    }
    <= assignment_preview_row_required,
    "openapi.yaml: assignment preview must expose lineage-wide availability and deterministic occurrence impact",
)
require(
    api_schemas.get("RuleImpactPreview", {}).get("properties", {}).get("canonicalInputStored", {}).get("const") is True
    and {"impactPreviewId", "impactInputHash"} <= set(api_schemas.get("RulePublishRequest", {}).get("required", [])),
    "openapi.yaml: rule publish must consume the exact canonical preview payload",
)
require(
    "sourceFingerprint" in set(api_schemas.get("PaymentCreate", {}).get("required", [])),
    "openapi.yaml: project payment needs a durable business-source fingerprint",
)
capture_resolution = api_schemas.get("CaptureAuthorizationResolutionCommand", {})
capture_resolution_decisions = set(
    capture_resolution.get("properties", {}).get("decision", {}).get("enum", [])
)
capture_resolution_receipt = api_schemas.get("CaptureAuthorizationResolutionReceipt", {})
capture_resolution_receipt_rules = json.dumps(
    capture_resolution_receipt.get("allOf", []),
    sort_keys=True,
)
require(
    {"clientOperationId", "captureVersion", "decision", "reasonCode", "evidenceSummary", "recentAuthProof"}
    <= set(capture_resolution.get("required", []))
    and capture_resolution_decisions == {"release_to_scan_and_review", "reject"}
    and "authoritativeReportingDate" not in capture_resolution.get("properties", {}),
    "openapi.yaml: security quarantine resolution must be evidence-backed and separate from reporting-date authority",
)
require(
    {
        "captureSessionId", "captureVersion", "decision",
        "authorizationDisposition", "resultingState", "receiptHash",
    }
    <= set(capture_resolution_receipt.get("required", []))
    and '"const": "release_to_scan_and_review"' in capture_resolution_receipt_rules
    and '"const": "recovery_approved"' in capture_resolution_receipt_rules
    and '"const": "scanning"' in capture_resolution_receipt_rules
    and '"const": "reject"' in capture_resolution_receipt_rules
    and '"const": "recovery_rejected"' in capture_resolution_receipt_rules
    and '"const": "terminal_failed"' in capture_resolution_receipt_rules,
    "openapi.yaml: security recovery decision must map to exactly one disposition and resulting capture state",
)
reporting_date_command = api_schemas.get("ReportingDateConfirmationCommand", {})
reporting_date_receipt = api_schemas.get("ReportingDateConfirmationReceipt", {})
reporting_date_rules = json.dumps(reporting_date_command.get("allOf", []), sort_keys=True)
require(
    {"clientOperationId", "captureVersion", "claimedOccurredOn", "decision", "reasonCode"}
    <= set(reporting_date_command.get("required", []))
    and set(reporting_date_command.get("properties", {}).get("decision", {}).get("enum", []))
    == {"confirm", "reject"}
    and '"const": "confirm"' in reporting_date_rules
    and '"const": "reject"' in reporting_date_rules
    and "decision" in set(reporting_date_receipt.get("required", []))
    and reporting_date_receipt.get("properties", {}).get("affectedQuantityEntryIds", {}).get("minItems") is None,
    "openapi.yaml: reporting-date confirmation must support confirm/reject and evidence-only captures",
)
require(
    {"lineType", "lineageRootId", "lineageVersion"} <= set(api_schemas.get("WorkItem", {}).get("required", []))
    and api_schemas.get("WorkItem", {}).get("properties", {}).get("lineType", {}).get("const") == "measured",
    "openapi.yaml: narrow measured-row policy and immutable work-item lineage are incomplete",
)
require(
    "businessCalendar" in set(api_schemas.get("ContractTermsDraft", {}).get("required", []))
    and {"calendarKey", "version"} <= set(api_schemas.get("BusinessCalendarBinding", {}).get("required", []))
    and "future effective date" in api_schemas.get("ContractTermsDraft", {}).get("properties", {}).get("effectiveOn", {}).get("description", "").lower(),
    "openapi.yaml: Pilot terms must bind a versioned calendar and reject unsupported future-effective publication",
)
require(
    "closeCycleNo" in set(api_schemas.get("ReportingPeriod", {}).get("required", []))
    and "closeCycleNo" in set(api_schemas.get("PeriodCloseRequest", {}).get("required", [])),
    "openapi.yaml: numbered period close cycle is missing from request or response",
)
require(
    {"packageVersionId", "decisionSetId", "issueType", "severity", "code", "state", "version"}
    <= set(api_schemas.get("PackageDecisionIssue", {}).get("required", []))
    and {"resolvedBy", "resolutionNote", "resolvedAt", "cancelledAt", "cancellationReasonCode"}
    <= set(api_schemas.get("PackageDecisionIssue", {}).get("required", []))
    and '"package_line"' in json.dumps(api_schemas.get("PackageDecisionIssue", {}).get("allOf", []), sort_keys=True)
    and '"cancelled"' in json.dumps(api_schemas.get("PackageDecisionIssue", {}).get("allOf", []), sort_keys=True)
    and "resolvePackageDecisionIssue" in operations,
    "openapi.yaml: normalized package-decision issues lack an exact resolution command",
)
require(
    {"clientOperationId", "expectedVersion", "expectedState", "reasonCode"}
    <= set(api_schemas.get("ExportCancellationCommand", {}).get("required", [])),
    "openapi.yaml: export cancellation must bind durable identity and exact worker state/version",
)
numbering_rule = api_schemas.get("NumberingRule", {})
require(
    {"seriesKey", "prefix", "padding"} <= set(numbering_rule.get("required", []))
    and "nextSequence" not in numbering_rule.get("properties", {}),
    "openapi.yaml: contract terms must select a stable numbering series and never accept a client sequence counter",
)
acceptance_create = api_schemas.get("AcceptanceCreate", {})
require(
    "expectedAcceptanceRecordVersion" in acceptance_create.get("properties", {})
    and len(acceptance_create.get("allOf", [])) >= 3,
    "openapi.yaml: acceptance successor and state/amount semantics must be machine constrained",
)
reversal_receipt = api_schemas.get("SaasPaymentReversalReceipt", {})
require(
    {"reversalId", "paymentId", "invoiceId", "invoiceVersion", "subscriptionId", "subscriptionVersion", "remainingSettledAmount"} <= set(reversal_receipt.get("required", [])),
    "openapi.yaml: SaaS reversal must return explicit payment/invoice/subscription consequences",
)
decision_batch = api_schemas.get("PackageLineDecisionBatchCreate", {})
decision_batch_required = set(decision_batch.get("required", []))
decision_batch_props = decision_batch.get("properties", {})
decision_item_input = decision_batch_props.get("items", {}).get("items", {}).get("properties", {})
require(
    {"clientOperationId", "decisionSetId", "targetVersion", "packageSnapshotHash", "finalize", "items"} <= decision_batch_required,
    "openapi.yaml: package line saves must target one source decision set and declare finalization",
)
require(
    decision_batch_props.get("items", {}).get("maxItems") == 500
    and "expectedItemVersion" in decision_item_input
    and "submittedAmountMinor" not in decision_item_input
    and "sourceType" not in decision_batch_props
    and "sourceDecisionId" not in decision_batch_props,
    "openapi.yaml: resumable decision items lost bounds/optimistic version or let clients assert source/totals",
)
decision_item_schema = decision_batch_props.get("items", {}).get("items", {})
decision_item_conditionals = json.dumps(decision_item_schema.get("allOf", []), sort_keys=True)
require(
    '"const": "accepted"' in decision_item_conditionals
    and '"modified"' in decision_item_conditionals
    and '"returned"' in decision_item_conditionals
    and '"reasonCode"' in decision_item_conditionals
    and '"correctionOwnerId"' in decision_item_conditionals
    and '"correctionDueAt"' in decision_item_conditionals,
    "openapi.yaml: package returned/modified issue ownership and accepted incompatibilities must be conditional",
)
decision_issue_input_text = json.dumps(
    decision_item_schema.get("properties", {}).get("issues", {}).get("items", {}),
    sort_keys=True,
)
require(
    '"requirement_occurrence"' in decision_issue_input_text
    and '"evidence_object"' in decision_issue_input_text
    and '"occurrenceId"' in decision_issue_input_text
    and '"evidenceObjectId"' in decision_issue_input_text,
    "openapi.yaml: package issue target discriminator must require its exact occurrence/evidence identity",
)
review_decision_required = set(api_schemas.get("ReviewDecision", {}).get("required", []))
review_correction_receipt_required = set(
    api_schemas.get("ReviewDecisionCorrectionReceipt", {}).get("required", [])
)
require(
    {"supersedesDecisionId", "lineageRootId", "lineageVersion", "isCurrent"}
    <= review_decision_required
    and {
        "correctionId", "invalidatedDecisionId", "lineageRootId",
        "reopenedCaptureVersion", "reviewTaskId", "receiptHash",
    }
    <= review_correction_receipt_required,
    "openapi.yaml: review correction must return an append-only reopen receipt and expose later decision lineage",
)
require(
    "pending" in set(api_schemas.get("PackageDecisionItem", {}).get("properties", {}).get("state", {}).get("enum", [])),
    "openapi.yaml: package decision item must represent inert pending saves",
)
manual_decision_required = set(api_schemas.get("ManualPackageDecision", {}).get("required", []))
require(
    {"decisionSetId", "sourceReference", "actorLabel", "decidedAt", "sourceReceiptHash"} <= manual_decision_required
    and "id" not in manual_decision_required,
    "openapi.yaml: manual response must round-trip its source receipt through the decision-set identity",
)
external_decision_required = set(api_schemas.get("ExternalDecision", {}).get("required", []))
require(
    {"decisionSetId", "packageState"} <= external_decision_required,
    "openapi.yaml: external return/full acceptance must disclose its decision-set/package consequence",
)
invalidation_receipt = api_schemas.get("EvidenceInvalidationReceipt", {})
require(
    {"evidenceVersion", "invalidatedAt", "affectedOccurrenceCount", "affectedOccurrenceIds", "affectedOccurrencesTruncated", "recalculationJobId"}
    <= set(invalidation_receipt.get("required", []))
    and invalidation_receipt.get("properties", {}).get("affectedOccurrenceIds", {}).get("maxItems") == 500,
    "openapi.yaml: evidence invalidation receipt must expose optimistic version and bounded dependency impact",
)
upload_create_schema = api_schemas.get("UploadCreate", {})
upload_purposes = set(upload_create_schema.get("properties", {}).get("purpose", {}).get("enum", []))
require(upload_purposes == {"evidence", "estimate_import", "location_import", "reference_document"}, f"openapi.yaml: upload purpose allowlist drifted: {sorted(upload_purposes)}")
upload_conditionals = {
    rule.get("if", {}).get("properties", {}).get("purpose", {}).get("const"): rule.get("then", {})
    for rule in upload_create_schema.get("allOf", [])
    if isinstance(rule, dict)
}
require(
    {"workItemId", "assignmentId", "locationId", "captureClientOperationId"} <= set(upload_conditionals.get("evidence", {}).get("required", []))
    and upload_conditionals.get("estimate_import", {}).get("properties", {}).get("workItemId", {}).get("type") == "null"
    and upload_conditionals.get("estimate_import", {}).get("properties", {}).get("assignmentId", {}).get("type") == "null"
    and upload_conditionals.get("estimate_import", {}).get("properties", {}).get("captureClientOperationId", {}).get("type") == "null"
    and upload_conditionals.get("reference_document", {}).get("properties", {}).get("workItemId", {}).get("type") == "null"
    and upload_conditionals.get("reference_document", {}).get("properties", {}).get("captureClientOperationId", {}).get("type") == "null",
    "openapi.yaml: upload purpose/work/client-operation conditional is incomplete",
)
upload_grant_required = set(api_schemas.get("UploadGrant", {}).get("required", []))
require(
    {"uploadId", "projectId", "purpose", "state", "workItemId", "assignmentId", "locationId", "captureClientOperationId", "objectKey", "fileName", "retentionClass", "expectedByteSize", "expectedSha256", "declaredMimeType", "expiresAt", "partSize", "parts"} <= upload_grant_required,
    "openapi.yaml: upload grant no longer returns the complete frozen tuple",
)
expected_upload_retention_classes = {"contract_baseline", "evidence_original"}
require(
    set(api_schemas.get("UploadGrant", {}).get("properties", {}).get("retentionClass", {}).get("enum", [])) == expected_upload_retention_classes,
    "openapi.yaml: upload grant retention-class allowlist drifted",
)
expected_upload_retention_by_purpose = {
    "evidence": "evidence_original",
    "estimate_import": "contract_baseline",
    "location_import": "contract_baseline",
    "reference_document": "contract_baseline",
}
for schema_name in ("UploadGrant", "UploadCompletionReceipt"):
    conditional_mapping = {
        rule.get("if", {}).get("properties", {}).get("purpose", {}).get("const"):
        rule.get("then", {}).get("properties", {}).get("retentionClass", {}).get("const")
        for rule in api_schemas.get(schema_name, {}).get("allOf", [])
        if isinstance(rule, dict) and rule.get("if", {}).get("properties", {}).get("purpose", {}).get("const") is not None
    }
    require(
        conditional_mapping == expected_upload_retention_by_purpose,
        f"openapi.yaml: {schema_name} purpose-to-retention mapping drifted",
    )
complete_upload_response = operations.get("completeUpload", (None, None, {}))[2].get("responses", {}).get("202", {})
complete_upload_schema = complete_upload_response.get("content", {}).get("application/json", {}).get("schema", {})
require(complete_upload_schema.get("$ref") == "#/components/schemas/UploadCompletionReceipt", "openapi.yaml: completeUpload must return the sealed intent and verification job receipt")
upload_receipt = api_schemas.get("UploadCompletionReceipt", {})
require(
    {"uploadId", "projectId", "purpose", "state", "workItemId", "assignmentId", "locationId", "captureClientOperationId", "objectKey", "fileName", "retentionClass", "byteSize", "sha256", "declaredMimeType", "expiresAt", "sealedAt", "verificationJob"} <= set(upload_receipt.get("required", [])),
    "openapi.yaml: completion receipt no longer exposes the sealed immutable tuple",
)
require(
    set(upload_receipt.get("properties", {}).get("retentionClass", {}).get("enum", [])) == expected_upload_retention_classes,
    "openapi.yaml: completion receipt retention-class allowlist drifted",
)
for schema_name in ("PaymentCreate", "PaymentReversalCreate", "Payment", "PaymentReversal"):
    require(
        "clientOperationId" in set(api_schemas.get(schema_name, {}).get("required", [])),
        f"openapi.yaml: {schema_name} must carry durable ledger command identity",
    )
capture_input_schema = api_schemas.get("CaptureSessionInput", {})
capture_nonempty_fields = {
    field
    for rule in capture_input_schema.get("anyOf", [])
    for field, constraint in rule.get("properties", {}).items()
    if constraint.get("minItems") == 1
}
require(capture_nonempty_fields == {"quantityEntries", "evidenceLinks", "occurrenceResponses"}, "openapi.yaml: capture input must permit typed/evidence/quantity-only but reject an empty capture")
require({"workItemId", "assignmentId", "locationId", "evidenceLinks", "occurrenceResponses"} <= set(capture_input_schema.get("required", [])), "openapi.yaml: capture must bind exact work assignment location and occurrence evidence links")
quantity_types = set(capture_input_schema.get("properties", {}).get("quantityEntries", {}).get("items", {}).get("properties", {}).get("entryType", {}).get("enum", []))
require(quantity_types == {"progress", "correction", "reversal"}, f"openapi.yaml: narrow Pilot quantity commands drifted {sorted(quantity_types)}")
require("evidenceLinks" in capture_input_schema.get("properties", {}), "openapi.yaml: capture evidence must target exact occurrences")
quantity_rules = capture_input_schema.get("properties", {}).get("quantityEntries", {}).get("items", {}).get("allOf", [])
quantity_rule_text = json.dumps(quantity_rules, sort_keys=True)
require(
    '"const": "progress"' in quantity_rule_text and '"const": "correction"' in quantity_rule_text and '"const": "reversal"' in quantity_rule_text,
    "openapi.yaml: quantity sign/non-zero rules must be conditional per Pilot entry type",
)
require(
    "assignedUserId" in api_schemas.get("AssignmentReassignmentCommand", {}).get("required", []),
    "openapi.yaml: assignment reassignment must name the new assignee",
)
require(
    {"referenceDocumentVersionId", "staleSnapshotHash"} <= set(api_schemas.get("AssignmentReferenceAcknowledgementCommand", {}).get("required", [])),
    "openapi.yaml: stale-reference acknowledgement must bind exact revision and snapshot",
)
search_type_enum = set(
    api_schemas.get("SearchResultPage", {})
    .get("properties", {}).get("data", {}).get("items", {})
    .get("properties", {}).get("type", {}).get("enum", [])
)
require("reference" in search_type_enum, "openapi.yaml: Pilot identifier search must include controlled references")
require(
    "from" in api_schemas.get("PaymentDueRule", {}).get("required", []),
    "openapi.yaml: payment due rule must name its deterministic source event",
)
require(
    {"previewId", "previewHash"} <= set(api_schemas.get("SubscriptionStateChange", {}).get("required", [])),
    "openapi.yaml: subscription state change must consume an exact consequence preview",
)
require(
    {"expectedVersion", "amountMinor"} <= (
        set(api_schemas.get("SaasInvoiceTransition", {}).get("required", []))
        | set(api_schemas.get("SaasInvoiceTransition", {}).get("properties", []))
    ),
    "openapi.yaml: SaaS invoice correction must expose concurrency version and positive amount",
)
job_required = set(api_schemas.get("Job", {}).get("required", []))
require(
    {"id", "type", "resourceType", "resourceId", "state", "progress", "attemptCount", "nextAttemptAt", "errorCode", "retryable", "statusUrl", "createdAt"} <= job_required,
    "openapi.yaml: Job lost public resource/retry correlation fields",
)
for schema_name, (domain, property_name, exact) in api_state_schemas.items():
    enum_values = set(api_schemas.get(schema_name, {}).get("properties", {}).get(property_name, {}).get("enum", []))
    require(bool(enum_values), f"openapi.yaml: {schema_name}.{property_name} enum missing")
    if exact:
        require(enum_values == catalog_by_domain[domain], f"openapi/state mismatch {schema_name}.{property_name} vs {domain}")
    else:
        require(enum_values <= catalog_by_domain[domain], f"openapi/state unknown values in {schema_name}.{property_name}")

public_operations = public_or_capability_operations
require(operations.get("submitPilotLead", (None, None, {}))[2].get("security") == [], "openapi.yaml: submitPilotLead must explicitly override auth with security: []")
for op_id, (_, _, operation) in operations.items():
    if op_id not in public_operations:
        require(operation.get("security") != [], f"openapi.yaml: unexpected unauthenticated operation {op_id}")
    elif op_id in operations:
        require(operation.get("security") == [], f"openapi.yaml: capability/public operation {op_id} must explicitly override bearer auth")

count_statement = re.search(r"exact allowlist:\s*(\d+) Pilot and (\d+) GA-forward", (DOCS / "22-data-api-contract.md").read_text(encoding="utf-8"))
require(count_statement is not None, "docs/22: exact OpenAPI release count statement missing")
if count_statement:
    require((release_counts["Pilot"], release_counts["GA"]) == tuple(map(int, count_statement.groups())), "docs/22: OpenAPI Pilot/GA operation counts are stale")

# ---------------------------------------------------------------------------
# Semantic UI-action closure
# ---------------------------------------------------------------------------

ui_action_rows = csv_rows["ui-actions.csv"]
mapped_mutations: list[str] = []
for row in ui_action_rows:
    action_id = row["action_id"]
    ref = f"ui-actions.csv:{action_id}"
    require(re.fullmatch(r"A-[0-9]{3}", action_id) is not None, f"{ref}: invalid action ID")
    require(re.fullmatch(r"[a-z0-9_]+", row["action_key"]) is not None, f"{ref}: invalid action_key")
    require(row["release"] in {"Pilot", "GA"}, f"{ref}: invalid release {row['release']}")
    require_refs(ref + " screen", split_refs(row["screen_id"]), screen_ids, sentinels={"platform_only", "notification_center"})
    require_refs(ref + " operation", [row["operation_id"]], set(operations), sentinels=set())
    require_refs(ref + " permission", split_refs(row["permission_resource"]), permission_resources)
    require_refs(ref + " domain", split_refs(row["transition_domain"]), state_domains)
    require_refs(ref + " event", split_refs(row["audit_event"]), events)
    require_refs(ref + " tests", split_refs(row["test_ids"]), tests, sentinels=set())
    for test_id in split_refs(row["test_ids"]):
        test_release = next((item["release"] for item in csv_rows["test-catalog.csv"] if item["test_id"] == test_id), None)
        compatible = {"Pilot", "Pilot-GA"} if row["release"] == "Pilot" else {"GA", "Pilot-GA"}
        require(test_release in compatible, f"{ref}: {test_id} release {test_release} cannot prove {row['release']} action")
    require(bool(row["state_consequence"].strip()), f"{ref}: state consequence is blank")
    operation_entry = operations.get(row["operation_id"])
    if operation_entry:
        method, _, operation = operation_entry
        require(method in {"post", "put", "patch", "delete"}, f"{ref}: action maps non-mutation {method.upper()} operation")
        require(operation.get("x-release") == row["release"], f"{ref}: release differs from OpenAPI {operation.get('x-release')}")
        mapped_mutations.append(row["operation_id"])

mutation_operations = {
    op_id
    for op_id, (method, _, _) in operations.items()
    if method in {"post", "put", "patch", "delete"}
}
require(len(mapped_mutations) == len(set(mapped_mutations)), "ui-actions.csv: one mutation operation must map to exactly one normative action")
require(set(mapped_mutations) == mutation_operations, f"ui-actions.csv: mutation closure mismatch missing={sorted(mutation_operations - set(mapped_mutations))} extra={sorted(set(mapped_mutations) - mutation_operations)}")


# ---------------------------------------------------------------------------
# SQL, tenant access surface and state-enum reconciliation
# ---------------------------------------------------------------------------

schema_text = (TECH / "schema.sql").read_text(encoding="utf-8")
schema_lower = schema_text.lower()
# Independent pgsql-parser evidence retired with the generated report
# (user-approved cleanup; see document-disposition.csv).
table_blocks = {
    match.group(1): match.group(2)
    for match in re.finditer(r"create\s+table\s+public\.([a-z0-9_]+)\s*\((.*?)\n\);", schema_text, re.IGNORECASE | re.DOTALL)
}
tables = set(table_blocks)
require(len(tables) >= 105, f"schema.sql: expected at least 105 explicit public tables, found {len(tables)}")
require(not ({"teams", "crews", "team_members", "crew_members"} & tables), "schema.sql: team/crew cannot appear before its GA lifecycle/API/authorization model")
for table in {"organizations", "memberships", "invitations", "invitation_project_scopes", "invitation_location_scopes", "ownership_transfers", "projects", "work_items", "evidence_requests", "capture_sessions", "upload_intents", "evidence_objects", "evidence_requirement_links", "quantity_entries", "reporting_periods", "package_versions", "external_sessions", "subscriptions", "saas_invoices", "saas_invoice_adjustments", "jobs", "idempotency_records", "payment_reversals", "reconciliation_imports", "integration_connections", "webhook_deliveries", "support_access_grants", "legal_holds", "contract_term_versions", "reference_documents", "reference_document_versions", "work_assignments", "requirement_occurrences", "typed_evidence_records", "review_tasks", "review_decision_corrections", "hold_point_decisions", "concealment_events", "concealment_event_evidence", "variation_subjects", "package_decision_sets", "package_decision_items", "saved_views", "impact_previews", "occurrence_trigger_events", "requirement_waiver_revocations", "capture_authorization_resolutions", "capture_reporting_date_confirmations", "period_close_cycles", "package_decision_issues", "member_offboarding_plans", "member_offboarding_plan_items", "membership_project_scope_removal_receipts", "export_cancellation_receipts"}:
    require(table in tables, f"schema.sql: missing required table {table}")
# A controlled reference identity exposed by the API always carries its issue date.
require(
    re.search(r"\bissue_date\s+date\s+not\s+null\b", table_blocks.get("reference_document_versions", ""), re.IGNORECASE) is not None,
    "schema.sql: reference_document_versions.issue_date must be NOT NULL to match ReferenceDocumentVersion.issueDate",
)
require(
    "projection_updated_at" in table_blocks.get("work_items", "").lower(),
    "schema.sql: work item projection refresh timestamp is missing",
)
for table_name, required_columns in {
    "work_items": {"lineage_root_id", "lineage_version", "is_current", "line_type"},
    "evidence_rule_versions": {"config_schema_version", "config_hash"},
    "offline_authorization_leases": {
        "organization_version", "subscription_version", "project_version",
        "contract_version", "authorization_context_hash",
    },
    "capture_sessions": {
        "authorization_disposition", "reporting_date_review_state",
        "claimed_reporting_date", "authoritative_reporting_date", "first_server_received_at",
    },
    "quantity_entries": {"claimed_occurred_on", "occurred_on", "reporting_date_review_state"},
    "review_decisions": {
        "client_operation_id", "supersedes_decision_id", "lineage_root_id",
        "lineage_version", "is_current",
    },
    "review_decision_corrections": {
        "client_operation_id", "capture_session_id", "invalidated_decision_id",
        "target_decision_version", "reopened_capture_version", "review_task_id",
        "reason_code", "corrected_by", "receipt_hash",
    },
    "capture_authorization_resolutions": {
        "client_operation_id", "capture_session_id", "decision", "reason_code",
        "evidence_summary", "target_capture_version", "decided_by", "receipt_hash",
    },
    "capture_reporting_date_confirmations": {
        "client_operation_id", "capture_session_id", "claimed_reporting_date",
        "authoritative_reporting_date", "decision", "reason_code",
        "target_capture_version", "decided_by", "receipt_hash",
    },
    "reporting_periods": {"close_cycle_no"},
    "payments": {"source_fingerprint"},
    "impact_previews": {"canonical_input_snapshot"},
    "contract_term_versions": {
        "business_calendar_key", "business_calendar_version",
        "business_calendar_snapshot", "business_calendar_hash",
    },
    "numbering_series": {
        "client_operation_id", "contract_id", "created_under_contract_version",
        "series_key", "prefix", "padding", "next_sequence", "first_used_at",
        "version", "created_by", "creation_receipt_hash",
    },
    "export_jobs": {"version"},
    "package_decision_issues": {
        "resolved_by", "resolved_at", "resolution_note",
        "cancelled_at", "cancellation_reason_code",
    },
}.items():
    block_columns = {
        column.lower()
        for column in column_pattern.findall(table_blocks.get(table_name, ""))
    } if "column_pattern" in globals() else set()
    # column_pattern is defined later for FK validation; use a direct boundary
    # check here so field parity remains independent of that parser.
    for column in required_columns:
        require(
            re.search(rf"\b{re.escape(column)}\b", table_blocks.get(table_name, ""), re.IGNORECASE) is not None,
            f"schema.sql: {table_name}.{column} required by the v2.9 API/business invariant is missing",
        )
package_item_block = table_blocks.get("package_decision_items", "")
require(
    re.search(r"\boccurrence_id\b", package_item_block, re.IGNORECASE) is None
    and re.search(r"\bevidence_object_id\b", package_item_block, re.IGNORECASE) is None,
    "schema.sql: financial package decision items must not also own occurrence/evidence issue targets",
)
capture_resolution_block = table_blocks.get("capture_authorization_resolutions", "").lower()
require(
    "'release_to_scan_and_review'" in capture_resolution_block
    and "'reject'" in capture_resolution_block
    and "'approve_recovery'" not in capture_resolution_block,
    "schema.sql: capture authorization decision enum drifted from the API",
)
require(
    re.search(r"unique\s*\(\s*organization_id\s*,\s*source_fingerprint\s*\)", table_blocks.get("payments", ""), re.IGNORECASE) is not None,
    "schema.sql: payment business fingerprint must be organization-unique",
)
require(
    "cancel_requested" in table_blocks.get("export_jobs", "")
    and "export_cancellation_receipts" in tables,
    "schema.sql: fenced running-export cancellation storage is incomplete",
)
require(
    re.search(r"foreign key\s*\(\s*organization_id\s*,\s*authorized_user_id\s*,\s*membership_id\s*\)", schema_text, re.IGNORECASE) is not None
    and re.search(r"foreign key\s*\(\s*organization_id\s*,\s*created_by\s*,\s*authorization_lease_id\s*\)", schema_text, re.IGNORECASE) is not None,
    "schema.sql: offline lease membership/user and capture actor identity binding is incomplete",
)
require("force row level security" in schema_lower, "schema.sql: FORCE RLS baseline missing")
require("revoke all on all tables in schema public from anon, authenticated" in schema_lower, "schema.sql: public client grants not revoked")
require("absent from exposed_schemas" in schema_lower and "`public`" in schema_lower, "schema.sql: exposed-schema boundary not recorded")
require(len(re.findall(r"foreign key\s*\(organization_id,", schema_lower)) >= 130, "schema.sql: composite tenant FK coverage regressed below 130")
require(
    "reactivated_from_project_id" in table_blocks.get("projects", "").lower()
    and re.search(
        r"foreign key\s*\(organization_id,\s*reactivated_from_project_id\)\s*references\s+public\.projects\s*\(organization_id,\s*id\)",
        table_blocks.get("projects", ""),
        re.IGNORECASE,
    ) is not None,
    "schema.sql: project continuation must have a same-tenant archived-source FK",
)

# Every project-bound tenant table needs at least one database-enforced parent
# relation carrying both organization_id and project_id. RLS alone must not be
# responsible for preventing cross-tenant/project graph corruption.
owned_composite_fks: list[tuple[str, tuple[str, ...], str, tuple[str, ...]]] = []
for owner_table, block in table_blocks.items():
    for columns, target_table, target_columns in re.findall(
        r"foreign key\s*\(([^)]+)\)\s*references\s+public\.([a-z0-9_]+)\s*\(([^)]+)\)",
        block,
        re.IGNORECASE | re.DOTALL,
    ):
        owned_composite_fks.append((
            owner_table,
            tuple(value.strip().lower() for value in columns.split(",")),
            target_table.lower(),
            tuple(value.strip().lower() for value in target_columns.split(",")),
        ))
for alter_match in re.finditer(r"alter table public\.([a-z0-9_]+)(.*?);", schema_text, re.IGNORECASE | re.DOTALL):
    owner_table, alter_body = alter_match.groups()
    for columns, target_table, target_columns in re.findall(
        r"foreign key\s*\(([^)]+)\)\s*references\s+public\.([a-z0-9_]+)\s*\(([^)]+)\)",
        alter_body,
        re.IGNORECASE | re.DOTALL,
    ):
        owned_composite_fks.append((
            owner_table.lower(),
            tuple(value.strip().lower() for value in columns.split(",")),
            target_table.lower(),
            tuple(value.strip().lower() for value in target_columns.split(",")),
        ))

# PostgreSQL requires every referenced column list to be a primary key or an
# exact non-partial unique key. Validate that property statically so a spec that
# looks tenant-safe cannot ship an unappliable migration.
unique_keys: dict[str, set[tuple[str, ...]]] = defaultdict(set)
column_pattern = re.compile(
    r"^\s*([a-z][a-z0-9_]*)\s+(?:uuid|text|bigint|integer|smallint|numeric\b|char\b|date\b|timestamptz\b|boolean\b|jsonb\b|bytea\b)",
    re.IGNORECASE | re.MULTILINE,
)
for table_name, block in table_blocks.items():
    declared_columns = [value.lower() for value in column_pattern.findall(block)]
    duplicates = sorted(value for value, count in Counter(declared_columns).items() if count > 1)
    require(not duplicates, f"schema.sql: duplicate columns in {table_name}: {duplicates}")
    for inline_match in re.finditer(
        r"^\s*([a-z][a-z0-9_]*)\s+[^,\n]*\bprimary\s+key\b",
        block,
        re.IGNORECASE | re.MULTILINE,
    ):
        unique_keys[table_name].add((inline_match.group(1).lower(),))
    for key_match in re.finditer(
        r"(?:primary\s+key|unique(?:\s+nulls\s+not\s+distinct)?)\s*\(([^)]+)\)",
        block,
        re.IGNORECASE | re.DOTALL,
    ):
        columns = tuple(value.strip().lower() for value in key_match.group(1).split(","))
        if all(re.fullmatch(r"[a-z][a-z0-9_]*", value) for value in columns):
            unique_keys[table_name].add(columns)
for index_match in re.finditer(
    r"create\s+unique\s+index\s+[a-z0-9_]+\s+on\s+public\.([a-z0-9_]+)\s*\(([^)]+)\)(.*?);",
    schema_text,
    re.IGNORECASE | re.DOTALL,
):
    table_name, raw_columns, suffix = index_match.groups()
    if re.search(r"\bwhere\b", suffix, re.IGNORECASE):
        continue
    columns = tuple(value.strip().lower() for value in raw_columns.split(","))
    if all(re.fullmatch(r"[a-z][a-z0-9_]*", value) for value in columns):
        unique_keys[table_name.lower()].add(columns)
for owner_table, local_columns, target_table, target_columns in owned_composite_fks:
    require(
        target_columns in unique_keys.get(target_table, set()),
        f"schema.sql: FK {owner_table}{local_columns} references non-unique {target_table}{target_columns}",
    )
for table_name, block in table_blocks.items():
    if re.search(r"\borganization_id\b", block) and re.search(r"\bproject_id\b", block):
        require(
            any(owner == table_name and {"organization_id", "project_id"} <= set(columns) for owner, columns, _, _ in owned_composite_fks),
            f"schema.sql: project-bound table {table_name} lacks composite organization/project parent integrity",
        )

# Every inline UUID reference from one tenant-owned table to another must be
# reinforced by a composite FK that carries organization_id to the parent's
# organization_id. A globally unique UUID is not a tenant-integrity boundary.
tenant_tables = {name for name, block in table_blocks.items() if re.search(r"\borganization_id\b", block)}
for owner_table, block in table_blocks.items():
    if owner_table not in tenant_tables:
        continue
    inline_tenant_refs = re.findall(
        r"^\s*([a-z0-9_]+)\s+[^,\n]*?references\s+public\.([a-z0-9_]+)\s*\(\s*id\s*\)",
        block,
        re.IGNORECASE | re.MULTILINE,
    )
    for local_column, target_table in inline_tenant_refs:
        local_column = local_column.lower()
        target_table = target_table.lower()
        if local_column == "organization_id" or target_table not in tenant_tables:
            continue
        reinforced = False
        for relation_owner, local_columns, relation_target, target_columns in owned_composite_fks:
            if relation_owner != owner_table:
                continue
            if "organization_id" not in local_columns or local_column not in local_columns:
                continue
            org_index = local_columns.index("organization_id")
            id_index = local_columns.index(local_column)
            if len(target_columns) != len(local_columns) or target_columns[org_index] != "organization_id":
                continue
            if relation_target == target_table and target_columns[id_index] == "id":
                reinforced = True
                break
            if local_column == "project_id" and target_columns[id_index] == "project_id":
                reinforced = True
                break
        require(
            reinforced,
            f"schema.sql: tenant FK {owner_table}.{local_column} -> {target_table}.id lacks organization-bound composite reinforcement",
        )
for constraint_name in {
    "evidence_requests_requirement_subject_fk",
    "evidence_requests_fulfillment_subject_fk",
    "payment_reversals_payment_tenant_fk",
    "reconciliation_imports_job_tenant_fk",
    "upload_intents_work_tenant_fk",
    "upload_intents_assignment_subject_fk",
    "evidence_upload_intent_subject_fk",
    "evidence_capture_subject_fk",
    "evidence_links_occurrence_subject_fk",
    "quantity_correction_subject_fk",
    "waivers_occurrence_subject_fk",
    "package_decision_sets_package_tenant_fk",
    "package_decisions_set_subject_fk",
    "import_files_upload_intent_tenant_fk",
    "import_jobs_verified_file_tenant_fk",
    "notification_preferences_member_tenant_fk",
    "notifications_member_tenant_fk",
    "notification_deliveries_recipient_tenant_fk",
}:
    require(constraint_name in schema_lower, f"schema.sql: critical subject/tenant constraint missing: {constraint_name}")
invitation_block = table_blocks.get("invitations", "").lower()
require(
    "status = 'accepted'" in invitation_block
    and "mfa_verified_at is not null" in invitation_block
    and "accepted_terms_version is not null" in invitation_block
    and "accepted_privacy_notice_version is not null" in invitation_block,
    "schema.sql: accepted invitation must persist server-observed MFA and exact legal versions",
)
require(
    "foreign key (invitation_id, project_id) references public.invitation_project_scopes(invitation_id, project_id)" in table_blocks.get("invitation_location_scopes", "").lower()
    and "foreign key (membership_id, project_id) references public.membership_project_scopes(membership_id, project_id)" in table_blocks.get("membership_location_scopes", "").lower(),
    "schema.sql: location scopes must be children of an explicitly allowed project scope",
)
decision_set_block = table_blocks.get("package_decision_sets", "").lower()
decision_item_block = table_blocks.get("package_decision_items", "").lower()
package_version_columns = set(re.findall(r"^\s*([a-z_][a-z0-9_]*)\s+", table_blocks.get("package_versions", "").lower(), re.MULTILINE))
receivable_columns = set(re.findall(r"^\s*([a-z_][a-z0-9_]*)\s+", table_blocks.get("receivables", "").lower(), re.MULTILINE))
acceptance_columns = set(re.findall(r"^\s*([a-z_][a-z0-9_]*)\s+", table_blocks.get("acceptance_records", "").lower(), re.MULTILINE))
require(
    {"document_number", "numbering_sequence", "numbering_series_id"} <= package_version_columns
    and "numbering_series" in tables
    and "package_number_reservations" in tables
    and "unique (numbering_series_id, sequence_no)" in table_blocks.get("package_number_reservations", "").lower()
    and "next_sequence" in table_blocks.get("numbering_series", "").lower(),
    "schema.sql: package document numbering must use an immutable server-owned stable series",
)
require(
    "acceptance_record_id" in receivable_columns
    and {"supersedes_acceptance_record_id", "lineage_root_id", "package_version", "version", "is_current"} <= acceptance_columns
    and "receivables_acceptance_tenant_fk" in schema_lower,
    "schema.sql: receivable must retain exact single-head append-only acceptance lineage",
)
require(
    {"member_offboarding_previews", "member_offboarding_preview_items", "offline_authorization_leases"} <= tables
    and "offline_capture_policy" in table_blocks.get("member_offboarding_preview_items", "").lower()
    and "authorization_lease_id" in table_blocks.get("capture_sessions", "").lower()
    and "authorization_lease_id" in table_blocks.get("upload_intents", "").lower(),
    "schema.sql: organization-wide offboarding and offline authorization proof must be normalized and capture-bound",
)
require(
    {"manual_decision", "source_reference", "source_actor_label", "source_decided_at", "source_receipt_hash", "reconciliation_receipt_hash", "returned_total_minor"}
    <= set(re.findall(r"^\s*([a-z_][a-z0-9_]*)\s+", decision_set_block, re.MULTILINE)),
    "schema.sql: package decision set does not persist separate source/reconciliation facts and totals",
)
require(
    "state text not null default 'pending'" in decision_item_block
    and "version bigint not null default 1" in decision_item_block
    and "decision = 'accepted' and modified_amount_minor = submitted_amount_minor" in decision_item_block
    and "decision = 'returned' and modified_amount_minor = 0" in decision_item_block,
    "schema.sql: pending package decision items lost versioning or deterministic amount invariants",
)
require(
    "version bigint not null default 1" in table_blocks.get("evidence_objects", "").lower(),
    "schema.sql: evidence invalidation targetVersion has no persisted optimistic version",
)

# Every row that carries an object-storage key also carries its lifecycle class
# and integrity metadata. This prevents unclassified/orphaned bytes from
# bypassing export, legal-hold and deletion decisions.
storage_contracts = {
    "upload_intents": {"object_key", "retention_class", "expected_sha256", "expected_byte_size", "declared_mime_type"},
    "evidence_objects": {"storage_key", "retention_class", "sha256", "byte_size", "mime_type"},
    "package_versions": {"manifest_storage_key", "manifest_retention_class", "manifest_sha256", "manifest_byte_size", "manifest_mime_type"},
    "package_artifacts": {"storage_key", "retention_class", "sha256", "byte_size", "mime_type"},
    "export_jobs": {"storage_key", "retention_class", "storage_sha256", "storage_byte_size", "storage_mime_type"},
    "import_files": {"storage_key", "retention_class", "sha256", "byte_size", "detected_mime_type"},
    "reference_document_versions": {"storage_key", "retention_class", "sha256", "byte_size", "mime_type"},
}
for table_name, required_columns in storage_contracts.items():
    block = table_blocks.get(table_name, "")
    missing_columns = sorted(column for column in required_columns if re.search(rf"\b{re.escape(column)}\b", block) is None)
    require(not missing_columns, f"schema.sql: storage row {table_name} lacks lifecycle/integrity columns {missing_columns}")
require(
    "unique (organization_id, client_operation_id)" in table_blocks.get("payment_reversals", "").lower(),
    "schema.sql: payment reversal lost durable per-tenant command idempotency",
)

access_rows = csv_rows["data-access-surface.csv"]
require(len(access_rows) >= 118, f"data-access-surface.csv: expected at least 118 explicit surfaces, found {len(access_rows)}")
access_by_object = {row["object_name"]: row for row in access_rows if row["schema"] == "public" and row["object_type"] == "table"}
require(
    access_by_object.get("work_items", {}).get("privileges") == "SELECT|INSERT|UPDATE(status,version,projection_updated_at)",
    "data-access-surface.csv: work_items UPDATE must be column-limited to the rebuildable projection cache",
)
require(
    access_by_object.get("work_item_locations", {}).get("privileges") == "SELECT|INSERT",
    "data-access-surface.csv: immutable work_item_locations baseline must not grant UPDATE/DELETE",
)
mapped_public_tables = {row["object_name"] for row in access_rows if row["object_type"] == "table" and row["schema"] == "public"}
require(tables == mapped_public_tables, f"data-access-surface.csv: SQL/access table mismatch missing={sorted(tables - mapped_public_tables)} extra={sorted(mapped_public_tables - tables)}")
table_release_sets: dict[str, set[str]] = defaultdict(set)
for row in access_rows:
    require(row["release"] in {"Pilot", "GA", "All"}, f"data-access-surface.csv: invalid release for {row['surface_id']}")
    require(row["client_exposed"] in {"true", "false"}, f"data-access-surface.csv: invalid client_exposed for {row['surface_id']}")
    if row["schema"] == "public":
        require(row["client_exposed"] == "false", f"data-access-surface.csv: public object exposed to client at {row['surface_id']}")
    if row["object_type"] == "table" and row["schema"] == "public":
        require(row["release"] in {"Pilot", "GA"}, f"data-access-surface.csv: public table {row['object_name']} needs Pilot or GA release")
        table_release_sets[row["object_name"]].add(row["release"])
for table_name, releases in table_release_sets.items():
    require(len(releases) == 1, f"data-access-surface.csv: {table_name} has mixed releases {sorted(releases)}")
table_releases = {table_name: next(iter(releases)) for table_name, releases in table_release_sets.items() if releases}
service_role_rows = [row for row in access_rows if row["db_role"] == "service_role"]
require(len(service_role_rows) == 1 and service_role_rows[0]["status"] == "prohibited-runtime", "data-access-surface.csv: service_role must have one prohibited-runtime entry")
tenant_billing_rows = {
    row["object_name"]: row
    for row in access_rows
    if row["db_role"] == "aktflow_app" and row["object_name"] in {"saas_invoices", "saas_payments", "saas_invoice_adjustments", "saas_payment_reversals"}
}
require(
    set(tenant_billing_rows) == {"saas_invoices", "saas_payments", "saas_invoice_adjustments", "saas_payment_reversals"}
    and all(row["privileges"] == "SELECT" for row in tenant_billing_rows.values()),
    "data-access-surface.csv: tenant role must be read-only on all SaaS invoice/payment/adjustment tables",
)
platform_billing_rows = [row for row in access_rows if row["db_role"] == "aktflow_platform_billing"]
require(
    {row["object_name"] for row in platform_billing_rows}
    == {"aktflow_platform_billing", "saas_invoices", "saas_payments", "saas_invoice_adjustments", "saas_payment_reversals"}
    and all(row["rls_policy_family"] == "platform_billing_actor_context" for row in platform_billing_rows),
    "data-access-surface.csv: isolated platform billing role/surface is incomplete",
)
require(
    all(row["consumer"] == "platform_billing_bff" for row in platform_billing_rows),
    "data-access-surface.csv: platform billing role leaked to a non-platform consumer",
)

retention_rows = csv_rows["data-retention-catalog.csv"]
retention_by_table = {row["object_name"]: row for row in retention_rows}
retention_classes = {
    "identity_access", "security_audit", "contract_baseline", "evidence_original",
    "evidence_derivative", "package_artifact", "project_commercial", "saas_billing",
    "support_incident", "analytics_minimized", "temporary_export",
}
require(
    set(retention_by_table) == tables,
    f"data-retention-catalog.csv: SQL/retention mapping mismatch missing={sorted(tables - set(retention_by_table))} extra={sorted(set(retention_by_table) - tables)}",
)
for table_name, row in retention_by_table.items():
    ref = f"data-retention-catalog.csv:{table_name}"
    allowed = set(split_refs(row["allowed_classes"]))
    require(bool(allowed) and allowed <= retention_classes, f"{ref}: unknown or blank retention classes {sorted(allowed - retention_classes)}")
    require(row["release"] == table_releases.get(table_name), f"{ref}: release differs from access catalog {table_releases.get(table_name)}")
    require(row["personal_data"] in {"false", "possible", "true"}, f"{ref}: invalid personal_data value")
    require(row["policy_status"] == "duration_external_gate", f"{ref}: duration must remain externally gated until V-003 evidence exists")
    require(row["external_gate"] == "V-003", f"{ref}: retention duration must trace to V-003")
    source = row["retention_class_source"]
    if source.startswith("fixed:"):
        require(source.removeprefix("fixed:") in allowed and len(allowed) == 1, f"{ref}: fixed class and allowlist disagree")
    elif source.startswith("row:"):
        column = source.removeprefix("row:")
        require(re.search(rf"\b{re.escape(column)}\b", table_blocks.get(table_name, "")) is not None, f"{ref}: row class column {column} does not exist")
    else:
        require(False, f"{ref}: unsupported retention_class_source {source}")

alias_rows = csv_rows["entity-aliases.csv"]
required_aliases = {
    "profiles", "project_memberships", "import_rows", "reporting_calendars", "waivers",
    "evidence_derivatives", "variation_lines", "variation_communications", "retention_schedules",
    "product_plans", "features", "plan_entitlements", "subscription_addons", "usage_events",
    "saas_invoice_lines", "saas_payment_allocations", "credits",
    "capture_tasks", "evidence_requirement_occurrences", "controlled_reference_revisions",
    "cost_code",
}
require({row["documented_name"] for row in alias_rows} == required_aliases, "entity-aliases.csv: canonical conceptual-name inventory changed without explicit validator update")
for row in alias_rows:
    ref = f"entity-aliases.csv:{row['documented_name']}"
    require(row["release"] in {"Pilot", "GA"}, f"{ref}: invalid release")
    require(row["status"] in {"alias", "deferred", "external"}, f"{ref}: invalid status")
    require(bool(row["implementation_boundary"].strip()), f"{ref}: missing implementation boundary")
    target = row["canonical_target"]
    if target.startswith("table:"):
        require(target.removeprefix("table:") in tables, f"{ref}: unknown target table {target}")
    elif target.startswith("column:"):
        table_column = target.removeprefix("column:")
        require("." in table_column, f"{ref}: malformed column target {target}")
        if "." in table_column:
            table_name, column_name = table_column.split(".", 1)
            require(table_name in tables, f"{ref}: unknown target table {table_name}")
            require(re.search(rf"\b{re.escape(column_name)}\b", table_blocks.get(table_name, "")) is not None, f"{ref}: unknown target column {table_column}")
    elif target.startswith("external:"):
        require(row["status"] == "external", f"{ref}: external target must have external status")
    else:
        require(False, f"{ref}: unsupported canonical target {target}")

state_columns = {
    "organizations": ("organization", "status"),
    "memberships": ("membership", "status"),
    "invitations": ("invitation", "status"),
    "projects": ("project", "status"),
    "contracts": ("contract", "status"),
    "contract_versions": ("contract_version", "status"),
    "import_jobs": ("import_job", "state"),
    "import_row_results": ("import_row", "state"),
    "upload_intents": ("upload_intent", "state"),
    "work_items": ("work_item", "status"),
    "evidence_rule_versions": ("rule_version", "status"),
    "rule_pack_versions": ("rule_version", "state"),
    "work_item_requirements": ("requirement", "state"),
    "evidence_requests": ("evidence_request", "state"),
    "capture_sessions": ("capture_session", "state"),
    "variations": ("variation", "state"),
    "reporting_periods": ("period", "state"),
    "package_versions": ("package", "state"),
    "receivables": ("receivable", "state"),
    "acceptance_records": ("acceptance", "state"),
    "external_shares": ("external_share", "state"),
    "subscriptions": ("subscription", "state"),
    "saas_invoices": ("saas_invoice", "state"),
    "jobs": ("job", "state"),
    "notification_deliveries": ("notification_delivery", "state"),
    "export_jobs": ("export_job", "state"),
    "deletion_jobs": ("deletion_job", "state"),
    "readiness_snapshots": ("readiness", "state"),
    "ownership_transfers": ("ownership_transfer", "state"),
    "integration_connections": ("integration", "state"),
    "webhook_deliveries": ("webhook_delivery", "state"),
    "contract_term_versions": ("contract_terms", "state"),
    "work_assignments": ("work_assignment", "state"),
    "requirement_occurrences": ("requirement_occurrence", "state"),
    "reference_document_versions": ("reference_document", "state"),
    "typed_evidence_records": ("typed_evidence", "validation_state"),
    "review_tasks": ("review_task", "state"),
    "package_decision_items": ("package_decision_item", "state"),
    "package_decision_sets": ("package_decision_set", "state"),
    "requirement_waivers": ("requirement_waiver", "state"),
    "period_close_cycles": ("period_close_cycle", "state"),
    "member_offboarding_plans": ("member_offboarding_plan", "state"),
    "package_decision_issues": ("package_decision_issue", "state"),
    "numbering_series": ("numbering_series", "state"),
}
membership_role_match = re.search(r"\brole\s+text\b.*?check\s*\(\s*role\s+in\s*\(([^)]+)\)", table_blocks.get("memberships", ""), re.IGNORECASE | re.DOTALL)
require(membership_role_match is not None, "schema.sql: cannot resolve memberships.role check")
if membership_role_match:
    sql_tenant_roles = set(re.findall(r"'([^']+)'", membership_role_match.group(1)))
    require(sql_tenant_roles == expected_tenant_roles, f"schema/permissions tenant-role mismatch: sql-only={sorted(sql_tenant_roles - expected_tenant_roles)} permissions-only={sorted(expected_tenant_roles - sql_tenant_roles)}")
upload_purpose_match = re.search(r"\bpurpose\s+text\b.*?check\s*\(\s*purpose\s+in\s*\(([^)]+)\)", table_blocks.get("upload_intents", ""), re.IGNORECASE | re.DOTALL)
require(upload_purpose_match is not None, "schema.sql: cannot resolve upload_intents.purpose check")
if upload_purpose_match:
    sql_upload_purposes = set(re.findall(r"'([^']+)'", upload_purpose_match.group(1)))
    require(sql_upload_purposes == upload_purposes, f"schema/openapi upload-purpose mismatch: sql-only={sorted(sql_upload_purposes - upload_purposes)} api-only={sorted(upload_purposes - sql_upload_purposes)}")
for table, (domain, column) in state_columns.items():
    block = table_blocks.get(table, "")
    match = re.search(rf"\b{column}\s+text\b.*?check\s*\(\s*{column}\s+in\s*\(([^)]+)\)", block, re.IGNORECASE | re.DOTALL)
    require(match is not None, f"schema.sql: cannot resolve {table}.{column} state check")
    if match:
        sql_states = set(re.findall(r"'([^']+)'", match.group(1)))
        require(sql_states == catalog_by_domain[domain], f"schema/state mismatch {table}.{column} vs {domain}: sql-only={sorted(sql_states - catalog_by_domain[domain])} catalog-only={sorted(catalog_by_domain[domain] - sql_states)}")
    # A column default that skips the declared initial state silently bypasses
    # the guarded entry transitions (activation, MFA-gated accept, publish).
    default_match = re.search(rf"\b{column}\s+text\s+not\s+null\s+default\s+'([a-z_]+)'", block, re.IGNORECASE)
    if default_match and domain in declared_initial_states:
        require(
            default_match.group(1) == declared_initial_states[domain],
            f"schema.sql: {table}.{column} default '{default_match.group(1)}' must equal declared initial state '{declared_initial_states[domain]}' of {domain}",
        )
    domain_releases = {row["release"] for row in csv_rows["state-catalog.csv"] if row["domain"] == domain}
    earliest_domain_release = "Pilot" if "Pilot" in domain_releases else "GA"
    require(table_releases.get(table) == earliest_domain_release, f"release mismatch: {table} access is {table_releases.get(table)} but {domain} starts in {earliest_domain_release}")


# ---------------------------------------------------------------------------
# Traceability, backlog graph, external gates and global test references
# ---------------------------------------------------------------------------

external_register_text = (DOCS / "30-validation-evidence-register.md").read_text(encoding="utf-8")
external_gates = set(re.findall(r"^\|\s*(V-\d{3})\s*\|", external_register_text, re.MULTILINE))
require(external_gates == {f"V-{index:03d}" for index in range(1, 13)}, "validation register must define exactly V-001..V-012")
require("all V-001–V-012 remain `unvalidated`" in external_register_text, "validation register must preserve explicit unvalidated status")

def validate_flow_token(token: str) -> bool:
    if token in flow_ids:
        return True
    match = re.fullmatch(r"(F\d{2})-(F\d{2})", token)
    if not match or match.group(1) not in flow_ids or match.group(2) not in flow_ids:
        return False
    return int(match.group(1)[1:]) <= int(match.group(2)[1:])


trace_rows = csv_rows["traceability.csv"]
trace_flow_coverage: set[str] = set()
for row in trace_rows:
    ref = f"traceability.csv:{row['requirement_id']}"
    require(row["release"] in {"Pilot", "GA", "Pilot-GA"}, f"{ref}: invalid release {row['release']}")
    flow_tokens = split_refs(row["flow_id"])
    require(all(validate_flow_token(token) for token in flow_tokens), f"{ref}: invalid flow token(s) {flow_tokens}")
    for token in flow_tokens:
        if token in flow_ids:
            trace_flow_coverage.add(token)
        else:
            start, end = (int(value[1:]) for value in token.split("-"))
            trace_flow_coverage.update(f"F{index:02d}" for index in range(start, end + 1))
    require_refs(ref + " screens", split_refs(row["primary_screens"]), screen_ids, sentinels={"all_critical", "notification_center", "platform_only"})
    require_refs(ref + " domains", split_refs(row["transition_domains"]), state_domains)
    require_refs(ref + " resources", split_refs(row["permission_resources"]), permission_resources)
    require_refs(ref + " operations", split_refs(row["operation_ids"]), set(operations), sentinels={"all_x_release_operations"})
    if row["release"] in {"Pilot", "GA"}:
        for operation_id in split_refs(row["operation_ids"]):
            if operation_id in operations:
                operation_release = operations[operation_id][2].get("x-release")
                require(operation_release == row["release"], f"{ref}: {operation_id} is {operation_release} but requirement is {row['release']}")
    require_refs(ref + " data", split_refs(row["data_entities"]), tables)
    if row["release"] == "Pilot":
        for entity in split_refs(row["data_entities"]):
            if entity in tables:
                require(table_releases.get(entity) == "Pilot", f"{ref}: Pilot requirement depends on GA table {entity}")
    require_refs(ref + " events", split_refs(row["audit_events"]), events)
    require_refs(ref + " tests", split_refs(row["test_ids"]), tests)
    require_refs(ref + " gates", split_refs(row["external_gates"]), external_gates)
require(trace_flow_coverage == flow_ids, f"traceability.csv: uncovered flows {sorted(flow_ids - trace_flow_coverage)}")

referenced_operation_ids = {
    value
    for row in trace_rows
    for value in split_refs(row["operation_ids"])
    if value not in {"all_x_release_operations"}
}
require(not (referenced_operation_ids - set(operations)), "traceability.csv: operation reference mismatch")
require(referenced_operation_ids == set(operations), f"traceability.csv: unowned operations {sorted(set(operations) - referenced_operation_ids)}")
referenced_state_domains = {value for row in trace_rows for value in split_refs(row["transition_domains"]) if value != "none"}
require(referenced_state_domains == state_domains, f"traceability.csv: unowned state domains {sorted(state_domains - referenced_state_domains)}")
referenced_permission_resources = {value for row in trace_rows for value in split_refs(row["permission_resources"]) if value != "none"}
require(referenced_permission_resources == permission_resources, f"traceability.csv: unowned permission resources {sorted(permission_resources - referenced_permission_resources)}")
referenced_events = {value for row in trace_rows for value in split_refs(row["audit_events"]) if value != "none"}
require(referenced_events == events, f"traceability.csv: unowned events {sorted(events - referenced_events)}")

# Backlog dependency-graph checks retired with implementation-backlog.csv
# (archived to docs/legacy/ per the user-approved cleanup).

test_reference_pattern = re.compile(r"\bT-[A-Z0-9]+(?:-[A-Z0-9]+)+\b")
global_test_refs: set[str] = set()
reference_files = [ROOT / "README.md", *DOCS.glob("*.md"), *TECH.glob("*.csv")]
for path in reference_files:
    if path.name == "test-catalog.csv":
        continue
    global_test_refs.update(test_reference_pattern.findall(path.read_text(encoding="utf-8")))
require_refs("global test references", global_test_refs, tests, sentinels=set())
# These tests were referenced only by implementation-backlog.csv, which was
# archived to docs/legacy/ per the user-approved cleanup. The archive is
# non-normative and deliberately not swept, so the historical references are
# recorded here instead of silently widening the sweep to legacy material.
ARCHIVED_BACKLOG_TEST_REFS = {
    "T-ADAPTER-002", "T-BOQ-LINE-TYPE-001", "T-DELETION-EXEC-001",
    "T-PERIOD-CLAIM-001", "T-RATE-LIMIT-001", "T-REIMPORT-LINEAGE-001",
    "T-REPEATABILITY-001", "T-STATE-RECOVERY-001", "T-TERMS-EFFECTIVE-001",
    "T-UAT-001",
}
require(
    tests <= (global_test_refs | ARCHIVED_BACKLOG_TEST_REFS),
    f"test-catalog.csv: orphan tests {sorted(tests - global_test_refs - ARCHIVED_BACKLOG_TEST_REFS)}",
)


# ---------------------------------------------------------------------------
# Prototype critical routes and evidence loops
# ---------------------------------------------------------------------------

app_text = (ROOT / "prototype" / "src" / "App.jsx").read_text(encoding="utf-8")
styles_text = (ROOT / "prototype" / "src" / "styles.css").read_text(encoding="utf-8")
require("Functional closure v2.9" in styles_text and "Functional closure v2.5" not in styles_text, "prototype styles.css: package-owned closure version label is stale")
required_routes = {
    "/", "/pilot", "/login", "/invite/demo", "/onboarding", "/app", "/app/work",
    "/app/evidence", "/app/rules", "/app/variations", "/app/close", "/app/packages",
    "/app/packages/current", "/app/payments", "/app/team", "/app/billing", "/app/baseline",
    "/app/assignments", "/app/occurrences/demo", "/review/demo", "/field",
}
for route in required_routes:
    require(f'path="{route}"' in app_text, f"prototype App.jsx: missing route {route}")

rules_text = (ROOT / "prototype" / "src" / "pages" / "Rules.jsx").read_text(encoding="utf-8")
evidence_text = (ROOT / "prototype" / "src" / "pages" / "Evidence.jsx").read_text(encoding="utf-8")
qa_text = (ROOT / "prototype" / "qa" / "verify.mjs").read_text(encoding="utf-8")
for marker in ("RULE_IMPACT_STALE", "previewFresh", "impact-ack", "rule-publish-dialog", "v2 стала незмінною версією"):
    require(marker in rules_text, f"prototype Rules.jsx: missing critical contract marker {marker}")
for marker in ("CAP-742-R2", "RCP-742-R2", "RVW-2207-91", "CAP-742 · оригінал незмінний"):
    require(marker in evidence_text, f"prototype Evidence.jsx: missing correction-lineage marker {marker}")
for marker in ("specVersion: '2.9.0'", "partial-assignment-row-receipts", "resumable-package-decision-set", "assignment-reassignment-receipt", "reference-acknowledgement-receipt", "organization-wide-member-offboarding", "offline-authorization-lease", "read-model-closure", "deterministic-occurrence-strategies", "post-invalidation-capture-quarantine", "canonical-rule-preview-payload", "staged-offboarding-plan", "stale rule preview did not block publish", "published rule version remains editable", "correction server receipt missing", "rules mobile horizontal overflow", "rule publish dialog did not restore focus", "pilot opaque receipt missing", "single work creation receipt missing", "evidence request receipt missing", "package submission receipt missing", "external acceptance receipt missing", "team invitation receipt missing", "contract terms publish receipt missing", "assignment occurrence receipt missing", "hold point concealment receipt missing", "package line decision receipt missing"):
    require(marker in qa_text, f"prototype QA: missing assertion {marker}")

qa_report_path = ROOT / "prototype" / "qa-results.json"
if qa_report_path.exists():
    try:
        qa_report = json.loads(qa_report_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        qa_report = {}
        require(False, f"prototype qa-results.json: invalid JSON: {error}")
    require(qa_report.get("ok") is True, "prototype qa-results.json: attached baseline smoke did not pass")
    require(not qa_report.get("findings"), "prototype qa-results.json: findings must be empty on pass")
    require(len(qa_report.get("flowFamilies", [])) == 17, "prototype qa-results.json: expected 17 flow families")
    require(len(qa_report.get("screenshots", [])) >= 19, "prototype qa-results.json: expected at least 19 screenshots")
    for screenshot in qa_report.get("screenshots", []):
        require((ROOT / "prototype" / "qa-screenshots" / screenshot).exists(), f"prototype qa-results.json: missing screenshot {screenshot}")


METRICS.update({
    "required_artifacts": len(required_files),
    "documents": len(doc_numbers),
    "sql_tables": len(tables),
    "access_surfaces": len(access_rows),
    "states": len(states),
    "transitions": len(csv_rows["state-transitions.csv"]),
    "errors": len(errors),
    "api_operations": len(operations),
    "requirements": len(trace_rows),
    "test_contracts": len(tests),
    "ui_actions": len(ui_action_rows),
    "entity_aliases": len(alias_rows),
    "retention_mappings": len(retention_rows),
    "command_availability_rules": len(command_rows),
    "external_gates_unvalidated": len(external_gates),
})

if FAILURES:
    print(f"AktFlow package validation: FAILED ({len(FAILURES)} findings)")
    for failure in FAILURES:
        print(f"- {failure}")
    sys.exit(1)

metric_text = ", ".join(f"{key}={value}" for key, value in METRICS.items())
print(f"AktFlow package validation: PASS ({metric_text})")
print("External/runtime evidence status: NOT PROVEN; V-001..V-012 remain unvalidated by design.")
