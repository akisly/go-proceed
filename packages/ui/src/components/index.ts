/**
 * The component inventory.
 *
 * TWENTY-TWO FILES, and the list is still short on purpose. The system's own
 * rule is "install only what earns its place — an unused variant is the first
 * thing to drift", and a package of forty speculative components is forty
 * things whose contrast, touch targets and states nobody has checked against
 * real content.
 *
 * SIX ARRIVED WITH PLAN D'S FOUNDATION CORRECTION (2026-08-23) — Table
 * (rebuilt), DataTable, Form, Label, Select, Checkbox. Each names its source
 * file and its licence in its own header.
 *
 * WHAT PUT THEM HERE IS AN INSTRUCTION, NOT A SCREEN. The owner's correction
 * was «я же дал тебе указания использовать один в один из референсов, то же
 * самое shadcn», plus TanStack Table for tables and zod for validation: of the
 * seventeen components in this directory only three had come from shadcn/ui,
 * and the three tables in the product were hand-written `<table>` markup over
 * a hand-rolled `Table/Th/Td/Tr`. Table, DataTable and the two migrated
 * registers are that correction discharged and are used TODAY.
 *
 * Form, Label, Select and Checkbox are NOT. **No form exists in this tree.**
 * They are here because the same instruction named them and because D3's
 * assignment-creation form is the next slice, not because a screen currently
 * renders them — and saying otherwise in this file would be the one place a
 * reviewer cannot check it cheaply. Their only render today is
 * `/kitchen-sink/components` cases 12 and 13.
 *
 * WHAT IS DELIBERATELY NOT HERE, and when it arrives:
 *   Drawer, Popover, CommandPalette — with the screen that needs them. Radix
 *     ships all of them in the one dependency already installed, so this is
 *     scheduling, not a gap.
 *   Combobox, DatePicker, Radio, Switch — with the field that needs them.
 *     Select and Checkbox came in ahead of their field, for the reason above;
 *     these four did not, because nothing named them.
 *   DataTableToolbar, DataTablePagination, DataTableBulkActions — the three
 *     the reference wraps its table in. No screen in this product filters,
 *     paginates or selects rows yet; `DataTable.tsx`'s header says what each
 *     would cost and what has to be true first.
 *   Toast — nothing in v0.1 is transient enough to need one, and a refusal the
 *     user must be able to re-read must not be able to disappear.
 *   Breadcrumb, Pagination, Timeline, Stepper — no screen needs them yet.
 *
 * TWO DUPLICATIONS THIS PACKAGE NOW CARRIES ON PURPOSE, NAMED SO THEY CANNOT
 * GO UNNOTICED. Both are the cost of taking shadcn one-to-one into a package
 * that already had hand-written answers, and both are decisions for the first
 * real form to make with screens in front of it — not for this file to make
 * ahead of one.
 *
 *   1. `Field` (render prop, no library) vs `FormItem`/`FormLabel`/
 *      `FormControl`/`FormDescription`/`FormMessage` (react-hook-form
 *      context). They solve the same problem — id minting, `aria-describedby`,
 *      `aria-invalid`, an error that is never colour alone — by opposite
 *      mechanisms. `Form.tsx`'s header has the full comparison.
 *   2. `Textarea` is exported from `Input.tsx` and was NOT replaced by
 *      shadcn's, because replacing it is a restyle of a shipped control
 *      (`min-h-24` and this system's border and placeholder roles) rather than
 *      an addition, and mixing that into the foundation commit would make the
 *      foundation unreviewable. shadcn's textarea differs in exactly two ways
 *      worth recording: `field-sizing-content` (the control grows with its
 *      content) and `min-h-16`. Neither is a role; both are behaviour changes
 *      that need a screen to be judged against.
 */
export { cn, cx } from "./cn";

export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from "./Button";
export { Chip, type ChipTone } from "./Chip";
export { Panel, PanelHeader, PanelBody } from "./Panel";
export { Field } from "./Field";
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
export {
  Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption,
} from "./Table";
export {
  DataTable, dataTableFeatures,
  type DataTableProps, type DataTableColumnDef, type DataTableFeatures, type SortingState,
} from "./DataTable";
export {
  Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage, useFormField,
} from "./Form";
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
