from pathlib import Path
import json
import os
import nbformat as nbf


OUT = Path("/Users/akisliy/Downloads/GoProceed/outputs/01a033d9-c008-7011-bf7b-e1dbd14e2e9d")
WAVE = int(os.environ.get("PROSPECTING_WAVE", "7"))
VERSION = int(os.environ.get("PROSPECTING_VERSION", str(WAVE + 1)))
DATE_TAG = os.environ.get("PROSPECTING_DATE_TAG", "2026-08-24")
BASE_FILE = os.environ.get("PROSPECTS_BASE_FILE", f"prospects_unified_v{WAVE}_2026-08-24.json")
UNIFIED_FILE = os.environ.get("PROSPECTS_UNIFIED_FILE", f"prospects_unified_v{VERSION}_{DATE_TAG}.json")
NOTEBOOK = OUT / f"goproceed_wave{WAVE}_analysis_{DATE_TAG}.ipynb"

normalization_snapshot = json.loads((OUT / f"wave{WAVE}_normalization_summary_{DATE_TAG}.json").read_text(encoding="utf-8"))
validation_snapshot = json.loads((OUT / f"wave{WAVE}_v{VERSION}_validation_{DATE_TAG}.json").read_text(encoding="utf-8"))
unified_snapshot = json.loads((OUT / UNIFIED_FILE).read_text(encoding="utf-8"))
lane_snapshot = validation_snapshot["laneCounts"]
browser_file = OUT / f"wave{WAVE}_browser_verification_{DATE_TAG}.json"
browser_count = len(json.loads(browser_file.read_text(encoding="utf-8")).get("companies", [])) if browser_file.exists() else 0
base_count = normalization_snapshot["base_total"]
new_count = normalization_snapshot["unique_new_supplier_leads"]
overlap_count = normalization_snapshot["overlaps_with_base"]
total_count = len(unified_snapshot)


def md(text: str):
    return nbf.v4.new_markdown_cell(text)


def code(text: str):
    return nbf.v4.new_code_cell(text)


