import { memo, useEffect, useRef, useState, type DragEvent as ReactDragEvent } from 'react';
import type { SidebarPreviewSectionProps } from './types';

export const SidebarPreviewSection = memo(function SidebarPreviewSection({
  canvasSize,
  previewDataUrl,
  tilePreviewDataUrl,
  tilePreviewSelection,
  selection,
  tilePreviewLayerCount,
  tilePreviewLayers,
  tilePreviewBaseSize,
  hasTilePreviewCandidate,
  clearTilePreviewLayers,
  reorderTilePreviewLayers,
  removeTilePreviewLayer,
  tilePreviewFocusSequence,
  animationPreviewDataUrl,
  animationFrames,
  animationPreviewIndex,
  animationPreviewFps,
  isAnimationPreviewPlaying,
  isAnimationPreviewLoop,
  addAnimationFrame,
  clearAnimationFrames,
  selectAnimationFrame,
  moveAnimationFrame,
  removeAnimationFrame,
  toggleAnimationPreviewPlayback,
  setAnimationPreviewFps,
  setAnimationPreviewLoop
}: SidebarPreviewSectionProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'tiling' | 'animation'>('preview');
  const [draggingTilePreviewLayerId, setDraggingTilePreviewLayerId] = useState<string | null>(null);
  const previousFrameCountRef = useRef<number>(animationFrames.length);
  const previousTilePreviewFocusSequenceRef = useRef<number>(tilePreviewFocusSequence);
  const displayedTilePreviewLayers = [...tilePreviewLayers].reverse();
  const canPlayAnimation = animationFrames.length >= 2;
  const canAddAnimationFrame = selection !== null;
  const canClearTilePreviewLayers = tilePreviewLayerCount > 0;

  useEffect(() => {
    if (animationFrames.length > previousFrameCountRef.current) {
      setActiveTab('animation');
    }
    previousFrameCountRef.current = animationFrames.length;
  }, [animationFrames.length]);

  useEffect(() => {
    if (tilePreviewFocusSequence > previousTilePreviewFocusSequenceRef.current) {
      setActiveTab('tiling');
    }
    previousTilePreviewFocusSequenceRef.current = tilePreviewFocusSequence;
  }, [tilePreviewFocusSequence]);

  const onTilePreviewLayerDragStart = (event: ReactDragEvent<HTMLDivElement>, sourceId: string) => {
    setDraggingTilePreviewLayerId(sourceId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', sourceId);
  };

  const onTilePreviewLayerDragEnd = () => {
    setDraggingTilePreviewLayerId(null);
  };

  const onTilePreviewLayerDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const onTilePreviewLayerDrop = (event: ReactDragEvent<HTMLDivElement>, targetId: string) => {
    event.preventDefault();
    const sourceId = draggingTilePreviewLayerId ?? event.dataTransfer.getData('text/plain');
    setDraggingTilePreviewLayerId(null);
    if (!sourceId || sourceId === targetId) {
      return;
    }

    const remainingLayerIds = displayedTilePreviewLayers
      .map((layer) => layer.id)
      .filter((layerId) => layerId !== sourceId);
    const targetIndex = remainingLayerIds.findIndex((layerId) => layerId === targetId);
    if (targetIndex < 0) {
      return;
    }

    const targetBounds = event.currentTarget.getBoundingClientRect();
    const insertAfter = event.clientY >= targetBounds.top + targetBounds.height / 2;
    remainingLayerIds.splice(insertAfter ? targetIndex + 1 : targetIndex, 0, sourceId);
    reorderTilePreviewLayers(remainingLayerIds);
  };

  return (
    <div className="sidebar-preview-section flex-shrink-0">
      <ul className="nav nav-tabs sidebar-preview-tabs" role="tablist">
        <li className="nav-item" role="presentation">
          <button
            type="button"
            className={`nav-link ${activeTab === 'preview' ? 'active' : ''}`}
            role="tab"
            aria-selected={activeTab === 'preview'}
            aria-controls="sidebar-preview-pane"
            aria-label="Preview (1x)"
            title="Preview (1x)"
            onClick={() => setActiveTab('preview')}
          >
            <i className="fa-regular fa-image" aria-hidden="true" />
            <span className="sidebar-preview-tab-label">1x</span>
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button
            type="button"
            className={`nav-link ${activeTab === 'tiling' ? 'active' : ''}`}
            role="tab"
            aria-selected={activeTab === 'tiling'}
            aria-controls="sidebar-tiling-pane"
            aria-label="Tiling Preview"
            title="Tiling Preview"
            onClick={() => setActiveTab('tiling')}
          >
            <i className="fa-solid fa-grip" aria-hidden="true" />
            <span className="sidebar-preview-tab-label">Tile</span>
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button
            type="button"
            className={`nav-link ${activeTab === 'animation' ? 'active' : ''}`}
            role="tab"
            aria-selected={activeTab === 'animation'}
            aria-controls="sidebar-animation-pane"
            aria-label="Animation Preview"
            title="Animation Preview"
            onClick={() => setActiveTab('animation')}
          >
            <i className="fa-solid fa-film" aria-hidden="true" />
            <span className="sidebar-preview-tab-label">Anim</span>
          </button>
        </li>
      </ul>
      <div className="tab-content sidebar-preview-tab-content">
        <div
          id="sidebar-preview-pane"
          className={`tab-pane fade ${activeTab === 'preview' ? 'show active' : ''}`}
          role="tabpanel"
        >
          <div className="preview-wrap preview-scroll-wrap">
            {previewDataUrl ? (
              <div className="preview-scroll-content">
                <img
                  src={previewDataUrl}
                  alt="PNG Preview"
                  className="preview-image preview-scroll-image"
                  width={canvasSize}
                  height={canvasSize}
                />
              </div>
            ) : null}
          </div>
        </div>
        <div
          id="sidebar-tiling-pane"
          className={`tab-pane fade ${activeTab === 'tiling' ? 'show active' : ''}`}
          role="tabpanel"
        >
          <div className="preview-wrap tile-preview-wrap">
            {tilePreviewDataUrl ? (
              <img
                src={tilePreviewDataUrl}
                alt="Selection 3x3 Tile Preview"
                className="preview-image tile-preview-image"
              />
            ) : (
              <div className="preview-placeholder">
                <span>矩形選択で 3x3 タイル表示</span>
                <span className="preview-placeholder-hint">Gで重ねプレビューに追加</span>
              </div>
            )}
          </div>
          <div className="tile-preview-controls mt-2">
            <div className="tile-preview-status">
              {tilePreviewBaseSize
                ? `${tilePreviewLayerCount}枚重ね / 基準 ${tilePreviewBaseSize.width}x${tilePreviewBaseSize.height}${hasTilePreviewCandidate && selection ? ' / 候補あり' : ''}`
                : tilePreviewSelection
                  ? `${tilePreviewSelection.w}x${tilePreviewSelection.h}`
                  : '重ねなし'}
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger animation-preview-icon-button ms-auto"
              onClick={clearTilePreviewLayers}
              disabled={!canClearTilePreviewLayers}
              aria-label="Tile Preview の重ねをすべて削除"
              title="Tile Preview の重ねをすべて削除"
            >
              <i className="fa-solid fa-trash-can" aria-hidden="true" />
              <span className="visually-hidden">全クリア</span>
            </button>
          </div>
          <div className="form-text mt-2 text-center">
            {tilePreviewLayerCount > 0
              ? hasTilePreviewCandidate && selection
                ? `${tilePreviewLayerCount}枚重ね + 現在選択を未確定候補として重ね表示`
                : `${tilePreviewLayerCount}枚重ねを3x3で表示`
              : tilePreviewSelection
                ? `${tilePreviewSelection.w}x${tilePreviewSelection.h} を3x3で表示${selection ? ' (現在選択中)' : ' (最終選択範囲)'}`
                : '選択範囲なし'}
          </div>
          {tilePreviewLayers.length > 0 ? (
            <div className="tile-preview-layer-list mt-2" role="list" aria-label="tile preview stacks">
              {displayedTilePreviewLayers.map((layer, displayIndex) => {
                const actualIndex = tilePreviewLayers.length - 1 - displayIndex;
                const isBaseLayer = actualIndex === 0;

                return (
                  <div
                    key={layer.id}
                    className={`tile-preview-layer-item ${isBaseLayer ? 'is-base' : ''} ${draggingTilePreviewLayerId === layer.id ? 'is-dragging' : ''}`}
                    role="listitem"
                    title="ドラッグで順序変更"
                    draggable
                    onDragStart={(event) => onTilePreviewLayerDragStart(event, layer.id)}
                    onDragEnd={onTilePreviewLayerDragEnd}
                    onDragOver={onTilePreviewLayerDragOver}
                    onDrop={(event) => onTilePreviewLayerDrop(event, layer.id)}
                  >
                    <div className="tile-preview-layer-main">
                      <span className="tile-preview-layer-thumb" aria-hidden="true">
                        <img src={layer.previewDataUrl} alt="" />
                      </span>
                      <span className="tile-preview-layer-number">{actualIndex + 1}</span>
                      <span className="tile-preview-layer-text">
                        {layer.width}x{layer.height}
                        {isBaseLayer ? ' / 基準' : ''}
                      </span>
                    </div>
                    <div className="tile-preview-layer-actions">
                      <button
                        type="button"
                        className="canvas-copy-btn"
                        onClick={() => removeTilePreviewLayer(layer.id)}
                        title="削除"
                        aria-label="削除"
                      >
                        <i className="fa-solid fa-xmark" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
        <div
          id="sidebar-animation-pane"
          className={`tab-pane fade ${activeTab === 'animation' ? 'show active' : ''}`}
          role="tabpanel"
        >
          <div className="preview-wrap animation-preview-wrap">
            {animationPreviewDataUrl ? (
              <img
                src={animationPreviewDataUrl}
                alt="Animation Preview"
                className="preview-image animation-preview-image"
              />
            ) : (
              <div className="preview-placeholder">
                矩形選択して T または右ツールバーのボタンでフレーム追加
              </div>
            )}
          </div>
          <div className="animation-preview-controls mt-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary animation-preview-icon-button"
              onClick={addAnimationFrame}
              disabled={!canAddAnimationFrame}
              aria-label="現在の選択範囲をアニメーションフレームに追加"
              title="現在の選択範囲をアニメーションフレームに追加 (T)"
            >
              <i className="fa-solid fa-plus" aria-hidden="true" />
              <span className="visually-hidden">追加 (T)</span>
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary animation-preview-icon-button"
              onClick={toggleAnimationPreviewPlayback}
              disabled={!canPlayAnimation}
              aria-label={isAnimationPreviewPlaying ? 'アニメーション再生を停止' : 'アニメーション再生を開始'}
              title={isAnimationPreviewPlaying ? 'アニメーション再生を停止' : 'アニメーション再生を開始'}
            >
              <i className={`fa-solid ${isAnimationPreviewPlaying ? 'fa-pause' : 'fa-play'}`} aria-hidden="true" />
              <span className="visually-hidden">{isAnimationPreviewPlaying ? '停止' : '再生'}</span>
            </button>
            <label className="animation-preview-fps" title="再生速度 (FPS)">
              <i className="fa-solid fa-gauge-high" aria-hidden="true" />
              <span className="visually-hidden">FPS</span>
              <input
                type="number"
                className="form-control form-control-sm"
                min={1}
                max={24}
                step={1}
                value={animationPreviewFps}
                onChange={(event) => setAnimationPreviewFps(Number.parseInt(event.target.value, 10))}
              />
            </label>
            <button
              type="button"
              className={`btn btn-sm animation-preview-icon-button ${isAnimationPreviewLoop ? 'btn-outline-primary' : 'btn-outline-secondary'}`}
              onClick={() => setAnimationPreviewLoop(!isAnimationPreviewLoop)}
              aria-label="ループ再生を切り替え"
              aria-pressed={isAnimationPreviewLoop}
              title={isAnimationPreviewLoop ? 'ループ再生: ON' : 'ループ再生: OFF'}
            >
              <i className="fa-solid fa-repeat" aria-hidden="true" />
              <span className="visually-hidden">Loop</span>
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger animation-preview-icon-button ms-auto"
              onClick={clearAnimationFrames}
              disabled={animationFrames.length === 0}
              aria-label="アニメーションフレームをすべて削除"
              title="アニメーションフレームをすべて削除"
            >
              <i className="fa-solid fa-trash-can" aria-hidden="true" />
              <span className="visually-hidden">全クリア</span>
            </button>
          </div>
          <div className="form-text mt-2 text-center">
            {animationFrames.length > 0
              ? `${animationFrames.length} frames / ${animationPreviewFps} FPS / ${isAnimationPreviewPlaying ? '再生中' : '停止中'}`
              : 'フレーム未登録'}
          </div>
          {animationFrames.length > 0 ? (
            <div className="animation-frame-list mt-2" role="list" aria-label="animation frames">
              {animationFrames.map((frame, index) => (
                <div
                  key={frame.id}
                  className={`animation-frame-item ${index === animationPreviewIndex ? 'active' : ''}`}
                  role="listitem"
                >
                  <button
                    type="button"
                    className="animation-frame-main"
                    onClick={() => selectAnimationFrame(index)}
                    title={`Frame ${index + 1} を表示`}
                  >
                    <span className="animation-frame-number">{index + 1}</span>
                    <span className="animation-frame-text">
                      {frame.w}x{frame.h} @ {frame.x},{frame.y}
                    </span>
                  </button>
                  <div className="animation-frame-actions">
                    <button
                      type="button"
                      className="canvas-copy-btn"
                      onClick={() => moveAnimationFrame(frame.id, 'up')}
                      disabled={index === 0}
                      title="上へ"
                      aria-label="上へ"
                    >
                      <i className="fa-solid fa-chevron-up" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="canvas-copy-btn"
                      onClick={() => moveAnimationFrame(frame.id, 'down')}
                      disabled={index === animationFrames.length - 1}
                      title="下へ"
                      aria-label="下へ"
                    >
                      <i className="fa-solid fa-chevron-down" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="canvas-copy-btn"
                      onClick={() => removeAnimationFrame(frame.id)}
                      title="削除"
                      aria-label="削除"
                    >
                      <i className="fa-solid fa-xmark" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
});
