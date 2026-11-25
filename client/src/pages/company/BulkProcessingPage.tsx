import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Cpu,
  Stamp,
  FolderKanban,
  Images,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Sparkles,
  CheckSquare,
  Square,
  Search,
  Check,
  X,
  ChevronDown,
  Video,
  Play,
} from 'lucide-react';
import { designsApi, templatesApi, projectsApi, processingApi, assetsApi } from '../../api/index.js';
import { Design, Project, WatermarkTemplate } from '../../types/index.js';
import { Card, Button, Badge } from '../../components/common/index.js';
import { useAuthStore } from '../../store/authStore.js';

export const BulkProcessingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialDesignIds = searchParams.get('designIds')?.split(',').filter(Boolean) || [];
  const initialTemplateId = searchParams.get('templateId') || '';

  const { role, company, permissions } = useAuthStore();
  const navigate = useNavigate();

  const canProcess =
    role === 'Company' || (role === 'Designer' && permissions?.canProcess !== false);

  const [designs, setDesigns] = useState<Design[]>([]);
  const [templates, setTemplates] = useState<WatermarkTemplate[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [selectedDesignIds, setSelectedDesignIds] = useState<string[]>(initialDesignIds);
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialTemplateId);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Accordion open/close states
  const [isStep1Open, setIsStep1Open] = useState(true);
  const [isStep2Open, setIsStep2Open] = useState(true);
  const [isStep3Open, setIsStep3Open] = useState(true);
  const [isGridExpanded, setIsGridExpanded] = useState(true);

  const [outputFormat, setOutputFormat] = useState<'jpeg' | 'png' | 'webp'>(
    company?.settings?.defaultOutputFormat || 'jpeg'
  );
  const [outputQuality, setOutputQuality] = useState(company?.settings?.defaultQuality ?? 90);
  const [stripMetadata, setStripMetadata] = useState(company?.settings?.sanitizeMetadata ?? true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canProcess) return;
    Promise.all([
      designsApi.list({ limit: 500 }),
      templatesApi.list(),
      projectsApi.list(),
    ]).then(([dRes, tRes, pRes]) => {
      const allDesigns = dRes.data.data || [];
      setDesigns(allDesigns);
      const tmpls = tRes.data.data || [];
      setTemplates(tmpls);
      const projs = pRes.data.data || [];
      setProjects(projs);

      if (!selectedTemplateId && tmpls.length > 0) {
        const def = tmpls.find((t: WatermarkTemplate) => t.isDefault) || tmpls[0];
        setSelectedTemplateId(def._id);
      }

      // If initialDesignIds passed in query (e.g. from gallery selection), preserve them;
      // otherwise keep selection empty by default (0 selected)
      if (initialDesignIds.length > 0) {
        setSelectedDesignIds(initialDesignIds);
      } else {
        setSelectedDesignIds([]);
      }
    });
  }, [canProcess]);

  if (!canProcess) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-[#1E293B] font-heading">Access Restricted</h2>
        <p className="text-xs text-[#64748B]">
          Your role does not have permission to execute bulk watermark processing batches.
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </div>
    );
  }

  // When project selector changes, update filter view without forcing selection
  const handleProjectSelect = (projId: string) => {
    setSelectedProjectId(projId);
  };

  // Filtered designs for current view
  const visibleDesigns = designs.filter((d) => {
    const matchesProject =
      !selectedProjectId ||
      d.projectId?._id === selectedProjectId ||
      d.projectId === selectedProjectId;
    if (!matchesProject) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (d.filename || '').toLowerCase().includes(q) ||
      (d.sku || '').toLowerCase().includes(q)
    );
  });

  const visibleSelectedCount = visibleDesigns.filter((d) =>
    selectedDesignIds.includes(d._id)
  ).length;

  const allVisibleSelected =
    visibleDesigns.length > 0 && visibleSelectedCount === visibleDesigns.length;

  // Toggle individual design selection
  const handleToggleDesign = (designId: string) => {
    setSelectedDesignIds((prev) =>
      prev.includes(designId)
        ? prev.filter((id) => id !== designId)
        : [...prev, designId]
    );
  };

  // Select all in current view
  const handleSelectAllInView = () => {
    const visibleIds = visibleDesigns.map((d) => d._id);
    setSelectedDesignIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
  };

  // Deselect all in current view
  const handleDeselectAllInView = () => {
    const visibleIdSet = new Set(visibleDesigns.map((d) => d._id));
    setSelectedDesignIds((prev) => prev.filter((id) => !visibleIdSet.has(id)));
  };

  const handleLaunchBatch = async () => {
    if (selectedDesignIds.length === 0) {
      setError('Please select at least one jewellery design to process.');
      return;
    }
    if (!selectedTemplateId) {
      setError('Please choose a watermark template.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await processingApi.createBatch({
        designIds: selectedDesignIds,
        templateId: selectedTemplateId,
        outputSettings: {
          format: outputFormat,
          quality: Number(outputQuality),
          stripMetadata,
        },
      });

      const batchId = res.data.data._id;
      const historyPath =
        role === 'Company' ? '/company/history' : '/designer/history';
      navigate(`${historyPath}?activeBatch=${batchId}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to start processing batch.');
      setSubmitting(false);
    }
  };

  const selectedTemplate = templates.find((t) => t._id === selectedTemplateId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B] font-heading">
          Bulk Watermark Processing
        </h1>
        <p className="text-xs text-[#64748B] mt-0.5">
          Apply a saved watermark configuration automatically across multiple jewellery catalogue images.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/20 flex items-center gap-2 text-xs text-[#DC2626]">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Select Images or Collection */}
      <Card className="space-y-4">
        {/* Accordion Header */}
        <div
          onClick={() => setIsStep1Open(!isStep1Open)}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#E2E8F0] cursor-pointer select-none group"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#7C3AED] text-white flex items-center justify-center text-xs font-bold font-heading">
              1
            </div>
            <h3 className="text-sm font-bold text-[#1E293B] font-heading group-hover:text-[#7C3AED] transition">
              Select Images or Collection
            </h3>
          </div>
          <div className="flex items-center gap-2.5">
            <Badge
              variant={selectedDesignIds.length > 0 ? 'primary' : 'neutral'}
              size="md"
            >
              {selectedDesignIds.length > 0
                ? `${selectedDesignIds.length} Target Images Selected`
                : 'No Images Selected'}
            </Badge>
            <div
              className="w-7 h-7 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] group-hover:border-[#7C3AED]/40 group-hover:bg-[#7C3AED]/5 flex items-center justify-center text-[#64748B] group-hover:text-[#7C3AED] transition"
              title={isStep1Open ? 'Click arrow to collapse Step 1' : 'Click arrow to open Step 1'}
            >
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  isStep1Open ? 'rotate-180' : ''
                }`}
              />
            </div>
          </div>
        </div>

        {/* Collapsed Step 1 summary when isStep1Open is false */}
        {!isStep1Open && (
          <div
            onClick={() => setIsStep1Open(true)}
            className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] hover:bg-[#F1F5F9] cursor-pointer transition flex flex-wrap items-center justify-between gap-2 text-xs"
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#1E293B]">
                {selectedProjectId
                  ? projects.find((p) => p._id === selectedProjectId)?.name || 'Selected Collection'
                  : 'All Collections'}
              </span>
              <span className="text-[#94A3B8]">•</span>
              <span className="text-[#7C3AED] font-bold">
                {selectedDesignIds.length} images staged for watermarking
              </span>
            </div>
            <span className="text-[11px] font-semibold text-[#7C3AED]">
              Click arrow to expand & customize
            </span>
          </div>
        )}

        {/* Step 1 Body */}
        {isStep1Open && (
          <div className="space-y-4">
            {/* Collection Dropdown & Quick Search */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#1E293B] font-heading mb-1">
                  Select an Entire Collection
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => handleProjectSelect(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg bg-white font-semibold text-[#1E293B] focus:outline-none focus:border-[#7C3AED]"
                >
                  <option value="">All Collections ({designs.length} images)</option>
                  {projects.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.designsCount || 0} images)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E293B] font-heading mb-1">
                  Filter by Name or SKU
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search jewellery filename or SKU..."
                    className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#7C3AED]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#1E293B]"
                      aria-label="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Action Controls & Accordion Toggle Bar for Staged Images */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 pb-1 border-t border-[#E2E8F0] text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsGridExpanded(!isGridExpanded)}
                  className="flex items-center gap-1.5 font-bold text-[#1E293B] hover:text-[#7C3AED] transition cursor-pointer select-none"
                  title={isGridExpanded ? 'Click arrow to close grid view' : 'Click arrow to open grid view'}
                >
                  <span>Showing <span className="text-[#1E293B]">{visibleDesigns.length}</span> images:</span>
                  <span className="text-[#7C3AED] font-bold">{visibleSelectedCount} selected</span>
                  <div
                    className={`w-5 h-5 rounded-md bg-[#F1F5F9] text-[#7C3AED] flex items-center justify-center transition-transform duration-200 ${
                      isGridExpanded ? 'rotate-180' : ''
                    }`}
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </div>
                </button>
                {selectedDesignIds.length > visibleSelectedCount && (
                  <span className="text-[11px] text-[#94A3B8]">
                    ({selectedDesignIds.length} total)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllInView}
                  disabled={allVisibleSelected || visibleDesigns.length === 0}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#7C3AED]/40 text-[#7C3AED] bg-[#7C3AED]/5 hover:bg-[#7C3AED]/15 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Select All ({visibleDesigns.length})</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeselectAllInView}
                  disabled={visibleSelectedCount === 0}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#E2E8F0] text-[#64748B] hover:text-[#DC2626] hover:border-[#DC2626]/30 hover:bg-[#DC2626]/5 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Deselect All</span>
                </button>

                {/* Direct Accordion Arrow Toggle Button */}
                <button
                  type="button"
                  onClick={() => setIsGridExpanded(!isGridExpanded)}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-[#7C3AED]/30 text-[#7C3AED] bg-[#7C3AED]/5 hover:bg-[#7C3AED]/15 transition flex items-center gap-1.5 cursor-pointer"
                  title={isGridExpanded ? 'Collapse grid to compact strip' : 'Expand full selection grid'}
                >
                  <span>{isGridExpanded ? 'Collapse' : 'Expand'}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isGridExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* If No Designs */}
            {visibleDesigns.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#64748B] bg-[#F8FAFC] rounded-xl border border-dashed border-[#CBD5E1]">
                <Images className="w-8 h-8 text-[#CBD5E1] mx-auto mb-2" />
                <div className="font-semibold text-[#1E293B]">No jewellery images found</div>
                <div className="text-[11px] mt-0.5">
                  {searchQuery ? 'Try clearing your search query.' : 'This collection has no images yet.'}
                </div>
              </div>
            ) : isGridExpanded ? (
              /* Expanded: Multi-Column Interactive Design Selection Grid */
              <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 max-h-[380px] overflow-y-auto p-2 border border-[#E2E8F0] rounded-xl bg-[#F8FAFC]/50">
                {visibleDesigns.map((d) => {
                  const isSelected = selectedDesignIds.includes(d._id);
                  const isVideo = d.mediaType === 'video';
                  const previewUrl = d.thumbnailAssetId
                    ? assetsApi.getViewUrl(d.thumbnailAssetId)
                    : assetsApi.getViewUrl(d.originalAssetId);

                  return (
                    <div
                      key={d._id}
                      onClick={() => handleToggleDesign(d._id)}
                      className={`group relative rounded-xl border p-2 cursor-pointer transition flex flex-col justify-between select-none ${
                        isSelected
                          ? 'border-[#7C3AED] bg-white ring-2 ring-[#7C3AED]/25 shadow-xs'
                          : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1] hover:shadow-xs opacity-80 hover:opacity-100'
                      }`}
                      title={`${d.filename} — Click to ${isSelected ? 'unselect' : 'select'}`}
                    >
                      {/* Top: Selection Checkbox & SKU */}
                      <div className="flex items-center justify-between mb-1.5">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center transition ${
                            isSelected
                              ? 'bg-[#7C3AED] text-white shadow-xs'
                              : 'border border-[#CBD5E1] bg-white group-hover:border-[#7C3AED]'
                          }`}
                        >
                          {isSelected ? (
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          ) : null}
                        </div>

                        {d.sku && (
                          <span className="font-mono text-[9px] font-bold text-[#64748B] bg-[#F1F5F9] px-1 py-0.5 rounded truncate max-w-[70px]">
                            {d.sku}
                          </span>
                        )}
                      </div>

                      {/* Jewellery Media Thumbnail */}
                      <div className="aspect-square w-full rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] overflow-hidden flex items-center justify-center mb-1.5 relative">
                        {isVideo ? (
                          d.thumbnailAssetId ? (
                            <img
                              src={assetsApi.getViewUrl(d.thumbnailAssetId)}
                              alt={d.filename}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                              loading="lazy"
                            />
                          ) : (
                            <video
                              src={assetsApi.getViewUrl(d.originalAssetId)}
                              muted
                              className="w-full h-full object-cover pointer-events-none"
                            />
                          )
                        ) : previewUrl ? (
                          <img
                            src={previewUrl}
                            alt={d.filename}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                            loading="lazy"
                          />
                        ) : (
                          <Images className="w-6 h-6 text-[#CBD5E1]" />
                        )}

                        {isVideo && (
                          <div className="absolute bottom-1 left-1 bg-black/75 text-white text-[9px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5 shadow-xs">
                            <Play className="w-2 h-2 fill-white" />
                            <span>{d.metadata?.duration ? `${Math.round(d.metadata.duration)}s` : 'VIDEO'}</span>
                          </div>
                        )}
                      </div>

                      {/* Filename & Processing Status */}
                      <div className="min-w-0">
                        <div
                          className={`text-[11px] font-semibold truncate ${
                            isSelected ? 'text-[#1E293B]' : 'text-[#64748B]'
                          }`}
                          title={d.filename}
                        >
                          {d.filename}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[#94A3B8] mt-0.5">
                          <span className={d.processingStatus === 'processed' ? 'text-[#16A34A] font-medium' : ''}>
                            {d.processingStatus === 'processed' ? 'Watermarked' : 'Unprocessed'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Collapsed: Compact Single-Row Thumbnail Strip */
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                  <span>Staged Designs Preview (Click any thumbnail to toggle, or click arrow to expand):</span>
                  <button
                    type="button"
                    onClick={() => setIsGridExpanded(true)}
                    className="font-semibold text-[#7C3AED] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Expand Grid View</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
                  {visibleDesigns.map((d) => {
                    const isSelected = selectedDesignIds.includes(d._id);
                    const previewUrl = d.thumbnailAssetId
                      ? assetsApi.getViewUrl(d.thumbnailAssetId)
                      : assetsApi.getViewUrl(d.originalAssetId);
                    return (
                      <div
                        key={d._id}
                        onClick={() => handleToggleDesign(d._id)}
                        className={`relative flex-shrink-0 w-14 h-14 rounded-lg border p-1 cursor-pointer transition select-none ${
                          isSelected
                            ? 'border-[#7C3AED] ring-2 ring-[#7C3AED]/25 bg-white shadow-xs'
                            : 'border-[#CBD5E1] bg-white opacity-40 hover:opacity-80'
                        }`}
                        title={`${d.filename} — Click to ${isSelected ? 'unselect' : 'select'}`}
                      >
                        <div className="w-full h-full rounded overflow-hidden flex items-center justify-center bg-[#F1F5F9]">
                          {d.mediaType === 'video' ? (
                            d.thumbnailAssetId ? (
                              <img
                                src={assetsApi.getViewUrl(d.thumbnailAssetId)}
                                alt={d.filename}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <video
                                src={assetsApi.getViewUrl(d.originalAssetId)}
                                muted
                                className="w-full h-full object-cover pointer-events-none"
                              />
                            )
                          ) : previewUrl ? (
                            <img
                              src={previewUrl}
                              alt={d.filename}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <Images className="w-4 h-4 text-[#CBD5E1]" />
                          )}
                        </div>
                        {isSelected && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#7C3AED] text-white rounded-full flex items-center justify-center shadow-xs">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Step 2: Select Watermark Template */}
      <Card className="space-y-4">
        <div
          onClick={() => setIsStep2Open(!isStep2Open)}
          className="flex items-center justify-between pb-2 border-b border-[#E2E8F0] cursor-pointer select-none group"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#7C3AED] text-white flex items-center justify-center text-xs font-bold font-heading">
              2
            </div>
            <h3 className="text-sm font-bold text-[#1E293B] font-heading group-hover:text-[#7C3AED] transition">
              Choose Watermark Template
            </h3>
          </div>
          <div className="flex items-center gap-2.5">
            {selectedTemplate && (
              <span className="text-xs font-semibold text-[#7C3AED] bg-[#7C3AED]/10 px-2.5 py-1 rounded-full">
                {selectedTemplate.name}
              </span>
            )}
            <div
              className="w-7 h-7 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] group-hover:border-[#7C3AED]/40 group-hover:bg-[#7C3AED]/5 flex items-center justify-center text-[#64748B] group-hover:text-[#7C3AED] transition"
              title={isStep2Open ? 'Click arrow to collapse Step 2' : 'Click arrow to open Step 2'}
            >
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  isStep2Open ? 'rotate-180' : ''
                }`}
              />
            </div>
          </div>
        </div>

        {!isStep2Open && selectedTemplate && (
          <div
            onClick={() => setIsStep2Open(true)}
            className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] hover:bg-[#F1F5F9] cursor-pointer transition flex items-center justify-between text-xs"
          >
            <div>
              Preset: <span className="font-semibold text-[#1E293B]">{selectedTemplate.name}</span>{' '}
              <span className="text-[#64748B]">
                ({selectedTemplate.configuration?.positionPreset || 'custom'},{' '}
                {selectedTemplate.configuration?.scalingPolicy || 'relative'})
              </span>
            </div>
            <span className="text-[11px] font-semibold text-[#7C3AED]">
              Click arrow to change template
            </span>
          </div>
        )}

        {isStep2Open && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {templates.map((tmpl) => (
              <div
                key={tmpl._id}
                onClick={() => setSelectedTemplateId(tmpl._id)}
                className={`p-3 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                  selectedTemplateId === tmpl._id
                    ? 'border-[#7C3AED] bg-[#7C3AED]/5 ring-2 ring-[#7C3AED]/20'
                    : 'border-[#E2E8F0] hover:border-[#CBD5E1] bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-[#1E293B] font-heading truncate">
                      {tmpl.name}
                    </span>
                    {tmpl.isDefault && (
                      <Badge variant="gold" size="sm">
                        Default
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-[#64748B] line-clamp-1">
                    {tmpl.description || 'Watermark preset'}
                  </p>
                </div>

                <div className="mt-2 text-[10px] text-[#64748B] flex items-center justify-between pt-1 border-t border-[#F1F5F9]">
                  <span className="capitalize">{tmpl.configuration?.positionPreset}</span>
                  <span className="capitalize">{tmpl.configuration?.scalingPolicy}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Step 3: Configure Output Settings */}
      <Card className="space-y-4">
        <div
          onClick={() => setIsStep3Open(!isStep3Open)}
          className="flex items-center justify-between pb-2 border-b border-[#E2E8F0] cursor-pointer select-none group"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#7C3AED] text-white flex items-center justify-center text-xs font-bold font-heading">
              3
            </div>
            <h3 className="text-sm font-bold text-[#1E293B] font-heading group-hover:text-[#7C3AED] transition">
              Output Settings & Compression
            </h3>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-semibold text-[#1E293B] bg-[#F1F5F9] px-2.5 py-1 rounded-full uppercase">
              {outputFormat} · {outputQuality}%
            </span>
            <div
              className="w-7 h-7 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] group-hover:border-[#7C3AED]/40 group-hover:bg-[#7C3AED]/5 flex items-center justify-center text-[#64748B] group-hover:text-[#7C3AED] transition"
              title={isStep3Open ? 'Click arrow to collapse Step 3' : 'Click arrow to open Step 3'}
            >
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  isStep3Open ? 'rotate-180' : ''
                }`}
              />
            </div>
          </div>
        </div>

        {!isStep3Open && (
          <div
            onClick={() => setIsStep3Open(true)}
            className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] hover:bg-[#F1F5F9] cursor-pointer transition flex items-center justify-between text-xs"
          >
            <div>
              Format: <span className="font-semibold text-[#1E293B] uppercase">{outputFormat}</span>{' '}
              at <span className="font-semibold text-[#1E293B]">{outputQuality}%</span> quality{' '}
              <span className="text-[#64748B]">
                ({stripMetadata ? 'EXIF metadata stripped' : 'EXIF preserved'})
              </span>
            </div>
            <span className="text-[11px] font-semibold text-[#7C3AED]">
              Click arrow to adjust settings
            </span>
          </div>
        )}

        {isStep3Open && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1E293B] font-heading mb-1">
                  Render Format
                </label>
                <select
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg bg-white font-semibold focus:outline-none focus:border-[#7C3AED]"
                >
                  <option value="jpeg">JPEG (High Compatibility)</option>
                  <option value="png">PNG (Preserve Transparency)</option>
                  <option value="webp">WebP (Modern Compact High Quality)</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-[#1E293B] font-heading mb-1">
                  <span>Quality Factor</span>
                  <span className="text-[#7C3AED] font-bold">{outputQuality}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="100"
                  step="5"
                  value={outputQuality}
                  onChange={(e) => setOutputQuality(parseInt(e.target.value, 10))}
                  className="w-full accent-[#7C3AED]"
                />
              </div>
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] cursor-pointer hover:bg-[#F1F5F9] transition">
              <input
                type="checkbox"
                checked={stripMetadata}
                onChange={(e) => setStripMetadata(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-[#7C3AED] focus:ring-[#7C3AED] border-[#CBD5E1]"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-[#1E293B] block">
                  Strip EXIF camera metadata to preserve production privacy
                </span>
                <p className="text-[11px] text-[#64748B] leading-relaxed">
                  Removes sensitive camera equipment tags, workshop GPS coordinates, exact timestamps, and editing software metadata from output images so clients and competitors cannot trace your manufacturing origins.
                </p>
              </div>
            </label>
          </div>
        )}
      </Card>

      {/* Launch Action */}
      <div className="flex justify-end pt-2">
        <Button
          type="button"
          disabled={submitting || selectedDesignIds.length === 0}
          variant="gold"
          size="lg"
          onClick={handleLaunchBatch}
        >
          <Sparkles className="w-4 h-4 mr-1.5" />
          {submitting
            ? 'Queueing Batch...'
            : `Start Batch Watermarking (${selectedDesignIds.length} Images)`}
        </Button>
      </div>
    </div>
  );
};
