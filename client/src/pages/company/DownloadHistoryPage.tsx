import React, { useState, useEffect } from 'react';
import {
  Download,
  FileArchive,
  Clock,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Images,
  Image as ImageIcon,
  RotateCw,
  User,
  Search,
  Play,
  Video,
} from 'lucide-react';
import { exportsApi, assetsApi } from '../../api/index.js';
import { ExportRecord, SingleDownloadRecord } from '../../types/index.js';
import { Card, Button, Badge, EmptyState, Pagination } from '../../components/common/index.js';
import { useAuthStore } from '../../store/authStore.js';

export const DownloadHistoryPage: React.FC = () => {
  const { role, company, permissions } = useAuthStore();

  const canViewSingleTab =
    role === 'Company' ||
    role === 'Designer' ||
    (role === 'Viewer' && company?.settings?.allowViewerDownload !== false);

  const canViewZipsTab =
    role === 'Company' ||
    (role === 'Designer' && permissions?.canExportZip !== false) ||
    (role === 'Viewer' && company?.settings?.allowViewerZipDownload === true);

  const [activeTab, setActiveTab] = useState<'single' | 'zips'>(
    canViewSingleTab ? 'single' : 'zips'
  );
  const [exportsList, setExportsList] = useState<ExportRecord[]>([]);
  const [singleDownloads, setSingleDownloads] = useState<SingleDownloadRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination & Search for Single Downloads
  const [singleSearch, setSingleSearch] = useState('');
  const [singlePage, setSinglePage] = useState(1);
  const [singlePageSize, setSinglePageSize] = useState(10);

  // Pagination & Search for ZIP Exports
  const [zipSearch, setZipSearch] = useState('');
  const [zipPage, setZipPage] = useState(1);
  const [zipPageSize, setZipPageSize] = useState(10);

  const isViewerBlocked = !canViewSingleTab && !canViewZipsTab;

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const [expRes, singleRes] = await Promise.allSettled([
        exportsApi.listExports(),
        exportsApi.listSingleDownloads(),
      ]);

      const exps = expRes.status === 'fulfilled' ? expRes.value.data.data || [] : [];
      const singles = singleRes.status === 'fulfilled' ? singleRes.value.data.data || [] : [];

      setExportsList(exps);
      setSingleDownloads(singles);

      // Auto-switch tab if only one is allowed or one is empty
      if (!canViewSingleTab && canViewZipsTab) {
        setActiveTab('zips');
      } else if (canViewSingleTab && !canViewZipsTab) {
        setActiveTab('single');
      } else if (singles.length === 0 && exps.length > 0) {
        setActiveTab('zips');
      }
    } catch (err) {
      console.error('Failed to load download history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Smart polling for ZIP exports in progress
  useEffect(() => {
    const hasActiveExports = exportsList.some(
      (e) => e.status === 'pending' || e.status === 'processing'
    );
    if (!hasActiveExports) return;

    const timer = setTimeout(fetchHistory, 4000);
    return () => clearTimeout(timer);
  }, [exportsList]);

  if (isViewerBlocked) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center space-y-3">
        <AlertCircle className="w-12 h-12 text-[#D97706] mx-auto" />
        <h2 className="text-xl font-bold text-[#1E293B] font-heading">
          Downloads Restricted by Company Policy
        </h2>
        <p className="text-xs text-[#64748B] max-w-md mx-auto">
          The company owner has configured read-only viewing permissions for the Viewer role.
          Catalogue downloads are currently disabled.
        </p>
      </div>
    );
  }

  const filteredSingleDownloads = singleDownloads.filter((item) => {
    if (!singleSearch.trim()) return true;
    const q = singleSearch.toLowerCase();
    const name = (item.filename || '').toLowerCase();
    const sku = (item.sku || '').toLowerCase();
    const user = (item.downloadedBy?.name || item.downloadedBy?.email || '').toLowerCase();
    return name.includes(q) || sku.includes(q) || user.includes(q);
  });

  const singleTotalPages = Math.ceil(filteredSingleDownloads.length / singlePageSize) || 1;
  const paginatedSingleDownloads = filteredSingleDownloads.slice(
    (singlePage - 1) * singlePageSize,
    singlePage * singlePageSize
  );

  const filteredExports = exportsList.filter((exp) => {
    if (!zipSearch.trim()) return true;
    const q = zipSearch.toLowerCase();
    const token = (exp.downloadToken || '').toLowerCase();
    return token.includes(q) || exp.status.toLowerCase().includes(q);
  });

  const zipTotalPages = Math.ceil(filteredExports.length / zipPageSize) || 1;
  const paginatedExports = filteredExports.slice(
    (zipPage - 1) * zipPageSize,
    zipPage * zipPageSize
  );

  return (
    <div className="w-full max-w-6xl mx-auto space-y-5 min-w-0">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1E293B] font-heading">
            Download & Export History
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Access downloaded watermarked jewellery images and generated ZIP catalogue archives.
          </p>
        </div>

        <Button size="sm" variant="outline" onClick={fetchHistory} disabled={loading} className="self-start sm:self-auto shrink-0">
          <RotateCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh History
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E2E8F0]">
        {canViewSingleTab && (
          <button
            onClick={() => setActiveTab('single')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg flex items-center gap-2 transition border-b-2 ${
              activeTab === 'single'
                ? 'border-[#7C3AED] text-[#7C3AED] bg-white font-bold'
                : 'border-transparent text-[#64748B] hover:text-[#1E293B] hover:bg-white/50'
            }`}
          >
            <Images className="w-4 h-4 text-[#7C3AED]" />
            <span>Single Images</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'single'
                  ? 'bg-[#7C3AED]/15 text-[#7C3AED]'
                  : 'bg-[#F1F5F9] text-[#64748B]'
              }`}
            >
              {singleDownloads.length}
            </span>
          </button>
        )}

        {canViewZipsTab && (
          <button
            onClick={() => setActiveTab('zips')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg flex items-center gap-2 transition border-b-2 ${
              activeTab === 'zips'
                ? 'border-[#7C3AED] text-[#7C3AED] bg-white font-bold'
                : 'border-transparent text-[#64748B] hover:text-[#1E293B] hover:bg-white/50'
            }`}
          >
            <FileArchive className="w-4 h-4 text-[#B8860B]" />
            <span>ZIP Packages</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'zips'
                  ? 'bg-[#B8860B]/15 text-[#B8860B]'
                  : 'bg-[#F1F5F9] text-[#64748B]'
              }`}
            >
              {exportsList.length}
            </span>
          </button>
        )}
      </div>

      {/* TAB 1: SINGLE IMAGE DOWNLOADS */}
      {activeTab === 'single' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by jewellery filename, SKU, or user..."
              value={singleSearch}
              onChange={(e) => {
                setSingleSearch(e.target.value);
                setSinglePage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-[#E2E8F0] rounded-xl focus:outline-none focus:border-[#7C3AED] shadow-xs"
            />
          </div>

          <Card className="p-0 overflow-hidden">
            {/* Mobile & Tablet Card View */}
            <div className="md:hidden divide-y divide-[#E2E8F0]">
              {loading ? (
                <div className="py-10 text-center text-xs text-[#64748B]">Loading downloaded images...</div>
              ) : filteredSingleDownloads.length === 0 ? (
                <div className="py-12 text-center text-[#64748B] p-4">
                  <Images className="w-8 h-8 text-[#CBD5E1] mx-auto mb-2" />
                  <div className="font-semibold text-xs text-[#1E293B]">
                    {singleSearch ? 'No downloaded images match your search.' : 'No individual image downloads yet.'}
                  </div>
                  <div className="text-[11px] text-[#64748B] mt-0.5">
                    When you download a watermarked design from the gallery or batch viewer, it will be listed here.
                  </div>
                </div>
              ) : (
                paginatedSingleDownloads.map((item) => {
                  const sizeKB = item.fileSize ? (item.fileSize / 1024).toFixed(1) : '—';
                  const hasAsset = !!item.assetId;

                  const isVideo =
                    item.filename?.toLowerCase().endsWith('.mp4') ||
                    item.filename?.toLowerCase().endsWith('.mov') ||
                    item.filename?.toLowerCase().endsWith('.webm');
                  const mediaSrc = item.url ? item.url : (item.assetId ? assetsApi.getViewUrl(item.assetId) : '');

                  return (
                    <div key={item._id} className="p-3.5 sm:p-4 space-y-2.5 hover:bg-[#F8FAFC]/60 transition min-w-0">
                      <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg bg-[#F1F5F9] overflow-hidden border border-[#E2E8F0] flex items-center justify-center shrink-0 relative">
                          {isVideo && mediaSrc ? (
                            <>
                              <video src={mediaSrc} muted className="w-full h-full object-cover pointer-events-none" />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                <Play className="w-3.5 h-3.5 fill-white text-white" />
                              </div>
                            </>
                          ) : mediaSrc ? (
                            <img src={mediaSrc} alt={item.filename} className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-[#CBD5E1]" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs text-[#1E293B] font-heading truncate block" title={item.filename}>
                            {item.filename}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <Badge variant="success" size="sm">
                              {item.assetType === 'processed' ? 'Watermarked' : 'Original'}
                            </Badge>
                            {item.sku && (
                              <span className="font-mono text-[10px] font-semibold text-[#1E293B] bg-[#F1F5F9] px-1.5 py-0.5 rounded border border-[#E2E8F0] truncate max-w-[130px]">
                                SKU: {item.sku}
                              </span>
                            )}
                            <span className="text-[10px] text-[#64748B] shrink-0">{sizeKB !== '—' ? `${sizeKB} KB` : ''}</span>
                          </div>
                        </div>
                      </div>

                      {/* Downloaded By & Date */}
                      <div className="flex items-center justify-between gap-2 text-[11px] text-[#64748B] pt-0.5 min-w-0">
                        <div className="min-w-0 flex-1 truncate">
                          <span className="font-medium text-[#1E293B]">{item.downloadedBy?.name || 'Jeweller'}</span>
                          {item.downloadedBy?.email && (
                            <span className="text-[#94A3B8] text-[10px] ml-1 truncate">
                              ({item.downloadedBy.email})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-[#94A3B8] shrink-0">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Download Action Button */}
                      <div className="pt-0.5">
                        {hasAsset && (item.assetType !== 'original' || role !== 'Viewer') ? (
                          <a
                            href={assetsApi.getDownloadUrl(item.assetId)}
                            download={item.filename}
                            className="w-full justify-center inline-flex items-center gap-1.5 px-3 py-2 bg-[#7C3AED]/10 hover:bg-[#7C3AED] active:bg-[#6D28D9] text-[#7C3AED] hover:text-white text-xs font-semibold rounded-lg transition"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download Image</span>
                          </a>
                        ) : (
                          <div className="text-xs text-[#94A3B8] italic text-center py-1.5 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                            {hasAsset ? 'Restricted' : 'Archived'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs min-w-[700px]">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-bold text-[#64748B] uppercase tracking-wider font-heading">
                    <th className="py-3 px-5">Jewellery Design</th>
                    <th className="py-3 px-5">SKU / Code</th>
                    <th className="py-3 px-5">File Size</th>
                    <th className="py-3 px-5">Downloaded By</th>
                    <th className="py-3 px-5">Timestamp</th>
                    <th className="py-3 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-[#64748B]">
                        Loading downloaded images...
                      </td>
                    </tr>
                  ) : filteredSingleDownloads.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#64748B]">
                        <Images className="w-8 h-8 text-[#CBD5E1] mx-auto mb-2" />
                        <div className="font-semibold text-[#1E293B]">
                          {singleSearch ? 'No downloaded images match your search.' : 'No individual image downloads yet.'}
                        </div>
                        <div className="text-[11px] text-[#64748B] mt-0.5">
                          When you download a watermarked design from the gallery or batch viewer, it will be listed here.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedSingleDownloads.map((item) => {
                      const sizeKB = item.fileSize ? (item.fileSize / 1024).toFixed(1) : '—';
                      const hasAsset = !!item.assetId;
                      const isItemVideo =
                        item.filename?.toLowerCase().endsWith('.mp4') ||
                        item.filename?.toLowerCase().endsWith('.mov') ||
                        item.filename?.toLowerCase().endsWith('.webm');
                      const mediaSrc = item.url ? item.url : (item.assetId ? assetsApi.getViewUrl(item.assetId) : '');

                      return (
                        <tr key={item._id} className="hover:bg-[#F8FAFC]/60 transition">
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-[#F1F5F9] overflow-hidden border border-[#E2E8F0] flex items-center justify-center flex-shrink-0 relative">
                                {isItemVideo && mediaSrc ? (
                                  <>
                                    <video src={mediaSrc} muted className="w-full h-full object-cover pointer-events-none" />
                                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                      <Play className="w-3 h-3 fill-white text-white" />
                                    </div>
                                  </>
                                ) : mediaSrc ? (
                                  <img
                                    src={mediaSrc}
                                    alt={item.filename}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <ImageIcon className="w-4 h-4 text-[#CBD5E1]" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-[#1E293B] font-heading truncate max-w-[220px]">
                                  {item.filename}
                                </div>
                                <div className="text-[10px] text-[#64748B]">
                                  <Badge variant="success" size="sm">
                                    {item.assetType === 'processed' ? 'Watermarked' : 'Original'}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-5">
                            {item.sku ? (
                              <span className="font-mono text-xs font-semibold text-[#1E293B] bg-[#F1F5F9] px-2 py-0.5 rounded border border-[#E2E8F0]">
                                {item.sku}
                              </span>
                            ) : (
                              <span className="text-[#94A3B8] italic">—</span>
                            )}
                          </td>

                          <td className="py-3.5 px-5 text-[#64748B]">
                            {sizeKB !== '—' ? `${sizeKB} KB` : '—'}
                          </td>

                          <td className="py-3.5 px-5 text-[#64748B]">
                            <div className="font-medium text-[#1E293B]">
                              {item.downloadedBy?.name || 'Jeweller'}
                            </div>
                            <div className="text-[10px] text-[#64748B]">
                              {item.downloadedBy?.email || item.ipAddress || ''}
                            </div>
                          </td>

                          <td className="py-3.5 px-5 text-[#64748B]">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-[#94A3B8]" />
                              <span>{new Date(item.createdAt).toLocaleString()}</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-5 text-right">
                            {hasAsset && (item.assetType !== 'original' || role !== 'Viewer') ? (
                              <a
                                href={assetsApi.getDownloadUrl(item.assetId)}
                                download={item.filename}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#7C3AED]/10 hover:bg-[#7C3AED] text-[#7C3AED] hover:text-white text-xs font-semibold rounded-lg transition"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Download</span>
                              </a>
                            ) : (
                              <span className="text-xs text-[#94A3B8] italic">
                                {hasAsset ? 'Restricted' : 'Archived'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {filteredSingleDownloads.length > singlePageSize && (
              <div className="p-4 border-t border-[#E2E8F0]">
                <Pagination
                  currentPage={singlePage}
                  totalPages={singleTotalPages}
                  totalItems={filteredSingleDownloads.length}
                  pageSize={singlePageSize}
                  onPageChange={setSinglePage}
                  onPageSizeChange={setSinglePageSize}
                  pageSizeOptions={[5, 10, 20, 50]}
                  itemName="downloads"
                />
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 2: BULK ZIP PACKAGES */}
      {activeTab === 'zips' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by token or status..."
              value={zipSearch}
              onChange={(e) => {
                setZipSearch(e.target.value);
                setZipPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-[#E2E8F0] rounded-xl focus:outline-none focus:border-[#7C3AED] shadow-xs"
            />
          </div>

          <Card className="p-0 overflow-hidden">
            {/* Mobile & Tablet Card View */}
            <div className="md:hidden divide-y divide-[#E2E8F0]">
              {loading ? (
                <div className="py-10 text-center text-xs text-[#64748B]">Loading ZIP archives...</div>
              ) : filteredExports.length === 0 ? (
                <div className="py-12 text-center text-[#64748B] p-4">
                  <FileArchive className="w-8 h-8 text-[#CBD5E1] mx-auto mb-2" />
                  <div className="font-semibold text-xs text-[#1E293B]">
                    {zipSearch ? 'No ZIP packages match your search.' : 'No export archives generated yet.'}
                  </div>
                  <div className="text-[11px] text-[#64748B] mt-0.5">
                    Select multiple designs in the Design Gallery to create and stream a ZIP package.
                  </div>
                </div>
              ) : (
                paginatedExports.map((exp) => {
                  const sizeMB = exp.archiveSize ? (exp.archiveSize / (1024 * 1024)).toFixed(2) : '0';
                  const isReady = exp.status === 'completed';

                  return (
                    <div key={exp._id} className="p-3.5 sm:p-4 space-y-2.5 hover:bg-[#F8FAFC]/60 transition min-w-0">
                      <div className="flex items-start justify-between gap-2 min-w-0">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-9 h-9 rounded-lg bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center shrink-0">
                            <FileArchive className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-xs text-[#1E293B] font-heading truncate">
                              Watermarked Catalogue ZIP
                            </div>
                            <div className="text-[11px] text-[#64748B] font-mono truncate">
                              Token: {exp.downloadToken.slice(0, 12)}...
                            </div>
                          </div>
                        </div>
                        <Badge
                          variant={
                            exp.status === 'completed'
                              ? 'success'
                              : exp.status === 'failed'
                              ? 'danger'
                              : 'warning'
                          }
                          size="sm"
                        >
                          {exp.status === 'completed'
                            ? 'Ready'
                            : exp.status === 'processing'
                            ? 'Archiving...'
                            : exp.status}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#64748B] pt-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#1E293B]">{exp.fileCount} images</span>
                          <span className="text-[#CBD5E1]">•</span>
                          <span>{exp.archiveSize ? `${sizeMB} MB` : 'Calculating...'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-[#94A3B8] shrink-0">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>Exp: {new Date(exp.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      <div className="pt-0.5">
                        {isReady ? (
                          <a
                            href={exportsApi.getDownloadUrl(exp.downloadToken)}
                            className="w-full justify-center inline-flex items-center gap-1.5 px-3 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold rounded-lg shadow-xs transition"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download ZIP Archive</span>
                          </a>
                        ) : (
                          <div className="text-xs text-[#64748B] italic text-center py-1.5 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                            Processing archive...
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs min-w-[750px]">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-bold text-[#64748B] uppercase tracking-wider font-heading">
                    <th className="py-3 px-5">Archive Package</th>
                    <th className="py-3 px-5">Image Count</th>
                    <th className="py-3 px-5">Archive Size</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5">Created On</th>
                    <th className="py-3 px-5">Expires In</th>
                    <th className="py-3 px-5 text-right">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-[#64748B]">
                        Loading ZIP archives...
                      </td>
                    </tr>
                  ) : filteredExports.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#64748B]">
                        <FileArchive className="w-8 h-8 text-[#CBD5E1] mx-auto mb-2" />
                        <div className="font-semibold text-[#1E293B]">
                          {zipSearch ? 'No ZIP packages match your search.' : 'No export archives generated yet.'}
                        </div>
                        <div className="text-[11px] text-[#64748B] mt-0.5">
                          Select multiple designs in the Design Gallery to create and stream a ZIP package.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedExports.map((exp) => {
                      const sizeMB = exp.archiveSize ? (exp.archiveSize / (1024 * 1024)).toFixed(2) : '0';
                      const isReady = exp.status === 'completed';

                      return (
                        <tr key={exp._id} className="hover:bg-[#F8FAFC]/60 transition">
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-2.5 font-semibold text-[#1E293B] font-heading">
                              <FileArchive className="w-4 h-4 text-[#7C3AED]" />
                              Watermarked Catalogue ZIP
                            </div>
                            <div className="text-[11px] text-[#64748B] font-mono">
                              Token: {exp.downloadToken.slice(0, 12)}...
                            </div>
                          </td>

                          <td className="py-3.5 px-5 font-semibold text-[#1E293B]">
                            {exp.fileCount} images
                          </td>

                          <td className="py-3.5 px-5 text-[#64748B]">
                            {exp.archiveSize ? `${sizeMB} MB` : 'Calculating...'}
                          </td>

                          <td className="py-3.5 px-5">
                            <Badge
                              variant={
                                exp.status === 'completed'
                                  ? 'success'
                                  : exp.status === 'failed'
                                  ? 'danger'
                                  : 'warning'
                              }
                            >
                              {exp.status === 'completed'
                                ? 'Ready'
                                : exp.status === 'processing'
                                ? 'Archiving...'
                                : exp.status}
                            </Badge>
                          </td>

                          <td className="py-3.5 px-5 text-[#64748B]">
                            {new Date(exp.createdAt).toLocaleDateString()}
                          </td>

                          <td className="py-3.5 px-5 text-[#64748B]">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {new Date(exp.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>

                          <td className="py-3.5 px-5 text-right">
                            {isReady ? (
                              <a
                                href={exportsApi.getDownloadUrl(exp.downloadToken)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold rounded-lg shadow-xs transition"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Download ZIP
                              </a>
                            ) : (
                              <span className="text-xs text-[#64748B] italic">Processing...</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {filteredExports.length > zipPageSize && (
              <div className="p-4 border-t border-[#E2E8F0]">
                <Pagination
                  currentPage={zipPage}
                  totalPages={zipTotalPages}
                  totalItems={filteredExports.length}
                  pageSize={zipPageSize}
                  onPageChange={setZipPage}
                  onPageSizeChange={setZipPageSize}
                  pageSizeOptions={[5, 10, 20, 50]}
                  itemName="archives"
                />
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};
