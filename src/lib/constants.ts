export const EXPENSE_CATEGORIES = [
  { value: 'rent', label: 'Rent', color: 'bg-slate-500' },
  { value: 'utility', label: 'Utility', color: 'bg-blue-500' },
  { value: 'salary', label: 'Salary', color: 'bg-purple-500' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-orange-500' },
  { value: 'equipment', label: 'Equipment', color: 'bg-cyan-500' },
  { value: 'misc', label: 'Misc', color: 'bg-gray-500' },
  { value: 'reserve', label: 'Reserve', color: 'bg-emerald-500' },
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]['value'];

export const ENQUIRY_STATUSES = [
  { value: 'new', label: 'New', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { value: 'read', label: 'Read', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  { value: 'contacted', label: 'Contacted', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  { value: 'converted', label: 'Converted', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { value: 'closed', label: 'Closed', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
] as const;

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'online', label: 'Online' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
] as const;
