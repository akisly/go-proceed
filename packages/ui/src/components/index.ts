/**
 * The component inventory.
 *
 * The list is short on purpose. The system's own rule is "install only what
 * earns its place — an unused variant is the first thing to drift", and a
 * package of speculative components is a set of things whose contrast, touch
 * targets and states nobody has checked against real content.
 *
 * `Table` (rebuilt), `DataTable`, `Form`, `Label`, `Select` and `Checkbox`
 * arrived with Plan D's foundation correction (2026-08-23): the owner asked
 * for shadcn/ui one-to-one and TanStack Table for tables. Each names its
 * source file and its licence in its own header. `Table` and `DataTable` have
 * callers; `Form`, `Label`, `Select` and `Checkbox` were named by the same
 * instruction and are here ahead of the screen that will use them.
 *
 * WHAT IS DELIBERATELY NOT HERE, and when it arrives:
 *   Drawer, Popover, CommandPalette — with the screen that needs them; Radix
 *     ships them in the dependency this package already has.
 *   Combobox, DatePicker, Radio, Switch — with the field that needs them.
 *   DataTableToolbar, DataTablePagination, DataTableBulkActions — what the
 *     reference wraps its table in. `DataTable.tsx` says what each would cost.
 *   Toast — nothing in v0.1 is transient enough to need one, and a refusal the
 *     user must be able to re-read must not be able to disappear.
 *   Breadcrumb, Pagination, Timeline, Stepper — no screen needs them yet.
 *
 * TWO DUPLICATIONS THIS PACKAGE CARRIES ON PURPOSE, named so they cannot go
 * unnoticed. Both are the cost of taking shadcn into a package that already
 * had hand-written answers, and both are decisions for the first screen that
 * has to choose between them.
 *
 *   1. RESOLVED 2026-08-28 by taking shadcn's own answer. `Field` is now the
 *      shadcn Field family (ten components, presentational, paired with
 *      react-hook-form's `Controller` per the vendor's current guide); the
 *      render-prop `Field` this note used to describe is gone.
 *
 *      RETIRED 2026-08-30. `Form`/`FormField`/`FormItem`/… were left exported
 *      with no caller and no planned one, and the question «whoever needs it
 *      decides whether it stays» was answered by the kitchen-sink gate below:
 *      an export nothing renders is an export nobody looks at, which is
 *      exactly how `FieldSeparator` shipped with the wrong token. A grep of
 *      every `from "@goproceed/ui/components"` import in the repo found zero
 *      uses of the family, so the file is deleted rather than showcased.
 *   2. `Textarea` is exported from `Input.tsx`; shadcn's was not taken,
 *      because replacing a shipped control is a restyle rather than an
 *      addition. shadcn's differs in `field-sizing-content` and `min-h-16`
 *      against this one's `min-h-24`.
 */
export { cn, cx } from "./cn";

export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from "./Button";
export { Chip, type ChipTone } from "./Chip";
export { Panel, PanelHeader, PanelBody } from "./Panel";
export {
  Field, FieldContent, FieldDescription, FieldError, FieldGroup,
  FieldLabel, FieldLegend, FieldSeparator, FieldSet, FieldTitle,
} from "./Field";
export { Input, Textarea } from "./Input";
export { Label } from "./Label";
export { Checkbox } from "./Checkbox";
export { Banner } from "./Banner";
export { EmptyState } from "./EmptyState";
export { Skeleton } from "./Skeleton";
export { Separator } from "./Separator";
export { Tooltip, TooltipProvider } from "./Tooltip";
export { Accordion, type AccordionEntry } from "./Accordion";
export { Meter, type MeterSegment } from "./Meter";
export { Figure } from "./Figure";
export { Pill, PillContent } from "./Pill";
export { SectionRule } from "./SectionRule";
export { FeatureGrid, FeatureCell } from "./FeatureGrid";
export { Bento, BentoCell } from "./Bento";
export { ComparePair, CompareCard, CompareArrow, type CompareRow } from "./Compare";
export {
  Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption,
} from "./Table";
export {
  DataTable, dataTableFeatures,
  type DataTableProps, type DataTableColumnDef, type DataTableFeatures, type SortingState,
} from "./DataTable";
export {
  Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem,
  SelectSeparator, SelectScrollUpButton, SelectScrollDownButton,
} from "./Select";
export {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from "./Dialog";
export {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "./DropdownMenu";
export { Avatar, AvatarFallback } from "./Avatar";
