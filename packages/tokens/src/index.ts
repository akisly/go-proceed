// Consumers import from "@aktflow/tokens", never from the generated path — so
// regenerating cannot break an import, and the generated file stays free to
// change shape.
export { color, colorRaw, type ColorName } from "./tokens.generated";
