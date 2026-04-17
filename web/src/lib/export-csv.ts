type CsvValue = string | number | boolean | null | undefined | Date;

export type CsvColumn<T> = {
  key: keyof T;
  label: string;
  format?: (value: T[keyof T], row: T) => CsvValue;
};

function normalizeCsvValue(value: CsvValue) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

export function escapeCsvValue(value: CsvValue) {
  const normalized = normalizeCsvValue(value).replace(/\r?\n|\r/g, " ");
  if (!/[",;]/.test(normalized)) {
    return normalized;
  }

  return `"${normalized.replace(/"/g, '""')}"`;
}

export function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]) {
  const header = columns.map((column) => escapeCsvValue(column.label)).join(";");
  const lines = rows.map((row) =>
    columns
      .map((column) => {
        const rawValue = row[column.key] as T[keyof T];
        const formattedValue = column.format ? column.format(rawValue, row) : (rawValue as CsvValue);
        return escapeCsvValue(formattedValue);
      })
      .join(";")
  );

  return [header, ...lines].join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
