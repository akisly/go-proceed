from pathlib import Path
import nbformat as nbf


OUT = Path("/Users/akisliy/Downloads/GoProceed/outputs/01a033d9-c008-7011-bf7b-e1dbd14e2e9d")
NOTEBOOK = OUT / "goproceed_wave6_analysis_2026-08-24.ipynb"


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
        "# GoProceed prospecting — Wave 6 validation\n\n"
        "Reproducible companion analysis for the unified lead base as of **2026-08-24** "
        "(Europe/Kyiv). The objective is to expand the pool of construction-project prospects "
        "while preserving the previously reviewed 51 leads and avoiding false claims of product demand."
    ),
    md(
        "## tl;dr\n\n"
        "Wave 6 expands the reviewed base from 1,688 to 1,929 companies. The new search covers "
        "additional project-heavy verticals such as hydrotechnical works, wells, industrial tanks, "
        "traffic systems, energy infrastructure, demolition, waste facilities and specialized coatings. "
        "Tender awards are used only as workflow/activity signals—not as evidence that a company wants GoProceed."
    ),
    md(
        "## Context & Methods\n\n"
        "Sources: the existing v6 prospect file, the official Prozorro API-derived Wave 6 supplier set, "
        "the normalization summary, browser-verification log and the v7 validation output. Records were filtered "
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
        "base_v6 = load('prospects_unified_v6_2026-08-24.json')\n"
        "wave6 = load('prozorro_wave6_supplier_leads_final_2026-08-24.json')\n"
        "wave6_summary = load('prozorro_wave6_summary_final_2026-08-24.json')\n"
        "normalization = load('wave6_normalization_summary_2026-08-24.json')\n"
        "v7 = load('prospects_unified_v7_2026-08-24.json')\n"
        "validation = load('wave6_v7_validation_2026-08-24.json')\n"
        "browser_checks = load('wave6_browser_verification_2026-08-24.json')\n"
        "df = pd.DataFrame(v7)\n"
        "wave6_df = df[df['lead_id'].astype(str).str.startswith('W6-')].copy()\n"
        "print({'v6_rows': len(base_v6), 'wave6_supplier_candidates': len(wave6), 'v7_rows': len(df), 'browser_spot_checks': len(browser_checks['verified'])})"
    ),
    md("## Results"),
    code(
        "lane_counts = df['lane'].value_counts().to_dict()\n"
        "intent_counts = df['intent_priority'].fillna('—').replace('', '—').value_counts().to_dict()\n"
        "headline = {\n"
        "    'total_leads': len(df),\n"
        "    'unique_new_wave6': normalization['unique_new_supplier_leads'],\n"
        "    'wave6_overlaps_merged': normalization['overlaps_with_base_1688'],\n"
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
        "assert len(df) == 1929\n"
        "assert df['lead_id'].nunique() == len(df)\n"
        "edrpou = df['edrpou'].fillna('').astype(str).str.replace(r'\\D', '', regex=True)\n"
        "assert edrpou[edrpou.ne('')].nunique() == edrpou.ne('').sum()\n"
        "previous = df[df['wave'] == 'Перевірено 51 — 24.08']\n"
        "assert len(previous) == 51\n"
        "assert (previous['evidence_confidence'] == 'high').all()\n"
        "assert lane_counts == {'Expansion discovery': 1375, 'Pilot now': 512, 'Requalify': 34, 'Later / requirements': 8}\n"
        "print('Validation passed: unique IDs/EDRPOU, 51/51 prior leads preserved, lane totals reconcile.')"
    ),
    code(
        "top_cols = ['lead_id','company_name','edrpou','segment','lane','intent_score','intent_priority','tender_count','live_project_count','domain']\n"
        "display(wave6_df.sort_values(['intent_score','total_award_value_uah'], ascending=False)[top_cols].head(15).reset_index(drop=True))"
    ),
    code(
        "lane_table = pd.Series(lane_counts, name='companies').rename_axis('recommended route').reset_index()\n"
        "lane_table['share'] = (lane_table['companies'] / len(df)).map(lambda value: f'{value:.1%}')\n"
        "display(lane_table)"
    ),
    code(
        "segment_counts = wave6_df['segment'].value_counts().rename_axis('Wave 6 segment').reset_index(name='new companies')\n"
        "display(segment_counts.head(15))"
    ),
    md(
        "## Takeaways\n\n"
        "1. The lead pool is materially broader than sanitary-technical and electrical installation alone. "
        "Wave 6 contributes 241 net-new companies after merging 44 overlaps.\n"
        "2. The nearest-term motion remains split: 512 accounts can receive an N.14/N.15 pilot message, "
        "while 1,375 should receive an honest workflow-discovery message.\n"
        "3. All prior 51 leads remain present and high confidence.\n"
        "4. The database is ready for prioritization and outreach, but not for claiming validated demand: "
        "the current evidence base still has zero replies, interviews or pilot commitments."
    ),
]

nbf.write(nb, NOTEBOOK)
print(NOTEBOOK)