nb = nbf.v4.new_notebook()
nb["metadata"] = {
    "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
    "language_info": {"name": "python", "version": "3"},
}
nb["cells"] = [
    md(
        f"# GoProceed prospecting — Wave {WAVE} validation\n\n"
        f"Reproducible companion analysis for the unified lead base as of **{DATE_TAG}** "
        "(Europe/Kyiv). The objective is to expand the pool of construction-project prospects "
        "while preserving the previously reviewed 51 leads and avoiding false claims of product demand."
    ),
    md(
        "## tl;dr\n\n"
        f"Wave {WAVE} expands the reviewed base from {base_count:,} to {total_count:,} companies: "
        f"{new_count:,} net-new suppliers after merging {overlap_count:,} overlaps. The search adds "
        "road safety, rail and tram works, shelters, interior finishing, façades, windows/doors, accessibility, "
        "gas and water infrastructure, sports grounds, restoration and other project-heavy verticals. "
        "Tender awards are used only as workflow/activity signals—not as evidence that a company wants GoProceed."
    ),
    md(
        "## Context & Methods\n\n"
        f"Sources: the existing v{WAVE} prospect file, the official Prozorro API-derived Wave {WAVE} supplier set, "
        f"the normalization summary, browser-verification log and the v{VERSION} validation output. Records were filtered "
        "to awarded construction/installation work, then deduplicated primarily by EDRPOU. Design-only, expertise, "
        "supervision, inventory, survey, research, rental and training records were excluded.\n\n"
        "### Key Assumptions\n\n"
        "- A Prozorro award confirms legal/project activity, not product interest.\n"
        "- A future published completion date is a planning signal, not proof of an active site.\n"
        "- Current product coverage is limited to the seeded N.14/N.15 requirements.\n"
        "- Other verticals receive a two-week workflow-discovery offer, not a coverage claim.\n"
        "- Attributed award value is a prioritization signal and is not TAM or revenue."
    ),
    md("## Data"),
    code(
        "from pathlib import Path\n"
        "import json\n"
        "import pandas as pd\n"
        "from IPython.display import display\n\n"
        f"OUT = Path({str(OUT)!r})\n"
        "def load(name):\n"
        "    return json.loads((OUT / name).read_text(encoding='utf-8'))\n\n"
        f"base = load({BASE_FILE!r})\n"
        f"wave = load('prozorro_wave{WAVE}_supplier_leads_final_{DATE_TAG}.json')\n"
        f"wave_summary = load('prozorro_wave{WAVE}_summary_final_{DATE_TAG}.json')\n"
        f"normalization = load('wave{WAVE}_normalization_summary_{DATE_TAG}.json')\n"
        f"unified = load({UNIFIED_FILE!r})\n"
        f"validation = load('wave{WAVE}_v{VERSION}_validation_{DATE_TAG}.json')\n"
        f"browser_path = OUT / 'wave{WAVE}_browser_verification_{DATE_TAG}.json'\n"
        "browser_checks = json.loads(browser_path.read_text(encoding='utf-8')) if browser_path.exists() else {'companies': []}\n"
        "df = pd.DataFrame(unified)\n"
        f"wave_df = df[df['lead_id'].astype(str).str.startswith('W{WAVE}-')].copy()\n"
        f"print({{'base_rows': len(base), 'wave_supplier_candidates': len(wave), 'v{VERSION}_rows': len(df), 'browser_spot_checks': len(browser_checks['companies'])}})"
    ),
    md("## Results"),
    code(
        "lane_counts = df['lane'].value_counts().to_dict()\n"
        "intent_counts = df['intent_priority'].fillna('—').replace('', '—').value_counts().to_dict()\n"
        "headline = {\n"
        "    'total_leads': len(df),\n"
        f"    'unique_new_wave{WAVE}': normalization['unique_new_supplier_leads'],\n"
        f"    'wave{WAVE}_overlaps_merged': normalization['overlaps_with_base'],\n"
        "    'tender_signal_accounts': int((df['tender_count'].fillna(0) > 0).sum()),\n"
        "    'future_completion_signal_accounts': int((df['live_project_count'].fillna(0) > 0).sum()),\n"
        "    'high_confidence_accounts': int((df['evidence_confidence'] == 'high').sum()),\n"
        "    'pilot_now': lane_counts.get('Pilot now', 0),\n"
        "    'expansion_discovery': lane_counts.get('Expansion discovery', 0),\n"
        "    'intent_I1': intent_counts.get('I1', 0),\n"
        "    'intent_I2': intent_counts.get('I2', 0),\n"
        "}\n"
        "display(pd.DataFrame([headline]).T.rename(columns={0: 'value'}))"
    ),
    code(
        "assert validation['ok'] is True\n"
        "assert len(df) == validation['counts']['unified_rows']\n"
        "assert df['lead_id'].nunique() == len(df)\n"
        "edrpou = df['edrpou'].fillna('').astype(str).str.replace(r'\\D', '', regex=True)\n"
        "assert edrpou[edrpou.ne('')].nunique() == edrpou.ne('').sum()\n"
        "previous = df[df['wave'] == 'Перевірено 51 — 24.08']\n"
        "assert len(previous) == 51\n"
        "assert (previous['evidence_confidence'] == 'high').all()\n"
        "assert sum(lane_counts.values()) == len(df)\n"
        "print('Validation passed: unique IDs/EDRPOU, 51/51 prior leads preserved, lane totals reconcile.')"
    ),
    code(
        "top_cols = ['lead_id','company_name','edrpou','segment','lane','intent_score','intent_priority','tender_count','live_project_count','domain']\n"
        "display(wave_df.sort_values(['intent_score','total_award_value_uah'], ascending=False)[top_cols].head(15).reset_index(drop=True))"
    ),
    code(
        "lane_table = pd.Series(lane_counts, name='companies').rename_axis('recommended route').reset_index()\n"
        "lane_table['share'] = (lane_table['companies'] / len(df)).map(lambda value: f'{value:.1%}')\n"
        "display(lane_table)"
    ),
    code(
        f"segment_counts = wave_df['segment'].value_counts().rename_axis('Wave {WAVE} segment').reset_index(name='new companies')\n"
        "display(segment_counts.head(15))"
    ),
    md(
        "## Takeaways\n\n"
        "1. The lead pool is materially broader than sanitary-technical and electrical installation alone. "
        f"Wave {WAVE} contributes {new_count:,} net-new companies after merging {overlap_count:,} overlaps.\n"
        f"2. The nearest-term motion remains split: {lane_snapshot.get('Pilot now', 0):,} accounts can receive an N.14/N.15 pilot message, "
        f"while {lane_snapshot.get('Expansion discovery', 0):,} should receive an honest workflow-discovery message.\n"
        "3. All prior 51 leads remain present and high confidence.\n"
        "4. The database is ready for prioritization and outreach, but not for claiming validated demand: "
        "the current evidence base still has zero replies, interviews or pilot commitments."
    ),
]

nbf.write(nb, NOTEBOOK)
print(NOTEBOOK)
