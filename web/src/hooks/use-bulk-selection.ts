import * as React from "react";

function areSameIds(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

export function useBulkSelection(initialIds: string[] = []) {
  const [selectedIds, setSelectedIds] = React.useState<string[]>(() => Array.from(new Set(initialIds)));

  const selectedIdSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);

  const isSelected = React.useCallback(
    (id: string) => selectedIdSet.has(id),
    [selectedIdSet]
  );

  const toggleSelection = React.useCallback((id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }, []);

  const replaceSelection = React.useCallback((ids: string[]) => {
    setSelectedIds((current) => {
      const next = Array.from(new Set(ids));
      return areSameIds(current, next) ? current : next;
    });
  }, []);

  const toggleMany = React.useCallback((ids: string[], nextSelected?: boolean) => {
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 0) return;

    setSelectedIds((current) => {
      const currentSet = new Set(current);
      const shouldSelect = nextSelected ?? uniqueIds.some((id) => !currentSet.has(id));

      uniqueIds.forEach((id) => {
        if (shouldSelect) {
          currentSet.add(id);
        } else {
          currentSet.delete(id);
        }
      });

      const next = Array.from(currentSet);
      return areSameIds(current, next) ? current : next;
    });
  }, []);

  const clearSelection = React.useCallback(() => {
    setSelectedIds((current) => (current.length === 0 ? current : []));
  }, []);

  return {
    selectedIds,
    selectedIdSet,
    selectedCount: selectedIds.length,
    hasSelection: selectedIds.length > 0,
    isSelected,
    toggleSelection,
    replaceSelection,
    toggleMany,
    clearSelection,
  };
}
