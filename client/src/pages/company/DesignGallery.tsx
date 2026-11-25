import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Images,
  Search,
  Filter,
  Sparkles,
  Download,
  Trash2,
  Stamp,
  CheckSquare,
  Square,
  Eye,
  ExternalLink,
  SplitSquareVertical,
  Upload,
  FileArchive,
  CheckCircle2,
  Video,
  Play,
  Layers,
} from 'lucide-react';
import { designsApi, projectsApi, templatesApi, exportsApi, assetsApi } from '../../api/index.js';
import { Design, Project, WatermarkTemplate } from '../../types/index.js';
import {
  Card,
  Button,
  Badge,
  Modal,
  EmptyState,
  ConfirmDeleteModal,
  Pagination,
  CustomVideoPlayer,
  MultiPlatformResizeModal,
} from '../../components/common/index.js';
import { useAuthStore } from '../../store/authStore.js';
import { useWatermarkStore } from '../../store/watermarkStore.js';

export const DesignGallery: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialProjectId = searchParams.get('projectId') || searchParams.get('project') || '';
  const initialStatus = searchParams.get('status') || 'all';

  const { role, permissions, company } = useAuthStore();
  const setReferenceImage = useWatermarkStore((s) => s.setReferenceImage);
  const navigate = useNavigate();

  const [designs, setDesigns] = useState<Design[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<WatermarkTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [totalDesigns, setTotalDesigns] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedProject, setSelectedProject] = useState(initialProjectId);
  const [selectedStatus, setSelectedStatus] = useState(initialStatus);
  const [searchQuery, setSearchQuery] = useState('');

  // Sync state with URL search params on navigation (e.g. from Dashboard or Projects link)
  useEffect(() => {
    const proj = searchParams.get('projectId') || searchParams.get('project') || '';
    const stat = searchParams.get('status') || 'all';
    setSelectedProject(proj);
    setSelectedStatus(stat);
    setPage(1);
  }, [searchParams]);

  // Single Image Watermark Modal state
  const [watermarkTarget, setWatermarkTarget] = useState<Design | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [watermarkingSingle, setWatermarkingSingle] = useState(false);

  // Preview Modal
  const [previewDesign, setPreviewDesign] = useState<Design | null>(null);
  const [compareMode, setCompareMode] = useState<'watermarked' | 'original' | 'split'>('watermarked');
  const [exporting, setExporting] = useState(false);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);

  // Dual Viewing: 'watermarked' (default) vs 'original' (master uploads) vs 'both'
  const [galleryViewMode, setGalleryViewMode] = useState<'watermarked' | 'original' | 'both'>('watermarked');
  // Card-specific overrides (allows flipping a single card directly)
  const [cardViewOverrides, setCardViewOverrides] = useState<Record<string, 'watermarked' | 'original'>>({});
  // Reusable Delete Modal state
  const [deleteDesignTarget, setDeleteDesignTarget] = useState<Design | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Multi-Platform Auto-Resizer Modal state
  const [resizeTargetDesign, setResizeTargetDesign] = useState<Design | null>(null);
  const [isBatchResizeOpen, setIsBatchResizeOpen] = useState(false);

  const canUpload = role === 'Company' || (role === 'Designer' && permissions?.canUpload !== false);
  const canDelete = role === 'Company' || (role === 'Designer' && permissions?.canDeleteDesign !== false);
  const canProcess = role === 'Company' || (role === 'Designer' && permissions?.canProcess !== false);
  const canDownloadSingle =
    role === 'Company' ||
    role === 'Designer' ||
    (role === 'Viewer' && company?.settings?.allowViewerDownload !== false);
  const canDownloadMaster = role === 'Company' || role === 'Designer';
  const canDownloadZip =
    role === 'Company' ||
    (role === 'Designer' && permissions?.canExportZip !== false) ||
    (role === 'Viewer' && company?.settings?.allowViewerZipDownload === true);

  const fetchDesigns = async () => {
    setLoading(true);
    try {
      const res = await designsApi.list({
        projectId: selectedProject || undefined,
        processingStatus: selectedStatus !== 'all' ? selectedStatus : undefined,
        search: searchQuery || undefined,
        page,
        limit: pageSize,
      });
      setDesigns(res.data.data || []);
      if (res.data.pagination) {
        setTotalDesigns(res.data.pagination.total);
        setTotalPages(res.data.pagination.pages || 1);
      }
    } catch (err) {
      console.error('Failed to load designs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    projectsApi.list().then((res) => setProjects(res.data.data || []));
    templatesApi.list().then((res) => {
      const list = res.data.data || [];
      setTemplates(list);
      const def = list.find((t: WatermarkTemplate) => t.isDefault) || list[0];
      if (def) setSelectedTemplateId(def._id);
    });
  }, []);

  const handleSingleWatermark = async () => {
    if (!watermarkTarget) return;
    setWatermarkingSingle(true);
    try {
      await designsApi.applyWatermark(watermarkTarget._id, {
        templateId: selectedTemplateId || undefined,
      });
      setDownloadToast(`✓ Watermark applied to ${watermarkTarget.filename}!`);
      setTimeout(() => setDownloadToast(null), 4000);
      setWatermarkTarget(null);
      fetchDesigns();
    } catch (err: any) {
      console.error('Failed to apply watermark:', err);
      setDownloadToast(`⚠ Watermark failed: ${err.response?.data?.message || err.message}`);
      setTimeout(() => setDownloadToast(null), 4000);
    } finally {
      setWatermarkingSingle(false);
    }
  };

  useEffect(() => {
    fetchDesigns();
  }, [selectedProject, selectedStatus, searchQuery, page, pageSize]);

  const toggleSelectAll = () => {
    if (selectedIds.length === designs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(designs.map((d) => d._id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const confirmDeleteDesign = async () => {
    if (!deleteDesignTarget) return;
    setDeleting(true);
    try {
      await designsApi.delete(deleteDesignTarget._id);
      if (previewDesign?._id === deleteDesignTarget._id) {
        setPreviewDesign(null);
      }
      setSelectedIds((prev) => prev.filter((id) => id !== deleteDesignTarget._id));
      setDeleteDesignTarget(null);
      fetchDesigns();
      setDownloadToast(`✓ Deleted ${deleteDesignTarget.filename}`);
      setTimeout(() => setDownloadToast(null), 3000);
    } catch (err: any) {
      console.error('Failed to delete design:', err);
      setDownloadToast(`⚠ Delete failed: ${err.response?.data?.message || err.message}`);
      setTimeout(() => setDownloadToast(null), 4000);
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkDeleting(true);
    try {
      const count = selectedIds.length;
      await designsApi.bulkDelete(selectedIds);
      if (previewDesign && selectedIds.includes(previewDesign._id)) {
        setPreviewDesign(null);
      }
      setSelectedIds([]);
      setIsBulkDeleteOpen(false);
      fetchDesigns();
      setDownloadToast(`✓ Successfully deleted ${count} jewellery design${count > 1 ? 's' : ''}`);
      setTimeout(() => setDownloadToast(null), 3500);
    } catch (err: any) {
      console.error('Failed to bulk delete designs:', err);
      setDownloadToast(`⚠ Delete failed: ${err.response?.data?.message || err.message}`);
      setTimeout(() => setDownloadToast(null), 4000);
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleOpenInEditor = (design: Design) => {
    if (design.originalAssetId) {
      setReferenceImage(design.originalAssetId);
      const editorPath = role === 'Company' ? '/company/editor' : '/designer/editor';
      navigate(editorPath);
    }
  };

  const handleBulkProcess = () => {
    const processingPath =
      role === 'Company' ? '/company/processing' : '/designer/processing';
    navigate(`${processingPath}?designIds=${selectedIds.join(',')}`);
  };

  const handleDownloadSelected = async (targetType: 'watermarked' | 'original' | 'both' = 'watermarked') => {
    if (selectedIds.length === 0) return;
    const selectedDesigns = designs.filter((d) => selectedIds.includes(d._id));

    // Case 1: Single image selected -> Direct instant download
    if (selectedDesigns.length === 1 && targetType !== 'both') {
      const design = selectedDesigns[0];
      const asset =
        targetType === 'original'
          ? design.originalAssetId
          : design.activeProcessedAssetId || design.originalAssetId;
      if (!asset) return;

      const link = document.createElement('a');
      link.href = assetsApi.getDownloadUrl(asset);
      link.setAttribute('download', asset.originalFilename || design.filename || 'jewellery.webp');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloadToast(`✓ Downloaded ${asset.originalFilename || design.filename}`);
      setTimeout(() => setDownloadToast(null), 3500);
      return;
    }

    // Case 2: Multiple images selected -> Direct ZIP export & download
    setExporting(true);
    const label =
      targetType === 'original'
        ? 'Original Masters'
        : targetType === 'both'
        ? 'Complete Bundle (Originals + Watermarked)'
        : 'Watermarked';

    setDownloadToast(`⏳ Preparing ZIP archive (${label}) for ${selectedDesigns.length} designs...`);
    try {
      let targetAssets: any[] = [];
      if (targetType === 'original') {
        targetAssets = selectedDesigns.map((d) => d.originalAssetId).filter(Boolean);
      } else if (targetType === 'watermarked') {
        targetAssets = selectedDesigns
          .map((d) => d.activeProcessedAssetId || d.originalAssetId)
          .filter(Boolean);
      } else {
        // Both: includes original AND active processed
        selectedDesigns.forEach((d) => {
          if (d.originalAssetId) targetAssets.push(d.originalAssetId);
          if (d.activeProcessedAssetId) targetAssets.push(d.activeProcessedAssetId);
        });
      }

      const assetIds = targetAssets
        .map((a) => a?._id || (typeof a === 'string' ? a : null))
        .filter(Boolean) as string[];

      const res = await exportsApi.createExport({ assetIds });
      let token = res.data.data?.downloadToken;
      let ready = res.data.data?.status === 'completed';

      // If still processing, poll briefly until ready
      if (!ready && res.data.data?._id) {
        for (let i = 0; i < 20; i++) {
          await new Promise((r) => setTimeout(r, 400));
          const checkRes = await exportsApi.getExportById(res.data.data._id);
          if (checkRes.data.data?.status === 'completed') {
            token = checkRes.data.data.downloadToken;
            ready = true;
            break;
          }
        }
      }

      if (token) {
        const downloadUrl = exportsApi.getDownloadUrl(token);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', `AurumMark_${targetType}_${Date.now()}.zip`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setDownloadToast(`✓ Downloaded ZIP archive with ${assetIds.length} images!`);
        setTimeout(() => setDownloadToast(null), 4000);
      } else {
        setDownloadToast('⚠ ZIP archive creation in progress. Please check back shortly.');
        setTimeout(() => setDownloadToast(null), 4000);
      }
    } catch (err: any) {
      console.error('Download failed:', err);
      setDownloadToast(`⚠ Download error: ${err.response?.data?.message || err.message || 'Export failed'}`);
      setTimeout(() => setDownloadToast(null), 5000);
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadSingleImages = () => {
    if (selectedIds.length === 0) return;
    const selectedDesigns = designs.filter((d) => selectedIds.includes(d._id));

    selectedDesigns.forEach((design, idx) => {
      const asset = design.activeProcessedAssetId || design.originalAssetId;
      if (!asset) return;
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = assetsApi.getDownloadUrl(asset);
        link.setAttribute('download', asset.originalFilename || design.filename || 'jewellery.webp');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, idx * 300);
    });

    setDownloadToast(`✓ Downloading ${selectedDesigns.length} individual images...`);
    setTimeout(() => setDownloadToast(null), 3500);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B] font-heading">Design Gallery</h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Browse high-resolution jewellery items, preview watermarks, and trigger batch operations.
          </p>
        </div>

        {canUpload && (
          <Link to={role === 'Company' ? '/company/upload' : '/designer/upload'}>
            <Button variant="primary" size="md">
              <Upload className="w-3.5 h-3.5 mr-1" />
              Upload Images
            </Button>
          </Link>
        )}
      </div>

      {/* Control Toolbar */}
      <Card className="p-4 space-y-3">
        {/* Dual Viewing Switcher: Watermarked vs Original Masters vs Dual View */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mr-1">
              View Mode :
            </span>
            <button
              type="button"
              onClick={() => {
                setGalleryViewMode('watermarked');
                setCardViewOverrides({});
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                galleryViewMode === 'watermarked'
                  ? 'bg-[#7C3AED] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#1E293B] hover:bg-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Watermarked Copies
            </button>
            <button
              type="button"
              onClick={() => {
                setGalleryViewMode('original');
                setCardViewOverrides({});
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                galleryViewMode === 'original'
                  ? 'bg-[#1E293B] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#1E293B] hover:bg-white'
              }`}
            >
              <Images className="w-3.5 h-3.5" />
              Original Master Uploads
            </button>
            <button
              type="button"
              onClick={() => {
                setGalleryViewMode('both');
                setCardViewOverrides({});
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                galleryViewMode === 'both'
                  ? 'bg-gradient-to-r from-[#B8860B] to-[#D4AF37] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#1E293B] hover:bg-white'
              }`}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              Dual / Comparison View
            </button>
          </div>

          <div className="text-[11px] text-[#64748B] font-medium">
            Total Designs : <span className="font-bold text-[#1E293B]">{totalDesigns}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              placeholder="Search by filename or SKU..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#E2E8F0] rounded-lg bg-white focus:outline-none focus:border-[#7C3AED]"
            />
          </div>

          {/* Collection Filter */}
          <div>
            <select
              value={selectedProject}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedProject(val);
                setPage(1);
                const nextParams = new URLSearchParams(searchParams);
                if (val) {
                  nextParams.set('projectId', val);
                  nextParams.delete('project');
                } else {
                  nextParams.delete('projectId');
                  nextParams.delete('project');
                }
                setSearchParams(nextParams);
              }}
              className="w-full px-3 py-1.5 text-xs border border-[#E2E8F0] rounded-lg bg-white font-medium focus:outline-none focus:border-[#7C3AED]"
            >
              <option value="">All Collections</option>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedStatus(val);
                setPage(1);
                const nextParams = new URLSearchParams(searchParams);
                if (val && val !== 'all') {
                  nextParams.set('status', val);
                } else {
                  nextParams.delete('status');
                }
                setSearchParams(nextParams);
              }}
              className="w-full px-3 py-1.5 text-xs border border-[#E2E8F0] rounded-lg bg-white font-medium focus:outline-none focus:border-[#7C3AED]"
            >
              <option value="all">All Statuses</option>
              <option value="unprocessed">Unprocessed Masters</option>
              <option value="processed">Watermarked Copies</option>
              <option value="processing">In Processing</option>
              <option value="failed">Failed Jobs</option>
            </select>
          </div>
        </div>

        {/* Multi-Select Action Bar */}
        <div className="flex flex-wrap items-center justify-between pt-2 border-t border-[#E2E8F0] text-xs">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 font-semibold text-[#64748B] hover:text-[#1E293B]"
          >
            {selectedIds.length === designs.length && designs.length > 0 ? (
              <CheckSquare className="w-4 h-4 text-[#7C3AED]" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            Select All ({selectedIds.length} of {designs.length})
          </button>

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {canProcess && (
                <Button variant="primary" size="sm" onClick={handleBulkProcess}>
                  <Stamp className="w-3.5 h-3.5 mr-1" />
                  Watermark Selected ({selectedIds.length})
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsBatchResizeOpen(true)}
                className="border-[#7C3AED]/40 text-[#7C3AED] hover:bg-purple-50 font-semibold"
              >
                <Layers className="w-3.5 h-3.5 mr-1" />
                Multi-Platform Export ({selectedIds.length})
              </Button>

              {canDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={exporting || bulkDeleting}
                  onClick={() => setIsBulkDeleteOpen(true)}
                  className="border-[#DC2626] text-[#DC2626] hover:bg-[#DC2626]/10 font-semibold"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Delete Selected ({selectedIds.length})
                </Button>
              )}

              {selectedIds.length === 1 ? (
                <div className="flex items-center gap-1.5">
                  {canDownloadSingle && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={exporting}
                      onClick={() => handleDownloadSelected('watermarked')}
                      className="border-[#7C3AED] text-[#7C3AED] hover:bg-[#7C3AED]/10 font-semibold"
                    >
                      <Download className="w-3.5 h-3.5 mr-1" />
                      Download Watermarked
                    </Button>
                  )}
                  {canDownloadMaster && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={exporting}
                      onClick={() => handleDownloadSelected('original')}
                      className="border-[#16A34A] text-[#16A34A] hover:bg-[#16A34A]/10 font-semibold"
                    >
                      <Images className="w-3.5 h-3.5 mr-1" />
                      Download Master
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {canDownloadZip && (
                    <>
                      <Button
                        variant="gold"
                        size="sm"
                        disabled={exporting}
                        onClick={() => handleDownloadSelected('watermarked')}
                        className="shadow-sm font-semibold"
                      >
                        <FileArchive className="w-3.5 h-3.5 mr-1" />
                        {exporting ? 'Creating ZIP...' : `Download Watermarked ZIP (${selectedIds.length})`}
                      </Button>

                      {canDownloadMaster && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={exporting}
                            onClick={() => handleDownloadSelected('original')}
                            className="border-[#1E293B] text-[#1E293B] hover:bg-slate-100 font-semibold"
                            title="Download raw original master photos in ZIP"
                          >
                            <FileArchive className="w-3.5 h-3.5 mr-1" />
                            Download Masters ZIP
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            disabled={exporting}
                            onClick={() => handleDownloadSelected('both')}
                            className="border-[#B8860B] text-[#B8860B] hover:bg-[#B8860B]/10 font-semibold"
                            title="Download ZIP with both Originals and Watermarked organized into folders"
                          >
                            <FileArchive className="w-3.5 h-3.5 mr-1" />
                            Download Both (ZIP Bundle)
                          </Button>
                        </>
                      )}
                    </>
                  )}

                  {canDownloadSingle && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={exporting}
                      onClick={handleDownloadSingleImages}
                      title="Download each image individually without zipping"
                    >
                      <Download className="w-3.5 h-3.5 mr-1" />
                      Individual Images ({selectedIds.length})
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Gallery Grid */}
      {loading ? (
        <div className="py-16 text-center text-xs text-[#64748B]">Loading jewellery gallery...</div>
      ) : designs.length === 0 ? (
        <EmptyState
          icon={Images}
          title="No Jewellery Designs Found"
          description="Upload your original jewellery photography or select another collection filter."
          actionText={canUpload ? 'Upload Jewellery Images' : undefined}
          onAction={canUpload ? () => navigate(role === 'Company' ? '/company/upload' : '/designer/upload') : undefined}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {designs.map((design) => {
            const isSelected = selectedIds.includes(design._id);
            const hasProcessed = !!design.activeProcessedAssetId;

            // Determine which version to show: individual card override takes precedence, then galleryViewMode
            const cardMode =
              cardViewOverrides[design._id] ||
              (galleryViewMode === 'original' ? 'original' : 'watermarked');

            const displayAsset =
              cardMode === 'original'
                ? design.originalAssetId
                : design.activeProcessedAssetId || design.originalAssetId;

            const previewUrl = displayAsset ? assetsApi.getViewUrl(displayAsset) : '';
            const isVideo = design.mediaType === 'video';
            const thumbUrl = design.thumbnailAssetId ? assetsApi.getViewUrl(design.thumbnailAssetId) : '';

            return (
              <div
                key={design._id}
                className={`bg-white rounded-xl border overflow-hidden shadow-xs group transition flex flex-col justify-between ${
                  isSelected ? 'border-[#7C3AED] ring-2 ring-[#7C3AED]/20' : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
                }`}
              >
                {/* Image / Video Container */}
                <div className="relative aspect-square bg-[#F1F5F9] overflow-hidden flex items-center justify-center">
                  {isVideo ? (
                    <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-black/5">
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={design.filename}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      ) : previewUrl ? (
                        <video
                          src={previewUrl}
                          muted
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300 pointer-events-none"
                        />
                      ) : (
                        <Video className="w-8 h-8 text-[#CBD5E1]" />
                      )}

                      {/* Center Play Button Overlay */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity">
                        <div className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-xs flex items-center justify-center text-white shadow-md">
                          <Play className="w-4 h-4 fill-white ml-0.5" />
                        </div>
                      </div>
                    </div>
                  ) : previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={design.filename}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <Images className="w-8 h-8 text-[#CBD5E1]" />
                  )}

                  {/* Video duration/type badge */}
                  {isVideo && (
                    <div className="absolute bottom-2.5 left-2.5 z-20 flex items-center gap-1 bg-black/75 backdrop-blur-xs text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-xs pointer-events-none">
                      <Play className="w-2.5 h-2.5 fill-white" />
                      <span>{design.metadata?.duration ? `${Math.round(design.metadata.duration)}s` : 'VIDEO'}</span>
                    </div>
                  )}

                  {/* Checkbox overlay (Elevated with z-20 and crisp styling) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(design._id);
                    }}
                    className={`absolute top-2.5 left-2.5 z-20 w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer shadow-md ${
                      isSelected
                        ? 'bg-[#7C3AED] text-white ring-2 ring-white scale-105'
                        : 'bg-white/95 text-[#64748B] hover:text-[#7C3AED] hover:bg-white border border-[#E2E8F0] hover:scale-105 active:scale-95'
                    }`}
                    title={isSelected ? 'Deselect image' : 'Select image'}
                    aria-label="Select design"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-white" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>

                  {/* Card View Mode Toggle Pill (Original Master vs Watermarked) */}
                  {hasProcessed ? (
                    <div className="absolute top-2.5 right-2.5 z-20 flex items-center bg-white/95 backdrop-blur-xs rounded-lg p-0.5 border border-[#E2E8F0] shadow-sm pointer-events-auto">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCardViewOverrides((prev) => ({
                            ...prev,
                            [design._id]: 'original',
                          }));
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                          cardMode === 'original'
                            ? 'bg-[#1E293B] text-white shadow-xs'
                            : 'text-[#64748B] hover:text-[#1E293B]'
                        }`}
                        title="View Original Master Upload"
                      >
                        Original
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCardViewOverrides((prev) => ({
                            ...prev,
                            [design._id]: 'watermarked',
                          }));
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                          cardMode === 'watermarked'
                            ? 'bg-[#7C3AED] text-white shadow-xs'
                            : 'text-[#64748B] hover:text-[#1E293B]'
                        }`}
                        title="View Watermarked Version"
                      >
                        Watermarked
                      </button>
                    </div>
                  ) : (
                    <div className="absolute top-2.5 right-2.5 z-20 pointer-events-none">
                      <Badge variant="neutral" size="sm">
                        Master Upload
                      </Badge>
                    </div>
                  )}

                  {/* Quick Action Overlay on Hover */}
                  <div className="absolute inset-0 z-10 bg-black/55 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2 pointer-events-none">
                    <div className="flex flex-wrap items-center justify-center gap-2 max-w-[124px]">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewDesign(design);
                        }}
                        title="Inspect & Compare"
                        className="w-8 h-8 rounded-full bg-white text-[#1E293B] hover:text-[#7C3AED] hover:bg-purple-50 transition shadow-md pointer-events-auto cursor-pointer hover:scale-110 active:scale-95 flex items-center justify-center shrink-0"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {design.mediaType !== 'video' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setResizeTargetDesign(design);
                          }}
                          title="Multi-Platform Auto-Resizer (Social / E-Com)"
                          className="w-8 h-8 rounded-full bg-white text-[#7C3AED] hover:text-[#6D28D9] hover:bg-purple-50 transition shadow-md pointer-events-auto cursor-pointer hover:scale-110 active:scale-95 flex items-center justify-center shrink-0"
                        >
                          <Layers className="w-4 h-4" />
                        </button>
                      )}

                      {canProcess && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setWatermarkTarget(design);
                            }}
                            title="Watermark this image"
                            className="w-8 h-8 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-md pointer-events-auto cursor-pointer hover:scale-110 active:scale-95 flex items-center justify-center shrink-0"
                          >
                            <Sparkles className="w-4 h-4 text-white" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenInEditor(design);
                            }}
                            title="Open in Watermark Studio"
                            className="w-8 h-8 rounded-full bg-white text-[#1E293B] hover:text-[#B8860B] hover:bg-amber-50 transition shadow-md pointer-events-auto cursor-pointer hover:scale-110 active:scale-95 flex items-center justify-center shrink-0"
                          >
                            <Stamp className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {design.activeProcessedAssetId && canDownloadSingle && (
                        <a
                          href={assetsApi.getDownloadUrl(design.activeProcessedAssetId)}
                          download={design.filename || 'jewellery_watermarked.webp'}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDownloadToast(`✓ Downloading Watermarked: ${design.filename}`);
                            setTimeout(() => setDownloadToast(null), 3000);
                          }}
                          title="Download Watermarked Image"
                          className="w-8 h-8 rounded-full bg-white text-[#1E293B] hover:text-[#7C3AED] hover:bg-purple-50 transition shadow-md pointer-events-auto cursor-pointer hover:scale-110 active:scale-95 flex items-center justify-center shrink-0"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}

                      {design.originalAssetId && canDownloadMaster && (
                        <a
                          href={assetsApi.getDownloadUrl(design.originalAssetId)}
                          download={design.filename || 'jewellery_master.webp'}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDownloadToast(`✓ Downloading Original Master: ${design.filename}`);
                            setTimeout(() => setDownloadToast(null), 3000);
                          }}
                          title="Download Original Master Photo"
                          className="w-8 h-8 rounded-full bg-white text-[#1E293B] hover:text-[#16A34A] hover:bg-emerald-50 transition shadow-md pointer-events-auto cursor-pointer hover:scale-110 active:scale-95 flex items-center justify-center shrink-0"
                        >
                          <Images className="w-4 h-4" />
                        </a>
                      )}

                      {canDelete && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteDesignTarget(design);
                          }}
                          title="Delete jewellery design"
                          className="w-8 h-8 rounded-full bg-white text-[#DC2626] hover:bg-rose-50 hover:text-[#B91C1C] transition shadow-md pointer-events-auto cursor-pointer hover:scale-110 active:scale-95 flex items-center justify-center shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Details Footer */}
                <div className="p-3 bg-white">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#7C3AED] font-mono truncate">
                      {design.sku || 'SKU-NONE'}
                    </span>
                    {canDelete && (
                      <button
                        onClick={() => setDeleteDesignTarget(design)}
                        title="Delete design"
                        className="text-[#CBD5E1] hover:text-[#DC2626] transition p-0.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="text-xs font-semibold text-[#1E293B] truncate mt-0.5" title={design.filename}>
                    {design.filename}
                  </div>
                  <div className="text-[10px] text-[#64748B] flex items-center justify-between mt-1 pt-1 border-t border-[#F1F5F9]">
                    <span>
                      {design.metadata?.width && design.metadata?.height
                        ? `${design.metadata.width}x${design.metadata.height}`
                        : 'Image'}
                    </span>
                    <span className="font-medium text-[#7C3AED]">
                      {hasProcessed ? (cardMode === 'original' ? 'Master View' : 'Watermarked') : 'Original'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalDesigns > pageSize && (
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0]">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalDesigns}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
            pageSizeOptions={[12, 24, 48, 96]}
            itemName="jewellery designs"
          />
        </div>
      )}

      {/* Compare Modal */}
      {previewDesign && (
        <Modal
          isOpen={!!previewDesign}
          onClose={() => setPreviewDesign(null)}
          title={`Jewellery Inspection: ${previewDesign.filename}`}
          description={`SKU: ${previewDesign.sku || 'N/A'}`}
          maxWidth="max-w-6xl"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 bg-[#F8FAFC] p-2.5 rounded-xl border border-[#E2E8F0] overflow-x-auto">
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  className="whitespace-nowrap"
                  variant={compareMode === 'watermarked' ? 'primary' : 'outline'}
                  onClick={() => setCompareMode('watermarked')}
                >
                  Watermarked Version
                </Button>
                <Button
                  size="sm"
                  className="whitespace-nowrap"
                  variant={compareMode === 'original' ? 'primary' : 'outline'}
                  onClick={() => setCompareMode('original')}
                >
                  Original Master
                </Button>
                {previewDesign.activeProcessedAssetId && (
                  <Button
                    size="sm"
                    className="whitespace-nowrap"
                    variant={compareMode === 'split' ? 'primary' : 'outline'}
                    onClick={() => setCompareMode('split')}
                  >
                    <SplitSquareVertical className="w-3.5 h-3.5 mr-1" />
                    Side-by-Side Compare
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {canProcess && (
                  <Button
                    size="sm"
                    variant="primary"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold whitespace-nowrap"
                    onClick={() => {
                      setWatermarkTarget(previewDesign);
                    }}
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1 text-emerald-200" />{' '}
                    {previewDesign.mediaType === 'video' ? 'Watermark Video' : 'Watermark Image'}
                  </Button>
                )}

                {previewDesign.originalAssetId && canDownloadMaster && (
                  <a
                    href={assetsApi.getDownloadUrl(previewDesign.originalAssetId)}
                    download={
                      previewDesign.filename ||
                      (previewDesign.mediaType === 'video' ? 'jewellery_master.mp4' : 'jewellery_master.webp')
                    }
                    onClick={() => {
                      setDownloadToast(`✓ Downloading Original Master: ${previewDesign.filename}`);
                      setTimeout(() => setDownloadToast(null), 3000);
                    }}
                    className="flex-shrink-0"
                  >
                    <Button size="sm" variant="outline" className="whitespace-nowrap">
                      <Images className="w-3.5 h-3.5 mr-1" /> Original Master
                    </Button>
                  </a>
                )}

                {previewDesign.activeProcessedAssetId && canDownloadSingle && (
                  <a
                    href={assetsApi.getDownloadUrl(previewDesign.activeProcessedAssetId)}
                    download={
                      previewDesign.filename ||
                      (previewDesign.mediaType === 'video' ? 'jewellery_watermarked.mp4' : 'jewellery_watermarked.webp')
                    }
                    onClick={() => {
                      setDownloadToast(`✓ Downloading Watermarked: ${previewDesign.filename}`);
                      setTimeout(() => setDownloadToast(null), 3000);
                    }}
                    className="flex-shrink-0"
                  >
                    <Button size="sm" variant="gold" className="whitespace-nowrap">
                      <Download className="w-3.5 h-3.5 mr-1" /> Watermarked Copy
                    </Button>
                  </a>
                )}

                {previewDesign.mediaType !== 'video' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#7C3AED]/40 text-[#7C3AED] hover:bg-purple-50 font-semibold whitespace-nowrap flex-shrink-0"
                    onClick={() => setResizeTargetDesign(previewDesign)}
                  >
                    <Layers className="w-3.5 h-3.5 mr-1 text-[#7C3AED]" /> Auto-Resize (Social / E-Com)
                  </Button>
                )}

                {canDelete && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#DC2626] text-[#DC2626] hover:bg-rose-50 font-semibold whitespace-nowrap flex-shrink-0"
                    onClick={() => {
                      setDeleteDesignTarget(previewDesign);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1 text-[#DC2626]" /> Delete Design
                  </Button>
                )}
              </div>
            </div>

            {compareMode === 'split' ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 text-center">
                  <span className="text-xs font-semibold text-[#64748B]">Original Master</span>
                  <div className="aspect-square bg-black rounded-xl overflow-hidden border border-[#E2E8F0] flex items-center justify-center">
                    {previewDesign.mediaType === 'video' ? (
                      <CustomVideoPlayer
                        src={assetsApi.getViewUrl(previewDesign.originalAssetId)}
                        compact={true}
                        title={`Master: ${previewDesign.filename}`}
                        className="w-full h-full"
                      />
                    ) : (
                      <img
                        src={assetsApi.getViewUrl(previewDesign.originalAssetId)}
                        alt="Original"
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-1 text-center">
                  <span className="text-xs font-semibold text-[#7C3AED]">Watermarked Copy</span>
                  <div className="aspect-square bg-black rounded-xl overflow-hidden border border-[#E2E8F0] flex items-center justify-center">
                    {previewDesign.mediaType === 'video' ? (
                      previewDesign.activeProcessedAssetId ? (
                        <CustomVideoPlayer
                          src={assetsApi.getViewUrl(previewDesign.activeProcessedAssetId)}
                          compact={true}
                          title={`Watermarked: ${previewDesign.filename}`}
                          className="w-full h-full"
                        />
                      ) : (
                        <div className="text-center p-4 text-xs text-slate-400">
                          Not watermarked yet
                        </div>
                      )
                    ) : (
                      <img
                        src={assetsApi.getViewUrl(previewDesign.activeProcessedAssetId)}
                        alt="Watermarked"
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="aspect-video max-h-[560px] bg-black rounded-xl overflow-hidden border border-[#E2E8F0] flex items-center justify-center">
                {previewDesign.mediaType === 'video' ? (
                  <CustomVideoPlayer
                    key={`${previewDesign._id}-${compareMode}`}
                    src={
                      compareMode === 'watermarked' && previewDesign.activeProcessedAssetId
                        ? assetsApi.getViewUrl(previewDesign.activeProcessedAssetId)
                        : assetsApi.getViewUrl(previewDesign.originalAssetId)
                    }
                    title={previewDesign.filename}
                    className="w-full h-full"
                  />
                ) : (
                  <img
                    src={
                      compareMode === 'watermarked' && previewDesign.activeProcessedAssetId
                        ? assetsApi.getViewUrl(previewDesign.activeProcessedAssetId)
                        : assetsApi.getViewUrl(previewDesign.originalAssetId)
                    }
                    alt="Jewel Preview"
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Single Media Watermark Modal */}
      {watermarkTarget && (
        <Modal
          isOpen={!!watermarkTarget}
          onClose={() => setWatermarkTarget(null)}
          title={`Watermark Single Jewellery ${watermarkTarget.mediaType === 'video' ? 'Video' : 'Image'}`}
          description={`Select a watermark template to apply to this jewellery ${watermarkTarget.mediaType === 'video' ? 'showcase video' : 'image'}.`}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4">
            {/* Media Preview Banner */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <div className="w-14 h-14 rounded-lg bg-black/5 overflow-hidden flex items-center justify-center shrink-0 border border-[#E2E8F0] relative">
                {watermarkTarget.mediaType === 'video' ? (
                  watermarkTarget.thumbnailAssetId ? (
                    <img
                      src={assetsApi.getViewUrl(watermarkTarget.thumbnailAssetId)}
                      alt={watermarkTarget.filename}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <video
                      src={assetsApi.getViewUrl(watermarkTarget.originalAssetId)}
                      muted
                      className="w-full h-full object-contain"
                    />
                  )
                ) : (
                  <img
                    src={assetsApi.getViewUrl(watermarkTarget.originalAssetId)}
                    alt={watermarkTarget.filename}
                    className="w-full h-full object-contain"
                  />
                )}
                {watermarkTarget.mediaType === 'video' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/35 pointer-events-none">
                    <Play className="w-4 h-4 text-white fill-white" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-[#1E293B] truncate flex items-center gap-1.5">
                  <span className="truncate">{watermarkTarget.filename}</span>
                  {watermarkTarget.mediaType === 'video' && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 shrink-0">
                      VIDEO
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-[#64748B] font-mono mt-0.5">
                  SKU: {watermarkTarget.sku || 'N/A'}
                </div>
                <div className="mt-1">
                  <Badge variant={watermarkTarget.processingStatus === 'processed' ? 'success' : 'neutral'} size="sm">
                    {watermarkTarget.processingStatus === 'processed' ? 'Currently Watermarked' : 'Unprocessed'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Template Selector */}
            <div>
              <label className="block text-xs font-semibold text-[#1E293B] font-heading mb-1.5">
                Choose Watermark Template *
              </label>
              {templates.length === 0 ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  No saved templates found. Please create one in Watermark Studio first.
                </div>
              ) : (
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl bg-white focus:outline-none focus:border-[#7C3AED] font-semibold text-[#1E293B]"
                >
                  {templates.map((tmpl) => (
                    <option key={tmpl._id} value={tmpl._id}>
                      {tmpl.name} ({tmpl.watermarkType}) {tmpl.isDefault ? '• [Company Default]' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Option to customize in studio */}
            <div className="flex items-center justify-between text-xs text-[#64748B] pt-1">
              <span>Need custom positioning?</span>
              <button
                type="button"
                onClick={() => {
                  const target = watermarkTarget;
                  setWatermarkTarget(null);
                  handleOpenInEditor(target);
                }}
                className="text-[#7C3AED] font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Open in Watermark Studio</span>
                <span>→</span>
              </button>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2.5">
              <Button
                variant="outline"
                size="md"
                onClick={() => setWatermarkTarget(null)}
                disabled={watermarkingSingle}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={watermarkingSingle || templates.length === 0}
                onClick={handleSingleWatermark}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5 text-emerald-200" />
                {watermarkingSingle ? 'Applying...' : 'Apply Watermark Now'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reusable Confirm Delete Modal (Single) */}
      <ConfirmDeleteModal
        isOpen={!!deleteDesignTarget}
        onClose={() => setDeleteDesignTarget(null)}
        onConfirm={confirmDeleteDesign}
        title="Delete Jewellery Design?"
        description="Are you sure you want to delete this jewellery design and its processed images? This will permanently remove the original and watermarked assets from storage."
        itemName={deleteDesignTarget?.filename || deleteDesignTarget?.sku}
        confirmText="Delete Design"
        loading={deleting}
      />

      {/* Reusable Confirm Delete Modal (Bulk / Multi) */}
      <ConfirmDeleteModal
        isOpen={isBulkDeleteOpen}
        onClose={() => setIsBulkDeleteOpen(false)}
        onConfirm={handleBulkDelete}
        title={`Delete ${selectedIds.length} Jewellery Designs?`}
        description={`Are you sure you want to permanently delete these ${selectedIds.length} selected jewellery designs? This will remove all master photos and watermarked copies from storage.`}
        itemName={`${selectedIds.length} jewellery design${selectedIds.length > 1 ? 's' : ''} selected`}
        confirmText={`Delete ${selectedIds.length} Design${selectedIds.length > 1 ? 's' : ''}`}
        loading={bulkDeleting}
      />

      {/* Multi-Platform Auto-Resizer Modal (Single Item) */}
      {resizeTargetDesign && (
        <MultiPlatformResizeModal
          isOpen={!!resizeTargetDesign}
          onClose={() => setResizeTargetDesign(null)}
          design={resizeTargetDesign}
        />
      )}

      {/* Multi-Platform Auto-Resizer Modal (Batch Selection) */}
      {isBatchResizeOpen && (
        <MultiPlatformResizeModal
          isOpen={isBatchResizeOpen}
          onClose={() => setIsBatchResizeOpen(false)}
          selectedDesigns={designs.filter((d) => selectedIds.includes(d._id))}
        />
      )}

      {/* Floating Download Toast Notification */}
      {downloadToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1E293B] text-white px-4 py-3 rounded-xl shadow-2xl border border-white/10 flex items-center gap-3 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
          <span>{downloadToast}</span>
        </div>
      )}
    </div>
  );
};
