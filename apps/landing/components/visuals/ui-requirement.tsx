import { demoRecords } from "../../content/demo-records";
import { KeyValue, RuleBox, UiWindow } from "./ui-window";

export function UiRequirement() {
  const r = demoRecords.route.requirement;
  return (
    <UiWindow title={r.title} tag={r.tag}>
      <div>{r.rows.map((row, i) => <KeyValue key={row.label} label={row.label} value={row.value} first={i === 0} />)}</div>
      <RuleBox lead={r.rule.lead} text={r.rule.text} />
    </UiWindow>
  );
}
