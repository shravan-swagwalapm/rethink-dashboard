'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const COUNTRY_CODES = [
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+1', country: 'USA/Canada', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+81', country: 'Japan', flag: '🇯🇵' },
  { code: '+86', country: 'China', flag: '🇨🇳' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
];

interface CountryCodePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Country Code Picker Component
 *
 * A dropdown selector for country codes with flags and country names.
 * Defaults to India (+91).
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
  const selectedCountry = COUNTRY_CODES.find((c) => c.code === value);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={className || 'w-[120px]'} aria-label="Select country code">
        <SelectValue>
          <span className="flex items-center gap-2">
            <span>{selectedCountry?.flag}</span>
            <span className="font-medium">{value}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {COUNTRY_CODES.map((country) => (
          <SelectItem key={country.code} value={country.code}>
            <span className="flex items-center gap-2">
              <span>{country.flag}</span>
              <span className="font-medium">{country.code}</span>
              <span className="text-muted-foreground text-sm">{country.country}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
