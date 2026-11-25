import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  History,
  RotateCw,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  Images,
  Cpu,
  Search,
  Filter,
  Download,
  Play,
  Video,
} from 'lucide-react';
import { processingApi, assetsApi } from '../../api/index.js';
import { ProcessingBatch, ProcessingItem } from '../../types/index.js';
import { Card, Button, Badge, Modal, EmptyState, ConfirmDeleteModal, Pagination, CustomVideoPlayer } from '../../components/common/index.js';
import { useAuthStore } from '../../store/authStore.js';

export const ProcessingHistoryPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const activeBatchFromUrl = searchParams.get('activeBatch');

  const { role, company, permissions } = useAuthStore();
  const canProcess =
    role === 'Company' || (role === 'Designer' && permissions?.canProcess !== false);
  const canDownloadOutput =
    role === 'Company' ||
    role === 'Designer' ||
    (role === 'Viewer' && company?.settings?.allowViewerDownload !== false);

  const [batches, setBatches] = useState<ProcessingBatch[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Batch Detail Modal
  const [inspectBatchId, setInspectBatchId] = useState<string | null>(activeBatchFromUrl || null);
  const [inspectBatch, setInspectBatch] = useState<ProcessingBatch | null>(null);
  const [batchItems, setBatchItems] = useState<ProcessingItem[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [previewItem, setPreviewItem] = useState<ProcessingItem | null>(null);
  const [cancelBatchTarget, setCancelBatchTarget] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);

  const fetchBatches = async () => {
    try {
      const res = await processingApi.listBatches();
      const list = res.data.data || [];
      setBatches(list);
      return list;
    } catch (err) {
      console.error('Failed to load batches:', err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const loadBatchDetails = async (batchId: string, showSpinner = true) => {
    if (showSpinner) setLoadingDetails(true);
    try {
      const res = await processingApi.getBatchById(batchId);
      const b = res.data.data.batch;
      setInspectBatch(b);
      setBatchItems(res.data.data.items || []);
      return b;
    } catch (err) {
      console.error('Failed to load batch details:', err);
      return null;
    } finally {
      if (showSpinner) setLoadingDetails(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchBatches();
    if (inspectBatchId) {
      loadBatchDetails(inspectBatchId, true);
    }
  }, []);

  // Smart polling: ONLY poll if any batch in the list or the inspected batch is actively queued/processing/pending
  useEffect(() => {
    const hasActiveBatches = batches.some(
      (b) => b.status === 'processing' || b.status === 'queued' || b.status === 'pending'
    );
    const isInspectActive =
      inspectBatch &&
      (inspectBatch.status === 'processing' ||
        inspectBatch.status === 'queued' ||
        inspectBatch.status === 'pending');

    // If nothing is actively running, do NOT poll
    if (!hasActiveBatches && !isInspectActive) {
      return;
    }

    const timer = setTimeout(async () => {
      await fetchBatches();
      if (inspectBatchId && isInspectActive) {
        await loadBatchDetails(inspectBatchId, false);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [batches, inspectBatch, inspectBatchId]);

  const handleOpenDetails = (batchId: string) => {
    setInspectBatchId(batchId);
    loadBatchDetails(batchId, true);
  };

  const handleRetry = async (batchId: string) => {
    try {
      await processingApi.retryBatch(batchId);
      fetchBatches();
      if (inspectBatchId) loadBatchDetails(inspectBatchId);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Retry failed.');
    }
  };

  const confirmCancelJob = async () => {
    if (!cancelBatchTarget) return;
    setCanceling(true);
    try {
      await processingApi.cancelBatch(cancelBatchTarget);
      setCancelBatchTarget(null);
      fetchBatches();
      if (inspectBatchId) loadBatchDetails(inspectBatchId);
    } catch (err: any) {
      console.error('Cancel batch error:', err);
    } finally {
      setCanceling(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      case 'processing':
        return <Badge variant="primary">Processing...</Badge>;
      case 'queued':
        return <Badge variant="warning">Queued</Badge>;
      case 'completed_with_errors':
        return <Badge variant="warning">Completed with Errors</Badge>;
      case 'failed':
        return <Badge variant="danger">Failed</Badge>;
      case 'cancelled':
        return <Badge variant="neutral">Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const filteredBatches = batches.filter((b) => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = (b.templateId?.name || 'custom watermark batch').toLowerCase();
      const id = b._id.toLowerCase();
      const user = (b.requestedBy?.name || '').toLowerCase();
      if (!name.includes(q) && !id.includes(q) && !user.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredBatches.length / pageSize) || 1;
  const paginatedBatches = filteredBatches.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1E293B] font-heading">
            Processing History & Queue
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Monitor background Sharp rendering tasks, track item progress, and trigger error retries.
          </p>
        </div>

        <Button size="sm" variant="outline" onClick={fetchBatches} className="self-start sm:self-auto shrink-0">
          <RotateCw className="w-3.5 h-3.5 mr-1" />
          Refresh Status
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-[#E2E8F0] shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by template name, batch ID, or user..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#7C3AED] focus:bg-white transition"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Filter className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#1E293B] focus:outline-none focus:border-[#7C3AED] cursor-pointer w-full sm:w-auto"
          >
            <option value="all">All Statuses</option>
            <option value="queued">Queued</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="completed_with_errors">Completed with Errors</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {/* Mobile & Tablet Card View */}
        <div className="md:hidden divide-y divide-[#E2E8F0]">
          {loading ? (
            <div className="py-10 text-center text-xs text-[#64748B]">Loading processing history...</div>
          ) : filteredBatches.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#64748B]">
              {searchQuery || statusFilter !== 'all'
                ? 'No batches match your filter criteria.'
                : 'No batch operations recorded yet.'}
            </div>
          ) : (
            paginatedBatches.map((batch) => {
              const total = batch.counters?.total || 0;
              const completed = batch.counters?.completed || 0;
              const failed = batch.counters?.failed || 0;
              const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
              const isRunning = batch.status === 'processing' || batch.status === 'queued';

              return (
                <div key={batch._id} className="p-4 space-y-3 hover:bg-[#F8FAFC]/60 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-[#1E293B] font-heading">
                        {batch.templateId?.name || 'Custom Watermark Batch'}
                      </div>
                      <div className="text-[11px] font-mono text-[#64748B] mt-0.5">
                        ID: {batch._id.slice(-8)}
                      </div>
                    </div>
                    {getStatusBadge(batch.status)}
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-[#64748B]">
                      <span>{completed} / {total} done ({percent}%)</span>
                      {failed > 0 && (
                        <span className="text-[#DC2626] font-semibold">({failed} failed)</span>
                      )}
                    </div>
                    <div className="w-full bg-[#F1F5F9] rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          failed > 0 ? 'bg-[#D97706]' : 'bg-[#16A34A]'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Metadata Row */}
                  <div className="flex flex-wrap items-center justify-between text-[11px] text-[#64748B] pt-1">
                    <span className="uppercase font-mono">
                      {batch.outputSettings?.format || 'JPEG'} @ {batch.outputSettings?.quality || 90}%
                    </span>
                    <span>By: {batch.requestedBy?.name || 'User'}</span>
                    <div className="flex items-center gap-1 text-[10px] text-[#94A3B8]">
                      <Clock className="w-3 h-3" />
                      <span>
                        {new Date(batch.createdAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Actions for Mobile */}
                  <div className="flex items-center gap-2 pt-2 border-t border-[#F1F5F9]">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenDetails(batch._id)}
                      className="flex-1 justify-center text-xs py-1.5"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      Inspect Items
                    </Button>

                    {canProcess && failed > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRetry(batch._id)}
                        className="text-[#D97706] border-[#D97706]/30 hover:bg-[#D97706]/10 text-xs py-1.5"
                      >
                        <RotateCw className="w-3.5 h-3.5 mr-1" />
                        Retry
                      </Button>
                    )}

                    {canProcess && isRunning && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCancelBatchTarget(batch._id)}
                        className="text-[#DC2626] border-[#DC2626]/30 hover:bg-[#DC2626]/10 text-xs py-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" />
                        Cancel
                      </Button>
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
                <th className="py-3 px-5">Batch ID / Template</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5">Progress</th>
                <th className="py-3 px-5">Format</th>
                <th className="py-3 px-5">Started By</th>
                <th className="py-3 px-5">Timestamp</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[#64748B]">
                    Loading processing history...
                  </td>
                </tr>
              ) : filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[#64748B]">
                    {searchQuery || statusFilter !== 'all'
                      ? 'No batches match your filter criteria.'
                      : 'No batch operations recorded yet.'}
                  </td>
                </tr>
              ) : (
                paginatedBatches.map((batch) => {
                  const total = batch.counters?.total || 0;
                  const completed = batch.counters?.completed || 0;
                  const failed = batch.counters?.failed || 0;
                  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
                  const isRunning = batch.status === 'processing' || batch.status === 'queued';

                  return (
                    <tr key={batch._id} className="hover:bg-[#F8FAFC]/60 transition">
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-[#1E293B] font-heading">
                          {batch.templateId?.name || 'Custom Watermark Batch'}
                        </div>
                        <div className="text-[11px] font-mono text-[#64748B]">
                          ID: {batch._id.slice(-8)}
                        </div>
                      </td>

                      <td className="py-3.5 px-5">{getStatusBadge(batch.status)}</td>

                      <td className="py-3.5 px-5 w-48">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-[#64748B]">
                            <span>
                              {completed} / {total} done
                            </span>
                            {failed > 0 && (
                              <span className="text-[#DC2626] font-semibold">({failed} failed)</span>
                            )}
                          </div>
                          <div className="w-full bg-[#F1F5F9] rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                failed > 0 ? 'bg-[#D97706]' : 'bg-[#16A34A]'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-5 uppercase font-mono text-[11px] text-[#64748B]">
                        {batch.outputSettings?.format || 'JPEG'} @ {batch.outputSettings?.quality || 90}%
                      </td>

                      <td className="py-3.5 px-5 text-[#64748B]">
                        {batch.requestedBy?.name || 'User'}
                      </td>

                      <td className="py-3.5 px-5 text-[#64748B]">
                        {new Date(batch.createdAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleOpenDetails(batch._id)}
                            title="Inspect items"
                            className="p-1.5 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#1E293B] transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {canProcess && failed > 0 && (
                            <button
                              onClick={() => handleRetry(batch._id)}
                              title="Retry Failed Items"
                              className="p-1.5 rounded-lg border border-[#E2E8F0] text-[#D97706] hover:bg-[#D97706]/10 transition"
                            >
                              <RotateCw className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {canProcess && isRunning && (
                            <button
                              onClick={() => setCancelBatchTarget(batch._id)}
                              title="Cancel Batch"
                              className="p-1.5 rounded-lg border border-[#E2E8F0] text-[#DC2626] hover:bg-[#DC2626]/10 transition cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filteredBatches.length > pageSize && (
          <div className="p-4 border-t border-[#E2E8F0]">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredBatches.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[5, 10, 20, 50]}
              itemName="batches"
            />
          </div>
        )}
      </Card>

      {/* Batch Item Inspection Modal */}
      {inspectBatchId && (
        <Modal
          isOpen={!!inspectBatchId}
          onClose={() => setInspectBatchId(null)}
          title={`Batch Details: ${inspectBatch?.templateId?.name || 'Watermark Job'}`}
          description={`Batch ID: ${inspectBatchId}`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-4">
            {loadingDetails ? (
              <div className="py-8 text-center text-xs text-[#64748B]">Loading items...</div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto divide-y divide-[#E2E8F0]">
                {batchItems.map((item) => {
                  const isItemVideo =
                    item.outputAssetId?.mimeType?.startsWith('video/') ||
                    item.sourceAssetId?.mimeType?.startsWith('video/') ||
                    item.designId?.mediaType === 'video' ||
                    item.designId?.filename?.toLowerCase().endsWith('.mp4') ||
                    item.designId?.filename?.toLowerCase().endsWith('.mov') ||
                    item.designId?.filename?.toLowerCase().endsWith('.webm') ||
                    item.outputAssetId?.originalFilename?.toLowerCase().endsWith('.mp4');

                  const thumbSrc = item.designId?.thumbnailAssetId
                    ? assetsApi.getViewUrl(item.designId.thumbnailAssetId)
                    : null;
                  const resultUrl = item.outputAssetId
                    ? assetsApi.getViewUrl(item.outputAssetId)
                    : (item.sourceAssetId ? assetsApi.getViewUrl(item.sourceAssetId) : '');

                  return (
                    <div key={item._id} className="py-3 flex items-center justify-between text-xs hover:bg-[#F8FAFC] px-2 rounded-xl transition">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Thumbnail tile with click to preview */}
                        <div
                          onClick={() => {
                            if (item.outputAssetId || item.sourceAssetId) {
                              setPreviewItem(item);
                            }
                          }}
                          className="relative w-12 h-12 rounded-lg bg-black/5 overflow-hidden border border-[#E2E8F0] flex items-center justify-center flex-shrink-0 cursor-pointer group hover:ring-2 hover:ring-[#7C3AED]/40 transition"
                          title="Click to preview result"
                        >
                          {isItemVideo ? (
                            thumbSrc ? (
                              <img
                                src={thumbSrc}
                                alt={item.designId?.filename || 'Result'}
                                className="w-full h-full object-cover"
                              />
                            ) : resultUrl ? (
                              <video
                                src={resultUrl}
                                muted
                                className="w-full h-full object-cover pointer-events-none"
                              />
                            ) : (
                              <Video className="w-5 h-5 text-[#CBD5E1]" />
                            )
                          ) : item.outputAssetId ? (
                            <img
                              src={assetsApi.getViewUrl(item.outputAssetId)}
                              alt="Result"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Images className="w-5 h-5 text-[#CBD5E1]" />
                          )}

                          {isItemVideo && (
                            <div className="absolute inset-0 bg-black/35 group-hover:bg-black/20 flex items-center justify-center transition">
                              <div className="w-5 h-5 rounded-full bg-white/95 text-[#7C3AED] flex items-center justify-center shadow-xs">
                                <Play className="w-2.5 h-2.5 fill-[#7C3AED] translate-x-0.2" />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Title, SKU & Status */}
                        <div className="min-w-0">
                          <div className="font-semibold text-[#1E293B] font-heading flex items-center gap-1.5 truncate">
                            <span className="truncate">{item.designId?.filename || 'Jewellery Design'}</span>
                            {isItemVideo && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 shrink-0">
                                VIDEO
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#64748B] font-mono">
                            SKU: {item.designId?.sku || 'N/A'}
                          </div>
                          {item.errorDetails && (
                            <div className="text-[11px] text-[#DC2626] truncate">{item.errorDetails}</div>
                          )}
                        </div>
                      </div>

                      {/* Right Action buttons */}
                      <div className="flex items-center gap-2.5 flex-shrink-0">
                        {item.status === 'completed' && (
                          <Badge variant="success">Processed</Badge>
                        )}
                        {item.status === 'processing' && (
                          <Badge variant="primary">Processing</Badge>
                        )}
                        {item.status === 'failed' && <Badge variant="danger">Failed</Badge>}
                        {item.status === 'pending' && <Badge variant="neutral">Pending</Badge>}

                        {(item.outputAssetId || item.sourceAssetId) && (
                          <button
                            type="button"
                            onClick={() => setPreviewItem(item)}
                            className="text-[#7C3AED] hover:text-[#6D28D9] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                            title="Preview jewellery result"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview</span>
                          </button>
                        )}

                        {item.outputAssetId && canDownloadOutput && (
                          <a
                            href={assetsApi.getDownloadUrl(item.outputAssetId._id)}
                            download={
                              item.designId?.filename
                                ? (isItemVideo && !item.designId.filename.toLowerCase().endsWith('.mp4')
                                    ? `${item.designId.filename}_watermarked.mp4`
                                    : item.designId.filename)
                                : (isItemVideo ? 'watermarked_video.mp4' : 'watermarked_jewellery.webp')
                            }
                            className="text-[#B8860B] hover:text-[#9A7009] hover:underline font-semibold flex items-center gap-1"
                            title="Download watermarked file"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Media Inspection Preview Modal */}
      {previewItem && (
        <Modal
          isOpen={!!previewItem}
          onClose={() => setPreviewItem(null)}
          title={`Inspection Result: ${previewItem.designId?.filename || 'Watermarked Output'}`}
          description={`SKU: ${previewItem.designId?.sku || 'N/A'} • Status: ${previewItem.status.toUpperCase()}`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-4">
            <div className="aspect-video max-h-[520px] bg-black rounded-xl overflow-hidden border border-[#E2E8F0] flex items-center justify-center">
              {previewItem.outputAssetId?.mimeType?.startsWith('video/') ||
              previewItem.sourceAssetId?.mimeType?.startsWith('video/') ||
              previewItem.designId?.mediaType === 'video' ||
              previewItem.designId?.filename?.toLowerCase().endsWith('.mp4') ? (
                <CustomVideoPlayer
                  key={previewItem._id}
                  src={
                    previewItem.outputAssetId
                      ? assetsApi.getViewUrl(previewItem.outputAssetId)
                      : assetsApi.getViewUrl(previewItem.sourceAssetId)
                  }
                  title={previewItem.designId?.filename}
                  className="w-full h-full"
                />
              ) : (
                <img
                  src={
                    previewItem.outputAssetId
                      ? assetsApi.getViewUrl(previewItem.outputAssetId)
                      : assetsApi.getViewUrl(previewItem.sourceAssetId)
                  }
                  alt={previewItem.designId?.filename || 'Result Preview'}
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#E2E8F0] text-xs">
              <span className="text-[#64748B] font-mono">
                Asset ID: {previewItem.outputAssetId?._id || previewItem.sourceAssetId?._id}
              </span>
              {previewItem.outputAssetId && canDownloadOutput && (
                <a
                  href={assetsApi.getDownloadUrl(previewItem.outputAssetId._id)}
                  download={
                    previewItem.designId?.filename || 'watermarked_jewellery.mp4'
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Result</span>
                </a>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Reusable Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!cancelBatchTarget}
        onClose={() => setCancelBatchTarget(null)}
        onConfirm={confirmCancelJob}
        title="Cancel Processing Batch?"
        description="Are you sure you want to cancel this processing job? Any images already watermarked will be saved, but remaining queue items will be stopped."
        confirmText="Cancel Batch"
        variant="warning"
        loading={canceling}
      />
    </div>
  );
};
