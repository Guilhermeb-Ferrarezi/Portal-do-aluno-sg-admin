import * as React from "react";
import { useSearchParams } from "react-router-dom";

type Primitive = string | number | boolean;

type ParamDefinition<T extends Primitive> = {
  defaultValue: T;
  parse?: (value: string) => T;
  serialize?: (value: T) => string;
};

type ParamDefinitions<TValues extends Record<string, Primitive>> = {
  [K in keyof TValues]: ParamDefinition<TValues[K]>;
};

type UpdateOptions = {
  replace?: boolean;
  resetPage?: boolean;
};

function parsePrimitive<T extends Primitive>(value: string, defaultValue: T) {
  if (typeof defaultValue === "number") {
    const parsed = Number(value);
    return (Number.isFinite(parsed) ? parsed : defaultValue) as T;
  }

  if (typeof defaultValue === "boolean") {
    return (value === "true") as T;
  }

  return value as T;
}

function serializePrimitive<T extends Primitive>(value: T) {
  return typeof value === "boolean" ? String(value) : `${value}`;
}

export function usePersistedListParams<TValues extends Record<string, Primitive>>(
  definitions: ParamDefinitions<TValues>,
  options?: { pageKey?: keyof TValues & string }
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const pageKey = options?.pageKey;

  const defaultValues = React.useMemo(() => {
    const nextDefaults = {} as TValues;
    for (const [key, definition] of Object.entries(definitions) as Array<[
      keyof TValues & string,
      ParamDefinition<TValues[keyof TValues & string]>
    ]>) {
      nextDefaults[key] = definition.defaultValue as TValues[keyof TValues & string];
    }
    return nextDefaults;
  }, [definitions]);

  const values = React.useMemo(() => {
    const nextValues = {} as TValues;

    for (const [key, definition] of Object.entries(definitions) as Array<[
      keyof TValues & string,
      ParamDefinition<TValues[keyof TValues & string]>
    ]>) {
      const rawValue = searchParams.get(key);
      if (rawValue === null || rawValue === "") {
        nextValues[key] = definition.defaultValue as TValues[keyof TValues & string];
        continue;
      }

      nextValues[key] = (definition.parse
        ? definition.parse(rawValue)
        : parsePrimitive(rawValue, definition.defaultValue)) as TValues[keyof TValues & string];
    }

    return nextValues;
  }, [definitions, searchParams]);

  const updateParams = React.useCallback(
    (updates: Partial<TValues>, updateOptions?: UpdateOptions) => {
      const shouldReplace = updateOptions?.replace ?? true;
      const shouldResetPage = updateOptions?.resetPage ?? true;

      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        let nonPageFilterChanged = false;

        for (const [key, nextValue] of Object.entries(updates) as Array<[
          keyof TValues & string,
          TValues[keyof TValues & string]
        ]>) {
          const definition = definitions[key];
          const serializedValue = definition.serialize
            ? definition.serialize(nextValue)
            : serializePrimitive(nextValue);
          const currentValue = next.get(key);
          const isDefault = nextValue === definition.defaultValue;

          if (currentValue !== serializedValue && (!pageKey || key !== pageKey)) {
            nonPageFilterChanged = true;
          }

          if (isDefault) {
            next.delete(key);
          } else {
            next.set(key, serializedValue);
          }
        }

        if (pageKey && shouldResetPage && nonPageFilterChanged) {
          const pageDefinition = definitions[pageKey];
          const serializedDefaultPage = pageDefinition.serialize
            ? pageDefinition.serialize(pageDefinition.defaultValue)
            : serializePrimitive(pageDefinition.defaultValue);

          if (pageDefinition.defaultValue === updates[pageKey]) {
            next.delete(pageKey);
          } else {
            next.set(pageKey, serializedDefaultPage);
          }
        }

        return next;
      }, { replace: shouldReplace });
    },
    [definitions, pageKey, setSearchParams, values]
  );

  return {
    searchParams,
    values,
    defaultValues,
    setParams: updateParams,
  };
}
