/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TransparentBackgroundMode } from '../../shared/transparent-background';
import { getTransparentBackgroundSurfaceClassName } from '../editor/transparent-background';

export type StatusToastType = 'success' | 'warning' | 'error' | 'info';

type UseEditorShellUiOptions = {
  hasUnsavedChanges: boolean;
  transparentBackgroundMode: TransparentBackgroundMode;
};

export function useEditorShellUi({
  hasUnsavedChanges,
  transparentBackgroundMode
}: UseEditorShellUiOptions) {
  const [statusText, setStatusTextRaw] = useState<string>('準備OK');
  const [toastType, setToastType] = useState<StatusToastType>('info');
  const [isToastVisible, setIsToastVisible] = useState<boolean>(false);
  const [toastSequence, setToastSequence] = useState<number>(0);

  const setStatusText = useCallback((text: string, type: StatusToastType) => {
    setStatusTextRaw(text);
    setToastType(type);
    setIsToastVisible(true);
    setToastSequence((prev) => prev + 1);
  }, []);

  useEffect(() => {
    document.title = `DlaPixy${hasUnsavedChanges ? ' *' : ''}`;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    void window.pixelApi.setTransparentBackgroundMode(transparentBackgroundMode).catch(() => undefined);
  }, [transparentBackgroundMode]);

  useEffect(() => {
    if (!isToastVisible) {
      return;
    }
    const timer = window.setTimeout(() => {
      setIsToastVisible(false);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [isToastVisible, toastSequence]);

  const transparentBackgroundClassName = useMemo(
    () => getTransparentBackgroundSurfaceClassName(transparentBackgroundMode),
    [transparentBackgroundMode]
  );

  return {
    statusText,
    toastType,
    isToastVisible,
    setStatusText,
    transparentBackgroundClassName
  };
}
