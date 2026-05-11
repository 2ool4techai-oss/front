// ── Original components ────────────────────────────────────────────────
export { MetricCard } from './MetricCard.js';
export type { MetricCardProps } from './MetricCard.js';

export { SentientForm } from './SentientForm.js';
export type { SentientFormProps, FormField } from './SentientForm.js';

export { ReactiveTable } from './ReactiveTable.js';
export type { ReactiveTableProps, TableColumn } from './ReactiveTable.js';

export { EmotionBadge, withEmotionAdaptation } from './EmotionBadge.js';
export type { EmotionBadgeProps } from './EmotionBadge.js';

export { HealingCard } from './HealingCard.js';
export type { HealingCardProps } from './HealingCard.js';

// ── Interactive ────────────────────────────────────────────────────────
export { Button } from './Button.js';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button.js';

export { Input } from './Input.js';
export type { InputProps, InputType, WrappedInput } from './Input.js';

export { Dropdown } from './Dropdown.js';
export type { DropdownProps, DropdownOption } from './Dropdown.js';

export { Checkbox, Switch, RadioGroup } from './Checkbox.js';
export type { CheckboxProps, SwitchProps, RadioGroupProps } from './Checkbox.js';

export { Slider, Pagination, Breadcrumb } from './Pagination.js';
export type { SliderProps, PaginationProps, BreadcrumbProps, BreadcrumbItem } from './Pagination.js';

// ── Layout / Navigation ────────────────────────────────────────────────
export { Tabs } from './Tabs.js';
export type { TabsProps, TabItem, TabsVariant } from './Tabs.js';

export { Accordion } from './Accordion.js';
export type { AccordionProps, AccordionItem } from './Accordion.js';

// ── Feedback ──────────────────────────────────────────────────────────
export { Alert } from './Alert.js';
export type { AlertProps, AlertVariant } from './Alert.js';

export { Progress, CircularProgress } from './Progress.js';
export type { ProgressProps, CircularProgressProps, ProgressVariant, ProgressSize } from './Progress.js';

export { Skeleton, SkeletonCard } from './Skeleton.js';
export type { SkeletonProps, SkeletonVariant } from './Skeleton.js';

// ── Overlay ────────────────────────────────────────────────────────────
export { toast, mountToastContainer } from './Toast.js';
export type { ToastOptions, ToastHandle, ToastType } from './Toast.js';

export { createModal, confirm, alert } from './Modal.js';
export type { ModalOptions, ModalHandle } from './Modal.js';

export { createTooltip, createPopover } from './Tooltip.js';
export type { TooltipOptions, PopoverOptions, TooltipHandle, TooltipPlacement } from './Tooltip.js';

// ── Utility ────────────────────────────────────────────────────────────
export { Spinner, Badge, Avatar, AvatarGroup } from './Spinner.js';
export type { SpinnerProps, SpinnerSize, SpinnerVariant, BadgeProps, BadgeVariant, AvatarProps, AvatarGroupProps, AvatarSize } from './Spinner.js';

// ── Data ───────────────────────────────────────────────────────────────
export { DataTable } from './DataTable.js';
export type { DataTableProps, DataTableHandle, TableColumn as DataTableColumn, SortDir } from './DataTable.js';

// ── Date & Time ────────────────────────────────────────────────────────
export { DatePicker, TimePicker } from './DatePicker.js';
export type { DatePickerProps, TimePickerProps } from './DatePicker.js';

// ── Color ──────────────────────────────────────────────────────────────
export { ColorPicker } from './ColorPicker.js';
export type { ColorPickerProps, ColorFormat } from './ColorPicker.js';

// ── Command ────────────────────────────────────────────────────────────
export { CommandPalette, installCommandPalette } from './CommandPalette.js';
export type { Command, CommandPaletteOptions, CommandPaletteHandle } from './CommandPalette.js';

// ── Select ─────────────────────────────────────────────────────────────
export { createSelect } from './Select.js';
export type { SelectHandle, SelectOptions, SelectOption } from './Select.js';

// ── Switch ─────────────────────────────────────────────────────────────
export { createSwitch } from './Switch.js';
export type { SwitchHandle, SwitchOptions } from './Switch.js';

// ── VirtualList ────────────────────────────────────────────────────────
export { createVirtualList } from './VirtualList.js';
export type { VirtualListHandle, VirtualListOptions } from './VirtualList.js';

// ── Slider ─────────────────────────────────────────────────────────────
export { createSlider } from './Slider.js';
export type { SliderHandle, SliderOptions } from './Slider.js';

// ── RadioGroup (handle-based) ──────────────────────────────────────────
export { createRadioGroup } from './RadioGroup.js';
export type { RadioGroupHandle, RadioGroupOptions, RadioOption } from './RadioGroup.js';

// ── FileUpload ─────────────────────────────────────────────────────────
export { createFileUpload } from './FileUpload.js';
export type { FileUploadHandle, FileUploadOptions } from './FileUpload.js';

// ── Chart ──────────────────────────────────────────────────────────────
export { createChart } from './Chart.js';
export type { ChartHandle, ChartOptions, ChartDataset, ChartType } from './Chart.js';

// ── Drawer ─────────────────────────────────────────────────────────────
export { createDrawer } from './Drawer.js';
export type { DrawerHandle, DrawerOptions } from './Drawer.js';

// ── Stepper ────────────────────────────────────────────────────────────
export { createStepper } from './Stepper.js';
export type { StepperHandle, StepperOptions, StepConfig } from './Stepper.js';

// ── NotificationCenter ─────────────────────────────────────────────────
export { createNotificationCenter } from './NotificationCenter.js';
export type { NotificationCenterHandle, NotificationCenterOptions, Notification } from './NotificationCenter.js';

// ── InfiniteScroll ─────────────────────────────────────────────────────
export { createInfiniteScroll } from './InfiniteScroll.js';
export type { InfiniteScrollHandle, InfiniteScrollOptions } from './InfiniteScroll.js';

// ── Kanban ─────────────────────────────────────────────────────────────
export { createKanban } from './Kanban.js';
export type { KanbanHandle, KanbanOptions, KanbanColumn, KanbanCard } from './Kanban.js';

// ── RichTextEditor ─────────────────────────────────────────────────────
export { createRTE } from './RichTextEditor.js';
export type { RTEHandle, RTEOptions, RTEToolbarItem } from './RichTextEditor.js';
