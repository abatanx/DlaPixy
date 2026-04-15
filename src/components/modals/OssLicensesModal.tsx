/**
 * DlaPixy / Pixel Editor for MapChip
 * @copyright (C) 2026 DEKITASHICO-LAB
 **/

import ossLicensesData from '../../generated/oss-licenses.json';
import { useBootstrapModal } from './useBootstrapModal';

type OssLicensesModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type OssLicensePackage = {
  name: string;
  version: string;
  license: string;
  packagePath: string;
  homepage: string | null;
  repositoryUrl: string | null;
  copyright: string | null;
  licenseText: string;
};

type OssLicensesPayload = {
  packages: OssLicensePackage[];
};

const licenseData = ossLicensesData as OssLicensesPayload;

function resolveDisplayUrl(entry: OssLicensePackage): string | null {
  return entry.homepage ?? entry.repositoryUrl ?? null;
}

export function OssLicensesModal({ isOpen, onClose }: OssLicensesModalProps) {
  const modalRef = useBootstrapModal({
    isOpen,
    keyboard: true,
    onHidden: onClose
  });

  return (
    <div
      ref={modalRef}
      className="modal fade"
      tabIndex={-1}
      aria-labelledby="oss-licenses-modal-title"
      aria-hidden="true"
    >
      <div className="modal-dialog modal-xl modal-dialog-centered">
        <div className="modal-content shadow">
          <div className="modal-header">
            <div>
              <h2 id="oss-licenses-modal-title" className="modal-title fs-5 d-inline-flex align-items-center gap-2">
                <i className="fa-solid fa-scale-balanced" aria-hidden="true" />
                <span>OSS Licenses</span>
              </h2>
            </div>
            <button type="button" className="btn-close" aria-label="閉じる" onClick={onClose} />
          </div>
          <div className="modal-body oss-licenses-modal-body">
            {licenseData.packages.length > 0 ? (
              <div className="oss-license-list">
                {licenseData.packages.map((entry) => {
                  const displayUrl = resolveDisplayUrl(entry);

                  return (
                    <details key={`${entry.name}@${entry.version}:${entry.packagePath}`} className="oss-license-item">
                      <summary className="oss-license-summary">
                        <div className="oss-license-summary-main">
                          <div className="oss-license-name-row">
                            <span className="oss-license-name">{entry.name}</span>
                            <span className="oss-license-version font-monospace">{entry.version}</span>
                          </div>
                          <div className="oss-license-meta">
                            <span className="oss-license-badge">{entry.license}</span>
                            <span className="font-monospace small text-body-secondary">{entry.packagePath}</span>
                          </div>
                        </div>
                        <i className="fa-solid fa-chevron-down oss-license-summary-icon" aria-hidden="true" />
                      </summary>
                      <div className="oss-license-content">
                        {displayUrl ? (
                          <div className="mb-3">
                            <div className="oss-license-label">URL</div>
                            <div className="font-monospace small text-break">{displayUrl}</div>
                          </div>
                        ) : null}
                        {entry.copyright ? (
                          <div className="mb-3">
                            <div className="oss-license-label">Copyright</div>
                            <div className="small text-break">{entry.copyright}</div>
                          </div>
                        ) : null}
                        <div>
                          <div className="oss-license-label">License Text</div>
                          <pre className="oss-license-text">{entry.licenseText}</pre>
                        </div>
                      </div>
                    </details>
                  );
                })}
              </div>
            ) : (
              <p className="mb-0 text-body-secondary">ライセンス情報を読み込めませんでした。</p>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
