// src/utils/helpers.ts (Example)
import { useState, useEffect } from 'preact/hooks';

// Debounce Hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cancel the timeout if value changes (also on delay change or unmount)
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Currency Formatter
const currencyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatCurrency = (value: number | null | undefined): string => {
  return currencyFormatter.format(value ?? 0);
};

// Number Formatter (for quantities)
const numberFormatter = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 0, // Adjust as needed
  maximumFractionDigits: 2,
});

export const formatNumber = (value: number | null | undefined): string => {
    return numberFormatter.format(value ?? 0);
}

// Date Formatter
export const formatDate = (dateString: string | Date | null | undefined): string => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        // Check if date is valid
        if (isNaN(date.getTime())) {
            return 'Fecha inválida';
        }
        return date.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    } catch (e) {
        console.error("Error formatting date:", dateString, e);
        return 'Error fecha';
    }
};