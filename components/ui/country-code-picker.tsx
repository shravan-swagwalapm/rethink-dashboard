'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  POPULAR_COUNTRIES,
  ALL_COUNTRIES,
  getCountryByCode,
  type Country,
} from '@/lib/data/countries';

interface CountryCodePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Country Code Picker Component
 *
 * A searchable dropdown selector for country codes with flags and country names.
 * Features:
 * - Search by country name or dial code
 * - 240+ countries with ITU E.164 dial codes
 * - Popular countries section for quick access
 * - Unicode flag emojis
 * - Mobile-friendly with touch scroll
 * - Keyboard accessible
 *
 * @example
 * const [countryCode, setCountryCode] = useState('+91');
 * <CountryCodePicker value={countryCode} onChange={setCountryCode} />
 */
export function CountryCodePicker({
  value,
  onChange,
  disabled,
  className,
}: CountryCodePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  // Get the selected country for display
  const selectedCountry = React.useMemo(
    () => getCountryByCode(value),
    [value]
  );

  // Filter countries based on search query
  const filterCountries = React.useCallback(
    (countries: Country[]): Country[] => {
      if (!search) return countries;

      const searchLower = search.toLowerCase();
      const searchWithoutPlus = search.replace(/^\+/, '');

      return countries.filter((country) => {
        // Match by country name (case-insensitive, partial match)
        const nameMatch = country.name.toLowerCase().includes(searchLower);

        // Match by dial code (starts with, with or without +)
        const codeWithoutPlus = country.code.replace(/^\+/, '');
        const codeMatch = codeWithoutPlus.startsWith(searchWithoutPlus);

        return nameMatch || codeMatch;
      });
    },
    [search]
  );

  // Filtered country lists
  const filteredPopular = React.useMemo(
    () => filterCountries(POPULAR_COUNTRIES),
    [filterCountries]
  );

  // Exclude popular countries from "All Countries" to avoid duplicates
  const filteredAll = React.useMemo(
    () => {
      const popularCodes = new Set(POPULAR_COUNTRIES.map(c => c.code));
      return filterCountries(ALL_COUNTRIES.filter(c => !popularCodes.has(c.code)));
    },
    [filterCountries]
  );

  // Clear search when popover closes
  React.useEffect(() => {
    if (!open) {
      setSearch('');
    }
  }, [open]);

  const handleSelect = React.useCallback(
    (country: Country) => {
      onChange(country.code);
      setOpen(false);
    },
    [onChange]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select country code"
          disabled={disabled}
          className={cn(
            'justify-between hover:bg-accent/10 hover:text-foreground',
            className || 'w-[120px]'
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <span className="text-base">{selectedCountry?.flag ?? '🌍'}</span>
            <span className="font-medium">{value || '+1'}</span>
          </span>
          <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[260px] p-0 border-2 border-border bg-card shadow-lg rounded-lg overflow-hidden"
        side="bottom"
        align="start"
        sideOffset={4}
      >
        <Command shouldFilter={false}>
          <div className="p-2 border-b border-border">
            <CommandInput
              placeholder="Search country or code..."
              value={search}
              onValueChange={setSearch}
              className="h-9"
            />
          </div>
          <CommandList className="max-h-[280px] overflow-y-auto p-1">
            <CommandEmpty>No country found.</CommandEmpty>

            {/* Popular Countries */}
            {filteredPopular.length > 0 && (
              <CommandGroup heading="Popular" className="px-1">
                {filteredPopular.map((country) => (
                  <CommandItem
                    key={`popular-${country.iso2}`}
                    value={`${country.code}-${country.iso2}`}
                    onSelect={() => handleSelect(country)}
                    className="cursor-pointer rounded-md px-2 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
                  >
                    <span className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="shrink-0">{country.flag}</span>
                      <span className="font-bold shrink-0">{country.code}</span>
                      <span className="truncate">{country.name}</span>
                    </span>
                    {value === country.code && (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* All Countries */}
            {filteredAll.length > 0 && (
              <CommandGroup heading="All Countries" className="px-1">
                {filteredAll.map((country) => (
                  <CommandItem
                    key={`all-${country.iso2}`}
                    value={`${country.code}-${country.iso2}`}
                    onSelect={() => handleSelect(country)}
                    className="cursor-pointer rounded-md px-2 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
                  >
                    <span className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="shrink-0">{country.flag}</span>
                      <span className="font-bold shrink-0">{country.code}</span>
                      <span className="truncate">{country.name}</span>
                    </span>
                    {value === country.code && (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
