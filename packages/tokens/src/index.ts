// Consumers import from "@goproceed/tokens", never from the generated path — so
// regenerating cannot break an import, and the generated file stays free to
// change shape.
export {
  primitive, primitiveOklch, color, shadow, component,
  font, text, fontWeight, leading, tracking, radius, space,
  breakpoint, container, duration, ease, stagger, spring, blur,
  type PrimitiveName, type RoleName, type ThemeName,
  type ShadowName, type BoxShadowValue,
} from "./tokens.generated";
