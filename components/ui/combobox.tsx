'use client';

import * as React from 'react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Input } from './input';

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  triggerClassName?: string;
  /** Показать кнопку сброса выбора рядом с триггером, когда value непустой */
  clearable?: boolean;
  onClear?: () => void;
  disabled?: boolean;
}

// Доступный комбобокс с поиском: кнопка-триггер открывает попап со списком
// (role="listbox"/"option", aria-activedescendant) и полем поиска внутри.
// Поддерживает ArrowUp/ArrowDown/Enter/Escape с клавиатуры - в отличие от
// самодельных div-дропдаунов, которые были раньше в трёх разных местах
// (только клик мышью, без ARIA-разметки).
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Выберите...',
  searchPlaceholder = 'Поиск...',
  emptyText = 'Ничего не найдено',
  className,
  triggerClassName,
  clearable = false,
  onClear,
  disabled,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listboxId = React.useId();

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => option.label.toLowerCase().includes(q));
  }, [options, query]);

  const selectedOption = options.find((option) => option.value === value);

  React.useEffect(() => {
    if (!open) return;
    setQuery('');
    setHighlightedIndex(0);
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  React.useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  const selectOption = (option: ComboboxOption) => {
    onChange(option.value);
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = filtered[highlightedIndex];
      if (option) selectOption(option);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <div className={cn('flex gap-2', className)}>
        <PopoverPrimitive.Trigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            disabled={disabled}
            className={cn(
              'w-full justify-between gap-2 font-normal',
              triggerClassName,
            )}
          >
            <span className="truncate text-left">
              {selectedOption?.label || placeholder}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
          </Button>
        </PopoverPrimitive.Trigger>
        {clearable && value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClear}
            title="Сбросить фильтр"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-64 rounded-md border bg-popover p-2 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              ref={inputRef}
              role="combobox"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={
                filtered[highlightedIndex]
                  ? `${listboxId}-${filtered[highlightedIndex].value}`
                  : undefined
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              className="h-8 border-0 p-0 shadow-none focus-visible:ring-0"
            />
          </div>

          <div
            id={listboxId}
            role="listbox"
            aria-label={placeholder}
            className="mt-2 max-h-72 overflow-y-auto"
          >
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground">
                {emptyText}
              </div>
            ) : (
              filtered.map((option, index) => (
                <div
                  key={option.value}
                  id={`${listboxId}-${option.value}`}
                  role="option"
                  aria-selected={option.value === value}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => selectOption(option)}
                  className={cn(
                    'flex w-full cursor-pointer items-center justify-between rounded-sm px-3 py-2 text-left text-sm',
                    index === highlightedIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {option.value === value && (
                    <Check className="h-4 w-4 shrink-0" />
                  )}
                </div>
              ))
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
