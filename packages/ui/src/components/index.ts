/**
 * The component inventory.
 *
 * FIFTEEN, and the list is short on purpose. The system's own rule is "install
 * only what earns its place — an unused variant is the first thing to drift",
 * and a package of forty speculative components is forty things whose contrast,
 * touch targets and states nobody has checked against real content.
 *
 * What is deliberately NOT here, and when it arrives:
 *   Dialog, Drawer, DropdownMenu, Popover, CommandPalette — Phase 4, with the
 *     app shell that needs them. Radix ships all of them in the one dependency
 *     already installed, so this is scheduling, not a gap.
 *   Select, Combobox, DatePicker, Checkbox, Radio, Switch — with the first real
 *     form. v1's ruling stands: a Radix Select would be far more compact for
 *     the register's eight filter options and is the WRONG control there,
 *     because the visible option set is the demo's claim.
 *   Toast — nothing in v0.1 is transient enough to need one, and a refusal the
 *     user must be able to re-read must not be able to disappear.
 *   Avatar, Breadcrumb, Pagination, Timeline, Stepper — no screen needs them
 *     yet.
 */
export { cn, cx } from "./cn";

export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from "./Button";
export { Chip, type ChipTone } from "./Chip";
export { Panel, PanelHeader, PanelBody } from "./Panel";
export { Field } from "./Field";
export { Input, Textarea } from "./Input";
export { Banner } from "./Banner";
export { EmptyState } from "./EmptyState";
export { Skeleton } from "./Skeleton";
export { Separator } from "./Separator";
export { Tooltip, TooltipProvider } from "./Tooltip";
export { Accordion, type AccordionEntry } from "./Accordion";
export { Meter, type MeterSegment } from "./Meter";
export { Figure } from "./Figure";
export { Table, Th, Td, Tr } from "./Table";
